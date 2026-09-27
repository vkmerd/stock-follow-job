import { prisma } from '../index.js'

export default async function bankaRoutes(app) {

  // ─── KATEGORİLER ─────────────────────────────────────────────
  app.get('/banka/kategoriler', async () => {
    return await prisma.bankaKategori.findMany({
      where: { aktif: true },
      orderBy: [{ tip: 'asc' }, { ad: 'asc' }]
    })
  })

  app.post('/banka/kategoriler', async (req, reply) => {
    const { ad, tip } = req.body
    if (!ad?.trim() || !tip) return reply.status(400).send({ hata: 'Ad ve tip zorunlu' })
    const kat = await prisma.bankaKategori.upsert({
      where:  { ad: ad.trim() },
      update: { aktif: true, tip },
      create: { ad: ad.trim(), tip }
    })
    return reply.status(201).send(kat)
  })

  app.put('/banka/kategoriler/:id', async (req) => {
    return await prisma.bankaKategori.update({
      where: { id: req.params.id },
      data:  req.body
    })
  })

  app.delete('/banka/kategoriler/:id', async (req) => {
    await prisma.bankaKategori.update({
      where: { id: req.params.id },
      data:  { aktif: false }
    })
    return { basarili: true }
  })

  // ─── HESAPLAR ────────────────────────────────────────────────
  app.get('/banka/hesaplar', async (req) => {
    const { magazaId } = req.query
    return await prisma.bankaHesap.findMany({
      where: {
        aktif: true,
        ...(magazaId && { magazaId }),
      },
      include: {
        magaza: { select: { id: true, ad: true, kod: true } },
        _count: { select: { hareketler: true } }
      },
      orderBy: { ad: 'asc' }
    })
  })

  app.post('/banka/hesaplar', async (req, reply) => {
    const { ad, banka, iban, magazaId, bakiye = 0 } = req.body
    if (!ad?.trim() || !banka?.trim()) return reply.status(400).send({ hata: 'Ad ve banka zorunlu' })
    const hesap = await prisma.bankaHesap.create({
      data: {
        ad: ad.trim(), banka: banka.trim(),
        iban: iban || null,
        magazaId: magazaId || null,
        bakiye: Number(bakiye)
      },
      include: { magaza: { select: { id: true, ad: true } } }
    })
    return reply.status(201).send(hesap)
  })

  app.put('/banka/hesaplar/:id', async (req) => {
    const { _count, magaza, hareketler, olusturuldu, ...veri } = req.body
    return await prisma.bankaHesap.update({
      where: { id: req.params.id },
      data:  veri,
      include: { magaza: { select: { id: true, ad: true } } }
    })
  })

  app.delete('/banka/hesaplar/:id', async (req) => {
    await prisma.bankaHesap.update({
      where: { id: req.params.id },
      data:  { aktif: false }
    })
    return { basarili: true }
  })

  // ─── HAREKETLER ──────────────────────────────────────────────
  app.get('/banka/hareketler', async (req) => {
    const { hesapId, magazaId, tip, baslangic, bitis, limit = 100 } = req.query
    return await prisma.bankaHareket.findMany({
      where: {
        ...(hesapId   && { hesapId }),
        ...(magazaId  && { magazaId }),
        ...(tip       && { tip }),
        ...(baslangic && bitis && {
          tarih: { gte: new Date(baslangic), lte: new Date(bitis) }
        }),
      },
      include: {
        hesap:    { select: { id: true, ad: true, banka: true } },
        kategori: { select: { id: true, ad: true, tip: true } },
        magaza:   { select: { id: true, ad: true } },
      },
      orderBy: { tarih: 'desc' },
      take:    Number(limit),
    })
  })

  app.get('/banka/ozet', async (req) => {
    const { hesapId, magazaId, yil, ay } = req.query
    const simdi = new Date()
    const hedefYil = Number(yil) || simdi.getFullYear()
    const hedefAy  = Number(ay)  || simdi.getMonth() + 1
    const baslangic = new Date(hedefYil, hedefAy - 1, 1)
    const bitis     = new Date(hedefYil, hedefAy, 0, 23, 59, 59)

    const hareketler = await prisma.bankaHareket.findMany({
      where: {
        tarih: { gte: baslangic, lte: bitis },
        ...(hesapId  && { hesapId }),
        ...(magazaId && { magazaId }),
      },
      include: { kategori: true }
    })

    const gelir = hareketler.filter(h=>h.tip==='gelir').reduce((t,h)=>t+Number(h.tutar),0)
    const gider = hareketler.filter(h=>h.tip==='gider').reduce((t,h)=>t+Number(h.tutar),0)

    const kategoriBazli = {}
    hareketler.forEach(h => {
      const key = h.kategori?.ad || 'Kategorisiz'
      if (!kategoriBazli[key]) kategoriBazli[key] = { ad:key, tip:h.tip, toplam:0, sayi:0 }
      kategoriBazli[key].toplam += Number(h.tutar)
      kategoriBazli[key].sayi++
    })

    return {
      yil: hedefYil, ay: hedefAy,
      gelir, gider, net: gelir - gider,
      hareketSayisi: hareketler.length,
      kategoriler: Object.values(kategoriBazli).sort((a,b)=>b.toplam-a.toplam),
    }
  })

  app.post('/banka/hareketler', async (req, reply) => {
    const { hesapId, kategoriId, magazaId, tip, aciklama, tutar, referans, tarih } = req.body
    if (!hesapId || !tutar || !tip) return reply.status(400).send({ hata: 'hesapId, tip ve tutar zorunlu' })

    const hesap = await prisma.bankaHesap.findUnique({ where: { id: hesapId } })
    if (!hesap) return reply.status(404).send({ hata: 'Hesap bulunamadı' })

    const yeniTutar  = Number(tutar)
    const yeniBakiye = tip === 'gelir'
      ? Number(hesap.bakiye) + yeniTutar
      : Number(hesap.bakiye) - yeniTutar

    const [hareket] = await prisma.$transaction([
      prisma.bankaHareket.create({
        data: {
          hesapId,
          kategoriId: kategoriId || null,
          magazaId:   magazaId   || null,
          tip, aciklama: aciklama || null,
          tutar: yeniTutar, bakiye: yeniBakiye,
          referans: referans || null,
          tarih: tarih ? new Date(tarih) : new Date(),
        },
        include: {
          hesap:    { select: { id: true, ad: true, banka: true } },
          kategori: { select: { id: true, ad: true } },
          magaza:   { select: { id: true, ad: true } },
        }
      }),
      prisma.bankaHesap.update({ where: { id: hesapId }, data: { bakiye: yeniBakiye } })
    ])

    return reply.status(201).send(hareket)
  })

  app.delete('/banka/hareketler/:id', async (req) => {
    const hareket = await prisma.bankaHareket.findUnique({ where: { id: req.params.id } })
    if (!hareket) return { basarili: false }
    const hesap = await prisma.bankaHesap.findUnique({ where: { id: hareket.hesapId } })
    const eskiBakiye = hareket.tip === 'gelir'
      ? Number(hesap.bakiye) - Number(hareket.tutar)
      : Number(hesap.bakiye) + Number(hareket.tutar)
    await prisma.$transaction([
      prisma.bankaHareket.delete({ where: { id: req.params.id } }),
      prisma.bankaHesap.update({ where: { id: hareket.hesapId }, data: { bakiye: eskiBakiye } })
    ])
    return { basarili: true }
  })

  // ─── MUTABAKAT ───────────────────────────────────────────────
  app.get('/banka/mutabakat', async (req) => {
    const { hesapId, baslangic, bitis } = req.query
    const bas = baslangic ? new Date(baslangic) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const bit = bitis ? new Date(bitis) : new Date()

    const satisOdemeleri = await prisma.satisOdeme.findMany({
      where: { tip: { in: ['kart','havale'] }, satis: { tarih: { gte: bas, lte: bit } } },
      include: {
        satis: { select: { fisNo: true, tarih: true, magaza: { select: { ad: true } } } },
        posTerminal: { select: { ad: true, banka: true } }
      }
    })

    const bankaHareketleri = await prisma.bankaHareket.findMany({
      where: { ...(hesapId && { hesapId }), tip: 'gelir', tarih: { gte: bas, lte: bit } },
      include: { hesap: { select: { ad: true, banka: true } } }
    })

    const toplamSatisOdeme = satisOdemeleri.reduce((t,o)=>t+Number(o.tutar),0)
    const toplamBankaGelir = bankaHareketleri.reduce((t,h)=>t+Number(h.tutar),0)
    const fark = toplamBankaGelir - toplamSatisOdeme

    return {
      satisOdemeleri, bankaHareketleri,
      toplamSatisOdeme, toplamBankaGelir, fark,
      mutabakatDurumu: Math.abs(fark) < 1 ? 'eslesti' : fark > 0 ? 'fazla' : 'eksik'
    }
  })

  // ─── VİRMAN ──────────────────────────────────────────────────
  app.post('/banka/virman', async (req, reply) => {
    const { tip, kaynakId, hedefId, tutar, aciklama, tarih } = req.body
    if (!hedefId || !tutar || tutar <= 0) return reply.status(400).send({ hata: 'Hedef hesap ve tutar zorunlu' })

    const hedef = await prisma.bankaHesap.findUnique({ where: { id: hedefId } })
    if (!hedef) return reply.status(404).send({ hata: 'Hedef hesap bulunamadı' })

    const islemTarihi = tarih ? new Date(tarih) : new Date()

    if (tip === 'banka') {
      // Bankalar arası virman
      if (!kaynakId) return reply.status(400).send({ hata: 'Kaynak hesap zorunlu' })
      const kaynak = await prisma.bankaHesap.findUnique({ where: { id: kaynakId } })
      if (!kaynak) return reply.status(404).send({ hata: 'Kaynak hesap bulunamadı' })
      // Eksi bakiye kontrolü yok - virman her durumda yapılabilir

      await prisma.$transaction(async (tx) => {
        const yeniKaynakBakiye = Number(kaynak.bakiye) - Number(tutar)
        const yeniHedefBakiye  = Number(hedef.bakiye)  + Number(tutar)

        await tx.bankaHesap.update({ where: { id: kaynakId }, data: { bakiye: yeniKaynakBakiye } })
        await tx.bankaHesap.update({ where: { id: hedefId  }, data: { bakiye: yeniHedefBakiye  } })

        await tx.bankaHareket.create({
          data: { hesapId: kaynakId, tip: 'gider', aciklama: aciklama || `Virman → ${hedef.ad}`, tutar: Number(tutar), bakiye: yeniKaynakBakiye, tarih: islemTarihi }
        })
        await tx.bankaHareket.create({
          data: { hesapId: hedefId,  tip: 'gelir', aciklama: aciklama || `Virman ← ${kaynak.ad}`, tutar: Number(tutar), bakiye: yeniHedefBakiye, tarih: islemTarihi }
        })
      })
    } else if (tip === 'kasa') {
      // Kasadan bankaya aktarım
      const yeniHedefBakiye = Number(hedef.bakiye) + Number(tutar)
      await prisma.bankaHesap.update({ where: { id: hedefId }, data: { bakiye: yeniHedefBakiye } })
      await prisma.bankaHareket.create({
        data: { hesapId: hedefId, tip: 'gelir', aciklama: aciklama || 'Kasadan Nakit Aktarım', tutar: Number(tutar), bakiye: yeniHedefBakiye, tarih: islemTarihi }
      })
    }

    return { basarili: true }
  })

}