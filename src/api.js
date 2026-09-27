// ─── ORTAMA GÖRE API ADRESİ (tek merkez) ─────────────────────
// Localde (npm run dev) → her zaman localhost backend
// Production build'de    → .env'deki VITE_API_URL veya canlı adres
export const API_BASE = import.meta.env.MODE === 'development'
  ? 'http://localhost:3001/api'
  : (import.meta.env.VITE_API_URL || 'https://panel.vegacantastore.com/api').replace(/\/$/, '')

const API = API_BASE

  
async function istek(url, options = {}) {
  const res = await fetch(`${API}${url}`, {
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    ...options,
  })
  if (!res.ok) {
    const hata = await res.json().catch(() => ({ hata: res.statusText }))
    const mesaj =
      hata.hata ||
      hata.message ||
      (res.status === 404 ? `Endpoint bulunamadı (${url}) — sunucuda backend güncellenmeli ve yeniden başlatılmalı.` : null) ||
      res.statusText ||
      'Bir hata oluştu'
    throw new Error(mesaj)
  }
  return res.json()
}

// ─── MAĞAZALAR ────────────────────────────────────────────────
export const magazalariGetir  = (params={}) => istek('/magazalar?' + new URLSearchParams(params))
export const magazaEkle       = (data)     => istek('/magazalar', { method: 'POST', body: JSON.stringify(data) })
export const magazaGuncelle   = (id, data) => istek(`/magazalar/${id}`, { method: 'PUT', body: JSON.stringify(data) })

// ─── ÜRÜNLER ──────────────────────────────────────────────────
export const urunleriGetir    = (params = {}) => istek('/urunler?' + new URLSearchParams(params))
export const urunGetir        = (id)          => istek(`/urunler/${id}`)
export const urunEkle         = (data)        => istek('/urunler', { method: 'POST', body: JSON.stringify(data) })
export const urunGuncelle     = (id, data)    => istek(`/urunler/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const urunSil          = (id)          => istek(`/urunler/${id}`, { method: 'DELETE', body: JSON.stringify({}) })
export const sonKoduGetir     = ()            => istek('/urunler/son-kod').then(r => r.kod)
export const urunKaydet       = (form) => form.id ? urunGuncelle(form.id, form) : urunEkle(form)

// ─── SATIŞLAR ─────────────────────────────────────────────────
export const satislariGetir   = (params = {}) => istek('/satislar?' + new URLSearchParams(params))
export const satisGetir       = (id)          => istek(`/satislar/${id}`)
export const satisKaydet      = (data)        => istek('/satislar', { method: 'POST', body: JSON.stringify(data) })
export const sonFisNoGetir    = ()            => istek('/satislar/son-fis').then(r => r.fisNo)
export const satisOzet        = (params = {}) => istek('/satislar/ozet?' + new URLSearchParams(params))
export const satisIptal       = (id)          => istek(`/satislar/${id}/iptal`, { method: 'PUT' })

// ─── POS TERMİNALLER ─────────────────────────────────────────
export const posTerminalleriniGetir = (params = {}) => istek('/pos?' + new URLSearchParams(params))
export const posTerminaliKaydet     = (data)        => istek('/pos', { method: 'POST', body: JSON.stringify(data) })
export const posTerminaliGuncelle   = (id, data)    => istek(`/pos/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const posTerminaliSil        = (id)          => istek(`/pos/${id}`, { method: 'DELETE' })
export const posRaporu              = (params = {}) => istek('/pos/rapor?' + new URLSearchParams(params))

// ─── STOK ─────────────────────────────────────────────────────
export const stokHareketleriGetir = (params = {}) => istek('/stok/hareketler?' + new URLSearchParams(params))
export const stokHareketKaydet    = (data)        => istek('/stok/hareketler', { method: 'POST', body: JSON.stringify(data) })
export const stokDus              = (data)        => istek('/stok/dus', { method: 'POST', body: JSON.stringify(data) })
export const stokTransfer         = (data)        => istek('/stok/transfer', { method: 'POST', body: JSON.stringify(data) })
export const kritikStoklar        = (params = {}) => istek('/stok/kritik?' + new URLSearchParams(params))

// ─── İADELER ─────────────────────────────────────────────────
export const iadelerGetir  = (params = {}) => istek('/iadeler?' + new URLSearchParams(params))
export const iadeOlustur   = (data)        => istek('/iadeler', { method: 'POST', body: JSON.stringify(data) })
export const iadeOnayla    = (id)          => istek(`/iadeler/${id}/onayla`, { method: 'PUT', body: JSON.stringify({}) })
export const iadeReddet    = (id)          => istek(`/iadeler/${id}/reddet`, { method: 'PUT', body: JSON.stringify({}) })

// ─── SİPARİŞLER ──────────────────────────────────────────────
export const siparisleriGetir     = (params = {}) => istek('/siparisler?' + new URLSearchParams(params))
export const siparisGetir         = (id)          => istek(`/siparisler/${id}`)
export const siparisOlustur       = (data)        => istek('/siparisler', { method: 'POST', body: JSON.stringify(data) })
export const siparisDurumGuncelle = (id, data)    => istek(`/siparisler/${id}/durum`, { method: 'PUT', body: JSON.stringify(data) })

// ─── MÜŞTERİLER ──────────────────────────────────────────────
export const musterileriGetir  = (params = {}) => istek('/musteriler?' + new URLSearchParams(params))
export const musteriGetir      = (id)          => istek(`/musteriler/${id}`)
export const musteriEkle       = (data)        => istek('/musteriler', { method: 'POST', body: JSON.stringify(data) })
export const musteriGuncelle   = (id, data)    => istek(`/musteriler/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const musteriSil        = (id)          => istek(`/musteriler/${id}`, { method: 'DELETE' })

// ─── KULLANICILAR ─────────────────────────────────────────────
export const kullanicilariGetir = ()            => istek('/kullanicilar')
export const kullaniciEkle      = (data)        => istek('/kullanicilar', { method: 'POST', body: JSON.stringify(data) })
export const kullaniciGuncelle  = (id, data)    => istek(`/kullanicilar/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const girisYap           = (data)        => istek('/kullanicilar/giris', { method: 'POST', body: JSON.stringify(data) })

// ─── AYARLAR ──────────────────────────────────────────────────
export const ayarlariGetir         = ()                  => istek('/ayarlar')
export const ayarGuncelle          = (anahtar, deger)    => istek(`/ayarlar/${anahtar}`, { method: 'PUT', body: JSON.stringify({ deger }) })
export const ayarlariTopluGuncelle = (ayarlar)           => istek('/ayarlar/toplu', { method: 'POST', body: JSON.stringify({ ayarlar }) })

// ─── SHOPIFY ──────────────────────────────────────────────────
export const shopifyDurumGetir       = ()            => istek('/shopify/durum')
export const shopifyUrunleriGetir    = (params = {}) => istek('/shopify/urunler?' + new URLSearchParams(params))
export const shopifyUrunuGetir       = (id)          => istek(`/shopify/urun/${encodeURIComponent(id)}`)
export const shopifyUrunuAktar       = (data)        => istek('/shopify/aktar', { method: 'POST', body: JSON.stringify(data) })
export const shopifyAktarilanGetir   = ()            => istek('/shopify/aktarilan')
export const shopifyUrunGuncelle     = (id, data)    => istek(`/shopify/guncelle/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) })
export const shopifySenkronize       = ()            => istek('/shopify/senkronize', { method: 'POST' })
export const shopifyYayinla          = (data)        => istek('/shopify/publish', { method: 'POST', body: JSON.stringify(data) })
export const shopifySyncStock        = (data)        => istek('/shopify/sync', { method: 'POST', body: JSON.stringify(data) })
// Shopify'daki mükerrer ürün fotoğraflarını temizler — { kuru: true } gönderilirse
// hiçbir şey silinmez, sadece ne silineceği raporlanır.
export const shopifyResimTemizle     = (data = {}) => istek('/shopify/resim-temizle', { method: 'POST', body: JSON.stringify(data) })
// Aynı adlı kopya koleksiyonları raporlar. VARSAYILAN KURU ÇALIŞMADIR (hiçbir şey
// silinmez); { kuru: false } gönderildiğinde kopyaların ürünleri en eski koleksiyona
// taşınır ve kopyalar silinir.
export const shopifyKoleksiyonTemizle = (data = {}) => istek('/shopify/koleksiyon-temizle', { method: 'POST', body: JSON.stringify(data) })
// Paneldeki TÜM renk adlarını Shopify'daki "Renk Adı" metafield'ine yazar (geri doldurma).
// Ürünleri yeniden yayınlamaz, sadece metafield'i yazar. VARSAYILAN KURU ÇALIŞMADIR
// (yalnızca kaç ürünün gönderileceğini raporlar); { kuru: false } gerçekten gönderir.
export const shopifyRenkAdlariniGonder = (data = {}) => istek('/shopify/renk-adlarini-gonder', { method: 'POST', body: JSON.stringify(data) })
// Shopify Dosyalar'daki mükerrer video kopyalarını raporlar. VARSAYILAN KURU
// ÇALIŞMADIR; { kuru: false } gönderildiğinde fazla kopyalar silinir (her gruptan biri
// korunur, bir ürün tarafından kullanılan dosyalara hiç dokunulmaz).
export const shopifyVideoTemizle     = (data = {}) => istek('/shopify/video-temizle', { method: 'POST', body: JSON.stringify(data) })
export const shopifySiparisleriSenkronize = (data = {}) => istek('/shopify/siparisler/senkronize', { method: 'POST', body: JSON.stringify(data) })
// ─── MARKA ÜRÜNLERİ (Silver Polo / Nas Bag) — Shopify'a gönderilenler ───
export const markaGonderilenleriGetir = (kaynak)      => istek('/marka-urunleri/gonderilenler' + (kaynak ? `?kaynak=${encodeURIComponent(kaynak)}` : ''))
export const markaGonderildiKaydet    = (data)        => istek('/marka-urunleri/gonderildi', { method: 'POST', body: JSON.stringify(data) })
// ─── CARİ HESAPLAR ───────────────────────────────────────────
export const carileriGetir     = (params = {}) => istek('/cari?' + new URLSearchParams(params))
export const cariEkle          = (data)        => istek('/cari', { method: 'POST', body: JSON.stringify(data) })
export const cariGuncelle      = (id, data)    => istek(`/cari/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const cariHareketEkle   = (data)        => istek('/cari/hareket', { method: 'POST', body: JSON.stringify(data) })

// ─── BANKA ───────────────────────────────────────────────────
// ─── BANKA (güncel) ─────────────────────────────────────────
export const bankaKategorileriniGetir = ()         => istek('/banka/kategoriler')
export const bankaKategoriEkle        = (data)     => istek('/banka/kategoriler', { method: 'POST', body: JSON.stringify(data) })
export const bankaKategoriGuncelle    = (id, data) => istek(`/banka/kategoriler/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const bankaKategoriSil         = (id)       => istek(`/banka/kategoriler/${id}`, { method: 'DELETE' })

export const bankaHesaplariGetir   = (params={})   => istek('/banka/hesaplar?' + new URLSearchParams(params))
export const bankaHesapEkle        = (data)         => istek('/banka/hesaplar', { method: 'POST', body: JSON.stringify(data) })
export const bankaHesapGuncelle    = (id, data)     => istek(`/banka/hesaplar/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const bankaHesapSil         = (id)           => istek(`/banka/hesaplar/${id}`, { method: 'DELETE' })

export const bankaHareketleriGetir = (params={})    => istek('/banka/hareketler?' + new URLSearchParams(params))
export const bankaHareketEkle      = (data)         => istek('/banka/hareketler', { method: 'POST', body: JSON.stringify(data) })
export const bankaHareketSil       = (id)           => istek(`/banka/hareketler/${id}`, { method: 'DELETE' })

export const bankaOzetGetir        = (params={})    => istek('/banka/ozet?' + new URLSearchParams(params))
export const bankaMutabakatGetir   = (params={})    => istek('/banka/mutabakat?' + new URLSearchParams(params))

// ─── MARKALAR ────────────────────────────────────────────────
export const markalariGetir   = ()         => istek('/markalar')
export const markaEkle        = (data)     => istek('/markalar', { method: 'POST', body: JSON.stringify(data) })
export const markaGuncelle    = (id, data) => istek(`/markalar/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const markaSil         = (id)       => istek(`/markalar/${id}`, { method: 'DELETE' })

// ─── KATEGORİLER ─────────────────────────────────────────────
export const kategorileriGetir = ()         => istek('/kategoriler')
export const kategoriEkle      = (data)     => istek('/kategoriler', { method: 'POST', body: JSON.stringify(data) })
export const kategoriGuncelle  = (id, data) => istek(`/kategoriler/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const kategoriSil       = (id)       => istek(`/kategoriler/${id}`, { method: 'DELETE' })

// ─── MASRAF ──────────────────────────────────────────────────
export const masrafKategorileriniGetir = ()         => istek('/masraf/kategoriler')
export const masrafKategoriEkle        = (data)     => istek('/masraf/kategoriler', { method: 'POST', body: JSON.stringify(data) })
export const masrafKategoriGuncelle    = (id, data) => istek(`/masraf/kategoriler/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const masrafKategoriSil         = (id)       => istek(`/masraf/kategoriler/${id}`, { method: 'DELETE' })

export const masraflariGetir = (params = {}) => istek('/masraf?' + new URLSearchParams(params))
export const masrafOzetGetir = (params = {}) => istek('/masraf/ozet?' + new URLSearchParams(params))
export const masrafEkle      = (data)        => istek('/masraf', { method: 'POST', body: JSON.stringify(data) })
export const masrafGuncelle  = (id, data)    => istek(`/masraf/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const masrafSil       = (id)          => istek(`/masraf/${id}`, { method: 'DELETE' })

// ─── GÜNLÜK KASA ─────────────────────────────────────────────
export const kasaBugunGetir  = (params={})  => istek('/kasa/bugun?' + new URLSearchParams(params))
export const kasaAc          = (data)       => istek('/kasa/ac', { method: 'POST', body: JSON.stringify(data) })
export const kasaKapat       = (data)       => istek('/kasa/kapat', { method: 'POST', body: JSON.stringify(data) })
export const kasaIslemEkle   = (data)       => istek('/kasa/islem', { method: 'POST', body: JSON.stringify(data) })
export const kasaGecmisGetir = (params={})  => istek('/kasa/gecmis?' + new URLSearchParams(params))

// ─── DEĞİŞİM ─────────────────────────────────────────────────
export const degisimleriGetir = (params={}) => istek('/degisimler?' + new URLSearchParams(params))
export const degisimOlustur   = (data)      => istek('/degisimler', { method: 'POST', body: JSON.stringify(data) })
export const degisimIptal     = (id)        => istek(`/degisimler/${id}/iptal`, { method: 'PUT', body: JSON.stringify({}) })

// ─── BANKA HESAP CRUD ────────────────────────────────────────


export const barkodIleUrunBul = (barkod, params={}) => istek(`/urunler/barkod/${barkod}?` + new URLSearchParams(params))

export const cariHareketleriGetir = (cariId) => istek(`/cari/${cariId}/hareketler`)

export const raporGetir = (params={}) => istek('/satislar/rapor?' + new URLSearchParams(params))
