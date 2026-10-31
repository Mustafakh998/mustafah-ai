-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Migration: 20261031060000_multitenant_branch_reassignment.sql
-- Description: Phase 5 — Branch Authorization & Audited Reassignment Architecture
--
-- Security Invariants:
-- 1. Direct column-level UPDATE on branch_id is REVOKED from authenticated users
--    on appointments and organization_members at the PostgreSQL engine level.
-- 2. Branch reassignment can ONLY be executed through the trusted SECURITY DEFINER
--    gate function api_reassign_branch().
-- 3. api_reassign_branch() verifies caller authority (Owner, Admin, or Platform Superadmin).
-- 4. Cross-tenant branch reassignment is strictly rejected: target branch MUST belong
--    to the exact same organization as the target entity.
-- 5. Every reassignment is transactionally audited in public.branch_reassignment_audit_log.
-- ==============================================================================

SET statement_timeout = '60s';

-- ------------------------------------------------------------------------------
-- 1. Dedicated Immutable Branch Reassignment Audit Log
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branch_reassignment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('appointment', 'member')),
    entity_id UUID NOT NULL,
    actor_role TEXT NOT NULL,
    actor_user_id UUID,
    old_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    new_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    reassignment_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_branch_reassign_audit_org 
ON public.branch_reassignment_audit_log (organization_id, created_at DESC);

-- Permissions & RLS
GRANT SELECT ON public.branch_reassignment_audit_log TO authenticated, service_role, app_worker;
GRANT ALL ON public.branch_reassignment_audit_log TO service_role, app_worker;

ALTER TABLE public.branch_reassignment_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_reassignment_audit_log NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v27_reassign_audit_select" ON public.branch_reassignment_audit_log;
CREATE POLICY "v27_reassign_audit_select" ON public.branch_reassignment_audit_log 
FOR SELECT TO authenticated 
USING (
    public.is_platform_superadmin() OR
    (public.get_auth_org_role(organization_id) IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "v27_reassign_audit_service" ON public.branch_reassignment_audit_log;
CREATE POLICY "v27_reassign_audit_service" ON public.branch_reassignment_audit_log 
FOR ALL TO service_role, app_worker 
USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. Revoke Direct Column-Level UPDATE on branch_id
-- ------------------------------------------------------------------------------
-- Revoke table-level UPDATE from authenticated so column-level grants take effect
REVOKE UPDATE ON public.appointments FROM authenticated;
GRANT UPDATE (
    lead_id, patient_name, phone, treatment, treatment_name_ar, preferred_date, 
    preferred_time, assigned_doctor, assigned_doctor_ar, status, reception_notes, 
    confirmed_at
) ON public.appointments TO authenticated;

REVOKE UPDATE ON public.organization_members FROM authenticated;
GRANT UPDATE (role, is_active) ON public.organization_members TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Authorized Branch Reassignment Gate Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_reassign_branch(
    p_entity_type TEXT,
    p_entity_id UUID,
    p_new_branch_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id UUID;
    v_old_branch_id UUID;
    v_caller_role TEXT;
    v_actor_user_id UUID := auth.uid();
BEGIN
    -- 1. Entity Resolution and Lock
    IF p_entity_type = 'appointment' THEN
        SELECT organization_id, branch_id INTO v_org_id, v_old_branch_id 
        FROM public.appointments 
        WHERE id = p_entity_id 
        FOR UPDATE;
    ELSIF p_entity_type = 'member' THEN
        SELECT organization_id, branch_id INTO v_org_id, v_old_branch_id 
        FROM public.organization_members 
        WHERE id = p_entity_id 
        FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'Invalid entity type: %. Must be "appointment" or "member".', p_entity_type;
    END IF;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Entity % of type % not found.', p_entity_id, p_entity_type;
    END IF;

    -- 2. Caller Authority Verification
    IF v_actor_user_id IS NOT NULL THEN
        -- Human PostgREST / Supabase Caller
        IF NOT public.is_platform_superadmin() THEN
            v_caller_role := public.get_auth_org_role(v_org_id);
            IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
                RAISE EXCEPTION 'Access Denied: Only clinic Owners and Admins are authorized to reassign branches.';
            END IF;
        ELSE
            v_caller_role := 'platform_superadmin';
        END IF;
    ELSE
        -- System Caller Path
        IF NOT public.fn_is_trusted_system_caller() THEN
            RAISE EXCEPTION 'Access Denied: Untrusted system context cannot reassign branches.';
        END IF;
        v_caller_role := COALESCE(current_setting('role', true), 'service_role');
    END IF;

    -- 3. Cross-Tenant Target Branch Validation
    IF p_new_branch_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.branches 
            WHERE id = p_new_branch_id AND organization_id = v_org_id
        ) THEN
            RAISE EXCEPTION 'Relational Tenant Violation: Target branch % does not belong to organization %.', p_new_branch_id, v_org_id;
        END IF;
    END IF;

    -- 4. Execute Branch Reassignment
    IF p_entity_type = 'appointment' THEN
        UPDATE public.appointments 
        SET branch_id = p_new_branch_id, updated_at = NOW() 
        WHERE id = p_entity_id;
    ELSIF p_entity_type = 'member' THEN
        UPDATE public.organization_members 
        SET branch_id = p_new_branch_id, updated_at = NOW() 
        WHERE id = p_entity_id;
    END IF;

    -- 5. Append Immutable Audit Log
    INSERT INTO public.branch_reassignment_audit_log (
        organization_id, entity_type, entity_id, actor_role, actor_user_id, 
        old_branch_id, new_branch_id, reassignment_reason
    ) VALUES (
        v_org_id, p_entity_type, p_entity_id, v_caller_role, v_actor_user_id, 
        v_old_branch_id, p_new_branch_id, p_reason
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'entity_type', p_entity_type,
        'entity_id', p_entity_id,
        'old_branch_id', v_old_branch_id,
        'new_branch_id', p_new_branch_id,
        'organization_id', v_org_id
    );
END;
$$;

ALTER FUNCTION public.api_reassign_branch(TEXT, UUID, UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.api_reassign_branch FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_reassign_branch TO authenticated, service_role, app_worker;
