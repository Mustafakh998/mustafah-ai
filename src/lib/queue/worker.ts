import crypto from 'crypto';
import { AccountId } from '@/types';
import { IPersistentStore, WebhookJobRecord, EscalationEventType } from '@/lib/db/types';
import { defaultPersistentStore } from '@/lib/db/persistence';
import {
  InstagramGraphApiDispatcher,
  defaultGraphApiDispatcher,
} from '@/lib/instagram/graphApi';
import { isWithin24HourWindow, PILOT_ACCOUNT_ID } from '@/lib/instagram/policy';

export interface WorkerOptions {
  workerId?: string;
  persistentStore?: IPersistentStore;
  dispatcher?: InstagramGraphApiDispatcher;
  baseBackoffMs?: number;
  maxAttempts?: number;
}

export type JobProcessStatus =
  | 'COMPLETED'
  | 'RETRY_SCHEDULED'
  | 'DEAD_LETTER'
  | 'OUTSIDE_24H_WINDOW_CANCELLED'
  | 'TAKEOVER_SUPPRESSED'
  | 'ACCOUNT_ISOLATION_BLOCKED'
  | 'NO_JOB';

export interface JobProcessingResult {
  jobId: string;
  messageId: string;
  senderId: string;
  accountId: AccountId;
  status: JobProcessStatus;
  attempts: number;
  error?: string;
  nextRetryDelayMs?: number;
}

/**
 * Background Queue Worker for Webhook Jobs
 * Enforces atomic concurrency control, exponential backoff retries,
 * dead-letter escalation, and mandatory 24-hour window re-validation.
 */
export class WebhookQueueWorker {
  public readonly workerId: string;
  private persistentStore: IPersistentStore;
  private dispatcher: InstagramGraphApiDispatcher;
  private baseBackoffMs: number;
  private maxAttempts: number;

  constructor(options: WorkerOptions = {}) {
    this.workerId =
      options.workerId || `worker_${process.pid || 1}_${crypto.randomUUID().slice(0, 8)}`;
    this.persistentStore = options.persistentStore || defaultPersistentStore;
    this.dispatcher = options.dispatcher || defaultGraphApiDispatcher;
    this.baseBackoffMs = options.baseBackoffMs ?? 1000;
    this.maxAttempts = options.maxAttempts ?? 3;
  }

  /**
   * Calculates exponential backoff delay: base * 2^(attempts - 1)
   */
  public calculateBackoffDelay(attempts: number): number {
    return this.baseBackoffMs * Math.pow(2, Math.max(0, attempts - 1));
  }

  /**
   * Atomically dequeues and processes the next pending/eligible job.
   */
  public async processNextJob(options: { now?: number } = {}): Promise<JobProcessingResult | null> {
    const now = options.now ?? Date.now();

    // 1. Concurrency Control: Atomically claim job with locked_by = this.workerId
    const job = await this.persistentStore.dequeueJob(this.workerId);
    if (!job) {
      return null;
    }

    const { id: jobId, messageId, accountId, senderId, recipientId, payload, attempts } = job;

    // 2. Account Isolation Check: Strictly prohibit clinic account dispatch
    if (accountId === 'almeswaksmile_iq') {
      const errorMsg = 'ACCOUNT_ISOLATION_PROHIBITION: Clinic account @almeswaksmile.iq is locked in Demo mode.';
      await this.persistentStore.failJob(jobId, errorMsg);
      await this.persistentStore.recordEscalation({
        accountId,
        senderId,
        eventType: 'outbound_dispatch_failed',
        severity: 'critical',
        rawMessageText: typeof payload.text === 'string' ? payload.text : '',
        details: { jobId, messageId, reason: errorMsg },
      });
      return {
        jobId,
        messageId,
        senderId,
        accountId,
        status: 'ACCOUNT_ISOLATION_BLOCKED',
        attempts,
        error: errorMsg,
      };
    }

    // 3. Human Takeover Re-Check: If human staff took over during queue wait, suppress automated reply
    const isTakeoverActive = await this.persistentStore.isTakeoverActive(accountId, senderId);
    if (isTakeoverActive) {
      const takeoverInfo = await this.persistentStore.getActiveTakeover(accountId, senderId);
      const reason = takeoverInfo?.reason || 'المحادثة محولة للموظف البشري';
      await this.persistentStore.completeJob(jobId);
      return {
        jobId,
        messageId,
        senderId,
        accountId,
        status: 'TAKEOVER_SUPPRESSED',
        attempts,
        error: `Automated reply suppressed: human takeover active (${reason})`,
      };
    }

    // 4. Critical 24-Hour Messaging Policy Re-Validation:
    // If job was delayed in queue and retried, re-validate incoming message timestamp against current time
    const incomingTimestamp = typeof payload.incomingTimestamp === 'number'
      ? payload.incomingTimestamp
      : Date.parse(job.createdAt) || now;

    const withinWindow = isWithin24HourWindow(incomingTimestamp, now);
    if (!withinWindow) {
      const errorMsg = 'OUTSIDE_24H_WINDOW: Message is older than 24 hours. Automated dispatch cancelled to prevent Meta policy penalty.';
      await this.persistentStore.failJob(jobId, errorMsg);
      
      // Escalate to human staff and activate takeover
      await this.persistentStore.setTakeover(
        accountId,
        senderId,
        'خارج نافذة الـ 24 ساعة لسياسة Meta — تم إلغاء الرد الآلي في طابور المعالجة وتوجيهه للمتابعة اليدوية'
      );
      await this.persistentStore.recordEscalation({
        accountId,
        senderId,
        eventType: 'outside_24h_window',
        severity: 'warning',
        rawMessageText: typeof payload.text === 'string' ? payload.text : '',
        details: {
          jobId,
          messageId,
          incomingTimestamp,
          delayedTime: now,
          error: errorMsg,
        },
      });

      return {
        jobId,
        messageId,
        senderId,
        accountId,
        status: 'OUTSIDE_24H_WINDOW_CANCELLED',
        attempts,
        error: errorMsg,
      };
    }

    // 5. Attempt Outbound Graph API Dispatch
    const replyText = typeof payload.text === 'string' ? payload.text : '';
    const outboundResult = await this.dispatcher.sendDirectMessage({
      recipientId: senderId,
      text: replyText,
      accountId: accountId as typeof PILOT_ACCOUNT_ID,
      incomingMessageTimestamp: incomingTimestamp,
      now,
    });

    if (outboundResult.success) {
      await this.persistentStore.completeJob(jobId);
      await this.persistentStore.markMessageStatus(messageId, 'processed');
      return {
        jobId,
        messageId,
        senderId,
        accountId,
        status: 'COMPLETED',
        attempts,
      };
    }

    // 6. Handle Dispatch Failure & Retries
    const failureError = outboundResult.message || outboundResult.error || 'Unknown dispatch error';
    await this.persistentStore.failJob(jobId, failureError);

    if (attempts >= this.maxAttempts) {
      // Dead-Letter Escalation
      let eventType: EscalationEventType = 'outbound_dispatch_failed';
      if (outboundResult.error === 'TOKEN_EXPIRED') {
        eventType = 'token_expired_or_invalid';
      } else if (outboundResult.error === 'RATE_LIMIT_EXCEEDED') {
        eventType = 'rate_limit_exceeded';
      }

      await this.persistentStore.recordEscalation({
        accountId,
        senderId,
        eventType,
        severity: 'critical',
        rawMessageText: replyText,
        details: {
          jobId,
          messageId,
          attempts,
          maxAttempts: this.maxAttempts,
          status: 'dead_letter',
          error: failureError,
        },
      });

      return {
        jobId,
        messageId,
        senderId,
        accountId,
        status: 'DEAD_LETTER',
        attempts,
        error: failureError,
      };
    }

    const nextRetryDelayMs = this.calculateBackoffDelay(attempts);
    return {
      jobId,
      messageId,
      senderId,
      accountId,
      status: 'RETRY_SCHEDULED',
      attempts,
      error: failureError,
      nextRetryDelayMs,
    };
  }

  /**
   * Processes a batch of up to `maxJobs` queued events.
   */
  public async runBatch(maxJobs = 10, options: { now?: number } = {}): Promise<JobProcessingResult[]> {
    const results: JobProcessingResult[] = [];
    for (let i = 0; i < maxJobs; i++) {
      const res = await this.processNextJob(options);
      if (!res) break;
      results.push(res);
    }
    return results;
  }

  /**
   * Lists all jobs in the dead-letter queue for review.
   */
  public async listDeadLetterJobs(accountId?: AccountId): Promise<WebhookJobRecord[]> {
    return this.persistentStore.listDeadLetterJobs(accountId);
  }

  /**
   * Resets a dead-letter job back to pending status for manual retry.
   */
  public async retryDeadLetterJob(jobId: string): Promise<boolean> {
    return this.persistentStore.retryDeadLetterJob(jobId);
  }
}

// Global default singleton worker
export const defaultWebhookQueueWorker = new WebhookQueueWorker();

