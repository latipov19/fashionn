/**
 * Fixed-window rate limiter held in process memory. This is correct for one process, which
 * is what this deployment runs. Move it to shared storage before running more than one.
 */

export type RateLimitDecision = { allowed: boolean; remaining: number; retryAfterMs: number };

export type RateLimiter = {
  /** Counts one attempt and says whether it may proceed. */
  check: (key: string) => RateLimitDecision;
  /** Forgets a key, for example after a successful login. */
  clear: (key: string) => void;
  reset: () => void;
};

type Window = { count: number; resetAt: number };

const MAX_TRACKED_KEYS = 10_000;
const limiters: RateLimiter[] = [];

export function createRateLimiter(options: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const { limit, windowMs, now = Date.now } = options;
  const windows = new Map<string, Window>();

  function prune(time: number) {
    for (const [key, window] of windows) {
      if (window.resetAt <= time) windows.delete(key);
    }
    // A flood of distinct keys must not grow memory without bound.
    if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
  }

  const limiter: RateLimiter = {
    check(key) {
      const time = now();
      if (windows.size >= MAX_TRACKED_KEYS) prune(time);
      const current = windows.get(key);
      if (!current || current.resetAt <= time) {
        windows.set(key, { count: 1, resetAt: time + windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
      }
      current.count += 1;
      const allowed = current.count <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - current.count),
        retryAfterMs: allowed ? 0 : current.resetAt - time,
      };
    },
    clear: (key) => void windows.delete(key),
    reset: () => windows.clear(),
  };
  limiters.push(limiter);
  return limiter;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

/** Per address and email, so one visitor cannot lock the account for everyone. */
export const loginLimiter = createRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES });
/** Per email across all addresses, so rotating addresses does not buy more guesses. */
export const loginAccountLimiter = createRateLimiter({ limit: 20, windowMs: FIFTEEN_MINUTES });
/** The same two limits for shoppers, counted apart, so shopper traffic never locks the admin out. */
export const customerLoginLimiter = createRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES });
export const customerLoginAccountLimiter = createRateLimiter({ limit: 20, windowMs: FIFTEEN_MINUTES });
export const checkoutLimiter = createRateLimiter({ limit: 10, windowMs: ONE_MINUTE });
export const newsletterLimiter = createRateLimiter({ limit: 5, windowMs: ONE_MINUTE });

export function resetRateLimits(): void {
  for (const limiter of limiters) limiter.reset();
}
