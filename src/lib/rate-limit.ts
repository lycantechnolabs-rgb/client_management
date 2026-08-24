/**
 * Fixed-window rate limiter.
 *
 * Backed by Upstash Redis when it is configured, and by an in-process Map when
 * it is not. The in-process path only ever protected one server instance: on
 * Vercel every serverless instance keeps its own counter, so an attacker
 * spreading requests across instances multiplies their allowance by however
 * many instances happen to be warm. That is the hole this closes.
 *
 * Upstash rather than a TCP client (ioredis, node-redis) on purpose: it speaks
 * HTTP, so there is no connection pool to exhaust when a few hundred lambdas
 * spin up at once, which is exactly the situation a login flood creates.
 *
 * Configure with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. With
 * neither set the limiter falls back to memory and says so once at startup.
 */
import { Redis } from "@upstash/redis";

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

// Stop the Map growing without bound on a long-lived server.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  /** Which store answered. Surfaced so the security suite can assert on it. */
  backend: "redis" | "memory";
};

/* -------------------------------------------------------------------------- */
/* Redis                                                                       */
/* -------------------------------------------------------------------------- */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Fail fast, deliberately.
 *
 * The client's default retry policy is five attempts with exponential backoff,
 * which adds up to roughly eleven seconds before it gives up. On the login path
 * that is the wrong trade twice over: every sign-in would hang for eleven
 * seconds during a Redis outage, and the in-process fallback would see each
 * attempt so far apart that its own window had already expired between them —
 * so it counted every request as the first and never enforced anything.
 *
 * One quick retry, then take the local counter.
 */
const REDIS_TIMEOUT_MS = 1000;

const redis =
  url && token
    ? new Redis({
        url,
        token,
        enableAutoPipelining: false,
        retry: { retries: 1, backoff: () => 50 },
      })
    : null;

/** Bounds total latency regardless of what the client does internally. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`redis timeout after ${ms}ms`)), ms),
    ),
  ]);
}

let warnedNoRedis = false;
let warnedRedisDown = false;

/**
 * INCR then PEXPIRE, as one script.
 *
 * It has to be atomic. Done as two round trips, a process that dies between
 * them leaves a key with no TTL — a counter that never resets, which locks the
 * account out permanently. Setting the TTL only when the counter comes back as
 * 1 keeps it a fixed window rather than a sliding one that never expires under
 * sustained load.
 */
const WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`;

function memoryLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: 0,
      backend: "memory",
    };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;

  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
    backend: "memory",
  };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (!redis) {
    if (!warnedNoRedis && process.env.NODE_ENV === "production") {
      warnedNoRedis = true;
      console.warn(
        "[rate-limit] No UPSTASH_REDIS_REST_URL/TOKEN — falling back to " +
          "in-process counters. On more than one instance this does not hold.",
      );
    }
    return memoryLimit(key, limit, windowMs);
  }

  try {
    const [count, pttl] = (await withTimeout(
      redis.eval(WINDOW_SCRIPT, [key], [windowMs]),
      REDIS_TIMEOUT_MS,
    )) as [number, number];

    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      // PTTL returns -1 when a key somehow has no expiry; fall back to the
      // nominal window rather than reporting a negative retry-after.
      retryAfterSeconds: allowed ? 0 : Math.ceil((pttl > 0 ? pttl : windowMs) / 1000),
      backend: "redis",
    };
  } catch (error) {
    // Degrade to the local counter rather than failing open or closed.
    //
    // Failing open would drop brute-force protection for the length of a Redis
    // outage. Failing closed would lock every grower out of their own portal
    // because a cache is down — an availability incident caused by a
    // dependency that is not on the critical path. The local counter is weaker
    // than the shared one but far better than either extreme, and it is loud.
    if (!warnedRedisDown) {
      warnedRedisDown = true;
      console.error(
        "[rate-limit] Redis unavailable, degrading to in-process counters:",
        error instanceof Error ? error.message : error,
      );
    }
    return memoryLimit(key, limit, windowMs);
  }
}

/** True when a shared store is configured. Used by the security suite. */
export function rateLimitBackend(): "redis" | "memory" {
  return redis ? "redis" : "memory";
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
