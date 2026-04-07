import { prisma } from "@/lib/db";
import { requireOperatorOrAdminRoute } from "@/lib/guards";
import { PAYMENT_LABELS } from "@/lib/constants";
import { buildActorAuditMeta, writeProcurementAudit } from "@/lib/audit";
import { buildProcurementDocumentFilename } from "@/lib/exportDocuments";
import { createPdfDoc, toPdfResponse } from "@/lib/pdfDoc";
import { drawTable } from "@/lib/pdfTable";
import { drawParagraph, ensurePage } from "@/lib/pdfLayout";
import { getOrderTotals } from "@/lib/orders";
import { rgb } from "pdf-lib";

export const runtime = "nodejs";

const W = 595.28, H = 841.89, LM = 40, RM = 555;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.33, 0.33, 0.33);
const LGRAY = rgb(0.73, 0.73, 0.73);

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

  const filename = buildProcurementDocumentFilename(procurement.inviteCode, "report", "pdf");

  const orders = await prisma.order.findMany({
    where: { procurementId: id, status: "SUBMITTED" },
    include: {
      items: { include: { product: { include: { category: true, unit: true } } } },
      checkin: true,
    },
    orderBy: { participantName: "asc" },
  });

  // Aggregations
  const orderTotals = orders.map((order) => getOrderTotals(order));
  const goodsTotalSum = orderTotals.reduce((sum, order) => sum + order.goodsTotal, 0);
  const deliveryShareSum = orderTotals.reduce((sum, order) => sum + order.deliveryShare, 0);
  const grandTotalSum = orderTotals.reduce((sum, order) => sum + order.grandTotal, 0);
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
  function summaryRow(label, value) {
    const labelText = String(label ?? "");
    const valueText = String(value ?? "");
    txt(labelText, LM, 9, GRAY);
    page.drawText(valueText, {
      x: 220,
      y,
      size: 9,
      font,
      color: BLACK,
    });
    y -= 9 * 1.7;
  }
  function gap(n = 1) { y -= 10 * n; }
  function checkPage(needed = 80) {
    ({ page, y } = ensurePage(pdf, page, y, needed));
  }
  function hline(color = LGRAY) {
    page.drawLine({ start: { x: LM, y }, end: { x: RM, y }, thickness: 0.5, color });
    y -= 6;
  }

  // Title
  lineCenter("Отчёт по закупке", 16);
  gap(0.4);
  hline();
  gap(0.6);
  ({ page, y } = drawParagraph(pdf, page, font, procurement.title, LM, y, 12, 470, 16, GRAY));
  gap(0.2);
  ({ page, y } = drawParagraph(
    pdf,
    page,
    font,
    `${procurement.supplier.name} • ${procurement.settlement.region.name}, ${procurement.settlement.name} • ${procurement.pickupPoint.name}`,
    LM,
    y,
    9,
    470,
    13,
    GRAY
  ));
  gap(0.8);
  hline();
  gap(0.7);

  // Summary box
  line("Сводка", LM, 12);
  gap(0.4);
  const summaryRows = [
    ["Всего заявок", String(orders.length)],
    ["Сумма товаров", `${goodsTotalSum.toLocaleString("ru-RU")} руб.`],
    ["Сумма доставки", `${deliveryShareSum.toLocaleString("ru-RU")} руб.`],
    ["Итого к оплате", `${grandTotalSum.toLocaleString("ru-RU")} руб.`],
    ["Оплачено", String(paymentBreakdown.PAID)],
    ["Оплата при выдаче", String(paymentBreakdown.PAY_ON_PICKUP)],
    ["Не оплачено", String(paymentBreakdown.UNPAID)],
    ["Выдано", `${issuedCount} / ${orders.length}`],
  ];
  for (const [label, val] of summaryRows) {
    summaryRow(label, val);
  }
  gap(0.5);
  hline();
  gap(0.8);

  // Orders table
  if (orders.length > 0) {
    checkPage();
    line("Заявки участников", LM, 12);
    gap(0.4);

    const ordersResult = drawTable({
      pdf, page, y, font,
      startX: LM,
      colWidths: [125, 60, 60, 65, 90, 55],
      headers: ["Участник", "Товары", "Доставка", "Итого", "Оплата", "Выдано"],
      rows: orders.map((order) => {
        const { goodsTotal, deliveryShare, grandTotal } = getOrderTotals(order);
        return [
          order.participantName ?? "—",
          goodsTotal.toLocaleString("ru-RU"),
          deliveryShare.toLocaleString("ru-RU"),
          grandTotal.toLocaleString("ru-RU"),
          PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus,
          order.checkin ? "Да" : "Нет",
        ];
      }),
      rowHeight: 15,
      fontSize: 8,
      alignRightCols: [1, 2, 3],
    });
    page = ordersResult.page;
    y = ordersResult.y;
    checkPage(36);
    gap(0.8);
    hline();
    gap(0.8);
  }

  // Top categories
  if (topCategories.length > 0) {
    checkPage();
    line("Топ категорий", LM, 12);
    gap(0.4);
    const catResult = drawTable({
      pdf, page, y, font,
      startX: LM,
      colWidths: [320, 80, 75],
      headers: ["Категория", "Кол-во", "Сумма (руб.)"],
      rows: topCategories.map((c) => [
        c.name,
        String(c.qty),
        c.sum.toLocaleString("ru-RU"),
      ]),
      rowHeight: 15,
      fontSize: 8,
      alignRightCols: [1, 2],
    });
    page = catResult.page;
    y = catResult.y;
    checkPage(36);
    gap(0.8);
    hline();
    gap(0.8);
  }

  // Top products
  if (topProducts.length > 0) {
    checkPage();
    line("Топ товаров", LM, 12);
    gap(0.4);
    const prodResult = drawTable({
      pdf, page, y, font,
      startX: LM,
      colWidths: [320, 80, 75],
      headers: ["Товар", "Кол-во", "Сумма (руб.)"],
      rows: topProducts.map((p) => [
        p.name,
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

  checkPage(28);
  gap(0.8);
  hline();
  gap(0.8);
  const ts = `Сформировано: ${new Date().toLocaleString("ru-RU")}`;
  page.drawText(ts, { x: RM - font.widthOfTextAtSize(ts, 7), y, size: 7, font, color: LGRAY });

  const bytes = await pdf.save();

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel: String(session?.email ?? "admin"),
    action: "EXPORT_DOC",
    procurementId: id,
    meta: buildActorAuditMeta(session, {
      type: "report_pdf",
      orderCount: orders.length,
      inviteCode: procurement.inviteCode,
      filename,
    }),
  });

  return toPdfResponse(bytes, filename);
}
