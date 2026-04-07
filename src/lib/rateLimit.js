/**
 * Minimal in-memory rate limiter (Map-based, no Redis).
 * Suitable for dev/single-process deployments.
 */

/** @type {Map<string, {count: number, resetAt: number}>} */
const store = new Map();

// Periodically evict expired entries to prevent unbounded memory growth.
// Runs every 10 minutes; harmless in serverless (timer won't persist).
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000);

/**
 * Check and increment the counter for a key.
 * Returns true if the limit is exceeded (request should be rejected).
 *
 * @param {string} key       - Unique key, e.g. `login:127.0.0.1:user@example.com`
 * @param {number} maxAttempts - Max allowed attempts in the window (default 5)
 * @param {number} windowMs  - Window in milliseconds (default 5 min)
 */
export function isLimited(key, maxAttempts = 5, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= maxAttempts) {
    return true;
  }

  entry.count += 1;
  return false;
}

/**
 * Reset the counter for a key (call after successful auth to clear penalties).
 * @param {string} key
 */
export function resetRateLimit(key) {
  store.delete(key);
}
