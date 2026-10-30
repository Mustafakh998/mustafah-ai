/**
 * In-Memory Message Deduplicator with Time-To-Live (TTL)
 * Prevents re-processing of duplicate webhook deliveries sent by Meta.
 */
export class MessageDeduplicator {
  private processedIds: Map<string, number>;
  private ttlMs: number;
  private cleanupIntervalMs: number;
  private lastCleanup: number;

  constructor(ttlMs = 10 * 60 * 1000, cleanupIntervalMs = 60 * 1000) {
    this.processedIds = new Map();
    this.ttlMs = ttlMs;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.lastCleanup = Date.now();
  }

  /**
   * Checks if an ID has already been processed. If not, marks it as processed.
   * Returns true if it is a duplicate, false if it is new.
   */
  public isDuplicate(id: string, now: number = Date.now()): boolean {
    if (!id) return false;

    this.autoCleanup(now);

    const timestamp = this.processedIds.get(id);
    if (timestamp && now - timestamp < this.ttlMs) {
      return true;
    }

    this.processedIds.set(id, now);
    return false;
  }

  /**
   * Check without marking
   */
  public has(id: string, now: number = Date.now()): boolean {
    const timestamp = this.processedIds.get(id);
    return Boolean(timestamp && now - timestamp < this.ttlMs);
  }

  /**
   * Manually record an ID as processed
   */
  public mark(id: string, now: number = Date.now()): void {
    if (id) {
      this.processedIds.set(id, now);
    }
  }

  /**
   * Clear all records (useful for testing)
   */
  public clear(): void {
    this.processedIds.clear();
  }

  /**
   * Size of currently tracked records
   */
  public size(): number {
    return this.processedIds.size;
  }

  private autoCleanup(now: number): void {
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }

    this.lastCleanup = now;
    for (const [id, time] of this.processedIds.entries()) {
      if (now - time >= this.ttlMs) {
        this.processedIds.delete(id);
      }
    }
  }
}

// Global singleton instance for the server runtime
export const globalMessageDeduplicator = new MessageDeduplicator();
