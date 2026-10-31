-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 7: Dynamic Reconciliation & Pre-Migration Anomaly Engine Test Suite
-- Database: multitenant_dev
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    v_report_count INTEGER;
    v_anomalous_tables INTEGER;
    v_caught BOOLEAN := FALSE;
    v_errmsg TEXT;
    v_fake_lead_id UUID := gen_random_uuid();
    v_org_a UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
    v_org_b UUID := 'a0000000-0000-0000-0000-000000000002'::uuid;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'MUSTAFAH-AI — PHASE 7: RECONCILIATION & ANOMALY ENGINE TEST';
    RAISE NOTICE '================================================================';

    -- --------------------------------------------------------------------------
    -- 1. Baseline Verification: 12 Tables in Anomaly Report
    -- --------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_report_count FROM public.vw_tenant_migration_anomaly_report;
    IF v_report_count != 12 THEN
        RAISE EXCEPTION 'Reconciliation View Error: Expected 12 tables in report, found %', v_report_count;
    END IF;

    SELECT COUNT(*) INTO v_anomalous_tables 
    FROM public.vw_tenant_migration_anomaly_report
    WHERE unmapped_rows > 0 
       OR missing_parents > 0 
       OR cross_tenant_violations > 0 
       OR invalid_references > 0;

    IF v_anomalous_tables != 0 THEN
        RAISE EXCEPTION 'Reconciliation View Failure: Expected 0 anomalous tables in clean state, found %', v_anomalous_tables;
    END IF;

    -- fn_assert_zero_migration_anomalies succeeds cleanly
    PERFORM public.fn_assert_zero_migration_anomalies();

    RAISE NOTICE '✅ [PASS] Test 1: Clean database state verified across all 12 tables (0 anomalies)';

    -- --------------------------------------------------------------------------
    -- 2. Negative Test: Detect Cross-Tenant Anomaly & Abort Migration
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL session_replication_role = 'replica';

        -- Insert a cross-tenant violation: lead with Org A claiming Org B account
        INSERT INTO public.leads (id, organization_id, account_id, patient_name, instagram_username, treatment, treatment_name_ar, status)
        VALUES (v_fake_lead_id, v_org_a, 'almeswaksmile_iq', 'Corrupted Cross Tenant Lead', 'corrupted_user', 'consultation', 'استشارة', 'new_inquiry');

        SET LOCAL session_replication_role = 'origin';

        -- Assertion MUST abort
        PERFORM public.fn_assert_zero_migration_anomalies();

        -- Clean up if it didn't throw
        DELETE FROM public.leads WHERE id = v_fake_lead_id;
    EXCEPTION WHEN OTHERS THEN
        v_errmsg := SQLERRM;
        IF v_errmsg LIKE '%FATAL MIGRATION ABORTION: Relational anomalies detected%' THEN
            v_caught := TRUE;
        END IF;
        SET LOCAL session_replication_role = 'replica';
        DELETE FROM public.leads WHERE id = v_fake_lead_id;
        SET LOCAL session_replication_role = 'origin';
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'Safety Failure: fn_assert_zero_migration_anomalies did not abort on cross-tenant anomaly! Caught: %', v_errmsg;
    END IF;

    RAISE NOTICE '✅ [PASS] Test 2: Fail-closed migration abort triggered on intentional cross-tenant anomaly';

    -- --------------------------------------------------------------------------
    -- 3. Post-Test Verification
    -- --------------------------------------------------------------------------
    PERFORM public.fn_assert_zero_migration_anomalies();

    RAISE NOTICE '✅ [PASS] Test 3: System cleanly recovered; 100 percent dynamic reconciliation verified';

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ALL PHASE 7 RECONCILIATION & ANOMALY TESTS PASSED (100 pct)';
    RAISE NOTICE '================================================================';
END $$;

ROLLBACK;
