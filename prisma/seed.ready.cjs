/**
 * prisma/seed.ready.cjs — historical utility dataset.
 * Official seed path for the project is `prisma/seed.js`.
 * Official fill scenario is `npm run db:reset`.
 * Idempotent via upsert. Run manually only when you intentionally need this legacy scenario.
 */
require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const hash = (pw) => bcrypt.hash(pw, 10);
const days = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

async function main() {
  // ── 1. Regions (3) ───────────────────────────────────────────────────────
  const regionNames = ["Краснодарский край", "Ростовская область", "Астраханская область"];
  const regions = [];
  for (const name of regionNames) {
    regions.push(await prisma.region.upsert({ where: { name }, update: {}, create: { name } }));
  }

  // ── 2. Settlements (4) ────────────────────────────────────────────────────
  const settlementDefs = [
    { name: "Солнечное", regionIdx: 0 },
    { name: "Новый Берег", regionIdx: 0 },
    { name: "Заречный",   regionIdx: 1 },
    { name: "Камыши",     regionIdx: 2 },
  ];
  const settlements = [];
  for (const s of settlementDefs) {
    const reg = regions[s.regionIdx];
    settlements.push(
      await prisma.settlement.upsert({
        where: { regionId_name: { regionId: reg.id, name: s.name } },
        update: {},
        create: { name: s.name, regionId: reg.id },
      })
    );
  }

  // ── 3. PickupPoints (4, index 2 has freezer) ─────────────────────────────
  const ppDefs = [
    { name: "ПВЗ Центральный",  address: "ул. Центральная, 1",   hasFreezer: false, sIdx: 0 },
    { name: "ПВЗ Северный",     address: "пр. Северный, 12",     hasFreezer: false, sIdx: 1 },
    { name: "ПВЗ Холодный",     address: "ул. Ледовая, 5",       hasFreezer: true,  sIdx: 2 },
    { name: "ПВЗ Восточный",    address: "ул. Восточная, 7",     hasFreezer: false, sIdx: 3 },
  ];
  const pickupPoints = [];
  for (const d of ppDefs) {
    const existing = await prisma.pickupPoint.findFirst({
      where: { settlementId: settlements[d.sIdx].id, name: d.name },
    });
    pickupPoints.push(
      existing ??
        (await prisma.pickupPoint.create({
          data: {
            name: d.name,
            address: d.address,
            hasFreezer: d.hasFreezer,
            settlementId: settlements[d.sIdx].id,
          },
        }))
    );
  }

  // ── 4. Categories (5) ─────────────────────────────────────────────────────
  const catNames = ["Крупы", "Молочное", "Напитки", "Консервы", "Хозтовары"];
  const cats = [];
  for (const name of catNames) {
    cats.push(await prisma.category.upsert({ where: { name }, update: {}, create: { name } }));
  }

  // ── 5. Units (5) ──────────────────────────────────────────────────────────
  const unitNames = ["шт", "кг", "л", "уп", "пач"];
  const units = [];
  for (const name of unitNames) {
    units.push(await prisma.unit.upsert({ where: { name }, update: {}, create: { name } }));
  }

  // ── 6. Suppliers (3: 2 active, 1 inactive) ───────────────────────────────
  const supplierDefs = [
    { name: "АгроОпт-Юг",   phone: "+7(900)100-01-01", email: "agro@ready.test",   minOrderSum: 8000,  isActive: true  },
    { name: "СберПоставка", phone: "+7(900)100-01-02", email: "sber@ready.test",   minOrderSum: 5000,  isActive: true  },
    { name: "НеАктивный",   phone: "+7(900)100-01-03", email: "closed@ready.test", minOrderSum: 10000, isActive: false },
  ];
  const suppliers = [];
  for (const d of supplierDefs) {
    let s = await prisma.supplier.findFirst({ where: { name: d.name } });
    if (!s) s = await prisma.supplier.create({ data: d });
    suppliers.push(s);
  }

  // ── 7. SupplierDeliveryZones (2 active suppliers × 2 settlements) ─────────
  for (const supIdx of [0, 1]) {
    for (const sIdx of [0, 1]) {
      await prisma.supplierDeliveryZone.upsert({
        where: {
          supplierId_settlementId: {
            supplierId: suppliers[supIdx].id,
            settlementId: settlements[sIdx].id,
          },
        },
        update: { isActive: true },
        create: { supplierId: suppliers[supIdx].id, settlementId: settlements[sIdx].id },
      });
    }
  }

  // ── 8. Products (20) ──────────────────────────────────────────────────────
  // cat: 0=Крупы 1=Молочное 2=Напитки 3=Консервы 4=Хозтовары
  // unit: 0=шт 1=кг 2=л 3=уп 4=пач
  const productDefs = [
    { name: "Гречка 800г",             cat: 0, unit: 1, price: 125, supIdx: 0 },
    { name: "Рис длиннозёрный 900г",   cat: 0, unit: 1, price: 115, supIdx: 0 },
    { name: "Пшено 900г",              cat: 0, unit: 1, price: 92,  supIdx: 0 },
    { name: "Овсянка 500г",            cat: 0, unit: 3, price: 88,  supIdx: 0 },
    { name: "Молоко 3.2% 1л",          cat: 1, unit: 2, price: 78,  supIdx: 0 },
    { name: "Кефир 2.5% 1л",           cat: 1, unit: 2, price: 82,  supIdx: 0 },
    { name: "Масло сливочное 200г",    cat: 1, unit: 0, price: 198, supIdx: 0 },
    { name: "Сыр Российский 400г",     cat: 1, unit: 0, price: 325, supIdx: 0 },
    { name: "Вода питьевая 5л",        cat: 2, unit: 2, price: 155, supIdx: 0 },
    { name: "Сок яблочный 1л",         cat: 2, unit: 2, price: 97,  supIdx: 0 },
    { name: "Сок томатный 1л",         cat: 2, unit: 2, price: 91,  supIdx: 1 },
    { name: "Компот вишнёвый 0.5л",    cat: 3, unit: 2, price: 67,  supIdx: 1 },
    { name: "Тушёнка говяжья 525г",    cat: 3, unit: 0, price: 290, supIdx: 1 },
    { name: "Горошек зелёный 400г",    cat: 3, unit: 0, price: 74,  supIdx: 1 },
    { name: "Кукуруза сладкая 340г",   cat: 3, unit: 0, price: 70,  supIdx: 1 },
    { name: "Фасоль красная 400г",     cat: 3, unit: 0, price: 98,  supIdx: 1 },
    { name: "Порошок стиральный 3кг",  cat: 4, unit: 1, price: 455, supIdx: 1 },
    { name: "Средство посудное 500мл", cat: 4, unit: 0, price: 138, supIdx: 1 },
    { name: "Мыло хозяйственное 200г", cat: 4, unit: 0, price: 46,  supIdx: 1 },
    { name: "Губки кухонные (5 шт)",   cat: 4, unit: 3, price: 92,  supIdx: 0 },
  ];
  const products = [];
  for (const d of productDefs) {
    let p = await prisma.product.findFirst({
      where: { supplierId: suppliers[d.supIdx].id, name: d.name },
    });
    if (!p) {
      p = await prisma.product.create({
        data: {
          name: d.name,
          categoryId: cats[d.cat].id,
          unitId: units[d.unit].id,
          price: d.price,
          supplierId: suppliers[d.supIdx].id,
          isActive: true,
        },
      });
    }
    products.push(p);
  }

  // ── 9. Users ──────────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "admin@local.test" },
    update: {},
    create: {
      email: "admin@local.test",
      passwordHash: await hash("Admin123!"),
      fullName: "Главный Администратор",
      role: "ADMIN",
    },
  });

  const operator1 = await prisma.user.upsert({
    where: { email: "operator1@local.test" },
    update: {},
    create: {
      email: "operator1@local.test",
      passwordHash: await hash("Operator123!"),
      fullName: "Оператор Первый",
      role: "OPERATOR",
      pickupPointId: pickupPoints[0].id,
      settlementId: settlements[0].id,
    },
  });

  const user1 = await prisma.user.upsert({
    where: { email: "user1@local.test" },
    update: {},
    create: {
      email: "user1@local.test",
      passwordHash: await hash("User123!"),
      fullName: "Иван Иванов",
      phone: "+7(900)200-00-01",
      role: "RESIDENT",
      settlementId: settlements[0].id,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "user2@local.test" },
    update: {},
    create: {
      email: "user2@local.test",
      passwordHash: await hash("User123!"),
      fullName: "Мария Петрова",
      phone: "+7(900)200-00-02",
      role: "RESIDENT",
      settlementId: settlements[0].id,
    },
  });

  // ── 10. Procurements (3: 2 OPEN, 1 CLOSED) ───────────────────────────────
  const procDefs = [
    {
      inviteCode: "READY-OPEN-1",
      title: "Закупка №1 — АгроОпт (открыта)",
      status: "OPEN",
      deadlineAt: days(3),
      deliveryFee: 1200,
      deliverySplitMode: "PROPORTIONAL_SUM",
      supplierIdx: 0,
      settlementIdx: 0,
      pickupIdx: 0,
      pickupWindowStart: days(7),
      pickupWindowEnd: days(9),
      pickupInstructions: "Приходите с 10:00 до 18:00, иметь при себе QR-код.",
    },
    {
      inviteCode: "READY-OPEN-2",
      title: "Закупка №2 — СберПоставка (открыта)",
      status: "OPEN",
      deadlineAt: days(6),
      deliveryFee: 600,
      deliverySplitMode: "EQUAL",
      supplierIdx: 1,
      settlementIdx: 1,
      pickupIdx: 1,
      pickupWindowStart: days(10),
      pickupWindowEnd: days(12),
      pickupInstructions: "ПВЗ Северный. Брать паспорт.",
    },
    {
      inviteCode: "READY-CLOSED-1",
      title: "Закупка №3 — АгроОпт (завершена)",
      status: "CLOSED",
      deadlineAt: new Date("2026-01-20"),
      deliveryFee: 500,
      deliverySplitMode: "PER_ITEM",
      supplierIdx: 0,
      settlementIdx: 0,
      pickupIdx: 0,
      pickupWindowStart: new Date("2026-01-25T10:00:00Z"),
      pickupWindowEnd: new Date("2026-01-25T18:00:00Z"),
      pickupInstructions: "Закупка завершена. Все заказы выданы.",
    },
  ];
  const procurements = [];
  for (const d of procDefs) {
    let proc = await prisma.procurement.findFirst({ where: { inviteCode: d.inviteCode } });
    if (!proc) {
      proc = await prisma.procurement.create({
        data: {
          inviteCode: d.inviteCode,
          title: d.title,
          status: d.status,
          deadlineAt: d.deadlineAt,
          deliveryFee: d.deliveryFee,
          deliverySplitMode: d.deliverySplitMode,
          supplierId: suppliers[d.supplierIdx].id,
          settlementId: settlements[d.settlementIdx].id,
          pickupPointId: pickupPoints[d.pickupIdx].id,
          minTotalSum: 5000,
          pickupWindowStart: d.pickupWindowStart,
          pickupWindowEnd: d.pickupWindowEnd,
          pickupInstructions: d.pickupInstructions,
        },
      });
    }
    procurements.push(proc);
  }

  // ── 11. Orders (6 SUBMITTED) ──────────────────────────────────────────────
  // 3 orders for proc[0] (user1×3 items, user2×2 items, extra for variety)
  // 2 orders for proc[1]
  // 1 order for proc[2] (CLOSED — will be checked-in)
  const orderDefs = [
    // proc[0] — PROPORTIONAL_SUM, fee=1200
    {
      proc: 0, user: user1, items: [[0,2],[4,1],[8,1]],
      paymentStatus: "PAID", paidAt: new Date("2026-02-20"), paymentMethod: "Перевод",
    },
    {
      proc: 0, user: user2, items: [[1,1],[5,2]],
      paymentStatus: "PAY_ON_PICKUP",
    },
    {
      proc: 0, user: null, guestName: "Гость Семёнов", guestPhone: "+7(900)300-00-03",
      items: [[2,3],[9,2]], paymentStatus: "UNPAID",
    },
    // proc[1] — EQUAL, fee=600
    {
      proc: 1, user: user1, items: [[10,2],[11,1],[12,1]],
      paymentStatus: "PAID", paidAt: new Date("2026-02-22"), paymentMethod: "Наличные",
    },
    {
      proc: 1, user: user2, items: [[13,2],[14,3]],
      paymentStatus: "UNPAID",
    },
    // proc[2] — PER_ITEM, fee=500 (CLOSED)
    {
      proc: 2, user: user1, items: [[0,2],[4,1]],
      paymentStatus: "PAID", paidAt: new Date("2026-01-22"), paymentMethod: "Перевод",
    },
  ];

  const orders = [];
  for (const d of orderDefs) {
    const proc = procurements[d.proc];
    const items = d.items.map(([pIdx, qty]) => ({
      productId: products[pIdx].id,
      qty,
      price: products[pIdx].price,
    }));
    const goodsTotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const orderCount = orderDefs.filter((x) => x.proc === d.proc).length;
    const fee = proc.deliveryFee;
    const deliveryShare = Math.round(fee / orderCount);
    const grandTotal = goodsTotal + deliveryShare;

    const userId = d.user?.id ?? null;
    const participantName = d.user?.fullName ?? d.guestName ?? null;
    const participantPhone = d.user?.phone ?? d.guestPhone ?? null;

    // skip if already exists
    const where = userId
      ? { procurementId: proc.id, userId, status: "SUBMITTED" }
      : { procurementId: proc.id, participantName, status: "SUBMITTED" };
    const existing = await prisma.order.findFirst({ where });
    if (existing) { orders.push(existing); continue; }

    const order = await prisma.order.create({
      data: {
        procurementId: proc.id,
        userId,
        participantName,
        participantPhone,
        status: "SUBMITTED",
        goodsTotal,
        deliveryShare,
        grandTotal,
        paymentStatus: d.paymentStatus,
        paidAt: d.paidAt ?? null,
        paymentMethod: d.paymentMethod ?? null,
        items: { create: items },
      },
    });
    orders.push(order);
  }

  // ── 12. PickupSession + Checkins ──────────────────────────────────────────
  // Session for CLOSED proc (proc[2])
  const closedProc = procurements[2];
  let session = await prisma.pickupSession.findFirst({
    where: { procurementId: closedProc.id },
  });
  if (!session) {
    session = await prisma.pickupSession.create({
      data: {
        procurementId: closedProc.id,
        status: "CLOSED",
        startAt: new Date("2026-01-25T10:00:00Z"),
        endAt:   new Date("2026-01-25T16:00:00Z"),
      },
    });
  }

  // Checkin order[5] (the CLOSED proc order for user1)
  let checkinCount = 0;
  const checkinTargets = [orders[5]]; // only 1 order in closed proc
  for (const order of checkinTargets) {
    if (!order) continue;
    const existing = await prisma.pickupCheckin.findFirst({ where: { orderId: order.id } });
    if (!existing) {
      await prisma.pickupCheckin.create({
        data: {
          sessionId: session.id,
          orderId: order.id,
          operatorUserId: operator1.id,
          note: "Выдано без замечаний",
        },
      });
      checkinCount++;
    }
  }

  // Also create a second checkin from proc[0] orders for a more complete scenario:
  // create an active session for proc[0] too
  let session0 = await prisma.pickupSession.findFirst({
    where: { procurementId: procurements[0].id },
  });
  if (!session0) {
    session0 = await prisma.pickupSession.create({
      data: {
        procurementId: procurements[0].id,
        status: "ACTIVE",
        startAt: days(7),
      },
    });
  }
  // Checkin order[0] (user1, PAID) — already paid, can be checked in
  const order0 = orders[0];
  if (order0) {
    const existing = await prisma.pickupCheckin.findFirst({ where: { orderId: order0.id } });
    if (!existing) {
      await prisma.pickupCheckin.create({
        data: {
          sessionId: session0.id,
          orderId: order0.id,
          operatorUserId: operator1.id,
          note: "Выдано",
        },
      });
      checkinCount++;
    }
  }

  // ── 13. ReceivingReport (for CLOSED proc) ─────────────────────────────────
  const existingReport = await prisma.receivingReport.findFirst({
    where: { procurementId: closedProc.id },
  });
  let receivingReportId = existingReport?.id ?? null;
  if (!existingReport) {
    const report = await prisma.receivingReport.create({
      data: {
        procurementId: closedProc.id,
        status: "FINAL",
        notes: "Приёмка завершена. Выявлены незначительные расхождения по гречке.",
      },
    });
    receivingReportId = report.id;
    await prisma.receivingLine.createMany({
      data: [
        {
          reportId: report.id,
          productId: products[0].id, // Гречка
          expectedQty: 10,
          receivedQty: 9,
          comment: "1 упаковка повреждена при транспортировке",
        },
        {
          reportId: report.id,
          productId: products[4].id, // Молоко
          expectedQty: 5,
          receivedQty: 5,
          comment: null,
        },
      ],
    });
  }

  // ── 14. Notifications (3-5 per user1 + user2) ────────────────────────────
  let notifCreated = 0;
  const notifDefs = [
    {
      type: "PROCUREMENT_CREATED",
      title: "Новая закупка открыта",
      body: "Закупка «Закупка №1 — АгроОпт» открыта для заявок.",
      linkUrl: `/p/READY-OPEN-1`,
    },
    {
      type: "ORDER_SUBMITTED",
      title: "Заявка принята",
      body: "Ваша заявка на закупку №1 успешно зарегистрирована.",
      linkUrl: "/my/orders",
    },
    {
      type: "PAYMENT_STATUS_CHANGED",
      title: "Статус оплаты изменён",
      body: "Ваша оплата подтверждена. Спасибо!",
      linkUrl: "/my/orders",
    },
    {
      type: "PROCUREMENT_CLOSED",
      title: "Закупка завершена",
      body: "Закупка «Закупка №3 — АгроОпт» завершена. Ожидайте выдачи.",
      linkUrl: "/my/orders",
    },
    {
      type: "ORDER_ISSUED",
      title: "Заказ выдан",
      body: "Ваш заказ успешно выдан на пункте выдачи.",
      linkUrl: "/my/orders",
    },
  ];

  for (const user of [user1, user2]) {
    const existingCount = await prisma.notification.count({ where: { userId: user.id } });
    if (existingCount === 0) {
      for (const n of notifDefs) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: n.type,
            title: n.title,
            body: n.body,
            linkUrl: n.linkUrl,
            // Mark last 2 as read for user2 only
            readAt:
              user.id === user2.id && notifDefs.indexOf(n) >= 3
                ? new Date("2026-02-24")
                : null,
          },
        });
        notifCreated++;
      }
    }
  }

  // ── 15. AuditLog (15-25 entries) ──────────────────────────────────────────
  const auditCount = await prisma.auditLog.count();
  if (auditCount < 5) {
    const entries = [
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "CREATE_PROCUREMENT", entityType: "PROCUREMENT", entityId: procurements[0].id, meta: { title: procurements[0].title } },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "CREATE_PROCUREMENT", entityType: "PROCUREMENT", entityId: procurements[1].id, meta: { title: procurements[1].title } },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "CREATE_PROCUREMENT", entityType: "PROCUREMENT", entityId: procurements[2].id, meta: { title: procurements[2].title } },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "CLOSE_PROCUREMENT",  entityType: "PROCUREMENT", entityId: procurements[2].id, meta: {} },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "UPDATE_DELIVERY_SETTINGS", entityType: "PROCUREMENT", entityId: procurements[0].id, meta: { deliveryFee: 1200, mode: "PROPORTIONAL_SUM" } },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "RECALC_DELIVERY_SHARES",   entityType: "PROCUREMENT", entityId: procurements[0].id, meta: {} },
      { actorType: "PUBLIC", actorLabel: "user1@local.test",   action: "SUBMIT_ORDER",       entityType: "ORDER",       entityId: orders[0]?.id ?? "n/a", meta: { procurementId: procurements[0].id } },
      { actorType: "PUBLIC", actorLabel: "user2@local.test",   action: "SUBMIT_ORDER",       entityType: "ORDER",       entityId: orders[1]?.id ?? "n/a", meta: { procurementId: procurements[0].id } },
      { actorType: "PUBLIC", actorLabel: "guest",              action: "SUBMIT_ORDER",       entityType: "ORDER",       entityId: orders[2]?.id ?? "n/a", meta: { procurementId: procurements[0].id } },
      { actorType: "PUBLIC", actorLabel: "user1@local.test",   action: "SUBMIT_ORDER",       entityType: "ORDER",       entityId: orders[3]?.id ?? "n/a", meta: { procurementId: procurements[1].id } },
      { actorType: "PUBLIC", actorLabel: "user2@local.test",   action: "SUBMIT_ORDER",       entityType: "ORDER",       entityId: orders[4]?.id ?? "n/a", meta: { procurementId: procurements[1].id } },
      { actorType: "PUBLIC", actorLabel: "user1@local.test",   action: "SUBMIT_ORDER",       entityType: "ORDER",       entityId: orders[5]?.id ?? "n/a", meta: { procurementId: procurements[2].id } },
      { actorType: "ADMIN", actorLabel: "operator1@local.test",action: "CREATE_PICKUP_SESSION", entityType: "PROCUREMENT", entityId: closedProc.id, meta: { sessionId: session.id } },
      { actorType: "ADMIN", actorLabel: "operator1@local.test",action: "CHECKIN_ORDER",      entityType: "PROCUREMENT", entityId: closedProc.id, meta: { orderId: orders[5]?.id ?? "n/a" } },
      { actorType: "ADMIN", actorLabel: "operator1@local.test",action: "CHECKIN_ORDER",      entityType: "PROCUREMENT", entityId: procurements[0].id, meta: { orderId: orders[0]?.id ?? "n/a" } },
      { actorType: "ADMIN", actorLabel: "operator1@local.test",action: "CLOSE_PICKUP_SESSION", entityType: "PROCUREMENT", entityId: closedProc.id, meta: {} },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "UPDATE_PAYMENT_STATUS", entityType: "ORDER",   entityId: orders[0]?.id ?? "n/a", meta: { procurementId: procurements[0].id, paymentStatus: "PAID" } },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "UPDATE_PAYMENT_STATUS", entityType: "ORDER",   entityId: orders[3]?.id ?? "n/a", meta: { procurementId: procurements[1].id, paymentStatus: "PAID" } },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "CREATE_RECEIVING",   entityType: "PROCUREMENT", entityId: closedProc.id, meta: { reportId: receivingReportId } },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "FINALIZE_RECEIVING", entityType: "PROCUREMENT", entityId: closedProc.id, meta: { reportId: receivingReportId } },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "EXPORT_DOC",         entityType: "PROCUREMENT", entityId: procurements[2].id, meta: { type: "payments_xlsx" } },
      { actorType: "ADMIN", actorLabel: "admin@local.test",    action: "EXPORT_DOC",         entityType: "PROCUREMENT", entityId: procurements[2].id, meta: { type: "report_xlsx" } },
    ];
    await prisma.auditLog.createMany({ data: entries });
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n✅ Ready seed complete:");
  console.log(`  regions:         ${regions.length}`);
  console.log(`  settlements:     ${settlements.length}`);
  console.log(`  pickupPoints:    ${pickupPoints.length} (1 с морозильником)`);
  console.log(`  categories:      ${cats.length}`);
  console.log(`  units:           ${units.length}`);
  console.log(`  suppliers:       ${suppliers.length} (2 active, 1 inactive)`);
  console.log(`  products:        ${products.length}`);
  console.log(`  procurements:    ${procurements.length} (2 OPEN, 1 CLOSED)`);
  console.log(`  orders:          ${orders.length} SUBMITTED`);
  console.log(`  checkins:        ${checkinCount}`);
  console.log(`  notifications:   ${notifCreated} (по ${notifDefs.length} у user1/user2)`);
  console.log(`  auditLog:        ≥22 записей`);
  console.log(`  receivingReport: 1 (с 2 строками, расхождение по гречке)\n`);

  console.log("Учётные записи:");
  console.log("  ADMIN:    admin@local.test    / Admin123!");
  console.log("  OPERATOR: operator1@local.test / Operator123!");
  console.log("  RESIDENT: user1@local.test     / User123!");
  console.log("  RESIDENT: user2@local.test     / User123!\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
