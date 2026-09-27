import { useState, useMemo } from 'react'
import { para, tarihFormat } from './utils'

export default function PosRapor({ gecmis, terminaller, t }) {
  const [donem, setDonem]           = useState('bugun')
  const [magazaFiltre, setMagazaFiltre] = useState('Tümü')

  const simdi = new Date()
  const filtreli = useMemo(() => {
    return gecmis.filter(s => {
      const tarih = new Date(s.tarih)
      if (donem === 'bugun')    return tarih.toDateString() === simdi.toDateString()
      if (donem === 'bu_hafta') return (simdi - tarih) <= 7 * 86400000
      if (donem === 'bu_ay')    return tarih.getMonth() === simdi.getMonth() && tarih.getFullYear() === simdi.getFullYear()
      return true
    }).filter(s => magazaFiltre === 'Tümü' || (typeof s.magaza==='object'?s.magaza?.ad:s.magaza) === magazaFiltre)
  }, [gecmis, donem, magazaFiltre])

  const kartOdemeleri = filtreli.flatMap(s => (s.odemeler||[]).filter(o => ['kart','taksit'].includes(o.tip)))
  const genelBrut     = kartOdemeleri.reduce((t,o) => t + Number(o.tutar), 0)
  const genelKomisyon = kartOdemeleri.reduce((t,o) => t + Number(o.komisyonTutar||0), 0)
  const genelNet      = genelBrut - genelKomisyon

  // Terminal bazlı gruplama
  const terminalRapor = terminaller.map(ter => {
    const odemeler = kartOdemeleri.filter(o => o.posId === ter.id)
    return {
      ...ter,
      islemSayisi:    odemeler.length,
      brutToplam:     odemeler.reduce((t,o) => t + Number(o.tutar), 0),
      komisyonToplam: odemeler.reduce((t,o) => t + Number(o.komisyonTutar||0), 0),
      netToplam:      odemeler.reduce((t,o) => t + Number(o.netTahsilat||o.tutar), 0),
    }
  }).filter(x => x.islemSayisi > 0)

  const magazalar = [...new Set(gecmis.map(s => typeof s.magaza==='object'?s.magaza?.ad:s.magaza).filter(Boolean))]

  return (
    <div style={{padding:'24px 28px'}}>
      {/* Başlık + filtreler */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:t.text}}>POS & Banka Raporu</div>
          <div style={{fontSize:13,color:t.textMuted,marginTop:3}}>{filtreli.length} satış işlemi</div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {[['bugun','Bugün'],['bu_hafta','Bu Hafta'],['bu_ay','Bu Ay'],['hepsi','Tümü']].map(([k,l])=>(
            <button key={k} onClick={()=>setDonem(k)} style={{padding:'7px 16px',borderRadius:20,fontSize:12,
              background:donem===k?t.accentBg:t.input,border:`1px solid ${donem===k?t.accent+'55':t.border}`,
              color:donem===k?t.accent:t.textMuted}}>{l}</button>
          ))}
          <select value={magazaFiltre} onChange={e=>setMagazaFiltre(e.target.value)}
            style={{padding:'7px 14px',borderRadius:20,fontSize:12,background:t.input,border:`1px solid ${t.border}`,color:t.text,outline:'none'}}>
            <option>Tümü</option>
            {magazalar.map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* KPI */}
      <div className="vega-grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        {[
          {l:'Brüt Ciro',       v:para(genelBrut),    c:t.accent},
          {l:'Toplam Komisyon', v:para(genelKomisyon), c:'#eb5757'},
          {l:'Net Tahsilat',    v:para(genelNet),      c:'#6fcf97'},
          {l:'Komisyon Oranı',  v:`%${genelBrut>0?((genelKomisyon/genelBrut)*100).toFixed(2):0}`, c:'#f2c94c'},
        ].map(k=>(
          <div key={k.l} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:'16px 18px'}}>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>{k.l}</div>
            <div style={{fontSize:20,fontFamily:"'Playfair Display',serif",color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Terminal raporu */}
      {terminalRapor.length > 0 && (
        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden',marginBottom:24}}>
          <div style={{padding:'14px 18px',borderBottom:`1px solid ${t.border}`,fontSize:12,color:t.textMuted,letterSpacing:.5}}>
            TERMINAL BAZLI KOMİSYON
          </div>
          <div className="vega-scroll-x">
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
              {['Terminal','Banka','İşlem','Brüt','Komisyon','Net'].map(h=>(
                <th key={h} style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {terminalRapor.map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${t.border}`}}>
                  <td style={{padding:'10px 14px',fontSize:13,color:t.text}}>{r.ad}</td>
                  <td style={{padding:'10px 14px',fontSize:12,color:t.textMuted}}>{r.banka}</td>
                  <td style={{padding:'10px 14px',fontSize:13,color:t.text}}>{r.islemSayisi}</td>
                  <td style={{padding:'10px 14px',fontSize:13,fontWeight:600,color:t.accent}}>{para(r.brutToplam)}</td>
                  <td style={{padding:'10px 14px',fontSize:12,color:'#f2c94c'}}>{para(r.komisyonToplam)}</td>
                  <td style={{padding:'10px 14px',fontSize:13,fontWeight:600,color:'#6fcf97'}}>{para(r.netToplam)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Satış listesi */}
      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden'}}>
        <div style={{padding:'14px 18px',borderBottom:`1px solid ${t.border}`,fontSize:12,color:t.textMuted}}>
          KREDİ KARTI İŞLEMLERİ
        </div>
        {filtreli.length === 0
          ? <div style={{padding:40,textAlign:'center',color:t.textMuted}}>Bu dönemde işlem yok</div>
          : <div className="vega-scroll-x"><table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
                {['Fiş No','Tarih','Mağaza','Ödeme','Tutar','Komisyon','Net'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtreli.flatMap(s =>
                  (s.odemeler||[]).filter(o=>['kart','taksit'].includes(o.tip)).map((o,i)=>(
                    <tr key={`${s.fisNo}_${i}`} style={{borderBottom:`1px solid ${t.border}`}}>
                      <td style={{padding:'10px 14px',fontSize:11,color:t.textMuted,fontFamily:'monospace'}}>{s.fisNo}</td>
                      <td style={{padding:'10px 14px',fontSize:11,color:t.textMuted}}>{tarihFormat(s.tarih)}</td>
                      <td style={{padding:'10px 14px',fontSize:12,color:t.text}}>{typeof s.magaza==='object'?s.magaza?.ad:s.magaza}</td>
                      <td style={{padding:'10px 14px',fontSize:12,color:t.text}}>
                        {o.banka} {o.taksit>1?`(${o.taksit} taksit)`:''}
                      </td>
                      <td style={{padding:'10px 14px',fontSize:13,fontWeight:600,color:t.accent}}>{para(o.tutar)}</td>
                      <td style={{padding:'10px 14px',fontSize:12,color:'#f2c94c'}}>{para(o.komisyonTutar)}</td>
                      <td style={{padding:'10px 14px',fontSize:13,fontWeight:600,color:'#6fcf97'}}>{para(o.netTahsilat||o.tutar)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
        }
      </div>
    </div>
  )
}
