import { prisma } from '../index.js'

export default async function cariRoutes(app) {

  // Tüm cariler
  app.get('/cari', async (req) => {
    const { tip } = req.query
    return await prisma.cariHesap.findMany({
      where: { aktif: true, ...(tip && { tip }) },
      include: { _count: { select: { hareketler: true } } },
      orderBy: { ad: 'asc' }
    })
  })

  // Cari ekle
  app.post('/cari', async (req, reply) => {
    const cari = await prisma.cariHesap.create({ data: req.body })
    return reply.status(201).send(cari)
  })

  // Cari güncelle
  app.put('/cari/:id', async (req) => {
    return await prisma.cariHesap.update({
      where: { id: req.params.id },
      data: req.body
    })
  })

  // Hareket ekle + bakiye güncelle
  app.post('/cari/hareket', async (req, reply) => {
    const { cariId, tip, tutar, ...rest } = req.body

    const cari = await prisma.cariHesap.findUnique({ where: { id: cariId } })
    if (!cari) return reply.status(404).send({ hata: 'Cari bulunamadı' })

    // Bakiye hesapla
    let yeniBakiye = Number(cari.bakiye)
    if (tip === 'borc')     yeniBakiye += Number(tutar)
    if (tip === 'odeme')    yeniBakiye -= Number(tutar)
    if (tip === 'alacak')   yeniBakiye += Number(tutar)
    if (tip === 'tahsilat') yeniBakiye -= Number(tutar)

    const { vadeTarihi, belgeNo, ...restTemiz } = rest
    const [hareket] = await prisma.$transaction([
      prisma.cariHareket.create({
        data: { 
          cariId, tip, tutar: Number(tutar), bakiyeSonrasi: yeniBakiye, 
          ...restTemiz,
          ...(vadeTarihi && { vadeTarihi: new Date(vadeTarihi) })
        }
      }),
      prisma.cariHesap.update({
        where: { id: cariId },
        data: { bakiye: yeniBakiye }
      })
    ])

    return reply.status(201).send(hareket)
  })

  // Müşteriden CariHesap bul veya oluştur
  app.post('/cari/musteri-bul-olustur', async (req, reply) => {
    const { musteriId, musteriAd } = req.body
    // Önce bu müşteriye ait cari hesap var mı bak
    let cari = await prisma.cariHesap.findFirst({
      where: { musteriId: musteriId }
    })
    if (!cari) {
      cari = await prisma.cariHesap.create({
        data: {
          ad:       musteriAd || 'Müşteri',
          tip:      'musteri',
          musteriId: musteriId,
          bakiye:   0,
        }
      })
    }
    return cari
  })

  // Cari hareketleri
  app.get('/cari/:id/hareketler', async (req) => {
    return await prisma.cariHareket.findMany({
      where: { cariId: req.params.id },
      orderBy: { tarih: 'desc' }
    })
  })

  // Hareket ödendi güncelle
  app.put('/cari/hareket/:id/odendi', async (req) => {
    return await prisma.cariHareket.update({
      where: { id: req.params.id },
      data: { odendi: Boolean(req.body.odendi) }
    })
  })

}