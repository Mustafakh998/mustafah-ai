# MUSTAFAH-AI — META APP REVIEW SUBMISSION PACKAGE
**Document Purpose:** Ready-to-use copy-paste submission text, reviewer credentials, test instructions, and screencast storyboard for Meta App Review approval.  
**Target Scopes:** `instagram_manage_messages` & `pages_manage_metadata`  
**Target App:** MustafaH-AI Assistant (App ID: Production Meta App)  
**Target Practice:** Dr. Mustafa Hadi Dental Clinic (`@drmustafa_hadi` — Baghdad, Iraq)  
**Security & Clinical Constraint:** 100% Prohibition on Automated Orthodontic Pricing Quotes; Human Takeover Protocol Enforced; 24-Hour Messaging Policy Enforced.

---

## 1. Quick URLs for Meta App Dashboard Settings

| Dashboard Field | Production URL | Status |
|---|---|---|
| **Privacy Policy URL** | `https://mustafah-ai.almeswak.iq/privacy` | Live & Verified |
| **Terms of Service URL** | `https://mustafah-ai.almeswak.iq/terms` | Live & Verified |
| **User Data Deletion Callback / URL** | `https://mustafah-ai.almeswak.iq/data-deletion` | Live & Verified |
| **Category** | Medical & Health / Business Communication | Configured |
| **App Icon** | 1024x1024 high-res dental tooth with AI sparkle | Ready |

---

## 2. Meta App Review Permission Justifications (Copy-Paste Text)

### 2.1 Permission: `instagram_manage_messages`

#### Question: How will your app use `instagram_manage_messages`?
```text
MustafaH-AI is an specialized clinical dental intake assistant developed specifically for Dr. Mustafa Hadi's verified orthodontic and dental surgery practice in Baghdad, Iraq (Instagram: @drmustafa_hadi).

Our application utilizes `instagram_manage_messages` for two essential clinical workflows:
1. Real-time Inbound Reception Intake: When prospective dental patients send Direct Messages (DMs) to @drmustafa_hadi, our system ingests webhook events to respond instantly in Iraqi Arabic dialect to routine queries regarding clinic location (Baghdad, Zayouna, Dream City Mall service street), opening hours (5:00 PM - 9:00 PM), and in-person consultation booking requests.
2. Clinical Safety Guardrails & Human Staff Handoff: The app enforces strict patient safety protocols. Per medical ethics and Iraqi Dental Syndicate standards, the assistant strictly refuses to provide automated orthodontic treatment pricing or installment promises before an in-person clinical exam and OPG radiographic diagnosis. When patients ask for pricing or human assistance, the app immediately halts automated AI replies, flags the conversation in our staff CRM, and escalates to Dr. Mustafa Hadi and our clinical receptionists.

Our application strictly adheres to the 24-hour Meta messaging window policy and will never send automated promotional messages outside this window.
```

#### Question: How does this permission provide a user-facing experience?
```text
Patients on Instagram seeking orthodontic consultations with Dr. Mustafa Hadi receive instantaneous, polite, and culturally appropriate responses in Iraqi Arabic. Instead of waiting hours for reception answers regarding clinic directions or consultation availability, they get verified clinic information immediately.

When complex clinical inquiries, dental emergencies, or orthodontic price inquiries occur, patients are guided safely to book an in-person clinical examination or speak directly with Dr. Mustafa via our direct reception telephone (+964 776 888 6667) or live human staff takeover inside Instagram Direct.
```

---

### 2.2 Permission: `pages_manage_metadata`

#### Question: How will your app use `pages_manage_metadata`?
```text
MustafaH-AI standardizes on Instagram Graph API via Facebook Login for Business to ensure reliable, long-lived Page Access Tokens that prevent token expiration disruptions for healthcare communication.

We use `pages_manage_metadata` exclusively to:
1. Subscribe the connected Facebook Page ("د. مصطفى هادي") to Meta webhook topics (`messages`, `messaging_postbacks`, `message_reactions`).
2. Maintain webhooks configuration and verify page-level bindings between the Facebook Page and its connected Instagram Professional Account (@drmustafa_hadi).

The app never modifies page profile settings, posts, or page settings beyond managing the necessary webhook subscription endpoints.
```

---

## 3. Step-by-Step Testing Instructions for Meta App Reviewers

Provide these exact instructions to the Meta reviewer in the review console:

```text
STEP-BY-STEP TESTING INSTRUCTIONS FOR REVIEWER:

1. Prerequisite:
   - Ensure you are logged into Instagram with your assigned Meta reviewer test account.

2. Initiating Contact:
   - Search for and open Instagram Direct Message to our test practice account: @drmustafa_hadi
   - Tap "Message".

3. Test Scenario A: Clinic Location & Working Hours (Iraqi Arabic Inquiry):
   - Send message: وين موقع العيادة وشوكت تفتحون؟ (Where is the clinic located and when do you open?)
   - Expected Result: You will immediately receive a friendly reply in Iraqi Arabic indicating the verified location:
     "بغداد – زيونة – خدمي دريم سيتي مول، مجاور مطعم صيف وشتاء، ط6 ش6"
     along with the reception telephone: 07768886667.

4. Test Scenario B: Strict Orthodontic Safety Policy (Zero Pricing Disclosure):
   - Send message: شكد سعر تقويم الأسنان؟ (How much is braces/orthodontics?)
   - Expected Result: The assistant will enforce our strict clinical guardrail: It will NOT provide any price or installment estimate. Instead, it explains that orthodontic pricing requires an in-person clinical exam and OPG X-ray by Dr. Mustafa Hadi, and offers to schedule a consultation.

5. Test Scenario C: Human Staff Takeover Escalation:
   - Send message: أريد أحجي ويا دكتور مصطفى مباشرة (I want to talk directly with Dr. Mustafa)
   - Expected Result: The assistant acknowledges the request, indicates that human staff have been notified, and immediately halts automated AI messaging so human staff can reply directly.
```

---

## 4. Screencast Video Storyboard (Step-by-Step Recording Guide)

**Video Target Duration:** 2 to 3 minutes  
**Format:** MP4 (1080p, 30fps) with English voiceover or clear English on-screen annotations.

### Scene 1: Meta Business Suite & Page Linkage (0:00 - 0:30)
- **Visual:** Show Meta Business Suite showing the Facebook Page ("د. مصطفى هادي") linked to Instagram Professional Account (`@drmustafa_hadi`).
- **Narration/Subtitle:** "MustafaH-AI is integrated with Dr. Mustafa Hadi's official Instagram practice via Facebook Page linking. We subscribe to webhook messages to provide real-time patient assistance."

### Scene 2: Inbound Inquiry & Location Response (0:30 - 1:00)
- **Visual:** Split screen. On the left: Instagram mobile app (test user sending DM). On the right: MustafaH-AI live dashboard (`/inbox`).
- **Action:** Test user types: `"وين مكان العيادة دكتور؟"`
- **Result:** Within 1 second, the assistant replies with the exact address in Zayouna, Dream City Mall street, Floor 6, and reception number `07768886667`.
- **Narration/Subtitle:** "Patients receive instant location and reception guidance in natural Iraqi Arabic dialect."

### Scene 3: Clinical Guardrail — Orthodontic Zero-Price Prohibition (1:00 - 1:40)
- **Visual:** Instagram DM conversation.
- **Action:** Test user types: `"شكد سعر التقويم العادي وبكم الأقساط؟"`
- **Result:** The system replies with the clinically approved policy template: zero prices are disclosed, explaining that treatment duration, bracket type, and cost depend strictly on clinical examination and panoramic X-ray by Dr. Mustafa Hadi.
- **Narration/Subtitle:** "In compliance with healthcare regulations, automated pricing and installment quotes are strictly blocked before an in-person clinical diagnosis."

### Scene 4: Human Staff Takeover & Live CRM (1:40 - 2:20)
- **Visual:** Test user types: `"أريد أحجي ويا الطبيب عندي ألم شديد"`.
- **Action:** 
  1. The AI acknowledges the urgent request and halts automated generation.
  2. Switch to the MustafaH-AI Reception Dashboard (`/inbox` / `/appointments`).
  3. Show the `HUMAN TAKEOVER` badge active in red/amber.
  4. Receptionist types a custom message in the dashboard: `"أهلاً بحضرتك، د. مصطفى متواجد وسنتصل بك خلال دقائق."`
  5. Show the receptionist's reply appearing in the patient's Instagram DM.
- **Narration/Subtitle:** "Human staff can seamlessly take over the conversation at any moment from our HIPAA/RLS-secured multi-tenant dashboard."

### Scene 5: Data Privacy & User Deletion Compliance (2:20 - 2:45)
- **Visual:** Show the live `/privacy` and `/data-deletion` pages.
- **Narration/Subtitle:** "All patient conversations are encrypted, partitioned using PostgreSQL Row Level Security, and patients can request complete data erasure at any time."

---

## 5. Pre-Submission Verification Checklist

- [x] **Primary Auth Configured:** Permanent Facebook Page Access Token via Facebook Login for Business.
- [x] **Webhook URL Active:** `https://mustafah-ai.almeswak.iq/api/webhooks/instagram` with HMAC-SHA256 signature verification.
- [x] **24-Hour Messaging Policy Enforced:** Automated replies blocked if incoming timestamp is older than 24 hours.
- [x] **Zero Orthodontic Price Disclosure:** Verified across 8 distinct Iraqi dialect inquiry variations.
- [x] **Account Isolation:** Clinic account (`@almeswaksmile.iq`) quarantined in Demo Mode; live processing limited strictly to Dr. Mustafa Hadi pilot account (`@drmustafa_hadi`).
- [x] **Legal Compliance:** Public Privacy Policy, Terms of Service, and Data Deletion pages live and accessible.
- [x] **Automated Test Coverage:** 213/213 automated tests passing in continuous integration.
