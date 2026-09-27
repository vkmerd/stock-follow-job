import { prisma } from '../index.js'

// Bir ürünün varyantlarını, body'de gönderilen mağazalar için silip yeniden oluşturur.
// GÜVENLİK: Sadece body'de GÖNDERİLEN mağazaların varyantları silinip yeniden oluşturulur.
// Frontend bir mağazayı listeden çıkarıp gönderirse (örn. görünüm filtresi nedeniyle),
// o mağazanın stoğu burada SİLİNMEZ — sadece dokunulmaz, olduğu gibi kalır.
async function replaceVaryantlar(urunId, varyantlar, kodMap, ilkMagazaId) {
  const hazirVaryantlar = varyantlar.map(v => ({
    urunId,
    renk:     v.renk   || null,
    beden:    v.beden  || null,
    adet:     Number(v.adet) || 0,
    barkod:   v.barkod || null,
    magazaId: kodMap[v.magaza] || kodMap[v.magazaId] || v.magazaId || ilkMagazaId,
  }))

  const gonderilenMagazaIdleri = [...new Set(hazirVaryantlar.map(v => v.magazaId).filter(Boolean))]

  await prisma.varyant.deleteMany({
    where: {
      urunId,
      ...(gonderilenMagazaIdleri.length > 0 && { magazaId: { in: gonderilenMagazaIdleri } })
    }
  })
  if (hazirVaryantlar.length > 0) {
    await prisma.varyant.createMany({ data: hazirVaryantlar })
  }
}

export default async function urunlerRoutes(app) {

  // Tüm ürünler — marka/fiyat/stok filtreleri ve (page verilirse) sayfalama destekler.
  // `page` gönderilmezse eski davranış korunur: düz bir dizi döner (diğer tüm
  // çağıranlar — dashboard, satış ekranı, vb. — bunu bekliyor).
  app.get('/urunler', async (req) => {
    const { magazaId, q, marka, kategori, fiyatMin, fiyatMax, stokDurum, page, limit } = req.query

    const where = {
      aktif: true,
      ...(q && {
        OR: [
          { ad:        { contains: q, mode: 'insensitive' } },
          { kod:       { contains: q, mode: 'insensitive' } },
          { barkod:    { contains: q, mode: 'insensitive' } },
          { sku:       { contains: q, mode: 'insensitive' } },
          { marka:     { contains: q, mode: 'insensitive' } },
          { ticimaxId: { contains: q, mode: 'insensitive' } },
        ]
      }),
      ...(marka && { marka }),
      ...(kategori && { kategori }),
      ...((fiyatMin || fiyatMax) && {
        satisF: {
          ...(fiyatMin && { gte: Number(fiyatMin) }),
          ...(fiyatMax && { lte: Number(fiyatMax) }),
        }
      }),
      // Bir mağaza seçiliyse (üst bar "Mağaza seçici") yalnızca o mağazaya atanmış —
      // yani o mağaza için varyant satırı olan — ürünler listelenir. Aksi halde
      // "Vega Ayakkabı" seçilince Vega Çanta'nın ürünleri de 0 stokla görünüyordu.
      ...(magazaId && { varyantlar: { some: { magazaId } } }),
    }

    // Stok durumu (stokta/kritik/tükendi) Varyant tablosunda ürün bazlı toplanmış bir
    // sütun olmadığı için ayrı bir groupBy adımıyla hesaplanıp eşleşen id'ler where'e eklenir.
    if (stokDurum && stokDurum !== 'hepsi') {
      const adaylar = await prisma.urun.findMany({ where, select: { id: true, kritikStok: true } })
      const adayIdleri = adaylar.map(a => a.id)
      const toplamlar = adayIdleri.length > 0
        ? await prisma.varyant.groupBy({
            by: ['urunId'],
            where: { urunId: { in: adayIdleri }, ...(magazaId && { magazaId }) },
            _sum: { adet: true }
          })
        : []
      const toplamMap = new Map(toplamlar.map(t => [t.urunId, t._sum.adet || 0]))
      where.id = {
        in: adaylar.filter(a => {
          const toplam = toplamMap.get(a.id) || 0
          const esik = a.kritikStok ?? 3
          if (stokDurum === 'stokta')  return toplam > 0
          if (stokDurum === 'kritik')  return toplam <= esik
          if (stokDurum === 'tukendi') return toplam <= 0
          return true
        }).map(a => a.id)
      }
    }

    const ortakSorgu = {
      where,
      include: {
        varyantlar: {
          where: magazaId ? { magazaId } : {},
          include: { magaza: { select: { id: true, ad: true, kod: true } } }
        }
      },
      orderBy: { olusturuldu: 'desc' } // en son yüklenen ürün en üstte
    }

    if (page == null) {
      return await prisma.urun.findMany(ortakSorgu)
    }

    const limitSayi = Math.min(200, Math.max(1, Number(limit) || 30))
    const sayfaSayi = Math.max(1, Number(page) || 1)
    const [total, items, eslesenler] = await Promise.all([
      prisma.urun.count({ where }),
      prisma.urun.findMany({ ...ortakSorgu, skip: (sayfaSayi - 1) * limitSayi, take: limitSayi }),
      // Mağaza bazlı stok özeti — sadece bu sayfadaki değil, filtreye uyan TÜM ürünler
      // üzerinden hesaplanır ki panelin üstündeki özet gerçek toplamları göstersin.
      prisma.urun.findMany({ where, select: { id: true } })
    ])

    const eslesenIdler = eslesenler.map(u => u.id)
    const magazaGruplari = eslesenIdler.length > 0
      ? await prisma.varyant.groupBy({
          by: ['magazaId'],
          where: { urunId: { in: eslesenIdler }, ...(magazaId && { magazaId }) },
          _sum: { adet: true }
        })
      : []
    const magazaStoklari = Object.fromEntries(
      magazaGruplari.map(g => [g.magazaId, g._sum.adet || 0])
    )
    const stokToplam = Object.values(magazaStoklari).reduce((s, n) => s + n, 0)

    return {
      items, total, page: sayfaSayi, limit: limitSayi,
      totalPages: Math.max(1, Math.ceil(total / limitSayi)),
      magazaStoklari, stokToplam
    }
  })

  // Tek ürün
  app.get('/urunler/:id', async (req, reply) => {
    const urun = await prisma.urun.findUnique({
      where: { id: req.params.id },
      include: {
        varyantlar: { include: { magaza: { select: { id: true, ad: true, kod: true } } } }
      }
    })
    if (!urun) return reply.status(404).send({ hata: 'Bulunamadı' })
    return urun
  })

  // Barkod ile varyant bul
  app.get('/urunler/barkod/:barkod', async (req, reply) => {
    const { barkod } = req.params
    const { magazaId } = req.query

    // Önce varyant tablosunda ara
    const varyant = await prisma.varyant.findFirst({
      where: { barkod },
      include: {
        urun:  true,
        magaza: { select: { id: true, ad: true, kod: true } }
      }
    })

    if (varyant) {
      // Mağaza bazlı stok
      const magazaStok = await prisma.varyant.findFirst({
        where: {
          urunId:  varyant.urunId,
          barkod,
          ...(magazaId && { magazaId })
        }
      })
      return {
        bulundu:  true,
        kaynak:   'varyant',
        urun:     varyant.urun,
        varyant:  varyant,
        stok:     magazaStok?.adet ?? varyant.adet,
      }
    }

    // Ürün tablosunda barkod alanında ara
    const urun = await prisma.urun.findFirst({
      where: { barkod, aktif: true },
      include: {
        varyantlar: {
          where: magazaId ? { magazaId } : {},
          include: { magaza: true }
        }
      }
    })

    if (urun) {
      return {
        bulundu: true,
        kaynak:  'urun',
        urun,
        varyant: urun.varyantlar[0] || null,
        stok:    urun.varyantlar.reduce((t, v) => t + v.adet, 0),
      }
    }

    return reply.status(404).send({ bulundu: false, hata: 'Barkod bulunamadı' })
  })

  // Son kod
  app.get('/urunler/son-kod', async () => {
    const son = await prisma.urun.findFirst({
      where:   { kod: { startsWith: 'V-' } },
      orderBy: { kod: 'desc' },
      select:  { kod: true }
    })
    if (!son) return { kod: 'V-00001' }
    const sayi = parseInt(son.kod.replace('V-', '')) + 1
    return { kod: `V-${String(sayi).padStart(5, '0')}` }
  })

  // Ürün ekle
  app.post('/urunler', async (req, reply) => {
    const { varyantlar, ...urunVeri } = req.body

    // Mağaza kodu/ad → id eşleştirmesi
    const magazalar = await prisma.magaza.findMany({ select: { id: true, kod: true, ad: true } })
    const kodMap = {}
    magazalar.forEach(m => {
      kodMap[m.kod] = m.id  // M1, M2
      kodMap[m.ad]  = m.id  // "Merkez Mağaza" gibi
    })
    const ilkMagazaId = magazalar[0]?.id

    // Schema'ya uymayan alanları ayır
    const {
      resimler, malzeme, ticimaxId,
      varyantlar: _v, ...temizUrunVeri
    } = urunVeri

    // barkod alanı benzersiz (unique) — aynı barkodlu bir ürün zaten varsa (örn. daha önce
    // Shopify senkronundan ya da başka bir aktarımdan kalmışsa, ya da soft-delete edilmiş
    // olsa bile) yeni satır oluşturmaya çalışmak Prisma P2002 hatasıyla patlar. Bunun yerine
    // mevcut ürünü güncelleyip (ve pasifse yeniden aktif edip) aynı kaydı kullanıyoruz.
    const mevcutBarkodluUrun = temizUrunVeri.barkod
      ? await prisma.urun.findFirst({ where: { barkod: temizUrunVeri.barkod } })
      : null

    if (mevcutBarkodluUrun) {
      const { kod: _kod, ...guncellemeVeri } = temizUrunVeri
      const urun = await prisma.urun.update({
        where: { id: mevcutBarkodluUrun.id },
        data: {
          ...guncellemeVeri,
          aktif: true,
          ...(resimler?.length && { resimler }),
          ...(malzeme          && { malzeme }),
          ...(ticimaxId        && { ticimaxId }),
        }
      })
      if (varyantlar?.length > 0) {
        await replaceVaryantlar(urun.id, varyantlar, kodMap, ilkMagazaId)
      }
      return reply.status(200).send(await prisma.urun.findUnique({
        where: { id: urun.id },
        include: { varyantlar: { include: { magaza: { select: { id: true, ad: true, kod: true } } } } }
      }))
    }

    // kod her zaman backend'de üret — race condition önlemek için
    // frontend'den gelse bile override et
    {
      const sonUrun = await prisma.urun.findFirst({
        where: { kod: { startsWith: 'V-' } },
        orderBy: { kod: 'desc' },
        select: { kod: true }
      })
      const sayi = sonUrun ? parseInt(sonUrun.kod.replace('V-', '')) + 1 : 1
      temizUrunVeri.kod = `V-${String(sayi).padStart(5, '0')}`
      temizUrunVeri.sku = temizUrunVeri.sku?.trim() || temizUrunVeri.kod
    }

    const urun = await prisma.urun.create({
      data: {
        ...temizUrunVeri,
        ...(resimler?.length  && { resimler }),
        ...(malzeme           && { malzeme }),
        ...(ticimaxId         && { ticimaxId }),
        ...(varyantlar?.length > 0 && {
          varyantlar: {
            create: varyantlar.map(v => ({
              renk:     v.renk     || null,
              beden:    v.beden    || null,
              adet:     Number(v.adet) || 0,
              barkod:   v.barkod   || null,
              magazaId: kodMap[v.magaza] || kodMap[v.magazaId] || v.magazaId || ilkMagazaId,
            }))
          }
        })
      },
      include: {
        varyantlar: { include: { magaza: { select: { id: true, ad: true, kod: true } } } }
      }
    })
    return reply.status(201).send(urun)
  })

  // Ürün güncelle
  app.put('/urunler/:id', async (req, reply) => {
    const { varyantlar, ...urunVeri } = req.body

    // Mağaza eşleştirmesi
    const magazalarGuncelle = await prisma.magaza.findMany({ select: { id: true, kod: true, ad: true } })
    const kodMap = {}
    magazalarGuncelle.forEach(m => { kodMap[m.kod] = m.id; kodMap[m.ad] = m.id })
    const ilkMagazaId = magazalarGuncelle[0]?.id

    // Schema dışı alanları ayır
    const {
      resimler: resimlerUp, malzeme: malzemeUp, ticimaxId: ticimaxIdUp,
      ...temizUrunVeriUp
    } = urunVeri

    const urun = await prisma.urun.update({
      where: { id: req.params.id },
      data: {
        ...temizUrunVeriUp,
        ...(resimlerUp !== undefined && { resimler: resimlerUp || [] }),
        ...(malzemeUp  !== undefined && { malzeme:  malzemeUp  || null }),
        ...(ticimaxIdUp!== undefined && { ticimaxId:ticimaxIdUp|| null }),
      }
    })

    if (varyantlar) {
      await replaceVaryantlar(urun.id, varyantlar, kodMap, ilkMagazaId)
    }

    return await prisma.urun.findUnique({
      where: { id: urun.id },
      include: {
        varyantlar: { include: { magaza: { select: { id: true, ad: true, kod: true } } } }
      }
    })
  })

  // Ürün sil (soft delete)
  app.delete('/urunler/:id', { config: { rawBody: false } }, async (req) => {
    await prisma.urun.update({
      where: { id: req.params.id },
      data:  { aktif: false }
    })
    return { basarili: true }
  })
}