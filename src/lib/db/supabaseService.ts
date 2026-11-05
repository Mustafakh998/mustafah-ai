import { AccountId, Conversation, ChatMessage, Lead, Appointment, TreatmentType } from '@/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mvokslekhpawkvjwzbos.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const DEFAULT_DRMUSTAFA_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const ALMESWAK_ORG_ID = 'a0000000-0000-0000-0000-000000000002';

// Raw row shapes returned by the Supabase REST API (snake_case columns).
interface ChatMessageRow {
  id: string;
  conversation_id: string;
  sender: string;
  text: string;
  timestamp: string;
  intent?: string | null;
  confidence?: number | string | null;
  suggested_reply?: string | null;
}

interface ConversationRow {
  id: string;
  account_id: string;
  instagram_username: string;
  patient_name: string;
  status: Conversation['status'];
  treatment_interest?: TreatmentType | null;
  unread?: boolean | null;
  last_message?: string | null;
  last_message_time?: string | null;
  created_at: string;
  patient_phone?: string | null;
  preferred_date?: string | null;
  chat_messages?: ChatMessageRow[] | null;
}

interface LeadRow {
  id: string;
  account_id: string;
  instagram_username: string;
  patient_name: string;
  phone?: string | null;
  treatment: string;
  treatment_name_ar: string;
  status: Lead['status'];
  inquiry_date: string;
  campaign_source?: string | null;
  estimated_value_iqd?: number | string | null;
  staff_notes?: string | null;
  confidence_score?: number | string | null;
  last_message_text?: string | null;
  is_handed_over_to_human?: boolean | null;
}

interface AppointmentRow {
  id: string;
  lead_id?: string | null;
  patient_name: string;
  phone: string;
  account_id: string;
  treatment: string;
  treatment_name_ar: string;
  preferred_date: string;
  preferred_time: string;
  assigned_doctor: string;
  assigned_doctor_ar: string;
  status: Appointment['status'];
  reception_notes?: string | null;
  created_at: string;
  confirmed_at?: string | null;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };
}

export function mapIntentToTreatment(intent?: string): TreatmentType {
  switch (intent) {
    case 'orthodontic_inquiry':
      return 'orthodontics';
    case 'general_dental_education':
    case 'urgent_clinical_question':
    case 'consultation_request':
      return 'consultation';
    case 'personal_professional_inquiry':
      return 'general_restorative';
    default:
      return 'orthodontics';
  }
}

export function mapIntentToTreatmentAr(intent?: string): string {
  switch (intent) {
    case 'orthodontic_inquiry':
      return 'تقويم الأسنان (استشارة تشخيصية)';
    case 'urgent_clinical_question':
      return 'حالة أسنان طارئة / ألم حاد';
    case 'consultation_request':
      return 'كشفية واستشارة أسنان';
    default:
      return 'تقويم الأسنان وتجميل الابتسامة';
  }
}

export interface InboundMessageEvent {
  messageId: string;
  senderId: string;
  senderUsername?: string;
  recipientId: string;
  accountId: AccountId;
  messageText: string;
  timestamp: number | string;
  aiResponse: {
    replyText: string;
    intent?: string;
    confidence?: number;
    requiresHumanHandoff?: boolean;
    treatmentDetected?: TreatmentType;
    extractedPatientInfo?: {
      phone?: string;
      preferredDate?: string;
    };
  };
  outboundDispatched?: boolean;
  /** Text actually delivered to the patient. If set, it is saved as an assistant message. */
  sentText?: string;
}

/**
 * Persist incoming webhook event, conversation record, chat messages, and CRM lead in Supabase.
 */
export async function persistWebhookEventToSupabase(event: InboundMessageEvent): Promise<boolean> {
  if (!SERVICE_KEY || !SUPABASE_URL) {
    console.warn('[SupabaseService] Service key or URL missing, skipping Supabase persistence.');
    return false;
  }

  const {
    senderId,
    senderUsername,
    accountId,
    messageText,
    timestamp,
    aiResponse,
    sentText,
  } = event;

  const orgId = accountId === 'almeswaksmile_iq' ? ALMESWAK_ORG_ID : DEFAULT_DRMUSTAFA_ORG_ID;
  const convId = senderId.startsWith('conv_') ? senderId : `conv_${senderId}`;
  const username = senderUsername || `user_${senderId.slice(-6)}`;
  const patientName = `مريض إنستغرام (@${username})`;
  const eventIsoTime = new Date(typeof timestamp === 'number' ? timestamp : Date.now()).toISOString();
  const treatment = aiResponse.treatmentDetected || mapIntentToTreatment(aiResponse.intent);
  const treatmentAr = mapIntentToTreatmentAr(aiResponse.intent);

  try {
    // 1. Upsert Conversation
    const convPayload = {
      id: convId,
      account_id: accountId,
      organization_id: orgId,
      instagram_username: username,
      patient_name: patientName,
      status: aiResponse.requiresHumanHandoff ? 'human_takeover' : 'active_ai',
      treatment_interest: treatment,
      unread: true,
      last_message: messageText,
      last_message_time: eventIsoTime,
      patient_phone: aiResponse.extractedPatientInfo?.phone || null,
      preferred_date: aiResponse.extractedPatientInfo?.preferredDate || null,
    };

    const convRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify([convPayload]),
    });

    if (!convRes.ok) {
      const errText = await convRes.text();
      console.error('[SupabaseService] Failed to upsert conversation:', convRes.status, errText);
    }

    // 2. Insert User Incoming Message
    const userMsgPayload = {
      conversation_id: convId,
      organization_id: orgId,
      sender: 'user',
      text: messageText,
      intent: aiResponse.intent || null,
      confidence: aiResponse.confidence || 0.9,
      // Keep the AI reply as an approvable draft unless that exact text was already sent.
      suggested_reply: aiResponse.replyText && aiResponse.replyText !== sentText ? aiResponse.replyText : null,
      timestamp: eventIsoTime,
    };

    const userMsgRes = await fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([userMsgPayload]),
    });

    if (!userMsgRes.ok) {
      const errText = await userMsgRes.text();
      console.error('[SupabaseService] Failed to insert user message:', userMsgRes.status, errText);
    }

    // 3. Insert the message actually sent to the patient (auto reply or holding message)
    if (sentText) {
      const aiMsgPayload = {
        conversation_id: convId,
        organization_id: orgId,
        sender: 'assistant',
        text: sentText,
        intent: aiResponse.intent || null,
        confidence: aiResponse.confidence || 0.9,
        timestamp: new Date().toISOString(),
      };

      await fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          Prefer: 'return=minimal',
        },
        body: JSON.stringify([aiMsgPayload]),
      });
    }

    // 4. Upsert / Insert CRM Lead
    const leadPayload = {
      account_id: accountId,
      organization_id: orgId,
      instagram_username: username,
      patient_name: patientName,
      phone: aiResponse.extractedPatientInfo?.phone || null,
      treatment: treatment,
      treatment_name_ar: treatmentAr,
      status: 'new_inquiry',
      inquiry_date: eventIsoTime,
      campaign_source: 'instagram_direct',
      estimated_value_iqd: 0,
      staff_notes: 'وارد تلقائي من إنستغرام د. مصطفى هادي',
      confidence_score: aiResponse.confidence || 0.95,
      last_message_text: messageText,
      is_handed_over_to_human: Boolean(aiResponse.requiresHumanHandoff),
    };

    // One lead per patient: only insert if this username has no lead yet.
    const existingLeadRes = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?select=id&limit=1&account_id=eq.${encodeURIComponent(accountId)}&instagram_username=eq.${encodeURIComponent(username)}`,
      { headers: getHeaders(), cache: 'no-store' }
    );
    const existingLeads: unknown[] = existingLeadRes.ok ? await existingLeadRes.json() : [];
    if (existingLeads.length === 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          Prefer: 'return=minimal',
        },
        body: JSON.stringify([leadPayload]),
      });
    }

    console.log(`[SupabaseService] Persisted DM event successfully for ${senderId} (convId: ${convId}).`);
    return true;
  } catch (err) {
    console.error('[SupabaseService] Error persisting DM to Supabase:', err);
    return false;
  }
}

/**
 * Fetch all conversations, messages, leads, and appointments from Supabase
 */
export async function fetchLiveDashboardData(targetAccountId: string = 'drmustafa_hadi') {
  if (!SERVICE_KEY || !SUPABASE_URL) {
    return { conversations: [], leads: [], appointments: [] };
  }

  try {
    const accountFilter = targetAccountId === 'all' ? '' : `&account_id=eq.${targetAccountId}`;

    // 1. Fetch Conversations with related Chat Messages
    const convUrl = `${SUPABASE_URL}/rest/v1/conversations?select=*,chat_messages!chat_messages_conversation_id_fkey(*)&order=last_message_time.desc${accountFilter}`;
    const convRes = await fetch(convUrl, {
      headers: getHeaders(),
      cache: 'no-store',
    });

    let rawConvs: ConversationRow[] = [];
    if (convRes.ok) {
      rawConvs = await convRes.json();
    }

    const conversations: Conversation[] = (rawConvs || []).map((c) => {
      const messages: ChatMessage[] = (c.chat_messages || [])
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((m) => ({
          id: m.id,
          conversationId: m.conversation_id,
          sender: m.sender as 'user' | 'assistant' | 'staff',
          text: m.text,
          timestamp: m.timestamp,
          intent: m.intent || undefined,
          confidence: m.confidence ? Number(m.confidence) : undefined,
          suggestedReply: m.suggested_reply || undefined,
        }));

      return {
        id: c.id,
        accountId: c.account_id as AccountId,
        instagramUsername: c.instagram_username,
        patientName: c.patient_name,
        status: c.status,
        treatmentInterest: c.treatment_interest || undefined,
        unread: Boolean(c.unread),
        lastMessage: c.last_message || '',
        lastMessageTime: c.last_message_time || c.created_at,
        messages,
        patientPhone: c.patient_phone || undefined,
        preferredDate: c.preferred_date || undefined,
      };
    });

    // 2. Fetch Leads
    const leadUrl = `${SUPABASE_URL}/rest/v1/leads?select=*&order=inquiry_date.desc${accountFilter}`;
    const leadRes = await fetch(leadUrl, { headers: getHeaders(), cache: 'no-store' });
    let rawLeads: LeadRow[] = [];
    if (leadRes.ok) {
      rawLeads = await leadRes.json();
    }

    const leads: Lead[] = (rawLeads || []).map((l) => ({
      id: l.id,
      accountId: l.account_id as AccountId,
      instagramUsername: l.instagram_username,
      patientName: l.patient_name,
      phone: l.phone || undefined,
      treatment: l.treatment as TreatmentType,
      treatmentNameAr: l.treatment_name_ar,
      status: l.status,
      inquiryDate: l.inquiry_date,
      campaignSource: l.campaign_source || 'Instagram Direct',
      estimatedValueIQD: Number(l.estimated_value_iqd || 0),
      staffNotes: l.staff_notes || '',
      confidenceScore: Number(l.confidence_score || 0.9),
      lastMessageText: l.last_message_text || '',
      lastMessageTime: l.inquiry_date,
      isHandedOverToHuman: Boolean(l.is_handed_over_to_human),
    }));

    // 3. Fetch Appointments
    const aptUrl = `${SUPABASE_URL}/rest/v1/appointments?select=*&order=preferred_date.desc${accountFilter}`;
    const aptRes = await fetch(aptUrl, { headers: getHeaders(), cache: 'no-store' });
    let rawApts: AppointmentRow[] = [];
    if (aptRes.ok) {
      rawApts = await aptRes.json();
    }

    const appointments: Appointment[] = (rawApts || []).map((a) => ({
      id: a.id,
      leadId: a.lead_id || '',
      patientName: a.patient_name,
      phone: a.phone,
      accountId: a.account_id as AccountId,
      treatment: a.treatment as TreatmentType,
      treatmentNameAr: a.treatment_name_ar,
      preferredDate: a.preferred_date,
      preferredTime: a.preferred_time,
      assignedDoctor: a.assigned_doctor,
      assignedDoctorAr: a.assigned_doctor_ar,
      status: a.status,
      receptionNotes: a.reception_notes || '',
      createdAt: a.created_at,
      confirmedAt: a.confirmed_at || undefined,
    }));

    return { conversations, leads, appointments };
  } catch (err) {
    console.error('[SupabaseService] Error fetching dashboard data:', err);
    return { conversations: [], leads: [], appointments: [] };
  }
}

/**
 * Record a staff reply sent from the dashboard
 */
export async function saveStaffReplyToSupabase(
  conversationId: string,
  text: string,
  sender: 'staff' | 'assistant' = 'staff'
) {
  if (!SERVICE_KEY || !SUPABASE_URL) return false;

  try {
    const nowIso = new Date().toISOString();

    // 1. Insert chat message
    await fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([
        {
          conversation_id: conversationId,
          sender,
          text,
          timestamp: nowIso,
        },
      ]),
    });

    // 2. Update conversation last_message
    await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`, {
      method: 'PATCH',
      headers: {
        ...getHeaders(),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        last_message: text,
        last_message_time: nowIso,
        unread: false,
      }),
    });

    return true;
  } catch (err) {
    console.error('[SupabaseService] Error saving staff reply:', err);
    return false;
  }
}


/** Time (ms) of the patient's latest message, used for Meta's 24-hour reply window. */
export async function getLastUserMessageTime(conversationId: string): Promise<number | null> {
  if (!SERVICE_KEY || !SUPABASE_URL) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_messages?select=timestamp&sender=eq.user&conversation_id=eq.${encodeURIComponent(conversationId)}&order=timestamp.desc&limit=1`,
      { headers: getHeaders(), cache: 'no-store' }
    );
    if (!res.ok) return null;
    const rows: { timestamp: string }[] = await res.json();
    return rows[0] ? new Date(rows[0].timestamp).getTime() : null;
  } catch {
    return null;
  }
}

/** Removes an AI draft from a patient message once staff approved and sent it. */
export async function clearSuggestedReply(messageId: string): Promise<void> {
  // Only database ids (UUIDs) exist in Supabase; local demo ids are skipped.
  if (!SERVICE_KEY || !SUPABASE_URL || !/^[0-9a-f-]{36}$/i.test(messageId)) return;
  await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?id=eq.${messageId}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ suggested_reply: null }),
  }).catch((e) => console.error('[SupabaseService] Failed to clear draft:', e));
}
