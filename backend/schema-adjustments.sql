-- Ek ürün alanları ve Shopify eşleme düzeni
-- Mevcut veriyi silmez.

ALTER TABLE "urunler"
ADD COLUMN IF NOT EXISTS "sku" TEXT;

ALTER TABLE "urunler"
ADD COLUMN IF NOT EXISTS "renkAdi" TEXT;

DROP INDEX IF EXISTS "urunler_shopifyId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "urunler_shopifyId_key"
ON "urunler"("shopifyId");
