-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ONLINE_PAYMENT_REFUNDED';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundAmount" INTEGER,
ADD COLUMN     "refundedAt" TIMESTAMP(3);
