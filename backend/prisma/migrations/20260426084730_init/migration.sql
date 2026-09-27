-- CreateTable
CREATE TABLE "Magaza" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "adres" TEXT,
    "telefon" TEXT,
    "email" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Magaza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kullanici" (
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

    CONSTRAINT "Kullanici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ayar" (
    "id" TEXT NOT NULL,
    "anahtar" TEXT NOT NULL,
    "deger" TEXT NOT NULL,
    "tip" TEXT NOT NULL DEFAULT 'text',
    "aciklama" TEXT,
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ayar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kategori" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "ustId" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Kategori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marka" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Marka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Urun" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "barkod" TEXT,
    "ad" TEXT NOT NULL,
    "markaId" TEXT,
    "kategoriId" TEXT,
    "alisF" DECIMAL(65,30) DEFAULT 0,
    "satisF" DECIMAL(65,30) DEFAULT 0,
    "kdv" INTEGER NOT NULL DEFAULT 18,
    "aciklama" TEXT,
    "kritikStok" INTEGER NOT NULL DEFAULT 3,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Urun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Varyant" (
    "id" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "magazaId" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL DEFAULT 0,
    "barkod" TEXT,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Varyant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StokHareket" (
    "id" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "magazaId" TEXT,
    "tip" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL,
    "birimFiyat" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notlar" TEXT,
    "referansId" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StokHareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosTerminal" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "banka" TEXT NOT NULL,
    "terminalNo" TEXT,
    "magazaId" TEXT NOT NULL,
    "komisyonPesin" DECIMAL(65,30) NOT NULL DEFAULT 1.49,
    "komisyon2" DECIMAL(65,30) NOT NULL DEFAULT 1.79,
    "komisyon3" DECIMAL(65,30) NOT NULL DEFAULT 1.99,
    "komisyon6" DECIMAL(65,30) NOT NULL DEFAULT 2.49,
    "komisyon9" DECIMAL(65,30) NOT NULL DEFAULT 2.99,
    "komisyon12" DECIMAL(65,30) NOT NULL DEFAULT 3.49,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Satis" (
    "id" TEXT NOT NULL,
    "fisNo" TEXT NOT NULL,
    "magazaId" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "musteriId" TEXT,
    "notlar" TEXT,
    "araToplam" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "genelIndirimOran" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "genelIndirimTutar" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "kdvToplam" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "genelToplam" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paraUstu" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'tamamlandi',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Satis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatisKalem" (
    "id" TEXT NOT NULL,
    "satisId" TEXT NOT NULL,
    "urunId" TEXT,
    "urunAd" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "birimFiyat" DECIMAL(65,30) NOT NULL,
    "indirimOran" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "toplam" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "SatisKalem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatisOdeme" (
    "id" TEXT NOT NULL,
    "satisId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "tutar" DECIMAL(65,30) NOT NULL,
    "posId" TEXT,
    "banka" TEXT,
    "taksitSayisi" INTEGER NOT NULL DEFAULT 1,
    "komisyonOran" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "komisyonTutar" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netTahsilat" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "SatisOdeme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iade" (
    "id" TEXT NOT NULL,
    "iadeNo" TEXT NOT NULL,
    "satisId" TEXT,
    "neden" TEXT,
    "notlar" TEXT,
    "toplamIade" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'beklemede',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IadeKalem" (
    "id" TEXT NOT NULL,
    "iadeId" TEXT NOT NULL,
    "urunId" TEXT,
    "urunAd" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "birimFiyat" DECIMAL(65,30) NOT NULL,
    "toplam" DECIMAL(65,30) NOT NULL,
    "stokaGeri" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "IadeKalem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IadeOdeme" (
    "id" TEXT NOT NULL,
    "iadeId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "tutar" DECIMAL(65,30) NOT NULL,
    "posId" TEXT,

    CONSTRAINT "IadeOdeme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Siparis" (
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
    "araToplam" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "indirim" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "kargoUcreti" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "genelToplam" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "odemeTip" TEXT,
    "odenmeDurum" TEXT NOT NULL DEFAULT 'beklemede',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Siparis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiparisKalem" (
    "id" TEXT NOT NULL,
    "siparisId" TEXT NOT NULL,
    "urunId" TEXT,
    "urunAd" TEXT NOT NULL,
    "renk" TEXT,
    "beden" TEXT,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "birimFiyat" DECIMAL(65,30) NOT NULL,
    "toplam" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "SiparisKalem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Musteri" (
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

    CONSTRAINT "Musteri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CariHesap" (
    "id" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "vergiNo" TEXT,
    "adres" TEXT,
    "bakiye" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notlar" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CariHesap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CariHareket" (
    "id" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "aciklama" TEXT,
    "tutar" DECIMAL(65,30) NOT NULL,
    "bakiyeSonrasi" DECIMAL(65,30) NOT NULL,
    "vadeTarihi" TIMESTAMP(3),
    "odendi" BOOLEAN NOT NULL DEFAULT false,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CariHareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankaHesap" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "banka" TEXT NOT NULL,
    "iban" TEXT,
    "bakiye" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankaHesap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankaHareket" (
    "id" TEXT NOT NULL,
    "hesapId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "aciklama" TEXT,
    "tutar" DECIMAL(65,30) NOT NULL,
    "bakiye" DECIMAL(65,30) NOT NULL,
    "referans" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankaHareket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Magaza_kod_key" ON "Magaza"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_email_key" ON "Kullanici"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Ayar_anahtar_key" ON "Ayar"("anahtar");

-- CreateIndex
CREATE UNIQUE INDEX "Marka_ad_key" ON "Marka"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "Urun_kod_key" ON "Urun"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "Urun_barkod_key" ON "Urun"("barkod");

-- CreateIndex
CREATE UNIQUE INDEX "Satis_fisNo_key" ON "Satis"("fisNo");

-- CreateIndex
CREATE UNIQUE INDEX "Iade_iadeNo_key" ON "Iade"("iadeNo");

-- CreateIndex
CREATE UNIQUE INDEX "Siparis_siparisNo_key" ON "Siparis"("siparisNo");

-- AddForeignKey
ALTER TABLE "Kullanici" ADD CONSTRAINT "Kullanici_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "Magaza"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kategori" ADD CONSTRAINT "Kategori_ustId_fkey" FOREIGN KEY ("ustId") REFERENCES "Kategori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Urun" ADD CONSTRAINT "Urun_markaId_fkey" FOREIGN KEY ("markaId") REFERENCES "Marka"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Urun" ADD CONSTRAINT "Urun_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "Kategori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Varyant" ADD CONSTRAINT "Varyant_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Varyant" ADD CONSTRAINT "Varyant_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "Magaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareket" ADD CONSTRAINT "StokHareket_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareket" ADD CONSTRAINT "StokHareket_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "Magaza"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosTerminal" ADD CONSTRAINT "PosTerminal_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "Magaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Satis" ADD CONSTRAINT "Satis_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "Magaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Satis" ADD CONSTRAINT "Satis_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Satis" ADD CONSTRAINT "Satis_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "Musteri"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisKalem" ADD CONSTRAINT "SatisKalem_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisKalem" ADD CONSTRAINT "SatisKalem_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisOdeme" ADD CONSTRAINT "SatisOdeme_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisOdeme" ADD CONSTRAINT "SatisOdeme_posId_fkey" FOREIGN KEY ("posId") REFERENCES "PosTerminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iade" ADD CONSTRAINT "Iade_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IadeKalem" ADD CONSTRAINT "IadeKalem_iadeId_fkey" FOREIGN KEY ("iadeId") REFERENCES "Iade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IadeKalem" ADD CONSTRAINT "IadeKalem_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IadeOdeme" ADD CONSTRAINT "IadeOdeme_iadeId_fkey" FOREIGN KEY ("iadeId") REFERENCES "Iade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IadeOdeme" ADD CONSTRAINT "IadeOdeme_posId_fkey" FOREIGN KEY ("posId") REFERENCES "PosTerminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "Musteri"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "Magaza"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiparisKalem" ADD CONSTRAINT "SiparisKalem_siparisId_fkey" FOREIGN KEY ("siparisId") REFERENCES "Siparis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiparisKalem" ADD CONSTRAINT "SiparisKalem_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "CariHesap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankaHareket" ADD CONSTRAINT "BankaHareket_hesapId_fkey" FOREIGN KEY ("hesapId") REFERENCES "BankaHesap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
