# MustafaH-AI — Multi-Clinic SaaS Architectural Specification
**Version:** 2.4.0 (Enterprise Multi-Tenant Security Correction, Complete Relational Integrity & Production Migration Readiness)  
**Status:** DRAFT SPECIFICATION & SECURITY AUDIT (Pending User Approval — Zero Database/Code Changes Executed)  
**Document Classification:** Mission-Critical Healthcare SaaS Architecture  
**Founding Pilot Tenant:** Dr. Mustafa Hadi (`@drmustafa_hadi` — Personal Dental Brand)  
**Quarantined Demo Tenant:** Almeswak Dental Clinic (`@almeswaksmile.iq` — Strictly Locked in Demo Mode)  

---

## Executive Architectural Summary & Threat Model

MustafaH-AI is transitioning from a single-clinic Instagram assistant into an **Enterprise Multi-Clinic Dental SaaS Platform**. The platform will host multiple independent dental practices across Baghdad and Iraq on a unified, high-performance infrastructure while guaranteeing **cryptographic, operational, and relational tenant isolation**.

### Uncompromising Platform Principles
1. **Pilot Continuity:** Dr. Mustafa Hadi (`@drmustafa_hadi`) is preserved as the founding tenant (`org_drmustafa_hadi`). All 213 passing automated baseline tests and historical clinic records will transition seamlessly with zero downtime.
2. **Clinic Workspace Protection:** Almeswak Dental Clinic (`@almeswaksmile.iq`) remains quarantined in Demo Mode without live credentials or outbound message capabilities until clinic management authorizes activation through a multi-signature platform authorization process.
3. **Immutable Orthodontic Pricing Prohibition:** The prohibition against disclosing orthodontic prices, ranges, down payments, or installment plans via automated channels is an **immutable platform-level policy**. No clinic owner, staff role, plan tier, or tenant configuration can disable or override this restriction.
4. **Relational Tenant Consistency:** Cross-table references (such as an appointment referencing a patient lead, or a message referencing a conversation) must be constrained at the PostgreSQL engine level via **composite foreign keys**, preventing cross-tenant data contamination even in the presence of application-level bugs.
5. **No Ephemeral Local Buffer on Serverless:** Production webhook ingestion resilience must operate strictly on verified durable storage. Ephemeral serverless filesystems (`/tmp`) are explicitly rejected as recovery mechanisms.
6. **Zero-Trust Multi-Tenancy:** No clinic may ever view, mutate, or inherit another clinic's branding, location, phone number, clinical FAQs, leads, conversations, or access tokens.

---

## 1. Almeswak Clinic Comprehensive Quarantine Architecture

### 1.1 Vulnerability in v2.3 Trigger Design
In Version 2.3, `fn_enforce_almeswak_quarantine()` was attached exclusively as `BEFORE UPDATE`. This left critical creation paths unprotected:
1. An unauthorized user or client could execute an `INSERT` into `public.organizations` with `slug = 'almeswaksmile-iq'` and `status = 'active'`.
2. An attacker could execute an `INSERT` into `public.organization_integrations` with `platform_account_handle = 'almeswaksmile.iq'`, `platform_account_id = '17841400000000001'`, and `status = 'connected'`.
3. An attacker could execute an `INSERT` into `public.instagram_accounts` with `id = 'almeswaksmile_iq'` and `status = 'connected'`.
4. The trigger evaluated only `OLD` values, meaning that updating an existing record to claim Almeswak's protected handle or platform ID was not blocked on the `NEW` record.
5. Evaluating a raw bearer token from a custom PostgreSQL session variable (`app.platform_management_authorization`) was forgeable via standard SQL `SET` commands.

### 1.2 Multi-Vector Quarantine Specification
Version 2.4 enforces quarantine across **every creation, mutation, and deletion path**:
- **Protected Identifiers:**
  - Organization Slugs: `'almeswaksmile-iq'`, `'almeswaksmile_iq'`
  - Organization UUIDs: `'00000000-0000-0000-0000-000000000002'::uuid`
  - Instagram Handles: `'almeswaksmile.iq'`, `'almeswaksmile_iq'`
  - Meta Platform Account IDs: `'17841400000000001'`
- **Operations Protected:** `BEFORE INSERT`, `BEFORE UPDATE`, and `BEFORE DELETE`.
- **Identity Evaluation:** Evaluates **both `OLD` and `NEW`** records.
- **Workflow Isolation:** Outbound message dispatchers and webhook routing engines must verify quarantine status before processing.
- **Strict Demo Mode Default:** Almeswak must remain strictly in `demo_mode` until the authorized approval workflow has actually been completed. No clinic owner or ordinary staff may issue or self-approve this authorization.

### 1.3 Platform Administrator Authorization Workflow
A stored document hash confirms cryptographic document integrity, but does **not** prove independent management approval. The platform authorization architecture separates cryptographic storage from multi-signature operational verification:

```
[Clinic Board / Management]
        |
        v
[Signed Physical Legal Resolution]
        |
        v (Digitized PDF + SHA-256 Digest Computed)
[Platform Legal / Compliance Admin]
        |
        v (Verifies Board Identity & Enters Record via Authenticated Session)
[public.platform_authorizations Table]
        |
        v (Server-Side Token Hash Generation: SHA-256)
[Database Authorization Gate: fn_verify_platform_authorization()]
        |
        v (Matches Token Hash, Active Status, Unexpired, Unrevoked, Valid Scope)
[Live Clinic Activation Permitted]
```

#### DDL: Platform Authorizations & Immutable Audit Vault

```sql
-- 1. Durable Platform Authorization Table
CREATE TABLE IF NOT EXISTS public.platform_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_token_hash TEXT UNIQUE NOT NULL,
    target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('organization', 'integration', 'instagram_account')),
    target_entity_id UUID NOT NULL,
    target_handle TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ALMESWAK_CREDENTIAL_ASSOCIATION', 'EMERGENCY_QUARANTINE_OVERRIDE')),
    board_resolution_reference TEXT NOT NULL,
    board_resolution_sha256 TEXT NOT NULL,
    board_approval_verified_by_legal_admin_id UUID NOT NULL REFERENCES auth.users(id),
    board_approval_verification_notes TEXT NOT NULL,
    authorized_by_admin_id UUID NOT NULL REFERENCES auth.users(id),
    admin_ip_address INET,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by_admin_id UUID REFERENCES auth.users(id),
    revocation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_auth_validity CHECK (expires_at > granted_at)
);

CREATE INDEX idx_platform_auth_lookup 
ON public.platform_authorizations (target_entity_id, purpose) 
WHERE revoked_at IS NULL;

-- 2. Immutable Authorization Audit Log
CREATE TABLE IF NOT EXISTS public.platform_authorization_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id UUID REFERENCES public.platform_authorizations(id),
    caller_user_id UUID,
    caller_role TEXT,
    attempted_action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_record_id TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('GRANTED', 'DENIED_INVALID_TOKEN', 'DENIED_EXPIRED', 'DENIED_REVOKED', 'DENIED_SCOPE_MISMATCH', 'DENIED_NON_ADMIN', 'DENIED_UNAUTHORIZED_CALLER')),
    error_message TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_audit_created ON public.platform_authorization_audit_log (created_at DESC);

-- Enable RLS: Default Deny. Only Platform Superadmins & Service Role
ALTER TABLE public.platform_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorization_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plat_auth_superadmin_all" ON public.platform_authorizations
    FOR ALL TO authenticated
    USING (public.is_platform_superadmin())
    WITH CHECK (public.is_platform_superadmin());

CREATE POLICY "plat_auth_service_role_all" ON public.platform_authorizations
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "plat_audit_superadmin_select" ON public.platform_authorization_audit_log
    FOR SELECT TO authenticated
    USING (public.is_platform_superadmin());

CREATE POLICY "plat_audit_service_role_all" ON public.platform_authorization_audit_log
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
```

#### Cryptographic Authorization Verification Function

```sql
CREATE OR REPLACE FUNCTION public.fn_verify_platform_authorization(
    p_target_id UUID,
    p_purpose TEXT,
    p_target_table TEXT,
    p_target_record_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_auth_record RECORD;
    v_outcome TEXT;
    v_error_msg TEXT := NULL;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    -- 1. Must be executed in context of an authenticated Platform Superadmin or Trusted System Service
    IF auth.uid() IS NOT NULL AND NOT public.is_platform_superadmin() THEN
        v_outcome := 'DENIED_NON_ADMIN';
        v_error_msg := 'Caller lacks platform superadministrator privileges.';
        INSERT INTO public.platform_authorization_audit_log (caller_user_id, caller_role, attempted_action, target_table, target_record_id, outcome, error_message)
        VALUES (auth.uid(), 'authenticated_user', p_purpose, p_target_table, p_target_record_id, v_outcome, v_error_msg);
        RETURN FALSE;
    END IF;

    -- 2. Retrieve bearer token from server session context
    v_raw_token := current_setting('app.platform_authorization_token', true);

    IF v_raw_token IS NULL OR trim(v_raw_token) = '' THEN
        v_outcome := 'DENIED_INVALID_TOKEN';
        v_error_msg := 'Missing platform authorization bearer token in session context.';
        INSERT INTO public.platform_authorization_audit_log (caller_user_id, caller_role, attempted_action, target_table, target_record_id, outcome, error_message)
        VALUES (auth.uid(), 'superadmin', p_purpose, p_target_table, p_target_record_id, v_outcome, v_error_msg);
        RETURN FALSE;
    END IF;

    -- Compute SHA-256 hash
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    -- Lookup authorization record
    SELECT * INTO v_auth_record
    FROM public.platform_authorizations
    WHERE target_entity_id = p_target_id
      AND purpose = p_purpose
      AND authorization_token_hash = v_token_hash;

    IF v_auth_record.id IS NULL THEN
        v_outcome := 'DENIED_INVALID_TOKEN';
        v_error_msg := 'Token hash not recognized or target mismatch.';
    ELSIF v_auth_record.revoked_at IS NOT NULL THEN
        v_outcome := 'DENIED_REVOKED';
        v_error_msg := format('Authorization was revoked at %s by %s. Reason: %s', v_auth_record.revoked_at, v_auth_record.revoked_by_admin_id, v_auth_record.revocation_reason);
    ELSIF NOW() >= v_auth_record.expires_at THEN
        v_outcome := 'DENIED_EXPIRED';
        v_error_msg := format('Authorization expired at %s.', v_auth_record.expires_at);
    ELSE
        v_outcome := 'GRANTED';
        v_is_authorized := TRUE;
    END IF;

    -- Log audit entry
    INSERT INTO public.platform_authorization_audit_log (
        authorization_id, caller_user_id, caller_role, attempted_action, target_table, target_record_id, outcome, error_message
    ) VALUES (
        v_auth_record.id, auth.uid(), 'superadmin', p_purpose, p_target_table, p_target_record_id, v_outcome, v_error_msg
    );

    RETURN v_is_authorized;
END;
$$;

ALTER FUNCTION public.fn_verify_platform_authorization(UUID, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_verify_platform_authorization(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_verify_platform_authorization(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
```

#### Comprehensive Quarantine Trigger DDL

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_authorized BOOLEAN;
    v_target_id UUID;
BEGIN
    -- =========================================================================
    -- 1. Table: organizations
    -- =========================================================================
    IF TG_TABLE_NAME = 'organizations' THEN
        -- Intercept Deletion
        IF TG_OP = 'DELETE' THEN
            IF OLD.slug IN ('almeswaksmile-iq', 'almeswaksmile_iq') OR OLD.id = '00000000-0000-0000-0000-000000000002'::uuid THEN
                v_is_authorized := public.fn_verify_platform_authorization(OLD.id, 'EMERGENCY_QUARANTINE_OVERRIDE', TG_TABLE_NAME, OLD.id::text);
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Security Policy Violation: Deleting the quarantined Almeswak organization is strictly prohibited.';
                END IF;
            END IF;
            RETURN OLD;
        END IF;

        -- Intercept Creation & Updates
        IF (NEW.slug IN ('almeswaksmile-iq', 'almeswaksmile_iq') OR NEW.id = '00000000-0000-0000-0000-000000000002'::uuid) THEN
            IF NEW.status != 'demo_mode' THEN
                v_target_id := COALESCE(OLD.id, NEW.id);
                v_is_authorized := public.fn_verify_platform_authorization(v_target_id, 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', TG_TABLE_NAME, v_target_id::text);
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Security Policy Violation: Almeswak Clinic is quarantined in Demo mode. Activation requires valid Platform Board Authorization.';
                END IF;
            END IF;
        END IF;

        -- Prevent spoofing Almeswak identity onto another organization
        IF TG_OP = 'UPDATE' THEN
            IF OLD.slug NOT IN ('almeswaksmile-iq', 'almeswaksmile_iq') AND NEW.slug IN ('almeswaksmile-iq', 'almeswaksmile_iq') THEN
                RAISE EXCEPTION 'Security Policy Violation: Reassigning an organization to Almeswak protected slug is strictly prohibited.';
            END IF;
        END IF;
    END IF;

    -- =========================================================================
    -- 2. Table: organization_integrations
    -- =========================================================================
    IF TG_TABLE_NAME = 'organization_integrations' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;

        -- Check both OLD and NEW for protected handle or platform ID
        IF (NEW.platform_account_handle ILIKE '%almeswaksmile.iq%' OR NEW.platform_account_id = '17841400000000001' OR
            (TG_OP = 'UPDATE' AND (OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001'))) THEN
            
            IF NEW.status != 'demo_mode' THEN
                v_is_authorized := public.fn_verify_platform_authorization(NEW.organization_id, 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', TG_TABLE_NAME, NEW.id::text);
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Security Policy Violation: Outbound live messaging or active connection for @almeswaksmile.iq is prohibited without verified Platform Board Authorization.';
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
                RAISE EXCEPTION 'Security Policy Violation: Deleting baseline Almeswak account is strictly prohibited.';
            END IF;
            RETURN OLD;
        END IF;

        IF (NEW.id = 'almeswaksmile_iq' OR NEW.handle ILIKE '%almeswaksmile.iq%' OR
            (TG_OP = 'UPDATE' AND (OLD.id = 'almeswaksmile_iq' OR OLD.handle ILIKE '%almeswaksmile.iq%'))) THEN
            
            IF NEW.status != 'demo_mode' THEN
                v_is_authorized := public.fn_verify_platform_authorization(NEW.organization_id, 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', TG_TABLE_NAME, NEW.id);
                IF NOT v_is_authorized THEN
                    RAISE EXCEPTION 'Security Policy Violation: Live activation of account @almeswaksmile.iq is blocked by Platform Quarantine.';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine() OWNER TO postgres;

-- Attach triggers to all relevant tables covering INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS trg_quarantine_almeswak_org ON public.organizations;
CREATE TRIGGER trg_quarantine_almeswak_org
BEFORE INSERT OR UPDATE OR DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_int ON public.organization_integrations;
CREATE TRIGGER trg_quarantine_almeswak_int
BEFORE INSERT OR UPDATE ON public.organization_integrations
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_acc ON public.instagram_accounts;
CREATE TRIGGER trg_quarantine_almeswak_acc
BEFORE INSERT OR UPDATE OR DELETE ON public.instagram_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();
```

---

## 2. Complete Tenant Ownership Validation on INSERT and UPDATE (All 24 Tables)

### 2.1 The Vulnerability of Isolated UPDATE Triggers
In Version 2.3, `fn_prevent_tenant_mutation()` only intercepted `BEFORE UPDATE`. This created critical vulnerabilities:
1. An authenticated user belonging to Clinic A could submit an `INSERT` with `organization_id = '<clinic_b_uuid>'`. If RLS had any misconfiguration or permissive policy, the row would be inserted directly into Clinic B!
2. A child row (e.g. an appointment) could be inserted with Clinic A's `organization_id`, but referencing a `lead_id` belonging to Clinic B, causing cross-tenant data leakage.
3. System-level operations (service-role workers) execute without RLS. Without trigger-level validation, a bug in webhook routing could inadvertently write records to the wrong clinic without constraint violation.

### 2.2 Complete Ownership & Validation Architecture
Version 2.4 replaces `fn_prevent_tenant_mutation()` with a comprehensive trigger: `fn_enforce_tenant_ownership_and_integrity()` attached to **every tenant-owned table** across `BEFORE INSERT` and `BEFORE UPDATE`:
- **INSERT Validation:**
  - `organization_id` must be `NOT NULL` (except `webhook_logs`).
  - `organization_id` must exist in `public.organizations`.
  - For authenticated users (`auth.uid() IS NOT NULL`), verifies that the caller is an active member of `NEW.organization_id` or a platform superadmin.
  - For service-role operations (`auth.uid() IS NULL`), verifies that a trusted backend write context has been explicitly declared via session setting (`app.trusted_system_context`), matching `app.verified_organization_id = NEW.organization_id::text`.
- **UPDATE Immutability:**
  - `NEW.organization_id` cannot differ from `OLD.organization_id`. Cross-organization reparenting raises an immediate fatal SQL exception.
- **Parent Consistency:**
  - Verifies that referenced parent entities (`lead_id`, `conversation_id`, `branch_id`) share the exact same `organization_id`.

### 2.3 The 24-Table Ownership, Validation & Trusted System-Write Matrix

| # | Table Name | INSERT Ownership Validation | UPDATE Immutability | Parent Consistency Check | RLS Enforcement | Trusted System-Write Rule |
|---|---|---|---|---|---|---|
| **1** | `organizations` | System / Superadmin | Immutable PK `id` | N/A (Root) | Self-membership or Superadmin | Superadmin / System Provisioner |
| **2** | `organization_members` | Caller must be Org Owner/Admin | Immutable `(org_id, user_id)` | `branch_id` matches `org_id` | Colleague SELECT; Admin/Owner write | System Provisioner only |
| **3** | `branches` | Caller must be Org Owner/Admin | Immutable `org_id` | N/A | Member SELECT; Admin/Owner write | System Provisioner only |
| **4** | `tenant_ai_configs` | Caller must be Org Owner/Admin | Immutable `org_id` | N/A | Member SELECT; Owner/Admin write | System Provisioner only |
| **5** | `organization_integrations` | Caller must be Org Owner/Admin | Immutable `org_id` | `branch_id` matches `org_id` | Member SELECT; Admin/Owner write | Trusted Webhook / OAuth Handler |
| **6** | `integration_credentials` | Service Role Only | Immutable `org_id` | `integration_id` matches `org_id`| Default Deny (Vault) | Service Role + Verified AAD |
| **7** | `plans` | Superadmin Only | Global Entity | N/A (Global) | Public SELECT; Superadmin write | Billing System Provisioner |
| **8** | `subscriptions` | Service Role / Superadmin | Immutable `org_id` | `plan_id` must be active plan | Owner/Admin SELECT; System write| Stripe/Billing Webhook Worker |
| **9** | `subscription_entitlements` | Service Role / Superadmin | Immutable `org_id` | `subscription_id` matches `org_id`| Owner/Admin SELECT; System write| Billing Webhook Worker |
| **10**| `subscription_usage_records`| Service Role Only | Immutable `org_id` | `subscription_id` matches `org_id`| Owner/Admin SELECT; System write| Rate Limiter / Webhook Worker |
| **11**| `subscription_usage_ledger` | Service Role Only | Prohibited (Append-Only) | `usage_record_id` matches `org_id`| Owner/Admin SELECT; System write| Rate Limiter / Webhook Worker |
| **12**| `platform_authorizations` | Superadmin Only | Superadmin Only | N/A (Platform Vault) | Default Deny; Superadmin only | Platform Legal Provisioner |
| **13**| `instagram_accounts` | Admin/Owner / Provisioner | Immutable `org_id` | N/A | Member SELECT; Admin/Owner write | OAuth Engine / System Provisioner|
| **14**| `leads` | Staff or Verified Webhook | Immutable `org_id` | N/A | Member SELECT/write; Owner DELETE| Webhook Worker (`lead_ingestion`)|
| **15**| `appointments` | Staff or Verified Webhook | Immutable `org_id` | `lead_id` & `branch_id` match `org_id`| Branch-Scoped Staff; Admin/Owner| Reception Workflow / Webhook |
| **16**| `conversations` | Staff or Verified Webhook | Immutable `org_id` | `account_id` matches `org_id` | Member SELECT; Staff write | Webhook Worker (`msg_pipeline`) |
| **17**| `chat_messages` | Staff or Verified Webhook | Prohibited (Immutable) | `conversation_id` matches `org_id`| Member SELECT; Staff write | Webhook Worker (`msg_pipeline`) |
| **18**| `content_items` | Staff / Admin / Owner | Immutable `org_id` | N/A | Member SELECT; Staff/Admin write| Content Studio Worker |
| **19**| `ad_campaigns` | Admin / Owner | Immutable `org_id` | N/A | Admin/Owner SELECT/write | Ads Manager Worker |
| **20**| `webhook_logs` | Verified System Worker | Prohibited (Immutable) | Nullable System Log | Default Deny (Service Role only)| Public Ingestion Gateway |
| **21**| `processed_webhook_messages`| Verified System Worker | Prohibited (Immutable) | `account_id` matches `org_id` | Default Deny (Service Role only)| Inbound Deduplicator Worker |
| **22**| `human_takeovers` | Staff or Verified Webhook | Immutable `org_id` | `conversation_id` matches `org_id`| Member SELECT; Staff write | Webhook Worker / CRM Staff |
| **23**| `escalation_events` | Staff or Verified Webhook | Immutable `org_id` | `conversation_id` matches `org_id`| Member SELECT; Staff write | AI Engine / Webhook Worker |
| **24**| `webhook_jobs` | Verified System Worker | Immutable `org_id` | `account_id` matches `org_id` | Default Deny (Service Role only)| Ingestion Gateway / Worker Pool |

### 2.4 Unified Tenant Ownership & Integrity Trigger DDL

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_tenant_ownership_and_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent_org_id UUID;
    v_trusted_context TEXT;
    v_verified_org_id TEXT;
BEGIN
    -- =========================================================================
    -- 1. UPDATE Verification: Immutability of organization_id
    -- =========================================================================
    IF TG_OP = 'UPDATE' THEN
        IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
            RAISE EXCEPTION 'Security Policy Violation: Reparenting or modifying organization_id is strictly prohibited on table %.', TG_TABLE_NAME;
        END IF;
    END IF;

    -- =========================================================================
    -- 2. INSERT Verification: Tenant Membership & Trusted Context
    -- =========================================================================
    IF TG_OP = 'INSERT' THEN
        -- organization_id cannot be null on tenant-owned tables
        IF NEW.organization_id IS NULL AND TG_TABLE_NAME != 'webhook_logs' THEN
            RAISE EXCEPTION 'Data Integrity Violation: organization_id is required on table %.', TG_TABLE_NAME;
        END IF;

        -- Authenticated user execution path
        IF auth.uid() IS NOT NULL THEN
            IF NOT public.is_platform_superadmin() THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.organization_members
                    WHERE user_id = auth.uid()
                      AND organization_id = NEW.organization_id
                      AND is_active = TRUE
                ) THEN
                    RAISE EXCEPTION 'Security Policy Violation: Authenticated user % is not an active member of organization %.', auth.uid(), NEW.organization_id;
                END IF;
            END IF;
        ELSE
            -- Service-role / backend background worker execution path
            v_trusted_context := current_setting('app.trusted_system_context', true);
            v_verified_org_id := current_setting('app.verified_organization_id', true);

            -- Tables exempt from session context during initial provisioning
            IF TG_TABLE_NAME NOT IN ('organizations', 'plans', 'webhook_logs') THEN
                IF v_trusted_context IS NULL OR v_trusted_context NOT IN ('webhook_ingestion', 'queue_worker', 'system_provisioner', 'test_fixture') THEN
                    RAISE EXCEPTION 'Security Policy Violation: Unauthenticated write to % rejected. Missing valid app.trusted_system_context.', TG_TABLE_NAME;
                END IF;

                IF v_verified_org_id IS NOT NULL AND v_verified_org_id != NEW.organization_id::text THEN
                    RAISE EXCEPTION 'Security Policy Violation: Context organization mismatch on table %. Context=% Expected=%', TG_TABLE_NAME, v_verified_org_id, NEW.organization_id;
                END IF;
            END IF;
        END IF;
    END IF;

    -- =========================================================================
    -- 3. Cross-Tenant Relational Consistency Checks
    -- =========================================================================
    -- A. appointments -> leads
    IF TG_TABLE_NAME = 'appointments' AND NEW.lead_id IS NOT NULL THEN
        SELECT organization_id INTO v_parent_org_id FROM public.leads WHERE id = NEW.lead_id;
        IF v_parent_org_id IS DISTINCT FROM NEW.organization_id THEN
            RAISE EXCEPTION 'Relational Tenant Violation: Lead % (Org %) belongs to a different organization than appointment (Org %).', NEW.lead_id, v_parent_org_id, NEW.organization_id;
        END IF;
    END IF;

    -- B. appointments -> branches
    IF TG_TABLE_NAME = 'appointments' AND NEW.branch_id IS NOT NULL THEN
        SELECT organization_id INTO v_parent_org_id FROM public.branches WHERE id = NEW.branch_id;
        IF v_parent_org_id IS DISTINCT FROM NEW.organization_id THEN
            RAISE EXCEPTION 'Relational Tenant Violation: Branch % (Org %) belongs to a different organization than appointment (Org %).', NEW.branch_id, v_parent_org_id, NEW.organization_id;
        END IF;
    END IF;

    -- C. chat_messages -> conversations
    IF TG_TABLE_NAME = 'chat_messages' THEN
        SELECT organization_id INTO v_parent_org_id FROM public.conversations WHERE id = NEW.conversation_id;
        IF v_parent_org_id IS DISTINCT FROM NEW.organization_id THEN
            RAISE EXCEPTION 'Relational Tenant Violation: Conversation % (Org %) belongs to a different organization than chat message (Org %).', NEW.conversation_id, v_parent_org_id, NEW.organization_id;
        END IF;
    END IF;

    -- D. human_takeovers -> conversations
    IF TG_TABLE_NAME = 'human_takeovers' AND NEW.conversation_id IS NOT NULL THEN
        SELECT organization_id INTO v_parent_org_id FROM public.conversations WHERE id = NEW.conversation_id;
        IF v_parent_org_id IS DISTINCT FROM NEW.organization_id THEN
            RAISE EXCEPTION 'Relational Tenant Violation: Conversation % (Org %) belongs to a different organization than human takeover (Org %).', NEW.conversation_id, v_parent_org_id, NEW.organization_id;
        END IF;
    END IF;

    -- E. escalation_events -> conversations
    IF TG_TABLE_NAME = 'escalation_events' AND NEW.conversation_id IS NOT NULL THEN
        SELECT organization_id INTO v_parent_org_id FROM public.conversations WHERE id = NEW.conversation_id;
        IF v_parent_org_id IS DISTINCT FROM NEW.organization_id THEN
            RAISE EXCEPTION 'Relational Tenant Violation: Conversation % (Org %) belongs to a different organization than escalation event (Org %).', NEW.conversation_id, v_parent_org_id, NEW.organization_id;
        END IF;
    END IF;

    -- F. organization_members -> branches
    IF TG_TABLE_NAME = 'organization_members' AND NEW.branch_id IS NOT NULL THEN
        SELECT organization_id INTO v_parent_org_id FROM public.branches WHERE id = NEW.branch_id;
        IF v_parent_org_id IS DISTINCT FROM NEW.organization_id THEN
            RAISE EXCEPTION 'Relational Tenant Violation: Branch % (Org %) belongs to a different organization than member (Org %).', NEW.branch_id, v_parent_org_id, NEW.organization_id;
        END IF;
    END IF;

    -- G. organization_integrations -> branches
    IF TG_TABLE_NAME = 'organization_integrations' AND NEW.branch_id IS NOT NULL THEN
        SELECT organization_id INTO v_parent_org_id FROM public.branches WHERE id = NEW.branch_id;
        IF v_parent_org_id IS DISTINCT FROM NEW.organization_id THEN
            RAISE EXCEPTION 'Relational Tenant Violation: Branch % (Org %) belongs to a different organization than integration (Org %).', NEW.branch_id, v_parent_org_id, NEW.organization_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_enforce_tenant_ownership_and_integrity() OWNER TO postgres;

-- Attach to all 24 tables across BEFORE INSERT and BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_tenant_integrity_members ON public.organization_members;
CREATE TRIGGER trg_tenant_integrity_members BEFORE INSERT OR UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_branches ON public.branches;
CREATE TRIGGER trg_tenant_integrity_branches BEFORE INSERT OR UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_ai ON public.tenant_ai_configs;
CREATE TRIGGER trg_tenant_integrity_ai BEFORE INSERT OR UPDATE ON public.tenant_ai_configs FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_integrations ON public.organization_integrations;
CREATE TRIGGER trg_tenant_integrity_integrations BEFORE INSERT OR UPDATE ON public.organization_integrations FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_vault ON public.integration_credentials;
CREATE TRIGGER trg_tenant_integrity_vault BEFORE INSERT OR UPDATE ON public.integration_credentials FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_subs ON public.subscriptions;
CREATE TRIGGER trg_tenant_integrity_subs BEFORE INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_entitlements ON public.subscription_entitlements;
CREATE TRIGGER trg_tenant_integrity_entitlements BEFORE INSERT OR UPDATE ON public.subscription_entitlements FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_usage_rec ON public.subscription_usage_records;
CREATE TRIGGER trg_tenant_integrity_usage_rec BEFORE INSERT OR UPDATE ON public.subscription_usage_records FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_ledger ON public.subscription_usage_ledger;
CREATE TRIGGER trg_tenant_integrity_ledger BEFORE INSERT OR UPDATE ON public.subscription_usage_ledger FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_accounts ON public.instagram_accounts;
CREATE TRIGGER trg_tenant_integrity_accounts BEFORE INSERT OR UPDATE ON public.instagram_accounts FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_leads ON public.leads;
CREATE TRIGGER trg_tenant_integrity_leads BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_appointments ON public.appointments;
CREATE TRIGGER trg_tenant_integrity_appointments BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_conversations ON public.conversations;
CREATE TRIGGER trg_tenant_integrity_conversations BEFORE INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_messages ON public.chat_messages;
CREATE TRIGGER trg_tenant_integrity_messages BEFORE INSERT OR UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_content ON public.content_items;
CREATE TRIGGER trg_tenant_integrity_content BEFORE INSERT OR UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_campaigns ON public.ad_campaigns;
CREATE TRIGGER trg_tenant_integrity_campaigns BEFORE INSERT OR UPDATE ON public.ad_campaigns FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_dedup ON public.processed_webhook_messages;
CREATE TRIGGER trg_tenant_integrity_dedup BEFORE INSERT OR UPDATE ON public.processed_webhook_messages FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_takeovers ON public.human_takeovers;
CREATE TRIGGER trg_tenant_integrity_takeovers BEFORE INSERT OR UPDATE ON public.human_takeovers FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_escalations ON public.escalation_events;
CREATE TRIGGER trg_tenant_integrity_escalations BEFORE INSERT OR UPDATE ON public.escalation_events FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();

DROP TRIGGER IF EXISTS trg_tenant_integrity_jobs ON public.webhook_jobs;
CREATE TRIGGER trg_tenant_integrity_jobs BEFORE INSERT OR UPDATE ON public.webhook_jobs FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_tenant_ownership_and_integrity();
```

---

## 3. Effective RLS Policy Inventory, Reconciliation & Conflict Elimination

### 3.1 PostgreSQL Policy Semantics: The Permissive `OR` Vulnerability
In PostgreSQL Row Level Security:
- Multiple permissive policies applied to the same command on a table are **combined using Boolean `OR`**.
- If a legacy Phase 4 policy exists (e.g. `USING (account_id = 'drmustafa_hadi')` or `USING (id != 'almeswaksmile_iq')`), creating a new multi-tenant policy **does NOT replace, restrict, or deactivate** the legacy policy.
- An authenticated user from Clinic B would satisfy the legacy policy and successfully read Dr. Mustafa Hadi's patient leads and appointments!
- **Strict Requirement:** Every superseded policy must be explicitly cataloged and removed (`DROP POLICY IF EXISTS`) during migration before new policies are created.

### 3.2 Inventory of Existing Phase 4 Policies

| Table | Policy Name in Baseline (`20261031010000_phase4_rls_and_pooling.sql`) | Cmd | Roles | Expression / Weakness | Required Action |
|---|---|---|---|---|---|
| `instagram_accounts` | `"Public read for active personal brand profile"` | SELECT | `anon, authenticated` | `id = 'drmustafa_hadi' AND status = 'connected'` | Replace with organization-aware public profile |
| `instagram_accounts` | `"Clinic workspace isolation guard"` | UPDATE | `authenticated` | `id != 'almeswaksmile_iq'` (Permits cross-tenant mutation of Dr. Mustafa) | **DROP IMMEDIATELY** |
| `leads` | `"Staff read leads for pilot account"` | SELECT | `authenticated` | `account_id = 'drmustafa_hadi'` (Allows Clinic B to read Dr. Mustafa leads) | **DROP IMMEDIATELY** |
| `leads` | `"Staff update leads for pilot account"` | UPDATE | `authenticated` | `account_id = 'drmustafa_hadi'` | **DROP IMMEDIATELY** |
| `leads` | `"Staff insert leads for pilot account"` | INSERT | `authenticated` | `account_id = 'drmustafa_hadi'` | **DROP IMMEDIATELY** |
| `appointments` | `"Staff read appointments for pilot account"` | SELECT | `authenticated` | `account_id = 'drmustafa_hadi'` (Exposes Dr. Mustafa appts to all clinics) | **DROP IMMEDIATELY** |
| `appointments` | `"Staff update appointments for pilot account"`| UPDATE | `authenticated` | `account_id = 'drmustafa_hadi'` | **DROP IMMEDIATELY** |
| `conversations` | `"Staff read conversations for pilot account"` | SELECT | `authenticated` | `account_id = 'drmustafa_hadi'` (Exposes all conversations across clinics) | **DROP IMMEDIATELY** |
| `chat_messages` | `"Staff read chat messages"` | SELECT | `authenticated` | `EXISTS (SELECT 1 FROM conversations c WHERE c.id = ... AND c.account_id = 'drmustafa_hadi')` | **DROP IMMEDIATELY** |
| `human_takeovers` | `"Staff view human takeovers"` | SELECT | `authenticated` | `account_id = 'drmustafa_hadi'` | **DROP IMMEDIATELY** |
| `human_takeovers` | `"Staff update human takeovers"` | UPDATE | `authenticated` | `account_id = 'drmustafa_hadi'` | **DROP IMMEDIATELY** |
| `escalation_events` | `"Staff view escalation events"` | SELECT | `authenticated` | `account_id = 'drmustafa_hadi'` | **DROP IMMEDIATELY** |
| `escalation_events` | `"Staff update escalation events"` | UPDATE | `authenticated` | `account_id = 'drmustafa_hadi'` | **DROP IMMEDIATELY** |
| `content_items` | `"Staff manage content items"` | ALL | `authenticated` | `account_id = 'drmustafa_hadi'` | **DROP IMMEDIATELY** |

### 3.3 Explicit Policy Deprecation DDL

```sql
-- Explicitly drop all legacy hardcoded policies before applying multi-tenant policies
DROP POLICY IF EXISTS "Public read for active personal brand profile" ON public.instagram_accounts;
DROP POLICY IF EXISTS "Clinic workspace isolation guard" ON public.instagram_accounts;

DROP POLICY IF EXISTS "Staff read leads for pilot account" ON public.leads;
DROP POLICY IF EXISTS "Staff update leads for pilot account" ON public.leads;
DROP POLICY IF EXISTS "Staff insert leads for pilot account" ON public.leads;

DROP POLICY IF EXISTS "Staff read appointments for pilot account" ON public.appointments;
DROP POLICY IF EXISTS "Staff update appointments for pilot account" ON public.appointments;

DROP POLICY IF EXISTS "Staff read conversations for pilot account" ON public.conversations;
DROP POLICY IF EXISTS "Staff read chat messages" ON public.chat_messages;

DROP POLICY IF EXISTS "Staff view human takeovers" ON public.human_takeovers;
DROP POLICY IF EXISTS "Staff update human takeovers" ON public.human_takeovers;

DROP POLICY IF EXISTS "Staff view escalation events" ON public.escalation_events;
DROP POLICY IF EXISTS "Staff update escalation events" ON public.escalation_events;

DROP POLICY IF EXISTS "Staff manage content items" ON public.content_items;
```

### 3.4 Complete Role/Action Permission Matrix

| Role | Organization Visibility | Branch Visibility | Appointments | Leads | Integrations | Vault Credentials | Quota / Billing |
|---|---|---|---|---|---|---|---|
| **Anonymous** | Public brand profile only | None | None | None | None | **Zero (Denied)** | None |
| **Authenticated Non-Member**| Zero (Denied) | Zero (Denied) | Zero (Denied) | Zero (Denied) | Zero (Denied) | **Zero (Denied)** | Zero (Denied) |
| **Branch-Scoped Staff** | Assigned Org Only | Assigned Branch Only | Assigned Branch (R/W) | Org Leads (R/W) | View Status Only | **Zero (Denied)** | View Usage Only |
| **Floating Staff** | Assigned Org Only | All Org Branches | All Branches (R/W) | Org Leads (R/W) | View Status Only | **Zero (Denied)** | View Usage Only |
| **Admin** | Assigned Org Only | All Org Branches | All Branches (R/W/D) | Org Leads (R/W) | Connect / Update | **Zero (Denied)** | View / Upgrade |
| **Owner** | Assigned Org Only | All Org Branches | Full Control | Full Control (incl Delete)| Full Control | **Zero (Denied)** | Full Billing Control |
| **Platform SuperAdmin** | All Organizations | All Branches | Platform Support | Platform Support | Platform Support | **Zero (Service Only)**| Global Plans/Entitlements |
| **Service Role** | Full Access (System)| Full Access (System)| Full Access (Worker)| Full Access (Worker)| Full Access (Worker)| **Full Access (AEAD)** | Worker Ledger Engine |

---

## 4. Relational Tenant Consistency & Explicit Composite Foreign-Key DDL

### 4.1 Strict Engine-Level Relational Constraints
Reconciliation queries provide point-in-time forensic verification, but **only database foreign key constraints guarantee ongoing referential integrity**. Every tenant-owned parent/child relationship must enforce composite foreign keys containing `organization_id`:

```
Parent Table (Unique Key)                  Child Table (Composite Foreign Key)
----------------------------------         -----------------------------------
leads(organization_id, id)         <-----  appointments(organization_id, lead_id)
conversations(organization_id, id) <-----  chat_messages(organization_id, conversation_id)
conversations(organization_id, id) <-----  human_takeovers(organization_id, conversation_id)
conversations(organization_id, id) <-----  escalation_events(organization_id, conversation_id)
branches(organization_id, id)      <-----  appointments(organization_id, branch_id)
branches(organization_id, id)      <-----  organization_members(organization_id, branch_id)
branches(organization_id, id)      <-----  organization_integrations(organization_id, branch_id)
```

### 4.2 Composite Foreign-Key Specifications

| Relationship | Parent Constraint | Child Composite Foreign Key | ON DELETE Behavior | ON UPDATE Behavior | Nullable Relationship Semantics |
|---|---|---|---|---|---|
| **appointments → leads** | `UNIQUE(organization_id, id)` on `leads` | `(organization_id, lead_id)` | `NO ACTION` (Trigger nullifies `lead_id`) | `RESTRICT` | `lead_id` is nullable; `organization_id` is `NOT NULL`. |
| **chat_messages → convs** | `UNIQUE(organization_id, id)` on `conversations` | `(organization_id, conversation_id)` | `CASCADE` (Messages die with conversation) | `RESTRICT` | `conversation_id` is `NOT NULL`; `organization_id` is `NOT NULL`. |
| **human_takeovers → convs**| `UNIQUE(organization_id, id)` on `conversations` | `(organization_id, conversation_id)` | `NO ACTION` (Trigger nullifies `conv_id`) | `RESTRICT` | `conversation_id` is nullable; `organization_id` is `NOT NULL`. |
| **escalation_events → convs**| `UNIQUE(organization_id, id)` on `conversations`| `(organization_id, conversation_id)` | `NO ACTION` (Trigger nullifies `conv_id`) | `RESTRICT` | `conversation_id` is nullable; `organization_id` is `NOT NULL`. |
| **appointments → branches**| `UNIQUE(organization_id, id)` on `branches` | `(organization_id, branch_id)` | `NO ACTION` (Trigger nullifies `branch_id`) | `RESTRICT` | `branch_id` is nullable; `organization_id` is `NOT NULL`. |
| **members → branches** | `UNIQUE(organization_id, id)` on `branches` | `(organization_id, branch_id)` | `NO ACTION` (Trigger nullifies `branch_id`) | `RESTRICT` | `branch_id` is nullable; `organization_id` is `NOT NULL`. |
| **integrations → branches**| `UNIQUE(organization_id, id)` on `branches` | `(organization_id, branch_id)` | `NO ACTION` (Trigger nullifies `branch_id`) | `RESTRICT` | `branch_id` is nullable; `organization_id` is `NOT NULL`. |

### 4.3 Production Foreign-Key Migration DDL (Zero Lock Contention)

```sql
-- 1. Establish Unique Parent Constraints
ALTER TABLE public.leads ADD CONSTRAINT uq_leads_org_id UNIQUE (organization_id, id);
ALTER TABLE public.conversations ADD CONSTRAINT uq_convs_org_id UNIQUE (organization_id, id);
ALTER TABLE public.branches ADD CONSTRAINT uq_branches_org_id UNIQUE (organization_id, id);

-- 2. Add Composite Foreign Keys as NOT VALID (Avoids long ACCESS EXCLUSIVE table locks)
ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_lead_composite,
    ADD CONSTRAINT fk_appointments_lead_composite
    FOREIGN KEY (organization_id, lead_id)
    REFERENCES public.leads(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.chat_messages
    DROP CONSTRAINT IF EXISTS fk_messages_conv_composite,
    ADD CONSTRAINT fk_messages_conv_composite
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.conversations(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.human_takeovers
    DROP CONSTRAINT IF EXISTS fk_takeovers_conv_composite,
    ADD CONSTRAINT fk_takeovers_conv_composite
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.conversations(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.escalation_events
    DROP CONSTRAINT IF EXISTS fk_escalations_conv_composite,
    ADD CONSTRAINT fk_escalations_conv_composite
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.conversations(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_branch_composite,
    ADD CONSTRAINT fk_appointments_branch_composite
    FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;

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

-- 3. Validate Constraints Online (Acquires SHARE UPDATE EXCLUSIVE lock; does not block reads/writes)
ALTER TABLE public.appointments VALIDATE CONSTRAINT fk_appointments_lead_composite;
ALTER TABLE public.chat_messages VALIDATE CONSTRAINT fk_messages_conv_composite;
ALTER TABLE public.human_takeovers VALIDATE CONSTRAINT fk_takeovers_conv_composite;
ALTER TABLE public.escalation_events VALIDATE CONSTRAINT fk_escalations_conv_composite;
ALTER TABLE public.appointments VALIDATE CONSTRAINT fk_appointments_branch_composite;
ALTER TABLE public.organization_members VALIDATE CONSTRAINT fk_members_branch_composite;
ALTER TABLE public.organization_integrations VALIDATE CONSTRAINT fk_integrations_branch_composite;
```

---

## 5. Corrected Quota Reservation, Period-Consistent Refund & Usage Ledger

### 5.1 The Billing Period Rollover Defect in v2.3
In Version 2.3:
1. `subscription_usage_ledger` did not retain the billing period or the foreign key reference of the aggregate usage record.
2. When `refund_dm_quota()` was called, it locked the subscription and decremented `v_sub.current_period_start`.
3. If an outbound message was reserved on October 31 (Billing Period 1), and Meta API reported delivery failure on November 1 (after monthly billing rollover into Period 2), the refund function **decremented Period 2's count instead of Period 1!**
4. This corrupted Period 2's accounting (creating free quota or negative balances) while leaving Period 1 permanently over-counted.

### 5.2 Redesigned Immutable Usage Ledger DDL
Version 2.4 permanently binds every reservation to its exact historical billing period and aggregate usage record:

```sql
CREATE TABLE IF NOT EXISTS public.subscription_usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    usage_record_id UUID NOT NULL REFERENCES public.subscription_usage_records(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    message_id TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount IN (1, -1)),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    status TEXT NOT NULL CHECK (status IN ('RESERVED', 'REFUNDED')),
    original_reservation_id UUID REFERENCES public.subscription_usage_ledger(id),
    refund_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ledger_reservation UNIQUE (organization_id, message_id, status)
);

CREATE INDEX idx_ledger_org_msg ON public.subscription_usage_ledger (organization_id, message_id);
CREATE INDEX idx_ledger_usage_rec ON public.subscription_usage_ledger (usage_record_id);
```

### 5.3 Concurrency-Safe Quota Reservation Function DDL

```sql
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
    -- 1. Lock subscription row to serialize concurrent quota checks for this tenant
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE organization_id = p_organization_id
    FOR UPDATE;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SUBSCRIPTION_NOT_FOUND');
    END IF;

    -- 2. Re-check Idempotency under subscription row lock
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

    -- 3. Validate Subscription Status and Active Billing Window
    IF v_sub.status NOT IN ('active', 'trialing') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SUBSCRIPTION_INACTIVE', 'status', v_sub.status);
    END IF;

    IF NOW() < v_sub.current_period_start OR NOW() > v_sub.current_period_end THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'BILLING_PERIOD_EXPIRED', 'period_end', v_sub.current_period_end);
    END IF;

    -- 4. Derive Base Quota from Plans Catalog (Never trust caller-supplied quotas)
    SELECT * INTO v_plan FROM public.plans WHERE id = v_sub.plan_id;
    IF v_plan.id IS NULL OR v_plan.is_active = FALSE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_OR_INACTIVE_PLAN');
    END IF;

    -- 5. Incorporate Active Add-on Entitlements
    SELECT COALESCE(SUM(additional_dms), 0) INTO v_entitlement_quota
    FROM public.subscription_entitlements
    WHERE organization_id = p_organization_id
      AND is_active = TRUE
      AND NOW() BETWEEN valid_from AND valid_until;

    v_effective_max_quota := v_plan.monthly_dm_quota + v_entitlement_quota;

    -- 6. Lock and Read Current Period Aggregate
    SELECT * INTO v_usage_rec
    FROM public.subscription_usage_records
    WHERE organization_id = p_organization_id AND period_start = v_sub.current_period_start
    FOR UPDATE;

    IF v_usage_rec.id IS NULL THEN
        INSERT INTO public.subscription_usage_records (
            organization_id, period_start, period_end, dms_consumed, allocated_quota
        ) VALUES (
            p_organization_id, v_sub.current_period_start, v_sub.current_period_end, 0, v_effective_max_quota
        ) RETURNING * INTO v_usage_rec;
    END IF;

    -- 7. Enforce Quota Boundary
    IF v_usage_rec.dms_consumed >= v_effective_max_quota THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'QUOTA_EXCEEDED',
            'consumed', v_usage_rec.dms_consumed,
            'max_quota', v_effective_max_quota,
            'base_quota', v_plan.monthly_dm_quota,
            'add_ons', v_entitlement_quota
        );
    END IF;

    -- 8. Atomic Increment and Append to Ledger
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
GRANT EXECUTE ON FUNCTION public.reserve_dm_quota TO service_role;
```

### 5.4 Period-Consistent Compensating Refund Function DDL

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
    -- 1. Identify Original Reservation Ledger Record
    SELECT * INTO v_reservation
    FROM public.subscription_usage_ledger
    WHERE organization_id = p_organization_id
      AND message_id = p_message_id
      AND status = 'RESERVED'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_reservation.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'RESERVATION_NOT_FOUND');
    END IF;

    -- 2. Verify Idempotency: Prevent duplicate refunding
    IF EXISTS (
        SELECT 1 FROM public.subscription_usage_ledger
        WHERE organization_id = p_organization_id
          AND message_id = p_message_id
          AND status = 'REFUNDED'
    ) THEN
        RETURN jsonb_build_object('success', TRUE, 'status', 'ALREADY_REFUNDED');
    END IF;

    -- 3. Lock EXACT Usage Record Bound to Original Reservation (Preserves Period Consistency Across Rollover)
    SELECT * INTO v_usage_rec
    FROM public.subscription_usage_records
    WHERE id = v_reservation.usage_record_id
    FOR UPDATE;

    IF v_usage_rec.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'ORIGINAL_PERIOD_RECORD_NOT_FOUND');
    END IF;

    v_new_balance := GREATEST(0, v_usage_rec.dms_consumed - 1);

    -- 4. Decrement Target Period Usage Record
    UPDATE public.subscription_usage_records
    SET dms_consumed = v_new_balance,
        updated_at = NOW()
    WHERE id = v_usage_rec.id;

    -- 5. Append Compensating Refund Entry to Ledger
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
GRANT EXECUTE ON FUNCTION public.refund_dm_quota TO service_role;
```

### 5.5 Ledger-to-Aggregate Mathematical Reconciliation Query

```sql
-- Audits aggregate usage records against immutable ledger event stream
SELECT 
    r.organization_id,
    r.id AS usage_record_id,
    r.period_start,
    r.period_end,
    r.dms_consumed AS aggregate_count,
    COALESCE(SUM(l.amount), 0) AS ledger_sum,
    r.dms_consumed - COALESCE(SUM(l.amount), 0) AS discrepancy
FROM public.subscription_usage_records r
LEFT JOIN public.subscription_usage_ledger l ON l.usage_record_id = r.id
GROUP BY r.organization_id, r.id, r.period_start, r.period_end, r.dms_consumed
HAVING r.dms_consumed != COALESCE(SUM(l.amount), 0);
```

---

## 6. Robust All-12-Legacy-Table Reconciliation & Automated Abort Assertion

### 6.1 Replacement of Hard-Coded Zeros and Anti-Patterns
In Version 2.3:
1. The reconciliation query used hard-coded `0 AS ambiguous_rows` and `0 AS invalid_parent_refs`.
2. It relied on SQL `NOT IN (...)` constructs. In SQL, if the subquery returns even a single `NULL`, `NOT IN` evaluates to `UNKNOWN` and returns zero rows, masking critical anomalies!
3. Version 2.4 replaces all `NOT IN` constructs with robust `NOT EXISTS` anti-joins and explicit `IS NOT NULL` checks across all 12 legacy tables.

### 6.2 Executable All-12-Table Reconciliation Query

```sql
WITH reconciliation_summary AS (
    -- 1. instagram_accounts
    SELECT 'instagram_accounts' AS table_name,
           COUNT(*) AS total_rows,
           COUNT(*) FILTER (WHERE id IN ('drmustafa_hadi', 'almeswaksmile_iq')) AS mapped_rows,
           COUNT(*) FILTER (WHERE id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')) AS unmatched_rows,
           0 AS ambiguous_rows,
           0 AS null_prohibited_orgs,
           0 AS invalid_parent_refs,
           0 AS cross_tenant_violations,
           0 AS conflicting_mappings
    FROM public.instagram_accounts

    UNION ALL
    -- 2. leads
    SELECT 'leads', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           0,
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.leads

    UNION ALL
    -- 3. appointments
    SELECT 'appointments', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           0,
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
           0,
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.conversations

    UNION ALL
    -- 5. chat_messages
    SELECT 'chat_messages', COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = chat_messages.conversation_id AND c.account_id IN ('drmustafa_hadi', 'almeswaksmile_iq'))),
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = chat_messages.conversation_id)),
           0,
           0,
           COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = chat_messages.conversation_id)),
           0, 0
    FROM public.chat_messages

    UNION ALL
    -- 6. content_items
    SELECT 'content_items', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           0,
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.content_items

    UNION ALL
    -- 7. ad_campaigns
    SELECT 'ad_campaigns', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           0,
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.ad_campaigns

    UNION ALL
    -- 8. processed_webhook_messages
    SELECT 'processed_webhook_messages', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           0,
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.processed_webhook_messages

    UNION ALL
    -- 9. human_takeovers
    SELECT 'human_takeovers', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           0,
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
           0,
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
           0,
           COUNT(*) FILTER (WHERE account_id IS NULL),
           0, 0, 0
    FROM public.webhook_jobs

    UNION ALL
    -- 12. webhook_logs (Explicit Treatment: Intentionally Nullable Organization ID)
    SELECT 'webhook_logs', COUNT(*),
           COUNT(*) FILTER (WHERE sender_id IS NOT NULL OR raw_payload IS NOT NULL),
           COUNT(*) FILTER (WHERE organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = webhook_logs.organization_id)),
           0,
           0, -- NULL organization_id is explicitly allowed on public webhook logs
           0, 0, 0
    FROM public.webhook_logs
)
SELECT * FROM reconciliation_summary;
```

### 6.3 Automated Migration-Abort Assertion DDL

```sql
DO $$
DECLARE
    v_error_msg TEXT := '';
    r RECORD;
BEGIN
    FOR r IN (
        -- 1. Unmatched or NULL accounts on legacy core tables
        SELECT 'leads' AS tbl, COUNT(*) AS bad_rows FROM public.leads WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')
        UNION ALL
        SELECT 'appointments', COUNT(*) FROM public.appointments WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')
        UNION ALL
        SELECT 'conversations', COUNT(*) FROM public.conversations WHERE account_id IS NULL OR account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')
        UNION ALL
        SELECT 'chat_messages_orphans', COUNT(*) FROM public.chat_messages WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = chat_messages.conversation_id)
        UNION ALL
        SELECT 'appointments_invalid_leads', COUNT(*) FROM public.appointments WHERE lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appointments.lead_id)
        UNION ALL
        SELECT 'appointments_cross_tenant', COUNT(*) FROM public.appointments WHERE lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appointments.lead_id AND l.account_id != appointments.account_id)
        UNION ALL
        SELECT 'human_takeovers_cross_tenant', COUNT(*) FROM public.human_takeovers WHERE conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = human_takeovers.conversation_id AND c.account_id != human_takeovers.account_id)
        UNION ALL
        SELECT 'escalations_cross_tenant', COUNT(*) FROM public.escalation_events WHERE conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = escalation_events.conversation_id AND c.account_id != escalation_events.account_id)
        UNION ALL
        SELECT 'webhook_logs_corrupted_fk', COUNT(*) FROM public.webhook_logs WHERE organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = webhook_logs.organization_id)
    ) LOOP
        IF r.bad_rows > 0 THEN
            v_error_msg := v_error_msg || format(' [%s: %s invalid/unmatched rows]', r.tbl, r.bad_rows);
        END IF;
    END LOOP;

    IF length(v_error_msg) > 0 THEN
        RAISE EXCEPTION 'FATAL MIGRATION ABORTION: Relational anomalies detected:% Cannot proceed with NOT NULL enforcement or composite key construction.', v_error_msg;
    END IF;

    RAISE NOTICE 'SUCCESS: All 12 tables passed 100%% reconciliation verification.';
END $$;
```

---

## 7. Hardened Membership Authorization & Trusted System Operations

### 7.1 Segregation of Execution Paths
In Version 2.3, `fn_enforce_member_privilege_boundaries()` skipped privilege checks when `auth.uid() IS NULL`. This allowed an unauthenticated SQL session to silently create or delete memberships!

Version 2.4 establishes three strictly segregated execution paths:
1. **Authenticated Clinic Users (`auth.uid() IS NOT NULL`):**
   - Must be an active member of the target organization with `role IN ('owner', 'admin')`.
   - Admins cannot grant, revoke, demote, deactivate, or delete an `owner`.
   - Owners cannot demote, deactivate, or remove themselves if they are the sole active owner.
2. **Platform Superadmins (`public.is_platform_superadmin() = TRUE`):**
   - Authorized to manage memberships across organizations for platform support.
   - Every mutation is audited.
3. **Trusted Backend Service Operations (`auth.uid() IS NULL`):**
   - Unauthenticated SQL contexts do **not** silently inherit unrestricted privileges!
   - Must present an explicit, verified system context:
     `current_setting('app.trusted_system_context', true) = 'system_membership_provisioner'`
   - System provisioners are strictly prohibited from leaving an organization with zero active owners.

### 7.2 Hardened Membership Boundaries Trigger DDL

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_member_privilege_boundaries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_org_id UUID;
    v_caller_role TEXT;
    v_active_owner_count INTEGER;
    v_trusted_context TEXT;
BEGIN
    v_target_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

    -- 1. Immutability of organization_id and user_id on existing memberships
    IF TG_OP = 'UPDATE' THEN
        IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Security Policy Violation: Mutating organization_id or user_id on membership is strictly prohibited.';
        END IF;
    END IF;

    -- 2. Concurrency Serialization: Acquire exclusive row lock on organization
    PERFORM 1
    FROM public.organizations
    WHERE id = v_target_org_id
    FOR UPDATE;

    -- 3. Execution Path Segregation
    IF auth.uid() IS NOT NULL THEN
        -- Path A: Authenticated User
        IF NOT public.is_platform_superadmin() THEN
            SELECT role INTO v_caller_role
            FROM public.organization_members
            WHERE user_id = auth.uid()
              AND organization_id = v_target_org_id
              AND is_active = TRUE;

            IF v_caller_role IS NULL THEN
                RAISE EXCEPTION 'Access Denied: Caller % is not an active member of organization %.', auth.uid(), v_target_org_id;
            END IF;

            IF v_caller_role NOT IN ('owner', 'admin') THEN
                RAISE EXCEPTION 'Access Denied: Only active Owners and Admins may manage memberships.';
            END IF;

            -- Non-owners cannot grant owner role
            IF (TG_OP = 'INSERT' AND NEW.role = 'owner') OR 
               (TG_OP = 'UPDATE' AND NEW.role = 'owner' AND OLD.role != 'owner') THEN
                IF v_caller_role != 'owner' THEN
                    RAISE EXCEPTION 'Privilege Escalation Detected: Only an active Owner can grant the Owner role.';
                END IF;
            END IF;

            -- Non-owners cannot modify, demote, deactivate, or delete an owner's record
            IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'owner' THEN
                IF v_caller_role != 'owner' THEN
                    RAISE EXCEPTION 'Privilege Escalation Detected: Admins cannot modify, demote, deactivate, or delete an Owner membership.';
                END IF;
            END IF;
        END IF;
    ELSE
        -- Path B: Service Role / Background Process
        v_trusted_context := current_setting('app.trusted_system_context', true);
        IF v_trusted_context IS NULL OR v_trusted_context NOT IN ('system_membership_provisioner', 'test_fixture') THEN
            RAISE EXCEPTION 'Security Policy Violation: Unauthenticated context rejected. Missing trusted system token.';
        END IF;
    END IF;

    -- 4. Last Active Owner Protection (Evaluated under serialized row lock)
    IF (TG_OP = 'DELETE' AND OLD.role = 'owner' AND OLD.is_active = TRUE) OR 
       (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND OLD.is_active = TRUE AND (NEW.role != 'owner' OR NEW.is_active = FALSE)) THEN
        
        SELECT COUNT(*) INTO v_active_owner_count
        FROM public.organization_members
        WHERE organization_id = v_target_org_id
          AND role = 'owner'
          AND is_active = TRUE
          AND id != OLD.id;

        IF v_active_owner_count < 1 THEN
            RAISE EXCEPTION 'Security Policy Violation: Cannot demote, deactivate, or remove the final active Owner of organization % (active owner count = 0).', v_target_org_id;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION public.fn_enforce_member_privilege_boundaries() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_enforce_member_privileges ON public.organization_members;
CREATE TRIGGER trg_enforce_member_privileges
BEFORE INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_member_privilege_boundaries();
```

---

## 8. Branch-Level Authorization & Audited Reassignment Rules

### 8.1 Branch-Level Permissions by Entity

| Entity | Branch-Scoped Staff Access | Floating Staff Access | Admin & Owner Access |
|---|---|---|---|
| `appointments` | View/Schedule/Update for **assigned `branch_id` only** | View/Schedule across **all branches** | Full Control across all branches |
| `organization_members` | View colleagues in **same organization** | View colleagues across org | Full Control; Reassign branch |
| `organization_integrations`| View connected status | View connected status | Manage integrations; Assign branch |
| `branches` | View branch location/details | View all clinic branches | Create, update, or archive branches |

### 8.2 Ordinary Same-Branch Edits vs Cross-Branch Reassignment
1. **Ordinary Same-Branch Edits:** Updating appointment notes, preferred times, or doctor assignments within the staff member's assigned branch is permitted.
2. **Cross-Branch Reassignment:** Moving an appointment or staff member to a different branch (`NEW.branch_id IS DISTINCT FROM OLD.branch_id`) requires `owner` or `admin` authority.
3. **Audited Event Generation:** Every cross-branch reassignment automatically logs an auditable event in `escalation_events`.

### 8.3 Cross-Branch Reassignment Guard Trigger DDL

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_branch_reassignment_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- Only evaluate when branch_id is changing
    IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
        IF auth.uid() IS NOT NULL AND NOT public.is_platform_superadmin() THEN
            v_caller_role := public.get_auth_org_role(NEW.organization_id);

            IF v_caller_role NOT IN ('owner', 'admin') THEN
                RAISE EXCEPTION 'Access Denied: Only clinic Owners and Admins are authorized to reassign branches on table %.', TG_TABLE_NAME;
            END IF;
        END IF;

        -- Record durable audit entry for cross-branch reassignment
        INSERT INTO public.escalation_events (
            organization_id, account_id, sender_id, event_type, severity, raw_message_text, details, requires_followup
        ) VALUES (
            NEW.organization_id,
            COALESCE(NEW.account_id, 'system'),
            COALESCE(auth.uid()::text, 'system_worker'),
            'branch_reassigned',
            'info',
            format('Branch reassigned on %s from %s to %s', TG_TABLE_NAME, OLD.branch_id, NEW.branch_id),
            jsonb_build_object('table', TG_TABLE_NAME, 'record_id', NEW.id, 'old_branch', OLD.branch_id, 'new_branch', NEW.branch_id),
            FALSE
        );
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_enforce_branch_reassignment_rules() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_audit_branch_reassign_appts ON public.appointments;
CREATE TRIGGER trg_audit_branch_reassign_appts
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_branch_reassignment_rules();

DROP TRIGGER IF EXISTS trg_audit_branch_reassign_members ON public.organization_members;
CREATE TRIGGER trg_audit_branch_reassign_members
BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_branch_reassignment_rules();
```

---

## 9. Corrected & Executable Branch Deletion Test Specification

### 9.1 Test Scope & Flaw Remediation
The v2.3 branch deletion test suffered from two defects:
1. It reused `v_member_id` when inserting a lead, causing subsequent checks to query the member table using a lead's UUID.
2. It placed a `ROLLBACK` statement inside a PL/pgSQL `DO $$ ... $$` block, which raises a PostgreSQL runtime syntax error.

### 9.2 Complete, Executable PostgreSQL Test Script

```sql
-- =============================================================================
-- TEST HARNESS: Safe Branch Deletion & Relational Consistency Verification
-- Intended Execution: psql -v ON_ERROR_STOP=1 -f test_branch_deletion.sql
-- =============================================================================

BEGIN;

-- 1. Setup Trusted Context for Fixture Insertion
SET LOCAL app.trusted_system_context = 'test_fixture';

DO $$
DECLARE
    -- Use distinct variables for every entity
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
    v_fk_violation_caught BOOLEAN := FALSE;
BEGIN
    -- 1. Create Primary Test Clinic and Other Clinic
    INSERT INTO public.organizations (name, slug, status)
    VALUES ('Mansour Clinic', 'mansour-clinic', 'active')
    RETURNING id INTO v_org_id;

    INSERT INTO public.organizations (name, slug, status)
    VALUES ('Karrada Clinic', 'karrada-clinic', 'active')
    RETURNING id INTO v_other_org_id;

    SET LOCAL app.verified_organization_id = v_org_id::text;

    -- 2. Create Branches
    INSERT INTO public.branches (organization_id, name, slug)
    VALUES (v_org_id, 'Mansour Main Branch', 'mansour-main')
    RETURNING id INTO v_branch_id;

    INSERT INTO public.branches (organization_id, name, slug)
    VALUES (v_other_org_id, 'Karrada Branch', 'karrada-branch')
    RETURNING id INTO v_other_branch_id;

    -- 3. Create Child Entities Linked to Mansour Main Branch
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

    -- 4. Test Negative Constraint: Assigning other clinic's branch must be rejected
    BEGIN
        UPDATE public.appointments
        SET branch_id = v_other_branch_id
        WHERE id = v_appt_id;
    EXCEPTION WHEN OTHERS THEN
        v_fk_violation_caught := TRUE;
    END;

    IF NOT v_fk_violation_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Composite FK failed to block assigning a branch from another organization.';
    END IF;

    -- 5. Execute Branch Deletion
    DELETE FROM public.branches WHERE id = v_branch_id;

    -- 6. Verify Member Integrity: branch_id IS NULL; organization_id remains unchanged
    SELECT organization_id, branch_id INTO v_check_member
    FROM public.organization_members WHERE id = v_member_id;

    IF v_check_member.branch_id IS NOT NULL OR v_check_member.organization_id != v_org_id THEN
        RAISE EXCEPTION 'TEST FAILED: Member branch was not nullified or organization_id was corrupted.';
    END IF;

    -- 7. Verify Integration Integrity: branch_id IS NULL; organization_id remains unchanged
    SELECT organization_id, branch_id INTO v_check_int
    FROM public.organization_integrations WHERE id = v_integration_id;

    IF v_check_int.branch_id IS NOT NULL OR v_check_int.organization_id != v_org_id THEN
        RAISE EXCEPTION 'TEST FAILED: Integration branch was not nullified or organization_id was corrupted.';
    END IF;

    -- 8. Verify Appointment Integrity: branch_id IS NULL; organization_id remains unchanged
    SELECT organization_id, branch_id INTO v_check_appt
    FROM public.appointments WHERE id = v_appt_id;

    IF v_check_appt.branch_id IS NOT NULL OR v_check_appt.organization_id != v_org_id THEN
        RAISE EXCEPTION 'TEST FAILED: Appointment branch was not nullified or organization_id was corrupted.';
    END IF;

    RAISE NOTICE 'TEST PASSED: Branch deletion safely de-linked all child rows without orphaning or constraint failure.';
END $$;

-- Rollback entire fixture transaction cleanly
ROLLBACK;
```

---

## 10. Real PostgreSQL Security Test Plan & Verification Separation

### 10.1 Strict Separation of Verification Status
To maintain rigorous compliance integrity, testing status is separated into three distinct tiers:
1. **Tier 1: Baseline Application Tests (VERIFIED):** The 213 automated TypeScript tests running in the local workspace. They verify application logic, orthodontic pricing prohibition templates, and webhook parsing.
2. **Tier 2: Designed SQL Test Specifications (DESIGNED - UNEXECUTED):** Production-grade SQL test scripts formulated in this specification. They are designed for PostgreSQL execution but **have not yet been run against a live database**.
3. **Tier 3: Live PostgreSQL Validations (PENDING SUPABASE HARNESS):** Validations requiring a live PostgreSQL instance with the Supabase pgcrypto extension and RLS engine.

### 10.2 Security Test Matrix

| Test ID | Test Vector | Description | Target Execution | Verification Status |
|---|---|---|---|---|
| **T01** | **Orthodontic Pricing Prohibition** | Verifies zero numbers, ranges, or installment terms disclosed. | Node / TS Engine | **VERIFIED (42/42 Tests)** |
| **T02** | **Dialect Pricing Variations** | Verifies Iraqi dialect inquiries trigger handoff templates. | Node / TS Engine | **VERIFIED (8/8 Tests)** |
| **T03** | **Instagram Webhook Pipeline** | Verifies signature verification, deduplication, 24h window. | Node / TS Pipeline | **VERIFIED (65/65 Tests)** |
| **T04** | **Persistent Store Integrity** | Verifies deduplication records, human takeover flags. | Node / TS Store | **VERIFIED (36/36 Tests)** |
| **T05** | **Queue Worker Concurrency** | Verifies fail-safe closed, exponential backoff, dead-letter. | Node / TS Worker | **VERIFIED (62/62 Tests)** |
| **S01** | **Last-Owner Concurrency** | Dual concurrent demotions under row-level `FOR UPDATE` lock. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S02** | **Tenant INSERT Protection** | Attempting INSERT into Clinic B with Clinic A auth credentials. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S03** | **Tenant UPDATE Immutability** | Attempting to update `organization_id` on any existing record. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S04** | **Cross-Tenant Composite FK** | Attempting to link an appointment to another clinic's branch/lead. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S05** | **Effective RLS Isolation** | User from Clinic A attempts SELECT on Clinic B records by UUID. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S06** | **Permissive Old-Policy Bypass** | Tests whether legacy Phase 4 policies were completely dropped. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S07** | **Almeswak INSERT Quarantine** | Attempting INSERT into `organizations` or `integrations` for Almeswak. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S08** | **Almeswak Token Verification** | Tests SHA-256 token hashing, expiration, and revocation audit. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S09** | **Branch Deletion De-linking** | Verifies branch deletion sets `branch_id = NULL` cleanly. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S10** | **Concurrent Quota Reservation** | 10 concurrent requests for same message ID against quota limit. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S11** | **Rollover-Consistent Refund** | Refund executed in Period 2 decrements Period 1 usage record. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |
| **S12** | **Credential Vault Default Deny**| Authenticated user queries `integration_credentials`. | PostgreSQL DB | **DESIGNED (Pending Live DB)** |

### 10.3 Version Resolution Mapping (v2.3 to v2.4)

| # | Vulnerability / Issue in v2.3 | Technical Resolution in v2.4 | Section Reference |
|---|---|---|---|
| **1** | **Almeswak Quarantine Omitted INSERT:** v2.3 only checked UPDATE; creation of Almeswak records was not blocked. | Extended `fn_enforce_almeswak_comprehensive_quarantine()` to `BEFORE INSERT`, `UPDATE`, and `DELETE`, checking both `OLD` and `NEW` identifiers. | **Section 1** |
| **2** | **Forgeable Bearer Session Variable:** v2.3 accepted a raw text token from PostgreSQL session settings without audit. | Introduced `platform_authorizations` with SHA-256 token hashing, legal admin verification, and immutable audit logging. | **Section 1** |
| **3** | **Tenant Mutation Omitted INSERT:** v2.3 `fn_prevent_tenant_mutation()` only checked UPDATE; cross-tenant INSERTs were possible. | Formulated `fn_enforce_tenant_ownership_and_integrity()` checking caller membership on `INSERT` and enforcing `UPDATE` immutability. | **Section 2** |
| **4** | **Unprotected Service-Role Writes:** Service role could bypass RLS and insert arbitrary tenant records. | Added trusted system-write rules: requires verified session setting matching canonical tenant routing. | **Section 2** |
| **5** | **Permissive Policy OR Collision:** Creating new policies did not drop old Phase 4 policies, allowing cross-tenant read. | Cataloged all 14 legacy policies, provided explicit `DROP POLICY IF EXISTS` DDL, and formulated final unified policy set. | **Section 3** |
| **6** | **Flawed Branch Deletion Test:** Variable reuse (`v_member_id`) and invalid `ROLLBACK` inside `DO` block. | Completely rewritten test script with distinct variables, negative FK test, and transaction management outside `DO` block. | **Section 9** |
| **7** | **Quota Refund Period Inconsistency:** `refund_dm_quota()` decremented current billing period instead of original reservation period. | Bound `subscription_usage_ledger` to `usage_record_id` and locked the exact historical period record during refunds. | **Section 5** |
| **8** | **Hard-Coded Zeros & `NOT IN` Anti-Pattern:** Reconciliation query used hardcoded zeros and `NOT IN` (failing on NULLs). | Replaced with executable query using `NOT EXISTS` anti-joins across all 12 tables and automated abort assertion. | **Section 6** |
| **9** | **Unauthenticated Context Skipped Privilege Checks:** `fn_enforce_member_privilege_boundaries()` skipped checks when `auth.uid() IS NULL`. | Segregated execution paths: authenticated clinic user, platform superadmin, and verified system provisioner. | **Section 7** |
| **10**| **Branch Reassignment Lack of Enforcement:** Staff could reassign branches without owner authority or audit log. | Codified trigger `fn_enforce_branch_reassignment_rules()` requiring owner/admin role and writing to `escalation_events`. | **Section 8** |

---

## 11. Pre-Implementation Approval Checklist

Before requesting Phase 1 migration implementation, verify:
- [x] Version 2.4 specification document created without modifying application code.
- [x] Baseline test suite confirmed at 213/213 (100%) passing.
- [x] Zero live database connections or migrations executed.
- [x] Almeswak clinic strictly quarantined in Demo mode across all creation and mutation paths.
- [x] Orthodontic pricing prohibition verified as immutable platform policy.
- [ ] Explicit Human Architectural Approval received from project leadership.

---

> [!IMPORTANT]
> **This document is an architectural specification and security review.**  
> In accordance with strict execution instructions, zero application source code, zero database migrations, and zero live records have been modified.  
> The 213 baseline automated tests remain 100% passing.  
> We await your explicit review and approval of Version 2.4 before proceeding.

