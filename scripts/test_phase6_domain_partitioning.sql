-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 2: Relational Domain Partitioning & Composite Key Security Test Suite
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
    v_branch_a1 UUID := 'b0000000-0000-0000-0000-000000000001'::uuid;
    v_branch_del UUID := gen_random_uuid();

    -- Entity IDs
    v_lead_a UUID := gen_random_uuid();
    v_lead_b UUID := gen_random_uuid();
    v_appt_a UUID := gen_random_uuid();
    v_appt_branch UUID := gen_random_uuid();
    v_conv_a TEXT := 'conv_test_org_a_' || substring(gen_random_uuid()::text, 1, 8);
    v_conv_b TEXT := 'conv_test_org_b_' || substring(gen_random_uuid()::text, 1, 8);
    v_conv_del TEXT := 'conv_test_del_' || substring(gen_random_uuid()::text, 1, 8);
    v_takeover_del UUID := gen_random_uuid();
    v_escalation_del UUID := gen_random_uuid();

    v_count INTEGER;
    v_caught BOOLEAN;
    v_sqlstate TEXT;
    v_errmsg TEXT;
    v_resolved_org UUID;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'MUSTAFAH-AI — PHASE 2: RELATIONAL DOMAIN PARTITIONING SUITE';
    RAISE NOTICE '================================================================';

    -- --------------------------------------------------------------------------
    -- 0. Fixtures Setup (Users & Memberships)
    -- --------------------------------------------------------------------------
    INSERT INTO auth.users (id, email) VALUES 
        (v_user_owner_a, 'owner_a@mustafahadi.iq'),
        (v_user_dentist_a1, 'dentist_a1@mustafahadi.iq'),
        (v_user_owner_b, 'owner_b@almeswak.iq')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organization_members (organization_id, user_id, branch_id, role, is_active)
    VALUES 
        (v_org_a, v_user_owner_a, NULL, 'owner', TRUE),
        (v_org_a, v_user_dentist_a1, v_branch_a1, 'dentist', TRUE),
        (v_org_b, v_user_owner_b, NULL, 'owner', TRUE)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = TRUE;

    -- --------------------------------------------------------------------------
    -- 1. Tenant AI Configurations & Immutable Ortho Guardrail
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    -- Owner A can read Org A's AI config
    SELECT COUNT(*) INTO v_count FROM public.tenant_ai_configs WHERE organization_id = v_org_a;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'AI Config Failure: Owner A cannot read Org A config!';
    END IF;

    -- Owner A CANNOT read Org B's AI config
    SELECT COUNT(*) INTO v_count FROM public.tenant_ai_configs WHERE organization_id = v_org_b;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Cross-Tenant AI Config Breach: Owner A saw Org B AI config!';
    END IF;

    -- Owner A can update slogan in Org A
    UPDATE public.tenant_ai_configs SET slogan_ar = 'دقة ورعاية فائقة' WHERE organization_id = v_org_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'AI Config Update Failure: Owner A could not update slogan!';
    END IF;

    -- Owner A attempts to disable orthodontic pricing prohibition: MUST FAIL with CHECK constraint
    v_caught := FALSE;
    BEGIN
        UPDATE public.tenant_ai_configs SET is_ortho_pricing_prohibited = FALSE WHERE organization_id = v_org_a;
    EXCEPTION WHEN check_violation THEN
        v_caught := TRUE;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Policy Violation: Allowed disabling is_ortho_pricing_prohibited in database!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 1: Tenant AI Configs isolated; Immutable Orthodontic check constraint enforced';

    -- --------------------------------------------------------------------------
    -- 2. Cross-Tenant Operational Domain Isolation (Leads, Appts, Conversations)
    -- --------------------------------------------------------------------------
    -- Seed test data via service_role
    PERFORM set_config('role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    INSERT INTO public.leads (id, organization_id, account_id, instagram_username, patient_name, treatment, treatment_name_ar, status, inquiry_date, estimated_value_iqd, confidence_score)
    VALUES 
        (v_lead_a, v_org_a, 'drmustafa_hadi', 'patient_a', 'Patient A', 'cosmetic_emax', 'ابتسامة إيماكس', 'new_inquiry', NOW(), 1000000, 0.95),
        (v_lead_b, v_org_b, 'almeswaksmile_iq', 'patient_b', 'Patient B', 'teeth_whitening', 'تبييض الأسنان', 'new_inquiry', NOW(), 200000, 0.90);

    INSERT INTO public.conversations (id, organization_id, account_id, instagram_username, patient_name, status, unread, last_message_time)
    VALUES 
        (v_conv_a, v_org_a, 'drmustafa_hadi', 'patient_a', 'Patient A', 'active_ai', FALSE, NOW()),
        (v_conv_b, v_org_b, 'almeswaksmile_iq', 'patient_b', 'Patient B', 'active_ai', FALSE, NOW());

    INSERT INTO public.appointments (id, organization_id, branch_id, account_id, patient_name, phone, treatment, treatment_name_ar, preferred_date, preferred_time, assigned_doctor, assigned_doctor_ar, status)
    VALUES 
        (v_appt_a, v_org_a, v_branch_a1, 'drmustafa_hadi', 'Patient A', '07712345678', 'consultation', 'استشارة', CURRENT_DATE + 1, '5:00 PM', 'Dr. Mustafa', 'د. مصطفى هادي', 'new_request');

    -- Authenticate as Owner A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    -- Leads: Owner A sees Org A lead, sees 0 of Org B
    SELECT COUNT(*) INTO v_count FROM public.leads WHERE id = v_lead_a;
    IF v_count != 1 THEN RAISE EXCEPTION 'Leads Isolation Failure: Owner A cannot see Org A lead!'; END IF;
    SELECT COUNT(*) INTO v_count FROM public.leads WHERE id = v_lead_b;
    IF v_count != 0 THEN RAISE EXCEPTION 'Leads Cross-Tenant Breach: Owner A saw Org B lead!'; END IF;

    -- Conversations: Owner A sees Org A conv, sees 0 of Org B
    SELECT COUNT(*) INTO v_count FROM public.conversations WHERE id = v_conv_a;
    IF v_count != 1 THEN RAISE EXCEPTION 'Conversations Isolation Failure: Owner A cannot see Org A conv!'; END IF;
    SELECT COUNT(*) INTO v_count FROM public.conversations WHERE id = v_conv_b;
    IF v_count != 0 THEN RAISE EXCEPTION 'Conversations Cross-Tenant Breach: Owner A saw Org B conv!'; END IF;

    -- Cross-Tenant UPDATE attempt on Org B Lead: 0 rows affected
    UPDATE public.leads SET patient_name = 'Hacked Patient' WHERE id = v_lead_b;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 0 THEN RAISE EXCEPTION 'Cross-Tenant Mutation Breach: Owner A was able to update Org B lead!'; END IF;

    -- Cross-Tenant INSERT attempt into Org B: Rejected by RLS WITH CHECK
    v_caught := FALSE;
    BEGIN
        INSERT INTO public.leads (organization_id, account_id, instagram_username, patient_name, treatment, treatment_name_ar, status, inquiry_date, estimated_value_iqd, confidence_score)
        VALUES (v_org_b, 'almeswaksmile_iq', 'rogue_patient', 'Rogue', 'consultation', 'استشارة', 'new_inquiry', NOW(), 0, 0.5);
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        IF v_sqlstate IN ('42501', '44000') THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Cross-Tenant INSERT Breach: Owner A was able to insert into Org B!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 2: Cross-tenant operational domain isolation strictly verified across reads & writes';

    -- --------------------------------------------------------------------------
    -- 3. Composite Foreign-Key Safe Deletion Triggers (Soft Orphan / Preserves Org)
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    -- 3a. Branch Deletion: Preserves appointment & organization_id, nullifies branch_id
    INSERT INTO public.branches (id, organization_id, name, slug)
    VALUES (v_branch_del, v_org_a, 'Branch To Be Deleted', 'branch-delete-test');

    INSERT INTO public.appointments (id, organization_id, branch_id, account_id, patient_name, phone, treatment, treatment_name_ar, preferred_date, preferred_time, assigned_doctor, assigned_doctor_ar, status)
    VALUES (v_appt_branch, v_org_a, v_branch_del, 'drmustafa_hadi', 'Branch Test Patient', '07700000001', 'consultation', 'استشارة', CURRENT_DATE + 2, '6:00 PM', 'Dr. Mustafa', 'د. مصطفى هادي', 'new_request');

    -- Delete Branch
    DELETE FROM public.branches WHERE id = v_branch_del;

    -- Verify appointment survives, branch_id is NULL, organization_id is preserved
    SELECT organization_id, branch_id INTO v_resolved_org, v_branch_del FROM public.appointments WHERE id = v_appt_branch;
    IF v_resolved_org != v_org_a THEN
        RAISE EXCEPTION 'Safe Orphan Failure: organization_id on appointment was corrupted!';
    END IF;
    IF v_branch_del IS NOT NULL THEN
        RAISE EXCEPTION 'Safe Orphan Failure: branch_id on appointment was not nullified!';
    END IF;

    -- 3b. Lead Deletion: Preserves appointment & organization_id, nullifies lead_id
    UPDATE public.appointments SET lead_id = v_lead_a WHERE id = v_appt_a;
    DELETE FROM public.leads WHERE id = v_lead_a;

    SELECT organization_id, lead_id INTO v_resolved_org, v_lead_a FROM public.appointments WHERE id = v_appt_a;
    IF v_resolved_org != v_org_a THEN
        RAISE EXCEPTION 'Safe Orphan Failure: organization_id on appointment was corrupted on lead deletion!';
    END IF;
    IF v_lead_a IS NOT NULL THEN
        RAISE EXCEPTION 'Safe Orphan Failure: lead_id on appointment was not nullified!';
    END IF;

    -- 3c. Conversation Deletion: Preserves takeover & escalation, nullifies conversation_id
    INSERT INTO public.conversations (id, organization_id, account_id, instagram_username, patient_name, status, unread, last_message_time)
    VALUES (v_conv_del, v_org_a, 'drmustafa_hadi', 'del_patient', 'Del Patient', 'active_ai', FALSE, NOW());

    INSERT INTO public.human_takeovers (id, organization_id, account_id, sender_id, conversation_id, reason, is_active, initiated_at)
    VALUES (v_takeover_del, v_org_a, 'drmustafa_hadi', 'sender_del_01', v_conv_del, 'Test takeover', TRUE, NOW());

    INSERT INTO public.escalation_events (id, organization_id, account_id, sender_id, conversation_id, event_type, severity, details, requires_followup)
    VALUES (v_escalation_del, v_org_a, 'drmustafa_hadi', 'sender_del_01', v_conv_del, 'human_agent_requested', 'info', '{}'::jsonb, TRUE);

    -- Delete Conversation
    DELETE FROM public.conversations WHERE id = v_conv_del;

    SELECT organization_id, conversation_id INTO v_resolved_org, v_conv_del FROM public.human_takeovers WHERE id = v_takeover_del;
    IF v_resolved_org != v_org_a OR v_conv_del IS NOT NULL THEN
        RAISE EXCEPTION 'Safe Orphan Failure: conversation deletion failed to safely nullify takeover conversation_id!';
    END IF;

    SELECT organization_id, conversation_id INTO v_resolved_org, v_conv_del FROM public.escalation_events WHERE id = v_escalation_del;
    IF v_resolved_org != v_org_a OR v_conv_del IS NOT NULL THEN
        RAISE EXCEPTION 'Safe Orphan Failure: conversation deletion failed to safely nullify escalation conversation_id!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 3: Composite FK safe deletion triggers verified (organization_id preserved, child keys safely nullified)';

    -- --------------------------------------------------------------------------
    -- 4. Tenant Immutability Trigger Protection on Operational Domain Tables
    -- --------------------------------------------------------------------------
    v_caught := FALSE;
    BEGIN
        UPDATE public.appointments SET organization_id = v_org_b WHERE id = v_appt_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Mutating organization_id on existing record is strictly prohibited%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: organization_id on appointments was mutable!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 4: Tenant immutability trigger strictly verified on operational domain tables';

    -- --------------------------------------------------------------------------
    -- 5. Automatic Organization ID Resolution Trigger (Backward Compatibility)
    -- --------------------------------------------------------------------------
    -- Client inserts lead without organization_id (passing only account_id)
    INSERT INTO public.leads (account_id, instagram_username, patient_name, treatment, treatment_name_ar, status, inquiry_date, estimated_value_iqd, confidence_score)
    VALUES ('drmustafa_hadi', 'auto_resolve_patient', 'Auto Patient', 'cosmetic_emax', 'ابتسامة إيماكس', 'new_inquiry', NOW(), 1200000, 0.99)
    RETURNING organization_id INTO v_resolved_org;

    IF v_resolved_org != v_org_a THEN
        RAISE EXCEPTION 'Auto-Resolution Failure: Expected % for account drmustafa_hadi, got %', v_org_a, v_resolved_org;
    END IF;

    -- Client inserts lead for Almeswak account without organization_id
    INSERT INTO public.leads (account_id, instagram_username, patient_name, treatment, treatment_name_ar, status, inquiry_date, estimated_value_iqd, confidence_score)
    VALUES ('almeswaksmile_iq', 'almeswak_patient', 'Almeswak Patient', 'consultation', 'استشارة', 'new_inquiry', NOW(), 0, 0.5)
    RETURNING organization_id INTO v_resolved_org;

    IF v_resolved_org != v_org_b THEN
        RAISE EXCEPTION 'Auto-Resolution Failure: Expected % for account almeswaksmile_iq, got %', v_org_b, v_resolved_org;
    END IF;

    RAISE NOTICE '✅ [PASS] Test 5: Automatic organization_id resolution trigger verified with 100 percent backward compatibility';

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ALL PHASE 2 RELATIONAL DOMAIN PARTITIONING TESTS PASSED (100 pct)';
    RAISE NOTICE '================================================================';
END $$;

ROLLBACK;

