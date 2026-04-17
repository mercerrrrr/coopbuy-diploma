import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockJwtVerify } = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: mockJwtVerify,
}));

import { proxy } from "@/proxy";

function makeRequest(pathname, { token } = {}) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    nextUrl: Object.assign(url, {
      clone() {
        return new URL(url.toString());
      },
    }),
    cookies: {
      get(name) {
        if (name === "cb_session" && token) return { value: token };
        return undefined;
      },
    },
  };
}

function setRole(role) {
  mockJwtVerify.mockResolvedValue({ payload: { role } });
}

describe("proxy() RBAC middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret-key-for-middleware-tests";
  });

  describe("/admin/*", () => {
    it("гость → /admin/procurements → 302 на /auth/login", async () => {
      const res = await proxy(makeRequest("/admin/procurements"));
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/auth/login");
      expect(location).toContain("next=%2Fadmin%2Fprocurements");
    });

    it("RESIDENT → /admin/procurements → 302 на /403", async () => {
      setRole("RESIDENT");
      const res = await proxy(makeRequest("/admin/procurements", { token: "tok" }));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/403");
    });

    it("OPERATOR → /admin/procurements → pass", async () => {
      setRole("OPERATOR");
      const res = await proxy(makeRequest("/admin/procurements", { token: "tok" }));
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("OPERATOR → /admin/dictionaries → pass", async () => {
      setRole("OPERATOR");
      const res = await proxy(makeRequest("/admin/dictionaries", { token: "tok" }));
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("ADMIN → /admin/procurements → pass", async () => {
      setRole("ADMIN");
      const res = await proxy(makeRequest("/admin/procurements", { token: "tok" }));
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("ADMIN → /admin/dictionaries → pass", async () => {
      setRole("ADMIN");
      const res = await proxy(makeRequest("/admin/dictionaries", { token: "tok" }));
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("невалидный токен → /admin/* → редирект на /auth/login", async () => {
      mockJwtVerify.mockRejectedValue(new Error("bad signature"));
      const res = await proxy(makeRequest("/admin/procurements", { token: "bad" }));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/auth/login");
    });
  });

  describe("/my/*", () => {
    it("гость → /my/procurements → 302 на /auth/login", async () => {
      const res = await proxy(makeRequest("/my/procurements"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/auth/login");
    });

    it("RESIDENT → /my/procurements → pass", async () => {
      setRole("RESIDENT");
      const res = await proxy(makeRequest("/my/procurements", { token: "tok" }));
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("ADMIN → /my/procurements → 302 на /403", async () => {
      setRole("ADMIN");
      const res = await proxy(makeRequest("/my/procurements", { token: "tok" }));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/403");
    });

    it("OPERATOR → /my/procurements → 302 на /403", async () => {
      setRole("OPERATOR");
      const res = await proxy(makeRequest("/my/procurements", { token: "tok" }));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/403");
    });
  });
});
