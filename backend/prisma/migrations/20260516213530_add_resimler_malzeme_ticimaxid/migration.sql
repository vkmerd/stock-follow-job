/*
  Warnings:

  - You are about to drop the column `belgeNo` on the `cari_hareketler` table. All the data in the column will be lost.
  - You are about to drop the column `musteriId` on the `cari_hesaplar` table. All the data in the column will be lost.
  - You are about to drop the column `siparisId` on the `iadeler` table. All the data in the column will be lost.
  - You are about to drop the column `toplam` on the `iadeler` table. All the data in the column will be lost.
  - You are about to drop the column `aylikHedef` on the `kullanicilar` table. All the data in the column will be lost.
  - You are about to drop the column `aylikHedef` on the `magazalar` table. All the data in the column will be lost.
  - You are about to drop the column `bankaHesapId` on the `masraflar` table. All the data in the column will be lost.
  - You are about to drop the column `odemeKaynagi` on the `masraflar` table. All the data in the column will be lost.
  - You are about to drop the column `karMarji` on the `satis_kalemleri` table. All the data in the column will be lost.
  - You are about to drop the column `maliyet` on the `satis_kalemleri` table. All the data in the column will be lost.
  - You are about to drop the column `marka` on the `satis_kalemleri` table. All the data in the column will be lost.
  - You are about to drop the column `bankaHesapId` on the `siparisler` table. All the data in the column will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SessionActivity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kullanici_hedefler` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[ticimaxId]` on the table `urunler` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "cari_hesaplar" DROP CONSTRAINT "cari_hesaplar_musteriId_fkey";

-- DropForeignKey
ALTER TABLE "iadeler" DROP CONSTRAINT "iadeler_siparisId_fkey";

-- DropForeignKey
ALTER TABLE "kullanici_hedefler" DROP CONSTRAINT "kullanici_hedefler_kullaniciId_fkey";

-- AlterTable
ALTER TABLE "cari_hareketler" DROP COLUMN "belgeNo";

-- AlterTable
ALTER TABLE "cari_hesaplar" DROP COLUMN "musteriId";

-- AlterTable
ALTER TABLE "iadeler" DROP COLUMN "siparisId",
DROP COLUMN "toplam";

-- AlterTable
ALTER TABLE "kullanicilar" DROP COLUMN "aylikHedef";

-- AlterTable
ALTER TABLE "magazalar" DROP COLUMN "aylikHedef";

-- AlterTable
ALTER TABLE "masraflar" DROP COLUMN "bankaHesapId",
DROP COLUMN "odemeKaynagi";

-- AlterTable
ALTER TABLE "satis_kalemleri" DROP COLUMN "karMarji",
DROP COLUMN "maliyet",
DROP COLUMN "marka";

-- AlterTable
ALTER TABLE "siparisler" DROP COLUMN "bankaHesapId";

-- AlterTable
ALTER TABLE "urunler" ADD COLUMN     "resimler" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ticimaxId" TEXT;

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "SessionActivity";

-- DropTable
DROP TABLE "kullanici_hedefler";

-- CreateIndex
CREATE UNIQUE INDEX "urunler_ticimaxId_key" ON "urunler"("ticimaxId");
