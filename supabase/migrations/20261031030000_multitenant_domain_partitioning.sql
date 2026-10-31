-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 2: Relational Domain Partitioning & Composite Key Multi-Tenancy
-- Migration: 20261031030000_multitenant_domain_partitioning.sql
-- ==============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ------------------------------------------------------------------------------
-- 1. Tenant AI Configs Table (Doctor & Clinic Persona Directory)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_ai_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    assistant_name_ar TEXT NOT NULL DEFAULT 'المساعد الذكي',
    doctor_name_ar TEXT NOT NULL,
    slogan_ar TEXT,
    primary_location_ar TEXT NOT NULL,
    emergency_phone TEXT NOT NULL DEFAULT '07768886667',
    working_hours_ar TEXT NOT NULL,
    dialect_mode TEXT NOT NULL DEFAULT 'iraqi_baghdadi',
    custom_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    approved_services JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_ortho_pricing_prohibited BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_ortho_pricing_prohibited = TRUE),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default AI Configurations for Pilot & Demo Clinics (Idempotent)
INSERT INTO public.tenant_ai_configs (
    organization_id, assistant_name_ar, doctor_name_ar, slogan_ar, primary_location_ar, emergency_phone, working_hours_ar
) VALUES 
    (
        'a0000000-0000-0000-0000-000000000001'::uuid,
        'المساعد الذكي لعيادة د. مصطفى هادي',
        'د. مصطفى هادي',
        'ابتسامتك تبدأ هنا',
        'بغداد - زيونة - مقابل دريم سيتي مول',
        '07768886667',
        'السبت - الخميس: 4:00 عصراً - 9:00 مساءً'
    ),
    (
        'a0000000-0000-0000-0000-000000000002'::uuid,
        'المساعد التجريبي لمركز المسواك',
        'أطباء مركز المسواك',
        'صحة أسنانكم غايتنا',
        'بغداد - مركز المسواك (نسخة تجريبية مغلقة)',
        '07700000000',
        'تجريبي مغلق'
    )
ON CONFLICT (organization_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Add organization_id Column to Operational Domain Tables
-- ------------------------------------------------------------------------------
ALTER TABLE public.instagram_accounts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.processed_webhook_messages ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.human_takeovers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.webhook_jobs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 3. Data Backfill & Tenant Reconciliation
-- ------------------------------------------------------------------------------
-- 3.1 Backfill instagram_accounts
UPDATE public.instagram_accounts
SET organization_id = CASE
    WHEN id = 'almeswaksmile_iq' OR handle ILIKE '%almeswak%' THEN 'a0000000-0000-0000-0000-000000000002'::uuid
    ELSE 'a0000000-0000-0000-0000-000000000001'::uuid
END
WHERE organization_id IS NULL;

-- 3.2 Backfill Child Tables with account_id
UPDATE public.leads l
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE l.account_id = a.id AND l.organization_id IS NULL;

UPDATE public.conversations c
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE c.account_id = a.id AND c.organization_id IS NULL;

UPDATE public.appointments app
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE app.account_id = a.id AND app.organization_id IS NULL;

UPDATE public.processed_webhook_messages p
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE p.account_id = a.id AND p.organization_id IS NULL;

UPDATE public.human_takeovers h
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE h.account_id = a.id AND h.organization_id IS NULL;

UPDATE public.escalation_events e
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE e.account_id = a.id AND e.organization_id IS NULL;

UPDATE public.webhook_jobs j
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE j.account_id = a.id AND j.organization_id IS NULL;

UPDATE public.content_items ci
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE ci.account_id = a.id AND ci.organization_id IS NULL;

UPDATE public.ad_campaigns ac
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE ac.account_id = a.id AND ac.organization_id IS NULL;

-- 3.3 Backfill chat_messages via conversation
UPDATE public.chat_messages m
SET organization_id = c.organization_id
FROM public.conversations c
WHERE m.conversation_id = c.id AND m.organization_id IS NULL;

-- Fallback safety for any orphaned row
UPDATE public.leads SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.conversations SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.appointments SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.chat_messages SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.processed_webhook_messages SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.human_takeovers SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.escalation_events SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.webhook_jobs SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.content_items SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.ad_campaigns SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;

-- Backfill appointments branch_id to Dr. Mustafa Hadi Main Branch if null
UPDATE public.appointments
SET branch_id = 'b0000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid AND branch_id IS NULL;

-- ------------------------------------------------------------------------------
-- 4. Enforce NOT NULL on organization_id
-- ------------------------------------------------------------------------------
ALTER TABLE public.instagram_accounts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.chat_messages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.processed_webhook_messages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.human_takeovers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.escalation_events ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.webhook_jobs ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.content_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.ad_campaigns ALTER COLUMN organization_id SET NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. Automatic Organization ID Resolution Trigger Function (Backward Compatibility)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_resolve_account_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        IF NEW.account_id IS NOT NULL THEN
            SELECT organization_id INTO NEW.organization_id
            FROM public.instagram_accounts
            WHERE id = NEW.account_id;
        END IF;

        IF NEW.organization_id IS NULL THEN
            NEW.organization_id := 'a0000000-0000-0000-0000-000000000001'::uuid;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_org_leads ON public.leads;
CREATE TRIGGER trg_resolve_org_leads BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_conv ON public.conversations;
CREATE TRIGGER trg_resolve_org_conv BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_appt ON public.appointments;
CREATE TRIGGER trg_resolve_org_appt BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_dedup ON public.processed_webhook_messages;
CREATE TRIGGER trg_resolve_org_dedup BEFORE INSERT ON public.processed_webhook_messages
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_takeover ON public.human_takeovers;
CREATE TRIGGER trg_resolve_org_takeover BEFORE INSERT ON public.human_takeovers
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_escalation ON public.escalation_events;
CREATE TRIGGER trg_resolve_org_escalation BEFORE INSERT ON public.escalation_events
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_jobs ON public.webhook_jobs;
CREATE TRIGGER trg_resolve_org_jobs BEFORE INSERT ON public.webhook_jobs
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

-- ------------------------------------------------------------------------------
-- 6. Composite Unique Constraints & Foreign Keys
-- ------------------------------------------------------------------------------
-- Parent Unique Constraints
ALTER TABLE public.instagram_accounts DROP CONSTRAINT IF EXISTS uq_accounts_org_id, ADD CONSTRAINT uq_accounts_org_id UNIQUE (organization_id, id);
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS uq_leads_org_id, ADD CONSTRAINT uq_leads_org_id UNIQUE (organization_id, id);
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS uq_conversations_org_id, ADD CONSTRAINT uq_conversations_org_id UNIQUE (organization_id, id);
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS uq_appointments_org_id, ADD CONSTRAINT uq_appointments_org_id UNIQUE (organization_id, id);

-- Child Composite Foreign Keys
ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS fk_leads_account_composite,
    ADD CONSTRAINT fk_leads_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.conversations
    DROP CONSTRAINT IF EXISTS fk_conversations_account_composite,
    ADD CONSTRAINT fk_conversations_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.chat_messages
    DROP CONSTRAINT IF EXISTS fk_messages_conv_composite,
    ADD CONSTRAINT fk_messages_conv_composite
    FOREIGN KEY (organization_id, conversation_id) REFERENCES public.conversations(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_account_composite,
    ADD CONSTRAINT fk_appointments_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_lead_composite,
    ADD CONSTRAINT fk_appointments_lead_composite
    FOREIGN KEY (organization_id, lead_id) REFERENCES public.leads(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_branch_composite,
    ADD CONSTRAINT fk_appointments_branch_composite
    FOREIGN KEY (organization_id, branch_id) REFERENCES public.branches(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT;

ALTER TABLE public.processed_webhook_messages
    DROP CONSTRAINT IF EXISTS fk_dedup_account_composite,
    ADD CONSTRAINT fk_dedup_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.human_takeovers
    DROP CONSTRAINT IF EXISTS fk_takeovers_account_composite,
    ADD CONSTRAINT fk_takeovers_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.human_takeovers
    DROP CONSTRAINT IF EXISTS fk_takeovers_conv_composite,
    ADD CONSTRAINT fk_takeovers_conv_composite
    FOREIGN KEY (organization_id, conversation_id) REFERENCES public.conversations(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT;

ALTER TABLE public.escalation_events
    DROP CONSTRAINT IF EXISTS fk_escalations_account_composite,
    ADD CONSTRAINT fk_escalations_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.escalation_events
    DROP CONSTRAINT IF EXISTS fk_escalations_conv_composite,
    ADD CONSTRAINT fk_escalations_conv_composite
    FOREIGN KEY (organization_id, conversation_id) REFERENCES public.conversations(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT;

ALTER TABLE public.webhook_jobs
    DROP CONSTRAINT IF EXISTS fk_jobs_account_composite,
    ADD CONSTRAINT fk_jobs_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ------------------------------------------------------------------------------
-- 7. Safe Non-Null Preserving Cascade Triggers (Soft Deletion / Set Null)
-- ------------------------------------------------------------------------------
-- 7.1 Safe Orphan Trigger for Branches (preserves organization_id on child records)
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_branches()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Safely nullify branch_id on appointments while preserving organization_id
    UPDATE public.appointments
    SET branch_id = NULL
    WHERE organization_id = OLD.organization_id AND branch_id = OLD.id;

    -- Safely nullify branch_id on members while preserving organization_id
    UPDATE public.organization_members
    SET branch_id = NULL
    WHERE organization_id = OLD.organization_id AND branch_id = OLD.id;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_safe_orphan_branches ON public.branches;
CREATE TRIGGER trg_safe_orphan_branches
BEFORE DELETE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_branches();

-- 7.2 Safe Orphan Trigger for Leads (preserves organization_id on appointments)
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_leads()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.appointments
    SET lead_id = NULL
    WHERE organization_id = OLD.organization_id AND lead_id = OLD.id;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_safe_orphan_leads ON public.leads;
CREATE TRIGGER trg_safe_orphan_leads
BEFORE DELETE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_leads();

-- 7.3 Safe Orphan Trigger for Conversations (preserves organization_id on takeovers & escalations)
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_safe_orphan_conversations ON public.conversations;
CREATE TRIGGER trg_safe_orphan_conversations
BEFORE DELETE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_conversations();

-- Apply Universal Tenant Mutation Lock on Operational Tables
DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_leads ON public.leads;
CREATE TRIGGER trg_prevent_tenant_mutation_leads BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_appt ON public.appointments;
CREATE TRIGGER trg_prevent_tenant_mutation_appt BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_conv ON public.conversations;
CREATE TRIGGER trg_prevent_tenant_mutation_conv BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

-- ------------------------------------------------------------------------------
-- 8. Table Permissions & Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_ai_configs TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_accounts TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processed_webhook_messages TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.human_takeovers TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalation_events TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_jobs TO authenticated, service_role, app_worker;

-- Enable and Force RLS
ALTER TABLE public.tenant_ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ai_configs FORCE ROW LEVEL SECURITY;
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
ALTER TABLE public.processed_webhook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.human_takeovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_takeovers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_jobs FORCE ROW LEVEL SECURITY;

-- 8.1 tenant_ai_configs RLS
DROP POLICY IF EXISTS "v27_ai_select" ON public.tenant_ai_configs;
CREATE POLICY "v27_ai_select" ON public.tenant_ai_configs FOR SELECT TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_ai_update" ON public.tenant_ai_configs;
CREATE POLICY "v27_ai_update" ON public.tenant_ai_configs FOR UPDATE TO authenticated
USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_ai_service" ON public.tenant_ai_configs;
CREATE POLICY "v27_ai_service" ON public.tenant_ai_configs FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.2 instagram_accounts RLS
DROP POLICY IF EXISTS "v27_acc_select" ON public.instagram_accounts;
CREATE POLICY "v27_acc_select" ON public.instagram_accounts FOR SELECT TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_acc_service" ON public.instagram_accounts;
CREATE POLICY "v27_acc_service" ON public.instagram_accounts FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.3 leads RLS
DROP POLICY IF EXISTS "v27_leads_all" ON public.leads;
CREATE POLICY "v27_leads_all" ON public.leads FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_leads_service" ON public.leads;
CREATE POLICY "v27_leads_service" ON public.leads FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.4 appointments RLS (Branch-scoped visibility)
DROP POLICY IF EXISTS "v27_appt_all" ON public.appointments;
CREATE POLICY "v27_appt_all" ON public.appointments FOR ALL TO authenticated
USING (
    public.is_platform_superadmin() OR
    (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND
        (
            public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR
            branch_id IS NULL OR
            branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(organization_id))
        )
    )
)
WITH CHECK (
    public.is_platform_superadmin() OR
    (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND
        (
            public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR
            branch_id IS NULL OR
            branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(organization_id))
        )
    )
);

DROP POLICY IF EXISTS "v27_appt_service" ON public.appointments;
CREATE POLICY "v27_appt_service" ON public.appointments FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.5 conversations RLS
DROP POLICY IF EXISTS "v27_conv_all" ON public.conversations;
CREATE POLICY "v27_conv_all" ON public.conversations FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_conv_service" ON public.conversations;
CREATE POLICY "v27_conv_service" ON public.conversations FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.6 chat_messages RLS
DROP POLICY IF EXISTS "v27_msg_all" ON public.chat_messages;
CREATE POLICY "v27_msg_all" ON public.chat_messages FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_msg_service" ON public.chat_messages;
CREATE POLICY "v27_msg_service" ON public.chat_messages FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.7 Webhook Reliability Tables RLS
DROP POLICY IF EXISTS "v27_dedup_all" ON public.processed_webhook_messages;
CREATE POLICY "v27_dedup_all" ON public.processed_webhook_messages FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_dedup_service" ON public.processed_webhook_messages;
CREATE POLICY "v27_dedup_service" ON public.processed_webhook_messages FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "v27_takeover_all" ON public.human_takeovers;
CREATE POLICY "v27_takeover_all" ON public.human_takeovers FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_takeover_service" ON public.human_takeovers;
CREATE POLICY "v27_takeover_service" ON public.human_takeovers FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "v27_escalations_all" ON public.escalation_events;
CREATE POLICY "v27_escalations_all" ON public.escalation_events FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_escalations_service" ON public.escalation_events;
CREATE POLICY "v27_escalations_service" ON public.escalation_events FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "v27_jobs_service" ON public.webhook_jobs;
CREATE POLICY "v27_jobs_service" ON public.webhook_jobs FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

