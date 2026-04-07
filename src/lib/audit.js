import { prisma } from "@/lib/db";

function normalizeMeta(meta = {}) {
  return Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined)
  );
}

export function buildActorAuditMeta(session, meta = {}) {
  return normalizeMeta({
    actorRole: session?.role,
    actorUserId: session?.sub ? String(session.sub) : undefined,
    actorPickupPointId: session?.pickupPointId
      ? String(session.pickupPointId)
      : undefined,
    actorSettlementId: session?.settlementId
      ? String(session.settlementId)
      : undefined,
    ...meta,
  });
}

export async function writeProcurementAudit({
  actorType,
  actorLabel,
  action,
  procurementId,
  orderId,
  meta,
}) {
  if (!procurementId) {
    throw new Error("procurementId is required for procurement audit log entries.");
  }

  const fullMeta = normalizeMeta({
    procurementId,
    orderId,
    ...meta,
  });

  await prisma.auditLog.create({
    data: {
      actorType,
      actorLabel: String(actorLabel ?? "system"),
      action,
      entityType: "PROCUREMENT",
      entityId: procurementId,
      meta: Object.keys(fullMeta).length > 0 ? fullMeta : undefined,
    },
  });
}

export async function writeOrderAudit({
  actorType,
  actorLabel,
  action,
  orderId,
  procurementId,
  meta,
}) {
  if (!orderId) {
    throw new Error("orderId is required for order audit log entries.");
  }

  const fullMeta = normalizeMeta({
    procurementId,
    orderId,
    ...meta,
  });

  await prisma.auditLog.create({
    data: {
      actorType,
      actorLabel: String(actorLabel ?? "system"),
      action,
      entityType: "ORDER",
      entityId: orderId,
      meta: Object.keys(fullMeta).length > 0 ? fullMeta : undefined,
    },
  });
}

export function buildProcurementAuditWhere(procurementId, orderIds = []) {
  const where = [{ entityType: "PROCUREMENT", entityId: procurementId }];

  if (orderIds.length > 0) {
    where.push({ entityType: "ORDER", entityId: { in: orderIds } });
  }

  return { OR: where };
}
