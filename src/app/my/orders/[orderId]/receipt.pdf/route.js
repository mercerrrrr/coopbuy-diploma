import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PAYMENT_LABELS } from "@/lib/constants";
import { buildActorAuditMeta, writeOrderAudit } from "@/lib/audit";
import { buildOrderDocumentFilename } from "@/lib/exportDocuments";
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
  const { orderId } = await params;

  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const userId = String(session.sub);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { include: { unit: true } } } },
      procurement: {
        include: {
          supplier: true,
          pickupPoint: true,
          settlement: { include: { region: true } },
        },
      },
      checkin: true,
    },
  });

  if (!order || order.userId !== userId || order.status !== "SUBMITTED") {
    return new Response("Not found", { status: 404 });
  }

  const { goodsTotal, deliveryShare } = getOrderTotals(order);
  const paymentLabel = PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus;
  const procurementClosed = order.procurement.status === "CLOSED";
  const p = order.procurement;
  const isCheckedIn = Boolean(order.checkin);
  const filename = buildOrderDocumentFilename(order.id, "receipt", "pdf");

  const { pdf, font } = await createPdfDoc();
  let page = pdf.addPage([W, H]);
  let y = H - LM;

  function txt(str, x, size, color = BLACK) {
    page.drawText(String(str ?? ""), { x, y, size, font, color });
  }
  function row(str, x, size, color = BLACK) { txt(str, x, size, color); y -= size * 1.6; }
  function rowRight(str, size, color = BLACK) {
    const s = String(str ?? "");
    txt(s, RM - font.widthOfTextAtSize(s, size), size, color);
    y -= size * 1.6;
  }
  function summaryRow(label, value, size, color = BLACK) {
    const labelText = String(label ?? "");
    const valueText = String(value ?? "");
    const summaryX = 360;
    txt(labelText, summaryX, size, color);
    page.drawText(valueText, {
      x: RM - font.widthOfTextAtSize(valueText, size),
      y,
      size,
      font,
      color,
    });
    y -= size * 1.7;
  }
  function rowCenter(str, size, color = BLACK) {
    const s = String(str ?? "");
    txt(s, (W - font.widthOfTextAtSize(s, size)) / 2, size, color);
    y -= size * 1.6;
  }
  function gap(n = 1) { y -= 10 * n; }
  function hline(color = LGRAY) {
    page.drawLine({ start: { x: LM, y }, end: { x: RM, y }, thickness: 0.5, color });
    y -= 6;
  }

  // Title
  rowCenter("Квитанция участника закупки", 16);
  gap(0.5);
  hline();

  // Procurement info
  ({ page, y } = drawParagraph(pdf, page, font, `Закупка: ${p.title}`, LM, y, 11, 470, 15, BLACK));
  ({ page, y } = drawParagraph(pdf, page, font, `Поставщик: ${p.supplier.name}`, LM, y, 10, 470, 14, GRAY));
  ({ page, y } = drawParagraph(pdf, page, font, `Населённый пункт: ${p.settlement.region.name} • ${p.settlement.name}`, LM, y, 10, 470, 14, GRAY));
  ({ page, y } = drawParagraph(pdf, page, font, `Пункт выдачи: ${p.pickupPoint.name}`, LM, y, 10, 470, 14, GRAY));
  if (p.pickupPoint.address) {
    ({ page, y } = drawParagraph(pdf, page, font, `Адрес: ${p.pickupPoint.address}`, LM, y, 10, 470, 14, GRAY));
  }
  if (p.pickupWindowStart) {
    const ws = `${new Date(p.pickupWindowStart).toLocaleString("ru-RU")}${
      p.pickupWindowEnd ? ` — ${new Date(p.pickupWindowEnd).toLocaleString("ru-RU")}` : ""
    }`;
    ({ page, y } = drawParagraph(pdf, page, font, `Окно выдачи: ${ws}`, LM, y, 10, 470, 14, GRAY));
  }
  if (p.pickupInstructions) {
    ({ page, y } = drawParagraph(pdf, page, font, `Инструкции: ${p.pickupInstructions}`, LM, y, 10, 470, 14, GRAY));
  }
  gap(0.5);
  hline();

  // Participant
  row(`Участник: ${order.participantName ?? "—"}`, LM, 11);
  if (order.participantPhone) row(`Телефон: ${order.participantPhone}`, LM, 10);
  row(`Статус выдачи: ${isCheckedIn ? "Выдано" : "Ожидает выдачи"}`, LM, 10);
  row(`ID заявки: ${order.id}`, LM, 9, GRAY);
  gap(0.8);

  // Items table
  const tableResult = drawTable({
    pdf,
    page,
    y,
    font,
    startX: LM,
    colWidths: [200, 55, 55, 65, 80],
    headers: ["Наименование", "Ед.", "Кол-во", "Цена (руб.)", "Сумма (руб.)"],
    rows: order.items.map((item) => [
      item.product.name,
      item.product.unit?.name ?? "шт",
      String(item.qty),
      item.price.toLocaleString("ru-RU"),
      (item.qty * item.price).toLocaleString("ru-RU"),
    ]),
    rowHeight: 16,
    fontSize: 9,
    alignRightCols: [2, 3, 4],
  });
  page = tableResult.page;
  y = tableResult.y;
  ({ page, y } = ensurePage(pdf, page, y, deliveryShare > 0 ? 100 : 84));

  gap(1.4);
  hline();
  gap(0.7);

  // Totals
  summaryRow("Товары", `${goodsTotal.toLocaleString("ru-RU")} руб.`, 12);
  summaryRow("Статус оплаты товаров", paymentLabel, 9, GRAY);
  if (deliveryShare > 0) {
    const deliveryLabel = procurementClosed ? "Доставка (при получении)" : "≈ Доставка (при получении)";
    const deliveryValue = procurementClosed
      ? `${deliveryShare.toLocaleString("ru-RU")} руб.`
      : `~${deliveryShare.toLocaleString("ru-RU")} руб.`;
    summaryRow(deliveryLabel, deliveryValue, 10, GRAY);
  }
  if (order.yookassaPaymentId) {
    summaryRow("ID платежа ЮKassa", order.yookassaPaymentId, 8, GRAY);
  }
  gap(1.5);
  const ts = `Сформировано: ${new Date().toLocaleString("ru-RU")}`;
  page.drawText(ts, { x: RM - font.widthOfTextAtSize(ts, 7), y, size: 7, font, color: LGRAY });

  const bytes = await pdf.save();

  await writeOrderAudit({
    actorType: "PUBLIC",
    actorLabel: session.email,
    action: "EXPORT_DOC",
    orderId: order.id,
    procurementId: order.procurementId,
    meta: buildActorAuditMeta(session, {
      type: "receipt_pdf",
      filename,
    }),
  });

  return toPdfResponse(bytes, filename);
}
