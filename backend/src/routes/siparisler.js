import { prisma } from '../index.js'
import { pushOrderStatusToShopify } from './shopify.js'

const DURUMLAR = ['beklemede','hazirlaniyor','paketlendi','kargoda','teslim_edildi','iptal','iade_edildi']

// EFT/Havale ile girilen bir siparişin tutarını ilgili banka hesabına işler.
// tutar negatifse (iptal/iade) bakiyeden düşer — mutabakat kaydı her durumda tutulur.
async function bankaBakiyeYansit(client, hesapId, tutar, aciklama, referans) {
  const hesap = await client.bankaHesap.findUnique({ where: { id: hesapId } })
  if (!hesap) return
  const yeniBakiye = Number(hesap.bakiye) + tutar
  await client.bankaHesap.update({ where: { id: hesap.id }, data: { bakiye: yeniBakiye } })
  await client.bankaHareket.create({
    data: {
      hesapId,
      tip:      tutar >= 0 ? 'gelir' : 'gider',
      aciklama,
      tutar:    Math.abs(tutar),
      bakiye:   yeniBakiye,
      referans,
    }
  })
}

export default async function siparislerRoutes(app) {

  // Tüm siparişler
  app.get('/siparisler', async (req) => {
    const { durum, kanal, magazaId, limit = 50 } = req.query
    return await prisma.siparis.findMany({
      where: {
        ...(durum    && durum !== 'hepsi' && { durum }),
        ...(kanal    && kanal !== 'hepsi' && { kanal }),
        ...(magazaId && { magazaId }),
      },
      include: {
        musteri:  { select: { id: true, ad: true, soyad: true, telefon: true } },
        magaza:   { select: { id: true, ad: true } },
        kalemler: { include: { urun: { select: { id: true, kod: true, ad: true } } } },
      },
      orderBy: { tarih: 'desc' },
      take: Number(limit),
    })
  })

  // Kanal özeti
  app.get('/siparisler/kanal-ozet', async (req) => {
    const { magazaId } = req.query
    const kanallar = await prisma.siparis.groupBy({
      by: ['kanal'],
      where: magazaId ? { magazaId } : {},
      _count: { id: true },
      _sum: { genelToplam: true },
    })
    const durumlar = await prisma.siparis.groupBy({
      by: ['durum'],
      where: magazaId ? { magazaId } : {},
      _count: { id: true },
    })
    return { kanallar, durumlar }
  })

  // Tek sipariş
  app.get('/siparisler/:id', async (req, reply) => {
    const siparis = await prisma.siparis.findUnique({
      where: { id: req.params.id },
      include: {
        musteri:  true,
        magaza:   true,
        kalemler: { include: { urun: { include: { varyantlar: true } } } },
      }
    })
    if (!siparis) return reply.status(404).send({ hata: 'Bulunamadı' })

    // Müşterinin geçmiş siparişleri
    let gecmisSiparisler = []
    if (siparis.musteriId) {
      gecmisSiparisler = await prisma.siparis.findMany({
        where: { musteriId: siparis.musteriId, id: { not: siparis.id } },
        orderBy: { tarih: 'desc' },
        take: 5,
        select: { id: true, siparisNo: true, tarih: true, genelToplam: true, durum: true }
      })
    }
    return { ...siparis, gecmisSiparisler }
  })

  // Sipariş oluştur
  app.post('/siparisler', async (req, reply) => {
    const { kalemler = [], genelToplam, ...veri } = req.body

    // musteriId yoksa musteriAd ile CRM'den bul veya oluştur
    let musteriId = veri.musteriId || null
    if (!musteriId && veri.musteriAd?.trim()) {
      try {
        // Telefon ile bul
        let musteri = veri.musteriTel ? await prisma.musteri.findFirst({
          where: { telefon: veri.musteriTel }
        }) : null
        // Ad ile bul
        if (!musteri) {
          const adParcalari = veri.musteriAd.trim().split(' ')
          musteri = await prisma.musteri.findFirst({
            where: { ad: adParcalari[0], soyad: adParcalari.slice(1).join(' ') || null }
          })
        }
        // Yoksa oluştur
        if (!musteri) {
          const adParcalari = veri.musteriAd.trim().split(' ')
          musteri = await prisma.musteri.create({
            data: {
              ad:      adParcalari[0],
              soyad:   adParcalari.slice(1).join(' ') || null,
              telefon: veri.musteriTel || null,
              adres:   veri.adres || null,
            }
          })
        }
        musteriId = musteri.id
      } catch(e) { /* CRM sessizce geç */ }
    }
    
    // Kalem alanlarını temizle - schema'ya uygun
    const temizKalemler = kalemler.map(k => ({
      urunId:     k.urunId || undefined,
      urunAd:     k.urunAd || '',
      renk:       k.renk || null,
      beden:      k.beden || null,
      adet:       Number(k.adet) || 1,
      birimFiyat: Number(k.birimFiyat) || 0,
      toplam:     Number(k.toplam || (k.adet * k.birimFiyat)) || 0,
    }))

    const siparis = await prisma.$transaction(async (tx) => {
      const yeniSiparis = await tx.siparis.create({
        data: {
          ...veri,
          musteriId,
          genelToplam: Number(genelToplam) || 0,
          kalemler: { create: temizKalemler }
        },
        include: { kalemler: true }
      })

      // Ürünle eşleşen kalemler için mağaza stoğunu düş (ana stok)
      if (veri.magazaId) {
        for (const kalem of yeniSiparis.kalemler) {
          if (!kalem.urunId) continue
          const varyant = await tx.varyant.findFirst({
            where: {
              urunId:   kalem.urunId,
              magazaId: veri.magazaId,
              renk:     kalem.renk  || null,
              beden:    kalem.beden || null,
            }
          })
          if (varyant) {
            await tx.varyant.update({
              where: { id: varyant.id },
              data:  { adet: Math.max(0, varyant.adet - kalem.adet) }
            })
            await tx.stokHareket.create({
              data: {
                urunId:     kalem.urunId,
                magazaId:   veri.magazaId,
                tip:        'satis',
                renk:       kalem.renk  || null,
                beden:      kalem.beden || null,
                adet:       -kalem.adet,
                birimFiyat: kalem.birimFiyat,
                notlar:     `Online Sipariş: ${yeniSiparis.siparisNo}`,
                referansId: yeniSiparis.id,
              }
            })
          }
        }
      }

      return yeniSiparis
    })

    // EFT/Havale ile girilen sipariş — tutar seçilen banka hesabına hemen yansır
    // (teslimatı beklemiyoruz: banka hesabı seçilmesi zaten transferin alındığını gösterir)
    if (siparis.odemeTip === 'eft' && siparis.bankaHesapId) {
      try {
        await bankaBakiyeYansit(prisma, siparis.bankaHesapId, Number(siparis.genelToplam), `Sipariş: ${siparis.siparisNo}`, siparis.siparisNo)
      } catch(e) { /* Banka yansıtma hatası sessizce geç */ }
    }

    return reply.status(201).send(siparis)
  })

  // Durum güncelle
  app.put('/siparisler/:id/durum', async (req) => {
    const { durum, kargoNo, kargoFirma } = req.body
    if (!DURUMLAR.includes(durum)) throw new Error('Geçersiz durum')

    const oncekiSiparis = await prisma.siparis.findUnique({
      where:   { id: req.params.id },
      include: { kalemler: true }
    })

    const guncellendi = { durum }
    if (kargoNo)    guncellendi.kargoNo    = kargoNo
    if (kargoFirma) guncellendi.kargoFirma = kargoFirma

    // Kargoya verildi → hazırlama süresini kaydet
    if (durum === 'kargoda' && oncekiSiparis) {
      guncellendi.hazirlamaSuresi = Math.round((Date.now() - new Date(oncekiSiparis.tarih).getTime()) / 60000)
    }

    // İptal/iade edildiyse — daha önce iptal/iade edilmemişse stoğu geri ver.
    const STOK_GERI_DURUMLARI = ['iptal', 'iade_edildi']
    const oncekiIptalIade = !!oncekiSiparis && STOK_GERI_DURUMLARI.includes(oncekiSiparis.durum)
    const yeniIptalIade = STOK_GERI_DURUMLARI.includes(durum)
    const stokGeriVerilecek = yeniIptalIade && !!oncekiSiparis && !oncekiIptalIade
    // TERS YÖN: iptal/iade edilmiş bir sipariş yeniden aktif bir duruma alınıyor. Panelde
    // artık her durum her zaman seçilebildiği için (teslim sonrası iade, yanlış işaretlenen
    // durumu geri alma) bu yön de gerçekleşebiliyor. Stok iptalde geri verilmişti; sipariş
    // yeniden yürürlüğe girdiğine göre tekrar düşülmeli — yoksa her iptal→geri alma turunda
    // stok sipariş adedi kadar şişerdi.
    const stokTekrarDusulecek = !yeniIptalIade && oncekiIptalIade

    const guncellenenSiparis = await prisma.$transaction(async (tx) => {
      const sonuc = await tx.siparis.update({
        where: { id: req.params.id },
        data:  guncellendi,
        include: { musteri: true, kalemler: true }
      })

      if ((stokGeriVerilecek || stokTekrarDusulecek) && sonuc.magazaId) {
        for (const kalem of sonuc.kalemler) {
          if (!kalem.urunId) continue
          const varyant = await tx.varyant.findFirst({
            where: {
              urunId:   kalem.urunId,
              magazaId: sonuc.magazaId,
              renk:     kalem.renk  || null,
              beden:    kalem.beden || null,
            }
          })
          if (varyant) {
            await tx.varyant.update({
              where: { id: varyant.id },
              data:  stokGeriVerilecek
                ? { adet: { increment: kalem.adet } }
                : { adet: Math.max(0, varyant.adet - kalem.adet) }
            })
            await tx.stokHareket.create({
              data: {
                urunId:     kalem.urunId,
                magazaId:   sonuc.magazaId,
                tip:        stokGeriVerilecek ? (durum === 'iptal' ? 'iptal' : 'iade') : 'satis',
                renk:       kalem.renk  || null,
                beden:      kalem.beden || null,
                adet:       stokGeriVerilecek ? kalem.adet : -kalem.adet,
                birimFiyat: kalem.birimFiyat,
                notlar:     stokGeriVerilecek
                  ? `Online Sipariş ${durum === 'iptal' ? 'İptali' : 'İadesi'}: ${sonuc.siparisNo}`
                  : `Online Sipariş yeniden aktif (${durum}): ${sonuc.siparisNo}`,
                referansId: sonuc.id,
              }
            })
          }
        }
      }

      return sonuc
    })

    // İptal/iade edildi → EFT ile girişte tutar zaten sipariş oluşturulurken bankaya
    // işlenmişti (bkz. POST /siparisler); şimdi geri alınıyor ki bakiye şişmesin.
    // Sipariş iptalden geri alınırsa tutar yeniden işleniyor — iki yön de simetrik olmalı,
    // aksi halde iptal→geri alma turu bakiyeyi kalıcı olarak eksiltirdi.
    if ((stokGeriVerilecek || stokTekrarDusulecek) && guncellenenSiparis.odemeTip === 'eft' && guncellenenSiparis.bankaHesapId) {
      const tutar = Number(guncellenenSiparis.genelToplam)
      try {
        await bankaBakiyeYansit(
          prisma, guncellenenSiparis.bankaHesapId,
          stokGeriVerilecek ? -tutar : tutar,
          stokGeriVerilecek
            ? `Sipariş ${durum === 'iptal' ? 'İptali' : 'İadesi'}: ${guncellenenSiparis.siparisNo}`
            : `Sipariş yeniden aktif: ${guncellenenSiparis.siparisNo}`,
          guncellenenSiparis.siparisNo
        )
      } catch(e) { /* Banka yansıtma hatası sessizce geç */ }
    }

    // Shopify kökenli sipariş (shopifyOrderId dolu) ise durum değişikliğini Shopify'a
    // da yazıyoruz (kargoda/teslim_edildi → fulfillment, iptal → orderCancel,
    // iade_edildi → refundCreate). Hatalar içeride yutulup loglanır — panel içi durum
    // güncellemesi Shopify'ın yanıt vermesine bağımlı kalmamalı.
    if (guncellenenSiparis.shopifyOrderId) {
      pushOrderStatusToShopify(guncellenenSiparis.shopifyOrderId, durum, { kargoNo, kargoFirma }).catch(() => {})
    }

    return guncellenenSiparis
  })

  // Toplu durum güncelle
  app.put('/siparisler/toplu-durum', async (req) => {
    const { ids, durum } = req.body
    await prisma.siparis.updateMany({
      where: { id: { in: ids } },
      data: { durum }
    })
    return { guncellendi: ids.length }
  })

  // Sipariş iptal
  app.put('/siparisler/:id/iptal', async (req) => {
    const siparis = await prisma.siparis.update({
      where: { id: req.params.id },
      data: { durum: 'iptal' },
      include: { kalemler: { include: { urun: true } } }
    })
    // Stok geri ver
    for (const k of siparis.kalemler) {
      if (!k.urunId || !siparis.magazaId) continue
      const varyant = await prisma.varyant.findFirst({
        where: { urunId: k.urunId, magazaId: siparis.magazaId, renk: k.renk||null, beden: k.beden||null }
      })
      if (varyant) {
        await prisma.varyant.update({
          where: { id: varyant.id },
          data: { adet: { increment: k.adet } }
        })
      }
    }
    return siparis
  })

  // Performans analitiği
  app.get('/siparisler/analitik', async (req) => {
    const { magazaId, gun = 30 } = req.query
    const baslangic = new Date(Date.now() - Number(gun) * 86400000)

    const siparisler = await prisma.siparis.findMany({
      where: {
        tarih: { gte: baslangic },
        ...(magazaId && { magazaId }),
      },
      select: {
        kanal: true, durum: true, genelToplam: true,
        hazirlamaSuresi: true, tarih: true
      }
    })

    const toplamSiparis = siparisler.length
    const tamamlanan = siparisler.filter(s=>s.durum==='teslim_edildi').length
    const iptal = siparisler.filter(s=>s.durum==='iptal').length
    const ortHazirlamaSuresi = siparisler.filter(s=>s.hazirlamaSuresi)
      .reduce((t,s,_,a)=>t+s.hazirlamaSuresi/a.length,0)
    const toplamCiro = siparisler.reduce((t,s)=>t+Number(s.genelToplam),0)

    const kanalDagilim = {}
    siparisler.forEach(s=>{
      if (!kanalDagilim[s.kanal]) kanalDagilim[s.kanal] = { sayi:0, ciro:0 }
      kanalDagilim[s.kanal].sayi++
      kanalDagilim[s.kanal].ciro += Number(s.genelToplam)
    })

    return { toplamSiparis, tamamlanan, iptal, ortHazirlamaSuresi, toplamCiro, kanalDagilim }
  })
}
