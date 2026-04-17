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

  const report = await prisma.receivingReport.findUnique({
    where: { procurementId: id },
    include: {
      procurement: { select: { inviteCode: true, pickupPointId: true } },
      lines: {
        include: { product: { select: { name: true } } },
        orderBy: { product: { name: "asc" } },
      },
    },
  });

  if (!report) {
    return new Response("Акт приёмки не найден", { status: 404 });
  }

  const { session, response } = await requireOperatorOrAdminRoute(report.procurement.pickupPointId);
  if (response) return response;

  const lines = [
    csvRow(["Наименование", "Ожидалось", "Получено", "Расхождение", "Комментарий"]),
    ...report.lines.map((l) =>
      csvRow([
        l.product.name,
        l.expectedQty,
        l.receivedQty,
        l.receivedQty - l.expectedQty,
        l.comment ?? "",
      ])
    ),
  ];

  const csv = "\uFEFF" + lines.join("\r\n");
  const filename = buildProcurementDocumentFilename(
    report.procurement.inviteCode,
    "receiving",
    "csv"
  );

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel: session.email,
    action: "EXPORT_DOC",
    procurementId: id,
    meta: buildActorAuditMeta(session, {
      type: "receiving_csv",
      rowCount: report.lines.length,
      inviteCode: report.procurement.inviteCode,
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
