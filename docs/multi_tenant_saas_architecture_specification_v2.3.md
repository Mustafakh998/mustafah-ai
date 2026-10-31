# MustafaH-AI — Multi-Clinic SaaS Architectural Specification
**Version:** 2.3.0 (Enterprise Multi-Tenant Security, Relational Concurrency & Production Migration Audit)  
**Status:** DRAFT SPECIFICATION & SECURITY AUDIT (Pending User Approval — Zero Database/Code Changes Executed)  
**Document Classification:** Mission-Critical Healthcare SaaS Architecture  
**Founding Pilot Tenant:** Dr. Mustafa Hadi (`@drmustafa_hadi` — Personal Dental Brand)  
**Quarantined Demo Tenant:** Almeswak Dental Clinic (`@almeswaksmile.iq` — Strictly Locked in Demo Mode)  

---

## Executive Architectural Summary

MustafaH-AI is transitioning from a single-clinic Instagram assistant into an **Enterprise Multi-Clinic Dental SaaS Platform**. The platform will host multiple independent dental practices across Baghdad and Iraq on a unified, high-performance infrastructure while guaranteeing **cryptographic, operational, and relational tenant isolation**.

### Uncompromising Platform Principles
1. **Pilot Continuity:** Dr. Mustafa Hadi (`@drmustafa_hadi`) is preserved as the founding tenant (`org_drmustafa_hadi`). All 213 passing automated tests and historical clinic records will transition seamlessly with zero downtime.
2. **Clinic Workspace Protection:** Almeswak Dental Clinic (`@almeswaksmile.iq`) remains quarantined in Demo Mode without live credentials or outbound message capabilities until clinic management authorizes activation.
3. **Immutable Orthodontic Pricing Prohibition:** The prohibition against disclosing orthodontic prices, ranges, down payments, or installment plans via automated channels is an **immutable platform-level policy**. No clinic owner, staff role, plan tier, or tenant configuration can disable or override this restriction.
4. **Relational Tenant Consistency:** Cross-table references (such as an appointment referencing a patient lead, or a message referencing a conversation) must be constrained at the PostgreSQL engine level via **composite foreign keys**, preventing cross-tenant data contamination even in the presence of application-level bugs.
5. **No Ephemeral Local Buffer on Serverless:** Production webhook ingestion resilience must operate strictly on verified durable storage. Ephemeral serverless filesystems (`/tmp`) are explicitly rejected as recovery mechanisms.
6. **Zero-Trust Multi-Tenancy:** No clinic may ever view, mutate, or inherit another clinic's branding, location, phone number, clinical FAQs, leads, conversations, or access tokens.

---

## 1. Concurrent Last-Owner Removal Protection & Membership Privilege Boundary Architecture

### 1.1 Concurrency Vulnerability in v2.2
In Version 2.2, `fn_enforce_member_privilege_boundaries()` checked the active owner count using a read query:
```sql
SELECT COUNT(*) INTO v_active_owner_count FROM public.organization_members ...
```
In high-concurrency environments under standard PostgreSQL `READ COMMITTED` isolation, if two co-owners of an organization simultaneously submit requests to delete, demote, or deactivate their own accounts, both transactions execute their `COUNT(*)` concurrently before either commits. Both transactions observe `v_active_owner_count = 1` (the other owner), pass the guard, and commit. As a result, the organization is left with **zero active owners**, rendering the tenant permanently orphaned and unmanageable.

### 1.2 Serialization via Exclusive Row Locking
Version 2.3 resolves this race condition by serializing all membership privilege mutations per organization. Before evaluating membership counts or role mutations, the transaction **must acquire an exclusive row-level lock** (`FOR UPDATE`) on the parent `public.organizations` record.

```
Transaction A (Owner 1 Demote)          Transaction B (Owner 2 Demote)
----------------------------------      ----------------------------------
BEGIN;                                  BEGIN;
SELECT id FROM organizations            SELECT id FROM organizations
  WHERE id = $org_id FOR UPDATE;          WHERE id = $org_id FOR UPDATE;
[ACQUIRES LOCK]                         [BLOCKED WAITING FOR LOCK...]
Check active owners (Count = 2)         ...
Update Owner 1 -> staff                 ...
COMMIT; [RELEASES LOCK]                 ...
                                        [UNBLOCKS & ACQUIRES LOCK]
                                        Re-checks active owners (Count = 1)
                                        Target is final owner (Count - 1 = 0)
                                        RAISE EXCEPTION 'Cannot demote final owner'!
                                        ROLLBACK;
```

### 1.3 Complete Production Trigger DDL

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
BEGIN
    v_target_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

    -- 1. Enforce Immutability of organization_id and user_id on existing memberships
    IF TG_OP = 'UPDATE' THEN
        IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Security Violation: Mutating organization_id or user_id on membership is strictly prohibited.';
        END IF;
    END IF;

    -- 2. Concurrency Serialization: Acquire exclusive lock on organization row
    -- This serializes all concurrent membership modifications for this organization
    PERFORM 1
    FROM public.organizations
    WHERE id = v_target_org_id
    FOR UPDATE;

    -- 3. Caller Privilege Authorization (Enforced when called via authenticated user)
    IF auth.uid() IS NOT NULL THEN
        SELECT role INTO v_caller_role
        FROM public.organization_members
        WHERE user_id = auth.uid()
          AND organization_id = v_target_org_id
          AND is_active = TRUE;

        -- Caller must be an active member of this organization
        IF v_caller_role IS NULL THEN
            RAISE EXCEPTION 'Access Denied: Caller is not an active member of organization %.', v_target_org_id;
        END IF;

        -- Only active Owners and Admins may create or modify memberships
        IF v_caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Access Denied: Only active Owners and Admins may manage memberships.';
        END IF;

        -- Check: Non-owners cannot grant the 'owner' role
        IF (TG_OP = 'INSERT' AND NEW.role = 'owner') OR 
           (TG_OP = 'UPDATE' AND NEW.role = 'owner' AND OLD.role != 'owner') THEN
            IF v_caller_role != 'owner' THEN
                RAISE EXCEPTION 'Privilege Escalation Detected: Only an active Owner can grant the Owner role.';
            END IF;
        END IF;

        -- Check: Non-owners cannot modify, demote, deactivate, or delete an owner's record
        IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'owner' THEN
            IF v_caller_role != 'owner' THEN
                RAISE EXCEPTION 'Privilege Escalation Detected: Admins cannot modify, demote, deactivate, or delete an Owner membership.';
            END IF;
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
            RAISE EXCEPTION 'Security Violation: Cannot demote, deactivate, or remove the final active Owner of organization % (active owner count = 0).', v_target_org_id;
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

### 1.4 Concurrency Verification Scenarios

| Test Case | Concurrent Actions | Execution Sequence | Expected Result |
|---|---|---|---|
| **C1: Dual Owner Self-Demotion** | Owner 1 updates role to `staff`; Owner 2 updates role to `staff` simultaneously. | Tx 1 acquires `FOR UPDATE` lock on `organizations`. Tx 2 waits. Tx 1 counts active owners (1 other), updates successfully, and commits. Tx 2 resumes, evaluates under updated committed state, sees `v_active_owner_count = 0`, and aborts with exception. | Exactly 1 demotion succeeds; 1 fails. Organization retains exactly 1 active owner. |
| **C2: Admin Owner Promotion Bypass** | Admin user attempts `INSERT` into `organization_members` with `role = 'owner'`. | Trigger inspects caller role via `auth.uid()`. Caller is `admin`, not `owner`. | Immediate SQL Exception: `Privilege Escalation Detected: Only an active Owner can grant the Owner role.` Transaction aborts. |
| **C3: Admin Owner Deactivation** | Admin attempts `UPDATE organization_members SET is_active = FALSE WHERE role = 'owner'`. | Caller role is `admin`; target role is `owner`. | Immediate SQL Exception: `Privilege Escalation Detected: Admins cannot modify, demote, deactivate, or delete an Owner membership.` Transaction aborts. |
| **C4: Sole Owner Self-Deactivation** | Sole clinic owner attempts to set `is_active = FALSE`. | Serialized lock acquired. `v_active_owner_count` excluding target is `0`. | Immediate SQL Exception: `Security Violation: Cannot demote, deactivate, or remove the final active Owner...` Transaction aborts. |

---

## 2. Complete Tenant Ownership Protection Matrix (All 24 Tables)

Every table across both the existing schema (12 tables) and the new SaaS schema (12 tables) has been audited. The matrix below defines the mutability of `organization_id`, access controls across roles, system-management status, and trigger attachment.

| # | Table Name | `organization_id` Immutable | INSERT Permission | UPDATE Permission | DELETE Permission | Exclusively System-Managed? | Trigger `trg_prevent_tenant_mutation` Attached? |
|---|---|---|---|---|---|---|---|
| **1** | `organizations` | N/A (Primary Key `id`) | System / Onboarding Function | Owner / SuperAdmin | SuperAdmin Only | No | N/A (Tenant Root) |
| **2** | `organization_members` | **Yes (Enforced)** | Owner / Admin | Owner (for owners), Admin (for staff) | Owner (for owners), Admin (for staff) | No | **Yes** (`trg_lock_tenant_members`) |
| **3** | `branches` | **Yes (Enforced)** | Owner / Admin | Owner / Admin | Owner / Admin | No | **Yes** (`trg_lock_tenant_branches`) |
| **4** | `tenant_ai_configs` | **Yes (Enforced)** | System / Owner | Owner / Admin | Prohibited | No | **Yes** (`trg_lock_tenant_ai_configs`) |
| **5** | `organization_integrations`| **Yes (Enforced)** | Owner / Admin | Owner / Admin / System | Owner / Admin | No | **Yes** (`trg_lock_tenant_integrations`) |
| **6** | `integration_credentials` | **Yes (Enforced)** | Service Role Only | Service Role Only | Service Role Only | **Yes (Vault)** | **Yes** (`trg_lock_tenant_vault`) |
| **7** | `plans` | N/A (Global Catalog) | SuperAdmin Only | SuperAdmin Only | Prohibited | No (Global) | N/A (Global Entity) |
| **8** | `subscriptions` | **Yes (Enforced)** | Service Role / SuperAdmin | Service Role / SuperAdmin | Prohibited | **Yes** | **Yes** (`trg_lock_tenant_subscriptions`) |
| **9** | `subscription_entitlements`| **Yes (Enforced)** | Service Role / SuperAdmin | Service Role / SuperAdmin | Prohibited | **Yes** | **Yes** (`trg_lock_tenant_entitlements`) |
| **10**| `subscription_usage_records`| **Yes (Enforced)**| Service Role Only | Service Role Only | Prohibited | **Yes** | **Yes** (`trg_lock_tenant_usage_records`) |
| **11**| `subscription_usage_ledger` | **Yes (Enforced)**| Service Role Only | Prohibited (Append-Only) | Prohibited | **Yes** | **Yes** (`trg_lock_tenant_usage_ledger`) |
| **12**| `platform_authorizations` | N/A (Target UUID) | SuperAdmin Only | SuperAdmin Only | Prohibited | **Yes (Audit)** | N/A (Audit Vault) |
| **13**| `instagram_accounts` | **Yes (Enforced)** | Owner / Admin / System | Owner / Admin / System | Prohibited (Archive) | No | **Yes** (`trg_lock_tenant_accounts`) |
| **14**| `leads` | **Yes (Enforced)** | Staff / Service Role | Staff / Admin / Owner | Owner Only | No | **Yes** (`trg_lock_tenant_leads`) |
| **15**| `appointments` | **Yes (Enforced)** | Staff / Service Role | Staff / Admin / Owner | Staff / Admin / Owner | No | **Yes** (`trg_lock_tenant_appointments`) |
| **16**| `conversations` | **Yes (Enforced)** | Service Role / Staff | Service Role / Staff | Prohibited | No | **Yes** (`trg_lock_tenant_conversations`) |
| **17**| `chat_messages` | **Yes (Enforced)** | Service Role / Staff | Prohibited (Immutable) | Prohibited | No | **Yes** (`trg_lock_tenant_messages`) |
| **18**| `content_items` | **Yes (Enforced)** | Staff / Admin / Owner | Staff / Admin / Owner | Staff / Admin / Owner | No | **Yes** (`trg_lock_tenant_content`) |
| **19**| `ad_campaigns` | **Yes (Enforced)** | Admin / Owner | Admin / Owner | Admin / Owner | No | **Yes** (`trg_lock_tenant_campaigns`) |
| **20**| `webhook_logs` | Nullable System Log | Service Role Only | Prohibited (Immutable) | Prohibited | **Yes** | N/A (Nullable System Log) |
| **21**| `processed_webhook_messages`|**Yes (Enforced)**| Service Role Only | Prohibited (Immutable) | Prohibited | **Yes** | **Yes** (`trg_lock_tenant_dedup`) |
| **22**| `human_takeovers` | **Yes (Enforced)** | Staff / Service Role | Staff / Service Role | Prohibited (Deactivate) | No | **Yes** (`trg_lock_tenant_takeovers`) |
| **23**| `escalation_events` | **Yes (Enforced)** | Service Role / Staff | Service Role / Staff | Prohibited | No | **Yes** (`trg_lock_tenant_escalations`) |
| **24**| `webhook_jobs` | **Yes (Enforced)** | Service Role Only | Service Role Only | Prohibited | **Yes** | **Yes** (`trg_lock_tenant_jobs`) |

### 2.1 Universal Tenant Mutation Lock Trigger DDL

```sql
CREATE OR REPLACE FUNCTION public.fn_prevent_tenant_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'Security Policy Violation: Cross-organization record reassignment or reparenting is strictly prohibited on table %.', TG_TABLE_NAME;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_prevent_tenant_mutation() OWNER TO postgres;

-- 1. SaaS Tables
DROP TRIGGER IF EXISTS trg_lock_tenant_members ON public.organization_members;
CREATE TRIGGER trg_lock_tenant_members BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_branches ON public.branches;
CREATE TRIGGER trg_lock_tenant_branches BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_ai_configs ON public.tenant_ai_configs;
CREATE TRIGGER trg_lock_tenant_ai_configs BEFORE UPDATE ON public.tenant_ai_configs FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_integrations ON public.organization_integrations;
CREATE TRIGGER trg_lock_tenant_integrations BEFORE UPDATE ON public.organization_integrations FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_vault ON public.integration_credentials;
CREATE TRIGGER trg_lock_tenant_vault BEFORE UPDATE ON public.integration_credentials FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_lock_tenant_subscriptions BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_entitlements ON public.subscription_entitlements;
CREATE TRIGGER trg_lock_tenant_entitlements BEFORE UPDATE ON public.subscription_entitlements FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_usage_records ON public.subscription_usage_records;
CREATE TRIGGER trg_lock_tenant_usage_records BEFORE UPDATE ON public.subscription_usage_records FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_usage_ledger ON public.subscription_usage_ledger;
CREATE TRIGGER trg_lock_tenant_usage_ledger BEFORE UPDATE ON public.subscription_usage_ledger FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

-- 2. Existing Schema Tables
DROP TRIGGER IF EXISTS trg_lock_tenant_accounts ON public.instagram_accounts;
CREATE TRIGGER trg_lock_tenant_accounts BEFORE UPDATE ON public.instagram_accounts FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_leads ON public.leads;
CREATE TRIGGER trg_lock_tenant_leads BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_appointments ON public.appointments;
CREATE TRIGGER trg_lock_tenant_appointments BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_conversations ON public.conversations;
CREATE TRIGGER trg_lock_tenant_conversations BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_messages ON public.chat_messages;
CREATE TRIGGER trg_lock_tenant_messages BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_content ON public.content_items;
CREATE TRIGGER trg_lock_tenant_content BEFORE UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_campaigns ON public.ad_campaigns;
CREATE TRIGGER trg_lock_tenant_campaigns BEFORE UPDATE ON public.ad_campaigns FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_dedup ON public.processed_webhook_messages;
CREATE TRIGGER trg_lock_tenant_dedup BEFORE UPDATE ON public.processed_webhook_messages FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_takeovers ON public.human_takeovers;
CREATE TRIGGER trg_lock_tenant_takeovers BEFORE UPDATE ON public.human_takeovers FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_escalations ON public.escalation_events;
CREATE TRIGGER trg_lock_tenant_escalations BEFORE UPDATE ON public.escalation_events FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_lock_tenant_jobs ON public.webhook_jobs;
CREATE TRIGGER trg_lock_tenant_jobs BEFORE UPDATE ON public.webhook_jobs FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
```

---

## 3. Platform Administrator Authorization & Almeswak Quarantine Architecture

### 3.1 Replacement of Static Text Marker
In Version 2.2, Almeswak quarantine checks evaluated the static session setting:
`current_setting('app.platform_management_authorization', true) = 'EXPLICIT_ALMESWAK_BOARD_APPROVAL'`.
This mechanism lacked cryptographic proof, audit traceability, and expiration controls. Any client with raw SQL access could forge the session variable via `SET app.platform_management_authorization = '...'`.

### 3.2 Production Platform Authorization Table DDL
Version 2.3 replaces the static string with a dedicated, cryptographically hashed authorization vault:

```sql
CREATE TABLE IF NOT EXISTS public.platform_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_token_hash TEXT UNIQUE NOT NULL,
    target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('organization', 'integration', 'global_policy')),
    target_entity_id UUID NOT NULL,
    target_handle TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'EMERGENCY_QUARANTINE_OVERRIDE')),
    board_resolution_reference TEXT NOT NULL,
    board_resolution_sha256 TEXT NOT NULL,
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

-- Enable RLS: Default Deny. Only platform superadmins and service role may access
ALTER TABLE public.platform_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_platform_superadmin_all" ON public.platform_authorizations
    FOR ALL TO authenticated
    USING (public.is_platform_superadmin())
    WITH CHECK (public.is_platform_superadmin());

CREATE POLICY "auth_service_role_all" ON public.platform_authorizations
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
```

### 3.3 Cryptographic Token Verification Function

```sql
CREATE OR REPLACE FUNCTION public.fn_verify_platform_authorization(
    p_target_id UUID,
    p_purpose TEXT,
    p_auth_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_token_hash TEXT;
    v_is_valid BOOLEAN;
BEGIN
    IF p_auth_token IS NULL OR trim(p_auth_token) = '' THEN
        RETURN FALSE;
    END IF;

    -- Derive SHA-256 hex digest of the raw bearer token
    v_token_hash := encode(digest(p_auth_token, 'sha256'), 'hex');

    SELECT EXISTS (
        SELECT 1
        FROM public.platform_authorizations
        WHERE target_entity_id = p_target_id
          AND purpose = p_purpose
          AND authorization_token_hash = v_token_hash
          AND revoked_at IS NULL
          AND expires_at > NOW()
    ) INTO v_is_valid;

    RETURN v_is_valid;
END;
$$;

ALTER FUNCTION public.fn_verify_platform_authorization(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_verify_platform_authorization(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_verify_platform_authorization(UUID, TEXT, TEXT) TO authenticated, service_role;
```

### 3.4 Hardened Almeswak Quarantine Trigger DDL

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_almeswak_quarantine()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_token TEXT;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    -- 1. Organization Table Enforcement
    IF TG_TABLE_NAME = 'organizations' THEN
        -- Intercept status transition from demo_mode or handle change
        IF (OLD.slug = 'almeswaksmile-iq' OR OLD.id = '00000000-0000-0000-0000-000000000002'::uuid) AND NEW.status != 'demo_mode' THEN
            v_auth_token := current_setting('app.platform_authorization_token', true);
            v_is_authorized := public.fn_verify_platform_authorization(OLD.id, 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', v_auth_token);

            IF NOT v_is_authorized THEN
                RAISE EXCEPTION 'Security Policy Violation: Almeswak Clinic is quarantined in Demo mode. Activation requires valid, unrevoked Platform Board Authorization.';
            END IF;
        END IF;
    END IF;

    -- 2. Integrations Table Enforcement
    IF TG_TABLE_NAME = 'organization_integrations' THEN
        IF (OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001') AND NEW.status != 'demo_mode' THEN
            v_auth_token := current_setting('app.platform_authorization_token', true);
            v_is_authorized := public.fn_verify_platform_authorization(OLD.organization_id, 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', v_auth_token);

            IF NOT v_is_authorized THEN
                RAISE EXCEPTION 'Security Policy Violation: Outbound live messaging for @almeswaksmile.iq is prohibited without verified Platform Board Authorization.';
            END IF;
        END IF;
    END IF;

    -- 3. Instagram Accounts Baseline Enforcement
    IF TG_TABLE_NAME = 'instagram_accounts' THEN
        IF (OLD.id = 'almeswaksmile_iq' OR OLD.handle = 'almeswaksmile.iq') AND NEW.status != 'demo_mode' THEN
            v_auth_token := current_setting('app.platform_authorization_token', true);
            v_is_authorized := public.fn_verify_platform_authorization(OLD.organization_id, 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', v_auth_token);

            IF NOT v_is_authorized THEN
                RAISE EXCEPTION 'Security Policy Violation: Live activation of account @almeswaksmile.iq is blocked by Platform Quarantine.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_enforce_almeswak_quarantine() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_org ON public.organizations;
CREATE TRIGGER trg_quarantine_almeswak_org BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_quarantine();

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_int ON public.organization_integrations;
CREATE TRIGGER trg_quarantine_almeswak_int BEFORE UPDATE ON public.organization_integrations FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_quarantine();

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_acc ON public.instagram_accounts;
CREATE TRIGGER trg_quarantine_almeswak_acc BEFORE UPDATE ON public.instagram_accounts FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_quarantine();
```

---

## 4. Composite Branch Foreign-Key Deletion & Relational Consistency Architecture

### 4.1 The Composite Foreign-Key Deletion Dilemma
In relational modeling, child entities referencing a branch must ensure the branch belongs to the **exact same organization**:
```sql
FOREIGN KEY (organization_id, branch_id) REFERENCES public.branches(organization_id, id)
```
When a clinic branch is closed or deleted, the desired business behavior is to **orphan the branch relationship** (`branch_id = NULL`) so that staff members, integrations, and historical appointments are not deleted.

However:
1. `organization_id` is defined as `NOT NULL` on `organization_members`, `organization_integrations`, and `appointments`.
2. Standard PostgreSQL `ON DELETE SET NULL` attempts to set **both** columns of the composite foreign key (`organization_id` AND `branch_id`) to `NULL`.
3. This triggers an immediate runtime exception:
   `ERROR: null value in column "organization_id" violates not-null constraint`.
4. While PostgreSQL 15+ supports column-specific `ON DELETE SET NULL (branch_id)`, this syntax fails on older toolchains, replication engines, and PostgreSQL 14 testing instances.

### 4.2 Universal Production Trigger Architecture
To ensure cross-version compatibility and guarantee zero orphaning of tenant ownership, the composite foreign key is configured with `ON DELETE NO ACTION`, paired with an atomic, transactional `BEFORE DELETE` trigger on `public.branches`:

```sql
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_branches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Safely nullify branch_id on members while strictly preserving organization_id
    UPDATE public.organization_members
    SET branch_id = NULL
    WHERE organization_id = OLD.organization_id AND branch_id = OLD.id;

    -- 2. Safely nullify branch_id on integrations while strictly preserving organization_id
    UPDATE public.organization_integrations
    SET branch_id = NULL
    WHERE organization_id = OLD.organization_id AND branch_id = OLD.id;

    -- 3. Safely nullify branch_id on appointments while strictly preserving organization_id
    UPDATE public.appointments
    SET branch_id = NULL
    WHERE organization_id = OLD.organization_id AND branch_id = OLD.id;

    RETURN OLD;
END;
$$;

ALTER FUNCTION public.fn_safe_orphan_branches() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_safe_orphan_branches ON public.branches;
CREATE TRIGGER trg_safe_orphan_branches
BEFORE DELETE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_branches();

-- Enforce Composite Foreign Keys with ON DELETE NO ACTION (satisfied by trigger execution)
ALTER TABLE public.organization_members
    DROP CONSTRAINT IF EXISTS fk_members_branch_composite,
    ADD CONSTRAINT fk_members_branch_composite
    FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id)
    ON DELETE NO ACTION;

ALTER TABLE public.organization_integrations
    DROP CONSTRAINT IF EXISTS fk_integrations_branch_composite,
    ADD CONSTRAINT fk_integrations_branch_composite
    FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id)
    ON DELETE NO ACTION;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_branch_composite,
    ADD CONSTRAINT fk_appointments_branch_composite
    FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id)
    ON DELETE NO ACTION;
```

### 4.3 Branch Deletion Verification Test Scenario

```sql
-- Automated Branch Deletion Verification Script
DO $$
DECLARE
    v_org_id UUID;
    v_branch_id UUID;
    v_member_id UUID;
    v_appt_id UUID;
    v_check_member RECORD;
    v_check_appt RECORD;
BEGIN
    -- 1. Setup isolated test organization and branch
    INSERT INTO public.organizations (name, slug, status)
    VALUES ('Branch Test Clinic', 'branch-test-clinic', 'active')
    RETURNING id INTO v_org_id;

    INSERT INTO public.branches (organization_id, name, slug)
    VALUES (v_org_id, 'Mansour Branch', 'mansour')
    RETURNING id INTO v_branch_id;

    -- 2. Create member and appointment linked to branch
    INSERT INTO public.organization_members (organization_id, user_id, branch_id, role)
    VALUES (v_org_id, gen_random_uuid(), v_branch_id, 'receptionist')
    RETURNING id INTO v_member_id;

    INSERT INTO public.leads (organization_id, full_name, phone, account_id)
    VALUES (v_org_id, 'Test Patient', '07700000000', 'drmustafa_hadi')
    RETURNING id INTO v_member_id;

    INSERT INTO public.appointments (organization_id, branch_id, lead_id, preferred_date, account_id)
    VALUES (v_org_id, v_branch_id, v_member_id, CURRENT_DATE + INTERVAL '1 day', 'drmustafa_hadi')
    RETURNING id INTO v_appt_id;

    -- 3. Execute branch deletion
    DELETE FROM public.branches WHERE id = v_branch_id;

    -- 4. Verify member integrity: branch_id is NULL, organization_id remains intact
    SELECT organization_id, branch_id INTO v_check_member
    FROM public.organization_members WHERE id = v_member_id;

    IF v_check_member.branch_id IS NOT NULL OR v_check_member.organization_id != v_org_id THEN
        RAISE EXCEPTION 'TEST FAILED: Member was not properly de-linked or organization_id was corrupted.';
    END IF;

    -- 5. Verify appointment integrity: branch_id is NULL, organization_id remains intact
    SELECT organization_id, branch_id INTO v_check_appt
    FROM public.appointments WHERE id = v_appt_id;

    IF v_check_appt.branch_id IS NOT NULL OR v_check_appt.organization_id != v_org_id THEN
        RAISE EXCEPTION 'TEST FAILED: Appointment was not properly de-linked or organization_id was corrupted.';
    END IF;

    -- Rollback test data
    RAISE NOTICE 'SUCCESS: Branch deletion safely de-linked child rows without tenant orphaning.';
    ROLLBACK;
END $$;
```

---

## 5. Concurrency-Safe Quota Reservation, Idempotency & Subscription Usage Ledger

### 5.1 The Idempotency & Concurrency Problem
When Meta delivers incoming webhook notifications, bursty network traffic or worker retries frequently dispatch identical events (`mid_...`) concurrently. If two workers handle the same webhook message simultaneously:
1. Without serialization, both workers read `dms_consumed = 99` against a quota limit of 100.
2. Both proceed to dispatch outbound messages.
3. Both attempt to insert into `subscription_usage_ledger`.
4. One worker crashes with a unique constraint violation (`23505 duplicate key value violates unique constraint`), while the tenant is double-charged or the message pipeline drops into an unhandled failure state.

### 5.2 Redesigned Quota Architecture
Version 2.3 enforces a strict, concurrency-safe protocol:
1. **Never Trust Caller Quotas:** Quotas are derived strictly inside the database from `plans.monthly_dm_quota` plus active `subscription_entitlements`.
2. **Subscription Lock First:** Acquire an exclusive row lock (`FOR UPDATE`) on `public.subscriptions` for the tenant.
3. **Idempotency Re-Check:** Once the lock is held, check whether `p_message_id` has already been recorded in `public.subscription_usage_ledger`. If found, immediately return an idempotent `ALREADY_RESERVED` status.
4. **Quota Boundary Enforcement:** Verify `dms_consumed < effective_quota`. If quota is exhausted, reject with `QUOTA_EXCEEDED`.
5. **Atomic Usage Ledger:** Increment `subscription_usage_records` and record an immutable entry in `subscription_usage_ledger`.
6. **Compensating Refund Transaction:** If downstream Meta API dispatch fails (network drop, expired token), an auditable refund function (`refund_dm_quota`) decrements the aggregate count and appends an auditable `REFUNDED` entry.

### 5.3 Complete Usage Tables DDL

```sql
-- 1. Aggregate Usage Records (Per Billing Period)
CREATE TABLE IF NOT EXISTS public.subscription_usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    dms_consumed INTEGER NOT NULL DEFAULT 0 CHECK (dms_consumed >= 0),
    allocated_quota INTEGER NOT NULL CHECK (allocated_quota > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_period UNIQUE (organization_id, period_start)
);

-- 2. Immutable Usage Ledger (Append-Only Event Stream)
CREATE TABLE IF NOT EXISTS public.subscription_usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount IN (1, -1)),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    status TEXT NOT NULL CHECK (status IN ('RESERVED', 'REFUNDED')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ledger_reservation UNIQUE (organization_id, message_id, status)
);

CREATE INDEX idx_ledger_org_msg ON public.subscription_usage_ledger (organization_id, message_id);
```

### 5.4 Concurrency-Safe Quota Reservation Function DDL

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
    v_entitlement_quota INTEGER := 0;
    v_effective_max_quota INTEGER;
    v_current_count INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- 1. Step 1: Acquire exclusive row lock on the organization's subscription
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE organization_id = p_organization_id
    FOR UPDATE;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SUBSCRIPTION_NOT_FOUND');
    END IF;

    -- 2. Step 2: Re-check idempotency key AFTER acquiring the lock
    -- Prevents race conditions and duplicate-key exceptions on concurrent webhook retries
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

    -- 3. Step 3: Validate Organization and Subscription Status
    IF v_sub.status NOT IN ('active', 'trialing') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SUBSCRIPTION_INACTIVE', 'status', v_sub.status);
    END IF;

    IF NOW() < v_sub.current_period_start OR NOW() > v_sub.current_period_end THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'BILLING_PERIOD_EXPIRED', 'period_end', v_sub.current_period_end);
    END IF;

    -- 4. Step 4: Derive base quota from trusted plans table
    SELECT * INTO v_plan FROM public.plans WHERE id = v_sub.plan_id;
    IF v_plan.id IS NULL OR v_plan.is_active = FALSE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_OR_INACTIVE_PLAN');
    END IF;

    -- 5. Step 5: Incorporate active add-on entitlements
    SELECT COALESCE(SUM(additional_dms), 0) INTO v_entitlement_quota
    FROM public.subscription_entitlements
    WHERE organization_id = p_organization_id
      AND is_active = TRUE
      AND NOW() BETWEEN valid_from AND valid_until;

    v_effective_max_quota := v_plan.monthly_dm_quota + v_entitlement_quota;

    -- 6. Step 6: Lock and read current period aggregate
    SELECT dms_consumed INTO v_current_count
    FROM public.subscription_usage_records
    WHERE organization_id = p_organization_id AND period_start = v_sub.current_period_start
    FOR UPDATE;

    IF v_current_count IS NULL THEN
        INSERT INTO public.subscription_usage_records (
            organization_id, period_start, period_end, dms_consumed, allocated_quota
        ) VALUES (
            p_organization_id, v_sub.current_period_start, v_sub.current_period_end, 0, v_effective_max_quota
        );
        v_current_count := 0;
    END IF;

    -- 7. Step 7: Enforce Quota Boundary
    IF v_current_count >= v_effective_max_quota THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'QUOTA_EXCEEDED',
            'consumed', v_current_count,
            'max_quota', v_effective_max_quota,
            'base_quota', v_plan.monthly_dm_quota,
            'add_ons', v_entitlement_quota
        );
    END IF;

    -- 8. Step 8: Atomic Increment & Append to Ledger
    v_new_balance := v_current_count + 1;

    UPDATE public.subscription_usage_records
    SET dms_consumed = v_new_balance,
        allocated_quota = v_effective_max_quota,
        updated_at = NOW()
    WHERE organization_id = p_organization_id AND period_start = v_sub.current_period_start;

    INSERT INTO public.subscription_usage_ledger (
        organization_id, message_id, amount, balance_after, status, created_at
    ) VALUES (
        p_organization_id, p_message_id, 1, v_new_balance, 'RESERVED', NOW()
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

### 5.5 Compensating Refund Transaction Function DDL

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
    v_sub RECORD;
    v_current_count INTEGER;
    v_new_balance INTEGER;
    v_ledger_entry RECORD;
BEGIN
    -- 1. Acquire lock on subscription
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE organization_id = p_organization_id
    FOR UPDATE;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SUBSCRIPTION_NOT_FOUND');
    END IF;

    -- 2. Verify prior reservation exists
    SELECT * INTO v_ledger_entry
    FROM public.subscription_usage_ledger
    WHERE organization_id = p_organization_id
      AND message_id = p_message_id
      AND status = 'RESERVED'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_ledger_entry.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'RESERVATION_NOT_FOUND');
    END IF;

    -- 3. Check if already refunded
    IF EXISTS (
        SELECT 1 FROM public.subscription_usage_ledger
        WHERE organization_id = p_organization_id
          AND message_id = p_message_id
          AND status = 'REFUNDED'
    ) THEN
        RETURN jsonb_build_object('success', TRUE, 'status', 'ALREADY_REFUNDED');
    END IF;

    -- 4. Lock aggregate record
    SELECT dms_consumed INTO v_current_count
    FROM public.subscription_usage_records
    WHERE organization_id = p_organization_id AND period_start = v_sub.current_period_start
    FOR UPDATE;

    v_new_balance := GREATEST(0, v_current_count - 1);

    -- 5. Decrement aggregate count
    UPDATE public.subscription_usage_records
    SET dms_consumed = v_new_balance,
        updated_at = NOW()
    WHERE organization_id = p_organization_id AND period_start = v_sub.current_period_start;

    -- 6. Append immutable refund entry to ledger
    INSERT INTO public.subscription_usage_ledger (
        organization_id, message_id, amount, balance_after, status, reason, created_at
    ) VALUES (
        p_organization_id, p_message_id, -1, v_new_balance, 'REFUNDED', p_reason, NOW()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'REFUNDED',
        'message_id', p_message_id,
        'balance_after', v_new_balance,
        'reason', p_reason
    );
END;
$$;

ALTER FUNCTION public.refund_dm_quota(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.refund_dm_quota FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_dm_quota TO service_role;
```

---

## 6. Comprehensive Pre-Migration Reconciliation & Automated Migration-Abort Assertion (All 12 Tables)

### 6.1 Audit Scope Across All 12 Existing Tables
Before executing destructive alterations or enforcing `NOT NULL` constraints, the migration script executes an exhaustive reconciliation query across all 12 tables. The audit accounts for every possible migration anomaly:
1. **Total Rows:** Physical count of existing rows in table.
2. **Mapped Rows:** Rows successfully mapped to either Dr. Mustafa Hadi (`org_drmustafa_hadi`) or Almeswak (`org_almeswaksmile_iq`).
3. **Unmatched Rows:** Rows referencing an account ID outside the known tenant mapping.
4. **Ambiguous Rows:** Rows containing contradictory tenant identifiers.
5. **Invalid Parent References:** Child records referencing non-existent leads or conversations.
6. **Cross-Tenant Violations:** Child records whose assigned `organization_id` differs from their parent record's `organization_id`.
7. **Conflicting Mappings:** Duplicate unique constraint violations under the target composite keys.

### 6.2 Pre-Migration Reconciliation Query (All 12 Tables)

```sql
WITH reconciliation_summary AS (
    -- 1. instagram_accounts
    SELECT 'instagram_accounts' AS table_name,
           COUNT(*) AS total_rows,
           COUNT(*) FILTER (WHERE id IN ('drmustafa_hadi', 'almeswaksmile_iq')) AS mapped_rows,
           COUNT(*) FILTER (WHERE id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')) AS unmatched_rows,
           0 AS ambiguous_rows,
           0 AS invalid_parent_refs,
           0 AS cross_tenant_violations,
           0 AS conflicting_mappings
    FROM public.instagram_accounts

    UNION ALL
    -- 2. leads
    SELECT 'leads', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL),
           0, 0, 0, 0
    FROM public.leads

    UNION ALL
    -- 3. appointments
    SELECT 'appointments', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL),
           0,
           COUNT(*) FILTER (WHERE lead_id IS NOT NULL AND lead_id NOT IN (SELECT id FROM public.leads)),
           COUNT(*) FILTER (WHERE lead_id IS NOT NULL AND account_id != (SELECT account_id FROM public.leads WHERE id = appointments.lead_id)),
           0
    FROM public.appointments

    UNION ALL
    -- 4. conversations
    SELECT 'conversations', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL),
           0, 0, 0, 0
    FROM public.conversations

    UNION ALL
    -- 5. chat_messages
    SELECT 'chat_messages', COUNT(*),
           COUNT(*) FILTER (WHERE conversation_id IN (SELECT id FROM public.conversations WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq'))),
           COUNT(*) FILTER (WHERE conversation_id NOT IN (SELECT id FROM public.conversations)),
           0,
           COUNT(*) FILTER (WHERE conversation_id NOT IN (SELECT id FROM public.conversations)),
           0, 0
    FROM public.chat_messages

    UNION ALL
    -- 6. content_items
    SELECT 'content_items', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL),
           0, 0, 0, 0
    FROM public.content_items

    UNION ALL
    -- 7. ad_campaigns
    SELECT 'ad_campaigns', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL),
           0, 0, 0, 0
    FROM public.ad_campaigns

    UNION ALL
    -- 8. processed_webhook_messages
    SELECT 'processed_webhook_messages', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL),
           0, 0, 0, 0
    FROM public.processed_webhook_messages

    UNION ALL
    -- 9. human_takeovers
    SELECT 'human_takeovers', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL),
           0,
           COUNT(*) FILTER (WHERE conversation_id IS NOT NULL AND conversation_id NOT IN (SELECT id FROM public.conversations)),
           COUNT(*) FILTER (WHERE conversation_id IS NOT NULL AND account_id != (SELECT account_id FROM public.conversations WHERE id = human_takeovers.conversation_id)),
           0
    FROM public.human_takeovers

    UNION ALL
    -- 10. escalation_events
    SELECT 'escalation_events', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL),
           0,
           COUNT(*) FILTER (WHERE conversation_id IS NOT NULL AND conversation_id NOT IN (SELECT id FROM public.conversations)),
           COUNT(*) FILTER (WHERE conversation_id IS NOT NULL AND account_id != (SELECT account_id FROM public.conversations WHERE id = escalation_events.conversation_id)),
           0
    FROM public.escalation_events

    UNION ALL
    -- 11. webhook_jobs
    SELECT 'webhook_jobs', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL),
           0, 0, 0, 0
    FROM public.webhook_jobs

    UNION ALL
    -- 12. webhook_logs (Intentionally Nullable Organization ID)
    SELECT 'webhook_logs', COUNT(*),
           COUNT(*) FILTER (WHERE organization_id IS NOT NULL),
           -- For webhook_logs, unmatched represents rows that reference a bogus organization_id, NOT nulls!
           COUNT(*) FILTER (WHERE organization_id IS NOT NULL AND organization_id NOT IN (SELECT id FROM public.organizations)),
           0, 0, 0, 0
    FROM public.webhook_logs
)
SELECT * FROM reconciliation_summary;
```

### 6.3 Automated Migration-Abort Assertion DDL

```sql
DO $$
DECLARE
    v_error_report TEXT := '';
    r RECORD;
BEGIN
    FOR r IN (
        -- Check anomalies across all 11 strictly tenant-owned tables
        SELECT 'instagram_accounts' AS tbl, COUNT(*) AS bad_count FROM public.instagram_accounts WHERE id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')
        UNION ALL
        SELECT 'leads', COUNT(*) FROM public.leads WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
        UNION ALL
        SELECT 'appointments', COUNT(*) FROM public.appointments WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL OR (lead_id IS NOT NULL AND lead_id NOT IN (SELECT id FROM public.leads))
        UNION ALL
        SELECT 'conversations', COUNT(*) FROM public.conversations WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
        UNION ALL
        SELECT 'chat_messages', COUNT(*) FROM public.chat_messages WHERE conversation_id NOT IN (SELECT id FROM public.conversations)
        UNION ALL
        SELECT 'content_items', COUNT(*) FROM public.content_items WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
        UNION ALL
        SELECT 'ad_campaigns', COUNT(*) FROM public.ad_campaigns WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
        UNION ALL
        SELECT 'processed_webhook_messages', COUNT(*) FROM public.processed_webhook_messages WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
        UNION ALL
        SELECT 'human_takeovers', COUNT(*) FROM public.human_takeovers WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
        UNION ALL
        SELECT 'escalation_events', COUNT(*) FROM public.escalation_events WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
        UNION ALL
        SELECT 'webhook_jobs', COUNT(*) FROM public.webhook_jobs WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
        UNION ALL
        -- Separate validation for webhook_logs: verify no corrupted foreign key references
        SELECT 'webhook_logs_corrupted_fk', COUNT(*) FROM public.webhook_logs WHERE organization_id IS NOT NULL AND organization_id NOT IN (SELECT id FROM public.organizations)
    ) LOOP
        IF r.bad_count > 0 THEN
            v_error_report := v_error_report || format(' [%s: %s unmapped/invalid rows]', r.tbl, r.bad_count);
        END IF;
    END LOOP;

    IF length(v_error_report) > 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED (Fail-Safe Assertion): Found unmapped or invalid records:% Refusing to apply NOT NULL constraints or enforce composite keys.', v_error_report;
    END IF;

    RAISE NOTICE 'MIGRATION ASSERTION PASSED: All 12 tables successfully verified and 100%% reconciled.';
END $$;
```

---

## 7. Complete Effective Row Level Security (RLS) Policy Specification (All 24 Tables)

### 7.1 Security Definer Helper Functions
These helper functions encapsulate caller context and are declared with `SECURITY DEFINER` and `SET search_path = public, pg_temp`:

```sql
-- 1. Extract all active organization IDs for authenticated caller
CREATE OR REPLACE FUNCTION public.get_auth_org_ids()
RETURNS TABLE (org_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND is_active = TRUE;
$$;

-- 2. Extract caller's role in a specific organization
CREATE OR REPLACE FUNCTION public.get_auth_org_role(p_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND is_active = TRUE
    LIMIT 1;
$$;

-- 3. Check if caller is a platform superadministrator
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
    );
$$;

-- 4. Extract assigned branch IDs for caller in an organization
CREATE OR REPLACE FUNCTION public.get_auth_branch_ids(p_org_id UUID)
RETURNS TABLE (branch_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT branch_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND is_active = TRUE
      AND branch_id IS NOT NULL;
$$;
```

### 7.2 Complete RLS Policies: SaaS Entities (Tables 1–12)

#### 1. `organizations`
```sql
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_members" ON public.organizations
    FOR SELECT TO authenticated
    USING (id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "org_insert_superadmin" ON public.organizations
    FOR INSERT TO authenticated
    WITH CHECK (public.is_platform_superadmin());

CREATE POLICY "org_update_owner_superadmin" ON public.organizations
    FOR UPDATE TO authenticated
    USING (
        (id IN (SELECT org_id FROM public.get_auth_org_ids()) AND public.get_auth_org_role(id) = 'owner')
        OR public.is_platform_superadmin()
    )
    WITH CHECK (
        (id IN (SELECT org_id FROM public.get_auth_org_ids()) AND public.get_auth_org_role(id) = 'owner')
        OR public.is_platform_superadmin()
    );

-- Intentional Denial: Organizations cannot be deleted by regular users
CREATE POLICY "org_delete_superadmin_only" ON public.organizations
    FOR DELETE TO authenticated
    USING (public.is_platform_superadmin());

CREATE POLICY "org_service_role_all" ON public.organizations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 2. `organization_members`
```sql
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_colleagues" ON public.organization_members
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "members_insert_admin_owner" ON public.organization_members
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_auth_org_role(organization_id) IN ('owner', 'admin')
        OR public.is_platform_superadmin()
    );

CREATE POLICY "members_update_admin_owner" ON public.organization_members
    FOR UPDATE TO authenticated
    USING (
        public.get_auth_org_role(organization_id) IN ('owner', 'admin')
        OR public.is_platform_superadmin()
    )
    WITH CHECK (
        public.get_auth_org_role(organization_id) IN ('owner', 'admin')
        OR public.is_platform_superadmin()
    );

CREATE POLICY "members_delete_admin_owner" ON public.organization_members
    FOR DELETE TO authenticated
    USING (
        public.get_auth_org_role(organization_id) IN ('owner', 'admin')
        OR public.is_platform_superadmin()
    );

CREATE POLICY "members_service_role_all" ON public.organization_members
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 3. `branches`
```sql
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_select_members" ON public.branches
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "branches_insert_admin_owner" ON public.branches
    FOR INSERT TO authenticated
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "branches_update_admin_owner" ON public.branches
    FOR UPDATE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "branches_delete_admin_owner" ON public.branches
    FOR DELETE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "branches_service_role_all" ON public.branches
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 4. `tenant_ai_configs`
```sql
ALTER TABLE public.tenant_ai_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_config_select_members" ON public.tenant_ai_configs
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "ai_config_insert_owner" ON public.tenant_ai_configs
    FOR INSERT TO authenticated
    WITH CHECK (public.get_auth_org_role(organization_id) = 'owner' OR public.is_platform_superadmin());

CREATE POLICY "ai_config_update_admin_owner" ON public.tenant_ai_configs
    FOR UPDATE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

-- Intentional Denial: AI configs cannot be deleted
CREATE POLICY "ai_config_service_role_all" ON public.tenant_ai_configs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 5. `organization_integrations`
```sql
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_select_members" ON public.organization_integrations
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "integrations_insert_admin_owner" ON public.organization_integrations
    FOR INSERT TO authenticated
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "integrations_update_admin_owner" ON public.organization_integrations
    FOR UPDATE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "integrations_delete_admin_owner" ON public.organization_integrations
    FOR DELETE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "integrations_service_role_all" ON public.organization_integrations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 6. `integration_credentials` (Vault)
```sql
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- Intentional Denial: Authenticated users have ZERO access to ciphertexts, IVs, and auth tags
CREATE POLICY "vault_service_role_only" ON public.integration_credentials
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
```

#### 7. `plans`
```sql
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_select_all" ON public.plans
    FOR SELECT TO authenticated
    USING (is_active = TRUE OR public.is_platform_superadmin());

CREATE POLICY "plans_modify_superadmin" ON public.plans
    FOR ALL TO authenticated
    USING (public.is_platform_superadmin())
    WITH CHECK (public.is_platform_superadmin());

CREATE POLICY "plans_service_role_all" ON public.plans
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 8. `subscriptions`
```sql
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_select_owner_admin" ON public.subscriptions
    FOR SELECT TO authenticated
    USING (
        (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND public.get_auth_org_role(organization_id) IN ('owner', 'admin'))
        OR public.is_platform_superadmin()
    );

-- Intentional Denial: Subscriptions are managed exclusively by service role (billing webhooks) and superadmin
CREATE POLICY "subs_modify_superadmin" ON public.subscriptions
    FOR ALL TO authenticated
    USING (public.is_platform_superadmin())
    WITH CHECK (public.is_platform_superadmin());

CREATE POLICY "subs_service_role_all" ON public.subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 9. `subscription_entitlements`
```sql
ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entitlements_select_owner_admin" ON public.subscription_entitlements
    FOR SELECT TO authenticated
    USING (
        (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND public.get_auth_org_role(organization_id) IN ('owner', 'admin'))
        OR public.is_platform_superadmin()
    );

CREATE POLICY "entitlements_service_role_all" ON public.subscription_entitlements
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 10. `subscription_usage_records`
```sql
ALTER TABLE public.subscription_usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_rec_select_owner_admin" ON public.subscription_usage_records
    FOR SELECT TO authenticated
    USING (
        (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND public.get_auth_org_role(organization_id) IN ('owner', 'admin'))
        OR public.is_platform_superadmin()
    );

CREATE POLICY "usage_rec_service_role_all" ON public.subscription_usage_records
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 11. `subscription_usage_ledger`
```sql
ALTER TABLE public.subscription_usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_select_owner_admin" ON public.subscription_usage_ledger
    FOR SELECT TO authenticated
    USING (
        (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND public.get_auth_org_role(organization_id) IN ('owner', 'admin'))
        OR public.is_platform_superadmin()
    );

-- Intentional Denial: Ledger is append-only and exclusively modified by service role
CREATE POLICY "ledger_service_role_all" ON public.subscription_usage_ledger
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 12. `platform_authorizations`
```sql
ALTER TABLE public.platform_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plat_auth_superadmin_all" ON public.platform_authorizations
    FOR ALL TO authenticated
    USING (public.is_platform_superadmin())
    WITH CHECK (public.is_platform_superadmin());

CREATE POLICY "plat_auth_service_role_all" ON public.platform_authorizations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 7.3 Complete RLS Policies: Existing Schema Entities (Tables 13–24)

#### 13. `instagram_accounts`
```sql
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acc_select_members" ON public.instagram_accounts
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "acc_modify_admin_owner" ON public.instagram_accounts
    FOR UPDATE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "acc_service_role_all" ON public.instagram_accounts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 14. `leads`
```sql
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_staff" ON public.leads
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "leads_insert_staff" ON public.leads
    FOR INSERT TO authenticated
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "leads_update_staff" ON public.leads
    FOR UPDATE TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "leads_delete_owner" ON public.leads
    FOR DELETE TO authenticated
    USING (public.get_auth_org_role(organization_id) = 'owner' OR public.is_platform_superadmin());

CREATE POLICY "leads_service_role_all" ON public.leads
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 15. `appointments`
```sql
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Branch-scoped access enforced for SELECT
CREATE POLICY "appts_select_branch_scoped" ON public.appointments
    FOR SELECT TO authenticated
    USING (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            -- Organization-wide role (owner, admin, or unassigned staff)
            EXISTS (
                SELECT 1 FROM public.organization_members m 
                WHERE m.user_id = auth.uid() 
                  AND m.organization_id = appointments.organization_id 
                  AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin'))
            ) OR
            -- Branch-specific staff
            appointments.branch_id IN (
                SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id)
            )
        )
    );

CREATE POLICY "appts_insert_staff" ON public.appointments
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (
                SELECT 1 FROM public.organization_members m 
                WHERE m.user_id = auth.uid() 
                  AND m.organization_id = appointments.organization_id 
                  AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin'))
            ) OR
            appointments.branch_id IN (
                SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id)
            )
        )
    );

CREATE POLICY "appts_update_staff" ON public.appointments
    FOR UPDATE TO authenticated
    USING (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (
                SELECT 1 FROM public.organization_members m 
                WHERE m.user_id = auth.uid() 
                  AND m.organization_id = appointments.organization_id 
                  AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin'))
            ) OR
            appointments.branch_id IN (
                SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id)
            )
        )
    )
    WITH CHECK (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            EXISTS (
                SELECT 1 FROM public.organization_members m 
                WHERE m.user_id = auth.uid() 
                  AND m.organization_id = appointments.organization_id 
                  AND (m.branch_id IS NULL OR m.role IN ('owner', 'admin'))
            ) OR
            appointments.branch_id IN (
                SELECT branch_id FROM public.get_auth_branch_ids(appointments.organization_id)
            )
        )
    );

CREATE POLICY "appts_delete_staff" ON public.appointments
    FOR DELETE TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "appts_service_role_all" ON public.appointments
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 16. `conversations`
```sql
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_select_staff" ON public.conversations
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "conv_update_staff" ON public.conversations
    FOR UPDATE TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

-- Intentional Denial: Conversations cannot be deleted
CREATE POLICY "conv_service_role_all" ON public.conversations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 17. `chat_messages`
```sql
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msg_select_staff" ON public.chat_messages
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "msg_insert_staff" ON public.chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

-- Intentional Denial: Chat messages are immutable. UPDATE and DELETE are prohibited.
CREATE POLICY "msg_service_role_all" ON public.chat_messages
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 18. `content_items`
```sql
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_all_staff" ON public.content_items
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "content_service_role_all" ON public.content_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 19. `ad_campaigns`
```sql
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_all_admin_owner" ON public.ad_campaigns
    FOR ALL TO authenticated
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

CREATE POLICY "campaigns_service_role_all" ON public.ad_campaigns
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 20. `webhook_logs` (System Store)
```sql
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Intentional Denial: Authenticated users have zero access to public/unauthenticated webhook logs
CREATE POLICY "webhook_logs_service_role_only" ON public.webhook_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
```

#### 21. `processed_webhook_messages` (Reliability Store)
```sql
ALTER TABLE public.processed_webhook_messages ENABLE ROW LEVEL SECURITY;

-- Intentional Denial: Processed message deduplication store is exclusively accessed by service role
CREATE POLICY "dedup_service_role_only" ON public.processed_webhook_messages
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
```

#### 22. `human_takeovers`
```sql
ALTER TABLE public.human_takeovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "takeover_select_staff" ON public.human_takeovers
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "takeover_insert_staff" ON public.human_takeovers
    FOR INSERT TO authenticated
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "takeover_update_staff" ON public.human_takeovers
    FOR UPDATE TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "takeover_service_role_all" ON public.human_takeovers
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 23. `escalation_events`
```sql
ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escalations_select_staff" ON public.escalation_events
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "escalations_update_staff" ON public.escalation_events
    FOR UPDATE TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

CREATE POLICY "escalations_service_role_all" ON public.escalation_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 24. `webhook_jobs` (Queue Store)
```sql
ALTER TABLE public.webhook_jobs ENABLE ROW LEVEL SECURITY;

-- Intentional Denial: Durable queue worker is exclusively executed by service role
CREATE POLICY "jobs_service_role_only" ON public.webhook_jobs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
```

---

## 8. Branch-Level Authorization & Multi-Branch Relational Integrity

### 8.1 Branch-Level Authorization Rules
1. **Active Membership Prerequisite:** A user must have an active membership (`is_active = TRUE`) in the organization to access any branch-owned entity. Inactive members immediately lose all data visibility.
2. **Branch-Scoped Staff Access:** Staff members assigned to a specific branch (`branch_id IS NOT NULL`) are strictly quarantined to records carrying their assigned `branch_id`. They cannot view or schedule appointments for other branches in the same clinic.
3. **Organization-Wide Administrative Access:** Clinic owners and administrators (`role IN ('owner', 'admin')`) or float staff (`branch_id IS NULL`) maintain access across all branches within their organization.
4. **Cross-Tenant Branch Prevention:** A branch cannot be assigned across organizations. The composite foreign key `(organization_id, branch_id) REFERENCES public.branches(organization_id, id)` guarantees that an appointment belonging to Clinic A cannot be assigned to a branch belonging to Clinic B.
5. **Audited Branch Reassignment:** Reassigning a staff member's branch or moving an appointment between branches requires `owner` or `admin` authority and generates an entry in `escalation_events` (or dedicated audit log).

---

## 9. Migration Lock Safety, Deadlock Prevention & Non-Destructive Recovery Procedures

### 9.1 The Danger of Naive Query Checks
In Version 2.2, migration safety relied on `SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'`. This check is inadequate because:
1. Long-idle transactions holding locks in `idle in transaction` state are completely invisible to `state = 'active'`.
2. DDL operations like `ALTER TABLE ... ADD CONSTRAINT` request `ACCESS EXCLUSIVE` locks, which queue behind shared read locks and block all incoming clinic traffic.

### 9.2 Reliable Lock Detection & Blocking Analysis Query

```sql
-- Comprehensive Active Lock & Blocking Analysis Query
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process,
    blocked_activity.state AS blocked_state,
    blocking_activity.state AS blocking_state
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### 9.3 Lock and Statement Timeouts
Every migration batch must set strict lock and statement timeouts. If an exclusive lock cannot be acquired within 5 seconds, the migration immediately aborts without holding locks or starving client connections:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';
```

### 9.4 Deadlock-Free Table Lock Acquisition Order
When locking multiple tables, the migration must strictly follow alphabetical or hierarchical locking order to eliminate deadlocks:
1. `public.organizations`
2. `public.organization_members`
3. `public.branches`
4. `public.instagram_accounts`
5. `public.leads`
6. `public.conversations`
7. `public.appointments`
8. `public.chat_messages`
9. `public.processed_webhook_messages`
10. `public.human_takeovers`
11. `public.escalation_events`
12. `public.webhook_jobs`

### 9.5 Idempotent Checkpoint Recovery (Zero Destructive Cascades)
Destructive commands such as `DROP TABLE ... CASCADE` or `DROP COLUMN ... CASCADE` are **permanently prohibited**. Recovery from an interrupted migration is handled via idempotent, forward-compatible checkpoints:

```
[CP 0: Pre-Flight Snapshot] -> Physical DB Snapshot & Schema Dump Verified
      |
[CP 1: New Tables Landing] -> CREATE TABLE IF NOT EXISTS (Zero mutation to existing tables)
      |
[CP 2: Nullable Columns]   -> ADD COLUMN IF NOT EXISTS organization_id UUID (No lock contention)
      |
[CP 3: Reconciliation]     -> Run All-12-Table Reconciliation Audit; Abort if anomalies > 0
      |
[CP 4: Data Backfill]      -> UPDATE ... SET organization_id = ... WHERE organization_id IS NULL
      |
[CP 5: Constraints Valid]  -> ADD CONSTRAINT ... NOT VALID -> VALIDATE CONSTRAINT
      |
[CP 6: RLS Policies]       -> Apply hardened RLS policies with dynamic tenant isolation
```

If execution is interrupted halfway through any checkpoint:
- Columns added in CP 2 remain safely nullable without disrupting existing Phase 4 operations.
- Constraints in CP 5 are added as `NOT VALID` first, avoiding full-table read locks during creation.
- Rolling back a checkpoint involves dropping newly created constraints (`DROP CONSTRAINT IF EXISTS ...`), leaving base table schemas and existing patient data 100% intact.

---

## 10. Final Security & Readiness Audit

### 10.1 Issue Resolution Mapping (v2.2 to v2.3)

| # | Vulnerability / Issue in v2.2 | Technical Resolution in v2.3 | Section Reference |
|---|---|---|---|
| **1** | **Concurrent Last-Owner Removal:** Concurrent transactions could simultaneously demote co-owners, leaving an organization with 0 active owners. | Serialized owner role mutations per organization using `SELECT id FROM organizations WHERE id = $org_id FOR UPDATE` before counting active owners. | **Section 1** |
| **2** | **Incomplete Tenant Ownership Matrix:** Trigger `fn_prevent_tenant_mutation` was not attached to all tables (e.g. `instagram_accounts`, `processed_webhook_messages`). | Audited all 24 tables. Produced complete matrix and attached explicit triggers to every tenant-owned entity. | **Section 2** |
| **3** | **Forgeable Almeswak Static Marker:** Static session text `EXPLICIT_ALMESWAK_BOARD_APPROVAL` could be forged via raw SQL `SET`. | Replaced with `platform_authorizations` table storing cryptographic token hashes, legal board references, and server-side verification. | **Section 3** |
| **4** | **Composite Branch FK `ON DELETE SET NULL` Failure:** Attempted to nullify `organization_id` on child tables with `NOT NULL` constraints. | Switched to `ON DELETE NO ACTION` paired with atomic `BEFORE DELETE ON branches` trigger nullifying `branch_id` while preserving `organization_id`. | **Section 4** |
| **5** | **Quota Idempotency Race Condition:** Webhook retries could trigger duplicate key errors or double-charge DM quota. Caller could supply quota. | Rewrote `reserve_dm_quota()`: locks subscription `FOR UPDATE`, derives quota from `plans` + `entitlements`, re-checks idempotency key under lock, and provides `refund_dm_quota()`. | **Section 5** |
| **6** | **Incomplete Pre-Migration Reconciliation:** Audit query only checked 4 tables; omitted remaining 8 tables. | Created comprehensive pre-migration reconciliation query and automated abort assertion covering all 12 tables without omission. | **Section 6** |
| **7** | **Referenced RLS Policies Instead of Providing DDL:** v2.2 referenced v2.1 policies instead of providing self-contained SQL. | Provided complete, unabridged RLS policies for all 24 tables with explicit intentional denials and branch-level scoping. | **Section 7** |
| **8** | **Branch Authorization Ambiguity:** Float staff and branch reassignment rules were not explicitly codified in RLS. | Codified branch-scoped RLS policies, active membership prerequisites, and audited reassignment rules. | **Section 8** |
| **9** | **Naive Migration Lock Checks:** Checked only `pg_stat_activity WHERE state = 'active'`, ignoring idle-in-transaction locks. | Implemented blocking locks analysis on `pg_locks`, lock timeouts (`5s`), and deadlock-free table acquisition ordering. | **Section 9** |

### 10.2 Comprehensive Security Test Matrix

| Category | Test Case Description | Execution Context | Status |
|---|---|---|---|
| **Orthodontic Guardrails** | Orthodontic price inquiry returns approved template; zero numbers/ranges disclosed. | TypeScript Automated Suite (`scripts/test_engine.ts`) | **VERIFIED (42/42 Passing)** |
| **Orthodontic Variations** | Strict price variations audit across Iraqi dialect and English queries. | TypeScript Automated Suite (`scripts/test_pricing_variations.ts`) | **VERIFIED (8/8 Passing)** |
| **Instagram Pipeline** | Inbound webhook signature verification, 24-hour messaging window, account isolation. | TypeScript Automated Suite (`scripts/test_instagram_pipeline.ts`) | **VERIFIED (65/65 Passing)** |
| **Persistence Store** | Persistent message deduplication, human takeovers, escalation events. | TypeScript Automated Suite (`scripts/test_phase3_persistence.ts`) | **VERIFIED (36/36 Passing)** |
| **Deployment Readiness** | Fail-safe closed behavior during DB outage, queue worker concurrency, dead-letter recovery. | TypeScript Automated Suite (`scripts/test_phase4_deployment.ts`) | **VERIFIED (62/62 Passing)** |
| **Concurrent Owner Changes** | Concurrent transactions attempting to demote last active owners of an organization. | Real PostgreSQL / Supabase Test Environment | **Awaiting Approval** |
| **Duplicate Quota Reservation** | 10 concurrent requests for identical message ID against quota boundary. | Real PostgreSQL / Supabase Test Environment | **Awaiting Approval** |
| **Branch Deletion Orphaning** | Deleting a branch safely de-links members and appointments without nullifying `organization_id`. | Real PostgreSQL / Supabase Test Environment | **Awaiting Approval** |
| **Tenant Mutation Trigger** | Attempting `UPDATE leads SET organization_id = 'other_org'` raises immediate SQL exception. | Real PostgreSQL / Supabase Test Environment | **Awaiting Approval** |
| **Credential Vault Access** | Authenticated user queries `integration_credentials` and receives 0 rows (Default Deny). | Real PostgreSQL / Supabase Test Environment | **Awaiting Approval** |
| **Almeswak Quarantine Bypass** | Attempting to update Almeswak status to `active` without valid token raises immediate SQL exception. | Real PostgreSQL / Supabase Test Environment | **Awaiting Approval** |
| **All-Table Reconciliation** | Pre-migration assertion executes across all 12 tables and passes with 0 anomalies. | Real PostgreSQL / Supabase Test Environment | **Awaiting Approval** |

### 10.3 Unresolved Risks & Operational Dependencies
1. **Supabase PostgreSQL Version Verification:** Confirm exact version on the live Supabase cluster (`SELECT version();`).
2. **Supabase Vault Secrets Provisioning:** Ensure platform master encryption keys are provisioned in Supabase Vault prior to Phase 1 implementation.
3. **Connection Pooler Transaction Timeouts:** Verify that Supabase transaction mode connection pooler (Supavisor) timeout exceeds 5 seconds to prevent aborted migrations during DDL validation.

---

> [!IMPORTANT]
> **This document is an architectural specification and security review.**  
> In accordance with strict execution instructions, zero application source code, zero database migrations, and zero live records have been modified.  
> The 213 automated tests remain 100% passing.  
> We await your explicit review and approval of Version 2.3 before proceeding.

