import { NextRequest, NextResponse } from 'next/server';
import {
  fetchLiveDashboardData,
  saveStaffReplyToSupabase,
  getLastUserMessageTime,
  clearSuggestedReply,
  persistWebhookEventToSupabase,
  mapIntentToTreatment,
} from '@/lib/db/supabaseService';
import { generateStyledReply } from '@/lib/ai/replyEngine';
import { defaultGraphApiDispatcher } from '@/lib/instagram/graphApi';
import { AccountId } from '@/types';

/** Real Instagram conversations use the numeric IGSID as id (conv_123...). Demo/simulated ones don't. */
const instagramRecipientOf = (conversationId: string) => {
  const id = conversationId.replace(/^conv_/, '');
  return /^\d{6,}$/.test(id) ? id : null;
};

/**
 * GET /api/conversations
 * Returns real-time conversations, chat messages, leads, and appointments from Supabase
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId') || 'drmustafa_hadi';

    const data = await fetchLiveDashboardData(accountId);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/conversations] GET Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/conversations
 * Actions:
 * - staff_reply: staff sends a message from the dashboard inbox
 * - simulate: simulate a patient DM and persist to Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'staff_reply' } = body;

    if (action === 'staff_reply') {
      const { conversationId, text, sender = 'staff', approvedMessageId } = body;
      if (!conversationId || !text) {
        return NextResponse.json(
          { error: 'conversationId and text are required.' },
          { status: 400 }
        );
      }

      if (typeof text !== 'string' || text.length > 1000) {
        return NextResponse.json({ error: 'Reply must be text under 1000 characters.' }, { status: 400 });
      }

      // Deliver to Instagram first for real conversations; only save if delivery worked.
      const recipientId = instagramRecipientOf(String(conversationId));
      let delivered: boolean | null = null;
      if (recipientId) {
        const lastUserAt = await getLastUserMessageTime(String(conversationId));
        const result = await defaultGraphApiDispatcher.sendDirectMessage({
          recipientId,
          text,
          incomingMessageTimestamp: lastUserAt ?? undefined,
        });
        if (!result.success) {
          return NextResponse.json(
            { success: false, delivered: false, error: result.error, message: result.message },
            { status: 502 }
          );
        }
        delivered = true;
      }

      await saveStaffReplyToSupabase(conversationId, text, sender);
      if (typeof approvedMessageId === 'string') await clearSuggestedReply(approvedMessageId);
      return NextResponse.json({ success: true, delivered, timestamp: new Date().toISOString() });
    }

    if (action === 'simulate') {
      const {
        text,
        username = 'patient_iq',
        accountId = 'drmustafa_hadi',
        conversationId,
        history = [],
      } = body;

      if (!text) {
        return NextResponse.json({ error: 'text is required.' }, { status: 400 });
      }

      const senderId = conversationId ? conversationId.replace('conv_', '') : `sim_${Date.now()}`;
      const patientName = username === 'patient_iq' ? 'مراجع إنستغرام تجريبي' : `@${username}`;

      // 1. Run Iraqi AI Dialect Engine (Async with Gemini + context history)
      const aiResponse = await generateStyledReply(text, accountId as AccountId, patientName, history);

      // 2. Persist to Supabase
      await persistWebhookEventToSupabase({
        messageId: `msg_${Date.now()}`,
        senderId,
        senderUsername: username,
        recipientId: accountId,
        accountId: accountId as AccountId,
        messageText: text,
        timestamp: Date.now(),
        aiResponse: {
          replyText: aiResponse.replyText,
          intent: aiResponse.intent,
          confidence: aiResponse.confidence,
          requiresHumanHandoff: aiResponse.requiresHumanHandoff,
          treatmentDetected: aiResponse.treatmentDetected || mapIntentToTreatment(aiResponse.intent),
          extractedPatientInfo: aiResponse.extractedPatientInfo,
        },
        // Simulated chats are never sent anywhere; mirror what the live webhook would do.
        sentText: aiResponse.mode === 'auto' ? aiResponse.replyText : undefined,
      });

      return NextResponse.json({
        success: true,
        aiResponse,
        senderId,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/conversations] POST Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
