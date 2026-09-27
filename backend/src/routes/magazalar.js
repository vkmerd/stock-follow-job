import { prisma } from '../index.js'

export default async function magazalarRoutes(app) {

  // Tüm mağazalar (yönetim için — aktif filtresi yok)
  app.get('/magazalar/hepsi', async () => {
    return await prisma.magaza.findMany({ orderBy: { ad: 'asc' } })
  })

  // Aktif mağazalar (diğer modüller için)
  app.get('/magazalar', async (req) => {
    const { hepsi } = req.query
    return await prisma.magaza.findMany({
      where: hepsi === 'true' ? {} : { aktif: true },
      include: {
        _count: { select: { varyantlar: true, satislar: true } }
      },
      orderBy: { ad: 'asc' }
    })
  })

  app.post('/magazalar', async (req, reply) => {
    const { ad, kod, adres, telefon, email, aktif = true, tip, ikon, renk } = req.body
    const magaza = await prisma.magaza.create({
      data: {
        ad,
        kod,
        adres: adres || null,
        telefon: telefon || null,
        email: email || null,
        aktif: Boolean(aktif),
        ...(tip !== undefined ? { tip } : {}),
        ...(ikon !== undefined ? { ikon } : {}),
        ...(renk !== undefined ? { renk } : {}),
      }
    })
    return reply.status(201).send(magaza)
  })

  // Tek mağaza
  app.get('/magazalar/:id', async (req, reply) => {
    const magaza = await prisma.magaza.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { varyantlar: true, satislar: true } } }
    })
    if (!magaza) return reply.status(404).send({ hata: 'Bulunamadı' })
    return magaza
  })

  app.put('/magazalar/:id', async (req) => {
    const { ad, kod, adres, telefon, email, aktif, aylikHedef } = req.body
    const magaza = await prisma.magaza.update({
      where: { id: req.params.id },
      data: {
        ...(ad !== undefined ? { ad } : {}),
        ...(kod !== undefined ? { kod } : {}),
        ...(adres !== undefined ? { adres } : {}),
        ...(telefon !== undefined ? { telefon } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(aktif !== undefined ? { aktif: Boolean(aktif) } : {}),
        ...(aylikHedef !== undefined ? { aylikHedef: Number(aylikHedef) || 0 } : {}),
      }
    })
    return magaza
  })

  // Tedarik mağazası — yoksa oluştur
  app.get('/magazalar/tedarik', async (req, reply) => {
    let tedarik = await prisma.magaza.findFirst({ where: { tip: 'tedarik' } })
    if (!tedarik) {
      tedarik = await prisma.magaza.create({
        data: { ad: 'Tedarik Deposu', kod: 'TEDARIK', tip: 'tedarik', aktif: true, ikon: '📦' }
      })
    }
    return tedarik
  })
}