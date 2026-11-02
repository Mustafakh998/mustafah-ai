-- =============================================================================
-- MUSTAFAH-AI — CONSOLIDATED PRODUCTION SUPABASE MIGRATION
-- Project ID: mvokslekhpawkvjwzbos
-- Execution Order: Phase 0 through Phase 7 (Full Multi-Tenant Foundation)
-- Generated: 2026-11-02T00:22:42.080Z
-- =============================================================================

-- =============================================================================
-- BEGIN MIGRATION: 20261030000000_almeswak_schema.sql
-- =============================================================================

-- ==============================================================================
-- ALMESWAK AI — BAGHDAD EDITION
-- PostgreSQL / Supabase Production Schema & Migrations
-- Version: 2026.10.30
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Instagram Accounts Table (Independent Multi-Tenant OAuth)
CREATE TABLE IF NOT EXISTS instagram_accounts (
    id TEXT PRIMARY KEY, -- 'drmustafa_hadi' or 'almeswaksmile_iq'
    handle TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Dental Clinic',
    followers INTEGER NOT NULL DEFAULT 0,
    following INTEGER NOT NULL DEFAULT 0,
    posts_count INTEGER NOT NULL DEFAULT 0,
    avatar_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'demo_mode', 'disconnected', 'token_expiring')),
    token_expires_at TIMESTAMPTZ,
    access_token_encrypted TEXT,
    role TEXT NOT NULL CHECK (role IN ('personal_brand', 'clinic_official')),
    bio_ar TEXT,
    location_ar TEXT,
    phone TEXT NOT NULL DEFAULT '07768886667',
    permissions JSONB NOT NULL DEFAULT '{"instagram_basic": false, "instagram_manage_messages": false, "pages_manage_metadata": false, "instagram_manage_comments": false}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Leads CRM Pipeline Table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    instagram_username TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    phone TEXT,
    treatment TEXT NOT NULL CHECK (treatment IN ('orthodontics', 'cosmetic_emax', 'pediatric', 'teeth_whitening', 'general_restorative', 'facial_aesthetics', 'consultation')),
    treatment_name_ar TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new_inquiry' CHECK (status IN ('new_inquiry', 'qualified', 'appointment_requested', 'confirmed', 'attended', 'lost')),
    inquiry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    campaign_source TEXT,
    estimated_value_iqd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    staff_notes TEXT,
    confidence_score NUMERIC(4, 3) NOT NULL DEFAULT 0.900,
    last_message_text TEXT,
    is_handed_over_to_human BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

-- 3. Appointments Management Table (Manual Reception Availability Workflow)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    treatment TEXT NOT NULL,
    treatment_name_ar TEXT NOT NULL,
    preferred_date DATE NOT NULL,
    preferred_time TEXT NOT NULL,
    assigned_doctor TEXT NOT NULL,
    assigned_doctor_ar TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new_request' CHECK (status IN ('new_request', 'awaiting_confirmation', 'confirmed', 'attended', 'cancelled', 'no_show')),
    reception_notes TEXT,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(preferred_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 4. Conversations and Messages Table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY, -- Meta Instagram thread ID or conv_id
    account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    instagram_username TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active_ai' CHECK (status IN ('active_ai', 'human_takeover', 'booked', 'archived')),
    treatment_interest TEXT,
    unread BOOLEAN NOT NULL DEFAULT TRUE,
    last_message TEXT,
    last_message_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    patient_phone TEXT,
    preferred_date TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'staff')),
    text TEXT NOT NULL,
    intent TEXT,
    confidence NUMERIC(4, 3),
    suggested_reply TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON chat_messages(conversation_id);

-- 5. Content Studio & 30-Day Publishing Calendar
CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('reel', 'carousel', 'story')),
    series_name_ar TEXT NOT NULL,
    hook_ar TEXT NOT NULL,
    script_ar TEXT NOT NULL,
    visual_direction_ar TEXT,
    caption_ar TEXT NOT NULL,
    cta_ar TEXT NOT NULL,
    cover_headline_ar TEXT NOT NULL,
    target_audience_ar TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review_needed', 'approved', 'published')),
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    inquiries_generated INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_date ON content_items(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_content_status ON content_items(status);

-- 6. Ad Campaigns Table (<$100/mo Budget Controller)
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    objective TEXT NOT NULL CHECK (objective IN ('click_to_instagram_direct', 'reel_engagement', 'retargeting')),
    allocated_budget_usd NUMERIC(8, 2) NOT NULL,
    spent_usd NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft_pending_approval' CHECK (status IN ('active', 'paused', 'draft_pending_approval')),
    target_location TEXT NOT NULL,
    target_audience_ar TEXT NOT NULL,
    reach INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    conversations_started INTEGER NOT NULL DEFAULT 0,
    qualified_inquiries INTEGER NOT NULL DEFAULT 0,
    appointment_requests INTEGER NOT NULL DEFAULT 0,
    confirmed_appointments INTEGER NOT NULL DEFAULT 0,
    attended_patients INTEGER NOT NULL DEFAULT 0,
    requires_human_approval BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Webhook Logs Table (Audit & Debugging)
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    sender_id TEXT,
    payload_snippet TEXT,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed')),
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Initial Accounts
INSERT INTO instagram_accounts (id, handle, name, name_ar, category, followers, following, posts_count, is_verified, status, token_expires_at, role, bio_ar, location_ar, phone, permissions)
VALUES
(
    'drmustafa_hadi',
    'drmustafa_hadi',
    'Dr. Mustafa Hadi',
    'د. مصطفى هادي',
    'Orthodontist',
    717,
    6412,
    16,
    false,
    'connected',
    NOW() + INTERVAL '45 days',
    'personal_brand',
    'أخصائي تقويم الأسنان والفكين | ابتسامات يقودها العلم والتكنولوجيا | مهتم بالتقنية والبرمجة | 📍 العراق - بغداد',
    'العراق، بغداد (عيادة المسواك - زيونة، خدمي دريم سيتي مول)',
    '07768886667',
    '{"instagram_basic": true, "instagram_manage_messages": true, "pages_manage_metadata": true, "instagram_manage_comments": true}'::jsonb
),
(
    'almeswaksmile_iq',
    'almeswaksmile.iq',
    'Almeswak Dental Clinic',
    'عيادة المسواك لطب وتجميل الأسنان',
    'Dental Clinic',
    1123,
    3,
    83,
    true,
    'demo_mode',
    NOW() + INTERVAL '20 days',
    'clinic_official',
    'ابتسامة | عناية | علاج | ثقة | 📍 بغداد – زيونة – خدمي دريم سيتي مول (مجاور مطعم صيف) | للحجز: 07768886667 | الاستفسار: دايركت',
    'بغداد – زيونة – خدمي دريم سيتي مول، مجاور مطعم صيف وشتاء، فوق مقهى الخيال (الطابق السادس، شقة 6)',
    '07768886667',
    '{"instagram_basic": false, "instagram_manage_messages": false, "pages_manage_metadata": false, "instagram_manage_comments": false}'::jsonb
)
ON CONFLICT (id) DO NOTHING;



-- =============================================================================
-- END MIGRATION: 20261030000000_almeswak_schema.sql
-- =============================================================================

-- =============================================================================
-- BEGIN MIGRATION: 20261031000000_phase3_reliability.sql
-- =============================================================================

-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 3: Production Reliability & Persistence Schema
-- Version: 2026.10.31
-- ==============================================================================

-- 1. Persistent Message Deduplication Table
-- Guarantees atomic deduplication across server restarts and multi-instance concurrency
CREATE TABLE IF NOT EXISTS processed_webhook_messages (
    message_id TEXT PRIMARY KEY, -- Meta 'mid' or unique event ID
    account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('received', 'processing', 'processed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_messages_account ON processed_webhook_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_processed_messages_sender ON processed_webhook_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_processed_messages_received_at ON processed_webhook_messages(received_at);

-- 2. Persistent Human Takeovers Table
-- Persists human takeover status across restarts and all server instances until released by authorized staff
CREATE TABLE IF NOT EXISTS human_takeovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL, -- Instagram Scoped User ID (IGSID)
    conversation_id TEXT,
    reason TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    released_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index ensures only one active takeover per sender/account at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_human_takeover ON human_takeovers(account_id, sender_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_takeovers_account ON human_takeovers(account_id);
CREATE INDEX IF NOT EXISTS idx_takeovers_sender ON human_takeovers(sender_id);

-- 3. Persistent Escalation & CRM Events Table
-- Durably records all clinical emergencies, pricing inquiries, 24h violations, and API errors
CREATE TABLE IF NOT EXISTS escalation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    conversation_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'orthodontic_pricing_inquiry',
        'orthodontic_installment_inquiry',
        'medical_emergency',
        'human_agent_requested',
        'outside_24h_window',
        'outbound_dispatch_failed',
        'token_expired_or_invalid',
        'rate_limit_exceeded'
    )),
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
    raw_message_text TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    requires_followup BOOLEAN NOT NULL DEFAULT TRUE,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_account ON escalation_events(account_id);
CREATE INDEX IF NOT EXISTS idx_escalation_type ON escalation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_escalation_followup ON escalation_events(requires_followup);
CREATE INDEX IF NOT EXISTS idx_escalation_created ON escalation_events(created_at);

-- 4. Durable Webhook Jobs Queue Table
-- Enables reliable async processing, retry management, and dead-letter handling
CREATE TABLE IF NOT EXISTS webhook_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id TEXT NOT NULL UNIQUE,
    account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON webhook_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_account ON webhook_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON webhook_jobs(created_at);



-- =============================================================================
-- END MIGRATION: 20261031000000_phase3_reliability.sql
-- =============================================================================

-- =============================================================================
-- BEGIN MIGRATION: 20261031010000_phase4_rls_and_pooling.sql
-- =============================================================================

-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 4: Production Security, Row Level Security (RLS) & Connection Pooling
-- Version: 2026.10.31
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enable Row Level Security (RLS) on All Production Tables
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS processed_webhook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS human_takeovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS webhook_jobs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Service Role Access Policies (Full Trusted Access for Webhooks & Workers)
-- ------------------------------------------------------------------------------
-- The Supabase service_role key is used exclusively by trusted server-side
-- webhooks, background workers, and automated dispatchers.
CREATE POLICY "Service role full access on instagram_accounts" ON instagram_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on leads" ON leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on appointments" ON appointments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on conversations" ON conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on chat_messages" ON chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on content_items" ON content_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on ad_campaigns" ON ad_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on webhook_logs" ON webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on processed_webhook_messages" ON processed_webhook_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on human_takeovers" ON human_takeovers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on escalation_events" ON escalation_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on webhook_jobs" ON webhook_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. Public Read Policies (Public Brand Info for Patient Landing)
-- ------------------------------------------------------------------------------
-- Only the active personal brand profile is readable by unauthenticated users.
-- The clinic account @almeswaksmile_iq remains isolated and protected.
CREATE POLICY "Public read for active personal brand profile" ON instagram_accounts
    FOR SELECT TO anon, authenticated
    USING (id = 'drmustafa_hadi' AND status = 'connected');

-- ------------------------------------------------------------------------------
-- 4. Authenticated Clinic Staff CRM Policies (Tenancy & Isolation Enforcement)
-- ------------------------------------------------------------------------------
-- Staff can view and manage leads for Dr. Mustafa Hadi
CREATE POLICY "Staff read leads for pilot account" ON leads
    FOR SELECT TO authenticated
    USING (account_id = 'drmustafa_hadi');

CREATE POLICY "Staff update leads for pilot account" ON leads
    FOR UPDATE TO authenticated
    USING (account_id = 'drmustafa_hadi')
    WITH CHECK (account_id = 'drmustafa_hadi');

CREATE POLICY "Staff insert leads for pilot account" ON leads
    FOR INSERT TO authenticated
    WITH CHECK (account_id = 'drmustafa_hadi');

-- Staff can view and manage appointments
CREATE POLICY "Staff read appointments for pilot account" ON appointments
    FOR SELECT TO authenticated
    USING (account_id = 'drmustafa_hadi');

CREATE POLICY "Staff update appointments for pilot account" ON appointments
    FOR UPDATE TO authenticated
    USING (account_id = 'drmustafa_hadi')
    WITH CHECK (account_id = 'drmustafa_hadi');

-- Staff can view conversations and messages
CREATE POLICY "Staff read conversations for pilot account" ON conversations
    FOR SELECT TO authenticated
    USING (account_id = 'drmustafa_hadi');

CREATE POLICY "Staff read chat messages" ON chat_messages
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = chat_messages.conversation_id AND c.account_id = 'drmustafa_hadi'
    ));

-- Staff can view and release human takeovers
CREATE POLICY "Staff view human takeovers" ON human_takeovers
    FOR SELECT TO authenticated
    USING (account_id = 'drmustafa_hadi');

CREATE POLICY "Staff update human takeovers" ON human_takeovers
    FOR UPDATE TO authenticated
    USING (account_id = 'drmustafa_hadi')
    WITH CHECK (account_id = 'drmustafa_hadi');

-- Staff can review escalation events in CRM
CREATE POLICY "Staff view escalation events" ON escalation_events
    FOR SELECT TO authenticated
    USING (account_id = 'drmustafa_hadi');

CREATE POLICY "Staff update escalation events" ON escalation_events
    FOR UPDATE TO authenticated
    USING (account_id = 'drmustafa_hadi')
    WITH CHECK (account_id = 'drmustafa_hadi');

-- Content studio items for pilot account
CREATE POLICY "Staff manage content items" ON content_items
    FOR ALL TO authenticated
    USING (account_id = 'drmustafa_hadi')
    WITH CHECK (account_id = 'drmustafa_hadi');

-- ------------------------------------------------------------------------------
-- 5. Strict Account Isolation Protection for @almeswaksmile_iq
-- ------------------------------------------------------------------------------
-- Prohibits non-service-role modification of clinic records while in demo mode.
-- Prevents accidental state transitions without authorized clinic admin OAuth.
CREATE POLICY "Clinic workspace isolation guard" ON instagram_accounts
    FOR UPDATE TO authenticated
    USING (id != 'almeswaksmile_iq')
    WITH CHECK (id != 'almeswaksmile_iq');

-- ------------------------------------------------------------------------------
-- 6. Supabase Connection Pooling & Index Optimizations
-- ------------------------------------------------------------------------------
-- Index for quick lookups on pending/failed webhook queue jobs
CREATE INDEX IF NOT EXISTS idx_webhook_jobs_pending_processing
    ON webhook_jobs (status, attempts, created_at)
    WHERE status IN ('pending', 'failed');

-- Index for fast lookup of active human takeovers
CREATE INDEX IF NOT EXISTS idx_active_takeovers_lookup
    ON human_takeovers (account_id, sender_id)
    WHERE is_active = TRUE;

-- Index for unresolved escalations requiring staff followup
CREATE INDEX IF NOT EXISTS idx_unresolved_escalations
    ON escalation_events (account_id, severity, created_at)
    WHERE requires_followup = TRUE;



-- =============================================================================
-- END MIGRATION: 20261031010000_phase4_rls_and_pooling.sql
-- =============================================================================

-- =============================================================================
-- BEGIN MIGRATION: 20261031020000_multitenant_core_foundation.sql
-- =============================================================================

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


-- =============================================================================
-- END MIGRATION: 20261031020000_multitenant_core_foundation.sql
-- =============================================================================

-- =============================================================================
-- BEGIN MIGRATION: 20261031030000_multitenant_domain_partitioning.sql
-- =============================================================================

-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Phase 2: Relational Domain Partitioning & Composite Key Multi-Tenancy
-- Migration: 20261031030000_multitenant_domain_partitioning.sql
-- ==============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ------------------------------------------------------------------------------
-- 1. Tenant AI Configs Table (Doctor & Clinic Persona Directory)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_ai_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    assistant_name_ar TEXT NOT NULL DEFAULT 'المساعد الذكي',
    doctor_name_ar TEXT NOT NULL,
    slogan_ar TEXT,
    primary_location_ar TEXT NOT NULL,
    emergency_phone TEXT NOT NULL DEFAULT '07768886667',
    working_hours_ar TEXT NOT NULL,
    dialect_mode TEXT NOT NULL DEFAULT 'iraqi_baghdadi',
    custom_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    approved_services JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_ortho_pricing_prohibited BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_ortho_pricing_prohibited = TRUE),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default AI Configurations for Pilot & Demo Clinics (Idempotent)
INSERT INTO public.tenant_ai_configs (
    organization_id, assistant_name_ar, doctor_name_ar, slogan_ar, primary_location_ar, emergency_phone, working_hours_ar
) VALUES 
    (
        'a0000000-0000-0000-0000-000000000001'::uuid,
        'المساعد الذكي لعيادة د. مصطفى هادي',
        'د. مصطفى هادي',
        'ابتسامتك تبدأ هنا',
        'بغداد - زيونة - مقابل دريم سيتي مول',
        '07768886667',
        'السبت - الخميس: 4:00 عصراً - 9:00 مساءً'
    ),
    (
        'a0000000-0000-0000-0000-000000000002'::uuid,
        'المساعد التجريبي لمركز المسواك',
        'أطباء مركز المسواك',
        'صحة أسنانكم غايتنا',
        'بغداد - مركز المسواك (نسخة تجريبية مغلقة)',
        '07700000000',
        'تجريبي مغلق'
    )
ON CONFLICT (organization_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Add organization_id Column to Operational Domain Tables
-- ------------------------------------------------------------------------------
ALTER TABLE public.instagram_accounts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.processed_webhook_messages ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.human_takeovers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.webhook_jobs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 3. Data Backfill & Tenant Reconciliation
-- ------------------------------------------------------------------------------
-- 3.1 Backfill instagram_accounts
UPDATE public.instagram_accounts
SET organization_id = CASE
    WHEN id = 'almeswaksmile_iq' OR handle ILIKE '%almeswak%' THEN 'a0000000-0000-0000-0000-000000000002'::uuid
    ELSE 'a0000000-0000-0000-0000-000000000001'::uuid
END
WHERE organization_id IS NULL;

-- 3.2 Backfill Child Tables with account_id
UPDATE public.leads l
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE l.account_id = a.id AND l.organization_id IS NULL;

UPDATE public.conversations c
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE c.account_id = a.id AND c.organization_id IS NULL;

UPDATE public.appointments app
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE app.account_id = a.id AND app.organization_id IS NULL;

UPDATE public.processed_webhook_messages p
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE p.account_id = a.id AND p.organization_id IS NULL;

UPDATE public.human_takeovers h
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE h.account_id = a.id AND h.organization_id IS NULL;

UPDATE public.escalation_events e
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE e.account_id = a.id AND e.organization_id IS NULL;

UPDATE public.webhook_jobs j
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE j.account_id = a.id AND j.organization_id IS NULL;

UPDATE public.content_items ci
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE ci.account_id = a.id AND ci.organization_id IS NULL;

UPDATE public.ad_campaigns ac
SET organization_id = a.organization_id
FROM public.instagram_accounts a
WHERE ac.account_id = a.id AND ac.organization_id IS NULL;

-- 3.3 Backfill chat_messages via conversation
UPDATE public.chat_messages m
SET organization_id = c.organization_id
FROM public.conversations c
WHERE m.conversation_id = c.id AND m.organization_id IS NULL;

-- Fallback safety for any orphaned row
UPDATE public.leads SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.conversations SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.appointments SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.chat_messages SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.processed_webhook_messages SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.human_takeovers SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.escalation_events SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.webhook_jobs SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.content_items SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.ad_campaigns SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;

-- Backfill appointments branch_id to Dr. Mustafa Hadi Main Branch if null
UPDATE public.appointments
SET branch_id = 'b0000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid AND branch_id IS NULL;

-- ------------------------------------------------------------------------------
-- 4. Enforce NOT NULL on organization_id
-- ------------------------------------------------------------------------------
ALTER TABLE public.instagram_accounts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.chat_messages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.processed_webhook_messages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.human_takeovers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.escalation_events ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.webhook_jobs ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.content_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.ad_campaigns ALTER COLUMN organization_id SET NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. Automatic Organization ID Resolution Trigger Function (Backward Compatibility)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_resolve_account_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        IF NEW.account_id IS NOT NULL THEN
            SELECT organization_id INTO NEW.organization_id
            FROM public.instagram_accounts
            WHERE id = NEW.account_id;
        END IF;

        IF NEW.organization_id IS NULL THEN
            NEW.organization_id := 'a0000000-0000-0000-0000-000000000001'::uuid;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_org_leads ON public.leads;
CREATE TRIGGER trg_resolve_org_leads BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_conv ON public.conversations;
CREATE TRIGGER trg_resolve_org_conv BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_appt ON public.appointments;
CREATE TRIGGER trg_resolve_org_appt BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_dedup ON public.processed_webhook_messages;
CREATE TRIGGER trg_resolve_org_dedup BEFORE INSERT ON public.processed_webhook_messages
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_takeover ON public.human_takeovers;
CREATE TRIGGER trg_resolve_org_takeover BEFORE INSERT ON public.human_takeovers
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_escalation ON public.escalation_events;
CREATE TRIGGER trg_resolve_org_escalation BEFORE INSERT ON public.escalation_events
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

DROP TRIGGER IF EXISTS trg_resolve_org_jobs ON public.webhook_jobs;
CREATE TRIGGER trg_resolve_org_jobs BEFORE INSERT ON public.webhook_jobs
FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_account_organization_id();

-- ------------------------------------------------------------------------------
-- 6. Composite Unique Constraints & Foreign Keys
-- ------------------------------------------------------------------------------
-- Parent Unique Constraints
ALTER TABLE public.instagram_accounts DROP CONSTRAINT IF EXISTS uq_accounts_org_id, ADD CONSTRAINT uq_accounts_org_id UNIQUE (organization_id, id);
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS uq_leads_org_id, ADD CONSTRAINT uq_leads_org_id UNIQUE (organization_id, id);
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS uq_conversations_org_id, ADD CONSTRAINT uq_conversations_org_id UNIQUE (organization_id, id);
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS uq_appointments_org_id, ADD CONSTRAINT uq_appointments_org_id UNIQUE (organization_id, id);

-- Child Composite Foreign Keys
ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS fk_leads_account_composite,
    ADD CONSTRAINT fk_leads_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.conversations
    DROP CONSTRAINT IF EXISTS fk_conversations_account_composite,
    ADD CONSTRAINT fk_conversations_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.chat_messages
    DROP CONSTRAINT IF EXISTS fk_messages_conv_composite,
    ADD CONSTRAINT fk_messages_conv_composite
    FOREIGN KEY (organization_id, conversation_id) REFERENCES public.conversations(organization_id, id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_account_composite,
    ADD CONSTRAINT fk_appointments_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_lead_composite,
    ADD CONSTRAINT fk_appointments_lead_composite
    FOREIGN KEY (organization_id, lead_id) REFERENCES public.leads(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT;

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS fk_appointments_branch_composite,
    ADD CONSTRAINT fk_appointments_branch_composite
    FOREIGN KEY (organization_id, branch_id) REFERENCES public.branches(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT;

ALTER TABLE public.processed_webhook_messages
    DROP CONSTRAINT IF EXISTS fk_dedup_account_composite,
    ADD CONSTRAINT fk_dedup_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.human_takeovers
    DROP CONSTRAINT IF EXISTS fk_takeovers_account_composite,
    ADD CONSTRAINT fk_takeovers_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.human_takeovers
    DROP CONSTRAINT IF EXISTS fk_takeovers_conv_composite,
    ADD CONSTRAINT fk_takeovers_conv_composite
    FOREIGN KEY (organization_id, conversation_id) REFERENCES public.conversations(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT;

ALTER TABLE public.escalation_events
    DROP CONSTRAINT IF EXISTS fk_escalations_account_composite,
    ADD CONSTRAINT fk_escalations_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE public.escalation_events
    DROP CONSTRAINT IF EXISTS fk_escalations_conv_composite,
    ADD CONSTRAINT fk_escalations_conv_composite
    FOREIGN KEY (organization_id, conversation_id) REFERENCES public.conversations(organization_id, id)
    ON DELETE NO ACTION ON UPDATE RESTRICT;

ALTER TABLE public.webhook_jobs
    DROP CONSTRAINT IF EXISTS fk_jobs_account_composite,
    ADD CONSTRAINT fk_jobs_account_composite
    FOREIGN KEY (organization_id, account_id) REFERENCES public.instagram_accounts(organization_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ------------------------------------------------------------------------------
-- 7. Safe Non-Null Preserving Cascade Triggers (Soft Deletion / Set Null)
-- ------------------------------------------------------------------------------
-- 7.1 Safe Orphan Trigger for Branches (preserves organization_id on child records)
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_branches()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Safely nullify branch_id on appointments while preserving organization_id
    UPDATE public.appointments
    SET branch_id = NULL
    WHERE organization_id = OLD.organization_id AND branch_id = OLD.id;

    -- Safely nullify branch_id on members while preserving organization_id
    UPDATE public.organization_members
    SET branch_id = NULL
    WHERE organization_id = OLD.organization_id AND branch_id = OLD.id;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_safe_orphan_branches ON public.branches;
CREATE TRIGGER trg_safe_orphan_branches
BEFORE DELETE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_branches();

-- 7.2 Safe Orphan Trigger for Leads (preserves organization_id on appointments)
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_leads()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.appointments
    SET lead_id = NULL
    WHERE organization_id = OLD.organization_id AND lead_id = OLD.id;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_safe_orphan_leads ON public.leads;
CREATE TRIGGER trg_safe_orphan_leads
BEFORE DELETE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_leads();

-- 7.3 Safe Orphan Trigger for Conversations (preserves organization_id on takeovers & escalations)
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.human_takeovers
    SET conversation_id = NULL
    WHERE organization_id = OLD.organization_id AND conversation_id = OLD.id;

    UPDATE public.escalation_events
    SET conversation_id = NULL
    WHERE organization_id = OLD.organization_id AND conversation_id = OLD.id;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_safe_orphan_conversations ON public.conversations;
CREATE TRIGGER trg_safe_orphan_conversations
BEFORE DELETE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_conversations();

-- Apply Universal Tenant Mutation Lock on Operational Tables
DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_leads ON public.leads;
CREATE TRIGGER trg_prevent_tenant_mutation_leads BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_appt ON public.appointments;
CREATE TRIGGER trg_prevent_tenant_mutation_appt BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_conv ON public.conversations;
CREATE TRIGGER trg_prevent_tenant_mutation_conv BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_tenant_mutation();

-- ------------------------------------------------------------------------------
-- 8. Table Permissions & Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_ai_configs TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_accounts TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processed_webhook_messages TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.human_takeovers TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalation_events TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_jobs TO authenticated, service_role, app_worker;

-- Enable and Force RLS
ALTER TABLE public.tenant_ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ai_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.human_takeovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_takeovers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_jobs FORCE ROW LEVEL SECURITY;

-- 8.1 tenant_ai_configs RLS
DROP POLICY IF EXISTS "v27_ai_select" ON public.tenant_ai_configs;
CREATE POLICY "v27_ai_select" ON public.tenant_ai_configs FOR SELECT TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_ai_update" ON public.tenant_ai_configs;
CREATE POLICY "v27_ai_update" ON public.tenant_ai_configs FOR UPDATE TO authenticated
USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin())
WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_ai_service" ON public.tenant_ai_configs;
CREATE POLICY "v27_ai_service" ON public.tenant_ai_configs FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.2 instagram_accounts RLS
DROP POLICY IF EXISTS "v27_acc_select" ON public.instagram_accounts;
CREATE POLICY "v27_acc_select" ON public.instagram_accounts FOR SELECT TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_acc_service" ON public.instagram_accounts;
CREATE POLICY "v27_acc_service" ON public.instagram_accounts FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.3 leads RLS
DROP POLICY IF EXISTS "v27_leads_all" ON public.leads;
CREATE POLICY "v27_leads_all" ON public.leads FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_leads_service" ON public.leads;
CREATE POLICY "v27_leads_service" ON public.leads FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.4 appointments RLS (Branch-scoped visibility)
DROP POLICY IF EXISTS "v27_appt_all" ON public.appointments;
CREATE POLICY "v27_appt_all" ON public.appointments FOR ALL TO authenticated
USING (
    public.is_platform_superadmin() OR
    (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND
        (
            public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR
            branch_id IS NULL OR
            branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(organization_id))
        )
    )
)
WITH CHECK (
    public.is_platform_superadmin() OR
    (
        organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) AND
        (
            public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR
            branch_id IS NULL OR
            branch_id IN (SELECT branch_id FROM public.get_auth_branch_ids(organization_id))
        )
    )
);

DROP POLICY IF EXISTS "v27_appt_service" ON public.appointments;
CREATE POLICY "v27_appt_service" ON public.appointments FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.5 conversations RLS
DROP POLICY IF EXISTS "v27_conv_all" ON public.conversations;
CREATE POLICY "v27_conv_all" ON public.conversations FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_conv_service" ON public.conversations;
CREATE POLICY "v27_conv_service" ON public.conversations FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.6 chat_messages RLS
DROP POLICY IF EXISTS "v27_msg_all" ON public.chat_messages;
CREATE POLICY "v27_msg_all" ON public.chat_messages FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_msg_service" ON public.chat_messages;
CREATE POLICY "v27_msg_service" ON public.chat_messages FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

-- 8.7 Webhook Reliability Tables RLS
DROP POLICY IF EXISTS "v27_dedup_all" ON public.processed_webhook_messages;
CREATE POLICY "v27_dedup_all" ON public.processed_webhook_messages FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_dedup_service" ON public.processed_webhook_messages;
CREATE POLICY "v27_dedup_service" ON public.processed_webhook_messages FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "v27_takeover_all" ON public.human_takeovers;
CREATE POLICY "v27_takeover_all" ON public.human_takeovers FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_takeover_service" ON public.human_takeovers;
CREATE POLICY "v27_takeover_service" ON public.human_takeovers FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "v27_escalations_all" ON public.escalation_events;
CREATE POLICY "v27_escalations_all" ON public.escalation_events FOR ALL TO authenticated
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin())
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_escalations_service" ON public.escalation_events;
CREATE POLICY "v27_escalations_service" ON public.escalation_events FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "v27_jobs_service" ON public.webhook_jobs;
CREATE POLICY "v27_jobs_service" ON public.webhook_jobs FOR ALL TO service_role, app_worker USING (true) WITH CHECK (true);



-- =============================================================================
-- END MIGRATION: 20261031030000_multitenant_domain_partitioning.sql
-- =============================================================================

-- =============================================================================
-- BEGIN MIGRATION: 20261031040000_almeswak_quarantine_gate.sql
-- =============================================================================

-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Migration: 20261031040000_almeswak_quarantine_gate.sql
-- Description: Phase 3 — Almeswak Cryptographic Quarantine Gate & Activation API
--
-- Security Invariants:
-- 1. Almeswak Dental Clinic (@almeswaksmile.iq, id a0000000-0000-0000-0000-000000000002)
--    is permanently quarantined in demo_mode and cannot be activated via direct DML.
-- 2. Direct UPDATE or DELETE on Almeswak records is intercepted and blocked by
--    fn_enforce_almeswak_comprehensive_quarantine().
-- 3. Live activation requires cryptographic board approval token verified by
--    fn_verify_and_consume_platform_authorization() and executed through
--    api_activate_quarantined_clinic().
-- 4. Separation of duties: board_approval_verified_by_legal_admin_id != authorized_by_admin_id.
-- 5. Atomic single-use consumption and immutable audit logging.
-- 6. Zero orthodontic pricing disclosure across all channels and tenants.
-- ==============================================================================

SET statement_timeout = '60s';

-- Ensure pgcrypto extension is installed
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- ------------------------------------------------------------------------------
-- 1. Platform Authorization Vault Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_token_hash TEXT UNIQUE NOT NULL,
    target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('organization', 'integration', 'instagram_account')),
    target_entity_id UUID NOT NULL,
    target_handle TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN (
        'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 
        'ALMESWAK_CREDENTIAL_ASSOCIATION', 
        'EMERGENCY_QUARANTINE_OVERRIDE'
    )),
    action TEXT NOT NULL CHECK (action IN (
        'ACTIVATE_ORGANIZATION',
        'CONNECT_INTEGRATION',
        'INBOUND_WEBHOOK_PROCESSING',
        'DISPATCH_OUTBOUND_MESSAGE',
        'CREDENTIAL_ASSOCIATION',
        'EMERGENCY_QUARANTINE_OVERRIDE',
        'ALL_ACTIONS'
    )),
    board_resolution_reference TEXT NOT NULL,
    board_resolution_sha256 TEXT NOT NULL,
    board_approval_verified_by_legal_admin_id UUID NOT NULL REFERENCES auth.users(id),
    board_approval_verification_notes TEXT NOT NULL,
    authorized_by_admin_id UUID NOT NULL REFERENCES auth.users(id),
    admin_ip_address INET,
    is_single_use BOOLEAN NOT NULL DEFAULT TRUE,
    consumed_at TIMESTAMPTZ,
    consumed_by_user_id UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by_admin_id UUID REFERENCES auth.users(id),
    revocation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_separation_of_duties CHECK (board_approval_verified_by_legal_admin_id != authorized_by_admin_id),
    CONSTRAINT chk_auth_validity CHECK (expires_at > granted_at)
);

CREATE INDEX IF NOT EXISTS idx_platform_auth_lookup 
ON public.platform_authorizations (target_entity_id, purpose, action) 
WHERE revoked_at IS NULL AND (NOT is_single_use OR consumed_at IS NULL);

-- ------------------------------------------------------------------------------
-- 2. Immutable Platform Authorization Audit Log Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_authorization_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id UUID REFERENCES public.platform_authorizations(id),
    caller_role TEXT NOT NULL,
    caller_user_id UUID,
    attempted_action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_record_id TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN (
        'GRANTED',
        'DENIED_INVALID_SECRET',
        'DENIED_EXPIRED',
        'DENIED_REVOKED',
        'DENIED_ALREADY_CONSUMED',
        'DENIED_SCOPE_MISMATCH',
        'DENIED_NON_ADMIN',
        'DENIED_UNTRUSTED_CALLER'
    )),
    error_message TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_created 
ON public.platform_authorization_audit_log (created_at DESC);

-- Enable RLS on Authorization Tables (without FORCE so SECURITY DEFINER functions can manage vault)
ALTER TABLE public.platform_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorizations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorization_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_authorization_audit_log NO FORCE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.platform_authorizations TO authenticated, service_role, app_worker;
GRANT SELECT ON public.platform_authorization_audit_log TO authenticated, service_role, app_worker;
GRANT ALL ON public.platform_authorizations TO service_role, app_worker;
GRANT ALL ON public.platform_authorization_audit_log TO service_role, app_worker;

-- RLS Policies
DROP POLICY IF EXISTS "v27_plat_auth_select" ON public.platform_authorizations;
CREATE POLICY "v27_plat_auth_select" ON public.platform_authorizations 
FOR SELECT TO authenticated
USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_plat_auth_service" ON public.platform_authorizations;
CREATE POLICY "v27_plat_auth_service" ON public.platform_authorizations 
FOR ALL TO service_role, app_worker
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "v27_plat_audit_select" ON public.platform_authorization_audit_log;
CREATE POLICY "v27_plat_audit_select" ON public.platform_authorization_audit_log 
FOR SELECT TO authenticated
USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_plat_audit_service" ON public.platform_authorization_audit_log;
CREATE POLICY "v27_plat_audit_service" ON public.platform_authorization_audit_log 
FOR ALL TO service_role, app_worker
USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. Atomic Secret Verification & Consumption Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_verify_and_consume_platform_authorization(
    p_target_id UUID,
    p_target_entity_type TEXT,
    p_target_table TEXT,
    p_target_record_id TEXT,
    p_target_handle TEXT,
    p_purpose TEXT,
    p_action TEXT,
    p_auth_secret TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_token_hash TEXT;
    v_auth_record RECORD;
    v_outcome TEXT;
    v_error_msg TEXT := NULL;
    v_caller_role TEXT := COALESCE(current_setting('role', true), 'unknown');
BEGIN
    -- 1. Caller Authority Verification: Must be Superadmin or Trusted System Role
    IF NOT (public.fn_is_trusted_system_caller() OR public.is_platform_superadmin()) THEN
        INSERT INTO public.platform_authorization_audit_log (
            caller_role, caller_user_id, attempted_action, target_table, target_record_id, outcome, error_message
        ) VALUES (
            'unauthorized', auth.uid(), p_action, p_target_table, p_target_record_id, 'DENIED_UNTRUSTED_CALLER', 'Caller lacks superadmin or trusted system role.'
        );
        RETURN FALSE;
    END IF;

    -- 2. Reject missing secret
    IF p_auth_secret IS NULL OR trim(p_auth_secret) = '' THEN
        INSERT INTO public.platform_authorization_audit_log (
            caller_role, caller_user_id, attempted_action, target_table, target_record_id, outcome, error_message
        ) VALUES (
            v_caller_role, auth.uid(), p_action, p_target_table, p_target_record_id, 'DENIED_INVALID_SECRET', 'Missing secret parameter.'
        );
        RETURN FALSE;
    END IF;

    -- Compute SHA-256 hash of presented secret
    v_token_hash := encode(digest(p_auth_secret, 'sha256'), 'hex');

    -- 3. Lock authorization record matching ALL parameters
    SELECT * INTO v_auth_record
    FROM public.platform_authorizations
    WHERE target_entity_id = p_target_id
      AND target_entity_type = p_target_entity_type
      AND target_handle = p_target_handle
      AND purpose = p_purpose
      AND action IN (p_action, 'ALL_ACTIONS')
      AND authorization_token_hash = v_token_hash
    FOR UPDATE;

    IF v_auth_record.id IS NULL THEN
        v_outcome := 'DENIED_INVALID_SECRET';
        v_error_msg := 'Secret hash unrecognized or scope mismatch for target.';
    ELSIF v_auth_record.revoked_at IS NOT NULL THEN
        v_outcome := 'DENIED_REVOKED';
        v_error_msg := format('Authorization revoked at %s: %s', v_auth_record.revoked_at, v_auth_record.revocation_reason);
    ELSIF NOW() >= v_auth_record.expires_at THEN
        v_outcome := 'DENIED_EXPIRED';
        v_error_msg := format('Authorization expired at %s', v_auth_record.expires_at);
    ELSIF v_auth_record.is_single_use AND v_auth_record.consumed_at IS NOT NULL THEN
        v_outcome := 'DENIED_ALREADY_CONSUMED';
        v_error_msg := format('Authorization was already consumed at %s by %s', v_auth_record.consumed_at, v_auth_record.consumed_by_user_id);
    ELSE
        v_outcome := 'GRANTED';
        IF v_auth_record.is_single_use THEN
            UPDATE public.platform_authorizations
            SET consumed_at = NOW(),
                consumed_by_user_id = auth.uid()
            WHERE id = v_auth_record.id;
        END IF;
    END IF;

    -- Audit execution (never logging raw secret)
    INSERT INTO public.platform_authorization_audit_log (
        authorization_id, caller_role, caller_user_id, attempted_action, target_table, target_record_id, outcome, error_message
    ) VALUES (
        v_auth_record.id, v_caller_role, auth.uid(), p_action, p_target_table, p_target_record_id, v_outcome, v_error_msg
    );

    RETURN (v_outcome = 'GRANTED');
END;
$$;

ALTER FUNCTION public.fn_verify_and_consume_platform_authorization(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_verify_and_consume_platform_authorization FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_verify_and_consume_platform_authorization TO authenticated, service_role, app_worker;

-- ------------------------------------------------------------------------------
-- 4. Almeswak Comprehensive Quarantine Trigger Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Protect Table: organizations
    IF TG_TABLE_NAME = 'organizations' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
               OR OLD.id = 'a0000000-0000-0000-0000-000000000002'::uuid THEN
                RAISE EXCEPTION 'Quarantine Violation: Deleting Almeswak clinic organization is strictly prohibited through direct DML.';
            END IF;
            RETURN OLD;
        END IF;

        -- Intercept rename evasion
        IF TG_OP = 'UPDATE' THEN
            IF OLD.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
               AND NEW.slug NOT IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') THEN
                RAISE EXCEPTION 'Quarantine Violation: Renaming Almeswak organization to evade quarantine is prohibited.';
            END IF;
            IF OLD.slug NOT IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
               AND NEW.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') THEN
                RAISE EXCEPTION 'Quarantine Violation: Renaming another organization to claim Almeswak identity is prohibited.';
            END IF;
        END IF;

        -- Block direct status change away from demo_mode
        IF (NEW.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
            OR NEW.id = 'a0000000-0000-0000-0000-000000000002'::uuid) THEN
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                RAISE EXCEPTION 'Quarantine Violation: Almeswak Clinic is quarantined in Demo mode. Activation requires api_activate_quarantined_clinic().';
            END IF;
        END IF;
    END IF;

    -- 2. Protect Table: instagram_accounts
    IF TG_TABLE_NAME = 'instagram_accounts' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.id = 'almeswaksmile_iq' OR OLD.handle = 'almeswaksmile.iq' THEN
                RAISE EXCEPTION 'Quarantine Violation: Deleting baseline Almeswak account is strictly prohibited.';
            END IF;
            RETURN OLD;
        END IF;

        IF (NEW.id = 'almeswaksmile_iq' OR NEW.handle ILIKE '%almeswaksmile%' OR
            (TG_OP = 'UPDATE' AND (OLD.id = 'almeswaksmile_iq' OR OLD.handle ILIKE '%almeswaksmile%'))) THEN
            
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                RAISE EXCEPTION 'Quarantine Violation: Live activation of account @almeswaksmile.iq is blocked by Platform Quarantine.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine TO authenticated, service_role, app_worker;

-- Apply Quarantine Triggers
DROP TRIGGER IF EXISTS trg_quarantine_almeswak_org ON public.organizations;
CREATE TRIGGER trg_quarantine_almeswak_org
BEFORE INSERT OR UPDATE OR DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_acc ON public.instagram_accounts;
CREATE TRIGGER trg_quarantine_almeswak_acc
BEFORE INSERT OR UPDATE OR DELETE ON public.instagram_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();

-- ------------------------------------------------------------------------------
-- 5. Cryptographically Authorized Clinic Activation Gate Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_activate_quarantined_clinic(
    p_organization_id UUID,
    p_auth_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_slug TEXT;
    v_is_authorized BOOLEAN;
BEGIN
    -- Resolve organization directly from database
    SELECT slug INTO v_slug FROM public.organizations WHERE id = p_organization_id;
    IF v_slug IS NULL THEN
        RAISE EXCEPTION 'Organization % not found.', p_organization_id;
    END IF;

    -- Verify and consume authorization secret against Platform Authorizations Vault
    v_is_authorized := public.fn_verify_and_consume_platform_authorization(
        p_organization_id, 
        'organization', 
        'organizations', 
        p_organization_id::text,
        'almeswaksmile.iq', 
        'ALMESWAK_LIVE_ACTIVATION_APPROVAL', 
        'ACTIVATE_ORGANIZATION', 
        p_auth_secret
    );

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Activation Denied: Valid Platform Board Authorization secret is required.';
    END IF;

    -- Temporarily disable quarantine triggers within this privileged SECURITY DEFINER transaction
    ALTER TABLE public.organizations DISABLE TRIGGER trg_quarantine_almeswak_org;
    ALTER TABLE public.instagram_accounts DISABLE TRIGGER trg_quarantine_almeswak_acc;

    -- Update organization status to active
    UPDATE public.organizations 
    SET status = 'active', updated_at = NOW() 
    WHERE id = p_organization_id;

    -- Update linked instagram account to connected
    UPDATE public.instagram_accounts 
    SET status = 'connected', updated_at = NOW() 
    WHERE organization_id = p_organization_id;

    -- Re-enable quarantine triggers
    ALTER TABLE public.organizations ENABLE TRIGGER trg_quarantine_almeswak_org;
    ALTER TABLE public.instagram_accounts ENABLE TRIGGER trg_quarantine_almeswak_acc;

    RETURN jsonb_build_object(
        'success', TRUE, 
        'organization_id', p_organization_id, 
        'status', 'active',
        'activated_at', NOW()
    );
END;
$$;

ALTER FUNCTION public.api_activate_quarantined_clinic(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.api_activate_quarantined_clinic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_activate_quarantined_clinic TO authenticated, service_role, app_worker;


-- =============================================================================
-- END MIGRATION: 20261031040000_almeswak_quarantine_gate.sql
-- =============================================================================

-- =============================================================================
-- BEGIN MIGRATION: 20261031050000_multitenant_subscriptions_and_metering.sql
-- =============================================================================

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


-- =============================================================================
-- END MIGRATION: 20261031050000_multitenant_subscriptions_and_metering.sql
-- =============================================================================

-- =============================================================================
-- BEGIN MIGRATION: 20261031060000_multitenant_branch_reassignment.sql
-- =============================================================================

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


-- =============================================================================
-- END MIGRATION: 20261031060000_multitenant_branch_reassignment.sql
-- =============================================================================

-- =============================================================================
-- BEGIN MIGRATION: 20261031070000_multitenant_integration_vault.sql
-- =============================================================================

-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Migration: 20261031070000_multitenant_integration_vault.sql
-- Description: Phase 6 — Organization Integrations & AEAD Credentials Vault
--
-- Security Invariants:
-- 1. integration_credentials table stores AEAD-encrypted access tokens and is
--    EXCLUSIVELY system-managed. Authenticated users are DENIED (USING (false)).
-- 2. organization_integrations is partitioned by organization_id and protected by RLS.
-- 3. Almeswak integration (@almeswaksmile.iq, id 17841400000000001) is strictly
--    quarantined in demo_mode and guarded by trg_quarantine_almeswak_int.
-- 4. Composite foreign keys enforce tenant isolation across branches and credentials.
-- ==============================================================================

SET statement_timeout = '60s';

-- ------------------------------------------------------------------------------
-- 1. Organization Integrations Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    branch_id UUID,
    provider TEXT NOT NULL DEFAULT 'instagram_graph_api' CHECK (provider IN ('instagram_graph_api', 'whatsapp_business')),
    platform_account_id TEXT NOT NULL,
    platform_account_handle TEXT,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'demo_mode', 'disconnected', 'expired')),
    last_verified_at TIMESTAMPTZ,
    last_error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_integrations_org_id UNIQUE (organization_id, id),
    CONSTRAINT fk_integrations_branch_composite 
        FOREIGN KEY (organization_id, branch_id) 
        REFERENCES public.branches(organization_id, id) 
        ON UPDATE RESTRICT,
    CONSTRAINT uq_integrations_provider_account UNIQUE (organization_id, provider, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON public.organization_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_branch ON public.organization_integrations(organization_id, branch_id);

-- ------------------------------------------------------------------------------
-- 2. Isolated Server-Side Credential Vault (AEAD Encrypted, System-Only)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    integration_id UUID NOT NULL UNIQUE,
    encrypted_access_token TEXT NOT NULL,
    token_iv TEXT NOT NULL,
    token_auth_tag TEXT NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_credentials_org_id UNIQUE (organization_id, id),
    CONSTRAINT fk_vault_integration_composite 
        FOREIGN KEY (organization_id, integration_id) 
        REFERENCES public.organization_integrations(organization_id, id) 
        ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_credentials_org ON public.integration_credentials(organization_id);

-- ------------------------------------------------------------------------------
-- 3. Quarantine Trigger on Integrations
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Protect Table: organizations
    IF TG_TABLE_NAME = 'organizations' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
               OR OLD.id = 'a0000000-0000-0000-0000-000000000002'::uuid THEN
                RAISE EXCEPTION 'Quarantine Violation: Deleting Almeswak clinic organization is strictly prohibited through direct DML.';
            END IF;
            RETURN OLD;
        END IF;

        -- Intercept rename evasion
        IF TG_OP = 'UPDATE' THEN
            IF OLD.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
               AND NEW.slug NOT IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') THEN
                RAISE EXCEPTION 'Quarantine Violation: Renaming Almeswak organization to evade quarantine is prohibited.';
            END IF;
            IF OLD.slug NOT IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
               AND NEW.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') THEN
                RAISE EXCEPTION 'Quarantine Violation: Renaming another organization to claim Almeswak identity is prohibited.';
            END IF;
        END IF;

        -- Block direct status change away from demo_mode
        IF (NEW.slug IN ('almeswak-demo', 'almeswaksmile-iq', 'almeswaksmile_iq') 
            OR NEW.id = 'a0000000-0000-0000-0000-000000000002'::uuid) THEN
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                RAISE EXCEPTION 'Quarantine Violation: Almeswak Clinic is quarantined in Demo mode. Activation requires api_activate_quarantined_clinic().';
            END IF;
        END IF;
    END IF;

    -- 2. Protect Table: organization_integrations
    IF TG_TABLE_NAME = 'organization_integrations' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001' THEN
                RAISE EXCEPTION 'Quarantine Violation: Deleting Almeswak integration is prohibited through direct DML.';
            END IF;
            RETURN OLD;
        END IF;

        IF TG_OP = 'UPDATE' AND (OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001') THEN
            IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
                RAISE EXCEPTION 'Quarantine Violation: Reassigning Almeswak integration to another organization is prohibited.';
            END IF;
        END IF;

        IF (NEW.platform_account_handle ILIKE '%almeswaksmile.iq%' OR NEW.platform_account_id = '17841400000000001' OR
            (TG_OP = 'UPDATE' AND (OLD.platform_account_handle ILIKE '%almeswaksmile.iq%' OR OLD.platform_account_id = '17841400000000001'))) THEN
            
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                RAISE EXCEPTION 'Quarantine Violation: Activating integration for @almeswaksmile.iq requires api_activate_quarantined_clinic().';
            END IF;
        END IF;
    END IF;

    -- 3. Protect Table: instagram_accounts
    IF TG_TABLE_NAME = 'instagram_accounts' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.id = 'almeswaksmile_iq' OR OLD.handle = 'almeswaksmile.iq' THEN
                RAISE EXCEPTION 'Quarantine Violation: Deleting baseline Almeswak account is strictly prohibited.';
            END IF;
            RETURN OLD;
        END IF;

        IF (NEW.id = 'almeswaksmile_iq' OR NEW.handle ILIKE '%almeswaksmile%' OR
            (TG_OP = 'UPDATE' AND (OLD.id = 'almeswaksmile_iq' OR OLD.handle ILIKE '%almeswaksmile%'))) THEN
            
            IF NEW.status IS NULL OR NEW.status != 'demo_mode' THEN
                RAISE EXCEPTION 'Quarantine Violation: Live activation of account @almeswaksmile.iq is blocked by Platform Quarantine.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine TO authenticated, service_role, app_worker;

DROP TRIGGER IF EXISTS trg_quarantine_almeswak_int ON public.organization_integrations;
CREATE TRIGGER trg_quarantine_almeswak_int
BEFORE INSERT OR UPDATE OR DELETE ON public.organization_integrations
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_almeswak_comprehensive_quarantine();

-- Safe Branch Deletion Trigger for Integrations
CREATE OR REPLACE FUNCTION public.fn_safe_orphan_integrations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.organization_integrations 
    SET branch_id = NULL 
    WHERE organization_id = OLD.organization_id AND branch_id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_safe_orphan_integrations ON public.branches;
CREATE TRIGGER trg_safe_orphan_integrations
BEFORE DELETE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.fn_safe_orphan_integrations();

-- ------------------------------------------------------------------------------
-- 4. Permissions & Row Level Security (RLS)
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_integrations TO authenticated, service_role, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO service_role, app_worker;
GRANT SELECT ON public.integration_credentials TO authenticated; -- Evaluated by RLS policy below

-- Enable RLS
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials FORCE ROW LEVEL SECURITY;

-- 4.1 organization_integrations RLS
DROP POLICY IF EXISTS "v27_int_select" ON public.organization_integrations;
CREATE POLICY "v27_int_select" ON public.organization_integrations 
FOR SELECT TO authenticated 
USING (organization_id IN (SELECT org_id FROM public.get_auth_org_ids()) OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_int_modify" ON public.organization_integrations;
CREATE POLICY "v27_int_modify" ON public.organization_integrations 
FOR UPDATE TO authenticated 
USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin()) 
WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_int_insert" ON public.organization_integrations;
CREATE POLICY "v27_int_insert" ON public.organization_integrations 
FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_int_delete" ON public.organization_integrations;
CREATE POLICY "v27_int_delete" ON public.organization_integrations 
FOR DELETE TO authenticated 
USING (public.get_auth_org_role(organization_id) IN ('owner', 'admin') OR public.is_platform_superadmin());

DROP POLICY IF EXISTS "v27_int_service" ON public.organization_integrations;
CREATE POLICY "v27_int_service" ON public.organization_integrations 
FOR ALL TO service_role, app_worker 
USING (true) WITH CHECK (true);

-- 4.2 integration_credentials RLS (STRICTLY SYSTEM-ONLY)
DROP POLICY IF EXISTS "v27_vault_deny_auth" ON public.integration_credentials;
CREATE POLICY "v27_vault_deny_auth" ON public.integration_credentials 
FOR ALL TO authenticated 
USING (false);

DROP POLICY IF EXISTS "v27_vault_service" ON public.integration_credentials;
CREATE POLICY "v27_vault_service" ON public.integration_credentials 
FOR ALL TO service_role, app_worker 
USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. Seed Founding Tenant & Demo Clinic Integrations
-- ------------------------------------------------------------------------------
INSERT INTO public.organization_integrations (
    id, organization_id, branch_id, provider, platform_account_id, platform_account_handle, status
) VALUES 
    (
        'e0000000-0000-0000-0000-000000000001'::uuid,
        'a0000000-0000-0000-0000-000000000001'::uuid,
        'b0000000-0000-0000-0000-000000000001'::uuid,
        'instagram_graph_api',
        '17841400000000000',
        'drmustafa_hadi',
        'connected'
    ),
    (
        'e0000000-0000-0000-0000-000000000002'::uuid,
        'a0000000-0000-0000-0000-000000000002'::uuid,
        NULL,
        'instagram_graph_api',
        '17841400000000001',
        'almeswaksmile.iq',
        'demo_mode'
    )
ON CONFLICT (organization_id, provider, platform_account_id) DO NOTHING;


-- =============================================================================
-- END MIGRATION: 20261031070000_multitenant_integration_vault.sql
-- =============================================================================

-- =============================================================================
-- BEGIN MIGRATION: 20261031080000_multitenant_reconciliation_engine.sql
-- =============================================================================

-- ==============================================================================
-- MUSTAFAH-AI — BAGHDAD EDITION
-- Migration: 20261031080000_multitenant_reconciliation_engine.sql
-- Description: Phase 7 — Dynamic Reconciliation & Pre-Migration Anomaly View
--
-- Security Invariants:
-- 1. Evaluates all 12 operational tables for relational consistency.
-- 2. Zero hardcoded values or fake counts; 100% dynamic evaluations using anti-joins.
-- 3. Fail-closed assertion function halts execution if any anomalies exist.
-- ==============================================================================

SET statement_timeout = '60s';

-- ------------------------------------------------------------------------------
-- 1. Single-Source Dynamic Relational Anomaly View
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_tenant_migration_anomaly_report AS
-- 1. instagram_accounts
SELECT 'instagram_accounts'::text AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (WHERE a.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = a.organization_id)) AS mapped_rows,
       COUNT(*) FILTER (WHERE a.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = a.organization_id)) AS unmapped_rows,
       COUNT(*) FILTER (WHERE a.id IS NULL) AS missing_parents,
       COUNT(*) FILTER (WHERE a.organization_id IS NULL) AS cross_tenant_violations,
       COUNT(*) FILTER (WHERE a.handle IS NULL) AS invalid_references
FROM public.instagram_accounts a

UNION ALL
-- 2. leads
SELECT 'leads'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE l.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = l.organization_id)),
       COUNT(*) FILTER (WHERE l.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = l.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = l.account_id AND a.organization_id = l.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = l.account_id AND a.organization_id != l.organization_id)),
       COUNT(*) FILTER (WHERE l.account_id IS NULL)
FROM public.leads l

UNION ALL
-- 3. appointments
SELECT 'appointments'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE appt.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = appt.organization_id)),
       COUNT(*) FILTER (WHERE appt.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = appt.organization_id)),
       COUNT(*) FILTER (WHERE appt.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appt.lead_id)),
       COUNT(*) FILTER (WHERE appt.lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appt.lead_id AND l.organization_id != appt.organization_id)),
       COUNT(*) FILTER (WHERE appt.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = appt.branch_id AND b.organization_id = appt.organization_id))
FROM public.appointments appt

UNION ALL
-- 4. conversations
SELECT 'conversations'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE c.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = c.organization_id)),
       COUNT(*) FILTER (WHERE c.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = c.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = c.account_id AND a.organization_id = c.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = c.account_id AND a.organization_id != c.organization_id)),
       COUNT(*) FILTER (WHERE c.account_id IS NULL)
FROM public.conversations c

UNION ALL
-- 5. chat_messages
SELECT 'chat_messages'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE m.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = m.organization_id)),
       COUNT(*) FILTER (WHERE m.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = m.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = m.conversation_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = m.conversation_id AND c.organization_id != m.organization_id)),
       COUNT(*) FILTER (WHERE m.conversation_id IS NULL)
FROM public.chat_messages m

UNION ALL
-- 6. content_items
SELECT 'content_items'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE ci.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ci.organization_id)),
       COUNT(*) FILTER (WHERE ci.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ci.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ci.account_id AND a.organization_id = ci.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ci.account_id AND a.organization_id != ci.organization_id)),
       COUNT(*) FILTER (WHERE ci.account_id IS NULL)
FROM public.content_items ci

UNION ALL
-- 7. ad_campaigns
SELECT 'ad_campaigns'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE ac.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ac.organization_id)),
       COUNT(*) FILTER (WHERE ac.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ac.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ac.account_id AND a.organization_id = ac.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = ac.account_id AND a.organization_id != ac.organization_id)),
       COUNT(*) FILTER (WHERE ac.account_id IS NULL)
FROM public.ad_campaigns ac

UNION ALL
-- 8. processed_webhook_messages
SELECT 'processed_webhook_messages'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE pwm.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = pwm.organization_id)),
       COUNT(*) FILTER (WHERE pwm.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = pwm.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = pwm.account_id AND a.organization_id = pwm.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = pwm.account_id AND a.organization_id != pwm.organization_id)),
       COUNT(*) FILTER (WHERE pwm.account_id IS NULL)
FROM public.processed_webhook_messages pwm

UNION ALL
-- 9. human_takeovers
SELECT 'human_takeovers'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE ht.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ht.organization_id)),
       COUNT(*) FILTER (WHERE ht.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ht.organization_id)),
       COUNT(*) FILTER (WHERE ht.conversation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ht.conversation_id)),
       COUNT(*) FILTER (WHERE ht.conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ht.conversation_id AND c.organization_id != ht.organization_id)),
       COUNT(*) FILTER (WHERE ht.account_id IS NULL)
FROM public.human_takeovers ht

UNION ALL
-- 10. escalation_events
SELECT 'escalation_events'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE ee.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ee.organization_id)),
       COUNT(*) FILTER (WHERE ee.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ee.organization_id)),
       COUNT(*) FILTER (WHERE ee.conversation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ee.conversation_id)),
       COUNT(*) FILTER (WHERE ee.conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = ee.conversation_id AND c.organization_id != ee.organization_id)),
       COUNT(*) FILTER (WHERE ee.account_id IS NULL)
FROM public.escalation_events ee

UNION ALL
-- 11. webhook_jobs
SELECT 'webhook_jobs'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE wj.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wj.organization_id)),
       COUNT(*) FILTER (WHERE wj.organization_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wj.organization_id)),
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = wj.account_id AND a.organization_id = wj.organization_id)),
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.instagram_accounts a WHERE a.id = wj.account_id AND a.organization_id != wj.organization_id)),
       COUNT(*) FILTER (WHERE wj.account_id IS NULL)
FROM public.webhook_jobs wj

UNION ALL
-- 12. webhook_logs
SELECT 'webhook_logs'::text,
       COUNT(*),
       COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id)),
       COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id)),
       COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id)),
       COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id)),
       COUNT(*) FILTER (WHERE wl.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = wl.organization_id))
FROM public.webhook_logs wl;

-- Restrict view access to admin and service roles
GRANT SELECT ON public.vw_tenant_migration_anomaly_report TO service_role, app_worker;

-- ------------------------------------------------------------------------------
-- 2. Fail-Closed Dynamic Anomaly Assertion Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_assert_zero_migration_anomalies()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_error_report TEXT := '';
    r RECORD;
BEGIN
    FOR r IN (
        SELECT table_name, unmapped_rows, missing_parents, cross_tenant_violations, invalid_references
        FROM public.vw_tenant_migration_anomaly_report
        WHERE unmapped_rows > 0 
           OR missing_parents > 0 
           OR cross_tenant_violations > 0 
           OR invalid_references > 0
    ) LOOP
        v_error_report := v_error_report || format(
            ' [Table %s -> unmapped:%s, missing_parent:%s, cross_tenant:%s, invalid_refs:%s]',
            r.table_name, r.unmapped_rows, r.missing_parents, r.cross_tenant_violations, r.invalid_references
        );
    END LOOP;

    IF length(v_error_report) > 0 THEN
        RAISE EXCEPTION 'FATAL MIGRATION ABORTION: Relational anomalies detected:% Cannot proceed with NOT NULL enforcement or composite key construction.', v_error_report;
    END IF;

    RAISE NOTICE 'SUCCESS: All 12 tables passed 100 percent dynamic reconciliation verification without anomalies.';
END;
$$;

ALTER FUNCTION public.fn_assert_zero_migration_anomalies() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_assert_zero_migration_anomalies FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_assert_zero_migration_anomalies TO service_role, app_worker;

-- Run validation assertion immediately
SELECT public.fn_assert_zero_migration_anomalies();


-- =============================================================================
-- END MIGRATION: 20261031080000_multitenant_reconciliation_engine.sql
-- =============================================================================

-- =============================================================================
-- FINAL PRODUCTION ASSERTION: ZERO MIGRATION ANOMALIES
-- =============================================================================
SELECT public.fn_assert_zero_migration_anomalies();
