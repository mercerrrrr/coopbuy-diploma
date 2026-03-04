import { prisma } from "@/lib/db";

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
      procurement: { select: { inviteCode: true } },
      lines: {
        include: { product: { select: { name: true } } },
        orderBy: { product: { name: "asc" } },
      },
    },
  });

  if (!report) {
    return new Response("Акт приёмки не найден", { status: 404 });
  }

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
  const filename = `receiving_${report.procurement.inviteCode}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
