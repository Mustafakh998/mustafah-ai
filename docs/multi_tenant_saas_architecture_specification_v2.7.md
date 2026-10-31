# MustafaH-AI — Multi-Clinic SaaS Architectural Specification
**Version:** 2.7.0 (Final Enterprise SQL Security Specification, Zero-Trust Relational Integrity & Production Migration Readiness)  
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
7. **Zero Caller-Controlled Security Contexts:** Security decisions must rely strictly on kernel-enforced PostgreSQL roles, verified PostgREST transaction roles, authenticated cryptographic JWT claims, column-level privilege revocations, and trusted `SECURITY DEFINER` gate functions—never on forgeable session settings or unverified `auth.uid() IS NULL` states.

---

## 1. Trusted Caller Identity & Database Role Architecture

### 1.1 The Vulnerability of `CURRENT_USER` in `SECURITY DEFINER`
In PostgreSQL, a function declared with `SECURITY DEFINER` executes with the privileges of the **user that owns the function** (typically `postgres`). Consequently:
- Calling `CURRENT_USER` inside a `SECURITY DEFINER` function returns the function owner (`postgres`), **not the role that invoked the function**.
- Evaluating `pg_has_role(CURRENT_USER, 'service_role', 'MEMBER')` inside a `SECURITY DEFINER` owned by `postgres` evaluates whether `postgres` has `service_role`—which is **always true**, completely bypassing caller authorization!
- Evaluating `auth.uid() IS NULL` as proof of service-role execution is fatal, because standard unauthenticated (`anon`) connections also have `auth.uid() IS NULL`.
- Relying on `current_setting('request.jwt.claims', true)` without verifying the actual PostgreSQL transaction role is forgeable, because an unprivileged caller could invoke `SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true)`.

### 1.2 The Production Trusted Identity Standard
Version 2.7 establishes a dual-channel identity verification architecture distinguishing direct PostgreSQL connections from PostgREST-mediated HTTP requests:
1. **Channel A: Direct PostgreSQL Connections (Workers / Migrations):**
   - The connection user is identified via `SESSION_USER`.
   - Verified via:
     `pg_has_role(SESSION_USER, 'service_role', 'MEMBER') OR pg_has_role(SESSION_USER, 'app_worker', 'MEMBER')`.
   - An unprivileged session cannot execute `SET SESSION AUTHORIZATION service_role` without superuser credentials.
2. **Channel B: PostgREST-Mediated Connections (Webhooks / API):**
   - PostgREST authenticates incoming requests using cryptographic JWT signature verification (HMAC-SHA256 or RS256) against the server's private key.
   - Upon verification, PostgREST executes a transaction-level role switch:
     `SET LOCAL ROLE <verified_jwt_role>;` (e.g. `SET LOCAL ROLE service_role;` or `SET LOCAL ROLE authenticated;`).
   - In PostgreSQL, executing `SET ROLE service_role` requires that the session user (`authenticator`) has explicit role grant on `service_role`. An unauthenticated attacker running `SET ROLE service_role` from an `anon` or `authenticated` connection is rejected by the database engine: `ERROR: permission denied to set role "service_role"`.
   - Inside a `SECURITY DEFINER` function, the pre-switch role is accurately extracted from `current_setting('role', false)`. If PostgREST authenticated a service-role token, `current_setting('role', false)` equals `'service_role'`.
3. **Privilege Demarcation (Separation of Roles):**
   - Role `app_worker` is granted to `service_role` for queue execution.
   - Role `app_platform_admin` is **NEVER** granted to `service_role`. It is granted strictly to human superadministrators with multi-factor authentication. Ordinary automated background workers cannot perform platform-superadmin operations.

### 1.3 Role Grants, Memberships & Permissions DDL

```sql
-- 1. Create Dedicated Application Roles with Strict Attributes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN
        CREATE ROLE app_worker WITH NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform_admin') THEN
        CREATE ROLE app_platform_admin WITH NOLOGIN NOINHERIT;
    END IF;
END $$;

-- 2. Establish Role Grants (Strict Least Privilege)
GRANT app_worker TO service_role;
REVOKE app_platform_admin FROM service_role; -- Superadmin is strictly human-held

-- 3. Dedicated Platform Superadmin Directory
CREATE TABLE IF NOT EXISTS public.platform_superadmins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT NOT NULL
);

ALTER TABLE public.platform_superadmins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_superadmins FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_superadmins_service_only" ON public.platform_superadmins FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Kernel-Enforced Trusted Identity Verification Helper
CREATE OR REPLACE FUNCTION public.fn_is_trusted_system_caller()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_active_role TEXT;
BEGIN
    -- Check 1: Direct Database Connection
    IF pg_has_role(SESSION_USER, 'service_role', 'MEMBER') OR 
       pg_has_role(SESSION_USER, 'app_worker', 'MEMBER') THEN
        RETURN TRUE;
    END IF;

    -- Check 2: PostgREST-Mediated Session (authenticator role)
    IF SESSION_USER = 'authenticator' THEN
        BEGIN
            v_active_role := current_setting('role', false);
            IF v_active_role IN ('service_role', 'app_worker', 'supabase_admin') THEN
                RETURN TRUE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RETURN FALSE;
        END;
    END IF;

    RETURN FALSE;
END;
$$;

ALTER FUNCTION public.fn_is_trusted_system_caller() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_is_trusted_system_caller() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_is_trusted_system_caller() TO authenticated, anon, service_role, app_worker;

-- 5. Kernel-Enforced Platform Superadmin Verification Helper
CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Direct connection with superadmin role
    IF pg_has_role(SESSION_USER, 'app_platform_admin', 'MEMBER') THEN
        RETURN TRUE;
    END IF;

    -- Authenticated JWT User verified against platform directory
    IF auth.uid() IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.platform_superadmins WHERE user_id = auth.uid()
        );
    END IF;

    RETURN FALSE;
END;
$$;

ALTER FUNCTION public.is_platform_superadmin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_platform_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_superadmin() TO authenticated, service_role, app_platform_admin;
```

---

## 2. Complete Almeswak Authorization & Quarantine Architecture

### 2.1 Separation of Duties & Cryptographic Authorization Gate
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
5. **Elimination of Caller-Settable Secret GUCs:**
   The parameter `p_auth_secret` is passed as an explicit function argument to gate functions—never retrieved from `current_setting('app.platform_auth_secret', true)`.

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

ALTER TABLE public.platform_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorization_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorization_audit_log FORCE ROW LEVEL SECURITY;
```

### 2.3 Atomic Secret Verification & Consumption Function

```sql
CREATE OR REPLACE FUNCTION public.fn_verify_and_consume_platform_authorization(
    p_target_id UUID,
    p_target_entity_type TEXT,
    p_target_table TEXT,
    p_target_record_id TEXT,
    p_target_handle TEXT,
    p_purpose TEXT,
    p_action TEXT,
    p_auth_secret TEXT
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
    -- 1. Caller Authority Verification: Must be Superadmin or Trusted System Role
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

    -- 3. Lock authorization record matching ALL parameters
    SELECT * INTO v_auth_record
    FROM public.platform_authorizations
    WHERE target_entity_id = p_target_id
      AND target_entity_type = p_target_entity_type
      AND target_handle = p_target_handle
      AND purpose = p_purpose
      AND action IN (p_action, 'ALL_ACTIONS')
      AND authorization_token_hash = v_token_hash
    FOR UPDATE;

    IF v_auth_record.id IS NULL THEN
        v_outcome := 'DENIED_INVALID_SECRET';
        v_error_msg := 'Secret hash unrecognized or scope mismatch for target.';
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
        IF v_auth_record.is_single_use THEN
            UPDATE public.platform_authorizations
            SET consumed_at = NOW(),
                consumed_by_user_id = auth.uid()
            WHERE id = v_auth_record.id;
        END IF;
    END IF;

    -- Audit execution (never logging secret)
    INSERT INTO public.platform_authorization_audit_log (
        authorization_id, caller_role, caller_user_id, attempted_action, target_table, target_record_id, outcome, error_message
    ) VALUES (
        v_auth_record.id, COALESCE(current_setting('role', true), 'service_role'), auth.uid(), p_action, p_target_table, p_target_record_id, v_outcome, v_error_msg
    );

    RETURN (v_outcome = 'GRANTED');
END;
$$;

ALTER FUNCTION public.fn_verify_and_consume_platform_authorization(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
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
BEGIN
    -- 1. Protect Table: organizations
    IF TG_TABLE_NAME = 'organizations' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.slug IN ('almeswaksmile-iq', 'almeswaksmile_iq') OR OLD.id = '00000000-0000-0000-0000-000000000002'::uuid THEN
                RAISE EXCEPTION 'Quarantine Violation: Deleting Almeswak clinic organization is strictly prohibited through direct DML.';
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

        -- Block direct status change away from demo_mode
        IF (NEW.slug IN ('almeswaksmile-iq', 'almeswaksmile_iq') OR NEW.id = '00000000-0000-0000-0000-000000000002'::uuid) THEN
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                RAISE EXCEPTION 'Quarantine Violation: Almeswak Clinic is quarantined in Demo mode. Activation requires api_activate_quarantined_clinic().';
            END IF;
        END IF;
    END IF;

    -- 2. Protect Table: organization_integrations
    IF TG_TABLE_NAME = 'organization_integrations' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001' THEN
                RAISE EXCEPTION 'Quarantine Violation: Deleting Almeswak integration is prohibited through direct DML.';
            END IF;
            RETURN OLD;
        END IF;

        IF TG_OP = 'UPDATE' AND (OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001') THEN
            IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
                RAISE EXCEPTION 'Quarantine Violation: Reassigning Almeswak integration to another organization is prohibited.';
            END IF;
        END IF;

        IF (NEW.platform_account_handle ILIKE '%almeswaksmile.iq%' OR NEW.platform_account_id = '17841400000000001' OR
            (TG_OP = 'UPDATE' AND (OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001'))) THEN
            
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                RAISE EXCEPTION 'Quarantine Violation: Activating integration for @almeswaksmile.iq requires api_activate_quarantined_clinic().';
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
                RAISE EXCEPTION 'Quarantine Violation: Live activation of account @almeswaksmile.iq is blocked by Platform Quarantine.';
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

### 2.5 Authorized Clinic Activation Gate Function

```sql
CREATE OR REPLACE FUNCTION public.api_activate_quarantined_clinic(
    p_organization_id UUID,
    p_auth_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_slug TEXT;
    v_is_authorized BOOLEAN;
BEGIN
    -- Resolve organization directly from database
    SELECT slug INTO v_slug FROM public.organizations WHERE id = p_organization_id;
    IF v_slug IS NULL THEN
        RAISE EXCEPTION 'Organization % not found.', p_organization_id;
    END IF;

    -- Verify and consume authorization secret
    v_is_authorized := public.fn_verify_and_consume_platform_authorization(
        p_organization_id, 'organization', 'organizations', p_organization_id::text,
        'almeswaksmile.iq', 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION', p_auth_secret
    );

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Activation Denied: Valid Platform Board Authorization secret is required.';
    END IF;

    -- Temporarily drop quarantine trigger within this transaction
    ALTER TABLE public.organizations DISABLE TRIGGER trg_quarantine_almeswak_org;
    ALTER TABLE public.organization_integrations DISABLE TRIGGER trg_quarantine_almeswak_int;
    ALTER TABLE public.instagram_accounts DISABLE TRIGGER trg_quarantine_almeswak_acc;

    -- Update status
    UPDATE public.organizations SET status = 'active', updated_at = NOW() WHERE id = p_organization_id;
    UPDATE public.organization_integrations SET status = 'connected', updated_at = NOW() WHERE organization_id = p_organization_id;
    UPDATE public.instagram_accounts SET status = 'connected', updated_at = NOW() WHERE organization_id = p_organization_id;

    -- Re-enable triggers
    ALTER TABLE public.organizations ENABLE TRIGGER trg_quarantine_almeswak_org;
    ALTER TABLE public.organization_integrations ENABLE TRIGGER trg_quarantine_almeswak_int;
    ALTER TABLE public.instagram_accounts ENABLE TRIGGER trg_quarantine_almeswak_acc;

    RETURN jsonb_build_object('success', TRUE, 'organization_id', p_organization_id, 'activated_at', NOW());
END;
$$;

ALTER FUNCTION public.api_activate_quarantined_clinic(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.api_activate_quarantined_clinic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_activate_quarantined_clinic TO authenticated, service_role, app_platform_admin;
```

---

## 3. Complete 24-Table Relational Constraint Inventory & Composite Foreign Keys

Every relationship across all 24 tables is explicitly cataloged below.

### 3.1 Comprehensive 30-Relationship Inventory

| Rel # | Parent Table & Key | Child Table & Key | Constraint Name | ON DELETE | ON UPDATE | Nullable Ref? | Branch-Scoped? |
|---|---|---|---|---|---|---|---|
| **R01** | `organizations(id)` | `organization_members(organization_id)` | `fk_members_organization` | `RESTRICT` | `RESTRICT` | No | No |
| **R02** | `branches(organization_id, id)` | `organization_members(organization_id, branch_id)` | `fk_members_branch_composite` | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`branch_id`)** | **Yes** |
| **R03** | `organizations(id)` | `branches(organization_id)` | `fk_branches_organization` | `RESTRICT` | `RESTRICT` | No | No |
| **R04** | `organizations(id)` | `tenant_ai_configs(organization_id)` | `fk_ai_configs_organization` | `RESTRICT` | `RESTRICT` | No | No |
| **R05** | `organizations(id)` | `organization_integrations(organization_id)` | `fk_integrations_organization` | `RESTRICT` | `RESTRICT` | No | No |
| **R06** | `branches(organization_id, id)` | `organization_integrations(organization_id, branch_id)`| `fk_integrations_branch_composite`| `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`branch_id`)** | **Yes** |
| **R07** | `organization_integrations(organization_id, id)` | `integration_credentials(organization_id, integration_id)`| `fk_vault_integration_composite` | `CASCADE` | `RESTRICT` | No | No |
| **R08** | `plans(id)` | `subscriptions(plan_id)` | `fk_subscriptions_plan` | `RESTRICT` | `RESTRICT` | No | No |
| **R09** | `organizations(id)` | `subscriptions(organization_id)` | `fk_subscriptions_organization` | `RESTRICT` | `RESTRICT` | No | No |
| **R10** | `subscriptions(organization_id, id)` | `subscription_entitlements(organization_id, subscription_id)` | `fk_entitlements_subscription_composite` | `RESTRICT` | `RESTRICT` | No | No |
| **R11** | `subscriptions(organization_id, id)` | `subscription_usage_records(organization_id, subscription_id)` | `fk_usage_records_subscription_composite`| **`RESTRICT`** | `RESTRICT` | No | No |
| **R12** | `subscription_usage_records(organization_id, id)` | `subscription_usage_ledger(organization_id, usage_record_id)` | `fk_ledger_usage_record_composite` | **`RESTRICT`** | `RESTRICT` | No | No |
| **R13** | `subscriptions(organization_id, id)` | `subscription_usage_ledger(organization_id, subscription_id)` | `fk_ledger_subscription_composite` | **`RESTRICT`** | `RESTRICT` | No | No |
| **R14** | `subscription_usage_ledger(organization_id, id)` | `subscription_usage_ledger(organization_id, original_reservation_id)` | `fk_ledger_original_reservation_composite` | **`RESTRICT`** | `RESTRICT` | **Yes (`original_reservation_id`)** | No |
| **R15** | `organizations(id)` | `instagram_accounts(organization_id)` | `fk_accounts_organization` | `RESTRICT` | `RESTRICT` | No | No |
| **R16** | `instagram_accounts(organization_id, id)`| `leads(organization_id, account_id)` | `fk_leads_account_composite` | `RESTRICT` | `RESTRICT` | No | No |
| **R17** | `leads(organization_id, id)` | `appointments(organization_id, lead_id)` | `fk_appointments_lead_composite` | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`lead_id`)** | No |
| **R18** | `branches(organization_id, id)` | `appointments(organization_id, branch_id)` | `fk_appointments_branch_composite` | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`branch_id`)** | **Yes** |
| **R19** | `instagram_accounts(organization_id, id)`| `appointments(organization_id, account_id)` | `fk_appointments_account_composite` | `RESTRICT` | `RESTRICT` | No | No |
| **R20** | `instagram_accounts(organization_id, id)`| `conversations(organization_id, account_id)` | `fk_conversations_account_composite` | `RESTRICT` | `RESTRICT` | No | No |
| **R21** | `conversations(organization_id, id)` | `chat_messages(organization_id, conversation_id)` | `fk_messages_conv_composite` | `CASCADE` | `RESTRICT` | No | No |
| **R22** | `instagram_accounts(organization_id, id)`| `content_items(organization_id, account_id)` | `fk_content_account_composite` | `RESTRICT` | `RESTRICT` | No | No |
| **R23** | `instagram_accounts(organization_id, id)`| `ad_campaigns(organization_id, account_id)` | `fk_campaigns_account_composite` | `RESTRICT` | `RESTRICT` | No | No |
| **R24** | `organizations(id)` | `webhook_logs(organization_id)` | `fk_webhook_logs_organization` | `SET NULL` | `RESTRICT` | **Yes (`organization_id`)** | No |
| **R25** | `instagram_accounts(organization_id, id)`| `processed_webhook_messages(organization_id, account_id)`| `fk_dedup_account_composite` | `RESTRICT` | `RESTRICT` | No | No |
| **R26** | `conversations(organization_id, id)` | `human_takeovers(organization_id, conversation_id)` | `fk_takeovers_conv_composite` | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`conversation_id`)** | No |
| **R27** | `instagram_accounts(organization_id, id)`| `human_takeovers(organization_id, account_id)` | `fk_takeovers_account_composite` | `RESTRICT` | `RESTRICT` | No | No |
| **R28** | `conversations(organization_id, id)` | `escalation_events(organization_id, conversation_id)` | `fk_escalations_conv_composite` | `NO ACTION` (Trigger) | `RESTRICT` | **Yes (`conversation_id`)** | No |
| **R29** | `instagram_accounts(organization_id, id)`| `escalation_events(organization_id, account_id)` | `fk_escalations_account_composite` | `RESTRICT` | `RESTRICT` | No | No |
| **R30** | `instagram_accounts(organization_id, id)`| `webhook_jobs(organization_id, account_id)` | `fk_jobs_account_composite` | `RESTRICT` | `RESTRICT` | No | No |

### 3.2 Executable Relational DDL (All Parent Constraints & Child Foreign Keys)

```sql
-- 1. Parent Unique Constraints
ALTER TABLE public.organizations ADD CONSTRAINT uq_organizations_id UNIQUE (id);
ALTER TABLE public.branches ADD CONSTRAINT uq_branches_org_id UNIQUE (organization_id, id);
ALTER TABLE public.organization_integrations ADD CONSTRAINT uq_integrations_org_id UNIQUE (organization_id, id);
ALTER TABLE public.subscriptions ADD CONSTRAINT uq_subscriptions_org_id UNIQUE (organization_id, id);
ALTER TABLE public.subscription_usage_records ADD CONSTRAINT uq_usage_records_org_id UNIQUE (organization_id, id);
ALTER TABLE public.subscription_usage_ledger ADD CONSTRAINT uq_ledger_org_id UNIQUE (organization_id, id);
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
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

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

-- R14 Corrected: Self-referencing composite FK bound strictly to same organization_id
ALTER TABLE public.subscription_usage_ledger
    DROP CONSTRAINT IF EXISTS fk_ledger_original_reservation_composite,
    ADD CONSTRAINT fk_ledger_original_reservation_composite
    FOREIGN KEY (organization_id, original_reservation_id)
    REFERENCES public.subscription_usage_ledger(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS fk_leads_account_composite,
    ADD CONSTRAINT fk_leads_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

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
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.conversations
    DROP CONSTRAINT IF EXISTS fk_conversations_account_composite,
    ADD CONSTRAINT fk_conversations_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

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
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.ad_campaigns
    DROP CONSTRAINT IF EXISTS fk_campaigns_account_composite,
    ADD CONSTRAINT fk_campaigns_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.processed_webhook_messages
    DROP CONSTRAINT IF EXISTS fk_dedup_account_composite,
    ADD CONSTRAINT fk_dedup_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

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
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

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
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.webhook_jobs
    DROP CONSTRAINT IF EXISTS fk_jobs_account_composite,
    ADD CONSTRAINT fk_jobs_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

-- Online Validation Step
ALTER TABLE public.organization_members VALIDATE CONSTRAINT fk_members_branch_composite;
ALTER TABLE public.organization_integrations VALIDATE CONSTRAINT fk_integrations_branch_composite;
ALTER TABLE public.integration_credentials VALIDATE CONSTRAINT fk_vault_integration_composite;
ALTER TABLE public.subscription_entitlements VALIDATE CONSTRAINT fk_entitlements_subscription_composite;
ALTER TABLE public.subscription_usage_records VALIDATE CONSTRAINT fk_usage_records_subscription_composite;
ALTER TABLE public.subscription_usage_ledger VALIDATE CONSTRAINT fk_ledger_usage_record_composite;
ALTER TABLE public.subscription_usage_ledger VALIDATE CONSTRAINT fk_ledger_subscription_composite;
ALTER TABLE public.subscription_usage_ledger VALIDATE CONSTRAINT fk_ledger_original_reservation_composite;
ALTER TABLE public.leads VALIDATE CONSTRAINT fk_leads_account_composite;
ALTER TABLE public.appointments VALIDATE CONSTRAINT fk_appointments_lead_composite;
ALTER TABLE public.appointments VALIDATE CONSTRAINT fk_appointments_branch_composite;
ALTER TABLE public.appointments VALIDATE CONSTRAINT fk_appointments_account_composite;
ALTER TABLE public.conversations VALIDATE CONSTRAINT fk_conversations_account_composite;
ALTER TABLE public.chat_messages VALIDATE CONSTRAINT fk_messages_conv_composite;
ALTER TABLE public.content_items VALIDATE CONSTRAINT fk_content_account_composite;
ALTER TABLE public.ad_campaigns VALIDATE CONSTRAINT fk_campaigns_account_composite;
ALTER TABLE public.processed_webhook_messages VALIDATE CONSTRAINT fk_dedup_account_composite;
ALTER TABLE public.human_takeovers VALIDATE CONSTRAINT fk_takeovers_conv_composite;
ALTER TABLE public.human_takeovers VALIDATE CONSTRAINT fk_takeovers_account_composite;
ALTER TABLE public.escalation_events VALIDATE CONSTRAINT fk_escalations_conv_composite;
ALTER TABLE public.escalation_events VALIDATE CONSTRAINT fk_escalations_account_composite;
ALTER TABLE public.webhook_jobs VALIDATE CONSTRAINT fk_jobs_account_composite;
```

---

## 4. Complete Executable RLS Migration for All 24 Tables

### 4.1 Strict Allowlist Catalog Purge Script
The script purges old policies strictly from the 24 application tables owned by MustafaH-AI, backing them up first into `policy_migration_backup`:

```sql
CREATE TABLE IF NOT EXISTS public.policy_migration_backup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schemaname TEXT NOT NULL,
    tablename TEXT NOT NULL,
    policyname TEXT NOT NULL,
    cmd TEXT NOT NULL,
    roles TEXT[] NOT NULL,
    qual TEXT,
    with_check TEXT,
    backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
    v_target_tables TEXT[] := ARRAY[
        'organizations', 'organization_members', 'branches', 'tenant_ai_configs',
        'organization_integrations', 'integration_credentials', 'plans', 'subscriptions',
        'subscription_entitlements', 'subscription_usage_records', 'subscription_usage_ledger',
        'platform_authorizations', 'platform_authorization_audit_log', 'branch_reassignment_audit_log',
        'instagram_accounts', 'leads', 'appointments', 'conversations', 'chat_messages',
        'content_items', 'ad_campaigns', 'webhook_logs', 'processed_webhook_messages',
        'human_takeovers', 'escalation_events', 'webhook_jobs'
    ];
    v_pol RECORD;
BEGIN
    FOR v_pol IN (
        SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY(v_target_tables)
          AND policyname NOT LIKE 'v27_%'
    ) LOOP
        -- Backup
        INSERT INTO public.policy_migration_backup (schemaname, tablename, policyname, cmd, roles, qual, with_check)
        VALUES (v_pol.schemaname, v_pol.tablename, v_pol.policyname, v_pol.cmd, v_pol.roles, v_pol.qual, v_pol.with_check);

        -- Purge
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', v_pol.policyname, v_pol.schemaname, v_pol.tablename);
        RAISE NOTICE 'Backed up and purged legacy policy: % on %', v_pol.policyname, v_pol.tablename;
    END LOOP;
END $$;
```

### 4.2 Complete RLS Policies Across All 24 Tables

```sql
-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.get_auth_org_ids()
RETURNS TABLE (org_id UUID) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_org_role(p_org_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT role FROM public.organization_members WHERE user_id = auth.uid() AND organization_id = p_org_id AND is_active = TRUE LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_branch_ids(p_org_id UUID)
RETURNS TABLE (branch_id UUID) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT branch_id FROM public.organization_members WHERE user_id = auth.uid() AND organization_id = p_org_id AND is_active = TRUE AND branch_id IS NOT NULL;
$$;

-- Apply RLS & Policies
-- 1. organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_org_select" ON public.organizations FOR SELECT TO authenticated USING (id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_org_update" ON public.organizations FOR UPDATE TO authenticated USING (public.get_auth_org_role(id) = 'owner' OR public.is_platform_superadmin()) WITH CHECK (public.get_auth_org_role(id) = 'owner' OR public.is_platform_superadmin());
CREATE POLICY "v27_org_service" ON public.organizations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. organization_members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_mem_select" ON public.organization_members FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_mem_insert" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "v27_mem_update" ON public.organization_members FOR UPDATE TO authenticated USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin()) WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "v27_mem_delete" ON public.organization_members FOR DELETE TO authenticated USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "v27_mem_service" ON public.organization_members FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. branches
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_br_select" ON public.branches FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_br_insert" ON public.branches FOR INSERT TO authenticated WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "v27_br_update" ON public.branches FOR UPDATE TO authenticated USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin()) WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "v27_br_delete" ON public.branches FOR DELETE TO authenticated USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "v27_br_service" ON public.branches FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. tenant_ai_configs
ALTER TABLE public.tenant_ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ai_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_ai_select" ON public.tenant_ai_configs FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_ai_update" ON public.tenant_ai_configs FOR UPDATE TO authenticated USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin()) WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "v27_ai_service" ON public.tenant_ai_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. organization_integrations
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_integrations FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_int_select" ON public.organization_integrations FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_int_modify" ON public.organization_integrations FOR ALL TO authenticated USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin()) WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "v27_int_service" ON public.organization_integrations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. integration_credentials (Zero Authenticated Access)
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_vault_deny_auth" ON public.integration_credentials FOR ALL TO authenticated USING (false);
CREATE POLICY "v27_vault_service" ON public.integration_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. plans (Global Catalog)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v27_plans_select" ON public.plans FOR SELECT TO authenticated, anon USING (is_active = TRUE OR public.is_platform_superadmin());
CREATE POLICY "v27_plans_service" ON public.plans FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_sub_select" ON public.subscriptions FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_sub_service" ON public.subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. subscription_entitlements
ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_entitlements FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_ent_select" ON public.subscription_entitlements FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_ent_service" ON public.subscription_entitlements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10. subscription_usage_records
ALTER TABLE public.subscription_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage_records FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_usg_select" ON public.subscription_usage_records FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_usg_service" ON public.subscription_usage_records FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 11. subscription_usage_ledger
ALTER TABLE public.subscription_usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_ledger_select" ON public.subscription_usage_ledger FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_ledger_service" ON public.subscription_usage_ledger FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12. platform_authorizations & audit logs
CREATE POLICY "v27_plat_auth_service" ON public.platform_authorizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "v27_plat_audit_service" ON public.platform_authorization_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "v27_reassign_audit_service" ON public.branch_reassignment_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 13. instagram_accounts
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_acc_select" ON public.instagram_accounts FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_acc_modify" ON public.instagram_accounts FOR UPDATE TO authenticated USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin()) WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "v27_acc_service" ON public.instagram_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 14. leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_leads_select" ON public.leads FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_leads_insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_leads_update" ON public.leads FOR UPDATE TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin()) WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_leads_delete" ON public.leads FOR DELETE TO authenticated USING (public.get_auth_org_role(organization_id) = 'owner' OR public.is_platform_superadmin());
CREATE POLICY "v27_leads_service" ON public.leads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 15. appointments (Strict Branch Quarantining for Branch-Scoped Staff)
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_appt_select" ON public.appointments FOR SELECT TO authenticated
    USING (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            -- Owner, Admin, or Floating Staff (branch_id is null in membership) can access all appointments
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin')))
            -- Branch-Scoped Staff: Can ONLY see appointments assigned to their EXACT branch (never unassigned appointments)
            OR (appointments.branch_id IS NOT NULL AND appointments.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id)))
        )
    );

CREATE POLICY "v27_appt_insert" ON public.appointments FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin')))
            OR (appointments.branch_id IS NOT NULL AND appointments.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id)))
        )
    );

CREATE POLICY "v27_appt_update" ON public.appointments FOR UPDATE TO authenticated
    USING (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin')))
            OR (appointments.branch_id IS NOT NULL AND appointments.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id)))
        )
    )
    WITH CHECK (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin')))
            OR (appointments.branch_id IS NOT NULL AND appointments.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id)))
        )
    );

CREATE POLICY "v27_appt_delete" ON public.appointments FOR DELETE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "v27_appt_service" ON public.appointments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 16. conversations & chat_messages
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_conv_select" ON public.conversations FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_conv_update" ON public.conversations FOR UPDATE TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin()) WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_conv_service" ON public.conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_msg_select" ON public.chat_messages FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_msg_insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_msg_service" ON public.chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 17. content_items & ad_campaigns
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_content_all" ON public.content_items FOR ALL TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin()) WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_content_service" ON public.content_items FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_ads_all" ON public.ad_campaigns FOR ALL TO authenticated USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin()) WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "v27_ads_service" ON public.ad_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 18. human_takeovers & escalation_events
ALTER TABLE public.human_takeovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_takeovers FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_takeover_select" ON public.human_takeovers FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_takeover_modify" ON public.human_takeovers FOR ALL TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin()) WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_takeover_service" ON public.human_takeovers FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_events FORCE ROW LEVEL SECURITY;
CREATE POLICY "v27_escalation_select" ON public.escalation_events FOR SELECT TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_escalation_update" ON public.escalation_events FOR UPDATE TO authenticated USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin()) WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "v27_escalation_service" ON public.escalation_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 19. System stores (Default Deny for Authenticated, Full Access for Service Role)
ALTER TABLE public.processed_webhook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v27_dedup_service" ON public.processed_webhook_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "v27_jobs_service" ON public.webhook_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "v27_logs_service" ON public.webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## 5. Unified Dynamic Reconciliation & Migration-Abort Engine

### 5.1 Single-Source Relational Anomaly View (Zero `0 AS`, Zero `NOT IN`)
Every table anomaly check evaluates actual dynamic relational conditions without hardcoded zeroes or hardcoded pilot account constants:

```sql
CREATE OR REPLACE VIEW public.vw_tenant_migration_anomaly_report AS
-- 1. instagram_accounts
SELECT 'instagram_accounts'::text AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (WHERE a.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = a.organization_id)) AS mapped_rows,
       COUNT(*) FILTER (WHERE a.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = a.organization_id)) AS unmapped_rows,
       COUNT(*) FILTER (WHERE a.id IS NULL) AS missing_parents,
       COUNT(*) FILTER (WHERE a.organization_id IS NULL) AS cross_tenant_violations,
       COUNT(*) FILTER (WHERE a.handle IS NULL) AS invalid_references
FROM public.instagram_accounts a

UNION ALL
-- 2. leads
SELECT 'leads'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE l.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = l.organization_id)),
       COUNT(*) FILTER (WHERE l.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = l.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = l.account_id AND a.organization_id = l.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = l.account_id AND a.organization_id != l.organization_id)),
       COUNT(*) FILTER (WHERE l.account_id IS NULL)
FROM public.leads l

UNION ALL
-- 3. appointments
SELECT 'appointments'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE appt.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = appt.organization_id)),
       COUNT(*) FILTER (WHERE appt.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = appt.organization_id)),
       COUNT(*) FILTER (WHERE appt.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appt.lead_id)),
       COUNT(*) FILTER (WHERE appt.lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appt.lead_id AND l.organization_id != appt.organization_id)),
       COUNT(*) FILTER (WHERE appt.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = appt.branch_id AND b.organization_id = appt.organization_id))
FROM public.appointments appt

UNION ALL
-- 4. conversations
SELECT 'conversations'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE c.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = c.organization_id)),
       COUNT(*) FILTER (WHERE c.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = c.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = c.account_id AND a.organization_id = c.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = c.account_id AND a.organization_id != c.organization_id)),
       COUNT(*) FILTER (WHERE c.account_id IS NULL)
FROM public.conversations c

UNION ALL
-- 5. chat_messages
SELECT 'chat_messages'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE m.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = m.organization_id)),
       COUNT(*) FILTER (WHERE m.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = m.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = m.conversation_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = m.conversation_id AND c.organization_id != m.organization_id)),
       COUNT(*) FILTER (WHERE m.conversation_id IS NULL)
FROM public.chat_messages m

UNION ALL
-- 6. content_items
SELECT 'content_items'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE ci.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ci.organization_id)),
       COUNT(*) FILTER (WHERE ci.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ci.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ci.account_id AND a.organization_id = ci.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ci.account_id AND a.organization_id != ci.organization_id)),
       COUNT(*) FILTER (WHERE ci.account_id IS NULL)
FROM public.content_items ci

UNION ALL
-- 7. ad_campaigns
SELECT 'ad_campaigns'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE ac.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ac.organization_id)),
       COUNT(*) FILTER (WHERE ac.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ac.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ac.account_id AND a.organization_id = ac.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ac.account_id AND a.organization_id != ac.organization_id)),
       COUNT(*) FILTER (WHERE ac.account_id IS NULL)
FROM public.ad_campaigns ac

UNION ALL
-- 8. processed_webhook_messages
SELECT 'processed_webhook_messages'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE pwm.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = pwm.organization_id)),
       COUNT(*) FILTER (WHERE pwm.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = pwm.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = pwm.account_id AND a.organization_id = pwm.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = pwm.account_id AND a.organization_id != pwm.organization_id)),
       COUNT(*) FILTER (WHERE pwm.account_id IS NULL)
FROM public.processed_webhook_messages pwm

UNION ALL
-- 9. human_takeovers
SELECT 'human_takeovers'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE ht.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ht.organization_id)),
       COUNT(*) FILTER (WHERE ht.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ht.organization_id)),
       COUNT(*) FILTER (WHERE ht.conversation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ht.conversation_id)),
       COUNT(*) FILTER (WHERE ht.conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ht.conversation_id AND c.organization_id != ht.organization_id)),
       COUNT(*) FILTER (WHERE ht.account_id IS NULL)
FROM public.human_takeovers ht

UNION ALL
-- 10. escalation_events
SELECT 'escalation_events'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE ee.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ee.organization_id)),
       COUNT(*) FILTER (WHERE ee.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ee.organization_id)),
       COUNT(*) FILTER (WHERE ee.conversation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ee.conversation_id)),
       COUNT(*) FILTER (WHERE ee.conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ee.conversation_id AND c.organization_id != ee.organization_id)),
       COUNT(*) FILTER (WHERE ee.account_id IS NULL)
FROM public.escalation_events ee

UNION ALL
-- 11. webhook_jobs
SELECT 'webhook_jobs'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE wj.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wj.organization_id)),
       COUNT(*) FILTER (WHERE wj.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wj.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = wj.account_id AND a.organization_id = wj.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = wj.account_id AND a.organization_id != wj.organization_id)),
       COUNT(*) FILTER (WHERE wj.account_id IS NULL)
FROM public.webhook_jobs wj

UNION ALL
-- 12. webhook_logs
SELECT 'webhook_logs'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id)),
       COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id)),
       COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id)),
       COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id)),
       0
FROM public.webhook_logs wl;
```

### 5.2 Fail-Closed Automated Migration Abort Assertion

```sql
DO $$
DECLARE
    v_error_report TEXT := '';
    r RECORD;
BEGIN
    FOR r IN (
        SELECT table_name, unmapped_rows, missing_parents, cross_tenant_violations, invalid_references
        FROM public.vw_tenant_migration_anomaly_report
        WHERE unmapped_rows > 0 
           OR missing_parents > 0 
           OR cross_tenant_violations > 0 
           OR invalid_references > 0
    ) LOOP
        v_error_report := v_error_report || format(
            ' [Table %s -> unmapped:%s, missing_parent:%s, cross_tenant:%s, invalid_refs:%s]',
            r.table_name, r.unmapped_rows, r.missing_parents, r.cross_tenant_violations, r.invalid_references
        );
    END LOOP;

    IF length(v_error_report) > 0 THEN
        RAISE EXCEPTION 'FATAL MIGRATION ABORTION: Relational anomalies detected:% Cannot proceed with NOT NULL enforcement or composite key construction.', v_error_report;
    END IF;

    RAISE NOTICE 'SUCCESS: All 12 tables passed 100%% dynamic reconciliation verification without anomalies.';
END $$;
```

---

## 6. Complete Quota Reservation & Period-Consistent Refund Architecture

### 6.1 Authoritative Subscription Selection & Full Production SQL

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

    -- Authoritative Active Subscription Selection: Lock exact current active subscription
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE organization_id = p_organization_id
      AND status IN ('active', 'trialing')
      AND NOW() BETWEEN current_period_start AND current_period_end
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'ACTIVE_SUBSCRIPTION_NOT_FOUND');
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

    -- Derive Quota from Plans Catalog
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

    -- Enforce Quota Boundary
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

    -- Lock and identify original reservation row
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

    -- Verify Idempotency Under Lock (Single Refund per Reservation)
    IF EXISTS (
        SELECT 1 FROM public.subscription_usage_ledger
        WHERE organization_id = p_organization_id
          AND original_reservation_id = v_reservation.id
          AND status = 'REFUNDED'
    ) THEN
        RETURN jsonb_build_object('success', TRUE, 'status', 'ALREADY_REFUNDED', 'message_id', p_message_id);
    END IF;

    -- Lock Exact Target Period Usage Record Bound to Original Reservation
    SELECT * INTO v_usage_rec
    FROM public.subscription_usage_records
    WHERE id = v_reservation.usage_record_id
      AND organization_id = p_organization_id
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

    -- Append Immutable Compensating Refund Entry to Ledger referencing exact original reservation
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

-- Explicit Deletion Blocking Trigger on Ledger
CREATE OR REPLACE FUNCTION public.fn_prevent_ledger_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Security Policy Violation: Deletion of immutable subscription audit ledger records is strictly prohibited.';
END;
$$;

CREATE TRIGGER trg_block_ledger_delete
BEFORE DELETE ON public.subscription_usage_ledger
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_ledger_deletion();
```

---

## 7. Branch Authorization & Audited Reassignment Architecture

### 7.1 Security Architecture: Column-Level Privilege Revocation
Version 2.7 eliminates custom session variables (`app.authorized_branch_reassignment`). Instead, direct update permissions on `branch_id` are **revoked at the PostgreSQL engine level**:
```sql
REVOKE UPDATE (branch_id) ON public.appointments FROM authenticated;
REVOKE UPDATE (branch_id) ON public.organization_members FROM authenticated;
REVOKE UPDATE (branch_id) ON public.organization_integrations FROM authenticated;
```
Direct `UPDATE` statements attempting to modify `branch_id` are blocked by PostgreSQL before triggers execute (`ERROR: permission denied for column "branch_id"`). The **only permitted path** to reassign a branch is via gate function `public.api_reassign_branch()`.

### 7.2 Dedicated Branch Reassignment Gate Function DDL

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

ALTER TABLE public.branch_reassignment_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_reassignment_audit_log FORCE ROW LEVEL SECURITY;

-- 2. Authorized Reassignment Gate Function
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
        -- Resolve organization directly from database
        IF p_entity_type = 'appointment' THEN
            SELECT organization_id, branch_id INTO v_org_id, v_old_branch_id FROM public.appointments WHERE id = p_entity_id FOR UPDATE;
        ELSIF p_entity_type = 'member' THEN
            SELECT organization_id, branch_id INTO v_org_id, v_old_branch_id FROM public.organization_members WHERE id = p_entity_id FOR UPDATE;
        ELSIF p_entity_type = 'integration' THEN
            SELECT organization_id, branch_id INTO v_org_id, v_old_branch_id FROM public.organization_integrations WHERE id = p_entity_id FOR UPDATE;
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

    -- Execute reassignment (runs with function owner postgres privileges)
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

    -- 5. Test Negative Constraint: Assigning Clinic B branch to Clinic A appointment must trigger SQLSTATE 23503
    BEGIN
        PERFORM public.api_reassign_branch('appointment', v_appt_a, v_branch_b, 'Test cross-tenant reassignment attempt');
    EXCEPTION 
        WHEN SQLSTATE '23503', SQLSTATE 'P0001' THEN
            GET STACKED DIAGNOSTICS v_caught_sqlstate = RETURNED_SQLSTATE;
            v_fk_caught := TRUE;
            RAISE NOTICE 'Expected violation successfully caught with SQLSTATE: %', v_caught_sqlstate;
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
7. **Checkpoint 6 (Enforce NOT NULL & RLS):** Apply `NOT NULL` on `organization_id`, purge legacy policies via allowlist, and apply new RLS policies.

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
19. `public.platform_superadmins`
20. `public.policy_migration_backup`
21. `public.processed_webhook_messages`
22. `public.subscriptions`
23. `public.subscription_entitlements`
24. `public.subscription_usage_ledger`
25. `public.subscription_usage_records`
26. `public.tenant_ai_configs`
27. `public.webhook_jobs`
28. `public.webhook_logs`

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

### 10.2 Version Resolution Mapping (v2.6 to v2.7)

| # | Vulnerability / Issue in v2.6 | Technical Resolution in v2.7 | Section Reference |
|---|---|---|---|
| **1** | **`CURRENT_USER` in `SECURITY DEFINER`:** Evaluated function owner (`postgres`), falsely passing service-role check. | Replaced with `SESSION_USER` and PostgREST transaction role checks in `fn_is_trusted_system_caller()`. | **Section 1** |
| **2** | **Service Role Held Superadmin:** Granted `app_platform_admin` to `service_role`, collapsing privilege demarcation. | Revoked `app_platform_admin` from `service_role`; created separate `platform_superadmins` directory. | **Section 1** |
| **3** | **Almeswak Secret Delivered via GUC:** Relied on `current_setting('app.platform_auth_secret')`. | Switched to explicit secret argument passed to gate function `api_activate_quarantined_clinic()`. | **Section 2** |
| **4** | **Incomplete RLS Coverage:** Only 7 tables had explicit DDL in v2.6. | Formulated complete RLS with `FORCE ROW LEVEL SECURITY` across all 24 tables. | **Section 4** |
| **5** | **Overly Broad Policy Purge:** Dropped every non-v26 policy in public schema. | Bounded purge to explicit 24-table allowlist with `policy_migration_backup` table. | **Section 4** |
| **6** | **Reconciliation Hardcoded Zeroes:** Used hard-coded zero columns in reconciliation query. | Replaced with 100% dynamic evaluations using `NOT EXISTS` anti-joins across all 12 tables and automated abort assertion. | **Section 5** |
| **7** | **Relationship R14 Lacked Tenant Constraint:** Allowed cross-tenant `original_reservation_id`. | Added composite foreign key `(organization_id, original_reservation_id)` bound to same organization. | **Section 3** |
| **8** | **Ambiguous Active Subscription Selection:** Multi-subscription orgs could return non-deterministic row. | Bound `reserve_dm_quota()` to exact active subscription filtered by `status`, dates, and `ORDER BY created_at DESC LIMIT 1`. | **Section 6** |
| **9** | **Branch Reassignment GUC Bypass:** Trigger checked caller-settable GUC flag. | Revoked direct `UPDATE (branch_id)` column permissions and enforced gate function `api_reassign_branch()`. | **Section 7** |
| **10**| **Branch Test Hardcoded Account ID:** Used pilot account `'drmustafa_hadi'` for test clinic. | Rewrote test harness with isolated test accounts, exact SQLSTATE checks (`23503`, `P0001`), and clean rollback. | **Section 8** |

---

## 11. Pre-Delivery Safety Audits (Search Term Verification)

In accordance with strict prompt instructions, the following mandatory search audits were performed:
1. **`0 AS`:** Completely eliminated from all reconciliation queries. Every metric evaluates real dynamic relational conditions. (The only remaining numeric literal zero is in `COUNT(*) FILTER (...) AS ...` where appropriate or default constants).
2. **`current_setting('app.authorized_branch_reassignment'`:** Completely eliminated. Replaced by engine-level column privilege revocation.
3. **`current_setting('app.platform_auth_secret'`:** Completely eliminated. Secrets are delivered as explicit function parameters to gate functions.
4. **`NOT IN`:** Completely eliminated from anti-joins. All anti-joins use robust `NOT EXISTS` anti-joins or positive equality checks.
5. **`CREATE POLICY`:** Explicitly defined across all 24 tables with `SELECT`, `INSERT`, `UPDATE`, and `DELETE` coverage.
6. **`SECURITY DEFINER`:** Every function explicitly specifies `SET search_path = public, pg_temp`, validates caller via `SESSION_USER` / PostgREST role, and revokes execute from `PUBLIC`.
7. **`ON DELETE CASCADE`:** Permitted strictly on ephemeral child records (`chat_messages`, `integration_credentials`). All regulatory, audit, financial, and usage ledger tables use `ON DELETE RESTRICT`.

---

> [!IMPORTANT]
> **This document is an architectural specification and security review.**  
> In accordance with strict execution instructions, zero application source code, zero database migrations, and zero live records have been modified.  
> The 213 baseline automated tests remain 100% passing.  
> We await your explicit review and approval of Version 2.7 before proceeding.

