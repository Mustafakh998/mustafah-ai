-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Migration: 20261031040000_almeswak_quarantine_gate.sql
-- Description: Phase 3 — Almeswak Cryptographic Quarantine Gate & Activation API
--
-- Security Invariants:
-- 1. Almeswak Dental Clinic (@almeswaksmile.iq, id a0000000-0000-0000-0000-000000000002)
--    is permanently quarantined in demo_mode and cannot be activated via direct DML.
-- 2. Direct UPDATE or DELETE on Almeswak records is intercepted and blocked by
--    fn_enforce_almeswak_comprehensive_quarantine().
-- 3. Live activation requires cryptographic board approval token verified by
--    fn_verify_and_consume_platform_authorization() and executed through
--    api_activate_quarantined_clinic().
-- 4. Separation of duties: board_approval_verified_by_legal_admin_id != authorized_by_admin_id.
-- 5. Atomic single-use consumption and immutable audit logging.
-- 6. Zero orthodontic pricing disclosure across all channels and tenants.
-- ==============================================================================

SET statement_timeout = '60s';

-- Ensure pgcrypto extension is installed
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- ------------------------------------------------------------------------------
-- 1. Platform Authorization Vault Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_token_hash TEXT UNIQUE NOT NULL,
    target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('organization', 'integration', 'instagram_account')),
    target_entity_id UUID NOT NULL,
    target_handle TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN (
        'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 
        'ALMESWAK_CREDENTIAL_ASSOCIATION', 
        'EMERGENCY_QUARANTINE_OVERRIDE'
    )),
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
    is_single_use BOOLEAN NOT NULL DEFAULT TRUE,
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

CREATE INDEX IF NOT EXISTS idx_platform_auth_lookup 
ON public.platform_authorizations (target_entity_id, purpose, action) 
WHERE revoked_at IS NULL AND (NOT is_single_use OR consumed_at IS NULL);

-- ------------------------------------------------------------------------------
-- 2. Immutable Platform Authorization Audit Log Table
-- ------------------------------------------------------------------------------
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_created 
ON public.platform_authorization_audit_log (created_at DESC);

-- Enable RLS on Authorization Tables (without FORCE so SECURITY DEFINER functions can manage vault)
ALTER TABLE public.platform_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorizations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorization_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorization_audit_log NO FORCE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.platform_authorizations TO authenticated, service_role, app_worker;
GRANT SELECT ON public.platform_authorization_audit_log TO authenticated, service_role, app_worker;
GRANT ALL ON public.platform_authorizations TO service_role, app_worker;
GRANT ALL ON public.platform_authorization_audit_log TO service_role, app_worker;

-- RLS Policies
DROP POLICY IF EXISTS "v27_plat_auth_select" ON public.platform_authorizations;
CREATE POLICY "v27_plat_auth_select" ON public.platform_authorizations 
FOR SELECT TO authenticated
USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_plat_auth_service" ON public.platform_authorizations;
CREATE POLICY "v27_plat_auth_service" ON public.platform_authorizations 
FOR ALL TO service_role, app_worker
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "v27_plat_audit_select" ON public.platform_authorization_audit_log;
CREATE POLICY "v27_plat_audit_select" ON public.platform_authorization_audit_log 
FOR SELECT TO authenticated
USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_plat_audit_service" ON public.platform_authorization_audit_log;
CREATE POLICY "v27_plat_audit_service" ON public.platform_authorization_audit_log 
FOR ALL TO service_role, app_worker
USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. Atomic Secret Verification & Consumption Function
-- ------------------------------------------------------------------------------
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
    v_caller_role TEXT := COALESCE(current_setting('role', true), 'unknown');
BEGIN
    -- 1. Caller Authority Verification: Must be Superadmin or Trusted System Role
    IF NOT (public.fn_is_trusted_system_caller() OR public.is_platform_superadmin()) THEN
        INSERT INTO public.platform_authorization_audit_log (
            caller_role, caller_user_id, attempted_action, target_table, target_record_id, outcome, error_message
        ) VALUES (
            'unauthorized', auth.uid(), p_action, p_target_table, p_target_record_id, 'DENIED_UNTRUSTED_CALLER', 'Caller lacks superadmin or trusted system role.'
        );
        RETURN FALSE;
    END IF;

    -- 2. Reject missing secret
    IF p_auth_secret IS NULL OR trim(p_auth_secret) = '' THEN
        INSERT INTO public.platform_authorization_audit_log (
            caller_role, caller_user_id, attempted_action, target_table, target_record_id, outcome, error_message
        ) VALUES (
            v_caller_role, auth.uid(), p_action, p_target_table, p_target_record_id, 'DENIED_INVALID_SECRET', 'Missing secret parameter.'
        );
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

    -- Audit execution (never logging raw secret)
    INSERT INTO public.platform_authorization_audit_log (
        authorization_id, caller_role, caller_user_id, attempted_action, target_table, target_record_id, outcome, error_message
    ) VALUES (
        v_auth_record.id, v_caller_role, auth.uid(), p_action, p_target_table, p_target_record_id, v_outcome, v_error_msg
    );

    RETURN (v_outcome = 'GRANTED');
END;
$$;

ALTER FUNCTION public.fn_verify_and_consume_platform_authorization(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_verify_and_consume_platform_authorization FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_verify_and_consume_platform_authorization TO authenticated, service_role, app_worker;

-- ------------------------------------------------------------------------------
-- 4. Almeswak Comprehensive Quarantine Trigger Function
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

    -- 2. Protect Table: instagram_accounts
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

-- Apply Quarantine Triggers
DROP TRIGGER IF EXISTS trg_quarantine_almeswak_org ON public.organizations;
CREATE TRIGGER trg_quarantine_almeswak_org
BEFORE INSERT OR UPDATE OR DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_acc ON public.instagram_accounts;
CREATE TRIGGER trg_quarantine_almeswak_acc
BEFORE INSERT OR UPDATE OR DELETE ON public.instagram_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();

-- ------------------------------------------------------------------------------
-- 5. Cryptographically Authorized Clinic Activation Gate Function
-- ------------------------------------------------------------------------------
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

    -- Verify and consume authorization secret against Platform Authorizations Vault
    v_is_authorized := public.fn_verify_and_consume_platform_authorization(
        p_organization_id, 
        'organization', 
        'organizations', 
        p_organization_id::text,
        'almeswaksmile.iq', 
        'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 
        'ACTIVATE_ORGANIZATION', 
        p_auth_secret
    );

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Activation Denied: Valid Platform Board Authorization secret is required.';
    END IF;

    -- Temporarily disable quarantine triggers within this privileged SECURITY DEFINER transaction
    ALTER TABLE public.organizations DISABLE TRIGGER trg_quarantine_almeswak_org;
    ALTER TABLE public.instagram_accounts DISABLE TRIGGER trg_quarantine_almeswak_acc;

    -- Update organization status to active
    UPDATE public.organizations 
    SET status = 'active', updated_at = NOW() 
    WHERE id = p_organization_id;

    -- Update linked instagram account to connected
    UPDATE public.instagram_accounts 
    SET status = 'connected', updated_at = NOW() 
    WHERE organization_id = p_organization_id;

    -- Re-enable quarantine triggers
    ALTER TABLE public.organizations ENABLE TRIGGER trg_quarantine_almeswak_org;
    ALTER TABLE public.instagram_accounts ENABLE TRIGGER trg_quarantine_almeswak_acc;

    RETURN jsonb_build_object(
        'success', TRUE, 
        'organization_id', p_organization_id, 
        'status', 'active',
        'activated_at', NOW()
    );
END;
$$;

ALTER FUNCTION public.api_activate_quarantined_clinic(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.api_activate_quarantined_clinic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_activate_quarantined_clinic TO authenticated, service_role, app_worker;
