import { NextRequest, NextResponse } from 'next/server';
import {
  validateMetaSignature,
  processInstagramWebhook,
} from '@/lib/instagram/webhookHandler';

// Meta Verification Token from environment variables
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

    // Enforce constant-time HMAC-SHA256 signature verification when real production secret is provided
    if (APP_SECRET && APP_SECRET !== 'mustafah_meta_app_secret_demo') {
      const sigValidation = validateMetaSignature(rawBody, signature, APP_SECRET);
      if (!sigValidation.isValid) {
        console.error(`[Meta Webhook] Signature verification failed: ${sigValidation.error}`);
        const statusCode = sigValidation.error?.includes('Missing') || sigValidation.error?.includes('Invalid') ? 401 : 500;
        return NextResponse.json({ error: sigValidation.error }, { status: statusCode });
      }
    } else {
      console.warn('[Meta Webhook] META_APP_SECRET is not configured or using demo secret; processing in permissive mode.');
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    // Process through complete pipeline: deduplication, echo suppression, account isolation,
    // 24-hour window verification, human takeover checks, Iraqi dialect AI, and Graph API dispatch
    const result = await processInstagramWebhook(payload);

    // Always respond immediately with 200 OK within 2 seconds to prevent Meta retries
    return NextResponse.json(
      {
        status: 'EVENT_RECEIVED',
        summary: result.summary,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Meta Webhook] Error processing event:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

