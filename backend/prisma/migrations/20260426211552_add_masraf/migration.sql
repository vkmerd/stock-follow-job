-- CreateTable
CREATE TABLE "masraf_kategoriler" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "ikon" TEXT NOT NULL DEFAULT '💰',
    "renk" TEXT NOT NULL DEFAULT '#c9b882',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "masraf_kategoriler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "masraflar" (
    "id" TEXT NOT NULL,
    "kategoriId" TEXT,
    "magazaId" TEXT,
    "tutar" DECIMAL(12,2) NOT NULL,
    "aciklama" TEXT,
    "faturaNo" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "masraflar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "masraf_kategoriler_ad_key" ON "masraf_kategoriler"("ad");

-- AddForeignKey
ALTER TABLE "masraflar" ADD CONSTRAINT "masraflar_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "masraf_kategoriler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "masraflar" ADD CONSTRAINT "masraflar_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
