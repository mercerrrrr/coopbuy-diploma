import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── DB backend mock ─────────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    rateLimitBucket: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (fn) => fn(mockPrisma)),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const MAX = 3;
const WINDOW = 60_000;

async function loadWithBackend(backend) {
  vi.resetModules();
  if (backend) {
    vi.stubEnv("RATE_LIMIT_BACKEND", backend);
  } else {
    vi.unstubAllEnvs();
  }
  return import("@/lib/rateLimit");
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

// ── Memory backend ──────────────────────────────────────────────────────────
describe("rateLimit — memory backend", () => {
  let isLimited, resetRateLimit;

  beforeEach(async () => {
    ({ isLimited, resetRateLimit } = await loadWithBackend("memory"));
  });

  it("первые N попыток проходят, N+1 блокируется", async () => {
    const key = "login:127.0.0.1:a@b.com";
    expect(await isLimited(key, MAX, WINDOW)).toBe(false);
    expect(await isLimited(key, MAX, WINDOW)).toBe(false);
    expect(await isLimited(key, MAX, WINDOW)).toBe(false);
    expect(await isLimited(key, MAX, WINDOW)).toBe(true);
  });

  it("resetRateLimit очищает счётчик", async () => {
    const key = "login:127.0.0.1:c@d.com";
    await isLimited(key, MAX, WINDOW);
    await isLimited(key, MAX, WINDOW);
    await isLimited(key, MAX, WINDOW);
    await resetRateLimit(key);
    expect(await isLimited(key, MAX, WINDOW)).toBe(false);
  });

  it("разные ключи не влияют друг на друга", async () => {
    const a = "login:1.1.1.1:x@x.com";
    const b = "login:2.2.2.2:y@y.com";
    await isLimited(a, MAX, WINDOW);
    await isLimited(a, MAX, WINDOW);
    await isLimited(a, MAX, WINDOW);
    expect(await isLimited(a, MAX, WINDOW)).toBe(true);
    expect(await isLimited(b, MAX, WINDOW)).toBe(false);
  });
});

// ── DB backend ──────────────────────────────────────────────────────────────
describe("rateLimit — DB backend", () => {
  let isLimited, resetRateLimit;

  beforeEach(async () => {
    ({ isLimited, resetRateLimit } = await loadWithBackend(undefined));
  });

  it("создаёт bucket через upsert на первой попытке", async () => {
    mockPrisma.rateLimitBucket.findUnique.mockResolvedValue(null);
    const result = await isLimited("db:k1", MAX, WINDOW);
    expect(result).toBe(false);
    expect(mockPrisma.rateLimitBucket.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "db:k1" },
        create: expect.objectContaining({ key: "db:k1", count: 1 }),
      })
    );
  });

  it("инкрементит count если bucket внутри окна", async () => {
    mockPrisma.rateLimitBucket.findUnique.mockResolvedValue({
      key: "db:k2",
      count: 1,
      windowStart: new Date(),
    });
    const result = await isLimited("db:k2", MAX, WINDOW);
    expect(result).toBe(false);
    expect(mockPrisma.rateLimitBucket.update).toHaveBeenCalledWith({
      where: { key: "db:k2" },
      data: { count: { increment: 1 } },
    });
  });

  it("блокирует когда count >= maxAttempts", async () => {
    mockPrisma.rateLimitBucket.findUnique.mockResolvedValue({
      key: "db:k3",
      count: MAX,
      windowStart: new Date(),
    });
    const result = await isLimited("db:k3", MAX, WINDOW);
    expect(result).toBe(true);
    expect(mockPrisma.rateLimitBucket.update).not.toHaveBeenCalled();
  });

  it("обновляет windowStart когда прежнее окно истекло", async () => {
    mockPrisma.rateLimitBucket.findUnique.mockResolvedValue({
      key: "db:k4",
      count: MAX,
      windowStart: new Date(Date.now() - WINDOW * 2),
    });
    const result = await isLimited("db:k4", MAX, WINDOW);
    expect(result).toBe(false);
    expect(mockPrisma.rateLimitBucket.upsert).toHaveBeenCalled();
    expect(mockPrisma.rateLimitBucket.update).not.toHaveBeenCalled();
  });

  it("resetRateLimit удаляет запись и проглатывает ошибку отсутствия", async () => {
    mockPrisma.rateLimitBucket.delete.mockRejectedValue(new Error("not found"));
    await expect(resetRateLimit("db:k5")).resolves.toBeUndefined();
    expect(mockPrisma.rateLimitBucket.delete).toHaveBeenCalledWith({ where: { key: "db:k5" } });
  });
});
