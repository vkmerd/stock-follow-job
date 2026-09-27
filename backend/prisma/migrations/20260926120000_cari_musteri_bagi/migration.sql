-- Cari hesabı müşteri kaydına bağlar.
-- Kod (routes/cari.js > /cari/musteri-bul-olustur) bu alanı kullanıyordu ama şemada yoktu:
-- Prisma "Unknown argument musteriId" hatası veriyor, uç 500 dönüyordu. Veresiye akışı da
-- buradan kırılıyordu (cari açılamıyor → alacak hareketi de yazılamıyor).
ALTER TABLE "cari_hesaplar" ADD COLUMN "musteriId" TEXT;

-- Aynı müşteriye ikinci bir cari hesap açılmasın.
CREATE UNIQUE INDEX "cari_hesaplar_musteriId_key" ON "cari_hesaplar"("musteriId");
