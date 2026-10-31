-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 6: Integrations & AEAD Credentials Vault Test Suite
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

    -- Branch IDs
    v_branch_del UUID := gen_random_uuid();

    -- Integration & Credential IDs
    v_int_test UUID := gen_random_uuid();
    v_cred_test UUID := gen_random_uuid();
    v_resolved_branch UUID;
    v_resolved_org UUID;

    v_count INTEGER;
    v_caught BOOLEAN;
    v_sqlstate TEXT;
    v_errmsg TEXT;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'MUSTAFAH-AI — PHASE 6: INTEGRATIONS & CREDENTIALS VAULT SUITE';
    RAISE NOTICE '================================================================';

    -- --------------------------------------------------------------------------
    -- 0. Fixture Setup (auth.users, memberships)
    -- --------------------------------------------------------------------------
    INSERT INTO auth.users (id, email) VALUES 
        (v_user_owner_a, 'owner_a@mustafahadi.iq'),
        (v_user_owner_b, 'owner_b@almeswak.iq')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organization_members (organization_id, user_id, branch_id, role, is_active)
    VALUES 
        (v_org_a, v_user_owner_a, NULL, 'owner', TRUE),
        (v_org_b, v_user_owner_b, NULL, 'owner', TRUE)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = TRUE;

    -- Seed an integration with credentials via service_role
    PERFORM set_config('role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    INSERT INTO public.organization_integrations (
        id, organization_id, branch_id, provider, platform_account_id, platform_account_handle, status
    ) VALUES (
        v_int_test, v_org_a, NULL, 'instagram_graph_api', '17841400000099999', 'drmustafa_test_int', 'connected'
    );

    INSERT INTO public.integration_credentials (
        id, organization_id, integration_id, encrypted_access_token, token_iv, token_auth_tag, key_version
    ) VALUES (
        v_cred_test, v_org_a, v_int_test, 'enc_token_bytes_aead_mock', 'iv_mock_123', 'tag_mock_456', 1
    );

    -- --------------------------------------------------------------------------
    -- 1. AEAD Credential Vault Confidentiality (Zero-Access for Authenticated)
    -- --------------------------------------------------------------------------
    -- Authenticate as Clinic Owner A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    -- Owner A CANNOT read integration_credentials (RLS policy returns 0 rows)
    SELECT COUNT(*) INTO v_count FROM public.integration_credentials WHERE id = v_cred_test;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Credential Vault Leak: Authenticated clinic owner was able to SELECT credentials!';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.integration_credentials;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Credential Vault Leak: Authenticated user saw credentials table rows!';
    END IF;

    -- System Caller (service_role) CAN read credentials
    PERFORM set_config('role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    SELECT COUNT(*) INTO v_count FROM public.integration_credentials WHERE id = v_cred_test;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'System Vault Access Failure: service_role could not read credentials!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 1: AEAD Credential Vault strictly isolated; Zero-access enforced for authenticated users';

    -- --------------------------------------------------------------------------
    -- 2. Organization Integrations Cross-Tenant Isolation
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    -- Owner A sees Org A integrations, sees 0 of Org B
    SELECT COUNT(*) INTO v_count FROM public.organization_integrations WHERE organization_id = v_org_a;
    IF v_count < 1 THEN
        RAISE EXCEPTION 'Integration Isolation Failure: Owner A cannot see Org A integrations!';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.organization_integrations WHERE organization_id = v_org_b;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Cross-Tenant Breach: Owner A saw Org B integrations!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 2: Organization integrations strictly isolated by RLS across tenants';

    -- --------------------------------------------------------------------------
    -- 3. Almeswak Integration Quarantine Guard (trg_quarantine_almeswak_int)
    -- --------------------------------------------------------------------------
    -- Authenticate as Owner B (who owns Almeswak in Org B)
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_b::text, true);

    -- 3a. Direct UPDATE status away from demo_mode: MUST FAIL
    v_caught := FALSE;
    BEGIN
        UPDATE public.organization_integrations 
        SET status = 'connected' 
        WHERE platform_account_handle = 'almeswaksmile.iq';
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Quarantine Violation: Activating integration for @almeswaksmile.iq%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Quarantine Breach: Direct UPDATE of Almeswak integration status was allowed!';
    END IF;

    -- 3b. Direct DELETE of Almeswak integration: MUST FAIL
    v_caught := FALSE;
    BEGIN
        DELETE FROM public.organization_integrations 
        WHERE platform_account_handle = 'almeswaksmile.iq';
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Quarantine Violation: Deleting Almeswak integration is prohibited%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Quarantine Breach: Direct DELETE of Almeswak integration was allowed!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 3: Almeswak integration quarantine guard strictly verified against mutation & deletion';

    -- --------------------------------------------------------------------------
    -- 4. Composite Foreign Key & Safe Branch Orphan Trigger
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    -- Insert temporary branch and link to test integration
    INSERT INTO public.branches (id, organization_id, name, slug)
    VALUES (v_branch_del, v_org_a, 'Branch To Be Orphaned', 'branch-orphan-int-test');

    UPDATE public.organization_integrations SET branch_id = v_branch_del WHERE id = v_int_test;

    -- Delete Branch: Must nullify branch_id without deleting integration or corrupting organization_id
    DELETE FROM public.branches WHERE id = v_branch_del;

    SELECT organization_id, branch_id INTO v_resolved_org, v_resolved_branch 
    FROM public.organization_integrations WHERE id = v_int_test;

    IF v_resolved_org != v_org_a THEN
        RAISE EXCEPTION 'Safe Orphan Failure: organization_id was corrupted on branch deletion!';
    END IF;
    IF v_resolved_branch IS NOT NULL THEN
        RAISE EXCEPTION 'Safe Orphan Failure: branch_id on integration was not nullified!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 4: Safe branch deletion trigger nullifies branch_id while preserving integration and tenant';

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ALL PHASE 6 INTEGRATIONS & CREDENTIALS VAULT TESTS PASSED (100 pct)';
    RAISE NOTICE '================================================================';
END $$;

ROLLBACK;
