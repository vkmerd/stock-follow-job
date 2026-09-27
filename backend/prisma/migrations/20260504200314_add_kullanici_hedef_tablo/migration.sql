-- CreateTable
CREATE TABLE "kullanici_hedefler" (
    "id" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "yil" INTEGER NOT NULL,
    "ay" INTEGER NOT NULL,
    "hedef" DECIMAL(12,2) NOT NULL,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kullanici_hedefler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kullanici_hedefler_kullaniciId_yil_ay_key" ON "kullanici_hedefler"("kullaniciId", "yil", "ay");

-- AddForeignKey
ALTER TABLE "kullanici_hedefler" ADD CONSTRAINT "kullanici_hedefler_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
