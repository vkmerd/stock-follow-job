// VegaCanta/src/shopify-urunleri.jsx
import { useState, useEffect, useRef } from 'react'
import { shopifyUrunuGetir, shopifyUrunuAktar, shopifyAktarilanGetir, shopifyUrunGuncelle, shopifySenkronize, shopifyResimTemizle, shopifyKoleksiyonTemizle, shopifyVideoTemizle, magazalariGetir, API_BASE } from './api'
import { Page, PageHeader, Button, Field, Input, Select, Textarea, SearchInput, Tabs, Segmented, Banner, Modal, EmptyState, LoadingRows, Skeleton, Menu, onayla, toast } from './ui'
import { RefreshCw, Download, Pencil, Sparkles, Images, FolderTree, Video, ChevronDown, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react'

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

const tl = v => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ShopifyUrunleri() {
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
      toast.success(`"${product.title}" aktarıldı.`)
      setImportModal(null)
      // Aktarılan ürünü listeden kaldır
      setProducts(prevProducts => prevProducts.filter(p => p.shopifyId !== product.shopifyId))
      loadImportedProducts() // İçe aktarılanlar listesini yenile
    } catch (err) {
      toast.error(`Aktarılamadı: ${err.message}`)
    } finally {
      setImporting(prev => ({ ...prev, [product.shopifyId]: false }))
    }
  }

  // Geçmişte oluşmuş mükerrer ürün fotoğraflarını Shopify tarafında temizler.
  // Sadece AYNI fotoğrafın fazla kopyaları silinir; tekil fotoğraflara dokunulmaz.
  async function handleResimTemizle() {
    if (!await onayla("Shopify'a gönderilmiş tüm ürünlerde mükerrer (çoklanmış) fotoğraflar silinecek. Her fotoğrafın ilk kopyası korunur.", { title: 'Mükerrer fotoğrafları temizle', confirmLabel: 'Fotoğrafları temizle', tone: 'critical' })) return
    try {
      setCleaning(true)
      setError('')
      const response = await shopifyResimTemizle()
      toast.success(`${response.silinen} mükerrer fotoğraf silindi (${response.islenen}/${response.toplam} ürün tarandı${response.atlanan ? `, ${response.atlanan} atlandı` : ''}).`)
    } catch (err) {
      toast.error(`Temizleme yapılamadı: ${err.message}`)
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
        toast.success(`Kopya koleksiyon bulunamadı (${rapor.toplamKoleksiyon} koleksiyon tarandı).`)
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
      const onay = await onayla(
        `${rapor.kopyaGrubu} adet aynı adlı koleksiyon grubu bulundu.\n` +
        `${rapor.silinen} kopya koleksiyon silinecek, içindeki ${rapor.tasinanUrun} ürün bağı en eski koleksiyona taşınacak.\n\n` +
        `${ornekler}${devami}${atlanan}\n\n` +
        'Bu işlem geri alınamaz.',
        { title: 'Kopya koleksiyonları birleştir', confirmLabel: `${rapor.silinen} koleksiyonu sil`, tone: 'critical' }
      )
      if (!onay) return
      const sonuc = await shopifyKoleksiyonTemizle({ kuru: false })
      toast.success(`${sonuc.silinen} kopya koleksiyon silindi, ${sonuc.tasinanUrun} ürün bağı taşındı.`)
    } catch (err) {
      toast.error(`Koleksiyon temizlenemedi: ${err.message}`)
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
        toast.success(`Mükerrer video bulunamadı (${rapor.toplamVideo} video dosyası tarandı).`)
        return
      }
      const ornekler = (rapor.detay || [])
        .slice(0, 10)
        .map(d => `• ${d.korunanDosya} — ${d.silinecekAdet} kopya`)
        .join('\n')
      const devami = (rapor.detay || []).length > 10 ? '\n• ...' : ''
      const onay = await onayla(
        `${rapor.toplamVideo} video dosyası tarandı.\n` +
        `${rapor.kopyaGrubu} grupta toplam ${rapor.silinen} fazla kopya silinecek.\n` +
        'Her gruptan bir dosya korunur; bir ürüne bağlı olan dosyalara dokunulmaz.\n\n' +
        `${ornekler}${devami}\n\n` +
        'Bu işlem geri alınamaz.',
        { title: 'Kopya videoları sil', confirmLabel: `${rapor.silinen} videoyu sil`, tone: 'critical' }
      )
      if (!onay) return
      const sonuc = await shopifyVideoTemizle({ kuru: false })
      toast.success(`${sonuc.silinen} mükerrer video dosyası silindi.`)
    } catch (err) {
      toast.error(`Video temizlenemedi: ${err.message}`)
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
      toast.success(response.mesaj)
      loadImportedProducts()
      loadShopifyProducts() // Shopify ürün listesini de yenile
    } catch (err) {
      toast.error(`Senkronizasyon yapılamadı: ${err.message}`)
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
    setDetailLoading(false)
  }

  async function handleUpdateProduct() {
    try {
      if (!editingId) return
      await shopifyUrunGuncelle(editingId, editForm)
      toast.success('Ürün güncellendi.')
      setEditingId(null)
      loadImportedProducts() // Güncellenen listeyi tekrar yükle
    } catch (err) {
      toast.error(`Ürün güncellenemedi: ${err.message}`)
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

  const detayAcik = detailProduct || detailLoading || detailError

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Page style={{ paddingBottom: 0, flexShrink: 0 }}>
        <PageHeader title="Shopify ürünleri" subtitle="Shopify mağazanızdaki ürünleri yönetin ve panelinize aktarın."
          actions={<>
            {/* Geçmişte çoklanmış fotoğrafları tek seferde temizler. Yayınlama akışı artık
                mükerrer yüklemiyor (bkz. backend reconcileShopifyProductImages) — bu araçlar
                sorun ortaya çıkmadan ÖNCE oluşmuş kopyaları düzeltmek içindir. */}
            <Menu trigger={({ toggle }) => (
              <Button icon={Sparkles} iconRight={ChevronDown} onClick={toggle} loading={cleaning}>{cleaning ? 'Temizleniyor…' : 'Temizlik araçları'}</Button>
            )} items={[
              { text: 'Mükerrer fotoğrafları temizle', icon: Images, onClick: handleResimTemizle, disabled: cleaning },
              { text: 'Kopya koleksiyonlar', icon: FolderTree, onClick: handleKoleksiyonTemizle, disabled: cleaning },
              { text: 'Kopya videolar', icon: Video, onClick: handleVideoTemizle, disabled: cleaning },
            ]} />
            {tab === 'imported' && <Button icon={RefreshCw} onClick={handleSync} loading={syncing}>{syncing ? 'Senkronize ediliyor…' : 'Senkronize et'}</Button>}
            <Button variant="primary" icon={RefreshCw} onClick={tab === 'shopify' ? loadShopifyProducts : loadImportedProducts} loading={loading}>
              {loading ? 'Yükleniyor…' : 'Yenile'}
            </Button>
          </>}>
          <Tabs value={tab} onChange={setTab} items={[
            { id: 'shopify', label: `Shopify ürünleri (${filteredProducts.length})` },
            { id: 'imported', label: `İçe aktarılanlar (${filteredImportedProducts.length})` },
          ]} />
        </PageHeader>
      </Page>

      <div ref={containerRef} className="vg-page" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 16 }}>
        {error && <Banner tone="critical">{error}</Banner>}

        <div className="vg-table-wrap">
          <div className="vg-table-toolbar">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün adı, marka, kod" aria-label="Ürün ara" style={{ flex: 1, minWidth: 200, maxWidth: 360 }} />
            {tab === 'shopify' && (
              <Segmented label="Durum" value={statusFilter} onChange={v => { setStatusFilter(v); setPage(0) }}
                options={[{ value: 'active', label: 'Aktif' }, { value: 'draft', label: 'Taslak' }, { value: 'all', label: 'Tümü' }]} />
            )}
          </div>

          {loading && <LoadingRows card={false} rows={8} />}

          {!loading && !error && currentItems.length > 0 && (
            <>
              <div className="vg-table-scroll">
                <table ref={tableRef} className="vg-table" style={{ minWidth: 720 }}>
                  <thead><tr><th>ID / kod</th><th>Ürün adı</th><th>Marka</th><th>Kategori</th><th className="is-num">Fiyat</th><th></th></tr></thead>
                  <tbody ref={tbodyRef}>
                    {currentItems.map((item, index) => {
                      // Her iki tab için ortak alanlar
                      const id = tab === 'shopify' ? (item.shopifyId || item.id) : item.kod;
                      const ad = tab === 'shopify' ? (item.title || item.handle) : item.ad;
                      const marka = tab === 'shopify' ? item.vendor : item.marka;
                      const kategori = tab === 'shopify' ? item.productType : item.kategori;
                      const price = tab === 'shopify' ? item.price : item.satisF;

                      return (
                        <tr key={id || index} className="is-clickable"
                          onClick={() => { if (tab === 'shopify') loadProductDetail(id); else openEditModal(item) }}>
                          <td className="vg-code vg-muted" style={{ maxWidth: 180 }}><div className="vg-truncate">{String(id || '').replace('gid://shopify/Product/', '')}</div></td>
                          <td className="is-strong">{ad}</td>
                          <td className="vg-muted">{marka || '—'}</td>
                          <td className="vg-muted">{kategori || '—'}</td>
                          <td className="is-num is-strong">{tl(price)}</td>
                          <td onClick={e => e.stopPropagation()}>
                            {tab === 'shopify' && (
                              <Button size="sm" icon={Download} onClick={() => handleImport(item)} loading={importing[item.shopifyId]}>
                                {importing[item.shopifyId] ? 'Aktarılıyor…' : 'Aktar'}
                              </Button>
                            )}
                            {tab === 'imported' && (
                              <Button size="sm" icon={Pencil} onClick={() => openEditModal(item)}>Düzenle</Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="vg-table-footer">
                <span className="vg-num">{start + 1}–{end} / {total} ürün</span>
                <div className="vg-row" style={{ gap: 6 }}>
                  <Button size="sm" icon={ChevronLeft} onClick={goPrev} disabled={page === 0}>Önceki</Button>
                  <span className="vg-num">{page + 1} / {totalPages}</span>
                  <Button size="sm" iconRight={ChevronRight} onClick={goNext} disabled={page >= totalPages - 1}>Sonraki</Button>
                  <Select size="sm" value={autoFit ? 'auto' : perPage} aria-label="Sayfa başına" style={{ width: 'auto' }} onChange={(e) => {
                    const v = e.target.value
                    if (v === 'auto') { setAutoFit(true); setPage(0) } else setPerPageFixed(Number(v))
                  }}>
                    <option value="auto">Ekrana sığdır</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </Select>
                </div>
              </div>
            </>
          )}

          {!loading && !error && currentItems.length === 0 && (
            <EmptyState icon={ShoppingCart} title={search ? `"${search}" ile eşleşen ürün yok` : 'Ürün bulunamadı'} />
          )}
        </div>
      </div>

      {detayAcik && (
        <Modal title={detailProduct?.title || 'Ürün detayı'} subtitle={detailProduct ? [detailProduct.vendor, detailProduct.productType].filter(Boolean).join(' · ') : undefined}
          onClose={closeDetailModal} size="xl">
          {detailLoading && <div className="vg-stack"><Skeleton h={160} /><Skeleton h={120} /></div>}
          {detailError && <Banner tone="critical">Ürün detayı alınamadı: {detailError}</Banner>}
          {detailProduct && <>
            <div className="vg-grid-2">
              <div className="vg-stack" style={{ gap: 4 }}>
                <div className="vg-kv"><span>Toplam stok</span><span>{detailProduct.totalInventory ?? '—'}</span></div>
                <div className="vg-kv"><span>Handle</span><span className="vg-code">{detailProduct.handle}</span></div>
              </div>
              {detailProduct.images?.edges?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {detailProduct.images.edges.slice(0, 3).map(({ node }, idx) => (
                    <img key={idx} src={node.url} alt={detailProduct.title} style={{ width: '100%', aspectRatio: '1', borderRadius: 8, objectFit: 'cover', boxShadow: 'inset 0 0 0 1px var(--line)' }} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="vg-section-label" style={{ marginBottom: 6 }}>Varyasyonlar</div>
              <div className="vg-table-wrap" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                <div className="vg-table-scroll">
                  <table className="vg-table vg-table--compact">
                    <thead><tr><th>Başlık</th><th className="is-num">Fiyat</th><th>SKU</th><th className="is-num">Stok</th><th>Barkod</th></tr></thead>
                    <tbody>
                      {detailProduct.variants?.edges?.map(({ node }) => (
                        <tr key={node.id}>
                          <td>{node.title}</td>
                          <td className="is-num">{tl(node.price)}</td>
                          <td className="vg-code">{node.sku || '—'}</td>
                          <td className="is-num">{node.inventoryQuantity ?? '—'}</td>
                          <td className="vg-code">{node.barcode || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="vg-grid-2">
              <div>
                <div className="vg-section-label" style={{ marginBottom: 6 }}>Metafield'lar</div>
                {detailProduct.metafields?.edges?.length > 0 ? (
                  <div className="vg-stack" style={{ gap: 6 }}>
                    {detailProduct.metafields.edges.map(({ node }) => (
                      <div key={node.id} className="vg-tile">
                        <div className="vg-code vg-muted">{node.namespace}.{node.key}</div>
                        <div style={{ fontSize: 13, marginTop: 2, wordBreak: 'break-word' }}>{node.value}</div>
                        {node.type && <div className="vg-help">{node.type}</div>}
                      </div>
                    ))}
                  </div>
                ) : <div className="vg-tile vg-muted" style={{ fontSize: 13 }}>Metafield yok.</div>}
              </div>
              <div>
                <div className="vg-section-label" style={{ marginBottom: 6 }}>Açıklama</div>
                <div className="vg-tile" style={{ minHeight: 120, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: '20px' }}>
                  {detailProduct.description || 'Açıklama yok.'}
                </div>
              </div>
            </div>
          </>}
        </Modal>
      )}

      {editingId && (
        <Modal title="Ürünü düzenle" onClose={() => setEditingId(null)}
          footer={<>
            <Button variant="plain" onClick={() => setEditingId(null)}>Vazgeç</Button>
            <Button variant="primary" onClick={handleUpdateProduct}>Değişiklikleri kaydet</Button>
          </>}>
          <Field label="Ürün adı" htmlFor="edit-ad"><Input id="edit-ad" value={editForm.ad || ''} onChange={e => setEditForm({ ...editForm, ad: e.target.value })} /></Field>
          <div className="vg-grid-2">
            <Field label="Alış fiyatı" htmlFor="edit-alisF"><Input id="edit-alisF" type="number" step="0.01" className="vg-num" value={editForm.alisF || ''} onChange={e => setEditForm({ ...editForm, alisF: e.target.value })} /></Field>
            <Field label="Satış fiyatı" htmlFor="edit-satisF"><Input id="edit-satisF" type="number" step="0.01" className="vg-num" value={editForm.satisF || ''} onChange={e => setEditForm({ ...editForm, satisF: e.target.value })} /></Field>
          </div>
          <div className="vg-grid-2">
            <Field label="Marka" htmlFor="edit-marka"><Input id="edit-marka" value={editForm.marka || ''} onChange={e => setEditForm({ ...editForm, marka: e.target.value })} /></Field>
            <Field label="KDV %" htmlFor="edit-kdv"><Input id="edit-kdv" type="number" className="vg-num" value={editForm.kdv || ''} onChange={e => setEditForm({ ...editForm, kdv: e.target.value })} /></Field>
          </div>
          <Field label="Kategori" htmlFor="edit-kategori"><Input id="edit-kategori" value={editForm.kategori || ''} onChange={e => setEditForm({ ...editForm, kategori: e.target.value })} /></Field>
          <Field label="Açıklama" htmlFor="edit-aciklama"><Textarea id="edit-aciklama" rows={3} value={editForm.aciklama || ''} onChange={e => setEditForm({ ...editForm, aciklama: e.target.value })} /></Field>
        </Modal>
      )}

      {importModal && (
        <Modal title="Hangi mağazaya aktarılsın?" onClose={() => setImportModal(null)}
          footer={<>
            <Button variant="plain" onClick={() => setImportModal(null)}>Vazgeç</Button>
            <Button variant="primary" icon={Download} onClick={confirmImport} disabled={!importMagazaId} loading={importing[importModal.shopifyId]}>
              {importing[importModal.shopifyId] ? 'Aktarılıyor…' : 'Ürünü aktar'}
            </Button>
          </>}>
          <p style={{ fontSize: 13, lineHeight: '20px' }}>
            <strong>{importModal.title}</strong> için mağaza bazlı stok kaydı bu mağazada oluşturulacak
            {importModal.inventoryQuantity != null && <> (başlangıç stoğu: <strong>{importModal.inventoryQuantity}</strong>, Shopify'daki mevcut adet)</>}.
          </p>
          {magazalar.length === 0 ? (
            <Banner tone="warning">Önce Mağazalar sayfasından en az bir mağaza ekleyin.</Banner>
          ) : (
            <Field label="Mağaza" htmlFor="imp-magaza">
              <Select id="imp-magaza" value={importMagazaId} onChange={e => setImportMagazaId(e.target.value)}>
                {magazalar.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
              </Select>
            </Field>
          )}
        </Modal>
      )}
    </div>
  )
}
