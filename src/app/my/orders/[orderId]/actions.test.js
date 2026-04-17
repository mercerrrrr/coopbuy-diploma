import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPrisma,
  mockAssertResident,
  mockPaymentsApi,
  mockWriteOrderAudit,
  mockRedirect,
} = vi.hoisted(() => ({
  mockPrisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockAssertResident: vi.fn(),
  mockPaymentsApi: { paymentsPost: vi.fn() },
  mockWriteOrderAudit: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/guards", () => ({ assertResident: mockAssertResident }));
vi.mock("@/lib/yookassa", () => ({ paymentsApi: mockPaymentsApi }));
vi.mock("@/lib/audit", () => ({ writeOrderAudit: mockWriteOrderAudit }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

import { createPayment } from "./actions";

function fd(entries) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

const SESSION = { sub: "user-1", role: "RESIDENT", email: "user@test.com" };

function baseOrder(overrides = {}) {
  return {
    id: "order-1",
    userId: "user-1",
    status: "SUBMITTED",
    paymentStatus: "UNPAID",
    goodsTotal: 14550,
    deliveryShare: 500,
    paymentAttempt: 0,
    procurementId: "proc-1",
    participantPhone: "+79991234567",
    procurement: { title: "Закупка овощей" },
    items: [
      { qty: 2, price: 5000, product: { name: "Помидоры" } },
      { qty: 1, price: 4550, product: { name: "Огурцы" } },
    ],
    ...overrides,
  };
}

describe("createPayment()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertResident.mockResolvedValue(SESSION);
  });

  it("создаёт платёж и редиректит на ЮKassa", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder());
    mockPaymentsApi.paymentsPost.mockResolvedValue({
      data: { id: "yk-pay-1", confirmation: { confirmation_url: "https://yookassa.ru/pay/123" } },
    });
    mockPrisma.order.update.mockResolvedValue({});

    await createPayment(fd({ orderId: "order-1" }));

    // Verify SDK call: paymentsPost(idempotenceKey, paymentData)
    expect(mockPaymentsApi.paymentsPost).toHaveBeenCalledOnce();
    const [idempotenceKey, paymentData] = mockPaymentsApi.paymentsPost.mock.calls[0];
    expect(idempotenceKey).toBe("order-order-1-1");
    expect(paymentData.amount).toEqual({ value: "14550.00", currency: "RUB" });
    expect(paymentData.capture).toBe(true);
    expect(paymentData.metadata).toEqual({ orderId: "order-1" });

    // Verify DB update
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: {
        yookassaPaymentId: "yk-pay-1",
        paymentStatus: "PENDING",
        paymentAttempt: 1,
      },
    });

    // Verify audit
    expect(mockWriteOrderAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ONLINE_PAYMENT_CREATED",
        orderId: "order-1",
        procurementId: "proc-1",
      }),
    );

    // Verify redirect
    expect(mockRedirect).toHaveBeenCalledWith("https://yookassa.ru/pay/123");
  });

  it("передаёт сумму в рублях корректно", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder({ goodsTotal: 100 }));
    mockPaymentsApi.paymentsPost.mockResolvedValue({
      data: { id: "yk-pay-2", confirmation: { confirmation_url: "https://yookassa.ru/pay/456" } },
    });
    mockPrisma.order.update.mockResolvedValue({});

    await createPayment(fd({ orderId: "order-1" }));

    const [, paymentData] = mockPaymentsApi.paymentsPost.mock.calls[0];
    expect(paymentData.amount.value).toBe("100.00");
  });

  it("инкрементирует paymentAttempt для idempotence key", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder({ paymentAttempt: 3 }));
    mockPaymentsApi.paymentsPost.mockResolvedValue({
      data: { id: "yk-pay-3", confirmation: { confirmation_url: "https://yookassa.ru/pay/789" } },
    });
    mockPrisma.order.update.mockResolvedValue({});

    await createPayment(fd({ orderId: "order-1" }));

    const [idempotenceKey] = mockPaymentsApi.paymentsPost.mock.calls[0];
    expect(idempotenceKey).toBe("order-order-1-4");
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentAttempt: 4 }) }),
    );
  });

  it("передаёт receipt только с товарами, без доставки (54-ФЗ)", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder());
    mockPaymentsApi.paymentsPost.mockResolvedValue({
      data: { id: "yk-pay-r", confirmation: { confirmation_url: "https://yookassa.ru/pay/r" } },
    });
    mockPrisma.order.update.mockResolvedValue({});

    await createPayment(fd({ orderId: "order-1" }));

    const [, paymentData] = mockPaymentsApi.paymentsPost.mock.calls[0];
    expect(paymentData.receipt).toBeDefined();
    expect(paymentData.receipt.customer).toEqual({
      email: "user@test.com",
      phone: "+79991234567",
    });
    // Only goods — delivery is paid at pickup
    expect(paymentData.receipt.items).toHaveLength(2);
    expect(paymentData.receipt.items[0]).toEqual({
      description: "Помидоры",
      quantity: "2",
      amount: { value: "5000.00", currency: "RUB" },
      vat_code: 1,
      payment_subject: "commodity",
      payment_mode: "full_payment",
    });
    expect(paymentData.receipt.items.every((i) => i.description !== "Доставка")).toBe(true);
  });

  it("разрешает повтор оплаты при FAILED", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder({ paymentStatus: "FAILED" }));
    mockPaymentsApi.paymentsPost.mockResolvedValue({
      data: { id: "yk-pay-4", confirmation: { confirmation_url: "https://yookassa.ru/pay/retry" } },
    });
    mockPrisma.order.update.mockResolvedValue({});

    await createPayment(fd({ orderId: "order-1" }));

    expect(mockPaymentsApi.paymentsPost).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith("https://yookassa.ru/pay/retry");
  });

  it("отклоняет если заказ чужой", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder({ userId: "other-user" }));

    await expect(createPayment(fd({ orderId: "order-1" }))).rejects.toThrow("Заказ не найден.");
    expect(mockPaymentsApi.paymentsPost).not.toHaveBeenCalled();
  });

  it("отклоняет если заказ не SUBMITTED", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder({ status: "DRAFT" }));

    await expect(createPayment(fd({ orderId: "order-1" }))).rejects.toThrow("Заказ не в статусе оформления.");
  });

  it("отклоняет если paymentStatus = PENDING", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder({ paymentStatus: "PENDING" }));

    await expect(createPayment(fd({ orderId: "order-1" }))).rejects.toThrow("Оплата уже инициирована или завершена.");
  });

  it("отклоняет если paymentStatus = PAID", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder({ paymentStatus: "PAID" }));

    await expect(createPayment(fd({ orderId: "order-1" }))).rejects.toThrow("Оплата уже инициирована или завершена.");
  });

  it("отклоняет если goodsTotal <= 0", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder({ goodsTotal: 0 }));

    await expect(createPayment(fd({ orderId: "order-1" }))).rejects.toThrow("Сумма заказа должна быть больше нуля.");
  });

  it("бросает понятную ошибку при сбое SDK", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(baseOrder());
    mockPaymentsApi.paymentsPost.mockRejectedValue(new Error("network error"));

    await expect(createPayment(fd({ orderId: "order-1" }))).rejects.toThrow("Не удалось создать платёж. Попробуйте позже.");
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });
});
