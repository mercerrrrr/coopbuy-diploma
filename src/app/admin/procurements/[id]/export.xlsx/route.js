import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireOperatorOrAdminRoute } from "@/lib/guards";
import { buildActorAuditMeta, writeProcurementAudit } from "@/lib/audit";
import { buildProcurementDocumentFilename } from "@/lib/exportDocuments";

export async function GET(_req, { params }) {
  const { id } = await params;

  const procurement = await prisma.procurement.findUnique({
    where: { id },
    select: { id: true, title: true, inviteCode: true, pickupPointId: true },
  });
  if (!procurement) return new Response("Not found", { status: 404 });

  const { session, response } = await requireOperatorOrAdminRoute(procurement.pickupPointId);
  if (response) return response;
  const filename = buildProcurementDocumentFilename(procurement.inviteCode, "agg", "xlsx");

  const orders = await prisma.order.findMany({
    where: { procurementId: id, status: "SUBMITTED" },
    include: { items: { include: { product: { include: { category: true, unit: true } } } } },
  });

  // Aggregate by product
  const aggMap = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      const p = item.product;
      if (!aggMap.has(p.id)) {
        aggMap.set(p.id, {
          name: p.name,
          category: p.category.name,
          unit: p.unit.name,
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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CoopBuy";
  const sheet = workbook.addWorksheet("Aggregation");

  sheet.columns = [
    { header: "Наименование", key: "name", width: 35 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Ед.", key: "unit", width: 10 },
    { header: "Кол-во", key: "qty", width: 12 },
    { header: "Сумма, ₽", key: "sum", width: 15 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };

  for (const row of rows) {
    sheet.addRow({
      name: row.name,
      category: row.category,
      unit: row.unit,
      qty: row.totalQty,
      sum: row.totalSum,
    });
  }

  // Total row
  const totalRow = sheet.addRow({ name: "Итого", category: "", unit: "", qty: "", sum: grandTotal });
  totalRow.font = { bold: true };
  totalRow.getCell("sum").font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel: String(session?.email ?? "admin"),
    action: "EXPORT_DOC",
    procurementId: id,
    meta: buildActorAuditMeta(session, {
      type: "export_xlsx",
      inviteCode: procurement.inviteCode,
      filename,
    }),
  });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
