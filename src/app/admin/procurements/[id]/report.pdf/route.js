import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createPdfDoc, toPdfResponse } from "@/lib/pdfDoc";
import { drawTable } from "@/lib/pdfTable";
import { ensurePage } from "@/lib/pdfLayout";
import { rgb } from "pdf-lib";

export const runtime = "nodejs";

const W = 595.28, H = 841.89, LM = 40, RM = 555;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.33, 0.33, 0.33);
const LGRAY = rgb(0.73, 0.73, 0.73);

const PAYMENT_LABELS = {
  UNPAID: "Не оплачено",
  PAID: "Оплачено",
  PAY_ON_PICKUP: "При выдаче",
};

export async function GET(_req, { params }) {
  const { id } = await params;

  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const procurement = await prisma.procurement.findUnique({
    where: { id },
    include: {
      supplier: true,
      settlement: { include: { region: true } },
      pickupPoint: true,
    },
  });
  if (!procurement) return new Response("Not Found", { status: 404 });

  const orders = await prisma.order.findMany({
    where: { procurementId: id, status: "SUBMITTED" },
    include: {
      items: { include: { product: { include: { category: true, unit: true } } } },
      checkin: true,
    },
    orderBy: { participantName: "asc" },
  });

  // Aggregations
  const goodsTotalSum = orders.reduce((s, o) => s + (o.goodsTotal ?? 0), 0);
  const deliveryShareSum = orders.reduce((s, o) => s + (o.deliveryShare ?? 0), 0);
  const grandTotalSum = orders.reduce((s, o) => s + (o.grandTotal ?? 0), 0);
  const paymentBreakdown = {
    UNPAID: orders.filter((o) => o.paymentStatus === "UNPAID").length,
    PAID: orders.filter((o) => o.paymentStatus === "PAID").length,
    PAY_ON_PICKUP: orders.filter((o) => o.paymentStatus === "PAY_ON_PICKUP").length,
  };
  const issuedCount = orders.filter((o) => o.checkin).length;

  const catMap = new Map();
  const prodMap = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      const p = item.product;
      const s = item.qty * item.price;
      if (!catMap.has(p.category.id)) catMap.set(p.category.id, { name: p.category.name, qty: 0, sum: 0 });
      const cr = catMap.get(p.category.id);
      cr.qty += item.qty; cr.sum += s;
      if (!prodMap.has(p.id)) prodMap.set(p.id, { name: p.name, qty: 0, sum: 0 });
      const pr = prodMap.get(p.id);
      pr.qty += item.qty; pr.sum += s;
    }
  }
  const topCategories = Array.from(catMap.values()).sort((a, b) => b.sum - a.sum).slice(0, 15);
  const topProducts = Array.from(prodMap.values()).sort((a, b) => b.sum - a.sum).slice(0, 20);

  const { pdf, font } = await createPdfDoc();
  let page = pdf.addPage([W, H]);
  let y = H - LM;

  function txt(str, x, size, color = BLACK) {
    page.drawText(String(str ?? ""), { x, y, size, font, color });
  }
  function line(str, x, size, color = BLACK) { txt(str, x, size, color); y -= size * 1.6; }
  function lineCenter(str, size, color = BLACK) {
    const s = String(str ?? "");
    txt(s, (W - font.widthOfTextAtSize(s, size)) / 2, size, color);
    y -= size * 1.6;
  }
  function gap(n = 1) { y -= 10 * n; }
  function checkPage(needed = 80) {
    ({ page, y } = ensurePage(pdf, page, y, needed));
  }

  // Title
  lineCenter(`Отчёт по закупке`, 16);
  lineCenter(procurement.title.slice(0, 55), 12, GRAY);
  gap(0.3);
  line(
    `${procurement.supplier.name} • ${procurement.settlement.region.name}, ${procurement.settlement.name} • ${procurement.pickupPoint.name}`,
    LM, 9, GRAY
  );
  gap(0.8);

  // Summary box
  line("Сводка", LM, 12);
  gap(0.2);
  const summaryRows = [
    ["Всего заявок", String(orders.length)],
    ["Сумма товаров", `${goodsTotalSum.toLocaleString("ru-RU")} руб.`],
    ["Сумма доставки", `${deliveryShareSum.toLocaleString("ru-RU")} руб.`],
    ["Итого к оплате", `${grandTotalSum.toLocaleString("ru-RU")} руб.`],
    ["Оплачено", String(paymentBreakdown.PAID + paymentBreakdown.PAY_ON_PICKUP)],
    ["Не оплачено", String(paymentBreakdown.UNPAID)],
    ["Выдано", `${issuedCount} / ${orders.length}`],
  ];
  for (const [label, val] of summaryRows) {
    txt(label, LM, 9, GRAY);
    txt(val, LM + 140, 9);
    y -= 9 * 1.6;
  }
  gap(1.2);

  // Orders table
  if (orders.length > 0) {
    checkPage();
    line("Заявки участников", LM, 12);
    gap(0.3);

    const ordersResult = drawTable({
      pdf, page, y, font,
      startX: LM,
      colWidths: [140, 60, 60, 65, 75, 55],
      headers: ["Участник", "Товары", "Доставка", "Итого", "Оплата", "Выдано"],
      rows: orders.map((o) => [
        (o.participantName ?? "—").slice(0, 20),
        (o.goodsTotal ?? 0).toLocaleString("ru-RU"),
        (o.deliveryShare ?? 0).toLocaleString("ru-RU"),
        (o.grandTotal ?? 0).toLocaleString("ru-RU"),
        (PAYMENT_LABELS[o.paymentStatus] ?? o.paymentStatus).slice(0, 11),
        o.checkin ? "Да" : "Нет",
      ]),
      rowHeight: 15,
      fontSize: 8,
      alignRightCols: [1, 2, 3],
    });
    page = ordersResult.page;
    y = ordersResult.y;
    checkPage(30);
    gap(1.2);
  }

  // Top categories
  if (topCategories.length > 0) {
    checkPage();
    line("Топ категорий", LM, 12);
    gap(0.3);
    const catResult = drawTable({
      pdf, page, y, font,
      startX: LM,
      colWidths: [320, 80, 75],
      headers: ["Категория", "Кол-во", "Сумма (руб.)"],
      rows: topCategories.map((c) => [
        c.name.slice(0, 48),
        String(c.qty),
        c.sum.toLocaleString("ru-RU"),
      ]),
      rowHeight: 15,
      fontSize: 8,
      alignRightCols: [1, 2],
    });
    page = catResult.page;
    y = catResult.y;
    checkPage(30);
    gap(1.2);
  }

  // Top products
  if (topProducts.length > 0) {
    checkPage();
    line("Топ товаров", LM, 12);
    gap(0.3);
    const prodResult = drawTable({
      pdf, page, y, font,
      startX: LM,
      colWidths: [320, 80, 75],
      headers: ["Товар", "Кол-во", "Сумма (руб.)"],
      rows: topProducts.map((p) => [
        p.name.slice(0, 48),
        String(p.qty),
        p.sum.toLocaleString("ru-RU"),
      ]),
      rowHeight: 15,
      fontSize: 8,
      alignRightCols: [1, 2],
    });
    page = prodResult.page;
    y = prodResult.y;
  }

  checkPage(25);
  gap(1.5);
  const ts = `Сформировано: ${new Date().toLocaleString("ru-RU")}`;
  page.drawText(ts, { x: RM - font.widthOfTextAtSize(ts, 7), y, size: 7, font, color: LGRAY });

  const bytes = await pdf.save();

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel: session.email,
      action: "EXPORT_DOC",
      entityType: "PROCUREMENT",
      entityId: id,
      meta: { type: "report_pdf", orderCount: orders.length },
    },
  });

  return toPdfResponse(bytes, `report_${id.slice(0, 8)}.pdf`);
}
