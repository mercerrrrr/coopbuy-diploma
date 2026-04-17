/**
 * Rate limiter — DB-backed (default) or in-memory (fallback).
 *
 * Default backend is Postgres (RateLimitBucket table), which survives
 * process restart and works across multiple instances. Set
 * RATE_LIMIT_BACKEND=memory for tests / single-process dev where DB
 * round-trips are undesirable.
 */

import { prisma } from "@/lib/db";

const USE_MEMORY = process.env.RATE_LIMIT_BACKEND === "memory";

// ── In-memory backend ───────────────────────────────────────────────────────
/** @type {Map<string, {count: number, resetAt: number}>} */
const memoryStore = new Map();

// Evict expired entries every 10 minutes to cap memory.
if (USE_MEMORY) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (now > entry.resetAt) memoryStore.delete(key);
    }
  }, 10 * 60 * 1000);
}

function memoryIsLimited(key, maxAttempts, windowMs) {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= maxAttempts) return true;
  entry.count += 1;
  return false;
}

function memoryReset(key) {
  memoryStore.delete(key);
}

// ── DB backend ──────────────────────────────────────────────────────────────
async function dbIsLimited(key, maxAttempts, windowMs) {
  const now = new Date();
  const windowFloor = new Date(now.getTime() - windowMs);

  return prisma.$transaction(async (tx) => {
    const bucket = await tx.rateLimitBucket.findUnique({ where: { key } });

    // Expired or missing bucket → start a fresh window.
    if (!bucket || bucket.windowStart < windowFloor) {
      await tx.rateLimitBucket.upsert({
        where: { key },
        update: { count: 1, windowStart: now },
        create: { key, count: 1, windowStart: now },
      });
      return false;
    }

    if (bucket.count >= maxAttempts) return true;

    await tx.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return false;
  });
}

async function dbReset(key) {
  try {
    await prisma.rateLimitBucket.delete({ where: { key } });
  } catch {
    // Row may not exist — that's a valid reset state, swallow.
  }
}

// ── Public API ──────────────────────────────────────────────────────────────
/**
 * Check and increment the counter for a key.
 * Resolves to true if the limit is exceeded (request should be rejected).
 *
 * @param {string} key         Unique key, e.g. `login:127.0.0.1:user@example.com`
 * @param {number} maxAttempts Max allowed attempts in the window (default 5)
 * @param {number} windowMs    Window in milliseconds (default 5 min)
 * @returns {Promise<boolean>}
 */
export async function isLimited(key, maxAttempts = 5, windowMs = 5 * 60 * 1000) {
  if (USE_MEMORY) return memoryIsLimited(key, maxAttempts, windowMs);
  return dbIsLimited(key, maxAttempts, windowMs);
}

/**
 * Reset the counter for a key (call after successful auth to clear penalties).
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function resetRateLimit(key) {
  if (USE_MEMORY) return memoryReset(key);
  return dbReset(key);
}
