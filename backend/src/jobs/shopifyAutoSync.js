import cron from 'node-cron'
import { prisma } from '../index.js'
import { publishShopifyProduct } from '../routes/shopify.js'

// Shopify Admin API rate limitine takılmamak için ürünler arasında bekleme
const URUN_ARASI_GECIKME_MS = 600

// Daha önce Shopify'a gönderilmiş (shopifyId dolu) ve aktif tüm ürünlerin
// GÜNCEL fiyat + stok bilgisini Shopify'a gönderir. publishShopifyProduct
// zaten mevcut ürünü günceller (yeniden oluşturmaz), varyant fiyat/barkodunu
// ve envanterini ayarlar — burada tek görev bunu tüm ürünler için sırayla çağırmak.
export async function shopifyOtomatikSenkronCalistir() {
  const urunler = await prisma.urun.findMany({
    where: { aktif: true, shopifyId: { not: null } },
    include: { varyantlar: true }
  })

  const sonuc = { toplam: urunler.length, basarili: 0, hatalar: [] }

  for (const urun of urunler) {
    try {
      // koleksiyonOlustur:false — bu işin görevi fiyat+stok göndermek. Kategori adından
      // koleksiyon AÇMASINA izin vermek, tek bir başarısız aramada mağazaya kopya bir
      // koleksiyon bırakıyor; saatte bir, tüm ürünler için tekrarlandığı için de
      // koleksiyonlar katlanarak çoğalıyordu. Var olan koleksiyona ekleme sürüyor.
      const product = await publishShopifyProduct(urun, {}, [], { koleksiyonOlustur: false })
      // publishShopifyProduct artık ID bulunamazsa handle ile de arayıp kendini
      // onarabiliyor — dönen id kayıtlı shopifyId'den farklıysa (eski silinmiş bir
      // ürünü işaret ediyorduysa) burada kalıcı olarak günceliyoruz, yoksa her saat
      // aynı fallback aramasını tekrar tekrar yapardı.
      if (product?.id && product.id !== urun.shopifyId) {
        await prisma.urun.update({ where: { id: urun.id }, data: { shopifyId: product.id } })
      }
      sonuc.basarili++
    } catch (err) {
      sonuc.hatalar.push({ urunId: urun.id, kod: urun.kod, hata: err.message })
      console.error(`[shopify-oto-senkron] ${urun.kod} gönderilemedi:`, err.message)
    }
    await new Promise(r => setTimeout(r, URUN_ARASI_GECIKME_MS))
  }

  console.log(`[shopify-oto-senkron] tamamlandı: ${sonuc.basarili}/${sonuc.toplam} başarılı, ${sonuc.hatalar.length} hata`)
  return sonuc
}

// Her saat başı çalışacak cron job'ı kurar.
export function shopifyOtomatikSenkronBaslat() {
  cron.schedule('0 * * * *', () => {
    console.log('[shopify-oto-senkron] zamanlanmış çalışma başlıyor...')
    shopifyOtomatikSenkronCalistir().catch(err => {
      console.error('[shopify-oto-senkron] beklenmeyen hata:', err)
    })
  })
  console.log('[shopify-oto-senkron] cron job kuruldu — her saat başı tüm ürünlerin fiyat+stoğu Shopify\'a gönderilecek')
}
