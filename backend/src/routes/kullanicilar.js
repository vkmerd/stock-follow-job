import { prisma } from '../index.js'
import { createHash } from 'crypto'

// SHA-256 — geliştirme/prototip için yeterli.
// Prod'da bcrypt/argon2 kullanın.
const sifrele = (sifre) => createHash('sha256').update(sifre).digest('hex')

export default async function kullanicilarRoutes(app) {

  // Tüm kullanıcılar (şifre hariç)
  app.get('/kullanicilar', async () => {
    return await prisma.kullanici.findMany({
      select: {
        id: true, email: true, ad: true, soyad: true,
        rol: true, aktif: true, sonGiris: true, magazaId: true,
        magaza: { select: { id: true, ad: true, kod: true } },
        hedefler: {
          where: { yil: new Date().getFullYear(), ay: new Date().getMonth() + 1 },
          select: { hedef: true, yil: true, ay: true },
          take: 1
        }
      },
      orderBy: { ad: 'asc' }
    })
  })

  // Kullanıcı ekle
  app.post('/kullanicilar', async (req, reply) => {
    const { sifre, ...rest } = req.body
    if (!sifre || sifre.length < 6) {
      return reply.status(400).send({ hata: 'Şifre en az 6 karakter olmalı' })
    }
    const kullanici = await prisma.kullanici.create({
      data: { ...rest, email: rest.email.toLowerCase().trim(), sifre: sifrele(sifre.trim()) },
      select: { id: true, email: true, ad: true, soyad: true, rol: true, aktif: true }
    })
    return reply.status(201).send(kullanici)
  })

  // Kullanıcı güncelle
  app.put('/kullanicilar/:id', async (req) => {
    const { sifre, ...rest } = req.body
    return await prisma.kullanici.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(rest.email && { email: rest.email.toLowerCase().trim() }),
        ...(sifre && { sifre: sifrele(sifre.trim()) })
      },
      select: { id: true, email: true, ad: true, soyad: true, rol: true, aktif: true, magazaId: true }
    })
  })

  // Giriş yap
  app.post('/kullanicilar/giris', async (req, reply) => {
    const { email, sifre } = req.body
    if (!email || !sifre) {
      return reply.status(400).send({ hata: 'Email ve şifre zorunlu' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const trimmedSifre = sifre.trim()

    console.log('Gelen email:', email, 'normalized:', normalizedEmail)
    console.log('Gelen sifre:', sifre, 'trimmed:', trimmedSifre)
    console.log('Hash:', sifrele(trimmedSifre))

    const kullanici = await prisma.kullanici.findUnique({
      where:   { email: normalizedEmail },
      include: { magaza: { select: { id: true, ad: true, kod: true } } }
    })

    console.log('DB kullanici:', kullanici ? 'bulundu' : 'bulunamadi')
    if (kullanici) console.log('DB sifre:', kullanici.sifre)

    if (!kullanici || kullanici.sifre !== sifrele(trimmedSifre)) {
      return reply.status(401).send({ hata: 'Email veya şifre hatalı' })
    }
    if (!kullanici.aktif) {
      return reply.status(403).send({ hata: 'Hesap pasif' })
    }

    // Son giriş güncelle
    await prisma.kullanici.update({
      where: { id: kullanici.id },
      data:  { sonGiris: new Date() }
    })

    const { sifre: _, ...kullaniciBilgi } = kullanici
    return kullaniciBilgi
  })

  // Hedef kaydet
  app.post('/kullanicilar/:id/hedef', async (req, reply) => {
    const { yil, ay, hedef } = req.body
    const result = await prisma.kullaniciHedef.upsert({
      where: { kullaniciId_yil_ay: { kullaniciId: req.params.id, yil, ay } },
      create: { kullaniciId: req.params.id, yil, ay, hedef: Number(hedef) },
      update: { hedef: Number(hedef) }
    })
    return reply.status(201).send(result)
  })

  // Hedefleri getir
  app.get('/kullanicilar/:id/hedefler', async (req) => {
    return await prisma.kullaniciHedef.findMany({
      where: { kullaniciId: req.params.id },
      orderBy: [{ yil: 'desc' }, { ay: 'desc' }],
      take: 24
    })
  })
}