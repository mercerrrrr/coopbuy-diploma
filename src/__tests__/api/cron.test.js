import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const { mockAutoClose } = vi.hoisted(() => ({
  mockAutoClose: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/procurements/autoCloseExpired", () => ({
  autoCloseExpiredProcurements: mockAutoClose,
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { GET } from "@/app/api/cron/auto-close/route";

function makeRequest(authHeader) {
  return {
    headers: {
      get: (name) => (name.toLowerCase() === "authorization" ? authHeader : null),
    },
  };
}

const originalSecret = process.env.CRON_SECRET;

describe("GET /api/cron/auto-close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest("Bearer whatever"));
    expect(res.status).toBe(500);
    expect(mockAutoClose).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(401);
    expect(mockAutoClose).not.toHaveBeenCalled();
  });

  it("returns 401 when bearer token mismatches", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(mockAutoClose).not.toHaveBeenCalled();
  });

  it("returns ok with closed count on success", async () => {
    mockAutoClose.mockResolvedValue(3);
    const res = await GET(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, closed: 3 });
    expect(mockAutoClose).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on internal failure", async () => {
    mockAutoClose.mockRejectedValue(new Error("boom"));
    const res = await GET(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(500);
  });
});
