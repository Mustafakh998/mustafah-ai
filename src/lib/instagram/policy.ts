import { AccountId } from '@/types';

// =============================================================================
// 1. Meta 24-Hour Messaging Policy Calculation
// =============================================================================

export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000; // 86,400,000 ms

/**
 * Normalizes incoming timestamp to milliseconds (supports seconds or ms format)
 */
export function normalizeTimestampToMs(timestamp: number): number {
  if (!timestamp || isNaN(timestamp)) return Date.now();
  // If timestamp is less than year 2001 in ms (~1e11), it's in seconds
  return timestamp < 1e11 ? timestamp * 1000 : timestamp;
}

/**
 * Checks whether an incoming message is within the permitted 24-hour Meta messaging window.
 * Strictly prohibits automated replies outside this window.
 */
export function isWithin24HourWindow(
  messageTimestamp: number,
  now: number = Date.now()
): boolean {
  const eventMs = normalizeTimestampToMs(messageTimestamp);
  const elapsed = now - eventMs;

  // Clock drift buffer of up to 60 seconds into the future
  if (elapsed < -60_000) {
    return false;
  }

  return elapsed <= TWENTY_FOUR_HOURS_MS;
}

/**
 * Computes elapsed hours since message creation
 */
export function getElapsedHours(
  messageTimestamp: number,
  now: number = Date.now()
): number {
  const eventMs = normalizeTimestampToMs(messageTimestamp);
  const elapsed = Math.max(0, now - eventMs);
  return Number((elapsed / (60 * 60 * 1000)).toFixed(2));
}

// =============================================================================
// 2. Account Isolation Rules
// =============================================================================

export const PILOT_ACCOUNT_ID: AccountId = 'drmustafa_hadi';
export const CLINIC_ACCOUNT_ID: AccountId = 'almeswaksmile_iq';

/**
 * Resolves an incoming Instagram user/page ID or handle to an AccountId.
 * Strictly isolates the clinic account @almeswaksmile.iq from live messaging.
 */
export function resolveTargetAccount(recipientId?: string): {
  accountId: AccountId;
  isPilot: boolean;
  isClinic: boolean;
  isLiveAllowed: boolean;
} {
  const clinicId = process.env.ALMESWAK_CLINIC_INSTAGRAM_USER_ID || '17841400000000001';

  if (recipientId === clinicId || recipientId === 'almeswaksmile_iq' || recipientId?.includes('almeswak')) {
    return {
      accountId: CLINIC_ACCOUNT_ID,
      isPilot: false,
      isClinic: true,
      isLiveAllowed: false, // CLINIC IS LOCKED IN DEMO MODE
    };
  }

  // Default to Dr. Mustafa Hadi pilot account
  return {
    accountId: PILOT_ACCOUNT_ID,
    isPilot: true,
    isClinic: false,
    isLiveAllowed: true, // Personal pilot account is active
  };
}

// =============================================================================
// 3. Human Takeover State Tracker
// =============================================================================

export class HumanTakeoverTracker {
  private takeoverMap: Map<string, { handoffAt: number; reason: string }>;

  constructor() {
    this.takeoverMap = new Map();
  }

  public setTakeover(senderId: string, reason: string, now: number = Date.now()): void {
    if (senderId) {
      this.takeoverMap.set(senderId, { handoffAt: now, reason });
    }
  }

  public isTakeoverActive(senderId: string): boolean {
    return this.takeoverMap.has(senderId);
  }

  public getTakeoverReason(senderId: string): string | undefined {
    return this.takeoverMap.get(senderId)?.reason;
  }

  public releaseTakeover(senderId: string): void {
    this.takeoverMap.delete(senderId);
  }

  public clear(): void {
    this.takeoverMap.clear();
  }
}

export const globalHumanTakeoverTracker = new HumanTakeoverTracker();

