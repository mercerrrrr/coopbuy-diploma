import { describe, it, expect } from "vitest";
import {
  assertOrderBelongsToProcurement,
  assertOrderCanCheckin,
} from "./checkinGuard";

// ── assertOrderBelongsToProcurement ──────────────────────────────────────────

describe("assertOrderBelongsToProcurement()", () => {
  it("не бросает исключение, если procurementId совпадает", () => {
    const order = { procurementId: "proc-1", status: "SUBMITTED", paymentStatus: "PAID" };
    expect(() => assertOrderBelongsToProcurement(order, "proc-1")).not.toThrow();
  });

  it("бросает ошибку если procurementId не совпадает", () => {
    const order = { procurementId: "proc-2", status: "SUBMITTED", paymentStatus: "PAID" };
    expect(() => assertOrderBelongsToProcurement(order, "proc-1")).toThrow(
      "не принадлежит"
    );
  });

  it("бросает ошибку если order равен null", () => {
    expect(() => assertOrderBelongsToProcurement(null, "proc-1")).toThrow("не найдена");
  });

  it("бросает ошибку если order равен undefined", () => {
    expect(() => assertOrderBelongsToProcurement(undefined, "proc-1")).toThrow("не найдена");
  });
});

// ── assertOrderCanCheckin ─────────────────────────────────────────────────────

describe("assertOrderCanCheckin()", () => {
  it("не бросает исключение для SUBMITTED + PAID", () => {
    const order = { status: "SUBMITTED", paymentStatus: "PAID" };
    expect(() => assertOrderCanCheckin(order)).not.toThrow();
  });

  it("не бросает исключение для SUBMITTED + PAY_ON_PICKUP", () => {
    const order = { status: "SUBMITTED", paymentStatus: "PAY_ON_PICKUP" };
    expect(() => assertOrderCanCheckin(order)).not.toThrow();
  });

  it("бросает ошибку если order не SUBMITTED (DRAFT)", () => {
    const order = { status: "DRAFT", paymentStatus: "PAID" };
    expect(() => assertOrderCanCheckin(order)).toThrow("подтверждённую");
  });

  it("бросает ошибку если order не SUBMITTED (CANCELED)", () => {
    const order = { status: "CANCELED", paymentStatus: "PAID" };
    expect(() => assertOrderCanCheckin(order)).toThrow("подтверждённую");
  });

  it("бросает ошибку если paymentStatus UNPAID", () => {
    const order = { status: "SUBMITTED", paymentStatus: "UNPAID" };
    expect(() => assertOrderCanCheckin(order)).toThrow("не оплачена");
  });

  it("бросает ошибку если order равен null", () => {
    expect(() => assertOrderCanCheckin(null)).toThrow("не найдена");
  });
});
