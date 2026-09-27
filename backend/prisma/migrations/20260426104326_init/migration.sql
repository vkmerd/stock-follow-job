/*
  Warnings:

  - You are about to drop the `Ayar` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BankaHareket` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BankaHesap` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CariHareket` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CariHesap` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Iade` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IadeKalem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IadeOdeme` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Kategori` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Kullanici` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Magaza` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Marka` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Musteri` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PosTerminal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Satis` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SatisKalem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SatisOdeme` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Siparis` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SiparisKalem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StokHareket` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Urun` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Varyant` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BankaHareket" DROP CONSTRAINT "BankaHareket_hesapId_fkey";

-- DropForeignKey
ALTER TABLE "CariHareket" DROP CONSTRAINT "CariHareket_cariId_fkey";

-- DropForeignKey
ALTER TABLE "Iade" DROP CONSTRAINT "Iade_satisId_fkey";

-- DropForeignKey
ALTER TABLE "IadeKalem" DROP CONSTRAINT "IadeKalem_iadeId_fkey";

-- DropForeignKey
ALTER TABLE "IadeKalem" DROP CONSTRAINT "IadeKalem_urunId_fkey";

-- DropForeignKey
ALTER TABLE "IadeOdeme" DROP CONSTRAINT "IadeOdeme_iadeId_fkey";

-- DropForeignKey
ALTER TABLE "IadeOdeme" DROP CONSTRAINT "IadeOdeme_posId_fkey";

-- DropForeignKey
ALTER TABLE "Kategori" DROP CONSTRAINT "Kategori_ustId_fkey";

-- DropForeignKey
ALTER TABLE "Kullanici" DROP CONSTRAINT "Kullanici_magazaId_fkey";

-- DropForeignKey
ALTER TABLE "PosTerminal" DROP CONSTRAINT "PosTerminal_magazaId_fkey";

-- DropForeignKey
ALTER TABLE "Satis" DROP CONSTRAINT "Satis_kullaniciId_fkey";

-- DropForeignKey
ALTER TABLE "Satis" DROP CONSTRAINT "Satis_magazaId_fkey";

-- DropForeignKey
ALTER TABLE "Satis" DROP CONSTRAINT "Satis_musteriId_fkey";

-- DropForeignKey
ALTER TABLE "SatisKalem" DROP CONSTRAINT "SatisKalem_satisId_fkey";

-- DropForeignKey
ALTER TABLE "SatisKalem" DROP CONSTRAINT "SatisKalem_urunId_fkey";

-- DropForeignKey
ALTER TABLE "SatisOdeme" DROP CONSTRAINT "SatisOdeme_posId_fkey";

-- DropForeignKey
ALTER TABLE "SatisOdeme" DROP CONSTRAINT "SatisOdeme_satisId_fkey";

-- DropForeignKey
ALTER TABLE "Siparis" DROP CONSTRAINT "Siparis_kullaniciId_fkey";

-- DropForeignKey
ALTER TABLE "Siparis" DROP CONSTRAINT "Siparis_magazaId_fkey";

-- DropForeignKey
ALTER TABLE "Siparis" DROP CONSTRAINT "Siparis_musteriId_fkey";

-- DropForeignKey
ALTER TABLE "SiparisKalem" DROP CONSTRAINT "SiparisKalem_siparisId_fkey";

-- DropForeignKey
ALTER TABLE "SiparisKalem" DROP CONSTRAINT "SiparisKalem_urunId_fkey";

-- DropForeignKey
ALTER TABLE "StokHareket" DROP CONSTRAINT "StokHareket_magazaId_fkey";

-- DropForeignKey
ALTER TABLE "StokHareket" DROP CONSTRAINT "StokHareket_urunId_fkey";

-- DropForeignKey
ALTER TABLE "Urun" DROP CONSTRAINT "Urun_kategoriId_fkey";

-- DropForeignKey
ALTER TABLE "Urun" DROP CONSTRAINT "Urun_markaId_fkey";

-- DropForeignKey
ALTER TABLE "Varyant" DROP CONSTRAINT "Varyant_magazaId_fkey";

-- DropForeignKey
ALTER TABLE "Varyant" DROP CONSTRAINT "Varyant_urunId_fkey";

-- DropTable
DROP TABLE "Ayar";

-- DropTable
DROP TABLE "BankaHareket";

-- DropTable
DROP TABLE "BankaHesap";

-- DropTable
DROP TABLE "CariHareket";

-- DropTable
DROP TABLE "CariHesap";

-- DropTable
DROP TABLE "Iade";

-- DropTable
DROP TABLE "IadeKalem";

-- DropTable
DROP TABLE "IadeOdeme";

-- DropTable
DROP TABLE "Kategori";

-- DropTable
DROP TABLE "Kullanici";

-- DropTable
DROP TABLE "Magaza";

-- DropTable
DROP TABLE "Marka";

-- DropTable
DROP TABLE "Musteri";

-- DropTable
DROP TABLE "PosTerminal";

-- DropTable
DROP TABLE "Satis";

-- DropTable
DROP TABLE "SatisKalem";

-- DropTable
DROP TABLE "SatisOdeme";

-- DropTable
DROP TABLE "Siparis";

-- DropTable
DROP TABLE "SiparisKalem";

-- DropTable
DROP TABLE "StokHareket";

-- DropTable
DROP TABLE "Urun";

-- DropTable
DROP TABLE "Varyant";

-- CreateTable
CREATE TABLE "magazalar" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "adres" TEXT,
    "telefon" TEXT,
    "email" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magazalar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kullanicilar" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sifre" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'kasiyer',
    "magazaId" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sonGiris" TIMESTAMP(3),
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kullanicilar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ayarlar" (
    "id" TEXT NOT NULL,
    "anahtar" TEXT NOT NULL,
    "deger" TEXT NOT NULL,
    "tip" TEXT NOT NULL DEFAULT 'text',
    "aciklama" TEXT,
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ayarlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kategoriler" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "ustId" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kategoriler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markalar" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "markalar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "urunler" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "barkod" TEXT,
    "ad" TEXT NOT NULL,
    "marka" TEXT,
    "kategori" TEXT,
    "altKategori" TEXT,
    "alisF" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "satisF" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kdv" INTEGER NOT NULL DEFAULT 18,
    "aciklama" TEXT,
    "kritikStok" INTEGER NOT NULL DEFAULT 3,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "urunler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "varyantlar" (
    "id" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "magazaId" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL DEFAULT 0,
    "barkod" TEXT,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "varyantlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stok_hareketler" (
    "id" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "magazaId" TEXT,
    "tip" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL,
    "birimFiyat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notlar" TEXT,
    "referansId" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stok_hareketler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_terminaller" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "banka" TEXT NOT NULL,
    "terminalNo" TEXT,
    "magazaId" TEXT NOT NULL,
    "komisyonPesin" DECIMAL(5,2) NOT NULL DEFAULT 1.49,
    "komisyon2" DECIMAL(5,2) NOT NULL DEFAULT 1.79,
    "komisyon3" DECIMAL(5,2) NOT NULL DEFAULT 1.99,
    "komisyon6" DECIMAL(5,2) NOT NULL DEFAULT 2.49,
    "komisyon9" DECIMAL(5,2) NOT NULL DEFAULT 2.99,
    "komisyon12" DECIMAL(5,2) NOT NULL DEFAULT 3.49,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_terminaller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satislar" (
    "id" TEXT NOT NULL,
    "fisNo" TEXT NOT NULL,
    "magazaId" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "musteriId" TEXT,
    "notlar" TEXT,
    "araToplam" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "genelIndirimOran" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "genelIndirimTutar" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kdvToplam" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "genelToplam" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paraUstu" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'tamamlandi',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satislar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satis_kalemleri" (
    "id" TEXT NOT NULL,
    "satisId" TEXT NOT NULL,
    "urunId" TEXT,
    "urunAd" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "birimFiyat" DECIMAL(12,2) NOT NULL,
    "indirimOran" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "toplam" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "satis_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satis_odemeler" (
    "id" TEXT NOT NULL,
    "satisId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "tutar" DECIMAL(12,2) NOT NULL,
    "posId" TEXT,
    "banka" TEXT,
    "taksitSayisi" INTEGER NOT NULL DEFAULT 1,
    "komisyonOran" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "komisyonTutar" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netTahsilat" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "satis_odemeler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iadeler" (
    "id" TEXT NOT NULL,
    "iadeNo" TEXT NOT NULL,
    "satisId" TEXT,
    "neden" TEXT,
    "notlar" TEXT,
    "toplamIade" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'beklemede',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iadeler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iade_kalemleri" (
    "id" TEXT NOT NULL,
    "iadeId" TEXT NOT NULL,
    "urunId" TEXT,
    "urunAd" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "birimFiyat" DECIMAL(12,2) NOT NULL,
    "toplam" DECIMAL(12,2) NOT NULL,
    "stokaGeri" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "iade_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iade_odemeler" (
    "id" TEXT NOT NULL,
    "iadeId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "tutar" DECIMAL(12,2) NOT NULL,
    "posId" TEXT,

    CONSTRAINT "iade_odemeler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siparisler" (
    "id" TEXT NOT NULL,
    "siparisNo" TEXT NOT NULL,
    "musteriId" TEXT,
    "magazaId" TEXT,
    "kullaniciId" TEXT,
    "kanal" TEXT NOT NULL DEFAULT 'online',
    "durum" TEXT NOT NULL DEFAULT 'beklemede',
    "kargoBilgi" TEXT,
    "kargoNo" TEXT,
    "adres" TEXT,
    "notlar" TEXT,
    "araToplam" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "indirim" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kargoUcreti" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "genelToplam" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "odemeTip" TEXT,
    "odenmeDurum" TEXT NOT NULL DEFAULT 'beklemede',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siparisler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siparis_kalemleri" (
    "id" TEXT NOT NULL,
    "siparisId" TEXT NOT NULL,
    "urunId" TEXT,
    "urunAd" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "birimFiyat" DECIMAL(12,2) NOT NULL,
    "toplam" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "siparis_kalemleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "musteriler" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT,
    "telefon" TEXT,
    "email" TEXT,
    "adres" TEXT,
    "notlar" TEXT,
    "puan" INTEGER NOT NULL DEFAULT 0,
    "dogumTarihi" TIMESTAMP(3),
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "musteriler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cari_hesaplar" (
    "id" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "vergiNo" TEXT,
    "adres" TEXT,
    "bakiye" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notlar" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cari_hesaplar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cari_hareketler" (
    "id" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "aciklama" TEXT,
    "tutar" DECIMAL(12,2) NOT NULL,
    "bakiyeSonrasi" DECIMAL(14,2) NOT NULL,
    "vadeTarihi" TIMESTAMP(3),
    "odendi" BOOLEAN NOT NULL DEFAULT false,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cari_hareketler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banka_hesaplar" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "banka" TEXT NOT NULL,
    "iban" TEXT,
    "bakiye" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banka_hesaplar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banka_hareketler" (
    "id" TEXT NOT NULL,
    "hesapId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "aciklama" TEXT,
    "tutar" DECIMAL(12,2) NOT NULL,
    "bakiye" DECIMAL(14,2) NOT NULL,
    "referans" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banka_hareketler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "magazalar_kod_key" ON "magazalar"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "kullanicilar_email_key" ON "kullanicilar"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ayarlar_anahtar_key" ON "ayarlar"("anahtar");

-- CreateIndex
CREATE UNIQUE INDEX "markalar_ad_key" ON "markalar"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "urunler_kod_key" ON "urunler"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "urunler_barkod_key" ON "urunler"("barkod");

-- CreateIndex
CREATE UNIQUE INDEX "varyantlar_urunId_magazaId_renk_beden_key" ON "varyantlar"("urunId", "magazaId", "renk", "beden");

-- CreateIndex
CREATE UNIQUE INDEX "satislar_fisNo_key" ON "satislar"("fisNo");

-- CreateIndex
CREATE UNIQUE INDEX "iadeler_iadeNo_key" ON "iadeler"("iadeNo");

-- CreateIndex
CREATE UNIQUE INDEX "siparisler_siparisNo_key" ON "siparisler"("siparisNo");

-- AddForeignKey
ALTER TABLE "kullanicilar" ADD CONSTRAINT "kullanicilar_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kategoriler" ADD CONSTRAINT "kategoriler_ustId_fkey" FOREIGN KEY ("ustId") REFERENCES "kategoriler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "varyantlar" ADD CONSTRAINT "varyantlar_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "urunler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "varyantlar" ADD CONSTRAINT "varyantlar_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_hareketler" ADD CONSTRAINT "stok_hareketler_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "urunler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_hareketler" ADD CONSTRAINT "stok_hareketler_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_terminaller" ADD CONSTRAINT "pos_terminaller_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satislar" ADD CONSTRAINT "satislar_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satislar" ADD CONSTRAINT "satislar_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satislar" ADD CONSTRAINT "satislar_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "musteriler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satis_kalemleri" ADD CONSTRAINT "satis_kalemleri_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "satislar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satis_kalemleri" ADD CONSTRAINT "satis_kalemleri_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "urunler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satis_odemeler" ADD CONSTRAINT "satis_odemeler_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "satislar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satis_odemeler" ADD CONSTRAINT "satis_odemeler_posId_fkey" FOREIGN KEY ("posId") REFERENCES "pos_terminaller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iadeler" ADD CONSTRAINT "iadeler_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "satislar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iade_kalemleri" ADD CONSTRAINT "iade_kalemleri_iadeId_fkey" FOREIGN KEY ("iadeId") REFERENCES "iadeler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iade_kalemleri" ADD CONSTRAINT "iade_kalemleri_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "urunler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iade_odemeler" ADD CONSTRAINT "iade_odemeler_iadeId_fkey" FOREIGN KEY ("iadeId") REFERENCES "iadeler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iade_odemeler" ADD CONSTRAINT "iade_odemeler_posId_fkey" FOREIGN KEY ("posId") REFERENCES "pos_terminaller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siparisler" ADD CONSTRAINT "siparisler_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "musteriler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siparisler" ADD CONSTRAINT "siparisler_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "magazalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siparisler" ADD CONSTRAINT "siparisler_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siparis_kalemleri" ADD CONSTRAINT "siparis_kalemleri_siparisId_fkey" FOREIGN KEY ("siparisId") REFERENCES "siparisler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siparis_kalemleri" ADD CONSTRAINT "siparis_kalemleri_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "urunler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cari_hareketler" ADD CONSTRAINT "cari_hareketler_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "cari_hesaplar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banka_hareketler" ADD CONSTRAINT "banka_hareketler_hesapId_fkey" FOREIGN KEY ("hesapId") REFERENCES "banka_hesaplar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
