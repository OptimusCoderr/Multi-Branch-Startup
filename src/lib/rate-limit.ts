import "server-only";

/**
 * In-memory sliding-window-ish rate limiter (fixed windows). This is
 * correct and effective for a single Node.js process — e.g. this app
 * self-hosted, or any deployment target with one long-lived server
 * instance — but does NOT share state across multiple serverless
 * instances (Vercel functions, multiple containers). A production
 * deployment on serverless infrastructure needs a shared store (Upstash
 * Redis is the common choice) behind this same interface; swapping the
 * implementation here is the only change required, since every call site
 * only depends on checkRateLimit()'s signature, not how it's backed.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

// Prevents unbounded memory growth from one-off keys (e.g. per-IP) that
// are never checked again — a cheap periodic sweep of expired entries.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  },
  5 * 60 * 1000,
).unref();

export class RateLimitError extends Error {
  constructor(retryAfterSeconds: number) {
    super(`Too many requests. Try again in ${retryAfterSeconds}s.`);
    this.name = "RateLimitError";
  }
}

/**
 * Throws RateLimitError if `key` has exceeded `max` calls within the
 * current `windowMs` window. Call at the top of a sensitive Server Action,
 * after the permission check (so an unauthorized caller gets a 403, not a
 * rate-limit message that confirms the endpoint exists and is reachable).
 */
export function checkRateLimit(key: string, options: { max: number; windowMs: number }): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  if (bucket.count >= options.max) {
    throw new RateLimitError(Math.ceil((bucket.resetAt - now) / 1000));
  }

  bucket.count += 1;
}
