/**
 * Closes all OPEN procurements whose deadline has passed.
 * Call this at the top of any page that lists procurements.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {Date} [now]
 * @returns {Promise<number>} count of closed procurements
 */
export async function autoCloseExpiredProcurements(prisma, now = new Date()) {
  const { count } = await prisma.procurement.updateMany({
    where: { status: "OPEN", deadlineAt: { lte: now } },
    data: { status: "CLOSED" },
  });
  return count;
}
