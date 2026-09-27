-- AlterTable
ALTER TABLE "iadeler" ADD COLUMN     "siparisId" TEXT,
ADD COLUMN     "toplam" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "iadeler" ADD CONSTRAINT "iadeler_siparisId_fkey" FOREIGN KEY ("siparisId") REFERENCES "siparisler"("id") ON DELETE SET NULL ON UPDATE CASCADE;
