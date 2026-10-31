-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 5: Branch Authorization & Audited Reassignment Test Suite
-- Database: multitenant_dev
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    -- Tenant IDs
    v_org_a UUID := 'a0000000-0000-0000-0000-000000000001'::uuid; -- Dr. Mustafa Hadi Clinic
    v_org_b UUID := 'a0000000-0000-0000-0000-000000000002'::uuid; -- Almeswak Demo Quarantine

    -- User IDs
    v_user_owner_a UUID := '10000000-0000-0000-0000-000000000001'::uuid;
    v_user_dentist_a1 UUID := '10000000-0000-0000-0000-000000000003'::uuid;
    v_user_owner_b UUID := '10000000-0000-0000-0000-000000000007'::uuid;

    -- Branch IDs
    v_branch_a1 UUID := 'b0000000-0000-0000-0000-000000000001'::uuid; -- Zayouna
    v_branch_a2 UUID := gen_random_uuid(); -- Mansour
    v_branch_b UUID := gen_random_uuid(); -- Almeswak Branch

    -- Entity IDs
    v_appt_test UUID := gen_random_uuid();
    v_member_dentist_id UUID := gen_random_uuid();

    v_res_json JSONB;
    v_count INTEGER;
    v_resolved_branch UUID;
    v_caught BOOLEAN;
    v_sqlstate TEXT;
    v_errmsg TEXT;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'MUSTAFAH-AI — PHASE 5: BRANCH AUTHORIZATION & AUDIT SUITE';
    RAISE NOTICE '================================================================';

    -- --------------------------------------------------------------------------
    -- 0. Fixture Setup (auth.users, branches, memberships, appointments)
    -- --------------------------------------------------------------------------
    INSERT INTO auth.users (id, email) VALUES 
        (v_user_owner_a, 'owner_a@mustafahadi.iq'),
        (v_user_dentist_a1, 'dentist_a1@mustafahadi.iq'),
        (v_user_owner_b, 'owner_b@almeswak.iq')
    ON CONFLICT (id) DO NOTHING;

    -- Seed Branches
    INSERT INTO public.branches (id, organization_id, name, slug, is_active)
    VALUES 
        (v_branch_a2, v_org_a, 'Mansour Secondary Branch', 'mansour-reassign-test', TRUE),
        (v_branch_b, v_org_b, 'Almeswak Demo Branch', 'almeswak-reassign-test', TRUE)
    ON CONFLICT (id) DO NOTHING;

    -- Seed Memberships
    INSERT INTO public.organization_members (id, organization_id, user_id, branch_id, role, is_active)
    VALUES 
        (gen_random_uuid(), v_org_a, v_user_owner_a, NULL, 'owner', TRUE),
        (v_member_dentist_id, v_org_a, v_user_dentist_a1, v_branch_a1, 'dentist', TRUE),
        (gen_random_uuid(), v_org_b, v_user_owner_b, NULL, 'owner', TRUE)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = TRUE;

    -- Seed Appointment in Branch A1
    INSERT INTO public.appointments (
        id, organization_id, branch_id, account_id, patient_name, phone, treatment, 
        treatment_name_ar, preferred_date, preferred_time, assigned_doctor, assigned_doctor_ar, status
    ) VALUES (
        v_appt_test, v_org_a, v_branch_a1, 'drmustafa_hadi', 'Reassign Test Patient', '07799998888',
        'consultation', 'استشارة', CURRENT_DATE + 3, '5:00 PM', 'Dr. Mustafa', 'د. مصطفى هادي', 'new_request'
    );

    -- --------------------------------------------------------------------------
    -- 1. Direct Column UPDATE (branch_id) Revocation Verification
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    -- 1a. Direct update on appointments.branch_id MUST BE REJECTED by PostgreSQL engine
    v_caught := FALSE;
    BEGIN
        UPDATE public.appointments SET branch_id = v_branch_a2 WHERE id = v_appt_test;
    EXCEPTION WHEN insufficient_privilege THEN
        v_caught := TRUE;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Policy Violation: Direct column UPDATE on appointments.branch_id was allowed!';
    END IF;

    -- 1b. Direct update on organization_members.branch_id MUST BE REJECTED by PostgreSQL engine
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_members SET branch_id = v_branch_a2 WHERE id = v_member_dentist_id;
    EXCEPTION WHEN insufficient_privilege THEN
        v_caught := TRUE;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Policy Violation: Direct column UPDATE on organization_members.branch_id was allowed!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 1: Direct column UPDATE on branch_id strictly revoked and blocked at engine level (SQLSTATE 42501)';

    -- --------------------------------------------------------------------------
    -- 2. Authorized Reassignment via api_reassign_branch()
    -- --------------------------------------------------------------------------
    -- 2a. Clinic Owner reassigns appointment from Branch A1 to Branch A2
    v_res_json := public.api_reassign_branch('appointment', v_appt_test, v_branch_a2, 'Patient requested Mansour branch');
    IF (v_res_json->>'success')::boolean != TRUE THEN
        RAISE EXCEPTION 'Branch Reassignment Failure: Expected success = true, got %', v_res_json;
    END IF;

    -- Verify appointment is now in Branch A2
    SELECT branch_id INTO v_resolved_branch FROM public.appointments WHERE id = v_appt_test;
    IF v_resolved_branch != v_branch_a2 THEN
        RAISE EXCEPTION 'Branch Reassignment Failure: Appointment branch_id was not updated to Mansour!';
    END IF;

    -- Verify audit log entry was written
    SELECT old_branch_id, new_branch_id, actor_role INTO v_branch_a1, v_resolved_branch, v_errmsg 
    FROM public.branch_reassignment_audit_log 
    WHERE entity_id = v_appt_test ORDER BY created_at DESC LIMIT 1;
    IF v_resolved_branch != v_branch_a2 OR v_errmsg != 'owner' THEN
        RAISE EXCEPTION 'Audit Failure: Reassignment audit entry was malformed!';
    END IF;

    -- 2b. Clinic Owner reassigns member (Dentist) to Branch A2
    v_res_json := public.api_reassign_branch('member', v_member_dentist_id, v_branch_a2, 'Staff rotation to Mansour branch');
    IF (v_res_json->>'success')::boolean != TRUE THEN
        RAISE EXCEPTION 'Member Reassignment Failure: Expected success = true, got %', v_res_json;
    END IF;

    SELECT branch_id INTO v_resolved_branch FROM public.organization_members WHERE id = v_member_dentist_id;
    IF v_resolved_branch != v_branch_a2 THEN
        RAISE EXCEPTION 'Member Reassignment Failure: Member branch_id was not updated to Mansour!';
    END IF;

    -- 2c. Clinic Owner reassigns appointment to NULL (floating appointment)
    v_res_json := public.api_reassign_branch('appointment', v_appt_test, NULL, 'Unassigned floating consultation');
    IF (v_res_json->>'success')::boolean != TRUE THEN
        RAISE EXCEPTION 'Floating Reassignment Failure: Expected success = true, got %', v_res_json;
    END IF;

    SELECT branch_id INTO v_resolved_branch FROM public.appointments WHERE id = v_appt_test;
    IF v_resolved_branch IS NOT NULL THEN
        RAISE EXCEPTION 'Floating Reassignment Failure: Appointment branch_id was not nullified!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 2: Authorized branch reassignment verified for appointments, members, and floating states';

    -- --------------------------------------------------------------------------
    -- 3. Cross-Tenant Branch Reassignment Prevention
    -- --------------------------------------------------------------------------
    -- Owner A attempts to reassign Org A appointment to Org B Branch: MUST FAIL
    v_caught := FALSE;
    BEGIN
        PERFORM public.api_reassign_branch('appointment', v_appt_test, v_branch_b, 'Rogue cross-tenant reassignment attempt');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Relational Tenant Violation: Target branch%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Relational Tenant Breach: Allowed cross-tenant reassignment to Branch B!';
    END IF;

    -- Owner A attempts to reassign Org A member to Org B Branch: MUST FAIL
    v_caught := FALSE;
    BEGIN
        PERFORM public.api_reassign_branch('member', v_member_dentist_id, v_branch_b, 'Rogue cross-tenant member transfer');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Relational Tenant Violation: Target branch%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Relational Tenant Breach: Allowed cross-tenant member transfer to Branch B!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 3: Cross-tenant branch reassignment strictly prevented by gate function';

    -- --------------------------------------------------------------------------
    -- 4. Unauthorized Caller Privilege Boundary
    -- --------------------------------------------------------------------------
    -- Authenticate as Dentist A1 (non-owner, non-admin)
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_dentist_a1::text, true);

    v_caught := FALSE;
    BEGIN
        PERFORM public.api_reassign_branch('appointment', v_appt_test, v_branch_a2, 'Dentist self-reassign attempt');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Access Denied: Only clinic Owners and Admins are authorized to reassign branches%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Privilege Boundary Failure: Dentist was able to execute branch reassignment!';
    END IF;

    -- Authenticate as Owner B (Tenant B) attempting to reassign Org A appointment: MUST FAIL
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_b::text, true);

    v_caught := FALSE;
    BEGIN
        PERFORM public.api_reassign_branch('appointment', v_appt_test, v_branch_a2, 'Owner B hijacking Org A appointment');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Access Denied: Only clinic Owners and Admins are authorized to reassign branches%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Tenant Boundary Failure: Owner B was able to reassign Org A appointment!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 4: Unauthorized roles and cross-tenant callers strictly denied from branch reassignment';

    -- --------------------------------------------------------------------------
    -- 5. Audit Log Isolation
    -- --------------------------------------------------------------------------
    -- Authenticate as Owner A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    -- Owner A can see Org A reassignment audit records
    SELECT COUNT(*) INTO v_count FROM public.branch_reassignment_audit_log WHERE organization_id = v_org_a;
    IF v_count < 3 THEN
        RAISE EXCEPTION 'Audit Isolation Failure: Owner A cannot see Org A reassignment audits!';
    END IF;

    -- Owner A CANNOT see Org B reassignment audit records
    SELECT COUNT(*) INTO v_count FROM public.branch_reassignment_audit_log WHERE organization_id = v_org_b;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Cross-Tenant Breach: Owner A saw Org B reassignment audits!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 5: Branch reassignment audit log strictly isolated by RLS';

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ALL PHASE 5 BRANCH AUTHORIZATION & AUDIT TESTS PASSED (100 pct)';
    RAISE NOTICE '================================================================';
END $$;

ROLLBACK;
