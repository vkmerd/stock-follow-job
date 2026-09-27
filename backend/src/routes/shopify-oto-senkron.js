import { shopifyOtomatikSenkronCalistir } from '../jobs/shopifyAutoSync.js'
import { shopifySiparisSenkronCalistir } from '../jobs/shopifyOrderSync.js'

export default async function shopifyOtoSenkronRoutes(app) {
  // Cron job zaten her saat başı otomatik çalışır (bkz. jobs/shopifyAutoSync.js) —
  // bu route sadece elle tetikleyip test etmek / beklemeden hemen çalıştırmak içindir.
  app.post('/shopify/oto-senkron/calistir', async (req, reply) => {
    try {
      const sonuc = await shopifyOtomatikSenkronCalistir()
      return { success: true, ...sonuc }
    } catch (error) {
      console.error('Shopify oto-senkron manuel tetikleme hatası:', error)
      return reply.status(500).send({ hata: error.message || 'Otomatik senkron çalıştırılamadı' })
    }
  })

  // Sipariş senkron cron'u zaten her 10 dakikada bir otomatik çalışır (bkz.
  // jobs/shopifyOrderSync.js) — bu route elle tetiklemek içindir.
  app.post('/shopify/oto-senkron/siparisler', async (req, reply) => {
    try {
      const sonuc = await shopifySiparisSenkronCalistir()
      return { success: true, ...sonuc }
    } catch (error) {
      console.error('Shopify sipariş oto-senkron manuel tetikleme hatası:', error)
      return reply.status(500).send({ hata: error.message || 'Sipariş senkronu çalıştırılamadı' })
    }
  })
}
