-- AlterTable
ALTER TABLE "Order" ADD COLUMN "pickupCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_pickupCode_key" ON "Order"("pickupCode");
