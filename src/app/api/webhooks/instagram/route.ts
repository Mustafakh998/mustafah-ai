import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateIraqiDialectResponse } from '@/lib/ai/iraqiEngine';

// Meta Verification Token from environment (or default development token)
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'mustafah_ai_baghdad_secure_verify_2026';
const APP_SECRET = process.env.META_APP_SECRET || 'mustafah_meta_app_secret_demo';

/**
 * 1. Meta Webhook Handshake (GET)
 * Meta calls this endpoint with hub.mode, hub.challenge, and hub.verify_token
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && (token === VERIFY_TOKEN || token === 'almeswak_ai_baghdad_secure_verify_2026')) {
    console.log('[Meta Webhook] GET handshake verified successfully.');
    // Return raw challenge as plain text with 200 OK
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('[Meta Webhook] Handshake failed. Token mismatch or invalid mode.');
  return NextResponse.json({ error: 'Forbidden. Invalid verification token.' }, { status: 403 });
}

/**
 * 2. Meta Webhook Incoming Payload (POST)
 * Dispatched by Meta when an Instagram Direct Message or Comment occurs
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    // In production with APP_SECRET, verify HMAC-SHA256 signature
    if (process.env.NODE_ENV === 'production' && signature && APP_SECRET !== 'almeswak_meta_app_secret_demo') {
      const expectedSignature =
        'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');

      if (signature !== expectedSignature) {
        console.error('[Meta Webhook] Signature verification failed!');
        return NextResponse.json({ error: 'Invalid HMAC signature.' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // Meta Instagram payloads structure: { object: 'instagram', entry: [{ messaging: [...] }] }
    if (payload.object === 'instagram' && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        const messagingEvents = entry.messaging || [];

        for (const event of messagingEvents) {
          const senderId = event.sender?.id;
          const recipientId = event.recipient?.id;
          const messageText = event.message?.text;

          // Ignore bot's own outbound messages (echoes)
          if (event.message?.is_echo) {
            continue;
          }

          if (messageText) {
            console.log(`[Meta Webhook] Incoming DM from ${senderId}: "${messageText}"`);

            // Run Iraqi Arabic AI Engine
            const aiResponse = generateIraqiDialectResponse(messageText, 'drmustafa_hadi');

            console.log(
              `[Meta Webhook] Generated Iraqi reply (Intent: ${aiResponse.intent}, Confidence: ${aiResponse.confidence}):`
            );
            console.log(`[Meta Webhook] "${aiResponse.replyText.slice(0, 80)}..."`);

            // In production with live Meta Page token, you invoke:
            // POST https://graph.facebook.com/v21.0/me/messages
            // { recipient: { id: senderId }, message: { text: aiResponse.replyText } }
          }
        }
      }
    }

    // Always respond immediately with 200 OK within 2 seconds to prevent Meta retries
    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
  } catch (error: any) {
    console.error('[Meta Webhook] Error processing event:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

