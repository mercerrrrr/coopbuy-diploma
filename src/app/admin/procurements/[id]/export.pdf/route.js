import { prisma } from "@/lib/db";
import { requireOperatorOrAdminRoute } from "@/lib/guards";
import { buildActorAuditMeta, writeProcurementAudit } from "@/lib/audit";
import { buildProcurementDocumentFilename } from "@/lib/exportDocuments";
import { createPdfDoc, toPdfResponse } from "@/lib/pdfDoc";
import { drawTable } from "@/lib/pdfTable";
import { drawParagraph, ensurePage } from "@/lib/pdfLayout";
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

  if (!procurement) return new Response("Not found", { status: 404 });

  const { session, response } = await requireOperatorOrAdminRoute(procurement.pickupPointId);
  if (response) return response;
  const filename = buildProcurementDocumentFilename(procurement.inviteCode, "agg", "pdf");

  const orders = await prisma.order.findMany({
    where: { procurementId: id, status: "SUBMITTED" },
    include: { items: { include: { product: { include: { unit: true, category: true } } } } },
  });

  const aggMap = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      const p = item.product;
      if (!aggMap.has(p.id)) {
        aggMap.set(p.id, {
          name: p.name,
          category: p.category?.name ?? "—",
          unit: p.unit?.name ?? "шт",
          totalQty: 0,
          totalSum: 0,
        });
      }
      const agg = aggMap.get(p.id);
      agg.totalQty += item.qty;
      agg.totalSum += item.qty * item.price;
    }
  }
  const rows = Array.from(aggMap.values()).sort((a, b) => b.totalSum - a.totalSum);
  const grandTotal = rows.reduce((s, r) => s + r.totalSum, 0);

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
  function gap(n = 1) { y -= 10 * n; }
  function hline(color = LGRAY) {
    page.drawLine({ start: { x: LM, y }, end: { x: RM, y }, thickness: 0.5, color });
    y -= 6;
  }

  ({ page, y } = drawParagraph(pdf, page, font, `Закупка: ${procurement.title}`, LM, y, 16, 470, 24, BLACK));
  gap(0.1);
  ({ page, y } = drawParagraph(pdf, page, font, `Поставщик: ${procurement.supplier.name}`, LM, y, 10, 470, 14, GRAY));
  ({ page, y } = drawParagraph(pdf, page, font, `Населённый пункт: ${procurement.settlement.region.name} • ${procurement.settlement.name}`, LM, y, 10, 470, 14, GRAY));
  ({ page, y } = drawParagraph(pdf, page, font, `Пункт выдачи: ${procurement.pickupPoint.name}`, LM, y, 10, 470, 14, GRAY));
  row(`Дедлайн: ${new Date(procurement.deadlineAt).toLocaleString("ru-RU")}`, LM, 10, GRAY);
  row(`Мин. сбор: ${procurement.minTotalSum.toLocaleString("ru-RU")} руб.`, LM, 10, GRAY);
  gap(0.6);
  hline();
  gap(0.8);

  if (rows.length === 0) {
    row("Нет подтверждённых заявок.", LM, 10, GRAY);
  } else {
    // Table: Наименование | Категория | Ед. | Кол-во | Сумма
    const result = drawTable({
      pdf,
      page,
      y,
      font,
      startX: LM,
      colWidths: [170, 100, 50, 60, 95],
      headers: ["Наименование", "Категория", "Ед.", "Кол-во", "Сумма (руб.)"],
      rows: rows.map((r) => [
        r.name,
        r.category,
        r.unit,
        String(r.totalQty),
        r.totalSum.toLocaleString("ru-RU"),
      ]),
      rowHeight: 16,
      fontSize: 8,
      alignRightCols: [3, 4],
    });
    page = result.page;
    y = result.y;
    ({ page, y } = ensurePage(pdf, page, y, 52));

    gap(1.2);
    hline();
    gap(0.7);
    summaryRow("Итого", `${grandTotal.toLocaleString("ru-RU")} руб.`, 10);
  }

  ({ page, y } = ensurePage(pdf, page, y, 24));
  gap(0.8);
  const ts = `Сформировано: ${new Date().toLocaleString("ru-RU")}`;
  rowRight(ts, 7, LGRAY);

  const bytes = await pdf.save();

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel: session.email,
    action: "EXPORT_DOC",
    procurementId: id,
    meta: buildActorAuditMeta(session, {
      type: "export_pdf",
      rowCount: rows.length,
      inviteCode: procurement.inviteCode,
      filename,
    }),
  });

  return toPdfResponse(bytes, filename);
}
