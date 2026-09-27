import crypto from 'node:crypto'
import { prisma } from '../index.js'
import {
  getShopifyConfig,
  validateShopifyConfig,
  getShopifyGraphqlUrl
} from '../lib/shopify-config.js'

function assertShopifyReady() {
  const config = getShopifyConfig()
  const check = validateShopifyConfig(config)
  if (!check.ok) {
    const msg = [...check.errors, ...check.hints].join(' ')
    throw new Error(msg)
  }
  return config
}



// Shopify GraphQL çağrısı
async function shopifyFetch(query, variables = {}) {
  const config = assertShopifyReady()
  const SHOPIFY_API = getShopifyGraphqlUrl(config)

  const res = await fetch(SHOPIFY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.token
    },
    body: JSON.stringify({ query, variables })
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch (err) {
    console.error('Shopify API hatası: JSON parse edilemedi', {
      status: res.status,
      text: text.slice(0, 2000),
      query,
      variables
    })
    throw new Error(`Shopify API hatası: ${res.status}`)
  }

  if (!res.ok) {
    console.error('Shopify API hatası:', {
      status: res.status,
      body: data,
      query,
      variables
    })
    throw new Error(`Shopify API hatası: ${res.status}`)
  }
  
  if (data.errors) {
    console.error('Shopify GraphQL Hata:', {
      errors: data.errors,
      query,
      variables
    })
    throw new Error(data.errors[0]?.message || 'Shopify API hatası')
  }

  return data.data
}

function getShopifyNumericId(gid) {
  if (!gid || typeof gid !== 'string') return null
  const parts = gid.split('/')
  return parts[parts.length - 1] || null
}

// getShopifyNumericId'nin tersi: yerel kayıtta düz sayı da (eski kayıtlar) GID de
// olabiliyor; GraphQL uçları her zaman GID istiyor.
function urunGidOlustur(shopifyId) {
  const ham = String(shopifyId || '').trim()
  if (!ham) return null
  if (ham.startsWith('gid://')) return ham
  if (/^d+$/.test(ham)) return `gid://shopify/Product/${ham}`
  return null
}

function isShopifyMetafieldMismatchError(err) {
  const message = err?.message || ''
  return /must be consistent with the definition's type/i.test(message) || /expected type/i.test(message)
}

// Bazı ürünlerde "Ayakkabı Numarası" gibi seçenekler Shopify'ın kendi standart taksonomi
// metafield sistemine bağlanmış oluyor (bkz. buildShopifyProductInput üstündeki not) —
// bu durumda REST varyant oluşturma, sistemde tanımlı olmayan/serbest metin yeni bir
// seçenek değeri kabul etmiyor ve bu spesifik hatayı döndürüyor.
function isLinkedMetafieldOptionError(err) {
  const message = err?.message || ''
  return /linked to a metafield/i.test(message)
}

// Ürünün seçeneklerini, hangisinin bir metafield'a (taksonomiye) bağlı olduğu bilgisiyle
// birlikte döner — linked option fallback akışı için gerekli.
async function getProductOptionsWithLink(productGid) {
  const query = `
    query GetProductOptionsWithLink($id: ID!) {
      product(id: $id) {
        options {
          id
          name
          linkedMetafield { namespace key }
        }
      }
    }
  `
  const result = await shopifyFetch(query, { id: productGid })
  return result.product?.options || []
}

// Bağlı bir seçenek için, verilen metin değerine (örn. "37") karşılık gelen mevcut
// taksonomi metaobject kaydının GID'ini bulur. Shopify'ın standart beden taksonomisi
// mağazada zaten kullanılan tüm makul değerleri (24-46 gibi) önceden metaobject olarak
// barındırıyor — burada YENİ bir taksonomi değeri OLUŞTURULMUYOR, sadece mevcut olan
// aranıyor. Değer mağazada hiç kullanılmamışsa null döner (bu durumda değerin bir kez
// Shopify admin panelinden elle seçilmesi/eklenmesi gerekir).
async function findMetaobjectIdForOptionValue(namespace, key, valueText) {
  const defQuery = `
    query GetMetafieldDefinitionForOption($namespace: String!, $key: String!) {
      metafieldDefinitions(namespace: $namespace, key: $key, first: 1, ownerType: PRODUCT) {
        edges { node { validations { name value } } }
      }
    }
  `
  const defResult = await shopifyFetch(defQuery, { namespace, key })
  const validations = defResult.metafieldDefinitions?.edges?.[0]?.node?.validations || []
  const metaobjectDefinitionId = validations.find(v => v.name === 'metaobject_definition_id')?.value
  if (!metaobjectDefinitionId) return null

  const typeQuery = `
    query GetMetaobjectDefinitionType($id: ID!) {
      metaobjectDefinition(id: $id) { type }
    }
  `
  const typeResult = await shopifyFetch(typeQuery, { id: metaobjectDefinitionId })
  const type = typeResult.metaobjectDefinition?.type
  if (!type) return null

  const listQuery = `
    query GetMetaobjectsOfType($type: String!) {
      metaobjects(type: $type, first: 250) {
        edges { node { id handle displayName } }
      }
    }
  `
  const listResult = await shopifyFetch(listQuery, { type })
  const items = (listResult.metaobjects?.edges || []).map(e => e.node)
  const normalized = String(valueText).trim().toLowerCase()
  const match = items.find(i =>
    String(i.handle || '').trim().toLowerCase() === normalized ||
    String(i.displayName || '').trim().toLowerCase() === normalized
  )
  return match?.id || null
}

// Bağlı (linked) bir seçeneğe, zaten var olan bir taksonomi değerini yeni bir seçenek
// değeri olarak ekler ve `variantStrategy: MANAGE` ile bu değer için otomatik bir varyant
// oluşturulmasını sağlar (REST'in başaramadığı adım budur). Oluşan varyantların güncel
// listesini döner ki çağıran taraf yeni varyantı title'a göre bulup fiyat/sku/barkod/stok
// alanlarını kendi standardına göre düzeltebilsin.
async function addLinkedOptionValue(productGid, optionId, metaobjectId) {
  const mutation = `
    mutation AddLinkedOptionValue($productId: ID!, $option: OptionUpdateInput!, $optionValuesToAdd: [OptionValueCreateInput!], $variantStrategy: ProductOptionUpdateVariantStrategy) {
      productOptionUpdate(productId: $productId, option: $option, optionValuesToAdd: $optionValuesToAdd, variantStrategy: $variantStrategy) {
        product {
          variants(first: 100) { edges { node { id title } } }
        }
        userErrors { field message code }
      }
    }
  `
  // NOT: optionValuesToAdd öğesine "name" eklemek Shopify'ın bunu "bağlantısız" (nonlinked)
  // bir değer sanmasına yol açıyor ve CANNOT_COMBINE_LINKED_AND_NONLINKED_OPTION_VALUES
  // hatası veriyor — sadece linkedMetafieldValue gönderilmeli, isim taksonomi kaydından
  // otomatik geliyor (canlıda doğrulandı).
  const result = await shopifyFetch(mutation, {
    productId: productGid,
    option: { id: optionId },
    optionValuesToAdd: [{ linkedMetafieldValue: metaobjectId }],
    variantStrategy: 'MANAGE'
  })
  const payload = result.productOptionUpdate
  if (payload.userErrors?.length) {
    throw new Error(payload.userErrors.map(e => e.message).join(' | '))
  }
  return payload.product?.variants?.edges?.map(e => e.node) || []
}

function stripConflictingMetafields(input) {
  if (!input || !Array.isArray(input.metafields)) return input
  // 'video_source_url' de listede: mağazada bu anahtarın tanımı farklı bir tipteyse
  // tekrar denemede o da çıkarılmazsa mutasyon İKİNCİ kez de hata veriyor ve tüm
  // yayınlama çöküyordu. Video zaten yüklenmiş olduğu için (yükleme ürün
  // güncellemesinden ÖNCE oluyor) her senkron Shopify Dosyalar'a sahipsiz bir kopya
  // daha bırakıyordu — video çoklamasının en sert kaynağı buydu.
  const keysToRemove = ['video', 'video_source_url', 'renk_gruplari', 'alis_fiyat', 'kritik_stok', 'urun_barkod', 'urun_sku', 'malzeme', 'kategori', 'alt_kategori', 'ticimax_id']
  const filtered = input.metafields.filter(m => m && m.key && !keysToRemove.includes(m.key))
  return { ...input, metafields: filtered }
}

function normalizeImageSrc(image) {
  if (!image) return null
  if (typeof image === 'string') return image.trim() || null
  if (typeof image === 'object') return String(image.src || image.url || '').trim() || null
  return null
}

// Shopify, dış bir URL'den resim yüklendiğinde orijinal dosya adını (query string hariç)
// genelde korur. Bir ürün tekrar yayınlandığında hangi resimlerin zaten yüklü olduğunu
// tespit etmek için hem yerel kaynak URL'sini hem de Shopify'daki CDN URL'sini bu dosya
// adı üzerinden karşılaştırıyoruz.
function imageFilenameKey(url) {
  if (!url) return null
  const clean = String(url).split('?')[0].split('#')[0]
  const name = clean.split('/').filter(Boolean).pop()
  return name ? name.toLowerCase() : null
}

// Sorgu/fragment kısmı atılmış, küçük harfe indirilmiş URL — aynı resmin farklı
// `?v=...` sürümleri aynı kabul edilsin diye.
function imageUrlKey(url) {
  if (!url) return null
  const clean = String(url).split('?')[0].split('#')[0].trim().toLowerCase()
  return clean || null
}

// Dosya adı eşleştirmesi sadece ad "ayırt edici" olduğunda güvenli — "1.jpg", "a.png"
// gibi adlar farklı ürünlerde/klasörlerde tekrar ettiği için yanlışlıkla "bu resim
// zaten var" denip gerçek bir fotoğrafın atlanmasına (ya da silinmesine) yol açabilir.
function isDistinctiveFilename(name) {
  if (!name) return false
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  return base.length >= 4
}

// Bir resmin "kimliği": aynı fotoğrafı temsil eden tüm işaretler. Karşılaştırma tek bir
// anahtara değil bu kümelerin KESİŞİMİNE bakılarak yapılıyor, çünkü:
//   • Shopify resmi kendi CDN'ine taşırken dosya adına rastgele sonek ekleyebiliyor,
//   • Shopify'dan İÇERİ aktarılmış ürünlerde yerel URL zaten Shopify CDN URL'sinin
//     ta kendisi (o zaman tam URL eşleşmesi yakalıyor),
//   • bizim yüklediğimiz resimlerde `alt`, kaynak dosya adına sabitleniyor (aşağıdaki
//     imageAltKey) — CDN adı değişse bile bu sabit kalıyor.
// ESKİ HATA: kontrol `img.alt || imageFilenameKey(img.src)` şeklindeydi; Shopify'daki
// resmin GERÇEK bir alt metni varsa ("Siyah Çanta" gibi) dosya adı kümeye hiç girmiyor,
// yerel resim "eksik" sanılıp her senkronda yeniden yükleniyordu — saatlik oto-senkronla
// birlikte aynı fotoğraf üst üste çoğalıyordu.
function imageIdentityKeys(src, alt) {
  const keys = new Set()
  const urlKey = imageUrlKey(src)
  if (urlKey) keys.add(`u:${urlKey}`)
  const name = imageFilenameKey(src)
  if (isDistinctiveFilename(name)) keys.add(`f:${name}`)

  // `alt` SADECE bizim yazdığımız çapaysa (yani bir dosya adıysa) kimlik sayılır ve
  // dosya adlarıyla AYNI ad alanına (`f:`) girer — Shopify CDN adı değişse bile yerel
  // dosya adıyla eşleşsin diye. Mağazacının elle girdiği alt metni ("Siyah Çanta" gibi)
  // çoğu zaman ürünün TÜM fotoğraflarında aynıdır; onu kimlik saymak birbirinden farklı
  // fotoğrafları "mükerrer" sanıp silmeye yol açardı.
  const altKey = String(alt || '').trim().toLowerCase()
  if (/\.(jpe?g|png|webp|gif|avif|bmp|tiff?)$/i.test(altKey) && isDistinctiveFilename(altKey)) {
    keys.add(`f:${altKey}`)
  }
  return keys
}

// Yüklediğimiz her resme kaynak dosya adını `alt` olarak yazıyoruz — Shopify bunu
// olduğu gibi saklıyor, yani sonraki senkronlarda "bu resim zaten yüklü" kontrolünün
// değişmeyen çapası bu.
function imageAltKey(src) {
  return imageFilenameKey(src)
}

function mergePublishPayload(dbUrun, payloadUrun) {
  if (!dbUrun && !payloadUrun) return null
  if (!dbUrun) return payloadUrun
  if (!payloadUrun) return dbUrun

  return {
    ...dbUrun,
    ...payloadUrun,
    resimler: Array.isArray(payloadUrun.resimler) ? payloadUrun.resimler : dbUrun.resimler,
    varyantlar: Array.isArray(payloadUrun.varyantlar) ? payloadUrun.varyantlar : dbUrun.varyantlar
  }
}

// Sayfalama gereken listelerde (koleksiyonlar gibi) `Link` başlığına da ihtiyaç var —
// shopifyRestFetch yalnızca gövdeyi döndürdüğü için ham sürüm ayrıldı.
// Shopify REST çağrılarında 429 (rate limit) yanıtı tekrar denenir: 429 isteğin hiç
// işlenmediği anlamına geldiği için POST'ta bile güvenli. Geçici 5xx ise YALNIZCA GET'te
// tekrarlanır — yazma isteği aslında işlenmiş olabilir ve tekrar POST etmek tam da
// önlemeye çalıştığımız kopya kaydı (koleksiyon/collect) yaratır.
const REST_TEKRAR_SAYISI = 4

async function shopifyRestFetchRaw(path, method = 'GET', body = null) {
  const config = assertShopifyReady()
  const SHOPIFY_API = `${config.storeUrl}/admin/api/${config.apiVersion}/${path}`
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': config.token
  }
  const sunucuHatasiTekrarlanabilir = method === 'GET'

  let deneme = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(SHOPIFY_API, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })

    const tekrarla = deneme < REST_TEKRAR_SAYISI &&
      (res.status === 429 || (sunucuHatasiTekrarlanabilir && res.status >= 500))
    if (tekrarla) {
      await res.text().catch(() => '')
      const retryAfter = Number(res.headers.get('retry-after'))
      const bekleme = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 10000)
        : Math.min(500 * 2 ** deneme, 8000)
      deneme += 1
      await new Promise(r => setTimeout(r, bekleme))
      continue
    }

    const text = await res.text()
    let data
    if (!text.trim()) {
      // DELETE gibi uçlar gövdesiz (ya da boş) yanıt dönebiliyor — bunu JSON ayrıştırma
      // hatası saymak, başarıyla silinmiş bir resmi "silinemedi" gibi göstermeye yol açardı.
      if (res.ok) return {}
      throw new Error(`Shopify REST hatası: ${res.status}`)
    }
    try {
      data = JSON.parse(text)
    } catch (err) {
      throw new Error(`Shopify REST hatası: ${res.status} ${text.slice(0, 2000)}`)
    }

    if (!res.ok) {
      throw new Error(`Shopify REST hatası: ${res.status} ${JSON.stringify(data)}`)
    }

    return { data, headers: res.headers }
  }
}

async function shopifyRestFetch(path, method = 'GET', body = null) {
  const sonuc = await shopifyRestFetchRaw(path, method, body)
  // Boş gövdeli yanıtta shopifyRestFetchRaw düz {} dönüyor (headers alanı yok).
  return sonuc && 'data' in sonuc ? sonuc.data : sonuc
}

async function updateShopifyVariantRest(variantId, payload) {
  if (!variantId) return null
  const data = await shopifyRestFetch(`variants/${variantId}.json`, 'PUT', { variant: payload })
  return data.variant
}

async function createShopifyVariantRest(productId, payload) {
  if (!productId) return null
  const data = await shopifyRestFetch(`products/${productId}/variants.json`, 'POST', { variant: payload })
  return data.variant
}

// `alt`, kaynak (Ticimax/Vega) URL'sinden türetilmiş sabit bir kimlik olarak
// gönderiliyor — Shopify resmi kendi CDN'ine taşırken dosya adına genelde rastgele
// bir sonek ekliyor (bkz. imageFilenameKey notu), bu yüzden tekrar yayınlarken
// "bu resim zaten yüklü mü" kontrolünü src/CDN dosya adına göre değil bu sabit
// alt metnine göre yapıyoruz.
async function createShopifyImageRest(productId, src, alt = null) {
  if (!productId || !src) return null
  const data = await shopifyRestFetch(`products/${productId}/images.json`, 'POST', { image: { src, ...(alt ? { alt } : {}) } })
  return data.image
}

async function deleteShopifyImageRest(productId, imageId) {
  if (!productId || !imageId) return false
  await shopifyRestFetch(`products/${productId}/images/${imageId}.json`, 'DELETE')
  return true
}

// Shopify'daki resim listesini yerel listeyle uyumlu hale getirir:
//   1) Shopify'da AYNI fotoğraftan birden fazla kopya varsa ilki kalır, fazlalıklar SİLİNİR
//      (geçmişte oluşmuş çoklamaları da kendiliğinden temizler),
//   2) yerel listede olup Shopify'da GERÇEKTEN olmayan resimler yüklenir.
// Shopify'da olup yerel listede olmayan resimlere DOKUNULMAZ — kullanıcı admin panelinden
// elle resim eklemiş olabilir, saatlik oto-senkronun bunları silmesi kabul edilemez.
async function reconcileShopifyProductImages(productId, desiredSources, { dryRun = false } = {}) {
  const sonuc = { silinen: 0, yuklenen: 0, mevcut: 0, atlandi: false, silinenler: [] }
  if (!productId) {
    sonuc.atlandi = true
    return sonuc
  }

  // Mevcut resimler okunamadıysa hiçbir şey yapmıyoruz — "boş" varsayıp yüklemek
  // tam da çoklamanın kaynağı olurdu.
  const currentProduct = await getShopifyProductRestById(productId).catch(() => null)
  if (!currentProduct) {
    sonuc.atlandi = true
    return sonuc
  }

  const currentImages = Array.isArray(currentProduct.images) ? currentProduct.images : []
  const seen = new Set()

  for (const img of currentImages) {
    const keys = imageIdentityKeys(img.src, img.alt)
    const mukerrer = [...keys].some(k => seen.has(k))
    if (mukerrer && img.id) {
      sonuc.silinenler.push({ id: img.id, src: img.src, alt: img.alt || null })
      if (!dryRun) {
        const silindi = await deleteShopifyImageRest(productId, img.id)
          .then(() => true)
          .catch(err => {
            console.warn('Mükerrer resim silinemedi:', img.id, err.message)
            return false
          })
        if (!silindi) {
          // Silinemediyse hâlâ üründe duruyor demektir; anahtarlarını kümede tutuyoruz ki
          // yerine yenisi yüklenmesin.
          keys.forEach(k => seen.add(k))
          continue
        }
      }
      sonuc.silinen += 1
      continue
    }
    keys.forEach(k => seen.add(k))
    sonuc.mevcut += 1
  }

  // Yerel listenin kendi içindeki tekrarlar da temizleniyor (aynı URL iki kez yazılmışsa).
  const desired = []
  const desiredSeen = new Set()
  for (const raw of desiredSources || []) {
    const src = normalizeImageSrc(raw)
    if (!src) continue
    const key = imageUrlKey(src)
    if (desiredSeen.has(key)) continue
    desiredSeen.add(key)
    desired.push(src)
  }

  for (const src of desired) {
    const keys = imageIdentityKeys(src, imageAltKey(src))
    if ([...keys].some(k => seen.has(k))) continue
    if (dryRun) {
      sonuc.yuklenen += 1
      keys.forEach(k => seen.add(k))
      continue
    }
    const created = await createShopifyImageRest(productId, src, imageAltKey(src))
      .catch(err => {
        console.warn('Resim ekleme hatası:', err.message)
        return null
      })
    if (!created) continue
    sonuc.yuklenen += 1
    // Yeni yüklenen resmin hem kaynak hem CDN anahtarları kümeye giriyor — aynı çalışmada
    // farklı URL'lerle gelen aynı dosyanın ikinci kez yüklenmesini de engelliyor.
    imageIdentityKeys(created.src, created.alt).forEach(k => seen.add(k))
    keys.forEach(k => seen.add(k))
  }

  return sonuc
}

// Koleksiyon adlarını karşılaştırma anahtarı. Türkçe'ye duyarlı küçültme şart:
// JS'in düz toLowerCase()'i "I" -> "i" ama "İ" -> "i̇" (birleşik noktalı) yapar, bu yüzden
// "IŞIK" ile "Işık" farklı görünüp aynı adla ikinci bir koleksiyon açılmasına yol açar.
function collectionTitleKey(title) {
  return String(title || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr')
    .normalize('NFC')
}

// Shopify `Link` başlığındaki bir sonraki sayfanın yolunu çıkarır.
// Örn: <https://.../custom_collections.json?limit=250&page_info=XYZ>; rel="next"
function nextPagePath(linkHeader, resource) {
  if (!linkHeader) return null
  const next = String(linkHeader).split(',').find(part => /rel="next"/i.test(part))
  if (!next) return null
  const match = next.match(/<([^>]+)>/)
  if (!match) return null
  try {
    const url = new URL(match[1])
    const pageInfo = url.searchParams.get('page_info')
    return pageInfo ? `${resource}.json?limit=250&page_info=${encodeURIComponent(pageInfo)}` : null
  } catch {
    return null
  }
}

// TÜM koleksiyonlar — hem elle oluşturulanlar (custom) hem kurallı olanlar (smart),
// sayfalama dahil.
// ESKİ HATA 1: yalnızca `custom_collections.json?limit=250` okunuyordu. Mağazada 250'den
// fazla koleksiyon olduğunda (çoklama başlayınca hızla oluyor) ya da aynı adlı koleksiyon
// SMART tipindeyse arama onu bulamıyor, her senkronda aynı adla YENİ bir koleksiyon
// açılıyordu.
// ESKİ HATA 2: sayfa isteği hata alınca (`.catch(() => null)` + `break`) ELDEKİ YARIM
// LİSTE tam liste sanılıyordu. Kopyalar çoğaldıkça sayfa sayısı artıyor, artan istek 429
// yiyor, yarım liste yüzünden var olan koleksiyon "yok" görünüp bir kopya daha açılıyordu
// — çoklamayı kendi kendini besleyen döngü buydu. Artık hata YUKARI FIRLIYOR: koleksiyona
// hiç eklememek, mağazaya kalıcı kopya bırakmaktan iyidir.
async function listAllShopifyCollections() {
  const hepsi = []
  for (const resource of ['custom_collections', 'smart_collections']) {
    let path = `${resource}.json?limit=250`
    let guard = 0
    while (path) {
      guard += 1
      if (guard > 50) throw new Error('Shopify koleksiyon listesi bitmedi (sayfa sınırı aşıldı)')
      const sonuc = await shopifyRestFetchRaw(path, 'GET')
      const liste = Array.isArray(sonuc?.data?.[resource]) ? sonuc.data[resource] : []
      for (const c of liste) hepsi.push({ ...c, _tur: resource })
      path = sonuc?.headers ? nextPagePath(sonuc.headers.get('link'), resource) : null
    }
  }
  return hepsi
}

// Saatlik oto-senkron her ürün için koleksiyon arıyor; her seferinde tüm sayfaları
// yeniden çekmek hem yavaş hem de Shopify rate limitini yiyor. Kısa ömürlü önbellek,
// aynı çalışma içinde listeyi bir kez okumayı sağlıyor.
const KOLEKSIYON_CACHE_MS = 60 * 1000
let koleksiyonCache = { zaman: 0, liste: null }
// Aynı anda gelen okumalar tek bir listelemeyi paylaşır: hem rate limiti hem de "ikisi de
// bulamadı, ikisi de açtı" yarışını azaltır.
let koleksiyonOkumasi = null
let koleksiyonOkumaBaslangici = 0
// Bu süreçte AÇILAN koleksiyonlar (anahtar -> kayıt). Shopify'ın liste ucu yeni kaydı
// birkaç saniye geç gösterebiliyor; tazeleme onu getirmezse aynı ad için ikinci bir kopya
// açılırdı. Kayıtların ömrü sınırlı: bu süre sonunda liste ucu onu kesin gösterir, ayrıca
// aradan silinmiş bir koleksiyonun id'sini sonsuza kadar kullanmayalım.
const OLUSTURULAN_TTL_MS = 10 * 60 * 1000
const olusturulanKoleksiyonlar = new Map()

function olusturulanKoleksiyonGetir(key) {
  const kayit = olusturulanKoleksiyonlar.get(key)
  if (!kayit) return null
  if (Date.now() - kayit.zaman > OLUSTURULAN_TTL_MS) {
    olusturulanKoleksiyonlar.delete(key)
    return null
  }
  return kayit.koleksiyon
}

// DİKKAT: hata durumunda İSTİSNA FIRLATIR (eskiden sessizce boş/bayat liste dönüyordu).
// Çağıranın yarım listeyi "koleksiyon yok" diye yorumlaması kopya koleksiyon demek.
async function getShopifyCollectionsCached(force = false) {
  const istekZamani = Date.now()
  if (!force && koleksiyonCache.liste && istekZamani - koleksiyonCache.zaman < KOLEKSIYON_CACHE_MS) {
    return koleksiyonCache.liste
  }
  // Uçuşta okuma varsa paylaşılır. Ama force isteyen taraf koleksiyon AÇMADAN önceki son
  // kontrolü yapıyor: kendi isteğinden ÖNCE başlamış bir okuma, aradaki saniyelerde başka
  // bir sunucu kopyasının açtığı koleksiyonu içermeyebilir — o okumayı bekleyip yenisini
  // başlatıyoruz.
  while (koleksiyonOkumasi) {
    if (!force || koleksiyonOkumaBaslangici >= istekZamani) return koleksiyonOkumasi
    await koleksiyonOkumasi.catch(() => {})
  }
  koleksiyonOkumaBaslangici = Date.now()
  koleksiyonOkumasi = listAllShopifyCollections()
    .then(liste => {
      koleksiyonCache = { zaman: Date.now(), liste }
      return liste
    })
    .finally(() => { koleksiyonOkumasi = null })
  return koleksiyonOkumasi
}

// Geriye dönük uyumluluk: sadece elle oluşturulan koleksiyonlar (sayfalama dahil).
async function listShopifyCustomCollections() {
  const hepsi = await getShopifyCollectionsCached()
  return hepsi.filter(c => c._tur === 'custom_collections')
}

// Aynı adlı birden fazla kayıt olabilir (mağazada kalmış eski kopyalar). Hangisinin
// seçildiği her çağrıda AYNI olmalı, yoksa ürünler kopyalara dağılıp "hangi koleksiyonda"
// sorusunu belirsizleştiriyor: elle açılanlar kurallı olanlara, eski (küçük id) yeniye
// tercih ediliyor — /shopify/koleksiyonlar ucu da aynı kuralı kullanıyor.
function koleksiyonBul(collections, key) {
  let secilen = null
  for (const collection of collections) {
    if (collectionTitleKey(collection.title) !== key) continue
    if (!secilen) { secilen = collection; continue }
    const customMu = c => (c._tur === 'custom_collections' ? 0 : 1)
    if (customMu(collection) < customMu(secilen) ||
        (customMu(collection) === customMu(secilen) && Number(collection.id) < Number(secilen.id))) {
      secilen = collection
    }
  }
  return secilen
}

// Aynı ad için eşzamanlı oluşturma isteklerini sıraya dizer. İki ürün aynı anda
// yayınlandığında ikisi de "yok" deyip aynı adla koleksiyon açabiliyordu; kilit sayesinde
// ikincisi birincinin açtığını görüyor.
const koleksiyonKilitleri = new Map()

function koleksiyonKilidiyle(key, is) {
  const onceki = koleksiyonKilitleri.get(key) || Promise.resolve()
  const calisma = onceki.then(is, is) // öncekinin hatası sıradakini engellemesin
  const kuyruk = calisma.catch(() => {})
  koleksiyonKilitleri.set(key, kuyruk)
  kuyruk.then(() => {
    if (koleksiyonKilitleri.get(key) === kuyruk) koleksiyonKilitleri.delete(key)
  })
  return calisma
}

// `create: false` ile SADECE arar, bulamazsa yeni koleksiyon AÇMAZ. Saatlik stok/fiyat
// senkronu bu modda çalışıyor — o işin görevi koleksiyon yaratmak değil, ve tek bir
// başarısız aramanın mağazaya kalıcı bir kopya koleksiyon bırakması kabul edilemez.
async function findOrCreateShopifyCollection(title, { create = true } = {}) {
  const normalizedTitle = String(title || '').trim()
  if (!normalizedTitle) return null
  const key = collectionTitleKey(normalizedTitle)

  const yerel = olusturulanKoleksiyonGetir(key)
  if (yerel) return yerel

  const collections = await getShopifyCollectionsCached()
  const existing = koleksiyonBul(collections, key)
  if (existing) return existing

  if (!create) return null

  return koleksiyonKilidiyle(key, async () => {
    // Kilidi beklerken sıradaki başka bir çağrı bu koleksiyonu açmış olabilir.
    const beklerkenOlusan = olusturulanKoleksiyonGetir(key)
    if (beklerkenOlusan) return beklerkenOlusan

    // Önbellek bayat olabilir — yeni koleksiyon açmadan ÖNCE listeyi tazeleyip son bir kez
    // bakıyoruz. Tazeleme başarısız olursa hata fırlar ve koleksiyon AÇILMAZ.
    const taze = await getShopifyCollectionsCached(true)
    const tazeEslesen = koleksiyonBul(taze, key)
    if (tazeEslesen) return tazeEslesen

    const data = await shopifyRestFetch('custom_collections.json', 'POST', {
      custom_collection: {
        title: normalizedTitle,
        published: true
      }
    })
    const olusan = data.custom_collection ? { ...data.custom_collection, _tur: 'custom_collections' } : null
    // Yeni koleksiyon hem önbelleğe hem kalıcı "bu süreçte açıldı" haritasına yazılıyor ki
    // sonraki ürünler (liste ucu henüz göstermese bile) onu bulsun.
    if (olusan) {
      olusturulanKoleksiyonlar.set(key, { koleksiyon: olusan, zaman: Date.now() })
      if (koleksiyonCache.liste) koleksiyonCache.liste.push(olusan)
    }
    return olusan
  })
}

async function addProductToCollection(productId, collectionId) {
  if (!productId || !collectionId) return null

  try {
    const data = await shopifyRestFetch('collects.json', 'POST', {
      collect: {
        product_id: Number(productId),
        collection_id: Number(collectionId)
      }
    })
    return data.collect || null
  } catch (err) {
    const message = err?.message || ''
    if (/already exists/i.test(message) || /has already been taken/i.test(message)) {
      return null
    }
    throw err
  }
}

// Bir koleksiyondaki ürün bağlarını (collect) sayfalama dahil listeler.
async function listCollectsForCollection(collectionId) {
  const hepsi = []
  let path = `collects.json?collection_id=${Number(collectionId)}&limit=250`
  let guard = 0
  while (path && guard < 50) {
    guard += 1
    const sonuc = await shopifyRestFetchRaw(path, 'GET').catch(() => null)
    if (!sonuc || !sonuc.data) break
    const liste = Array.isArray(sonuc.data.collects) ? sonuc.data.collects : []
    hepsi.push(...liste)
    path = sonuc.headers ? nextPagePath(sonuc.headers.get('link'), 'collects') : null
    // nextPagePath limit/page_info'yu kuruyor ama collection_id'yi düşürüyor; Shopify
    // page_info'lu isteklerde ek filtre kabul etmediği için bu doğru davranış.
  }
  return hepsi
}

function getCollectionTitlesFromProduct(urun) {
  const titles = []
  if (urun.kategori) titles.push(String(urun.kategori).trim())
  if (urun.altKategori) titles.push(String(urun.altKategori).trim())
  return [...new Set(titles.filter(Boolean))]
}

async function getShopifyProductRestById(productId) {
  if (!productId) return null
  const data = await shopifyRestFetch(`products/${productId}.json`, 'GET')
  return data.product || null
}

// URL Shopify'ın kendi CDN'ini işaret ediyor mu? Ediyorsa dosya zaten Shopify'da,
// tekrar yüklenmemeli. Shopify video URL'leri cdn.shopify.com/videos/... biçiminde.
function shopifyCdnVideoUrlMi(url) {
  return /(^|\/\/|\.)cdn\.shopify\.com\//i.test(String(url || ''))
}

// Video dosyasına KAYNAK URL'SİNDEN türetilmiş, değişmez bir ad veriyoruz. Bu adın iki
// işi var:
//   • aynı kaynağın Shopify'da zaten yüklü olup olmadığını (findShopifyVideoByFilename)
//     tek bir sorguyla anlamak,
//   • iki farklı ürünün videosu tesadüfen "video.mp4" gibi aynı adı taşısa bile
//     birbirine karışmamasını sağlamak (hash kaynak URL'sinden geliyor).
// ESKİ DAVRANIŞ: ad, URL'nin son parçasıydı ("video.mp4"), yani ne teşhis edici ne de
// benzersizdi.

function videoDosyaAdi(sourceUrl) {
  const temiz = String(sourceUrl || '').split('?')[0].split('#')[0]
  const sonParca = temiz.split('/').filter(Boolean).pop() || ''
  const uzantiEsles = sonParca.match(/\.([a-z0-9]{2,5})$/i)
  const uzanti = uzantiEsles ? uzantiEsles[1].toLowerCase() : 'mp4'
  // Hash SORGU PARAMETRESİ ATILMIŞ URL'den üretiliyor. Aksi halde önbellek kırıcı bir
  // `?v=...` değiştiği anda ad da değişir ve aynı video yeniden yüklenirdi — Shopify CDN
  // URL'leri tam olarak böyle bir parametre taşıyor.
  const hash = crypto.createHash('sha1').update(temiz.toLowerCase()).digest('hex').slice(0, 12)
  return `vega-video-${hash}.${uzanti}`
}

// Mağazadaki TÜM video dosyaları (sayfalama dahil) — mükerrer temizliği için.
// Aynı videonun kaç kopyası olduğunu anlamak için ad, boyut ve süre birlikte okunuyor.
async function listAllShopifyVideoFiles() {
  const query = `
    query ListVideoFiles($after: String) {
      files(first: 100, after: $after, query: "media_type:VIDEO") {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            alt
            createdAt
            ... on Video {
              filename
              duration
              fileStatus
              originalSource { fileSize }
            }
          }
        }
      }
    }
  `
  const hepsi = []
  let after = null
  let guard = 0
  while (guard < 50) {
    guard += 1
    const result = await shopifyFetch(query, { after })
    const conn = result.files
    if (!conn) break
    for (const e of (conn.edges || [])) if (e?.node) hepsi.push(e.node)
    if (!conn.pageInfo?.hasNextPage) break
    after = conn.pageInfo.endCursor
  }
  return hepsi
}

async function deleteShopifyFiles(gidler) {
  if (!gidler || gidler.length === 0) return 0
  const mutation = `
    mutation FileDelete($fileIds: [ID!]!) {
      fileDelete(fileIds: $fileIds) {
        deletedFileIds
        userErrors { field message }
      }
    }
  `
  const result = await shopifyFetch(mutation, { fileIds: gidler })
  const payload = result.fileDelete
  if (payload?.userErrors?.length) {
    throw new Error(payload.userErrors.map(e => e.message).join(' | '))
  }
  return (payload?.deletedFileIds || []).length
}

// Shopify Dosyalar'da bu adda bir video var mı? Varsa GID'ini döner.
// Dönüş: GID (bulundu) | null (yok) | undefined (KONTROL EDİLEMEDİ — sorgu hata verdi,
// örn. read_files izni yok). undefined ile null'ı ayırmak önemli: "yok" ise yükleriz,
// "bilinmiyor" ise eski metafield karşılaştırmasına düşeriz, körlemesine yüklemeyiz.
async function findShopifyVideoByFilename(filename) {
  if (!filename) return null
  const query = `
    query FindVideoFile($query: String!) {
      files(first: 10, query: $query) {
        edges {
          node {
            id
            ... on Video {
              filename
              fileStatus
            }
          }
        }
      }
    }
  `
  try {
    const result = await shopifyFetch(query, { query: `filename:${filename}` })
    const nodes = (result.files?.edges || []).map(e => e.node).filter(Boolean)
    // Arama "içinde geçen" sonuçlar da dönebiliyor — tam ad eşleşmesi şart.
    const tam = nodes.find(n => String(n.filename || '').toLowerCase() === filename.toLowerCase())
    if (!tam) return null
    // Yükleme hâlâ işleniyorsa (PROCESSING) dosya yine mevcut demektir; tekrar
    // yüklemek ikinci bir kopya oluşturur, o yüzden onu da "var" sayıyoruz.
    if (tam.fileStatus === 'FAILED') return null
    return tam.id
  } catch (err) {
    console.warn('Shopify video dosyası aranamadı:', err.message)
    return undefined
  }
}

// `custom.video` metafield tanımı Shopify'da `file_reference` tipinde — düz metin URL kabul
// etmiyor, Shopify'ın kendi dosya sistemindeki bir dosyanın GID'ini bekliyor.
//
// ÖNEMLİ: `fileCreate`'e dış bir URL'i `originalSource` olarak direkt vermek VIDEO için
// çalışmıyor — Shopify her zaman "Invalid video url" döndürüyor (herkese açık, kesinlikle
// geçerli bir test videosuyla bile doğrulandı). Görsellerin aksine videolar için Shopify'ın
// 3 adımlı "staged upload" akışı zorunlu: 1) yükleme hedefi al, 2) dosya baytlarını o hedefe
// yükle, 3) dönen resourceUrl'i fileCreate'e ver (filename GÖNDERME — resourceUrl ile
// tutarsızlık hatası veriyor).
async function createShopifyVideoFile(url) {
  if (!url) return null

  const videoRes = await fetch(url)
  if (!videoRes.ok) throw new Error(`Video indirilemedi: ${videoRes.status}`)
  const buffer = Buffer.from(await videoRes.arrayBuffer())
  // Ad kaynak URL'sinden deterministik üretiliyor — sonraki senkronlarda "bu video zaten
  // yüklü mü" kontrolünün dayanağı bu (bkz. videoDosyaAdi).
  const filename = videoDosyaAdi(url)
  const mimeType = videoRes.headers.get('content-type') || 'video/mp4'

  const stagedMutation = `
    mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }
  `
  const stagedResult = await shopifyFetch(stagedMutation, {
    input: [{ resource: 'VIDEO', filename, mimeType, httpMethod: 'POST', fileSize: String(buffer.length) }]
  })
  const stagedPayload = stagedResult.stagedUploadsCreate
  if (stagedPayload.userErrors?.length) {
    throw new Error(stagedPayload.userErrors.map(e => e.message).join(' | '))
  }
  const target = stagedPayload.stagedTargets?.[0]
  if (!target) throw new Error('Shopify staged upload hedefi alınamadı')

  const form = new FormData()
  for (const p of target.parameters) form.append(p.name, p.value)
  form.append('file', new Blob([buffer]), filename)
  const uploadRes = await fetch(target.url, { method: 'POST', body: form })
  if (!uploadRes.ok) throw new Error(`Video yükleme hatası: ${uploadRes.status}`)

  const fileCreateMutation = `
    mutation FileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id }
        userErrors { field message }
      }
    }
  `
  const fcResult = await shopifyFetch(fileCreateMutation, {
    // `alt` kaynak URL'sini taşıyor: Shopify Dosyalar ekranında hangi videonun nereden
    // geldiği görünür oluyor, mükerrer temizliğinde de ek bir ipucu.
    files: [{ originalSource: target.resourceUrl, contentType: 'VIDEO', alt: String(url).slice(0, 512) }]
  })
  const fcPayload = fcResult.fileCreate
  if (fcPayload.userErrors?.length) {
    throw new Error(fcPayload.userErrors.map(e => e.message).join(' | '))
  }
  return fcPayload.files?.[0]?.id || null
}

function slugifyHandle(text = '') {
  return text.toString().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ü/g, 'u').replace(/Ü/g, 'u')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || `vega-${Date.now()}`
}

function getFieldValue(obj, path) {
  if (!obj || !path) return undefined
  return path.split('.').reduce((value, key) => value?.[key], obj)
}

// Ticimax XML'inde SKU ürün üzerinde değil ilk seçenekte tutuluyor
// (secenekler[0].stokKodu) — urun.sku/urun.kod hep boş kaldığı için SKU
// sessizce "VEGA" literaline düşüyordu, gerçek stok kodu hiç gönderilmiyordu.
function resolveBaseSku(urun, mapping = {}) {
  return String(
    getFieldValue(urun, mapping.sku) ||
    urun.sku ||
    urun.kod ||
    urun.secenekler?.[0]?.stokKodu ||
    urun.ozelAlan1 ||
    'VEGA'
  ).trim()
}

// Mağaza bazlı tekil stok modeli: Shopify'a renk/beden varyasyonu GÖNDERİLMEZ.
// Tüm mağazalardaki (ve varsa eski renk/beden kayıtlarındaki) adetler toplanıp
// ürün için TEK bir "Default" varyant/envanter sayısı oluşturulur.
function aggregateVariants(rawVariants = []) {
  let toplamAdet = 0
  let barkod = null
  for (const v of rawVariants || []) {
    toplamAdet += Number(v.adet || v.stokAdedi || v.quantity || 0)
    if (!barkod && v.barkod) barkod = v.barkod
  }
  return [{ renk: '', beden: '', adet: toplamAdet, barkod }]
}

// Ayakkabı gibi numara bazlı ürünler için: mağaza bazlı tekil stoğun aksine, Shopify'a
// TEK aggregate satır yerine HER NUMARA için ayrı bir varyant gönderilir. Aynı numara
// birden fazla mağazada olabileceği için (Vega'da mağaza+numara bazlı ayrı satırlar
// tutuluyor — bkz. /shopify/aktar), buradaki tek görev mağazalar arasında AYNI numarayı
// toplamak; farklı numaraları ayrı tutmak.
function aggregateVariantsByBeden(rawVariants = []) {
  const map = new Map()
  for (const v of rawVariants || []) {
    const beden = String(v.beden || '').trim()
    if (!beden) continue
    const adet = Number(v.adet || v.stokAdedi || v.quantity || 0)
    if (!map.has(beden)) map.set(beden, { renk: '', beden, adet: 0, barkod: null })
    const entry = map.get(beden)
    entry.adet += adet
    if (!entry.barkod && v.barkod) entry.barkod = v.barkod
  }
  return [...map.values()].sort((a, b) => (parseInt(a.beden) || 0) - (parseInt(b.beden) || 0))
}

// Hem local DB ürünlerinde (`urun.varyantlar`) hem de ham Ticimax XML
// nesnelerinde (`urun.secenekler`) çalışacak ortak varyant çözümleyici.
function resolveRawVariants(urun) {
  if (Array.isArray(urun.varyantlar)) return urun.varyantlar
  if (!Array.isArray(urun.secenekler)) return []
  return urun.secenekler.map(s => {
    const renk = s.renk || s.color || (s.ekSecenekOzellik || []).find(o => /renk|color/i.test(o.tanim || o.text || ''))?.deger || ''
    const beden = s.beden || s.size || (s.ekSecenekOzellik || []).find(o => /beden|numara|size/i.test(o.tanim || o.text || ''))?.deger || ''
    return {
      renk,
      beden,
      adet: Number(s.stokAdedi || s.adet || s.quantity || 0),
      barkod: s.barkod || s.stokKodu || null
    }
  })
}

// ─── "Renk Adı" metafield eşlemesi (panel → Shopify) ───
// Paneldeki Urun.renkAdi alanı, mağazadaki ÖZEL "Renk Adı" metafield'ine yazılıyor; site
// bunu ürün altındaki renk modalında ve iç sayfadaki renk seçeneklerinde okuyor.
// Anahtar SABİT YAZILMIYOR: Shopify, tanım adından anahtarı kendisi türetiyor ("renk_adi",
// "renk-adi", Türkçe karakter atılmış "renk_ad" ...). Yanlış anahtara yazmak, adminde
// görünen alanı boş bırakıp yanına ikinci bir "yapılandırılmamış" metafield düşürürdü —
// bu yüzden tanımı mağazadan bulup namespace/key/type'ını olduğu gibi kullanıyoruz.
// Gerekirse .env ile sabitlenebilir:  SHOPIFY_RENK_ADI_METAFIELD="custom.renk_adi"
const RENK_ADI_VARSAYILAN = { namespace: 'custom', key: 'renk_adi', type: 'single_line_text_field' }
const RENK_ADI_TANIM_TTL_MS = 10 * 60 * 1000
// Serbest metin yazılabilecek tipler. Tanım bunların dışındaysa (ör. taksonomi/metaobject
// referansı) değer gönderilmiyor — Shopify tip uyuşmazlığında tüm ürün güncellemesini
// reddediyor, yani bir renk adı uğruna fiyat/stok senkronu da çöpe giderdi.
const RENK_ADI_METIN_TIPLERI = ['single_line_text_field', 'multi_line_text_field', 'list.single_line_text_field']
const RENK_ADI_ADAYLARI = new Set(['renkadi', 'renkad', 'renkismi', 'colorname'])
// Okuma hatasından sonra bu süre boyunca yeniden sorulmuyor: saatlik oto-senkron yüzlerce
// ürün için çalışıyor, her birinde başarısız sorguyu tekrarlamak rate limiti yer.
const RENK_ADI_HATA_BEKLEME_MS = 60 * 1000
let renkAdiTanimCache = { zaman: 0, tanim: null }
let renkAdiSonHata = 0

// Metafield adını/anahtarını karşılaştırılabilir hale getirir: "Renk Adı", "renk_adi" ve
// "Renk-Adi" aynı anahtara iner.
function metafieldAdAnahtari(deger) {
  return String(deger || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '')
}

async function listProductMetafieldDefinitions() {
  const query = `
    query UrunMetafieldTanimlari($after: String) {
      metafieldDefinitions(ownerType: PRODUCT, first: 250, after: $after) {
        edges { node { name namespace key type { name } } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `
  const tanimlar = []
  let after = null
  for (let sayfa = 0; sayfa < 10; sayfa++) {
    const sonuc = await shopifyFetch(query, { after })
    const kutu = sonuc.metafieldDefinitions
    if (!kutu) break
    for (const edge of kutu.edges || []) if (edge?.node) tanimlar.push(edge.node)
    if (!kutu.pageInfo?.hasNextPage) break
    after = kutu.pageInfo.endCursor
  }
  return tanimlar
}

// Mağazadaki "Renk Adı" tanımını bulur. Bulamazsa `custom.renk_adi` varsayılanına düşer
// (uyarı loglanır) — böylece tanım sonradan açıldığında eşleme kendiliğinden oturur.
async function getRenkAdiMetafieldTanimi() {
  const simdi = Date.now()
  if (renkAdiTanimCache.tanim && simdi - renkAdiTanimCache.zaman < RENK_ADI_TANIM_TTL_MS) {
    return renkAdiTanimCache.tanim
  }
  if (renkAdiSonHata && simdi - renkAdiSonHata < RENK_ADI_HATA_BEKLEME_MS) {
    return renkAdiTanimCache.tanim || RENK_ADI_VARSAYILAN
  }

  const elle = String(process.env.SHOPIFY_RENK_ADI_METAFIELD || '').trim()
  let bulunan = null
  let okumaHatasi = false
  try {
    const tanimlar = await listProductMetafieldDefinitions()
    if (elle) {
      const nokta = elle.indexOf('.')
      const ns = nokta > 0 ? elle.slice(0, nokta) : 'custom'
      const anahtar = nokta > 0 ? elle.slice(nokta + 1) : elle
      bulunan = tanimlar.find(d => d.namespace === ns && d.key === anahtar) ||
        { namespace: ns, key: anahtar, type: { name: RENK_ADI_VARSAYILAN.type } }
    } else {
      // Tema (vega-color-block.liquid) `custom.renk_adi` anahtarını SABİT okuyor — o tanım
      // mağazada varsa her zaman o kazanır. Ada göre arama yalnızca yedek: anahtar farklı
      // türetilmişse ("renk-adi", "renk_ad" ...) yine doğru alanı buluruz.
      bulunan = tanimlar.find(d =>
        d.namespace === RENK_ADI_VARSAYILAN.namespace && d.key === RENK_ADI_VARSAYILAN.key) || null
      if (!bulunan) {
        bulunan = tanimlar.find(d =>
          RENK_ADI_ADAYLARI.has(metafieldAdAnahtari(d.name)) ||
          RENK_ADI_ADAYLARI.has(metafieldAdAnahtari(d.key))) || null
      }
      if (!bulunan) {
        console.warn(`Shopify'da "Renk Adı" metafield tanımı bulunamadı — varsayılan ${RENK_ADI_VARSAYILAN.namespace}.${RENK_ADI_VARSAYILAN.key} kullanılıyor.`)
      }
    }
  } catch (err) {
    okumaHatasi = true
    renkAdiSonHata = Date.now()
    console.warn('Renk adı metafield tanımı okunamadı:', err.message)
  }

  const tanim = bulunan
    ? { namespace: bulunan.namespace, key: bulunan.key, type: bulunan.type?.name || RENK_ADI_VARSAYILAN.type }
    : RENK_ADI_VARSAYILAN
  // Geçici bir okuma hatasında varsayılanı 10 dakika boyunca ÖNBELLEĞE ALMIYORUZ; aksi
  // halde tek bir başarısız sorgu yüzünden değerler yanlış anahtara yazılmaya devam ederdi.
  if (!okumaHatasi) {
    renkAdiTanimCache = { zaman: simdi, tanim }
    renkAdiSonHata = 0
  }
  return tanim
}

// Panel değerini, tanımın tipine uygun metafield girdisine çevirir. Boş renk adı hiç
// gönderilmiyor: productUpdate'te BELİRTİLMEYEN metafield mevcut değerinde kalır, yani
// alan yanlışlıkla boşaltılmaz.
function renkAdiMetafieldGirdisi(renkAdi, tanim) {
  const metin = String(renkAdi || '').trim()
  if (!metin) return null
  const hedef = tanim || RENK_ADI_VARSAYILAN
  const tip = hedef.type || RENK_ADI_VARSAYILAN.type
  if (!RENK_ADI_METIN_TIPLERI.includes(tip)) {
    console.warn(`Renk adı metafield tipi metin değil (${tip}) — değer gönderilmedi.`)
    return null
  }
  return {
    namespace: hedef.namespace,
    key: hedef.key,
    type: tip,
    value: tip === 'list.single_line_text_field' ? JSON.stringify([metin]) : metin
  }
}

// Shopify'dan okunan metafield değerini panelin düz metin alanına çevirir (liste tipinde
// JSON dizi geliyor).
function renkAdiMetafieldDegeriniCoz(deger) {
  const ham = String(deger || '').trim()
  if (!ham) return null
  if (ham.startsWith('[')) {
    try {
      const dizi = JSON.parse(ham)
      if (Array.isArray(dizi)) return dizi.map(x => String(x).trim()).filter(Boolean).join(', ') || null
    } catch {
      // JSON değilse düz metin kabul et
    }
  }
  return ham
}

function buildShopifyProductInput(urun, mapping = {}, existingProduct = null, videoFileGid = null, videoSourceUrl = null, renkAdiTanim = null) {
  const title = getFieldValue(urun, mapping.title) || urun.ad || urun.urunAdi || ''
  const descriptionHtml = getFieldValue(urun, mapping.body) || urun.aciklama || urun.onYazi || ''
  const handle = slugifyHandle(getFieldValue(urun, mapping.handle) || title || urun.ad || urun.urunAdi || urun.kod || urun.barkod || 'vega-urun')

  // SATICI (vendor) BAĞLANTISI KALDIRILDI. Eskiden `urun.marka` Shopify'ın "Satıcı"
  // alanına yazılıyordu; kullanıcı isteğiyle artık yazılmıyor ve alan hiç GÖNDERİLMİYOR —
  // productUpdate'te belirtilmeyen alan mevcut değerinde kaldığı için mağazadaki mevcut
  // satıcı değerleri de bozulmuyor. Marka bilgisi kaybolmuyor: etiketlere (tags) ve
  // vega.marka metafield'ine yazılmaya devam ediyor.
  // Sabit bir satıcı adı isteniyorsa .env'de SHOPIFY_DEFAULT_VENDOR tanımlanabilir.
  const vendor = String(process.env.SHOPIFY_DEFAULT_VENDOR || '').trim() || null

  // TÜR (productType) = paneldeki KATEGORİ alanı (Çanta, Ayakkabı ...).
  const productType = getFieldValue(urun, mapping.productType) || urun.kategori || ''
  const barkod = String(urun.barkod || '').trim()
  const alisFiyat = Number(urun.alisF || 0)
  const kritikStok = Number.parseInt(urun.kritikStok ?? 0, 10)
  const tags = new Set()
  if (urun.marka) tags.add(urun.marka)
  if (urun.kategori) tags.add(urun.kategori)
  if (urun.altKategori) tags.add(urun.altKategori)
  if (urun.kod) tags.add(urun.kod)
  const skuIcinDeger = urun.sku || urun.secenekler?.[0]?.stokKodu
  if (skuIcinDeger) tags.add(skuIcinDeger)
  if (barkod) tags.add(barkod)
  if (urun.ticimaxId) tags.add(urun.ticimaxId)
  if (urun.renkGruplari) {
    const renkList = Array.isArray(urun.renkGruplari)
      ? urun.renkGruplari
      : String(urun.renkGruplari).split(/[;,]+/).map(x => x.trim()).filter(Boolean)
    renkList.forEach(r => tags.add(r))
  }

  // Paneldeki "Renk Adı" → mağazadaki aynı adlı özel metafield (bkz. getRenkAdiMetafieldTanimi).
  const renkAdiMetafield = renkAdiMetafieldGirdisi(urun.renkAdi, renkAdiTanim)

  const metafields = [
    ...(urun.kod ? [{ namespace: 'vega', key: 'local_kod', value: String(urun.kod), type: 'single_line_text_field' }] : []),
    ...(urun.id ? [{ namespace: 'vega', key: 'local_id', value: String(urun.id), type: 'single_line_text_field' }] : []),
    ...(skuIcinDeger ? [{ namespace: 'vega', key: 'urun_sku', value: String(skuIcinDeger), type: 'single_line_text_field' }] : []),
    ...(barkod ? [{ namespace: 'vega', key: 'urun_barkod', value: barkod, type: 'single_line_text_field' }] : []),
    ...(urun.marka ? [{ namespace: 'vega', key: 'marka', value: String(urun.marka), type: 'single_line_text_field' }] : []),
    ...(urun.kategori ? [{ namespace: 'vega', key: 'kategori', value: String(urun.kategori), type: 'single_line_text_field' }] : []),
    ...(urun.altKategori ? [{ namespace: 'vega', key: 'alt_kategori', value: String(urun.altKategori), type: 'single_line_text_field' }] : []),
    ...(urun.malzeme ? [{ namespace: 'vega', key: 'malzeme', value: String(urun.malzeme), type: 'single_line_text_field' }] : []),
    ...(Number.isFinite(alisFiyat) ? [{ namespace: 'vega', key: 'alis_fiyat', value: String(alisFiyat.toFixed(2)), type: 'number_decimal' }] : []),
    ...(Number.isFinite(kritikStok) ? [{ namespace: 'vega', key: 'kritik_stok', value: String(kritikStok), type: 'number_integer' }] : []),
    ...(urun.ticimaxId ? [{ namespace: 'vega', key: 'ticimax_id', value: String(urun.ticimaxId), type: 'single_line_text_field' }] : []),
    ...(videoFileGid ? [{ namespace: 'custom', key: 'video', value: videoFileGid, type: 'file_reference' }] : []),
    ...(videoFileGid ? [{ namespace: 'vega', key: 'video_source_url', value: String(videoSourceUrl || ''), type: 'single_line_text_field' }] : []),
    ...(urun.renkGruplari ? [{ namespace: 'custom', key: 'renk_gruplari', value: Array.isArray(urun.renkGruplari) ? urun.renkGruplari.join(', ') : String(urun.renkGruplari), type: 'single_line_text_field' }] : []),
    ...(renkAdiMetafield ? [renkAdiMetafield] : [])
  ]

  const input = {
    title,
    descriptionHtml,
    ...(vendor ? { vendor } : {}),
    productType,
    handle,
    // Her yayınlama/senkronda AÇIKÇA ACTIVE gönderiliyor — productUpdate'te
    // belirtilmeyen alanlar mevcut değerinde kalır, yani bir ürün bir kez Taslak
    // olursa (elle test/kayıt sırasında), status hiç zorlanmadığı için sonraki her
    // stok/fiyat senkronu onu sonsuza dek Taslak'ta bırakırdı.
    status: 'ACTIVE',
    tags: Array.from(tags).filter(Boolean),
    metafields
  }

  if (existingProduct?.id) {
    input.id = existingProduct.id
  }

  return input
}

async function findShopifyProductByHandle(handle) {
  if (!handle) return null
  const query = `
    query FindProductByHandle($query: String!) {
      products(first: 1, query: $query) {
        edges {
          node {
            id
            handle
            title
          }
        }
      }
    }
  `
  const result = await shopifyFetch(query, { query: `handle:${handle}` })
  return result.products.edges[0]?.node || null
}

async function getShopifyProductById(id) {
  if (!id) return null
  const query = `
    query GetProductById($id: ID!) {
      product(id: $id) {
        id
        handle
        title
        metafields(first: 20) {
          edges {
            node {
              namespace
              key
              value
            }
          }
        }
        # Video metafield'leri doğrudan anahtarla çekiliyor — ürünün 20'den fazla
        # metafield'i olduğunda first:20 listesinde görünmüyor, video her senkronda
        # yeniden yükleniyordu.
        videoSourceUrl: metafield(namespace: "vega", key: "video_source_url") { value }
        videoRef: metafield(namespace: "custom", key: "video") { value }
        variants(first: 100) {
          edges {
            node {
              id
              sku
              title
              price
              inventoryQuantity
            }
          }
        }
      }
    }
  `
  const result = await shopifyFetch(query, { id })
  return result.product || null
}

// "Aktar" (Shopify → yerel DB) akışı için — liste ekranındaki özet veriyle yetinmeyip
// açıklama, resimler ve video dahil ürünün tam halini Shopify'dan çekiyoruz.
async function getShopifyProductForImport(id, renkAdiHedef = RENK_ADI_VARSAYILAN) {
  if (!id) return null
  const query = `
    query GetProductForImport($id: ID!, $renkNs: String!, $renkKey: String!) {
      product(id: $id) {
        id
        title
        handle
        vendor
        productType
        descriptionHtml
        images(first: 20) {
          edges { node { url } }
        }
        metafields(first: 50) {
          edges { node { namespace key value type } }
        }
        # Renk adı doğrudan anahtarla da çekiliyor — ürünün 50'den fazla metafield'i
        # olduğunda yukarıdaki listede görünmeyebiliyor.
        renkAdiMetafield: metafield(namespace: $renkNs, key: $renkKey) { value type }
        variants(first: 100) {
          edges { node { price sku barcode inventoryQuantity selectedOptions { name value } } }
        }
      }
    }
  `
  const result = await shopifyFetch(query, {
    id,
    renkNs: renkAdiHedef?.namespace || RENK_ADI_VARSAYILAN.namespace,
    renkKey: renkAdiHedef?.key || RENK_ADI_VARSAYILAN.key
  })
  return result.product || null
}

// Bir Shopify varyantının "beden/numara" seçeneğini (varsa) döner — ayakkabı gibi
// numara bazlı ürünleri, tek satırlık "mağaza bazlı tekil stok" modelinden ayırt
// etmek için kullanılır (bkz. /shopify/aktar).
function shopifyVaryantBedeni(variantNode) {
  const secenek = (variantNode?.selectedOptions || []).find(o => /beden|numara|size/i.test(o.name || ''))
  return secenek?.value?.trim() || null
}

// Shopify'da barkodu boş bırakılmış varyantlar (numaralar) için deterministik,
// benzersiz bir barkod üretir — frontend'deki stok-yonetimi.jsx'teki yeniBarkod()
// ile aynı mantık (869 öneki + EAN-13 checksum) — iki taraf tutarlı üretsin diye.
function ean13Checksum(kod12) {
  let t = 0
  for (let i = 0; i < 12; i++) t += parseInt(kod12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (t % 10)) % 10
}
function strHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
  return Math.abs(h)
}
function otomatikBarkodUret(ad, marka, renk, beden) {
  const hash9 = strHash([ad, marka, renk, beden].join('|').toLowerCase()).toString().padStart(9, '0').slice(-9)
  const kod12 = '869' + hash9
  return kod12 + ean13Checksum(kod12)
}

// `custom.video` metafield'i `file_reference` tipindeyse değeri düz bir URL değil,
// Shopify dosya sisteminde bir GID'dir (bkz. createShopifyVideoFile notu). Bu GID'i
// gerçek oynatılabilir video URL'sine çeviriyoruz.
async function resolveVideoFileUrl(gid) {
  if (!gid) return null
  const query = `
    query GetVideoUrl($id: ID!) {
      node(id: $id) {
        ... on Video {
          sources { url }
        }
      }
    }
  `
  const result = await shopifyFetch(query, { id: gid })
  return result.node?.sources?.[0]?.url || null
}

async function createShopifyProduct(input) {
  const mutation = `
    mutation CreateProduct($input: ProductInput!) {
      productCreate(input: $input) {
        product { id handle title }
        userErrors { field message }
      }
    }
  `
  console.debug('Shopify createProduct input:', JSON.stringify(input, null, 2))
  try {
    const result = await shopifyFetch(mutation, { input })
    const payload = result.productCreate
    if (payload.userErrors?.length) {
      throw new Error(payload.userErrors.map(err => err.message).join(' | '))
    }
    return payload.product
  } catch (err) {
    if (isShopifyMetafieldMismatchError(err) && input.metafields?.length) {
      const retryInput = stripConflictingMetafields(input)
      if (retryInput.metafields.length !== input.metafields.length) {
        console.warn('Shopify metafield mismatch detected. Retrying create without conflicting metafields.')
        const retryResult = await shopifyFetch(mutation, { input: retryInput })
        const retryPayload = retryResult.productCreate
        if (retryPayload.userErrors?.length) {
          throw new Error(retryPayload.userErrors.map(err => err.message).join(' | '))
        }
        return retryPayload.product
      }
    }
    throw err
  }
}

async function updateShopifyProduct(input) {
  const mutation = `
    mutation UpdateProduct($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id handle title }
        userErrors { field message }
      }
    }
  `
  console.debug('Shopify updateProduct input:', JSON.stringify(input, null, 2))
  try {
    const result = await shopifyFetch(mutation, { input })
    const payload = result.productUpdate
    if (payload.userErrors?.length) {
      throw new Error(payload.userErrors.map(err => err.message).join(' | '))
    }
    return payload.product
  } catch (err) {
    if (isShopifyMetafieldMismatchError(err) && input.metafields?.length) {
      const retryInput = stripConflictingMetafields(input)
      if (retryInput.metafields.length !== input.metafields.length) {
        console.warn('Shopify metafield mismatch detected. Retrying update without conflicting metafields.')
        const retryResult = await shopifyFetch(mutation, { input: retryInput })
        const retryPayload = retryResult.productUpdate
        if (retryPayload.userErrors?.length) {
          throw new Error(retryPayload.userErrors.map(err => err.message).join(' | '))
        }
        return retryPayload.product
      }
    }
    throw err
  }
}

// Mağazadaki tüm satış kanallarını (Online Mağaza, POS, vb.) döner. `productCreate`/
// `productUpdate` bir ürünü SADECE varsayılan kanala (genelde Online Mağaza) yayınlar —
// diğer kanallara görünmesi için ayrıca `publishablePublish` çağrılması gerekir.
async function getAllShopifyPublications() {
  const query = `
    query GetPublications {
      publications(first: 25) {
        edges { node { id name } }
      }
    }
  `
  const result = await shopifyFetch(query)
  return (result.publications?.edges || []).map(e => e.node)
}

// Bir ürünü, mağazada tanımlı TÜM satış kanallarına yayınlar. Ürün zaten bir kanalda
// yayınlıysa o kanal için no-op'tur (hata vermez) — bu yüzden hem yeni oluşturmada hem
// de her yeniden yayınlamada güvenle çağrılabilir.
async function publishToAllChannels(productGid) {
  const publications = await getAllShopifyPublications().catch(err => {
    console.warn('Satış kanalları listelenemedi:', err.message)
    return []
  })
  if (publications.length === 0) return

  const mutation = `
    mutation PublishToAllChannels($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }
  `
  const input = publications.map(p => ({ publicationId: p.id }))
  const result = await shopifyFetch(mutation, { id: productGid, input })
  const errors = result.publishablePublish?.userErrors
  if (errors?.length) {
    console.warn('Bazı satış kanallarına yayınlama hatası:', errors.map(e => e.message).join(' | '))
  }
}

async function createShopifyVariants(productId, variants) {
  if (!variants || variants.length === 0) return []
  
  const variantInputs = variants.map(v => ({
    title: v.title || 'Default Title',
    sku: v.sku || '',
    price: v.price || '0',
    barcode: v.barcode || '',
    inventoryPolicy: 'DENY',
    inventoryManagement: 'SHOPIFY',
    ...(v.option1 ? { option1: v.option1 } : {}),
    ...(v.option2 ? { option2: v.option2 } : {}),
    ...(v.option3 ? { option3: v.option3 } : {})
  }))

  const results = []
  for (const variantInput of variantInputs) {
    try {
      const mutation = `
        mutation CreateProductVariant($productId: ID!, $input: ProductVariantInput!) {
          productVariantCreate(productId: $productId, input: $input) {
            productVariant { id sku title }
            userErrors { field message }
          }
        }
      `
      const result = await shopifyFetch(mutation, { productId, input: variantInput })
      const payload = result.productVariantCreate
      if (payload.userErrors?.length) {
        results.push({ error: payload.userErrors.map(e => e.message).join(' | ') })
      } else {
        results.push({ success: true, variant: payload.productVariant })
      }
    } catch (err) {
      results.push({ error: err.message })
    }
  }
  return results
}


// `koleksiyonOlustur: false` → kategori adından YENİ koleksiyon açılmaz, sadece zaten
// var olanlar kullanılır. Saatlik stok/fiyat senkronu bu modda çağırıyor.
export async function publishShopifyProduct(urun, mapping = {}, secilenKoleksiyonIds = [], { koleksiyonOlustur = true } = {}) {
  const handle = slugifyHandle(getFieldValue(urun, mapping.title) || urun.ad || urun.urunAdi || urun.kod || urun.sku || urun.barkod || 'vega-urun')
  // Kayıtlı shopifyId artık Shopify'da yoksa (ürün admin panelden silinmiş/taşınmış
  // olabilir) ID araması null döner — bu durumda direkt createProduct'a düşmek, aynı
  // handle'da GERÇEKTEN var olan bir ürünle çakışıp "Handle already in use" hatası
  // verir (oto-senkron sonsuza dek başarısız olurdu). ID bulunamazsa handle ile de
  // aranıyor; bulunursa o ürün güncellenir, shopifyId de aşağıda kendini onarır.
  let existingProduct = urun.shopifyId
    ? await getShopifyProductById(urun.shopifyId).catch(() => null)
    : null
  if (!existingProduct) {
    const byHandle = await findShopifyProductByHandle(handle).catch(() => null)
    // Handle araması sadece id/handle/title döner — video metafield'leri olmadan
    // "video değişmedi mi" kontrolü yapılamıyordu, tam ürünü id ile tekrar çekiyoruz.
    existingProduct = byHandle
      ? (await getShopifyProductById(byHandle.id).catch(() => null)) || byHandle
      : null
  }

  const rawVariants = resolveRawVariants(urun)
  // Ayakkabı gibi numara bazlı ürünler: birden fazla FARKLI beden değeri varsa, mağaza
  // bazlı tekil stok yerine Shopify'a da HER NUMARA için ayrı varyant/stok gönderilir.
  const numaraBazliMi = new Set(rawVariants.map(v => String(v.beden || '').trim()).filter(Boolean)).size > 1
  const variants = numaraBazliMi ? aggregateVariantsByBeden(rawVariants) : aggregateVariants(rawVariants)
  const baseSku = resolveBaseSku(urun, mapping)
  const productBarcode = String(urun.barkod || '').trim() || null

  // Karşılaştırmalı fiyat (Shopify'da üstü çizili "compare at" fiyatı) — frontend
  // bunu satış fiyatından ayrı, kendi çarpanıyla (×2.40) hesaplayıp gönderiyor.
  const karsilastirmaliFiyat = Number(urun.karsilastirmaliFiyat || 0)
  const shopifyVariantPayloads = variants.length > 0 ? variants.map((v) => ({
    title: numaraBazliMi ? String(v.beden) : 'Default Title',
    sku: numaraBazliMi ? `${baseSku}-${v.beden}` : baseSku,
    barcode: String(v.barkod || productBarcode || '').trim() || undefined,
    price: String(Number(urun.satisF || urun.satisFiyati || 0).toFixed(2)),
    compare_at_price: karsilastirmaliFiyat > 0 ? String(karsilastirmaliFiyat.toFixed(2)) : undefined,
    taxable: false, // Kullanıcı isteği: Shopify'da "Vergi al" (charge tax) kapalı gönderilsin
    inventory_policy: 'deny',
    inventory_management: 'shopify',
    inventory_quantity: Number(v.adet || 0),
    option1: numaraBazliMi ? String(v.beden) : 'Default Title'
  })) : []

  const rawImages = urun.resimler || []
  const images = Array.isArray(rawImages)
    ? rawImages.map(normalizeImageSrc).filter(Boolean).map(src => ({ src }))
    : []

  const videoUrl = normalizeImageSrc(urun.video)
  // ── Video: tekrar yüklemeyi ÖNLEMEDE sıranın payı var ──
  // Yükleme, ürün güncellemesinden ÖNCE oluyor. Yani "bu videoyu zaten yükledim"
  // bilgisini yalnızca ürün metafield'lerinde tutmak kırılgan: güncelleme herhangi bir
  // sebeple hata verirse (metafield tipi uyuşmazlığı, handle çakışması, geçici ağ hatası)
  // dosya Shopify Dosyalar'da SAHİPSİZ kalıyor ve saatlik senkron bir sonraki turda aynı
  // videoyu bir daha yüklüyordu — saatte bir kopya, sonsuza kadar.
  //
  // Bu yüzden asıl kontrol artık Shopify'ın KENDİ dosya listesinde yapılıyor: kaynak
  // URL'sinden türetilen değişmez dosya adı orada varsa video yeniden yüklenmez, var olan
  // dosyanın GID'i kullanılır. Bu kontrol metafield yazımından bağımsız olduğu için
  // kendi kendini onarıyor.
  const existingMetafields = existingProduct?.metafields?.edges?.map(e => e.node) || []
  const existingVideoSourceUrl = existingProduct?.videoSourceUrl?.value
    || existingMetafields.find(m => m.namespace === 'vega' && m.key === 'video_source_url')?.value || null
  const existingVideoGid = existingProduct?.videoRef?.value
    || existingMetafields.find(m => m.namespace === 'custom' && m.key === 'video')?.value || null

  const videoYukle = () => createShopifyVideoFile(videoUrl).catch(err => {
    console.warn('Video dosyası Shopify\'a yüklenemedi:', err.message)
    return null
  })

  let videoFileGid = null
  if (videoUrl) {
    // 1) Video zaten Shopify CDN'inde barındırılıyorsa dosya hâlihazırda Shopify'da
    //    demektir. Ürün Shopify'dan İÇERİ aktarıldığında yerel kayda düşen URL tam olarak
    //    budur (bkz. /shopify/aktar > resolveVideoFileUrl) — onu tekrar yüklemek birebir
    //    aynı videonun ikinci kopyasını yaratıyordu.
    if (shopifyCdnVideoUrlMi(videoUrl)) {
      videoFileGid = existingVideoGid || (await findShopifyVideoByFilename(imageFilenameKey(videoUrl))) || null
    }

    // 2) Dış kaynaklı (Ticimax / kendi yüklediğimiz) video: kaynak URL'sinden türetilen
    //    değişmez ada göre Shopify Dosyalar'da var mı diye bakıyoruz.
    if (!videoFileGid) {
      const mevcutDosyaGid = await findShopifyVideoByFilename(videoDosyaAdi(videoUrl))

      if (mevcutDosyaGid) {
        // Dosya Shopify'da zaten var — yükleme YOK, var olan dosya kullanılıyor.
        videoFileGid = mevcutDosyaGid
      } else if (mevcutDosyaGid === undefined) {
        // Dosya listesi sorgulanamadı (ör. uygulamanın read_files izni yok). Emin
        // olamadığımız için körlemesine yüklemiyoruz; eski metafield karşılaştırmasına
        // düşüyoruz — kaynak aynıysa yine yükleme yapılmaz.
        videoFileGid = existingVideoSourceUrl === videoUrl ? existingVideoGid : await videoYukle()
      } else {
        // Dosya gerçekten yok: ilk yükleme.
        videoFileGid = await videoYukle()
      }
    }
  }

  // Renk adı metafield'inin namespace/key/type'ı mağazadan okunuyor (10 dk önbellekli).
  // Okunamazsa varsayılana düşer; yayınlamayı bu yüzden durdurmuyoruz.
  const renkAdiTanim = await getRenkAdiMetafieldTanimi().catch(() => null)
  const input = buildShopifyProductInput(urun, mapping, existingProduct, videoFileGid, videoUrl, renkAdiTanim)
  const product = existingProduct ? await updateShopifyProduct(input) : await createShopifyProduct(input)

  // Kullanıcı isteği: ürün ne olursa olsun TÜM satış kanallarında (Online Mağaza,
  // POS, vb.) yayınlanmalı — productCreate/productUpdate bunu tek başına yapmıyor.
  await publishToAllChannels(product.id).catch(err => {
    console.warn('Satış kanallarına yayınlama hatası:', err.message)
  })

  const shopifyProductId = getShopifyNumericId(product.id)

  // Kullanıcı yayınlamadan önce koleksiyon seçtiyse (Marka Ürünleri'ndeki koleksiyon
  // modalı) sadece o seçime uyuyoruz; seçim yoksa eskisi gibi kategori/alt kategori
  // adından otomatik koleksiyon bulma/oluşturma davranışına düşüyoruz.
  if (secilenKoleksiyonIds.length > 0 && shopifyProductId) {
    for (const collectionId of secilenKoleksiyonIds) {
      // NOT: bu ID'ler REST'ten (custom_collections.json) geliyor — GraphQL GID değil,
      // düz sayısal ID. getShopifyNumericId sadece "gid://..." string'lerini ayrıştırır,
      // string olmayan (number) girdide sessizce null döner — bu yüzden burada
      // KULLANILMAMALI, olduğu gibi geçirilmeli (addProductToCollection zaten Number()'a çeviriyor).
      await addProductToCollection(shopifyProductId, collectionId).catch(err => {
        console.warn('Ürün koleksiyona eklenemedi:', collectionId, err.message)
      })
    }
  } else {
    const collectionTitles = getCollectionTitlesFromProduct(urun)
    if (collectionTitles.length > 0 && shopifyProductId) {
      for (const collectionTitle of collectionTitles) {
        const collection = await findOrCreateShopifyCollection(collectionTitle, { create: koleksiyonOlustur }).catch(err => {
          console.warn('Koleksiyon bulunamadı/oluşturulamadı:', collectionTitle, err.message)
          return null
        })
        if (!collection?.id) continue
        // Kurallı (smart) koleksiyonlara ürün elle eklenemez — üyelik koleksiyonun kendi
        // kurallarından gelir, collects çağrısı hata döner.
        if (collection._tur === 'smart_collections') continue
        // REST koleksiyon id'si zaten düz sayı; getShopifyNumericId yalnızca "gid://..."
        // string'lerini ayrıştırdığı için burada null döndürüyor ve ürün hiçbir zaman
        // koleksiyona eklenmiyordu.
        await addProductToCollection(shopifyProductId, collection.id).catch(err => {
          console.warn('Ürün koleksiyona eklenemedi:', collectionTitle, err.message)
        })
      }
    }
  }

  if (shopifyVariantPayloads.length > 0) {
    const currentProduct = await getShopifyProductById(product.id).catch(() => null)
    const currentProductRest = currentProduct ? null : await getShopifyProductRestById(shopifyProductId).catch(() => null)
    const existingVariants = (currentProduct?.variants?.edges || []).map(edge => edge.node)
    const existingVariantsRest = Array.isArray(currentProductRest?.variants) ? currentProductRest.variants : []
    const variantsToUpdate = existingVariants.length > 0
      ? existingVariants
      : existingVariantsRest.map(v => ({
          id: `gid://shopify/ProductVariant/${v.id}`,
          sku: v.sku,
          title: v.title,
          price: v.price,
          inventoryQuantity: v.inventory_quantity
        }))
    const usedExistingVariantIds = new Set()

    for (let index = 0; index < shopifyVariantPayloads.length; index += 1) {
      const localVariant = shopifyVariantPayloads[index]
      const match = variantsToUpdate.find(v => {
        if (usedExistingVariantIds.has(v.id)) return false
        // Ayakkabı (numara bazlı) ürünlerde SKU'ya güvenilemez — ürün Shopify'da bizim
        // `${baseSku}-${beden}` kuralımızdan ÖNCE oluşturulmuş olabilir, elle farklı bir
        // SKU girilmiş olabilir, hatta SKU hiç girilmemiş (null) olabilir. Bu yüzden asıl
        // kimlik numara/beden değeridir (Shopify'da varyantın "title"ı) — SKU eşleşmesi
        // sadece SKU'lar zaten tutarlıysa (numara bazlı olmayan ürünlerde) kullanılır.
        if (numaraBazliMi) {
          return String(v.title || '').trim() === String(localVariant.title || '').trim()
        }
        if (v.sku && localVariant.sku && v.sku === localVariant.sku) return true
        const existingOptionText = [v.title, v.sku, v.id].filter(Boolean).join(' ')
        return existingOptionText === localVariant.title
      })

      const primaryFallback = !match && index === 0 && variantsToUpdate.length > 0

      if (match || primaryFallback) {
        const targetVariant = match || variantsToUpdate[0]
        usedExistingVariantIds.add(targetVariant.id)
        const targetId = getShopifyNumericId(targetVariant.id)
        if (targetId) {
          await updateShopifyVariantRest(targetId, {
            id: targetId,
            price: localVariant.price,
            compare_at_price: localVariant.compare_at_price,
            taxable: localVariant.taxable,
            sku: localVariant.sku,
            barcode: localVariant.barcode,
            inventory_policy: localVariant.inventory_policy,
            inventory_management: localVariant.inventory_management,
            option1: localVariant.option1,
            ...(localVariant.option2 ? { option2: localVariant.option2 } : {})
          }).catch(err => console.warn('Variant güncelleme hatası:', err.message))
        }
      } else {
        try {
          await createShopifyVariantRest(shopifyProductId, localVariant)
        } catch (err) {
          if (numaraBazliMi && isLinkedMetafieldOptionError(err)) {
            try {
              const options = await getProductOptionsWithLink(product.id)
              const linkedOption = options.find(o => o.linkedMetafield)
              const metaobjectId = linkedOption
                ? await findMetaobjectIdForOptionValue(linkedOption.linkedMetafield.namespace, linkedOption.linkedMetafield.key, localVariant.title)
                : null

              if (!linkedOption || !metaobjectId) {
                console.warn(`Metafield bağlantılı seçenek için "${localVariant.title}" değeri mağazada mevcut değil — bu ürüne bu numarayı bir kez Shopify admin panelinden elle ekleyin, sonraki senkronlar stoğunu otomatik güncelleyecek.`)
              } else {
                const updatedVariants = await addLinkedOptionValue(product.id, linkedOption.id, metaobjectId)
                const created = updatedVariants.find(v => String(v.title || '').trim() === String(localVariant.title).trim())
                const createdNumericId = created ? getShopifyNumericId(created.id) : null
                if (createdNumericId) {
                  await updateShopifyVariantRest(createdNumericId, {
                    id: createdNumericId,
                    price: localVariant.price,
                    compare_at_price: localVariant.compare_at_price,
                    taxable: localVariant.taxable,
                    sku: localVariant.sku,
                    barcode: localVariant.barcode,
                    inventory_policy: localVariant.inventory_policy,
                    inventory_management: localVariant.inventory_management
                  })
                  usedExistingVariantIds.add(created.id)
                } else {
                  console.warn('Taksonomi değeri eklendi ama yeni varyant bulunamadı:', localVariant.title)
                }
              }
            } catch (fallbackErr) {
              console.warn('Linked option fallback hatası:', fallbackErr.message)
            }
          } else {
            console.warn('Variant oluşturma hatası:', err.message)
          }
        }
      }
    }
  }

  if (images.length > 0) {
    // Resimler her senkronda Shopify'daki listeyle MUTABAKATA sokuluyor: mükerrer kopyalar
    // siliniyor, gerçekten eksik olanlar yükleniyor (bkz. reconcileShopifyProductImages).
    // Önceki iki yaklaşım da yetersizdi: dosya adı eşleştirmesi Shopify CDN adlarını
    // yakalayamıyordu, "üründe resim varsa hiç dokunma" kuralı ise çoklamayı durdursa da
    // sonradan eklenen fotoğrafların Shopify'a hiç gitmemesine yol açıyordu.
    await reconcileShopifyProductImages(shopifyProductId, images.map(i => i.src))
      .catch(err => console.warn('Resim senkronu hatası:', err.message))
  }

  if (shopifyVariantPayloads.length > 0) {
    // Eşleştirmeyi SKU üzerinden yapıyoruz (her ürünün/numaranın SKU'su benzersiz).
    // Ayakkabıda her numaranın kendi SKU'su (`${baseSku}-${beden}`) var — bu yüzden
    // shopifyVariantPayloads'taki SKU'ları kullanıyoruz (variants ile birebir aynı sırada).
    const inventoryMap = new Map()
    variants.forEach((v, i) => {
      inventoryMap.set(shopifyVariantPayloads[i]?.sku || baseSku, Number(v.adet || 0))
    })
    if (inventoryMap.size > 0) {
      await adjustInventoryLevels(product.id, inventoryMap).catch(err => {
        console.warn('Shopify inventory ayarlama hatası:', err.message)
      })
    }
  }

  return product
}

async function ensureInventoryItemTracked(inventoryItemId) {
  const mutation = `
    mutation EnableInventoryTracking($id: ID!, $input: InventoryItemInput!) {
      inventoryItemUpdate(id: $id, input: $input) {
        inventoryItem { id tracked }
        userErrors { field message }
      }
    }
  `
  const result = await shopifyFetch(mutation, { id: inventoryItemId, input: { tracked: true } })
  const errors = result.inventoryItemUpdate?.userErrors || []
  if (errors.length > 0) {
    throw new Error(errors.map(e => e.message).join(' | '))
  }
}

async function adjustInventoryLevels(productId, inventoryMap) {
  const query = `
    query ProductInventory($id: ID!) {
      product(id: $id) {
        id
        variants(first: 100) {
          edges {
            node {
              id
              sku
              inventoryQuantity
              selectedOptions { name value }
              inventoryItem { id tracked }
            }
          }
        }
      }
      locations(first: 1) {
        edges { node { id } }
      }
    }
  `
  const result = await shopifyFetch(query, { id: productId })
  const locationId = result.locations?.edges?.[0]?.node?.id
  if (!locationId) {
    throw new Error('Shopify lokasyonu bulunamadı. Inventory senkronu için lokasyon gereklidir.')
  }

  const product = result.product
  const adjustments = []
  const changes = []
  for (const edge of product.variants.edges) {
    const node = edge.node
    // Eşleştirme önceliği: SKU tam eşleşmesi. Tek-varyant modelinde her ürünün
    // benzersiz bir SKU'su olduğu için bu yeterli ve güvenilirdir.
    let target = inventoryMap.get(node.sku)
    if (target === undefined) {
      // Geriye dönük uyumluluk: eski renk/beden key formatıyla kaydedilmiş olabilir.
      const legacyKey = node.selectedOptions.map(o => o.value).filter(Boolean).join('||')
      target = inventoryMap.get(legacyKey)
    }
    if (target === undefined) continue

    if (!node.inventoryItem?.id) {
      adjustments.push({ sku: node.sku, status: 'skip', reason: 'inventoryItem missing' })
      continue
    }

    // Yeni ürün oluşturulunca Shopify otomatik bir "Default Title" varyantı yaratıyor
    // ve bu varyantın inventory item'ı `tracked: false` geliyor. REST varyant PUT
    // isteğindeki `inventory_management: 'shopify'` alanı SADECE varyant oluşturulurken
    // etkili oluyor — mevcut bir varyantı güncellerken Shopify bunu sessizce yok sayıyor.
    // Sonuç: miktar `inventoryAdjustQuantities` ile başarıyla yazılıyor ama Shopify
    // "stok takip edilmiyor" dediği için hiçbir yerde (Admin/satış kanalları) görünmüyor.
    // Burada tracking'i açıkça açıyoruz ki yazılan miktar gerçekten sayılsın.
    if (node.inventoryItem.tracked === false) {
      await ensureInventoryItemTracked(node.inventoryItem.id).catch(err => {
        console.warn('Inventory tracking açılamadı:', node.sku, err.message)
      })
    }

    // Skip-if-unchanged sadece bir optimizasyon (istek sayısını azaltır) — doğruluk
    // artık buna bağlı değil, çünkü aşağıda MUTLAK değer gönderiliyor (delta değil).
    // `inventoryQuantity` birden fazla lokasyonun toplamını döndürür (tek lokasyona
    // özel değil); önceki delta yaklaşımı çoklu lokasyonlu mağazalarda bu yüzden yanlış
    // hesaplayabiliyordu — set (mutlak) yaklaşımı bu belirsizliği tamamen ortadan kaldırır.
    const current = Number(node.inventoryQuantity || 0)
    if (current === Number(target)) {
      adjustments.push({ sku: node.sku, from: current, to: target, degismedi: true })
      continue
    }

    changes.push({ inventoryItemId: node.inventoryItem.id, locationId, quantity: Number(target) })
    adjustments.push({ sku: node.sku, from: current, to: target, error: null })
  }

  if (changes.length === 0) return adjustments

  // Delta (inventoryAdjustQuantities: "şu kadar artır/azalt") yerine mutlak değer
  // (inventorySetQuantities: "şu kadar OLSUN") kullanılıyor — aynıysa değişmiyor,
  // artmışsa/azalmışsa doğrudan doğru sayıya ayarlanıyor, delta hesabına bağlı değil.
  const mutation = `
    mutation SetInventoryQuantities($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        userErrors { field message }
      }
    }
  `
  const adjustResult = await shopifyFetch(mutation, {
    input: {
      reason: 'correction',
      name: 'available',
      // Shopify'ın "compareQuantity" iyimser eşzamanlılık kontrolünü atlıyoruz — biz
      // zaten mutlak hedef değeri gönderiyoruz, Shopify'ın mevcut değerini önceden
      // bilmemiz/karşılaştırmamız gerekmiyor.
      ignoreCompareQuantity: true,
      quantities: changes
    }
  })

  const errors = adjustResult.inventorySetQuantities?.userErrors || []
  if (errors.length > 0) {
    const message = errors.map(e => e.message).join(' | ')
    adjustments.forEach(a => { a.error = message })
    throw new Error(`Shopify inventory güncelleme hatası: ${message}`)
  }

  return adjustments
}

// ═══════════════════════════════════════════════════════════════════════
// ─── SİPARİŞLER (Shopify → Vega, çift yönlü durum senkronu) ────────────
// ═══════════════════════════════════════════════════════════════════════

// Shopify sipariş durumlarını (kargo/finansal/iptal/iade) Vega'nın tek
// `durum` alanına eşliyoruz. Öncelik: iptal > iade > kargo/teslimat durumu.
function mapShopifyOrderDurum(order) {
  if (order.cancelledAt) return 'iptal'
  const iadeVarMi = (order.refunds || []).length > 0
    || order.displayFinancialStatus === 'REFUNDED'
    || order.displayFinancialStatus === 'PARTIALLY_REFUNDED'
  if (iadeVarMi) return 'iade_edildi'
  switch (order.displayFulfillmentStatus) {
    case 'FULFILLED': return 'teslim_edildi'
    case 'PARTIALLY_FULFILLED':
    case 'IN_PROGRESS': return 'kargoda'
    default: return 'beklemede'
  }
}

function shopifyIlkFulfillment(order) {
  return (order.fulfillments || [])[0] || null
}

async function fetchShopifyOrdersPage({ first = 50, after = null, query = null } = {}) {
  const gql = `
    query GetOrders($first: Int!, $after: String, $query: String) {
      orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT) {
        edges {
          cursor
          node {
            id
            name
            createdAt
            updatedAt
            cancelledAt
            note
            displayFinancialStatus
            displayFulfillmentStatus
            currentTotalPriceSet { shopMoney { amount } }
            totalShippingPriceSet { shopMoney { amount } }
            totalDiscountsSet { shopMoney { amount } }
            customer { id firstName lastName email phone }
            shippingAddress { address1 address2 city province country phone name }
            fulfillments(first: 5) {
              id
              status
              trackingInfo(first: 3) { number company url }
            }
            refunds(first: 5) { id createdAt }
            lineItems(first: 100) {
              edges {
                node {
                  title
                  quantity
                  sku
                  variant { id sku selectedOptions { name value } }
                  originalUnitPriceSet { shopMoney { amount } }
                }
              }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `
  const result = await shopifyFetch(gql, { first, after, query })
  return result.orders
}

function shopifyAdresMetni(adres) {
  if (!adres) return null
  return [adres.address1, adres.address2, adres.city, adres.province, adres.country].filter(Boolean).join(', ') || null
}

// Shopify müşterisini (e-posta/telefon üzerinden) mevcut bir Vega müşterisiyle
// eşleştirir, yoksa yeni bir CRM kaydı oluşturur — ürün aktarımındaki
// find-or-create deseniyle aynı mantık.
async function findOrCreateMusteriFromShopifyOrder(order) {
  const musteriBilgi = order.customer
  const adres = order.shippingAddress
  const ad = musteriBilgi?.firstName || adres?.name?.split(' ')?.[0] || 'Web'
  const soyad = musteriBilgi?.lastName
    || (adres?.name ? adres.name.split(' ').slice(1).join(' ') : null)
    || null
  const telefon = musteriBilgi?.phone || adres?.phone || null
  const email = musteriBilgi?.email || null

  let musteri = null
  if (email) musteri = await prisma.musteri.findFirst({ where: { email } })
  if (!musteri && telefon) musteri = await prisma.musteri.findFirst({ where: { telefon } })
  if (!musteri) {
    musteri = await prisma.musteri.create({
      data: { ad, soyad, telefon, email, adres: shopifyAdresMetni(adres) }
    })
  }
  return musteri
}

// ─── Shopify siparişi → yerel stok düşümü ──────────────────────────────
// Sipariş panele aktarılırken satır kalemleri yerel ürünlerle eşleştirilip mağaza
// stoğundan düşülüyor. Üç şey kritik:
//   • İDEMPOTENS: senkron hem saatlik cron'dan hem "Şimdi Çek" butonundan defalarca
//     çalışıyor, aynı sipariş her seferinde yeniden işleniyor. Stok yalnızca BİR kez
//     düşmeli. Bunun için Siparis tablosuna bayrak eklemek yerine stok defterine
//     (StokHareket.referansId = sipariş id) bakıyoruz — migration gerektirmiyor ve
//     zaten tek doğru kaynak defterin kendisi.
//   • GERİYE DÖNÜK GÜVENLİK: bu özellik açılmadan ÖNCE aktarılmış siparişlerin defterde
//     hiç izi yok; onlar için düşüm YAPILMIYOR (yoksa ilk senkronda geçmişteki tüm
//     siparişler bir kerede stoktan düşülürdü).
//   • SİMETRİ: Shopify'da iptal/iade edilen sipariş için stok geri veriliyor, iptal
//     kalkarsa tekrar düşülüyor (bkz. routes/siparisler.js'teki aynı mantık).

const SIPARIS_IPTAL_IADE_DURUMLARI = ['iptal', 'iade_edildi']

// Stok hangi mağazadan düşsün? Tek mağazalı kurulumda soru yok. Birden fazla mağaza
// varsa .env'deki SHOPIFY_SIPARIS_MAGAZA_ID (ya da SHOPIFY_SIPARIS_MAGAZA_KODU) belirler;
// o da yoksa mağaza kalem bazında, stoğu olan mağaza tercih edilerek seçilir.
async function shopifySiparisMagazaId() {
  const envId = String(process.env.SHOPIFY_SIPARIS_MAGAZA_ID || '').trim()
  if (envId) return envId
  const envKod = String(process.env.SHOPIFY_SIPARIS_MAGAZA_KODU || '').trim()
  if (envKod) {
    const magaza = await prisma.magaza.findFirst({ where: { kod: envKod }, select: { id: true } })
    if (magaza) return magaza.id
  }
  const magazalar = await prisma.magaza.findMany({ select: { id: true }, take: 2 })
  return magazalar.length === 1 ? magazalar[0].id : null
}

// Shopify satır kalemindeki "beden/numara" seçeneği (varsa).
function shopifyKalemBedeni(li) {
  const secenekler = li?.variant?.selectedOptions || []
  const secim = secenekler.find(o => /beden|numara|size/i.test(o?.name || ''))
  return secim?.value?.trim() || null
}

function shopifyKalemRengi(li) {
  const secenekler = li?.variant?.selectedOptions || []
  const secim = secenekler.find(o => /renk|color/i.test(o?.name || ''))
  return secim?.value?.trim() || null
}

// Satır kalemini yerel ürünle eşler: SKU → ürün barkodu → varyant barkodu → ürün adı.
// Eşleşme yoksa null döner; sipariş yine de aktarılır, sadece o kalem için stok düşülmez.
async function shopifyKalemiUrunleEsle(li) {
  const sku = String(li?.sku || li?.variant?.sku || '').trim()
  const beden = shopifyKalemBedeni(li)

  if (sku) {
    const skuEslesen = await prisma.urun.findFirst({ where: { sku } })
    if (skuEslesen) return { urun: skuEslesen, beden }

    const barkodEslesen = await prisma.urun.findFirst({ where: { barkod: sku } })
    if (barkodEslesen) return { urun: barkodEslesen, beden }

    // Varyant barkodu eşleşirse hangi numaranın satıldığını da kesin biliyoruz —
    // Shopify seçeneklerinden çıkarılan bedene göre daha güvenilir.
    const varyantEslesen = await prisma.varyant.findFirst({ where: { barkod: sku }, include: { urun: true } })
    if (varyantEslesen?.urun) return { urun: varyantEslesen.urun, beden: varyantEslesen.beden || beden }
  }

  const baslik = String(li?.title || '').trim()
  if (baslik) {
    const adEslesen = await prisma.urun.findFirst({ where: { ad: baslik } })
    if (adEslesen) return { urun: adEslesen, beden }
  }
  return null
}

// Düşümün yapılacağı varyant satırını seçer. Numara eşleşmezse (ya da ürün numara
// bazlı değilse) mağaza bazlı tekil stok satırına düşülüyor.
async function shopifyStokVaryantiSec(urunId, beden, tercihMagazaId) {
  const hepsi = await prisma.varyant.findMany({ where: { urunId } })
  if (hepsi.length === 0) return null

  const hedefBeden = (beden || '').trim().toLowerCase()
  let adaylar = hedefBeden ? hepsi.filter(v => (v.beden || '').trim().toLowerCase() === hedefBeden) : hepsi
  if (adaylar.length === 0) adaylar = hepsi.filter(v => !v.beden) // tekil stok modeli
  if (adaylar.length === 0) return null

  const tercihli = tercihMagazaId ? adaylar.filter(v => v.magazaId === tercihMagazaId) : []
  const liste = tercihli.length > 0 ? tercihli : adaylar
  // Stoğu olan mağaza öncelikli — hiçbirinde yoksa ilk satır (düşüm 0'da sabitlenir).
  return [...liste].sort((a, b) => b.adet - a.adet)[0]
}

// Siparişin stok durumunu Shopify'daki güncel durumuyla hizalar.
// `yeni`: sipariş bu senkronda ilk kez oluşturuldu mu.
async function shopifySiparisStoguHizala({ siparisId, siparisNo, durum, satirlar, yeni, tercihMagazaId }) {
  const rapor = { dusulen: 0, geriVerilen: 0, eslesmeyen: 0 }

  // Defterdeki net hareket: düşümler negatif, iade/iptal geri vermeleri pozitif.
  const hareketler = await prisma.stokHareket.findMany({
    where: { referansId: siparisId },
    select: { adet: true }
  })
  const izVar = hareketler.length > 0
  const stokHalenDusuk = hareketler.reduce((t, h) => t + h.adet, 0) < 0

  const iptalIade = SIPARIS_IPTAL_IADE_DURUMLARI.includes(durum)
  const dusulmeli = !iptalIade && !stokHalenDusuk && (yeni || izVar)
  const geriVerilmeli = iptalIade && stokHalenDusuk
  if (!dusulmeli && !geriVerilmeli) return rapor

  for (const satir of satirlar) {
    if (!satir.eslesme?.urun?.id) { rapor.eslesmeyen++; continue }
    const varyant = await shopifyStokVaryantiSec(satir.eslesme.urun.id, satir.eslesme.beden, tercihMagazaId)
    if (!varyant) { rapor.eslesmeyen++; continue }

    const adet = Number(satir.adet) || 0
    if (adet <= 0) continue

    await prisma.$transaction([
      prisma.varyant.update({
        where: { id: varyant.id },
        data: dusulmeli
          ? { adet: Math.max(0, varyant.adet - adet) }
          : { adet: { increment: adet } }
      }),
      prisma.stokHareket.create({
        data: {
          urunId:     satir.eslesme.urun.id,
          magazaId:   varyant.magazaId,
          tip:        dusulmeli ? 'satis' : (durum === 'iptal' ? 'iptal' : 'iade'),
          renk:       varyant.renk || null,
          beden:      varyant.beden || null,
          adet:       dusulmeli ? -adet : adet,
          birimFiyat: satir.birimFiyat || 0,
          notlar:     dusulmeli
            ? `Shopify Siparişi: ${siparisNo}`
            : `Shopify Sipariş ${durum === 'iptal' ? 'İptali' : 'İadesi'}: ${siparisNo}`,
          referansId: siparisId,
        }
      })
    ])

    if (dusulmeli) rapor.dusulen++
    else rapor.geriVerilen++
  }

  return rapor
}

// Bir Shopify siparişini Vega'nın `Siparis`/`SiparisKalem` tablolarına aktarır.
// `shopifyOrderId` (unique) üzerinden idempotent: sipariş zaten varsa günceller,
// yoksa oluşturur — hem manuel "Şimdi Çek" butonu hem de periyodik cron job bunu kullanır.
export async function importShopifyOrder(order) {
  const musteri = await findOrCreateMusteriFromShopifyOrder(order)
  const durum = mapShopifyOrderDurum(order)
  const lineItems = (order.lineItems?.edges || []).map(e => e.node)
  const fulfillment = shopifyIlkFulfillment(order)
  const tracking = fulfillment?.trackingInfo?.[0]

  const araToplam = lineItems.reduce((t, li) => t + Number(li.originalUnitPriceSet?.shopMoney?.amount || 0) * Number(li.quantity || 0), 0)
  const kargoUcreti = Number(order.totalShippingPriceSet?.shopMoney?.amount || 0)
  const indirim = Number(order.totalDiscountsSet?.shopMoney?.amount || 0)
  const genelToplam = Number(order.currentTotalPriceSet?.shopMoney?.amount || 0)

  const ortakVeri = {
    shopifyOrderId: order.id,
    shopifyFulfillmentId: fulfillment?.id || null,
    kanal: 'shopify',
    durum,
    musteriId: musteri.id,
    musteriAd: [musteri.ad, musteri.soyad].filter(Boolean).join(' ') || null,
    musteriTel: musteri.telefon || null,
    adres: shopifyAdresMetni(order.shippingAddress),
    notlar: order.note || null,
    araToplam,
    indirim,
    kargoUcreti,
    genelToplam,
    odenmeDurum: /PAID/i.test(order.displayFinancialStatus || '') ? 'odendi' : 'beklemede',
    kargoNo: tracking?.number || null,
    kargoFirma: tracking?.company || null,
  }

  // Her satır kalemi yerel ürünle eşleştiriliyor: hem kalem kaydına `urunId` düşsün
  // (panelde ürün bağı görünür) hem de stok düşümü doğru varyanttan yapılabilsin.
  const satirlar = []
  for (const li of lineItems) {
    const eslesme = await shopifyKalemiUrunleEsle(li).catch(() => null)
    satirlar.push({
      eslesme,
      urunAd: li.title,
      renk: shopifyKalemRengi(li),
      beden: eslesme?.beden || shopifyKalemBedeni(li),
      adet: Number(li.quantity || 0) || 1,
      birimFiyat: Number(li.originalUnitPriceSet?.shopMoney?.amount || 0),
    })
  }

  const kalemVerisi = satirlar.map(r => ({
    urunId: r.eslesme?.urun?.id || null,
    urunAd: r.urunAd,
    renk: r.renk,
    beden: r.beden,
    adet: r.adet,
    birimFiyat: r.birimFiyat,
    toplam: r.birimFiyat * r.adet,
  }))

  // Stoğun düşeceği mağaza siparişe de yazılıyor — panelde "hangi mağazadan çıktı"
  // bilgisi ve sonraki iptal/iade işlemleri buna bakıyor.
  const stokMagazaId = await shopifySiparisMagazaId().catch(() => null)
  if (stokMagazaId) ortakVeri.magazaId = stokMagazaId

  const mevcut = await prisma.siparis.findFirst({ where: { shopifyOrderId: order.id } })

  if (mevcut) {
    // Ürün kalemleri Shopify'da değişebilir (satır ekleme/düzenleme) — en güncel
    // haliyle eşleşsin diye eskiler silinip yeniden oluşturuluyor (aynı desen
    // publishShopifyProduct'taki varyant/resim senkronunda da kullanılıyor).
    await prisma.$transaction([
      prisma.siparisKalem.deleteMany({ where: { siparisId: mevcut.id } }),
      prisma.siparis.update({
        where: { id: mevcut.id },
        data: { ...ortakVeri, kalemler: { create: kalemVerisi } }
      })
    ])
    const stok = await shopifySiparisStoguHizala({
      siparisId: mevcut.id, siparisNo: mevcut.siparisNo, durum, satirlar,
      yeni: false, tercihMagazaId: stokMagazaId
    }).catch(err => {
      console.warn('[shopify-siparis-senkron] stok hizalanamadı:', mevcut.siparisNo, err.message)
      return null
    })
    return { yeni: false, id: mevcut.id, stok }
  }

  const siparisNo = `SH-${getShopifyNumericId(order.id)}`
  const yeniSiparis = await prisma.siparis.create({
    data: {
      ...ortakVeri,
      siparisNo,
      tarih: order.createdAt,
      kalemler: { create: kalemVerisi }
    }
  })
  const stok = await shopifySiparisStoguHizala({
    siparisId: yeniSiparis.id, siparisNo, durum, satirlar,
    yeni: true, tercihMagazaId: stokMagazaId
  }).catch(err => {
    console.warn('[shopify-siparis-senkron] stok düşülemedi:', siparisNo, err.message)
    return null
  })
  return { yeni: true, id: yeniSiparis.id, stok }
}

// Belirli bir zaman penceresindeki (veya tüm) Shopify siparişlerini sayfalayarak
// çeker ve her birini içe aktarır. `sinceMinutes` verilmezse TÜM siparişler taranır
// (ilk kurulum/manuel tam senkron için).
export async function syncShopifyOrders({ sinceMinutes = null } = {}) {
  let query = null
  if (sinceMinutes) {
    const since = new Date(Date.now() - sinceMinutes * 60000).toISOString()
    query = `updated_at:>='${since}'`
  }

  let after = null
  let hasNext = true
  let yeni = 0
  let guncellenen = 0
  let stokDusulen = 0
  let stokGeriVerilen = 0
  let eslesmeyenKalem = 0
  const hatalar = []

  while (hasNext) {
    const page = await fetchShopifyOrdersPage({ first: 50, after, query })
    for (const edge of page.edges) {
      try {
        const sonuc = await importShopifyOrder(edge.node)
        if (sonuc.yeni) yeni++
        else guncellenen++
        if (sonuc.stok) {
          stokDusulen += sonuc.stok.dusulen
          stokGeriVerilen += sonuc.stok.geriVerilen
          eslesmeyenKalem += sonuc.stok.eslesmeyen
        }
      } catch (err) {
        hatalar.push({ orderId: edge.node.id, hata: err.message })
        console.warn('[shopify-siparis-senkron] sipariş aktarılamadı:', edge.node.id, err.message)
      }
    }
    hasNext = page.pageInfo.hasNextPage
    after = page.pageInfo.endCursor
  }

  return { yeni, guncellenen, stokDusulen, stokGeriVerilen, eslesmeyenKalem, hatalar }
}

// ─── Vega → Shopify (durum değişikliğini geri yazma) ───

// Bir siparişin açık (henüz gönderilmemiş) "fulfillment order"larını Shopify'da
// karşılık gelen kargo bilgisiyle birlikte "gönderildi" olarak işaretler.
async function shopifyOrderFulfill(shopifyOrderId, { trackingNumber, trackingCompany } = {}) {
  const foQuery = `
    query GetFulfillmentOrders($id: ID!) {
      order(id: $id) {
        fulfillmentOrders(first: 5) { edges { node { id status } } }
      }
    }
  `
  const foResult = await shopifyFetch(foQuery, { id: shopifyOrderId })
  const acikFulfillmentOrders = (foResult.order?.fulfillmentOrders?.edges || [])
    .map(e => e.node)
    .filter(fo => fo.status === 'OPEN' || fo.status === 'IN_PROGRESS')
  if (acikFulfillmentOrders.length === 0) return null

  const mutation = `
    mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment { id status }
        userErrors { field message }
      }
    }
  `
  const result = await shopifyFetch(mutation, {
    fulfillment: {
      lineItemsByFulfillmentOrder: acikFulfillmentOrders.map(fo => ({ fulfillmentOrderId: fo.id })),
      ...(trackingNumber ? { trackingInfo: { number: trackingNumber, company: trackingCompany || undefined } } : {}),
      notifyCustomer: false
    }
  })
  const errors = result.fulfillmentCreate?.userErrors
  if (errors?.length) throw new Error(errors.map(e => e.message).join(' | '))
  return result.fulfillmentCreate.fulfillment
}

async function shopifyOrderCancel(shopifyOrderId) {
  const mutation = `
    mutation CancelOrder($orderId: ID!, $reason: OrderCancelReason!, $notifyCustomer: Boolean, $refund: Boolean, $restock: Boolean) {
      orderCancel(orderId: $orderId, reason: $reason, notifyCustomer: $notifyCustomer, refund: $refund, restock: $restock) {
        job { id done }
        userErrors { field message }
      }
    }
  `
  const result = await shopifyFetch(mutation, {
    orderId: shopifyOrderId, reason: 'OTHER', notifyCustomer: false, refund: false, restock: true
  })
  const errors = result.orderCancel?.userErrors
  if (errors?.length) throw new Error(errors.map(e => e.message).join(' | '))
  return result.orderCancel.job
}

// Siparişin tüm iade edilebilir kalemlerini + ödenen tutarın tamamını iade eder
// (kısmi iade Vega tarafında desteklenmiyor — panelde tek "İade Edildi" durumu var).
async function shopifyOrderRefundFull(shopifyOrderId) {
  const txQuery = `
    query GetOrderForRefund($id: ID!) {
      order(id: $id) {
        id
        transactions(first: 10) { id kind gateway amountSet { shopMoney { amount } } }
        lineItems(first: 100) { edges { node { id refundableQuantity } } }
      }
    }
  `
  const result = await shopifyFetch(txQuery, { id: shopifyOrderId })
  const order = result.order
  const refundableTx = (order?.transactions || []).find(t => t.kind === 'SALE' || t.kind === 'CAPTURE')
  if (!refundableTx) return null

  const refundLineItems = (order.lineItems?.edges || [])
    .map(e => e.node)
    .filter(li => li.refundableQuantity > 0)
    .map(li => ({ lineItemId: li.id, quantity: li.refundableQuantity, restockType: 'RETURN' }))

  const mutation = `
    mutation RefundOrder($input: RefundInput!) {
      refundCreate(input: $input) {
        refund { id }
        userErrors { field message }
      }
    }
  `
  const result2 = await shopifyFetch(mutation, {
    input: {
      orderId: shopifyOrderId,
      notify: false,
      ...(refundLineItems.length > 0 ? { refundLineItems } : {}),
      transactions: [{
        orderId: shopifyOrderId,
        gateway: refundableTx.gateway,
        kind: 'REFUND',
        amount: refundableTx.amountSet.shopMoney.amount,
        parentId: refundableTx.id
      }]
    }
  })
  const errors = result2.refundCreate?.userErrors
  if (errors?.length) throw new Error(errors.map(e => e.message).join(' | '))
  return result2.refundCreate.refund
}

// Panelde bir Shopify kökenli siparişin durumu değiştirildiğinde bunu Shopify'a
// geri yazar. Shopify tarafında zaten aynı durumdaysa (örn. zaten fulfilled)
// mutasyonlar no-op/hata dönebilir — hatalar burada yutulup loglanıyor ki panel
// içi durum güncellemesi Shopify'a bağımlı kalmasın.
export async function pushOrderStatusToShopify(shopifyOrderId, durum, { kargoNo, kargoFirma } = {}) {
  if (!shopifyOrderId) return
  try {
    if (durum === 'kargoda' || durum === 'teslim_edildi') {
      await shopifyOrderFulfill(shopifyOrderId, { trackingNumber: kargoNo, trackingCompany: kargoFirma })
    } else if (durum === 'iptal') {
      await shopifyOrderCancel(shopifyOrderId)
    } else if (durum === 'iade_edildi') {
      await shopifyOrderRefundFull(shopifyOrderId)
    }
  } catch (err) {
    console.warn('[shopify-siparis-durum] Shopify\'a geri yazılamadı:', shopifyOrderId, durum, err.message)
  }
}

export default async function shopifyRoutes(app) {

  // ─── Shopify Auth Akışı (Access Token Almak İçin) ───
  
  // 1. Yetkilendirme Başlat: https://panel.vegacantastore.com/api/shopify/auth?shop=magaza-adin.myshopify.com
  app.get('/shopify/auth', async (req, reply) => {
    const { shop } = req.query;
    const shopUrl = shop || 'vegacantastore.myshopify.com';
    const redirectUri = 'https://panel.vegacantastore.com/api/shopify/auth/callback';
    const scopes = 'read_products,write_products,read_inventory,write_inventory,read_orders';
    const clientId = process.env.SHOPIFY_API_KEY;

    if (!clientId) {
      return reply.status(500).send({ hata: 'SHOPIFY_API_KEY (Client ID) backend .env dosyasında eksik!' });
    }

    const authUrl = `https://${shopUrl}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}`;
    return reply.redirect(authUrl);
  });

app.get('/shopify/auth/callback', async (req, reply) => {
    const { shop, code } = req.query;
    
    console.log('=== CALLBACK GELDİ ===')
    console.log('shop:', shop)
    console.log('code:', code)
    console.log('API_KEY:', process.env.SHOPIFY_API_KEY)
    console.log('API_SECRET:', process.env.SHOPIFY_API_SECRET ? 'VAR' : 'YOK')
    
    if (!code) {
      return reply.status(400).send({ hata: 'Shopify code parametresi gelmedi.' });
    }

    const shopDomain = shop || 'vega-canta-store.myshopify.com';
    console.log('shopDomain:', shopDomain)

    try {
      const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code
        })
      });

      const text = await response.text();
      console.log('Shopify yanıtı:', text);
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return reply.status(500).send({ 
          hata: 'Shopify HTML döndürdü (JSON değil)', 
          shopify_yaniti: text.substring(0, 500)
        });
      }
      
      if (data.access_token) {
        return reply.send({
          basarili: true,
          magaza: shopDomain,
          access_token: data.access_token,
          talimat: "Token'ı kopyalayın ve .env dosyanıza SHOPIFY_ACCESS_TOKEN olarak ekleyin."
        });
      } else {
        return reply.status(400).send({ hata: 'Access token alınamadı', detay: data });
      }
    } catch (error) {
      return reply.status(500).send({ hata: 'Token alma hatası', mesaj: error.message });
    }
  });



  // ─── Kurulum durumu (token göstermez) ───


  app.get('/shopify/durum', async () => {
    const config = getShopifyConfig()
    const check = validateShopifyConfig(config)
    return {
      success: check.ok,
      bagli: check.ok,
      magaza: check.storeHost,
      tokenOnEk: check.tokenPrefix,
      hatalar: check.errors,
      ipuclari: check.hints,
      ornekMagazaUrl: 'https://vega-canta-store.myshopify.com',
      panelUrl: 'https://panel.vegacantastore.com'
    }
  })

  // ─── Shopify ürünleri listele ───
  app.get('/shopify/urunler', async (req, reply) => {
    try {
      const { first = 50, after = null, status = 'active' } = req.query

      // Frontend'deki Aktif/Taslak/Tümü filtresi buraya kadar geliyordu ama hiç
      // kullanılmıyordu — bu yüzden taslak (draft) ürünler de listeye karışıyordu.
      // Shopify'ın arama sözdizimiyle status filtresi uyguluyoruz.
      const statusQuery = status && status !== 'all' ? `status:${status}` : ''

      const query = `
        query GetProducts($first: Int!, $after: String, $query: String) {
          products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
            edges {
              node {
                id
                title
                handle
                vendor
                productType
                createdAt
                updatedAt
                status
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        price
                        sku
                        barcode
                        inventoryQuantity
                      }
                    }
                  }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `

      const result = await shopifyFetch(query, {
        first: parseInt(first),
        after: after || null,
        query: statusQuery || null
      })

      const products = result.products.edges.map(edge => ({
        ...edge.node,
        shopifyId: edge.node.id,
        cursor: edge.cursor,
        price: edge.node.variants.edges[0]?.node.price || 0,
        sku: edge.node.variants.edges[0]?.node.sku || null,
        barcode: edge.node.variants.edges[0]?.node.barcode || null,
        inventoryQuantity: edge.node.variants.edges[0]?.node.inventoryQuantity ?? 0
      }))

      return {
        success: true,
        products: {
          edges: products.map((p, i) => ({ node: p, cursor: req.query.after ? `cursor-${i}` : p.id })),
          pageInfo: result.products.pageInfo
        }
      }
    } catch (error) {
      console.error('Shopify ürünleri hatası:', error)
      return reply.status(500).send({ 
        hata: error.message || 'Shopify ürünleri alınamadı'
      })
    }
  })

  // ─── Shopify ürün detayını getir ───
  app.get('/shopify/urun/*', async (req, reply) => {
    try {
      const rawId = req.params['*'] || ''
      const id = decodeURIComponent(rawId)

      const query = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            title
            handle
            vendor
            productType
            description
            createdAt
            totalInventory
            images(first: 10) {
              edges {
                node {
                  url
                }
              }
            }
            options {
              id
              name
              values
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                  barcode
                  inventoryQuantity
                  inventoryItem {
                    tracked
                  }
                }
              }
            }
            metafields(first: 50) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                  description
                }
              }
            }
          }
        }
      `

      const result = await shopifyFetch(query, { id })
      return result.product
    } catch (error) {
      return reply.status(500).send({ hata: error.message })
    }
  })

  // ─── Shopify ürünü veritabanına aktar ───
  app.post('/shopify/aktar', async (req, reply) => {
    try {
      const { shopifyId, magazaId, stok } = req.body

      if (!shopifyId) {
        return reply.status(400).send({ hata: 'shopifyId gerekli' })
      }
      if (!magazaId) {
        return reply.status(400).send({ hata: 'Mağaza seçimi gerekli' })
      }

      // Liste ekranındaki özet veriyle (sadece başlık/fiyat/sku/barkod) yetinmek yerine,
      // açıklama/resimler/video dahil ürünün TAM halini burada, sunucu tarafında,
      // doğrudan Shopify'dan çekiyoruz — tek doğru kaynak Shopify'ın kendisi.
      // Renk adı metafield'inin namespace/key'i mağazadan okunuyor (10 dk önbellekli) ve
      // ürün sorgusuna geçiriliyor.
      const renkAdiTanim = await getRenkAdiMetafieldTanimi().catch(() => null)
      const renkAdiHedef = renkAdiTanim || RENK_ADI_VARSAYILAN
      const shopifyUrun = await getShopifyProductForImport(shopifyId, renkAdiHedef)
      if (!shopifyUrun) {
        return reply.status(404).send({ hata: 'Shopify ürünü bulunamadı' })
      }

      const { title, handle, vendor, productType, descriptionHtml } = shopifyUrun
      if (!title || !handle) {
        return reply.status(400).send({ hata: 'Ürün adı ve kodu gerekli' })
      }

      const tumVaryantlar = (shopifyUrun.variants?.edges || []).map(e => e.node)
      const ilkVaryant = tumVaryantlar[0] || {}
      const price = ilkVaryant.price
      const sku = ilkVaryant.sku
      const barcode = ilkVaryant.barcode
      const shopifyStok = ilkVaryant.inventoryQuantity

      // Birden fazla varyant VE en az birinde "beden/numara" seçeneği varsa (ayakkabı gibi
      // numara bazlı ürünler), tek satırlık "mağaza bazlı tekil stok" yerine mağaza+numara
      // bazlı ayrı satırlar oluşturuyoruz — her numaranın kendi stoğu ve barkodu olur.
      const numaraliVaryantlar = tumVaryantlar
        .map(v => ({ ...v, beden: shopifyVaryantBedeni(v) }))
        .filter(v => v.beden)
      const numaraBazliMi = tumVaryantlar.length > 1 && numaraliVaryantlar.length > 0

      // Mağaza bazlı tekil stok modelinde ürünün TEK barkodu var — bu değer hem Urun.barkod
      // hem de aşağıda oluşturulacak Varyant.barkod alanına yazılır. Eskiden Shopify'da
      // barkod boşsa Urun.barkod null kalıyor, ama Varyant.barkod için ayrı bir otomatik
      // barkod üretiliyordu (bkz. otomatikBarkodUret altında) — bu ikisi birbirinden
      // koptuğu için Stok Yönetimi'ndeki "Barkod" alanı (Urun.barkod'dan okunuyor, boşsa
      // formda RASTGELE yeni bir barkod öneriliyor) ile gerçekte kullanılan/taranan barkod
      // (Varyant.barkod, Satış Kasa'nın barkod aramasında önce kontrol ettiği alan) farklı
      // görünüyordu. Aynı deterministik değeri baştan hesaplayıp ikisine de yazarak bu
      // ayrışmayı önlüyoruz.
      const tekBarkod = numaraBazliMi ? (barcode || null) : (barcode || otomatikBarkodUret(title, vendor, '', ''))

      // Shopify tarafında geçmişte oluşmuş çoklamalar yerel DB'ye taşınmasın — aksi halde
      // ürünü tekrar yayınlarken bu kopyalar "yerel liste" sayılıp yeniden yükleniyordu.
      const resimler = []
      const resimAnahtarlari = new Set()
      for (const url of (shopifyUrun.images?.edges || []).map(e => e.node.url).filter(Boolean)) {
        const key = imageUrlKey(url)
        if (!key || resimAnahtarlari.has(key)) continue
        resimAnahtarlari.add(key)
        resimler.push(url)
      }

      const videoMetafield = (shopifyUrun.metafields?.edges || [])
        .map(e => e.node)
        .find(m => m.namespace === 'custom' && m.key === 'video')
      const video = videoMetafield
        ? (videoMetafield.type === 'file_reference'
            ? await resolveVideoFileUrl(videoMetafield.value).catch(() => null)
            : videoMetafield.value)
        : null

      // Marka artık Shopify'ın "Satıcı" alanına YAZILMIYOR (bkz. buildShopifyProductInput),
      // dolayısıyla vendor çoğu üründe mağaza adını ("Vega Çanta Store") tutuyor. Markanın
      // doğru kaynağı bizim yazdığımız vega.marka metafield'i; vendor yalnızca eski
      // kayıtlar için yedek.
      const shopifyMarka = (shopifyUrun.metafields?.edges || [])
        .map(e => e.node)
        .find(m => m.namespace === 'vega' && m.key === 'marka')?.value?.trim() || null

      // Renk adı metafield'i panele geri okunuyor: ürün Shopify'dan içeri aktarılırken
      // (ya da yeniden aktarılırken) paneldeki "Renk Adı" alanı boş kalmasın.
      const shopifyRenkAdi = renkAdiMetafieldDegeriniCoz(
        shopifyUrun.renkAdiMetafield?.value ||
        (shopifyUrun.metafields?.edges || [])
          .map(e => e.node)
          .find(m => m.namespace === renkAdiHedef.namespace && m.key === renkAdiHedef.key)?.value
      )

      const aciklama = descriptionHtml || `Shopify Handle: ${handle}`

      // Son kod numarasını al
      const sonUrun = await prisma.urun.findFirst({
        where: { kod: { startsWith: 'S-' } },
        orderBy: { kod: 'desc' },
        take: 1
      })

      let yeniNo = 1
      if (sonUrun) {
        const no = parseInt(sonUrun.kod.split('-')[1]) || 0
        yeniNo = no + 1
      }

      const kod = `S-${String(yeniNo).padStart(5, '0')}`

      // "shopifyId" alanı Prisma şemasında @unique DEĞİL (sadece id/kod/barkod unique) —
      // bu yüzden prisma.urun.upsert({ where: { shopifyId } }) her zaman geçersizdi ve
      // hata veriyordu. Şemaya dokunmadan (canlı DB'de migration riski almadan) elle
      // bul/oluştur-güncelle yapıyoruz.
      const mevcutUrun = await prisma.urun.findFirst({ where: { shopifyId } })

      let urun
      if (mevcutUrun) {
        urun = await prisma.urun.update({
          where: { id: mevcutUrun.id },
          data: {
            ad: title,
            // Kullanıcı ürün formunda markayı elle değiştirmiş/seçmiş olabilir — Shopify'ın
            // "Vendor" alanı boş bırakıldığında Shopify otomatik olarak mağaza adını
            // ("Vega Çanta Store" gibi) kullanır. Bunu koşulsuz üzerine yazmak, kullanıcının
            // seçtiği markayı her yeniden aktarımda/senkronda sessizce siliyordu. Mevcut bir
            // marka varsa onu koru, yoksa Shopify'dakini kullan.
            marka: mevcutUrun.marka || shopifyMarka || vendor || null,
            kategori: numaraBazliMi ? 'Ayakkabı' : productType,
            satisF: parseFloat(price) || 0,
            sku: sku || null,
            barkod: tekBarkod,
            aciklama,
            resimler,
            // Shopify'da değer yoksa paneldeki mevcut renk adını EZME (marka alanındaki
            // ile aynı gerekçe: kullanıcının elle girdiği değer kaybolmasın).
            renkAdi: shopifyRenkAdi || mevcutUrun.renkAdi || null,
            ...(video && { video }),
            guncellendi: new Date(),
            // Ürün daha önce aktarılıp Stok Yönetimi'nden silinmişse (silme "soft delete" —
            // aktif:false yapıyor, bkz. urunler.js DELETE /urunler/:id) burası aktif:true
            // set etmediği için tekrar aktarınca backend "başarıyla aktarıldı" dese de kayıt
            // aktif:false kalmaya devam ediyordu — GET /urunler aktif:true filtrelediği için
            // Stok Yönetimi listesinde hiç görünmüyordu. Yeniden aktarım her zaman diriltmeli.
            aktif: true
          }
        })
      } else {
        // barkod alanı da unique — aynı barkodla zaten kayıtlı bir ürün varsa (örn. daha
        // önce Ticimax'tan aktarılmışsa) yeni satır oluşturmaya çalışmak P2002 hatası verir.
        // Böyle bir durumda yeni satır açmak yerine mevcut kaydı güncelleyip shopifyId'yi bağlıyoruz.
        const barkodCakisan = barcode ? await prisma.urun.findFirst({ where: { barkod: barcode } }) : null
        urun = barkodCakisan
          ? await prisma.urun.update({
              where: { id: barkodCakisan.id },
              data: {
                ad: title,
                // Aynı gerekçe: mevcut yerel markayı Shopify'ın varsayılan vendor'üyle ezme.
                marka: barkodCakisan.marka || shopifyMarka || vendor || null,
                kategori: numaraBazliMi ? 'Ayakkabı' : productType,
                satisF: parseFloat(price) || 0,
                shopifyId,
                sku: sku || null,
                aciklama,
                resimler,
                renkAdi: shopifyRenkAdi || barkodCakisan.renkAdi || null,
                ...(video && { video }),
                guncellendi: new Date(),
                aktif: true
              }
            })
          : await prisma.urun.create({
              data: {
                kod,
                barkod: tekBarkod,
                shopifyId,
                ad: title,
                marka: shopifyMarka || vendor,
                kategori: numaraBazliMi ? 'Ayakkabı' : productType,
                satisF: parseFloat(price) || 0,
                alisF: 0,
                sku: sku || null,
                aciklama,
                resimler,
                kritikStok: 0,
                renkAdi: shopifyRenkAdi || null,
                ...(video && { video })
              }
            })
      }

      if (numaraBazliMi) {
        // Ayakkabı: aynı numara birden fazla Shopify varyantında (örn. farklı renk
        // kombinasyonlarında) tekrar edebilir — bunları numaraya göre toplayıp TEK
        // satıra indiriyoruz (yoksa unique([urunId,magazaId,renk,beden]) çakışması olur).
        const numaraMap = new Map()
        for (const v of numaraliVaryantlar) {
          const mevcut = numaraMap.get(v.beden)
          const adet = Math.max(0, parseInt(v.inventoryQuantity, 10) || 0)
          if (mevcut) {
            mevcut.adet += adet
            if (!mevcut.barkod && v.barcode?.trim()) mevcut.barkod = v.barcode.trim()
          } else {
            numaraMap.set(v.beden, { beden: v.beden, adet, barkod: v.barcode?.trim() || null })
          }
        }

        // Seçilen mağaza için bu ürüne ait TÜM eski satırları sil ve Shopify'daki
        // güncel numara listesinden yeniden oluştur. Bir önceki aktarımda ürün henüz
        // numara bazlı algılanmamışsa (tek "Standart" satırı) ya da Shopify'da artık
        // olmayan bir numara kalmışsa, o eski satır silinmeden yeni numara satırlarının
        // yanında durup toplam stoğu (ör. ~2 katına) şişiriyordu — bu yüzden önce temizleniyor.
        await prisma.varyant.deleteMany({ where: { urunId: urun.id, magazaId } })
        for (const v of numaraMap.values()) {
          // Shopify'da o numara için barkod girilmemişse otomatik (deterministik) üret —
          // boş bırakılan barkod, etiket basımında/taramada numarayı ayırt edilemez yapıyordu.
          const numaraBarkod = v.barkod || otomatikBarkodUret(title, vendor, '', v.beden)
          await prisma.varyant.create({
            data: { urunId: urun.id, magazaId, renk: 'Standart', beden: v.beden, adet: v.adet, barkod: numaraBarkod }
          })
        }
      } else {
        // Mağaza bazlı tekil stok: seçilen mağaza için bu ürüne ait tüm eski satırları
        // temizleyip tek satır olarak yeniden oluştur (aynı doubling riski — ürün daha
        // önce numara bazlı aktarılmışsa kalan eski numara satırları toplamı şişirirdi).
        const adet = Math.max(0, parseInt(stok, 10) || parseInt(shopifyStok, 10) || 0)
        await prisma.varyant.deleteMany({ where: { urunId: urun.id, magazaId } })
        await prisma.varyant.create({
          data: { urunId: urun.id, magazaId, renk: 'Standart', beden: null, adet, barkod: tekBarkod }
        })
      }

      return { success: true, urun, mesaj: 'Ürün başarıyla aktarıldı' }
    } catch (error) {
      console.error('Shopify aktar hatası:', error)
      return reply.status(500).send({ hata: error.message })
    }
  })

  // ─── İçe aktarılmış Shopify ürünlerini getir ───
  app.get('/shopify/aktarilan', async (req) => {
    try {
      // "kod 'S-' ile başlıyor mu" eskiden "Shopify'dan mı geldi" için kullanılıyordu, ama
      // bir ürün barkod/shopifyId eşleşmesiyle YEREL bir kayıtla birleştiğinde (örn. daha
      // önce Ticimax'tan "V-xxxxx" koduyla aktarılmışsa) kod değişmiyor ve ürün bu listede
      // hiç görünmüyordu. Doğru koşul: shopifyId dolu olan her ürün.
      const urunler = await prisma.urun.findMany({
        where: {
          shopifyId: { not: null }
        },
        include: {
          varyantlar: true
        },
        orderBy: { guncellendi: 'desc' }
      })
      return { success: true, urunler }
    } catch (error) {
      console.error('Aktarılan ürünler hatası:', error)
      return { success: false, hata: error.message }
    }
  })

  // ─── Shopify ürün detaylarını güncelle ───
  app.put('/shopify/guncelle/:id', async (req, reply) => {
    try {
      const { id } = req.params
      const { ad, satisF, alisF, kdv, marka, kategori, aciklama, shopifyHandle } = req.body

      // Shopify'da da güncelle (opsiyonel)
      if (shopifyHandle && satisF) {
        const updateQuery = `
          mutation UpdateProduct($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                handle
              }
              userErrors {
                field
                message
              }
            }
          }
        `

        const urunKayit = await prisma.urun.findUnique({ where: { id } })
        const urunShopifyId = urunKayit?.shopifyId || urunKayit?.barkod

        if (urunShopifyId && urunShopifyId.startsWith('gid://')) {
          await shopifyFetch(updateQuery, {
            input: {
              id: urunShopifyId,
              // Shopify'da fiyat varyantlarında tutulur, buradan doğrudan değiştirilemez
            }
          })
        }
      }

      // Yerel veritabanında güncelle
      const urun = await prisma.urun.update({
        where: { id },
        data: {
          ...(ad && { ad }),
          ...(satisF !== undefined && { satisF: parseFloat(satisF) }),
          ...(alisF !== undefined && { alisF: parseFloat(alisF) }),
          ...(kdv !== undefined && { kdv: parseInt(kdv) }),
          ...(marka && { marka }),
          ...(kategori && { kategori }),
          ...(aciklama && { aciklama }),
          guncellendi: new Date()
        },
        include: { varyantlar: true }
      })

      return { success: true, urun, mesaj: 'Ürün güncellendi' }
    } catch (error) {
      console.error('Ürün güncelleme hatası:', error)
      return reply.status(500).send({ hata: error.message })
    }
  })

  app.post('/shopify/senkronize', async (req, reply) => {
    try {
      const query = `
        query {
          products(first: 250) {
            edges {
              node {
                id
                title
                handle
                vendor
                productType
                createdAt
                variants(first: 1) {
                  edges {
                    node {
                      price
                      sku
                      barcode
                    }
                  }
                }
              }
            }
          }
        }
      `

      const result = await shopifyFetch(query)
      const products = result.products.edges.map(e => e.node)

      let aktarilan = 0
      for (const p of products) {
          const existing = await prisma.urun.findFirst({
            where: { shopifyId: p.id }
          })

        if (!existing) {
          // Otomatik olarak aktarılan ürünü kodla
          const sonUrun = await prisma.urun.findFirst({
            where: { kod: { startsWith: 'S-' } },
            orderBy: { kod: 'desc' },
            take: 1
          })
          
          let yeniNo = 1
          if (sonUrun) {
            const no = parseInt(sonUrun.kod.split('-')[1]) || 0
            yeniNo = no + 1
          }

          const kod = `S-${String(yeniNo).padStart(5, '0')}`

          await prisma.urun.create({
            data: {
              kod,
              shopifyId: p.id,
              sku: p.variants.edges[0]?.node.sku || null,
              barkod: p.variants.edges[0]?.node.barcode || null,
              ad: p.title,
              marka: p.vendor,
              kategori: p.productType,
              satisF: parseFloat(p.variants.edges[0]?.node.price) || 0,
              alisF: 0,
              kritikStok: 0
            }
          })

          aktarilan++
        }
      }

      return { 
        success: true, 
        mesaj: `${aktarilan} yeni ürün senkronize edildi`,
        toplam: products.length
      }
    } catch (error) {
      console.error('Senkronizasyon hatası:', error)
      return reply.status(500).send({ hata: error.message })
    }
  })

  // Online Sipariş Paneli'ndeki "Shopify'dan Çek" butonu — belirtilen gün kadar
  // geriye dönük siparişleri çekip Siparis tablosuna aktarır/günceller. Ayrıca her
  // 10 dakikada bir arka planda otomatik çalışır (bkz. jobs/shopifyOrderSync.js).
  app.post('/shopify/siparisler/senkronize', async (req, reply) => {
    try {
      const { gun } = req.body || {}
      const sinceMinutes = gun ? Number(gun) * 24 * 60 : null
      const sonuc = await syncShopifyOrders({ sinceMinutes })
      return { success: true, ...sonuc }
    } catch (error) {
      console.error('Shopify sipariş senkron hatası:', error)
      return reply.status(500).send({ hata: error.message || 'Shopify siparişleri senkronize edilemedi' })
    }
  })

  // Teşhis ucu: paneldeki "Renk Adı" alanının Shopify'da HANGİ metafield'e yazıldığını
  // gösterir. `bulundu:false` dönüyorsa mağazada o adda bir tanım yok ve varsayılan
  // anahtar kullanılıyor demektir (tanımı açın ya da .env'de SHOPIFY_RENK_ADI_METAFIELD
  // ile anahtarı sabitleyin).
  app.get('/shopify/renk-adi-metafield', async (req, reply) => {
    try {
      const tanimlar = await listProductMetafieldDefinitions()
      const tanim = await getRenkAdiMetafieldTanimi()
      const bulundu = tanimlar.some(d => d.namespace === tanim.namespace && d.key === tanim.key)
      return {
        success: true,
        bulundu,
        namespace: tanim.namespace,
        key: tanim.key,
        tip: tanim.type,
        envAyari: process.env.SHOPIFY_RENK_ADI_METAFIELD || null
      }
    } catch (error) {
      console.error('Renk adı metafield tanımı okunamadı:', error)
      return reply.status(500).send({ hata: error.message || 'Metafield tanımı okunamadı' })
    }
  })

  // Paneldeki TÜM renk adlarını tek seferde Shopify'a gönderir (geri doldurma).
  // Ürünleri baştan yayınlamaz — yalnızca renk adı metafield'ini yazar, bu yüzden
  // fiyat/stok/varyant tarafına hiç dokunmaz ve çok daha hızlıdır.
  // VARSAYILAN KURU ÇALIŞMADIR: `{ "kuru": false }` gönderilene kadar sadece raporlar.
  app.post('/shopify/renk-adlarini-gonder', async (req, reply) => {
    try {
      const { kuru = true } = req.body || {}

      const tanim = await getRenkAdiMetafieldTanimi()
      if (!RENK_ADI_METIN_TIPLERI.includes(tanim.type)) {
        return reply.status(400).send({
          hata: `Renk adı metafield tipi metin değil (${tanim.type}) — toplu gönderim yapılamaz.`
        })
      }

      const urunler = await prisma.urun.findMany({
        where: { aktif: true, shopifyId: { not: null }, renkAdi: { not: null } },
        select: { id: true, kod: true, ad: true, renkAdi: true, shopifyId: true },
        orderBy: { kod: 'asc' }
      })

      const sonuc = {
        kuru: !!kuru,
        namespace: tanim.namespace,
        key: tanim.key,
        tip: tanim.type,
        aday: 0,
        gonderilen: 0,
        atlanan: [],
        hatalar: []
      }

      const girdiler = []
      for (const urun of urunler) {
        const metin = String(urun.renkAdi || '').trim()
        if (!metin) continue
        const gid = urunGidOlustur(urun.shopifyId)
        if (!gid) {
          // Shopify kimliği tanınmıyorsa (eski/bozuk kayıt) atla — yanlış ürüne yazmaktansa
          // raporda göstermek doğru.
          sonuc.atlanan.push({ kod: urun.kod, ad: urun.ad, sebep: 'Shopify ID okunamadı' })
          continue
        }
        const girdi = renkAdiMetafieldGirdisi(metin, tanim)
        if (!girdi) continue
        girdiler.push({ urun, metafield: { ownerId: gid, ...girdi } })
      }

      sonuc.aday = girdiler.length
      if (kuru || girdiler.length === 0) return { success: true, ...sonuc }

      // metafieldsSet tek çağrıda en fazla 25 metafield alıyor.
      const mutation = `
        mutation RenkAdlariniYaz($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { id }
            userErrors { field message elementIndex }
          }
        }
      `

      for (let i = 0; i < girdiler.length; i += 25) {
        const parca = girdiler.slice(i, i + 25)
        try {
          const cevap = await shopifyFetch(mutation, { metafields: parca.map(g => g.metafield) })
          const userErrors = cevap.metafieldsSet?.userErrors || []
          const hataliIndexler = new Set()
          for (const hata of userErrors) {
            const index = Number.isInteger(hata.elementIndex) ? hata.elementIndex : null
            if (index !== null) hataliIndexler.add(index)
            const urun = index !== null ? parca[index]?.urun : null
            sonuc.hatalar.push({ kod: urun?.kod || null, ad: urun?.ad || null, hata: hata.message })
          }
          sonuc.gonderilen += parca.length - hataliIndexler.size
        } catch (err) {
          // Parçanın tamamı gitmedi — hangi ürünler olduğu raporda görünsün.
          for (const g of parca) {
            sonuc.hatalar.push({ kod: g.urun.kod, ad: g.urun.ad, hata: err.message })
          }
        }
        // Shopify GraphQL maliyet limitine takılmamak için parçalar arası kısa bekleme.
        if (i + 25 < girdiler.length) await new Promise(r => setTimeout(r, 300))
      }

      return { success: true, ...sonuc }
    } catch (error) {
      console.error('Renk adı toplu gönderim hatası:', error)
      return reply.status(500).send({ hata: error.message || 'Renk adları gönderilemedi' })
    }
  })

  // Ürünü yayınlamadan önce kullanıcının seçebileceği koleksiyon listesi
  // (Marka Ürünleri ekranındaki koleksiyon seçim modalı bunu çeker).
  app.get('/shopify/koleksiyonlar', async (req, reply) => {
    try {
      const koleksiyonlar = await listShopifyCustomCollections()
      // Mağazada aynı adlı kopya koleksiyonlar varsa modalda tek satır görünsün — aksi
      // halde kullanıcı "Çanta"nın hangi kopyasını seçeceğini bilemiyor. En eski (en küçük
      // id'li) kayıt asıl kabul ediliyor; gerçek kopyalar /shopify/koleksiyon-temizle ile
      // raporlanıp birleştiriliyor.
      const benzersiz = new Map()
      for (const k of [...koleksiyonlar].sort((a, b) => Number(a.id) - Number(b.id))) {
        const key = collectionTitleKey(k.title)
        if (!key || benzersiz.has(key)) continue
        benzersiz.set(key, { id: k.id, title: k.title })
      }
      return [...benzersiz.values()]
    } catch (error) {
      console.error('Koleksiyonlar alınamadı:', error)
      return reply.status(500).send({ hata: error.message || 'Koleksiyonlar alınamadı' })
    }
  })

  // Aynı adlı kopya koleksiyonları raporlar; `{ "kuru": false }` gönderilirse kopyaların
  // ürünlerini en eski koleksiyona taşıyıp kopyaları SİLER.
  // VARSAYILAN KURU ÇALIŞMADIR — koleksiyon silmek geri alınamaz, önce raporu görün.
  // Kurallı (smart) koleksiyonlara dokunulmaz, yalnızca raporda gösterilir.
  app.post('/shopify/koleksiyon-temizle', async (req, reply) => {
    try {
      const { kuru = true } = req.body || {}
      const hepsi = await getShopifyCollectionsCached(true)

      const gruplar = new Map()
      for (const k of hepsi) {
        const key = collectionTitleKey(k.title)
        if (!key) continue
        if (!gruplar.has(key)) gruplar.set(key, [])
        gruplar.get(key).push(k)
      }

      const sonuc = { kuru: !!kuru, toplamKoleksiyon: hepsi.length, kopyaGrubu: 0, silinen: 0, tasinanUrun: 0, atlanan: [], detay: [] }

      for (const [, grup] of gruplar) {
        if (grup.length < 2) continue
        sonuc.kopyaGrubu += 1
        // En eski (en küçük id) asıl kabul ediliyor.
        const sirali = [...grup].sort((a, b) => Number(a.id) - Number(b.id))
        const asil = sirali[0]
        const kopyalar = sirali.slice(1)

        const smartVar = grup.some(k => k._tur === 'smart_collections')
        if (smartVar) {
          // Kurallı koleksiyon karışmışsa otomatik birleştirme yapmıyoruz — üyelik
          // kurallardan geliyor, elle karar verilmeli.
          sonuc.atlanan.push({ baslik: asil.title, sebep: 'kurallı (smart) koleksiyon içeriyor', adet: grup.length })
          continue
        }

        const detay = { baslik: asil.title, korunanId: asil.id, silinecek: kopyalar.map(k => k.id), tasinanUrun: 0 }

        for (const kopya of kopyalar) {
          const collects = await listCollectsForCollection(kopya.id).catch(() => [])
          if (!kuru) {
            for (const c of collects) {
              const eklendi = await addProductToCollection(c.product_id, asil.id).catch(() => null)
              if (eklendi) detay.tasinanUrun += 1
            }
            await shopifyRestFetch(`custom_collections/${kopya.id}.json`, 'DELETE').catch(err => {
              console.warn('Kopya koleksiyon silinemedi:', kopya.id, err.message)
            })
          } else {
            detay.tasinanUrun += collects.length
          }
          sonuc.silinen += 1
          await new Promise(res => setTimeout(res, 300))
        }

        sonuc.tasinanUrun += detay.tasinanUrun
        sonuc.detay.push(detay)
      }

      // Silinen kopyalar önbellekte kalmasın; "bu süreçte açıldı" haritası da temizleniyor,
      // aksi halde silinmiş bir kopyanın id'si sonraki yayınlarda kullanılmaya devam ederdi.
      if (!kuru) {
        koleksiyonCache = { zaman: 0, liste: null }
        olusturulanKoleksiyonlar.clear()
      }

      return { success: true, ...sonuc }
    } catch (error) {
      console.error('Koleksiyon temizleme hatası:', error)
      return reply.status(500).send({ hata: error.message || 'Koleksiyonlar temizlenemedi' })
    }
  })

  // Geçmişte oluşmuş fotoğraf çoklamalarını TEK SEFERDE temizler: Shopify'a gönderilmiş
  // (shopifyId dolu) tüm aktif ürünlerde aynı fotoğrafın fazla kopyalarını siler.
  // `{ "kuru": true }` gönderilirse hiçbir şey silinmez, sadece ne silineceği raporlanır.
  app.post('/shopify/resim-temizle', async (req, reply) => {
    try {
      const { kuru = false, urunId = null } = req.body || {}
      const urunler = await prisma.urun.findMany({
        where: { aktif: true, shopifyId: { not: null }, ...(urunId ? { id: urunId } : {}) },
        select: { id: true, kod: true, ad: true, shopifyId: true, resimler: true }
      })

      const sonuc = { toplam: urunler.length, islenen: 0, silinen: 0, atlanan: 0, detay: [] }

      for (const urun of urunler) {
        const shopifyProductId = getShopifyNumericId(urun.shopifyId)
        if (!shopifyProductId) {
          sonuc.atlanan += 1
          continue
        }
        // Burada YALNIZCA temizlik yapılıyor: eksik resim yükleme yok (desired boş),
        // böylece toplu çalıştırma yanlışlıkla yeni resim basmıyor.
        const r = await reconcileShopifyProductImages(shopifyProductId, [], { dryRun: !!kuru })
          .catch(err => {
            console.warn(`[resim-temizle] ${urun.kod} atlandı:`, err.message)
            return null
          })
        if (!r || r.atlandi) {
          sonuc.atlanan += 1
        } else {
          sonuc.islenen += 1
          sonuc.silinen += r.silinen
          if (r.silinen > 0) {
            sonuc.detay.push({ kod: urun.kod, ad: urun.ad, silinen: r.silinen, kalan: r.mevcut })
          }
        }
        // Shopify Admin API rate limitine takılmamak için ürünler arası kısa bekleme.
        await new Promise(res => setTimeout(res, 300))
      }

      return { success: true, kuru: !!kuru, ...sonuc }
    } catch (error) {
      console.error('Shopify resim temizleme hatası:', error)
      return reply.status(500).send({ hata: error.message || 'Resimler temizlenemedi' })
    }
  })

  // Shopify Dosyalar'daki MÜKERRER video kopyalarını raporlar; `{ "kuru": false }`
  // gönderilirse fazlalıkları siler (her gruptan en eski dosya KORUNUR).
  // VARSAYILAN KURU ÇALIŞMADIR — dosya silmek geri alınamaz, önce raporu görün.
  //
  // "Mükerrer" ölçütü: aynı süre + aynı dosya boyutu. Ad kullanılmıyor, çünkü Shopify
  // aynı adlı ikinci dosyaya kendiliğinden sonek ekliyor; süre+boyut ise aynı videonun
  // farklı kopyalarında birebir aynı kalıyor. Hâlâ bir ürün tarafından kullanılan dosyalar
  // (custom.video metafield'i) KORUNANLAR arasına alınıyor, asla silinmiyor.
  app.post('/shopify/video-temizle', async (req, reply) => {
    try {
      const { kuru = true } = req.body || {}
      const dosyalar = await listAllShopifyVideoFiles()

      // Bir üründe kullanımda olan video GID'leri — bunlar hiçbir koşulda silinmez.
      const kullanimda = new Set()
      const urunler = await prisma.urun.findMany({
        where: { aktif: true, shopifyId: { not: null } },
        select: { shopifyId: true }
      })
      // Bu taramada TEK bir ürün bile okunamazsa silme yapılmıyor: kullanımdaki bir
      // videoyu "sahipsiz" sanıp silmek, ürün sayfasındaki videoyu yok eder.
      let okunamayanUrun = 0
      for (const u of urunler) {
        const prod = await getShopifyProductById(u.shopifyId).catch(() => null)
        if (!prod) { okunamayanUrun += 1; continue }
        const gid = prod?.videoRef?.value
        if (gid) kullanimda.add(gid)
        // Shopify GraphQL maliyet limitine takılmamak için ürünler arası kısa bekleme.
        await new Promise(res => setTimeout(res, 120))
      }

      const gruplar = new Map()
      for (const f of dosyalar) {
        const sure = f.duration == null ? '?' : Math.round(Number(f.duration))
        const boyut = f.originalSource?.fileSize == null ? '?' : String(f.originalSource.fileSize)
        // Süre ya da boyut okunamayan dosyalar gruplanmıyor — yanlış eşleştirip
        // birbirinden farklı videoları silmek kabul edilemez.
        if (sure === '?' || boyut === '?') continue
        const key = `${sure}|${boyut}`
        if (!gruplar.has(key)) gruplar.set(key, [])
        gruplar.get(key).push(f)
      }

      const sonuc = { kuru: !!kuru, toplamVideo: dosyalar.length, kopyaGrubu: 0, silinen: 0, okunamayanUrun, detay: [] }
      const silinecekGidler = []

      for (const [, grup] of gruplar) {
        if (grup.length < 2) continue
        sonuc.kopyaGrubu += 1
        // Korunacak dosya: bir ürün tarafından kullanılan varsa O, yoksa en eski.
        const sirali = [...grup].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        const korunan = sirali.find(f => kullanimda.has(f.id)) || sirali[0]
        const fazlalar = sirali.filter(f => f.id !== korunan.id && !kullanimda.has(f.id))
        if (fazlalar.length === 0) continue
        silinecekGidler.push(...fazlalar.map(f => f.id))
        sonuc.detay.push({
          korunanDosya: korunan.filename || korunan.id,
          korunanKullanimda: kullanimda.has(korunan.id),
          silinecekAdet: fazlalar.length,
          silinecek: fazlalar.map(f => f.filename || f.id)
        })
      }

      sonuc.silinen = silinecekGidler.length

      if (!kuru && okunamayanUrun > 0) {
        return reply.status(409).send({
          hata: `${okunamayanUrun} ürün Shopify'dan okunamadı — hangi videoların kullanımda olduğu kesin bilinemiyor, güvenlik için silme yapılmadı. Tekrar deneyin.`,
          ...sonuc
        })
      }

      if (!kuru && silinecekGidler.length > 0) {
        // fileDelete tek çağrıda çok dosya alıyor ama rate limit için parçalıyoruz.
        let silindi = 0
        for (let i = 0; i < silinecekGidler.length; i += 20) {
          const dilim = silinecekGidler.slice(i, i + 20)
          silindi += await deleteShopifyFiles(dilim).catch(err => {
            console.warn('Video dosyaları silinemedi:', err.message)
            return 0
          })
          await new Promise(res => setTimeout(res, 400))
        }
        sonuc.silinen = silindi
      }

      return { success: true, ...sonuc }
    } catch (error) {
      console.error('Video temizleme hatası:', error)
      return reply.status(500).send({ hata: error.message || 'Videolar temizlenemedi' })
    }
  })

  app.post('/shopify/publish', async (req, reply) => {
    try {
      const { urunId, urun: payloadUrun, mapping = {}, koleksiyonIds = [] } = req.body
      let urun = payloadUrun

      if (urunId) {
        const dbUrun = await prisma.urun.findUnique({
          where: { id: urunId },
          include: { varyantlar: true }
        })
        if (!dbUrun) return reply.status(404).send({ hata: 'Ürün bulunamadı' })
        urun = mergePublishPayload(dbUrun, payloadUrun)
      }

      if (!urun) {
        return reply.status(400).send({ hata: 'Ürün verisi veya urunId gereklidir' })
      }

      const product = await publishShopifyProduct(urun, mapping, koleksiyonIds)

      if (urunId && product?.id) {
        await prisma.urun.update({
          where: { id: urunId },
          data: { shopifyId: product.id }
        })
      }

      return { success: true, product }
    } catch (error) {
      console.error('Shopify publish hatası:', error)
      return reply.status(500).send({ hata: error.message || 'Shopify ürün yayınlanamadı' })
    }
  })

  app.post('/shopify/sync', async (req, reply) => {
    try {
      const { urunId, urun: payloadUrun, shopifyId, handle, mapping = {} } = req.body
      let urun = payloadUrun

      if (urunId) {
        const dbUrun = await prisma.urun.findUnique({
          where: { id: urunId },
          include: { varyantlar: true }
        })
        if (!dbUrun) return reply.status(404).send({ hata: 'Ürün bulunamadı' })
        urun = mergePublishPayload(dbUrun, payloadUrun)
      }

      if (!urun) {
        return reply.status(400).send({ hata: 'Ürün verisi veya urunId gereklidir' })
      }

      let product = null
      const lookupId = shopifyId || urun.shopifyId
      if (lookupId) {
        product = await getShopifyProductById(lookupId).catch(() => null)
      }

      const searchHandle = handle || slugifyHandle(urun.ad || urun.urunAdi || urun.kod || '')
      if (!product && searchHandle) {
        product = await findShopifyProductByHandle(searchHandle)
      }

      if (!product) {
        product = await publishShopifyProduct(urun, mapping)
        if (urunId && product?.id) {
          await prisma.urun.update({ where: { id: urunId }, data: { shopifyId: product.id } })
        }
      }

      const rawVariants = resolveRawVariants(urun)
      const localVariants = aggregateVariants(rawVariants)
      const baseSku = resolveBaseSku(urun, mapping)
      const inventoryMap = new Map()
      for (const v of localVariants) {
        inventoryMap.set(baseSku, v.adet)
      }

      const adjustments = await adjustInventoryLevels(product.id, inventoryMap)
      return { success: true, product, adjustments }
    } catch (error) {
      console.error('Shopify sync hatası:', error)
      return reply.status(500).send({ hata: error.message || 'Shopify stok senkronizasyonu başarısız' })
    }
  })
}