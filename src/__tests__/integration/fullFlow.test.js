/**
 * Full-flow integration test (Option B).
 *
 * Requires a running Postgres and TEST_DATABASE_URL pointed at a migrated
 * test database. The entire suite is skipped when TEST_DATABASE_URL is not set
 * so `npm run test:unit` stays fast and DB-free.
 *
 * Run locally with:
 *   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/coopbuy_test \
 *   npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const shouldRun = Boolean(TEST_DATABASE_URL);

const { mockGetSession, mockRevalidatePath, mockRedirect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRedirect: vi.fn((url) => {
    const err = new Error(`REDIRECT:${url}`);
    err.url = url;
    throw err;
  }),
}));

vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

let prisma;
let addToCart;
let submitOrder;
let updatePaymentStatus;
let createPickupSession;
let checkinOrder;

let ctx;

function fd(entries) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

async function seedFixtures(prisma) {
  const prefix = `intg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const region = await prisma.region.create({
    data: { name: `${prefix}_region` },
  });
  const settlement = await prisma.settlement.create({
    data: { name: `${prefix}_settlement`, regionId: region.id },
  });
  const pickupPoint = await prisma.pickupPoint.create({
    data: {
      name: `${prefix}_pp`,
      address: "test address",
      settlementId: settlement.id,
    },
  });
  const category = await prisma.category.create({ data: { name: `${prefix}_cat` } });
  const unit = await prisma.unit.create({ data: { name: `${prefix}_unit` } });
  const supplier = await prisma.supplier.create({
    data: { name: `${prefix}_supplier` },
  });
  const product = await prisma.product.create({
    data: {
      name: `${prefix}_product`,
      categoryId: category.id,
      unitId: unit.id,
      supplierId: supplier.id,
      price: 150,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: `${prefix}_admin@local.test`,
      passwordHash: "x",
      fullName: "Test Admin",
      role: "ADMIN",
    },
  });
  const resident = await prisma.user.create({
    data: {
      email: `${prefix}_resident@local.test`,
      passwordHash: "x",
      fullName: "Test Resident",
      role: "RESIDENT",
      settlementId: settlement.id,
    },
  });

  const procurement = await prisma.procurement.create({
    data: {
      title: `${prefix}_procurement`,
      inviteCode: `${prefix}_code`,
      status: "OPEN",
      deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      minTotalSum: 0,
      supplierId: supplier.id,
      settlementId: settlement.id,
      pickupPointId: pickupPoint.id,
      deliveryFee: 300,
      deliverySplitMode: "EQUAL",
    },
  });

  return {
    prefix,
    region,
    settlement,
    pickupPoint,
    category,
    unit,
    supplier,
    product,
    admin,
    resident,
    procurement,
  };
}

async function cleanupFixtures(prisma, ctx) {
  if (!ctx) return;
  // Procurement cascades: Order → OrderItem, PickupSession → PickupCheckin.
  // AuditLog and Notification have no FKs to procurement and must be cleaned manually.
  const orders = await prisma.order.findMany({
    where: { procurementId: ctx.procurement.id },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);

  await prisma.notification.deleteMany({
    where: { userId: { in: [ctx.admin.id, ctx.resident.id] } },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityId: ctx.procurement.id },
        { entityId: { in: orderIds } },
      ],
    },
  });

  await prisma.procurement.delete({ where: { id: ctx.procurement.id } });
  await prisma.user.delete({ where: { id: ctx.admin.id } });
  await prisma.user.delete({ where: { id: ctx.resident.id } });
  await prisma.product.delete({ where: { id: ctx.product.id } });
  await prisma.supplier.delete({ where: { id: ctx.supplier.id } });
  await prisma.unit.delete({ where: { id: ctx.unit.id } });
  await prisma.category.delete({ where: { id: ctx.category.id } });
  await prisma.pickupPoint.delete({ where: { id: ctx.pickupPoint.id } });
  await prisma.settlement.delete({ where: { id: ctx.settlement.id } });
  await prisma.region.delete({ where: { id: ctx.region.id } });
}

describe.skipIf(!shouldRun)("Full flow integration (guest→resident→order→pay→checkin)", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || "integration-test-secret";

    const dbMod = await import("@/lib/db");
    prisma = dbMod.prisma;

    const cartActions = await import("@/app/p/[code]/actions");
    addToCart = cartActions.addToCart;
    submitOrder = cartActions.submitOrder;

    const adminActions = await import("@/app/admin/procurements/[id]/actions");
    updatePaymentStatus = adminActions.updatePaymentStatus;
    createPickupSession = adminActions.createPickupSession;
    checkinOrder = adminActions.checkinOrder;

    ctx = await seedFixtures(prisma);
  }, 60_000);

  afterAll(async () => {
    if (prisma && ctx) {
      await cleanupFixtures(prisma, ctx);
    }
    if (prisma) await prisma.$disconnect();
  });

  it("resident оформляет заявку, админ помечает оплаченной, операция выдачи проходит успешно", async () => {
    // ─── Resident: addToCart ─────────────────────────────────────────────
    mockGetSession.mockResolvedValue({
      sub: ctx.resident.id,
      email: ctx.resident.email,
      role: "RESIDENT",
      settlementId: ctx.settlement.id,
    });

    await addToCart(
      fd({
        code: ctx.procurement.inviteCode,
        procurementId: ctx.procurement.id,
        productId: ctx.product.id,
        qty: "3",
      })
    );

    const draft = await prisma.order.findFirst({
      where: {
        procurementId: ctx.procurement.id,
        userId: ctx.resident.id,
        status: "DRAFT",
      },
      include: { items: true },
    });
    expect(draft).not.toBeNull();
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].qty).toBe(3);

    // ─── Resident: submitOrder ───────────────────────────────────────────
    const submitRes = await submitOrder(
      null,
      fd({
        procurementId: ctx.procurement.id,
        code: ctx.procurement.inviteCode,
        participantName: "Иван Иванов",
        participantPhone: "+79990001122",
      })
    );
    expect(submitRes?.ok ?? true).not.toBe(false);

    const submitted = await prisma.order.findUnique({
      where: { id: draft.id },
    });
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.goodsTotal).toBe(ctx.product.price * 3);
    // With EQUAL split and only one submitted order, the whole delivery fee
    // falls on this order.
    expect(submitted.deliveryShare).toBe(ctx.procurement.deliveryFee);
    expect(submitted.grandTotal).toBe(
      submitted.goodsTotal + submitted.deliveryShare
    );

    const submitAudit = await prisma.auditLog.findFirst({
      where: { action: "SUBMIT_ORDER", entityId: draft.id },
    });
    expect(submitAudit).not.toBeNull();

    const submitNotif = await prisma.notification.findFirst({
      where: { userId: ctx.resident.id, type: "ORDER_SUBMITTED" },
    });
    expect(submitNotif).not.toBeNull();

    // ─── Admin: updatePaymentStatus → PAID ───────────────────────────────
    mockGetSession.mockResolvedValue({
      sub: ctx.admin.id,
      email: ctx.admin.email,
      role: "ADMIN",
    });

    const payRes = await updatePaymentStatus(
      null,
      fd({
        orderId: draft.id,
        paymentStatus: "PAID",
        paymentMethod: "cash",
      })
    );
    expect(payRes).toEqual({ ok: true, message: "Статус оплаты обновлён." });

    const paid = await prisma.order.findUnique({ where: { id: draft.id } });
    expect(paid.paymentStatus).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();
    expect(paid.paymentMethod).toBe("cash");

    const payAudit = await prisma.auditLog.findFirst({
      where: { action: "UPDATE_PAYMENT_STATUS", entityId: draft.id },
    });
    expect(payAudit).not.toBeNull();

    const payNotif = await prisma.notification.findFirst({
      where: { userId: ctx.resident.id, type: "PAYMENT_STATUS_CHANGED" },
    });
    expect(payNotif).not.toBeNull();

    // ─── Admin: createPickupSession ──────────────────────────────────────
    await createPickupSession(
      fd({
        procurementId: ctx.procurement.id,
        startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        endAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      })
    );

    const pickup = await prisma.pickupSession.findUnique({
      where: { procurementId: ctx.procurement.id },
    });
    expect(pickup).not.toBeNull();
    expect(pickup.status).toBe("PLANNED");

    // ─── Admin: checkinOrder ─────────────────────────────────────────────
    await checkinOrder(
      fd({
        sessionId: pickup.id,
        orderId: draft.id,
      })
    );

    const checkin = await prisma.pickupCheckin.findUnique({
      where: { orderId: draft.id },
    });
    expect(checkin).not.toBeNull();
    expect(checkin.sessionId).toBe(pickup.id);
    expect(checkin.operatorUserId).toBe(ctx.admin.id);

    const checkinAudit = await prisma.auditLog.findFirst({
      where: { action: "CHECKIN_ORDER", entityId: draft.id },
    });
    expect(checkinAudit).not.toBeNull();

    const issuedNotif = await prisma.notification.findFirst({
      where: { userId: ctx.resident.id, type: "ORDER_ISSUED" },
    });
    expect(issuedNotif).not.toBeNull();

    // Double-checkin must be blocked.
    await expect(
      checkinOrder(
        fd({
          sessionId: pickup.id,
          orderId: draft.id,
        })
      )
    ).rejects.toThrow(/уже выдана/);
  }, 60_000);
});

// If TEST_DATABASE_URL is not set we still want the suite file to register
// a placeholder test so vitest doesn't report "no tests".
describe.skipIf(shouldRun)("Full flow integration (skipped)", () => {
  it.skip("TEST_DATABASE_URL not set — integration flow skipped", () => {});
});
