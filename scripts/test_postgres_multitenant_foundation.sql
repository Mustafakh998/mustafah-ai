-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 1 Foundation: Hardened Real PostgreSQL Security & RLS Test Suite
-- Database: multitenant_dev
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    -- Test User IDs (auth.users)
    v_user_owner_a UUID := '10000000-0000-0000-0000-000000000001'::uuid;
    v_user_admin_a UUID := '10000000-0000-0000-0000-000000000002'::uuid;
    v_user_dentist_a1 UUID := '10000000-0000-0000-0000-000000000003'::uuid;
    v_user_reception_a1 UUID := '10000000-0000-0000-0000-000000000004'::uuid;
    v_user_staff_a2 UUID := '10000000-0000-0000-0000-000000000005'::uuid;
    v_user_inactive_a UUID := '10000000-0000-0000-0000-000000000006'::uuid;
    v_user_owner_b UUID := '10000000-0000-0000-0000-000000000007'::uuid;
    v_user_new_owner UUID := '10000000-0000-0000-0000-000000000008'::uuid;
    v_user_superadmin UUID := '10000000-0000-0000-0000-000000000009'::uuid;
    v_user_floating_staff UUID := '10000000-0000-0000-0000-000000000010'::uuid;
    v_nonexistent_user UUID := '10000000-0000-0000-0000-000000000099'::uuid;

    -- Test Org IDs
    v_org_a UUID := 'a0000000-0000-0000-0000-000000000001'::uuid; -- Dr. Mustafa Hadi Clinic
    v_org_b UUID := 'a0000000-0000-0000-0000-000000000002'::uuid; -- Almeswak Demo Quarantine
    v_org_suspended UUID := 'a0000000-0000-0000-0000-000000000003'::uuid; -- Suspended Clinic

    -- Test Branch IDs
    v_branch_a1 UUID := 'b0000000-0000-0000-0000-000000000001'::uuid; -- Org A Branch 1 (Zayouna)
    v_branch_a2 UUID := 'b0000000-0000-0000-0000-000000000002'::uuid; -- Org A Branch 2 (Mansour)
    v_branch_b UUID := 'b0000000-0000-0000-0000-000000000003'::uuid;  -- Org B Branch (Almeswak Demo)

    v_count INTEGER;
    v_status TEXT;
    v_tier TEXT;
    v_caught BOOLEAN;
    v_sqlstate TEXT;
    v_errmsg TEXT;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'MUSTAFAH-AI — PHASE 1: HARDENED POSTGRESQL SECURITY SUITE';
    RAISE NOTICE '================================================================';

    -- --------------------------------------------------------------------------
    -- 0. Fixture Seeding (System Setup)
    -- --------------------------------------------------------------------------
    INSERT INTO auth.users (id, email) VALUES 
        (v_user_owner_a, 'owner_a@mustafahadi.iq'),
        (v_user_admin_a, 'admin_a@mustafahadi.iq'),
        (v_user_dentist_a1, 'dentist_a1@mustafahadi.iq'),
        (v_user_reception_a1, 'reception_a1@mustafahadi.iq'),
        (v_user_staff_a2, 'staff_a2@mustafahadi.iq'),
        (v_user_inactive_a, 'inactive_a@mustafahadi.iq'),
        (v_user_owner_b, 'owner_b@almeswak.iq'),
        (v_user_new_owner, 'new_owner@mustafahadi.iq'),
        (v_user_superadmin, 'superadmin@mustafah-platform.iq'),
        (v_user_floating_staff, 'floating_staff@mustafahadi.iq')
    ON CONFLICT (id) DO NOTHING;

    -- Seed Suspended Organization for testing
    INSERT INTO public.organizations (id, slug, name, name_ar, status, tier)
    VALUES (v_org_suspended, 'suspended-clinic-test', 'Suspended Clinic', 'عيادة موقوفة', 'suspended', 'starter')
    ON CONFLICT (slug) DO UPDATE SET status = 'suspended', tier = 'starter';

    -- Ensure branches exist
    INSERT INTO public.branches (id, organization_id, name, slug, phone, address, is_main, is_active)
    VALUES 
        (v_branch_a1, v_org_a, 'Zayouna Main Branch', 'zayouna-main-test', '07768886667', 'Zayouna', TRUE, TRUE),
        (v_branch_a2, v_org_a, 'Mansour Secondary Branch', 'mansour-sec-test', '07768886668', 'Mansour', FALSE, TRUE),
        (v_branch_b, v_org_b, 'Almeswak Demo Main', 'almeswak-demo-main', '07700000000', 'Baghdad Demo', TRUE, TRUE)
    ON CONFLICT (id) DO NOTHING;

    -- Seed Memberships
    INSERT INTO public.organization_members (organization_id, user_id, branch_id, role, is_active)
    VALUES 
        (v_org_a, v_user_owner_a, NULL, 'owner', TRUE),              -- Floating Owner
        (v_org_a, v_user_admin_a, NULL, 'admin', TRUE),              -- Floating Admin
        (v_org_a, v_user_dentist_a1, v_branch_a1, 'dentist', TRUE),  -- Branch A1 Dentist
        (v_org_a, v_user_reception_a1, v_branch_a1, 'receptionist', TRUE), -- Branch A1 Receptionist
        (v_org_a, v_user_staff_a2, v_branch_a2, 'staff', TRUE),      -- Branch A2 Staff
        (v_org_a, v_user_inactive_a, v_branch_a1, 'staff', FALSE),   -- Inactive Member
        (v_org_a, v_user_floating_staff, NULL, 'staff', TRUE),       -- Branch-unassigned Staff
        (v_org_b, v_user_owner_b, v_branch_b, 'owner', TRUE),        -- Org B Owner
        (v_org_suspended, v_user_owner_a, NULL, 'owner', TRUE)       -- Owner A also owns Suspended Org
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET branch_id = EXCLUDED.branch_id, role = EXCLUDED.role, is_active = EXCLUDED.is_active;

    -- Seed Initial Superadmin
    INSERT INTO public.platform_superadmins (user_id, notes)
    VALUES (v_user_superadmin, 'Primary Platform Auditor')
    ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE '✅ [PASS] Step 0: Test fixtures seeded in auth.users, branches, members, and superadmins';

    -- --------------------------------------------------------------------------
    -- 1. Trusted System Caller Authorization Protection
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    -- Authenticated user must NOT be recognized as trusted system caller
    IF public.fn_is_trusted_system_caller() THEN
        RAISE EXCEPTION 'Security Breach: fn_is_trusted_system_caller() returned TRUE for authenticated user!';
    END IF;

    -- Manipulated GUCs must not grant system trust
    PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    IF public.fn_is_trusted_system_caller() THEN
        RAISE EXCEPTION 'Security Breach: fn_is_trusted_system_caller() allowed spoofed request.jwt.claims!';
    END IF;

    -- Reset spoofed settings
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    RAISE NOTICE '✅ [PASS] Test 1: Trusted system caller authorization strictly defended against role & GUC tampering';

    -- --------------------------------------------------------------------------
    -- 2. Subscription Tier and Organization Status Field Protection
    -- --------------------------------------------------------------------------
    -- 2a. Owner attempts to upgrade their own tier: Must fail with P0001
    v_caught := FALSE;
    BEGIN
        UPDATE public.organizations SET tier = 'enterprise' WHERE id = v_org_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Clinic members cannot modify subscription tier%' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'Unexpected error on tier modification: % (%)', v_sqlstate, v_errmsg;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Clinic owner was able to modify organization subscription tier!';
    END IF;

    -- 2b. Owner attempts to change status to demo_mode: Must fail with P0001
    v_caught := FALSE;
    BEGIN
        UPDATE public.organizations SET status = 'demo_mode' WHERE id = v_org_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Clinic members cannot modify organization status%' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'Unexpected error on status modification: % (%)', v_sqlstate, v_errmsg;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Clinic owner was able to modify organization status to demo_mode!';
    END IF;

    -- 2c. Owner attempts to reactivate a suspended organization: Must fail with P0001
    v_caught := FALSE;
    BEGIN
        UPDATE public.organizations SET status = 'active' WHERE id = v_org_suspended;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Clinic members cannot modify organization status%' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'Unexpected error on suspended reactivate: % (%)', v_sqlstate, v_errmsg;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Clinic owner was able to reactivate suspended organization!';
    END IF;

    -- 2d. Owner updates allowed profile field (name): Must succeed
    UPDATE public.organizations SET name = 'Dr. Mustafa Hadi Dental Clinic - Updated' WHERE id = v_org_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Profile Update Failure: Owner could not update allowed clinic name field.';
    END IF;

    -- 2e. Superadmin can update status and tier
    PERFORM set_config('request.jwt.claim.sub', v_user_superadmin::text, true);
    UPDATE public.organizations SET status = 'trialing' WHERE id = v_org_suspended;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Superadmin Admin Failure: Superadmin could not update organization status.';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 2: Subscription tier and organization status fields strictly protected against tenant mutation';

    -- --------------------------------------------------------------------------
    -- 3. Tenant Isolation & Cross-Tenant Read Defense
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    -- SELECT Org A: Allowed
    SELECT COUNT(*) INTO v_count FROM public.organizations WHERE id = v_org_a;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Isolation Failure: Owner A cannot read their own organization (count=%)', v_count;
    END IF;

    -- SELECT Org B: Denied (0 rows)
    SELECT COUNT(*) INTO v_count FROM public.organizations WHERE id = v_org_b;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Isolation Breach: Owner A can read Org B (count=%)', v_count;
    END IF;

    -- SELECT Org B branches: Denied (0 rows)
    SELECT COUNT(*) INTO v_count FROM public.branches WHERE organization_id = v_org_b;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Isolation Breach: Owner A can read branches of Org B (count=%)', v_count;
    END IF;

    -- SELECT Org B members: Denied (0 rows)
    SELECT COUNT(*) INTO v_count FROM public.organization_members WHERE organization_id = v_org_b;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Isolation Breach: Owner A can read members of Org B (count=%)', v_count;
    END IF;

    RAISE NOTICE '✅ [PASS] Test 3: Cross-tenant reads strictly blocked by RLS across all tables';

    -- --------------------------------------------------------------------------
    -- 4. Cross-Tenant Write Defense (INSERT, UPDATE, DELETE)
    -- --------------------------------------------------------------------------
    -- 4a. Cross-Tenant INSERT into branches
    v_caught := FALSE;
    BEGIN
        INSERT INTO public.branches (organization_id, name, slug)
        VALUES (v_org_b, 'Hacked Branch', 'hacked-branch');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        IF v_sqlstate IN ('42501', 'P0001', '23514') THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'Unexpected SQLSTATE on cross-tenant branch INSERT: % (%)', v_sqlstate, SQLERRM;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Allowed cross-tenant INSERT into branches!';
    END IF;

    -- 4b. Cross-Tenant INSERT into organization_members
    v_caught := FALSE;
    BEGIN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_b, v_user_new_owner, 'dentist');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        IF v_sqlstate IN ('42501', 'P0001', '23514') THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'Unexpected SQLSTATE on cross-tenant member INSERT: % (%)', v_sqlstate, SQLERRM;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Allowed cross-tenant INSERT into members!';
    END IF;

    -- 4c. Cross-Tenant UPDATE on branches (silent 0 rows updated)
    UPDATE public.branches SET name = 'Hacked Branch' WHERE organization_id = v_org_b;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Security Breach: Cross-tenant UPDATE on branches affected % rows!', v_count;
    END IF;

    -- 4d. Cross-Tenant UPDATE on organization_members (silent 0 rows updated)
    UPDATE public.organization_members SET role = 'staff' WHERE organization_id = v_org_b;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Security Breach: Cross-tenant UPDATE on organization_members affected % rows!', v_count;
    END IF;

    -- 4e. Cross-Tenant DELETE on branches (silent 0 rows deleted)
    DELETE FROM public.branches WHERE organization_id = v_org_b;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Security Breach: Cross-tenant DELETE on branches affected % rows!', v_count;
    END IF;

    -- 4f. Cross-Tenant DELETE on organization_members (silent 0 rows deleted)
    DELETE FROM public.organization_members WHERE organization_id = v_org_b;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Security Breach: Cross-tenant DELETE on organization_members affected % rows!', v_count;
    END IF;

    RAISE NOTICE '✅ [PASS] Test 4: Cross-tenant INSERT, UPDATE, and DELETE strictly prevented';

    -- --------------------------------------------------------------------------
    -- 5. Composite Relational Integrity & Tenant Mutation Lock
    -- --------------------------------------------------------------------------
    -- 5a. Cross-tenant branch attachment (Org A member with Org B branch)
    v_caught := FALSE;
    BEGIN
        INSERT INTO public.organization_members (organization_id, user_id, branch_id, role)
        VALUES (v_org_a, v_user_new_owner, v_branch_b, 'dentist');
    EXCEPTION WHEN foreign_key_violation THEN
        v_sqlstate := SQLSTATE;
        IF v_sqlstate = '23503' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Relational Breach: Composite FK permitted attaching Org B branch to Org A member!';
    END IF;

    -- 5b. Mutating organization_id on branches
    v_caught := FALSE;
    BEGIN
        UPDATE public.branches SET organization_id = v_org_b WHERE id = v_branch_a1;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Mutating organization_id on existing record is strictly prohibited%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Mutating organization_id was permitted on branches!';
    END IF;

    -- 5c. Mutating organization_id on organization_members
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET organization_id = v_org_b WHERE user_id = v_user_dentist_a1;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Mutating organization_id on membership is strictly prohibited%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Mutating organization_id was permitted on members!';
    END IF;

    -- 5d. Mutating user_id on organization_members
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET user_id = v_user_new_owner WHERE user_id = v_user_dentist_a1;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Mutating user_id on membership is strictly prohibited%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Mutating user_id was permitted on members!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 5: Composite FK (organization_id, branch_id) and immutability triggers strictly verified';

    -- --------------------------------------------------------------------------
    -- 6. Branch Authorization by Role & Peer Visibility
    -- --------------------------------------------------------------------------
    -- 6a. Owner (Floating): sees both branches in Org A
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);
    SELECT COUNT(*) INTO v_count FROM public.branches WHERE organization_id = v_org_a;
    IF v_count != 2 THEN
        RAISE EXCEPTION 'Branch Failure: Floating Owner expected 2 branches, saw %', v_count;
    END IF;

    -- 6b. Admin (Floating): sees both branches in Org A
    PERFORM set_config('request.jwt.claim.sub', v_user_admin_a::text, true);
    SELECT COUNT(*) INTO v_count FROM public.branches WHERE organization_id = v_org_a;
    IF v_count != 2 THEN
        RAISE EXCEPTION 'Branch Failure: Floating Admin expected 2 branches, saw %', v_count;
    END IF;

    -- 6c. Dentist (Branch A1): sees Branch A1, CANNOT see Branch A2
    PERFORM set_config('request.jwt.claim.sub', v_user_dentist_a1::text, true);
    SELECT COUNT(*) INTO v_count FROM public.branches WHERE id = v_branch_a1;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Branch Failure: Dentist A1 cannot see assigned branch!';
    END IF;
    SELECT COUNT(*) INTO v_count FROM public.branches WHERE id = v_branch_a2;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Branch Breach: Dentist A1 was able to view Branch A2 (Mansour)!';
    END IF;

    -- 6d. Dentist peer visibility: can see self, Branch A1 peer (Receptionist A1), and org leadership (Owner, Admin)
    SELECT COUNT(*) INTO v_count FROM public.organization_members WHERE user_id = v_user_reception_a1;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Peer Visibility Failure: Dentist A1 cannot see peer Receptionist A1!';
    END IF;
    SELECT COUNT(*) INTO v_count FROM public.organization_members WHERE user_id = v_user_owner_a;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Leadership Visibility Failure: Dentist A1 cannot see clinic Owner!';
    END IF;

    -- 6e. Dentist CANNOT see Branch A2 Staff
    SELECT COUNT(*) INTO v_count FROM public.organization_members WHERE user_id = v_user_staff_a2;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Branch Isolation Breach: Dentist A1 was able to see Staff member assigned to Branch A2!';
    END IF;

    -- 6f. Cross-branch UPDATE attempt by Dentist on Branch A2: Denied
    UPDATE public.branches SET name = 'Dentist Hack' WHERE id = v_branch_a2;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Branch Breach: Dentist was able to update Branch A2!';
    END IF;

    -- 6g. Cross-branch DELETE attempt by Dentist on Branch A2: Denied
    DELETE FROM public.branches WHERE id = v_branch_a2;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Branch Breach: Dentist was able to delete Branch A2!';
    END IF;

    -- 6h. Branch-unassigned ordinary staff member: Sees ZERO branches
    PERFORM set_config('request.jwt.claim.sub', v_user_floating_staff::text, true);
    SELECT COUNT(*) INTO v_count FROM public.branches WHERE organization_id = v_org_a;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Branch Least-Privilege Breach: Branch-unassigned staff was able to see branches (count=%)!', v_count;
    END IF;

    -- 6i. Branch-unassigned ordinary staff member: Sees only self and clinic leadership (Owner, Admin)
    -- Must NOT see peers assigned to specific branches
    SELECT COUNT(*) INTO v_count FROM public.organization_members WHERE user_id = v_user_floating_staff;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Self Visibility Failure: Floating staff cannot see own membership!';
    END IF;
    SELECT COUNT(*) INTO v_count FROM public.organization_members WHERE user_id = v_user_owner_a;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Leadership Visibility Failure: Floating staff cannot see clinic Owner!';
    END IF;
    SELECT COUNT(*) INTO v_count FROM public.organization_members WHERE user_id = v_user_dentist_a1;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Branch Isolation Breach: Floating staff was able to see Branch A1 Dentist!';
    END IF;
    SELECT COUNT(*) INTO v_count FROM public.organization_members WHERE user_id = v_user_staff_a2;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Branch Isolation Breach: Floating staff was able to see Branch A2 Staff!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 6: Branch-level authorization and least-privilege peer visibility strictly verified';

    -- --------------------------------------------------------------------------
    -- 7. Membership Privilege Escalation & Role Boundaries
    -- --------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_user_admin_a::text, true);

    -- Admin attempts to insert an Owner
    v_caught := FALSE;
    BEGIN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_a, v_user_new_owner, 'owner');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Only an active Owner can grant the Owner role%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Privilege Escalation: Admin was able to create an Owner!';
    END IF;

    -- Admin attempts to promote self to Owner
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET role = 'owner' WHERE user_id = v_user_admin_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Only an active Owner can grant the Owner role%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Privilege Escalation: Admin was able to self-promote to Owner!';
    END IF;

    -- Admin attempts to demote Owner A
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET role = 'admin' WHERE user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Admins cannot modify, demote, deactivate, or delete an Owner membership%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Privilege Escalation: Admin was able to demote Owner!';
    END IF;

    -- Admin attempts to delete Owner A
    v_caught := FALSE;
    BEGIN
        DELETE FROM public.organization_members WHERE user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Admins cannot modify, demote, deactivate, or delete an Owner membership%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Privilege Escalation: Admin was able to delete Owner!';
    END IF;

    -- Staff attempts to manage memberships: Denied
    PERFORM set_config('request.jwt.claim.sub', v_user_dentist_a1::text, true);
    v_caught := FALSE;
    BEGIN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_a, v_user_new_owner, 'staff');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%is not authorized to manage memberships%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Privilege Escalation: Dentist was able to insert member!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 7: Membership privilege escalation and RBAC rules strictly verified';

    -- --------------------------------------------------------------------------
    -- 8. Inactive Member & Anonymous Access Rejection
    -- --------------------------------------------------------------------------
    -- Inactive Member
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_inactive_a::text, true);

    SELECT COUNT(*) INTO v_count FROM public.organizations WHERE id = v_org_a;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Security Breach: Inactive member was able to select organization!';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.branches WHERE organization_id = v_org_a;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Security Breach: Inactive member was able to select branches!';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.organization_members WHERE organization_id = v_org_a;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Security Breach: Inactive member was able to select members!';
    END IF;

    -- Anonymous Role (Engine Privilege Rejection)
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    v_caught := FALSE;
    BEGIN
        SELECT COUNT(*) INTO v_count FROM public.organizations;
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLSTATE = '42501' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Anonymous caller was granted access to organizations!';
    END IF;

    v_caught := FALSE;
    BEGIN
        SELECT COUNT(*) INTO v_count FROM public.branches;
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLSTATE = '42501' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Anonymous caller was granted access to branches!';
    END IF;

    v_caught := FALSE;
    BEGIN
        SELECT COUNT(*) INTO v_count FROM public.organization_members;
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLSTATE = '42501' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Anonymous caller was granted access to members!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 8: Inactive members and anonymous callers strictly receive zero records / 42501';

    -- --------------------------------------------------------------------------
    -- 9. Human Platform Superadmin Separation & Audited Procedure
    -- --------------------------------------------------------------------------
    -- 9a. Superadmin grants new superadmin
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_superadmin::text, true);

    PERFORM public.api_manage_platform_superadmin('GRANT', v_user_new_owner, 'Secondary Auditor');
    SELECT COUNT(*) INTO v_count FROM public.platform_superadmins WHERE user_id = v_user_new_owner;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Superadmin Failure: Grant did not add record to platform_superadmins!';
    END IF;

    -- Verify audit log
    SELECT COUNT(*) INTO v_count FROM public.platform_superadmin_audit_log WHERE target_user_id = v_user_new_owner AND action = 'GRANT';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Superadmin Failure: Grant did not produce audit log!';
    END IF;

    -- 9b. Attempt to revoke nonexistent user: Must fail with P0001 and create zero audit records
    v_caught := FALSE;
    BEGIN
        PERFORM public.api_manage_platform_superadmin('REVOKE', v_nonexistent_user, 'Invalid Revoke');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%is not an active platform superadmin%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Superadmin Breach: Allowed revoking nonexistent superadmin without rejection!';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.platform_superadmin_audit_log WHERE target_user_id = v_nonexistent_user;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Audit Integrity Failure: False audit record was logged for nonexistent user!';
    END IF;

    -- 9c. Superadmin revokes v_user_new_owner
    PERFORM public.api_manage_platform_superadmin('REVOKE', v_user_new_owner, 'Revoking Secondary Auditor');
    SELECT COUNT(*) INTO v_count FROM public.platform_superadmins WHERE user_id = v_user_new_owner;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Superadmin Failure: Revoke did not remove record from platform_superadmins!';
    END IF;

    -- 9d. Service role attempts to grant superadmin: MUST BE REJECTED (Human superadmins only)
    PERFORM set_config('role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    v_caught := FALSE;
    BEGIN
        PERFORM public.api_manage_platform_superadmin('GRANT', v_user_new_owner, 'Automated Worker Escalation');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate IN ('P0001', '42501') AND (v_errmsg LIKE '%Only authenticated human platform superadmins%' OR v_errmsg LIKE '%permission denied%') THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Privilege Escalation Breach: service_role was able to call api_manage_platform_superadmin!';
    END IF;

    -- 9e. Service role attempts to call bootstrap: MUST BE REJECTED (postgres DBA only)
    v_caught := FALSE;
    BEGIN
        PERFORM public.api_bootstrap_initial_superadmin(v_user_new_owner, 'Automated Bootstrap Attempt');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate IN ('P0001', '42501') THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Privilege Escalation Breach: service_role was able to call api_bootstrap_initial_superadmin!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 9: Human platform superadmin authorization strictly separated from service_role';

    -- --------------------------------------------------------------------------
    -- 10. Last Active Owner Protection Across All Roles, Succession & Exceptional Procedures
    -- --------------------------------------------------------------------------
    -- 10a. Authenticated Owner attempts to demote, deactivate, or delete self as sole active owner
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    -- Demotion attempt
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET role = 'admin' WHERE user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Cannot demote, deactivate, or remove the final active Owner%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Sole active owner was able to demote self!';
    END IF;

    -- Deactivation attempt
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET is_active = FALSE WHERE user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Cannot demote, deactivate, or remove the final active Owner%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Sole active owner was able to deactivate self!';
    END IF;

    -- Deletion attempt
    v_caught := FALSE;
    BEGIN
        DELETE FROM public.organization_members WHERE organization_id = v_org_a AND user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Cannot demote, deactivate, or remove the final active Owner%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Sole active owner was able to delete self!';
    END IF;

    -- 10b. service_role attempts to demote, deactivate, or delete sole active owner: MUST BE REJECTED
    PERFORM set_config('role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    -- service_role demotion attempt
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET role = 'dentist' WHERE organization_id = v_org_a AND user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Cannot demote, deactivate, or remove the final active Owner%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: service_role was able to demote the sole active owner!';
    END IF;

    -- service_role deactivation attempt
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET is_active = FALSE WHERE organization_id = v_org_a AND user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Cannot demote, deactivate, or remove the final active Owner%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: service_role was able to deactivate the sole active owner!';
    END IF;

    -- service_role deletion attempt
    v_caught := FALSE;
    BEGIN
        DELETE FROM public.organization_members WHERE organization_id = v_org_a AND user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Cannot demote, deactivate, or remove the final active Owner%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: service_role was able to delete the sole active owner!';
    END IF;

    -- 10c. app_worker attempts to demote, deactivate, or delete sole active owner: MUST BE REJECTED
    PERFORM set_config('role', 'app_worker', true);

    -- app_worker demotion attempt
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET role = 'dentist' WHERE organization_id = v_org_a AND user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Cannot demote, deactivate, or remove the final active Owner%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: app_worker was able to demote the sole active owner!';
    END IF;

    -- app_worker deactivation attempt
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET is_active = FALSE WHERE organization_id = v_org_a AND user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Cannot demote, deactivate, or remove the final active Owner%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: app_worker was able to deactivate the sole active owner!';
    END IF;

    -- app_worker deletion attempt
    v_caught := FALSE;
    BEGIN
        DELETE FROM public.organization_members WHERE organization_id = v_org_a AND user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Cannot demote, deactivate, or remove the final active Owner%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: app_worker was able to delete the sole active owner!';
    END IF;

    -- 10d. Valid Multi-Owner Succession Workflow
    -- Step 1: Owner adds new co-owner
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
    VALUES (v_org_a, v_user_new_owner, 'owner', TRUE);

    -- Step 2: Former owner steps down to dentist (valid because 2 active owners now exist)
    UPDATE public.organization_members SET role = 'dentist' WHERE organization_id = v_org_a AND user_id = v_user_owner_a;

    SELECT COUNT(*) INTO v_count FROM public.organization_members WHERE organization_id = v_org_a AND role = 'owner' AND is_active = TRUE;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Owner Succession Failure: Expected 1 active owner after step-down (count=%)', v_count;
    END IF;

    -- 10e. Exceptional Owner Replacement Workflow (Audited Platform Superadmin Procedure)
    -- Platform superadmin executes emergency replacement of v_user_new_owner with v_user_owner_a
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_superadmin::text, true);

    PERFORM public.api_exceptional_owner_replacement(
        v_org_a,
        v_user_new_owner,
        v_user_owner_a,
        'Executive board emergency succession order #9021'
    );

    -- Verify new owner state: v_user_owner_a is now active owner, v_user_new_owner is demoted
    SELECT role, is_active INTO v_tier, v_caught FROM public.organization_members WHERE organization_id = v_org_a AND user_id = v_user_owner_a;
    IF v_tier != 'owner' OR v_caught != TRUE THEN
        RAISE EXCEPTION 'Exceptional Succession Failure: Target was not promoted to active owner!';
    END IF;

    SELECT role, is_active INTO v_tier, v_caught FROM public.organization_members WHERE organization_id = v_org_a AND user_id = v_user_new_owner;
    IF v_tier != 'staff' OR v_caught != FALSE THEN
        RAISE EXCEPTION 'Exceptional Succession Failure: Former owner was not demoted to inactive staff!';
    END IF;

    -- Verify exact audit log entry produced
    SELECT COUNT(*) INTO v_count 
    FROM public.platform_superadmin_audit_log 
    WHERE target_user_id = v_user_new_owner 
      AND performed_by = v_user_superadmin
      AND notes LIKE '%EXCEPTIONAL_OWNER_REPLACEMENT%';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Exceptional Succession Audit Failure: Audit log record missing or duplicate (count=%)', v_count;
    END IF;

    -- 10f. Security Violation: Non-superadmin cannot call exceptional replacement
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);
    v_caught := FALSE;
    BEGIN
        PERFORM public.api_exceptional_owner_replacement(v_org_a, v_user_owner_a, v_user_new_owner, 'Unauthorized Replace');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Only authenticated human platform superadmins%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Clinic owner was able to call api_exceptional_owner_replacement!';
    END IF;

    -- 10g. Security Violation: Tampered app.authorized_organization_deprovisioning GUC without superadmin
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);
    PERFORM set_config('app.authorized_organization_deprovisioning', 'TRUE', true);
    v_caught := FALSE;
    BEGIN
        DELETE FROM public.organization_members WHERE organization_id = v_org_a AND user_id = v_user_owner_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Unauthorized attempt to bypass last-owner protection without platform superadmin privileges%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Caller was able to bypass last-owner check with spoofed GUC! (% %)', v_sqlstate, v_errmsg;
    END IF;
    PERFORM set_config('app.authorized_organization_deprovisioning', 'FALSE', true);

    -- 10h. Verify Almeswak quarantine and pilot status
    PERFORM set_config('role', 'service_role', true);
    SELECT status INTO v_status FROM public.organizations WHERE slug = 'almeswak-demo';
    IF v_status != 'demo_mode' THEN
        RAISE EXCEPTION 'Quarantine Breach: Almeswak status is not demo_mode! (%)', v_status;
    END IF;

    SELECT status INTO v_status FROM public.organizations WHERE slug = 'drmustafa-hadi';
    IF v_status != 'active' THEN
        RAISE EXCEPTION 'Pilot Failure: Dr. Mustafa Hadi status is not active! (%)', v_status;
    END IF;

    RAISE NOTICE '✅ [PASS] Test 10: Last active owner protection strictly enforced across all roles; Succession & Exceptional procedures verified; Pilot active; Almeswak in demo_mode';

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ALL 10 REAL POSTGRESQL SECURITY SUITES PASSED (100%%)';
    RAISE NOTICE '================================================================';
END $$;

ROLLBACK;
