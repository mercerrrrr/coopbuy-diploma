-- CreateEnum
CREATE TYPE "ReceivingStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'PUBLIC');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE_PROCUREMENT', 'CLOSE_PROCUREMENT', 'SUBMIT_ORDER', 'CREATE_RECEIVING', 'UPDATE_RECEIVING_LINE', 'FINALIZE_RECEIVING');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PROCUREMENT', 'ORDER', 'RECEIVING');

-- AlterTable
ALTER TABLE "Procurement" ADD COLUMN     "pickupInstructions" TEXT,
ADD COLUMN     "pickupWindowEnd" TIMESTAMP(3),
ADD COLUMN     "pickupWindowStart" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReceivingReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "ReceivingStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "procurementId" TEXT NOT NULL,

    CONSTRAINT "ReceivingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivingLine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reportId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "comment" TEXT,

    CONSTRAINT "ReceivingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceivingReport_procurementId_key" ON "ReceivingReport"("procurementId");

-- AddForeignKey
ALTER TABLE "ReceivingReport" ADD CONSTRAINT "ReceivingReport_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "Procurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ReceivingReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
