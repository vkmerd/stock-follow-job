import { prisma } from '../index.js'

export default async function masrafRoutes(app) {

  // ─── KATEGORİLER ─────────────────────────────────────────────
  app.get('/masraf/kategoriler', async () => {
    return await prisma.masrafKategori.findMany({
      where: { aktif: true },
      orderBy: { ad: 'asc' },
      include: { _count: { select: { masraflar: true } } }
    })
  })

  app.post('/masraf/kategoriler', async (req, reply) => {
    const { ad, ikon = '💰', renk = '#c9b882' } = req.body
    if (!ad?.trim()) return reply.status(400).send({ hata: 'Ad zorunlu' })
    const kat = await prisma.masrafKategori.upsert({
      where:  { ad: ad.trim() },
      update: { aktif: true, ikon, renk },
      create: { ad: ad.trim(), ikon, renk }
    })
    return reply.status(201).send(kat)
  })

  app.put('/masraf/kategoriler/:id', async (req) => {
    return await prisma.masrafKategori.update({
      where: { id: req.params.id },
      data:  req.body
    })
  })

  app.delete('/masraf/kategoriler/:id', async (req) => {
    await prisma.masrafKategori.update({
      where: { id: req.params.id },
      data:  { aktif: false }
    })
    return { basarili: true }
  })

  // ─── MASRAFLAR ───────────────────────────────────────────────
  app.get('/masraf', async (req) => {
    const { magazaId, kategoriId, baslangic, bitis, limit = 100 } = req.query

    const where = {
      ...(magazaId   && { magazaId }),
      ...(kategoriId && { kategoriId }),
      ...(baslangic  && bitis && {
        tarih: { gte: new Date(baslangic), lte: new Date(bitis) }
      }),
    }

    return await prisma.masraf.findMany({
      where,
      include: {
        kategori: { select: { id: true, ad: true, ikon: true, renk: true } },
        magaza:   { select: { id: true, ad: true, kod: true } },
      },
      orderBy: { tarih: 'desc' },
      take:    Number(limit),
    })
  })

  // Özet — aylık toplam ve kategori dağılımı
  app.get('/masraf/ozet', async (req) => {
    const { magazaId, yil, ay } = req.query
    const simdi = new Date()
    const hedefYil = Number(yil) || simdi.getFullYear()
    const hedefAy  = Number(ay)  || simdi.getMonth() + 1

    const baslangic = new Date(hedefYil, hedefAy - 1, 1)
    const bitis     = new Date(hedefYil, hedefAy, 0, 23, 59, 59)

    const masraflar = await prisma.masraf.findMany({
      where: {
        tarih: { gte: baslangic, lte: bitis },
        ...(magazaId && { magazaId }),
      },
      include: { kategori: true },
    })

    const toplamTutar = masraflar.reduce((t, m) => t + Number(m.tutar), 0)

    // Kategori bazlı gruplama
    const kategoriBazli = {}
    masraflar.forEach(m => {
      const key = m.kategori?.ad || 'Kategorisiz'
      const ikon = m.kategori?.ikon || '💰'
      const renk = m.kategori?.renk || '#888'
      if (!kategoriBazli[key]) kategoriBazli[key] = { ad: key, ikon, renk, toplam: 0, sayi: 0 }
      kategoriBazli[key].toplam += Number(m.tutar)
      kategoriBazli[key].sayi++
    })

    return {
      yil:          hedefYil,
      ay:           hedefAy,
      toplamTutar,
      masrafSayisi: masraflar.length,
      kategoriler:  Object.values(kategoriBazli).sort((a, b) => b.toplam - a.toplam),
    }
  })

  app.post('/masraf', async (req, reply) => {
    const { kategoriId, magazaId, tutar, aciklama, faturaNo, tarih, kasayaDus = true, odemeKaynagi = 'nakit', bankaHesapId } = req.body
    if (!tutar || tutar <= 0) return reply.status(400).send({ hata: 'Tutar zorunlu' })

    const masraf = await prisma.masraf.create({
      data: {
        ...(kategoriId && { kategori:   { connect: { id: kategoriId } } }),
        ...(magazaId   && { magaza:     { connect: { id: magazaId } } }),
        tutar:         Number(tutar),
        aciklama:      aciklama || null,
        faturaNo:      faturaNo || null,
        tarih:         tarih ? new Date(tarih) : new Date(),
        odemeKaynagi:  odemeKaynagi || 'nakit',
        ...(bankaHesapId && { bankaHesapId }),
      },
      include: {
        kategori: { select: { id: true, ad: true, ikon: true, renk: true } },
        magaza:   { select: { id: true, ad: true, kod: true } },
      }
    })

    // Ödeme kaynağına göre hareket ekle
    if (kasayaDus && odemeKaynagi === 'nakit' && magazaId) {
      try {
        const bugun = new Date()
        bugun.setHours(0,0,0,0)
        const kasa = await prisma.gunlukKasa.findUnique({
          where: { magazaId_tarih: { magazaId, tarih: bugun } }
        })
        if (kasa && kasa.durum === 'acik') {
          await prisma.kasaIslem.create({
            data: {
              kasaId:    kasa.id,
              tip:       'masraf',
              odeme:     'nakit',
              tutar:     Number(tutar),
              aciklama:  aciklama || masraf.kategori?.ad || 'Masraf',
              referansId: null,
            }
          })
        }
      } catch(e) { /* Kasa yoksa sessizce geç */ }
    }

    // Banka hesabından ödeme
    if (odemeKaynagi === 'banka' && bankaHesapId) {
      try {
        const hesap = await prisma.bankaHesap.findUnique({ where: { id: bankaHesapId } })
        if (hesap) {
          const yeniBakiye = Number(hesap.bakiye) - Number(tutar)
          await prisma.bankaHesap.update({ where: { id: bankaHesapId }, data: { bakiye: yeniBakiye } })
          await prisma.bankaHareket.create({
            data: {
              hesapId:  bankaHesapId,
              tip:      'gider',
              aciklama: aciklama || masraf.kategori?.ad || 'Masraf',
              tutar:    Number(tutar),
              bakiye:   yeniBakiye,
              referans: masraf.id,
            }
          })
        }
      } catch(e) { /* Banka hareketi hatası sessizce geç */ }
    }

    // Nakit Kasa'dan ödeme - nakit ama mağaza yoksa
    if (odemeKaynagi === 'nakit' && !magazaId) {
      try {
        const nakitHesap = await prisma.bankaHesap.findFirst({ where: { ad: 'Nakit Kasa' } })
        if (nakitHesap) {
          const yeniBakiye = Number(nakitHesap.bakiye) - Number(tutar)
          await prisma.bankaHesap.update({ where: { id: nakitHesap.id }, data: { bakiye: yeniBakiye } })
          await prisma.bankaHareket.create({
            data: {
              hesapId:  nakitHesap.id,
              tip:      'gider',
              aciklama: aciklama || masraf.kategori?.ad || 'Masraf',
              tutar:    Number(tutar),
              bakiye:   yeniBakiye,
              referans: masraf.id,
            }
          })
        }
      } catch(e) { /* Nakit kasa hareketi sessizce geç */ }
    }

    return reply.status(201).send(masraf)
  })

  app.put('/masraf/:id', async (req) => {
    const { kategoriId, magazaId, tutar, aciklama, faturaNo, tarih } = req.body
    return await prisma.masraf.update({
      where: { id: req.params.id },
      data: {
        ...(kategoriId !== undefined && { kategoriId: kategoriId || null }),
        ...(magazaId   !== undefined && { magazaId:   magazaId   || null }),
        ...(tutar      !== undefined && { tutar: Number(tutar) }),
        ...(aciklama   !== undefined && { aciklama }),
        ...(faturaNo   !== undefined && { faturaNo }),
        ...(tarih      !== undefined && { tarih: new Date(tarih) }),
      },
      include: { kategori: true, magaza: true }
    })
  })

  app.delete('/masraf/:id', async (req) => {
    const id = req.params.id
    // Bağlı banka hareketini de sil
    try {
      const hareket = await prisma.bankaHareket.findFirst({ where: { referans: id } })
      if (hareket) {
        // Bakiyeyi geri al
        const hesap = await prisma.bankaHesap.findUnique({ where: { id: hareket.hesapId } })
        if (hesap) {
          await prisma.bankaHesap.update({
            where: { id: hesap.id },
            data: { bakiye: Number(hesap.bakiye) + Number(hareket.tutar) }
          })
        }
        await prisma.bankaHareket.delete({ where: { id: hareket.id } })
      }
    } catch(e) { /* Banka hareketi yoksa geç */ }
    await prisma.masraf.delete({ where: { id } })
    return { basarili: true }
  })
}
