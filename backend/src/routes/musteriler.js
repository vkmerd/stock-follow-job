import { prisma } from '../index.js'

export default async function musterilerRoutes(app) {

  // Tüm müşteriler
  app.get('/musteriler', async (req) => {
    const { q } = req.query
    return await prisma.musteri.findMany({
      where: q ? {
        OR: [
          { ad:      { contains: q, mode: 'insensitive' } },
          { soyad:   { contains: q, mode: 'insensitive' } },
          { telefon: { contains: q } },
          { email:   { contains: q, mode: 'insensitive' } },
        ]
      } : {},
      include: {
        _count: { select: { satislar: true, siparisler: true } }
      },
      orderBy: { ad: 'asc' }
    })
  })

  // Tek müşteri (satış geçmişiyle)
  app.get('/musteriler/:id', async (req, reply) => {
    const musteri = await prisma.musteri.findUnique({
      where:   { id: req.params.id },
      include: {
        satislar:   { orderBy: { tarih: 'desc' }, take: 20,
                      include: { kalemler: true, odemeler: true } },
        siparisler: { orderBy: { tarih: 'desc' }, take: 10 },
      }
    })
    if (!musteri) return reply.status(404).send({ hata: 'Bulunamadı' })
    return musteri
  })

  // Body'den yalnızca Musteri şemasındaki güncellenebilir alanları al
  // (frontend bazen _count, id, olusturuldu gibi ekstra alanlar gönderiyor)
  const temizle = (body = {}) => {
    const izin = ['ad', 'soyad', 'telefon', 'email', 'adres', 'notlar', 'puan', 'dogumTarihi']
    const veri = {}
    for (const k of izin) {
      if (body[k] !== undefined) veri[k] = body[k]
    }
    if (veri.dogumTarihi) veri.dogumTarihi = new Date(veri.dogumTarihi)
    if (veri.puan !== undefined) veri.puan = Number(veri.puan) || 0
    return veri
  }

  // Müşteri ekle
  app.post('/musteriler', async (req, reply) => {
    const musteri = await prisma.musteri.create({ data: temizle(req.body) })
    return reply.status(201).send(musteri)
  })

  // Müşteri güncelle
  app.put('/musteriler/:id', async (req) => {
    return await prisma.musteri.update({
      where: { id: req.params.id },
      data:  temizle(req.body)
    })
  })

  // Müşteri sil
  app.delete('/musteriler/:id', async (req, reply) => {
    // Satış geçmişi varsa silme (FK koruması)
    const satisVar = await prisma.satis.count({ where: { musteriId: req.params.id } })
    if (satisVar > 0) {
      return reply.status(400).send({ hata: 'Satış geçmişi olan müşteri silinemez' })
    }
    await prisma.musteri.delete({ where: { id: req.params.id } })
    return { basarili: true }
  })
}
