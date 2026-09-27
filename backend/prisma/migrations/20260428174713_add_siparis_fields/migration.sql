-- AlterTable
ALTER TABLE "banka_hareketler" ADD COLUMN     "kategoriId" TEXT,
ADD COLUMN     "magazaId" TEXT;

-- AlterTable
ALTER TABLE "banka_hesaplar" ADD COLUMN     "magazaId" TEXT;

-- AlterTable
ALTER TABLE "siparisler" ADD COLUMN     "hazirlamaSuresi" INTEGER,
ADD COLUMN     "kargoFirma" TEXT,
ADD COLUMN     "musteriAd" TEXT,
ADD COLUMN     "musteriTel" TEXT,
ADD COLUMN     "ozelNot" TEXT;

-- CreateTable
CREATE TABLE "banka_kategoriler" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banka_kategoriler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banka_kategoriler_ad_key" ON "banka_kategoriler"("ad");

-- AddForeignKey
ALTER TABLE "banka_hesaplar" ADD CONSTRAINT "banka_hesaplar_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banka_hareketler" ADD CONSTRAINT "banka_hareketler_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "banka_kategoriler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banka_hareketler" ADD CONSTRAINT "banka_hareketler_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
