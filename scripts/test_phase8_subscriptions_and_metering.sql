-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 4: Subscriptions, Entitlements & Metered Ledger Engine Test Suite
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

    v_msg_1 TEXT := 'msg_dm_test_001_' || substring(gen_random_uuid()::text, 1, 8);
    v_msg_2 TEXT := 'msg_dm_test_002_' || substring(gen_random_uuid()::text, 1, 8);
    v_msg_rollover TEXT := 'msg_dm_rollover_' || substring(gen_random_uuid()::text, 1, 8);
    v_msg_exceeded TEXT := 'msg_dm_exceeded_' || substring(gen_random_uuid()::text, 1, 8);

    -- Historical & Rollover Period Setup
    v_sub_a_id UUID;
    v_usage_rec_hist_id UUID := gen_random_uuid();
    v_entitlement_id UUID := gen_random_uuid();

    v_res_json JSONB;
    v_count INTEGER;
    v_consumed INTEGER;
    v_caught BOOLEAN;
    v_sqlstate TEXT;
    v_errmsg TEXT;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'MUSTAFAH-AI — PHASE 4: SUBSCRIPTIONS & METERED LEDGER SUITE';
    RAISE NOTICE '================================================================';

    -- --------------------------------------------------------------------------
    -- 0. Fixture Setup (auth.users, memberships, active subscriptions)
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

    SELECT id INTO v_sub_a_id FROM public.subscriptions WHERE organization_id = v_org_a LIMIT 1;
    IF v_sub_a_id IS NULL THEN
        RAISE EXCEPTION 'Fixture Failure: Org A subscription not found!';
    END IF;

    -- --------------------------------------------------------------------------
    -- 1. Plans Catalog & Cross-Tenant Subscription Isolation
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    -- 1a. Authenticated user can read plans catalog
    SELECT COUNT(*) INTO v_count FROM public.plans WHERE is_active = TRUE;
    IF v_count < 3 THEN
        RAISE EXCEPTION 'Plans Catalog Failure: Expected at least 3 active plans, got %', v_count;
    END IF;

    -- 1b. Tenant isolation: Owner A sees Org A subscription, sees 0 of Org B
    SELECT COUNT(*) INTO v_count FROM public.subscriptions WHERE organization_id = v_org_a;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Subscription Isolation Failure: Owner A cannot see Org A subscription!';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.subscriptions WHERE organization_id = v_org_b;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'Cross-Tenant Breach: Owner A was able to see Org B subscription!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 1: Plans catalog globally available; Subscriptions strictly isolated by RLS';

    -- --------------------------------------------------------------------------
    -- 2. Atomic Quota Reservation & Idempotency (reserve_dm_quota)
    -- --------------------------------------------------------------------------
    -- Switch to service_role (trusted caller)
    PERFORM set_config('role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    -- 2a. Initial reservation for v_msg_1
    v_res_json := public.reserve_dm_quota(v_org_a, v_msg_1);
    IF (v_res_json->>'success')::boolean != TRUE OR (v_res_json->>'status') != 'RESERVED' THEN
        RAISE EXCEPTION 'Quota Reservation Failure: Expected success = true, got %', v_res_json;
    END IF;

    -- Verify ledger entry was created
    SELECT balance_after INTO v_consumed FROM public.subscription_usage_ledger 
    WHERE organization_id = v_org_a AND message_id = v_msg_1 AND status = 'RESERVED';
    IF v_consumed < 1 THEN
        RAISE EXCEPTION 'Ledger Failure: Expected balance_after >= 1, got %', v_consumed;
    END IF;

    -- 2b. Idempotency: Calling reserve_dm_quota again with same v_msg_1 MUST NOT double-increment
    v_res_json := public.reserve_dm_quota(v_org_a, v_msg_1);
    IF (v_res_json->>'success')::boolean != TRUE OR (v_res_json->>'status') != 'ALREADY_RESERVED' THEN
        RAISE EXCEPTION 'Idempotency Failure: Expected ALREADY_RESERVED, got %', v_res_json;
    END IF;

    -- Verify count did not increment
    SELECT COUNT(*) INTO v_count FROM public.subscription_usage_ledger 
    WHERE organization_id = v_org_a AND message_id = v_msg_1 AND status = 'RESERVED';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Idempotency Failure: Duplicate ledger entry was created!';
    END IF;

    -- 2c. Untrusted caller (authenticated without trusted system role) MUST BE REJECTED
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_owner_a::text, true);

    v_caught := FALSE;
    BEGIN
        PERFORM public.reserve_dm_quota(v_org_a, 'msg_untrusted_attempt');
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate IN ('42501', 'P0001') THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Breach: Authenticated non-system caller was able to reserve quota!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 2: Atomic DM quota reservation, strict idempotency, and caller authorization verified';

    -- --------------------------------------------------------------------------
    -- 3. Period-Consistent Compensating Refund (refund_dm_quota)
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    -- 3a. Refund v_msg_1
    v_res_json := public.refund_dm_quota(v_org_a, v_msg_1, 'Meta API delivery failure code 613');
    IF (v_res_json->>'success')::boolean != TRUE OR (v_res_json->>'status') != 'REFUNDED' THEN
        RAISE EXCEPTION 'Quota Refund Failure: Expected success = true, got %', v_res_json;
    END IF;

    -- Verify ledger entry was created with amount = -1 and references original reservation
    SELECT amount, original_reservation_id INTO v_consumed, v_usage_rec_hist_id 
    FROM public.subscription_usage_ledger 
    WHERE organization_id = v_org_a AND message_id = v_msg_1 AND status = 'REFUNDED';
    IF v_consumed != -1 OR v_usage_rec_hist_id IS NULL THEN
        RAISE EXCEPTION 'Compensating Ledger Failure: Refund entry was malformed!';
    END IF;

    -- 3b. Refund Idempotency: Calling refund again on same message MUST NOT double-refund
    v_res_json := public.refund_dm_quota(v_org_a, v_msg_1, 'Duplicate retry');
    IF (v_res_json->>'success')::boolean != TRUE OR (v_res_json->>'status') != 'ALREADY_REFUNDED' THEN
        RAISE EXCEPTION 'Refund Idempotency Failure: Expected ALREADY_REFUNDED, got %', v_res_json;
    END IF;

    -- Verify exactly 1 refund record exists
    SELECT COUNT(*) INTO v_count FROM public.subscription_usage_ledger 
    WHERE organization_id = v_org_a AND message_id = v_msg_1 AND status = 'REFUNDED';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Refund Idempotency Failure: Duplicate refund ledger entry was created!';
    END IF;

    -- 3c. Unknown reservation refund attempt: Returns RESERVATION_NOT_FOUND
    v_res_json := public.refund_dm_quota(v_org_a, 'non_existent_msg_id', 'Random reason');
    IF (v_res_json->>'success')::boolean != FALSE OR (v_res_json->>'error') != 'RESERVATION_NOT_FOUND' THEN
        RAISE EXCEPTION 'Refund Failure: Expected RESERVATION_NOT_FOUND, got %', v_res_json;
    END IF;

    RAISE NOTICE '✅ [PASS] Test 3: Compensating refund, single-refund idempotency, and unknown reservation handling verified';

    -- --------------------------------------------------------------------------
    -- 4. Billing Rollover Safety (Historical Period Refund Protection)
    -- --------------------------------------------------------------------------
    -- Seed an aggregate record and reservation belonging to an EXPIRED historical period (Period 1)
    INSERT INTO public.subscription_usage_records (
        id, organization_id, subscription_id, period_start, period_end, dms_consumed, allocated_quota
    ) VALUES (
        v_usage_rec_hist_id, v_org_a, v_sub_a_id, 
        NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days', 50, 2500
    );

    INSERT INTO public.subscription_usage_ledger (
        organization_id, subscription_id, usage_record_id, period_start, period_end,
        message_id, amount, balance_after, status
    ) VALUES (
        v_org_a, v_sub_a_id, v_usage_rec_hist_id,
        NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days',
        v_msg_rollover, 1, 50, 'RESERVED'
    );

    -- Execute refund for historical message: MUST decrement Period 1's aggregate, NOT current period!
    v_res_json := public.refund_dm_quota(v_org_a, v_msg_rollover, 'Delayed failure after period rollover');
    IF (v_res_json->>'success')::boolean != TRUE OR (v_res_json->>'status') != 'REFUNDED' THEN
        RAISE EXCEPTION 'Rollover Refund Failure: Expected success = true, got %', v_res_json;
    END IF;

    -- Verify Historical Period 1 was decremented from 50 to 49
    SELECT dms_consumed INTO v_consumed FROM public.subscription_usage_records 
    WHERE id = v_usage_rec_hist_id;
    IF v_consumed != 49 THEN
        RAISE EXCEPTION 'Rollover Accounting Corruption: Historical period was not decremented! Got %', v_consumed;
    END IF;

    RAISE NOTICE '✅ [PASS] Test 4: Historical billing period rollover safe; Compensating refund permanently bound to original period';

    -- --------------------------------------------------------------------------
    -- 5. Add-on Entitlements & Quota Exceeded Enforcement
    -- --------------------------------------------------------------------------
    -- 5a. Quota Exceeded Check: Artificially set usage record consumed = allocated_quota
    UPDATE public.subscription_usage_records 
    SET dms_consumed = allocated_quota 
    WHERE organization_id = v_org_a AND period_start > NOW() - INTERVAL '2 days';

    v_res_json := public.reserve_dm_quota(v_org_a, v_msg_exceeded);
    IF (v_res_json->>'success')::boolean != FALSE OR (v_res_json->>'error') != 'QUOTA_EXCEEDED' THEN
        RAISE EXCEPTION 'Quota Enforcement Failure: Expected QUOTA_EXCEEDED, got %', v_res_json;
    END IF;

    -- 5b. Add Entitlement: Additional 500 DMs
    INSERT INTO public.subscription_entitlements (
        id, organization_id, subscription_id, additional_dms, feature_key, is_active, valid_from, valid_until
    ) VALUES (
        v_entitlement_id, v_org_a, v_sub_a_id, 500, 'additional_dm_pack', TRUE, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '10 days'
    );

    -- Reservation should now succeed because effective quota increased by 500
    v_res_json := public.reserve_dm_quota(v_org_a, v_msg_exceeded);
    IF (v_res_json->>'success')::boolean != TRUE OR (v_res_json->>'status') != 'RESERVED' THEN
        RAISE EXCEPTION 'Entitlement Failure: Expected reservation success after add-on, got %', v_res_json;
    END IF;

    RAISE NOTICE '✅ [PASS] Test 5: Strict quota boundary enforcement and dynamic add-on entitlement expansion verified';

    -- --------------------------------------------------------------------------
    -- 6. Immutable Usage Ledger Deletion Protection Trigger
    -- --------------------------------------------------------------------------
    v_caught := FALSE;
    BEGIN
        DELETE FROM public.subscription_usage_ledger WHERE organization_id = v_org_a;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_errmsg := SQLERRM;
        IF v_sqlstate = 'P0001' AND v_errmsg LIKE '%Security Policy Violation: Deletion of immutable subscription audit ledger records is strictly prohibited%' THEN
            v_caught := TRUE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Security Policy Violation: Deletion of immutable usage ledger was allowed!';
    END IF;

    RAISE NOTICE '✅ [PASS] Test 6: Immutable subscription usage ledger deletion blocking trigger strictly verified';

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ALL PHASE 4 SUBSCRIPTIONS & METERED LEDGER TESTS PASSED (100 pct)';
    RAISE NOTICE '================================================================';
END $$;

ROLLBACK;
