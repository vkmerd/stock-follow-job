import { prisma } from '../index.js'

export default async function iadelerRoutes(app) {

  // Tüm iadeler
  app.get('/iadeler', async (req) => {
    const { durum, limit = 50, baslangic, bitis } = req.query
    return await prisma.iade.findMany({
      where: {
        ...(durum && { durum }),
        ...(baslangic && bitis && { tarih: { gte: new Date(baslangic), lte: new Date(bitis) } }),
      },
      include: {
        satis:    { select: { fisNo: true, magaza: { select: { ad: true } }, musteri: { select: { ad: true, soyad: true } } } },
        kalemler: true,
        odemeler: true,
      },
      orderBy: { tarih: 'desc' },
      take:    Number(limit),
    })
  })

  // İade oluştur
  app.post('/iadeler', async (req, reply) => {
    const { kalemler = [], odemeler = [], ...iadeVeri } = req.body

    const iade = await prisma.iade.create({
      data: {
        ...iadeVeri,
        kalemler: { create: kalemler },
        odemeler: { create: odemeler },
      },
      include: { kalemler: true, odemeler: true }
    })
    return reply.status(201).send(iade)
  })

  // İade onayla — stok geri ekle
  app.put('/iadeler/:id/onayla', async (req, reply) => {
    const iade = await prisma.iade.findUnique({
      where:   { id: req.params.id },
      include: { kalemler: true, satis: true }
    })
    if (!iade) return reply.status(404).send({ hata: 'Bulunamadı' })
    if (iade.durum !== 'beklemede') {
      return reply.status(400).send({ hata: 'Yalnızca beklemedeki iadeler onaylanabilir' })
    }

    await prisma.$transaction(async (tx) => {
      for (const kalem of iade.kalemler) {
        if (!kalem.urunId || !kalem.stokaGeri) continue

        // Satışın mağazasını bul
        const magazaId = iade.satis?.magazaId || null

        const varyant = await tx.varyant.findFirst({
          where: {
            urunId:   kalem.urunId,
            renk:     kalem.renk  || null,
            beden:    kalem.beden || null,
            ...(magazaId && { magazaId }),
          }
        })

        if (varyant) {
          await tx.varyant.update({
            where: { id: varyant.id },
            data:  { adet: varyant.adet + kalem.adet }
          })
        }

        await tx.stokHareket.create({
          data: {
            urunId:     kalem.urunId,
            magazaId:   magazaId || undefined,
            tip:        'iade',
            renk:       kalem.renk  || null,
            beden:      kalem.beden || null,
            adet:       kalem.adet,
            birimFiyat: kalem.birimFiyat,
            notlar:     `İade: ${iade.iadeNo}`,
            referansId: iade.id,
          }
        })
      }

      await tx.iade.update({
        where: { id: req.params.id },
        data:  { durum: 'onaylandi' }
      })
    })

    return await prisma.iade.findUnique({
      where:   { id: req.params.id },
      include: { kalemler: true, odemeler: true }
    })
  })

  // İade reddet
  app.put('/iadeler/:id/reddet', async (req) => {
    return await prisma.iade.update({
      where: { id: req.params.id },
      data:  { durum: 'reddedildi' }
    })
  })
}
