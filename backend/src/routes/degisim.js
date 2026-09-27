import { prisma } from '../index.js'

export default async function degisimRoutes(app) {

  // Değişim listesi
  app.get('/degisimler', async (req) => {
    const { durum, magazaId, limit = 50 } = req.query
    return await prisma.degisim.findMany({
      where: {
        ...(durum    && { durum }),
        ...(magazaId && { magazaId }),
      },
      include: {
        satis:    { select: { fisNo: true, tarih: true } },
        magaza:   { select: { id: true, ad: true } },
        kalemler: true,
      },
      orderBy: { tarih: 'desc' },
      take: Number(limit)
    })
  })

  // Değişim oluştur
  app.post('/degisimler', async (req, reply) => {
    const { satisId, magazaId, kalemler = [], farkTutar, farkOdeme, notlar } = req.body

    if (!satisId) return reply.status(400).send({ hata: 'satisId zorunlu' })
    if (!kalemler.length) return reply.status(400).send({ hata: 'En az bir kalem gerekli' })

    const degisimNo = `D-${Date.now().toString().slice(-6)}`

    const degisim = await prisma.$transaction(async (tx) => {
      // Değişim kaydı oluştur
      const yeni = await tx.degisim.create({
        data: {
          degisimNo,
          satisId,
          magazaId: magazaId || null,
          farkTutar: Number(farkTutar) || 0,
          farkOdeme: farkOdeme || null,
          notlar:    notlar || null,
          durum:     'tamamlandi',
          kalemler: {
            create: kalemler.map(k => ({
              tip:        k.tip, // 'iade' | 'yeni'
              urunId:     k.urunId || null,
              urunAd:     k.urunAd,
              renk:       k.renk || null,
              beden:      k.beden || null,
              adet:       Number(k.adet) || 1,
              birimFiyat: Number(k.birimFiyat),
              toplam:     Number(k.toplam),
            }))
          }
        },
        include: { kalemler: true }
      })

      // Stok güncelle
      for (const k of kalemler) {
        if (!k.urunId || !magazaId) continue
        const varyant = await tx.varyant.findFirst({
          where: { urunId: k.urunId, magazaId, renk: k.renk||null, beden: k.beden||null }
        })
        if (!varyant) continue

        const adetDegisim = k.tip === 'iade' ? k.adet : -k.adet
        await tx.varyant.update({
          where: { id: varyant.id },
          data: { adet: { increment: adetDegisim } }
        })

        // Stok hareketi kaydet
        await tx.stokHareket.create({
          data: {
            urunId:    k.urunId,
            magazaId,
            tip:       'degisim',
            renk:      k.renk || null,
            beden:     k.beden || null,
            adet:      adetDegisim,
            birimFiyat: Number(k.birimFiyat),
            notlar:    `Değişim: ${degisimNo}`,
          }
        })
      }

      return yeni
    })

    return reply.status(201).send(degisim)
  })

  // Değişim iptal
  app.put('/degisimler/:id/iptal', async (req) => {
    return await prisma.degisim.update({
      where: { id: req.params.id },
      data:  { durum: 'iptal' }
    })
  })
}
