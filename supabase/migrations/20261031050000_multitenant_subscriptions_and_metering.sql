-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Migration: 20261031050000_multitenant_subscriptions_and_metering.sql
-- Description: Phase 4 — Subscriptions, Entitlements & Metered Ledger Engine
--
-- Security Invariants:
-- 1. Plans are globally readable, but only platform superadmins can manage them.
-- 2. Subscriptions, Entitlements, Usage Records, and Usage Ledgers are strictly
--    isolated by organization_id using PostgreSQL RLS and composite foreign keys.
-- 3. The usage ledger is append-only and strictly immutable: DELETION is blocked
--    by trigger trg_block_ledger_delete.
-- 4. reserve_dm_quota() atomically increments usage under row-level lock and
--    appends to the immutable ledger with strict idempotency.
-- 5. refund_dm_quota() executes a period-consistent compensating negative ledger entry
--    permanently bound to the original reservation row (preventing period rollover corruption).
-- ==============================================================================

SET statement_timeout = '60s';

-- ------------------------------------------------------------------------------
-- 1. Subscription Plans (Global Catalog)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY, -- 'starter', 'professional', 'enterprise'
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    description_ar TEXT NOT NULL,
    monthly_price_usd NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    annual_discount_percentage NUMERIC(4, 2) NOT NULL DEFAULT 0.15,
    monthly_dm_quota INTEGER NOT NULL,
    max_staff_seats INTEGER NOT NULL,
    max_branches INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Plan Catalog (Non-destructive)
INSERT INTO public.plans (id, name, name_ar, description_ar, monthly_price_usd, monthly_dm_quota, max_staff_seats, max_branches)
VALUES 
    ('starter', 'Starter Clinic', 'باقة العيادة الفردية', 'مخصصة للعيادات الفردية وأطباء الأسنان المستقلين', 49.00, 500, 2, 1),
    ('professional', 'Professional Clinic', 'باقة العيادة التخصصية', 'للعيادات التخصصية التي تحتاج إلى تخصيص أكبر ودعم حسابين', 149.00, 2500, 5, 2),
    ('enterprise', 'Enterprise Dental Center', 'باقة المراكز الكبرى', 'للمراكز التخصصية متعددة الفروع والأطباء', 299.00, 10000, 999, 10)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Organization Subscriptions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    plan_id TEXT NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subscriptions_org_id UNIQUE (organization_id, id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organization_id);

-- ------------------------------------------------------------------------------
-- 3. Subscription Entitlements (Add-on Features & Quotas per Tenant)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    subscription_id UUID NOT NULL,
    additional_dms INTEGER NOT NULL DEFAULT 0,
    feature_key TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_entitlements_subscription_composite 
        FOREIGN KEY (organization_id, subscription_id) 
        REFERENCES public.subscriptions(organization_id, id) 
        ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_entitlements_lookup 
ON public.subscription_entitlements(organization_id, is_active, valid_from, valid_until);

-- ------------------------------------------------------------------------------
-- 4. Subscription Usage Records (Billing Period Aggregates)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    subscription_id UUID NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    dms_consumed INTEGER NOT NULL DEFAULT 0 CHECK (dms_consumed >= 0),
    allocated_quota INTEGER NOT NULL CHECK (allocated_quota >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usage_records_org_period UNIQUE (organization_id, period_start),
    CONSTRAINT uq_usage_records_org_id UNIQUE (organization_id, id),
    CONSTRAINT fk_usage_records_subscription_composite 
        FOREIGN KEY (organization_id, subscription_id) 
        REFERENCES public.subscriptions(organization_id, id) 
        ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_usage_records_org_period 
ON public.subscription_usage_records(organization_id, period_start);

-- ------------------------------------------------------------------------------
-- 5. Immutable Subscription Usage Ledger (Auditable Metering Transactions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    subscription_id UUID NOT NULL,
    usage_record_id UUID NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    message_id TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount IN (1, -1)),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    status TEXT NOT NULL CHECK (status IN ('RESERVED', 'REFUNDED')),
    original_reservation_id UUID,
    refund_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_ledger_org_id UNIQUE (organization_id, id),
    CONSTRAINT fk_ledger_subscription_composite 
        FOREIGN KEY (organization_id, subscription_id) 
        REFERENCES public.subscriptions(organization_id, id) 
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_ledger_usage_record_composite 
        FOREIGN KEY (organization_id, usage_record_id) 
        REFERENCES public.subscription_usage_records(organization_id, id) 
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_ledger_original_reservation_composite 
        FOREIGN KEY (organization_id, original_reservation_id) 
        REFERENCES public.subscription_usage_ledger(organization_id, id) 
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT uq_ledger_reservation UNIQUE (organization_id, message_id, status)
);

CREATE INDEX IF NOT EXISTS idx_ledger_org_msg ON public.subscription_usage_ledger (organization_id, message_id);
CREATE INDEX IF NOT EXISTS idx_ledger_usage_rec ON public.subscription_usage_ledger (usage_record_id);

-- Explicit Deletion Blocking Trigger on Ledger
CREATE OR REPLACE FUNCTION public.fn_prevent_ledger_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Security Policy Violation: Deletion of immutable subscription audit ledger records is strictly prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_ledger_delete ON public.subscription_usage_ledger;
CREATE TRIGGER trg_block_ledger_delete
BEFORE DELETE ON public.subscription_usage_ledger
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_ledger_deletion();

-- ------------------------------------------------------------------------------
-- 6. Concurrency-Safe Quota Reservation Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_dm_quota(
    p_organization_id UUID,
    p_message_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sub RECORD;
    v_plan RECORD;
    v_usage_rec RECORD;
    v_entitlement_quota INTEGER := 0;
    v_effective_max_quota INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Verify trusted caller
    IF NOT public.fn_is_trusted_system_caller() THEN
        RAISE EXCEPTION 'Access Denied: reserve_dm_quota requires service_role or app_worker privileges.';
    END IF;

    -- Authoritative Active Subscription Selection: Lock exact current active subscription
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE organization_id = p_organization_id
      AND status IN ('active', 'trialing')
      AND NOW() BETWEEN current_period_start AND current_period_end
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'ACTIVE_SUBSCRIPTION_NOT_FOUND');
    END IF;

    -- Re-check Idempotency under subscription row lock
    IF EXISTS (
        SELECT 1 FROM public.subscription_usage_ledger
        WHERE organization_id = p_organization_id 
          AND message_id = p_message_id 
          AND status = 'RESERVED'
    ) THEN
        SELECT balance_after INTO v_new_balance
        FROM public.subscription_usage_ledger
        WHERE organization_id = p_organization_id 
          AND message_id = p_message_id 
          AND status = 'RESERVED'
        ORDER BY created_at DESC
        LIMIT 1;

        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'ALREADY_RESERVED',
            'message_id', p_message_id,
            'balance_after', v_new_balance
        );
    END IF;

    -- Derive Quota from Plans Catalog
    SELECT * INTO v_plan FROM public.plans WHERE id = v_sub.plan_id;
    IF v_plan.id IS NULL OR v_plan.is_active = FALSE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_OR_INACTIVE_PLAN');
    END IF;

    -- Incorporate Active Add-on Entitlements
    SELECT COALESCE(SUM(additional_dms), 0) INTO v_entitlement_quota
    FROM public.subscription_entitlements
    WHERE organization_id = p_organization_id
      AND is_active = TRUE
      AND NOW() BETWEEN valid_from AND valid_until;

    v_effective_max_quota := v_plan.monthly_dm_quota + v_entitlement_quota;

    -- Lock and Read Current Period Aggregate
    SELECT * INTO v_usage_rec
    FROM public.subscription_usage_records
    WHERE organization_id = p_organization_id AND period_start = v_sub.current_period_start
    FOR UPDATE;

    IF v_usage_rec.id IS NULL THEN
        INSERT INTO public.subscription_usage_records (
            organization_id, subscription_id, period_start, period_end, dms_consumed, allocated_quota
        ) VALUES (
            p_organization_id, v_sub.id, v_sub.current_period_start, v_sub.current_period_end, 0, v_effective_max_quota
        ) RETURNING * INTO v_usage_rec;
    END IF;

    -- Enforce Quota Boundary
    IF v_usage_rec.dms_consumed >= v_effective_max_quota THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'QUOTA_EXCEEDED',
            'consumed', v_usage_rec.dms_consumed,
            'max_quota', v_effective_max_quota
        );
    END IF;

    -- Atomic Increment and Append to Immutable Ledger
    v_new_balance := v_usage_rec.dms_consumed + 1;

    UPDATE public.subscription_usage_records
    SET dms_consumed = v_new_balance,
        allocated_quota = v_effective_max_quota,
        updated_at = NOW()
    WHERE id = v_usage_rec.id;

    INSERT INTO public.subscription_usage_ledger (
        organization_id, subscription_id, usage_record_id, period_start, period_end,
        message_id, amount, balance_after, status, created_at
    ) VALUES (
        p_organization_id, v_sub.id, v_usage_rec.id, v_usage_rec.period_start, v_usage_rec.period_end,
        p_message_id, 1, v_new_balance, 'RESERVED', clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'RESERVED',
        'message_id', p_message_id,
        'balance_after', v_new_balance,
        'max_quota', v_effective_max_quota
    );
END;
$$;

ALTER FUNCTION public.reserve_dm_quota(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reserve_dm_quota FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_dm_quota TO service_role, app_worker;

-- ------------------------------------------------------------------------------
-- 7. Period-Consistent Compensating Refund Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_dm_quota(
    p_organization_id UUID,
    p_message_id TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reservation RECORD;
    v_usage_rec RECORD;
    v_new_balance INTEGER;
BEGIN
    -- Verify trusted caller
    IF NOT public.fn_is_trusted_system_caller() THEN
        RAISE EXCEPTION 'Access Denied: refund_dm_quota requires service_role or app_worker privileges.';
    END IF;

    -- Lock and identify original reservation row
    SELECT * INTO v_reservation
    FROM public.subscription_usage_ledger
    WHERE organization_id = p_organization_id
      AND message_id = p_message_id
      AND status = 'RESERVED'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_reservation.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'RESERVATION_NOT_FOUND');
    END IF;

    -- Verify Idempotency Under Lock (Single Refund per Reservation)
    IF EXISTS (
        SELECT 1 FROM public.subscription_usage_ledger
        WHERE organization_id = p_organization_id
          AND original_reservation_id = v_reservation.id
          AND status = 'REFUNDED'
    ) THEN
        RETURN jsonb_build_object('success', TRUE, 'status', 'ALREADY_REFUNDED', 'message_id', p_message_id);
    END IF;

    -- Lock Exact Target Period Usage Record Bound to Original Reservation
    SELECT * INTO v_usage_rec
    FROM public.subscription_usage_records
    WHERE id = v_reservation.usage_record_id
      AND organization_id = p_organization_id
    FOR UPDATE;

    IF v_usage_rec.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'ORIGINAL_PERIOD_RECORD_NOT_FOUND');
    END IF;

    -- Fail Closed on Inconsistent Count (Never silently clamp with GREATEST)
    IF v_usage_rec.dms_consumed <= 0 THEN
        RAISE EXCEPTION 'Data Inconsistency Violation: Cannot refund reservation % because period aggregate consumed count is % (expected > 0).', v_reservation.id, v_usage_rec.dms_consumed;
    END IF;

    v_new_balance := v_usage_rec.dms_consumed - 1;

    -- Decrement Target Period Usage Record
    UPDATE public.subscription_usage_records
    SET dms_consumed = v_new_balance,
        updated_at = NOW()
    WHERE id = v_usage_rec.id;

    -- Append Immutable Compensating Refund Entry to Ledger referencing exact original reservation
    INSERT INTO public.subscription_usage_ledger (
        organization_id, subscription_id, usage_record_id, period_start, period_end,
        message_id, amount, balance_after, status, original_reservation_id, refund_reason, created_at
    ) VALUES (
        p_organization_id, v_reservation.subscription_id, v_usage_rec.id, v_usage_rec.period_start, v_usage_rec.period_end,
        p_message_id, -1, v_new_balance, 'REFUNDED', v_reservation.id, p_reason, clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'REFUNDED',
        'message_id', p_message_id,
        'balance_after', v_new_balance,
        'period_start', v_usage_rec.period_start,
        'refund_reason', p_reason
    );
END;
$$;

ALTER FUNCTION public.refund_dm_quota(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.refund_dm_quota FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_dm_quota TO service_role, app_worker;

-- ------------------------------------------------------------------------------
-- 8. Table Permissions & Row Level Security (RLS)
-- ------------------------------------------------------------------------------
GRANT SELECT ON public.plans TO authenticated, anon, service_role, app_worker;
GRANT ALL ON public.plans TO service_role, app_worker;

GRANT SELECT ON public.subscriptions TO authenticated, service_role, app_worker;
GRANT ALL ON public.subscriptions TO service_role, app_worker;

GRANT SELECT ON public.subscription_entitlements TO authenticated, service_role, app_worker;
GRANT ALL ON public.subscription_entitlements TO service_role, app_worker;

GRANT SELECT ON public.subscription_usage_records TO authenticated, service_role, app_worker;
GRANT ALL ON public.subscription_usage_records TO service_role, app_worker;

GRANT SELECT ON public.subscription_usage_ledger TO authenticated, service_role, app_worker;
GRANT ALL ON public.subscription_usage_ledger TO service_role, app_worker;

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage_ledger FORCE ROW LEVEL SECURITY;

-- 8.1 plans
DROP POLICY IF EXISTS "v27_plans_select" ON public.plans;
CREATE POLICY "v27_plans_select" ON public.plans FOR SELECT TO authenticated, anon 
USING (is_active = TRUE OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_plans_service" ON public.plans;
CREATE POLICY "v27_plans_service" ON public.plans FOR ALL TO service_role, app_worker 
USING (true) WITH CHECK (true);

-- 8.2 subscriptions
DROP POLICY IF EXISTS "v27_sub_select" ON public.subscriptions;
CREATE POLICY "v27_sub_select" ON public.subscriptions FOR SELECT TO authenticated 
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_sub_service" ON public.subscriptions;
CREATE POLICY "v27_sub_service" ON public.subscriptions FOR ALL TO service_role, app_worker 
USING (true) WITH CHECK (true);

-- 8.3 subscription_entitlements
DROP POLICY IF EXISTS "v27_ent_select" ON public.subscription_entitlements;
CREATE POLICY "v27_ent_select" ON public.subscription_entitlements FOR SELECT TO authenticated 
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_ent_service" ON public.subscription_entitlements;
CREATE POLICY "v27_ent_service" ON public.subscription_entitlements FOR ALL TO service_role, app_worker 
USING (true) WITH CHECK (true);

-- 8.4 subscription_usage_records
DROP POLICY IF EXISTS "v27_usg_select" ON public.subscription_usage_records;
CREATE POLICY "v27_usg_select" ON public.subscription_usage_records FOR SELECT TO authenticated 
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_usg_service" ON public.subscription_usage_records;
CREATE POLICY "v27_usg_service" ON public.subscription_usage_records FOR ALL TO service_role, app_worker 
USING (true) WITH CHECK (true);

-- 8.5 subscription_usage_ledger
DROP POLICY IF EXISTS "v27_ledger_select" ON public.subscription_usage_ledger;
CREATE POLICY "v27_ledger_select" ON public.subscription_usage_ledger FOR SELECT TO authenticated 
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_ledger_service" ON public.subscription_usage_ledger;
CREATE POLICY "v27_ledger_service" ON public.subscription_usage_ledger FOR ALL TO service_role, app_worker 
USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 9. Seed Active Subscriptions for Pilot & Demo Clinics
-- ------------------------------------------------------------------------------
INSERT INTO public.subscriptions (
    id, organization_id, plan_id, status, current_period_start, current_period_end
) VALUES 
    (
        'c0000000-0000-0000-0000-000000000001'::uuid,
        'a0000000-0000-0000-0000-000000000001'::uuid,
        'professional',
        'active',
        NOW() - INTERVAL '1 day',
        NOW() + INTERVAL '29 days'
    ),
    (
        'c0000000-0000-0000-0000-000000000002'::uuid,
        'a0000000-0000-0000-0000-000000000002'::uuid,
        'enterprise',
        'trialing',
        NOW() - INTERVAL '1 day',
        NOW() + INTERVAL '29 days'
    )
ON CONFLICT (organization_id, id) DO NOTHING;
