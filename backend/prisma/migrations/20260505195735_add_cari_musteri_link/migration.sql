-- AlterTable
ALTER TABLE "cari_hesaplar" ADD COLUMN     "musteriId" TEXT;

-- AddForeignKey
ALTER TABLE "cari_hesaplar" ADD CONSTRAINT "cari_hesaplar_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "musteriler"("id") ON DELETE SET NULL ON UPDATE CASCADE;
