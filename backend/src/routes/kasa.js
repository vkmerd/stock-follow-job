import { prisma } from '../index.js'

export default async function kasaRoutes(app) {

  // ─── GÜNLÜK KASA ─────────────────────────────────────────────

  // Bugünkü kasayı getir (yoksa oluştur)
  app.get('/kasa/bugun', async (req, reply) => {
    const { magazaId } = req.query
    if (!magazaId) return reply.status(400).send({ hata: 'magazaId zorunlu' })

    const bugun = new Date()
    bugun.setHours(0,0,0,0)

    let kasa = await prisma.gunlukKasa.findUnique({
      where: { magazaId_tarih: { magazaId, tarih: bugun } },
      include: {
        islemler: { orderBy: { tarih: 'desc' } },
        magaza: { select: { id: true, ad: true, kod: true } }
      }
    })

    if (!kasa) {
      kasa = await prisma.gunlukKasa.create({
        data: { magazaId, tarih: bugun, acilisBakiyesi: 0, durum: 'kapali' },
        include: {
          islemler: true,
          magaza: { select: { id: true, ad: true, kod: true } }
        }
      })
    }

    // Satış, iade ve masrafları da ekle
    const satislar = await prisma.satis.findMany({
      where: {
        magazaId,
        tarih: { gte: bugun, lt: new Date(bugun.getTime() + 86400000) }
      },
      include: { odemeler: true, kalemler: true }
    })

    const iadeler = await prisma.iade.findMany({
      where: {
        durum: 'onaylandi',
        tarih: { gte: bugun, lt: new Date(bugun.getTime() + 86400000) }
      },
      include: { odemeler: true }
    })

    const masraflar = await prisma.masraf.findMany({
      where: {
        magazaId,
        tarih: { gte: bugun, lt: new Date(bugun.getTime() + 86400000) }
      },
      include: { kategori: true }
    })

    // Manuel hareketleri de al
    const manuelHareketler = await prisma.kasaIslem.findMany({
      where: {
        kasaId: kasa.id,
        tip: { in: ['nakit_giris', 'nakit_cikis', 'diger'] }
      },
      orderBy: { tarih: 'desc' }
    })

    // Özet hesapla
    const nakitSatis  = satislar.flatMap(s=>s.odemeler).filter(o=>o.tip==='nakit').reduce((t,o)=>t+Number(o.tutar),0)
    const kartSatis   = satislar.flatMap(s=>s.odemeler).filter(o=>['kart','taksit'].includes(o.tip)).reduce((t,o)=>t+Number(o.tutar),0)
    const havaleSatis = satislar.flatMap(s=>s.odemeler).filter(o=>o.tip==='havale').reduce((t,o)=>t+Number(o.tutar),0)
    const toplamSatis = satislar.reduce((t,s)=>t+Number(s.genelToplam),0)
    const toplamIade  = iadeler.reduce((t,i)=>t+Number(i.toplamIade),0)
    const toplamMasraf= masraflar.reduce((t,m)=>t+Number(m.tutar),0)
    const manuelGiris = manuelHareketler.filter(h=>h.tip==='nakit_giris').reduce((t,h)=>t+Number(h.tutar),0)
    const manuelCikis = manuelHareketler.filter(h=>h.tip==='nakit_cikis').reduce((t,h)=>t+Number(h.tutar),0)
    const nakitNet    = Number(kasa.acilisBakiyesi) + nakitSatis - toplamIade - toplamMasraf + manuelGiris - manuelCikis

    return {
      ...kasa,
      ozet: {
        toplamSatis, nakitSatis, kartSatis, havaleSatis,
        toplamIade, toplamMasraf, nakitNet,
        satisSayisi: satislar.length,
        iadeSayisi:  iadeler.length,
      },
      satislar,
      iadeler,
      masraflar,
      manuelHareketler,
    }
  })

  // Kasa aç
  app.post('/kasa/ac', async (req, reply) => {
    const { magazaId, acilisBakiyesi = 0, notlar } = req.body
    if (!magazaId) return reply.status(400).send({ hata: 'magazaId zorunlu' })

    const bugun = new Date()
    bugun.setHours(0,0,0,0)

    const kasa = await prisma.gunlukKasa.upsert({
      where: { magazaId_tarih: { magazaId, tarih: bugun } },
      update: { acilisBakiyesi: Number(acilisBakiyesi), durum: 'acik', notlar },
      create: { magazaId, tarih: bugun, acilisBakiyesi: Number(acilisBakiyesi), durum: 'acik', notlar },
    })
    return reply.status(201).send(kasa)
  })

  // Kasa kapat (Z raporu)
  app.post('/kasa/kapat', async (req, reply) => {
    const { kasaId, kapanisBakiyesi, notlar } = req.body
    const kasa = await prisma.gunlukKasa.update({
      where: { id: kasaId },
      data: { durum: 'kapali', kapanisBakiyesi: Number(kapanisBakiyesi), notlar }
    })
    return kasa
  })

  // Nakit Kasaya Aktar
  app.post('/kasa/nakite-aktar', async (req, reply) => {
    const { kasaId, tutar, aciklama } = req.body
    if (!tutar || tutar <= 0) return reply.status(400).send({ hata: 'Geçersiz tutar' })

    // "Nakit Kasa" hesabını bul veya oluştur
    let nakitHesap = await prisma.bankaHesap.findFirst({
      where: { ad: 'Nakit Kasa' }
    })
    if (!nakitHesap) {
      nakitHesap = await prisma.bankaHesap.create({
        data: { ad: 'Nakit Kasa', banka: 'Nakit', iban: 'NAKIT-KASA', bakiye: 0 }
      })
    }

    const yeniBakiye = Number(nakitHesap.bakiye) + Number(tutar)
    
    await prisma.$transaction([
      prisma.bankaHesap.update({
        where: { id: nakitHesap.id },
        data: { bakiye: yeniBakiye }
      }),
      prisma.bankaHareket.create({
        data: {
          hesapId:  nakitHesap.id,
          tip:      'gelir',
          aciklama: aciklama || 'Günlük Kasa Nakdi',
          tutar:    Number(tutar),
          bakiye:   yeniBakiye,
          referans: kasaId,
        }
      })
    ])

    return reply.status(201).send({ basarili: true, yeniBakiye })
  })

  // Kasa hareketi ekle (manuel nakit giriş/çıkış)
  app.post('/kasa/islem', async (req, reply) => {
    const { kasaId, tip, odeme, tutar, aciklama } = req.body
    const islem = await prisma.kasaIslem.create({
      data: { kasaId, tip, odeme: odeme||null, tutar: Number(tutar), aciklama: aciklama||null }
    })
    return reply.status(201).send(islem)
  })

  // Geçmiş kasalar
  app.get('/kasa/gecmis', async (req) => {
    const { magazaId, limit = 30 } = req.query
    return await prisma.gunlukKasa.findMany({
      where: magazaId ? { magazaId } : {},
      include: { magaza: { select: { id: true, ad: true } }, _count: { select: { islemler: true } } },
      orderBy: { tarih: 'desc' },
      take: Number(limit)
    })
  })
}
