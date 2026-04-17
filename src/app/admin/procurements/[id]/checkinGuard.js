/**
 * Pure guard functions for checkin validation.
 * No DB access — accepts plain objects so they can be unit-tested.
 */

/**
 * Asserts that an order belongs to the given procurement.
 * Throws Error if procurementId doesn't match.
 */
export function assertOrderBelongsToProcurement(order, procurementId) {
  if (!order) throw new Error("Заявка не найдена.");
  if (order.procurementId !== procurementId) {
    throw new Error("Заявка не принадлежит данной закупке.");
  }
}

/**
 * Asserts that an order can be checked in:
 *   - status must be SUBMITTED
 *   - paymentStatus must not be REFUNDED
 * Delivery is paid separately at pickup, so UNPAID is allowed.
 */
export function assertOrderCanCheckin(order) {
  if (!order) throw new Error("Заявка не найдена.");
  if (order.status !== "SUBMITTED") {
    throw new Error("Выдать можно только подтверждённую заявку.");
  }
  if (order.paymentStatus === "REFUNDED") {
    throw new Error(
      "Заявка с возвратом средств. Выдача невозможна."
    );
  }
}

/**
 * Asserts that a pickup session belongs to the procurement and can accept check-ins.
 */
export function assertPickupSessionCanCheckin(pickupSession, procurementId) {
  if (!pickupSession) throw new Error("Сессия выдачи не найдена.");
  if (pickupSession.procurementId !== procurementId) {
    throw new Error("Сессия выдачи не принадлежит данной закупке.");
  }
  if (pickupSession.status === "CLOSED") {
    throw new Error("Сессия выдачи уже закрыта.");
  }
}
