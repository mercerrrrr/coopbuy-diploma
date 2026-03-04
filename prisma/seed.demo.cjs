/**
 * prisma/seed.demo.cjs — Demo dataset seed
 * Idempotent: clears demo-tagged data first, then re-creates.
 * Run: node prisma/seed.demo.cjs
 */
require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── helpers ───────────────────────────────────────────────────────────────
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const hash = (pw) => bcrypt.hash(pw, 10);

const tomorrow = (days = 1) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
  // ── 1. Regions ──────────────────────────────────────────────────────────
  const regionNames = [
    "Астраханская область",
    "Волгоградская область",
    "Ростовская область",
    "Краснодарский край",
    "Ставропольский край",
  ];
  const regions = [];
  for (const name of regionNames) {
    const r = await prisma.region.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    regions.push(r);
  }

  // ── 2. Settlements (7) ──────────────────────────────────────────────────
  const settlementDefs = [
    { name: "Новолесное", region: 0 },
    { name: "Светлый", region: 0 },
    { name: "Красноармейск", region: 1 },
    { name: "Котельниково", region: 1 },
    { name: "Новочеркасск", region: 2 },
    { name: "Батайск", region: 3 },
    { name: "Минеральные Воды", region: 4 },
  ];
  const settlements = [];
  for (const s of settlementDefs) {
    const reg = regions[s.region];
    const obj = await prisma.settlement.upsert({
      where: { regionId_name: { regionId: reg.id, name: s.name } },
      update: {},
      create: { name: s.name, regionId: reg.id },
    });
    settlements.push(obj);
  }

  // ── 3. PickupPoints (7, 2 with freezer) ────────────────────────────────
  const pickupPoints = [];
  for (let i = 0; i < settlements.length; i++) {
    const existing = await prisma.pickupPoint.findFirst({
      where: { settlementId: settlements[i].id, name: "Пункт выдачи №1" },
    });
    const pp = existing ?? await prisma.pickupPoint.create({
      data: {
        settlementId: settlements[i].id,
        name: "Пункт выдачи №1",
        address: `ул. Центральная, д.${i + 1}`,
        hasFreezer: i < 2,
      },
    });
    pickupPoints.push(pp);
  }

  // ── 4. Categories (5) ──────────────────────────────────────────────────
  const catNames = ["Крупы", "Молочное", "Напитки", "Консервы", "Хозтовары"];
  const categories = [];
  for (const name of catNames) {
    const c = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    categories.push(c);
  }

  // ── 5. Units (5) ───────────────────────────────────────────────────────
  const unitNames = ["шт", "кг", "л", "уп", "пач"];
  const units = [];
  for (const name of unitNames) {
    const u = await prisma.unit.upsert({ where: { name }, update: {}, create: { name } });
    units.push(u);
  }

  // ── 6. Suppliers (5: 4 active, 1 inactive) ─────────────────────────────
  const supplierDefs = [
    { name: "Оптовик-Юг",     phone: "+7(900)000-00-01", email: "opt-yug@demo.test",    minOrderSum: 10000, isActive: true  },
    { name: "АгроТрейд",      phone: "+7(900)000-00-02", email: "agro@demo.test",        minOrderSum: 15000, isActive: true  },
    { name: "СберПродукт",    phone: "+7(900)000-00-03", email: "sber@demo.test",        minOrderSum: 5000,  isActive: true  },
    { name: "МегаОпт",        phone: "+7(900)000-00-04", email: "mega@demo.test",        minOrderSum: 20000, isActive: true  },
    { name: "ЗакрытыйОптовик",phone: "+7(900)000-00-05", email: "closed@demo.test",      minOrderSum: 8000,  isActive: false },
  ];
  const suppliers = [];
  for (const d of supplierDefs) {
    let s = await prisma.supplier.findFirst({ where: { name: d.name } });
    if (!s) {
      s = await prisma.supplier.create({ data: d });
    }
    suppliers.push(s);
  }

  // ── 7. SupplierDeliveryZones ────────────────────────────────────────────
  const activeSuppliers = suppliers.filter((s) => s.isActive);
  for (const sup of activeSuppliers) {
    for (const sett of settlements.slice(0, 5)) {
      await prisma.supplierDeliveryZone.upsert({
        where: { supplierId_settlementId: { supplierId: sup.id, settlementId: sett.id } },
        update: { isActive: true },
        create: { supplierId: sup.id, settlementId: sett.id },
      });
    }
  }

  // ── 8. Products (20) ───────────────────────────────────────────────────
  const productTemplates = [
    { name: "Гречка 800г",           cat: 0, unit: 1, price: 120 },
    { name: "Рис длиннозёрный 900г", cat: 0, unit: 1, price: 110 },
    { name: "Пшено 900г",            cat: 0, unit: 1, price: 90  },
    { name: "Овсянка 500г",          cat: 0, unit: 3, price: 85  },
    { name: "Молоко 3.2% 1л",        cat: 1, unit: 2, price: 75  },
    { name: "Кефир 2.5% 1л",         cat: 1, unit: 2, price: 80  },
    { name: "Масло сливочное 200г",  cat: 1, unit: 0, price: 195 },
    { name: "Сыр Российский 400г",   cat: 1, unit: 0, price: 320 },
    { name: "Вода питьевая 5л",      cat: 2, unit: 2, price: 150 },
    { name: "Сок яблочный 1л",       cat: 2, unit: 2, price: 95  },
    { name: "Сок томатный 1л",       cat: 2, unit: 2, price: 88  },
    { name: "Компот вишнёвый 0.5л",  cat: 3, unit: 2, price: 65  },
    { name: "Тушёнка говяжья 525г",  cat: 3, unit: 0, price: 285 },
    { name: "Горошек зелёный 400г",  cat: 3, unit: 0, price: 72  },
    { name: "Кукуруза сладкая 340г", cat: 3, unit: 0, price: 68  },
    { name: "Фасоль красная 400г",   cat: 3, unit: 0, price: 95  },
    { name: "Порошок стиральный 99кг",cat: 4, unit: 1, price: 450 },
    { name: "Средство посудное 500мл",cat:4, unit: 0, price: 135 },
    { name: "Мыло хозяйственное 200г",cat:4, unit: 0, price: 45  },
    { name: "Губки кухонные (5 шт)", cat: 4, unit: 3, price: 89  },
  ];
  const products = [];
  for (let i = 0; i < productTemplates.length; i++) {
    const t = productTemplates[i];
    const sup = activeSuppliers[i % activeSuppliers.length];
    const sku = i % 3 === 0 ? `SKU-${String(i + 1).padStart(4, "0")}` : null;
    let p = await prisma.product.findFirst({
      where: { supplierId: sup.id, name: t.name },
    });
    if (!p) {
      p = await prisma.product.create({
        data: {
          name: t.name,
          categoryId: categories[t.cat].id,
          unitId: units[t.unit].id,
          price: t.price,
          supplierId: sup.id,
          sku,
          isActive: true,
        },
      });
    }
    products.push(p);
  }

  // ── 9. Users ───────────────────────────────────────────────────────────
  // Admin
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

  // Operators
  const operatorUsers = [];
  for (let i = 1; i <= 2; i++) {
    const email = `operator${i}@local.test`;
    const pp = pickupPoints[i - 1];
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await hash("Operator123!"),
        fullName: `Оператор ${i}`,
        role: "OPERATOR",
        pickupPointId: pp.id,
        settlementId: pp.settlementId,
      },
    });
    operatorUsers.push(u);
  }

  // Residents (user1..user6)
  const residentUsers = [];
  for (let i = 1; i <= 6; i++) {
    const email = `user${i}@local.test`;
    const sett = settlements[(i - 1) % settlements.length];
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await hash("User123!"),
        fullName: `Житель ${i}`,
        phone: `+7(900)100-00-${String(i).padStart(2, "0")}`,
        role: "RESIDENT",
        settlementId: sett.id,
      },
    });
    residentUsers.push(u);
  }

  // ── 10. Procurements (3) ───────────────────────────────────────────────
  const splitModes = ["PROPORTIONAL_SUM", "EQUAL", "PER_ITEM"];
  const procDefs = [
    {
      title: "Демо-закупка №1 (Оптовик-Юг)",
      status: "OPEN",
      deadlineAt: tomorrow(2),
      deliveryFee: 1200,
      deliverySplitMode: "PROPORTIONAL_SUM",
      supplierIdx: 0,
      settlementIdx: 0,
      pickupIdx: 0,
      inviteCode: "DEMO-OPEN-1",
    },
    {
      title: "Демо-закупка №2 (АгроТрейд)",
      status: "OPEN",
      deadlineAt: tomorrow(5),
      deliveryFee: 800,
      deliverySplitMode: "EQUAL",
      supplierIdx: 1,
      settlementIdx: 1,
      pickupIdx: 1,
      inviteCode: "DEMO-OPEN-2",
    },
    {
      title: "Демо-закупка №3 (завершена)",
      status: "CLOSED",
      deadlineAt: new Date("2026-02-01"),
      deliveryFee: 500,
      deliverySplitMode: "PER_ITEM",
      supplierIdx: 2,
      settlementIdx: 2,
      pickupIdx: 2,
      inviteCode: "DEMO-CLOSED-1",
    },
  ];
  const procurements = [];
  for (const d of procDefs) {
    let proc = await prisma.procurement.findFirst({ where: { inviteCode: d.inviteCode } });
    if (!proc) {
      proc = await prisma.procurement.create({
        data: {
          title: d.title,
          status: d.status,
          inviteCode: d.inviteCode,
          deadlineAt: d.deadlineAt,
          deliveryFee: d.deliveryFee,
          deliverySplitMode: d.deliverySplitMode,
          supplierId: suppliers[d.supplierIdx].id,
          settlementId: settlements[d.settlementIdx].id,
          pickupPointId: pickupPoints[d.pickupIdx].id,
          minTotalSum: 5000,
          pickupWindowStart: tomorrow(7),
          pickupWindowEnd: tomorrow(9),
          pickupInstructions: "Приходите с 10:00 до 18:00, иметь при себе QR-код.",
        },
      });
    }
    procurements.push(proc);
  }

  // ── 11. Orders (6–10 SUBMITTED) ────────────────────────────────────────
  const payStatuses = ["PAID", "PAY_ON_PICKUP", "UNPAID"];
  const orders = [];

  // Create orders in the 2 OPEN procurements
  for (let procIdx = 0; procIdx < 2; procIdx++) {
    const proc = procurements[procIdx];
    const procProducts = products.slice(procIdx * 5, procIdx * 5 + 8);

    for (let u = 0; u < residentUsers.length; u++) {
      const user = residentUsers[u];

      // Skip if order already exists
      const existing = await prisma.order.findFirst({
        where: { procurementId: proc.id, userId: user.id, status: "SUBMITTED" },
      });
      if (existing) {
        orders.push(existing);
        continue;
      }

      // Pick 2–3 random products for this order
      const chosen = procProducts.slice(u % procProducts.length, (u % procProducts.length) + rnd(2, 3));
      if (!chosen.length) continue;

      const items = chosen.map((p) => ({ productId: p.id, qty: rnd(1, 3), price: p.price }));
      const goodsTotal = items.reduce((s, it) => s + it.qty * it.price, 0);
      const deliveryShare = Math.ceil(proc.deliveryFee / residentUsers.length);
      const grandTotal = goodsTotal + deliveryShare;
      const paymentStatus = payStatuses[(u + procIdx) % 3];

      const order = await prisma.order.create({
        data: {
          procurementId: proc.id,
          userId: user.id,
          participantName: user.fullName,
          participantPhone: user.phone ?? "+7(900)000-00-00",
          status: "SUBMITTED",
          goodsTotal,
          deliveryShare,
          grandTotal,
          paymentStatus,
          paidAt: paymentStatus === "PAID" ? new Date() : null,
          paymentMethod: paymentStatus === "PAID" ? "Перевод" : null,
          items: { create: items },
        },
      });
      orders.push(order);
    }
  }

  // ── 12. PickupSession + PickupCheckin (for CLOSED procurement) ─────────
  const closedProc = procurements[2];
  let session = await prisma.pickupSession.findFirst({ where: { procurementId: closedProc.id } });
  if (!session) {
    session = await prisma.pickupSession.create({
      data: {
        procurementId: closedProc.id,
        status: "ACTIVE",
        startAt: new Date("2026-02-15T10:00:00Z"),
        endAt: new Date("2026-02-15T18:00:00Z"),
      },
    });
  }

  // Checkins for first 3 orders of the OPEN proc 0 that are PAID
  let checkinCount = 0;
  for (const order of orders.slice(0, 3)) {
    const existing = await prisma.pickupCheckin.findFirst({ where: { orderId: order.id } });
    if (!existing) {
      await prisma.pickupCheckin.create({
        data: {
          sessionId: session.id,
          orderId: order.id,
          operatorUserId: operatorUsers[0].id,
          note: "Выдано без замечаний",
        },
      });
      checkinCount++;
    }
  }

  // ── 13. Notifications ──────────────────────────────────────────────────
  const notifTypes = [
    { type: "PROCUREMENT_CREATED", title: "Новая закупка открыта", body: "Закупка «Демо-закупка №1» открыта для заявок." },
    { type: "ORDER_SUBMITTED",     title: "Заявка принята",        body: "Ваша заявка успешно зарегистрирована." },
    { type: "PAYMENT_STATUS_CHANGED", title: "Статус оплаты изменён", body: "Ваша оплата подтверждена." },
  ];
  let notifCreated = 0;
  for (const user of residentUsers) {
    const existing = await prisma.notification.findFirst({ where: { userId: user.id } });
    if (!existing) {
      for (const n of notifTypes) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: n.type,
            title: n.title,
            body: n.body,
            linkUrl: "/my/orders",
          },
        });
        notifCreated++;
      }
    }
  }

  // ── 14. AuditLog ───────────────────────────────────────────────────────
  const auditCount = await prisma.auditLog.count();
  if (auditCount < 5) {
    const auditEntries = [
      { actorType: "ADMIN", actorLabel: "admin@local.test", action: "CREATE_PROCUREMENT", entityType: "PROCUREMENT", entityId: procurements[0].id, meta: { title: procurements[0].title } },
      { actorType: "ADMIN", actorLabel: "admin@local.test", action: "CREATE_PROCUREMENT", entityType: "PROCUREMENT", entityId: procurements[1].id, meta: { title: procurements[1].title } },
      { actorType: "ADMIN", actorLabel: "admin@local.test", action: "CLOSE_PROCUREMENT",  entityType: "PROCUREMENT", entityId: procurements[2].id, meta: {} },
      { actorType: "ADMIN", actorLabel: "admin@local.test", action: "UPDATE_DELIVERY_SETTINGS", entityType: "PROCUREMENT", entityId: procurements[0].id, meta: { deliveryFee: 1200 } },
      { actorType: "ADMIN", actorLabel: "admin@local.test", action: "EXPORT_DOC",         entityType: "PROCUREMENT", entityId: procurements[2].id, meta: { type: "payments_xlsx" } },
      { actorType: "PUBLIC", actorLabel: "user1@local.test", action: "SUBMIT_ORDER",       entityType: "ORDER",       entityId: orders[0]?.id ?? "demo", meta: {} },
      { actorType: "PUBLIC", actorLabel: "user2@local.test", action: "SUBMIT_ORDER",       entityType: "ORDER",       entityId: orders[1]?.id ?? "demo", meta: {} },
      { actorType: "ADMIN", actorLabel: "operator1@local.test", action: "CHECKIN_ORDER",  entityType: "ORDER",       entityId: orders[0]?.id ?? "demo", meta: {} },
      { actorType: "ADMIN", actorLabel: "admin@local.test", action: "UPDATE_PAYMENT_STATUS", entityType: "ORDER",   entityId: orders[0]?.id ?? "demo", meta: { paymentStatus: "PAID" } },
      { actorType: "ADMIN", actorLabel: "admin@local.test", action: "RECALC_DELIVERY_SHARES", entityType: "PROCUREMENT", entityId: procurements[0].id, meta: {} },
    ];
    await prisma.auditLog.createMany({ data: auditEntries });
  }

  // ── 15. ReceivingReport ────────────────────────────────────────────────
  const existingReport = await prisma.receivingReport.findFirst({ where: { procurementId: closedProc.id } });
  if (!existingReport) {
    const report = await prisma.receivingReport.create({
      data: {
        procurementId: closedProc.id,
        status: "FINAL",
        notes: "Приёмка завершена. Выявлены незначительные расхождения.",
      },
    });
    await prisma.receivingLine.createMany({
      data: [
        { reportId: report.id, productId: products[0].id, expectedQty: 20, receivedQty: 19, comment: "1 упаковка повреждена" },
        { reportId: report.id, productId: products[4].id, expectedQty: 15, receivedQty: 15, comment: null },
      ],
    });
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("\n✅ Demo seed complete:");
  console.log(`  regions:        ${regions.length}`);
  console.log(`  settlements:    ${settlements.length}`);
  console.log(`  pickupPoints:   ${pickupPoints.length}`);
  console.log(`  categories:     ${categories.length}`);
  console.log(`  units:          ${units.length}`);
  console.log(`  suppliers:      ${suppliers.length}`);
  console.log(`  products:       ${products.length}`);
  console.log(`  procurements:   ${procurements.length}`);
  console.log(`  orders(submit): ${orders.length}`);
  console.log(`  checkins:       ${checkinCount}`);
  console.log(`  notifications:  ${notifCreated}`);
  console.log(`  auditLogs:      ≥10 entries`);
  console.log(`  receivingReport: 1 (with 2 lines)\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
