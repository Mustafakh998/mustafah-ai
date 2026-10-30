import {
  OutboundDispatchResult,
  OutboundMessageRequest,
  OutboundMessageSuccessResponse,
  MetaGraphApiErrorResponse,
} from './types';
import { AccountId } from '@/types';
import { isWithin24HourWindow, PILOT_ACCOUNT_ID } from './policy';

export interface GraphApiDispatcherOptions {
  customFetch?: typeof fetch;
  maxRetries?: number;
  initialBackoffMs?: number;
  graphApiVersion?: string;
  baseUrl?: string;
}

/**
 * Sanitizes logging objects to guarantee access tokens and secrets are never logged.
 */
export function sanitizeLogString(str: string): string {
  if (!str) return '';
  return str
    .replace(/(access_token=)[^& \t\n\r]+/gi, '$1[MASKED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+/gi, '$1[MASKED]')
    .replace(/(app_secret=)[^& \t\n\r]+/gi, '$1[MASKED]');
}

/**
 * Outbound Instagram Graph API Message Dispatcher
 * Sends Direct Messages via official Meta Graph API v21.0
 */
export class InstagramGraphApiDispatcher {
  private customFetch?: typeof fetch;
  private maxRetries: number;
  private initialBackoffMs: number;
  private graphApiVersion: string;
  private baseUrl: string;

  constructor(options: GraphApiDispatcherOptions = {}) {
    this.customFetch = options.customFetch;
    this.maxRetries = options.maxRetries ?? 2;
    this.initialBackoffMs = options.initialBackoffMs ?? 300;
    this.graphApiVersion = options.graphApiVersion ?? 'v21.0';
    this.baseUrl = options.baseUrl ?? 'https://graph.facebook.com';
  }

  /**
   * Resolves the access token for the specified account.
   * Only permits tokens for Dr. Mustafa Hadi personal pilot account.
   */
  private resolveAccessToken(accountId: AccountId): string | null {
    if (accountId !== PILOT_ACCOUNT_ID) {
      return null;
    }

    const token = process.env.DR_MUSTAFA_ACCESS_TOKEN;
    if (!token || token.trim() === '' || token.includes('your_long_lived_user_access_token_here')) {
      return null;
    }

    return token.trim();
  }

  /**
   * Dispatches an outbound direct message to a recipient.
   */
  public async sendDirectMessage(params: {
    recipientId: string;
    text: string;
    accountId?: AccountId;
    incomingMessageTimestamp?: number;
    skipWindowCheck?: boolean;
    now?: number;
  }): Promise<OutboundDispatchResult> {
    const {
      recipientId,
      text,
      accountId = PILOT_ACCOUNT_ID,
      incomingMessageTimestamp,
      skipWindowCheck = false,
      now = Date.now(),
    } = params;

    // 1. Account Isolation Guard: Strictly prevent clinic account from sending outbound messages
    if (accountId !== PILOT_ACCOUNT_ID) {
      console.warn(
        `[Meta Dispatcher] Blocked outbound attempt: Account "${accountId}" is locked in Demo mode.`
      );
      return {
        success: false,
        error: 'ACCOUNT_ISOLATION_PROHIBITION',
        message: 'Outbound dispatch blocked: Clinic account @almeswaksmile.iq is locked in Demo mode.',
      };
    }

    // 2. 24-Hour Messaging Policy Guard
    if (incomingMessageTimestamp && !skipWindowCheck) {
      const isAllowed = isWithin24HourWindow(incomingMessageTimestamp, now);
      if (!isAllowed) {
        console.warn(
          `[Meta Dispatcher] Blocked outbound attempt to ${recipientId}: Exceeded 24-hour messaging window.`
        );
        return {
          success: false,
          error: 'OUTSIDE_24H_WINDOW',
          message: 'Outbound message blocked: Exceeded Meta 24-hour messaging window.',
        };
      }
    }

    // 3. Token Resolution & Authorization Check
    const token = this.resolveAccessToken(accountId);
    if (!token) {
      console.warn(
        `[Meta Dispatcher] Outbound dispatch aborted: Missing or unconfigured DR_MUSTAFA_ACCESS_TOKEN.`
      );
      return {
        success: false,
        error: 'UNAUTHORIZED_OR_MISSING_TOKEN',
        message: 'Personal Instagram account is not authorized or access token is missing.',
      };
    }

    // 4. Construct Endpoint & Payload (Dynamic Hostname Resolution based on Token Type)
    // If token starts with IGAA (Instagram Login User Token), route to graph.instagram.com
    let resolvedBaseUrl = this.baseUrl;
    if (token.startsWith('IGAA') && resolvedBaseUrl.includes('graph.facebook.com')) {
      resolvedBaseUrl = 'https://graph.instagram.com';
    }
    const url = `${resolvedBaseUrl}/${this.graphApiVersion}/me/messages`;
    const payload: OutboundMessageRequest = {
      recipient: { id: recipientId },
      message: { text },
    };

    const fetchFn = this.customFetch || globalThis.fetch;

    // 5. Execute Request with Retry & Rate-Limit Backoff
    let attempt = 0;
    let delay = this.initialBackoffMs;

    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const response = await fetchFn(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const rawJson = await response.json();

        // Success Response (HTTP 200 OK)
        if (response.ok) {
          const successData = rawJson as OutboundMessageSuccessResponse;
          return {
            success: true,
            recipientId: successData.recipient_id || recipientId,
            messageId: successData.message_id,
          };
        }

        // Meta Graph API Error Response
        const errorData = rawJson as MetaGraphApiErrorResponse;
        const metaError = errorData.error;
        const errorCode = metaError?.code;

        // Check for Expired / Invalid Token (Code 190)
        if (errorCode === 190) {
          console.error(
            `[Meta Dispatcher] Auth failure: Instagram access token is expired or invalidated (Code 190).`
          );
          return {
            success: false,
            error: 'TOKEN_EXPIRED',
            code: 190,
            message: metaError.message || 'Instagram access token has expired. Please re-authorize.',
          };
        }

        // Check for Rate Limit Errors (Code 4, 17, 32, 613)
        const isRateLimit = errorCode === 4 || errorCode === 17 || errorCode === 32 || errorCode === 613;
        if (isRateLimit) {
          console.warn(
            `[Meta Dispatcher] Rate limit encountered (Code ${errorCode}). Attempt ${attempt}/${this.maxRetries + 1}.`
          );
          if (attempt <= this.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            continue;
          }
          return {
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            code: errorCode,
            message: metaError.message || 'Meta rate limit reached. Please wait before retrying.',
          };
        }

        // Server-side transient 5xx errors: Retry
        if (response.status >= 500 && attempt <= this.maxRetries) {
          console.warn(
            `[Meta Dispatcher] Meta 5xx server error (${response.status}). Retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }

        // Generic API Error
        console.error(
          `[Meta Dispatcher] Graph API call failed with status ${response.status}: ${sanitizeLogString(
            metaError?.message || 'Unknown error'
          )}`
        );
        return {
          success: false,
          error: 'API_ERROR',
          code: errorCode,
          message: metaError?.message || `Meta API error (${response.status})`,
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[Meta Dispatcher] Network/fetch error on attempt ${attempt}: ${sanitizeLogString(errorMsg)}`
        );

        if (attempt <= this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }

        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: `Network error connecting to Meta Graph API: ${sanitizeLogString(errorMsg)}`,
        };
      }
    }

    return {
      success: false,
      error: 'API_ERROR',
      message: 'Max retry attempts exceeded without receiving a valid response from Meta.',
    };
  }
}

// Global default singleton dispatcher
export const defaultGraphApiDispatcher = new InstagramGraphApiDispatcher();
