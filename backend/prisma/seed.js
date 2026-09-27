import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const prisma = new PrismaClient()
const hash = (s) => createHash('sha256').update(s).digest('hex')

async function main() {
  console.log('🌱 Seed başlıyor...')

  // ─── MAĞAZALAR ──────────────────────────────────────────────
  const m1 = await prisma.magaza.upsert({
    where:  { kod: 'M1' },
    update: {},
    create: { ad: 'Merkez Mağaza', kod: 'M1', adres: 'Bağcılar, İstanbul' }
  })
  const m2 = await prisma.magaza.upsert({
    where:  { kod: 'M2' },
    update: {},
    create: { ad: 'AVM Mağazası', kod: 'M2', adres: 'Avm, İstanbul' }
  })
  console.log('✅ Mağazalar')

  // ─── KULLANICILAR ───────────────────────────────────────────
  await prisma.kullanici.upsert({
    where:  { email: 'admin@vega.com' },
    update: {},
    create: { email: 'admin@vega.com', sifre: hash('vega123'), ad: 'Admin', rol: 'admin' }
  })
  await prisma.kullanici.upsert({
    where:  { email: 'kasiyer@vega.com' },
    update: {},
    create: { email: 'kasiyer@vega.com', sifre: hash('kasiyer123'), ad: 'Ayşe', soyad: 'Kaya', rol: 'kasiyer', magazaId: m1.id }
  })
  console.log('✅ Kullanıcılar  — admin@vega.com / vega123')

  // ─── MARKALAR & KATEGORİLER ─────────────────────────────────
  for (const ad of [
    'Zara','Mango','Guess','H&M','Nike','Adidas','New Balance','Converse',
    'Vakko','Boyner','Camper','Steve Madden','Tommy Hilfiger','Calvin Klein',
    'Michael Kors','Coach','Furla','Diğer'
  ]) {
    await prisma.marka.upsert({ where: { ad }, update: {}, create: { ad } })
  }
  const catCanta    = await prisma.kategori.upsert({ where: { id: 'cat-canta'    }, update: {}, create: { id: 'cat-canta',    ad: 'Çanta',    sira: 1 } })
  const catAyakkabi = await prisma.kategori.upsert({ where: { id: 'cat-ayakkabi' }, update: {}, create: { id: 'cat-ayakkabi', ad: 'Ayakkabı', sira: 2 } })
  // Alt kategoriler
  for (const [ustId, altlar] of [
    ['cat-canta',    ['Omuz Çantası','Sırt Çantası','El Çantası','Bel Çantası','Clutch','Seyahat']],
    ['cat-ayakkabi', ['Sneaker','Bot','Topuklu','Loafer','Sandalet','Terlik']],
  ]) {
    for (const ad of altlar) {
      const id = `cat-${ad.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}`;
      await prisma.kategori.upsert({ where:{id}, update:{}, create:{id, ad, ustId, sira:0} });
    }
  }
  console.log('✅ Marka & Kategori')

  // ─── POS TERMİNALLER ────────────────────────────────────────
  const pos1 = await prisma.posTerminal.upsert({
    where:  { id: 'pos-isbank-m1' },
    update: {},
    create: {
      id: 'pos-isbank-m1', ad: 'İş Bankası Merkez', banka: 'İş Bankası',
      terminalNo: 'T-1234567', magazaId: m1.id,
      komisyonPesin: 1.49, komisyon2: 1.79, komisyon3: 1.99,
      komisyon6: 2.49, komisyon9: 2.99, komisyon12: 3.49
    }
  })
  const pos2 = await prisma.posTerminal.upsert({
    where:  { id: 'pos-garanti-m1' },
    update: {},
    create: {
      id: 'pos-garanti-m1', ad: 'Garanti Merkez', banka: 'Garanti BBVA',
      terminalNo: 'T-2345678', magazaId: m1.id,
      komisyonPesin: 1.39, komisyon2: 1.69, komisyon3: 1.89,
      komisyon6: 2.39, komisyon9: 2.89, komisyon12: 3.39
    }
  })
  console.log('✅ POS Terminaller')

  // ─── ÜRÜNLER ────────────────────────────────────────────────
  const urunler = [
    {
      kod: 'V-00001', barkod: '8690000001', ad: 'Deri Omuz Çantası',
      marka: 'Zara', kategori: 'Çanta', altKategori: 'Omuz Çantası',
      alisF: 450, satisF: 990, kdv: 20, kritikStok: 3,
      stok: [
        { magazaId: m1.id, renk: 'Siyah', beden: 'M', adet: 5 },
        { magazaId: m2.id, renk: 'Siyah', beden: 'M', adet: 4 },
        { magazaId: m1.id, renk: 'Krem',  beden: 'M', adet: 2 },
      ]
    },
    {
      kod: 'V-00002', barkod: '8690000002', ad: 'Sneaker Bağcıklı',
      marka: 'Nike', kategori: 'Ayakkabı', altKategori: 'Sneaker',
      alisF: 800, satisF: 1490, kdv: 20, kritikStok: 3,
      stok: [
        { magazaId: m1.id, renk: 'Beyaz', beden: '40', adet: 5 },
        { magazaId: m1.id, renk: 'Beyaz', beden: '41', adet: 2 },
        { magazaId: m2.id, renk: 'Siyah', beden: '42', adet: 1 },
      ]
    },
    {
      kod: 'V-00003', barkod: '8690000003', ad: 'Topuklu Bot',
      marka: 'Zara', kategori: 'Ayakkabı', altKategori: 'Bot',
      alisF: 600, satisF: 1250, kdv: 20, kritikStok: 3,
      stok: [
        { magazaId: m1.id, renk: 'Kahve', beden: '38', adet: 3 },
        { magazaId: m2.id, renk: 'Siyah', beden: '39', adet: 6 },
      ]
    },
    {
      kod: 'V-00004', barkod: '8690000004', ad: 'Bel Çantası',
      marka: 'Guess', kategori: 'Çanta', altKategori: 'Bel Çantası',
      alisF: 300, satisF: 650, kdv: 20, kritikStok: 3,
      stok: [
        { magazaId: m1.id, renk: 'Bordo', beden: 'Tek Ebat', adet: 1 },
        { magazaId: m2.id, renk: 'Siyah', beden: 'Tek Ebat', adet: 4 },
      ]
    },
  ]

  for (const u of urunler) {
    const { stok, ...urunVeri } = u
    const urun = await prisma.urun.upsert({
      where:  { kod: u.kod },
      update: {},
      create: urunVeri
    })
    for (const s of stok) {
      await prisma.varyant.upsert({
        where: { urunId_magazaId_renk_beden: {
          urunId: urun.id, magazaId: s.magazaId,
          renk: s.renk, beden: s.beden
        }},
        update: {},
        create: { urunId: urun.id, ...s }
      })
    }
  }
  console.log('✅ Ürünler & Varyantlar')

  // ─── AYARLAR ────────────────────────────────────────────────
  const ayarlar = {
    firma_adi:    'Vega Çanta & Ayakkabı',
    kdv_orani:    '20',
    para_birimi:  'TRY',
    varsayilan_magaza: m1.id,
  }
  for (const [anahtar, deger] of Object.entries(ayarlar)) {
    await prisma.ayar.upsert({
      where:  { anahtar },
      update: { deger },
      create: { anahtar, deger }
    })
  }
  console.log('✅ Ayarlar')

  console.log('\n🎉 Seed tamamlandı!')
  console.log('   admin@vega.com  /  vega123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
