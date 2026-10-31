-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Migration: 20261031070000_multitenant_integration_vault.sql
-- Description: Phase 6 — Organization Integrations & AEAD Credentials Vault
--
-- Security Invariants:
-- 1. integration_credentials table stores AEAD-encrypted access tokens and is
--    EXCLUSIVELY system-managed. Authenticated users are DENIED (USING (false)).
-- 2. organization_integrations is partitioned by organization_id and protected by RLS.
-- 3. Almeswak integration (@almeswaksmile.iq, id 17841400000000001) is strictly
--    quarantined in demo_mode and guarded by trg_quarantine_almeswak_int.
-- 4. Composite foreign keys enforce tenant isolation across branches and credentials.
-- ==============================================================================

SET statement_timeout = '60s';

-- ------------------------------------------------------------------------------
-- 1. Organization Integrations Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    branch_id UUID,
    provider TEXT NOT NULL DEFAULT 'instagram_graph_api' CHECK (provider IN ('instagram_graph_api', 'whatsapp_business')),
    platform_account_id TEXT NOT NULL,
    platform_account_handle TEXT,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'demo_mode', 'disconnected', 'expired')),
    last_verified_at TIMESTAMPTZ,
    last_error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_integrations_org_id UNIQUE (organization_id, id),
    CONSTRAINT fk_integrations_branch_composite 
        FOREIGN KEY (organization_id, branch_id) 
        REFERENCES public.branches(organization_id, id) 
        ON UPDATE RESTRICT,
    CONSTRAINT uq_integrations_provider_account UNIQUE (organization_id, provider, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON public.organization_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_branch ON public.organization_integrations(organization_id, branch_id);

-- ------------------------------------------------------------------------------
-- 2. Isolated Server-Side Credential Vault (AEAD Encrypted, System-Only)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    integration_id UUID NOT NULL UNIQUE,
    encrypted_access_token TEXT NOT NULL,
    token_iv TEXT NOT NULL,
    token_auth_tag TEXT NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_credentials_org_id UNIQUE (organization_id, id),
    CONSTRAINT fk_vault_integration_composite 
        FOREIGN KEY (organization_id, integration_id) 
        REFERENCES public.organization_integrations(organization_id, id) 
        ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_credentials_org ON public.integration_credentials(organization_id);

-- ------------------------------------------------------------------------------
-- 3. Quarantine Trigger on Integrations
-- ------------------------------------------------------------------------------
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
            IF OLD.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
               OR OLD.id = 'a0000000-0000-0000-0000-000000000002'::uuid THEN
                RAISE EXCEPTION 'Quarantine Violation: Deleting Almeswak clinic organization is strictly prohibited through direct DML.';
            END IF;
            RETURN OLD;
        END IF;

        -- Intercept rename evasion
        IF TG_OP = 'UPDATE' THEN
            IF OLD.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
               AND NEW.slug NOT IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') THEN
                RAISE EXCEPTION 'Quarantine Violation: Renaming Almeswak organization to evade quarantine is prohibited.';
            END IF;
            IF OLD.slug NOT IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
               AND NEW.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') THEN
                RAISE EXCEPTION 'Quarantine Violation: Renaming another organization to claim Almeswak identity is prohibited.';
            END IF;
        END IF;

        -- Block direct status change away from demo_mode
        IF (NEW.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
            OR NEW.id = 'a0000000-0000-0000-0000-000000000002'::uuid) THEN
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

        IF (NEW.id = 'almeswaksmile_iq' OR NEW.handle ILIKE '%almeswaksmile%' OR
            (TG_OP = 'UPDATE' AND (OLD.id = 'almeswaksmile_iq' OR OLD.handle ILIKE '%almeswaksmile%'))) THEN
            
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                RAISE EXCEPTION 'Quarantine Violation: Live activation of account @almeswaksmile.iq is blocked by Platform Quarantine.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine TO authenticated, service_role, app_worker;

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_int ON public.organization_integrations;
CREATE TRIGGER trg_quarantine_almeswak_int
BEFORE INSERT OR UPDATE OR DELETE ON public.organization_integrations
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();

-- Safe Branch Deletion Trigger for Integrations
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_integrations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.organization_integrations 
    SET branch_id = NULL 
    WHERE organization_id = OLD.organization_id AND branch_id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_safe_orphan_integrations ON public.branches;
CREATE TRIGGER trg_safe_orphan_integrations
BEFORE DELETE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_integrations();

-- ------------------------------------------------------------------------------
-- 4. Permissions & Row Level Security (RLS)
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_integrations TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO service_role, app_worker;
GRANT SELECT ON public.integration_credentials TO authenticated; -- Evaluated by RLS policy below

-- Enable RLS
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials FORCE ROW LEVEL SECURITY;

-- 4.1 organization_integrations RLS
DROP POLICY IF EXISTS "v27_int_select" ON public.organization_integrations;
CREATE POLICY "v27_int_select" ON public.organization_integrations 
FOR SELECT TO authenticated 
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_int_modify" ON public.organization_integrations;
CREATE POLICY "v27_int_modify" ON public.organization_integrations 
FOR UPDATE TO authenticated 
USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin()) 
WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_int_insert" ON public.organization_integrations;
CREATE POLICY "v27_int_insert" ON public.organization_integrations 
FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_int_delete" ON public.organization_integrations;
CREATE POLICY "v27_int_delete" ON public.organization_integrations 
FOR DELETE TO authenticated 
USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_int_service" ON public.organization_integrations;
CREATE POLICY "v27_int_service" ON public.organization_integrations 
FOR ALL TO service_role, app_worker 
USING (true) WITH CHECK (true);

-- 4.2 integration_credentials RLS (STRICTLY SYSTEM-ONLY)
DROP POLICY IF EXISTS "v27_vault_deny_auth" ON public.integration_credentials;
CREATE POLICY "v27_vault_deny_auth" ON public.integration_credentials 
FOR ALL TO authenticated 
USING (false);

DROP POLICY IF EXISTS "v27_vault_service" ON public.integration_credentials;
CREATE POLICY "v27_vault_service" ON public.integration_credentials 
FOR ALL TO service_role, app_worker 
USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. Seed Founding Tenant & Demo Clinic Integrations
-- ------------------------------------------------------------------------------
INSERT INTO public.organization_integrations (
    id, organization_id, branch_id, provider, platform_account_id, platform_account_handle, status
) VALUES 
    (
        'e0000000-0000-0000-0000-000000000001'::uuid,
        'a0000000-0000-0000-0000-000000000001'::uuid,
        'b0000000-0000-0000-0000-000000000001'::uuid,
        'instagram_graph_api',
        '17841400000000000',
        'drmustafa_hadi',
        'connected'
    ),
    (
        'e0000000-0000-0000-0000-000000000002'::uuid,
        'a0000000-0000-0000-0000-000000000002'::uuid,
        NULL,
        'instagram_graph_api',
        '17841400000000001',
        'almeswaksmile.iq',
        'demo_mode'
    )
ON CONFLICT (organization_id, provider, platform_account_id) DO NOTHING;
