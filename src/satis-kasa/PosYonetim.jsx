import { useState } from 'react'
import { posTerminalleriniGetir, posTerminaliKaydet, posTerminaliGuncelle, posTerminaliSil } from '../api'
import { BANKALAR, TAKSIT_SECENEKLERI } from './utils'

export default function PosYonetim({ terminaller, setTerminaller, magazalar, t }) {
  const bos = {
    ad:'', banka:BANKALAR[0], terminalNo:'', magazaId:'',
    komisyonPesin:1.49, komisyon2:1.79, komisyon3:1.99,
    komisyon6:2.49, komisyon9:2.99, komisyon12:3.49, aktif:true
  }
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState(bos)
  const [kayit, setKayit] = useState(false)

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const getKomisyon = (f, n) => {
    const map = {1:'komisyonPesin',2:'komisyon2',3:'komisyon3',6:'komisyon6',9:'komisyon9',12:'komisyon12'}
    return f[map[n]] ?? 0
  }
  const setKomisyon = (n,v) => {
    const map = {1:'komisyonPesin',2:'komisyon2',3:'komisyon3',6:'komisyon6',9:'komisyon9',12:'komisyon12'}
    set(map[n], Number(v))
  }

  const kaydet = async () => {
    if(!(form.ad||'').trim()||(!(form.terminalNo||form.terminalno||'').trim())) return alert('Ad ve terminal no zorunlu.')
    setKayit(true)
    try {
      // Sadece schema alanlarını gönder
      const { magaza, _count, ...temizForm } = form
      const gonderilecek = { ...temizForm, terminalNo: temizForm.terminalNo||temizForm.terminalno||'' }
      delete gonderilecek.terminalno
      if (form.id) await posTerminaliGuncelle(form.id, gonderilecek)
      else         await posTerminaliKaydet(gonderilecek)
      const guncel = await posTerminalleriniGetir({ hepsi: true })
      setTerminaller(guncel)
      setModal(null)
    } catch(err) { alert('Kayıt hatası: ' + err.message) }
    finally { setKayit(false) }
  }

  const sil = async (id) => {
    if(!window.confirm('Terminal silinsin mi?')) return
    await posTerminaliSil(id)
    setTerminaller(p=>p.filter(x=>x.id!==id))
  }

  const inp = { background:t.input, border:`1px solid ${t.border}`, borderRadius:8,
    padding:'8px 12px', color:t.text, fontSize:13, fontFamily:'inherit', width:'100%', outline:'none' }
  const lbl = { fontSize:11, color:t.textMuted, marginBottom:5, letterSpacing:.5, textTransform:'uppercase' }

  return (
    <div style={{padding:'24px 28px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:t.text}}>POS Terminal Yönetimi</div>
          <div style={{fontSize:13,color:t.textMuted,marginTop:3}}>{terminaller.filter(x=>x.aktif).length} aktif terminal</div>
        </div>
        <button onClick={()=>{setForm(bos);setModal('yeni');}} style={{
          padding:'10px 20px',borderRadius:12,background:t.accentBg,
          border:`1px solid ${t.accent}55`,color:t.accent,fontSize:14,fontWeight:600}}>
          + Yeni Terminal
        </button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
        {terminaller.map(terminal=>(
          <div key={terminal.id} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20,opacity:terminal.aktif?1:.5}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14}}>
              <div>
                <div style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:3}}>{terminal.ad}</div>
                <div style={{fontSize:12,color:t.textMuted}}>{terminal.banka}</div>
                <div style={{fontSize:11,color:t.textMuted,marginTop:2}}>No: {terminal.terminalNo||terminal.terminalno}</div>
                <div style={{fontSize:11,color:t.textMuted}}>{terminal.magaza?.ad||''}</div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,
                  background:terminal.aktif?'rgba(111,207,151,0.1)':t.input,
                  color:terminal.aktif?'#6fcf97':t.textMuted}}>
                  {terminal.aktif?'Aktif':'Pasif'}
                </span>
                <button onClick={async()=>{ await posTerminaliGuncelle(terminal.id,{...terminal,aktif:!terminal.aktif}); const g=await posTerminalleriniGetir({ hepsi: true }); setTerminaller(g); }} style={{
                  padding:'5px 10px',borderRadius:8,
                  background:terminal.aktif?'rgba(235,87,87,.08)':'rgba(111,207,151,.08)',
                  border:`1px solid ${terminal.aktif?'rgba(235,87,87,.2)':'rgba(111,207,151,.2)'}`,
                  color:terminal.aktif?'#eb5757':'#6fcf97',fontSize:11}}>
                  {terminal.aktif?'Pasif Yap':'Aktif Yap'}
                </button>
                <button onClick={()=>{setForm({...terminal, terminalNo: terminal.terminalNo||''});setModal('duzenle');}} style={{
                  padding:'5px 10px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>✎</button>
                <button onClick={()=>sil(terminal.id)} style={{
                  padding:'5px 10px',borderRadius:8,background:'rgba(235,87,87,.08)',border:'1px solid rgba(235,87,87,.2)',color:'#eb5757',fontSize:12}}>✕</button>
              </div>
            </div>

            <div style={{background:t.hover,borderRadius:10,padding:'10px 12px'}}>
              <div style={{fontSize:10,color:t.textMuted,marginBottom:8,letterSpacing:.5}}>KOMİSYON ORANLARI</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {TAKSIT_SECENEKLERI.map(n=>(
                  <div key={n} style={{textAlign:'center',background:t.card,borderRadius:8,padding:'6px 10px',minWidth:52}}>
                    <div style={{fontSize:10,color:t.textMuted}}>{n===1?'Peşin':`${n} T`}</div>
                    <div style={{fontSize:13,fontWeight:600,color:t.accent,marginTop:2}}>%{getKomisyon(terminal,n)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,width:'100%',maxWidth:580,maxHeight:'90vh',overflowY:'auto',padding:28}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>{modal==='yeni'?'Yeni Terminal Ekle':'Terminal Düzenle'}</div>
              <button onClick={()=>setModal(null)} style={{color:t.textMuted,fontSize:20}}>✕</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div><div style={lbl}>Terminal Adı</div><input style={inp} value={form.ad} onChange={e=>set('ad',e.target.value)} placeholder="İş Bankası Merkez"/></div>
                <div><div style={lbl}>Terminal No</div><input style={inp} value={form.terminalNo||''} onChange={e=>set('terminalNo',e.target.value)} placeholder="T-1234567"/></div>
              </div>
              <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div>
                  <div style={lbl}>Banka</div>
                  <select style={inp} value={form.banka} onChange={e=>set('banka',e.target.value)}>
                    {BANKALAR.map(b=><option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <div style={lbl}>Mağaza</div>
                  <select style={inp} value={form.magazaId||''} onChange={e=>set('magazaId',e.target.value)}>
                    <option value="">Seçin...</option>
                    {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div style={lbl}>Komisyon Oranları (%)</div>
                <div className="vega-grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                  {TAKSIT_SECENEKLERI.map(n=>(
                    <div key={n}>
                      <div style={{fontSize:11,color:t.textMuted,marginBottom:4}}>{n===1?'Peşin':`${n} Taksit`}</div>
                      <input style={{...inp,paddingRight:28}} type="number" step="0.01" min={0} max={10}
                        value={getKomisyon(form,n)} onChange={e=>setKomisyon(n,e.target.value)}/>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div onClick={()=>set('aktif',!form.aktif)} style={{
                  width:40,height:22,borderRadius:11,cursor:'pointer',position:'relative',transition:'background .2s',
                  background:form.aktif?t.accent:t.input,border:`1px solid ${t.border}`}}>
                  <div style={{position:'absolute',top:3,left:form.aktif?21:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left .2s'}}/>
                </div>
                <span style={{fontSize:13,color:form.aktif?'#6fcf97':t.textMuted}}>{form.aktif?'Aktif':'Pasif'}</span>
              </div>

              <div style={{display:'flex',gap:12,marginTop:6}}>
                <button onClick={()=>setModal(null)} style={{flex:1,padding:'10px 0',borderRadius:10,background:'transparent',border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
                <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'10px 0',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>
                  {kayit?'Kaydediliyor...':'✓ Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
