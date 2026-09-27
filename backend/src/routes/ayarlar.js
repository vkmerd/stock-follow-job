import { prisma } from '../index.js'

export default async function ayarlarRoutes(app) {

  // Tüm ayarlar (key-value obje olarak)
  app.get('/ayarlar', async () => {
    const ayarlar = await prisma.ayar.findMany({ orderBy: { anahtar: 'asc' } })
    return Object.fromEntries(ayarlar.map(a => [a.anahtar, a.deger]))
  })

  app.get('/ayarlar/:anahtar', async (req, reply) => {
    const ayar = await prisma.ayar.findUnique({ where: { anahtar: req.params.anahtar } })
    if (!ayar) return reply.status(404).send({ hata: 'Ayar bulunamadı' })
    return ayar
  })

  app.put('/ayarlar/:anahtar', async (req) => {
    const { deger, tip = 'text', aciklama } = req.body
    return await prisma.ayar.upsert({
      where:  { anahtar: req.params.anahtar },
      update: { deger: String(deger) },
      create: { anahtar: req.params.anahtar, deger: String(deger), tip, aciklama }
    })
  })

  // Toplu güncelle
  app.post('/ayarlar/toplu', async (req) => {
    const { ayarlar } = req.body
    const islemler = Object.entries(ayarlar).map(([anahtar, deger]) =>
      prisma.ayar.upsert({
        where:  { anahtar },
        update: { deger: String(deger) },
        create: { anahtar, deger: String(deger) }
      })
    )
    await prisma.$transaction(islemler)
    return { basarili: true }
  })
}
