import { prisma } from '../index.js'

export default async function posRoutes(app) {

  // Tüm POS terminalleri
  app.get('/pos', async (req) => {
    const { magazaId, hepsi } = req.query
    return await prisma.posTerminal.findMany({
      where: {
        ...(hepsi !== 'true' && { aktif: true }),
        ...(magazaId && { magazaId }),
      },
      include: { magaza: { select: { id: true, ad: true, kod: true } } },
      orderBy: { ad: 'asc' }
    })
  })

  // POS ekle
  app.post('/pos', async (req, reply) => {
    const pos = await prisma.posTerminal.create({
      data:    req.body,
      include: { magaza: { select: { id: true, ad: true } } }
    })
    return reply.status(201).send(pos)
  })

  // POS güncelle
  app.put('/pos/:id', async (req) => {
    const { terminalno, magaza, _count, id, olusturuldu, ...veri } = req.body
    return await prisma.posTerminal.update({
      where: { id: req.params.id },
      data:  { ...veri, ...(terminalno && { terminalNo: terminalno }) },
      include: { magaza: { select: { id: true, ad: true } } }
    })
  })

  // POS sil (soft delete)
  app.delete('/pos/:id', async (req) => {
    await prisma.posTerminal.update({
      where: { id: req.params.id },
      data:  { aktif: false }
    })
    return { basarili: true }
  })

  // POS komisyon raporu
  app.get('/pos/rapor', async (req) => {
    const { magazaId, baslangic, bitis } = req.query
    const odemeler = await prisma.satisOdeme.findMany({
      where: {
        tip:   { in: ['kart', 'taksit'] },
        posId: { not: null },
        satis: {
          durum: 'tamamlandi',
          ...(magazaId && { magazaId }),
          ...(baslangic && bitis && {
            tarih: { gte: new Date(baslangic), lte: new Date(bitis) }
          }),
        }
      },
      include: {
        posTerminal: { include: { magaza: { select: { id: true, ad: true } } } },
        satis:       { select: { fisNo: true, tarih: true } }
      }
    })

    // POS bazlı gruplama
    const posBazli = {}
    for (const o of odemeler) {
      const pid = o.posId
      if (!posBazli[pid]) {
        posBazli[pid] = {
          pos:             o.posTerminal,
          islemSayisi:     0,
          brutToplam:      0,
          komisyonToplam:  0,
          netToplam:       0,
        }
      }
      posBazli[pid].islemSayisi++
      posBazli[pid].brutToplam     += Number(o.tutar)
      posBazli[pid].komisyonToplam += Number(o.komisyonTutar)
      posBazli[pid].netToplam      += Number(o.netTahsilat)
    }

    return Object.values(posBazli)
  })
}
