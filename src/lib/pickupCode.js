/**
 * Generates a unique 6-digit pickup code within a Prisma transaction.
 */
export async function generateUniquePickupCode(tx, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await tx.order.findUnique({
      where: { pickupCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Не удалось сгенерировать уникальный код получения.");
}
