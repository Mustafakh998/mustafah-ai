-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 3: Almeswak Cryptographic Quarantine Gate & Activation API Test Suite
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
    v_user_owner_b UUID := '10000000-0000-0000-0000-000000000007'::uuid;
    v_user_legal_admin UUID := '10000000-0000-0000-0000-000000000011'::uuid;
    v_user_superadmin UUID := '10000000-0000-0000-0000-000000000012'::uuid;

    -- Token Secrets & Hashes
    v_raw_secret_valid TEXT := 'sec_board_almeswak_live_approved_2026_xyz';
    v_hash_valid TEXT;
    v_raw_secret_expired TEXT := 'sec_board_expired_token';
    v_hash_expired TEXT;
    v_raw_secret_revoked TEXT := 'sec_board_revoked_token';
    v_hash_revoked TEXT;

    -- Auth Record IDs
    v_auth_id_valid UUID := gen_random_uuid();
    v_auth_id_expired UUID := gen_random_uuid();
    v_auth_id_revoked UUID := gen_random_uuid();

    v_count INTEGER;
    v_caught BOOLEAN;
    v_sqlstate TEXT;
    v_errmsg TEXT;
    v_res_bool BOOLEAN;
    v_res_json JSONB;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'MUSTAFAH-AI — PHASE 3: CRYPTOGRAPHIC QUARANTINE GATE SUITE';
    RAISE NOTICE '================================================================';

    -- --------------------------------------------------------------------------
    -- 0. Fixture Setup (auth.users, superadmins, memberships)
    -- --------------------------------------------------------------------------
    INSERT INTO auth.users (id, email) VALUES 
        (v_user_owner_a, 'owner_a@mustafahadi.iq'),
        (v_user_owner_b, 'owner_b@almeswak.iq'),
        (v_user_legal_admin, 'legal_counsel@mustafah-platform.iq'),
        (v_user_superadmin, 'board_superadmin@mustafah-platform.iq')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.platform_superadmins (user_id, granted_by, notes)
    VALUES (v_user_superadmin, v_user_superadmin, 'Test superadmin')
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.organization_members (organization_id, user_id, branch_id, role, is_active)
    VALUES 
        (v_org_a, v_user_owner_a, NULL, 'owner', TRUE),
        (v_org_b, v_user_owner_b, NULL, 'owner', TRUE)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = TRUE;

    -- Compute token hashes
    v_hash_valid := encode(digest(v_raw_secret_valid, 'sha256'), 'hex');
    v_hash_expired := encode(digest(v_raw_secret_expired, 'sha256'), 'hex');
    v_hash_revoked := encode(digest(v_raw_secret_revoked, 'sha256'), 'hex');

    -- --------------------------------------------------------------------------
    -- 1. Direct DML Quarantine Interception on organizations
    -- --------------------------------------------------------------------------
    -- 1a. Direct UPDATE status away from demo_mode: MUST FAIL
    v_caught := FALSE;
    BEGIN
        UPDATE public.organizations SET status = 'active' WHERE id = v_org_b;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Quarantine Violation: Almeswak Clinic is quarantined in Demo mode%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Quarantine Breach: Direct UPDATE of Almeswak organization status was allowed!';
    END IF;

    -- 1b. Direct DELETE of Almeswak organization: MUST FAIL
    v_caught := FALSE;
    BEGIN
        DELETE FROM public.organizations WHERE id = v_org_b;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Quarantine Violation: Deleting Almeswak clinic organization is strictly prohibited%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Quarantine Breach: Direct DELETE of Almeswak organization was allowed!';
    END IF;

    -- 1c. Rename evasion attempt: MUST FAIL
    v_caught := FALSE;
    BEGIN
        UPDATE public.organizations SET slug = 'almeswak-renamed-evasion' WHERE id = v_org_b;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND (v_errmsg LIKE '%Quarantine Violation: Renaming Almeswak organization to evade quarantine%' OR v_errmsg LIKE '%Mutating organization slug is strictly prohibited%') THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Quarantine Breach: Renaming Almeswak organization was allowed!';
    END IF;

    -- 1d. Another organization claiming Almeswak slug: MUST FAIL
    v_caught := FALSE;
    BEGIN
        UPDATE public.organizations SET slug = 'almeswak-demo' WHERE id = v_org_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Quarantine Breach: Another organization was able to adopt Almeswak slug!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 1: Direct DML mutations, deletion, and rename evasion strictly blocked on organizations';

    -- --------------------------------------------------------------------------
    -- 2. Direct DML Quarantine Interception on instagram_accounts
    -- --------------------------------------------------------------------------
    -- 2a. Direct UPDATE status away from demo_mode on Almeswak account: MUST FAIL
    v_caught := FALSE;
    BEGIN
        UPDATE public.instagram_accounts SET status = 'connected' WHERE id = 'almeswaksmile_iq';
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Quarantine Violation: Live activation of account @almeswaksmile.iq is blocked by Platform Quarantine%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Quarantine Breach: Direct UPDATE of Almeswak instagram account was allowed!';
    END IF;

    -- 2b. Direct DELETE of Almeswak instagram account: MUST FAIL
    v_caught := FALSE;
    BEGIN
        DELETE FROM public.instagram_accounts WHERE id = 'almeswaksmile_iq';
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Quarantine Violation: Deleting baseline Almeswak account is strictly prohibited%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Quarantine Breach: Direct DELETE of Almeswak instagram account was allowed!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 2: Direct DML mutations and deletion strictly blocked on instagram_accounts';

    -- --------------------------------------------------------------------------
    -- 3. Separation of Duties & Vault Constraints
    -- --------------------------------------------------------------------------
    -- 3a. Same admin for legal verification and authorization: MUST FAIL with chk_separation_of_duties
    v_caught := FALSE;
    BEGIN
        INSERT INTO public.platform_authorizations (
            authorization_token_hash, target_entity_type, target_entity_id, target_handle,
            purpose, action, board_resolution_reference, board_resolution_sha256,
            board_approval_verified_by_legal_admin_id, board_approval_verification_notes,
            authorized_by_admin_id, expires_at
        ) VALUES (
            'hash_dummy_01', 'organization', v_org_b, 'almeswaksmile.iq',
            'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION', 'RES-2026-001', 'sha256-dummy',
            v_user_superadmin, 'Self-verification attempt',
            v_user_superadmin, NOW() + INTERVAL '1 day'
        );
    EXCEPTION WHEN check_violation THEN
        v_caught := TRUE;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Vault Policy Violation: Separation of duties constraint was bypassed!';
    END IF;

    -- 3b. Expired date earlier than granted date: MUST FAIL with chk_auth_validity
    v_caught := FALSE;
    BEGIN
        INSERT INTO public.platform_authorizations (
            authorization_token_hash, target_entity_type, target_entity_id, target_handle,
            purpose, action, board_resolution_reference, board_resolution_sha256,
            board_approval_verified_by_legal_admin_id, board_approval_verification_notes,
            authorized_by_admin_id, expires_at
        ) VALUES (
            'hash_dummy_02', 'organization', v_org_b, 'almeswaksmile.iq',
            'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION', 'RES-2026-002', 'sha256-dummy',
            v_user_legal_admin, 'Legal verification OK',
            v_user_superadmin, NOW() - INTERVAL '1 day'
        );
    EXCEPTION WHEN check_violation THEN
        v_caught := TRUE;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Vault Policy Violation: Expiration check constraint was bypassed!';
    END IF;

    -- Seed Valid, Expired, and Revoked Authorizations
    INSERT INTO public.platform_authorizations (
        id, authorization_token_hash, target_entity_type, target_entity_id, target_handle,
        purpose, action, board_resolution_reference, board_resolution_sha256,
        board_approval_verified_by_legal_admin_id, board_approval_verification_notes,
        authorized_by_admin_id, is_single_use, expires_at
    ) VALUES (
        v_auth_id_valid, v_hash_valid, 'organization', v_org_b, 'almeswaksmile.iq',
        'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION', 'RES-2026-BOARD-ALMESWAK', 'sha256-res-valid',
        v_user_legal_admin, 'Board resolution authenticated by General Counsel',
        v_user_superadmin, TRUE, NOW() + INTERVAL '7 days'
    );

    INSERT INTO public.platform_authorizations (
        id, authorization_token_hash, target_entity_type, target_entity_id, target_handle,
        purpose, action, board_resolution_reference, board_resolution_sha256,
        board_approval_verified_by_legal_admin_id, board_approval_verification_notes,
        authorized_by_admin_id, is_single_use, granted_at, expires_at
    ) VALUES (
        v_auth_id_expired, v_hash_expired, 'organization', v_org_b, 'almeswaksmile.iq',
        'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION', 'RES-2026-EXPIRED', 'sha256-res-expired',
        v_user_legal_admin, 'Expired board resolution',
        v_user_superadmin, TRUE, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 second'
    );

    INSERT INTO public.platform_authorizations (
        id, authorization_token_hash, target_entity_type, target_entity_id, target_handle,
        purpose, action, board_resolution_reference, board_resolution_sha256,
        board_approval_verified_by_legal_admin_id, board_approval_verification_notes,
        authorized_by_admin_id, is_single_use, expires_at, revoked_at, revoked_by_admin_id, revocation_reason
    ) VALUES (
        v_auth_id_revoked, v_hash_revoked, 'organization', v_org_b, 'almeswaksmile.iq',
        'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION', 'RES-2026-REVOKED', 'sha256-res-revoked',
        v_user_legal_admin, 'Revoked authorization',
        v_user_superadmin, TRUE, NOW() + INTERVAL '5 days', NOW(), v_user_superadmin, 'Board rescinded approval'
    );

    RAISE NOTICE '✅ [PASS] Test 3: Separation of duties and vault constraints strictly enforced; test authorizations seeded';

    -- --------------------------------------------------------------------------
    -- 4. Cryptographic Secret Verification & Consumption Unit Tests
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_superadmin::text, true);

    -- 4a. Incorrect secret: Returns FALSE, logs DENIED_INVALID_SECRET
    v_res_bool := public.fn_verify_and_consume_platform_authorization(
        v_org_b, 'organization', 'organizations', v_org_b::text,
        'almeswaksmile.iq', 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION',
        'wrong_tampered_secret'
    );
    IF v_res_bool != FALSE THEN
        RAISE EXCEPTION 'Cryptographic Failure: Accepted invalid secret!';
    END IF;

    SELECT outcome INTO v_errmsg FROM public.platform_authorization_audit_log 
    WHERE attempted_action = 'ACTIVATE_ORGANIZATION' ORDER BY created_at DESC LIMIT 1;
    IF v_errmsg != 'DENIED_INVALID_SECRET' THEN
        RAISE EXCEPTION 'Audit Failure: Expected outcome DENIED_INVALID_SECRET, got %', v_errmsg;
    END IF;

    -- 4b. Expired secret: Returns FALSE, logs DENIED_EXPIRED
    v_res_bool := public.fn_verify_and_consume_platform_authorization(
        v_org_b, 'organization', 'organizations', v_org_b::text,
        'almeswaksmile.iq', 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION',
        v_raw_secret_expired
    );
    IF v_res_bool != FALSE THEN
        RAISE EXCEPTION 'Cryptographic Failure: Accepted expired secret!';
    END IF;

    SELECT outcome INTO v_errmsg FROM public.platform_authorization_audit_log 
    WHERE attempted_action = 'ACTIVATE_ORGANIZATION' ORDER BY created_at DESC LIMIT 1;
    IF v_errmsg != 'DENIED_EXPIRED' THEN
        RAISE EXCEPTION 'Audit Failure: Expected outcome DENIED_EXPIRED, got %', v_errmsg;
    END IF;

    -- 4c. Revoked secret: Returns FALSE, logs DENIED_REVOKED
    v_res_bool := public.fn_verify_and_consume_platform_authorization(
        v_org_b, 'organization', 'organizations', v_org_b::text,
        'almeswaksmile.iq', 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION',
        v_raw_secret_revoked
    );
    IF v_res_bool != FALSE THEN
        RAISE EXCEPTION 'Cryptographic Failure: Accepted revoked secret!';
    END IF;

    SELECT outcome INTO v_errmsg FROM public.platform_authorization_audit_log 
    WHERE attempted_action = 'ACTIVATE_ORGANIZATION' ORDER BY created_at DESC LIMIT 1;
    IF v_errmsg != 'DENIED_REVOKED' THEN
        RAISE EXCEPTION 'Audit Failure: Expected outcome DENIED_REVOKED, got %', v_errmsg;
    END IF;

    -- 4d. Non-superadmin / Untrusted caller attempt: Returns FALSE, logs DENIED_UNTRUSTED_CALLER
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_b::text, true);

    v_res_bool := public.fn_verify_and_consume_platform_authorization(
        v_org_b, 'organization', 'organizations', v_org_b::text,
        'almeswaksmile.iq', 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION',
        v_raw_secret_valid
    );
    IF v_res_bool != FALSE THEN
        RAISE EXCEPTION 'Cryptographic Failure: Untrusted caller was able to consume authorization!';
    END IF;

    SELECT outcome INTO v_errmsg FROM public.platform_authorization_audit_log 
    WHERE attempted_action = 'ACTIVATE_ORGANIZATION' ORDER BY created_at DESC LIMIT 1;
    IF v_errmsg != 'DENIED_UNTRUSTED_CALLER' THEN
        RAISE EXCEPTION 'Audit Failure: Expected outcome DENIED_UNTRUSTED_CALLER, got %', v_errmsg;
    END IF;

    RAISE NOTICE '✅ [PASS] Test 4: Cryptographic secret verification, rejection reasons, and audit logging verified';

    -- --------------------------------------------------------------------------
    -- 5. End-to-End Cryptographic Activation API & Replay Attack Prevention
    -- --------------------------------------------------------------------------
    -- Authenticate as Superadmin
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_superadmin::text, true);

    -- 5a. Call activation API with invalid secret: MUST THROW EXCEPTION
    v_caught := FALSE;
    BEGIN
        PERFORM public.api_activate_quarantined_clinic(v_org_b, 'bogus_secret_123');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Activation Denied: Valid Platform Board Authorization secret is required%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: api_activate_quarantined_clinic succeeded with bogus secret!';
    END IF;

    -- Verify Almeswak organization and instagram_account remain in demo_mode
    SELECT status INTO v_errmsg FROM public.organizations WHERE id = v_org_b;
    IF v_errmsg != 'demo_mode' THEN
        RAISE EXCEPTION 'Quarantine Failure: Almeswak organization status changed prematurely!';
    END IF;

    SELECT status INTO v_errmsg FROM public.instagram_accounts WHERE id = 'almeswaksmile_iq';
    IF v_errmsg != 'demo_mode' THEN
        RAISE EXCEPTION 'Quarantine Failure: Almeswak account status changed prematurely!';
    END IF;

    -- 5b. Call activation API with valid secret: MUST SUCCEED
    v_res_json := public.api_activate_quarantined_clinic(v_org_b, v_raw_secret_valid);
    IF (v_res_json->>'success')::boolean != TRUE THEN
        RAISE EXCEPTION 'Activation Failure: Expected success = true, got %', v_res_json;
    END IF;

    -- Verify Almeswak organization status transitioned to active
    SELECT status INTO v_errmsg FROM public.organizations WHERE id = v_org_b;
    IF v_errmsg != 'active' THEN
        RAISE EXCEPTION 'Activation Failure: Expected status active, got %', v_errmsg;
    END IF;

    -- Verify Almeswak instagram_account transitioned to connected
    SELECT status INTO v_errmsg FROM public.instagram_accounts WHERE id = 'almeswaksmile_iq';
    IF v_errmsg != 'connected' THEN
        RAISE EXCEPTION 'Activation Failure: Expected instagram status connected, got %', v_errmsg;
    END IF;

    -- Verify token was atomically marked consumed
    SELECT consumed_at, consumed_by_user_id INTO v_errmsg, v_user_legal_admin 
    FROM public.platform_authorizations WHERE id = v_auth_id_valid;
    IF v_errmsg IS NULL OR v_user_legal_admin != v_user_superadmin THEN
        RAISE EXCEPTION 'Token Consumption Failure: Token was not marked consumed by superadmin!';
    END IF;

    -- 5c. Replay Attack: Calling again with the same secret MUST FAIL
    -- First verify with fn_verify_and_consume_platform_authorization to inspect persistent audit log
    v_res_bool := public.fn_verify_and_consume_platform_authorization(
        v_org_b, 'organization', 'organizations', v_org_b::text,
        'almeswaksmile.iq', 'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 'ACTIVATE_ORGANIZATION',
        v_raw_secret_valid
    );
    IF v_res_bool != FALSE THEN
        RAISE EXCEPTION 'Replay Attack Breach: Consumed token was accepted by verification function!';
    END IF;

    SELECT outcome INTO v_errmsg FROM public.platform_authorization_audit_log 
    WHERE attempted_action = 'ACTIVATE_ORGANIZATION' ORDER BY created_at DESC LIMIT 1;
    IF v_errmsg != 'DENIED_ALREADY_CONSUMED' THEN
        RAISE EXCEPTION 'Audit Failure: Expected outcome DENIED_ALREADY_CONSUMED, got %', v_errmsg;
    END IF;

    -- Verify api_activate_quarantined_clinic also strictly rejects the consumed secret
    v_caught := FALSE;
    BEGIN
        PERFORM public.api_activate_quarantined_clinic(v_org_b, v_raw_secret_valid);
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Activation Denied: Valid Platform Board Authorization secret is required%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Replay Attack Breach: Consumed token was accepted a second time by API!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 5: End-to-end cryptographic activation gate succeeded; Single-use replay attack strictly blocked';

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ALL PHASE 3 CRYPTOGRAPHIC QUARANTINE GATE TESTS PASSED (100 pct)';
    RAISE NOTICE '================================================================';
END $$;

ROLLBACK;
