-- CreateEnum
CREATE TYPE "DeliverySplitMode" AS ENUM ('PROPORTIONAL_SUM', 'EQUAL', 'PER_ITEM');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'PAY_ON_PICKUP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_DELIVERY_SETTINGS';
ALTER TYPE "AuditAction" ADD VALUE 'RECALC_DELIVERY_SHARES';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_PAYMENT_STATUS';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryShare" INTEGER,
ADD COLUMN     "goodsTotal" INTEGER,
ADD COLUMN     "grandTotal" INTEGER,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- AlterTable
ALTER TABLE "Procurement" ADD COLUMN     "deliveryFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliverySplitMode" "DeliverySplitMode" NOT NULL DEFAULT 'PROPORTIONAL_SUM';
