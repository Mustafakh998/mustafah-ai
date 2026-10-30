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
