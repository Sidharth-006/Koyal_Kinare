import { AppError } from '@/shared/errors';

export class RateLimitExceededError extends AppError {
  constructor(message: string = 'Too many requests. Please try again later.') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Clean up stale rate limit entries periodically (every 5 minutes)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < 300000);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 300000).unref();

/**
 * Checks and records rate limit for a specific key.
 * Throws RateLimitExceededError (HTTP 429) if exceeded.
 *
 * @param key Unique identifier (e.g., `admin_${adminId}:session_revoke`)
 * @param limit Maximum allowed attempts within window
 * @param windowMs Time window in milliseconds (default: 60,000ms = 1 min)
 */
export function checkRateLimit(key: string, limit: number = 30, windowMs: number = 60000): void {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter timestamps within window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    throw new RateLimitExceededError();
  }

  record.timestamps.push(now);
}

/**
 * Clears rate limit store (useful for automated testing)
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
