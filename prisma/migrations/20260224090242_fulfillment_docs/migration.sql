-- CreateEnum
CREATE TYPE "PickupSessionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_PICKUP_SESSION';
ALTER TYPE "AuditAction" ADD VALUE 'CHECKIN_ORDER';
ALTER TYPE "AuditAction" ADD VALUE 'CLOSE_PICKUP_SESSION';

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'PICKUP_SESSION';

-- CreateTable
CREATE TABLE "PickupSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "PickupSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "procurementId" TEXT NOT NULL,

    CONSTRAINT "PickupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupCheckin" (
    "id" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "sessionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "operatorUserId" TEXT,

    CONSTRAINT "PickupCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickupSession_procurementId_key" ON "PickupSession"("procurementId");

-- CreateIndex
CREATE UNIQUE INDEX "PickupCheckin_orderId_key" ON "PickupCheckin"("orderId");

-- AddForeignKey
ALTER TABLE "PickupSession" ADD CONSTRAINT "PickupSession_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "Procurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupCheckin" ADD CONSTRAINT "PickupCheckin_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PickupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupCheckin" ADD CONSTRAINT "PickupCheckin_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
