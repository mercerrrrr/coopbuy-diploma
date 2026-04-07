export function getProcurementState(procurement, submittedTotal = 0, now = new Date()) {
  const deadlineAt = new Date(procurement.deadlineAt);
  const deadlinePassed = deadlineAt.getTime() <= now.getTime();
  const minReached =
    (procurement.minTotalSum ?? 0) <= 0 || submittedTotal >= (procurement.minTotalSum ?? 0);
  const isOpen = procurement.status === "OPEN";
  const isActive = isOpen && !deadlinePassed;
  const closedBecauseMinNotReached = !isActive && deadlinePassed && !minReached;

  return {
    isOpen,
    isActive,
    deadlinePassed,
    minReached,
    closedBecauseMinNotReached,
    submittedTotal,
  };
}
