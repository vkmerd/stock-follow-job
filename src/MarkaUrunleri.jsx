import { useState, useEffect, useRef } from 'react'
import { API_BASE, markaGonderilenleriGetir, markaGonderildiKaydet } from './api'
import { Page, PageHeader, Button, IconButton, Field, Input, Select, SearchInput, Tabs, Badge, Banner, Modal, Tile, Checkbox, EmptyState, LoadingRows, Menu, MagazaIkon, onayla, toast } from './ui'
import { RefreshCw, ArrowDownToLine, Upload, Check, TriangleAlert, MoreHorizontal, Settings2, Eye, Tag, ChevronLeft, ChevronRight } from 'lucide-react'

const API_URL = `${API_BASE}/ticimax-urunler`
const NASBAG_API_URL = `${API_BASE}/nasbag-urunler`
const REFRESH_INTERVAL_MS = 120000 // 2 dakika
// Silver Polo ürünleri Shopify'a gönderilirken tedarikçi fiyatının üstüne konan çarpanlar
const SHOPIFY_FIYAT_CARPANI = 2
// Karşılaştırmalı (üstü çizili "compare at") fiyat için ayrı, daha yüksek çarpan
const SHOPIFY_KARSILASTIRMA_CARPANI = 2.40
// Nas Bag ürünleri Shopify'a gönderilirken Fiyat1'in üstüne konan çarpan
const NASBAG_FIYAT_CARPANI = 2.05

export default function MarkaUrunleri() {
  const [xmlRaw, setXmlRaw] = useState('')
  const [urunler, setUrunler] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedUrun, setSelectedUrun] = useState(null)
  const [mappingModalUrun, setMappingModalUrun] = useState(null)
  const [mappingState, setMappingState] = useState({
    title: 'urunAdi',
    body: 'aciklama',
    images: 'resimler',
    sku: 'stokKodu',
    inventory: 'stokAdedi'
  })
  const prevStockRef = useRef({})
  const containerRef = useRef(null)
  const tableRef = useRef(null)
  const tbodyRef = useRef(null)

  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(25)
  const [autoFit, setAutoFit] = useState(true)
  const [search, setSearch] = useState('')
  const [sekme, setSekme] = useState('liste') // 'liste' | 'gonderilenler' | 'nasbag'
  // Shopify'a gönderilen ürünler: { [urunKartiID]: { urunAdi, marka, tedarikciFiyati, gonderilenFiyat, tarih } }
  const [gonderilenler, setGonderilenler] = useState({})

  // Nas Bag canlı stok verisi
  const [nasbagUrunler, setNasbagUrunler] = useState([])
  const [nasbagLoading, setNasbagLoading] = useState(false)
  const [nasbagError, setNasbagError] = useState(null)
  const [nasbagSearch, setNasbagSearch] = useState('')
  const [nasbagPage, setNasbagPage] = useState(0)
  const NASBAG_PER_PAGE = 25
  // Nas Bag Shopify'a gönderilen ürünler: { [stokKod]: { baslik, tedarikciFiyati, gonderilenFiyat, tarih } }
  const [nasbagGonderilenler, setNasbagGonderilenler] = useState({})
  const [nasbagPublishing, setNasbagPublishing] = useState({})

  // Vega aktarım durumu: { [urunKartiID]: 'bekliyor' | 'aktariliyor' | 'tamam' | 'guncellendi' | 'hata' | hata_mesaji }
  const [aktarimDurum, setAktarimDurum] = useState({})
  const [magazaSecModal, setMagazaSecModal] = useState(null) // aktarılacak ürün
  const [magazalar, setMagazalar] = useState([])
  const [seciliMagazaId, setSeciliMagazaId] = useState('')

  // Shopify'a yayınlamadan önce koleksiyon seçimi
  const [koleksiyonModalUrun, setKoleksiyonModalUrun] = useState(null) // yayınlanacak ürün
  const [koleksiyonlar, setKoleksiyonlar] = useState([])
  const [koleksiyonlarYukleniyor, setKoleksiyonlarYukleniyor] = useState(false)
  const [seciliKoleksiyonIds, setSeciliKoleksiyonIds] = useState([])

  // Mağazaları yükle
  useEffect(() => {
    fetch(`${API_BASE}/magazalar`)
      .then(r => r.json())
      .then(data => {
        const liste = Array.isArray(data) ? data : []
        setMagazalar(liste)
        if (liste.length > 0) setSeciliMagazaId(liste[0].id)
      })
      .catch(() => {})
  }, [])

  const fetchUrunler = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(API_URL)
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`)
      }

      const data = await res.text()
      setXmlRaw(data)

      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(data, 'text/xml')
      const urunNodes = Array.from(xmlDoc.querySelectorAll('Root > Urunler > Urun'))

      const parsed = urunNodes.map((urun) => ({
        aktif: urun.querySelector('Aktif')?.textContent ?? '',
        urunKartiID: urun.querySelector('UrunKartiID')?.textContent ?? '',
        urunAdi: urun.querySelector('UrunAdi')?.textContent ?? '',
        onYazi: urun.querySelector('OnYazi')?.innerHTML?.trim() ?? '',
        aciklama: (() => {
          // Önce Aciklama / OnYazi alanlarını dene
          const temiz = (s) => (s || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
          const a = temiz(urun.querySelector('Aciklama')?.innerHTML ?? '')
          const o = temiz(urun.querySelector('OnYazi')?.innerHTML ?? '')
          const metin = a || o

          // TeknikDetaylar'ı HTML liste olarak oluştur
          const detaylar = Array.from(urun.querySelectorAll('TeknikDetaylar > TeknikDetay'))
          const teknikHtml = detaylar.length > 0
            ? '<ul>' + detaylar.map(d => {
                const tanim  = d.querySelector('OzellikTanim')?.textContent?.trim() ?? ''
                const deger  = d.querySelector('DegerTanim')?.textContent?.trim() ?? ''
                if (!tanim || !deger) return ''
                return `<li><strong>${tanim}:</strong> ${deger}</li>`
              }).filter(Boolean).join('') + '</ul>'
            : ''

          // İkisi varsa birleştir, sadece biri varsa onu döndür
          if (metin && teknikHtml) return metin + '<br/>' + teknikHtml
          return metin || teknikHtml || ''
        })(),
        marka: urun.querySelector('Marka')?.textContent ?? '',
        markaID: urun.querySelector('MarkaID')?.textContent ?? '',
        satisBirimi: urun.querySelector('SatisBirimi')?.textContent ?? '',
        kategoriID: urun.querySelector('KategoriID')?.textContent ?? '',
        kategori: urun.querySelector('Kategori')?.textContent ?? '',
        kategoriTree: urun.querySelector('KategoriTree')?.textContent ?? '',
        urunUrl: urun.querySelector('UrunUrl')?.textContent ?? '',
        ozelAlan1: urun.querySelector('OzelAlan1')?.textContent ?? '',
        // Resimler: hem URL hem renk attribute'u sakla (filtreleme için)
        resimler: Array.from(urun.querySelectorAll('Resimler > Resim')).map((node) => ({
          url:  node.textContent?.trim() ?? '',
          renk: node.getAttribute('Renk') || node.getAttribute('renk') || node.getAttribute('Color') || ''
        })).filter(r => r.url),
        secenekler: Array.from(urun.querySelectorAll('UrunSecenek > Secenek')).map((secenek) => ({
          aktif: secenek.querySelector('Aktif')?.textContent ?? '',
          varyasyonID: secenek.querySelector('VaryasyonID')?.textContent ?? '',
          stokKodu: secenek.querySelector('StokKodu')?.textContent ?? '',
          barkod: secenek.querySelector('Barkod')?.textContent ?? '',
          stokAdedi: secenek.querySelector('StokAdedi')?.textContent ?? '',
          alisFiyati: secenek.querySelector('AlisFiyati')?.textContent ?? '',
          satisFiyati: secenek.querySelector('SatisFiyati')?.textContent ?? '',
          indirimliFiyat: secenek.querySelector('IndirimliFiyat')?.textContent ?? '',
          kdvdahil: secenek.querySelector('KDVDahil')?.textContent ?? '',
          kdvOrani: secenek.querySelector('KdvOrani')?.textContent ?? '',
          paraBirimi: secenek.querySelector('ParaBirimi')?.textContent ?? '',
          paraBirimiKodu: secenek.querySelector('ParaBirimiKodu')?.textContent ?? '',
          desi: secenek.querySelector('Desi')?.textContent ?? '',
          ekSecenekOzellik: Array.from(secenek.querySelectorAll('EkSecenekOzellik > Ozellik')).map((ozellik) => ({
            tanim: ozellik.getAttribute('Tanim') ?? '',
            deger: ozellik.getAttribute('Deger') ?? '',
            text: ozellik.textContent ?? ''
          }))
        })),
        teknikDetaylar: Array.from(urun.querySelectorAll('TeknikDetaylar > TeknikDetay')).map((detay) => ({
          ozellikID: detay.querySelector('OzellikID')?.textContent ?? '',
          ozellikTanim: detay.querySelector('OzellikTanim')?.textContent ?? '',
          degerID: detay.querySelector('DegerID')?.textContent ?? '',
          degerTanim: detay.querySelector('DegerTanim')?.textContent ?? ''
        }))
      }))

      setUrunler(parsed)
    } catch (fetchError) {
      console.error('Ürünler alınırken hata oluştu:', fetchError)
      setError(fetchError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUrunler()
    const interval = setInterval(fetchUrunler, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // Nas Bag XML'ini çek — backend bu isteği kendi içinde günlük önbelliğe alıyor,
  // burada sık sık çağırmak Nas Bag'in sunucusuna gitmiyor.
  const fetchNasbagUrunler = async () => {
    setNasbagLoading(true)
    setNasbagError(null)
    try {
      const res = await fetch(NASBAG_API_URL)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

      const data = await res.text()
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(data, 'text/xml')
      const urunNodes = Array.from(xmlDoc.querySelectorAll('Urunler > Urun'))

      const parsed = urunNodes.map((urun) => ({
        stokKod: urun.querySelector('StokKod')?.textContent?.trim() ?? '',
        anaStokKodu: urun.querySelector('AnaStokKodu')?.textContent?.trim() ?? '',
        barkod: urun.querySelector('Barkod')?.textContent?.trim() ?? '',
        baslik: urun.querySelector('Baslik')?.textContent?.trim() ?? '',
        fiyat1: urun.querySelector('Fiyat1')?.textContent?.trim() ?? '',
        fiyat2: urun.querySelector('Fiyat2')?.textContent?.trim() ?? '',
        fiyat3: urun.querySelector('Fiyat3')?.textContent?.trim() ?? '',
        paraBirimi: urun.querySelector('Parabirimi')?.textContent?.trim() ?? '',
        kdv: urun.querySelector('Kdv')?.textContent?.trim() ?? '',
        stok: urun.querySelector('StokKalanMiktari')?.textContent?.trim() ?? '',
        renk: urun.querySelector('Renk')?.textContent?.trim() ?? '',
        beden: urun.querySelector('Beden')?.textContent?.trim() ?? '',
        detay: urun.querySelector('Detay')?.textContent?.trim() ?? '',
        resim: urun.querySelector('Resim')?.textContent?.trim() ?? ''
      }))

      setNasbagUrunler(parsed)
    } catch (fetchError) {
      console.error('Nas Bag ürünleri alınırken hata oluştu:', fetchError)
      setNasbagError(fetchError.message)
    } finally {
      setNasbagLoading(false)
    }
  }

  useEffect(() => {
    fetchNasbagUrunler()
    const interval = setInterval(fetchNasbagUrunler, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // Load saved mappings from localStorage
  useEffect(() => {
    try {
      const s = localStorage.getItem('shopifyMappings')
      if (s) setMappingState(JSON.parse(s))
    } catch (e) { console.warn('mapping load failed', e) }
  }, [])

  // Daha önce Shopify'a gönderilmiş ürünlerin kaydını veritabanından yükle
  // (önceden localStorage'daydı — cihaz/tarayıcı değişince kayboluyordu)
  useEffect(() => {
    markaGonderilenleriGetir('silverpolo')
      .then(liste => {
        const next = {}
        liste.forEach(k => { next[k.disKimlik] = { urunAdi: k.urunAdi, marka: k.marka, tedarikciFiyati: k.tedarikciFiyati, gonderilenFiyat: k.gonderilenFiyat, shopifyId: k.shopifyId, tarih: k.tarih } })
        setGonderilenler(next)
      })
      .catch(e => console.warn('gönderilenler yüklenemedi', e))
  }, [])

  useEffect(() => {
    markaGonderilenleriGetir('nasbag')
      .then(liste => {
        const next = {}
        liste.forEach(k => { next[k.disKimlik] = { baslik: k.urunAdi, tedarikciFiyati: k.tedarikciFiyati, gonderilenFiyat: k.gonderilenFiyat, shopifyId: k.shopifyId, tarih: k.tarih } })
        setNasbagGonderilenler(next)
      })
      .catch(e => console.warn('nasbag gönderilenler yüklenemedi', e))
  }, [])

  const gonderildiIsaretle = async (urun, gonderilenFiyat, tedarikciFiyati, shopifyId = null) => {
    const kayit = { urunAdi: urun.urunAdi, marka: urun.marka, tedarikciFiyati, gonderilenFiyat, shopifyId, tarih: new Date().toISOString() }
    setGonderilenler(prev => ({ ...prev, [urun.urunKartiID]: kayit }))
    try {
      await markaGonderildiKaydet({ kaynak: 'silverpolo', disKimlik: urun.urunKartiID, urunAdi: urun.urunAdi, marka: urun.marka, tedarikciFiyati, gonderilenFiyat, shopifyId })
    } catch (e) { console.warn('gönderildi kaydı veritabanına yazılamadı', e) }
  }

  const nasbagGonderildiIsaretle = async (urun, gonderilenFiyat, tedarikciFiyati, shopifyId = null) => {
    const kayit = { baslik: urun.baslik, tedarikciFiyati, gonderilenFiyat, shopifyId, tarih: new Date().toISOString() }
    setNasbagGonderilenler(prev => ({ ...prev, [urun.stokKod]: kayit }))
    try {
      await markaGonderildiKaydet({ kaynak: 'nasbag', disKimlik: urun.stokKod, urunAdi: urun.baslik, marka: 'Nas Bag', tedarikciFiyati, gonderilenFiyat, shopifyId })
    } catch (e) { console.warn('nasbag gönderildi kaydı veritabanına yazılamadı', e) }
  }

  const openMappingModal = (urun) => {
    setMappingModalUrun(urun)
  }

  const saveMapping = (newMapping) => {
    setMappingState(newMapping)
    try { localStorage.setItem('shopifyMappings', JSON.stringify(newMapping)) } catch (e) { console.warn(e) }
    setMappingModalUrun(null)
  }

  // Ticimax ürününü Vega stok yönetimine aktar (yeni ürün oluştur veya güncelle)
  const aktarVegaya = async (urun, magazaId) => {
    const id = urun.urunKartiID
    setAktarimDurum(s => ({ ...s, [id]: 'aktariliyor' }))
    setMagazaSecModal(null)
    try {
      // İlk seçenek fiyat/stok bilgilerini taşır; tüm seçenekler varyant olur
      const ilkSec = urun.secenekler[0] || {}

      // Renk ve beden bilgilerini EkSecenekOzellik'ten çıkar
      const renkBul = (sec) => {
        const ozellik = sec.ekSecenekOzellik?.find(o =>
          /renk|color/i.test(o.tanim || '')
        )
        return ozellik?.deger || ozellik?.text || null
      }
      const bedenBul = (sec) => {
        const ozellik = sec.ekSecenekOzellik?.find(o =>
          /beden|size|numara/i.test(o.tanim || '')
        )
        return ozellik?.deger || ozellik?.text || null
      }

      // TEKİL STOK: tüm seçeneklerin stoğunu topla, tek varyant olarak kaydet
      // Renk/beden bilgisi Shopify'a GÖNDERİLMEZ — varyasyonsuz ürün olarak yayınlanır
      const toplamAdet = urun.secenekler
        .filter(sec => sec.aktif !== '0')
        .reduce((t, sec) => t + (parseInt(sec.stokAdedi) || 0), 0)

      const varyantlar = [{
        renk:     null,   // TEKİL — renk yok
        beden:    null,   // TEKİL — beden yok
        adet:     toplamAdet,
        barkod:   ilkSec.barkod?.trim() || null,
        magazaId: magazaId  // kullanıcının seçtiği mağaza
      }]

      // Teknik detaylardan malzeme bilgisini çıkar
      const malzemeDet = urun.teknikDetaylar?.find(d =>
        /malzeme|material/i.test(d.ozellikTanim || '')
      )

      // İlk seçeneğin rengini bul — o rengin fotoğraflarını filtrele
      const ilkRenk = renkBul(ilkSec)

      // Resim filtreleme:
      // 1. Resimde renk attribute'u varsa sadece ilk varyant rengiyle eşleşenleri al
      // 2. Hiçbirinde renk yoksa (attribute yok) tümünü al
      // 3. Renk attribute'u olan ama eşleşmeyen varsa sadece eşleşenleri al
      const tumResimler = urun.resimler || []
      const renkliResimler = tumResimler.filter(r => r.renk)
      let seciliResimler
      if (renkliResimler.length === 0) {
        // Attribute yok — tüm resimler bu ürüne ait
        seciliResimler = tumResimler.map(r => r.url || r).filter(Boolean)
      } else if (ilkRenk) {
        // Renk attribute'u var — ilk varyant rengiyle eşleşenleri al
        const eslesenler = renkliResimler
          .filter(r => r.renk.toLowerCase().includes(ilkRenk.toLowerCase()) ||
                       ilkRenk.toLowerCase().includes(r.renk.toLowerCase()))
          .map(r => r.url)
        // Eşleşen yoksa rensiz olanları al, o da yoksa tümünü al
        const renksizler = tumResimler.filter(r => !r.renk).map(r => r.url)
        seciliResimler = eslesenler.length > 0 ? [...renksizler, ...eslesenler] : tumResimler.map(r => r.url || r)
      } else {
        // Renk attribute var ama ilk varyantın rengi bilinmiyor — rensiz olanları al
        seciliResimler = tumResimler.filter(r => !r.renk).map(r => r.url)
        if (seciliResimler.length === 0) seciliResimler = tumResimler.map(r => r.url || r)
      }

      const payload = {
        ad:          urun.urunAdi,
        aciklama:    urun.aciklama || urun.onYazi || '',
        marka:       urun.marka || '',
        kategori:    urun.kategori || '',
        altKategori: (() => {
          const parts = (urun.kategoriTree || '').split('>').map(s => s.trim()).filter(Boolean)
          return parts.length > 1 ? parts[parts.length - 1] : ''
        })(),
        alisF:       parseFloat(ilkSec.alisFiyati)  || 0,
        satisF:      parseFloat(ilkSec.satisFiyati) || 0,
        kdv:         parseInt(ilkSec.kdvOrani)      || 10,
        sku:         ilkSec.stokKodu?.trim() || '',
        barkod:      ilkSec.barkod?.trim()   || null,
        resimler:    seciliResimler.filter(Boolean),
        malzeme:     malzemeDet?.degerTanim  || null,
        ticimaxId:   String(id),
        aktif:       urun.aktif !== '0',
        video:       '',   // Ticimax'tan video gelmez — boş bırak, kullanıcı kendisi yüklesin
        varyantlar
      }

      // Önce bu ticimax ID ile kayıtlı ürün var mı bak
      const mevcutRes = await fetch(`${API_BASE}/urunler?ticimaxId=${encodeURIComponent(String(id))}`)
      const mevcutData = mevcutRes.ok ? await mevcutRes.json() : []
      // API array döndürüyor — ticimaxId'si tam eşleşen ilk ürünü al
      const liste = Array.isArray(mevcutData) ? mevcutData : (mevcutData.urunler || [])
      const mevcutUrun = liste.find(u => String(u.ticimaxId) === String(id))

      let res, sonuc
      if (mevcutUrun?.id) {
        // Güncelle
        res = await fetch(`${API_BASE}/urunler/${mevcutUrun.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        sonuc = 'guncellendi'
      } else {
        // Yeni ekle
        res = await fetch(`${API_BASE}/urunler`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        sonuc = 'tamam'
      }

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err)
      }

      setAktarimDurum(s => ({ ...s, [id]: sonuc }))
      // 3 saniye sonra durumu temizle
      setTimeout(() => setAktarimDurum(s => ({ ...s, [id]: null })), 3000)
    } catch (e) {
      console.error('Vega aktarım hatası:', e)
      setAktarimDurum(s => ({ ...s, [id]: 'hata: ' + (e.message || e) }))
    }
  }

  // Tüm filtrelenmiş ürünleri toplu aktar
  const topluAktar = async () => {
    if (!seciliMagazaId) { toast.warning('Önce bir mağaza seçin.'); return }
    if (!await onayla(`${filteredUrunler.length} ürün "${magazalar.find(m=>m.id===seciliMagazaId)?.ad}" mağazasına tekil stok olarak aktarılacak.`, { title: 'Toplu aktarım', confirmLabel: `${filteredUrunler.length} ürünü aktar`, tone: 'primary' })) return
    for (const urun of filteredUrunler) {
      await aktarVegaya(urun, seciliMagazaId)
    }
    toast.success(`${filteredUrunler.length} ürün için aktarım tamamlandı.`)
  }

  const publishToShopify = async (urun, koleksiyonIds = []) => {
    setLoading(true)
    try {
      // Tedarikçi (Silver Polo) fiyatının üstüne sabit çarpan konarak Shopify'a
      // gönderilecek satış fiyatı hesaplanır — Ticimax XML'inde fiyat ürün
      // üzerinde değil ilk seçenekte (secenekler[0].satisFiyati) tutuluyor.
      // Karşılaştırmalı (üstü çizili) fiyat, satış fiyatından AYRI ve daha yüksek
      // bir çarpanla (×2.40) aynı tedarikçi fiyatı baz alınarak hesaplanıyor.
      const ilkSec = urun.secenekler?.[0] || {}
      const tedarikciFiyati = parseFloat(ilkSec.indirimliFiyat) || parseFloat(ilkSec.satisFiyati) || 0
      const gonderilecekFiyat = Math.round(tedarikciFiyati * SHOPIFY_FIYAT_CARPANI * 100) / 100
      const karsilastirmaliFiyat = Math.round(tedarikciFiyati * SHOPIFY_KARSILASTIRMA_CARPANI * 100) / 100
      const gonderilecekUrun = { ...urun, satisF: gonderilecekFiyat, karsilastirmaliFiyat }

      const body = { urun: gonderilecekUrun, mapping: mappingState, koleksiyonIds }
      const res = await fetch('/api/shopify/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await res.text())
      const sonuc = await res.json().catch(() => ({}))
      gonderildiIsaretle(urun, gonderilecekFiyat, tedarikciFiyati, sonuc?.product?.id || null)
      toast.success(`Ürün Shopify mağazanıza gönderildi.
₺${tedarikciFiyati.toFixed(2)} × ${SHOPIFY_FIYAT_CARPANI} = ₺${gonderilecekFiyat.toFixed(2)} · karşılaştırmalı ₺${karsilastirmaliFiyat.toFixed(2)}`, 6000)
    } catch (e) {
      console.error(e)
      toast.error('Yayınlanamadı: ' + (e.message || e))
    } finally {
      setLoading(false)
    }
  }

  // Nas Bag ürününü Shopify'a gönderir — Silver Polo'dan farklı olarak tedarikçi
  // fiyatı (Fiyat1) tek başına ×2.05 çarpanıyla satış fiyatına çevrilir, karşılaştırmalı
  // (compare at) fiyat hesaplanmaz.
  const publishNasbagToShopify = async (urun) => {
    const id = urun.stokKod
    setNasbagPublishing(s => ({ ...s, [id]: true }))
    try {
      const tedarikciFiyati = parseFloat(String(urun.fiyat1 || '0').replace(',', '.')) || 0
      const gonderilecekFiyat = Math.round(tedarikciFiyati * NASBAG_FIYAT_CARPANI * 100) / 100

      const gonderilecekUrun = {
        urunAdi: urun.baslik,
        marka: 'Nas Bag',
        aciklama: urun.detay || '',
        barkod: urun.barkod,
        resimler: urun.resim ? [urun.resim] : [],
        secenekler: [{
          stokKodu: urun.stokKod,
          barkod: urun.barkod,
          stokAdedi: urun.stok,
          aktif: '1'
        }],
        satisF: gonderilecekFiyat
      }

      const body = { urun: gonderilecekUrun, mapping: mappingState }
      const res = await fetch('/api/shopify/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await res.text())
      const sonuc = await res.json().catch(() => ({}))
      nasbagGonderildiIsaretle(urun, gonderilecekFiyat, tedarikciFiyati, sonuc?.product?.id || null)
      toast.success(`Ürün Shopify mağazanıza gönderildi.
₺${tedarikciFiyati.toFixed(2)} × ${NASBAG_FIYAT_CARPANI} = ₺${gonderilecekFiyat.toFixed(2)}`, 6000)
    } catch (e) {
      console.error(e)
      toast.error('Yayınlanamadı: ' + (e.message || e))
    } finally {
      setNasbagPublishing(s => ({ ...s, [id]: false }))
    }
  }

  // "Yayınla" tıklanınca doğrudan göndermek yerine, hangi koleksiyon(lar)da
  // görünmesi gerektiğini seçtirmek için modalı açar ve koleksiyon listesini çeker.
  const openKoleksiyonModal = async (urun) => {
    setKoleksiyonModalUrun(urun)
    setSeciliKoleksiyonIds([])
    if (koleksiyonlar.length > 0) return // zaten yüklüyse tekrar çekme
    setKoleksiyonlarYukleniyor(true)
    try {
      const res = await fetch('/api/shopify/koleksiyonlar')
      if (!res.ok) throw new Error(await res.text())
      setKoleksiyonlar(await res.json())
    } catch (e) {
      console.error('Koleksiyonlar alınamadı:', e)
    } finally {
      setKoleksiyonlarYukleniyor(false)
    }
  }

  const koleksiyonSecimiToggle = (id) => {
    setSeciliKoleksiyonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const koleksiyonModalOnayla = async () => {
    const urun = koleksiyonModalUrun
    setKoleksiyonModalUrun(null)
    await publishToShopify(urun, seciliKoleksiyonIds)
  }

  const syncToShopify = async (urun) => {
    try {
      const payload = { urun, mapping: mappingState }
      const res = await fetch('/api/shopify/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error(await res.text())
      return true
    } catch (e) {
      console.error('sync failed', e)
      return false
    }
  }

  // Auto-sync stock changes to Shopify (checks differences)
  useEffect(() => {
    if (!urunler || urunler.length === 0) return
    urunler.forEach(async (u) => {
      const id = u.urunKartiID
      const stok = (u.secenekler[0] || {}).stokAdedi || '0'
      if (prevStockRef.current[id] == null) {
        prevStockRef.current[id] = stok
        return
      }
      if (String(prevStockRef.current[id]) !== String(stok)) {
        // stock changed locally, sync
        await syncToShopify(u)
        prevStockRef.current[id] = stok
      }
    })
  }, [urunler])

  // Calculate perPage to fit available container height when autoFit enabled
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
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [autoFit, urunler])

  // Filtering + pagination calculations
  const filteredUrunler = urunler.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    const first = (u.secenekler && u.secenekler[0]) || {}
    return String(u.urunAdi || '').toLowerCase().includes(q)
      || String(u.marka || '').toLowerCase().includes(q)
      || String(u.kategoriTree || '').toLowerCase().includes(q)
      || String(u.urunKartiID || '').toLowerCase().includes(q)
      || String(first.stokKodu || '').toLowerCase().includes(q)
  })
  const total = filteredUrunler.length
  const start = page * perPage
  const end = Math.min(total, start + perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage || 1))
  const currentItems = filteredUrunler.slice(start, end)

  const goPrev = () => setPage(p => Math.max(0, p - 1))
  const goNext = () => setPage(p => Math.min(totalPages - 1, p + 1))
  const setPerPageFixed = (n) => { setAutoFit(false); setPerPage(n); setPage(0) }

  // reset page on search change
  useEffect(() => { setPage(0) }, [search])

  // Nas Bag filtreleme + sayfalama
  const filteredNasbag = nasbagUrunler.filter(u => {
    if (!nasbagSearch) return true
    const q = nasbagSearch.toLowerCase()
    return String(u.baslik || '').toLowerCase().includes(q)
      || String(u.stokKod || '').toLowerCase().includes(q)
      || String(u.anaStokKodu || '').toLowerCase().includes(q)
      || String(u.barkod || '').toLowerCase().includes(q)
  })
  const nasbagTotal = filteredNasbag.length
  const nasbagStart = nasbagPage * NASBAG_PER_PAGE
  const nasbagEnd = Math.min(nasbagTotal, nasbagStart + NASBAG_PER_PAGE)
  const nasbagTotalPages = Math.max(1, Math.ceil(nasbagTotal / NASBAG_PER_PAGE || 1))
  const nasbagItems = filteredNasbag.slice(nasbagStart, nasbagEnd)

  useEffect(() => { setNasbagPage(0) }, [nasbagSearch])

  const tarihSaat = iso => new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const tl = v => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const AktarimButonu = ({ urun }) => {
    const durum = aktarimDurum[urun.urunKartiID]
    const hata = durum?.startsWith('hata')
    return (
      <Button size="sm" icon={durum === 'tamam' || durum === 'guncellendi' ? Check : hata ? TriangleAlert : ArrowDownToLine}
        variant={hata ? 'critical-plain' : 'secondary'}
        title={hata ? durum : 'Vega stok yönetimine aktar'}
        loading={durum === 'aktariliyor'}
        onClick={() => setMagazaSecModal(urun)}>
        {durum === 'tamam' ? 'Aktarıldı' : durum === 'guncellendi' ? 'Güncellendi' : hata ? 'Hata' : 'Vega'}
      </Button>
    )
  }

  const Sayfalama = ({ bas, son, toplam, sayfa, sayfaSayisi, onceki, sonraki, children }) => (
    <div className="vg-table-footer">
      <span className="vg-num">{toplam ? bas + 1 : 0}–{son} / {toplam}</span>
      <div className="vg-row" style={{ gap: 6 }}>
        <Button size="sm" icon={ChevronLeft} onClick={onceki} disabled={sayfa === 0}>Önceki</Button>
        <span className="vg-num">{sayfa + 1} / {sayfaSayisi}</span>
        <Button size="sm" iconRight={ChevronRight} onClick={sonraki} disabled={sayfa >= sayfaSayisi - 1}>Sonraki</Button>
        {children}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Page style={{ paddingBottom: 0, flexShrink: 0 }}>
        <PageHeader title="Marka ürünleri" subtitle="Silver Polo ve Nas Bag tedarikçi ürünlerini inceleyin, Vega'ya aktarın ve Shopify'da yayınlayın."
          actions={<>
            <Button icon={RefreshCw} onClick={sekme.startsWith('nasbag') ? fetchNasbagUrunler : fetchUrunler} loading={sekme.startsWith('nasbag') ? nasbagLoading : loading}>Yenile</Button>
            {!sekme.startsWith('nasbag') && (
              <Button variant="primary" icon={ArrowDownToLine} onClick={topluAktar} disabled={loading || filteredUrunler.length === 0}>
                Tümünü Vega'ya aktar ({filteredUrunler.length})
              </Button>
            )}
          </>}>
          <Tabs value={sekme} onChange={setSekme} items={[
            { id: 'liste', label: `Silver Polo (${urunler.length})` },
            { id: 'gonderilenler', label: `Silver Polo gönderilenler (${Object.keys(gonderilenler).length})` },
            { id: 'nasbag', label: `Nas Bag (${nasbagUrunler.length})` },
            { id: 'nasbag-gonderilenler', label: `Nas Bag gönderilenler (${Object.keys(nasbagGonderilenler).length})` },
          ]} />
        </PageHeader>
      </Page>

      <div ref={containerRef} className="vg-page" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 16 }}>
        {sekme === 'liste' && error && <Banner tone="critical">Silver Polo ürünleri alınamadı: {error}</Banner>}

        {sekme === 'liste' && (
          <div className="vg-table-wrap">
            <div className="vg-table-toolbar">
              <SearchInput placeholder="Ürün adı, marka, kod" aria-label="Silver Polo ürünlerinde ara" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200, maxWidth: 360 }} />
            </div>
            {loading && urunler.length === 0 && <LoadingRows card={false} rows={8} />}
            {!loading && !error && urunler.length === 0 && <EmptyState icon={Tag} title="Ürün bulunamadı" />}
            {!error && urunler.length > 0 && (
              <>
                <div className="vg-table-scroll">
                  <table ref={tableRef} className="vg-table" style={{ minWidth: 1000 }}>
                    <thead><tr><th>ID</th><th>Ürün adı</th><th>Marka</th><th>Kategori</th><th>Kod</th><th className="is-num">Stok</th><th className="is-num">Fiyat</th><th>İşlemler</th></tr></thead>
                    <tbody ref={tbodyRef}>
                      {currentItems.map((urun, index) => {
                        const firstSecenek = urun.secenekler[0] || {}
                        const gonderildi = !!gonderilenler[urun.urunKartiID]
                        return (
                          <tr key={urun.urunKartiID || index} className="is-clickable" onClick={() => setSelectedUrun(urun)}>
                            <td className="vg-code vg-muted">{urun.urunKartiID}</td>
                            <td>
                              <div className="is-strong">{urun.urunAdi}</div>
                              {gonderildi && <Badge tone="success" size="sm">Shopify'da</Badge>}
                            </td>
                            <td className="vg-muted">{urun.marka}</td>
                            <td className="vg-muted" style={{ maxWidth: 200 }}><div className="vg-truncate">{urun.kategoriTree}</div></td>
                            <td className="vg-code vg-muted">{firstSecenek.stokKodu || urun.ozelAlan1}</td>
                            <td className="is-num">{firstSecenek.stokAdedi || '—'}</td>
                            <td className="is-num">
                              {firstSecenek.indirimliFiyat ? (
                                <>
                                  <div className="vg-muted" style={{ textDecoration: 'line-through', fontSize: 12 }}>{firstSecenek.satisFiyati}</div>
                                  <div className="is-strong vg-text-critical">{firstSecenek.indirimliFiyat}</div>
                                </>
                              ) : <span className="is-strong">{firstSecenek.satisFiyati || '—'}</span>}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className="vg-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                                <Button size="sm" variant={gonderildi ? 'secondary' : 'primary'} icon={Upload} onClick={() => openKoleksiyonModal(urun)}>{gonderildi ? 'Yeniden gönder' : 'Yayınla'}</Button>
                                <AktarimButonu urun={urun} />
                                <Menu trigger={({ toggle }) => <IconButton icon={MoreHorizontal} label="Diğer işlemler" size="sm" onClick={toggle} />}
                                  items={[
                                    { text: 'Shopify eşlemesi', icon: Settings2, onClick: () => openMappingModal(urun) },
                                    { text: 'Stoğu senkronize et', icon: RefreshCw, onClick: async () => { const ok = await syncToShopify(urun); ok ? toast.success('Stok senkronize edildi.') : toast.error('Senkronizasyon yapılamadı.') } },
                                    { text: 'Detay', icon: Eye, onClick: () => setSelectedUrun(urun) },
                                  ]} />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Sayfalama bas={start} son={end} toplam={total} sayfa={page} sayfaSayisi={totalPages} onceki={goPrev} sonraki={goNext}>
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
                </Sayfalama>
              </>
            )}
          </div>
        )}

        {sekme === 'gonderilenler' && (
          <div className="vg-table-wrap">
            {Object.keys(gonderilenler).length === 0 ? (
              <EmptyState icon={Upload} title="Henüz Shopify'a gönderilmiş ürün yok" />
            ) : (
              <div className="vg-table-scroll">
                <table className="vg-table" style={{ minWidth: 760 }}>
                  <thead><tr><th>Ürün adı</th><th>Marka</th><th className="is-num">Tedarikçi fiyatı</th><th className="is-num">Gönderilen fiyat (×{SHOPIFY_FIYAT_CARPANI})</th><th>Gönderilme tarihi</th></tr></thead>
                  <tbody>
                    {Object.entries(gonderilenler)
                      .sort((a, b) => new Date(b[1].tarih) - new Date(a[1].tarih))
                      .map(([urunKartiID, kayit]) => (
                        <tr key={urunKartiID}>
                          <td className="is-strong">{kayit.urunAdi}</td>
                          <td className="vg-muted">{kayit.marka}</td>
                          <td className="is-num vg-muted">{tl(kayit.tedarikciFiyati)}</td>
                          <td className="is-num is-strong">{tl(kayit.gonderilenFiyat)}</td>
                          <td className="vg-nowrap vg-muted">{tarihSaat(kayit.tarih)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {sekme === 'nasbag' && nasbagError && <Banner tone="critical">Nas Bag ürünleri alınamadı: {nasbagError}</Banner>}

        {sekme === 'nasbag' && (
          <div className="vg-table-wrap">
            <div className="vg-table-toolbar">
              <SearchInput placeholder="Başlık, stok kodu, barkod" aria-label="Nas Bag ürünlerinde ara" value={nasbagSearch} onChange={(e) => setNasbagSearch(e.target.value)} style={{ flex: 1, minWidth: 200, maxWidth: 360 }} />
            </div>
            {nasbagLoading && nasbagUrunler.length === 0 && <LoadingRows card={false} rows={8} />}
            {!nasbagLoading && !nasbagError && nasbagUrunler.length === 0 && <EmptyState icon={Tag} title="Nas Bag ürünü bulunamadı" />}
            {!nasbagError && nasbagUrunler.length > 0 && (
              <>
                <div className="vg-table-scroll">
                  <table className="vg-table" style={{ minWidth: 960 }}>
                    <thead><tr><th style={{ width: 56 }}></th><th>Stok kodu</th><th>Başlık</th><th>Barkod</th><th>Renk / beden</th><th className="is-num">Stok</th><th className="is-num">Fiyat 1 / 2 / 3</th><th></th></tr></thead>
                    <tbody>
                      {nasbagItems.map((urun, index) => (
                        <tr key={urun.stokKod || index}>
                          <td>{urun.resim ? <img src={urun.resim} alt={urun.baslik} className="vg-thumb" /> : <span className="vg-thumb" style={{ display: 'block' }} />}</td>
                          <td>
                            <div className="vg-code is-strong">{urun.stokKod}</div>
                            {urun.anaStokKodu && urun.anaStokKodu !== '0' && <div className="vg-list__secondary">Ana: {urun.anaStokKodu}</div>}
                          </td>
                          <td>
                            <div>{urun.baslik}</div>
                            {nasbagGonderilenler[urun.stokKod] && <Badge tone="success" size="sm">Shopify'da</Badge>}
                          </td>
                          <td className="vg-code vg-muted">{urun.barkod}</td>
                          <td className="vg-muted">{urun.renk || '—'} / {urun.beden || '—'}</td>
                          <td className="is-num">{urun.stok || '0'}</td>
                          <td className="is-num vg-muted vg-nowrap">{urun.fiyat1} / {urun.fiyat2} / {urun.fiyat3} {urun.paraBirimi}</td>
                          <td>
                            <Button size="sm" variant={nasbagGonderilenler[urun.stokKod] ? 'secondary' : 'primary'} icon={Upload}
                              onClick={() => publishNasbagToShopify(urun)} loading={!!nasbagPublishing[urun.stokKod]}>
                              {nasbagGonderilenler[urun.stokKod] ? 'Yeniden gönder' : 'Yayınla'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Sayfalama bas={nasbagStart} son={nasbagEnd} toplam={nasbagTotal} sayfa={nasbagPage} sayfaSayisi={nasbagTotalPages}
                  onceki={() => setNasbagPage(p => Math.max(0, p - 1))} sonraki={() => setNasbagPage(p => Math.min(nasbagTotalPages - 1, p + 1))} />
              </>
            )}
          </div>
        )}

        {sekme === 'nasbag-gonderilenler' && (
          <div className="vg-table-wrap">
            {Object.keys(nasbagGonderilenler).length === 0 ? (
              <EmptyState icon={Upload} title="Henüz Shopify'a gönderilmiş Nas Bag ürünü yok" />
            ) : (
              <div className="vg-table-scroll">
                <table className="vg-table" style={{ minWidth: 760 }}>
                  <thead><tr><th>Başlık</th><th>Stok kodu</th><th className="is-num">Tedarikçi fiyatı</th><th className="is-num">Gönderilen fiyat (×{NASBAG_FIYAT_CARPANI})</th><th>Gönderilme tarihi</th></tr></thead>
                  <tbody>
                    {Object.entries(nasbagGonderilenler)
                      .sort((a, b) => new Date(b[1].tarih) - new Date(a[1].tarih))
                      .map(([stokKod, kayit]) => (
                        <tr key={stokKod}>
                          <td className="is-strong">{kayit.baslik}</td>
                          <td className="vg-code vg-muted">{stokKod}</td>
                          <td className="is-num vg-muted">{tl(kayit.tedarikciFiyati)}</td>
                          <td className="is-num is-strong">{tl(kayit.gonderilenFiyat)}</td>
                          <td className="vg-nowrap vg-muted">{tarihSaat(kayit.tarih)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ürün detayı */}
      {selectedUrun && (
        <Modal title={selectedUrun.urunAdi} subtitle={`Ürün ID ${selectedUrun.urunKartiID}`} onClose={() => setSelectedUrun(null)} size="xl" closeOnOverlay>
          {selectedUrun.resimler.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {selectedUrun.resimler.map((r, idx) => (
                <img key={idx} src={r.url || r} alt={selectedUrun.urunAdi} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, boxShadow: 'inset 0 0 0 1px var(--line)' }} />
              ))}
            </div>
          )}

          <div className="vg-grid-4" style={{ gap: 8 }}>
            <Tile label="Marka" value={<span style={{ fontSize: 14 }}>{selectedUrun.marka} <span className="vg-muted">({selectedUrun.markaID})</span></span>} />
            <Tile label="Kategori" value={<span style={{ fontSize: 13 }}>{selectedUrun.kategoriTree}</span>} />
            <Tile label="Satış birimi" value={<span style={{ fontSize: 14 }}>{selectedUrun.satisBirimi || '—'}</span>} />
            <Tile label="Durum" value={<Badge tone={selectedUrun.aktif === '1' ? 'success' : 'neutral'}>{selectedUrun.aktif === '1' ? 'Aktif' : 'Pasif'}</Badge>} />
          </div>

          {selectedUrun.secenekler.length > 0 && (
            <div>
              <div className="vg-section-label" style={{ marginBottom: 6 }}>Seçenekler ve fiyatlar</div>
              <div className="vg-table-wrap" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                <div className="vg-table-scroll">
                  <table className="vg-table vg-table--compact">
                    <thead><tr><th>Stok kodu</th><th>Barkod</th><th className="is-num">Adet</th><th className="is-num">Fiyat</th><th className="is-num">İndirimli</th></tr></thead>
                    <tbody>
                      {selectedUrun.secenekler.map((sec, idx) => (
                        <tr key={idx}>
                          <td className="vg-code">{sec.stokKodu}</td>
                          <td className="vg-code vg-muted">{sec.barkod}</td>
                          <td className="is-num">{sec.stokAdedi}</td>
                          <td className="is-num">{sec.satisFiyati}</td>
                          <td className="is-num is-strong">{sec.indirimliFiyat || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {selectedUrun.teknikDetaylar.length > 0 && (
            <div>
              <div className="vg-section-label" style={{ marginBottom: 6 }}>Teknik detaylar</div>
              <div className="vg-grid-2" style={{ gap: '0 16px' }}>
                {selectedUrun.teknikDetaylar.map((detay, idx) => (
                  <div key={idx} className="vg-kv" style={{ borderBottom: '1px solid var(--line)' }}><span>{detay.ozellikTanim}</span><span>{detay.degerTanim}</span></div>
                ))}
              </div>
            </div>
          )}

          {selectedUrun.aciklama && (
            <div>
              <div className="vg-section-label" style={{ marginBottom: 6 }}>Açıklama</div>
              <p className="vg-muted" style={{ fontSize: 13, lineHeight: '20px' }}>{selectedUrun.aciklama}</p>
            </div>
          )}

          {selectedUrun.onYazi && (
            <div>
              <div className="vg-section-label" style={{ marginBottom: 6 }}>Ön yazı</div>
              <p className="vg-muted" style={{ fontSize: 13, lineHeight: '20px' }}>{selectedUrun.onYazi}</p>
            </div>
          )}
        </Modal>
      )}

      {/* Eşleme */}
      {mappingModalUrun && (
        <Modal title="Shopify alan eşlemesi" subtitle={mappingModalUrun.urunAdi} onClose={() => setMappingModalUrun(null)} closeOnOverlay
          footer={<>
            <Button variant="plain" onClick={() => setMappingModalUrun(null)}>Vazgeç</Button>
            <Button variant="primary" onClick={() => saveMapping(mappingState)}>Eşlemeyi kaydet</Button>
          </>}>
          <div className="vg-grid-2">
            {[['title', 'Başlık alanı'], ['body', 'Açıklama alanı'], ['images', 'Resimler alanı'], ['sku', 'SKU alanı'], ['inventory', 'Stok alanı']].map(([k, l]) => (
              <Field key={k} label={l} htmlFor={`map-${k}`}>
                <Input id={`map-${k}`} mono value={mappingState[k]} onChange={(e) => setMappingState(s => ({ ...s, [k]: e.target.value }))} />
              </Field>
            ))}
          </div>
        </Modal>
      )}

      {/* Mağaza seçimi */}
      {magazaSecModal && (
        <Modal title="Mağaza seçin" onClose={() => setMagazaSecModal(null)}
          footer={<>
            <Button variant="plain" onClick={() => setMagazaSecModal(null)}>Vazgeç</Button>
            <Button variant="primary" icon={ArrowDownToLine} onClick={() => { if (seciliMagazaId) aktarVegaya(magazaSecModal, seciliMagazaId) }} disabled={!seciliMagazaId}>Aktar</Button>
          </>}>
          <p style={{ fontSize: 13, lineHeight: '20px' }}><strong>{magazaSecModal.urunAdi}</strong> hangi mağazaya tekil stok olarak aktarılsın?</p>
          <div className="vg-stack" style={{ gap: 6 }}>
            {magazalar.map(m => (
              <label key={m.id} className="vg-tile vg-check" style={{ cursor: 'pointer', boxShadow: seciliMagazaId === m.id ? 'inset 0 0 0 2px var(--accent)' : undefined }}>
                <input type="radio" name="aktar-magaza" checked={seciliMagazaId === m.id} onChange={() => setSeciliMagazaId(m.id)} />
                <MagazaIkon ikon={m.ikon} style={{ width: 14, height: 14 }} />{m.ad}
              </label>
            ))}
          </div>
        </Modal>
      )}

      {/* Koleksiyon seçimi */}
      {koleksiyonModalUrun && (
        <Modal title="Koleksiyon seçin" onClose={() => setKoleksiyonModalUrun(null)}
          footer={<>
            <Button variant="plain" onClick={() => setKoleksiyonModalUrun(null)}>Vazgeç</Button>
            <Button variant="primary" icon={Upload} onClick={koleksiyonModalOnayla}>
              Yayınla ({seciliKoleksiyonIds.length > 0 ? `${seciliKoleksiyonIds.length} koleksiyon` : 'otomatik'})
            </Button>
          </>}>
          <p style={{ fontSize: 13, lineHeight: '20px' }}>
            <strong>{koleksiyonModalUrun.urunAdi}</strong> Shopify'da hangi koleksiyonlarda görünsün? Hiçbiri seçilmezse ürün kategori ve alt kategori adına göre otomatik koleksiyonlanır.
          </p>
          {koleksiyonlarYukleniyor ? <LoadingRows card={false} rows={4} /> : koleksiyonlar.length === 0 ? (
            <EmptyState compact title="Shopify'da koleksiyon bulunamadı" />
          ) : (
            <div className="vg-stack" style={{ gap: 4, maxHeight: 320, overflowY: 'auto' }}>
              {koleksiyonlar.map(k => (
                <Checkbox key={k.id} className="vg-tile" style={{ cursor: 'pointer' }} checked={seciliKoleksiyonIds.includes(k.id)} onChange={() => koleksiyonSecimiToggle(k.id)} label={k.title} />
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
