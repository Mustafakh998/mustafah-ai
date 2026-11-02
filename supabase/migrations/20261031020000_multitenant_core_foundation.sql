-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 1 Foundation: Core Multi-Tenant Architecture & RBAC Isolation
-- Version: 2026.10.31 (Hardened Production Standard)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Dedicated Application Roles (Strict Least Privilege)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN
        CREATE ROLE app_worker WITH NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform_admin') THEN
        CREATE ROLE app_platform_admin WITH NOLOGIN NOINHERIT;
    END IF;
END $$;

GRANT app_worker TO service_role;
REVOKE app_platform_admin FROM service_role; -- Superadmin is strictly human-held

-- ------------------------------------------------------------------------------
-- 2. Platform Superadmins & Audit Directory
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_superadmins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.platform_superadmin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL CHECK (action IN ('GRANT', 'REVOKE')),
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT NOT NULL
);

ALTER TABLE public.platform_superadmins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_superadmins FORCE ROW LEVEL SECURITY;

ALTER TABLE public.platform_superadmin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_superadmin_audit_log FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.platform_superadmins TO authenticated;
GRANT ALL ON public.platform_superadmins TO service_role, app_worker;

GRANT SELECT ON public.platform_superadmin_audit_log TO authenticated;
GRANT ALL ON public.platform_superadmin_audit_log TO service_role, app_worker;

-- 2.1 Helper function for policy definition
CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.platform_superadmins
        WHERE user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_platform_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_superadmin() TO authenticated, service_role;

DROP POLICY IF EXISTS "superadmins_select" ON public.platform_superadmins;
CREATE POLICY "superadmins_select" ON public.platform_superadmins 
    FOR SELECT TO authenticated 
    USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS "superadmins_service_only" ON public.platform_superadmins;
CREATE POLICY "superadmins_service_only" ON public.platform_superadmins 
    FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "superadmin_audit_select" ON public.platform_superadmin_audit_log;
CREATE POLICY "superadmin_audit_select" ON public.platform_superadmin_audit_log 
    FOR SELECT TO authenticated 
    USING (EXISTS (SELECT 1 FROM public.platform_superadmins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "superadmin_audit_service_only" ON public.platform_superadmin_audit_log;
CREATE POLICY "superadmin_audit_service_only" ON public.platform_superadmin_audit_log 
    FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. Organizations (Clinics) Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trialing', 'demo_mode')),
    tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'professional', 'enterprise')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. Branches (Multi-Branch Clinic Infrastructure)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_branch_org_id UNIQUE (organization_id, id),
    CONSTRAINT uq_branch_org_slug UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_branches_organization_id ON public.branches(organization_id);

-- ------------------------------------------------------------------------------
-- 5. Organization Members (RBAC & Membership Directory)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'dentist', 'receptionist', 'staff')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_member_org_user UNIQUE (organization_id, user_id),
    CONSTRAINT uq_member_org_id UNIQUE (organization_id, id),
    CONSTRAINT fk_members_branch_composite FOREIGN KEY (organization_id, branch_id)
        REFERENCES public.branches(organization_id, id) ON DELETE NO ACTION ON UPDATE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_members_organization_id ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_org_branch ON public.organization_members(organization_id, branch_id);

-- ------------------------------------------------------------------------------
-- 6. Hardened Security Definer Helper Functions
-- ------------------------------------------------------------------------------

-- 6.1 Trusted System Caller Verification
-- Rejects user-controlled GUCs and parameter tampering. Verifies actual database role.
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
    -- 1. Check transaction role setting (from PostgREST role switch or SET ROLE)
    BEGIN
        v_active_role := current_setting('role', false);
    EXCEPTION WHEN OTHERS THEN
        v_active_role := NULL;
    END;

    -- If active transaction role is explicitly authenticated or anon, it is NEVER trusted
    IF v_active_role IS NOT NULL AND v_active_role IN ('authenticated', 'anon') THEN
        RETURN FALSE;
    END IF;

    -- 2. Direct connection as dedicated service role or queue worker
    IF SESSION_USER IN ('service_role', 'app_worker') THEN
        RETURN TRUE;
    END IF;

    -- 3. PostgREST connection switching to service_role or app_worker
    -- Only valid when connection user is authenticator or postgres
    IF v_active_role IN ('service_role', 'app_worker') AND SESSION_USER IN ('authenticator', 'postgres') THEN
        RETURN TRUE;
    END IF;

    -- 4. Direct administrative connection (migrations/CLI DBA)
    IF SESSION_USER = 'postgres' AND (v_active_role IS NULL OR v_active_role = 'none') THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_is_trusted_system_caller() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_is_trusted_system_caller() TO authenticated, anon, service_role;

-- 6.2 Platform Superadmin Check
CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.platform_superadmins
        WHERE user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_platform_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_superadmin() TO authenticated, service_role;

-- 6.3 Secure Platform Superadmin Management Procedure (Human Superadmins Only)
-- Serialized with transaction-level advisory mutex; human-only authentication; validates target existence.
CREATE OR REPLACE FUNCTION public.api_manage_platform_superadmin(
    p_action TEXT,
    p_target_user_id UUID,
    p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_superadmin_count INTEGER;
    v_target_exists BOOLEAN;
BEGIN
    -- 1. Concurrency Serialization: Acquire transactional advisory lock
    PERFORM pg_advisory_xact_lock(hashtext('platform_superadmin_mutex'));

    -- 2. Strict Human Superadmin Authentication Check
    -- Neither service_role nor background workers nor ordinary clinic users can manage superadmins.
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL OR NOT public.is_platform_superadmin() THEN
        RAISE EXCEPTION 'Access Denied: Only authenticated human platform superadmins may manage superadmin privileges.';
    END IF;

    -- Validate notes parameter
    IF p_notes IS NULL OR length(trim(p_notes)) < 3 THEN
        RAISE EXCEPTION 'Audit Validation Error: Detailed notes (min 3 chars) are required for all platform superadmin mutations.';
    END IF;

    IF p_action = 'GRANT' THEN
        -- Check if target user exists in auth.users
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
            RAISE EXCEPTION 'Target user % does not exist in auth.users.', p_target_user_id;
        END IF;

        INSERT INTO public.platform_superadmins (user_id, granted_by, notes)
        VALUES (p_target_user_id, v_caller_id, p_notes)
        ON CONFLICT (user_id) DO UPDATE SET notes = EXCLUDED.notes;

        INSERT INTO public.platform_superadmin_audit_log (action, target_user_id, performed_by, notes)
        VALUES ('GRANT', p_target_user_id, v_caller_id, p_notes);

    ELSIF p_action = 'REVOKE' THEN
        -- Check if target user actually exists in platform_superadmins
        SELECT EXISTS (
            SELECT 1 FROM public.platform_superadmins WHERE user_id = p_target_user_id
        ) INTO v_target_exists;

        IF NOT v_target_exists THEN
            RAISE EXCEPTION 'Target user % is not an active platform superadmin.', p_target_user_id;
        END IF;

        -- Concurrency-Safe Last Superadmin Protection (Evaluated under mutex lock)
        SELECT COUNT(*) INTO v_superadmin_count FROM public.platform_superadmins;
        IF v_superadmin_count <= 1 THEN
            RAISE EXCEPTION 'Security Policy Violation: Cannot revoke the final platform superadmin.';
        END IF;

        DELETE FROM public.platform_superadmins WHERE user_id = p_target_user_id;

        INSERT INTO public.platform_superadmin_audit_log (action, target_user_id, performed_by, notes)
        VALUES ('REVOKE', p_target_user_id, v_caller_id, p_notes);
    ELSE
        RAISE EXCEPTION 'Invalid action %: must be GRANT or REVOKE.', p_action;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.api_manage_platform_superadmin(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_manage_platform_superadmin(TEXT, UUID, TEXT) TO authenticated; -- Human superadmins only (NOT service_role)

-- 6.4 Separately Controlled Initial Superadmin Bootstrap Procedure
-- Restricted strictly to direct database administrator (postgres); single-use only.
CREATE OR REPLACE FUNCTION public.api_bootstrap_initial_superadmin(
    p_initial_user_id UUID,
    p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_count INTEGER;
BEGIN
    -- Transactional advisory lock
    PERFORM pg_advisory_xact_lock(hashtext('platform_superadmin_mutex'));

    -- Strictly restricted to direct database superuser/migration administrator
    IF SESSION_USER != 'postgres' THEN
        RAISE EXCEPTION 'Access Denied: Initial platform superadmin bootstrap can only be executed by the database administrator.';
    END IF;

    -- Verify target user exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_initial_user_id) THEN
        RAISE EXCEPTION 'Target user % does not exist in auth.users.', p_initial_user_id;
    END IF;

    -- Strictly single-use: rejected if any superadmin already exists
    SELECT COUNT(*) INTO v_existing_count FROM public.platform_superadmins;
    IF v_existing_count > 0 THEN
        RAISE EXCEPTION 'Security Policy Violation: Initial bootstrap is disabled because % platform superadmin(s) already exist.', v_existing_count;
    END IF;

    INSERT INTO public.platform_superadmins (user_id, granted_by, notes)
    VALUES (p_initial_user_id, NULL, p_notes);

    INSERT INTO public.platform_superadmin_audit_log (action, target_user_id, performed_by, notes)
    VALUES ('GRANT', p_initial_user_id, NULL, 'BOOTSTRAP: ' || p_notes);
END;
$$;

REVOKE ALL ON FUNCTION public.api_bootstrap_initial_superadmin(UUID, TEXT) FROM PUBLIC;
-- Only postgres can run bootstrap. NOT granted to authenticated or service_role!

-- 6.4 Authenticated User Organizations
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

REVOKE ALL ON FUNCTION public.get_auth_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_org_ids() TO authenticated, service_role;

-- 6.5 Authenticated User Role in Specific Organization
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

REVOKE ALL ON FUNCTION public.get_auth_org_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_org_role(UUID) TO authenticated, service_role;

-- 6.6 Authenticated User Branch IDs
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

REVOKE ALL ON FUNCTION public.get_auth_branch_ids(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_branch_ids(UUID) TO authenticated, service_role;

-- 6.7 Check If Authenticated User is a Floating Member
CREATE OR REPLACE FUNCTION public.is_org_floating_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE user_id = auth.uid()
          AND organization_id = p_org_id
          AND is_active = TRUE
          AND branch_id IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.is_org_floating_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_floating_member(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. Organization Mutation & Tenant Protection Trigger Functions
-- ------------------------------------------------------------------------------

-- 7.1 Organization Mutation Rules (Protects tier, status, slug, and id)
CREATE OR REPLACE FUNCTION public.fn_enforce_organization_mutation_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Immutability of organization primary key (id) and unique slug
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Security Policy Violation: Mutating organization id is strictly prohibited.';
    END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
        RAISE EXCEPTION 'Security Policy Violation: Mutating organization slug is strictly prohibited.';
    END IF;

    -- 2. Platform Superadmins and Trusted System Callers are authorized for administrative updates
    IF public.is_platform_superadmin() OR public.fn_is_trusted_system_caller() THEN
        RETURN NEW;
    END IF;

    -- 3. Clinic Owners/Members: Strictly prohibited from modifying billing & administrative fields
    IF NEW.tier IS DISTINCT FROM OLD.tier THEN
        RAISE EXCEPTION 'Security Policy Violation: Clinic members cannot modify subscription tier. Tier changes require platform billing administration.';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Security Policy Violation: Clinic members cannot modify organization status. Status changes require platform administration.';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_enforce_organization_mutation_rules() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_enforce_organization_mutation_rules() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_enforce_organization_mutation_rules ON public.organizations;
CREATE TRIGGER trg_enforce_organization_mutation_rules
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_organization_mutation_rules();

-- 7.2 Universal Tenant Mutation Lock Trigger Function
CREATE OR REPLACE FUNCTION public.fn_prevent_tenant_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'Security Policy Violation: Mutating organization_id on existing record is strictly prohibited.';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_prevent_tenant_mutation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_prevent_tenant_mutation() TO authenticated, service_role;

-- Apply Tenant Mutation Lock Triggers
DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_branches ON public.branches;
CREATE TRIGGER trg_prevent_tenant_mutation_branches
BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_members ON public.organization_members;
CREATE TRIGGER trg_prevent_tenant_mutation_members
BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

-- ------------------------------------------------------------------------------
-- 8. Concurrency-Safe Member Privilege Boundaries Trigger Function & Exceptional Procedures
-- ------------------------------------------------------------------------------

-- 8.1 Exceptional Owner Replacement Procedure (Human Platform Superadmins Only)
-- Dedicated, explicit, and audited procedure for emergency owner succession
CREATE OR REPLACE FUNCTION public.api_exceptional_owner_replacement(
    p_organization_id UUID,
    p_target_owner_id UUID,
    p_new_owner_id UUID,
    p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_target_is_owner BOOLEAN;
BEGIN
    -- 1. Mutex / Transactional lock on organization
    PERFORM 1 FROM public.organizations WHERE id = p_organization_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization % not found.', p_organization_id;
    END IF;

    -- 2. Strict Authentication: Must be authenticated human platform superadmin
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL OR NOT public.is_platform_superadmin() THEN
        RAISE EXCEPTION 'Access Denied: Only authenticated human platform superadmins may execute exceptional owner replacement.';
    END IF;

    -- Validate notes parameter
    IF p_notes IS NULL OR length(trim(p_notes)) < 5 THEN
        RAISE EXCEPTION 'Audit Validation Error: Detailed notes (min 5 chars) are required for exceptional owner replacement.';
    END IF;

    -- Verify target user is currently an active owner
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = p_organization_id
          AND user_id = p_target_owner_id
          AND role = 'owner'
          AND is_active = TRUE
    ) INTO v_target_is_owner;

    IF NOT v_target_is_owner THEN
        RAISE EXCEPTION 'Target user % is not an active owner of organization %.', p_target_owner_id, p_organization_id;
    END IF;

    -- Verify new owner exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_new_owner_id) THEN
        RAISE EXCEPTION 'New owner user % does not exist in auth.users.', p_new_owner_id;
    END IF;

    -- Step A: Ensure new owner is active owner first (maintains invariant)
    INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
    VALUES (p_organization_id, p_new_owner_id, 'owner', TRUE)
    ON CONFLICT (organization_id, user_id) DO UPDATE 
    SET role = 'owner', is_active = TRUE;

    -- Step B: Demote previous target owner to staff
    UPDATE public.organization_members
    SET role = 'staff', is_active = FALSE
    WHERE organization_id = p_organization_id
      AND user_id = p_target_owner_id;

    -- Step C: Log to platform audit trail
    INSERT INTO public.platform_superadmin_audit_log (action, target_user_id, performed_by, notes)
    VALUES ('REVOKE', p_target_owner_id, v_caller_id, 'EXCEPTIONAL_OWNER_REPLACEMENT: Replaced by ' || p_new_owner_id::text || '. ' || p_notes);
END;
$$;

REVOKE ALL ON FUNCTION public.api_exceptional_owner_replacement(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_exceptional_owner_replacement(UUID, UUID, UUID, TEXT) TO authenticated;

-- 8.2 Exceptional Organization Deprovisioning Procedure
-- Dedicated, explicit procedure for safely decommissioning / deleting an organization and its cascade
CREATE OR REPLACE FUNCTION public.api_deprovision_organization(
    p_organization_id UUID,
    p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    -- Only platform superadmins or direct postgres administrator
    IF SESSION_USER = 'postgres' THEN
        v_caller_id := NULL;
    ELSIF auth.uid() IS NOT NULL AND public.is_platform_superadmin() THEN
        v_caller_id := auth.uid();
    ELSE
        RAISE EXCEPTION 'Access Denied: Only platform superadmins or database administrator may deprovision organizations.';
    END IF;

    IF p_notes IS NULL OR length(trim(p_notes)) < 3 THEN
        RAISE EXCEPTION 'Audit Validation Error: Detailed notes are required for organization deprovisioning.';
    END IF;

    -- Lock organization
    PERFORM 1 FROM public.organizations WHERE id = p_organization_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization % not found.', p_organization_id;
    END IF;

    -- Authorize deprovisioning in transaction setting so member cascade delete is permitted
    PERFORM set_config('app.authorized_organization_deprovisioning', 'TRUE', true);

    -- Delete organization (cascades to branches and members)
    DELETE FROM public.organizations WHERE id = p_organization_id;

    IF v_caller_id IS NOT NULL THEN
        INSERT INTO public.platform_superadmin_audit_log (action, target_user_id, performed_by, notes)
        VALUES ('REVOKE', v_caller_id, v_caller_id, 'DEPROVISION_ORGANIZATION: ' || p_organization_id::text || '. ' || p_notes);
    END IF;

    PERFORM set_config('app.authorized_organization_deprovisioning', 'FALSE', true);
END;
$$;

REVOKE ALL ON FUNCTION public.api_deprovision_organization(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_deprovision_organization(UUID, TEXT) TO authenticated, service_role;

-- 8.3 Concurrency-Safe Member Privilege Boundaries Trigger Function
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

    -- 1. Immutability of organization_id and user_id on existing memberships
    IF TG_OP = 'UPDATE' THEN
        IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
            RAISE EXCEPTION 'Security Policy Violation: Mutating organization_id on membership is strictly prohibited.';
        END IF;
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Security Policy Violation: Mutating user_id on membership is strictly prohibited.';
        END IF;
    END IF;

    -- 2. Concurrency Serialization: Acquire exclusive row lock on organization
    PERFORM 1
    FROM public.organizations
    WHERE id = v_target_org_id
    FOR UPDATE;

    -- 3. Execution Path Segregation
    IF public.fn_is_trusted_system_caller() THEN
        -- Path A: Trusted System Caller (service_role / migrations / automated workers)
        -- Allowed to perform legitimate member provisioning / management
        NULL;
    ELSIF auth.uid() IS NOT NULL THEN
        -- Path B: Authenticated User
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
                RAISE EXCEPTION 'Access Denied: Role % is not authorized to manage memberships. Only active Owners and Admins may manage memberships.', v_caller_role;
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
        -- Path C: Unauthenticated and untrusted context rejected
        RAISE EXCEPTION 'Security Policy Violation: Unauthenticated context rejected.';
    END IF;

    -- 4. Last Active Owner Protection (Evaluated under serialized row lock)
    -- Enforced absolutely for ALL callers: authenticated users, service_role, and app_worker.
    -- No system worker, service role, or clinic member can ever demote, deactivate, or remove
    -- the final active owner of an organization.
    IF (TG_OP = 'DELETE' AND OLD.role = 'owner' AND OLD.is_active = TRUE) OR 
       (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND OLD.is_active = TRUE AND (NEW.role != 'owner' OR NEW.is_active = FALSE)) THEN
        
        -- Check if organization is being deprovisioned via authorized deprovisioning procedure
        IF current_setting('app.authorized_organization_deprovisioning', true) = 'TRUE' THEN
            -- Only permitted when executing inside api_deprovision_organization
            IF public.is_platform_superadmin() OR (SESSION_USER = 'postgres' AND (current_setting('role', true) IS NULL OR current_setting('role', true) = 'none')) THEN
                RETURN OLD;
            ELSE
                RAISE EXCEPTION 'Security Policy Violation: Unauthorized attempt to bypass last-owner protection without platform superadmin privileges.';
            END IF;
        END IF;

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

REVOKE ALL ON FUNCTION public.fn_enforce_member_privilege_boundaries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_enforce_member_privilege_boundaries() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_enforce_member_privileges ON public.organization_members;
CREATE TRIGGER trg_enforce_member_privileges
BEFORE INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_member_privilege_boundaries();

-- ------------------------------------------------------------------------------
-- 9. Table Privilege Grants & Row Level Security (RLS)
-- ------------------------------------------------------------------------------
-- ARCHITECTURAL SPECIFICATION & RLS OWNERSHIP DOCUMENTATION:
-- Table Owner: postgres
-- RLS Behavior for Table Owner: In PostgreSQL, table owners and superusers bypass
--   table RLS by default unless FORCE ROW LEVEL SECURITY is enabled.
-- Security Definer Helpers Execution Context: get_auth_org_ids(), get_auth_org_role(),
--   and get_auth_branch_ids() execute as the function owner (postgres).
-- FORCE ROW LEVEL SECURITY Decision:
--   - organizations and branches have FORCE ROW LEVEL SECURITY enabled, ensuring all
--     sessions (including owners) must satisfy explicit policies.
--   - organization_members has ENABLE ROW LEVEL SECURITY without FORCE ROW LEVEL SECURITY.
--     Enabling FORCE on organization_members would cause infinite recursion
--     ("infinite recursion detected in policy for relation organization_members") because
--     security-definer helper functions called within the policy would themselves be subjected
--     to RLS on organization_members.
--   - Authenticated users are strictly bounded by RLS policies on organization_members.
--   - service_role and app_worker are bounded by explicit policies and triggers.
-- Branch-Unassigned Member Visibility:
--   - Only 'owner' and 'admin' roles (leadership) have organization-wide branch and member visibility.
--   - Ordinary members (dentists, receptionists, staff) who are unassigned to a branch (branch_id IS NULL)
--     see 0 branches and see only themselves and clinic leadership (owners/admins).
-- ------------------------------------------------------------------------------

GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role, app_worker;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role, app_worker;

GRANT SELECT, INSERT, DELETE ON public.organization_members TO authenticated;
GRANT UPDATE (role, is_active) ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role, app_worker;

-- 9.1 organizations RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v27_org_select" ON public.organizations;
CREATE POLICY "v27_org_select" ON public.organizations 
    FOR SELECT TO authenticated 
    USING (id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_org_update" ON public.organizations;
CREATE POLICY "v27_org_update" ON public.organizations 
    FOR UPDATE TO authenticated 
    USING (public.get_auth_org_role(id) = 'owner' OR public.is_platform_superadmin()) 
    WITH CHECK (public.get_auth_org_role(id) = 'owner' OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_org_service" ON public.organizations;
CREATE POLICY "v27_org_service" ON public.organizations 
    FOR ALL TO service_role, app_worker 
    USING (true) WITH CHECK (true);

-- 9.2 branches RLS (Branch-Level Authorization Enforced)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v27_br_select" ON public.branches;
CREATE POLICY "v27_br_select" ON public.branches 
    FOR SELECT TO authenticated 
    USING (
        public.is_platform_superadmin() OR
        (
            organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND
            (
                public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR
                id IN (SELECT branch_id FROM public.get_auth_branch_ids(organization_id))
            )
        )
    );

DROP POLICY IF EXISTS "v27_br_insert" ON public.branches;
CREATE POLICY "v27_br_insert" ON public.branches 
    FOR INSERT TO authenticated 
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_br_update" ON public.branches;
CREATE POLICY "v27_br_update" ON public.branches 
    FOR UPDATE TO authenticated 
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin()) 
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_br_delete" ON public.branches;
CREATE POLICY "v27_br_delete" ON public.branches 
    FOR DELETE TO authenticated 
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_br_service" ON public.branches;
CREATE POLICY "v27_br_service" ON public.branches 
    FOR ALL TO service_role, app_worker 
    USING (true) WITH CHECK (true);

-- 9.3 organization_members RLS (Branch and Role Scoped)
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v27_mem_select" ON public.organization_members;
CREATE POLICY "v27_mem_select" ON public.organization_members 
    FOR SELECT TO authenticated 
    USING (
        public.is_platform_superadmin() OR
        (user_id = auth.uid() AND is_active = TRUE) OR
        (
            organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND
            (
                -- Owners and Admins have org-wide visibility
                public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR
                -- Branch-assigned members: see peers in same branch OR org leadership (owner/admin)
                (
                    organization_members.branch_id IS NOT NULL AND
                    organization_members.branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(organization_id))
                ) OR
                organization_members.role IN ('owner', 'admin')
            )
        )
    );

DROP POLICY IF EXISTS "v27_mem_insert" ON public.organization_members;
CREATE POLICY "v27_mem_insert" ON public.organization_members 
    FOR INSERT TO authenticated 
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_mem_update" ON public.organization_members;
CREATE POLICY "v27_mem_update" ON public.organization_members 
    FOR UPDATE TO authenticated 
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin()) 
    WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_mem_delete" ON public.organization_members;
CREATE POLICY "v27_mem_delete" ON public.organization_members 
    FOR DELETE TO authenticated 
    USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_mem_service" ON public.organization_members;
CREATE POLICY "v27_mem_service" ON public.organization_members 
    FOR ALL TO service_role, app_worker 
    USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 10. Non-Destructive Founding Tenant & Quarantined Demo Seed Records
-- ------------------------------------------------------------------------------
-- Uses ON CONFLICT DO NOTHING so that manual customizations, contact info,
-- and live settings are NEVER overwritten or reset upon migration reruns.
INSERT INTO public.organizations (id, slug, name, name_ar, status, tier)
VALUES 
    (
        'a0000000-0000-0000-0000-000000000001'::uuid, 
        'drmustafa-hadi', 
        'Dr. Mustafa Hadi Dental Clinic', 
        'عيادة د. مصطفى هادي لطب الأسنان', 
        'active', 
        'professional'
    ),
    (
        'a0000000-0000-0000-0000-000000000002'::uuid, 
        'almeswak-demo', 
        'Almeswak Dental Clinic (Demo Mode)', 
        'مركز المسواك لطب الأسنان (النسخة التجريبية)', 
        'demo_mode', 
        'enterprise'
    )
ON CONFLICT (slug) DO NOTHING;

-- Seed Primary Branch for Dr. Mustafa Hadi Clinic (Non-Destructive)
INSERT INTO public.branches (id, organization_id, name, slug, phone, address, is_main, is_active)
VALUES 
    (
        'b0000000-0000-0000-0000-000000000001'::uuid,
        'a0000000-0000-0000-0000-000000000001'::uuid,
        'Baghdad Main Center - Zayouna',
        'baghdad-zayouna',
        '07768886667',
        'بغداد - زيونة - مقابل دريم سيتي مول',
        TRUE,
        TRUE
    )
ON CONFLICT (organization_id, slug) DO NOTHING;
