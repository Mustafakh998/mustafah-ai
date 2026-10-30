import { AccountId, PilotIntentType, TreatmentType } from '@/types';

// =============================================================================
// Meta Instagram Webhook Payload Types
// =============================================================================

export interface InstagramWebhookSender {
  id: string;
}

export interface InstagramWebhookRecipient {
  id: string;
}

export interface InstagramWebhookMessage {
  mid: string;
  text?: string;
  is_echo?: boolean;
  quick_reply?: {
    payload: string;
  };
  attachments?: Array<{
    type: string;
    payload: {
      url?: string;
      [key: string]: unknown;
    };
  }>;
}

export interface InstagramWebhookMessagingEvent {
  sender: InstagramWebhookSender;
  recipient: InstagramWebhookRecipient;
  timestamp: number;
  message?: InstagramWebhookMessage;
  postback?: {
    title: string;
    payload: string;
    mid: string;
  };
}

export interface InstagramWebhookEntry {
  id: string;
  time: number;
  messaging?: InstagramWebhookMessagingEvent[];
}

export interface InstagramWebhookPayload {
  object: 'instagram' | string;
  entry?: InstagramWebhookEntry[];
}

// =============================================================================
// Meta Instagram Graph API Types
// =============================================================================

export interface OutboundMessageRequest {
  recipient: {
    id: string;
  };
  message: {
    text: string;
  };
}

export interface OutboundMessageSuccessResponse {
  recipient_id: string;
  message_id: string;
}

export interface MetaGraphApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export interface MetaGraphApiErrorResponse {
  error: MetaGraphApiError;
}

export type OutboundDispatchResult =
  | {
      success: true;
      recipientId: string;
      messageId: string;
    }
  | {
      success: false;
      error:
        | 'UNAUTHORIZED_OR_MISSING_TOKEN'
        | 'TOKEN_EXPIRED'
        | 'RATE_LIMIT_EXCEEDED'
        | 'ACCOUNT_ISOLATION_PROHIBITION'
        | 'OUTSIDE_24H_WINDOW'
        | 'HUMAN_TAKEOVER_ACTIVE'
        | 'NETWORK_ERROR'
        | 'API_ERROR';
      code?: number;
      message: string;
    };

// =============================================================================
// Webhook Processing Event Result
// =============================================================================

export interface ProcessedWebhookEventResult {
  eventId: string;
  senderId: string;
  recipientId: string;
  accountId: AccountId;
  messageText?: string;
  isEcho: boolean;
  isDuplicate: boolean;
  isWithin24hWindow: boolean;
  isHandedOverToHuman: boolean;
  orthoPriceInquiryDetected: boolean;
  aiReplyText?: string;
  intent?: PilotIntentType | string;
  confidence?: number;
  requiresHumanHandoff: boolean;
  handoffReason?: string;
  outboundResult?: OutboundDispatchResult;
  status:
    | 'SUCCESS_DISPATCHED'
    | 'IGNORED_ECHO'
    | 'IGNORED_DUPLICATE'
    | 'CLINIC_ACCOUNT_LOCKED'
    | 'HUMAN_TAKEOVER_ACTIVE_NO_AI_REPLY'
    | 'OUTSIDE_24H_WINDOW_ESCALATED'
    | 'PROCESSED_NO_DISPATCH'
    | 'NON_TEXT_EVENT';
}
