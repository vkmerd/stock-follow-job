import { useState, useEffect } from 'react'
import { iadelerGetir, iadeOnayla, iadeReddet } from './api'

const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const tarih = iso => new Date(iso).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})

const DURUMLAR = [
  { id:'hepsi',      label:'Tümü',         renk:'#888' },
  { id:'beklemede',  label:'Beklemede',     renk:'#f2c94c' },
  { id:'onaylandi',  label:'Onaylandı',     renk:'#6fcf97' },
  { id:'reddedildi', label:'Reddedildi',    renk:'#eb5757' },
]

const NEDENLER = {
  musteri_istegi: 'Müşteri İsteği',
  urun_hatali:    'Ürün Hatalı/Bozuk',
  beden_uyumsuz:  'Beden/Numara Uyumsuz',
  diger:          'Diğer',
}

export default function IadeYonetimi({ t, rol }) {
  const [iadeler, setIadeler]       = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [durum, setDurum]           = useState('beklemede')
  const [secilen, setSecilen]       = useState(null)
  const [islem, setIslem]           = useState(null) // 'onaylaniyor' | 'reddediliyor'

  const yukle = () => {
    setYukleniyor(true)
    iadelerGetir(durum === 'hepsi' ? {} : { durum })
      .then(setIadeler)
      .catch(console.error)
      .finally(() => setYukleniyor(false))
  }

  useEffect(() => { yukle() }, [durum])

  const onayla = async (id) => {
    if (!window.confirm('Bu iadeyi onaylamak istediğinize emin misiniz? Stok geri eklenecek.')) return
    setIslem('onaylaniyor')
    try {
      await iadeOnayla(id)
      yukle()
      setSecilen(null)
    } catch(e) { alert('Hata: ' + e.message) }
    finally { setIslem(null) }
  }

  const reddet = async (id) => {
    if (!window.confirm('Bu iadeyi reddetmek istediğinize emin misiniz?')) return
    setIslem('reddediliyor')
    try {
      await iadeReddet(id)
      yukle()
      setSecilen(null)
    } catch(e) { alert('Hata: ' + e.message) }
    finally { setIslem(null) }
  }

  const bekleyenSayi = iadeler.filter(i => i.durum === 'beklemede').length

  return (
    <div className="vega-page-pad" style={{padding:'22px 28px', fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        .vega-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-scroll-x table{min-width:640px;}
        @media (max-width:860px){
          .vega-page-pad{padding-left:14px!important;padding-right:14px!important;}
          .vega-grid-2,.vega-detail-grid{grid-template-columns:1fr!important;}
        }
        @media (max-width:600px){
          .vega-header-row{flex-direction:column;align-items:stretch!important;}
        }
      `}</style>

      {/* Başlık */}
      <div className="vega-header-row" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:t.text}}>İade Yönetimi</div>
          <div style={{fontSize:13,color:t.textMuted,marginTop:4}}>
            {bekleyenSayi > 0
              ? <span style={{color:'#f2c94c'}}>⚠ {bekleyenSayi} bekleyen iade var</span>
              : 'Bekleyen iade yok'}
          </div>
        </div>
        <button onClick={yukle} style={{padding:'8px 18px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>
          ↺ Yenile
        </button>
      </div>

      {/* Durum filtreleri */}
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {DURUMLAR.map(d => (
          <button key={d.id} onClick={() => setDurum(d.id)} style={{
            padding:'8px 18px', borderRadius:20, fontSize:12,
            background: durum===d.id ? `${d.renk}18` : t.input,
            border: `1px solid ${durum===d.id ? d.renk+'55' : t.border}`,
            color: durum===d.id ? d.renk : t.textMuted,
            fontWeight: durum===d.id ? 600 : 400
          }}>
            {d.label}
            {d.id === 'beklemede' && bekleyenSayi > 0 && (
              <span style={{marginLeft:6,background:'#f2c94c',color:'#111',borderRadius:10,padding:'1px 7px',fontSize:11,fontWeight:700}}>
                {bekleyenSayi}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* İçerik */}
      {yukleniyor ? (
        <div style={{padding:60,textAlign:'center',color:t.textMuted}}>⏳ Yükleniyor...</div>
      ) : iadeler.length === 0 ? (
        <div style={{padding:60,textAlign:'center',color:t.textMuted,background:t.card,border:`1px solid ${t.border}`,borderRadius:14}}>
          Bu durumda iade yok
        </div>
      ) : (
        <div className="vega-detail-grid" style={{display:'grid',gridTemplateColumns:secilen?'1fr 400px':'1fr',gap:16,alignItems:'start'}}>

          {/* Liste */}
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden'}}>
            <div className="vega-scroll-x">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
                  {['İade No','Tarih','Fiş No','Mağaza','Neden','Tutar','Durum','İşlem'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left',letterSpacing:.3}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {iadeler.map(iade => {
                  const durumObj = DURUMLAR.find(d => d.id === iade.durum) || DURUMLAR[0]
                  const secilenMi = secilen?.id === iade.id
                  return (
                    <tr key={iade.id} onClick={() => setSecilen(secilenMi ? null : iade)}
                      style={{borderBottom:`1px solid ${t.border}`,cursor:'pointer',
                        background: secilenMi ? t.accentBg : 'transparent'}}>
                      <td style={{padding:'11px 14px',fontSize:12,color:t.accent,fontFamily:'monospace',fontWeight:600}}>{iade.iadeNo}</td>
                      <td style={{padding:'11px 14px',fontSize:11,color:t.textMuted,whiteSpace:'nowrap'}}>{tarih(iade.tarih)}</td>
                      <td style={{padding:'11px 14px',fontSize:12,color:t.text,fontFamily:'monospace'}}>{iade.satis?.fisNo||'—'}</td>
                      <td style={{padding:'11px 14px',fontSize:12,color:t.text}}>{iade.satis?.magaza?.ad||'—'}</td>
                      <td style={{padding:'11px 14px',fontSize:12,color:t.textMuted}}>{NEDENLER[iade.neden]||iade.neden||'—'}</td>
                      <td style={{padding:'11px 14px',fontSize:13,fontWeight:600,color:t.accent}}>{para(iade.toplamIade)}</td>
                      <td style={{padding:'11px 14px'}}>
                        <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,
                          background:`${durumObj.renk}18`,color:durumObj.renk,fontWeight:600}}>
                          {durumObj.label}
                        </span>
                      </td>
                      <td style={{padding:'11px 14px'}}>
                        {iade.durum === 'beklemede' && rol === 'admin' && (
                          <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>onayla(iade.id)} disabled={!!islem} style={{
                              padding:'5px 12px',borderRadius:8,fontSize:11,fontWeight:600,
                              background:'rgba(111,207,151,.12)',border:'1px solid rgba(111,207,151,.35)',
                              color:'#6fcf97'}}>
                              {islem==='onaylaniyor'?'...':'✓ Onayla'}
                            </button>
                            <button onClick={()=>reddet(iade.id)} disabled={!!islem} style={{
                              padding:'5px 12px',borderRadius:8,fontSize:11,
                              background:'rgba(235,87,87,.08)',border:'1px solid rgba(235,87,87,.2)',
                              color:'#eb5757'}}>
                              {islem==='reddediliyor'?'...':'✕ Reddet'}
                            </button>
                          </div>
                        )}
                        {iade.durum !== 'beklemede' && (
                          <span style={{fontSize:11,color:t.textMuted}}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>

          {/* Detay paneli */}
          {secilen && (
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20,position:'sticky',top:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:t.text}}>{secilen.iadeNo}</div>
                <button onClick={()=>setSecilen(null)} style={{color:t.textMuted,fontSize:18}}>✕</button>
              </div>

              {/* Özet */}
              <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
                {[
                  {l:'Tarih', v:tarih(secilen.tarih)},
                  {l:'Fiş No', v:secilen.satis?.fisNo||'—'},
                  {l:'Mağaza', v:secilen.satis?.magaza?.ad||'—'},
                  {l:'Neden', v:NEDENLER[secilen.neden]||secilen.neden||'—'},
                ].map(x=>(
                  <div key={x.l} style={{padding:'8px 12px',background:t.hover,borderRadius:8}}>
                    <div style={{fontSize:10,color:t.textMuted,marginBottom:3,textTransform:'uppercase',letterSpacing:.4}}>{x.l}</div>
                    <div style={{fontSize:12,color:t.text}}>{x.v}</div>
                  </div>
                ))}
              </div>

              {/* Not */}
              {secilen.notlar && (
                <div style={{padding:'8px 12px',background:'rgba(242,201,76,.05)',border:'1px solid rgba(242,201,76,.15)',borderRadius:8,fontSize:12,color:'#f2c94c',marginBottom:16}}>
                  📝 {secilen.notlar}
                </div>
              )}

              {/* Ürünler */}
              <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.4}}>İade Edilen Ürünler</div>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                {(secilen.kalemler||[]).map((k,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'10px 12px',background:t.hover,borderRadius:10}}>
                    <div>
                      <div style={{fontSize:13,color:t.text,fontWeight:500}}>{k.urunAd}</div>
                      <div style={{fontSize:11,color:t.textMuted}}>{k.renk}{k.beden?` / ${k.beden}`:''} · {k.adet} adet</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:t.accent}}>{para(k.toplam)}</div>
                  </div>
                ))}
              </div>

              {/* Toplam */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'12px 14px',background:t.hover,borderRadius:10,marginBottom:16}}>
                <span style={{fontSize:13,color:t.textMuted}}>Toplam İade</span>
                <span style={{fontSize:20,fontWeight:700,color:t.accent}}>{para(secilen.toplamIade)}</span>
              </div>

              {/* Stok durumu */}
              <div style={{padding:'8px 12px',background:'rgba(86,204,242,.05)',border:'1px solid rgba(86,204,242,.15)',borderRadius:8,fontSize:12,color:'#56ccf2',marginBottom:16}}>
                {secilen.durum === 'onaylandi'
                  ? '✓ Stok geri eklendi'
                  : secilen.durum === 'reddedildi'
                    ? '✕ Stok değişmedi'
                    : '⏳ Onay bekliyor — stok henüz değişmedi'}
              </div>

              {/* Admin butonları */}
              {secilen.durum === 'beklemede' && rol === 'admin' && (
                <div style={{display:'flex',gap:10}}>
                  <button onClick={()=>onayla(secilen.id)} disabled={!!islem} style={{
                    flex:1,padding:'11px 0',borderRadius:12,fontSize:13,fontWeight:700,
                    background:'rgba(111,207,151,.15)',border:'1px solid rgba(111,207,151,.4)',color:'#6fcf97'}}>
                    {islem==='onaylaniyor'?'Onaylanıyor...':'✓ İadeyi Onayla'}
                  </button>
                  <button onClick={()=>reddet(secilen.id)} disabled={!!islem} style={{
                    flex:1,padding:'11px 0',borderRadius:12,fontSize:13,fontWeight:600,
                    background:'rgba(235,87,87,.08)',border:'1px solid rgba(235,87,87,.25)',color:'#eb5757'}}>
                    {islem==='reddediliyor'?'Reddediliyor...':'✕ Reddet'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
