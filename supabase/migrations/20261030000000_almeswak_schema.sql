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
