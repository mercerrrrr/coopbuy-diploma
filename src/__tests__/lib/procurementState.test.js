import { describe, expect, it } from "vitest";

import { getProcurementState } from "@/lib/procurements/state";

describe("getProcurementState()", () => {
  it("считает активную открытую закупку", () => {
    const state = getProcurementState(
      {
        status: "OPEN",
        deadlineAt: "2099-01-01T00:00:00.000Z",
        minTotalSum: 1000,
      },
      1200,
      new Date("2026-03-01T00:00:00.000Z")
    );

    expect(state.isActive).toBe(true);
    expect(state.minReached).toBe(true);
    expect(state.closedBecauseMinNotReached).toBe(false);
  });

  it("отмечает закрытие из-за недобора после дедлайна", () => {
    const state = getProcurementState(
      {
        status: "CLOSED",
        deadlineAt: "2026-02-01T00:00:00.000Z",
        minTotalSum: 5000,
      },
      1800,
      new Date("2026-03-01T00:00:00.000Z")
    );

    expect(state.deadlinePassed).toBe(true);
    expect(state.minReached).toBe(false);
    expect(state.closedBecauseMinNotReached).toBe(true);
  });
});
