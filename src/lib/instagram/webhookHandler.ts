import crypto from 'crypto';
import {
  InstagramWebhookPayload,
  ProcessedWebhookEventResult,
} from './types';
import {
  isWithin24HourWindow,
  resolveTargetAccount,
  HumanTakeoverTracker,
  globalHumanTakeoverTracker,
  PILOT_ACCOUNT_ID,
} from './policy';
import { MessageDeduplicator, globalMessageDeduplicator } from './dedup';
import {
  InstagramGraphApiDispatcher,
  defaultGraphApiDispatcher,
} from './graphApi';
import { generateIraqiDialectResponse } from '@/lib/ai/iraqiEngine';

export interface WebhookHandlerOptions {
  deduplicator?: MessageDeduplicator;
  takeoverTracker?: HumanTakeoverTracker;
  dispatcher?: InstagramGraphApiDispatcher;
  enableOutboundDispatch?: boolean;
  appSecret?: string;
  now?: number;
}

/**
 * Validates Meta's HMAC-SHA256 signature using constant-time comparison.
 */
export function validateMetaSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string | undefined = process.env.META_APP_SECRET
): { isValid: boolean; error?: string } {
  if (!appSecret) {
    return {
      isValid: false,
      error: 'META_APP_SECRET environment variable is missing.',
    };
  }

  if (!signature) {
    return {
      isValid: false,
      error: 'Missing X-Hub-Signature-256 header.',
    };
  }

  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return {
      isValid: false,
      error: 'Invalid HMAC signature. Signature verification failed.',
    };
  }

  return { isValid: true };
}

/**
 * Full Instagram Webhook Processing Pipeline
 */
export async function processInstagramWebhook(
  payload: InstagramWebhookPayload,
  options: WebhookHandlerOptions = {}
): Promise<{
  results: ProcessedWebhookEventResult[];
  summary: {
    total: number;
    processed: number;
    duplicates: number;
    echoes: number;
    outOfWindow: number;
    humanTakeover: number;
    clinicBlocked: number;
  };
}> {
  const deduplicator = options.deduplicator || globalMessageDeduplicator;
  const takeoverTracker = options.takeoverTracker || globalHumanTakeoverTracker;
  const dispatcher = options.dispatcher || defaultGraphApiDispatcher;
  const enableOutboundDispatch = options.enableOutboundDispatch ?? true;
  const now = options.now ?? Date.now();

  const results: ProcessedWebhookEventResult[] = [];
  const summary = {
    total: 0,
    processed: 0,
    duplicates: 0,
    echoes: 0,
    outOfWindow: 0,
    humanTakeover: 0,
    clinicBlocked: 0,
  };

  if (payload.object !== 'instagram' || !Array.isArray(payload.entry)) {
    return { results, summary };
  }

  for (const entry of payload.entry) {
    const messagingEvents = entry.messaging || [];

    for (const event of messagingEvents) {
      summary.total++;
      const senderId = event.sender?.id || 'unknown_sender';
      const recipientId = event.recipient?.id || entry.id || 'unknown_recipient';
      const eventTimestamp = event.timestamp || entry.time || now;
      const message = event.message;
      const messageId = message?.mid || `gen_${eventTimestamp}_${senderId}`;
      const messageText = message?.text?.trim();

      // 1. Bot Echo Check
      if (message?.is_echo) {
        summary.echoes++;
        results.push({
          eventId: messageId,
          senderId,
          recipientId,
          accountId: PILOT_ACCOUNT_ID,
          isEcho: true,
          isDuplicate: false,
          isWithin24hWindow: true,
          isHandedOverToHuman: false,
          orthoPriceInquiryDetected: false,
          requiresHumanHandoff: false,
          status: 'IGNORED_ECHO',
        });
        continue;
      }

      // 2. Duplicate Event Check
      if (deduplicator.isDuplicate(messageId, now)) {
        summary.duplicates++;
        results.push({
          eventId: messageId,
          senderId,
          recipientId,
          accountId: PILOT_ACCOUNT_ID,
          isEcho: false,
          isDuplicate: true,
          isWithin24hWindow: true,
          isHandedOverToHuman: false,
          orthoPriceInquiryDetected: false,
          requiresHumanHandoff: false,
          status: 'IGNORED_DUPLICATE',
        });
        continue;
      }

      // 3. Account Isolation Check (Clinic Workspace Protection)
      const accountResolution = resolveTargetAccount(recipientId);
      if (accountResolution.isClinic || !accountResolution.isLiveAllowed) {
        summary.clinicBlocked++;
        console.warn(
          `[Meta Webhook] Account Isolation: Event targeting clinic account @almeswaksmile.iq rejected. Workspace is locked in Demo mode.`
        );
        results.push({
          eventId: messageId,
          senderId,
          recipientId,
          accountId: accountResolution.accountId,
          messageText,
          isEcho: false,
          isDuplicate: false,
          isWithin24hWindow: true,
          isHandedOverToHuman: false,
          orthoPriceInquiryDetected: false,
          requiresHumanHandoff: false,
          status: 'CLINIC_ACCOUNT_LOCKED',
        });
        continue;
      }

      // 4. Non-Text Event Handling (e.g. Stickers, Reactions, Audio attachments)
      if (!messageText) {
        results.push({
          eventId: messageId,
          senderId,
          recipientId,
          accountId: PILOT_ACCOUNT_ID,
          isEcho: false,
          isDuplicate: false,
          isWithin24hWindow: isWithin24HourWindow(eventTimestamp, now),
          isHandedOverToHuman: takeoverTracker.isTakeoverActive(senderId),
          orthoPriceInquiryDetected: false,
          requiresHumanHandoff: false,
          status: 'NON_TEXT_EVENT',
        });
        continue;
      }

      // 5. 24-Hour Messaging Policy Guard
      const withinWindow = isWithin24HourWindow(eventTimestamp, now);
      if (!withinWindow) {
        summary.outOfWindow++;
        takeoverTracker.setTakeover(
          senderId,
          'خارج نافذة الـ 24 ساعة لسياسة Meta — يجب المتابعة اليدوية أو عبر الواتساب',
          now
        );
        console.warn(
          `[Meta Webhook] Policy Violation: Incoming message from ${senderId} is outside 24h window (${eventTimestamp}). Escalated to human staff.`
        );
        results.push({
          eventId: messageId,
          senderId,
          recipientId,
          accountId: PILOT_ACCOUNT_ID,
          messageText,
          isEcho: false,
          isDuplicate: false,
          isWithin24hWindow: false,
          isHandedOverToHuman: true,
          orthoPriceInquiryDetected: false,
          requiresHumanHandoff: true,
          handoffReason: 'خارج نافذة الـ 24 ساعة لسياسة Meta — يجب المتابعة اليدوية أو عبر الواتساب',
          status: 'OUTSIDE_24H_WINDOW_ESCALATED',
        });
        continue;
      }

      // 6. Human Takeover Check: Suppress automated AI replies if conversation is handed over
      if (takeoverTracker.isTakeoverActive(senderId)) {
        summary.humanTakeover++;
        const handoffReason = takeoverTracker.getTakeoverReason(senderId);
        console.log(
          `[Meta Webhook] Human Takeover Active for ${senderId}. Automated AI reply suppressed (Reason: ${handoffReason}).`
        );
        results.push({
          eventId: messageId,
          senderId,
          recipientId,
          accountId: PILOT_ACCOUNT_ID,
          messageText,
          isEcho: false,
          isDuplicate: false,
          isWithin24hWindow: true,
          isHandedOverToHuman: true,
          orthoPriceInquiryDetected: false,
          requiresHumanHandoff: true,
          handoffReason,
          status: 'HUMAN_TAKEOVER_ACTIVE_NO_AI_REPLY',
        });
        continue;
      }

      // 7. Iraqi Arabic AI Engine Execution with Strict Orthodontic Pricing Prohibition
      const aiResponse = generateIraqiDialectResponse(messageText, PILOT_ACCOUNT_ID);
      const isOrthoPriceInquiry =
        aiResponse.intent === 'orthodontic_inquiry' &&
        /سعر|أسعار|اسعار|تكلفة|تكلف|يكلف|بيش|شكد|كم|فلوس|قسط|أقساط|اقساط|تقسيط|دفعة|مقدمة|تمويل|دفعات|طريقة الدفع|price|cost|installment/i.test(
          messageText
        );

      // 8. If human handoff is required (e.g. ortho price inquiry, emergency, human requested)
      if (aiResponse.requiresHumanHandoff) {
        takeoverTracker.setTakeover(
          senderId,
          aiResponse.handoffReason || 'تحويل للموظف البشري',
          now
        );
      }

      // 9. Outbound Dispatch via Meta Graph API
      let outboundResult;
      if (enableOutboundDispatch) {
        outboundResult = await dispatcher.sendDirectMessage({
          recipientId: senderId,
          text: aiResponse.replyText,
          accountId: PILOT_ACCOUNT_ID,
          incomingMessageTimestamp: eventTimestamp,
          now,
        });
      }

      summary.processed++;
      results.push({
        eventId: messageId,
        senderId,
        recipientId,
        accountId: PILOT_ACCOUNT_ID,
        messageText,
        isEcho: false,
        isDuplicate: false,
        isWithin24hWindow: true,
        isHandedOverToHuman: aiResponse.requiresHumanHandoff,
        orthoPriceInquiryDetected: isOrthoPriceInquiry,
        aiReplyText: aiResponse.replyText,
        intent: aiResponse.intent,
        confidence: aiResponse.confidence,
        requiresHumanHandoff: aiResponse.requiresHumanHandoff,
        handoffReason: aiResponse.handoffReason,
        outboundResult,
        status: outboundResult?.success ? 'SUCCESS_DISPATCHED' : 'PROCESSED_NO_DISPATCH',
      });
    }
  }

  return { results, summary };
}
