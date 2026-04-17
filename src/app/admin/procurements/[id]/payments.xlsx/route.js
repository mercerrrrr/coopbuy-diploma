import { prisma } from "@/lib/db";
import { requireOperatorOrAdminRoute } from "@/lib/guards";
import { PAYMENT_LABELS } from "@/lib/constants";
import { buildActorAuditMeta, writeProcurementAudit } from "@/lib/audit";
import { buildProcurementDocumentFilename } from "@/lib/exportDocuments";
import { getOrderTotals } from "@/lib/orders";
import ExcelJS from "exceljs";

export async function GET(_req, { params }) {
  const { id } = await params;

  const procurement = await prisma.procurement.findUnique({
    where: { id },
    select: { pickupPointId: true, inviteCode: true },
  });
  if (!procurement) return new Response("Not found", { status: 404 });

  const { session, response } = await requireOperatorOrAdminRoute(procurement.pickupPointId);
  if (response) return response;
  const filename = buildProcurementDocumentFilename(procurement.inviteCode, "payments", "xlsx");

  const orders = await prisma.order.findMany({
    where: { procurementId: id, status: "SUBMITTED" },
    orderBy: { participantName: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "CoopBuy";
  const ws = wb.addWorksheet("Orders");

  ws.columns = [
    { header: "Участник", key: "name", width: 25 },
    { header: "Телефон", key: "phone", width: 18 },
    { header: "Товары, ₽", key: "goodsTotal", width: 14 },
    { header: "Доставка, ₽", key: "deliveryShare", width: 14 },
    { header: "Итого, ₽", key: "grandTotal", width: 14 },
    { header: "Статус оплаты", key: "paymentStatus", width: 18 },
    { header: "Оплачено в", key: "paidAt", width: 22 },
    { header: "Способ оплаты", key: "paymentMethod", width: 18 },
    { header: "ID платежа ЮKassa", key: "yookassaPaymentId", width: 36 },
  ];

  // Bold header row
  ws.getRow(1).font = { bold: true };

  for (const order of orders) {
    const { goodsTotal, deliveryShare, grandTotal } = getOrderTotals(order);
    ws.addRow({
      name: order.participantName ?? "",
      phone: order.participantPhone ?? "",
      goodsTotal,
      deliveryShare,
      grandTotal,
      paymentStatus: PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus,
      paidAt: order.paidAt ? new Date(order.paidAt).toLocaleString("ru-RU") : "",
      paymentMethod: order.paymentMethod ?? "",
      yookassaPaymentId: order.yookassaPaymentId ?? "",
    });
  }

  const buf = await wb.xlsx.writeBuffer();

  await writeProcurementAudit({
    actorType: "ADMIN",
    actorLabel: session.email,
    action: "EXPORT_DOC",
    procurementId: id,
    meta: buildActorAuditMeta(session, {
      type: "payments_xlsx",
      orderCount: orders.length,
      inviteCode: procurement.inviteCode,
      filename,
    }),
  });

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
