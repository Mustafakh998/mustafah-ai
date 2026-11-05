import crypto from 'crypto';
import {
  InstagramWebhookPayload,
  ProcessedWebhookEventResult,
} from './types';
import {
  isWithin24HourWindow,
  getElapsedHours,
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
import { generateStyledReply, holdingMessageFor } from '@/lib/ai/replyEngine';
import {
  IPersistentStore,
  EscalationEventType,
  EscalationSeverity,
  DatabaseUnavailableError,
} from '@/lib/db/types';
import { defaultPersistentStore } from '@/lib/db/persistence';
import { persistWebhookEventToSupabase } from '@/lib/db/supabaseService';

export interface WebhookHandlerOptions {
  deduplicator?: MessageDeduplicator;
  takeoverTracker?: HumanTakeoverTracker;
  dispatcher?: InstagramGraphApiDispatcher;
  persistentStore?: IPersistentStore;
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
    dbFailSafeClosed: number;
  };
}> {
  const deduplicator = options.deduplicator || globalMessageDeduplicator;
  const takeoverTracker = options.takeoverTracker || globalHumanTakeoverTracker;
  const dispatcher = options.dispatcher || defaultGraphApiDispatcher;
  const persistentStore = options.persistentStore || defaultPersistentStore;
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
    dbFailSafeClosed: 0,
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

      // 2. Account Isolation Check (Clinic Workspace Protection)
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

      // 3. Persistent & In-Memory Duplicate Event Check
      const isMemoryDup = deduplicator.isDuplicate(messageId, now);
      let isClaimedPersistent = false;
      try {
        isClaimedPersistent = await persistentStore.claimMessageId(messageId, PILOT_ACCOUNT_ID, senderId);
      } catch (err: unknown) {
        if (err instanceof DatabaseUnavailableError || (err instanceof Error && err.name === 'DatabaseUnavailableError')) {
          console.error(`[Meta Webhook] FAIL-SAFE CLOSED: Database unavailable for event ${messageId}. Suppressing automated replies.`);
          summary.dbFailSafeClosed++;
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
            handoffReason: 'قاعدة البيانات غير متاحة — تم إيقاف الرد الآلي وتفعيل الحماية المغلقة (Fail-Safe Closed)',
            status: 'FAIL_SAFE_DB_UNAVAILABLE_CLOSED',
          });
          continue;
        }
        throw err;
      }

      if (isMemoryDup || !isClaimedPersistent) {
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

      // 4. Non-Text Event Handling (e.g. Stickers, Reactions, Audio attachments)
      let isPersistentTakeoverActive = false;
      try {
        isPersistentTakeoverActive = await persistentStore.isTakeoverActive(PILOT_ACCOUNT_ID, senderId);
      } catch (err: unknown) {
        if (err instanceof DatabaseUnavailableError || (err instanceof Error && err.name === 'DatabaseUnavailableError')) {
          console.error(`[Meta Webhook] FAIL-SAFE CLOSED: Database unavailable for sender ${senderId}. Suppressing automated replies.`);
          summary.dbFailSafeClosed++;
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
            handoffReason: 'قاعدة البيانات غير متاحة — تم إيقاف الرد الآلي وتفعيل الحماية المغلقة (Fail-Safe Closed)',
            status: 'FAIL_SAFE_DB_UNAVAILABLE_CLOSED',
          });
          continue;
        }
        throw err;
      }
      if (!messageText) {
        results.push({
          eventId: messageId,
          senderId,
          recipientId,
          accountId: PILOT_ACCOUNT_ID,
          isEcho: false,
          isDuplicate: false,
          isWithin24hWindow: isWithin24HourWindow(eventTimestamp, now),
          isHandedOverToHuman: isPersistentTakeoverActive || takeoverTracker.isTakeoverActive(senderId),
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
        await persistentStore.setTakeover(
          PILOT_ACCOUNT_ID,
          senderId,
          'خارج نافذة الـ 24 ساعة لسياسة Meta — يجب المتابعة اليدوية أو عبر الواتساب'
        );
        await persistentStore.recordEscalation({
          accountId: PILOT_ACCOUNT_ID,
          senderId,
          eventType: 'outside_24h_window',
          severity: 'warning',
          rawMessageText: messageText,
          details: {
            messageId,
            eventTimestamp,
            elapsedHours: getElapsedHours(eventTimestamp, now),
          },
        });
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

      // 6. Persistent & Memory Human Takeover Check: Suppress automated AI replies if active
      if (isPersistentTakeoverActive || takeoverTracker.isTakeoverActive(senderId)) {
        summary.humanTakeover++;
        const activeRecord = await persistentStore.getActiveTakeover(PILOT_ACCOUNT_ID, senderId);
        const handoffReason = activeRecord?.reason || takeoverTracker.getTakeoverReason(senderId) || 'المحادثة محولة للموظف البشري';
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
        // Still save the message so staff see it in the inbox.
        await persistWebhookEventToSupabase({
          messageId,
          senderId,
          recipientId,
          accountId: PILOT_ACCOUNT_ID,
          messageText,
          timestamp: eventTimestamp,
          aiResponse: { replyText: '', requiresHumanHandoff: true },
        }).catch((e) => console.error('[Meta Webhook] Failed to persist takeover message:', e));
        continue;
      }

      // 7. Iraqi Arabic AI Engine Execution with Strict Orthodontic Pricing Prohibition
      const aiResponse = await generateStyledReply(messageText, PILOT_ACCOUNT_ID);
      // auto: send the AI reply. draft + handoff: send a short holding message, keep the AI reply as a draft.
      // draft without handoff: send nothing until staff approve the draft in the inbox.
      const textToSend =
        aiResponse.mode === 'auto'
          ? aiResponse.replyText
          : aiResponse.requiresHumanHandoff
          ? holdingMessageFor(aiResponse.intent)
          : null;
      const isOrthoPriceInquiry =
        aiResponse.intent === 'orthodontic_inquiry' &&
        /سعر|أسعار|اسعار|تكلفة|تكلف|يكلف|بيش|شكد|كم|فلوس|قسط|أقساط|اقساط|تقسيط|دفعة|مقدمة|تمويل|دفعات|طريقة الدفع|price|cost|installment/i.test(
          messageText
        );

      // 8. If human handoff is required (e.g. ortho price inquiry, emergency, human requested)
      if (aiResponse.requiresHumanHandoff) {
        const handoffReason = aiResponse.handoffReason || 'تحويل للموظف البشري';
        takeoverTracker.setTakeover(senderId, handoffReason, now);
        await persistentStore.setTakeover(PILOT_ACCOUNT_ID, senderId, handoffReason);

        let eventType: EscalationEventType = 'human_agent_requested';
        let severity: EscalationSeverity = 'info';

        if (aiResponse.intent === 'urgent_clinical_question') {
          eventType = 'medical_emergency';
          severity = 'emergency';
        } else if (isOrthoPriceInquiry) {
          const isInstallment = /قسط|أقساط|اقساط|تقسيط|دفعة|مقدمة|تمويل|installment/i.test(messageText);
          eventType = isInstallment ? 'orthodontic_installment_inquiry' : 'orthodontic_pricing_inquiry';
          severity = 'warning';
        } else if (aiResponse.intent === 'human_attention_required') {
          eventType = 'human_agent_requested';
          severity = 'info';
        }

        await persistentStore.recordEscalation({
          accountId: PILOT_ACCOUNT_ID,
          senderId,
          eventType,
          severity,
          rawMessageText: messageText,
          details: {
            messageId,
            intent: aiResponse.intent,
            confidence: aiResponse.confidence,
            handoffReason,
          },
        });
      }

      // 9. Outbound Dispatch via Meta Graph API
      let outboundResult;
      if (enableOutboundDispatch && textToSend) {
        outboundResult = await dispatcher.sendDirectMessage({
          recipientId: senderId,
          text: textToSend,
          accountId: PILOT_ACCOUNT_ID,
          incomingMessageTimestamp: eventTimestamp,
          now,
        });

        if (outboundResult.success) {
          await persistentStore.markMessageStatus(messageId, 'processed');
        } else {
          await persistentStore.markMessageStatus(messageId, 'failed', outboundResult.message);

          let failureType: EscalationEventType = 'outbound_dispatch_failed';
          let failureSeverity: EscalationSeverity = 'warning';

          if (outboundResult.error === 'TOKEN_EXPIRED') {
            failureType = 'token_expired_or_invalid';
            failureSeverity = 'critical';
          } else if (outboundResult.error === 'RATE_LIMIT_EXCEEDED') {
            failureType = 'rate_limit_exceeded';
            failureSeverity = 'warning';
          }

          await persistentStore.recordEscalation({
            accountId: PILOT_ACCOUNT_ID,
            senderId,
            eventType: failureType,
            severity: failureSeverity,
            details: {
              messageId,
              error: outboundResult.error,
              code: outboundResult.code,
              message: outboundResult.message,
            },
          });
        }
      }

      if (!textToSend) {
        await persistentStore.markMessageStatus(messageId, 'processed');
      }

      // 10. Persist Conversation, Messages, and CRM Lead into Supabase
      try {
        await persistWebhookEventToSupabase({
          messageId,
          senderId,
          recipientId,
          accountId: PILOT_ACCOUNT_ID,
          messageText,
          timestamp: eventTimestamp,
          aiResponse: {
            replyText: aiResponse.replyText,
            intent: aiResponse.intent,
            confidence: aiResponse.confidence,
            requiresHumanHandoff: aiResponse.requiresHumanHandoff,
            treatmentDetected: aiResponse.treatmentDetected,
            extractedPatientInfo: aiResponse.extractedPatientInfo,
          },
          outboundDispatched: outboundResult?.success,
          sentText: outboundResult?.success && textToSend ? textToSend : undefined,
        });
      } catch (dbErr) {
        console.error('[Meta Webhook] Error persisting conversation to Supabase:', dbErr);
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
        status: outboundResult?.success
          ? 'SUCCESS_DISPATCHED'
          : aiResponse.mode === 'draft'
          ? 'DRAFT_AWAITING_APPROVAL'
          : 'PROCESSED_NO_DISPATCH',
      });
    }
  }

  return { results, summary };
}
