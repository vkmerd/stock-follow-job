import { useState, useEffect } from 'react'
import { useVega } from './VegaContext'
import {
  masrafKategorileriniGetir, masrafKategoriEkle, masrafKategoriGuncelle, masrafKategoriSil,
  masraflariGetir, masrafOzetGetir, masrafEkle, masrafGuncelle, masrafSil,
  bankaHesaplariGetir
} from './api'

const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const tarihTR = iso => new Date(iso).toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'})

const IKONLAR = ['💰','🏠','⚡','💧','👥','🚚','📢','🔧','📦','🖥','📋','🏭','🎯','💼','🌐','📱']
const RENKLER = ['#c9b882','#6fcf97','#56ccf2','#bb87fc','#f2c94c','#eb5757','#ff9f43','#a29bfe','#fd79a8','#00cec9']

// ─── KATEGORİ MODAL ───────────────────────────────────────────
function KategoriModal({ kategori, onKaydet, onKapat, t }) {
  const bos = { ad:'', ikon:'💰', renk:'#c9b882' }
  const [form, setForm] = useState(kategori || bos)
  const [hata, setHata] = useState('')
  const [kayit, setKayit] = useState(false)
  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  const kaydet = async () => {
    if (!form.ad.trim()) return setHata('Kategori adı zorunlu')
    setHata(''); setKayit(true)
    try {
      if (kategori) await masrafKategoriGuncelle(kategori.id, form)
      else          await masrafKategoriEkle(form)
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:'28px 32px',width:'100%',maxWidth:420}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>{kategori?'Kategori Düzenle':'Yeni Kategori'}</div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Kategori Adı *</div>
            <input value={form.ad} onChange={e=>g('ad',e.target.value)} placeholder="örn. Kira, Elektrik..."
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>İkon</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {IKONLAR.map(ikon=>(
                <button key={ikon} onClick={()=>g('ikon',ikon)} style={{
                  width:40,height:40,borderRadius:10,fontSize:18,
                  background:form.ikon===ikon?t.accentBg:t.input,
                  border:`1px solid ${form.ikon===ikon?t.accent+'55':t.border}`}}>{ikon}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Renk</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {RENKLER.map(renk=>(
                <button key={renk} onClick={()=>g('renk',renk)} style={{
                  width:28,height:28,borderRadius:'50%',background:renk,
                  border:`3px solid ${form.renk===renk?'#fff':'transparent'}`,
                  boxShadow:form.renk===renk?`0 0 0 2px ${renk}`:'none'}}/>
              ))}
            </div>
          </div>
        </div>
        {hata && <div style={{marginTop:12,padding:'8px 14px',background:'rgba(235,87,87,.1)',border:'1px solid rgba(235,87,87,.3)',borderRadius:8,fontSize:12,color:'#eb5757'}}>{hata}</div>}
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={onKapat} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'11px 0',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>
            {kayit?'Kaydediliyor...':kategori?'Güncelle':'Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MASRAF FORMU MODAL ───────────────────────────────────────
function MasrafModal({ masraf, kategoriler, magazalar, bankaHesaplar=[], onKaydet, onKapat, t }) {
  const bugun = new Date().toISOString().slice(0,10)
  const bos = { kategoriId:'', magazaId:'', tutar:'', aciklama:'', faturaNo:'', tarih:bugun, odemeKaynagi:'nakit' }
  const [form, setForm] = useState(masraf ? {
    ...masraf, tutar: Number(masraf.tutar),
    kategoriId: masraf.kategoriId||'', magazaId: masraf.magazaId||'',
    tarih: masraf.tarih?.slice(0,10)||bugun, odemeKaynagi: masraf.odemeKaynagi||'nakit'
  } : bos)
  const [hata, setHata] = useState('')
  const [kayit, setKayit] = useState(false)
  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  const kaydet = async () => {
    if (!form.tutar || Number(form.tutar) <= 0) return setHata('Tutar zorunlu ve sıfırdan büyük olmalı')
    setHata(''); setKayit(true)
    try {
      if (masraf) await masrafGuncelle(masraf.id, form)
      else        await masrafEkle(form)
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  const seciliKat = kategoriler.find(k=>k.id===form.kategoriId)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:'28px 32px',width:'100%',maxWidth:500}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>{masraf?'Masraf Düzenle':'Yeni Masraf Kaydı'}</div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {/* Kategori */}
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Kategori</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {kategoriler.map(k=>(
                <button key={k.id} onClick={()=>g('kategoriId',k.id)} style={{
                  padding:'7px 14px',borderRadius:20,fontSize:12,
                  background:form.kategoriId===k.id?`${k.renk}18`:t.input,
                  border:`1px solid ${form.kategoriId===k.id?k.renk+'55':t.border}`,
                  color:form.kategoriId===k.id?k.renk:t.textMuted,
                  fontWeight:form.kategoriId===k.id?600:400}}>
                  {k.ikon} {k.ad}
                </button>
              ))}
            </div>
          </div>

          {/* Mağaza */}
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Mağaza</div>
            <select value={form.magazaId} onChange={e=>g('magazaId',e.target.value)}
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}>
              <option value="">Genel (Mağazaya bağlı değil)</option>
              {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
            </select>
          </div>

          {/* Ödeme Kaynağı */}
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Ödeme Kaynağı</div>
            <div style={{display:'flex',gap:8}}>
              {[['nakit','💵 Nakit'],['kart','💳 Kart'],['banka','🏦 Banka']].map(([k,l])=>(
                <button type="button" key={k} onClick={()=>g('odemeKaynagi',k)} style={{flex:1,padding:'8px 0',borderRadius:10,fontSize:12,
                  background:form.odemeKaynagi===k?t.accentBg:t.input,
                  border:`1px solid ${form.odemeKaynagi===k?t.accent+'55':t.border}`,
                  color:form.odemeKaynagi===k?t.accent:t.textMuted,
                  fontWeight:form.odemeKaynagi===k?600:400}}>{l}</button>
              ))}
            </div>
            {form.odemeKaynagi==='banka'&&(
              <select value={form.bankaHesapId||''} onChange={e=>g('bankaHesapId',e.target.value)}
                style={{width:'100%',marginTop:8,padding:'9px 12px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}>
                <option value="">Hesap seçin...</option>
                {bankaHesaplar.map(h=><option key={h.id} value={h.id}>{h.ad} — {h.banka}</option>)}
              </select>
            )}
          </div>

          {/* Tutar + Tarih */}
          <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Tutar *</div>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
                <input type="number" value={form.tutar} onChange={e=>g('tutar',e.target.value)} placeholder="0,00"
                  style={{width:'100%',padding:'10px 14px 10px 28px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.accent,fontSize:16,fontWeight:700,outline:'none'}}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Tarih</div>
              <input type="date" value={form.tarih} onChange={e=>g('tarih',e.target.value)}
                style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
            </div>
          </div>

          {/* Açıklama + Fatura No */}
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Açıklama</div>
            <input value={form.aciklama} onChange={e=>g('aciklama',e.target.value)} placeholder="Masraf detayı..."
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Fatura No</div>
            <input value={form.faturaNo} onChange={e=>g('faturaNo',e.target.value)} placeholder="Opsiyonel..."
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
          </div>
        </div>

        {hata && <div style={{marginTop:12,padding:'8px 14px',background:'rgba(235,87,87,.1)',border:'1px solid rgba(235,87,87,.3)',borderRadius:8,fontSize:12,color:'#eb5757'}}>{hata}</div>}

        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={onKapat} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'11px 0',borderRadius:10,background:'rgba(235,87,87,.12)',border:'1px solid rgba(235,87,87,.35)',color:'#eb5757',fontSize:13,fontWeight:700}}>
            {kayit?'Kaydediliyor...':masraf?'Güncelle':'💸 Masraf Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function MasrafYonetimi({ t }) {
  t = t || {
    bg:'#0c0b09', card:'rgba(255,255,255,.04)', border:'rgba(255,255,255,.08)',
    text:'#e8e0d4', textMuted:'#666', accent:'#c9b882', accentBg:'rgba(201,184,130,.15)',
    input:'rgba(255,255,255,.06)', hover:'rgba(255,255,255,.06)', sidebar:'#0a0908'
  }

  const { magazalar: ctxMagazalar } = useVega()
  const magazalar = (ctxMagazalar||[]).filter(m=>m.tip!=='online')

  const simdi = new Date()
  const [sekme, setSekme]           = useState('liste')    // liste | kategoriler
  const [masraflar, setMasraflar]   = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [ozet, setOzet]             = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [modal, setModal]           = useState(null)       // null | 'masraf' | 'kategori' | obj
  const [bankaHesaplar, setBankaHesaplar] = useState([])
  const [katModal, setKatModal]     = useState(null)
  const [yil, setYil]               = useState(simdi.getFullYear())
  const [ay, setAy]                 = useState(simdi.getMonth()+1)
  const [magazaFiltre, setMagazaFiltre] = useState('')

  const yukle = async () => {
    setYukleniyor(true)
    try {
      const [mData, kData, bData, oData] = await Promise.all([
        masraflariGetir({ limit:200, ...(magazaFiltre&&{magazaId:magazaFiltre}) }),
        masrafKategorileriniGetir(),
        bankaHesaplariGetir().catch(()=>[]),
        masrafOzetGetir({ yil, ay, ...(magazaFiltre&&{magazaId:magazaFiltre}) }),
      ])
      setMasraflar(mData)
      setKategoriler(kData)
      setBankaHesaplar(Array.isArray(bData)?bData:[])
      setOzet(oData)
    } catch(e) { console.error(e) }
    finally { setYukleniyor(false) }
  }

  useEffect(() => { yukle() }, [yil, ay, magazaFiltre])

  const sil = async (id) => {
    if (!window.confirm('Bu masraf silinsin mi?')) return
    await masrafSil(id)
    setMasraflar(p=>p.filter(m=>m.id!==id))
  }

  const katSil = async (id) => {
    if (!window.confirm('Bu kategori silinsin mi?')) return
    await masrafKategoriSil(id)
    setKategoriler(p=>p.filter(k=>k.id!==id))
  }

  const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

  return (
    <div style={{minHeight:'100vh',background:t.bg,color:t.text,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;} button{cursor:pointer;border:none;background:none;font-family:inherit;}
        input,select{font-family:inherit;} select option{background:#1a1814;}
        tbody tr:hover td{background:rgba(255,255,255,.015);}
        .vega-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-scroll-x table{min-width:640px;}
        .vega-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap!important;}
        .vega-tabs button{white-space:nowrap;flex-shrink:0;}
        @media (max-width:860px){
          .vega-page-pad{padding-left:14px!important;padding-right:14px!important;}
          .vega-grid-2,.vega-detail-grid{grid-template-columns:1fr!important;}
        }
        @media (max-width:600px){
          .vega-header-row{flex-direction:column;align-items:stretch!important;}
          .vega-header-actions{width:100%;}
        }
      `}</style>

      <div className="vega-page-pad" style={{padding:'22px 28px 0'}}>
        {/* Başlık */}
        <div className="vega-header-row" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:t.text}}>Masraf Yönetimi</div>
            <div style={{fontSize:13,color:t.textMuted,marginTop:4}}>
              {AYLAR[ay-1]} {yil} · Toplam: <span style={{color:'#eb5757',fontWeight:600}}>{para(ozet?.toplamTutar||0)}</span>
            </div>
          </div>
          <button className="vega-header-actions" onClick={()=>setModal('masraf')} style={{
            padding:'10px 22px',borderRadius:12,
            background:'rgba(235,87,87,.12)',border:'1px solid rgba(235,87,87,.35)',
            color:'#eb5757',fontSize:13,fontWeight:700}}>
            + Masraf Ekle
          </button>
        </div>

        {/* Filtreler */}
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <select value={ay} onChange={e=>setAy(Number(e.target.value))}
            style={{padding:'8px 14px',borderRadius:20,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}>
            {AYLAR.map((a,i)=><option key={i} value={i+1}>{a}</option>)}
          </select>
          <select value={yil} onChange={e=>setYil(Number(e.target.value))}
            style={{padding:'8px 14px',borderRadius:20,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}>
            {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <select value={magazaFiltre} onChange={e=>setMagazaFiltre(e.target.value)}
            style={{padding:'8px 14px',borderRadius:20,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}>
            <option value="">Tüm Mağazalar</option>
            {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
          </select>
        </div>

        {/* Sekmeler */}
        <div className="vega-tabs" style={{display:'flex',gap:4,borderBottom:`1px solid ${t.border}`}}>
          {[['liste','📋 Masraf Listesi'],['kategoriler','🏷 Kategoriler']].map(([k,l])=>(
            <button key={k} onClick={()=>setSekme(k)} style={{padding:'10px 18px',borderRadius:'10px 10px 0 0',fontSize:13,
              background:sekme===k?t.accentBg:'transparent',border:`1px solid ${sekme===k?t.accent+'44':'transparent'}`,
              color:sekme===k?t.accent:t.textMuted}}>{l}</button>
          ))}
        </div>
      </div>

      <div className="vega-page-pad" style={{padding:'24px 28px 48px'}}>
        {yukleniyor ? (
          <div style={{padding:60,textAlign:'center',color:t.textMuted}}>⏳ Yükleniyor...</div>
        ) : (
          <>
            {/* ─── LİSTE SEKMESİ ─── */}
            {sekme==='liste' && (
              <div className="vega-detail-grid" style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:20,alignItems:'start'}}>
                {/* Masraf tablosu */}
                <div>
                  {masraflar.length === 0 ? (
                    <div style={{padding:60,textAlign:'center',color:t.textMuted,background:t.card,border:`1px solid ${t.border}`,borderRadius:14}}>
                      Bu dönemde masraf kaydı yok
                    </div>
                  ) : (
                    <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden'}}>
                      <div className="vega-scroll-x">
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
                            {['Tarih','Kategori','Mağaza','Kaynak','Açıklama','Fatura No','Tutar','İşlem'].map(h=>(
                              <th key={h} style={{padding:'11px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left',letterSpacing:.3}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {masraflar.map(m=>(
                            <tr key={m.id} style={{borderBottom:`1px solid ${t.border}`}}>
                              <td style={{padding:'11px 14px',fontSize:11,color:t.textMuted,whiteSpace:'nowrap'}}>{tarihTR(m.tarih)}</td>
                              <td style={{padding:'11px 14px'}}>
                                {m.kategori ? (
                                  <span style={{fontSize:12,padding:'3px 10px',borderRadius:20,
                                    background:`${m.kategori.renk}18`,color:m.kategori.renk,fontWeight:500}}>
                                    {m.kategori.ikon} {m.kategori.ad}
                                  </span>
                                ) : <span style={{fontSize:12,color:t.textMuted}}>—</span>}
                              </td>
                              <td style={{padding:'11px 14px',fontSize:12,color:t.text}}>{m.magaza?.ad||<span style={{color:t.textMuted}}>Genel</span>}</td>
                              <td style={{padding:'11px 14px',fontSize:12,color:t.text,maxWidth:200}}>
                                <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.aciklama||'—'}</div>
                              </td>
                              <td style={{padding:'11px 14px',fontSize:11,color:t.textMuted,fontFamily:'monospace'}}>{m.faturaNo||'—'}</td>
                              <td style={{padding:'11px 14px',fontSize:14,fontWeight:700,color:'#eb5757'}}>{para(m.tutar)}</td>
                              <td style={{padding:'11px 14px'}}>
                                <div style={{display:'flex',gap:6}}>
                                  <button onClick={()=>setModal(m)} style={{fontSize:11,padding:'4px 10px',borderRadius:7,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted}}>✎</button>
                                  <button onClick={()=>sil(m.id)} style={{fontSize:11,padding:'4px 10px',borderRadius:7,background:'rgba(235,87,87,.06)',border:'1px solid rgba(235,87,87,.15)',color:'#eb5757'}}>✕</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Özet paneli */}
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  {/* Toplam kart */}
                  <div style={{background:'rgba(235,87,87,.08)',border:'1px solid rgba(235,87,87,.2)',borderRadius:14,padding:18}}>
                    <div style={{fontSize:11,color:'#eb5757',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Aylık Toplam Masraf</div>
                    <div style={{fontSize:28,fontFamily:"'Playfair Display',serif",fontWeight:700,color:'#eb5757'}}>{para(ozet?.toplamTutar||0)}</div>
                    <div style={{fontSize:12,color:t.textMuted,marginTop:4}}>{ozet?.masrafSayisi||0} kayıt</div>
                  </div>

                  {/* Kategori dağılımı */}
                  {(ozet?.kategoriler||[]).length > 0 && (
                    <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:16}}>
                      <div style={{fontSize:11,color:t.textMuted,marginBottom:12,textTransform:'uppercase',letterSpacing:.5}}>Kategori Dağılımı</div>
                      <div style={{display:'flex',flexDirection:'column',gap:10}}>
                        {ozet.kategoriler.map(k=>{
                          const oran = ozet.toplamTutar > 0 ? (k.toplam/ozet.toplamTutar*100).toFixed(1) : 0
                          return (
                            <div key={k.ad}>
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                                <span style={{fontSize:12,color:t.text}}>{k.ikon} {k.ad}</span>
                                <span style={{fontSize:12,fontWeight:600,color:k.renk}}>{para(k.toplam)}</span>
                              </div>
                              <div style={{height:5,background:'rgba(255,255,255,.06)',borderRadius:3,overflow:'hidden'}}>
                                <div style={{width:`${oran}%`,height:'100%',background:k.renk,borderRadius:3}}/>
                              </div>
                              <div style={{fontSize:10,color:t.textMuted,marginTop:2}}>%{oran} · {k.sayi} kayıt</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── KATEGORİLER SEKMESİ ─── */}
            {sekme==='kategoriler' && (
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                  <div style={{fontSize:13,color:t.textMuted}}>{kategoriler.length} kategori</div>
                  <button onClick={()=>setKatModal('yeni')} style={{
                    padding:'9px 20px',borderRadius:10,background:t.accentBg,
                    border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>
                    + Yeni Kategori
                  </button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
                  {kategoriler.map(k=>(
                    <div key={k.id} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:16,borderLeft:`3px solid ${k.renk}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:40,height:40,borderRadius:10,background:`${k.renk}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
                            {k.ikon}
                          </div>
                          <div>
                            <div style={{fontSize:14,fontWeight:600,color:t.text}}>{k.ad}</div>
                            <div style={{fontSize:11,color:t.textMuted}}>{k._count?.masraflar||0} kayıt</div>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>setKatModal(k)} style={{padding:'4px 8px',borderRadius:7,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:11}}>✎</button>
                          <button onClick={()=>katSil(k.id)} style={{padding:'4px 8px',borderRadius:7,background:'rgba(235,87,87,.06)',border:'1px solid rgba(235,87,87,.15)',color:'#eb5757',fontSize:11}}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button onClick={()=>setKatModal('yeni')} style={{
                    background:'transparent',border:`2px dashed ${t.border}`,borderRadius:12,
                    padding:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                    gap:8,color:t.textMuted,fontSize:13,minHeight:80}}>
                    <span style={{fontSize:24}}>+</span> Yeni Kategori
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Masraf Modal */}
      {modal && (
        <MasrafModal
          masraf={modal==='masraf'?null:modal}
          kategoriler={kategoriler}
          magazalar={magazalar}
          bankaHesaplar={bankaHesaplar}
          t={t}
          onKaydet={()=>{ setModal(null); yukle() }}
          onKapat={()=>setModal(null)}
        />
      )}

      {/* Kategori Modal */}
      {katModal && (
        <KategoriModal
          kategori={katModal==='yeni'?null:katModal}
          t={t}
          onKaydet={()=>{ setKatModal(null); yukle() }}
          onKapat={()=>setKatModal(null)}
        />
      )}
    </div>
  )
}
