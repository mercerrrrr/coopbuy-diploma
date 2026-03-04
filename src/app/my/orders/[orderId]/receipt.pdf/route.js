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

  const goodsTotal = order.goodsTotal ?? order.items.reduce((s, i) => s + i.qty * i.price, 0);
  const deliveryShare = order.deliveryShare ?? 0;
  const grandTotal = order.grandTotal ?? goodsTotal;
  const paymentLabel = {
    UNPAID: "Не оплачено", PAID: "Оплачено", PAY_ON_PICKUP: "Оплата при выдаче",
  }[order.paymentStatus] ?? order.paymentStatus;
  const p = order.procurement;
  const isCheckedIn = Boolean(order.checkin);

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
  row(`Закупка: ${p.title.slice(0, 60)}`, LM, 11);
  row(`Поставщик: ${p.supplier.name.slice(0, 55)}`, LM, 10, GRAY);
  row(`НП: ${p.settlement.region.name} • ${p.settlement.name}`, LM, 10, GRAY);
  row(`Пункт выдачи: ${p.pickupPoint.name}`, LM, 10, GRAY);
  if (p.pickupPoint.address) {
    row(`Адрес: ${p.pickupPoint.address.slice(0, 60)}`, LM, 10, GRAY);
  }
  if (p.pickupWindowStart) {
    const ws = `${new Date(p.pickupWindowStart).toLocaleString("ru-RU")}${
      p.pickupWindowEnd ? ` — ${new Date(p.pickupWindowEnd).toLocaleString("ru-RU")}` : ""
    }`;
    row(`Окно выдачи: ${ws}`, LM, 10, GRAY);
  }
  if (p.pickupInstructions) row(`Инструкции: ${p.pickupInstructions.slice(0, 65)}`, LM, 10, GRAY);
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
      item.product.name.slice(0, 30),
      (item.product.unit?.name ?? "шт").slice(0, 8),
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
  ({ page, y } = ensurePage(pdf, page, y, 80));

  gap(0.5);
  // Totals
  if (deliveryShare > 0) {
    rowRight(`Товары: ${goodsTotal.toLocaleString("ru-RU")} руб.`, 10);
    rowRight(`Доставка: ${deliveryShare.toLocaleString("ru-RU")} руб.`, 10);
  }
  rowRight(`К оплате: ${grandTotal.toLocaleString("ru-RU")} руб.`, 12);
  rowRight(`Статус оплаты: ${paymentLabel}`, 9, GRAY);
  gap(1.5);
  const ts = `Сформировано: ${new Date().toLocaleString("ru-RU")}`;
  page.drawText(ts, { x: RM - font.widthOfTextAtSize(ts, 7), y, size: 7, font, color: LGRAY });

  const bytes = await pdf.save();
  const filename = `receipt_${order.id.slice(0, 8)}.pdf`;

  await prisma.auditLog.create({
    data: {
      actorType: "PUBLIC",
      actorLabel: String(session.email),
      action: "EXPORT_DOC",
      entityType: "ORDER",
      entityId: order.procurementId,
      meta: { orderId: order.id, doc: "receipt" },
    },
  });

  return toPdfResponse(bytes, filename);
}
