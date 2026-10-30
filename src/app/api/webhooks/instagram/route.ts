import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateIraqiDialectResponse } from '@/lib/ai/iraqiEngine';

// Meta Verification Token & App Secret from environment variables
// Hardcoded production secrets are strictly prohibited.
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET;

/**
 * 1. Meta Webhook Handshake (GET)
 * Meta calls this endpoint with hub.mode, hub.challenge, and hub.verify_token
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Enforce configuration check
  if (!VERIFY_TOKEN) {
    console.error('[Meta Webhook] Server configuration error: META_VERIFY_TOKEN is not set.');
    return NextResponse.json(
      { error: 'Server misconfiguration: META_VERIFY_TOKEN environment variable is missing.' },
      { status: 500 }
    );
  }

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
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

    // In production or whenever APP_SECRET is configured, enforce constant-time HMAC-SHA256 signature verification
    if (process.env.NODE_ENV === 'production' || APP_SECRET) {
      if (!APP_SECRET) {
        console.error('[Meta Webhook] Production error: META_APP_SECRET is not configured.');
        return NextResponse.json(
          { error: 'Server misconfiguration: META_APP_SECRET is required for signature verification.' },
          { status: 500 }
        );
      }

      if (!signature) {
        console.warn('[Meta Webhook] Security rejection: Missing X-Hub-Signature-256 header.');
        return NextResponse.json({ error: 'Missing HMAC signature.' }, { status: 401 });
      }

      const expectedSignature =
        'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');

      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        console.error('[Meta Webhook] Security alert: Signature verification failed!');
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

