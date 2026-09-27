import cron from 'node-cron'
import { syncShopifyOrders } from '../routes/shopify.js'

// Cron her 10 dakikada bir çalışır — güvenlik payı olsun diye her seferinde son
// 3 saatlik pencereyi tarar (bir çalışma atlanırsa/gecikirse sipariş kaybolmasın).
// importShopifyOrder shopifyOrderId üzerinden idempotent olduğu için aynı siparişin
// tekrar tekrar taranması sorun yaratmaz, sadece güncel bilgiyle üzerine yazar.
const PENCERE_DAKIKA = 180

export async function shopifySiparisSenkronCalistir() {
  const sonuc = await syncShopifyOrders({ sinceMinutes: PENCERE_DAKIKA })
  console.log(`[shopify-siparis-senkron] tamamlandı: ${sonuc.yeni} yeni, ${sonuc.guncellenen} güncellendi, ${sonuc.hatalar.length} hata`)
  return sonuc
}

export function shopifySiparisSenkronBaslat() {
  cron.schedule('*/10 * * * *', () => {
    shopifySiparisSenkronCalistir().catch(err => {
      console.error('[shopify-siparis-senkron] beklenmeyen hata:', err)
    })
  })
  console.log('[shopify-siparis-senkron] cron job kuruldu — her 10 dakikada bir Shopify siparişleri çekilecek')
}
