-- AlterTable
ALTER TABLE "siparisler" ADD COLUMN     "shopifyOrderId" TEXT,
ADD COLUMN     "shopifyFulfillmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "siparisler_shopifyOrderId_key" ON "siparisler"("shopifyOrderId");
