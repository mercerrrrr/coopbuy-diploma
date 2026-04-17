import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

// ── Hoisted mocks (created before any module is imported) ──────────────────
const { mockCookieStore, mockCookies, mockJwtVerify, MockSignJWT, mockPrisma } = vi.hoisted(() => {
  const mockCookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
  const mockCookies = vi.fn().mockResolvedValue(mockCookieStore);
  const mockJwtVerify = vi.fn();
  // SignJWT — class with fluent builder API ending in .sign()
  // Use regular function so `new SignJWT()` correctly sets `this` (Vitest v4 compat).
  const MockSignJWT = vi.fn().mockImplementation(function () {
    this.setProtectedHeader = vi.fn().mockReturnThis();
    this.setIssuedAt = vi.fn().mockReturnThis();
    this.setExpirationTime = vi.fn().mockReturnThis();
    this.sign = vi.fn().mockResolvedValue("mock.signed.jwt");
  });
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockCookieStore, mockCookies, mockJwtVerify, MockSignJWT, mockPrisma };
});

vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("jose", () => ({ SignJWT: MockSignJWT, jwtVerify: mockJwtVerify }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
// React.cache() memoizes per-request; in tests each `vi.clearAllMocks` would
// not reset the cache, so opt out by stubbing cache to identity.
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...actual, cache: (fn) => fn };
});

import { getSession, setSessionCookie, invalidateAllSessions } from "@/lib/auth";

const originalAuthSecret = process.env.AUTH_SECRET;

// ── Helpers ─────────────────────────────────────────────────────────────────
function noCookie() {
  mockCookieStore.get.mockReturnValue(undefined);
}
function withCookieValue(val) {
  mockCookieStore.get.mockReturnValue({ value: val });
}

describe("getSession()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-auth-secret";
  });

  it("возвращает null если cookie отсутствует", async () => {
    noCookie();
    const session = await getSession();
    expect(session).toBeNull();
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it("возвращает null при невалидном JWT (jwtVerify бросает)", async () => {
    withCookieValue("invalid.token");
    mockJwtVerify.mockRejectedValue(new Error("invalid signature"));
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("возвращает payload при валидном JWT и совпадающем tokenVersion", async () => {
    const payload = { email: "user@test.com", role: "ADMIN", sub: "u1", tv: 3 };
    withCookieValue("valid.token");
    mockJwtVerify.mockResolvedValue({ payload });
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 3 });
    const session = await getSession();
    expect(session).toEqual(payload);
  });

  it("отклоняет токен, если tokenVersion устарел (logout делал инкремент)", async () => {
    const payload = { email: "user@test.com", role: "ADMIN", sub: "u1", tv: 2 };
    withCookieValue("valid.token");
    mockJwtVerify.mockResolvedValue({ payload });
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 3 });
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("возвращает null если пользователь удалён", async () => {
    const payload = { email: "user@test.com", role: "ADMIN", sub: "u1", tv: 0 };
    withCookieValue("valid.token");
    mockJwtVerify.mockResolvedValue({ payload });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("читает cookie с ключом cb_session", async () => {
    noCookie();
    await getSession();
    expect(mockCookieStore.get).toHaveBeenCalledWith("cb_session");
  });
});

describe("setSessionCookie()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-auth-secret";
  });

  it("вызывает cookies().set с httpOnly: true и sameSite: 'lax'", async () => {
    await setSessionCookie({ email: "admin@test.com", role: "ADMIN", tv: 0 });
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "cb_session",
      "mock.signed.jwt",
      expect.objectContaining({ httpOnly: true, sameSite: "lax" })
    );
  });

  it("устанавливает maxAge на 7 дней (604800 секунд)", async () => {
    await setSessionCookie({ email: "u@u.com", role: "RESIDENT", tv: 0 });
    const [, , opts] = mockCookieStore.set.mock.calls[0];
    expect(opts.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it("устанавливает path: '/'", async () => {
    await setSessionCookie({ email: "u@u.com", role: "RESIDENT", tv: 0 });
    const [, , opts] = mockCookieStore.set.mock.calls[0];
    expect(opts.path).toBe("/");
  });

  it("подписывает токен через SignJWT", async () => {
    await setSessionCookie({ email: "u@u.com", role: "OPERATOR", tv: 0 });
    expect(MockSignJWT).toHaveBeenCalled();
  });
});

describe("invalidateAllSessions()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-auth-secret";
  });

  it("инкрементит tokenVersion в БД и возвращает новое значение", async () => {
    mockPrisma.user.update.mockResolvedValue({ tokenVersion: 5 });
    const result = await invalidateAllSessions("u1");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
    expect(result).toBe(5);
  });
});

afterAll(() => {
  if (originalAuthSecret === undefined) {
    delete process.env.AUTH_SECRET;
    return;
  }

  process.env.AUTH_SECRET = originalAuthSecret;
});
