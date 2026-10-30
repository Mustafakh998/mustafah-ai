import { AccountId } from '@/types';

export interface DeduplicationRecord {
  messageId: string;
  accountId: AccountId;
  senderId: string;
  receivedAt: string;
  status: 'received' | 'processing' | 'processed' | 'failed';
  errorMessage?: string;
}

export interface TakeoverRecord {
  id: string;
  accountId: AccountId;
  senderId: string;
  conversationId?: string;
  reason: string;
  isActive: boolean;
  initiatedAt: string;
  releasedAt?: string;
  releasedBy?: string;
}

export type EscalationEventType =
  | 'orthodontic_pricing_inquiry'
  | 'orthodontic_installment_inquiry'
  | 'medical_emergency'
  | 'human_agent_requested'
  | 'outside_24h_window'
  | 'outbound_dispatch_failed'
  | 'token_expired_or_invalid'
  | 'rate_limit_exceeded';

export type EscalationSeverity = 'info' | 'warning' | 'critical' | 'emergency';

export interface EscalationEventRecord {
  id?: string;
  accountId: AccountId;
  senderId: string;
  conversationId?: string;
  eventType: EscalationEventType;
  severity: EscalationSeverity;
  rawMessageText?: string;
  details?: Record<string, unknown>;
  requiresFollowup?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt?: string;
}

export interface WebhookJobRecord {
  id: string;
  messageId: string;
  accountId: AccountId;
  senderId: string;
  recipientId: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  lockedAt?: string;
  lockedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IPersistentStore {
  // Deduplication
  claimMessageId(messageId: string, accountId: AccountId, senderId: string): Promise<boolean>;
  isMessageProcessed(messageId: string): Promise<boolean>;
  markMessageStatus(messageId: string, status: DeduplicationRecord['status'], errorMessage?: string): Promise<void>;

  // Human Takeover
  setTakeover(accountId: AccountId, senderId: string, reason: string, conversationId?: string): Promise<void>;
  isTakeoverActive(accountId: AccountId, senderId: string): Promise<boolean>;
  getActiveTakeover(accountId: AccountId, senderId: string): Promise<TakeoverRecord | null>;
  releaseTakeover(accountId: AccountId, senderId: string, releasedBy: string): Promise<boolean>;
  listActiveTakeovers(accountId?: AccountId): Promise<TakeoverRecord[]>;

  // Escalation & CRM Events
  recordEscalation(event: EscalationEventRecord): Promise<string>;
  listEscalations(filters?: { accountId?: AccountId; eventType?: EscalationEventType; requiresFollowup?: boolean }): Promise<EscalationEventRecord[]>;
  resolveEscalation(eventId: string, resolvedBy: string): Promise<boolean>;

  // Webhook Queue
  enqueueJob(job: Omit<WebhookJobRecord, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'>): Promise<string>;
  dequeueJob(lockedBy: string): Promise<WebhookJobRecord | null>;
  completeJob(jobId: string): Promise<void>;
  failJob(jobId: string, error: string): Promise<void>;

  // Reset / Clear (for testing)
  clearAll(): Promise<void>;
}
