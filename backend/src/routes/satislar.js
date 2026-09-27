import { prisma } from '../index.js'

// Veritabanında `cari_hesaplar.musteriId` sütunu var mı? Kod bu bağı kullanmak istiyor
// (bkz. migration 20260926120000_cari_musteri_bagi) ama migration uygulanmamış kurulumlarda
// sütun olmayabiliyor. Bunu SATIŞ TRANSACTION'INDAN ÖNCE, tek seferlik bir sorgu ile
// yokluyoruz: transaction içinde denenirse — alan Prisma şemasında var ama veritabanında
// yoksa — Postgres transaction'ı komple iptal eder ve SATIŞ DA KAYBOLURDU.
// Sütun yoksa cari, müşteri ADIYLA eşleştiriliyor; satış, stok ve borç kaydı yine oluşur.
let cariMusteriIdDestegi = null
async function cariMusteriIdVarMi() {
  if (cariMusteriIdDestegi !== null) return cariMusteriIdDestegi
  try {
    await prisma.cariHesap.findFirst({ where: { musteriId: '00000000-0000-0000-0000-000000000000' }, select: { id: true } })
    cariMusteriIdDestegi = true
  } catch {
    console.warn('[veresiye] cari_hesaplar.musteriId yok — cari hesaplar müşteri ADIYLA eşleştirilecek. Kalıcı çözüm: migration 20260926120000_cari_musteri_bagi')
    cariMusteriIdDestegi = false
  }
  return cariMusteriIdDestegi
}
export default async function satislarRoutes(app) {

  // Tüm satışlar
  app.get('/satislar', async (req) => {
    const { magazaId, baslangic, bitis, limit = 100 } = req.query
    return await prisma.satis.findMany({
      where: {
        ...(magazaId && { magazaId }),
        ...(baslangic && bitis && {
          tarih: { gte: new Date(baslangic), lte: new Date(bitis) }
        }),
      },
      include: {
        magaza:   { select: { id: true, ad: true, kod: true } },
        musteri:  { select: { id: true, ad: true, soyad: true, telefon: true } },
        kullanici: { select: { id: true, ad: true, soyad: true } },
        // Geçmiş ekranı kalemleri "ÜRÜN KODU - Renk Adı" olarak gösteriyor; bu iki alan
        // SatisKalem'de tutulmuyor (satır yalnızca urunAd/renk saklıyor), ürün kaydından
        // geliyor.
        kalemler: { include: { urun: { select: { id: true, kod: true, sku: true, renkAdi: true, marka: true } } } },
        odemeler: { include: { posTerminal: { select: { id: true, ad: true, banka: true } } } },
      },
      orderBy: { tarih: 'desc' },
      take:    Number(limit),
    })
  })

  // Tek satış
  app.get('/satislar/:id', async (req, reply) => {
    const satis = await prisma.satis.findUnique({
      where: { id: req.params.id },
      include: {
        magaza:   true,
        musteri:  true,
        kalemler: { include: { urun: { select: { id: true, kod: true, ad: true, marka: true, kategori: true, malzeme: true } } } },
        odemeler: { include: { posTerminal: true } },
        iadeler:  true,
      }
    })
    if (!satis) return reply.status(404).send({ hata: 'Bulunamadı' })
    return satis
  })

  // Son fiş numarası
  app.get('/satislar/son-fis', async () => {
    const son = await prisma.satis.findFirst({
      orderBy: { tarih: 'desc' },
      select:  { fisNo: true }
    })
    if (!son) return { fisNo: 'F-0001' }
    const sayi = parseInt(son.fisNo.replace('F-', '')) + 1
    return { fisNo: `F-${String(sayi).padStart(4, '0')}` }
  })

  // Satış kaydet — kalemler + ödemeler + stok düş tek transaction
  app.post('/satislar', async (req, reply) => {
    const body = req.body || {}
    const rawKalemler = body.kalemler
    const rawOdemeler = body.odemeler
    let kalemler = Array.isArray(rawKalemler) ? rawKalemler : (rawKalemler?.create || [])
    const odemeler = Array.isArray(rawOdemeler) ? rawOdemeler : (rawOdemeler?.create || [])
    const { ...satisVeri } = body

    // Normalize kalemler: accept array OR { create: [...] }, and convert nested
    // Prisma shapes like { urun: { connect: { id } } } into flat `urunId`.
    kalemler = (kalemler || []).map(k => {
      const urunId = k.urunId || (k.urun && (k.urun.connect?.id || (k.urun.connect?.where && k.urun.connect.where.id))) || null
      const adet = Number(k.adet ?? k.quantity) || 1
      const birimFiyat = Number(k.birimFiyat ?? k.fiyat ?? 0) || 0
      const indirimOran = Number(k.indirimOran ?? k.indirim ?? 0) || 0
      const toplam = Number(k.toplam ?? (adet * birimFiyat)) || 0
      return {
        urunId: urunId || null,
        urunAd: k.urunAd || k.urun_ad || '',
        renk: k.renk || null,
        beden: k.beden || null,
        adet,
        birimFiyat,
        indirimOran,
        toplam,
        barkod: k.barkod || null,
      }
    })

    // Sadece schema'da olan alanları al
    const {
      fisNo: fisNoGelen, magazaId, musteriId, kullaniciId, durum,
      notlar, araToplam, genelIndirimOran, genelIndirimTutar,
      kdvToplam, genelToplam, paraUstu
    } = satisVeri

    // Fiş numarası üretimi: Transaction İÇİNDE üret + çakışmada otomatik retry
    async function fisNoUret(tx) {
      const son = await tx.satis.findFirst({
        orderBy: { olusturuldu: 'desc' },
        select: { fisNo: true }
      })
      if (!son?.fisNo) return 'F-0001'
      const sayi = parseInt(son.fisNo.replace(/^F-/, '')) || 0
      return `F-${String(sayi + 1).padStart(4, '0')}`
    }

    const temizSatisVeri = {
      ...(magazaId    && { magazaId }),
      ...(musteriId   && { musteriId }),
      ...(kullaniciId && { kullaniciId }),
      ...(durum       && { durum }),
      notlar:            notlar || '',
      araToplam:         Number(araToplam)         || 0,
      genelIndirimOran:  Number(genelIndirimOran)  || 0,
      genelIndirimTutar: Number(genelIndirimTutar) || 0,
      kdvToplam:         Number(kdvToplam)         || 0,
      genelToplam:       Number(genelToplam)       || 0,
      paraUstu:          Number(paraUstu)          || 0,
    }

    // Veresiye için cari bağının hangi yoldan kurulacağı transaction'a girmeden belirleniyor.
    const musteriIdDestekli = await cariMusteriIdVarMi()

    // Çakışma retry: aynı anda iki satış kaydedilirse fiş no çakışması
    // yaşanabilir — bu durumda transaction'ı 3 kez yeniden deneriz.
    let satis
    let deneme = 0
    while (true) {
      try {
        satis = await prisma.$transaction(async (tx) => {
          // fisNo transaction içinde üretiliyor — race condition engeli
          const fisNo = fisNoGelen || await fisNoUret(tx)

      // 1. Satış kaydı (önce sadece satis tablosu)
      // Defensively ensure we don't pass nested relations here even if present
          const createData = { ...temizSatisVeri, fisNo }
      if (createData.kalemler) delete createData.kalemler
      if (createData.odemeler) delete createData.odemeler
      const yeniSatis = await tx.satis.create({ data: createData })

      // 2. Kalemleri ayrı ayrı ekle (nested create sorunlarından kaçınmak için)
      const createdKalemler = []
      for (const k of kalemler || []) {
        const kayit = await tx.satisKalem.create({
          data: {
            satisId: yeniSatis.id,
            urunId:     k.urunId     || null,
            urunAd:     k.urunAd    || '',
            renk:       k.renk      || null,
            beden:      k.beden     || null,
            adet:       Number(k.adet)       || 1,
            birimFiyat: Number(k.birimFiyat) || 0,
            indirimOran: Number(k.indirimOran || k.indirim) || 0,
            toplam:     Number(k.toplam)     || 0,
          }
        })
        createdKalemler.push(kayit)
      }

      // 3. Ödemeleri ayrı ekle
      const createdOdemeler = []
      for (const o of odemeler || []) {
        const ok = await tx.satisOdeme.create({
          data: {
            satisId:      yeniSatis.id,
            tip:          o.tip,
            tutar:        Number(o.tutar)        || 0,
            posId:        o.posId                || null,
            banka:        o.banka                || null,
            taksitSayisi: Number(o.taksitSayisi) || Number(o.taksit) || 1,
            komisyonOran: Number(o.komisyonOran) || Number(o.komisyon) || 0,
            komisyonTutar:Number(o.komisyonTutar)|| 0,
            netTahsilat:  Number(o.netTahsilat || o.tutar) || 0,
          }
        })
        createdOdemeler.push(ok)
      }


      // 3b. VERESİYE: ödeme tipi 'veresiye' olan tutar, müşterinin cari hesabına ALACAK
      // olarak yazılıyor — satışla AYNI transaction'da, yani ya ikisi birden olur ya
      // hiçbiri. ESKİ DAVRANIŞ: veresiye ekranda ayrı bir düğmeydi, satışı hiç
      // kaydetmeden doğrudan /cari/hareket çağırıyordu; satış kaydı da stok düşümü de
      // oluşmuyordu (üstelik cari ucu da hata veriyordu, bkz. CariHesap.musteriId).
      const veresiyeToplam = (odemeler || [])
        .filter(o => o.tip === 'veresiye')
        .reduce((t, o) => t + (Number(o.tutar) || 0), 0)

      if (veresiyeToplam > 0 && temizSatisVeri.musteriId) {
        const musteriKaydi = await tx.musteri.findUnique({ where: { id: temizSatisVeri.musteriId } })
        const cariAdi = [musteriKaydi?.ad, musteriKaydi?.soyad].filter(Boolean).join(' ') || 'Müşteri'

        // Bağ tercihen müşteri id'si üzerinden; sütun yoksa ad üzerinden (aynı adlı iki
        // müşteri tek cari paylaşabilir — bu yüzden migration önerilir).
        const cari = (await tx.cariHesap.findFirst(
          musteriIdDestekli
            ? { where: { musteriId: temizSatisVeri.musteriId } }
            : { where: { tip: 'musteri', ad: cariAdi } }
        )) || await tx.cariHesap.create({
          data: {
            tip: 'musteri',
            ...(musteriIdDestekli && { musteriId: temizSatisVeri.musteriId }),
            ad: cariAdi,
            telefon: musteriKaydi?.telefon || null,
            bakiye: 0,
          }
        })
        const yeniBakiye = Number(cari.bakiye) + veresiyeToplam
        await tx.cariHareket.create({
          data: {
            cariId: cari.id,
            tip: 'alacak',
            tutar: veresiyeToplam,
            bakiyeSonrasi: yeniBakiye,
            aciklama: `Veresiye satış - Fiş ${fisNo}`,
            odendi: false,
          }
        })
        await tx.cariHesap.update({ where: { id: cari.id }, data: { bakiye: yeniBakiye } })
      }

      // 4. Her kalem için stok düş + hareket kaydet (aynı kalemler dizisini kullan)
      for (const kalem of kalemler) {
        if (!kalem.urunId) continue

        // Önce barkodla ara, bulamazsa renk/beden ile ara
        let varyant = null
        if (kalem.barkod) {
          varyant = await tx.varyant.findFirst({ where: { barkod: kalem.barkod, magazaId: temizSatisVeri.magazaId } })
        }
        if (!varyant) {
          varyant = await tx.varyant.findFirst({
            where: {
              urunId:   kalem.urunId,
              magazaId: temizSatisVeri.magazaId,
              renk:     kalem.renk  || null,
              beden:    kalem.beden || null,
            }
          })
        }

        if (varyant) {
          await tx.varyant.update({
            where: { id: varyant.id },
            data:  { adet: Math.max(0, varyant.adet - kalem.adet) }
          })
          await tx.stokHareket.create({
            data: {
              urunId:     kalem.urunId,
              magazaId:   temizSatisVeri.magazaId,
              tip:        'satis',
              renk:       kalem.renk  || null,
              beden:      kalem.beden || null,
              adet:       -kalem.adet,
              birimFiyat: kalem.birimFiyat,
              notlar:     `Fiş: ${satisVeri.fisNo}`,
              referansId: yeniSatis.id,
            }
          })
        }
      }

      // 5. Son olarak tam kaydı include ile dön
      const tamSatis = await tx.satis.findUnique({ where: { id: yeniSatis.id }, include: { kalemler: true, odemeler: true } })
      return tamSatis
        })
        break // transaction başarılı — döngüden çık
      } catch (err) {
        // P2002 = unique constraint (fiş no çakışması) — yeniden dene
        if (err?.code === 'P2002' && err?.meta?.target?.some(t => t.includes('fisNo')) && deneme < 3) {
          deneme++
          console.warn(`[Satış] Fiş no çakışması, yeniden deneniyor (${deneme}/3)...`)
          continue
        }
        throw err // başka hata veya max retry aşıldı
      }
    }

    return reply.status(201).send(satis)
  })

  // Satış iptal
  app.put('/satislar/:id/iptal', async (req) => {
    return await prisma.satis.update({
      where: { id: req.params.id },
      data:  { durum: 'iptal' }
    })
  })

  // Özet rapor
  app.get('/satislar/ozet', async (req) => {
    const { magazaId, donem = 'bugun' } = req.query
    const simdi = new Date()
    const baslangic = new Date()

    if (donem === 'bugun')    baslangic.setHours(0, 0, 0, 0)
    if (donem === 'bu_hafta') baslangic.setDate(simdi.getDate() - 7)
    if (donem === 'bu_ay')    baslangic.setDate(1), baslangic.setHours(0, 0, 0, 0)

    const satislar = await prisma.satis.findMany({
      where: {
        durum: 'tamamlandi',
        tarih: { gte: baslangic },
        ...(magazaId && { magazaId }),
      },
      include: { odemeler: true }
    })

    const toplamCiro     = satislar.reduce((t, s) => t + Number(s.genelToplam), 0)
    const toplamKomisyon = satislar.reduce((t, s) =>
      t + s.odemeler.reduce((a, o) => a + Number(o.komisyonTutar), 0), 0)

    return {
      satisSayisi:   satislar.length,
      toplamCiro,
      toplamKomisyon,
      netTahsilat:   toplamCiro - toplamKomisyon,
    }
  })
}