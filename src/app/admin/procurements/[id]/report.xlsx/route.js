import { prisma } from "@/lib/db";
import { requireOperatorOrAdminRoute } from "@/lib/guards";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/constants";
import { buildActorAuditMeta, writeProcurementAudit } from "@/lib/audit";
import { buildProcurementDocumentFilename } from "@/lib/exportDocuments";
import { getOrderTotals } from "@/lib/orders";
import ExcelJS from "exceljs";

export async function GET(_req, { params }) {
  const { id } = await params;

  const procurement = await prisma.procurement.findUnique({
    where: { id },
    include: {
      supplier: true,
      settlement: { include: { region: true } },
      pickupPoint: true,
    },
  });
  if (!procurement) return new Response("Not Found", { status: 404 });

  const { session, response } = await requireOperatorOrAdminRoute(procurement.pickupPointId);
  if (response) return response;
  const filename = buildProcurementDocumentFilename(procurement.inviteCode, "report", "xlsx");

  const orders = await prisma.order.findMany({
    where: { procurementId: id, status: "SUBMITTED" },
    include: {
      items: { include: { product: { include: { category: true, unit: true } } } },
      checkin: true,
    },
    orderBy: { participantName: "asc" },
  });

  // ── Aggregations ──────────────────────────────────────────
  const totals = orders.map((order) => getOrderTotals(order));
  const goodsTotalSum = totals.reduce((sum, order) => sum + order.goodsTotal, 0);
  const deliveryShareSum = totals.reduce((sum, order) => sum + order.deliveryShare, 0);
  const grandTotalSum = totals.reduce((sum, order) => sum + order.grandTotal, 0);
  const paidCount = orders.filter((o) => o.paymentStatus === "PAID").length;
  const payOnPickupCount = orders.filter((o) => o.paymentStatus === "PAY_ON_PICKUP").length;
  const unpaidCount = orders.filter((o) => o.paymentStatus === "UNPAID").length;
  const issuedCount = orders.filter((o) => o.checkin).length;

  const catMap = new Map();
  const prodMap = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      const p = item.product;
      const s = item.qty * item.price;
      if (!catMap.has(p.category.id)) catMap.set(p.category.id, { name: p.category.name, qty: 0, sum: 0 });
      const cr = catMap.get(p.category.id);
      cr.qty += item.qty;
      cr.sum += s;
      if (!prodMap.has(p.id)) prodMap.set(p.id, { name: p.name, category: p.category.name, unit: p.unit.name, qty: 0, sum: 0 });
      const pr = prodMap.get(p.id);
      pr.qty += item.qty;
      pr.sum += s;
    }
  }
  const topCategories = Array.from(catMap.values()).sort((a, b) => b.sum - a.sum);
  const topProducts = Array.from(prodMap.values()).sort((a, b) => b.sum - a.sum);

  const wb = new ExcelJS.Workbook();
  wb.creator = "CoopBuy";

  // ── Sheet 1: Summary ──────────────────────────────────────
  const wsSummary = wb.addWorksheet("Summary");
  wsSummary.columns = [
    { header: "Показатель", key: "key", width: 30 },
    { header: "Значение", key: "value", width: 25 },
  ];
  wsSummary.getRow(1).font = { bold: true };
  const summaryRows = [
    ["Закупка", procurement.title],
    ["Поставщик", procurement.supplier.name],
    ["Населённый пункт", `${procurement.settlement.region.name}, ${procurement.settlement.name}`],
    ["Пункт выдачи", procurement.pickupPoint.name],
    ["Статус", STATUS_LABELS[procurement.status] ?? procurement.status],
    ["Дедлайн", new Date(procurement.deadlineAt).toLocaleString("ru-RU")],
    ["Всего заявок", orders.length],
    ["Сумма товаров, ₽", goodsTotalSum],
    ["Сумма доставки, ₽", deliveryShareSum],
    ["Итого, ₽", grandTotalSum],
    ["Оплачено", paidCount],
    ["Оплата при выдаче", payOnPickupCount],
    ["Не оплачено", unpaidCount],
    ["Выдано", issuedCount],
    ["Не выдано", orders.length - issuedCount],
  ];
  for (const [key, value] of summaryRows) {
    wsSummary.addRow({ key, value });
  }

  // ── Sheet 2: Orders ───────────────────────────────────────
  const wsOrders = wb.addWorksheet("Orders");
  wsOrders.columns = [
    { header: "Участник", key: "name", width: 25 },
    { header: "Телефон", key: "phone", width: 18 },
    { header: "Товары, ₽", key: "goodsTotal", width: 14 },
    { header: "Доставка, ₽", key: "deliveryShare", width: 14 },
    { header: "Итого, ₽", key: "grandTotal", width: 14 },
    { header: "Статус оплаты", key: "paymentStatus", width: 18 },
    { header: "Оплачено в", key: "paidAt", width: 22 },
    { header: "Выдан", key: "issued", width: 10 },
  ];
  wsOrders.getRow(1).font = { bold: true };
  for (const order of orders) {
    const { goodsTotal, deliveryShare, grandTotal } = getOrderTotals(order);
    wsOrders.addRow({
      name: order.participantName ?? "",
      phone: order.participantPhone ?? "",
      goodsTotal,
      deliveryShare,
      grandTotal,
      paymentStatus: PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus,
      paidAt: order.paidAt ? new Date(order.paidAt).toLocaleString("ru-RU") : "",
      issued: order.checkin ? "Да" : "Нет",
    });
  }

  // ── Sheet 3: TopCategories ────────────────────────────────
  const wsCats = wb.addWorksheet("TopCategories");
  wsCats.columns = [
    { header: "Категория", key: "name", width: 30 },
    { header: "Кол-во", key: "qty", width: 12 },
    { header: "Сумма, ₽", key: "sum", width: 14 },
  ];
  wsCats.getRow(1).font = { bold: true };
  for (const cat of topCategories) {
    wsCats.addRow({ name: cat.name, qty: cat.qty, sum: cat.sum });
  }

  // ── Sheet 4: TopProducts ──────────────────────────────────
  const wsProds = wb.addWorksheet("TopProducts");
  wsProds.columns = [
    { header: "Товар", key: "name", width: 35 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Ед.", key: "unit", width: 10 },
    { header: "Кол-во", key: "qty", width: 12 },
    { header: "Сумма, ₽", key: "sum", width: 14 },
  ];
  wsProds.getRow(1).font = { bold: true };
  for (const prod of topProducts) {
    wsProds.addRow({ name: prod.name, category: prod.category, unit: prod.unit, qty: prod.qty, sum: prod.sum });
  }

  const buf = await wb.xlsx.writeBuffer();

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel: session.email,
    action: "EXPORT_DOC",
    procurementId: id,
    meta: buildActorAuditMeta(session, {
      type: "report_xlsx",
      orderCount: orders.length,
      inviteCode: procurement.inviteCode,
      filename,
    }),
  });

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
