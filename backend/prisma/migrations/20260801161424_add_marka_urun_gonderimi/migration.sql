-- CreateTable
CREATE TABLE "marka_urun_gonderimleri" (
    "id" TEXT NOT NULL,
    "kaynak" TEXT NOT NULL,
    "disKimlik" TEXT NOT NULL,
    "urunAdi" TEXT NOT NULL,
    "marka" TEXT,
    "tedarikciFiyati" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gonderilenFiyat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shopifyId" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marka_urun_gonderimleri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marka_urun_gonderimleri_kaynak_disKimlik_key" ON "marka_urun_gonderimleri"("kaynak", "disKimlik");
