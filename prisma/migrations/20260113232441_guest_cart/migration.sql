-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "guestId" TEXT;

-- CreateIndex
CREATE INDEX "Order_procurementId_guestId_idx" ON "Order"("procurementId", "guestId");
