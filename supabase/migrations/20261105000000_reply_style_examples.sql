-- Curated examples of how the clinic team replies to patients.
-- The AI reads these (plus recent real staff replies) to copy the team's tone.
CREATE TABLE IF NOT EXISTS reply_style_examples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id TEXT NOT NULL DEFAULT 'drmustafa_hadi',
    customer_message TEXT NOT NULL CHECK (char_length(customer_message) BETWEEN 1 AND 1000),
    staff_reply TEXT NOT NULL CHECK (char_length(staff_reply) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reply_style_account ON reply_style_examples(account_id, created_at DESC);

-- Only the server (service role) reads/writes this table.
ALTER TABLE reply_style_examples ENABLE ROW LEVEL SECURITY;
