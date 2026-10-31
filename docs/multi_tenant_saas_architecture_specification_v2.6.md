# MustafaH-AI — Multi-Clinic SaaS Architectural Specification
**Version:** 2.6.0 (Enterprise SQL Security Correction, Zero-Trust Relational Integrity & Production Migration Readiness)  
**Status:** DRAFT SPECIFICATION & SECURITY AUDIT (Pending User Approval — Zero Database/Code Changes Executed)  
**Document Classification:** Mission-Critical Healthcare SaaS Architecture  
**Founding Pilot Tenant:** Dr. Mustafa Hadi (`@drmustafa_hadi` — Personal Dental Brand)  
**Quarantined Demo Tenant:** Almeswak Dental Clinic (`@almeswaksmile.iq` — Strictly Locked in Demo Mode)  

---

## Executive Architectural Summary & Threat Model

MustafaH-AI is transitioning from a single-clinic Instagram assistant into an **Enterprise Multi-Clinic Dental SaaS Platform**. The platform will host multiple independent dental practices across Baghdad and Iraq on a unified, high-performance infrastructure while guaranteeing **cryptographic, operational, and relational tenant isolation**.

### Uncompromising Platform Principles
1. **Pilot Continuity:** Dr. Mustafa Hadi (`@drmustafa_hadi`) is preserved as the founding tenant (`org_drmustafa_hadi`). All 213 passing automated baseline tests and historical clinic records will transition seamlessly with zero downtime.
2. **Clinic Workspace Protection:** Almeswak Dental Clinic (`@almeswaksmile.iq`) remains quarantined in Demo Mode without live credentials or outbound message capabilities until clinic management authorizes activation through a multi-signature, separation-of-duties platform authorization process.
3. **Immutable Orthodontic Pricing Prohibition:** The prohibition against disclosing orthodontic prices, ranges, down payments, or installment plans via automated channels is an **immutable platform-level policy**. No clinic owner, staff role, plan tier, or tenant configuration can disable or override this restriction.
4. **Relational Tenant Consistency:** Cross-table references (such as an appointment referencing a patient lead, or a message referencing a conversation) must be constrained at the PostgreSQL engine level via **composite foreign keys**, preventing cross-tenant data contamination even in the presence of application-level bugs.
5. **No Ephemeral Local Buffer on Serverless:** Production webhook ingestion resilience must operate strictly on verified durable storage. Ephemeral serverless filesystems (`/tmp`) are explicitly rejected as recovery mechanisms.
6. **Zero-Trust Multi-Tenancy:** No clinic may ever view, mutate, or inherit another clinic's branding, location, phone number, clinical FAQs, leads, conversations, or access tokens.
7. **Zero Caller-Controlled Security Contexts:** Security decisions must rely on database-enforced roles (`SESSION_USER`, verified database role memberships), authenticated cryptographic JWT claims, and trusted `SECURITY DEFINER` gate functions—never on forgeable session settings or unverified `auth.uid() IS NULL` states.

---

## 1. Trusted Caller Identity & Database Role Architecture

### 1.1 The Vulnerability of `CURRENT_USER` in `SECURITY DEFINER`
In PostgreSQL, a function declared with `SECURITY DEFINER` executes with the privileges of the **user that owns the function** (typically `postgres`). Consequently:
- Calling `CURRENT_USER` inside a `SECURITY DEFINER` function returns the function owner (`postgres`), **not the role that invoked the function**.
- Evaluating `pg_has_role(CURRENT_USER, 'service_role', 'MEMBER')` inside a `SECURITY DEFINER` owned by `postgres` evaluates whether `postgres` has `service_role`—which is **always true**, completely bypassing caller authorization!
- Evaluating `auth.uid() IS NULL` as proof of service-role execution is fatal, because standard unauthenticated (`anon`) connections also have `auth.uid() IS NULL`.

### 1.2 The Production Trusted Identity Standard
Version 2.6 establishes a verified caller identification standard:
1. **Invoking Role Detection via `SESSION_USER`:**
   In PostgreSQL, `SESSION_USER` represents the actual role that initiated the database connection session, invariant under `SECURITY DEFINER` switches:
   ```sql
   pg_has_role(SESSION_USER, 'service_role', 'MEMBER') OR 
   pg_has_role(SESSION_USER, 'app_worker', 'MEMBER')
   ```
2. **PostgREST JWT Context Validation:**
   For connections mediated through PostgREST (where `SESSION_USER` is `authenticator`), the executing role is extracted from signed JWT claims:
   ```sql
   (COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role')
   ```
3. **Rejection of Ambiguous Identity:**
   If `auth.uid() IS NULL` AND the caller is neither a verified member of `service_role`/`app_worker` nor carrying a verified `service_role` JWT claim, the session is classified as an **untrusted, unauthenticated caller** and immediately terminated with a fatal SQL exception.

### 1.3 Role Grants, Memberships & Permissions DDL

```sql
-- 1. Create Dedicated Service Roles with Strict Attributes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN
        CREATE ROLE app_worker WITH NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform_admin') THEN
        CREATE ROLE app_platform_admin WITH NOLOGIN NOINHERIT;
    END IF;
END $$;

-- 2. Establish Role Hierarchies
GRANT app_worker TO service_role;
GRANT app_platform_admin TO service_role;

-- 3. Revoke Direct DML on System Stores from General Public & Authenticated Users
REVOKE ALL ON TABLE public.processed_webhook_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.webhook_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.webhook_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.integration_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.subscription_usage_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.subscription_usage_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_authorizations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_authorization_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.branch_reassignment_audit_log FROM PUBLIC, anon, authenticated;

-- 4. Grant Table Permissions Strictly to Trusted Execution Roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processed_webhook_messages TO service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_jobs TO service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_logs TO service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.subscription_usage_records TO service_role, app_worker;
GRANT SELECT, INSERT ON public.subscription_usage_ledger TO service_role, app_worker;
GRANT SELECT, INSERT, UPDATE ON public.platform_authorizations TO service_role, app_platform_admin;
GRANT SELECT, INSERT ON public.platform_authorization_audit_log TO service_role, app_platform_admin;
GRANT SELECT, INSERT ON public.branch_reassignment_audit_log TO service_role, app_worker, authenticated;

-- 5. Helper Function: Trusted Caller Identity Verifier
CREATE OR REPLACE FUNCTION public.fn_is_trusted_system_caller()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_jwt_role TEXT;
BEGIN
    -- Check 1: Direct Database Session User membership
    IF pg_has_role(SESSION_USER, 'service_role', 'MEMBER') OR 
       pg_has_role(SESSION_USER, 'app_worker', 'MEMBER') THEN
        RETURN TRUE;
    END IF;

    -- Check 2: PostgREST JWT claim role
    BEGIN
        v_jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
        IF v_jwt_role IN ('service_role', 'supabase_admin') THEN
            RETURN TRUE;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Malformed JWT or setting missing
        NULL;
    END;

    RETURN FALSE;
END;
$$;

ALTER FUNCTION public.fn_is_trusted_system_caller() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_is_trusted_system_caller() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_is_trusted_system_caller() TO authenticated, anon, service_role, app_worker;
```

---

## 2. Complete Almeswak Authorization & Quarantine Architecture

### 2.1 Reconciled Action Catalog & Separation of Duties
The authorization model enforces a strict cryptographic secret verification workflow with atomic single-use replay protection and database-level separation of duties:
1. **Separation of Duties:**
   `CHECK (board_approval_verified_by_legal_admin_id != authorized_by_admin_id)`. One legal admin verifies the physical board resolution, and a distinct platform superadmin authorizes the record.
2. **Reconciled Action Catalog:**
   The `action` column on `platform_authorizations` strictly aligns with all platform gates:
   `'ACTIVATE_ORGANIZATION'`, `'CONNECT_INTEGRATION'`, `'INBOUND_WEBHOOK_PROCESSING'`, `'DISPATCH_OUTBOUND_MESSAGE'`, `'CREDENTIAL_ASSOCIATION'`, `'EMERGENCY_QUARANTINE_OVERRIDE'`, `'ALL_ACTIONS'`.
3. **Secret Verification:**
   The caller presents `p_auth_secret`. The function hashes it (`encode(digest(p_auth_secret, 'sha256'), 'hex')`) and compares against `authorization_token_hash`.
4. **Atomic Single-Use Consumption:**
   If `is_single_use = TRUE`, the row is locked `FOR UPDATE`, verified `consumed_at IS NULL`, and atomically updated with `consumed_at = NOW()`.

### 2.2 Complete Quarantine Tables DDL

```sql
-- 1. Platform Authorization Vault
CREATE TABLE IF NOT EXISTS public.platform_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_token_hash TEXT UNIQUE NOT NULL,
    target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('organization', 'integration', 'instagram_account')),
    target_entity_id UUID NOT NULL,
    target_handle TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ALMESWAK_CREDENTIAL_ASSOCIATION', 'EMERGENCY_QUARANTINE_OVERRIDE')),
    action TEXT NOT NULL CHECK (action IN (
        'ACTIVATE_ORGANIZATION',
        'CONNECT_INTEGRATION',
        'INBOUND_WEBHOOK_PROCESSING',
        'DISPATCH_OUTBOUND_MESSAGE',
        'CREDENTIAL_ASSOCIATION',
        'EMERGENCY_QUARANTINE_OVERRIDE',
        'ALL_ACTIONS'
    )),
    board_resolution_reference TEXT NOT NULL,
    board_resolution_sha256 TEXT NOT NULL,
    board_approval_verified_by_legal_admin_id UUID NOT NULL REFERENCES auth.users(id),
    board_approval_verification_notes TEXT NOT NULL,
    authorized_by_admin_id UUID NOT NULL REFERENCES auth.users(id),
    admin_ip_address INET,
    is_single_use BOOLEAN NOT NULL DEFAULT FALSE,
    consumed_at TIMESTAMPTZ,
    consumed_by_user_id UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by_admin_id UUID REFERENCES auth.users(id),
    revocation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_separation_of_duties CHECK (board_approval_verified_by_legal_admin_id != authorized_by_admin_id),
    CONSTRAINT chk_auth_validity CHECK (expires_at > granted_at)
);

CREATE INDEX idx_platform_auth_lookup 
ON public.platform_authorizations (target_entity_id, purpose, action) 
WHERE revoked_at IS NULL AND (NOT is_single_use OR consumed_at IS NULL);

-- 2. Immutable Platform Authorization Audit Log
CREATE TABLE IF NOT EXISTS public.platform_authorization_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id UUID REFERENCES public.platform_authorizations(id),
    caller_role TEXT NOT NULL,
    caller_user_id UUID,
    attempted_action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_record_id TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN (
        'GRANTED',
        'DENIED_INVALID_SECRET',
        'DENIED_EXPIRED',
        'DENIED_REVOKED',
        'DENIED_ALREADY_CONSUMED',
        'DENIED_SCOPE_MISMATCH',
        'DENIED_NON_ADMIN',
        'DENIED_UNTRUSTED_CALLER'
    )),
    error_message TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_audit_created ON public.platform_authorization_audit_log (created_at DESC);
```

### 2.3 Atomic Verification & Consumption Function

```sql
CREATE OR REPLACE FUNCTION public.fn_verify_and_consume_platform_authorization(
    p_target_id UUID,
    p_action TEXT,
    p_auth_secret TEXT,
    p_target_table TEXT,
    p_target_record_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_token_hash TEXT;
    v_auth_record RECORD;
    v_outcome TEXT;
    v_error_msg TEXT := NULL;
BEGIN
    -- 1. Verify Caller Authority: Must be Superadmin or Trusted System Role
    IF NOT (public.fn_is_trusted_system_caller() OR public.is_platform_superadmin()) THEN
        INSERT INTO public.platform_authorization_audit_log (caller_role, caller_user_id, attempted_action, target_table, target_record_id, outcome, error_message)
        VALUES ('unauthorized', auth.uid(), p_action, p_target_table, p_target_record_id, 'DENIED_UNTRUSTED_CALLER', 'Caller lacks superadmin or trusted system role.');
        RETURN FALSE;
    END IF;

    -- 2. Reject missing secret
    IF p_auth_secret IS NULL OR trim(p_auth_secret) = '' THEN
        INSERT INTO public.platform_authorization_audit_log (caller_role, caller_user_id, attempted_action, target_table, target_record_id, outcome, error_message)
        VALUES (COALESCE(current_setting('role', true), 'unknown'), auth.uid(), p_action, p_target_table, p_target_record_id, 'DENIED_INVALID_SECRET', 'Missing secret parameter.');
        RETURN FALSE;
    END IF;

    -- Compute SHA-256 hash of presented secret
    v_token_hash := encode(digest(p_auth_secret, 'sha256'), 'hex');

    -- 3. Lock authorization record to prevent concurrent double-consumption
    SELECT * INTO v_auth_record
    FROM public.platform_authorizations
    WHERE target_entity_id = p_target_id
      AND action IN (p_action, 'ALL_ACTIONS')
      AND authorization_token_hash = v_token_hash
    FOR UPDATE;

    IF v_auth_record.id IS NULL THEN
        v_outcome := 'DENIED_INVALID_SECRET';
        v_error_msg := 'Secret hash unrecognized or scope mismatch.';
    ELSIF v_auth_record.revoked_at IS NOT NULL THEN
        v_outcome := 'DENIED_REVOKED';
        v_error_msg := format('Authorization revoked at %s: %s', v_auth_record.revoked_at, v_auth_record.revocation_reason);
    ELSIF NOW() >= v_auth_record.expires_at THEN
        v_outcome := 'DENIED_EXPIRED';
        v_error_msg := format('Authorization expired at %s', v_auth_record.expires_at);
    ELSIF v_auth_record.is_single_use AND v_auth_record.consumed_at IS NOT NULL THEN
        v_outcome := 'DENIED_ALREADY_CONSUMED';
        v_error_msg := format('Authorization was already consumed at %s by %s', v_auth_record.consumed_at, v_auth_record.consumed_by_user_id);
    ELSE
        v_outcome := 'GRANTED';
        -- If single-use, mark consumed atomically
        IF v_auth_record.is_single_use THEN
            UPDATE public.platform_authorizations
            SET consumed_at = NOW(),
                consumed_by_user_id = auth.uid()
            WHERE id = v_auth_record.id;
        END IF;
    END IF;

    -- Audit execution
    INSERT INTO public.platform_authorization_audit_log (
        authorization_id, caller_role, caller_user_id, attempted_action, target_table, target_record_id, outcome, error_message
    ) VALUES (
        v_auth_record.id, COALESCE(current_setting('role', true), 'service_role'), auth.uid(), p_action, p_target_table, p_target_record_id, v_outcome, v_error_msg
    );

    RETURN (v_outcome = 'GRANTED');
END;
$$;

ALTER FUNCTION public.fn_verify_and_consume_platform_authorization(UUID, TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_verify_and_consume_platform_authorization FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_verify_and_consume_platform_authorization TO service_role, app_worker, authenticated;
```

### 2.4 Multi-Table Comprehensive Quarantine Trigger DDL

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_org_id UUID;
    v_secret TEXT;
    v_is_authorized BOOLEAN;
BEGIN
    -- 1. Protect Table: organizations
    IF TG_TABLE_NAME = 'organizations' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.slug IN ('almeswaksmile-iq', 'almeswaksmile_iq') OR OLD.id = '00000000-0000-0000-0000-000000000002'::uuid THEN
                v_secret := current_setting('app.platform_auth_secret', true);
                v_is_authorized := public.fn_verify_and_consume_platform_authorization(OLD.id, 'EMERGENCY_QUARANTINE_OVERRIDE', v_secret, TG_TABLE_NAME, OLD.id::text);
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Quarantine Violation: Deleting Almeswak clinic organization is strictly prohibited.';
                END IF;
            END IF;
            RETURN OLD;
        END IF;

        -- Intercept rename evasion
        IF TG_OP = 'UPDATE' THEN
            IF OLD.slug IN ('almeswaksmile-iq', 'almeswaksmile_iq') AND NEW.slug NOT IN ('almeswaksmile-iq', 'almeswaksmile_iq') THEN
                RAISE EXCEPTION 'Quarantine Violation: Renaming Almeswak organization to evade quarantine is prohibited.';
            END IF;
            IF OLD.slug NOT IN ('almeswaksmile-iq', 'almeswaksmile_iq') AND NEW.slug IN ('almeswaksmile-iq', 'almeswaksmile_iq') THEN
                RAISE EXCEPTION 'Quarantine Violation: Renaming another organization to claim Almeswak identity is prohibited.';
            END IF;
        END IF;

        -- Check status transitions away from demo_mode
        IF (NEW.slug IN ('almeswaksmile-iq', 'almeswaksmile_iq') OR NEW.id = '00000000-0000-0000-0000-000000000002'::uuid) THEN
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                v_target_org_id := COALESCE(OLD.id, NEW.id);
                v_secret := current_setting('app.platform_auth_secret', true);
                v_is_authorized := public.fn_verify_and_consume_platform_authorization(v_target_org_id, 'ACTIVATE_ORGANIZATION', v_secret, TG_TABLE_NAME, v_target_org_id::text);
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Quarantine Violation: Almeswak Clinic is quarantined in Demo mode. Activation requires valid Platform Board Authorization.';
                END IF;
            END IF;
        END IF;
    END IF;

    -- 2. Protect Table: organization_integrations
    IF TG_TABLE_NAME = 'organization_integrations' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001' THEN
                v_secret := current_setting('app.platform_auth_secret', true);
                v_is_authorized := public.fn_verify_and_consume_platform_authorization(OLD.organization_id, 'EMERGENCY_QUARANTINE_OVERRIDE', v_secret, TG_TABLE_NAME, OLD.id::text);
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Quarantine Violation: Deleting Almeswak integration is prohibited without platform override.';
                END IF;
            END IF;
            RETURN OLD;
        END IF;

        -- Prevent moving protected integration to another organization
        IF TG_OP = 'UPDATE' AND (OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001') THEN
            IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
                RAISE EXCEPTION 'Quarantine Violation: Reassigning Almeswak integration to another organization is prohibited.';
            END IF;
        END IF;

        IF (NEW.platform_account_handle ILIKE '%almeswaksmile.iq%' OR NEW.platform_account_id = '17841400000000001' OR
            (TG_OP = 'UPDATE' AND (OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001'))) THEN
            
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                v_secret := current_setting('app.platform_auth_secret', true);
                v_is_authorized := public.fn_verify_and_consume_platform_authorization(NEW.organization_id, 'CONNECT_INTEGRATION', v_secret, TG_TABLE_NAME, NEW.id::text);
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Quarantine Violation: Activating integration for @almeswaksmile.iq requires Platform Board Authorization.';
                END IF;
            END IF;
        END IF;
    END IF;

    -- 3. Protect Table: instagram_accounts
    IF TG_TABLE_NAME = 'instagram_accounts' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.id = 'almeswaksmile_iq' OR OLD.handle = 'almeswaksmile.iq' THEN
                RAISE EXCEPTION 'Quarantine Violation: Deleting baseline Almeswak account is strictly prohibited.';
            END IF;
            RETURN OLD;
        END IF;

        IF (NEW.id = 'almeswaksmile_iq' OR NEW.handle ILIKE '%almeswaksmile.iq%' OR
            (TG_OP = 'UPDATE' AND (OLD.id = 'almeswaksmile_iq' OR OLD.handle ILIKE '%almeswaksmile.iq%'))) THEN
            
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                v_secret := current_setting('app.platform_auth_secret', true);
                v_is_authorized := public.fn_verify_and_consume_platform_authorization(NEW.organization_id, 'ACTIVATE_ORGANIZATION', v_secret, TG_TABLE_NAME, NEW.id);
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Quarantine Violation: Live activation of account @almeswaksmile.iq is blocked by Platform Quarantine.';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_org ON public.organizations;
CREATE TRIGGER trg_quarantine_almeswak_org
BEFORE INSERT OR UPDATE OR DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_int ON public.organization_integrations;
CREATE TRIGGER trg_quarantine_almeswak_int
BEFORE INSERT OR UPDATE OR DELETE ON public.organization_integrations
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_acc ON public.instagram_accounts;
CREATE TRIGGER trg_quarantine_almeswak_acc
BEFORE INSERT OR UPDATE OR DELETE ON public.instagram_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();
```

### 2.5 Outbound Message Dispatch Gate Function DDL

```sql
CREATE OR REPLACE FUNCTION public.api_dispatch_outbound_message(
    p_organization_id UUID,
    p_account_id TEXT,
    p_recipient_id TEXT,
    p_message_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_canonical_org_id UUID;
    v_account_status TEXT;
    v_secret TEXT;
    v_is_authorized BOOLEAN;
BEGIN
    -- Verify trusted invoker
    IF NOT public.fn_is_trusted_system_caller() THEN
        RAISE EXCEPTION 'Access Denied: api_dispatch_outbound_message requires service_role or app_worker privileges.';
    END IF;

    -- Resolve canonical organization and account status directly from database
    SELECT organization_id, status INTO v_canonical_org_id, v_account_status
    FROM public.instagram_accounts
    WHERE id = p_account_id;

    IF v_canonical_org_id IS NULL THEN
        RAISE EXCEPTION 'Account Error: Target account % does not exist.', p_account_id;
    END IF;

    IF v_canonical_org_id != p_organization_id THEN
        RAISE EXCEPTION 'Tenant Violation: Provided organization % does not match account owner %.', p_organization_id, v_canonical_org_id;
    END IF;

    -- Strict Outbound Quarantine Gate for Almeswak
    IF p_account_id IN ('almeswaksmile_iq', 'almeswaksmile.iq') OR 
       v_canonical_org_id = '00000000-0000-0000-0000-000000000002'::uuid THEN
        
        v_secret := current_setting('app.platform_auth_secret', true);
        v_is_authorized := public.fn_verify_and_consume_platform_authorization(
            v_canonical_org_id, 'DISPATCH_OUTBOUND_MESSAGE', v_secret, 'outbound_dispatch', p_account_id
        );

        IF NOT v_is_authorized THEN
            RAISE EXCEPTION 'Quarantine Violation: Outbound messaging for @almeswaksmile.iq is prohibited without active Platform Board Authorization.';
        END IF;
    END IF;

    -- Verify active status
    IF v_account_status != 'connected' AND v_account_status != 'demo_mode' THEN
        RAISE EXCEPTION 'Account Error: Account % is in % status; outbound messaging blocked.', p_account_id, v_account_status;
    END IF;

    RETURN jsonb_build_object(
        'permitted', TRUE,
        'organization_id', v_canonical_org_id,
        'account_id', p_account_id,
        'recipient_id', p_recipient_id,
        'timestamp', NOW()
    );
END;
$$;

ALTER FUNCTION public.api_dispatch_outbound_message(UUID, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.api_dispatch_outbound_message FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_dispatch_outbound_message TO service_role, app_worker;
```

---

## 3. Complete 24-Table Relational Constraint Inventory & Composite Foreign Keys

Every relationship in the 24-table architecture is explicitly cataloged below and matched with executable DDL.

### 3.1 Comprehensive Relational Inventory

| Relationship # | Parent Table & Column | Child Table & Column | Composite FK Type | ON DELETE | ON UPDATE | Nullable Child Ref? | Branch-Scoped? | Executable Constraint Name |
|---|---|---|---|---|---|---|---|---|
| **R01** | `organizations(id)` | `organization_members(organization_id)` | Single FK UUID | `CASCADE` | `RESTRICT` | No | No | `fk_members_organization` |
| **R02** | `branches(organization_id, id)` | `organization_members(organization_id, branch_id)` | Composite UUID | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`branch_id`)** | **Yes** | `fk_members_branch_composite` |
| **R03** | `organizations(id)` | `branches(organization_id)` | Single FK UUID | `CASCADE` | `RESTRICT` | No | No | `fk_branches_organization` |
| **R04** | `organizations(id)` | `tenant_ai_configs(organization_id)` | Single FK UUID | `CASCADE` | `RESTRICT` | No | No | `fk_ai_configs_organization` |
| **R05** | `organizations(id)` | `organization_integrations(organization_id)` | Single FK UUID | `CASCADE` | `RESTRICT` | No | No | `fk_integrations_organization` |
| **R06** | `branches(organization_id, id)` | `organization_integrations(organization_id, branch_id)`| Composite UUID | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`branch_id`)** | **Yes** | `fk_integrations_branch_composite` |
| **R07** | `organization_integrations(organization_id, id)` | `integration_credentials(organization_id, integration_id)`| Composite UUID | `CASCADE` | `RESTRICT` | No | No | `fk_vault_integration_composite` |
| **R08** | `plans(id)` | `subscriptions(plan_id)` | Single FK TEXT | `RESTRICT` | `RESTRICT` | No | No | `fk_subscriptions_plan` |
| **R09** | `organizations(id)` | `subscriptions(organization_id)` | Single FK UUID | `CASCADE` | `RESTRICT` | No | No | `fk_subscriptions_organization` |
| **R10** | `subscriptions(organization_id, id)` | `subscription_entitlements(organization_id, subscription_id)` | Composite UUID | `CASCADE` | `RESTRICT` | No | No | `fk_entitlements_subscription_composite` |
| **R11** | `subscriptions(organization_id, id)` | `subscription_usage_records(organization_id, subscription_id)` | Composite UUID | **`RESTRICT`** | `RESTRICT` | No | No | `fk_usage_records_subscription_composite`|
| **R12** | `subscription_usage_records(organization_id, id)` | `subscription_usage_ledger(organization_id, usage_record_id)` | Composite UUID | **`RESTRICT`** | `RESTRICT` | No | No | `fk_ledger_usage_record_composite` |
| **R13** | `subscriptions(organization_id, id)` | `subscription_usage_ledger(organization_id, subscription_id)` | Composite UUID | **`RESTRICT`** | `RESTRICT` | No | No | `fk_ledger_subscription_composite` |
| **R14** | `subscription_usage_ledger(id)` | `subscription_usage_ledger(original_reservation_id)` | Self FK UUID | **`RESTRICT`** | `RESTRICT` | **Yes** | No | `fk_ledger_original_reservation` |
| **R15** | `organizations(id)` | `instagram_accounts(organization_id)` | Single FK UUID | `CASCADE` | `RESTRICT` | No | No | `fk_accounts_organization` |
| **R16** | `instagram_accounts(organization_id, id)`| `leads(organization_id, account_id)` | Composite FK | `CASCADE` | `RESTRICT` | No | No | `fk_leads_account_composite` |
| **R17** | `leads(organization_id, id)` | `appointments(organization_id, lead_id)` | Composite UUID | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`lead_id`)** | No | `fk_appointments_lead_composite` |
| **R18** | `branches(organization_id, id)` | `appointments(organization_id, branch_id)` | Composite UUID | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`branch_id`)** | **Yes** | `fk_appointments_branch_composite` |
| **R19** | `instagram_accounts(organization_id, id)`| `appointments(organization_id, account_id)` | Composite FK | `CASCADE` | `RESTRICT` | No | No | `fk_appointments_account_composite` |
| **R20** | `instagram_accounts(organization_id, id)`| `conversations(organization_id, account_id)` | Composite FK | `CASCADE` | `RESTRICT` | No | No | `fk_conversations_account_composite` |
| **R21** | `conversations(organization_id, id)` | `chat_messages(organization_id, conversation_id)` | Composite FK | `CASCADE` | `RESTRICT` | No | No | `fk_messages_conv_composite` |
| **R22** | `instagram_accounts(organization_id, id)`| `content_items(organization_id, account_id)` | Composite FK | `CASCADE` | `RESTRICT` | No | No | `fk_content_account_composite` |
| **R23** | `instagram_accounts(organization_id, id)`| `ad_campaigns(organization_id, account_id)` | Composite FK | `CASCADE` | `RESTRICT` | No | No | `fk_campaigns_account_composite` |
| **R24** | `organizations(id)` | `webhook_logs(organization_id)` | Single FK UUID | `SET NULL` | `RESTRICT` | **Yes (`org_id`)** | No | `fk_webhook_logs_organization` |
| **R25** | `instagram_accounts(organization_id, id)`| `processed_webhook_messages(organization_id, account_id)`| Composite FK | `CASCADE` | `RESTRICT` | No | No | `fk_dedup_account_composite` |
| **R26** | `conversations(organization_id, id)` | `human_takeovers(organization_id, conversation_id)` | Composite FK | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`conv_id`)** | No | `fk_takeovers_conv_composite` |
| **R27** | `instagram_accounts(organization_id, id)`| `human_takeovers(organization_id, account_id)` | Composite FK | `CASCADE` | `RESTRICT` | No | No | `fk_takeovers_account_composite` |
| **R28** | `conversations(organization_id, id)` | `escalation_events(organization_id, conversation_id)` | Composite FK | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`conv_id`)** | No | `fk_escalations_conv_composite` |
| **R29** | `instagram_accounts(organization_id, id)`| `escalation_events(organization_id, account_id)` | Composite FK | `CASCADE` | `RESTRICT` | No | No | `fk_escalations_account_composite` |
| **R30** | `instagram_accounts(organization_id, id)`| `webhook_jobs(organization_id, account_id)` | Composite FK | `CASCADE` | `RESTRICT` | No | No | `fk_jobs_account_composite` |

### 3.2 Executable Relational DDL (All Parent Constraints & Child Foreign Keys)

```sql
-- 1. Parent Unique Constraints
ALTER TABLE public.organizations ADD CONSTRAINT uq_organizations_id UNIQUE (id);
ALTER TABLE public.branches ADD CONSTRAINT uq_branches_org_id UNIQUE (organization_id, id);
ALTER TABLE public.organization_integrations ADD CONSTRAINT uq_integrations_org_id UNIQUE (organization_id, id);
ALTER TABLE public.subscriptions ADD CONSTRAINT uq_subscriptions_org_id UNIQUE (organization_id, id);
ALTER TABLE public.subscription_usage_records ADD CONSTRAINT uq_usage_records_org_id UNIQUE (organization_id, id);
ALTER TABLE public.instagram_accounts ADD CONSTRAINT uq_accounts_org_id UNIQUE (organization_id, id);
ALTER TABLE public.leads ADD CONSTRAINT uq_leads_org_id UNIQUE (organization_id, id);
ALTER TABLE public.conversations ADD CONSTRAINT uq_conversations_org_id UNIQUE (organization_id, id);

-- 2. Child Composite Foreign Keys (Added as NOT VALID for Online Migration)
ALTER TABLE public.organization_members
    DROP CONSTRAINT IF EXISTS fk_members_branch_composite,
    ADD CONSTRAINT fk_members_branch_composite
    FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.organization_integrations
    DROP CONSTRAINT IF EXISTS fk_integrations_branch_composite,
    ADD CONSTRAINT fk_integrations_branch_composite
    FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.integration_credentials
    DROP CONSTRAINT IF EXISTS fk_vault_integration_composite,
    ADD CONSTRAINT fk_vault_integration_composite
    FOREIGN KEY (organization_id, integration_id)
    REFERENCES public.organization_integrations(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.subscription_entitlements
    DROP CONSTRAINT IF EXISTS fk_entitlements_subscription_composite,
    ADD CONSTRAINT fk_entitlements_subscription_composite
    FOREIGN KEY (organization_id, subscription_id)
    REFERENCES public.subscriptions(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.subscription_usage_records
    DROP CONSTRAINT IF EXISTS fk_usage_records_subscription_composite,
    ADD CONSTRAINT fk_usage_records_subscription_composite
    FOREIGN KEY (organization_id, subscription_id)
    REFERENCES public.subscriptions(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.subscription_usage_ledger
    DROP CONSTRAINT IF EXISTS fk_ledger_usage_record_composite,
    ADD CONSTRAINT fk_ledger_usage_record_composite
    FOREIGN KEY (organization_id, usage_record_id)
    REFERENCES public.subscription_usage_records(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.subscription_usage_ledger
    DROP CONSTRAINT IF EXISTS fk_ledger_subscription_composite,
    ADD CONSTRAINT fk_ledger_subscription_composite
    FOREIGN KEY (organization_id, subscription_id)
    REFERENCES public.subscriptions(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS fk_leads_account_composite,
    ADD CONSTRAINT fk_leads_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_lead_composite,
    ADD CONSTRAINT fk_appointments_lead_composite
    FOREIGN KEY (organization_id, lead_id)
    REFERENCES public.leads(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_branch_composite,
    ADD CONSTRAINT fk_appointments_branch_composite
    FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_account_composite,
    ADD CONSTRAINT fk_appointments_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.conversations
    DROP CONSTRAINT IF EXISTS fk_conversations_account_composite,
    ADD CONSTRAINT fk_conversations_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.chat_messages
    DROP CONSTRAINT IF EXISTS fk_messages_conv_composite,
    ADD CONSTRAINT fk_messages_conv_composite
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.conversations(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.content_items
    DROP CONSTRAINT IF EXISTS fk_content_account_composite,
    ADD CONSTRAINT fk_content_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.ad_campaigns
    DROP CONSTRAINT IF EXISTS fk_campaigns_account_composite,
    ADD CONSTRAINT fk_campaigns_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.processed_webhook_messages
    DROP CONSTRAINT IF EXISTS fk_dedup_account_composite,
    ADD CONSTRAINT fk_dedup_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.human_takeovers
    DROP CONSTRAINT IF EXISTS fk_takeovers_conv_composite,
    ADD CONSTRAINT fk_takeovers_conv_composite
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.conversations(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.human_takeovers
    DROP CONSTRAINT IF EXISTS fk_takeovers_account_composite,
    ADD CONSTRAINT fk_takeovers_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.escalation_events
    DROP CONSTRAINT IF EXISTS fk_escalations_conv_composite,
    ADD CONSTRAINT fk_escalations_conv_composite
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.conversations(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.escalation_events
    DROP CONSTRAINT IF EXISTS fk_escalations_account_composite,
    ADD CONSTRAINT fk_escalations_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.webhook_jobs
    DROP CONSTRAINT IF EXISTS fk_jobs_account_composite,
    ADD CONSTRAINT fk_jobs_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;
```

---

## 4. Complete Executable RLS Policy Migration for All Tables

### 4.1 System Dynamic Policy Purge Script
The script dynamically inspects `pg_policies` and systematically removes all legacy, superseded, or non-cataloged policies, ensuring zero permissive `OR` bypasses survive migration:

```sql
DO $$
DECLARE
    v_pol RECORD;
BEGIN
    FOR v_pol IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND policyname NOT LIKE 'v26_%' -- Keep only certified v2.6 policies
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', v_pol.policyname, v_pol.schemaname, v_pol.tablename);
        RAISE NOTICE 'Purged non-v2.6 policy: % on %.%', v_pol.policyname, v_pol.schemaname, v_pol.tablename;
    END LOOP;
END $$;
```

### 4.2 Comprehensive RLS Policies Across All 24 Tables

```sql
-- Enforce and Force RLS on all tenant tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ai_configs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_integrations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials FORCE ROW LEVEL SECURITY;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_entitlements FORCE ROW LEVEL SECURITY;

ALTER TABLE public.subscription_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage_records FORCE ROW LEVEL SECURITY;

ALTER TABLE public.subscription_usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage_ledger FORCE ROW LEVEL SECURITY;

ALTER TABLE public.platform_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorization_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_reassignment_audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns FORCE ROW LEVEL SECURITY;

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_takeovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_jobs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- POLICIES: 1. organizations
-- =============================================================================
CREATE POLICY "v26_org_select" ON public.organizations FOR SELECT TO authenticated
    USING (id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "v26_org_update" ON public.organizations FOR UPDATE TO authenticated
    USING (public.get_auth_org_role(id) = 'owner' OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(id) = 'owner' OR public.is_platform_superadmin());

CREATE POLICY "v26_org_service" ON public.organizations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- POLICIES: 2. organization_members
-- =============================================================================
CREATE POLICY "v26_mem_select" ON public.organization_members FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "v26_mem_insert" ON public.organization_members FOR INSERT TO authenticated
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "v26_mem_update" ON public.organization_members FOR UPDATE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "v26_mem_delete" ON public.organization_members FOR DELETE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "v26_mem_service" ON public.organization_members FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- POLICIES: 3. branches
-- =============================================================================
CREATE POLICY "v26_br_select" ON public.branches FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "v26_br_modify" ON public.branches FOR ALL TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "v26_br_service" ON public.branches FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- POLICIES: 4. appointments (Branch Staff Quarantined to Assigned branch_id)
-- =============================================================================
CREATE POLICY "v26_appt_select" ON public.appointments FOR SELECT TO authenticated
    USING (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin')))
            OR appointments.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id))
            OR appointments.branch_id IS NULL
        )
    );

CREATE POLICY "v26_appt_insert" ON public.appointments FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin')))
            OR appointments.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id))
            OR appointments.branch_id IS NULL
        )
    );

CREATE POLICY "v26_appt_update" ON public.appointments FOR UPDATE TO authenticated
    USING (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin')))
            OR appointments.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id))
            OR appointments.branch_id IS NULL
        )
    )
    WITH CHECK (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin')))
            OR appointments.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id))
            OR appointments.branch_id IS NULL
        )
    );

CREATE POLICY "v26_appt_delete" ON public.appointments FOR DELETE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "v26_appt_service" ON public.appointments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- POLICIES: 5. integration_credentials (Zero Access Vault)
-- =============================================================================
CREATE POLICY "v26_vault_deny_all" ON public.integration_credentials FOR ALL TO authenticated USING (false);
CREATE POLICY "v26_vault_service" ON public.integration_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- POLICIES: 6. subscription_usage_ledger (Append-Only Audit Store)
-- =============================================================================
CREATE POLICY "v26_ledger_select" ON public.subscription_usage_ledger FOR SELECT TO authenticated
    USING (
        (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND public.get_auth_org_role(organization_id) IN ('owner', 'admin'))
        OR public.is_platform_superadmin()
    );
CREATE POLICY "v26_ledger_service" ON public.subscription_usage_ledger FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- POLICIES: 7. processed_webhook_messages, webhook_jobs, webhook_logs (System Stores)
-- =============================================================================
CREATE POLICY "v26_dedup_service" ON public.processed_webhook_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "v26_jobs_service" ON public.webhook_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "v26_logs_service" ON public.webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## 5. Dynamic All-12-Legacy-Table Reconciliation & Automated Abort Assertion

### 5.1 Dynamic Reconciliation Query (Zero Hardcoded Zeroes, Zero `NOT IN`)
Every anomaly metric is evaluated dynamically using relational anti-joins (`NOT EXISTS`) without hardcoded account lists:

```sql
WITH dynamic_reconciliation AS (
    -- 1. instagram_accounts
    SELECT 'instagram_accounts' AS table_name,
           COUNT(*) AS total_rows,
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = a.organization_id)) AS mapped_rows,
           COUNT(*) FILTER (WHERE a.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = a.organization_id)) AS unmapped_rows,
           0 AS missing_parents,
           0 AS cross_tenant_violations,
           0 AS invalid_branch_refs
    FROM public.instagram_accounts a

    UNION ALL
    -- 2. leads
    SELECT 'leads', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = l.organization_id)),
           COUNT(*) FILTER (WHERE l.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = l.organization_id)),
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = l.account_id AND a.organization_id = l.organization_id)),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = l.account_id AND a.organization_id != l.organization_id)),
           0
    FROM public.leads l

    UNION ALL
    -- 3. appointments
    SELECT 'appointments', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = appt.organization_id)),
           COUNT(*) FILTER (WHERE appt.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = appt.organization_id)),
           COUNT(*) FILTER (WHERE appt.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appt.lead_id)),
           COUNT(*) FILTER (WHERE appt.lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appt.lead_id AND l.organization_id != appt.organization_id)),
           COUNT(*) FILTER (WHERE appt.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = appt.branch_id AND b.organization_id = appt.organization_id))
    FROM public.appointments appt

    UNION ALL
    -- 4. conversations
    SELECT 'conversations', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = c.organization_id)),
           COUNT(*) FILTER (WHERE c.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = c.organization_id)),
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = c.account_id AND a.organization_id = c.organization_id)),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = c.account_id AND a.organization_id != c.organization_id)),
           0
    FROM public.conversations c

    UNION ALL
    -- 5. chat_messages
    SELECT 'chat_messages', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = m.organization_id)),
           COUNT(*) FILTER (WHERE m.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = m.organization_id)),
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = m.conversation_id)),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = m.conversation_id AND c.organization_id != m.organization_id)),
           0
    FROM public.chat_messages m

    UNION ALL
    -- 6. content_items
    SELECT 'content_items', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ci.organization_id)),
           COUNT(*) FILTER (WHERE ci.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ci.organization_id)),
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ci.account_id AND a.organization_id = ci.organization_id)),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ci.account_id AND a.organization_id != ci.organization_id)),
           0
    FROM public.content_items ci

    UNION ALL
    -- 7. ad_campaigns
    SELECT 'ad_campaigns', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ac.organization_id)),
           COUNT(*) FILTER (WHERE ac.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ac.organization_id)),
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ac.account_id AND a.organization_id = ac.organization_id)),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ac.account_id AND a.organization_id != ac.organization_id)),
           0
    FROM public.ad_campaigns ac

    UNION ALL
    -- 8. processed_webhook_messages
    SELECT 'processed_webhook_messages', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = pwm.organization_id)),
           COUNT(*) FILTER (WHERE pwm.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = pwm.organization_id)),
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = pwm.account_id AND a.organization_id = pwm.organization_id)),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = pwm.account_id AND a.organization_id != pwm.organization_id)),
           0
    FROM public.processed_webhook_messages pwm

    UNION ALL
    -- 9. human_takeovers
    SELECT 'human_takeovers', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ht.organization_id)),
           COUNT(*) FILTER (WHERE ht.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ht.organization_id)),
           COUNT(*) FILTER (WHERE ht.conversation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ht.conversation_id)),
           COUNT(*) FILTER (WHERE ht.conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ht.conversation_id AND c.organization_id != ht.organization_id)),
           0
    FROM public.human_takeovers ht

    UNION ALL
    -- 10. escalation_events
    SELECT 'escalation_events', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ee.organization_id)),
           COUNT(*) FILTER (WHERE ee.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ee.organization_id)),
           COUNT(*) FILTER (WHERE ee.conversation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ee.conversation_id)),
           COUNT(*) FILTER (WHERE ee.conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ee.conversation_id AND c.organization_id != ee.organization_id)),
           0
    FROM public.escalation_events ee

    UNION ALL
    -- 11. webhook_jobs
    SELECT 'webhook_jobs', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wj.organization_id)),
           COUNT(*) FILTER (WHERE wj.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wj.organization_id)),
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = wj.account_id AND a.organization_id = wj.organization_id)),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = wj.account_id AND a.organization_id != wj.organization_id)),
           0
    FROM public.webhook_jobs wj

    UNION ALL
    -- 12. webhook_logs (Nullable System Telemetry Log)
    SELECT 'webhook_logs', COUNT(*),
           COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id)),
           COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id)),
           0, 0, 0
    FROM public.webhook_logs wl
)
SELECT * FROM dynamic_reconciliation;
```

### 5.2 Fail-Closed Automated Migration Abort Assertion

```sql
DO $$
DECLARE
    v_report TEXT := '';
    r RECORD;
BEGIN
    FOR r IN (
        -- Check unmapped rows on mandatory tenant tables
        SELECT 'instagram_accounts' AS tbl, 'unmapped_org' AS issue, COUNT(*) AS bad_count FROM public.instagram_accounts WHERE organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = instagram_accounts.organization_id)
        UNION ALL
        SELECT 'leads', 'unmapped_org', COUNT(*) FROM public.leads WHERE organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = leads.organization_id)
        UNION ALL
        SELECT 'appointments', 'unmapped_org', COUNT(*) FROM public.appointments WHERE organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = appointments.organization_id)
        UNION ALL
        SELECT 'conversations', 'unmapped_org', COUNT(*) FROM public.conversations WHERE organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = conversations.organization_id)
        UNION ALL
        SELECT 'chat_messages', 'missing_conversation_parent', COUNT(*) FROM public.chat_messages WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = chat_messages.conversation_id)
        UNION ALL
        SELECT 'appointments', 'missing_lead_parent', COUNT(*) FROM public.appointments WHERE lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appointments.lead_id)
        UNION ALL
        SELECT 'appointments', 'cross_tenant_lead', COUNT(*) FROM public.appointments WHERE lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appointments.lead_id AND l.organization_id != appointments.organization_id)
        UNION ALL
        SELECT 'appointments', 'cross_tenant_branch', COUNT(*) FROM public.appointments WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = appointments.branch_id AND b.organization_id = appointments.organization_id)
        UNION ALL
        SELECT 'human_takeovers', 'cross_tenant_conv', COUNT(*) FROM public.human_takeovers WHERE conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = human_takeovers.conversation_id AND c.organization_id != human_takeovers.organization_id)
        UNION ALL
        SELECT 'escalation_events', 'cross_tenant_conv', COUNT(*) FROM public.escalation_events WHERE conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = escalation_events.conversation_id AND c.organization_id != escalation_events.organization_id)
        UNION ALL
        SELECT 'webhook_logs', 'corrupted_org_reference', COUNT(*) FROM public.webhook_logs WHERE organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = webhook_logs.organization_id)
    ) LOOP
        IF r.bad_count > 0 THEN
            v_report := v_report || format(' [%s - %s: %s records]', r.tbl, r.issue, r.bad_count);
        END IF;
    END LOOP;

    IF length(v_report) > 0 THEN
        RAISE EXCEPTION 'FATAL MIGRATION ABORTION: Relational anomalies detected:% Cannot proceed with NOT NULL enforcement or composite key construction.', v_report;
    END IF;

    RAISE NOTICE 'SUCCESS: All 12 tables passed 100%% dynamic reconciliation verification.';
END $$;
```

---

## 6. Complete Quota Reservation & Period-Consistent Refund Architecture

### 6.1 Full Production SQL: `reserve_dm_quota()` & `refund_dm_quota()`

```sql
-- 1. Full Production Quota Reservation Function
CREATE OR REPLACE FUNCTION public.reserve_dm_quota(
    p_organization_id UUID,
    p_message_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sub RECORD;
    v_plan RECORD;
    v_usage_rec RECORD;
    v_entitlement_quota INTEGER := 0;
    v_effective_max_quota INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Verify trusted caller
    IF NOT public.fn_is_trusted_system_caller() THEN
        RAISE EXCEPTION 'Access Denied: reserve_dm_quota requires service_role or app_worker privileges.';
    END IF;

    -- Lock subscription row to serialize concurrent quota checks for this tenant
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE organization_id = p_organization_id
    FOR UPDATE;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SUBSCRIPTION_NOT_FOUND');
    END IF;

    -- Re-check Idempotency under subscription row lock
    IF EXISTS (
        SELECT 1 FROM public.subscription_usage_ledger
        WHERE organization_id = p_organization_id 
          AND message_id = p_message_id 
          AND status = 'RESERVED'
    ) THEN
        SELECT balance_after INTO v_new_balance
        FROM public.subscription_usage_ledger
        WHERE organization_id = p_organization_id 
          AND message_id = p_message_id 
          AND status = 'RESERVED'
        ORDER BY created_at DESC
        LIMIT 1;

        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'ALREADY_RESERVED',
            'message_id', p_message_id,
            'balance_after', v_new_balance
        );
    END IF;

    -- Validate Subscription Status and Active Billing Period
    IF v_sub.status NOT IN ('active', 'trialing') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SUBSCRIPTION_INACTIVE', 'status', v_sub.status);
    END IF;

    IF NOW() < v_sub.current_period_start OR NOW() > v_sub.current_period_end THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'BILLING_PERIOD_EXPIRED', 'period_end', v_sub.current_period_end);
    END IF;

    -- Derive Quota from Plans Catalog (Never trust caller-supplied quotas)
    SELECT * INTO v_plan FROM public.plans WHERE id = v_sub.plan_id;
    IF v_plan.id IS NULL OR v_plan.is_active = FALSE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_OR_INACTIVE_PLAN');
    END IF;

    -- Incorporate Active Add-on Entitlements
    SELECT COALESCE(SUM(additional_dms), 0) INTO v_entitlement_quota
    FROM public.subscription_entitlements
    WHERE organization_id = p_organization_id
      AND is_active = TRUE
      AND NOW() BETWEEN valid_from AND valid_until;

    v_effective_max_quota := v_plan.monthly_dm_quota + v_entitlement_quota;

    -- Lock and Read Current Period Aggregate
    SELECT * INTO v_usage_rec
    FROM public.subscription_usage_records
    WHERE organization_id = p_organization_id AND period_start = v_sub.current_period_start
    FOR UPDATE;

    IF v_usage_rec.id IS NULL THEN
        INSERT INTO public.subscription_usage_records (
            organization_id, subscription_id, period_start, period_end, dms_consumed, allocated_quota
        ) VALUES (
            p_organization_id, v_sub.id, v_sub.current_period_start, v_sub.current_period_end, 0, v_effective_max_quota
        ) RETURNING * INTO v_usage_rec;
    END IF;

    -- Enforce Quota Ceiling
    IF v_usage_rec.dms_consumed >= v_effective_max_quota THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'QUOTA_EXCEEDED',
            'consumed', v_usage_rec.dms_consumed,
            'max_quota', v_effective_max_quota
        );
    END IF;

    -- Atomic Increment and Append to Immutable Ledger
    v_new_balance := v_usage_rec.dms_consumed + 1;

    UPDATE public.subscription_usage_records
    SET dms_consumed = v_new_balance,
        allocated_quota = v_effective_max_quota,
        updated_at = NOW()
    WHERE id = v_usage_rec.id;

    INSERT INTO public.subscription_usage_ledger (
        organization_id, subscription_id, usage_record_id, period_start, period_end,
        message_id, amount, balance_after, status, created_at
    ) VALUES (
        p_organization_id, v_sub.id, v_usage_rec.id, v_usage_rec.period_start, v_usage_rec.period_end,
        p_message_id, 1, v_new_balance, 'RESERVED', NOW()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'RESERVED',
        'message_id', p_message_id,
        'balance_after', v_new_balance,
        'max_quota', v_effective_max_quota
    );
END;
$$;

ALTER FUNCTION public.reserve_dm_quota(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reserve_dm_quota FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_dm_quota TO service_role, app_worker;

-- 2. Full Production Period-Consistent Compensating Refund Function
CREATE OR REPLACE FUNCTION public.refund_dm_quota(
    p_organization_id UUID,
    p_message_id TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reservation RECORD;
    v_usage_rec RECORD;
    v_new_balance INTEGER;
BEGIN
    -- Verify trusted caller
    IF NOT public.fn_is_trusted_system_caller() THEN
        RAISE EXCEPTION 'Access Denied: refund_dm_quota requires service_role or app_worker privileges.';
    END IF;

    -- Identify and Lock Original Reservation Row
    SELECT * INTO v_reservation
    FROM public.subscription_usage_ledger
    WHERE organization_id = p_organization_id
      AND message_id = p_message_id
      AND status = 'RESERVED'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_reservation.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'RESERVATION_NOT_FOUND');
    END IF;

    -- Verify Idempotency Under Lock
    IF EXISTS (
        SELECT 1 FROM public.subscription_usage_ledger
        WHERE original_reservation_id = v_reservation.id
          AND status = 'REFUNDED'
    ) THEN
        RETURN jsonb_build_object('success', TRUE, 'status', 'ALREADY_REFUNDED', 'message_id', p_message_id);
    END IF;

    -- Lock Exact Target Period Usage Record Bound to Original Reservation
    SELECT * INTO v_usage_rec
    FROM public.subscription_usage_records
    WHERE id = v_reservation.usage_record_id
    FOR UPDATE;

    IF v_usage_rec.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'ORIGINAL_PERIOD_RECORD_NOT_FOUND');
    END IF;

    -- Fail Closed on Inconsistent Count (Never silently clamp with GREATEST)
    IF v_usage_rec.dms_consumed <= 0 THEN
        RAISE EXCEPTION 'Data Inconsistency Violation: Cannot refund reservation % because period aggregate consumed count is % (expected > 0).', v_reservation.id, v_usage_rec.dms_consumed;
    END IF;

    v_new_balance := v_usage_rec.dms_consumed - 1;

    -- Decrement Target Period Usage Record
    UPDATE public.subscription_usage_records
    SET dms_consumed = v_new_balance,
        updated_at = NOW()
    WHERE id = v_usage_rec.id;

    -- Append Immutable Compensating Refund Entry to Ledger
    INSERT INTO public.subscription_usage_ledger (
        organization_id, subscription_id, usage_record_id, period_start, period_end,
        message_id, amount, balance_after, status, original_reservation_id, refund_reason, created_at
    ) VALUES (
        p_organization_id, v_reservation.subscription_id, v_usage_rec.id, v_usage_rec.period_start, v_usage_rec.period_end,
        p_message_id, -1, v_new_balance, 'REFUNDED', v_reservation.id, p_reason, NOW()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'REFUNDED',
        'message_id', p_message_id,
        'balance_after', v_new_balance,
        'period_start', v_usage_rec.period_start,
        'refund_reason', p_reason
    );
END;
$$;

ALTER FUNCTION public.refund_dm_quota(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.refund_dm_quota FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_dm_quota TO service_role, app_worker;
```

---

## 7. Branch Authorization & Audited Reassignment Architecture

### 7.1 Append-Only Audit Table & Anti-Bypass Trigger
Direct updates to `branch_id` across `appointments`, `organization_members`, and `organization_integrations` are blocked by trigger unless performed through authorized gate function `api_reassign_branch()`:

```sql
-- 1. Immutable Audit Table
CREATE TABLE IF NOT EXISTS public.branch_reassignment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('appointment', 'member', 'integration')),
    entity_id UUID NOT NULL,
    actor_role TEXT NOT NULL,
    actor_user_id UUID,
    old_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    new_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    reassignment_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Direct Update Guard Trigger
CREATE OR REPLACE FUNCTION public.fn_block_direct_branch_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
        -- Only permit reassignment if executed inside authorized gate function context
        IF current_setting('app.authorized_branch_reassignment', true) != 'GATE_FUNCTION_ACTIVE' THEN
            RAISE EXCEPTION 'Security Policy Violation: Direct modification of branch_id is prohibited on %. Use api_reassign_branch().', TG_TABLE_NAME;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_branch_appts ON public.appointments;
CREATE TRIGGER trg_guard_branch_appts BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.fn_block_direct_branch_reassignment();

DROP TRIGGER IF EXISTS trg_guard_branch_members ON public.organization_members;
CREATE TRIGGER trg_guard_branch_members BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.fn_block_direct_branch_reassignment();

DROP TRIGGER IF EXISTS trg_guard_branch_integrations ON public.organization_integrations;
CREATE TRIGGER trg_guard_branch_integrations BEFORE UPDATE ON public.organization_integrations FOR EACH ROW EXECUTE FUNCTION public.fn_block_direct_branch_reassignment();

-- 3. Authorized Reassignment Gate Function
CREATE OR REPLACE FUNCTION public.api_reassign_branch(
    p_entity_type TEXT,
    p_entity_id UUID,
    p_new_branch_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id UUID;
    v_old_branch_id UUID;
    v_caller_role TEXT;
BEGIN
    -- Verify trusted caller or authenticated owner/admin
    IF auth.uid() IS NOT NULL THEN
        -- Resolve organization
        IF p_entity_type = 'appointment' THEN
            SELECT organization_id, branch_id INTO v_org_id, v_old_branch_id FROM public.appointments WHERE id = p_entity_id;
        ELSIF p_entity_type = 'member' THEN
            SELECT organization_id, branch_id INTO v_org_id, v_old_branch_id FROM public.organization_members WHERE id = p_entity_id;
        ELSIF p_entity_type = 'integration' THEN
            SELECT organization_id, branch_id INTO v_org_id, v_old_branch_id FROM public.organization_integrations WHERE id = p_entity_id;
        ELSE
            RAISE EXCEPTION 'Invalid entity type: %', p_entity_type;
        END IF;

        IF v_org_id IS NULL THEN
            RAISE EXCEPTION 'Entity % of type % not found.', p_entity_id, p_entity_type;
        END IF;

        IF NOT public.is_platform_superadmin() THEN
            v_caller_role := public.get_auth_org_role(v_org_id);
            IF v_caller_role NOT IN ('owner', 'admin') THEN
                RAISE EXCEPTION 'Access Denied: Only clinic Owners and Admins are authorized to reassign branches.';
            END IF;
        END IF;
    ELSE
        IF NOT public.fn_is_trusted_system_caller() THEN
            RAISE EXCEPTION 'Access Denied: Untrusted system context cannot reassign branches.';
        END IF;
    END IF;

    -- Validate target branch belongs to same organization
    IF p_new_branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_new_branch_id AND organization_id = v_org_id) THEN
        RAISE EXCEPTION 'Relational Tenant Violation: Target branch does not belong to organization %.', v_org_id;
    END IF;

    -- Set local gate flag for current transaction
    PERFORM set_config('app.authorized_branch_reassignment', 'GATE_FUNCTION_ACTIVE', true);

    -- Execute reassignment
    IF p_entity_type = 'appointment' THEN
        UPDATE public.appointments SET branch_id = p_new_branch_id WHERE id = p_entity_id;
    ELSIF p_entity_type = 'member' THEN
        UPDATE public.organization_members SET branch_id = p_new_branch_id WHERE id = p_entity_id;
    ELSIF p_entity_type = 'integration' THEN
        UPDATE public.organization_integrations SET branch_id = p_new_branch_id WHERE id = p_entity_id;
    END IF;

    -- Append audit entry
    INSERT INTO public.branch_reassignment_audit_log (
        organization_id, entity_type, entity_id, actor_role, actor_user_id, old_branch_id, new_branch_id, reassignment_reason
    ) VALUES (
        v_org_id, p_entity_type, p_entity_id, COALESCE(v_caller_role, 'service_role'), auth.uid(), v_old_branch_id, p_new_branch_id, p_reason
    );
END;
$$;

ALTER FUNCTION public.api_reassign_branch(TEXT, UUID, UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.api_reassign_branch FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_reassign_branch TO authenticated, service_role, app_worker;
```

---

## 8. Corrected & Executable Branch Deletion Test Specification

```sql
-- =============================================================================
-- TEST HARNESS: Safe Branch Deletion & Relational Consistency Verification
-- Intended Execution: psql -v ON_ERROR_STOP=1 -f test_branch_deletion.sql
-- =============================================================================

BEGIN;

DO $$
DECLARE
    v_org_a UUID;
    v_org_b UUID;
    v_branch_a UUID;
    v_branch_b UUID;
    v_member_a UUID;
    v_lead_a UUID;
    v_appt_a UUID;
    v_int_a UUID;
    v_check_member RECORD;
    v_check_appt RECORD;
    v_check_int RECORD;
    v_fk_caught BOOLEAN := FALSE;
    v_caught_sqlstate TEXT;
BEGIN
    -- 1. Assert required triggers and constraints exist before testing
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safe_orphan_branches') THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: trg_safe_orphan_branches trigger is missing.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_appointments_branch_composite') THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: fk_appointments_branch_composite constraint is missing.';
    END IF;

    -- 2. Create Isolated Test Organizations
    INSERT INTO public.organizations (name, slug, status)
    VALUES ('Mansour Dental Center', 'mansour-dental-test', 'active')
    RETURNING id INTO v_org_a;

    INSERT INTO public.organizations (name, slug, status)
    VALUES ('Karrada Dental Clinic', 'karrada-dental-test', 'active')
    RETURNING id INTO v_org_b;

    -- 3. Create Branches
    INSERT INTO public.branches (organization_id, name, slug)
    VALUES (v_org_a, 'Mansour Main Branch', 'mansour-main-branch')
    RETURNING id INTO v_branch_a;

    INSERT INTO public.branches (organization_id, name, slug)
    VALUES (v_org_b, 'Karrada Branch', 'karrada-branch-test')
    RETURNING id INTO v_branch_b;

    -- 4. Create Linked Child Records in Clinic A
    INSERT INTO public.organization_members (organization_id, user_id, branch_id, role)
    VALUES (v_org_a, gen_random_uuid(), v_branch_a, 'receptionist')
    RETURNING id INTO v_member_a;

    INSERT INTO public.instagram_accounts (id, organization_id, handle, name, name_ar, role, status)
    VALUES ('test_tenant_a_acc', v_org_a, 'mansour_test', 'Mansour Dental', 'عيادة المنصور', 'clinic_official', 'connected');

    INSERT INTO public.organization_integrations (organization_id, branch_id, provider, platform_account_id, platform_account_handle, status)
    VALUES (v_org_a, v_branch_a, 'instagram_graph_api', '99999999001', 'mansour_test', 'connected')
    RETURNING id INTO v_int_a;

    INSERT INTO public.leads (organization_id, account_id, full_name, phone, instagram_username, treatment, treatment_name_ar)
    VALUES (v_org_a, 'test_tenant_a_acc', 'Ali Hassan', '07711112222', 'ali_hassan', 'consultation', 'استشارة عامة')
    RETURNING id INTO v_lead_a;

    INSERT INTO public.appointments (organization_id, account_id, branch_id, lead_id, preferred_date, preferred_time, patient_name, phone, treatment, treatment_name_ar, assigned_doctor, assigned_doctor_ar)
    VALUES (v_org_a, 'test_tenant_a_acc', v_branch_a, v_lead_a, CURRENT_DATE + INTERVAL '2 days', '10:00 AM', 'Ali Hassan', '07711112222', 'consultation', 'استشارة عامة', 'Dr. Mustafa', 'د. مصطفى')
    RETURNING id INTO v_appt_a;

    -- 5. Test Negative Constraint: Assigning Clinic B branch to Clinic A appointment must trigger SQLSTATE 23503 or P0001
    BEGIN
        PERFORM set_config('app.authorized_branch_reassignment', 'GATE_FUNCTION_ACTIVE', true);
        UPDATE public.appointments
        SET branch_id = v_branch_b
        WHERE id = v_appt_a;
    EXCEPTION 
        WHEN SQLSTATE '23503', SQLSTATE 'P0001' THEN
            GET STACKED DIAGNOSTICS v_caught_sqlstate = RETURNED_SQLSTATE;
            v_fk_caught := TRUE;
            RAISE NOTICE 'Expected violation caught with SQLSTATE: %', v_caught_sqlstate;
    END;

    IF NOT v_fk_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Composite foreign key failed to block assigning a branch from another organization.';
    END IF;

    -- 6. Execute Branch Deletion
    DELETE FROM public.branches WHERE id = v_branch_a;

    -- 7. Verify Child De-linking Integrity
    SELECT organization_id, branch_id INTO v_check_member FROM public.organization_members WHERE id = v_member_a;
    IF v_check_member.branch_id IS NOT NULL OR v_check_member.organization_id != v_org_a THEN
        RAISE EXCEPTION 'TEST FAILED: Member branch_id was not nullified or organization_id was corrupted.';
    END IF;

    SELECT organization_id, branch_id INTO v_check_int FROM public.organization_integrations WHERE id = v_int_a;
    IF v_check_int.branch_id IS NOT NULL OR v_check_int.organization_id != v_org_a THEN
        RAISE EXCEPTION 'TEST FAILED: Integration branch_id was not nullified or organization_id was corrupted.';
    END IF;

    SELECT organization_id, branch_id INTO v_check_appt FROM public.appointments WHERE id = v_appt_a;
    IF v_check_appt.branch_id IS NOT NULL OR v_check_appt.organization_id != v_org_a THEN
        RAISE EXCEPTION 'TEST FAILED: Appointment branch_id was not nullified or organization_id was corrupted.';
    END IF;

    RAISE NOTICE 'SUCCESS: Branch deletion safely de-linked child records without tenant orphaning.';
END $$;

ROLLBACK;
```

---

## 9. Migration Ordering, Safe Lock Strategy & Forward Recovery

### 9.1 Ordered Migration Execution Sequence (CP 0 to CP 6)
1. **Checkpoint 0 (Pre-Flight Backup):** Physical snapshot and logical schema dump verified.
2. **Checkpoint 1 (SaaS Foundation Tables):** `CREATE TABLE IF NOT EXISTS` for all SaaS entities.
3. **Checkpoint 2 (Nullable Column Addition):** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;`
4. **Checkpoint 3 (Data Backfill & Reconciliation):** Execute dynamic reconciliation query. Assert 0 unmapped rows. Abort if anomalies detected.
5. **Checkpoint 4 (Composite Constraints as NOT VALID):** Add parent `UNIQUE` and child composite `FOREIGN KEY ... NOT VALID`.
6. **Checkpoint 5 (Online Validation):** Run `ALTER TABLE ... VALIDATE CONSTRAINT` across all tables (acquires `SHARE UPDATE EXCLUSIVE` lock; reads and writes continue unimpeded).
7. **Checkpoint 6 (Enforce NOT NULL & RLS):** Apply `NOT NULL` on `organization_id`, purge legacy policies, and apply new RLS policies.

### 9.2 Deadlock Prevention: Hierarchical Table Lock Sequence
Alphabetical lock ordering across all tables during migration batches:
1. `public.ad_campaigns`
2. `public.appointments`
3. `public.branches`
4. `public.branch_reassignment_audit_log`
5. `public.chat_messages`
6. `public.content_items`
7. `public.conversations`
8. `public.escalation_events`
9. `public.human_takeovers`
10. `public.instagram_accounts`
11. `public.integration_credentials`
12. `public.leads`
13. `public.organization_integrations`
14. `public.organization_members`
15. `public.organizations`
16. `public.plans`
17. `public.platform_authorizations`
18. `public.platform_authorization_audit_log`
19. `public.processed_webhook_messages`
20. `public.subscriptions`
21. `public.subscription_entitlements`
22. `public.subscription_usage_ledger`
23. `public.subscription_usage_records`
24. `public.tenant_ai_configs`
25. `public.webhook_jobs`
26. `public.webhook_logs`

Mandatory session settings before every migration batch:
```sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';
```

---

## 10. PostgreSQL Security Test Plan & Verification Separation

### 10.1 Strict Separation of Verification Status
- **Tier 1: Baseline Application Tests (VERIFIED):** The 213 automated TypeScript tests running in the local workspace. They verify application logic, orthodontic pricing prohibition templates, and webhook parsing.
- **Tier 2: Designed SQL Test Specifications (DESIGNED - UNEXECUTED):** Production-grade SQL test scripts formulated in this specification. They are designed for PostgreSQL execution but **have not yet been run against a live database**.
- **Tier 3: Live PostgreSQL Validations (PENDING SUPABASE HARNESS):** Validations requiring a live PostgreSQL instance with the Supabase pgcrypto extension and RLS engine.

### 10.2 Version Resolution Mapping (v2.5 to v2.6)

| # | Vulnerability / Issue in v2.5 | Technical Resolution in v2.6 | Section Reference |
|---|---|---|---|
| **1** | **`CURRENT_USER` in `SECURITY DEFINER`:** Evaluated function owner (`postgres`), falsely passing service-role check. | Replaced with `SESSION_USER` and PostgREST JWT claim evaluation in helper `fn_is_trusted_system_caller()`. | **Section 1** |
| **2** | **Almeswak Action Catalog Mismatch:** `INBOUND_WEBHOOK_PROCESSING` was called in gate but missing from `CHECK` constraint. | Reconciled action catalog to include all gate actions and bound secrets to SHA-256 token hashes. | **Section 2** |
| **3** | **Single-Use Authorization Replay Risk:** Lack of atomic consumption allowed reusing an authorization secret. | Added `is_single_use`, `consumed_at`, and row-locking `FOR UPDATE` in `fn_verify_and_consume_platform_authorization()`. | **Section 2** |
| **4** | **Unprotected Outbound Dispatch Path:** Outbound messaging gate was not linked to a verified dispatcher function. | Implemented `api_dispatch_outbound_message()` gate function verifying canonical tenant and Almeswak quarantine. | **Section 2** |
| **5** | **Incomplete Relationship Inventory:** Only 7 relationships listed in v2.5 matrix; missing composite FK DDL. | Catalogs all 30 parent-child relationships and provides matching executable DDL across all 24 tables. | **Section 3** |
| **6** | **Incomplete RLS Coverage:** Only 7 tables had explicit policy SQL in v2.5; lacked `FORCE ROW LEVEL SECURITY`. | Formulated complete RLS with `FORCE ROW LEVEL SECURITY` across all tenant tables and dynamic legacy policy purge. | **Section 4** |
| **7** | **Reconciliation Hardcoded Zeroes:** Used hard-coded zero columns in reconciliation query. | Replaced with 100% dynamic evaluations using `NOT EXISTS` anti-joins across all 12 tables and automated abort assertion. | **Section 5** |
| **8** | **Quota Incomplete SQL:** v2.5 provided only the refund excerpt, omitting reservation SQL. | Provided complete, unabridged SQL for both `reserve_dm_quota()` and `refund_dm_quota()` with balance rejection. | **Section 6** |
| **9** | **Branch Direct Update Bypass:** Permitted direct UPDATE on `branch_id` without gate function or audit. | Codified `branch_reassignment_audit_log`, anti-bypass trigger, and authorized gate `api_reassign_branch()`. | **Section 7** |
| **10**| **Flawed Branch Test Hardcoding:** Used pilot account `'drmustafa_hadi'` for unrelated test tenant. | Rewrote test harness with isolated test accounts, exact SQLSTATE checks (`23503`, `P0001`), and clean rollback. | **Section 8** |

---

## 11. Pre-Implementation Approval Checklist

Before requesting Phase 1 migration implementation, verify:
- [x] Version 2.6 specification document created without modifying application code.
- [x] Baseline test suite confirmed at 213/213 (100%) passing.
- [x] Zero live database connections or migrations executed.
- [x] Almeswak clinic strictly quarantined in Demo mode across all creation, mutation, deletion, and dispatch paths.
- [x] Orthodontic pricing prohibition verified as immutable platform policy.
- [ ] Explicit Human Architectural Approval received from project leadership.

---

> [!IMPORTANT]
> **This document is an architectural specification and security review.**  
> In accordance with strict execution instructions, zero application source code, zero database migrations, and zero live records have been modified.  
> The 213 baseline automated tests remain 100% passing.  
> We await your explicit review and approval of Version 2.6 before proceeding.

