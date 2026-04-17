import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const { mockPrisma, mockWriteOrderAudit, mockCreateNotification } = vi.hoisted(() => ({
  mockPrisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockWriteOrderAudit: vi.fn(),
  mockCreateNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ writeOrderAudit: mockWriteOrderAudit }));
vi.mock("@/lib/notifications", () => ({ createNotification: mockCreateNotification }));
vi.mock("@/lib/constants", () => ({
  PAYMENT_LABELS: {
    UNPAID: "Не оплачено",
    PAID: "Оплачено",
    PAY_ON_PICKUP: "Оплата при выдаче",
    PENDING: "Ожидание оплаты",
    FAILED: "Оплата не прошла",
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { POST } from "@/app/api/webhooks/yookassa/route";

const originalSkipIp = process.env.YOOKASSA_SKIP_IP_CHECK;

function makeRequest(body, ip = "185.71.76.1") {
  return new Request("http://localhost/api/webhooks/yookassa", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

function successBody(orderId = "order-1", paymentId = "yk-pay-1") {
  return {
    event: "payment.succeeded",
    object: { id: paymentId, metadata: { orderId } },
  };
}

function cancelBody(orderId = "order-1", paymentId = "yk-pay-1") {
  return {
    event: "payment.canceled",
    object: { id: paymentId, metadata: { orderId } },
  };
}

describe("POST /api/webhooks/yookassa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.YOOKASSA_SKIP_IP_CHECK = "true";
  });

  afterEach(() => {
    process.env.YOOKASSA_SKIP_IP_CHECK = originalSkipIp;
  });

  // ── IP whitelist ──────────────────────────────────────────

  it("отклоняет запрос с неизвестного IP (403)", async () => {
    process.env.YOOKASSA_SKIP_IP_CHECK = "false";
    const res = await POST(makeRequest(successBody(), "1.2.3.4"));
    expect(res.status).toBe(403);
    expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("пропускает запрос с IP из whitelist ЮKassa", async () => {
    process.env.YOOKASSA_SKIP_IP_CHECK = "false";
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      paymentStatus: "PENDING",
      userId: "user-1",
      procurementId: "proc-1",
    });
    mockPrisma.order.update.mockResolvedValue({});

    const res = await POST(makeRequest(successBody(), "185.71.76.10"));
    expect(res.status).toBe(200);
  });

  it("пропускает запрос с IP 77.75.153.50 (входит в /25)", async () => {
    process.env.YOOKASSA_SKIP_IP_CHECK = "false";
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      paymentStatus: "PENDING",
      userId: "user-1",
      procurementId: "proc-1",
    });
    mockPrisma.order.update.mockResolvedValue({});

    const res = await POST(makeRequest(successBody(), "77.75.153.50"));
    expect(res.status).toBe(200);
  });

  // ── Validation ────────────────────────────────────────────

  it("возвращает 400 при отсутствии обязательных полей", async () => {
    const res = await POST(makeRequest({ event: "payment.succeeded", object: {} }));
    expect(res.status).toBe(400);
  });

  it("возвращает 400 при невалидном JSON", async () => {
    const req = new Request("http://localhost/api/webhooks/yookassa", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "1.1.1.1" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── payment.succeeded ─────────────────────────────────────

  it("обновляет статус PENDING -> PAID при payment.succeeded", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      paymentStatus: "PENDING",
      userId: "user-1",
      procurementId: "proc-1",
    });
    mockPrisma.order.update.mockResolvedValue({});

    const res = await POST(makeRequest(successBody()));
    expect(res.status).toBe(200);

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: {
        paymentStatus: "PAID",
        paidAt: expect.any(Date),
        paymentMethod: "ЮKassa онлайн",
        yookassaPaymentId: "yk-pay-1",
      },
    });

    expect(mockWriteOrderAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ONLINE_PAYMENT_SUCCEEDED",
        orderId: "order-1",
      }),
    );

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "PAYMENT_STATUS_CHANGED",
        title: "Оплата прошла успешно",
      }),
    );
  });

  it("идемпотентен — пропускает если уже PAID", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      paymentStatus: "PAID",
      userId: "user-1",
      procurementId: "proc-1",
    });

    const res = await POST(makeRequest(successBody()));
    expect(res.status).toBe(200);
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
    expect(mockWriteOrderAudit).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("возвращает 200 если заказ не найден (не провоцирует retry)", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(successBody("nonexistent")));
    expect(res.status).toBe(200);
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  // ── payment.canceled ──────────────────────────────────────

  it("обновляет статус PENDING -> FAILED при payment.canceled", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      paymentStatus: "PENDING",
      userId: "user-1",
      procurementId: "proc-1",
    });
    mockPrisma.order.update.mockResolvedValue({});

    const res = await POST(makeRequest(cancelBody()));
    expect(res.status).toBe(200);

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { paymentStatus: "FAILED" },
    });

    expect(mockWriteOrderAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ONLINE_PAYMENT_FAILED",
        orderId: "order-1",
      }),
    );

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        title: "Оплата не прошла",
      }),
    );
  });

  it("не перезаписывает PAID при payment.canceled (идемпотентность)", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      paymentStatus: "PAID",
      userId: "user-1",
      procurementId: "proc-1",
    });

    const res = await POST(makeRequest(cancelBody()));
    expect(res.status).toBe(200);
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it("не дублирует FAILED при повторном payment.canceled", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      paymentStatus: "FAILED",
      userId: "user-1",
      procurementId: "proc-1",
    });

    const res = await POST(makeRequest(cancelBody()));
    expect(res.status).toBe(200);
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  // ── Unknown events ────────────────────────────────────────

  it("возвращает 200 для неизвестного события", async () => {
    const body = {
      event: "refund.succeeded",
      object: { id: "ref-1", metadata: { orderId: "order-1" } },
    };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();
  });

  // ── Error handling ────────────────────────────────────────

  it("возвращает 500 при ошибке БД (YooKassa повторит)", async () => {
    mockPrisma.order.findUnique.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest(successBody()));
    expect(res.status).toBe(500);
  });
});
