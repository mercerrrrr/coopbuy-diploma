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
 *   - paymentStatus must not be UNPAID
 * Throws descriptive Error on violation.
 */
export function assertOrderCanCheckin(order) {
  if (!order) throw new Error("Заявка не найдена.");
  if (order.status !== "SUBMITTED") {
    throw new Error("Выдать можно только подтверждённую заявку.");
  }
  if (order.paymentStatus === "UNPAID") {
    throw new Error(
      "Заявка не оплачена. Выдача возможна только при статусе PAID или PAY_ON_PICKUP."
    );
  }
}
