import { NextRequest, NextResponse } from 'next/server';
import {
  fetchLiveDashboardData,
  saveStaffReplyToSupabase,
  persistWebhookEventToSupabase,
  mapIntentToTreatment,
} from '@/lib/db/supabaseService';
import { generateIraqiDialectResponseAsync } from '@/lib/ai/iraqiEngine';
import { AccountId } from '@/types';

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
      const { conversationId, text, sender = 'staff' } = body;
      if (!conversationId || !text) {
        return NextResponse.json(
          { error: 'conversationId and text are required.' },
          { status: 400 }
        );
      }

      await saveStaffReplyToSupabase(conversationId, text, sender);
      return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
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
      const aiResponse = await generateIraqiDialectResponseAsync(
        text,
        accountId as AccountId,
        patientName,
        history
      );

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
        outboundDispatched: true,
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
