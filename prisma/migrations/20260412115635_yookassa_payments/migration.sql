-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ONLINE_PAYMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ONLINE_PAYMENT_SUCCEEDED';
ALTER TYPE "AuditAction" ADD VALUE 'ONLINE_PAYMENT_FAILED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentAttempt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "yookassaPaymentId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Order_procurementId_status_idx" ON "Order"("procurementId", "status");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE INDEX "Order_yookassaPaymentId_idx" ON "Order"("yookassaPaymentId");
