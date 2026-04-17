-- AlterEnum
ALTER TYPE "ImportBatchStatus" ADD VALUE 'REVERTED';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'REVERT_PRICE_LIST';

-- AlterTable PriceImportBatch: apply/revert timestamps
ALTER TABLE "PriceImportBatch"
  ADD COLUMN "appliedAt"  TIMESTAMP(3),
  ADD COLUMN "revertedAt" TIMESTAMP(3);

-- AlterTable PriceImportRow: snapshot for undo + resolved productId
ALTER TABLE "PriceImportRow"
  ADD COLUMN "appliedProductId" TEXT,
  ADD COLUMN "previousPrice"    INTEGER,
  ADD COLUMN "previousActive"   BOOLEAN;

-- CreateIndex PriceImportRow(batchId, status) — batch view filters
CREATE INDEX "PriceImportRow_batchId_status_idx"
  ON "PriceImportRow"("batchId", "status");

-- CreateIndex Procurement(settlementId, status, deadlineAt) — dashboard + filters
CREATE INDEX "Procurement_settlementId_status_deadlineAt_idx"
  ON "Procurement"("settlementId", "status", "deadlineAt");

-- CreateIndex OrderItem(orderId) + OrderItem(productId) — top-products/orders reports
CREATE INDEX "OrderItem_orderId_idx"   ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex AuditLog(createdAt) — sort by time in admin UI
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
