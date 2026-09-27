import { useState, useEffect } from 'react'
import * as api from './api'

const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const tarihTR = iso => iso ? new Date(iso).toLocaleDateString('tr-TR') : '—'

const TIP_RENK = {
  borc:      { label: 'Borç',      renk: '#eb5757', ikon: '▲' },
  alacak:    { label: 'Alacak',    renk: '#f2c94c', ikon: '▲' },
  odeme:     { label: 'Ödeme',     renk: '#6fcf97', ikon: '▼' },
  tahsilat:  { label: 'Tahsilat',  renk: '#6fcf97', ikon: '▼' },
}

// ─── CARİ MODAL ───────────────────────────────────────────────
function CariModal({ cari, onKaydet, onKapat, t }) {
  const bos = { ad:'', telefon:'', email:'', adres:'', vergiNo:'', tip:'musteri', notlar:'' }
  const [form, setForm] = useState(cari ? {...cari} : bos)
  const [kayit, setKayit] = useState(false)
  const g = (k,v) => setForm(p=>({...p,[k]:v}))
  const inp = { width:'100%', padding:'9px 12px', borderRadius:10, background:t.input, border:`1px solid ${t.border}`, color:t.text, fontSize:13, outline:'none' }

  const kaydet = async () => {
    if (!form.ad.trim()) return alert('Ad zorunlu')
    setKayit(true)
    try {
      if (cari) await api.cariGuncelle(cari.id, form)
      else       await api.cariEkle(form)
      onKaydet()
    } catch(e) { alert(e.message) }
    finally { setKayit(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:'100%',maxWidth:460}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>{cari?'Cari Düzenle':'Yeni Cari Hesap'}</div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          {[['musteri','Müşteri'],['tedarikci','Tedarikçi']].map(([k,l])=>(
            <button key={k} onClick={()=>g('tip',k)} style={{flex:1,padding:'8px 0',borderRadius:8,fontSize:13,
              background:form.tip===k?t.accentBg:t.input,border:`1px solid ${form.tip===k?t.accent+'55':t.border}`,
              color:form.tip===k?t.accent:t.textMuted,fontWeight:form.tip===k?600:400}}>{l}</button>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div><div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Ad *</div><input value={form.ad} onChange={e=>g('ad',e.target.value)} style={inp}/></div>
          <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Telefon</div><input value={form.telefon||''} onChange={e=>g('telefon',e.target.value)} style={inp}/></div>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Vergi No</div><input value={form.vergiNo||''} onChange={e=>g('vergiNo',e.target.value)} style={inp}/></div>
          </div>
          <div><div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Adres</div><input value={form.adres||''} onChange={e=>g('adres',e.target.value)} style={inp}/></div>
          <div><div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Notlar</div><textarea value={form.notlar||''} onChange={e=>g('notlar',e.target.value)} rows={2} style={{...inp,resize:'vertical'}}/></div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={onKapat} style={{flex:1,padding:'10px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'10px 0',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>
            {kayit?'Kaydediliyor...':cari?'Güncelle':'Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── HAREKET MODAL ────────────────────────────────────────────
function HareketModal({ cari, onKaydet, onKapat, t }) {
  const bugun = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({ tip: cari.tip==='tedarikci'?'borc':'alacak', tutar:'', aciklama:'', belgeNo:'', vadeTarihi:'' })
  const [kayit, setKayit] = useState(false)
  const g = (k,v) => setForm(p=>({...p,[k]:v}))
  const inp = { width:'100%', padding:'9px 12px', borderRadius:10, background:t.input, border:`1px solid ${t.border}`, color:t.text, fontSize:13, outline:'none' }

  const tipSecenekleri = cari.tip==='tedarikci' ? ['borc','odeme'] : ['alacak','tahsilat']

  const kaydet = async () => {
    if (!form.tutar || Number(form.tutar) <= 0) return alert('Tutar zorunlu')
    setKayit(true)
    try {
      await api.cariHareketEkle({
        cariId: cari.id,
        tip: form.tip,
        tutar: Number(form.tutar),
        aciklama: form.aciklama || null,
        belgeNo: form.belgeNo || null,
        bakiyeSonrasi: 0,
        vadeTarihi: form.vadeTarihi ? form.vadeTarihi + 'T12:00:00.000Z' : null,
      })
      onKaydet()
    } catch(e) { alert(e.message) }
    finally { setKayit(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:'100%',maxWidth:420}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>Hareket Ekle — {cari.ad}</div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',gap:8}}>
            {tipSecenekleri.map(k=>(
              <button key={k} onClick={()=>g('tip',k)} style={{flex:1,padding:'8px 0',borderRadius:8,fontSize:12,
                background:form.tip===k?TIP_RENK[k]?.renk+'18':t.input,
                border:`1px solid ${form.tip===k?TIP_RENK[k]?.renk+'44':t.border}`,
                color:form.tip===k?TIP_RENK[k]?.renk:t.textMuted,fontWeight:form.tip===k?600:400}}>
                {TIP_RENK[k]?.ikon} {TIP_RENK[k]?.label}
              </button>
            ))}
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Tutar *</div>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
              <input type="number" value={form.tutar} onChange={e=>g('tutar',e.target.value)}
                style={{...inp,paddingLeft:28,fontSize:16,fontWeight:700,color:TIP_RENK[form.tip]?.renk}}/>
            </div>
          </div>
          <div><div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Açıklama</div><input value={form.aciklama} onChange={e=>g('aciklama',e.target.value)} style={inp} placeholder="Fatura açıklaması..."/></div>
          <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Belge No</div><input value={form.belgeNo} onChange={e=>g('belgeNo',e.target.value)} style={inp} placeholder="F-001"/></div>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Vade Tarihi</div><input type="date" value={form.vadeTarihi} onChange={e=>g('vadeTarihi',e.target.value)} style={inp}/></div>
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={onKapat} style={{flex:1,padding:'10px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'10px 0',borderRadius:10,
            background:TIP_RENK[form.tip]?.renk+'18',border:`1px solid ${TIP_RENK[form.tip]?.renk}44`,
            color:TIP_RENK[form.tip]?.renk,fontSize:13,fontWeight:600}}>
            {kayit?'Kaydediliyor...':'+ Hareket Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TAHSİLAT / ÖDEME MODAL ───────────────────────────────────
function TahsilatModal({ hareket, cari, onKaydet, onKapat, t }) {
  const [tutar, setTutar] = useState(String(hareket.tutar))
  const [aciklama, setAciklama] = useState('')
  const [kayit, setKayit] = useState(false)
  const karsiTip = hareket.tip === 'alacak' ? 'tahsilat' : 'odeme'
  const inp = { width:'100%', padding:'9px 12px', borderRadius:10, background:t.input, border:`1px solid ${t.border}`, color:t.text, fontSize:13, outline:'none' }

  const kaydet = async () => {
    if (!tutar || Number(tutar) <= 0) return alert('Tutar zorunlu')
    setKayit(true)
    try {
      // Karşı hareket oluştur (tahsilat/ödeme)
      await api.cariHareketEkle({
        cariId: cari.id,
        tip: karsiTip,
        tutar: Number(tutar),
        aciklama: aciklama || `${hareket.tip==='alacak'?'Tahsilat':'Ödeme'} - ${hareket.aciklama||hareket.belgeNo||''}`,
        bakiyeSonrasi: 0,
      })
      // Orijinali ödendi işaretle
      await fetch(`${api.API_BASE}/cari/hareket/${hareket.id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ odendi: true })
      })
      onKaydet()
    } catch(e) { alert(e.message) }
    finally { setKayit(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:'100%',maxWidth:400}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text,marginBottom:16}}>
          {hareket.tip==='alacak'?'💰 Tahsilat':'💸 Ödeme'} — {cari.ad}
        </div>
        <div style={{padding:'12px 16px',background:'rgba(255,255,255,.03)',borderRadius:10,marginBottom:16,fontSize:12,color:t.textMuted}}>
          Hareket: {hareket.aciklama||hareket.belgeNo||'—'} · ₺{Number(hareket.tutar).toLocaleString('tr-TR')}
          {hareket.vadeTarihi&&<div style={{marginTop:4,color:new Date(hareket.vadeTarihi)<new Date()?'#eb5757':'#f2c94c'}}>Vade: {tarihTR(hareket.vadeTarihi)}</div>}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Tahsil Edilecek Tutar</div>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
              <input type="number" value={tutar} onChange={e=>setTutar(e.target.value)}
                style={{...inp,paddingLeft:28,fontSize:18,fontWeight:700,color:'#6fcf97'}}/>
            </div>
          </div>
          <div><div style={{fontSize:11,color:t.textMuted,marginBottom:5}}>Açıklama</div><input value={aciklama} onChange={e=>setAciklama(e.target.value)} style={inp} placeholder="Opsiyonel..."/></div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={onKapat} style={{flex:1,padding:'10px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'10px 0',borderRadius:10,background:'rgba(111,207,151,.12)',border:'1px solid rgba(111,207,151,.35)',color:'#6fcf97',fontSize:13,fontWeight:700}}>
            {kayit?'İşleniyor...':hareket.tip==='alacak'?'✓ Tahsil Et':'✓ Ödeme Yap'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── HESAP DÖKÜMÜ ─────────────────────────────────────────────
function HesapDokumu({ cari, onKapat, onGuncelle, t }) {
  const [hareketler, setHareketler] = useState([])
  const [tahsilatModal, setTahsilatModal] = useState(null)
  const [hareketModal, setHareketModal] = useState(false)

  const yukle = () => api.cariHareketleriGetir(cari.id).then(setHareketler).catch(()=>setHareketler([]))

  useEffect(() => { yukle() }, [cari?.id])

  // Güncel bakiyeyi hareketlerden hesapla
  const guncelBakiye = hareketler.reduce((t, h) => {
    if (h.tip === 'alacak' || h.tip === 'borc') return t + Number(h.tutar)
    if (h.tip === 'tahsilat' || h.tip === 'odeme') return t - Number(h.tutar)
    return t
  }, 0)
  const bekleyenler = hareketler.filter(h => (h.tip==='alacak'||h.tip==='borc') && !h.odendi)
  const toplamBekleyen = bekleyenler.reduce((t,h)=>t+Number(h.tutar),0)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:'100%',maxWidth:620,maxHeight:'85vh',overflowY:'auto'}}>
        
        {/* Başlık */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:t.text}}>{cari.ad}</div>
            <div style={{fontSize:12,color:t.textMuted}}>{cari.tip==='musteri'?'Müşteri':'Tedarikçi'} · {cari.telefon||''}</div>
          </div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>

        {/* Bakiye kartları */}
        <div className="vega-grid-3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:t.textMuted,marginBottom:4}}>GÜNCEL BAKİYE</div>
            <div style={{fontSize:18,fontWeight:700,color:guncelBakiye>0?'#eb5757':'#6fcf97'}}>
              {para(Math.abs(guncelBakiye))}
            </div>
            <div style={{fontSize:11,color:t.textMuted}}>{guncelBakiye>0?'Borçlu':guncelBakiye<0?'Alacaklı':'Sıfır'}</div>
          </div>
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:t.textMuted,marginBottom:4}}>BEKLEYEN</div>
            <div style={{fontSize:18,fontWeight:700,color:'#f2c94c'}}>{para(toplamBekleyen)}</div>
            <div style={{fontSize:11,color:t.textMuted}}>{bekleyenler.length} hareket</div>
          </div>
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:t.textMuted,marginBottom:4}}>TOPLAM İŞLEM</div>
            <div style={{fontSize:18,fontWeight:700,color:t.accent}}>{hareketler.length}</div>
            <div style={{fontSize:11,color:t.textMuted}}>hareket</div>
          </div>
        </div>

        {/* Bekleyen vadeler */}
        {bekleyenler.some(h=>h.vadeTarihi)&&(
          <div style={{marginBottom:16,padding:'12px 16px',background:'rgba(242,201,76,.06)',border:'1px solid rgba(242,201,76,.2)',borderRadius:10}}>
            <div style={{fontSize:11,color:'#f2c94c',fontWeight:600,marginBottom:8}}>⏰ Bekleyen Vadeler</div>
            {bekleyenler.filter(h=>h.vadeTarihi).map(h=>{
              const gun=Math.ceil((new Date(h.vadeTarihi)-new Date())/86400000)
              return (
                <div key={h.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div style={{fontSize:12,color:t.text}}>{h.aciklama||h.belgeNo||'—'}</div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:11,color:gun<0?'#eb5757':gun<=7?'#f2c94c':'#6fcf97'}}>
                      {gun<0?`${Math.abs(gun)} gün geçti`:gun===0?'Bugün':`${gun} gün kaldı`}
                    </span>
                    <span style={{fontSize:12,fontWeight:700,color:t.accent}}>{para(h.tutar)}</span>
                    <button onClick={()=>setTahsilatModal(h)} style={{fontSize:11,padding:'3px 8px',borderRadius:6,
                      background:'rgba(111,207,151,.08)',border:'1px solid rgba(111,207,151,.25)',color:'#6fcf97',cursor:'pointer'}}>
                      💰 Tahsil
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Hareket Ekle butonu */}
        <button onClick={()=>setHareketModal(true)} style={{width:'100%',padding:'9px 0',borderRadius:10,
          background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600,marginBottom:16}}>
          + Hareket Ekle
        </button>

        {/* Hareketler listesi */}
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {hareketler.map(h=>{
            const ht = TIP_RENK[h.tip] || TIP_RENK.borc
            const gun = h.vadeTarihi ? Math.ceil((new Date(h.vadeTarihi)-new Date())/86400000) : null
            return (
              <div key={h.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'12px 14px',background:t.card,border:`1px solid ${t.border}`,borderRadius:10,
                opacity:h.odendi?0.5:1}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                    <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:ht.renk+'18',color:ht.renk,fontWeight:600}}>
                      {ht.ikon} {ht.label}
                    </span>
                    {h.odendi&&<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:'rgba(111,207,151,.12)',color:'#6fcf97'}}>✓ Ödendi</span>}
                    {h.belgeNo&&<span style={{fontSize:10,color:t.textMuted,fontFamily:'monospace'}}>#{h.belgeNo}</span>}
                  </div>
                  <div style={{fontSize:12,color:t.text}}>{h.aciklama||'—'}</div>
                  <div style={{fontSize:10,color:t.textMuted,marginTop:2}}>{tarihTR(h.tarih||h.olusturuldu)}</div>
                  {gun!==null&&!h.odendi&&(
                    <div style={{fontSize:10,fontWeight:600,color:gun<0?'#eb5757':gun<=7?'#f2c94c':'#6fcf97',marginTop:2}}>
                      {gun<0?`⚠ ${Math.abs(gun)} gün geçti`:gun===0?'🔴 Bugün vadesi doluyor':`⏱ ${gun} gün kaldı`}
                    </div>
                  )}
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:15,fontWeight:700,color:h.odendi?'#555':ht.renk,textDecoration:h.odendi?'line-through':'none'}}>
                    {['alacak','borc'].includes(h.tip)?'+':'-'}{para(h.tutar)}
                  </div>
                  {!h.odendi && (h.tip==='alacak'||h.tip==='borc') && (
                    <button onClick={()=>setTahsilatModal(h)} style={{marginTop:4,fontSize:11,padding:'3px 8px',borderRadius:6,
                      background:'rgba(111,207,151,.08)',border:'1px solid rgba(111,207,151,.25)',color:'#6fcf97',cursor:'pointer'}}>
                      💰 {h.tip==='alacak'?'Tahsil Et':'Öde'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {hareketler.length===0&&<div style={{padding:30,textAlign:'center',color:t.textMuted}}>Hareket bulunamadı</div>}
        </div>
      </div>

      {tahsilatModal&&(
        <TahsilatModal hareket={tahsilatModal} cari={cari} t={t}
          onKapat={()=>setTahsilatModal(null)}
          onKaydet={()=>{ setTahsilatModal(null); yukle(); onGuncelle() }}
        />
      )}
      {hareketModal&&(
        <HareketModal cari={cari} t={t}
          onKapat={()=>setHareketModal(false)}
          onKaydet={()=>{ setHareketModal(false); yukle(); onGuncelle() }}
        />
      )}
    </div>
  )
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function BorcAlacak({ t }) {
  const [cariler, setCariler]       = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [arama, setArama]           = useState('')
  const [tipFiltre, setTipFiltre]   = useState('hepsi')
  const [cariModal, setCariModal]   = useState(null)
  const [secilenCari, setSecilenCari] = useState(null)

  const yukle = () => {
    setYukleniyor(true)
    api.carileriGetir().then(setCariler).catch(console.error).finally(()=>setYukleniyor(false))
  }

  useEffect(() => { yukle() }, [])

  const filtreli = cariler.filter(c => {
    const aramaEsles = !arama || c.ad.toLowerCase().includes(arama.toLowerCase()) || c.telefon?.includes(arama)
    const tipEsles = tipFiltre==='hepsi' || c.tip===tipFiltre
    return aramaEsles && tipEsles
  })

  const toplamBorc = cariler.filter(c=>Number(c.bakiye)>0).reduce((t,c)=>t+Number(c.bakiye),0)
  const toplamAlacak = cariler.filter(c=>Number(c.bakiye)<0).reduce((t,c)=>t+Math.abs(Number(c.bakiye)),0)

  return (
    <div className="vega-page-pad" style={{padding:'22px 28px'}}>
      <style>{`
        .vega-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-scroll-x table{min-width:640px;}
        @media (max-width:860px){
          .vega-page-pad{padding-left:14px!important;padding-right:14px!important;}
          .vega-grid-2,.vega-grid-3{grid-template-columns:1fr!important;}
        }
        @media (max-width:600px){
          .vega-header-row{flex-direction:column;align-items:stretch!important;gap:12px;}
        }
      `}</style>
      {/* Başlık */}
      <div className="vega-header-row" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:t.text}}>Borç / Alacak</div>
          <div style={{fontSize:13,color:t.textMuted,marginTop:4}}>{cariler.length} cari hesap</div>
        </div>
        <button onClick={()=>setCariModal('yeni')} style={{padding:'10px 20px',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>
          + Yeni Hesap
        </button>
      </div>

      {/* KPI */}
      <div className="vega-grid-3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:20}}>
        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:'16px 18px'}}>
          <div style={{fontSize:11,color:t.textMuted,marginBottom:4}}>TOPLAM ALACAK</div>
          <div style={{fontSize:22,fontWeight:700,color:'#6fcf97'}}>{para(toplamAlacak)}</div>
        </div>
        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:'16px 18px'}}>
          <div style={{fontSize:11,color:t.textMuted,marginBottom:4}}>TOPLAM BORÇ</div>
          <div style={{fontSize:22,fontWeight:700,color:'#eb5757'}}>{para(toplamBorc)}</div>
        </div>
        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:'16px 18px'}}>
          <div style={{fontSize:11,color:t.textMuted,marginBottom:4}}>NET BAKİYE</div>
          <div style={{fontSize:22,fontWeight:700,color:toplamAlacak-toplamBorc>=0?'#6fcf97':'#eb5757'}}>{para(Math.abs(toplamAlacak-toplamBorc))}</div>
          <div style={{fontSize:11,color:t.textMuted}}>{toplamAlacak-toplamBorc>=0?'Net Alacak':'Net Borç'}</div>
        </div>
      </div>

      {/* Filtreler */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <input value={arama} onChange={e=>setArama(e.target.value)} placeholder="Ad veya telefon ara..."
          style={{flex:1,minWidth:200,padding:'9px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
        {[['hepsi','Tümü'],['musteri','Müşteriler'],['tedarikci','Tedarikçiler']].map(([k,l])=>(
          <button key={k} onClick={()=>setTipFiltre(k)} style={{padding:'9px 16px',borderRadius:10,fontSize:12,
            background:tipFiltre===k?t.accentBg:t.input,border:`1px solid ${tipFiltre===k?t.accent+'55':t.border}`,
            color:tipFiltre===k?t.accent:t.textMuted}}>{l}</button>
        ))}
      </div>

      {/* Liste */}
      {yukleniyor ? <div style={{padding:40,textAlign:'center',color:t.textMuted}}>Yükleniyor...</div> : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtreli.map(c=>{
            const bakiye = Number(c.bakiye)
            const durum = bakiye > 0 ? 'borc' : bakiye < 0 ? 'alacak' : 'sifir'
            return (
              <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'14px 18px',background:t.card,border:`1px solid ${t.border}`,borderRadius:12,
                cursor:'pointer'}}
                onClick={()=>setSecilenCari(c)}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:t.text}}>{c.ad}</div>
                  <div style={{fontSize:12,color:t.textMuted,marginTop:2}}>
                    <span style={{padding:'1px 8px',borderRadius:20,background:t.hover,fontSize:11}}>{c.tip==='musteri'?'Müşteri':'Tedarikçi'}</span>
                    {c.telefon&&<span style={{marginLeft:8}}>{c.telefon}</span>}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:16,fontWeight:700,color:durum==='borc'?'#eb5757':durum==='alacak'?'#6fcf97':t.textMuted}}>
                    {para(Math.abs(bakiye))}
                  </div>
                  <div style={{fontSize:11,color:durum==='borc'?'#eb5757':durum==='alacak'?'#6fcf97':t.textMuted}}>
                    {durum==='borc'?'Borçlu':durum==='alacak'?'Alacaklı':'Dengede'}
                  </div>
                </div>
              </div>
            )
          })}
          {filtreli.length===0&&<div style={{padding:40,textAlign:'center',color:t.textMuted}}>Kayıt bulunamadı</div>}
        </div>
      )}

      {cariModal&&(
        <CariModal cari={cariModal==='yeni'?null:cariModal} t={t}
          onKaydet={()=>{ setCariModal(null); yukle() }}
          onKapat={()=>setCariModal(null)}
        />
      )}
      {secilenCari&&(
        <HesapDokumu cari={secilenCari} t={t}
          onKapat={()=>setSecilenCari(null)}
          onGuncelle={()=>{ 
            yukle()
            // Güncel bakiyeyi çek
            api.carileriGetir().then(liste => {
              const guncel = liste.find(c => c.id === secilenCari?.id)
              if (guncel) setSecilenCari(guncel)
            }).catch(()=>{})
          }}
        />
      )}
    </div>
  )
}