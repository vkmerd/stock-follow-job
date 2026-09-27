-- CreateTable
CREATE TABLE "gunluk_kasalar" (
    "id" TEXT NOT NULL,
    "magazaId" TEXT NOT NULL,
    "tarih" DATE NOT NULL,
    "acilisBakiyesi" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kapanisBakiyesi" DECIMAL(12,2),
    "durum" TEXT NOT NULL DEFAULT 'acik',
    "notlar" TEXT,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gunluk_kasalar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kasa_islemler" (
    "id" TEXT NOT NULL,
    "kasaId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "odeme" TEXT,
    "tutar" DECIMAL(12,2) NOT NULL,
    "aciklama" TEXT,
    "referansId" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kasa_islemler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degisimler" (
    "id" TEXT NOT NULL,
    "degisimNo" TEXT NOT NULL,
    "satisId" TEXT NOT NULL,
    "magazaId" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'beklemede',
    "farkTutar" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "farkOdeme" TEXT,
    "notlar" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "degisimler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degisim_kalemler" (
    "id" TEXT NOT NULL,
    "degisimId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "urunId" TEXT,
    "urunAd" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "birimFiyat" DECIMAL(12,2) NOT NULL,
    "toplam" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "degisim_kalemler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gunluk_kasalar_magazaId_tarih_key" ON "gunluk_kasalar"("magazaId", "tarih");

-- CreateIndex
CREATE UNIQUE INDEX "degisimler_degisimNo_key" ON "degisimler"("degisimNo");

-- AddForeignKey
ALTER TABLE "gunluk_kasalar" ADD CONSTRAINT "gunluk_kasalar_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kasa_islemler" ADD CONSTRAINT "kasa_islemler_referansId_fkey" FOREIGN KEY ("referansId") REFERENCES "kasa_islemler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kasa_islemler" ADD CONSTRAINT "kasa_islemler_kasaId_fkey" FOREIGN KEY ("kasaId") REFERENCES "gunluk_kasalar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degisimler" ADD CONSTRAINT "degisimler_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "satislar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degisimler" ADD CONSTRAINT "degisimler_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degisim_kalemler" ADD CONSTRAINT "degisim_kalemler_degisimId_fkey" FOREIGN KEY ("degisimId") REFERENCES "degisimler"("id") ON DELETE CASCADE ON UPDATE CASCADE;
