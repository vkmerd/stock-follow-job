import { useState, useEffect, useRef } from 'react'
import { useVega } from './VegaContext'
import { siparisleriGetir, siparisGetir, siparisDurumGuncelle, urunleriGetir, bankaHesaplariGetir, shopifySiparisleriSenkronize, API_BASE } from './api'

const ODEME_TIPLERI_ONLINE = [
  { id:'kredi_karti',    label:'Kredi Kartı',    ikon:'💳', renk:'#56ccf2' },
  { id:'eft',            label:'EFT / Havale',   ikon:'🏦', renk:'#bb87fc' },
  { id:'kapida_odeme',   label:'Kapıda Ödeme',   ikon:'🚪', renk:'#f2c94c' },
]

const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const tarih = iso => new Date(iso).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
const sure  = dk => dk < 60 ? `${dk}dk` : `${Math.floor(dk/60)}s ${dk%60}dk`

const KANALLAR = [
  { id:'hepsi',      label:'Tümü',          ikon:'📦', renk:'#888' },
  { id:'trendyol',   label:'Trendyol',       ikon:'🟠', renk:'#FF6000' },
  { id:'hepsiburada',label:'Hepsiburada',    ikon:'🟣', renk:'#8B00FF' },
  { id:'n11',        label:'N11',            ikon:'🔵', renk:'#003EBF' },
  { id:'web',        label:'Web Sitesi',     ikon:'🌐', renk:'#56ccf2' },
  { id:'shopify',    label:'Shopify',        ikon:'🛍️', renk:'#95BF47' },
  { id:'online',     label:'Online',         ikon:'💻', renk:'#6fcf97' },
  { id:'telefon',    label:'Telefon',        ikon:'📞', renk:'#f2c94c' },
  { id:'instagram',  label:'Instagram',      ikon:'📸', renk:'#E1306C' },
  { id:'manuel',     label:'Manuel',         ikon:'✏️',  renk:'#a0a0a0' },
]

const DURUMLAR = [
  { id:'beklemede',       label:'Beklemede',       renk:'#f2c94c', ikon:'⏳', sira:1 },
  { id:'hazirlaniyor',    label:'Hazırlanıyor',     renk:'#56ccf2', ikon:'📦', sira:2 },
  { id:'paketlendi',      label:'Paketlendi',       renk:'#bb87fc', ikon:'🎁', sira:3 },
  { id:'kargoda',         label:'Kargoya Verildi',  renk:'#ff9f43', ikon:'🚚', sira:4 },
  { id:'teslim_edildi',   label:'Teslim Edildi',    renk:'#6fcf97', ikon:'✅', sira:5 },
  { id:'iptal',           label:'İptal',            renk:'#eb5757', ikon:'❌', sira:6 },
  { id:'iade_edildi',     label:'İade Edildi',      renk:'#bb87fc', ikon:'↩',  sira:7 },
]

const KARGO_FIRMALARI = ['Yurtiçi Kargo','Aras Kargo','MNG Kargo','PTT Kargo','Sürat Kargo','DHL','UPS']

// ─── ONLİNE İADE MODAL ───────────────────────────────────────
function OnlineIadeModal({ onKaydet, onKapat, t }) {
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
const res = await fetch(`${API_BASE}/siparisler?q=${encodeURIComponent(sipNo)}&limit=5`);      const d = await res.json()
      const bulunan = Array.isArray(d) ? d.find(s => s.siparisNo?.includes(sipNo) || s.fisNo?.includes(sipNo)) : null
      if (bulunan) setSiparis(bulunan)
      else setHata('Sipariş bulunamadı')
    } catch(e) { setHata('Arama hatası') }
    finally { setAramak(false) }
  }

  const kaydet = async () => {
    const secili = Object.entries(seciliKalemler).filter(([,v])=>v>0)
    if (!secili.length) return setHata('En az bir ürün seçin')
    setKayit(true); setHata('')
    
    // .env dosyasından canlı API adresini çekiyoruz, yoksa fallback olarak localhost kullanır
    const API_BASE_URL = API_BASE;

    try {
      const kalemler = secili.map(([id, adet]) => {
        const k = (siparis.kalemler||[]).find(k=>k.id===id)
        return { urunId:k?.urunId, urunAd:k?.urunAd, renk:k?.renk, beden:k?.beden, adet, birimFiyat:k?.birimFiyat, toplamIade:Number(k?.birimFiyat||0)*adet }
      })
      const toplamIade = kalemler.reduce((t,k)=>t+Number(k.toplamIade),0)
      
      // DEĞİŞİKLİK BURADA: localhost yerine dinamik URL geldi
      const res = await fetch(`${API_BASE_URL}/api/iadeler`, {
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
      if (!res.ok) throw new Error('İade oluşturulamadı')
      
      // DEĞİŞİKLİK BURADA: localhost yerine dinamik URL geldi
      await fetch(`${API_BASE_URL}/api/siparisler/${siparis.id}/durum`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ durum: 'iade_edildi' })
      }).catch(()=>{})
      
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  const inp = {padding:'9px 12px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:'28px 32px',width:'100%',maxWidth:520,maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>Yeni İade Oluştur</div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>

        {/* Sipariş Arama */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Sipariş / Fiş No</div>
          <div style={{display:'flex',gap:8}}>
            <input value={sipNo} onChange={e=>setSipNo(e.target.value)} onKeyDown={e=>e.key==='Enter'&&siparisAra()}
              placeholder="SP-001234 veya F-0042" style={{...inp,flex:1}}/>
            <button onClick={siparisAra} disabled={aramak} style={{padding:'9px 16px',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,whiteSpace:'nowrap'}}>
              {aramak?'Aranıyor...':'🔍 Ara'}
            </button>
          </div>
        </div>

        {/* Sipariş Bilgisi */}
        {siparis && (
          <div style={{marginBottom:16}}>
            <div style={{padding:'12px 14px',background:`${t.accent}08`,border:`1px solid ${t.accent}22`,borderRadius:10,marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:t.text}}>{siparis.siparisNo||siparis.fisNo}</div>
              <div style={{fontSize:11,color:t.textMuted,marginTop:2}}>
                {siparis.musteriAd||siparis.musteri?.ad||'—'} · 
                {siparis.odemeTip||siparis.odemeler?.[0]?.tip||'—'} · 
                ₺{Number(siparis.genelToplam||0).toLocaleString('tr-TR')}
              </div>
            </div>

            {/* Ürün Seçimi */}
            <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>İade Edilecek Ürünler</div>
            {(siparis.kalemler||[]).map(k=>(
              <div key={k.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${t.border}`}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:t.text}}>{k.urunAd}</div>
                  <div style={{fontSize:11,color:t.textMuted}}>{k.renk}{k.beden?` / ${k.beden}`:''} · ₺{Number(k.birimFiyat||0).toFixed(2)}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:11,color:t.textMuted}}>Adet:</span>
                  <input type="number" min={0} max={k.adet} value={seciliKalemler[k.id]||0}
                    onChange={e=>setSeciliKalemler(p=>({...p,[k.id]:Math.min(k.adet,Math.max(0,Number(e.target.value)))}))}
                    style={{...inp,width:60,textAlign:'center',padding:'4px 8px'}}/>
                  <span style={{fontSize:11,color:t.textMuted}}>/ {k.adet}</span>
                </div>
              </div>
            ))}

            {/* Ödeme Yöntemi */}
            <div style={{marginTop:14}}>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>İade Ödeme Yöntemi</div>
              <div style={{display:'flex',gap:8}}>
                {[['nakit','💵 Nakit'],['kart','💳 Kart'],['havale','🏦 Havale']].map(([k,l])=>(
                  <button key={k} onClick={()=>setOdemeYontemi(k)} style={{flex:1,padding:'8px 0',borderRadius:8,fontSize:12,
                    background:odemeYontemi===k?t.accentBg:t.input,border:`1px solid ${odemeYontemi===k?t.accent+'55':t.border}`,
                    color:odemeYontemi===k?t.accent:t.textMuted,fontWeight:odemeYontemi===k?600:400}}>{l}</button>
                ))}
              </div>
            </div>

            {/* Toplam */}
            <div style={{marginTop:12,padding:'10px 14px',background:'rgba(235,87,87,.06)',border:'1px solid rgba(235,87,87,.2)',borderRadius:8,fontSize:13,fontWeight:700,color:'#eb5757',display:'flex',justifyContent:'space-between'}}>
              <span>İade Tutarı:</span>
              <span>₺{Object.entries(seciliKalemler).reduce((t,[id,adet])=>{
                const k=(siparis.kalemler||[]).find(k=>k.id===id)
                return t+Number(k?.birimFiyat||0)*adet
              },0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</span>
            </div>
          </div>
        )}

        {hata&&<div style={{marginBottom:12,padding:'8px 14px',background:'rgba(235,87,87,.1)',border:'1px solid rgba(235,87,87,.3)',borderRadius:8,fontSize:12,color:'#eb5757'}}>{hata}</div>}

        <div style={{display:'flex',gap:10}}>
          <button onClick={onKapat} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit||!siparis} style={{flex:2,padding:'11px 0',borderRadius:10,background:'rgba(235,87,87,.12)',border:'1px solid rgba(235,87,87,.35)',color:'#eb5757',fontSize:13,fontWeight:700}}>
            {kayit?'Kaydediliyor...':'↩ İadeyi Oluştur'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MANUEL SİPARİŞ MODAL ────────────────────────────────────
function ManuelSiparisModal({ onKaydet, onKapat, t, magazalar }) {
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

  const g = (k,v) => setForm(p=>({...p,[k]:v}))

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
    if (!form.musteriAd.trim()) return setHata('Müşteri adı zorunlu')
    if (!form.genelToplam || Number(form.genelToplam) <= 0) return setHata('Tutar zorunlu')
    if (form.odemeTip === 'eft' && !form.bankaHesapId) return setHata('EFT/Havale için tutarın düşeceği banka hesabı seçilmeli')
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
      if (!res.ok) throw new Error('Sipariş kaydedilemedi')
      await res.json()
      // NOT: Yeni müşteri CRM kaydı backend'de /siparisler route'unda
      // "bul veya oluştur" ile yapılıyor. Burada ayrıca POST /musteriler
      // atmak çift kayda yol açtığı için kaldırıldı.
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  const inp = {padding:'9px 12px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none',width:'100%'}

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowY:'auto'}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:'28px 32px',width:'100%',maxWidth:580,maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:t.text}}>Manuel Sipariş Girişi</div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {/* Kanal */}
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Kanal</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {KANALLAR.filter(k=>k.id!=='hepsi').map(k=>(
                <button key={k.id} onClick={()=>g('kanal',k.id)} style={{
                  padding:'6px 12px',borderRadius:20,fontSize:12,
                  background:form.kanal===k.id?`${k.renk}18`:t.input,
                  border:`1px solid ${form.kanal===k.id?k.renk+'55':t.border}`,
                  color:form.kanal===k.id?k.renk:t.textMuted}}>
                  {k.ikon} {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stoğun düşeceği mağaza */}
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Stok Mağazası (barkodlu ürünler buradan düşülür)</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {fizikselMagazalar.map(m=>(
                <button key={m.id} onClick={()=>g('magazaId',m.id)} style={{
                  padding:'6px 12px',borderRadius:20,fontSize:12,
                  background:form.magazaId===m.id?t.accentBg:t.input,
                  border:`1px solid ${form.magazaId===m.id?t.accent+'55':t.border}`,
                  color:form.magazaId===m.id?t.accent:t.textMuted}}>
                  {m.ikon||'🏪'} {m.ad}
                </button>
              ))}
              {fizikselMagazalar.length===0 && <span style={{fontSize:11,color:t.textMuted}}>Önce Mağaza Yönetimi'nden bir mağaza ekleyin</span>}
            </div>
          </div>

          {/* Müşteri bilgileri */}
          <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{position:'relative'}}>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>
                Müşteri Adı * {musteriId && <span style={{color:'#6fcf97',fontSize:10}}>✓ CRM'den seçildi</span>}
              </div>
              <input value={form.musteriAd} onChange={e=>musteriAra(e.target.value)}
                onFocus={()=>form.musteriAd.length>=2&&setMusteriOneriAcik(true)}
                onBlur={()=>setTimeout(()=>setMusteriOneriAcik(false),200)}
                placeholder="Ad Soyad veya telefon ara..." style={inp}/>
              {musteriOneriAcik && musteriOneri.length>0 && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,
                  background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:8,
                  overflow:'hidden',boxShadow:'0 8px 24px rgba(0,0,0,.5)'}}>
                  {musteriOneri.map(m=>(
                    <div key={m.id} onClick={()=>musteriSec(m)}
                      style={{padding:'8px 12px',cursor:'pointer',borderBottom:`1px solid ${t.border}`}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{fontSize:12,color:t.text,fontWeight:500}}>{m.ad} {m.soyad||''}</div>
                      <div style={{fontSize:10,color:t.textMuted}}>{m.telefon||''} {m.adres?'· '+m.adres.slice(0,30):''}</div>
                    </div>
                  ))}
                  <div onClick={()=>setMusteriOneriAcik(false)}
                    style={{padding:'6px 12px',fontSize:11,color:t.textMuted,cursor:'pointer',background:'rgba(255,255,255,.02)'}}>
                    + Yeni müşteri olarak devam et
                  </div>
                </div>
              )}
            </div>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Telefon</div>
              <input value={form.musteriTel} onChange={e=>g('musteriTel',e.target.value)} placeholder="05xx xxx xx xx" style={inp}/>
            </div>
          </div>

          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Teslimat Adresi</div>
            <textarea value={form.adres} onChange={e=>g('adres',e.target.value)} rows={2} placeholder="Mahalle, sokak, no, şehir..."
              style={{...inp,resize:'vertical'}}/>
          </div>

          {/* Ödeme tipi */}
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Ödeme Tipi</div>
            <div style={{display:'flex',gap:8}}>
              {ODEME_TIPLERI_ONLINE.map(o=>(
                <button key={o.id} onClick={()=>g('odemeTip',o.id)} style={{
                  flex:1,padding:'9px 0',borderRadius:10,fontSize:12,
                  background:form.odemeTip===o.id?`${o.renk}18`:t.input,
                  border:`1px solid ${form.odemeTip===o.id?o.renk+'55':t.border}`,
                  color:form.odemeTip===o.id?o.renk:t.textMuted,fontWeight:form.odemeTip===o.id?600:400}}>
                  {o.ikon} {o.label}
                </button>
              ))}
            </div>
            {form.odemeTip==='kapida_odeme'&&(
              <div style={{marginTop:8,padding:'8px 12px',background:'rgba(242,201,76,.06)',border:'1px solid rgba(242,201,76,.2)',borderRadius:8,fontSize:11,color:'#f2c94c'}}>
                ⚠ Kapıda ödeme kasaya yansıtılmaz — teslim sonrası manuel giriş gerekebilir.
              </div>
            )}
            {form.odemeTip==='eft'&&(
              bankaHesaplari.length>0?(
                <div style={{marginTop:8}}>
                  <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Tutarın Düşeceği Banka Hesabı</div>
                  <select value={form.bankaHesapId} onChange={e=>g('bankaHesapId',e.target.value)}
                    style={{...inp, border:`1px solid ${!form.bankaHesapId ? '#eb5757' : t.border}`}}>
                    <option value="">Hesap seçin...</option>
                    {bankaHesaplari.map(h=><option key={h.id} value={h.id}>{h.ad} — {h.banka}</option>)}
                  </select>
                </div>
              ):(
                <div style={{marginTop:8,padding:'8px 12px',background:'rgba(235,87,87,.06)',border:'1px solid rgba(235,87,87,.2)',borderRadius:8,fontSize:11,color:'#eb5757'}}>
                  ⚠ Kayıtlı banka hesabı yok — Banka Mutabakat ekranından bir hesap ekleyin, aksi halde tutar hiçbir hesaba işlenmez.
                </div>
              )
            )}
          </div>

          {/* Ürünler */}
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:11,color:t.textMuted,textTransform:'uppercase',letterSpacing:.5}}>Ürünler</div>
              <button onClick={kalemEkle} style={{fontSize:11,padding:'4px 10px',borderRadius:6,background:t.accentBg,border:`1px solid ${t.accent}44`,color:t.accent}}>+ Ekle</button>
            </div>
            {form.kalemler.map((k,i)=>(
              <div key={i} style={{marginBottom:10,padding:'10px 12px',background:t.hover,borderRadius:10,border:`1px solid ${t.border}`}}>
                {/* Ürün arama */}
                <div style={{position:'relative',marginBottom:8}}>
                  <input
                    value={aktifKalemIdx===i ? urunArama : k.urunAd}
                    onChange={e=>{ kalemGuncelle(i,'urunAd',e.target.value); urunAra(e.target.value,i); }}
                    onFocus={()=>{ setAktifKalemIdx(i); setUrunArama(k.urunAd||''); }}
                    onBlur={()=>setTimeout(()=>{ setUrunOneri([]); setAktifKalemIdx(null); },200)}
                    placeholder="🔍 Ürün adı, barkod veya kod..."
                    style={{...inp,fontSize:12}}/>
                  {aktifKalemIdx===i && urunOneri.length>0 && (
                    <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,
                      background:t.sidebar,border:`1px solid ${t.border}`,borderRadius:8,overflow:'hidden',boxShadow:'0 8px 24px rgba(0,0,0,.4)'}}>
                      {urunOneri.map(u=>{
                        const varyantlar = (u.varyantlar||[])
                        return (
                          <div key={u.id}>
                            <div style={{padding:'8px 12px',fontSize:12,fontWeight:600,color:t.accent,background:'rgba(255,255,255,.03)'}}>
                              {u.ad} — {u.marka} · ₺{u.satisF}
                            </div>
                            {varyantlar.length>0 ? varyantlar.slice(0,4).map((v,vi)=>(
                              <div key={vi} onClick={()=>urunSec(u,v,i)}
                                style={{padding:'6px 16px',fontSize:11,color:t.textMuted,cursor:'pointer',
                                  borderTop:`1px solid ${t.border}`}}
                                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                <span style={{color:t.text,fontWeight:500}}>{v.renk}{v.beden?` / ${v.beden}`:''}</span>
                                <span style={{marginLeft:8,color:v.adet>0?'#6fcf97':'#eb5757'}}>Stok: {v.adet}</span>
                                {v.barkod&&<span style={{marginLeft:8,fontFamily:'monospace',fontSize:10}}>#{v.barkod}</span>}
                              </div>
                            )) : (
                              <div onClick={()=>urunSec(u,null,i)}
                                style={{padding:'6px 16px',fontSize:11,color:t.textMuted,cursor:'pointer'}}
                                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                Varyant yok — ekle
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                {/* Detaylar */}
                <div className="vega-grid-fields" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:6}}>
                  <input value={k.renk} onChange={e=>kalemGuncelle(i,'renk',e.target.value)} placeholder="Renk"
                    style={{...inp,fontSize:11}}/>
                  <input value={k.beden} onChange={e=>kalemGuncelle(i,'beden',e.target.value)} placeholder="Beden"
                    style={{...inp,fontSize:11}}/>
                  <input type="number" value={k.adet} onChange={e=>kalemGuncelle(i,'adet',e.target.value)} placeholder="Adet"
                    style={{...inp,fontSize:11}}/>
                  <input type="number" value={k.birimFiyat} onChange={e=>kalemGuncelle(i,'birimFiyat',e.target.value)} placeholder="₺ Fiyat"
                    style={{...inp,fontSize:11,color:t.accent}}/>
                  <button onClick={()=>kalemSil(i)} style={{padding:'4px 8px',borderRadius:6,background:'rgba(235,87,87,.06)',border:'1px solid rgba(235,87,87,.15)',color:'#eb5757',fontSize:12,cursor:'pointer'}}>✕</button>
                </div>
                {k.barkod&&<div style={{fontSize:10,color:t.textMuted,fontFamily:'monospace',marginTop:4}}>#{k.barkod}</div>}
              </div>
            ))}
          </div>

          {/* Toplam + Not */}
          <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Toplam Tutar *</div>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
                <input type="number" value={form.genelToplam} onChange={e=>g('genelToplam',e.target.value)}
                  style={{...inp,paddingLeft:28,color:t.accent,fontWeight:700,fontSize:15}}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Sipariş Tarihi</div>
              <div style={{display:'flex',gap:6}}>
                <input type="date" value={form.tarih} onChange={e=>g('tarih',e.target.value)} style={{...inp,flex:2}}/>
                <input type="time" value={form.saat} onChange={e=>g('saat',e.target.value)} style={{...inp,flex:1}}/>
              </div>
            </div>
          </div>

          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Özel Not (Müşteri)</div>
            <input value={form.ozelNot} onChange={e=>g('ozelNot',e.target.value)} placeholder="Hediye paketi vb..." style={inp}/>
          </div>
        </div>

        {hata&&<div style={{marginTop:12,padding:'8px 14px',background:'rgba(235,87,87,.1)',border:'1px solid rgba(235,87,87,.3)',borderRadius:8,fontSize:12,color:'#eb5757'}}>{hata}</div>}

        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={onKapat} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'11px 0',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:14,fontWeight:700}}>
            {kayit?'Kaydediliyor...':'📦 Sipariş Oluştur'}
          </button>
        </div>
      </div>
    </div>
  )
}

function KanalIkon({ kanal, size=20 }) {
  const k = KANALLAR.find(x=>x.id===kanal) || KANALLAR[1]
  return (
    <span title={k.label} style={{
      display:'inline-flex',alignItems:'center',justifyContent:'center',
      width:size,height:size,borderRadius:6,fontSize:size*0.6,
      background:`${k.renk}20`,flexShrink:0
    }}>{k.ikon}</span>
  )
}

// ─── KARGO MODAL ──────────────────────────────────────────────
function KargoModal({ siparis, onKaydet, onKapat, t }) {
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
      onKaydet()
    } catch(e) { alert(e.message) }
    finally { setKayit(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:'100%',maxWidth:440}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>Kargoya Ver — {siparis.siparisNo}</div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Kargo Firması</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {KARGO_FIRMALARI.map(f=>(
                <button key={f} onClick={()=>setKargoFirma(f)} style={{
                  padding:'6px 12px',borderRadius:8,fontSize:12,
                  background:kargoFirma===f?t.accentBg:t.input,
                  border:`1px solid ${kargoFirma===f?t.accent+'55':t.border}`,
                  color:kargoFirma===f?t.accent:t.textMuted}}>{f}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Takip Numarası</div>
            <input value={kargoNo} onChange={e=>setKargoNo(e.target.value)} placeholder="Kargo takip numarası..."
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
          </div>
          <div style={{padding:'12px 14px',background:'rgba(255,159,67,.08)',border:'1px solid rgba(255,159,67,.2)',borderRadius:10,fontSize:12,color:'#ff9f43'}}>
            📍 Teslimat Adresi: {siparis.adres||'Adres girilmemiş'}
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={yazdirEtiket} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>
            🖨 Etiket Yazdır
          </button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'11px 0',borderRadius:10,background:'rgba(255,159,67,.12)',border:'1px solid rgba(255,159,67,.35)',color:'#ff9f43',fontSize:13,fontWeight:700}}>
            {kayit?'...':'🚚 Kargoya Ver'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── QUICK VIEW DRAWER ────────────────────────────────────────
function QuickView({ siparisId, onKapat, onDurumGuncelle, t }) {
  const [siparis, setSiparis] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [durumGuncelleniyor, setDurumGuncelleniyor] = useState(false)
  const [kargoModal, setKargoModal] = useState(false)

  useEffect(() => {
    siparisGetir(siparisId).then(setSiparis).catch(console.error).finally(()=>setYukleniyor(false))
  }, [siparisId])

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
        ? 'Sipariş ürünleri stoğa GERİ EKLENECEK. Devam edilsin mi?'
        : 'Sipariş yeniden aktif hale geliyor — ürünler stoktan TEKRAR DÜŞÜLECEK. Devam edilsin mi?'
      if (!window.confirm(mesaj)) return
    }
    setDurumGuncelleniyor(true)
    try {
      await siparisDurumGuncelle(siparisId, { durum: yeniDurum })
      const guncellendi = await siparisGetir(siparisId)
      setSiparis(guncellendi)
      onDurumGuncelle()
    } catch(e) { alert(e.message) }
    finally { setDurumGuncelleniyor(false) }
  }

  const d = siparis ? DURUMLAR.find(x=>x.id===siparis.durum)||DURUMLAR[0] : null
  const k = siparis ? KANALLAR.find(x=>x.id===siparis.kanal)||KANALLAR[1] : null

  return (
    <div style={{position:'fixed',inset:0,zIndex:200,display:'flex'}}>
      <div onClick={onKapat} style={{flex:1,background:'rgba(0,0,0,.5)'}}/>
      <div className="vega-drawer" style={{background:t.sidebar||'#0f0d0b',borderLeft:`1px solid ${t.border}`,display:'flex',flexDirection:'column',overflowY:'auto'}}>
        {yukleniyor ? (
          <div style={{padding:60,textAlign:'center',color:t.textMuted}}>⏳ Yükleniyor...</div>
        ) : !siparis ? (
          <div style={{padding:40,color:t.textMuted}}>Sipariş bulunamadı</div>
        ) : (
          <>
            {/* Header */}
            <div style={{padding:'20px 24px',borderBottom:`1px solid ${t.border}`,background:'rgba(255,255,255,.02)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <KanalIkon kanal={siparis.kanal} size={28}/>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:t.text}}>{siparis.siparisNo}</div>
                  </div>
                  <div style={{fontSize:12,color:t.textMuted}}>{tarih(siparis.tarih)} · {k?.label}</div>
                </div>
                <button onClick={onKapat} style={{color:t.textMuted,fontSize:20,padding:'4px 8px'}}>✕</button>
              </div>

              {/* Durum */}
              <div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:12,padding:'6px 14px',borderRadius:20,
                background:`${d.renk}15`,border:`1px solid ${d.renk}40`}}>
                <span>{d.ikon}</span>
                <span style={{fontSize:12,fontWeight:600,color:d.renk}}>{d.label}</span>
              </div>
            </div>

            {/* Müşteri */}
            <div style={{padding:'16px 24px',borderBottom:`1px solid ${t.border}`}}>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>Müşteri</div>
              <div style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:4}}>
                {siparis.musteriAd||`${siparis.musteri?.ad||''} ${siparis.musteri?.soyad||''}`.trim()||'—'}
              </div>
              {(siparis.musteriTel||siparis.musteri?.telefon)&&(
                <div style={{fontSize:13,color:t.textMuted,marginBottom:4}}>📞 {siparis.musteriTel||siparis.musteri?.telefon}</div>
              )}
              {siparis.adres&&(
                <div style={{fontSize:12,color:t.textMuted,display:'flex',gap:6,alignItems:'flex-start'}}>
                  <span>📍</span>
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(siparis.adres)}`} target="_blank" rel="noreferrer"
                    style={{color:'#56ccf2',textDecoration:'none'}}>{siparis.adres}</a>
                </div>
              )}
              {siparis.ozelNot&&(
                <div style={{marginTop:8,padding:'8px 12px',background:'rgba(242,201,76,.06)',border:'1px solid rgba(242,201,76,.15)',borderRadius:8,fontSize:12,color:'#f2c94c'}}>
                  💬 {siparis.ozelNot}
                </div>
              )}
            </div>

            {/* Ürünler */}
            <div style={{padding:'16px 24px',borderBottom:`1px solid ${t.border}`}}>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>
                Ürünler ({siparis.kalemler?.length||0})
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {(siparis.kalemler||[]).map((k,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:t.card,borderRadius:10}}>
                    <div>
                      <div style={{fontSize:13,color:t.text,fontWeight:500}}>{k.urunAd||k.urun?.ad||'—'}</div>
                      <div style={{fontSize:11,color:t.textMuted}}>
                        {k.renk&&`${k.renk}`}{k.beden&&` / ${k.beden}`} · ×{k.adet}
                      </div>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:t.accent}}>{para(k.toplamFiyat||k.birimFiyat*k.adet)}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:12,padding:'12px 0',borderTop:`1px solid ${t.border}`}}>
                <span style={{fontSize:13,color:t.textMuted}}>Toplam</span>
                <span style={{fontSize:18,fontWeight:700,color:t.accent}}>{para(siparis.genelToplam)}</span>
              </div>
            </div>

            {/* Kargo */}
            {siparis.kargoNo&&(
              <div style={{padding:'16px 24px',borderBottom:`1px solid ${t.border}`}}>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Kargo</div>
                <div style={{fontSize:13,color:t.text}}>{siparis.kargoFirma||'—'}</div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                  <span style={{fontSize:12,fontFamily:'monospace',color:'#ff9f43'}}>{siparis.kargoNo}</span>
                </div>
              </div>
            )}

            {/* Geçmiş Siparişler */}
            {(siparis.gecmisSiparisler||[]).length > 0 && (
              <div style={{padding:'16px 24px',borderBottom:`1px solid ${t.border}`}}>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>
                  Müşterinin Geçmiş Siparişleri
                </div>
                {siparis.gecmisSiparisler.map(g=>{
                  const gd = DURUMLAR.find(x=>x.id===g.durum)||DURUMLAR[0]
                  return (
                    <div key={g.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${t.border}`}}>
                      <div>
                        <div style={{fontSize:12,color:t.text,fontFamily:'monospace'}}>{g.siparisNo}</div>
                        <div style={{fontSize:11,color:t.textMuted}}>{tarih(g.tarih)}</div>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <span style={{fontSize:11,color:gd.renk}}>{gd.ikon} {gd.label}</span>
                        <span style={{fontSize:12,fontWeight:600,color:t.accent}}>{para(g.genelToplam)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Durum Güncelle — HER durum, HER ZAMAN seçilebilir.
                ESKİ DAVRANIŞ: yalnızca `sira`sı mevcut durumdan büyük olanlar listeleniyor,
                sipariş teslim/iptal/iade edildiğinde ise blok tamamen gizleniyordu. Bu yüzden
                teslim edilmiş bir siparişi iade almak ya da yanlış işaretlenmiş bir durumu
                geri almak panelden mümkün değildi. */}
            <div style={{padding:'16px 24px',borderBottom:`1px solid ${t.border}`}}>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>Durumu Güncelle</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {DURUMLAR.map(d=>{
                  const aktif = d.id === siparis.durum
                  return (
                    <button key={d.id} onClick={()=>durumGuncelle(d.id)} disabled={durumGuncelleniyor||aktif} style={{
                      padding:'10px 14px',borderRadius:10,textAlign:'left',fontSize:13,
                      background:aktif?`${d.renk}22`:`${d.renk}10`,
                      border:`1px solid ${d.renk}${aktif?'66':'30'}`,color:d.renk,
                      fontWeight:aktif?700:500,cursor:aktif?'default':'pointer',
                      opacity:durumGuncelleniyor&&!aktif?.5:1}}>
                      {d.ikon} {d.label}{aktif?' · şu anki durum':''}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {kargoModal && siparis && (
        <KargoModal
          siparis={siparis} t={t}
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
export default function OnlineSiparisler({ t }) {
  t = t || {
    bg:'#0c0b09', card:'rgba(255,255,255,.04)', border:'rgba(255,255,255,.08)',
    text:'#e8e0d4', textMuted:'#666', accent:'#c9b882', accentBg:'rgba(201,184,130,.15)',
    input:'rgba(255,255,255,.06)', hover:'rgba(255,255,255,.06)', sidebar:'#0a0908'
  }

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
      alert(`Shopify: ${sonuc.yeni} yeni, ${sonuc.guncellenen} güncellenen sipariş${sonuc.hatalar?.length ? ` (${sonuc.hatalar.length} hata)` : ''}` + (stokBilgi ? `\n${stokBilgi}` : ''))
    } catch(e) { alert(e.message || 'Shopify siparişleri çekilemedi') }
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
  }, [aktifSekme])

  // Kanal sayıları
  const kanalSayilari = {}
  siparisler.forEach(s=>{ kanalSayilari[s.kanal]=(kanalSayilari[s.kanal]||0)+1 })

  // Kanban gruplar
  const kanbanGruplar = DURUMLAR.filter(d=>d.id!=='iptal').map(d=>({
    ...d,
    siparisler: siparisler.filter(s=>s.sira===undefined&&s.durum===d.id)
  }))

  return (
    <div style={{minHeight:'100vh',background:t.bg,color:t.text,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;} button{cursor:pointer;border:none;background:none;font-family:inherit;}
        input,select{font-family:inherit;} select option{background:#1a1814;}
        .vega-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-scroll-x table{min-width:640px;}
        .vega-drawer{width:480px;}
        @media (max-width:860px){
          .vega-page-pad{padding-left:14px!important;padding-right:14px!important;}
          .vega-grid-2{grid-template-columns:1fr!important;}
          .vega-grid-fields{grid-template-columns:1fr 1fr!important;}
        }
        @media (max-width:600px){
          .vega-header-row{flex-direction:column;align-items:stretch!important;}
          .vega-header-actions{flex-wrap:wrap!important;width:100%;}
          .vega-drawer{width:100vw!important;}
        }
      `}</style>

      <div className="vega-page-pad" style={{padding:'22px 28px 0'}}>
        {/* Başlık */}
        <div className="vega-header-row" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:t.text}}>Online Sipariş Paneli</div>
            <div style={{fontSize:13,color:t.textMuted,marginTop:4}}>
              {siparisler.filter(s=>s.durum==='beklemede').length > 0
                ? <span style={{color:'#f2c94c'}}>⏳ {siparisler.filter(s=>s.durum==='beklemede').length} bekleyen sipariş</span>
                : 'Bekleyen sipariş yok'}
              {analitik?.ortHazirlamaSuresi>0 && (
                <span style={{marginLeft:12,color:t.textMuted}}>Ort. hazırlama: {sure(Math.round(analitik.ortHazirlamaSuresi))}</span>
              )}
            </div>
          </div>
          <div className="vega-header-actions" style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <button onClick={()=>setManuelModal(true)} style={{padding:'9px 18px',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>+ Manuel Sipariş</button>
            <button onClick={shopifydenCek} disabled={shopifyCekiliyor} style={{padding:'9px 18px',borderRadius:10,background:'rgba(149,191,71,.15)',border:'1px solid rgba(149,191,71,.4)',color:'#95BF47',fontSize:13,fontWeight:600,opacity:shopifyCekiliyor?.6:1}}>
              {shopifyCekiliyor ? '⏳ Çekiliyor...' : '🛍️ Tüm Shopify Siparişlerini Çek'}
            </button>
          <button onClick={yukle} style={{padding:'8px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>↺ Yenile</button>
            {/* Ana Sekmeler */}
            {[['siparisler','📦 Siparişler'],['iadeler','↩ İadeler']].map(([k,l])=>(
              <button key={k} onClick={()=>setAktifSekme(k)} style={{padding:'8px 14px',borderRadius:10,fontSize:12,
                background:aktifSekme===k?t.accentBg:t.input,border:`1px solid ${aktifSekme===k?t.accent+'55':t.border}`,
                color:aktifSekme===k?t.accent:t.textMuted,fontWeight:aktifSekme===k?600:400}}>{l}</button>
            ))}
            <div style={{width:1,background:t.border,margin:'0 4px'}}/>
            {aktifSekme==='siparisler'&&[['liste','☰ Liste'],['kanban','⬜ Kanban']].map(([k,l])=>(
              <button key={k} onClick={()=>setGorunum(k)} style={{padding:'8px 14px',borderRadius:10,fontSize:12,
                background:gorunum===k?t.accentBg:t.input,border:`1px solid ${gorunum===k?t.accent+'55':t.border}`,
                color:gorunum===k?t.accent:t.textMuted}}>{l}</button>
            ))}
          </div>
        </div>

        {/* Analitik Kartlar */}
        {aktifSekme==='siparisler' && analitik && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:16}}>
            {[
              {l:'Toplam Sipariş',v:analitik.toplamSiparis,c:t.accent},
              {l:'Tamamlanan',v:analitik.tamamlanan,c:'#6fcf97'},
              {l:'İptal',v:analitik.iptal,c:'#eb5757'},
              {l:'Ciro',v:para(analitik.toplamCiro),c:t.accent},
            ].map(k=>(
              <div key={k.l} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:'12px 14px'}}>
                <div style={{fontSize:9,color:t.textMuted,marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{k.l}</div>
                <div style={{fontSize:16,fontWeight:700,color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Kanal Filtreleri */}
        <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
          {KANALLAR.map(k=>{
            const sayi = k.id==='hepsi' ? siparisler.length : (kanalSayilari[k.id]||0)
            if (k.id!=='hepsi'&&sayi===0) return null
            return (
              <button key={k.id} onClick={()=>setKanalFiltre(k.id)} style={{
                display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,fontSize:12,
                background:kanalFiltre===k.id?`${k.renk}18`:t.input,
                border:`1px solid ${kanalFiltre===k.id?k.renk+'55':t.border}`,
                color:kanalFiltre===k.id?k.renk:t.textMuted}}>
                <span>{k.ikon}</span><span>{k.label}</span>
                <span style={{background:kanalFiltre===k.id?k.renk:t.border,color:kanalFiltre===k.id?'#111':'#999',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700}}>{sayi}</span>
              </button>
            )
          })}
        </div>

        {/* Durum Filtreleri */}
        <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
          <button onClick={()=>setDurumFiltre('hepsi')} style={{padding:'5px 12px',borderRadius:20,fontSize:11,
            background:durumFiltre==='hepsi'?t.accentBg:t.input,border:`1px solid ${durumFiltre==='hepsi'?t.accent+'55':t.border}`,
            color:durumFiltre==='hepsi'?t.accent:t.textMuted}}>Tümü</button>
          {DURUMLAR.map(d=>(
            <button key={d.id} onClick={()=>setDurumFiltre(d.id)} style={{padding:'5px 12px',borderRadius:20,fontSize:11,
              background:durumFiltre===d.id?`${d.renk}15`:t.input,border:`1px solid ${durumFiltre===d.id?d.renk+'40':t.border}`,
              color:durumFiltre===d.id?d.renk:t.textMuted}}>{d.ikon} {d.label}</button>
          ))}
        </div>

        <div style={{borderBottom:`1px solid ${t.border}`,marginBottom:0}}/>
      </div>

      <div className="vega-page-pad" style={{padding:'20px 28px 48px'}}>
        {yukleniyor ? (
          <div style={{padding:60,textAlign:'center',color:t.textMuted}}>⏳ Yükleniyor...</div>
        ) : siparisler.length === 0 ? (
          <div style={{padding:60,textAlign:'center',color:t.textMuted,background:t.card,border:`1px solid ${t.border}`,borderRadius:14}}>
            Sipariş bulunamadı
          </div>
        ) : gorunum === 'liste' ? (
          /* LİSTE GÖRÜNÜM */
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden'}}>
            <div className="vega-scroll-x">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
                  {['Kanal','Sipariş No','Tarih','Müşteri','Ürün','Tutar','Ödeme','Kargo','Durum'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left',letterSpacing:.3}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {siparisler.map(s=>{
                  const d = DURUMLAR.find(x=>x.id===s.durum)||DURUMLAR[0]
                  return (
                    <tr key={s.id} onClick={()=>setSeciliId(s.id)} style={{borderBottom:`1px solid ${t.border}`,cursor:'pointer'}}>
                      <td style={{padding:'11px 14px'}}><KanalIkon kanal={s.kanal}/></td>
                      <td style={{padding:'11px 14px',fontSize:12,color:t.accent,fontFamily:'monospace',fontWeight:600}}>{s.siparisNo}</td>
                      <td style={{padding:'11px 14px',fontSize:11,color:t.textMuted,whiteSpace:'nowrap'}}>{tarih(s.tarih)}</td>
                      <td style={{padding:'11px 14px',fontSize:12,color:t.text}}>
                        {s.musteriAd||`${s.musteri?.ad||''} ${s.musteri?.soyad||''}`.trim()||'—'}
                      </td>
                      <td style={{padding:'11px 14px',fontSize:11,color:t.textMuted}}>{s.kalemler?.length||0} ürün</td>
                      <td style={{padding:'11px 14px',fontSize:13,fontWeight:600,color:t.accent}}>{para(s.genelToplam)}</td>
                      <td style={{padding:'11px 14px',fontSize:11,color:t.textMuted}}>{s.odemeTip||'—'}</td>
                      <td style={{padding:'11px 14px',fontSize:11,color:s.kargoNo?'#ff9f43':t.textMuted}}>
                        {s.kargoNo ? `🚚 ${s.kargoFirma||''}` : '—'}
                      </td>
                      <td style={{padding:'11px 14px'}}>
                        <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:`${d.renk}15`,color:d.renk,fontWeight:600,whiteSpace:'nowrap'}}>
                          {d.ikon} {d.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        ) : (
          /* KANBAN GÖRÜNÜM */
          <div style={{display:'flex',gap:14,overflowX:'auto',paddingBottom:16}}>
            {DURUMLAR.filter(d=>d.id!=='iptal').map(d=>{
              const grup = siparisler.filter(s=>s.durum===d.id)
              return (
                <div key={d.id} style={{minWidth:260,flexShrink:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,padding:'8px 12px',
                    background:`${d.renk}10`,border:`1px solid ${d.renk}25`,borderRadius:10}}>
                    <span style={{fontSize:12,fontWeight:600,color:d.renk}}>{d.ikon} {d.label}</span>
                    <span style={{fontSize:11,background:d.renk,color:'#111',borderRadius:10,padding:'1px 8px',fontWeight:700}}>{grup.length}</span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {grup.map(s=>(
                      <div key={s.id} onClick={()=>setSeciliId(s.id)} style={{
                        background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:14,cursor:'pointer',
                        borderLeft:`3px solid ${d.renk}`}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <KanalIkon kanal={s.kanal} size={20}/>
                            <span style={{fontSize:12,color:t.accent,fontFamily:'monospace',fontWeight:600}}>{s.siparisNo}</span>
                          </div>
                          <span style={{fontSize:13,fontWeight:700,color:t.accent}}>{para(s.genelToplam)}</span>
                        </div>
                        <div style={{fontSize:12,color:t.text,marginBottom:4}}>
                          {s.musteriAd||`${s.musteri?.ad||''} ${s.musteri?.soyad||''}`.trim()||'—'}
                        </div>
                        <div style={{fontSize:11,color:t.textMuted}}>{tarih(s.tarih)}</div>
                        <div style={{fontSize:11,color:t.textMuted,marginTop:4}}>{s.kalemler?.length||0} ürün</div>
                      </div>
                    ))}
                    {grup.length===0&&(
                      <div style={{padding:'20px',textAlign:'center',color:t.textMuted,fontSize:12,background:t.hover,borderRadius:10}}>Boş</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Manuel Sipariş Modal */}
      {iadeModal && (
        <OnlineIadeModal t={t}
          onKapat={()=>setIadeModal(false)}
          onKaydet={()=>{ setIadeModal(false); setAktifSekme('iadeler'); }}
        />
      )}
      {manuelModal && (
        <ManuelSiparisModal
          t={t}
          magazalar={ctxMagazalar||[]}
          onKapat={()=>setManuelModal(false)}
          onKaydet={()=>{ setManuelModal(false); yukle(); }}
        />
      )}

      {aktifSekme==='iadeler'&&(
        <>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
          <button onClick={()=>setIadeModal(true)} style={{padding:'9px 18px',borderRadius:10,background:'rgba(235,87,87,.1)',border:'1px solid rgba(235,87,87,.3)',color:'#eb5757',fontSize:13,fontWeight:600}}>+ Yeni İade</button>
        </div>
        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden'}}>
          {iadeyukleniyor?(
            <div style={{padding:40,textAlign:'center',color:t.textMuted}}>Yükleniyor...</div>
          ):(
            <div className="vega-scroll-x">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
                {['İade No','Sipariş/Fiş','Müşteri','Ürünler','Tutar','Ödeme','Durum','Tarih'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {iadeler.map(iade=>(
                  <tr key={iade.id} style={{borderBottom:`1px solid ${t.border}`}}>
                    <td style={{padding:'10px 14px',fontSize:11,color:t.textMuted,fontFamily:'monospace'}}>{iade.iadeNo||iade.id?.slice(0,8)}</td>
                    <td style={{padding:'10px 14px',fontSize:12,color:t.text}}>
                      <div>{iade.siparis?.siparisNo||iade.satis?.fisNo||'—'}</div>
                      {iade.siparis?.durum&&<div style={{fontSize:10,color:t.textMuted}}>{iade.siparis.durum}</div>}
                    </td>
                    <td style={{padding:'10px 14px',fontSize:12,color:t.text}}>{iade.siparis?.musteriAd||iade.satis?.musteri?.ad||'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:11,color:t.textMuted}}>{(iade.kalemler||[]).map(k=>k.urunAd).join(', ').slice(0,30)||'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:13,fontWeight:700,color:'#eb5757'}}>₺{Number(iade.toplam||iade.toplamIade||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</td>
                    <td style={{padding:'10px 14px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(86,204,242,.1)',color:'#56ccf2'}}>{iade.siparis?.odemeTip||iade.notlar?.split(' - ')[1]||'—'}</span></td>
                    <td style={{padding:'10px 14px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                      background:iade.durum==='onaylandi'?'rgba(111,207,151,.1)':iade.durum==='reddedildi'?'rgba(235,87,87,.1)':'rgba(242,201,76,.1)',
                      color:iade.durum==='onaylandi'?'#6fcf97':iade.durum==='reddedildi'?'#eb5757':'#f2c94c'}}>
                      {iade.durum==='onaylandi'?'✓ Onaylandı':iade.durum==='reddedildi'?'✕ Reddedildi':'⏳ Bekliyor'}
                    </span></td>
                    <td style={{padding:'10px 14px',fontSize:11,color:t.textMuted}}>{iade.tarih?new Date(iade.tarih).toLocaleDateString('tr-TR'):'—'}</td>
                  </tr>
                ))}
                {iadeler.length===0&&<tr><td colSpan={8} style={{padding:40,textAlign:'center',color:t.textMuted}}>İade bulunamadı</td></tr>}
              </tbody>
            </table>
            </div>
          )}
        </div>
        </>
      )}

      {/* Quick View Drawer */}
      {seciliId && (
        <QuickView
          siparisId={seciliId}
          t={t}
          onKapat={()=>setSeciliId(null)}
          onDurumGuncelle={()=>{ yukle(); }}
        />
      )}
    </div>
  )
}