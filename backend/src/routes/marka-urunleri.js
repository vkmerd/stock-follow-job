import { prisma } from '../index.js'

// Marka Ürünleri (Silver Polo / Nas Bag) sekmesinden Shopify'a gönderilen ürünlerin
// kaydı — önceden tarayıcı localStorage'da tutuluyordu, veritabanına taşındı.
export default async function markaUrunleriRoutes(app) {

  // Gönderilenler listesi — kaynak filtresi opsiyonel (silverpolo | nasbag)
  app.get('/marka-urunleri/gonderilenler', async (req) => {
    const { kaynak } = req.query
    return await prisma.markaUrunGonderimi.findMany({
      where: kaynak ? { kaynak } : {},
      orderBy: { tarih: 'desc' }
    })
  })

  // Bir ürün Shopify'a gönderildiğinde çağrılır — aynı [kaynak, disKimlik] zaten
  // varsa (yeniden gönderim) günceller, yoksa yeni kayıt açar.
  app.post('/marka-urunleri/gonderildi', async (req, reply) => {
    const { kaynak, disKimlik, urunAdi, marka, tedarikciFiyati, gonderilenFiyat, shopifyId } = req.body
    if (!kaynak || !disKimlik) {
      return reply.status(400).send({ hata: 'kaynak ve disKimlik zorunlu' })
    }

    const kayit = await prisma.markaUrunGonderimi.upsert({
      where: { kaynak_disKimlik: { kaynak, disKimlik: String(disKimlik) } },
      update: {
        urunAdi,
        marka: marka || null,
        tedarikciFiyati: Number(tedarikciFiyati) || 0,
        gonderilenFiyat: Number(gonderilenFiyat) || 0,
        shopifyId: shopifyId || null,
        tarih: new Date()
      },
      create: {
        kaynak,
        disKimlik: String(disKimlik),
        urunAdi,
        marka: marka || null,
        tedarikciFiyati: Number(tedarikciFiyati) || 0,
        gonderilenFiyat: Number(gonderilenFiyat) || 0,
        shopifyId: shopifyId || null
      }
    })

    return reply.status(201).send(kayit)
  })
}
