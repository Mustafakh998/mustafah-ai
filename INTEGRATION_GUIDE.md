# ALMESWAK AI — BAGHDAD EDITION
## Meta Instagram Graph API Integration & Deployment Guide

---

## 1. Architecture Overview

ALMESWAK AI operates on a modern hybrid architecture designed specifically for the Iraqi healthcare market:
* **Layer A (Fast-Path Automation):** Rapid instant response (<1s) for standard zero-ambiguity queries (clinic location in Zayouna, opening hours, official booking phone `07768886667`, WhatsApp direct links).
* **Layer B (Custom Iraqi Arabic AI Engine):** Context-aware conversational AI fluent in Baghdad dialect, equipped with intent classification, dental service knowledge, medical liability guardrails, and automated lead capture.
* **Receptionist Handoff Hub:** Seamless escalation to reception desk via dashboard and WhatsApp when a patient requests an in-person appointment or asks for human staff.

```
                          ┌────────────────────────┐
                          │ Incoming Instagram DM  │
                          └───────────┬────────────┘
                                      │
                                      ▼
                        ┌──────────────────────────┐
                        │ Meta Webhook Event (POST)│
                        └─────────────┬────────────┘
                                      │
                                      ▼
                  ┌───────────────────────────────────────┐
                  │ ALMESWAK AI: Iraqi Dialect Classifier │
                  └───────────────┬───────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         │                                                 │
         ▼                                                 ▼
┌──────────────────┐                             ┌───────────────────┐
│ Routine Inquiry  │                             │ Treatment / Booking│
│ (Hours, Location)│                             │ or Online Rx / Sx │
└────────┬─────────┘                             └─────────┬─────────┘
         │                                                 │
         ▼                                                 ▼
┌──────────────────┐                             ┌───────────────────┐
│ Instant Canned   │                             │ Clinical Guardrail│
│ Baghdad Response │                             │ + Lead Capture    │
│                  │                             │ + Reception Alert │
└──────────────────┘                             └───────────────────┘
```

---

## 2. Meta Instagram API Authorization Steps

### Step 1: Professional Account Verification
1. Open Instagram on your mobile device.
2. Go to **Settings & Privacy** -> **Account type and tools** -> **Switch to Professional Account**.
3. Select **Health/Beauty** or **Dentist & Dental Clinic**.
4. Connect the Instagram account to a designated Facebook Page (required for Graph API messaging webhooks).

### Step 2: Meta App Setup (Meta for Developers)
1. Go to [developers.facebook.com](https://developers.facebook.com/) and log in with your Facebook account.
2. Click **My Apps** -> **Create App**.
3. Choose **Other** as the use case, then select **Business** as the app type.
4. Name the application: `Almeswak AI Baghdad`.
5. Under **Add Products to Your App**, locate **Instagram** and click **Set Up**.

### Step 3: Webhook Configuration
1. In the left navigation of the Meta App Dashboard, click **Webhooks** under Instagram.
2. Provide your production callback URL and verify token:
   * **Callback URL:** `https://your-domain.com/api/webhooks/instagram`
   * **Verify Token:** `almeswak_ai_baghdad_secure_verify_2026` (or the token configured in `.env.local`)
3. Click **Verify and Save**. Meta will send a `GET` handshake request to your endpoint; our system validates the token and immediately returns `hub.challenge`.
4. Subscribe to the following webhook fields:
   * `messages` (Essential: receives direct messages from patients)
   * `messaging_postbacks` (Receives button clicks and quick replies)
   * `message_reactions` (Optional: receives emoji reactions)
   * `comments` (Optional: required for Comment-to-DM flows)

### Step 4: Generating Long-Lived Access Tokens
1. Open the **Graph API Explorer** in the Meta Developer Console.
2. Select your App, choose **User Token**, and select permissions:
   * `instagram_basic`
   * `instagram_manage_messages`
   * `pages_manage_metadata`
   * `pages_show_list`
3. Generate the short-lived token, then exchange it for a 60-day long-lived token via:
   ```http
   GET https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={short-lived-token}
   ```
4. Save the token into `.env.local` as `DR_MUSTAFA_ACCESS_TOKEN`.

---

## 3. Account Access Segregation Policy

### Personal Brand Account (`@drmustafa_hadi`)
* **Access Mode:** Active Development & Live Testing Account.
* **Ownership:** User has direct credentials and authorization.
* **Scope:** Orthodontic educational content, personal brand Q&A, and clinical inquiries.

### Clinic Account (`@almeswaksmile.iq`)
* **Access Mode:** Demo Sandbox & Configuration Mode.
* **Ownership:** Managed by clinic owners/administration.
* **Protocol:** The application runs in full interactive simulation mode until the clinic administrator performs the one-click Meta OAuth authorization.
* **Security Rule:** Never request the clinic's Instagram password or attempt unauthorized third-party automation.

---

## 4. ManyChat Hybrid Integration Option (Zero-Code Layer A)

If the clinic chooses to utilize an existing ManyChat Pro account alongside this AI engine:
1. In ManyChat, set up default keyword triggers (e.g. "عنوانكم", "رقمكم", "دوام").
2. For open-ended inquiries, configure an **External Request** action in ManyChat:
   * **URL:** `https://your-domain.com/api/ai/chat`
   * **Method:** `POST`
   * **Body:**
     ```json
     {
       "message": "{{last_input_text}}",
       "accountId": "almeswaksmile_iq",
       "patientName": "{{first_name}}"
     }
     ```
3. Map the returned `replyText` into the ManyChat message response.

---

## 5. Medical Liability & Safety Protocols

The AI assistant is strictly instructed on the following non-negotiable medical rules:
1. **No Online Diagnosis:** The AI will never inspect photos or descriptions to provide a conclusive medical diagnosis. It explicitly informs the patient that a physical examination with panoramic X-rays is mandatory.
2. **No Prescription or Medication Dosage:** It will never prescribe antibiotics, anti-inflammatories, or analgesics.
3. **No Clinical Guarantees:** It will never guarantee specific treatment durations or outcomes over text without in-person clinical assessment.
4. **Immediate Human Escalation:** Any inquiry involving acute dental trauma, severe facial swelling, or explicit requests for human staff immediately triggers receptionist notification.
