/**
 * Shopify Admin API yapılandırması.
 * Desteklenen env değişkenleri (öncelik sırasıyla):
 *   Mağaza: SHOPIFY_STORE_URL | SHOPIFY_SHOP
 *   Token:  SHOPIFY_ACCESS_TOKEN | SHOPIFY_ADMIN_TOKEN
 *   Sürüm:  SHOPIFY_API_VERSION (varsayılan: 2025-01)
 */

function normalizeStoreUrl(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let url = raw.trim()
  if (!url) return ''
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }
  return url.replace(/\/+$/, '')
}

export function getShopifyConfig() {
  const storeUrl = normalizeStoreUrl(
    process.env.SHOPIFY_STORE_URL || process.env.SHOPIFY_SHOP || ''
  )
  const token = (
    process.env.SHOPIFY_ACCESS_TOKEN ||
    process.env.SHOPIFY_ADMIN_TOKEN ||
    ''
  ).trim()
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01'

  return { storeUrl, token, apiVersion }
}

export function validateShopifyConfig({ storeUrl, token }) {
  const errors = []
  const hints = []
  const tokenLower = String(token || '').toLowerCase()

  if (!storeUrl || storeUrl.includes('yourstore.myshopify.com')) {
    errors.push('Mağaza adresi tanımlı değil.')
    hints.push(
      'backend/.env dosyasına SHOPIFY_STORE_URL=https://MAGAZA-ADI.myshopify.com yazın.',
      'MAGAZA-ADI: Shopify Admin → Ayarlar → Mağaza ayrıntıları → "myshopify.com" adresi (ör. vega-canta-store.myshopify.com).',
      'panel.vegacantastore.com veya vegacantastore.com YAZMAYIN — bunlar sizin panel siteniz, Shopify API adresi değil.'
    )
  } else if (!storeUrl.includes('.myshopify.com')) {
    errors.push('Mağaza adresi .myshopify.com ile bitmeli.')
    hints.push('Örnek: https://vega-canta-store.myshopify.com')
  }

  if (!token) {
    errors.push('Admin API access token tanımlı değil.')
    hints.push(
      'Shopify Admin → Ayarlar → Uygulamalar ve satış kanalları → Uygulama geliştir → Uygulama oluştur.',
      'Admin API erişim kapsamları: en az read_products → Uygulamayı yükle → "Admin API access token" (shpat_...) kopyala.',
      'backend/.env → SHOPIFY_ACCESS_TOKEN=shpat_... (veya SHOPIFY_ADMIN_TOKEN)'
    )
  } else if (/buraya|gercek|xxx|example|placeholder/.test(tokenLower)) {
    errors.push('SHOPIFY_ACCESS_TOKEN gerçek bir token değil; placeholder değer kullanılmış.')
    hints.push(
      'backend/.env içindeki SHOPIFY_ACCESS_TOKEN satırını Shopify Admin → Uygulama geliştir → Kurulum sonrası görünen gerçek shpat_... token ile değiştirin.',
      'Bu değeri kod içinde üretmek mümkün değil; mağazanızdan alınması gerekir.'
    )
  } else if (token.startsWith('shpss_')) {
    errors.push('Girdiğiniz kod Client Secret (shpss_), Admin API token değil.')
        hints.push(
      'shpss_ kodu Partners panelindeki "API secret key" dir; ürün listesi için kullanılamaz.',
      'Doğru token: Mağaza Admin panelinde Custom app kurup "Install" sonrası görünen shpat_... token.',
      'OAuth akışını kullandıysanız shpca_ ile başlayan token da geçerlidir.'
    )
  } else if (!token.startsWith('shpat_') && !token.startsWith('shpca_')) {
    errors.push('Admin API token shpat_ veya shpca_ ile başlamalıdır. Girdiğiniz değeri kontrol edin.')
  }


  return {
    ok: errors.length === 0,
    errors,
    hints,
    storeHost: storeUrl ? new URL(storeUrl).host : null,
    tokenPrefix: token ? `${token.slice(0, 8)}...` : null
  }
}

export function getShopifyGraphqlUrl(config) {
  return `${config.storeUrl}/admin/api/${config.apiVersion}/graphql.json`
}
