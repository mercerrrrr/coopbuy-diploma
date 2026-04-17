import { prisma } from "@/lib/db";
import { requireOperatorOrAdminRoute } from "@/lib/guards";
import { buildActorAuditMeta, writeProcurementAudit } from "@/lib/audit";
import { buildProcurementDocumentFilename } from "@/lib/exportDocuments";

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(";") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(fields) {
  return fields.map(csvEscape).join(";");
}

export async function GET(_req, { params }) {
  const { id } = await params;

  const procurement = await prisma.procurement.findUnique({
    where: { id },
    select: { inviteCode: true, title: true, pickupPointId: true },
  });

  if (!procurement) {
    return new Response("Not found", { status: 404 });
  }

  const { session, response } = await requireOperatorOrAdminRoute(procurement.pickupPointId);
  if (response) return response;

  const orders = await prisma.order.findMany({
    where: { procurementId: id, status: "SUBMITTED" },
    include: {
      items: { include: { product: { include: { category: true, unit: true } } } },
    },
  });

  // Агрегация по продукту
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

  const rows = aggMap.size > 0
    ? Array.from(aggMap.values()).sort((a, b) => b.totalSum - a.totalSum)
    : [];

  const lines = [
    csvRow(["Наименование", "Категория", "Ед. изм.", "Кол-во", "Сумма (руб.)"]),
    ...rows.map((r) => csvRow([r.name, r.category, r.unit, r.totalQty, r.totalSum])),
  ];

  // BOM для корректного открытия в Excel
  const csv = "\uFEFF" + lines.join("\r\n");
  const filename = buildProcurementDocumentFilename(procurement.inviteCode, "agg", "csv");

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel: session.email,
    action: "EXPORT_DOC",
    procurementId: id,
    meta: buildActorAuditMeta(session, {
      type: "export_csv",
      rowCount: rows.length,
      inviteCode: procurement.inviteCode,
      filename,
    }),
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
