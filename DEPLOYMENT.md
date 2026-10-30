# MUSTAFAH-AI — BAGHDAD EDITION
## Production Deployment & Operational Runbook

---

## 1. Quick Local Development Setup

To run MustafaH-AI locally on your development workstation:

```bash
# 1. Clone or navigate to the repository
cd c:\Users\gigia\OneDrive\Desktop\ai

# 2. Install dependencies
npm install

# 3. Run automated test suite
npx tsx scripts/test_engine.ts

# 4. Start Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 2. Production Deployment to Vercel (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "feat: complete MustafaH-AI Baghdad edition system"
   git push origin main
   ```

2. **Deploy on Vercel:**
   * Import the GitHub repository into your Vercel Dashboard.
   * Framework preset will automatically detect **Next.js**.
   * Add the environment variables from `.env.example`:
     - `META_VERIFY_TOKEN`: Your secure random verification token
     - `META_APP_SECRET`: Your Meta App Secret
     - `NEXT_PUBLIC_CLINIC_PHONE`: `07768886667`
     - `NEXT_PUBLIC_APP_URL`: `https://your-custom-domain.com`

3. **Verify Webhook SSL Handshake:**
   In your Meta Developer Console, set your Webhook URL to:
   ```
   https://your-custom-domain.com/api/webhooks/instagram
   ```
   Verify Token:
   ```
   almeswak_ai_baghdad_secure_verify_2026
   ```

---

## 3. PostgreSQL Database Migrations (Supabase)

1. Open your Supabase project SQL Editor or standard `psql` console.
2. Copy and execute the contents of:
   ```
   supabase/migrations/20261030000000_almeswak_schema.sql
   ```
3. All tables (`instagram_accounts`, `leads`, `appointments`, `conversations`, `chat_messages`, `content_items`, `ad_campaigns`, `webhook_logs`) and indexes will be created automatically.

---

## 4. Daily Operational Protocol for Baghdad Clinic Reception Desk

1. **Morning Protocol (2:00 PM Baghdad Time):**
   * Open the **Appointments** tab on the dashboard.
   * Review all appointments for the day marked `Confirmed`.
   * For any `New Request` received overnight from DMs, click the WhatsApp button to verify time slot availability with the patient.
2. **Real-time DM Triage:**
   * Incoming messages will be answered automatically by the **Iraqi Arabic AI Assistant** in Baghdad dialect.
   * If a patient requests a human receptionist or asks for online diagnosis, the system automatically activates `Human Takeover` and alerts the reception desk.
   * Staff can click `Takeover` to reply manually or click `Suggested Reply` to send AI-generated answers with one click.
3. **Closing Protocol (9:00 PM Baghdad Time):**
   * Update appointment statuses in the **Leads CRM** to `Attended` or `No-show`.
   * Review content scheduled for the next day in the **Content Calendar** and approve for publishing.

