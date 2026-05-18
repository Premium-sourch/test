/**
 * In-memory sliding-window rate limiter.
 * No Redis, no external packages — just a Map.
 *
 * Tracks an array of request timestamps per API key ID.
 * On each check, timestamps older than 1 hour are pruned.
 */

const rateLimitMap = new Map();

/**
 * Check whether a request is allowed under the rate limit.
 * @param {string} keyId — the API key id (not the key itself)
 * @param {number} limit — max requests per hour
 * @returns {{ allowed: boolean, remaining: number, resetAt: number|null }}
 */
export function checkRateLimit(keyId, limit) {
  const now = Date.now();
  const oneHourAgo = now - 3600000;

  let timestamps = rateLimitMap.get(keyId) || [];

  // Prune old entries
  timestamps = timestamps.filter((t) => t > oneHourAgo);

  if (timestamps.length >= limit) {
    rateLimitMap.set(keyId, timestamps);
    return {
      allowed: false,
      remaining: 0,
      resetAt: timestamps[0] + 3600000,
    };
  }

  timestamps.push(now);
  rateLimitMap.set(keyId, timestamps);

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetAt: null,
  };
}

/**
 * Remove stale entries every 30 minutes to prevent memory leaks.
 */
const CLEANUP_INTERVAL = 30 * 60 * 1000;
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [keyId, timestamps] of rateLimitMap) {
    const filtered = timestamps.filter((t) => t > oneHourAgo);
    if (filtered.length === 0) {
      rateLimitMap.delete(keyId);
    } else {
      rateLimitMap.set(keyId, filtered);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Express middleware that enforces the per-key rate limit.
 * Must be used AFTER apiKeyAuthenticate (so req.apiKey exists).
 */
export function rateLimitMiddleware(req, res, next) {
  if (!req.apiKey) {
    return next();
  }

  const { allowed, remaining, resetAt } = checkRateLimit(
    req.apiKey.id,
    req.apiKey.rateLimit || 100
  );

  res.set('X-RateLimit-Remaining', String(remaining));

  if (!allowed) {
    res.set('Retry-After', String(Math.ceil((resetAt - Date.now()) / 1000)));
    return res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMITED',
      retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
    });
  }

  next();
}
