-- AlterTable
ALTER TABLE "masraflar" ADD COLUMN     "bankaHesapId" TEXT,
ADD COLUMN     "odemeKaynagi" TEXT DEFAULT 'nakit';
