import { useState, useEffect } from 'react'
import { useVega } from './VegaContext'
import { siparisleriGetir, siparisGetir, siparisDurumGuncelle, urunleriGetir, bankaHesaplariGetir, shopifySiparisleriSenkronize, API_BASE } from './api'
import { Page, PageHeader, Button, IconButton, Field, Input, Select, Textarea, Tabs, Segmented, Badge, Banner, Modal, StatCard, EmptyState, LoadingRows, alpha, onayla, toast } from './ui'
import {
  Plus, RefreshCw, Download, List, Columns3, X, Search, Printer, Truck, Phone, MapPin, MessageSquare,
  ShoppingBag, Globe, ShoppingCart, Monitor, Camera, PenLine, Undo2, Check, Package,
} from 'lucide-react'

const ODEME_TIPLERI_ONLINE = [
  { id:'kredi_karti',    label:'Kredi kartı' },
  { id:'eft',            label:'EFT / havale' },
  { id:'kapida_odeme',   label:'Kapıda ödeme' },
]

const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const tarih = iso => new Date(iso).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
const sure  = dk => dk < 60 ? `${dk} dk` : `${Math.floor(dk/60)} sa ${dk%60} dk`

// Pazaryeri renkleri markanın kendi rengidir; yalnızca küçük ikon kutusunda kullanılır.
const KANALLAR = [
  { id:'hepsi',      label:'Tümü',          ikon:Package,      renk:'var(--ink-muted)' },
  { id:'trendyol',   label:'Trendyol',       ikon:ShoppingBag,  renk:'#f27a1a' },
  { id:'hepsiburada',label:'Hepsiburada',    ikon:ShoppingBag,  renk:'#ff6000' },
  { id:'n11',        label:'N11',            ikon:ShoppingBag,  renk:'#5f3dc4' },
  { id:'web',        label:'Web sitesi',     ikon:Globe,        renk:'var(--accent)' },
  { id:'shopify',    label:'Shopify',        ikon:ShoppingCart, renk:'#5e8e3e' },
  { id:'online',     label:'Online',         ikon:Monitor,      renk:'var(--success)' },
  { id:'telefon',    label:'Telefon',        ikon:Phone,        renk:'var(--warning)' },
  { id:'instagram',  label:'Instagram',      ikon:Camera,       renk:'#c13584' },
  { id:'manuel',     label:'Manuel',         ikon:PenLine,      renk:'var(--ink-muted)' },
]

const DURUMLAR = [
  { id:'beklemede',       label:'Beklemede',       ton:'warning',  sira:1 },
  { id:'hazirlaniyor',    label:'Hazırlanıyor',     ton:'info',     sira:2 },
  { id:'paketlendi',      label:'Paketlendi',       ton:'violet',   sira:3 },
  { id:'kargoda',         label:'Kargoya verildi',  ton:'orange',   sira:4 },
  { id:'teslim_edildi',   label:'Teslim edildi',    ton:'success',  sira:5 },
  { id:'iptal',           label:'İptal',            ton:'critical', sira:6 },
  { id:'iade_edildi',     label:'İade edildi',      ton:'neutral',  sira:7 },
]

const KARGO_FIRMALARI = ['Yurtiçi Kargo','Aras Kargo','MNG Kargo','PTT Kargo','Sürat Kargo','DHL','UPS']

const musteriAdi = s => s.musteriAd||`${s.musteri?.ad||''} ${s.musteri?.soyad||''}`.trim()||'—'

function KanalIkon({ kanal, size=24 }) {
  const k = KANALLAR.find(x=>x.id===kanal) || KANALLAR[1]
  const Ic = k.ikon
  return (
    <span title={k.label} style={{
      display:'inline-grid',placeItems:'center',width:size,height:size,borderRadius:6,flexShrink:0,
      background:alpha(k.renk, 14),color:k.renk
    }}><Ic className="vg-icon" style={{ width: size*0.6, height: size*0.6 }} /></span>
  )
}

function DurumBadge({ durum }) {
  const d = DURUMLAR.find(x=>x.id===durum)||DURUMLAR[0]
  return <Badge tone={d.ton}>{d.label}</Badge>
}

// ─── ONLİNE İADE MODAL ───────────────────────────────────────
function OnlineIadeModal({ onKaydet, onKapat }) {
  const [sipNo, setSipNo]   = useState('')
  const [siparis, setSiparis] = useState(null)
  const [seciliKalemler, setSeciliKalemler] = useState({})
  const [odemeYontemi, setOdemeYontemi] = useState('nakit')
  const [aramak, setAramak] = useState(false)
  const [kayit, setKayit]   = useState(false)
  const [hata, setHata]     = useState('')

  const siparisAra = async () => {
    if (!sipNo.trim()) return
    setAramak(true); setHata('')
    try {
      const res = await fetch(`${API_BASE}/siparisler?q=${encodeURIComponent(sipNo)}&limit=5`)
      const d = await res.json()
      const bulunan = Array.isArray(d) ? d.find(s => s.siparisNo?.includes(sipNo) || s.fisNo?.includes(sipNo)) : null
      if (bulunan) setSiparis(bulunan)
      else setHata('Bu numarayla sipariş bulunamadı.')
    } catch { setHata('Arama yapılamadı. Bağlantıyı kontrol edin.') }
    finally { setAramak(false) }
  }

  const iadeTutari = siparis ? Object.entries(seciliKalemler).reduce((t,[id,adet])=>{
    const k=(siparis.kalemler||[]).find(k=>k.id===id)
    return t+Number(k?.birimFiyat||0)*adet
  },0) : 0

  const kaydet = async () => {
    const secili = Object.entries(seciliKalemler).filter(([,v])=>v>0)
    if (!secili.length) return setHata('En az bir ürün seçin.')
    setKayit(true); setHata('')
    try {
      const kalemler = secili.map(([id, adet]) => {
        const k = (siparis.kalemler||[]).find(k=>k.id===id)
        return { urunId:k?.urunId, urunAd:k?.urunAd, renk:k?.renk, beden:k?.beden, adet, birimFiyat:k?.birimFiyat, toplamIade:Number(k?.birimFiyat||0)*adet }
      })
      const toplamIade = kalemler.reduce((t,k)=>t+Number(k.toplamIade),0)

      // API_BASE zaten /api ile bitiyor (bkz. api.js)
      const res = await fetch(`${API_BASE}/iadeler`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          iadeNo: `I-${(siparis.siparisNo||siparis.fisNo||'').replace(/[^0-9]/g,'').slice(-6)||Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`,
          siparisId:  siparis.id || null,
          satisId:    null,
          kalemler:   kalemler.map(k=>({ urunId:k.urunId||null, urunAd:k.urunAd||'', renk:k.renk||null, beden:k.beden||null, adet:Number(k.adet)||1, birimFiyat:Number(k.birimFiyat)||0, toplam:Number(k.toplamIade)||0 })),
          toplam:     toplamIade,
          toplamIade: toplamIade,
          notlar: `Online sipariş iadesi: ${siparis.siparisNo||siparis.fisNo} - ${odemeYontemi}`
        })
      })
      if (!res.ok) throw new Error('İade oluşturulamadı.')

      await fetch(`${API_BASE}/siparisler/${siparis.id}/durum`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ durum: 'iade_edildi' })
      }).catch(()=>{})

      toast.success('İade oluşturuldu.')
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <Modal title="Yeni iade" onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" icon={Undo2} onClick={kaydet} disabled={!siparis} loading={kayit}>{kayit?'Kaydediliyor…':'İadeyi oluştur'}</Button>
      </>}>
      <Field label="Sipariş / fiş no" htmlFor="oi-no">
        <div className="vg-row" style={{ flexWrap: 'nowrap' }}>
          <Input id="oi-no" mono value={sipNo} onChange={e=>setSipNo(e.target.value)} onKeyDown={e=>e.key==='Enter'&&siparisAra()} placeholder="SP-001234 veya F-0042" />
          <Button icon={Search} onClick={siparisAra} loading={aramak}>{aramak?'Aranıyor…':'Ara'}</Button>
        </div>
      </Field>

      {siparis && (
        <>
          <div className="vg-tile">
            <div className="vg-code" style={{ fontSize: 13 }}>{siparis.siparisNo||siparis.fisNo}</div>
            <div className="vg-list__secondary">{siparis.musteriAd||siparis.musteri?.ad||'—'} · {siparis.odemeTip||siparis.odemeler?.[0]?.tip||'—'} · {para(siparis.genelToplam)}</div>
          </div>

          <div>
            <div className="vg-section-label" style={{ marginBottom: 4 }}>İade edilecek ürünler</div>
            <ul className="vg-list">
              {(siparis.kalemler||[]).map(k=>(
                <li key={k.id} className="vg-list__item" style={{ padding: '8px 0' }}>
                  <div className="vg-list__main">
                    <div className="vg-list__primary">{k.urunAd}</div>
                    <div className="vg-list__secondary">{k.renk}{k.beden?` / ${k.beden}`:''} · {para(k.birimFiyat)}</div>
                  </div>
                  <div className="vg-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <Input size="sm" type="number" min={0} max={k.adet} value={seciliKalemler[k.id]||0} aria-label={`${k.urunAd} iade adedi`}
                      onChange={e=>setSeciliKalemler(p=>({...p,[k.id]:Math.min(k.adet,Math.max(0,Number(e.target.value)))}))}
                      className="vg-num" style={{ width: 64, textAlign: 'center' }} />
                    <span className="vg-muted" style={{ fontSize: 12 }}>/ {k.adet}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <Field label="İade ödeme yöntemi">
            <Segmented label="İade ödeme yöntemi" value={odemeYontemi} onChange={setOdemeYontemi} className="vg-segmented--block"
              options={[{ value:'nakit', label:'Nakit' }, { value:'kart', label:'Kart' }, { value:'havale', label:'Havale' }]} />
          </Field>

          <div className="vg-kv vg-kv--total"><span>İade tutarı</span><span>{para(iadeTutari)}</span></div>
        </>
      )}

      {hata&&<Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

// ─── MANUEL SİPARİŞ MODAL ────────────────────────────────────
function ManuelSiparisModal({ onKaydet, onKapat, magazalar }) {
  const bugun = new Date().toISOString().slice(0,10)
  const suAnSaat = new Date().toTimeString().slice(0,5)
  const { aktifMagaza } = useVega()
  const fizikselMagazalar = (magazalar||[]).filter(m => m.tip !== 'online')
  const varsayilanMagazaId = (aktifMagaza && aktifMagaza !== 'hepsi') ? aktifMagaza : (fizikselMagazalar[0]?.id || '')
  const [form, setForm] = useState({
    kanal: 'instagram', musteriAd: '', musteriTel: '', adres: '', magazaId: varsayilanMagazaId,
    odemeTip: 'kapida_odeme', bankaHesapId: '', notlar: '', ozelNot: '',
    tarih: bugun, saat: suAnSaat, genelToplam: '', kalemler: [{ urunAd:'', renk:'', beden:'', adet:1, birimFiyat:'' }]
  })
  const [bankaHesaplari, setBankaHesaplari] = useState([])
  const [urunDb, setUrunDb] = useState([])
  const [musteriOneri, setMusteriOneri] = useState([])
  const [musteriOneriAcik, setMusteriOneriAcik] = useState(false)
  const [musteriId, setMusteriId] = useState(null)
  const [urunArama, setUrunArama] = useState('')
  const [urunOneri, setUrunOneri] = useState([])
  const [aktifKalemIdx, setAktifKalemIdx] = useState(null)
  const [kayit, setKayit] = useState(false)
  const [hata, setHata] = useState('')

  useEffect(() => {
    bankaHesaplariGetir().then(setBankaHesaplari).catch(()=>[])
    urunleriGetir().then(setUrunDb).catch(()=>[])
  }, [])

  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  const musteriAra = async (q) => {
    g('musteriAd', q)
    setMusteriId(null)
    if (q.length >= 2) {
      try {
        const res = await fetch(`${API_BASE}/musteriler?q=${encodeURIComponent(q)}&limit=5`)
        const d = await res.json()
        setMusteriOneri(Array.isArray(d) ? d : [])
        setMusteriOneriAcik((Array.isArray(d) ? d : []).length > 0)
      } catch { setMusteriOneri([]) }
    } else {
      setMusteriOneri([])
      setMusteriOneriAcik(false)
    }
  }

  const musteriSec = (m) => {
    g('musteriAd', `${m.ad} ${m.soyad||''}`.trim())
    g('musteriTel', m.telefon || form.musteriTel)
    g('adres', m.adres || form.adres)
    setMusteriId(m.id)
    setMusteriOneri([])
    setMusteriOneriAcik(false)
  }

  const urunSec = (urun, varyant, idx) => {
    const cp = [...form.kalemler]
    cp[idx] = {
      ...cp[idx],
      urunId:     urun.id,
      urunAd:     urun.ad,
      marka:      urun.marka || '',
      renk:       varyant?.renk || cp[idx].renk || '',
      beden:      varyant?.beden || cp[idx].beden || '',
      stok:       varyant?.adet || 0,
      birimFiyat: Number(urun.satisF) || cp[idx].birimFiyat,
    }
    const toplam = cp.reduce((t,k) => t + (Number(k.adet||1) * Number(k.birimFiyat||0)), 0)
    setForm(p=>({...p, kalemler: cp, genelToplam: toplam.toFixed(2)}))
    setUrunOneri([])
    setUrunArama('')
    setAktifKalemIdx(null)
  }

  const urunAra = (q, idx) => {
    setUrunArama(q)
    setAktifKalemIdx(idx)
    if (q.length >= 2) {
      const sonuc = urunDb.filter(u =>
        u.ad?.toLowerCase().includes(q.toLowerCase()) ||
        u.barkod?.includes(q) ||
        u.kod?.toLowerCase().includes(q.toLowerCase()) ||
        (u.varyantlar||[]).some(v => v.barkod?.includes(q))
      ).slice(0, 6)
      setUrunOneri(sonuc)
      // Barkod tam eşleşmesi varsa direkt seç
      if (q.length >= 8) {
        for (const u of urunDb) {
          const eslesenV = (u.varyantlar||[]).find(v => v.barkod === q)
          if (eslesenV) { urunSec(u, eslesenV, idx); return; }
        }
      }
    } else {
      setUrunOneri([])
    }
  }

  const kalemGuncelle = (i, k, v) => {
    const cp = [...form.kalemler]
    cp[i] = {...cp[i], [k]: v}
    // Toplam hesapla
    const toplam = cp.reduce((t,k) => t + (Number(k.adet||1) * Number(k.birimFiyat||0)), 0)
    setForm(p=>({...p, kalemler: cp, genelToplam: toplam.toFixed(2)}))
  }

  const kalemEkle = () => setForm(p=>({...p, kalemler:[...p.kalemler,{urunAd:'',renk:'',beden:'',adet:1,birimFiyat:''}]}))
  const kalemSil = (i) => setForm(p=>({...p, kalemler:p.kalemler.filter((_,idx)=>idx!==i)}))

  const kaydet = async () => {
    if (!form.musteriAd.trim()) return setHata('Müşteri adı zorunlu.')
    if (!form.genelToplam || Number(form.genelToplam) <= 0) return setHata('Toplam tutar zorunlu.')
    if (form.odemeTip === 'eft' && !form.bankaHesapId) return setHata('EFT/havale için tutarın işleneceği banka hesabını seçin.')
    setHata(''); setKayit(true)
    try {
      const siparisNo = `SP-${Date.now().toString().slice(-6)}`
      const res = await fetch(`${API_BASE}/siparisler`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          siparisNo,
          kanal:       form.kanal,
          magazaId:    form.magazaId || null,
          musteriId:   musteriId || null,
          musteriAd:   form.musteriAd || null,
          musteriTel:  form.musteriTel || null,
          adres:       form.adres || null,
          odemeTip:    form.odemeTip,
          bankaHesapId: form.odemeTip === 'eft' ? form.bankaHesapId : null,
          ozelNot:     form.ozelNot || null,
          notlar:      form.notlar || null,
          genelToplam: Number(form.genelToplam),
          durum:       'beklemede',
          // form.tarih/form.saat tarayıcının local saatinde girilir — `new Date("YYYY-MM-DDTHH:MM")`
          // bunu local saat olarak yorumlayıp doğru UTC anına çevirir (eskiden sabit "T12:00:00Z"
          // kullanılıyordu, bu da TR saatinde (+3) her zaman 15:00 gösteriyordu).
          tarih:       new Date(`${form.tarih}T${form.saat || '12:00'}:00`).toISOString(),
          kalemler:    form.kalemler.filter(k=>k.urunAd).map(k=>({
            urunId:     k.urunId || null,
            urunAd:     k.urunAd,
            renk:       k.renk || null,
            beden:      k.beden || null,
            adet:       Number(k.adet) || 1,
            birimFiyat: Number(k.birimFiyat) || 0,
            toplam: Number(k.adet||1) * Number(k.birimFiyat||0),
          }))
        })
      })
      if (!res.ok) throw new Error('Sipariş kaydedilemedi.')
      await res.json()
      // NOT: Yeni müşteri CRM kaydı backend'de /siparisler route'unda
      // "bul veya oluştur" ile yapılıyor. Burada ayrıca POST /musteriler
      // atmak çift kayda yol açtığı için kaldırıldı.
      toast.success(`${siparisNo} numaralı sipariş oluşturuldu.`)
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  const oneriKutusu = { position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:20, background:'var(--surface)', borderRadius:8, boxShadow:'var(--shadow-popover)', overflow:'hidden', maxHeight: 280, overflowY: 'auto' }

  return (
    <Modal title="Manuel sipariş" onClose={onKapat} size="lg"
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" icon={Check} onClick={kaydet} loading={kayit}>{kayit?'Kaydediliyor…':'Siparişi oluştur'}</Button>
      </>}>
      <Field label="Kanal">
        <div className="vg-row" style={{ gap: 6 }}>
          {KANALLAR.filter(k=>k.id!=='hepsi').map(k=>(
            <button key={k.id} type="button" className="vg-chip" aria-pressed={form.kanal===k.id} onClick={()=>g('kanal',k.id)}>
              <k.ikon className="vg-icon" style={{ width: 14, height: 14 }} />{k.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Stok mağazası" help="Barkodlu ürünler bu mağazanın stoğundan düşülür.">
        <div className="vg-row" style={{ gap: 6 }}>
          {fizikselMagazalar.map(m=>(
            <button key={m.id} type="button" className="vg-chip" aria-pressed={form.magazaId===m.id} onClick={()=>g('magazaId',m.id)}>{m.ad}</button>
          ))}
          {fizikselMagazalar.length===0 && <span className="vg-help">Önce Mağazalar sayfasından bir mağaza ekleyin.</span>}
        </div>
      </Field>

      <div className="vg-grid-2">
        <Field label="Müşteri adı" htmlFor="ms-musteri" action={musteriId && <Badge tone="success" size="sm">CRM'den seçildi</Badge>}>
          <div style={{ position: 'relative' }}>
            <Input id="ms-musteri" value={form.musteriAd} onChange={e=>musteriAra(e.target.value)} autoComplete="off"
              onFocus={()=>form.musteriAd.length>=2&&setMusteriOneriAcik(true)}
              onBlur={()=>setTimeout(()=>setMusteriOneriAcik(false),200)}
              placeholder="Ad soyad veya telefon" />
            {musteriOneriAcik && musteriOneri.length>0 && (
              <div style={oneriKutusu}>
                {musteriOneri.map(m=>(
                  <button key={m.id} type="button" className="vg-list__item vg-list__item--button" onMouseDown={e=>e.preventDefault()} onClick={()=>musteriSec(m)}>
                    <div className="vg-list__main">
                      <div className="vg-list__primary">{m.ad} {m.soyad||''}</div>
                      <div className="vg-list__secondary vg-truncate">{m.telefon||''} {m.adres?'· '+m.adres.slice(0,30):''}</div>
                    </div>
                  </button>
                ))}
                <button type="button" className="vg-menu__item" style={{ width: '100%', borderTop: '1px solid var(--line)', borderRadius: 0, color: 'var(--ink-muted)' }}
                  onMouseDown={e=>e.preventDefault()} onClick={()=>setMusteriOneriAcik(false)}>
                  <Plus className="vg-icon" /> Yeni müşteri olarak devam et
                </button>
              </div>
            )}
          </div>
        </Field>
        <Field label="Telefon" htmlFor="ms-tel"><Input id="ms-tel" value={form.musteriTel} onChange={e=>g('musteriTel',e.target.value)} placeholder="05xx xxx xx xx" /></Field>
      </div>

      <Field label="Teslimat adresi" htmlFor="ms-adres">
        <Textarea id="ms-adres" value={form.adres} onChange={e=>g('adres',e.target.value)} rows={2} placeholder="Mahalle, sokak, no, şehir" />
      </Field>

      <Field label="Ödeme tipi">
        <Segmented label="Ödeme tipi" value={form.odemeTip} onChange={v=>g('odemeTip',v)} className="vg-segmented--block"
          options={ODEME_TIPLERI_ONLINE.map(o=>({ value:o.id, label:o.label }))} />
        {form.odemeTip==='kapida_odeme'&&(
          <Banner tone="warning" style={{ marginTop: 8 }}>Kapıda ödeme kasaya yansımaz. Teslimattan sonra manuel giriş gerekebilir.</Banner>
        )}
        {form.odemeTip==='eft'&&(
          bankaHesaplari.length>0?(
            <Select value={form.bankaHesapId} onChange={e=>g('bankaHesapId',e.target.value)} aria-label="Banka hesabı" style={{ marginTop: 8 }} aria-invalid={!form.bankaHesapId || undefined}>
              <option value="">Tutarın işleneceği banka hesabını seçin</option>
              {bankaHesaplari.map(h=><option key={h.id} value={h.id}>{h.ad} · {h.banka}</option>)}
            </Select>
          ):(
            <Banner tone="critical" style={{ marginTop: 8 }}>Kayıtlı banka hesabı yok. Banka ve mutabakat sayfasından hesap ekleyin; aksi halde tutar hiçbir hesaba işlenmez.</Banner>
          )
        )}
      </Field>

      <div>
        <div className="vg-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="vg-label">Ürünler</span>
          <Button size="sm" icon={Plus} onClick={kalemEkle}>Ürün ekle</Button>
        </div>
        <div className="vg-stack" style={{ gap: 8 }}>
          {form.kalemler.map((k,i)=>(
            <div key={i} className="vg-tile vg-stack" style={{ gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <div className="vg-input-group">
                  <Search className="vg-icon" />
                  <Input value={aktifKalemIdx===i ? urunArama : k.urunAd} autoComplete="off"
                    onChange={e=>{ kalemGuncelle(i,'urunAd',e.target.value); urunAra(e.target.value,i); }}
                    onFocus={()=>{ setAktifKalemIdx(i); setUrunArama(k.urunAd||''); }}
                    onBlur={()=>setTimeout(()=>{ setUrunOneri([]); setAktifKalemIdx(null); },200)}
                    placeholder="Ürün adı, barkod veya kod" aria-label="Ürün ara" />
                </div>
                {aktifKalemIdx===i && urunOneri.length>0 && (
                  <div style={oneriKutusu}>
                    {urunOneri.map(u=>{
                      const varyantlar = (u.varyantlar||[])
                      return (
                        <div key={u.id}>
                          <div className="vg-menu__label" style={{ background: 'var(--surface-sunken)', color: 'var(--ink)', fontWeight: 600 }}>
                            {u.ad} · {u.marka} · {para(u.satisF)}
                          </div>
                          {varyantlar.length>0 ? varyantlar.slice(0,4).map((v,vi)=>(
                            <button key={vi} type="button" className="vg-menu__item" style={{ width: '100%' }} onMouseDown={e=>e.preventDefault()} onClick={()=>urunSec(u,v,i)}>
                              <span style={{ fontWeight: 500 }}>{v.renk}{v.beden?` / ${v.beden}`:''}</span>
                              <Badge tone={v.adet>0?'success':'critical'} size="sm">Stok {v.adet}</Badge>
                              {v.barkod&&<span className="vg-code vg-muted" style={{ marginLeft: 'auto' }}>{v.barkod}</span>}
                            </button>
                          )) : (
                            <button type="button" className="vg-menu__item" style={{ width: '100%' }} onMouseDown={e=>e.preventDefault()} onClick={()=>urunSec(u,null,i)}>Varyant yok, ürünü ekle</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr)) auto', gap: 6 }}>
                <Input size="sm" value={k.renk} onChange={e=>kalemGuncelle(i,'renk',e.target.value)} placeholder="Renk" aria-label="Renk" />
                <Input size="sm" value={k.beden} onChange={e=>kalemGuncelle(i,'beden',e.target.value)} placeholder="Beden" aria-label="Beden" />
                <Input size="sm" type="number" className="vg-num" value={k.adet} onChange={e=>kalemGuncelle(i,'adet',e.target.value)} placeholder="Adet" aria-label="Adet" />
                <Input size="sm" type="number" className="vg-num" value={k.birimFiyat} onChange={e=>kalemGuncelle(i,'birimFiyat',e.target.value)} placeholder="Fiyat ₺" aria-label="Birim fiyat" />
                <IconButton icon={X} label="Ürünü kaldır" size="sm" variant="critical-plain" onClick={()=>kalemSil(i)} />
              </div>
              {k.barkod&&<div className="vg-code vg-muted">#{k.barkod}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="vg-grid-2">
        <Field label="Toplam tutar" htmlFor="ms-toplam">
          <div className="vg-input-group">
            <Input id="ms-toplam" type="number" className="vg-num" value={form.genelToplam} onChange={e=>g('genelToplam',e.target.value)} style={{ paddingRight: 28, fontWeight: 600 }} />
            <span className="vg-input-suffix">₺</span>
          </div>
        </Field>
        <Field label="Sipariş tarihi">
          <div className="vg-row" style={{ flexWrap: 'nowrap', gap: 6 }}>
            <Input type="date" value={form.tarih} onChange={e=>g('tarih',e.target.value)} aria-label="Tarih" style={{ flex: 2 }} />
            <Input type="time" value={form.saat} onChange={e=>g('saat',e.target.value)} aria-label="Saat" style={{ flex: 1 }} />
          </div>
        </Field>
      </div>

      <Field label="Müşteri notu" htmlFor="ms-not"><Input id="ms-not" value={form.ozelNot} onChange={e=>g('ozelNot',e.target.value)} placeholder="Hediye paketi vb." /></Field>

      {hata&&<Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

// ─── KARGO MODAL ──────────────────────────────────────────────
function KargoModal({ siparis, onKaydet, onKapat }) {
  const [kargoFirma, setKargoFirma] = useState(siparis.kargoFirma||KARGO_FIRMALARI[0])
  const [kargoNo, setKargoNo]       = useState(siparis.kargoNo||'')
  const [kayit, setKayit]           = useState(false)

  const yazdirEtiket = () => {
    const win = window.open('','_blank','width=500,height=400')
    win.document.write(`<!DOCTYPE html><html><head><title>Kargo Etiketi</title>
    <style>body{font-family:Arial;padding:20px;font-size:12px;}
    .box{border:2px solid #000;padding:16px;max-width:380px;}
    h2{margin:0 0 10px;font-size:16px;} .row{display:flex;justify-content:space-between;margin-bottom:6px;}
    .big{font-size:20px;font-weight:bold;text-align:center;padding:10px;border:1px solid #000;margin:10px 0;}
    </style></head><body>
    <div class="box">
      <h2>${kargoFirma} - Kargo Etiketi</h2>
      <div class="row"><span>Sipariş No:</span><span>${siparis.siparisNo}</span></div>
      <div class="row"><span>Müşteri:</span><span>${siparis.musteriAd||siparis.musteri?.ad||'—'}</span></div>
      <div class="row"><span>Adres:</span><span style="max-width:180px;text-align:right">${siparis.adres||'—'}</span></div>
      <div class="row"><span>Kanal:</span><span>${siparis.kanal||'—'}</span></div>
      <div class="big">${kargoNo||'TAKİP NO GİRİLMEDİ'}</div>
      <div class="row"><span>Tutar:</span><span>${para(siparis.genelToplam)}</span></div>
      <div class="row"><span>Tarih:</span><span>${new Date().toLocaleDateString('tr-TR')}</span></div>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  const kaydet = async () => {
    setKayit(true)
    try {
      await siparisDurumGuncelle(siparis.id, { durum:'kargoda', kargoNo, kargoFirma })
      toast.success(`${siparis.siparisNo} kargoya verildi.`)
      onKaydet()
    } catch(e) { toast.error(e.message) }
    finally { setKayit(false) }
  }

  return (
    <Modal title="Kargoya ver" subtitle={siparis.siparisNo} onClose={onKapat}
      footer={<>
        <Button icon={Printer} onClick={yazdirEtiket} style={{ marginRight: 'auto' }}>Etiket yazdır</Button>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" icon={Truck} onClick={kaydet} loading={kayit}>Kargoya ver</Button>
      </>}>
      <Field label="Kargo firması">
        <div className="vg-row" style={{ gap: 6 }}>
          {KARGO_FIRMALARI.map(f=>(
            <button key={f} type="button" className="vg-chip" aria-pressed={kargoFirma===f} onClick={()=>setKargoFirma(f)}>{f}</button>
          ))}
        </div>
      </Field>
      <Field label="Takip numarası" htmlFor="kg-no"><Input id="kg-no" mono value={kargoNo} onChange={e=>setKargoNo(e.target.value)} placeholder="Kargo takip numarası" /></Field>
      <Banner icon={MapPin}>Teslimat adresi: {siparis.adres||'Adres girilmemiş'}</Banner>
    </Modal>
  )
}

// ─── QUICK VIEW DRAWER ────────────────────────────────────────
function QuickView({ siparisId, onKapat, onDurumGuncelle }) {
  const [siparis, setSiparis] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [durumGuncelleniyor, setDurumGuncelleniyor] = useState(false)
  const [kargoModal, setKargoModal] = useState(false)

  useEffect(() => {
    siparisGetir(siparisId).then(setSiparis).catch(console.error).finally(()=>setYukleniyor(false))
  }, [siparisId])

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape' && !kargoModal && !document.querySelector('.vg-overlay')) onKapat() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [kargoModal, onKapat])

  // İptal/iade durumları stoğu hareket ettiriyor: bu duruma GEÇİŞ stoğu geri verir,
  // buradan ÇIKIŞ ise stoğu tekrar düşer (bkz. routes/siparisler.js). Artık her durum
  // her zaman seçilebildiği için yanlış tıklama stok sayısını kaydırabilir — bu iki yön
  // için onay isteniyor.
  const STOK_ETKILEYEN_DURUMLAR = ['iptal', 'iade_edildi']

  const durumGuncelle = async (yeniDurum) => {
    if (yeniDurum === 'kargoda') return setKargoModal(true)
    const oncekiStokluMu = STOK_ETKILEYEN_DURUMLAR.includes(siparis?.durum)
    const yeniStokluMu   = STOK_ETKILEYEN_DURUMLAR.includes(yeniDurum)
    if (oncekiStokluMu !== yeniStokluMu) {
      const mesaj = yeniStokluMu
        ? 'Sipariş ürünleri stoğa geri eklenecek.'
        : 'Sipariş yeniden aktif hale geliyor; ürünler stoktan tekrar düşülecek.'
      if (!await onayla(mesaj, { title: 'Stok değişecek', confirmLabel: 'Durumu değiştir', tone: 'primary' })) return
    }
    setDurumGuncelleniyor(true)
    try {
      await siparisDurumGuncelle(siparisId, { durum: yeniDurum })
      const guncellendi = await siparisGetir(siparisId)
      setSiparis(guncellendi)
      toast.success(`Durum güncellendi: ${DURUMLAR.find(d=>d.id===yeniDurum)?.label}.`)
      onDurumGuncelle()
    } catch(e) { toast.error(e.message) }
    finally { setDurumGuncelleniyor(false) }
  }

  const k = siparis ? KANALLAR.find(x=>x.id===siparis.kanal)||KANALLAR[1] : null

  return (
    <div className="vg-drawer-wrap">
      <div className="vg-drawer-scrim" onClick={onKapat} />
      <aside className="vg-drawer" role="dialog" aria-modal="true" aria-label="Sipariş detayı">
        {yukleniyor ? (
          <LoadingRows card={false} rows={6} />
        ) : !siparis ? (
          <EmptyState title="Sipariş bulunamadı" actions={<Button onClick={onKapat}>Kapat</Button>} />
        ) : (
          <>
            <div className="vg-drawer__header">
              <KanalIkon kanal={siparis.kanal} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="vg-code" style={{ fontSize: 15, fontWeight: 600 }}>{siparis.siparisNo}</div>
                <div className="vg-list__secondary">{tarih(siparis.tarih)} · {k?.label}</div>
                <div style={{ marginTop: 6 }}><DurumBadge durum={siparis.durum} /></div>
              </div>
              <IconButton icon={X} label="Kapat" size="sm" onClick={onKapat} />
            </div>

            <div className="vg-drawer__body">
              <section className="vg-drawer__section">
                <div className="vg-section-label">Müşteri</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{musteriAdi(siparis)}</div>
                {(siparis.musteriTel||siparis.musteri?.telefon)&&(
                  <div className="vg-row vg-muted" style={{ gap: 6, fontSize: 13 }}><Phone className="vg-icon" style={{ width: 14, height: 14 }} />{siparis.musteriTel||siparis.musteri?.telefon}</div>
                )}
                {siparis.adres&&(
                  <div className="vg-row" style={{ gap: 6, fontSize: 13, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <MapPin className="vg-icon" style={{ width: 14, height: 14, marginTop: 2, color: 'var(--ink-muted)' }} />
                    <a className="vg-link" href={`https://maps.google.com/?q=${encodeURIComponent(siparis.adres)}`} target="_blank" rel="noreferrer">{siparis.adres}</a>
                  </div>
                )}
                {siparis.ozelNot&&<Banner tone="warning" icon={MessageSquare}>{siparis.ozelNot}</Banner>}
              </section>

              <section className="vg-drawer__section">
                <div className="vg-section-label">Ürünler ({siparis.kalemler?.length||0})</div>
                <ul className="vg-list">
                  {(siparis.kalemler||[]).map((k,i)=>(
                    <li key={i} className="vg-list__item" style={{ padding: '8px 0' }}>
                      <div className="vg-list__main">
                        <div className="vg-list__primary">{k.urunAd||k.urun?.ad||'—'}</div>
                        <div className="vg-list__secondary">{k.renk&&`${k.renk}`}{k.beden&&` / ${k.beden}`} · ×{k.adet}</div>
                      </div>
                      <div className="vg-list__value">{para(k.toplamFiyat||k.birimFiyat*k.adet)}</div>
                    </li>
                  ))}
                </ul>
                <div className="vg-kv vg-kv--total"><span>Toplam</span><span>{para(siparis.genelToplam)}</span></div>
              </section>

              {siparis.kargoNo&&(
                <section className="vg-drawer__section">
                  <div className="vg-section-label">Kargo</div>
                  <div className="vg-row" style={{ gap: 8 }}><Truck className="vg-icon" style={{ color: 'var(--ink-muted)' }} />{siparis.kargoFirma||'—'}<span className="vg-code">{siparis.kargoNo}</span></div>
                </section>
              )}

              {(siparis.gecmisSiparisler||[]).length > 0 && (
                <section className="vg-drawer__section">
                  <div className="vg-section-label">Müşterinin geçmiş siparişleri</div>
                  <ul className="vg-list">
                    {siparis.gecmisSiparisler.map(g=>(
                      <li key={g.id} className="vg-list__item" style={{ padding: '8px 0' }}>
                        <div className="vg-list__main">
                          <div className="vg-list__primary vg-code">{g.siparisNo}</div>
                          <div className="vg-list__secondary">{tarih(g.tarih)}</div>
                        </div>
                        <DurumBadge durum={g.durum} />
                        <div className="vg-list__value">{para(g.genelToplam)}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Durum Güncelle — HER durum, HER ZAMAN seçilebilir.
                  ESKİ DAVRANIŞ: yalnızca `sira`sı mevcut durumdan büyük olanlar listeleniyor,
                  sipariş teslim/iptal/iade edildiğinde ise blok tamamen gizleniyordu. Bu yüzden
                  teslim edilmiş bir siparişi iade almak ya da yanlış işaretlenmiş bir durumu
                  geri almak panelden mümkün değildi. */}
              <section className="vg-drawer__section">
                <div className="vg-section-label">Durumu güncelle</div>
                <div className="vg-stack" style={{ gap: 4 }}>
                  {DURUMLAR.map(d=>{
                    const aktif = d.id === siparis.durum
                    return (
                      <button key={d.id} type="button" className="vg-nav-item" aria-current={aktif ? 'page' : undefined}
                        onClick={()=>durumGuncelle(d.id)} disabled={durumGuncelleniyor||aktif}
                        style={{ height: 36, opacity: durumGuncelleniyor&&!aktif ? .5 : 1, cursor: aktif ? 'default' : 'pointer' }}>
                        <Badge tone={d.ton}>{d.label}</Badge>
                        {aktif && <span className="vg-muted" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400 }}>Şu anki durum</span>}
                        {!aktif && d.id === 'kargoda' && <Truck className="vg-icon" style={{ marginLeft: 'auto' }} />}
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>
          </>
        )}
      </aside>

      {kargoModal && siparis && (
        <KargoModal
          siparis={siparis}
          onKaydet={async()=>{
            setKargoModal(false)
            const g=await siparisGetir(siparisId)
            setSiparis(g)
            onDurumGuncelle()
          }}
          onKapat={()=>setKargoModal(false)}
        />
      )}
    </div>
  )
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function OnlineSiparisler() {
  const { magazalar:ctxMagazalar, aktifMagaza } = useVega()

  const [siparisler, setSiparisler]   = useState([])
  const [analitik, setAnalitik]       = useState(null)
  const [yukleniyor, setYukleniyor]   = useState(true)
  const [kanalFiltre, setKanalFiltre] = useState('hepsi')
  const [durumFiltre, setDurumFiltre] = useState('hepsi')
  const [seciliId, setSeciliId]       = useState(null)
  const [aktifSekme, setAktifSekme]   = useState('siparisler')
  const [iadeler, setIadeler]         = useState([])
  const [iadeyukleniyor, setIadeYukleniyor] = useState(false)
  const [manuelModal, setManuelModal] = useState(false)
  const [iadeModal, setIadeModal]     = useState(false)
  const [gorunum, setGorunum]         = useState('liste') // liste | kanban
  const [shopifyCekiliyor, setShopifyCekiliyor] = useState(false)
  const [iadeYenile, setIadeYenile]   = useState(0)

  const magazaId = aktifMagaza && aktifMagaza !== 'hepsi' ? aktifMagaza : null

  const yukle = async () => {
    setYukleniyor(true)
    try {
      const [s, a] = await Promise.all([
        siparisleriGetir({ limit:200, ...(magazaId&&{magazaId}), ...(kanalFiltre!=='hepsi'&&{kanal:kanalFiltre}), ...(durumFiltre!=='hepsi'&&{durum:durumFiltre}) }),
        fetch(`${API_BASE}/siparisler/analitik${magazaId?`?magazaId=${magazaId}`:''}`).then(r=>r.json()).catch(()=>null),
      ])
      setSiparisler(Array.isArray(s)?s:[])
      setAnalitik(a)
    } catch(e) { console.error(e) }
    finally { setYukleniyor(false) }
  }

  useEffect(()=>{ yukle() },[kanalFiltre,durumFiltre,aktifMagaza])

  // Shopify mağazasındaki TÜM siparişleri (tarih sınırı yok) çekip Siparis tablosuna
  // aktarır/günceller — panelin geri kalanıyla (iade, müşteri geçmişi, kargo, analitik)
  // aynı akışa girer. `gun` gönderilmezse backend tüm geçmişi tarar (bkz. shopify.js
  // /shopify/siparisler/senkronize — gun boşsa sinceMinutes:null → filtresiz tam tarama).
  const shopifydenCek = async () => {
    setShopifyCekiliyor(true)
    try {
      const sonuc = await shopifySiparisleriSenkronize({})
      await yukle()
      // Stok düşümü artık sipariş aktarımının parçası (bkz. shopify.js >
      // shopifySiparisStoguHizala) — sonucu burada da göstermek, ürünle eşleşmeyen
      // kalemlerin sessizce kaybolmasını engelliyor.
      const stokBilgi = [
        sonuc.stokDusulen ? `${sonuc.stokDusulen} kalem stoktan düşüldü` : null,
        sonuc.stokGeriVerilen ? `${sonuc.stokGeriVerilen} kalem stoğa geri verildi` : null,
        sonuc.eslesmeyenKalem ? `${sonuc.eslesmeyenKalem} kalem ürünle eşleşmedi` : null,
      ].filter(Boolean).join(', ')
      const mesaj = `Shopify: ${sonuc.yeni} yeni, ${sonuc.guncellenen} güncellenen sipariş${sonuc.hatalar?.length ? ` (${sonuc.hatalar.length} hata)` : ''}` + (stokBilgi ? `\n${stokBilgi}` : '')
      if (sonuc.hatalar?.length || sonuc.eslesmeyenKalem) toast.warning(mesaj, 9000)
      else toast.success(mesaj, 6000)
    } catch(e) { toast.error(e.message || 'Shopify siparişleri çekilemedi.') }
    finally { setShopifyCekiliyor(false) }
  }

  useEffect(() => {
    if (aktifSekme !== 'iadeler') return
    setIadeYukleniyor(true)
    fetch(`${API_BASE}/iadeler?limit=100`)
      .then(r => r.json())
      .then(d => setIadeler(Array.isArray(d) ? d : []))
      .catch(() => setIadeler([]))
      .finally(() => setIadeYukleniyor(false))
  }, [aktifSekme, iadeYenile])

  // Kanal sayıları
  const kanalSayilari = {}
  siparisler.forEach(s=>{ kanalSayilari[s.kanal]=(kanalSayilari[s.kanal]||0)+1 })
  const bekleyen = siparisler.filter(s=>s.durum==='beklemede').length

  return (
    <Page>
      <PageHeader title="Online siparişler"
        subtitle={<>
          {bekleyen > 0 ? `${bekleyen} sipariş onay bekliyor` : 'Bekleyen sipariş yok'}
          {analitik?.ortHazirlamaSuresi>0 && ` · ortalama hazırlama ${sure(Math.round(analitik.ortHazirlamaSuresi))}`}
        </>}
        actions={<>
          <Button icon={RefreshCw} onClick={yukle}>Yenile</Button>
          <Button icon={Download} onClick={shopifydenCek} loading={shopifyCekiliyor}>{shopifyCekiliyor ? 'Çekiliyor…' : "Shopify'dan tümünü çek"}</Button>
          {aktifSekme === 'iadeler'
            ? <Button variant="primary" icon={Undo2} onClick={()=>setIadeModal(true)}>Yeni iade</Button>
            : <Button variant="primary" icon={Plus} onClick={()=>setManuelModal(true)}>Manuel sipariş</Button>}
        </>}>
        <Tabs value={aktifSekme} onChange={setAktifSekme} items={[
          { id: 'siparisler', label: 'Siparişler', count: bekleyen },
          { id: 'iadeler', label: 'İadeler' },
        ]} />
      </PageHeader>

      {aktifSekme==='siparisler' && <>
        {analitik && (
          <div className="vg-grid-4">
            <StatCard label="Toplam sipariş" value={analitik.toplamSiparis ?? 0} />
            <StatCard label="Tamamlanan" value={analitik.tamamlanan ?? 0} />
            <StatCard label="İptal" value={analitik.iptal ?? 0} />
            <StatCard label="Ciro" value={para(analitik.toplamCiro)} />
          </div>
        )}

        <div className="vg-table-wrap">
          <div className="vg-table-toolbar" style={{ alignItems: 'flex-start' }}>
            <div className="vg-stack" style={{ gap: 8, flex: 1, minWidth: 0 }}>
              <div className="vg-chips" role="group" aria-label="Kanal" style={{ flexWrap: 'wrap' }}>
                {KANALLAR.map(k=>{
                  const sayi = k.id==='hepsi' ? siparisler.length : (kanalSayilari[k.id]||0)
                  if (k.id!=='hepsi'&&sayi===0&&kanalFiltre!==k.id) return null
                  return (
                    <button key={k.id} type="button" className="vg-chip" aria-pressed={kanalFiltre===k.id} onClick={()=>setKanalFiltre(k.id)}>
                      <k.ikon className="vg-icon" style={{ width: 14, height: 14 }} />{k.label}
                      <span className="vg-num" style={{ opacity: .7 }}>{sayi}</span>
                    </button>
                  )
                })}
              </div>
              <Select size="sm" value={durumFiltre} onChange={e=>setDurumFiltre(e.target.value)} aria-label="Durum" style={{ width: 'auto', alignSelf: 'flex-start' }}>
                <option value="hepsi">Tüm durumlar</option>
                {DURUMLAR.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
            </div>
            <Segmented label="Görünüm" value={gorunum} onChange={setGorunum} options={[
              { value: 'liste', label: <span className="vg-row" style={{ gap: 4 }}><List className="vg-icon" style={{ width: 14, height: 14 }} />Liste</span> },
              { value: 'kanban', label: <span className="vg-row" style={{ gap: 4 }}><Columns3 className="vg-icon" style={{ width: 14, height: 14 }} />Kanban</span> },
            ]} />
          </div>

          {yukleniyor ? <LoadingRows card={false} rows={8} /> : siparisler.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Sipariş bulunamadı" text="Filtreleri değiştirin ya da Shopify'dan siparişleri çekin." />
          ) : gorunum === 'liste' ? (
            <div className="vg-table-scroll">
              <table className="vg-table" style={{ minWidth: 920 }}>
                <thead><tr><th style={{ width: 44 }}></th><th>Sipariş no</th><th>Tarih</th><th>Müşteri</th><th className="is-num">Ürün</th><th className="is-num">Tutar</th><th>Ödeme</th><th>Kargo</th><th>Durum</th></tr></thead>
                <tbody>
                  {siparisler.map(s=>(
                    <tr key={s.id} className="is-clickable" onClick={()=>setSeciliId(s.id)} aria-selected={seciliId===s.id}>
                      <td><KanalIkon kanal={s.kanal}/></td>
                      <td className="vg-code is-strong">{s.siparisNo}</td>
                      <td className="vg-nowrap vg-muted">{tarih(s.tarih)}</td>
                      <td>{musteriAdi(s)}</td>
                      <td className="is-num vg-muted">{s.kalemler?.length||0}</td>
                      <td className="is-num is-strong">{para(s.genelToplam)}</td>
                      <td className="vg-muted">{ODEME_TIPLERI_ONLINE.find(o=>o.id===s.odemeTip)?.label || s.odemeTip || '—'}</td>
                      <td className="vg-muted">{s.kargoNo ? <span className="vg-row" style={{ gap: 4 }}><Truck className="vg-icon" style={{ width: 14, height: 14 }} />{s.kargoFirma||''}</span> : '—'}</td>
                      <td><DurumBadge durum={s.durum} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="vg-kanban" style={{ padding: 12 }}>
              {DURUMLAR.filter(d=>d.id!=='iptal').map(d=>{
                const grup = siparisler.filter(s=>s.durum===d.id)
                return (
                  <div key={d.id} className="vg-kanban__col">
                    <div className="vg-kanban__head"><Badge tone={d.ton}>{d.label}</Badge><span className="vg-count" style={{ background: 'var(--surface)', color: 'var(--ink-muted)' }}>{grup.length}</span></div>
                    {grup.map(s=>(
                      <button key={s.id} type="button" className="vg-kanban__card" onClick={()=>setSeciliId(s.id)}>
                        <div className="vg-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                          <span className="vg-row" style={{ gap: 6, flexWrap: 'nowrap' }}><KanalIkon kanal={s.kanal} size={20}/><span className="vg-code" style={{ fontWeight: 600 }}>{s.siparisNo}</span></span>
                          <span className="vg-num" style={{ fontWeight: 600 }}>{para(s.genelToplam)}</span>
                        </div>
                        <div style={{ fontSize: 13 }}>{musteriAdi(s)}</div>
                        <div className="vg-list__secondary">{tarih(s.tarih)} · {s.kalemler?.length||0} ürün</div>
                      </button>
                    ))}
                    {grup.length===0&&<div className="vg-help" style={{ textAlign: 'center', padding: 16 }}>Boş</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </>}

      {aktifSekme==='iadeler'&&(
        <div className="vg-table-wrap">
          {iadeyukleniyor ? <LoadingRows card={false} /> : iadeler.length===0 ? (
            <EmptyState icon={Undo2} title="İade bulunamadı" actions={<Button variant="primary" icon={Undo2} onClick={()=>setIadeModal(true)}>Yeni iade</Button>} />
          ) : (
            <div className="vg-table-scroll">
              <table className="vg-table" style={{ minWidth: 860 }}>
                <thead><tr><th>İade no</th><th>Sipariş / fiş</th><th>Müşteri</th><th>Ürünler</th><th className="is-num">Tutar</th><th>Ödeme</th><th>Durum</th><th>Tarih</th></tr></thead>
                <tbody>
                  {iadeler.map(iade=>(
                    <tr key={iade.id}>
                      <td className="vg-code">{iade.iadeNo||iade.id?.slice(0,8)}</td>
                      <td>
                        <div className="vg-code">{iade.siparis?.siparisNo||iade.satis?.fisNo||'—'}</div>
                        {iade.siparis?.durum&&<div className="vg-list__secondary">{DURUMLAR.find(d=>d.id===iade.siparis.durum)?.label || iade.siparis.durum}</div>}
                      </td>
                      <td>{iade.siparis?.musteriAd||iade.satis?.musteri?.ad||'—'}</td>
                      <td className="vg-muted" style={{ maxWidth: 220 }}><div className="vg-truncate">{(iade.kalemler||[]).map(k=>k.urunAd).join(', ')||'—'}</div></td>
                      <td className="is-num is-strong">{para(iade.toplam||iade.toplamIade||0)}</td>
                      <td><Badge dot={false}>{iade.siparis?.odemeTip||iade.notlar?.split(' - ')[1]||'—'}</Badge></td>
                      <td><Badge tone={iade.durum==='onaylandi'?'success':iade.durum==='reddedildi'?'critical':'warning'}>{iade.durum==='onaylandi'?'Onaylandı':iade.durum==='reddedildi'?'Reddedildi':'Bekliyor'}</Badge></td>
                      <td className="vg-nowrap vg-muted">{iade.tarih?new Date(iade.tarih).toLocaleDateString('tr-TR'):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {iadeModal && (
        <OnlineIadeModal
          onKapat={()=>setIadeModal(false)}
          onKaydet={()=>{ setIadeModal(false); setAktifSekme('iadeler'); setIadeYenile(x=>x+1) }}
        />
      )}
      {manuelModal && (
        <ManuelSiparisModal
          magazalar={ctxMagazalar||[]}
          onKapat={()=>setManuelModal(false)}
          onKaydet={()=>{ setManuelModal(false); yukle(); }}
        />
      )}

      {seciliId && (
        <QuickView
          siparisId={seciliId}
          onKapat={()=>setSeciliId(null)}
          onDurumGuncelle={()=>{ yukle(); }}
        />
      )}
    </Page>
  )
}
