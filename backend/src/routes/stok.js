import { prisma } from '../index.js'

// Mağaza bazlı tekil stok modelinde renk/beden ayrımı olmayan varyantlar
// `renk: 'Standart', beden: null` olarak tutulur (bkz. shopify.js, urunler.js).
// Bu dosyadaki rotalar `renk` boş bırakıldığında (Stok Hareketleri formunda
// normal/beklenen durum) eskiden `renk: null` kullanıyordu — bu, var olan
// 'Standart' varyant satırını bulamayıp YENİ, farklı (ve stoğu hiçbir yerde
// görünmeyen "hayalet") bir satır oluşturuyordu. Standart'a normalize ediyoruz.
const normRenk = (renk) => (renk && renk.trim()) ? renk.trim() : 'Standart'

export default async function stokRoutes(app) {

  // Stok geçmişi. Stok Yönetimi > "Stok Geçmişi" sekmesi buradan besleniyor:
  // filtreler (ürün/mağaza/tip/yön/tarih/serbest arama), sayfalama, dönem özeti ve
  // her hareketin KAYNAĞI (hangi satış fişi / sipariş / iade kaydı) birlikte dönüyor.
  // NOT: yanıt artık düz dizi değil `{ hareketler, toplam, ozet }` nesnesi.
  app.get('/stok/hareketler', async (req) => {
    const { urunId, magazaId, tip, yon, q, baslangic, bitis, limit = 200, offset = 0 } = req.query

    const where = {
      ...(urunId   && { urunId }),
      ...(magazaId && magazaId !== 'hepsi' && { magazaId }),
      ...(tip      && tip      !== 'hepsi' && { tip }),
      // Yön, tipten bağımsız: aynı tip (transfer, sayım) hem giriş hem çıkış üretebiliyor.
      ...(yon === 'giris' && { adet: { gt: 0 } }),
      ...(yon === 'cikis' && { adet: { lt: 0 } }),
      ...((baslangic || bitis) && {
        tarih: {
          ...(baslangic && { gte: new Date(baslangic) }),
          // Bitiş tarihi gün olarak geliyor (2026-09-26) — o günün tamamı kapsansın
          // diye ertesi günün başına kadar alıyoruz, yoksa son günün hareketleri düşerdi.
          ...(bitis && { lt: new Date(new Date(bitis).getTime() + 86400000) }),
        }
      }),
      ...(q && {
        OR: [
          { notlar: { contains: q, mode: 'insensitive' } },
          { urun: { ad:     { contains: q, mode: 'insensitive' } } },
          { urun: { kod:    { contains: q, mode: 'insensitive' } } },
          { urun: { sku:    { contains: q, mode: 'insensitive' } } },
          { urun: { barkod: { contains: q, mode: 'insensitive' } } },
        ]
      }),
    }

    const [hareketler, toplam, girisToplam, cikisToplam] = await Promise.all([
      prisma.stokHareket.findMany({
        where,
        include: {
          urun:   { select: { id: true, ad: true, kod: true, sku: true, marka: true, renkAdi: true } },
          magaza: { select: { id: true, ad: true, kod: true } },
        },
        orderBy: { tarih: 'desc' },
        take: Math.min(Number(limit) || 200, 1000),
        skip: Number(offset) || 0,
      }),
      prisma.stokHareket.count({ where }),
      prisma.stokHareket.aggregate({ where: { ...where, adet: { gt: 0 } }, _sum: { adet: true } }),
      prisma.stokHareket.aggregate({ where: { ...where, adet: { lt: 0 } }, _sum: { adet: true } }),
    ])

    // Hareketin KAYNAĞI: referansId hangi tabloya ait olduğunu söylemiyor (tek bir
    // serbest alan), bu yüzden dönen id'ler dört tabloda birden aranıp eşleşen belge
    // numarası satıra ekleniyor. "Ne sebeple düşüldü" sorusunun cevabı bu.
    const referansIdler = [...new Set(hareketler.map(h => h.referansId).filter(Boolean))]
    const kaynakMap = new Map()
    if (referansIdler.length > 0) {
      const [satislar, siparisler, iadeler, degisimler] = await Promise.all([
        prisma.satis.findMany({ where: { id: { in: referansIdler } }, select: { id: true, fisNo: true } }),
        prisma.siparis.findMany({ where: { id: { in: referansIdler } }, select: { id: true, siparisNo: true, kanal: true } }),
        prisma.iade.findMany({ where: { id: { in: referansIdler } }, select: { id: true, iadeNo: true } }),
        prisma.degisim.findMany({ where: { id: { in: referansIdler } }, select: { id: true, degisimNo: true } }),
      ])
      satislar.forEach(s   => kaynakMap.set(s.id, { tur: 'satis',   no: s.fisNo }))
      siparisler.forEach(s => kaynakMap.set(s.id, { tur: 'siparis', no: s.siparisNo, kanal: s.kanal }))
      iadeler.forEach(i    => kaynakMap.set(i.id, { tur: 'iade',    no: i.iadeNo }))
      degisimler.forEach(d => kaynakMap.set(d.id, { tur: 'degisim', no: d.degisimNo }))
    }

    return {
      hareketler: hareketler.map(h => ({ ...h, kaynak: h.referansId ? (kaynakMap.get(h.referansId) || null) : null })),
      toplam,
      ozet: {
        giris: Number(girisToplam._sum.adet || 0),
        cikis: Math.abs(Number(cikisToplam._sum.adet || 0)),
        net:   Number(girisToplam._sum.adet || 0) + Number(cikisToplam._sum.adet || 0),
      },
    }
  })

  // Manuel stok hareketi ekle (alış, sayım, fire vs.)
  app.post('/stok/hareketler', async (req, reply) => {
    const { urunId, magazaId, renk, beden, adet, ...rest } = req.body

    const hareket = await prisma.$transaction(async (tx) => {
      const yeniHareket = await tx.stokHareket.create({
        data: { urunId, magazaId, renk: normRenk(renk), beden: beden || null, adet, ...rest },
        include: { urun: true, magaza: true }
      })

      // Varyant stok güncelle
      if (urunId && magazaId) {
        const varyant = await tx.varyant.findFirst({
          where: { urunId, magazaId, renk: normRenk(renk), beden: beden || null }
        })
        if (varyant) {
          await tx.varyant.update({
            where: { id: varyant.id },
            data:  { adet: Math.max(0, varyant.adet + adet) }
          })
        } else if (adet > 0) {
          // Varyant yoksa oluştur (alış senaryosu)
          await tx.varyant.create({
            data: { urunId, magazaId, renk: normRenk(renk), beden: beden || null, adet }
          })
        }
      }

      return yeniHareket
    })

    return reply.status(201).send(hareket)
  })

  // Stok düş (doğrudan)
  app.post('/stok/dus', async (req, reply) => {
    const { urunId, magazaId, renk, beden, adet } = req.body
    const varyant = await prisma.varyant.findFirst({
      where: { urunId, magazaId, renk: normRenk(renk), beden: beden || null }
    })
    if (!varyant) return reply.status(404).send({ hata: 'Varyant bulunamadı' })
    return await prisma.varyant.update({
      where: { id: varyant.id },
      data:  { adet: Math.max(0, varyant.adet - adet) }
    })
  })

  // Kritik stok listesi
  app.get('/stok/kritik', async (req) => {
    const { magazaId } = req.query
    const urunler = await prisma.urun.findMany({
      where: { aktif: true },
      include: {
        varyantlar: {
          where: magazaId ? { magazaId } : {},
          include: { magaza: { select: { id: true, ad: true } } }
        }
      }
    })
    return urunler.filter(u => {
      const toplam = u.varyantlar.reduce((t, v) => t + v.adet, 0)
      return toplam <= u.kritikStok
    })
  })

  // Mağazalar arası transfer
  app.post('/stok/transfer', async (req, reply) => {
    const { urunId, kaynakMagazaId, hedefMagazaId, renk, beden, adet, notlar } = req.body

    const kaynak = await prisma.varyant.findFirst({
      where: { urunId, magazaId: kaynakMagazaId, renk: normRenk(renk), beden: beden || null }
    })
    if (!kaynak || kaynak.adet < adet) {
      return reply.status(400).send({ hata: 'Yetersiz stok' })
    }

    await prisma.$transaction(async (tx) => {
      // Kaynaktan düş
      await tx.varyant.update({
        where: { id: kaynak.id },
        data:  { adet: kaynak.adet - adet }
      })

      // Hedefe ekle veya oluştur
      const hedef = await tx.varyant.findFirst({
        where: { urunId, magazaId: hedefMagazaId, renk: normRenk(renk), beden: beden || null }
      })
      if (hedef) {
        await tx.varyant.update({
          where: { id: hedef.id },
          data:  { adet: hedef.adet + adet }
        })
      } else {
        await tx.varyant.create({
          data: { urunId, magazaId: hedefMagazaId, renk: normRenk(renk), beden: beden || null, adet }
        })
      }

      // İki taraflı hareket kaydı
      await tx.stokHareket.createMany({
        data: [
          { urunId, magazaId: kaynakMagazaId, tip: 'transfer', renk: normRenk(renk), beden: beden || null, adet: -adet, birimFiyat: 0, notlar },
          { urunId, magazaId: hedefMagazaId,  tip: 'transfer', renk: normRenk(renk), beden: beden || null, adet:  adet, birimFiyat: 0, notlar },
        ]
      })
    })

    return { basarili: true }
  })
}
