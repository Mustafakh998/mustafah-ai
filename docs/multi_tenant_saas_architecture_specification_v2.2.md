# MustafaH-AI — Multi-Clinic SaaS Architectural Specification
**Version:** 2.2.0 (Final Security, Relational Integrity & Migration Refinement)  
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

## 1. Database Ownership & Isolation Matrix for All 12 Existing Tables

Every existing table from Phases 1–4 has been audited. The table below specifies its exact multi-tenant ownership model, foreign key strategy, indexing, and migration path.

| # | Existing Table | Primary Tenant Key | Ownership Type | Foreign Key & Referential Action | Composite Index / Constraints | Data Backfill Strategy |
|---|---|---|---|---|---|---|
| **1** | `instagram_accounts` | `organization_id UUID` | Direct Tenant Asset | `REFERENCES public.organizations(id) ON DELETE CASCADE` | `UNIQUE(organization_id, handle)`<br>`INDEX(organization_id, status)` | Map `'drmustafa_hadi'` to Dr. Mustafa's org; map `'almeswaksmile_iq'` to Almeswak org. |
| **2** | `leads` | `organization_id UUID` | Direct Tenant Data | `REFERENCES public.organizations(id) ON DELETE CASCADE` | `UNIQUE(organization_id, id)`<br>`INDEX(organization_id, status)`<br>`INDEX(organization_id, phone)` | Backfill `organization_id` matching `account_id` mapping. |
| **3** | `appointments` | `organization_id UUID` | Direct Tenant Data | `REFERENCES public.organizations(id) ON DELETE CASCADE`<br>`COMPOSITE FK (organization_id, lead_id) REFERENCES public.leads(organization_id, id)` (See Sec. 2 for deletion rules) | `INDEX(organization_id, preferred_date)`<br>`INDEX(organization_id, status)` | Backfill `organization_id` matching `account_id` mapping. |
| **4** | `conversations` | `organization_id UUID` | Direct Tenant Data | `REFERENCES public.organizations(id) ON DELETE CASCADE` | `UNIQUE(organization_id, id)`<br>`INDEX(organization_id, status)` | Backfill `organization_id` matching `account_id` mapping. |
| **5** | `chat_messages` | `organization_id UUID` | Dual: Direct & Parent | `REFERENCES public.organizations(id) ON DELETE CASCADE`<br>`COMPOSITE FK (organization_id, conversation_id) REFERENCES public.conversations(organization_id, id) ON DELETE CASCADE` | `INDEX(organization_id, conversation_id)`<br>`INDEX(conversation_id, timestamp)` | Backfill `organization_id` via join to parent `conversations.organization_id`. |
| **6** | `content_items` | `organization_id UUID` | Direct Tenant Asset | `REFERENCES public.organizations(id) ON DELETE CASCADE` | `INDEX(organization_id, scheduled_date)`<br>`INDEX(organization_id, status)` | Backfill `organization_id` matching `account_id` mapping. |
| **7** | `ad_campaigns` | `organization_id UUID` | Direct Tenant Asset | `REFERENCES public.organizations(id) ON DELETE CASCADE` | `INDEX(organization_id, status)` | Backfill `organization_id` matching `account_id` mapping. |
| **8** | `webhook_logs` | `organization_id UUID` (Nullable) | System Audit Log | `REFERENCES public.organizations(id) ON DELETE SET NULL` | `INDEX(organization_id, created_at)`<br>`INDEX(status, created_at)` | Backfill where `sender_id` or recipient correlates to known pilot account. **Explicitly Nullable** (see rationale below). |
| **9** | `processed_webhook_messages` | `organization_id UUID` | Direct Reliability Store | `REFERENCES public.organizations(id) ON DELETE CASCADE` | `PRIMARY KEY (organization_id, message_id)`<br>`INDEX(organization_id, sender_id)` | Transform PK from `(message_id)` to composite `(organization_id, message_id)`. |
| **10** | `human_takeovers` | `organization_id UUID` | Direct Reliability Store | `REFERENCES public.organizations(id) ON DELETE CASCADE`<br>`COMPOSITE FK (organization_id, conversation_id) REFERENCES public.conversations(organization_id, id)` (See Sec. 2) | `UNIQUE(organization_id, sender_id) WHERE is_active = TRUE`<br>`INDEX(organization_id, sender_id)` | Update partial unique index to include `organization_id`. |
| **11** | `escalation_events` | `organization_id UUID` | Direct Audit Log | `REFERENCES public.organizations(id) ON DELETE CASCADE`<br>`COMPOSITE FK (organization_id, conversation_id) REFERENCES public.conversations(organization_id, id)` (See Sec. 2) | `INDEX(organization_id, event_type)`<br>`INDEX(organization_id, requires_followup)` | Backfill `organization_id` matching `account_id` mapping. |
| **12** | `webhook_jobs` | `organization_id UUID` | Direct Queue Task | `REFERENCES public.organizations(id) ON DELETE CASCADE` | `UNIQUE(organization_id, message_id)`<br>`INDEX(organization_id, status, attempts)` | Backfill `organization_id` matching `account_id` mapping. |

### 1.1 Rationale for Nullable `organization_id` on `webhook_logs`
Incoming HTTP webhook calls from Meta or third-party web scrapers hit the public ingestion endpoint (`/api/webhooks/instagram`) prior to authentication or account lookup. These requests may:
1. Fail HMAC-SHA256 signature verification (spoofed/malicious requests).
2. Carry a recipient ID that does not map to any registered organization in the database.
3. Be health checks or malformed JSON payloads.

If `webhook_logs.organization_id` were enforced as `NOT NULL`, recording security rejections or unregistered incoming events would throw a database constraint violation. This would destroy forensic telemetry precisely when security monitoring is most critical. Therefore, `webhook_logs.organization_id` remains **nullable with `ON DELETE SET NULL`**.

---

## 2. Relational Tenant Consistency & Composite Foreign-Key Deletion Behavior

### 2.1 The PostgreSQL Composite `ON DELETE SET NULL` Incompatibility
In standard PostgreSQL, declaring `FOREIGN KEY (organization_id, lead_id) REFERENCES public.leads(organization_id, id) ON DELETE SET NULL` introduces a critical runtime failure:
1. PostgreSQL attempts to nullify **all** columns in the composite key (both `organization_id` and `lead_id`).
2. However, `organization_id` is defined as `NOT NULL` on child tables (`appointments`, `human_takeovers`, `escalation_events`).
3. Deleting a parent lead or conversation results in an immediate SQL constraint violation:
   `ERROR: null value in column "organization_id" of relation "appointments" violates not-null constraint`.

### 2.2 PostgreSQL Version-Compatible Solutions

#### Option A: PostgreSQL 15+ Native Column-Specific SET NULL
PostgreSQL 15 introduced column-specific `ON DELETE SET NULL (column_list)`:
```sql
ALTER TABLE public.appointments
    ADD CONSTRAINT fk_appointments_lead_composite
    FOREIGN KEY (organization_id, lead_id)
    REFERENCES public.leads(organization_id, id)
    ON DELETE SET NULL (lead_id);
```
*Limitation:* While Supabase runs PostgreSQL 15+, third-party DB tools, older local Postgres testing setups, or logical replication targets running Postgres 14 or earlier will fail to parse this syntax.

#### Option B: Universal Production Trigger Architecture (Recommended & Default)
To guarantee compatibility across all PostgreSQL versions, the platform uses `ON DELETE NO ACTION` on composite foreign keys combined with an explicit, transactional `BEFORE DELETE` orphan resolution trigger:

```sql
-- 1. appointments -> leads safe orphan resolution trigger
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_appointments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.appointments
    SET lead_id = NULL
    WHERE organization_id = OLD.organization_id AND lead_id = OLD.id;
    RETURN OLD;
END;
$$;

ALTER FUNCTION public.fn_safe_orphan_appointments() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_safe_orphan_appointments ON public.leads;
CREATE TRIGGER trg_safe_orphan_appointments
BEFORE DELETE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_appointments();

-- 2. conversations -> human_takeovers & escalation_events safe orphan resolution
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.human_takeovers
    SET conversation_id = NULL
    WHERE organization_id = OLD.organization_id AND conversation_id = OLD.id;

    UPDATE public.escalation_events
    SET conversation_id = NULL
    WHERE organization_id = OLD.organization_id AND conversation_id = OLD.id;

    RETURN OLD;
END;
$$;

ALTER FUNCTION public.fn_safe_orphan_conversations() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_safe_orphan_conversations ON public.conversations;
CREATE TRIGGER trg_safe_orphan_conversations
BEFORE DELETE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_conversations();

-- 3. Composite Foreign Keys configured with ON DELETE NO ACTION (enforced after trigger)
ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_lead_composite,
    ADD CONSTRAINT fk_appointments_lead_composite
    FOREIGN KEY (organization_id, lead_id)
    REFERENCES public.leads(organization_id, id)
    ON DELETE NO ACTION;

ALTER TABLE public.human_takeovers
    DROP CONSTRAINT IF EXISTS fk_takeovers_conv_composite,
    ADD CONSTRAINT fk_takeovers_conv_composite
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.conversations(organization_id, id)
    ON DELETE NO ACTION;

ALTER TABLE public.escalation_events
    DROP CONSTRAINT IF EXISTS fk_escalations_conv_composite,
    ADD CONSTRAINT fk_escalations_conv_composite
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.conversations(organization_id, id)
    ON DELETE NO ACTION;

-- 4. chat_messages -> conversations uses true CASCADE (valid because messages die with conversation)
ALTER TABLE public.chat_messages
    DROP CONSTRAINT IF EXISTS fk_messages_conv_composite,
    ADD CONSTRAINT fk_messages_conv_composite
    FOREIGN KEY (organization_id, conversation_id)
    REFERENCES public.conversations(organization_id, id)
    ON DELETE CASCADE;
```

---

## 3. Membership Authorization & Privilege Escalation Closure

In v2.1, standard RLS allowed any `admin` to promote users to `owner` or demote the clinic owner. Version 2.2 closes this vulnerability using a transactional database trigger and strict RLS rules.

### 3.1 Hardened Privilege Boundaries Trigger

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_member_privilege_boundaries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_is_owner BOOLEAN;
    v_active_owner_count INTEGER;
BEGIN
    -- 1. Enforce Immutability of organization_id and user_id on existing memberships
    IF TG_OP = 'UPDATE' THEN
        IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Security Violation: Mutating organization_id or user_id on membership is strictly prohibited.';
        END IF;
    END IF;

    -- 2. Verify Caller's Authority
    -- In service-role operations (auth.uid() IS NULL), bypass check for initial system seeding
    IF auth.uid() IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE user_id = auth.uid()
              AND organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
              AND role = 'owner'
              AND is_active = TRUE
        ) INTO v_caller_is_owner;

        -- Check: Only an existing owner can grant the 'owner' role
        IF (TG_OP = 'INSERT' AND NEW.role = 'owner') OR (TG_OP = 'UPDATE' AND NEW.role = 'owner' AND OLD.role != 'owner') THEN
            IF NOT v_caller_is_owner THEN
                RAISE EXCEPTION 'Privilege Escalation Detected: Only an existing Owner can grant the Owner role.';
            END IF;
        END IF;

        -- Check: An admin cannot modify an owner's record
        IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'owner' THEN
            IF NOT v_caller_is_owner THEN
                RAISE EXCEPTION 'Privilege Escalation Detected: Admins cannot modify or delete an Owner membership.';
            END IF;
        END IF;
    END IF;

    -- 3. Last Active Owner Protection (Lockout Prevention)
    -- Guarantees that an organization MUST ALWAYS have at least one active owner
    IF (TG_OP = 'DELETE' AND OLD.role = 'owner' AND OLD.is_active = TRUE) OR 
       (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND (NEW.role != 'owner' OR NEW.is_active = FALSE)) THEN
        SELECT COUNT(*) INTO v_active_owner_count
        FROM public.organization_members
        WHERE organization_id = OLD.organization_id
          AND role = 'owner'
          AND is_active = TRUE
          AND id != OLD.id;

        IF v_active_owner_count < 1 THEN
            RAISE EXCEPTION 'Security Violation: Cannot demote, deactivate, or remove the final active Owner of an organization.';
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

## 4. Prevention of Cross-Organization Record Movement

### 4.1 The Multi-Organization Leak Vulnerability
If Dr. X is a member of Clinic A (Mansour) and Clinic B (Zayouna), an ordinary `UPDATE leads SET organization_id = 'clinic_b_id' WHERE id = 'lead_a_id'` would succeed under naive RLS policies checking `organization_id IN (SELECT org_id FROM get_auth_org_ids())`. This would allow silent cross-tenant data transfers.

### 4.2 Universal Tenant Mutation Lock Trigger
To eliminate this vector across all tables, every tenant-owned table is equipped with an immutable trigger:

```sql
CREATE OR REPLACE FUNCTION public.fn_prevent_tenant_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'Security Violation: Cross-organization record reassignment is strictly prohibited.';
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_prevent_tenant_mutation() OWNER TO postgres;

-- Attach trigger to all tenant-owned tables
CREATE TRIGGER trg_lock_tenant_leads BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
CREATE TRIGGER trg_lock_tenant_appts BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
CREATE TRIGGER trg_lock_tenant_convs BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
CREATE TRIGGER trg_lock_tenant_msgs BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
CREATE TRIGGER trg_lock_tenant_content BEFORE UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
CREATE TRIGGER trg_lock_tenant_campaigns BEFORE UPDATE ON public.ad_campaigns FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
CREATE TRIGGER trg_lock_tenant_integrations BEFORE UPDATE ON public.organization_integrations FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
CREATE TRIGGER trg_lock_tenant_branches BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
CREATE TRIGGER trg_lock_tenant_ai BEFORE UPDATE ON public.tenant_ai_configs FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
CREATE TRIGGER trg_lock_tenant_subs BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();
```

---

## 5. Integration Credential Vault Separation & AEAD Security

To prevent client-side exposure of ciphertexts, IVs, and encryption metadata, the data model strictly separates client-facing integration metadata from the credential vault.

### 5.1 Decoupled Integration Tables DDL

```sql
-- 1. Client-Facing Metadata Table (Safe for Authenticated Staff)
CREATE TABLE IF NOT EXISTS public.organization_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID,
    provider TEXT NOT NULL DEFAULT 'instagram_graph_api' CHECK (provider IN ('instagram_graph_api', 'whatsapp_business')),
    platform_account_id TEXT NOT NULL UNIQUE, -- Meta Page ID or Instagram Business Account ID
    platform_account_handle TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'demo_mode', 'disconnected', 'expired')),
    token_expires_at TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ,
    last_error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Isolated Server-Side Credential Vault (EXCLUSIVELY SYSTEM-MANAGED)
CREATE TABLE IF NOT EXISTS public.integration_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL UNIQUE REFERENCES public.organization_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    encrypted_access_token TEXT NOT NULL,
    token_iv TEXT NOT NULL,
    token_auth_tag TEXT NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS ON VAULT: Zero Access for Authenticated Users (DEFAULT DENY)
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vault_service_role_only" ON public.integration_credentials
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
```

### 5.2 Cryptographic AEAD Specification
Tokens are encrypted using **AES-256-GCM** with Authenticated Additional Data (AAD):

$$\text{AAD} = \text{organization\_id} \parallel \text{platform\_account\_id}$$

This ensures that ciphertext stolen from Organization A cannot be decrypted or attached to Organization B.

### 5.3 Safe API Response Shape
Client API calls to `/api/integrations` return only non-sensitive metadata:
```json
{
  "id": "int_789012",
  "provider": "instagram_graph_api",
  "platform_account_handle": "drmustafa_hadi",
  "status": "connected",
  "token_expires_at": null,
  "last_verified_at": "2026-10-31T01:00:00Z"
}
```

---

## 6. Almeswak Clinic Demo Quarantine Enforcement

Almeswak Dental Clinic (`@almeswaksmile.iq`) must remain locked in Demo mode. No ordinary organization owner, admin, or subscription upgrade may activate it.

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_almeswak_quarantine()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Enforce on organizations table
    IF TG_TABLE_NAME = 'organizations' THEN
        IF OLD.slug = 'almeswaksmile-iq' AND NEW.status != 'demo_mode' THEN
            IF current_setting('app.platform_management_authorization', true) != 'EXPLICIT_ALMESWAK_BOARD_APPROVAL' THEN
                RAISE EXCEPTION 'Security Policy Violation: Almeswak Clinic is quarantined in Demo mode. Activation requires signed clinic management authorization.';
            END IF;
        END IF;
    END IF;

    -- Enforce on organization_integrations table
    IF TG_TABLE_NAME = 'organization_integrations' THEN
        IF (OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001') AND NEW.status != 'demo_mode' THEN
            IF current_setting('app.platform_management_authorization', true) != 'EXPLICIT_ALMESWAK_BOARD_APPROVAL' THEN
                RAISE EXCEPTION 'Security Policy Violation: Outbound messaging for @almeswaksmile.iq is prohibited without official authorization.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_enforce_almeswak_quarantine() OWNER TO postgres;

CREATE TRIGGER trg_quarantine_almeswak_org BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_quarantine();
CREATE TRIGGER trg_quarantine_almeswak_int BEFORE UPDATE ON public.organization_integrations FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_quarantine();
```

---

## 7. Fail-Safe Historical Data Migration & Pre-Migration Reconciliation SQL

Before enforcing `NOT NULL` constraints, the migration executes a comprehensive reconciliation query covering all 12 tables:

```sql
-- Comprehensive Pre-Migration Reconciliation & Anomaly Detection Query
WITH mapping_audit AS (
    SELECT 'instagram_accounts' AS table_name, COUNT(*) AS total_rows,
           COUNT(*) FILTER (WHERE id = 'drmustafa_hadi' OR id = 'almeswaksmile_iq') AS mapped_rows,
           COUNT(*) FILTER (WHERE id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq')) AS unmappable_rows
    FROM public.instagram_accounts
    UNION ALL
    SELECT 'leads', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL)
    FROM public.leads
    UNION ALL
    SELECT 'appointments', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL)
    FROM public.appointments
    UNION ALL
    SELECT 'conversations', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL)
    FROM public.conversations
    UNION ALL
    SELECT 'chat_messages', COUNT(*),
           COUNT(*) FILTER (WHERE conversation_id IN (SELECT id FROM public.conversations WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq'))),
           COUNT(*) FILTER (WHERE conversation_id NOT IN (SELECT id FROM public.conversations))
    FROM public.chat_messages
    UNION ALL
    SELECT 'content_items', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL)
    FROM public.content_items
    UNION ALL
    SELECT 'ad_campaigns', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL)
    FROM public.ad_campaigns
    UNION ALL
    SELECT 'processed_webhook_messages', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL)
    FROM public.processed_webhook_messages
    UNION ALL
    SELECT 'human_takeovers', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL)
    FROM public.human_takeovers
    UNION ALL
    SELECT 'escalation_events', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL)
    FROM public.escalation_events
    UNION ALL
    SELECT 'webhook_jobs', COUNT(*),
           COUNT(*) FILTER (WHERE account_id IN ('drmustafa_hadi', 'almeswaksmile_iq')),
           COUNT(*) FILTER (WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL)
    FROM public.webhook_jobs
)
SELECT * FROM mapping_audit;
```

### 7.1 Automated Migration Abort Assertion
```sql
DO $$
DECLARE
    v_unmappable_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_unmappable_count
    FROM (
        SELECT id FROM public.leads WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
        UNION ALL
        SELECT id FROM public.appointments WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
        UNION ALL
        SELECT id FROM public.conversations WHERE account_id NOT IN ('drmustafa_hadi', 'almeswaksmile_iq') OR account_id IS NULL
    ) anomalies;

    IF v_unmappable_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Found % unmappable records. Refusing to apply NOT NULL without certainty.', v_unmappable_count;
    END IF;
END $$;
```

---

## 8. Multi-Branch Relational Integrity & Branch-Level Authorization

### 8.1 Multi-Branch Schema Constraints
```sql
-- Ensure branches has composite unique constraint
ALTER TABLE public.branches ADD CONSTRAINT uq_branches_org_id UNIQUE (organization_id, id);

-- Enforce composite foreign keys on organization_members
ALTER TABLE public.organization_members
    DROP CONSTRAINT IF EXISTS fk_members_branch_composite,
    ADD CONSTRAINT fk_members_branch_composite
    FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id)
    ON DELETE SET NULL;

-- Enforce composite foreign keys on organization_integrations
ALTER TABLE public.organization_integrations
    DROP CONSTRAINT IF EXISTS fk_integrations_branch_composite,
    ADD CONSTRAINT fk_integrations_branch_composite
    FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id)
    ON DELETE SET NULL;

-- Enforce composite foreign keys on appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_branch_composite,
    ADD CONSTRAINT fk_appointments_branch_composite
    FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id)
    ON DELETE SET NULL;
```

### 8.2 Branch-Scoped RLS Policies
Staff assigned to a specific branch (`branch_id IS NOT NULL`) are restricted to viewing and scheduling records for that branch:

```sql
CREATE POLICY "appts_select_branch_scoped" ON public.appointments
    FOR SELECT TO authenticated
    USING (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND (
            -- Organization-wide role (branch_id is null in membership)
            EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id AND m.branch_id IS NULL) OR
            -- Branch-specific staff
            appointments.branch_id IN (SELECT m.branch_id FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = appointments.organization_id)
        )
    );
```

---

## 9. Concurrency-Safe Subscription Ledger & Quota Reservation

The quota reservation function **never trusts caller-supplied quotas**. It queries the trusted `plans` catalog directly, validates billing dates, and maintains an auditable usage ledger:

```sql
-- 1. Immutable Usage Ledger Table
CREATE TABLE IF NOT EXISTS public.subscription_usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 1,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, message_id) -- Idempotency key
);

-- 2. Concurrency-Safe Reservation Function
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
    v_current_count INTEGER;
    v_max_quota INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- 1. Check Idempotency: Has this message already been reserved?
    IF EXISTS (SELECT 1 FROM public.subscription_usage_ledger WHERE organization_id = p_organization_id AND message_id = p_message_id) THEN
        RETURN jsonb_build_object('success', TRUE, 'reason', 'already_reserved');
    END IF;

    -- 2. Lock subscription row to prevent concurrent race conditions
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE organization_id = p_organization_id
    FOR UPDATE;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SUBSCRIPTION_NOT_FOUND');
    END IF;

    -- 3. Validate Status and Billing Period
    IF v_sub.status NOT IN ('active', 'trialing') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SUBSCRIPTION_INACTIVE');
    END IF;

    IF NOW() NOT BETWEEN v_sub.current_period_start AND v_sub.current_period_end THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'BILLING_PERIOD_EXPIRED');
    END IF;

    -- 4. Derive quota from trusted plans table
    SELECT * INTO v_plan FROM public.plans WHERE id = v_sub.plan_id;
    v_max_quota := v_plan.monthly_dm_quota;

    -- 5. Lock usage aggregate row
    SELECT dms_consumed INTO v_current_count
    FROM public.subscription_usage_records
    WHERE organization_id = p_organization_id AND period_start = v_sub.current_period_start
    FOR UPDATE;

    IF v_current_count IS NULL THEN
        INSERT INTO public.subscription_usage_records (organization_id, period_start, period_end, dms_consumed, allocated_quota)
        VALUES (p_organization_id, v_sub.current_period_start, v_sub.current_period_end, 0, v_max_quota);
        v_current_count := 0;
    END IF;

    -- 6. Enforce Quota Ceiling
    IF v_current_count >= v_max_quota THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'QUOTA_EXCEEDED', 'current', v_current_count, 'max', v_max_quota);
    END IF;

    -- 7. Increment aggregate and append to immutable ledger
    v_new_balance := v_current_count + 1;
    UPDATE public.subscription_usage_records
    SET dms_consumed = v_new_balance, updated_at = NOW()
    WHERE organization_id = p_organization_id AND period_start = v_sub.current_period_start;

    INSERT INTO public.subscription_usage_ledger (organization_id, message_id, amount, balance_after)
    VALUES (p_organization_id, p_message_id, 1, v_new_balance);

    RETURN jsonb_build_object('success', TRUE, 'balance_after', v_new_balance, 'max_quota', v_max_quota);
END;
$$;

ALTER FUNCTION public.reserve_dm_quota(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reserve_dm_quota FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_dm_quota TO service_role;
```

---

## 10. Checkpoint-Based Migration & Non-Destructive Recovery

Destructive statements like `DROP COLUMN CASCADE` are **permanently removed**. Recovery is handled via dependency-aware checkpoints:

### 10.1 Preconditions & Checkpoint Verification
- **Precondition Check:**
  `SELECT current_setting('server_version_num')::integer >= 150000;` (Verifies Postgres version).
  `SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active' AND query ILIKE '%leads%';` (Verifies no active table locks).

### 10.2 Forward Checkpoints with Rollback Actions

| Checkpoint | Target Objects | Forward Action | Non-Destructive Rollback |
|---|---|---|---|
| **CP 0** | Snapshot | Physical Point-In-Time Backup | Restore backup snapshot if corruption occurs |
| **CP 1** | SaaS Tables | `CREATE TABLE IF NOT EXISTS` | `DROP TABLE IF EXISTS integration_credentials, ... RESTRICT;` |
| **CP 2** | Nullable Columns | `ADD COLUMN IF NOT EXISTS organization_id` | Revert application config; leave nullable column in place |
| **CP 3** | Data Backfill | Run reconciliation query; assert 0 anomalies | Correct mapping script and re-run update |
| **CP 4** | Composite Keys | `ADD CONSTRAINT ... NOT VALID` -> `VALIDATE` | `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...;` |
| **CP 5** | Dynamic RLS | Replace static policies with dynamic policies | Revert policies back to Phase 4 baseline |

---

## 11. Final Audit Deliverables & Risk Mapping

### 11.1 Issue Resolution Mapping (v2.1 to v2.2)

| Issue Identified in v2.1 | Technical Resolution in v2.2 |
|---|---|
| **Composite FK `ON DELETE SET NULL` on NOT NULL column** | Implemented PostgreSQL version-compatible `ON DELETE NO ACTION` paired with safe `BEFORE DELETE` triggers nullifying child FKs. |
| **Admin privilege escalation to Owner** | Added trigger `fn_enforce_member_privilege_boundaries()` blocking non-owner promotions and protecting the final owner. |
| **Cross-organization record mutation via UPDATE** | Attached universal trigger `fn_prevent_tenant_mutation()` on all tables raising exceptions on `organization_id` change. |
| **Credentials exposed to authenticated client queries** | Split into client metadata (`organization_integrations`) and serverless vault (`integration_credentials`) with default deny RLS. |
| **Almeswak Demo quarantine bypass risk** | Enforced database-level triggers blocking status change from `'demo_mode'` without platform authorization token. |
| **Missing migration on `instagram_accounts`** | Fully integrated `instagram_accounts.organization_id` with composite unique constraint into migration checkpoints. |
| **Destructive `CASCADE` rollback in v2.1** | Replaced with non-destructive forward checkpoints and isolated dependency-aware rollbacks. |
| **Caller-supplied quota parameter vulnerability** | Rewrote `reserve_dm_quota()` to derive quotas directly from trusted `plans` catalog with idempotency keys. |

### 11.2 Unresolved Environmental Risks & Supabase Verification Requirements
The following items cannot be fully verified locally and must be checked on the live Supabase instance:
1. **Supabase PostgreSQL Version:** Verify exact version (`SELECT version();`) to determine whether Option A (`ON DELETE SET NULL (col)`) or Option B (Trigger) is natively supported.
2. **Supabase Service-Role Environment Secrets:** Confirm `INTEGRATION_KEY_CURRENT_VERSION` is securely provisioned in Supabase Vault.
3. **Database Connection Pooler Limits:** Verify that composite foreign key triggers do not exceed connection transaction timeouts during high-burst webhook ingestion.

---

> [!IMPORTANT]
> **This document is an architectural specification.**  
> No application code, database migrations, or live credentials have been modified.  
> We await your explicit review and approval of Version 2.2 before beginning implementation.

