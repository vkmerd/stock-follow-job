import { useState, useEffect, useRef } from 'react'
import { useVega } from './VegaContext'
import { API_BASE, markaGonderilenleriGetir, markaGonderildiKaydet } from './api'

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
  const { t } = useVega()
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
    if (!seciliMagazaId) { alert('Lütfen önce bir mağaza seçin.'); return }
    if (!window.confirm(`${filteredUrunler.length} ürün "${magazalar.find(m=>m.id===seciliMagazaId)?.ad}" mağazasına tekil stok olarak aktarılacak. Onaylıyor musunuz?`)) return
    for (const urun of filteredUrunler) {
      await aktarVegaya(urun, seciliMagazaId)
    }
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
      alert(`Ürün Shopify mağazanıza gönderildi / güncellendi (₺${tedarikciFiyati.toFixed(2)} × ${SHOPIFY_FIYAT_CARPANI} = ₺${gonderilecekFiyat.toFixed(2)}, karşılaştırmalı: ₺${karsilastirmaliFiyat.toFixed(2)})`)
    } catch (e) {
      console.error(e)
      alert('Yayınlama hatası: ' + (e.message || e))
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
      alert(`Ürün Shopify mağazanıza gönderildi / güncellendi (₺${tedarikciFiyati.toFixed(2)} × ${NASBAG_FIYAT_CARPANI} = ₺${gonderilecekFiyat.toFixed(2)})`)
    } catch (e) {
      console.error(e)
      alert('Yayınlama hatası: ' + (e.message || e))
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
          .vega-header-actions{width:100%;flex-wrap:wrap!important;}
          .vega-header-actions button{flex:1;min-width:140px;}
        }
      `}</style>
      {/* Header */}
      <div className="vega-page-pad" style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        <div className="vega-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 600 }}>Marka Ürünleri</h1>
            <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>Silver Polo ürünlerini yönetin ve detaylarını görün</p>
            <div style={{ marginTop: 8 }}>
              <input
                placeholder="Ürün adı, marka, kod ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.input, color: t.text, width: '100%', maxWidth: 380 }}
              />
            </div>
          </div>
          <div className="vega-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={fetchUrunler}
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: `1px solid ${t.accent}55`,
                background: t.accentBg,
                color: t.accent,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Yükleniyor...' : '↻ Yenile'}
            </button>
            <button
              onClick={topluAktar}
              disabled={loading || filteredUrunler.length === 0}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid #6fcf9755',
                background: 'rgba(111,207,151,0.1)',
                color: '#6fcf97',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                opacity: loading ? 0.6 : 1
              }}
            >
              ↓ Tümünü Vega'ya Aktar ({filteredUrunler.length})
            </button>
          </div>
        </div>

        {/* Sekmeler */}
        <div className="vega-tabs" style={{ display: 'flex', gap: 4, marginTop: 16 }}>
          {[
            ['liste', `Tüm Ürünler (${urunler.length})`],
            ['gonderilenler', `✓ Gönderilenler (${Object.keys(gonderilenler).length})`],
            ['nasbag', `Nas Bag (${nasbagUrunler.length})`],
            ['nasbag-gonderilenler', `✓ Nas Bag Gönderilenler (${Object.keys(nasbagGonderilenler).length})`],
          ].map(([id, etiket]) => (
            <button key={id} onClick={() => setSekme(id)} style={{
              padding: '8px 16px', borderRadius: '10px 10px 0 0', fontSize: 13,
              background: sekme === id ? t.accentBg : 'transparent',
              border: `1px solid ${sekme === id ? t.accent + '55' : 'transparent'}`,
              borderBottom: sekme === id ? `1px solid ${t.bg}` : '',
              color: sekme === id ? t.accent : t.textMuted, cursor: 'pointer'
            }}>{etiket}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={containerRef} className="vega-page-pad" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {sekme === 'liste' && error && (
          <div style={{ 
            padding: '12px 16px', 
            borderRadius: 8, 
            background: 'rgba(235,87,87,0.1)',
            border: `1px solid rgba(235,87,87,0.3)`,
            color: '#eb5757',
            marginBottom: 16,
            fontSize: 13
          }}>
            Hata: {error}
          </div>
        )}

        {sekme === 'liste' && !loading && !error && urunler.length > 0 && (
          <div style={{ borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            <div className="vega-scroll-x">
            <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: t.card, borderBottom: `1px solid ${t.border}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>ID</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ürün Adı</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Marka</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kategori</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kod</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stok</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fiyat</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Shopify</th>
                </tr>
              </thead>
              <tbody ref={tbodyRef}>
                {currentItems.map((urun, index) => {
                  const firstSecenek = urun.secenekler[0] || {}
                  return (
                    <tr 
                      key={urun.urunKartiID || index} 
                      onClick={() => setSelectedUrun(urun)}
                      style={{ 
                        borderBottom: `1px solid ${t.border}`,
                        cursor: 'pointer',
                        background: t.bg,
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = t.hover}
                      onMouseLeave={(e) => e.currentTarget.style.background = t.bg}
                    >
                      <td style={{ padding: '12px 16px', fontSize: 13, color: t.accent, fontWeight: 500 }}>{urun.urunKartiID}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{urun.urunAdi}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>{urun.marka}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>{urun.kategoriTree}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>{firstSecenek.stokKodu || urun.ozelAlan1}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{firstSecenek.stokAdedi || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>
                        {firstSecenek.indirimliFiyat ? (
                          <>
                            <div style={{ color: t.textMuted, textDecoration: 'line-through', fontSize: 12 }}>{firstSecenek.satisFiyati}</div>
                            <div style={{ color: '#eb5757', fontWeight: 600 }}>{firstSecenek.indirimliFiyat}</div>
                          </>
                        ) : (
                          <span style={{ color: t.accent, fontWeight: 500 }}>{firstSecenek.satisFiyati || '-'}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={(e) => { e.stopPropagation(); openMappingModal(urun) }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.textMuted, fontSize: 12 }}>Eşleme</button>
                          <button onClick={(e) => { e.stopPropagation(); openKoleksiyonModal(urun) }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.accent}33`, background: t.accentBg, color: t.accent, fontSize: 12 }}>
                            {gonderilenler[urun.urunKartiID] ? '✓ Yeniden Gönder' : 'Yayınla'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); syncToShopify(urun) }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 12 }}>Senkron</button>
                          {/* Vega aktarım butonu */}
                          {(() => {
                            const durum = aktarimDurum[urun.urunKartiID]
                            const renk = durum === 'tamam' ? '#6fcf97'
                              : durum === 'guncellendi' ? '#f2994a'
                              : durum?.startsWith('hata') ? '#eb5757'
                              : durum === 'aktariliyor' ? t.textMuted
                              : '#6fcf97'
                            const etiket = durum === 'tamam' ? '✓ Aktarıldı'
                              : durum === 'guncellendi' ? '✓ Güncellendi'
                              : durum?.startsWith('hata') ? '✕ Hata'
                              : durum === 'aktariliyor' ? '...'
                              : '↓ Vega'
                            return (
                              <button
                                title={durum?.startsWith('hata') ? durum : 'Vega Stok Yönetimine aktar'}
                                onClick={(e) => { e.stopPropagation(); setMagazaSecModal(urun); }}
                                disabled={durum === 'aktariliyor'}
                                style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${renk}55`, background: `${renk}15`, color: renk, fontSize: 12, cursor: durum === 'aktariliyor' ? 'wait' : 'pointer' }}
                              >{etiket}</button>
                            )
                          })()}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            {/* Pagination controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.bg, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ color: t.textMuted, fontSize: 13 }}>
                Gösterilen {start + 1} - {end} / {total}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={goPrev} disabled={page === 0} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted }}>Önceki</button>
                <div style={{ fontSize: 13, color: t.textMuted }}>{page + 1} / {totalPages}</div>
                <button onClick={goNext} disabled={page >= totalPages - 1} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted }}>Sonraki</button>
                <select value={autoFit ? 'auto' : perPage} onChange={(e) => {
                  const v = e.target.value
                  if (v === 'auto') { setAutoFit(true); setPage(0) } else setPerPageFixed(Number(v))
                }} style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text }}>
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

        {sekme === 'liste' && !loading && !error && urunler.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textMuted }}>
            <p style={{ fontSize: 14 }}>Ürün bulunamadı</p>
          </div>
        )}

        {sekme === 'gonderilenler' && (
          Object.keys(gonderilenler).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textMuted }}>
              <p style={{ fontSize: 14 }}>Henüz Shopify'a gönderilmiş ürün yok</p>
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
              <div className="vega-scroll-x">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: t.card, borderBottom: `1px solid ${t.border}` }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ürün Adı</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Marka</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tedarikçi Fiyatı</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gönderilen Fiyat (×{SHOPIFY_FIYAT_CARPANI})</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gönderilme Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(gonderilenler)
                    .sort((a, b) => new Date(b[1].tarih) - new Date(a[1].tarih))
                    .map(([urunKartiID, kayit]) => (
                      <tr key={urunKartiID} style={{ borderBottom: `1px solid ${t.border}` }}>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>{kayit.urunAdi}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>{kayit.marka}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>₺{Number(kayit.tedarikciFiyati).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: t.accent, fontWeight: 500 }}>₺{Number(kayit.gonderilenFiyat).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>
                          {new Date(kayit.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            </div>
          )
        )}

        {sekme === 'nasbag' && nasbagError && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(235,87,87,0.1)',
            border: `1px solid rgba(235,87,87,0.3)`,
            color: '#eb5757',
            marginBottom: 16,
            fontSize: 13
          }}>
            Hata: {nasbagError}
          </div>
        )}

        {sekme === 'nasbag' && (
          <div style={{ marginBottom: 14 }}>
            <input
              placeholder="Nas Bag ürünlerinde ara (başlık, stok kodu, barkod)..."
              value={nasbagSearch}
              onChange={(e) => setNasbagSearch(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.input, color: t.text, width: '100%', maxWidth: 380 }}
            />
          </div>
        )}

        {sekme === 'nasbag' && !nasbagLoading && !nasbagError && nasbagUrunler.length > 0 && (
          <div style={{ borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            <div className="vega-scroll-x">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: t.card, borderBottom: `1px solid ${t.border}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Resim</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stok Kodu</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Başlık</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Barkod</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Renk / Beden</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stok</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fiyat1 / 2 / 3</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Shopify</th>
                </tr>
              </thead>
              <tbody>
                {nasbagItems.map((urun, index) => (
                  <tr key={urun.stokKod || index} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: '8px 16px' }}>
                      {urun.resim ? (
                        <img src={urun.resim} alt={urun.baslik} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: `1px solid ${t.border}` }} />
                      ) : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: t.accent, fontWeight: 500 }}>
                      {urun.stokKod}
                      {urun.anaStokKodu && urun.anaStokKodu !== '0' && (
                        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 400 }}>Ana: {urun.anaStokKodu}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{urun.baslik}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>{urun.barkod}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>{urun.renk || '-'} / {urun.beden || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{urun.stok || '0'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>{urun.fiyat1} / {urun.fiyat2} / {urun.fiyat3} {urun.paraBirimi}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      <button
                        onClick={() => publishNasbagToShopify(urun)}
                        disabled={!!nasbagPublishing[urun.stokKod]}
                        style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.accent}33`, background: t.accentBg, color: t.accent, fontSize: 12, cursor: nasbagPublishing[urun.stokKod] ? 'wait' : 'pointer' }}
                      >
                        {nasbagPublishing[urun.stokKod] ? '...' : (nasbagGonderilenler[urun.stokKod] ? '✓ Yeniden Gönder' : 'Yayınla')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {/* Pagination controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.bg, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ color: t.textMuted, fontSize: 13 }}>
                Gösterilen {nasbagStart + 1} - {nasbagEnd} / {nasbagTotal}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setNasbagPage(p => Math.max(0, p - 1))} disabled={nasbagPage === 0} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted }}>Önceki</button>
                <div style={{ fontSize: 13, color: t.textMuted }}>{nasbagPage + 1} / {nasbagTotalPages}</div>
                <button onClick={() => setNasbagPage(p => Math.min(nasbagTotalPages - 1, p + 1))} disabled={nasbagPage >= nasbagTotalPages - 1} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted }}>Sonraki</button>
              </div>
            </div>
          </div>
        )}

        {sekme === 'nasbag' && !nasbagLoading && !nasbagError && nasbagUrunler.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textMuted }}>
            <p style={{ fontSize: 14 }}>Nas Bag ürünü bulunamadı</p>
          </div>
        )}

        {sekme === 'nasbag-gonderilenler' && (
          Object.keys(nasbagGonderilenler).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textMuted }}>
              <p style={{ fontSize: 14 }}>Henüz Shopify'a gönderilmiş Nas Bag ürünü yok</p>
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
              <div className="vega-scroll-x">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: t.card, borderBottom: `1px solid ${t.border}` }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Başlık</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stok Kodu</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tedarikçi Fiyatı</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gönderilen Fiyat (×{NASBAG_FIYAT_CARPANI})</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gönderilme Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(nasbagGonderilenler)
                    .sort((a, b) => new Date(b[1].tarih) - new Date(a[1].tarih))
                    .map(([stokKod, kayit]) => (
                      <tr key={stokKod} style={{ borderBottom: `1px solid ${t.border}` }}>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>{kayit.baslik}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>{stokKod}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>₺{Number(kayit.tedarikciFiyati).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: t.accent, fontWeight: 500 }}>₺{Number(kayit.gonderilenFiyat).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }}>
                          {new Date(kayit.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            </div>
          )
        )}
      </div>

      {/* Modal */}
      {selectedUrun && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgb(0, 0, 0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedUrun(null)}
        >
          <div 
            style={{
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              width: '100%',
              maxWidth: 900,
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 600 }}>{selectedUrun.urunAdi}</h2>
                <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Ürün ID: {selectedUrun.urunKartiID}</p>
              </div>
              <button 
                onClick={() => setSelectedUrun(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.bg,
                  color: t.text,
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {/* Resimler */}
              {selectedUrun.resimler.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: t.accent }}>Resimler</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {selectedUrun.resimler.map((r, idx) => (
                      <img 
                        key={idx} 
                        src={r.url || r} 
                        alt={selectedUrun.urunAdi} 
                        style={{ 
                          width: '100%', 
                          height: 200, 
                          objectFit: 'cover', 
                          borderRadius: 8,
                          border: `1px solid ${t.border}`
                        }} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Bilgiler */}
              <div className="vega-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                <div>
                  <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Marka</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{selectedUrun.marka} ({selectedUrun.markaID})</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Kategori</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{selectedUrun.kategoriTree}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Satış Birimi</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{selectedUrun.satisBirimi || '-'}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Durum</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: selectedUrun.aktif === '1' ? '#6fcf97' : '#eb5757' }}>
                    {selectedUrun.aktif === '1' ? '✓ Aktif' : '✕ Pasif'}
                  </p>
                </div>
              </div>

              {/* Seçenekler */}
              {selectedUrun.secenekler.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: t.accent }}>Seçenekler & Fiyatlar</h3>
                  <div style={{ borderRadius: 8, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                    <div className="vega-scroll-x">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: t.bg, borderBottom: `1px solid ${t.border}` }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stok Kodu</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Barkod</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Adet</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fiyat</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>İndirimli</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUrun.secenekler.map((sec, idx) => (
                          <tr key={idx} style={{ borderBottom: `1px solid ${t.border}` }}>
                            <td style={{ padding: '10px 12px', fontSize: 12 }}>{sec.stokKodu}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: t.textMuted }}>{sec.barkod}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12 }}>{sec.stokAdedi}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 500 }}>{sec.satisFiyati}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: t.accent, fontWeight: 500 }}>{sec.indirimliFiyat || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Teknik Detaylar */}
              {selectedUrun.teknikDetaylar.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: t.accent }}>Teknik Detaylar</h3>
                  <div className="vega-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {selectedUrun.teknikDetaylar.map((detay, idx) => (
                      <div key={idx}>
                        <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{detay.ozellikTanim}</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{detay.degerTanim}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Açıklama */}
              {selectedUrun.aciklama && (
                <div style={{ marginBottom: 28 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: t.accent }}>Açıklama</h3>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: t.textMuted }}>{selectedUrun.aciklama}</p>
                </div>
              )}

              {/* Ön Yazı */}
              {selectedUrun.onYazi && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: t.accent }}>Ön Yazı</h3>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: t.textMuted }}>{selectedUrun.onYazi}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mapping Modal */}
      {mappingModalUrun && (
        <div style={{ position: 'fixed', top:0,left:0,right:0,bottom:0,background:'rgb(0, 0, 0)', display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100 }} onClick={() => setMappingModalUrun(null)}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, width: '100%', maxWidth: 640, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
              <h3 style={{ margin:0 }}>{mappingModalUrun.urunAdi} - Shopify Eşleme</h3>
              <button onClick={() => setMappingModalUrun(null)} style={{ border:'none', background:'transparent', fontSize:18, cursor:'pointer' }}>✕</button>
            </div>
            <div className="vega-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ fontSize:12, color:t.textMuted }}>Başlık alanı</label>
                <input value={mappingState.title} onChange={(e) => setMappingState(s => ({ ...s, title: e.target.value }))} style={{ width:'100%', padding:8, borderRadius:8, border:`1px solid ${t.border}`, background:t.input, color:t.text }} />
              </div>
              <div>
                <label style={{ fontSize:12, color:t.textMuted }}>Açıklama alanı</label>
                <input value={mappingState.body} onChange={(e) => setMappingState(s => ({ ...s, body: e.target.value }))} style={{ width:'100%', padding:8, borderRadius:8, border:`1px solid ${t.border}`, background:t.input, color:t.text }} />
              </div>
              <div>
                <label style={{ fontSize:12, color:t.textMuted }}>Resimler alanı</label>
                <input value={mappingState.images} onChange={(e) => setMappingState(s => ({ ...s, images: e.target.value }))} style={{ width:'100%', padding:8, borderRadius:8, border:`1px solid ${t.border}`, background:t.input, color:t.text }} />
              </div>
              <div>
                <label style={{ fontSize:12, color:t.textMuted }}>SKU alanı</label>
                <input value={mappingState.sku} onChange={(e) => setMappingState(s => ({ ...s, sku: e.target.value }))} style={{ width:'100%', padding:8, borderRadius:8, border:`1px solid ${t.border}`, background:t.input, color:t.text }} />
              </div>
              <div>
                <label style={{ fontSize:12, color:t.textMuted }}>Stok alanı</label>
                <input value={mappingState.inventory} onChange={(e) => setMappingState(s => ({ ...s, inventory: e.target.value }))} style={{ width:'100%', padding:8, borderRadius:8, border:`1px solid ${t.border}`, background:t.input, color:t.text }} />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:14 }}>
              <button onClick={() => { setMappingModalUrun(null) }} style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${t.border}`, background:'transparent', color:t.textMuted }}>İptal</button>
              <button onClick={() => saveMapping(mappingState)} style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${t.accent}33`, background:t.accentBg, color:t.accent }}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Mağaza Seçim Modali */}
      {magazaSecModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#1a1814',border:`1px solid ${t.border}`,borderRadius:16,padding:28,width:380,maxWidth:'90vw'}}>
            <div style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:6}}>Mağaza Seçin</div>
            <div style={{fontSize:12,color:t.textMuted,marginBottom:18}}>
              <strong style={{color:t.accent}}>{magazaSecModal.urunAdi}</strong> hangi mağazaya tekil stok olarak aktarılsın?
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
              {magazalar.map(m => (
                <button key={m.id} onClick={() => setSeciliMagazaId(m.id)}
                  style={{padding:'10px 14px',borderRadius:10,textAlign:'left',cursor:'pointer',
                    border:`1px solid ${seciliMagazaId===m.id?t.accent+'88':t.border}`,
                    background:seciliMagazaId===m.id?t.accentBg:'transparent',
                    color:seciliMagazaId===m.id?t.accent:t.text,fontSize:13}}>
                  {m.ikon||'🏪'} {m.ad}
                  {seciliMagazaId===m.id&&<span style={{float:'right',fontSize:11}}>✓ Seçili</span>}
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setMagazaSecModal(null)}
                style={{flex:1,padding:'9px 0',borderRadius:10,border:`1px solid ${t.border}`,background:'transparent',color:t.textMuted,fontSize:13,cursor:'pointer'}}>
                İptal
              </button>
              <button onClick={()=>{ if(seciliMagazaId) aktarVegaya(magazaSecModal, seciliMagazaId) }}
                disabled={!seciliMagazaId}
                style={{flex:2,padding:'9px 0',borderRadius:10,border:`1px solid ${t.accent}55`,
                  background:t.accentBg,color:t.accent,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                ↓ Aktar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Koleksiyon Seçim Modali */}
      {koleksiyonModalUrun && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#1a1814',border:`1px solid ${t.border}`,borderRadius:16,padding:28,width:420,maxWidth:'90vw',maxHeight:'80vh',display:'flex',flexDirection:'column'}}>
            <div style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:6}}>Koleksiyon Seçin</div>
            <div style={{fontSize:12,color:t.textMuted,marginBottom:18}}>
              <strong style={{color:t.accent}}>{koleksiyonModalUrun.urunAdi}</strong> Shopify'da hangi koleksiyon(lar)da görünsün? Hiçbiri seçilmezse otomatik olarak ürünün kategori/alt kategori adına göre koleksiyonlanır.
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:20,overflowY:'auto',flex:1}}>
              {koleksiyonlarYukleniyor ? (
                <div style={{fontSize:13,color:t.textMuted,textAlign:'center',padding:20}}>Koleksiyonlar yükleniyor...</div>
              ) : koleksiyonlar.length === 0 ? (
                <div style={{fontSize:13,color:t.textMuted,textAlign:'center',padding:20}}>Shopify'da koleksiyon bulunamadı</div>
              ) : koleksiyonlar.map(k => {
                const secili = seciliKoleksiyonIds.includes(k.id)
                return (
                  <button key={k.id} onClick={() => koleksiyonSecimiToggle(k.id)}
                    style={{padding:'10px 14px',borderRadius:10,textAlign:'left',cursor:'pointer',
                      border:`1px solid ${secili?t.accent+'88':t.border}`,
                      background:secili?t.accentBg:'transparent',
                      color:secili?t.accent:t.text,fontSize:13}}>
                    {k.title}
                    {secili && <span style={{float:'right',fontSize:11}}>✓ Seçili</span>}
                  </button>
                )
              })}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setKoleksiyonModalUrun(null)}
                style={{flex:1,padding:'9px 0',borderRadius:10,border:`1px solid ${t.border}`,background:'transparent',color:t.textMuted,fontSize:13,cursor:'pointer'}}>
                İptal
              </button>
              <button onClick={koleksiyonModalOnayla}
                style={{flex:2,padding:'9px 0',borderRadius:10,border:`1px solid ${t.accent}55`,
                  background:t.accentBg,color:t.accent,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                ↑ Yayınla ({seciliKoleksiyonIds.length > 0 ? `${seciliKoleksiyonIds.length} koleksiyon` : 'otomatik'})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}