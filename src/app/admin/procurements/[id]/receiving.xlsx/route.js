import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(_req, { params }) {
  const { id } = await params;

  const procurement = await prisma.procurement.findUnique({
    where: { id },
    select: { id: true, inviteCode: true },
  });
  if (!procurement) return new Response("Not found", { status: 404 });

  const report = await prisma.receivingReport.findUnique({
    where: { procurementId: id },
    include: {
      lines: {
        include: { product: { select: { name: true, unit: { select: { name: true } } } } },
        orderBy: { product: { name: "asc" } },
      },
    },
  });

  if (!report) {
    return new Response("Акт приёмки отсутствует", { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CoopBuy";
  const sheet = workbook.addWorksheet("Receiving");

  sheet.columns = [
    { header: "Наименование", key: "name", width: 35 },
    { header: "Ед.", key: "unit", width: 10 },
    { header: "Ожидалось", key: "expected", width: 14 },
    { header: "Получено", key: "received", width: 14 },
    { header: "Δ", key: "delta", width: 10 },
    { header: "Комментарий", key: "comment", width: 30 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };

  for (const line of report.lines) {
    const delta = line.receivedQty - line.expectedQty;
    const row = sheet.addRow({
      name: line.product.name,
      unit: line.product.unit.name,
      expected: line.expectedQty,
      received: line.receivedQty,
      delta,
      comment: line.comment ?? "",
    });
    if (delta !== 0) {
      row.getCell("delta").font = {
        bold: true,
        color: { argb: delta < 0 ? "FFCC0000" : "FF006600" },
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();

  const session = await getSession();
  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel: String(session?.email ?? "admin"),
      action: "EXPORT_DOC",
      entityType: "PROCUREMENT",
      entityId: id,
      meta: { type: "xlsx_receiving", inviteCode: procurement.inviteCode },
    },
  });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="procurement_${procurement.inviteCode}_receiving.xlsx"`,
    },
  });
}
