import { prisma } from '../index.js'

export default async function katalogRoutes(app) {

  // ─── MARKALAR ───────────────────────────────────────────────
  app.get('/markalar', async () => {
    return await prisma.marka.findMany({
      where: { aktif: true },
      orderBy: { ad: 'asc' }
    })
  })

  app.post('/markalar', async (req, reply) => {
    const { ad } = req.body
    if (!ad?.trim()) return reply.status(400).send({ hata: 'Ad zorunlu' })
    const marka = await prisma.marka.upsert({
      where:  { ad: ad.trim() },
      update: { aktif: true },
      create: { ad: ad.trim() }
    })
    return reply.status(201).send(marka)
  })

  app.put('/markalar/:id', async (req) => {
    return await prisma.marka.update({
      where: { id: req.params.id },
      data:  req.body
    })
  })

  app.delete('/markalar/:id', async (req) => {
    await prisma.marka.update({
      where: { id: req.params.id },
      data:  { aktif: false }
    })
    return { basarili: true }
  })

  // ─── KATEGORİLER ────────────────────────────────────────────
  app.get('/kategoriler', async () => {
    return await prisma.kategori.findMany({
      where: { aktif: true },
      orderBy: [{ sira: 'asc' }, { ad: 'asc' }]
    })
  })

  app.post('/kategoriler', async (req, reply) => {
    const kategori = await prisma.kategori.create({ data: req.body })
    return reply.status(201).send(kategori)
  })

  app.put('/kategoriler/:id', async (req) => {
    return await prisma.kategori.update({
      where: { id: req.params.id },
      data:  req.body
    })
  })

  app.delete('/kategoriler/:id', async (req) => {
    await prisma.kategori.update({
      where: { id: req.params.id },
      data:  { aktif: false }
    })
    return { basarili: true }
  })
}
