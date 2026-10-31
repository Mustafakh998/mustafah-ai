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

