import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHeaders,
  mockIsLimited,
  mockMergeGuestDraftOrdersIntoUser,
  mockPrisma,
  mockRedirect,
  mockRevalidatePath,
  mockSetSessionCookie,
} = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockIsLimited: vi.fn(),
  mockMergeGuestDraftOrdersIntoUser: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  mockRedirect: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockSetSessionCookie: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  setSessionCookie: mockSetSessionCookie,
}));

vi.mock("@/lib/guestCart", () => ({
  mergeGuestDraftOrdersIntoUser: mockMergeGuestDraftOrdersIntoUser,
}));

vi.mock("@/lib/rateLimit", () => ({
  isLimited: mockIsLimited,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { register } from "./actions";

function formData(entries) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

describe("register()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
    });
    mockIsLimited.mockReturnValue(false);
  });

  it("возвращает человекочитаемую ошибку при дублирующемся email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });

    const result = await register(
      null,
      formData({
        email: "resident@example.test",
        password: "Resident123!",
        fullName: "Иван Иванов",
        settlementId: "settlement-1",
        phone: "+79001234567",
      })
    );

    expect(result).toEqual({ error: "Этот email уже зарегистрирован." });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockSetSessionCookie).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
