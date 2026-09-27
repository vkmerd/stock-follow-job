// VegaCanta/src/shopify-urunleri.jsx
import { useState, useEffect, useRef } from 'react'
import { shopifyUrunleriGetir, shopifyUrunuGetir, shopifyUrunuAktar, shopifyAktarilanGetir, shopifyUrunGuncelle, shopifySenkronize, shopifyResimTemizle, shopifyKoleksiyonTemizle, shopifyVideoTemizle, magazalariGetir, API_BASE } from './api'
import { useVega } from './VegaContext'

const BACKEND_API = API_BASE

async function fetchShopifyProducts(after = null, first = 50, statusFilter = 'active') {
  let q = `?first=${first}`
  if (after) q += `&after=${encodeURIComponent(after)}`
  if (statusFilter && statusFilter !== 'all') q += `&status=${encodeURIComponent(statusFilter)}`
  const res = await fetch(`${BACKEND_API}/shopify/urunler${q}`)

  if (!res.ok) {
    const hata = await res.json().catch(() => ({ hata: res.statusText }))
    throw new Error(hata.hata || 'Shopify ürünleri alınamadı')
  }

  return res.json()
}

export default function ShopifyUrunleri() {
  const { t } = useVega()

  const [tab, setTab] = useState('shopify')
  const [products, setProducts] = useState([])
  const [importedProducts, setImportedProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [detailProduct, setDetailProduct] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  // Sayfalama ve arama için state'ler
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(25)
  const [autoFit, setAutoFit] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active') // aktif ürünler varsayılan

  // Aktarım için mağaza seçimi
  const [magazalar, setMagazalar] = useState([])
  const [importModal, setImportModal] = useState(null) // aktarılacak ürün
  const [importMagazaId, setImportMagazaId] = useState('')

  const containerRef = useRef(null)
  const tableRef = useRef(null)
  const tbodyRef = useRef(null)

  useEffect(() => {
    if (tab === 'shopify') {
      loadShopifyProducts()
    }
  }, [tab, statusFilter])

  useEffect(() => {
    if (tab === 'imported') {
      loadImportedProducts()
    }
  }, [tab])

  useEffect(() => {
    magazalariGetir().then(liste => {
      const dizi = (Array.isArray(liste) ? liste : []).filter(m => m.tip !== 'online')
      setMagazalar(dizi)
      if (dizi.length > 0) setImportMagazaId(dizi[0].id)
    }).catch(() => {})
  }, [])

  async function loadShopifyProducts() {
    try {
      setLoading(true)
      setError('')

      // Eskiden en fazla 2 sayfa (250+250=500 ürün) çekilip duruluyordu — daha
      // fazla aktif ürün varsa listede hiç görünmüyordu. hasNextPage bitene kadar
      // sayfalamayı sürdürüp TÜM ürünleri çekiyoruz.
      let allProducts = []
      let cursor = null
      let hasNextPage = true
      while (hasNextPage) {
        const pageResponse = await fetchShopifyProducts(cursor, 250, statusFilter)
        const page = pageResponse.products
        allProducts = [...allProducts, ...page.edges.map(edge => edge.node)]
        hasNextPage = page.pageInfo.hasNextPage
        cursor = page.pageInfo.endCursor
        if (hasNextPage && !cursor) break // güvenlik: cursor yoksa sonsuz döngüye girme
      }

      const normalizedProducts = allProducts.map(product => ({
        ...product,
        shopifyId: product.shopifyId || product.id,
        price: product.price ?? product?.variants?.edges?.[0]?.node?.price ?? 0,
        sku: product.sku ?? product?.variants?.edges?.[0]?.node?.sku ?? null,
        barcode: product.barcode ?? product?.variants?.edges?.[0]?.node?.barcode ?? null,
        title: product.title ?? product.handle ?? '',
      }))

      setProducts(normalizedProducts) // Tüm ürünleri state'e kaydet
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadImportedProducts() {
    try {
      setLoading(true)
      setError('')
      const response = await shopifyAktarilanGetir()
      setImportedProducts(response.urunler || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // "Aktar" tıklanınca doğrudan aktarmak yerine, hangi mağazaya aktarılacağını sor
  function handleImport(product) {
    setImportModal(product)
  }

  async function confirmImport() {
    const product = importModal
    if (!product || !importMagazaId) return
    try {
      setImporting(prev => ({ ...prev, [product.shopifyId]: true }))
      // Backend, açıklama/resimler/video dahil ürünün tam halini shopifyId üzerinden
      // doğrudan Shopify'dan çekiyor — burada sadece hangi ürün ve hangi mağaza bilgisini
      // gönderiyoruz. `stok` opsiyonel bir öneri; boş kalırsa backend Shopify'daki güncel
      // adedi kullanır.
      await shopifyUrunuAktar({
        shopifyId: product.shopifyId,
        magazaId: importMagazaId,
        stok: product.inventoryQuantity || 0
      })
      alert(`✓ "${product.title}" başarıyla aktarıldı`)
      setImportModal(null)
      // Aktarılan ürünü listeden kaldır
      setProducts(prevProducts => prevProducts.filter(p => p.shopifyId !== product.shopifyId))
      loadImportedProducts() // İçe aktarılanlar listesini yenile
    } catch (err) {
      alert(`✗ Hata: ${err.message}`)
    } finally {
      setImporting(prev => ({ ...prev, [product.shopifyId]: false }))
    }
  }

  // Geçmişte oluşmuş mükerrer ürün fotoğraflarını Shopify tarafında temizler.
  // Sadece AYNI fotoğrafın fazla kopyaları silinir; tekil fotoğraflara dokunulmaz.
  async function handleResimTemizle() {
    if (!window.confirm("Shopify'a gönderilmiş tüm ürünlerde mükerrer (çoklanmış) fotoğraflar silinecek. Her fotoğrafın ilk kopyası korunur. Devam edilsin mi?")) return
    try {
      setCleaning(true)
      setError('')
      const response = await shopifyResimTemizle()
      alert(`✓ ${response.silinen} mükerrer fotoğraf silindi (${response.islenen}/${response.toplam} ürün tarandı${response.atlanan ? `, ${response.atlanan} atlandı` : ''}).`)
    } catch (err) {
      alert(`✗ Temizleme hatası: ${err.message}`)
      setError(err.message)
    } finally {
      setCleaning(false)
    }
  }

  // Önce KURU çalıştırıp raporu gösterir; kullanıcı onaylarsa kopya koleksiyonların
  // ürünlerini en eskisine taşıyıp kopyaları siler. Koleksiyon silmek geri alınamaz,
  // bu yüzden onay ekranında tam sayılar gösteriliyor.
  async function handleKoleksiyonTemizle() {
    try {
      setCleaning(true)
      setError('')
      const rapor = await shopifyKoleksiyonTemizle({ kuru: true })
      if (!rapor.kopyaGrubu) {
        alert(`✓ Kopya koleksiyon bulunamadı (${rapor.toplamKoleksiyon} koleksiyon tarandı).`)
        return
      }
      const ornekler = (rapor.detay || [])
        .slice(0, 10)
        .map(d => `• ${d.baslik} — ${d.silinecek.length} kopya`)
        .join('\n')
      const devami = (rapor.detay || []).length > 10 ? '\n• ...' : ''
      const atlanan = (rapor.atlanan || []).length
        ? `\n\n${rapor.atlanan.length} grup atlanacak (kurallı koleksiyon içeriyor).`
        : ''
      const onay = window.confirm(
        `${rapor.kopyaGrubu} adet aynı adlı koleksiyon grubu bulundu.\n` +
        `${rapor.silinen} kopya koleksiyon SİLİNECEK, içindeki ${rapor.tasinanUrun} ürün bağı en eski koleksiyona taşınacak.\n\n` +
        `${ornekler}${devami}${atlanan}\n\n` +
        'Bu işlem GERİ ALINAMAZ. Devam edilsin mi?'
      )
      if (!onay) return
      const sonuc = await shopifyKoleksiyonTemizle({ kuru: false })
      alert(`✓ ${sonuc.silinen} kopya koleksiyon silindi, ${sonuc.tasinanUrun} ürün bağı taşındı.`)
    } catch (err) {
      alert(`✗ Koleksiyon temizleme hatası: ${err.message}`)
      setError(err.message)
    } finally {
      setCleaning(false)
    }
  }

  // Önce KURU çalıştırıp raporu gösterir; kullanıcı onaylarsa fazla video kopyalarını
  // siler. Bir ürün tarafından kullanılan dosyalar hiçbir koşulda silinmiyor.
  async function handleVideoTemizle() {
    try {
      setCleaning(true)
      setError('')
      const rapor = await shopifyVideoTemizle({ kuru: true })
      if (!rapor.kopyaGrubu) {
        alert(`✓ Mükerrer video bulunamadı (${rapor.toplamVideo} video dosyası tarandı).`)
        return
      }
      const ornekler = (rapor.detay || [])
        .slice(0, 10)
        .map(d => `• ${d.korunanDosya} — ${d.silinecekAdet} kopya`)
        .join('\n')
      const devami = (rapor.detay || []).length > 10 ? '\n• ...' : ''
      const onay = window.confirm(
        `${rapor.toplamVideo} video dosyası tarandı.\n` +
        `${rapor.kopyaGrubu} grupta toplam ${rapor.silinen} fazla kopya SİLİNECEK.\n` +
        'Her gruptan bir dosya korunur; bir ürüne bağlı olan dosyalara dokunulmaz.\n\n' +
        `${ornekler}${devami}\n\n` +
        'Bu işlem GERİ ALINAMAZ. Devam edilsin mi?'
      )
      if (!onay) return
      const sonuc = await shopifyVideoTemizle({ kuru: false })
      alert(`✓ ${sonuc.silinen} mükerrer video dosyası silindi.`)
    } catch (err) {
      alert(`✗ Video temizleme hatası: ${err.message}`)
      setError(err.message)
    } finally {
      setCleaning(false)
    }
  }

  async function handleSync() {
    try {
      setSyncing(true)
      setError('')
      const response = await shopifySenkronize()
      alert(`✓ ${response.mesaj}`)
      loadImportedProducts()
      loadShopifyProducts() // Shopify ürün listesini de yenile
    } catch (err) {
      alert(`✗ Senkronizasyon hatası: ${err.message}`)
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function loadProductDetail(id) {
    try {
      setDetailLoading(true)
      setDetailError('')
      setDetailProduct(null)
      const detail = await shopifyUrunuGetir(id)
      setDetailProduct(detail)
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetailModal() {
    setDetailProduct(null)
    setDetailError('')
  }

  async function handleUpdateProduct() {
    try {
      if (!editingId) return
      await shopifyUrunGuncelle(editingId, editForm)
      alert('✓ Ürün güncellendi')
      setEditingId(null)
      loadImportedProducts() // Güncellenen listeyi tekrar yükle
    } catch (err) {
      alert(`✗ Güncelleme hatası: ${err.message}`)
    }
  }

  function openEditModal(product) {
    setEditingId(product.id)
    setEditForm({
      ad: product.ad,
      satisF: product.satisF,
      alisF: product.alisF,
      kdv: product.kdv,
      marka: product.marka,
      kategori: product.kategori,
      aciklama: product.aciklama
    })
  }

  // Sayfalama ve arama filtreleme
  const filteredProducts = products.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return String(p.title || '').toLowerCase().includes(q)
      || String(p.vendor || '').toLowerCase().includes(q)
      || String(p.productType || '').toLowerCase().includes(q)
      || String(p.handle || '').toLowerCase().includes(q)
  })

  const filteredImportedProducts = importedProducts.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return String(u.ad || '').toLowerCase().includes(q)
      || String(u.marka || '').toLowerCase().includes(q)
      || String(u.kategori || '').toLowerCase().includes(q)
      || String(u.kod || '').toLowerCase().includes(q)
  })

  const currentList = tab === 'shopify' ? filteredProducts : filteredImportedProducts;
  const total = currentList.length
  const start = page * perPage
  const end = Math.min(total, start + perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage || 1))
  const currentItems = currentList.slice(start, end)

  const goPrev = () => setPage(p => Math.max(0, p - 1))
  const goNext = () => setPage(p => Math.min(totalPages - 1, p + 1))
  const setPerPageFixed = (n) => { setAutoFit(false); setPerPage(n); setPage(0) }

  useEffect(() => { setPage(0) }, [search, tab])

  // autoFit hesaplaması (MarkaUrunleri.jsx'ten alındı)
  useEffect(() => {
    const calc = () => {
      if (!autoFit) return
      const cont = containerRef.current
      const table = tableRef.current
      if (!cont || !table) return
      const thead = table.querySelector('thead')
      const headerH = thead ? thead.getBoundingClientRect().height : 56
      const available = cont.clientHeight - headerH - 110 // padding + other UI
      let rowH = 48
      const firstRow = table.querySelector('tbody tr')
      if (firstRow) rowH = Math.max(32, firstRow.getBoundingClientRect().height)
      const fit = Math.max(5, Math.floor(available / rowH))
      setPerPage(fit)
      setPage(0)
    }
    // Sadece tablo varsa veya tab değiştiğinde yeniden hesapla
    // hem Shopify hem de Imported için tablo yapısına geçtik
    if (tableRef.current) {
      calc()
      window.addEventListener('resize', calc)
      return () => window.removeEventListener('resize', calc)
    }
    // NOT: currentItems.length'i dependency'e KOYMA — setPerPage/setPage
    // burada tetiklendiğinde currentItems.length değişir, bu da efekti
    // tekrar tetikleyip satır yüksekliğini yeniden ölçer (sayfa içeriğine
    // göre değişebiliyor) ve sonsuz bir "fit" salınımına, yani ekranın
    // sürekli titremesine/oynamasına yol açıyordu.
  }, [autoFit, tab, products.length, importedProducts.length])


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg, color: t.text }}>
      <style>{`
        .vega-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-scroll-x table{min-width:640px;}
        .vega-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap!important;}
        .vega-tabs button{white-space:nowrap;flex-shrink:0;}
        @media (max-width:860px){
          .vega-page-pad{padding-left:14px!important;padding-right:14px!important;}
          .vega-grid-2{grid-template-columns:1fr!important;}
        }
        @media (max-width:600px){
          .vega-header-row{flex-direction:column;align-items:stretch!important;}
          .vega-header-actions{width:100%;}
        }
      `}</style>
      {/* Header */}
      <div className="vega-page-pad" style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        <div className="vega-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '600' }}>🛍️ Shopify Entegrasyonu</h1>
            <p style={{ margin: 0, fontSize: '13px', color: t.textMuted }}>Shopify mağazanızdaki ürünleri yönetin ve kendi panelinize aktarın.</p>
            <div style={{ marginTop: '8px' }}>
              <input
                placeholder="Ürün adı, marka, kod ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.input, color: t.text, width: '100%', maxWidth: '380px' }}
              />
            </div>
          </div>
          <div className="vega-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Geçmişte çoklanmış fotoğrafları tek seferde temizler. Yayınlama akışı artık
                mükerrer yüklemiyor (bkz. backend reconcileShopifyProductImages) — bu buton
                sorun ortaya çıkmadan ÖNCE oluşmuş kopyaları düzeltmek içindir. */}
            <button
              className="vega-header-actions"
              onClick={handleResimTemizle}
              disabled={cleaning}
              title="Shopify'daki mükerrer ürün fotoğraflarını siler (her fotoğrafın ilk kopyası kalır)"
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: t.textMuted,
                cursor: cleaning ? 'default' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: cleaning ? 0.6 : 1
              }}
            >
              {cleaning ? 'Temizleniyor...' : '🧹 Mükerrer Fotoğrafları Temizle'}
            </button>
            <button
              className="vega-header-actions"
              onClick={handleKoleksiyonTemizle}
              disabled={cleaning}
              title="Aynı adlı kopya koleksiyonları raporlar; onaylarsanız birleştirip siler"
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: t.textMuted,
                cursor: cleaning ? 'default' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: cleaning ? 0.6 : 1
              }}
            >
              🗂 Kopya Koleksiyonlar
            </button>
            <button
              className="vega-header-actions"
              onClick={handleVideoTemizle}
              disabled={cleaning}
              title="Shopify Dosyalar'daki mükerrer video kopyalarını raporlar; onaylarsanız siler"
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: t.textMuted,
                cursor: cleaning ? 'default' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: cleaning ? 0.6 : 1
              }}
            >
              🎬 Kopya Videolar
            </button>
            <button
              className="vega-header-actions"
              onClick={tab === 'shopify' ? loadShopifyProducts : loadImportedProducts}
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: `1px solid ${t.accent}55`,
                background: t.accentBg,
                color: t.accent,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Yükleniyor...' : '↻ Yenile'}
            </button>
          </div>
        </div>
      </div>

      <div className="vega-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: `1px solid ${t.border}`, flexWrap: 'wrap', gap: 8 }}>
        <div className="vega-tabs" style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setTab('shopify')}
            style={{ padding: '10px 16px', fontWeight: '500', borderBottom: `2px solid ${tab === 'shopify' ? t.accent : 'transparent'}`, color: tab === 'shopify' ? t.accent : t.textMuted, transition: 'color 200ms ease, border-color 200ms ease', cursor: 'pointer', background: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
          >
            📦 Shopify Ürünleri ({filteredProducts.length})
          </button>
          <button
            onClick={() => setTab('imported')}
            style={{ padding: '10px 16px', fontWeight: '500', borderBottom: `2px solid ${tab === 'imported' ? t.accent : 'transparent'}`, color: tab === 'imported' ? t.accent : t.textMuted, transition: 'color 200ms ease, border-color 200ms ease', cursor: 'pointer', background: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
          >
            ✓ İçe Aktarılanlar ({filteredImportedProducts.length})
          </button>
        </div>
        {tab === 'shopify' && (
          <div style={{ display: 'flex', gap: 6, paddingBottom: 8 }}>
            {[['active','✓ Aktif'],['draft','Taslak'],['all','Tümü']].map(([val, label]) => (
              <button key={val} onClick={() => { setStatusFilter(val); setPage(0) }}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${statusFilter === val ? t.accent : t.border}`,
                  background: statusFilter === val ? t.accentBg : 'transparent',
                  color: statusFilter === val ? t.accent : t.textMuted, fontWeight: statusFilter === val ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ 
          padding: '12px 16px', 
          borderRadius: '8px', 
          background: 'rgba(235,87,87,0.1)',
          border: `1px solid rgba(235,87,87,0.3)`,
          color: '#eb5757',
          marginBottom: '16px',
          fontSize: '13px',
          margin: '0 24px 16px 24px' // İçerik ile aynı hizaya getirmek için
        }}>
          Hata: {error}
        </div>
      )}

      {/* Content */}
      <div ref={containerRef} className="vega-page-pad" style={{ flex: '1', overflowY: 'auto', padding: '0 24px 20px 24px' }}> {/* Üst padding kaldırıldı, alttan eklendi */}
        {loading && <div style={{ color: t.textMuted, fontWeight: '500', textAlign: 'center', padding: '40px 0' }}>Yükleniyor...</div>}

        {!loading && !error && currentItems.length > 0 && (
          <div style={{ borderRadius: '12px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            <div className="vega-scroll-x">
            <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: t.card, borderBottom: `1px solid ${t.border}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ID / Kod</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ürün Adı</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Marka</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kategori</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fiyat</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>İşlem</th>
                </tr>
              </thead>
              <tbody ref={tbodyRef}>
                {currentItems.map((item, index) => {
                  // Her iki tab için ortak alanlar
                  const id = tab === 'shopify' ? (item.shopifyId || item.id) : item.kod;
                  const ad = tab === 'shopify' ? (item.title || item.handle) : item.ad;
                  const marka = tab === 'shopify' ? item.vendor : item.marka;
                  const kategori = tab === 'shopify' ? item.productType : item.kategori;
                  const price = tab === 'shopify' ? parseFloat(item.price || 0).toFixed(2) : parseFloat(item.satisF || 0).toFixed(2);

                  return (
                    <tr 
                      key={id || index} 
                      onClick={() => { if (tab === 'shopify') loadProductDetail(id); else openEditModal(item) }}
                      style={{ 
                        borderBottom: `1px solid ${t.border}`,
                        cursor: tab === 'shopify' || tab === 'imported' ? 'pointer' : 'default',
                        background: t.bg,
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = t.hover}
                      onMouseLeave={(e) => e.currentTarget.style.background = t.bg}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: t.accent, fontWeight: '500' }}>{id}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{ad}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: t.textMuted }}>{marka}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: t.textMuted }}>{kategori}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: t.accent, fontWeight: '500' }}>{price} TL</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {tab === 'shopify' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleImport(item) }} 
                              disabled={importing[item.shopifyId]}
                              style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${t.accent}33`, background: t.accentBg, color: t.accent, fontSize: '12px', cursor: 'pointer', opacity: importing[item.shopifyId] ? 0.6 : 1 }}
                            >
                              {importing[item.shopifyId] ? 'Aktarılıyor...' : '➕ Aktar'}
                            </button>
                          )}
                          {tab === 'imported' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); openEditModal(item) }} 
                              style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: '12px', cursor: 'pointer' }}
                            >
                              ✏️ Düzenle
                            </button>
                          )}
                          {tab === 'imported' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleSync() }} // Tüm aktarılanları senkronize eder
                              disabled={syncing}
                              style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: '12px', cursor: 'pointer', opacity: syncing ? 0.6 : 1 }}
                            >
                              {syncing ? 'Senk. Ediliyor...' : 'Senkron'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            {/* Pagination controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.card, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ color: t.textMuted, fontSize: '13px' }}>
                Gösterilen {start + 1} - {end} / {total}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={goPrev} disabled={page === 0} style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, cursor: 'pointer', opacity: page === 0 ? 0.5 : 1 }}>Önceki</button>
                <div style={{ fontSize: '13px', color: t.textMuted }}>{page + 1} / {totalPages}</div>
                <button onClick={goNext} disabled={page >= totalPages - 1} style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, cursor: 'pointer', opacity: page >= totalPages - 1 ? 0.5 : 1 }}>Sonraki</button>
                <select value={autoFit ? 'auto' : perPage} onChange={(e) => {
                  const v = e.target.value
                  if (v === 'auto') { setAutoFit(true); setPage(0) } else setPerPageFixed(Number(v))
                }} style={{ padding: '6px 8px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.input, color: t.text }}>
                  <option value="auto">Ekrana Sığdır</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && currentItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textMuted, backgroundColor: t.card, borderRadius: '12px', border: `1px solid ${t.border}` }}>
            <p style={{ fontSize: '14px' }}>Ürün bulunamadı</p>
          </div>
        )}
      </div>

      {detailProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '980px', maxHeight: '88vh', overflowY: 'auto', background: t.bg, borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', padding: '24px', position: 'relative' }}>
            <button onClick={closeDetailModal} style={{ position: 'absolute', top: '18px', right: '18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '20px', color: t.text }}>✕</button>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '18px' }}>
              <div style={{ flex: '1 1 240px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>{detailProduct.title}</h2>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: t.textMuted }}>{detailProduct.vendor} · {detailProduct.productType}</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: t.textMuted }}><strong>Toplam Stok:</strong> {detailProduct.totalInventory ?? '—'}</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: t.textMuted }}><strong>Handle:</strong> {detailProduct.handle}</p>
              </div>
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {detailProduct.images?.edges?.length > 0 && detailProduct.images.edges.slice(0, 3).map(({ node }, idx) => (
                    <img key={idx} src={node.url} alt={detailProduct.title} style={{ width: '100%', borderRadius: '14px', objectFit: 'cover', maxHeight: '160px' }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="vega-grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(240px, 1fr)', gap: '24px' }}>
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 600 }}>Varyasyonlar</h3>
                <div style={{ border: `1px solid ${t.border}`, borderRadius: '16px', overflow: 'hidden' }}>
                  <div className="vega-scroll-x">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: t.card }}>
                        <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', color: t.textMuted, fontWeight: 600 }}>Başlık</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', color: t.textMuted, fontWeight: 600 }}>Fiyat</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', color: t.textMuted, fontWeight: 600 }}>SKU</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', color: t.textMuted, fontWeight: 600 }}>Stok</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', color: t.textMuted, fontWeight: 600 }}>Barcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailProduct.variants?.edges?.map(({ node }) => (
                        <tr key={node.id}>
                          <td style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}`, color: t.text }}>{node.title}</td>
                          <td style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}`, color: t.text }}>{parseFloat(node.price || 0).toFixed(2)} TL</td>
                          <td style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}`, color: t.text }}>{node.sku || '-'}</td>
                          <td style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}`, color: t.text }}>{node.inventoryQuantity ?? '—'}</td>
                          <td style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}`, color: t.text }}>{node.barcode || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 600 }}>Metafields</h3>
                {detailProduct.metafields?.edges?.length > 0 ? (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {detailProduct.metafields.edges.map(({ node }) => (
                      <div key={node.id} style={{ padding: '12px 14px', borderRadius: '14px', border: `1px solid ${t.border}`, background: t.card }}>
                        <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '6px' }}><strong>{node.namespace}.{node.key}</strong></div>
                        <div style={{ fontSize: '13px', color: t.text }}>{node.value}</div>
                        <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '6px' }}>{node.type || ''}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '14px', borderRadius: '14px', border: `1px solid ${t.border}`, background: t.card, color: t.textMuted }}>Metafield bulunamadı.</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 600 }}>Açıklama</h3>
              <div style={{ minHeight: '120px', padding: '16px', borderRadius: '16px', border: `1px solid ${t.border}`, background: t.card, color: t.text, whiteSpace: 'pre-wrap' }}>
                {detailProduct.description || 'Açıklama yok.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: t.bg, borderRadius: '1rem', padding: '1.5rem', /* @media (min-width: 640px)': { padding: '2rem' }, */ maxWidth: '32rem', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)', border: `1px solid ${t.border}` }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: t.text, marginBottom: '1.5rem' }}>Ürün Düzenle</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="edit-ad" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: t.textMuted, marginBottom: '0.25rem' }}>Ürün Adı</label>
                <input
                  type="text"
                  id="edit-ad"
                  value={editForm.ad || ''}
                  onChange={e => setEditForm({ ...editForm, ad: e.target.value })}
                  style={{ width: '100%', border: `1px solid ${t.border}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: t.input, color: t.text, outline: 'none', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', transition: 'border-color 200ms ease, box-shadow 200ms ease' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', /* @media (min-width: 640px)': { gridTemplateColumns: '1fr 1fr' } */ }}>
                <div>
                  <label htmlFor="edit-alisF" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: t.textMuted, marginBottom: '0.25rem' }}>Alış Fiyatı</label>
                  <input
                    type="number"
                    step="0.01"
                    id="edit-alisF"
                    value={editForm.alisF || ''}
                    onChange={e => setEditForm({ ...editForm, alisF: e.target.value })}
                    style={{ width: '100%', border: `1px solid ${t.border}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: t.input, color: t.text, outline: 'none', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', transition: 'border-color 200ms ease, box-shadow 200ms ease' }}
                  />
                </div>
                <div>
                  <label htmlFor="edit-satisF" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: t.textMuted, marginBottom: '0.25rem' }}>Satış Fiyatı</label>
                  <input
                    type="number"
                    step="0.01"
                    id="edit-satisF"
                    value={editForm.satisF || ''}
                    onChange={e => setEditForm({ ...editForm, satisF: e.target.value })}
                    style={{ width: '100%', border: `1px solid ${t.border}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: t.input, color: t.text, outline: 'none', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', transition: 'border-color 200ms ease, box-shadow 200ms ease' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', /* @media (min-width: 640px)': { gridTemplateColumns: '1fr 1fr' } */ }}>
                <div>
                  <label htmlFor="edit-marka" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: t.textMuted, marginBottom: '0.25rem' }}>Marka</label>
                  <input
                    type="text"
                    id="edit-marka"
                    value={editForm.marka || ''}
                    onChange={e => setEditForm({ ...editForm, marka: e.target.value })}
                    style={{ width: '100%', border: `1px solid ${t.border}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: t.input, color: t.text, outline: 'none', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', transition: 'border-color 200ms ease, box-shadow 200ms ease' }}
                  />
                </div>
                <div>
                  <label htmlFor="edit-kdv" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: t.textMuted, marginBottom: '0.25rem' }}>KDV %</label>
                  <input
                    type="number"
                    id="edit-kdv"
                    value={editForm.kdv || ''}
                    onChange={e => setEditForm({ ...editForm, kdv: e.target.value })}
                    style={{ width: '100%', border: `1px solid ${t.border}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: t.input, color: t.text, outline: 'none', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', transition: 'border-color 200ms ease, box-shadow 200ms ease' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-kategori" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: t.textMuted, marginBottom: '0.25rem' }}>Kategori</label>
                <input
                  type="text"
                  id="edit-kategori"
                  value={editForm.kategori || ''}
                  onChange={e => setEditForm({ ...editForm, kategori: e.target.value })}
                  style={{ width: '100%', border: `1px solid ${t.border}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: t.input, color: t.text, outline: 'none', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', transition: 'border-color 200ms ease, box-shadow 200ms ease' }}
                />
              </div>

              <div>
                <label htmlFor="edit-aciklama" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: t.textMuted, marginBottom: '0.25rem' }}>Açıklama</label>
                <textarea
                  id="edit-aciklama"
                  value={editForm.aciklama || ''}
                  onChange={e => setEditForm({ ...editForm, aciklama: e.target.value })}
                  style={{ width: '100%', border: `1px solid ${t.border}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: t.input, color: t.text, outline: 'none', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', transition: 'border-color 200ms ease, box-shadow 200ms ease' }}
                  rows="3"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
              <button
                onClick={() => setEditingId(null)}
                style={{ flex: '1', padding: '0.625rem 1.25rem', border: `1px solid ${t.border}`, borderRadius: '0.5rem', fontWeight: '500', color: t.textMuted, backgroundColor: t.card, cursor: 'pointer', transition: 'background-color 200ms ease, border-color 200ms ease', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.18)' }}
              >
                İptal
              </button>
              <button
                onClick={handleUpdateProduct}
                style={{ flex: '1', padding: '0.625rem 1.25rem', backgroundColor: t.accent, color: 'white', borderRadius: '0.5rem', fontWeight: '500', cursor: 'pointer', transition: 'background-color 200ms ease', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {importModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
          <div style={{ backgroundColor: t.bg, borderRadius: '1rem', padding: '1.5rem', maxWidth: '26rem', width: '100%', border: `1px solid ${t.border}`, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: t.text, marginBottom: '0.5rem' }}>Hangi mağazaya aktarılsın?</h3>
            <p style={{ fontSize: '0.8125rem', color: t.textMuted, marginBottom: '1rem' }}>
              "{importModal.title}" — mağaza bazlı stok kaydı bu mağaza için oluşturulacak
              {importModal.inventoryQuantity != null && <> (başlangıç stoğu: <strong>{importModal.inventoryQuantity}</strong> — Shopify'daki mevcut adet)</>}.
            </p>
            {magazalar.length === 0 ? (
              <div style={{ fontSize: '0.8125rem', color: '#eb5757', marginBottom: '1rem' }}>⚠ Önce Mağaza Yönetimi'nden en az bir mağaza ekleyin.</div>
            ) : (
              <select
                value={importMagazaId}
                onChange={e => setImportMagazaId(e.target.value)}
                style={{ width: '100%', border: `1px solid ${t.border}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: t.input, color: t.text, outline: 'none', marginBottom: '1.25rem' }}
              >
                {magazalar.map(m => <option key={m.id} value={m.id}>{m.ikon || '🏪'} {m.ad}</option>)}
              </select>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setImportModal(null)}
                style={{ flex: 1, padding: '0.625rem 1.25rem', border: `1px solid ${t.border}`, borderRadius: '0.5rem', fontWeight: 500, color: t.textMuted, backgroundColor: t.card, cursor: 'pointer' }}
              >
                İptal
              </button>
              <button
                onClick={confirmImport}
                disabled={!importMagazaId || importing[importModal.shopifyId]}
                style={{ flex: 1, padding: '0.625rem 1.25rem', backgroundColor: t.accent, color: 'white', borderRadius: '0.5rem', fontWeight: 500, cursor: importMagazaId ? 'pointer' : 'not-allowed', opacity: importMagazaId ? 1 : 0.6 }}
              >
                {importing[importModal.shopifyId] ? 'Aktarılıyor...' : '➕ Aktar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}