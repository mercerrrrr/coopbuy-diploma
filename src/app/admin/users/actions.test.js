import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAssertAdmin, mockHash, mockPrisma, mockRevalidatePath } = vi.hoisted(() => ({
  mockAssertAdmin: vi.fn(),
  mockHash: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    pickupPoint: {
      findUnique: vi.fn(),
    },
    settlement: {
      findUnique: vi.fn(),
    },
  },
  mockRevalidatePath: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  hash: mockHash,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/guards", () => ({
  assertAdmin: mockAssertAdmin,
}));

import { createOperator, createResident } from "./actions";

function formData(entries) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

describe("admin users actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertAdmin.mockResolvedValue({ role: "ADMIN" });
    mockHash.mockResolvedValue("hashed-password");
  });

  it("возвращает inline-ошибку для дублирующегося email оператора", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    mockPrisma.pickupPoint.findUnique.mockResolvedValue({
      id: "pickup-1",
      name: "ПВЗ Центральный",
      settlementId: "settlement-1",
      settlement: { name: "Солнечное" },
    });

    const result = await createOperator(
      null,
      formData({
        email: "operator@example.test",
        password: "Operator123!",
        fullName: "Оператор Тестовый",
        pickupPointId: "pickup-1",
      })
    );

    expect(result).toEqual({
      ok: false,
      message: "Не удалось создать оператора.",
      fieldErrors: {
        email: "Пользователь с таким email уже существует.",
      },
    });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("создаёт жителя с settlementId и телефоном", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.settlement.findUnique.mockResolvedValue({
      id: "settlement-1",
      name: "Солнечное",
      region: { name: "Астраханская область" },
    });

    const result = await createResident(
      null,
      formData({
        email: "resident@example.test",
        password: "Resident123!",
        fullName: "Житель Тестовый",
        settlementId: "settlement-1",
        phone: "+79001234567",
      })
    );

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "resident@example.test",
        passwordHash: "hashed-password",
        fullName: "Житель Тестовый",
        phone: "+79001234567",
        role: "RESIDENT",
        settlementId: "settlement-1",
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
    expect(result).toEqual({
      ok: true,
      message: "Житель создан для населённого пункта «Солнечное».",
      fieldErrors: {},
    });
  });
});
