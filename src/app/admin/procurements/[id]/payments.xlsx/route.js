import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import ExcelJS from "exceljs";

const PAYMENT_LABELS = {
  UNPAID: "Не оплачено",
  PAID: "Оплачено",
  PAY_ON_PICKUP: "При выдаче",
};

export async function GET(_req, { params }) {
  const { id } = await params;

  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATOR")) {
    return new Response("Unauthorized", { status: 401 });
  }

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
  ];

  // Bold header row
  ws.getRow(1).font = { bold: true };

  for (const order of orders) {
    const goodsTotal = order.goodsTotal ?? 0;
    const deliveryShare = order.deliveryShare ?? 0;
    const grandTotal = order.grandTotal ?? goodsTotal;
    ws.addRow({
      name: order.participantName ?? "",
      phone: order.participantPhone ?? "",
      goodsTotal,
      deliveryShare,
      grandTotal,
      paymentStatus: PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus,
      paidAt: order.paidAt ? new Date(order.paidAt).toLocaleString("ru-RU") : "",
      paymentMethod: order.paymentMethod ?? "",
    });
  }

  const buf = await wb.xlsx.writeBuffer();

  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      actorLabel: session.email,
      action: "EXPORT_DOC",
      entityType: "PROCUREMENT",
      entityId: id,
      meta: { type: "payments_xlsx", orderCount: orders.length },
    },
  });

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="payments_${id.slice(0, 8)}.xlsx"`,
    },
  });
}
