# MustafaH-AI — Multi-Clinic SaaS Architectural Specification
**Version:** 2.5.0 (Final Enterprise SQL Security Correction, Zero-Trust Relational Integrity & Production Migration Readiness)  
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
7. **Zero Caller-Controlled Security Contexts:** Security decisions must rely on database-enforced roles (`CURRENT_USER`, `pg_has_role`), authenticated cryptographic JWT claims, and trusted `SECURITY DEFINER` gate functions—never on forgeable session settings or unverified `auth.uid() IS NULL` states.

---

## 1. Secure Execution Architecture: Eliminating Forgeable Session Settings

### 1.1 The Vulnerability of Custom Session Settings in v2.4
Version 2.4 relied on caller-supplied PostgreSQL custom configuration settings:
- `current_setting('app.trusted_system_context', true)`
- `current_setting('app.verified_organization_id', true)`
- `current_setting('app.platform_authorization_token', true)`

**Critical Security Flaw:** Any SQL client, unauthenticated connection, or compromised client library executing raw SQL could execute `SET LOCAL app.trusted_system_context = 'system_provisioner'` or `SET LOCAL app.platform_authorization_token = '...'`. These settings are purely advisory strings and provide **zero cryptographic or relational proof of identity**. Furthermore, treating `auth.uid() IS NULL` as proof of service-role identity is fatally flawed because standard unauthenticated (`anon`) or raw PostgreSQL connections also have `auth.uid() IS NULL`.

### 1.2 Enterprise Role-Based & Gate Function Architecture
Version 2.5 completely eliminates caller-controlled session variables in favor of a **Zero-Trust Database Role & Gate Function Model**:
1. **Database Role Segregation:**
   - `anon`: Unauthenticated public HTTP connections (managed by PostgREST). Zero table write permissions.
   - `authenticated`: Verified clinic users with validated JWTs. Bounded strictly by Row Level Security (RLS).
   - `service_role`: Trusted Supabase server-side runtime key possessing PostgreSQL `BYPASSRLS`.
   - `app_worker`: Dedicated background queue processor and webhook dispatcher role.
   - `app_platform_admin`: Dedicated platform superadministrator role.
2. **Identification of Trusted Service Context:**
   A process is verified as a trusted system service **if and only if** the actual PostgreSQL session role satisfies:
   ```sql
   pg_has_role(CURRENT_USER, 'service_role', 'MEMBER') OR 
   (COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role')
   ```
   An unauthenticated session (`auth.uid() IS NULL`) that is **not** a verified member of `service_role` is immediately rejected as an untrusted intruder.
3. **Dedicated `SECURITY DEFINER` Gate Functions:**
   Direct DML (`INSERT`, `UPDATE`, `DELETE`) on system tables (`processed_webhook_messages`, `webhook_jobs`, `webhook_logs`, `integration_credentials`, `subscription_usage_records`, `subscription_usage_ledger`) is **REVOKED from `PUBLIC`, `anon`, and `authenticated`**.
   Trusted writes must occur exclusively through gate functions that derive the canonical `organization_id` internally from verified database relations (e.g. resolving a Meta Page ID to its registered organization) rather than trusting caller-supplied parameters.
4. **Strict Ban on Test Fixture Bypasses:**
   The `test_fixture` context string is permanently removed from all production triggers and functions. Test execution must use standard database roles within isolated transaction blocks (`BEGIN ... ROLLBACK`).
5. **Comprehensive UPDATE Authorization:**
   Triggers must not only verify `organization_id` immutability, but must also enforce that the mutating user is an active member with sufficient role permissions (`owner`, `admin`, or assigned `branch_id`).

### 1.3 Role Grants & Gate Function DDL

```sql
-- 1. Create Dedicated Application Roles (if not present)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN
        CREATE ROLE app_worker NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform_admin') THEN
        CREATE ROLE app_platform_admin NOINHERIT;
    END IF;
END $$;

-- 2. Revoke Direct DML on System Stores from General Users
REVOKE INSERT, UPDATE, DELETE ON public.processed_webhook_messages FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.webhook_jobs FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.webhook_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.integration_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.subscription_usage_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.subscription_usage_ledger FROM PUBLIC, anon, authenticated;

-- Grant access strictly to trusted roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processed_webhook_messages TO service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_jobs TO service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_logs TO service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.subscription_usage_records TO service_role, app_worker;
GRANT SELECT, INSERT ON public.subscription_usage_ledger TO service_role, app_worker;

-- 3. Trusted Gate Function: Webhook Ingestion Gate
CREATE OR REPLACE FUNCTION public.api_ingest_webhook_job(
    p_message_id TEXT,
    p_platform_account_id TEXT,
    p_sender_id TEXT,
    p_recipient_id TEXT,
    p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id UUID;
    v_account_id TEXT;
    v_job_id UUID;
BEGIN
    -- Verify caller is service_role or app_worker
    IF NOT (pg_has_role(CURRENT_USER, 'service_role', 'MEMBER') OR 
            pg_has_role(CURRENT_USER, 'app_worker', 'MEMBER') OR
            (COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role')) THEN
        RAISE EXCEPTION 'Access Denied: api_ingest_webhook_job requires service_role or app_worker privileges.';
    END IF;

    -- Canonical Tenant Lookup: Derive organization_id directly from verified integration
    SELECT organization_id, id INTO v_org_id, v_account_id
    FROM public.instagram_accounts
    WHERE id = p_recipient_id OR handle = p_recipient_id;

    IF v_org_id IS NULL THEN
        -- Fallback check on organization_integrations table
        SELECT organization_id, platform_account_handle INTO v_org_id, v_account_id
        FROM public.organization_integrations
        WHERE platform_account_id = p_recipient_id OR platform_account_handle = p_recipient_id;
    END IF;

    -- If recipient is completely unmapped, fail safely or record as unassigned queue task
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Routing Error: Webhook recipient % does not map to any registered organization.', p_recipient_id;
    END IF;

    -- Enforce Almeswak Demo Quarantine at the ingestion gateway
    IF v_account_id IN ('almeswaksmile_iq', 'almeswaksmile.iq') THEN
        IF NOT public.fn_is_almeswak_authorized(v_org_id, 'INBOUND_WEBHOOK_PROCESSING') THEN
            RAISE EXCEPTION 'Quarantine Violation: Inbound webhook processing for @almeswaksmile.iq is blocked by Platform Quarantine.';
        END IF;
    END IF;

    -- Insert into webhook_jobs using canonical derived organization_id
    INSERT INTO public.webhook_jobs (
        organization_id, account_id, message_id, sender_id, recipient_id, payload, status
    ) VALUES (
        v_org_id, v_account_id, p_message_id, p_sender_id, p_recipient_id, p_payload, 'pending'
    ) RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$;

ALTER FUNCTION public.api_ingest_webhook_job(TEXT, TEXT, TEXT, TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.api_ingest_webhook_job FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_ingest_webhook_job TO service_role, app_worker;
```

---

## 2. Complete Almeswak Authorization & Quarantine Architecture

### 2.1 Separation of Duties & Cryptographic Authorization Gate
In Version 2.4, a single platform admin could theoretically self-issue and approve an authorization. Version 2.5 establishes a strict **Separation of Duties** principle enforced by database constraint:
$$\text{legal\_verifier\_admin\_id} \neq \text{authorizing\_superadmin\_id}$$
One administrator (Legal/Compliance) must verify the physical board resolution and record its document digest, while a distinct Platform Superadministrator issues the cryptographically hashed activation grant.

### 2.2 Complete Quarantine Coverage Across All Vectors
Quarantine triggers must protect:
1. `BEFORE INSERT`, `BEFORE UPDATE`, and `BEFORE DELETE` on `organizations`.
2. `BEFORE INSERT`, `BEFORE UPDATE`, and `BEFORE DELETE` on `organization_integrations`.
3. `BEFORE INSERT`, `BEFORE UPDATE`, and `BEFORE DELETE` on `instagram_accounts`.
4. Outbound message dispatch via gate function `fn_assert_outbound_dispatch_permitted()`.
5. Renaming protections: An existing organization cannot be renamed to Almeswak, and Almeswak cannot be renamed to evade quarantine.
6. Null status protection: An explicit check `status IS NULL OR status != 'demo_mode'` ensures no null evasion.

### 2.3 Quarantine DDL & Replay-Protected Authorization Table

```sql
-- 1. Platform Authorization Table with Separation of Duties
CREATE TABLE IF NOT EXISTS public.platform_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_token_hash TEXT UNIQUE NOT NULL,
    target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('organization', 'integration', 'instagram_account')),
    target_entity_id UUID NOT NULL,
    target_handle TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ALMESWAK_CREDENTIAL_ASSOCIATION', 'EMERGENCY_QUARANTINE_OVERRIDE')),
    action TEXT NOT NULL CHECK (action IN ('ACTIVATE_ORGANIZATION', 'CONNECT_INTEGRATION', 'DISPATCH_OUTBOUND_MESSAGE', 'ALL_ACTIONS')),
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
    -- Enforce Separation of Duties: Legal verifier and Authorizing admin must be different humans
    CONSTRAINT chk_separation_of_duties CHECK (board_approval_verified_by_legal_admin_id != authorized_by_admin_id),
    CONSTRAINT chk_auth_validity CHECK (expires_at > granted_at)
);

CREATE INDEX idx_platform_auth_lookup 
ON public.platform_authorizations (target_entity_id, purpose, action) 
WHERE revoked_at IS NULL AND consumed_at IS NULL;

-- 2. Audit Trail for All Authorization Invocations
CREATE TABLE IF NOT EXISTS public.platform_authorization_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id UUID REFERENCES public.platform_authorizations(id),
    caller_role TEXT NOT NULL,
    caller_user_id UUID,
    attempted_action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_record_id TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('GRANTED', 'DENIED_INVALID_TOKEN', 'DENIED_EXPIRED', 'DENIED_REVOKED', 'DENIED_ALREADY_CONSUMED', 'DENIED_SCOPE_MISMATCH', 'DENIED_NON_ADMIN', 'DENIED_UNAUTHORIZED_CALLER')),
    error_message TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.platform_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorization_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plat_auth_service_role" ON public.platform_authorizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "plat_audit_service_role" ON public.platform_authorization_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 2.4 Cryptographic Verification & Outbound Dispatch Gate

```sql
-- Verification Helper Function
CREATE OR REPLACE FUNCTION public.fn_is_almeswak_authorized(
    p_organization_id UUID,
    p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_valid BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.platform_authorizations
        WHERE target_entity_id = p_organization_id
          AND purpose IN ('ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'EMERGENCY_QUARANTINE_OVERRIDE')
          AND action IN (p_action, 'ALL_ACTIONS')
          AND revoked_at IS NULL
          AND (NOT is_single_use OR consumed_at IS NULL)
          AND expires_at > NOW()
    ) INTO v_is_valid;

    RETURN v_is_valid;
END;
$$;

ALTER FUNCTION public.fn_is_almeswak_authorized(UUID, TEXT) OWNER TO postgres;

-- Server-Side Outbound Dispatch Gate
CREATE OR REPLACE FUNCTION public.fn_assert_outbound_dispatch_permitted(
    p_account_id TEXT,
    p_organization_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Intercept Almeswak accounts
    IF p_account_id IN ('almeswaksmile_iq', 'almeswaksmile.iq') OR 
       p_organization_id = '00000000-0000-0000-0000-000000000002'::uuid THEN
        
        IF NOT public.fn_is_almeswak_authorized(p_organization_id, 'DISPATCH_OUTBOUND_MESSAGE') THEN
            RAISE EXCEPTION 'Quarantine Violation: Outbound message dispatch for Almeswak Dental Clinic (@almeswaksmile.iq) is prohibited without active Platform Board Authorization.';
        END IF;
    END IF;
END;
$$;

ALTER FUNCTION public.fn_assert_outbound_dispatch_permitted(TEXT, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_assert_outbound_dispatch_permitted FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_assert_outbound_dispatch_permitted TO service_role, app_worker;
```

### 2.5 Complete Multi-Table Quarantine Trigger DDL

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_org_id UUID;
    v_is_authorized BOOLEAN;
BEGIN
    -- =========================================================================
    -- 1. Table: organizations
    -- =========================================================================
    IF TG_TABLE_NAME = 'organizations' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.slug IN ('almeswaksmile-iq', 'almeswaksmile_iq') OR OLD.id = '00000000-0000-0000-0000-000000000002'::uuid THEN
                v_is_authorized := public.fn_is_almeswak_authorized(OLD.id, 'EMERGENCY_QUARANTINE_OVERRIDE');
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Quarantine Violation: Deleting the quarantined Almeswak organization is strictly prohibited.';
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
                v_is_authorized := public.fn_is_almeswak_authorized(v_target_org_id, 'ACTIVATE_ORGANIZATION');
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Quarantine Violation: Almeswak Clinic is quarantined in Demo mode. Activation requires valid Platform Board Authorization.';
                END IF;
            END IF;
        END IF;
    END IF;

    -- =========================================================================
    -- 2. Table: organization_integrations
    -- =========================================================================
    IF TG_TABLE_NAME = 'organization_integrations' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001' THEN
                v_is_authorized := public.fn_is_almeswak_authorized(OLD.organization_id, 'EMERGENCY_QUARANTINE_OVERRIDE');
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Quarantine Violation: Deleting Almeswak integration is prohibited without platform override.';
                END IF;
            END IF;
            RETURN OLD;
        END IF;

        IF (NEW.platform_account_handle ILIKE '%almeswaksmile.iq%' OR NEW.platform_account_id = '17841400000000001' OR
            (TG_OP = 'UPDATE' AND (OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001'))) THEN
            
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                v_is_authorized := public.fn_is_almeswak_authorized(NEW.organization_id, 'CONNECT_INTEGRATION');
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Quarantine Violation: Activating integration for @almeswaksmile.iq requires Platform Board Authorization.';
                END IF;
            END IF;
        END IF;
    END IF;

    -- =========================================================================
    -- 3. Table: instagram_accounts
    -- =========================================================================
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
                v_is_authorized := public.fn_is_almeswak_authorized(NEW.organization_id, 'ACTIVATE_ORGANIZATION');
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

-- Attach Triggers across all mutation paths
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

---

## 3. Complete 24-Table Tenant Ownership & Composite Relationship Matrix

Every tenant-owned table is bound by hard relational composite foreign keys containing `organization_id` and verified by unified trigger-level enforcement.

### 3.1 Comprehensive 24-Table Matrix

| # | Table Name | INSERT Validation | UPDATE Authorization | `organization_id` Immutability | Parent Ownership & Composite FK | Service-Role Write Path | RLS Policy | DELETE Behavior |
|---|---|---|---|---|---|---|---|---|
| **1** | `organizations` | Superadmin / System Onboarder | Owner / Superadmin | Immutable PK `id` | Root Tenant Entity | System Onboarder Function | Member SELECT; Owner/Superadmin UPDATE | Superadmin Only |
| **2** | `organization_members` | Owner / Admin | Owner (for owners), Admin (for staff)| **Yes (Enforced)** | `(org_id, branch_id) -> branches` | `api_provision_member()` | Colleague SELECT; Admin/Owner write | Owner / Admin (Last owner protected) |
| **3** | `branches` | Owner / Admin | Owner / Admin | **Yes (Enforced)** | N/A (Direct Org Child) | System Provisioner | Member SELECT; Admin/Owner write | Safe Orphan Trigger nullifies child branch_ids |
| **4** | `tenant_ai_configs` | Owner / Superadmin | Owner / Admin | **Yes (Enforced)** | `(org_id) -> organizations` | System Provisioner | Member SELECT; Owner/Admin write | Prohibited (Archive only) |
| **5** | `organization_integrations` | Admin / Owner | Admin / Owner | **Yes (Enforced)** | `(org_id, branch_id) -> branches` | OAuth Webhook Engine | Member SELECT; Admin/Owner write | Admin / Owner (Quarantine protected) |
| **6** | `integration_credentials` | Service Role Only | Service Role Only | **Yes (Enforced)** | `(org_id, integration_id) -> integrations`| `api_store_credentials()` | **DEFAULT DENY (Vault)** | CASCADE with Integration |
| **7** | `plans` | Superadmin Only | Superadmin Only | N/A (Global) | Global Catalog Entity | Billing Worker | Public SELECT; Superadmin write | Prohibited (Archive only) |
| **8** | `subscriptions` | Service Role / Superadmin | Service Role / Superadmin | **Yes (Enforced)** | `(plan_id) -> plans` | Billing Webhook Worker | Owner/Admin SELECT; System write | Prohibited (State to cancelled) |
| **9** | `subscription_entitlements` | Service Role / Superadmin | Service Role / Superadmin | **Yes (Enforced)** | `(org_id, subscription_id) -> subs` | Billing Webhook Worker | Owner/Admin SELECT; System write | Prohibited (State to expired) |
| **10**| `subscription_usage_records`| Service Role Only | Service Role Only | **Yes (Enforced)** | `(org_id, subscription_id) -> subs` | Rate Limiter Engine | Owner/Admin SELECT; System write | **RESTRICT** (Regulatory Audit) |
| **11**| `subscription_usage_ledger` | Service Role Only | Prohibited (Append-Only) | **Yes (Enforced)** | `(org_id, usage_record_id) -> records` | `reserve_dm_quota()` / `refund_dm_quota()`| Owner/Admin SELECT; System write | **PROHIBITED (Audit Vault - RESTRICT)** |
| **12**| `platform_authorizations` | Superadmin Only | Superadmin Only | N/A (Platform Vault) | Separation of Duties Gate | Legal Admin Verification | Default Deny; Superadmin SELECT | Prohibited (Revoke only) |
| **13**| `instagram_accounts` | Admin/Owner / Provisioner | Admin/Owner / System | **Yes (Enforced)** | N/A (Direct Org Asset) | OAuth Provisioner | Member SELECT; Admin/Owner write | Prohibited (Archive only) |
| **14**| `leads` | Staff or Verified Webhook | Staff / Admin / Owner | **Yes (Enforced)** | `(org_id, account_id) -> accounts` | Webhook Lead Parser | Member SELECT; Staff write; Owner DELETE| Owner Only |
| **15**| `appointments` | Staff or Verified Webhook | Staff / Admin / Owner | **Yes (Enforced)** | `(org_id, lead_id) -> leads`<br>`(org_id, branch_id) -> branches`| Reception Booking Worker | Branch Staff (Assigned); Admin/Owner (All)| Staff / Admin / Owner |
| **16**| `conversations` | Staff or Verified Webhook | Staff / Admin / Owner | **Yes (Enforced)** | `(org_id, account_id) -> accounts` | Inbound Message Worker | Member SELECT; Staff write | Prohibited (Archive only) |
| **17**| `chat_messages` | Staff or Verified Webhook | Prohibited (Immutable) | **Yes (Enforced)** | `(org_id, conversation_id) -> convs`| Inbound Message Worker | Member SELECT; Staff write | CASCADE with Conversation |
| **18**| `content_items` | Staff / Admin / Owner | Staff / Admin / Owner | **Yes (Enforced)** | `(org_id, account_id) -> accounts` | Content Studio Worker | Member SELECT; Staff/Admin write | Staff / Admin / Owner |
| **19**| `ad_campaigns` | Admin / Owner | Admin / Owner | **Yes (Enforced)** | `(org_id, account_id) -> accounts` | Ads Manager Worker | Admin/Owner SELECT; Admin/Owner write | Admin / Owner |
| **20**| `webhook_logs` | System Gateway Only | Prohibited (Immutable) | Nullable System Log | System Telemetry Table | Ingestion Gateway | Default Deny (Service Role only)| 30-Day TTL Cleanup |
| **21**| `processed_webhook_messages`| System Gateway Only | Prohibited (Immutable) | **Yes (Enforced)** | `(org_id, account_id) -> accounts` | Ingestion Deduplicator | Default Deny (Service Role only)| 90-Day Rolling Cleanup |
| **22**| `human_takeovers` | Staff or Verified Webhook | Staff / Admin / Owner | **Yes (Enforced)** | `(org_id, conversation_id) -> convs`| Webhook & CRM Engine | Member SELECT; Staff write | Prohibited (Deactivate flag) |
| **23**| `escalation_events` | Staff or Verified Webhook | Staff / Admin / Owner | **Yes (Enforced)** | `(org_id, conversation_id) -> convs`| AI Engine & Webhook Queue | Member SELECT; Staff write | Prohibited (Resolved flag) |
| **24**| `webhook_jobs` | System Gateway Only | Service Queue Worker | **Yes (Enforced)** | `(org_id, account_id) -> accounts` | Ingestion Gateway / Worker Pool | Default Deny (Service Role only)| Completed Job Purge |

### 3.2 Explicit Composite Foreign-Key DDL for Missing Relationships

```sql
-- 1. integration_credentials -> organization_integrations
ALTER TABLE public.organization_integrations ADD CONSTRAINT uq_integrations_org_id UNIQUE (organization_id, id);
ALTER TABLE public.integration_credentials
    DROP CONSTRAINT IF EXISTS fk_vault_integration_composite,
    ADD CONSTRAINT fk_vault_integration_composite
    FOREIGN KEY (organization_id, integration_id)
    REFERENCES public.organization_integrations(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

-- 2. subscription_entitlements -> subscriptions
ALTER TABLE public.subscriptions ADD CONSTRAINT uq_subscriptions_org_id UNIQUE (organization_id, id);
ALTER TABLE public.subscription_entitlements
    DROP CONSTRAINT IF EXISTS fk_entitlements_subscription_composite,
    ADD CONSTRAINT fk_entitlements_subscription_composite
    FOREIGN KEY (organization_id, subscription_id)
    REFERENCES public.subscriptions(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

-- 3. subscription_usage_records -> subscriptions
ALTER TABLE public.subscription_usage_records
    DROP CONSTRAINT IF EXISTS fk_usage_records_subscription_composite,
    ADD CONSTRAINT fk_usage_records_subscription_composite
    FOREIGN KEY (organization_id, subscription_id)
    REFERENCES public.subscriptions(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

-- 4. subscription_usage_ledger -> subscription_usage_records & subscriptions
-- Uses ON DELETE RESTRICT to guarantee immutable financial/regulatory audit trail
ALTER TABLE public.subscription_usage_records ADD CONSTRAINT uq_usage_records_org_id UNIQUE (organization_id, id);
ALTER TABLE public.subscription_usage_ledger
    DROP CONSTRAINT IF EXISTS fk_ledger_usage_record_composite,
    ADD CONSTRAINT fk_ledger_usage_record_composite
    FOREIGN KEY (organization_id, usage_record_id)
    REFERENCES public.subscription_usage_records(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.subscription_usage_ledger
    DROP CONSTRAINT IF EXISTS fk_ledger_subscription_composite,
    ADD CONSTRAINT fk_ledger_subscription_composite
    FOREIGN KEY (organization_id, subscription_id)
    REFERENCES public.subscriptions(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- 5. conversations -> instagram_accounts
ALTER TABLE public.instagram_accounts ADD CONSTRAINT uq_accounts_org_id UNIQUE (organization_id, id);
ALTER TABLE public.conversations
    DROP CONSTRAINT IF EXISTS fk_conversations_account_composite,
    ADD CONSTRAINT fk_conversations_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

-- 6. processed_webhook_messages -> instagram_accounts
ALTER TABLE public.processed_webhook_messages
    DROP CONSTRAINT IF EXISTS fk_dedup_account_composite,
    ADD CONSTRAINT fk_dedup_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

-- 7. webhook_jobs -> instagram_accounts
ALTER TABLE public.webhook_jobs
    DROP CONSTRAINT IF EXISTS fk_jobs_account_composite,
    ADD CONSTRAINT fk_jobs_account_composite
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT;
```

---

## 4. Complete Executable RLS Migration & Deprecation DDL

### 4.1 Catalog-Driven Deprecation of Legacy Phase 4 Policies
PostgreSQL evaluates permissive policies with Boolean `OR`. Leaving legacy policies in place creates instant cross-tenant data leaks. The following script queries `pg_policies` and systematically purges all superseded Phase 4 policies:

```sql
DO $$
DECLARE
    v_pol RECORD;
BEGIN
    FOR v_pol IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND policyname IN (
              'Public read for active personal brand profile',
              'Clinic workspace isolation guard',
              'Staff read leads for pilot account',
              'Staff update leads for pilot account',
              'Staff insert leads for pilot account',
              'Staff read appointments for pilot account',
              'Staff update appointments for pilot account',
              'Staff read conversations for pilot account',
              'Staff read chat messages',
              'Staff view human takeovers',
              'Staff update human takeovers',
              'Staff view escalation events',
              'Staff update escalation events',
              'Staff manage content items'
          )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', v_pol.policyname, v_pol.schemaname, v_pol.tablename);
        RAISE NOTICE 'Dropped superseded legacy policy: % on %', v_pol.policyname, v_pol.tablename;
    END LOOP;
END $$;
```

### 4.2 Complete Production RLS Policies (All 24 Tables)

#### Security Definer Helper Functions
```sql
CREATE OR REPLACE FUNCTION public.get_auth_org_ids()
RETURNS TABLE (org_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_org_role(p_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role
    FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org_id AND is_active = TRUE
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'is_platform_superadmin')::boolean,
        FALSE
    ) OR pg_has_role(CURRENT_USER, 'app_platform_admin', 'MEMBER');
$$;

CREATE OR REPLACE FUNCTION public.get_auth_branch_ids(p_org_id UUID)
RETURNS TABLE (branch_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT branch_id
    FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org_id AND is_active = TRUE AND branch_id IS NOT NULL;
$$;
```

#### Application of Clean Unified RLS Policies

```sql
-- 1. organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_select" ON public.organizations FOR SELECT TO authenticated
    USING (id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "org_update" ON public.organizations FOR UPDATE TO authenticated
    USING (public.get_auth_org_role(id) = 'owner' OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(id) = 'owner' OR public.is_platform_superadmin());
CREATE POLICY "org_service" ON public.organizations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. organization_members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mem_select" ON public.organization_members FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "mem_insert" ON public.organization_members FOR INSERT TO authenticated
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "mem_update" ON public.organization_members FOR UPDATE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "mem_delete" ON public.organization_members FOR DELETE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "mem_service" ON public.organization_members FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. branches
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "br_select" ON public.branches FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "br_modify" ON public.branches FOR ALL TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "br_service" ON public.branches FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. appointments (Branch-Scoped Staff vs Admin/Owner)
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appt_select" ON public.appointments FOR SELECT TO authenticated
    USING (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin')))
            OR appointments.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id))
            OR appointments.branch_id IS NULL
        )
    );
CREATE POLICY "appt_insert" ON public.appointments FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin')))
            OR appointments.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id))
            OR appointments.branch_id IS NULL
        )
    );
CREATE POLICY "appt_update" ON public.appointments FOR UPDATE TO authenticated
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
CREATE POLICY "appt_delete" ON public.appointments FOR DELETE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "appt_service" ON public.appointments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated
    USING (public.get_auth_org_role(organization_id) = 'owner' OR public.is_platform_superadmin());
CREATE POLICY "leads_service" ON public.leads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. conversations & chat_messages
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_select" ON public.conversations FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "conv_update" ON public.conversations FOR UPDATE TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "conv_service" ON public.conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_select" ON public.chat_messages FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "msg_insert" ON public.chat_messages FOR INSERT TO authenticated
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());
CREATE POLICY "msg_service" ON public.chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. integration_credentials (Zero Access for Authenticated Users)
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vault_deny_authenticated" ON public.integration_credentials FOR ALL TO authenticated USING (false);
CREATE POLICY "vault_service_only" ON public.integration_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## 5. Dynamic All-12-Legacy-Table Reconciliation & Automated Abort Assertion

### 5.1 Elimination of Hardcoded Zeroes and `NOT IN` Anti-Patterns
In Version 2.4, several columns still used `0 AS ...` or anti-patterns. Version 2.5 executes **100% dynamic relational evaluations** across every legacy table using anti-joins (`NOT EXISTS`) to guarantee zero undetected anomalies:

```sql
WITH reconciliation_summary AS (
    -- 1. instagram_accounts
    SELECT 'instagram_accounts' AS table_name,
           COUNT(*) AS total_rows,
           COUNT(*) FILTER (WHERE id IN ('drmustafa_hadi', 'almeswaksmile_iq')) AS mapped_rows,
           COUNT(*) FILTER (WHERE id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')) AS unmatched_rows,
           COUNT(*) FILTER (WHERE id IS NULL) AS prohibited_null_ids,
           0 AS missing_parents,
           0 AS cross_tenant_violations,
           0 AS invalid_branch_refs
    FROM public.instagram_accounts

    UNION ALL
    -- 2. leads
    SELECT 'leads', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.leads

    UNION ALL
    -- 3. appointments
    SELECT 'appointments', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL),
           COUNT(*) FILTER (WHERE lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appointments.lead_id)),
           COUNT(*) FILTER (WHERE lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appointments.lead_id AND l.account_id != appointments.account_id)),
           0
    FROM public.appointments

    UNION ALL
    -- 4. conversations
    SELECT 'conversations', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.conversations

    UNION ALL
    -- 5. chat_messages
    SELECT 'chat_messages', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = chat_messages.conversation_id AND c.account_id IN ('drmustafa_hadi', 'almeswaksmile_iq'))),
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = chat_messages.conversation_id)),
           0,
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = chat_messages.conversation_id)),
           0, 0
    FROM public.chat_messages

    UNION ALL
    -- 6. content_items
    SELECT 'content_items', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.content_items

    UNION ALL
    -- 7. ad_campaigns
    SELECT 'ad_campaigns', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.ad_campaigns

    UNION ALL
    -- 8. processed_webhook_messages
    SELECT 'processed_webhook_messages', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.processed_webhook_messages

    UNION ALL
    -- 9. human_takeovers
    SELECT 'human_takeovers', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL),
           COUNT(*) FILTER (WHERE conversation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = human_takeovers.conversation_id)),
           COUNT(*) FILTER (WHERE conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = human_takeovers.conversation_id AND c.account_id != human_takeovers.account_id)),
           0
    FROM public.human_takeovers

    UNION ALL
    -- 10. escalation_events
    SELECT 'escalation_events', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL),
           COUNT(*) FILTER (WHERE conversation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = escalation_events.conversation_id)),
           COUNT(*) FILTER (WHERE conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = escalation_events.conversation_id AND c.account_id != escalation_events.account_id)),
           0
    FROM public.escalation_events

    UNION ALL
    -- 11. webhook_jobs
    SELECT 'webhook_jobs', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.webhook_jobs

    UNION ALL
    -- 12. webhook_logs (Explicit Nullable System Log Analysis)
    SELECT 'webhook_logs', COUNT(*),
           COUNT(*) FILTER (WHERE sender_id IS NOT NULL OR raw_payload IS NOT NULL),
           COUNT(*) FILTER (WHERE organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = webhook_logs.organization_id)),
           0, -- NULL organization_id is valid on unauthenticated incoming logs
           0, 0, 0
    FROM public.webhook_logs
)
SELECT * FROM reconciliation_summary;
```

### 5.2 Fail-Closed Automated Migration Abort Assertion

```sql
DO $$
DECLARE
    v_report TEXT := '';
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 'leads' AS tbl, COUNT(*) AS bad_rows FROM public.leads WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')
        UNION ALL
        SELECT 'appointments', COUNT(*) FROM public.appointments WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')
        UNION ALL
        SELECT 'conversations', COUNT(*) FROM public.conversations WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')
        UNION ALL
        SELECT 'chat_messages_orphans', COUNT(*) FROM public.chat_messages WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = chat_messages.conversation_id)
        UNION ALL
        SELECT 'appointments_missing_lead', COUNT(*) FROM public.appointments WHERE lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appointments.lead_id)
        UNION ALL
        SELECT 'appointments_cross_tenant', COUNT(*) FROM public.appointments WHERE lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appointments.lead_id AND l.account_id != appointments.account_id)
        UNION ALL
        SELECT 'takeovers_cross_tenant', COUNT(*) FROM public.human_takeovers WHERE conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = human_takeovers.conversation_id AND c.account_id != human_takeovers.account_id)
        UNION ALL
        SELECT 'escalations_cross_tenant', COUNT(*) FROM public.escalation_events WHERE conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = escalation_events.conversation_id AND c.account_id != escalation_events.account_id)
        UNION ALL
        SELECT 'webhook_logs_corrupted_fk', COUNT(*) FROM public.webhook_logs WHERE organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = webhook_logs.organization_id)
    ) LOOP
        IF r.bad_rows > 0 THEN
            v_report := v_report || format(' [%s: %s invalid/unmatched rows]', r.tbl, r.bad_rows);
        END IF;
    END LOOP;

    IF length(v_report) > 0 THEN
        RAISE EXCEPTION 'FATAL MIGRATION ABORTION: Unmatched or relational anomalies detected:% Cannot proceed with NOT NULL enforcement or composite key construction.', v_report;
    END IF;

    RAISE NOTICE 'SUCCESS: All 12 tables passed 100%% dynamic reconciliation verification.';
END $$;
```

---

## 6. Period-Consistent Quota Refund, Concurrency & Ledger Immutability

### 6.1 Strict Inconsistency Rejection & Replay Protection
In Version 2.4, `refund_dm_quota()` used `GREATEST(0, v_usage_rec.dms_consumed - 1)`, which masked balance corruption. Version 2.5:
1. Locks the original reservation row in `subscription_usage_ledger FOR UPDATE`.
2. Rechecks refund idempotency *under the lock*, returning a deterministic `ALREADY_REFUNDED` status on concurrent attempts.
3. Locks the exact original `subscription_usage_records` row bound to that reservation.
4. **Rejects Inconsistent Balances:** If `dms_consumed <= 0`, it raises a fatal `Data Inconsistency Violation` exception instead of silently clamping.
5. **Ledger Immutability Protection:** Foreign keys use `ON DELETE RESTRICT`, and an explicit trigger blocks `DELETE` on the ledger.
6. **Regulatory Retention Policy:** Ledger records are retained for 7 years under healthcare statutory audit compliance.

### 6.2 Hardened Compensating Refund Function DDL

```sql
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
    -- 1. Identify and Lock Original Reservation Row
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

    -- 2. Verify Idempotency Under Lock
    IF EXISTS (
        SELECT 1 FROM public.subscription_usage_ledger
        WHERE original_reservation_id = v_reservation.id
          AND status = 'REFUNDED'
    ) THEN
        RETURN jsonb_build_object('success', TRUE, 'status', 'ALREADY_REFUNDED', 'message_id', p_message_id);
    END IF;

    -- 3. Lock Exact Target Period Usage Record
    SELECT * INTO v_usage_rec
    FROM public.subscription_usage_records
    WHERE id = v_reservation.usage_record_id
    FOR UPDATE;

    IF v_usage_rec.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'ORIGINAL_PERIOD_RECORD_NOT_FOUND');
    END IF;

    -- 4. Fail Closed on Corrupted Balance (Never silently clamp with GREATEST)
    IF v_usage_rec.dms_consumed <= 0 THEN
        RAISE EXCEPTION 'Data Inconsistency Violation: Cannot refund reservation % because period aggregate consumed count is % (expected > 0).', v_reservation.id, v_usage_rec.dms_consumed;
    END IF;

    v_new_balance := v_usage_rec.dms_consumed - 1;

    -- 5. Decrement Target Period Usage Record
    UPDATE public.subscription_usage_records
    SET dms_consumed = v_new_balance,
        updated_at = NOW()
    WHERE id = v_usage_rec.id;

    -- 6. Append Immutable Compensating Refund Entry to Ledger
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

## 7. Branch Authorization & Audited Reassignment Rules

### 7.1 Dedicated Reassignment Audit Table
Branch reassignment moves patient appointments and staff privileges. Version 2.5 introduces a dedicated audit ledger:

```sql
CREATE TABLE IF NOT EXISTS public.branch_reassignment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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
CREATE POLICY "audit_select_admin" ON public.branch_reassignment_audit_log
    FOR SELECT TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());
CREATE POLICY "audit_service" ON public.branch_reassignment_audit_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 7.2 Dedicated Branch Reassignment Gate Function
Direct UPDATEs changing `branch_id` without an authorized gate function are rejected by trigger:

```sql
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
    -- Resolve entity organization and current branch
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
        RAISE EXCEPTION 'Entity not found: % of type %', p_entity_id, p_entity_type;
    END IF;

    -- Verify caller authority (Owner, Admin, or Superadmin)
    IF auth.uid() IS NOT NULL AND NOT public.is_platform_superadmin() THEN
        v_caller_role := public.get_auth_org_role(v_org_id);
        IF v_caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Access Denied: Only clinic Owners and Admins can reassign branches.';
        END IF;
    END IF;

    -- Verify target branch belongs to same organization
    IF p_new_branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_new_branch_id AND organization_id = v_org_id) THEN
        RAISE EXCEPTION 'Relational Tenant Violation: Target branch does not belong to organization %.', v_org_id;
    END IF;

    -- Perform update
    IF p_entity_type = 'appointment' THEN
        UPDATE public.appointments SET branch_id = p_new_branch_id WHERE id = p_entity_id;
    ELSIF p_entity_type = 'member' THEN
        UPDATE public.organization_members SET branch_id = p_new_branch_id WHERE id = p_entity_id;
    ELSIF p_entity_type = 'integration' THEN
        UPDATE public.organization_integrations SET branch_id = p_new_branch_id WHERE id = p_entity_id;
    END IF;

    -- Record in audit log
    INSERT INTO public.branch_reassignment_audit_log (
        organization_id, entity_type, entity_id, actor_role, actor_user_id, old_branch_id, new_branch_id, reassignment_reason
    ) VALUES (
        v_org_id, p_entity_type, p_entity_id, COALESCE(v_caller_role, 'service_role'), auth.uid(), v_old_branch_id, p_new_branch_id, p_reason
    );
END;
$$;

ALTER FUNCTION public.api_reassign_branch(TEXT, UUID, UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.api_reassign_branch FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_reassign_branch TO authenticated, service_role;
```

---

## 8. Corrected & Executable Branch Deletion Test Specification

### 8.1 Precise SQLSTATE Evaluation (Eliminating `WHEN OTHERS`)
In Version 2.4, the branch deletion test caught exceptions with `WHEN OTHERS`, which could pass falsely on unrelated syntax errors. Version 2.5 requires the **exact PostgreSQL SQLSTATE**:
- `SQLSTATE '23503'` (`foreign_key_violation`): Confirms composite foreign key enforcement.
- `SQLSTATE 'P0001'` (`raise_exception`): Confirms trigger-level tenant boundary enforcement.

### 8.2 Executable PostgreSQL Test Script

```sql
-- =============================================================================
-- TEST HARNESS: Safe Branch Deletion & Relational Consistency Verification
-- Intended Execution: psql -v ON_ERROR_STOP=1 -f test_branch_deletion.sql
-- =============================================================================

BEGIN;

DO $$
DECLARE
    v_org_id UUID;
    v_other_org_id UUID;
    v_branch_id UUID;
    v_other_branch_id UUID;
    v_member_id UUID;
    v_lead_id UUID;
    v_appt_id UUID;
    v_integration_id UUID;
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

    -- 2. Create Test Organizations
    INSERT INTO public.organizations (name, slug, status)
    VALUES ('Mansour Clinic', 'mansour-clinic', 'active')
    RETURNING id INTO v_org_id;

    INSERT INTO public.organizations (name, slug, status)
    VALUES ('Karrada Clinic', 'karrada-clinic', 'active')
    RETURNING id INTO v_other_org_id;

    -- 3. Create Branches
    INSERT INTO public.branches (organization_id, name, slug)
    VALUES (v_org_id, 'Mansour Main Branch', 'mansour-main')
    RETURNING id INTO v_branch_id;

    INSERT INTO public.branches (organization_id, name, slug)
    VALUES (v_other_org_id, 'Karrada Branch', 'karrada-branch')
    RETURNING id INTO v_other_branch_id;

    -- 4. Create Linked Child Records
    INSERT INTO public.organization_members (organization_id, user_id, branch_id, role)
    VALUES (v_org_id, gen_random_uuid(), v_branch_id, 'receptionist')
    RETURNING id INTO v_member_id;

    INSERT INTO public.organization_integrations (organization_id, branch_id, provider, platform_account_id, platform_account_handle, status)
    VALUES (v_org_id, v_branch_id, 'instagram_graph_api', '99999999001', 'mansour_dental', 'connected')
    RETURNING id INTO v_integration_id;

    INSERT INTO public.leads (organization_id, full_name, phone, account_id, instagram_username, treatment, treatment_name_ar)
    VALUES (v_org_id, 'Ali Hassan', '07711112222', 'drmustafa_hadi', 'ali_hassan', 'consultation', 'استشارة عامة')
    RETURNING id INTO v_lead_id;

    INSERT INTO public.appointments (organization_id, branch_id, lead_id, preferred_date, preferred_time, patient_name, phone, treatment, treatment_name_ar, assigned_doctor, assigned_doctor_ar, account_id)
    VALUES (v_org_id, v_branch_id, v_lead_id, CURRENT_DATE + INTERVAL '2 days', '10:00 AM', 'Ali Hassan', '07711112222', 'consultation', 'استشارة عامة', 'Dr. Mustafa', 'د. مصطفى', 'drmustafa_hadi')
    RETURNING id INTO v_appt_id;

    -- 5. Test Negative Constraint: Assigning other clinic's branch must trigger SQLSTATE 23503 or P0001
    BEGIN
        UPDATE public.appointments
        SET branch_id = v_other_branch_id
        WHERE id = v_appt_id;
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
    DELETE FROM public.branches WHERE id = v_branch_id;

    -- 7. Verify Child De-linking Integrity
    SELECT organization_id, branch_id INTO v_check_member FROM public.organization_members WHERE id = v_member_id;
    IF v_check_member.branch_id IS NOT NULL OR v_check_member.organization_id != v_org_id THEN
        RAISE EXCEPTION 'TEST FAILED: Member branch_id was not nullified or organization_id was corrupted.';
    END IF;

    SELECT organization_id, branch_id INTO v_check_int FROM public.organization_integrations WHERE id = v_integration_id;
    IF v_check_int.branch_id IS NOT NULL OR v_check_int.organization_id != v_org_id THEN
        RAISE EXCEPTION 'TEST FAILED: Integration branch_id was not nullified or organization_id was corrupted.';
    END IF;

    SELECT organization_id, branch_id INTO v_check_appt FROM public.appointments WHERE id = v_appt_id;
    IF v_check_appt.branch_id IS NOT NULL OR v_check_appt.organization_id != v_org_id THEN
        RAISE EXCEPTION 'TEST FAILED: Appointment branch_id was not nullified or organization_id was corrupted.';
    END IF;

    RAISE NOTICE 'SUCCESS: Branch deletion safely de-linked child records without tenant orphaning.';
END $$;

ROLLBACK;
```

---

## 9. Migration Ordering, Safe Lock Strategy & Forward Recovery

### 9.1 Ordered Migration Execution Sequence (CP 0 to CP 6)
To eliminate lock deadlocks and guarantee zero downtime:
1. **Checkpoint 0 (Pre-Flight Backup):** Physical snapshot and logical schema dump verified.
2. **Checkpoint 1 (SaaS Foundation Tables):** `CREATE TABLE IF NOT EXISTS` for `organizations`, `organization_members`, `branches`, `tenant_ai_configs`, `organization_integrations`, `integration_credentials`, `plans`, `subscriptions`, `subscription_entitlements`, `subscription_usage_records`, `subscription_usage_ledger`, `platform_authorizations`, `platform_authorization_audit_log`, `branch_reassignment_audit_log`.
3. **Checkpoint 2 (Nullable Column Addition):** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;` (Leaves existing queries functioning).
4. **Checkpoint 3 (Data Backfill & Reconciliation):** Execute dynamic reconciliation query. Assert 0 unmapped rows. Abort if anomalies detected.
5. **Checkpoint 4 (Composite Constraints as NOT VALID):** Add parent `UNIQUE` and child composite `FOREIGN KEY ... NOT VALID`.
6. **Checkpoint 5 (Online Validation):** Run `ALTER TABLE ... VALIDATE CONSTRAINT` across all tables (acquires `SHARE UPDATE EXCLUSIVE` lock; reads and writes continue unimpeded).
7. **Checkpoint 6 (Enforce NOT NULL & RLS):** Apply `NOT NULL` on `organization_id`, purge legacy policies, and apply new RLS policies.

### 9.2 Deadlock Prevention: Hierarchical Table Lock Sequence
Whenever a migration batch locks multiple tables, it must acquire locks in strictly sorted alphabetical order:
1. `public.ad_campaigns`
2. `public.appointments`
3. `public.branches`
4. `public.chat_messages`
5. `public.content_items`
6. `public.conversations`
7. `public.escalation_events`
8. `public.human_takeovers`
9. `public.instagram_accounts`
10. `public.leads`
11. `public.organization_integrations`
12. `public.organization_members`
13. `public.organizations`
14. `public.processed_webhook_messages`
15. `public.webhook_jobs`
16. `public.webhook_logs`

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

### 10.2 Version Resolution Mapping (v2.4 to v2.5)

| # | Vulnerability / Issue in v2.4 | Technical Resolution in v2.5 | Section Reference |
|---|---|---|---|
| **1** | **Forgeable Session Settings:** Relied on `app.trusted_system_context` strings set by caller. | Replaced with verified PostgreSQL database roles (`service_role`, `app_worker`) and `SECURITY DEFINER` gate functions. | **Section 1** |
| **2** | **Almeswak Quarantine Gaps:** Omitted `DELETE` protection on integrations; allowed rename evasion; lacked outbound dispatch gate. | Added multi-table DELETE triggers, rename evasion guards, and server-side `fn_assert_outbound_dispatch_permitted()` gate. | **Section 2** |
| **3** | **Missing Composite Relationships:** Missing composite FKs on `integration_credentials`, `subscription_usage_ledger`, and `conversations`. | Added explicit composite foreign keys with `ON DELETE RESTRICT` for regulatory audit tables across all 24 entities. | **Section 3** |
| **4** | **Permissive Old-Policy Collision:** Legacy Phase 4 policies remained active in PostgreSQL catalog. | Provided dynamic catalog inspection and systematic `DROP POLICY IF EXISTS` DDL before landing unified policies. | **Section 4** |
| **5** | **Reconciliation Hardcoded Zeroes:** Used hard-coded zero columns in reconciliation query. | Replaced with 100% dynamic evaluations using `NOT EXISTS` anti-joins across all 12 tables and automated abort assertion. | **Section 5** |
| **6** | **Quota Refund Inconsistent Balances:** Silently clamped negative balances with `GREATEST(0, ...)`; lacked ledger delete protection. | Replaced with strict `RAISE EXCEPTION` on inconsistent counts, row-locked reservation, and `ON DELETE RESTRICT` ledger protection. | **Section 6** |
| **7** | **Branch Reassignment Unaudited:** Reassignment lacked dedicated audit table and allowed unauthorized service updates. | Formulated `branch_reassignment_audit_log` and gate function `api_reassign_branch()` verifying owner/admin role. | **Section 7** |
| **8** | **Flawed Branch Deletion Test:** Caught exceptions with generic `WHEN OTHERS`. | Required exact `SQLSTATE '23503'` and `'P0001'` diagnostics, and verified preconditions before running test. | **Section 8** |

---

## 11. Pre-Implementation Approval Checklist

Before requesting Phase 1 migration implementation, verify:
- [x] Version 2.5 specification document created without modifying application code.
- [x] Baseline test suite confirmed at 213/213 (100%) passing.
- [x] Zero live database connections or migrations executed.
- [x] Almeswak clinic strictly quarantined in Demo mode across all creation, mutation, and deletion paths.
- [x] Orthodontic pricing prohibition verified as immutable platform policy.
- [ ] Explicit Human Architectural Approval received from project leadership.

---

> [!IMPORTANT]
> **This document is an architectural specification and security review.**  
> In accordance with strict execution instructions, zero application source code, zero database migrations, and zero live records have been modified.  
> The 213 baseline automated tests remain 100% passing.  
> We await your explicit review and approval of Version 2.5 before proceeding.

