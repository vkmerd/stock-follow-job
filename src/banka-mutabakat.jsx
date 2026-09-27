// ─── VİRMAN MODAL ────────────────────────────────────────────
function VirmanModal({ hesaplar, magazalar=[], onKaydet, onKapat, t, tip='banka' }) {
  const bugun = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({ kaynakId:'', hedefId:'', magazaId:'', tutar:'', aciklama:'', tarih:bugun })
  const [kayit, setKayit] = useState(false)
  const [hata, setHata] = useState('')
  const [kasaNakiti, setKasaNakiti] = useState(null)
  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  // Seçili mağazanın kasa bakiyesini çek
  useEffect(() => {
    if (tip !== 'kasa' || !form.magazaId) return
    fetch(`${API_BASE}/kasa/bugun?magazaId=${form.magazaId}`)
      .then(r=>r.json())
      .then(kasa => {
        const nakit = kasa?.ozet?.nakitNet || 0
        setKasaNakiti(nakit)
        g('tutar', Number(nakit).toFixed(2))
      })
      .catch(()=>{ setKasaNakiti(0) })
  }, [tip, form.magazaId])
  const inp = {padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none',width:'100%'}

  const kaydet = async () => {
    if (!form.tutar || Number(form.tutar)<=0) return setHata('Tutar zorunlu')
    if (tip==='banka' && (!form.kaynakId||!form.hedefId)) return setHata('İki hesap seçin')
    if (tip==='banka' && form.kaynakId===form.hedefId) return setHata('Kaynak ve hedef aynı olamaz')
    if (tip==='kasa' && !form.hedefId) return setHata('Hedef hesap seçin')
    setHata(''); setKayit(true)
    try {
      const res = await fetch(`${API_BASE}/banka/virman`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tip, kaynakId:form.kaynakId||null, hedefId:form.hedefId, magazaId:form.magazaId||null, tutar:Number(form.tutar), aciklama:form.aciklama||null, tarih: form.tarih + 'T12:00:00.000Z' })
      })
      if (!res.ok) { const e=await res.json(); throw new Error(e.hata||'Hata') }
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:'28px 32px',width:'100%',maxWidth:440}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>
            {tip==='banka'?'🔄 Bankalar Arası Virman':'💰 Kasadan Bankaya Aktarım'}
          </div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {tip==='banka'&&(
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Kaynak Hesap</div>
              <select value={form.kaynakId} onChange={e=>g('kaynakId',e.target.value)} style={inp}>
                <option value="">Seçin...</option>
                {hesaplar.map(h=><option key={h.id} value={h.id}>{h.ad} — {h.banka} (₺{Number(h.bakiye).toLocaleString('tr-TR')})</option>)}
              </select>
            </div>
          )}
          {tip==='kasa'&&(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Kaynak Mağaza *</div>
                <select value={form.magazaId} onChange={e=>g('magazaId',e.target.value)}
                  style={{padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none',width:'100%'}}>
                  <option value="">Mağaza seçin...</option>
                  {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </div>
              {kasaNakiti!==null&&(
                <div style={{padding:'10px 14px',background:`${t.accent}10`,border:`1px solid ${t.accent}33`,borderRadius:10,fontSize:12,color:t.accent}}>
                  💰 Kasadaki Nakit: <strong>₺{Number(kasaNakiti).toLocaleString('tr-TR',{minimumFractionDigits:2})}</strong>
                </div>
              )}
            </div>
          )}
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Hedef Hesap</div>
            <select value={form.hedefId} onChange={e=>g('hedefId',e.target.value)} style={inp}>
              <option value="">Seçin...</option>
              {hesaplar.filter(h=>h.id!==form.kaynakId).map(h=><option key={h.id} value={h.id}>{h.ad} — {h.banka}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Tutar *</div>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
              <input type="number" value={form.tutar} onChange={e=>g('tutar',e.target.value)} style={{...inp,paddingLeft:28,color:t.accent,fontSize:15,fontWeight:700}}/>
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Açıklama</div>
            <input value={form.aciklama} onChange={e=>g('aciklama',e.target.value)} placeholder="Virman açıklaması..." style={inp}/>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Tarih</div>
            <input type="date" value={form.tarih} onChange={e=>g('tarih',e.target.value)} style={inp}/>
          </div>
        </div>
        {hata&&<div style={{marginTop:12,padding:'8px 14px',background:'rgba(235,87,87,.1)',border:'1px solid rgba(235,87,87,.3)',borderRadius:8,fontSize:12,color:'#eb5757'}}>{hata}</div>}
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={onKapat} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'11px 0',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:700}}>
            {kayit?'Aktarılıyor...':'✓ Virmani Yap'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useVega } from './VegaContext'
import {
  bankaHesaplariGetir, bankaHesapEkle, bankaHesapGuncelle, bankaHesapSil,
  bankaHareketleriGetir, bankaHareketEkle, bankaHareketSil,
  bankaKategorileriniGetir, bankaOzetGetir, bankaMutabakatGetir,
  urunleriGetir
, API_BASE } from './api'

const para    = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const tarihTR = iso => iso ? new Date(iso).toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const saatTR  = iso => iso ? new Date(iso).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : ''
const AYLAR   = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const BANKALAR = ['Ziraat Bankası','İş Bankası','Garanti BBVA','Yapı Kredi','Akbank','Halkbank','Vakıfbank','Denizbank','QNB Finansbank','TEB','HSBC','ING','Diğer']

function HesapModal({ hesap, magazalar, onKaydet, onKapat, t }) {
  const bos = { ad:'', banka:BANKALAR[0], iban:'', magazaId:'', bakiye:0 }
  const [form, setForm] = useState(hesap ? { ad:hesap.ad, banka:hesap.banka, iban:hesap.iban||'', magazaId:hesap.magazaId||'' } : bos)
  const [hata, setHata] = useState('')
  const [kayit, setKayit] = useState(false)
  const tutarRefs = useRef({}) // kalem id → input ref
  const ekleRef = useRef(null)

  // Son kalemin referans inputundan Tab → kalem ekle butonu
  // Enter on kalem ekle → yeni kalem aç, tutarına fokus
  const yeniKalemEkleVeFokusla = useCallback(() => {
    const yeniKalem = bosKalem()
    setKalemler(p => [...p, yeniKalem])
    // Sonraki render'da yeni kalemin tutar inputuna fokus
    setTimeout(() => {
      tutarRefs.current[yeniKalem.id]?.focus()
    }, 50)
  }, [])
  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  const kaydet = async () => {
    if (!form.ad.trim()) return setHata('Hesap adı zorunlu')
    setHata(''); setKayit(true)
    try {
      const temizForm = { ...form, bakiye: Number(form.bakiye)||0, magazaId: form.magazaId || null }
      if (hesap) await bankaHesapGuncelle(hesap.id, temizForm)
      else       await bankaHesapEkle(temizForm)
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:'28px 32px',width:'100%',maxWidth:460}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>{hesap?'Hesap Düzenle':'Yeni Banka Hesabı'}</div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Hesap Adı *</div>
            <input value={form.ad||''} onChange={e=>g('ad',e.target.value)} placeholder="örn. İş Bankası Merkez"
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>IBAN</div>
            <input value={form.iban||''} onChange={e=>g('iban',e.target.value)} placeholder="TR..."
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Banka</div>
            <select value={form.banka} onChange={e=>g('banka',e.target.value)}
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}>
              {BANKALAR.map(b=><option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Mağaza</div>
            <select value={form.magazaId||''} onChange={e=>g('magazaId',e.target.value)}
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}>
              <option value="">Genel</option>
              {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
            </select>
          </div>
          {!hesap && (
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Başlangıç Bakiyesi</div>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
                <input type="number" value={form.bakiye||0} onChange={e=>g('bakiye',e.target.value)}
                  style={{width:'100%',padding:'10px 14px 10px 28px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.accent,fontSize:14,fontWeight:600,outline:'none'}}/>
              </div>
            </div>
          )}
        </div>
        {hata&&<div style={{marginTop:12,padding:'8px 14px',background:'rgba(235,87,87,.1)',border:'1px solid rgba(235,87,87,.3)',borderRadius:8,fontSize:12,color:'#eb5757'}}>{hata}</div>}
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={onKapat} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'11px 0',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>
            {kayit?'Kaydediliyor...':hesap?'Güncelle':'Hesap Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HareketModal({ hesap, kategoriler, onKaydet, onKapat, t }) {
  const bugun = new Date().toISOString().slice(0,10)
  const duzenle = hesap?.duzenle || null

  // Çoklu kalem sistemi — duzenle modunda tek kalem
  const bosKalem = () => ({ id: Date.now(), tip:'gider', kategoriId:'', aciklama:'', tutar:'', referans:'', tarih:bugun })
  const [kalemler, setKalemler] = useState(duzenle ? [{
    id: 1, tip: duzenle.tip,
    tutar: String(duzenle.tutar),
    aciklama: duzenle.aciklama||'',
    kategoriId: duzenle.kategoriId||'',
    referans: duzenle.referans||'',
    tarih: duzenle.tarih?.slice(0,10)||bugun
  }] : [bosKalem()])
  const [hata, setHata] = useState('')
  const [kayit, setKayit] = useState(false)
  const tutarRefs = useRef({}) // kalem id → input ref
  const ekleRef = useRef(null)

  // Son kalemin referans inputundan Tab → kalem ekle butonu
  // Enter on kalem ekle → yeni kalem aç, tutarına fokus
  const yeniKalemEkleVeFokusla = useCallback(() => {
    const yeniKalem = bosKalem()
    setKalemler(p => [...p, yeniKalem])
    // Sonraki render'da yeni kalemin tutar inputuna fokus
    setTimeout(() => {
      tutarRefs.current[yeniKalem.id]?.focus()
    }, 50)
  }, [])

  const gKalem = (id, k, v) => setKalemler(p => p.map(k2 => k2.id===id ? {...k2, [k]:v} : k2))
  const kalemEkle = () => setKalemler(p => [...p, bosKalem()])
  const kalemSil = (id) => setKalemler(p => p.filter(k => k.id !== id))

  const genelToplam = kalemler.reduce((t, k) => t + (Number(k.tutar)||0), 0)

  const kaydet = async () => {
    const gecersiz = kalemler.find(k => !k.tutar || Number(k.tutar) <= 0)
    if (gecersiz) return setHata('Tüm kalemlere geçerli tutar girin')
    setHata(''); setKayit(true)
    try {
      if (duzenle) await bankaHareketSil(duzenle.id)
      // Her kalemi sırayla kaydet
      for (const k of kalemler) {
        await bankaHareketEkle({
          hesapId: duzenle ? duzenle.hesapId : hesap.id,
          kategoriId: k.kategoriId||null,
          tip: k.tip,
          aciklama: k.aciklama||null,
          tutar: Number(k.tutar),
          referans: k.referans||null,
          tarih: k.tarih + 'T12:00:00.000Z'
        })
      }
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:'28px 32px',width:'100%',maxWidth:580,maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,flexShrink:0}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>Hareket — {hesap.ad}</div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>

        {/* Kalem listesi */}
        <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:12}}>
          {kalemler.map((k, ki) => {
            const aktifKat = kategoriler.filter(kat => kat.tip === k.tip)
            const renk = k.tip === 'gelir' ? '#6fcf97' : '#eb5757'
            return (
              <div key={k.id} style={{background:'rgba(255,255,255,.03)',border:`1px solid ${t.border}`,borderRadius:12,padding:'14px 16px'}}>
                {/* Kalem başlık */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{display:'flex',gap:6}}>
                    {[['gelir','▲ Gelir','#6fcf97'],['gider','▼ Gider','#eb5757']].map(([tip,lbl,c])=>(
                      <button key={tip} onClick={()=>gKalem(k.id,'tip',tip)} style={{padding:'5px 12px',borderRadius:8,fontSize:12,
                        background:k.tip===tip?`${c}18`:t.input,border:`1px solid ${k.tip===tip?c+'55':t.border}`,
                        color:k.tip===tip?c:t.textMuted,fontWeight:k.tip===tip?600:400}}>{lbl}</button>
                    ))}
                  </div>
                  {kalemler.length > 1 && (
                    <button onClick={()=>kalemSil(k.id)} style={{fontSize:12,color:'#eb5757',background:'none',border:'none',cursor:'pointer',padding:'4px 8px'}}>✕ Kaldır</button>
                  )}
                </div>

                {/* Kategori */}
                {aktifKat.length > 0 && (
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
                    {aktifKat.map(kat=>(
                      <button key={kat.id} onClick={()=>gKalem(k.id,'kategoriId',kat.id)} style={{padding:'4px 10px',borderRadius:16,fontSize:11,
                        background:k.kategoriId===kat.id?t.accentBg:t.input,border:`1px solid ${k.kategoriId===kat.id?t.accent+'55':t.border}`,
                        color:k.kategoriId===kat.id?t.accent:t.textMuted}}>{kat.ad}</button>
                    ))}
                  </div>
                )}

                {/* Tutar + Tarih */}
                <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:8}}>
                  <div style={{position:'relative'}}>
                    <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:t.textMuted,fontSize:13}}>₺</span>
                    <input
                      ref={el => { tutarRefs.current[k.id] = el }}
                      type="number" value={k.tutar}
                      onChange={e=>gKalem(k.id,'tutar',e.target.value)}
                      placeholder="0,00"
                      style={{width:'100%',padding:'9px 12px 9px 26px',borderRadius:9,background:t.input,border:`1px solid ${renk}44`,color:renk,fontSize:15,fontWeight:700,outline:'none'}}/>
                  </div>
                  <input type="date" value={k.tarih} onChange={e=>gKalem(k.id,'tarih',e.target.value)}
                    style={{width:'100%',padding:'9px 12px',borderRadius:9,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
                </div>

                {/* Açıklama + Referans */}
                <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <input value={k.aciklama} onChange={e=>gKalem(k.id,'aciklama',e.target.value)} placeholder="Açıklama..."
                    style={{width:'100%',padding:'8px 12px',borderRadius:9,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}/>
                  <input value={k.referans} onChange={e=>gKalem(k.id,'referans',e.target.value)} placeholder="Referans no..."
                    onKeyDown={e => {
                      // Son kalemin referans inputundan Tab → kalem ekle butonuna fokus
                      if (e.key === 'Tab' && !e.shiftKey && ki === kalemler.length - 1 && !duzenle) {
                        e.preventDefault()
                        ekleRef.current?.focus()
                      }
                    }}
                    style={{width:'100%',padding:'8px 12px',borderRadius:9,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}/>
                </div>
              </div>
            )
          })}

          {/* Kalem ekle butonu */}
          {!duzenle && (
            <button
              ref={ekleRef}
              onClick={yeniKalemEkleVeFokusla}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); yeniKalemEkleVeFokusla(); } }}
              style={{padding:'10px 0',borderRadius:10,border:`1.5px dashed ${t.border}`,background:'transparent',color:t.textMuted,fontSize:13,cursor:'pointer'}}
            >
              + Kalem Ekle <span style={{fontSize:10,opacity:.5}}>(Enter)</span>
            </button>
          )}
        </div>

        {/* Genel toplam */}
        {kalemler.length > 1 && (
          <div style={{flexShrink:0,marginTop:12,padding:'10px 16px',background:'rgba(255,255,255,.03)',border:`1px solid ${t.border}`,borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:t.textMuted}}>{kalemler.length} kalem · Genel Toplam</span>
            <span style={{fontSize:18,fontWeight:800,color:t.accent}}>₺{genelToplam.toLocaleString('tr-TR',{minimumFractionDigits:2})}</span>
          </div>
        )}

        {hata && <div style={{flexShrink:0,marginTop:10,padding:'8px 14px',background:'rgba(235,87,87,.1)',border:'1px solid rgba(235,87,87,.3)',borderRadius:8,fontSize:12,color:'#eb5757'}}>{hata}</div>}

        <div style={{display:'flex',gap:10,marginTop:14,flexShrink:0}}>
          <button onClick={onKapat} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'11px 0',borderRadius:10,
            background:'rgba(201,184,130,.12)',border:`1px solid rgba(201,184,130,.35)`,
            color:t.accent,fontSize:13,fontWeight:600}}>
            {kayit ? 'Kaydediliyor...' : `${kalemler.length > 1 ? `${kalemler.length} Kalemi` : ''} Kaydet${kalemler.length > 1 ? ` (₺${genelToplam.toLocaleString('tr-TR',{minimumFractionDigits:2})})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BankaMutabakat({ t }) {
  t = t || {
    bg:'#0c0b09', card:'rgba(255,255,255,.04)', border:'rgba(255,255,255,.08)',
    text:'#e8e0d4', textMuted:'#666', accent:'#c9b882', accentBg:'rgba(201,184,130,.15)',
    input:'rgba(255,255,255,.06)', hover:'rgba(255,255,255,.06)', sidebar:'#0a0908'
  }
  const { magazalar:ctxMagazalar } = useVega()
  const magazalar = (ctxMagazalar||[]).filter(m=>m.tip!=='online')
  const simdi = new Date()
  const [sekme, setSekme]             = useState('hesaplar')
  const [hesaplar, setHesaplar]       = useState([])
  const [hareketler, setHareketler]   = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [ozet, setOzet]               = useState(null)
  const [mutabakat, setMutabakat]     = useState(null)
  const [yukleniyor, setYukleniyor]   = useState(true)
  const [secilenHesap, setSecilenHesap] = useState(null)
  const [hesapModal, setHesapModal]   = useState(null)
  const [hareketModal, setHareketModal] = useState(null)
  const [virmanModal, setVirmanModal]   = useState(null) // null | 'banka' | 'kasa'
  const [yil, setYil]                 = useState(simdi.getFullYear())
  const [ay, setAy]                   = useState(simdi.getMonth()+1)
  const [tipFiltre, setTipFiltre]     = useState('hepsi')

  // Stok Değeri sekmesi — mağaza bazlı yerel stok + Nas Bag/Silver Polo tedarikçi stoğu
  const [stokUrunler, setStokUrunler]       = useState([])
  const [nasbagStok, setNasbagStok]         = useState([])
  const [silverpoloStok, setSilverpoloStok] = useState([])
  const [stokYukleniyor, setStokYukleniyor] = useState(false)
  const [stokYuklendi, setStokYuklendi]     = useState(false)

  const yukle = async () => {
    setYukleniyor(true)
    try {
      const [h,har,kat,o] = await Promise.all([
        bankaHesaplariGetir(),
        bankaHareketleriGetir({limit:200,...(secilenHesap&&{hesapId:secilenHesap.id})}),
        bankaKategorileriniGetir().catch(()=>[]),
        bankaOzetGetir({yil,ay,...(secilenHesap&&{hesapId:secilenHesap.id})}).catch(()=>null),
      ])
      setHesaplar(Array.isArray(h)?h:[])
      setHareketler(Array.isArray(har)?har:[])
      setKategoriler(Array.isArray(kat)?kat:[])
      setOzet(o)
    } catch(e){ console.error(e) }
    finally { setYukleniyor(false) }
  }

  const mutabakatYukle = async () => {
    const bas = new Date(yil,ay-1,1).toISOString()
    const bit = new Date(yil,ay,0,23,59,59).toISOString()
    const m = await bankaMutabakatGetir({baslangic:bas,bitis:bit,...(secilenHesap&&{hesapId:secilenHesap.id})}).catch(()=>null)
    setMutabakat(m)
  }

  useEffect(()=>{ yukle() },[secilenHesap,yil,ay])
  useEffect(()=>{
    const iv = setInterval(()=>{ if(document.visibilityState==='visible') yukle() }, 60000)
    return ()=>clearInterval(iv)
  },[secilenHesap,yil,ay])
  useEffect(()=>{ if(sekme==='mutabakat') mutabakatYukle() },[sekme,yil,ay,secilenHesap])

  // "Stok Değeri" sekmesi ilk açıldığında yükle — Banka sayfasının normal açılışını
  // yavaşlatmasın diye (335+ Silver Polo ürünü içeren XML dahil) sadece sekmeye
  // gerçekten girilince çekiliyor.
  useEffect(() => {
    if (sekme !== 'stok' || stokYuklendi) return
    setStokYukleniyor(true)
    Promise.all([
      urunleriGetir().catch(() => []),
      fetch(`${API_BASE}/nasbag-urunler`).then(r => r.ok ? r.text() : Promise.reject(r.statusText)).catch(() => null),
      fetch(`${API_BASE}/ticimax-urunler`).then(r => r.ok ? r.text() : Promise.reject(r.statusText)).catch(() => null),
    ]).then(([u, nasbagXml, spXml]) => {
      setStokUrunler(Array.isArray(u) ? u : (u?.items || []))

      if (nasbagXml) {
        const doc = new DOMParser().parseFromString(nasbagXml, 'text/xml')
        const nodes = Array.from(doc.querySelectorAll('Urunler > Urun'))
        setNasbagStok(nodes.map(n => ({
          stok:   parseInt(n.querySelector('StokKalanMiktari')?.textContent ?? '0') || 0,
          fiyat1: parseFloat((n.querySelector('Fiyat1')?.textContent ?? '0').replace(',', '.')) || 0,
        })))
      }

      if (spXml) {
        const doc = new DOMParser().parseFromString(spXml, 'text/xml')
        const nodes = Array.from(doc.querySelectorAll('Root > Urunler > Urun'))
        setSilverpoloStok(nodes.flatMap(n =>
          Array.from(n.querySelectorAll('UrunSecenek > Secenek'))
            .filter(s => s.querySelector('Aktif')?.textContent !== '0')
            .map(s => ({
              stok:  parseInt(s.querySelector('StokAdedi')?.textContent ?? '0') || 0,
              alisF: parseFloat(s.querySelector('AlisFiyati')?.textContent ?? '0') || 0,
            }))
        ))
      }

      setStokYuklendi(true)
    }).catch(console.error)
    .finally(() => setStokYukleniyor(false))
  }, [sekme, stokYuklendi])

  // Mağaza bazlı yerel stok değeri: her mağaza için Σ(adet × alışFiyatı)
  const magazaStokDegeri = magazalar.map(m => {
    let adet = 0, deger = 0, cesit = 0
    stokUrunler.forEach(u => {
      const buMagazaVaryantlari = (u.varyantlar || []).filter(v => v.magazaId === m.id)
      if (buMagazaVaryantlari.length === 0) return
      const buMagazaAdet = buMagazaVaryantlari.reduce((t, v) => t + (Number(v.adet) || 0), 0)
      if (buMagazaAdet > 0) cesit++
      adet += buMagazaAdet
      deger += buMagazaAdet * (Number(u.alisF) || 0)
    })
    return { magaza: m, adet, deger, cesit }
  })
  const yerelToplamDeger = magazaStokDegeri.reduce((t, m) => t + m.deger, 0)
  const yerelToplamAdet  = magazaStokDegeri.reduce((t, m) => t + m.adet, 0)

  const nasbagToplamDeger = nasbagStok.reduce((t, u) => t + u.stok * u.fiyat1, 0)
  const nasbagToplamAdet  = nasbagStok.reduce((t, u) => t + u.stok, 0)

  const silverpoloToplamDeger = silverpoloStok.reduce((t, s) => t + s.stok * s.alisF, 0)
  const silverpoloToplamAdet  = silverpoloStok.reduce((t, s) => t + s.stok, 0)

  const toplamBakiye = hesaplar.reduce((t,h)=>t+Number(h.bakiye),0)
  const filtreli = hareketler.filter(h=>tipFiltre==='hepsi'||h.tip===tipFiltre)

  return (
    <div style={{minHeight:'100vh',background:t.bg,color:t.text,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;} button{cursor:pointer;border:none;background:none;font-family:inherit;}
        input,select{font-family:inherit;} select option{background:#1a1814;} tbody tr:hover td{background:rgba(255,255,255,.015);}
        .vega-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-scroll-x table{min-width:640px;}
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

      <div className="vega-page-pad" style={{padding:'22px 28px 0'}}>
        <div className="vega-header-row" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:t.text}}>Banka & Mutabakat</div>
            <div style={{fontSize:13,color:t.textMuted,marginTop:4}}>Toplam: <span style={{color:t.accent,fontWeight:600}}>{para(toplamBakiye)}</span></div>
          </div>
          <div className="vega-header-actions" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {sekme==='hareketler'&&secilenHesap&&(
              <button onClick={()=>setHareketModal(secilenHesap)} style={{padding:'9px 18px',borderRadius:10,background:'rgba(111,207,151,.12)',border:'1px solid rgba(111,207,151,.35)',color:'#6fcf97',fontSize:13,fontWeight:600}}>+ Hareket</button>
            )}
            <button onClick={()=>setVirmanModal('kasa')} style={{padding:'9px 18px',borderRadius:10,background:'rgba(242,201,76,.12)',border:'1px solid rgba(242,201,76,.35)',color:'#f2c94c',fontSize:13,fontWeight:600}}>💰 Kasadan Aktar</button>
            <button onClick={()=>setVirmanModal('banka')} style={{padding:'9px 18px',borderRadius:10,background:'rgba(187,135,252,.12)',border:'1px solid rgba(187,135,252,.35)',color:'#bb87fc',fontSize:13,fontWeight:600}}>🔄 Virman</button>
            <button onClick={()=>setHesapModal('yeni')} style={{padding:'9px 18px',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>+ Yeni Hesap</button>
          </div>
        </div>

        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          <select value={secilenHesap?.id||''} onChange={e=>setSecilenHesap(hesaplar.find(x=>x.id===e.target.value)||null)}
            style={{padding:'8px 14px',borderRadius:20,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}>
            <option value="">Tüm Hesaplar</option>
            {hesaplar.map(h=><option key={h.id} value={h.id}>{h.ad} — {h.banka}</option>)}
          </select>
          <select value={ay} onChange={e=>setAy(Number(e.target.value))}
            style={{padding:'8px 14px',borderRadius:20,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}>
            {AYLAR.map((a,i)=><option key={i} value={i+1}>{a}</option>)}
          </select>
          <select value={yil} onChange={e=>setYil(Number(e.target.value))}
            style={{padding:'8px 14px',borderRadius:20,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}>
            {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>

        <div style={{display:'flex',gap:4,borderBottom:`1px solid ${t.border}`}}>
          {[['hesaplar','🏦 Hesaplar'],['hareketler','📋 Hareketler'],['mutabakat','⚖ Mutabakat'],['stok','📦 Stok Değeri']].map(([k,l])=>(
            <button key={k} onClick={()=>setSekme(k)} style={{padding:'10px 18px',borderRadius:'10px 10px 0 0',fontSize:13,
              background:sekme===k?t.accentBg:'transparent',border:`1px solid ${sekme===k?t.accent+'44':'transparent'}`,
              color:sekme===k?t.accent:t.textMuted}}>{l}</button>
          ))}
        </div>
      </div>

      <div className="vega-page-pad" style={{padding:'24px 28px 48px'}}>
        {yukleniyor
          ?<div style={{padding:60,textAlign:'center',color:t.textMuted}}>⏳ Yükleniyor...</div>
          :<>
            {sekme==='hesaplar'&&(
              <div>
                {ozet&&(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:20}}>
                    {[
                      {l:`${AYLAR[ay-1]} Gelir`,v:para(ozet.gelir||0),c:'#6fcf97'},
                      {l:`${AYLAR[ay-1]} Gider`,v:para(ozet.gider||0),c:'#eb5757'},
                      {l:'Net',v:para((ozet.gelir||0)-(ozet.gider||0)),c:(ozet.gelir||0)>=(ozet.gider||0)?'#6fcf97':'#eb5757'},
                    ].map(k=>(
                      <div key={k.l} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:'14px 16px'}}>
                        <div style={{fontSize:10,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.4}}>{k.l}</div>
                        <div style={{fontSize:18,fontWeight:700,color:k.c,fontFamily:"'Playfair Display',serif"}}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
                  {hesaplar.map(h=>(
                    <div key={h.id} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20,borderLeft:`3px solid ${Number(h.bakiye)>=0?t.accent:'#eb5757'}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
                        <div>
                          <div style={{fontSize:15,fontWeight:600,color:t.text}}>{h.ad}</div>
                          <div style={{fontSize:12,color:t.textMuted}}>{h.banka}</div>
                          {h.iban&&<div style={{fontSize:10,color:t.textMuted,fontFamily:'monospace',marginTop:2}}>{h.iban}</div>}
                          {h.magaza&&<div style={{fontSize:11,color:t.textMuted,marginTop:2}}>📍 {h.magaza.ad}</div>}
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>setHesapModal(h)} style={{padding:'4px 8px',borderRadius:7,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:11}}>✎</button>
                          <button onClick={async()=>{if(!window.confirm('Silinsin mi?'))return;await bankaHesapSil(h.id);yukle()}}
                            style={{padding:'4px 8px',borderRadius:7,background:'rgba(235,87,87,.06)',border:'1px solid rgba(235,87,87,.15)',color:'#eb5757',fontSize:11}}>✕</button>
                        </div>
                      </div>
                      <div style={{fontSize:22,fontWeight:700,color:Number(h.bakiye)>=0?t.accent:'#eb5757',fontFamily:"'Playfair Display',serif",marginBottom:12}}>{para(h.bakiye)}</div>
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=>{setSecilenHesap(h);setSekme('hareketler')}} style={{flex:1,padding:'7px 0',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>📋 Hareketler</button>
                        <button onClick={()=>{setSecilenHesap(h);setHareketModal(h)}} style={{flex:1,padding:'7px 0',borderRadius:8,background:t.accentBg,border:`1px solid ${t.accent}44`,color:t.accent,fontSize:12,fontWeight:600}}>+ Hareket</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={()=>setHesapModal('yeni')} style={{background:'transparent',border:`2px dashed ${t.border}`,borderRadius:14,padding:20,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,color:t.textMuted,fontSize:13,minHeight:140}}>
                    <span style={{fontSize:28}}>+</span><span>Yeni Hesap</span>
                  </button>
                </div>
              </div>
            )}

            {sekme==='hareketler'&&(
              <div>
                <div style={{display:'flex',gap:8,marginBottom:14}}>
                  {[['hepsi','Tümü'],['gelir','▲ Gelir'],['gider','▼ Gider']].map(([k,l])=>(
                    <button key={k} onClick={()=>setTipFiltre(k)} style={{padding:'7px 16px',borderRadius:20,fontSize:12,
                      background:tipFiltre===k?t.accentBg:t.input,border:`1px solid ${tipFiltre===k?t.accent+'55':t.border}`,
                      color:tipFiltre===k?t.accent:t.textMuted}}>{l}</button>
                  ))}
                </div>
                {filtreli.length===0
                  ?<div style={{padding:60,textAlign:'center',color:t.textMuted,background:t.card,border:`1px solid ${t.border}`,borderRadius:14}}>Hareket yok</div>
                  :<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden'}}>
                    <div className="vega-scroll-x">
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
                        {['Tarih','Hesap','Kategori','Açıklama','Ref','Tutar','Bakiye',''].map(h=>(
                          <th key={h} style={{padding:'11px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {filtreli.map(h=>(
                          <tr key={h.id} style={{borderBottom:`1px solid ${t.border}`}}>
                            <td style={{padding:'11px 14px',fontSize:11,color:t.textMuted,whiteSpace:'nowrap'}}>
                              <div>{tarihTR(h.tarih)}</div><div style={{fontSize:10}}>{saatTR(h.tarih)}</div>
                            </td>
                            <td style={{padding:'11px 14px',fontSize:12,color:t.text}}>{h.hesap?.ad||'—'}</td>
                            <td style={{padding:'11px 14px'}}>{h.kategori?<span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:t.hover,color:t.textMuted}}>{h.kategori.ad}</span>:<span style={{color:t.textMuted,fontSize:11}}>—</span>}</td>
                            <td style={{padding:'11px 14px',fontSize:12,color:t.text,maxWidth:160}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.aciklama||'—'}</div></td>
                            <td style={{padding:'11px 14px',fontSize:11,color:t.textMuted,fontFamily:'monospace'}}>{h.referans||'—'}</td>
                            <td style={{padding:'11px 14px',fontSize:14,fontWeight:700,color:h.tip==='gelir'?'#6fcf97':'#eb5757'}}>{h.tip==='gelir'?'+':'-'}{para(h.tutar)}</td>
                            <td style={{padding:'11px 14px',fontSize:12,color:t.textMuted}}>{para(h.bakiye)}</td>
                            <td style={{padding:'11px 14px'}}>
                              <div style={{display:'flex',gap:4}}>
                                <button onClick={()=>setHareketModal({...secilenHesap||hesaplar[0], duzenle:h})}
                                  style={{fontSize:11,padding:'4px 8px',borderRadius:7,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted}}>✎</button>
                                <button onClick={async()=>{if(!window.confirm('Silinsin mi?'))return;await bankaHareketSil(h.id);yukle()}}
                                style={{fontSize:11,padding:'4px 8px',borderRadius:7,background:'rgba(235,87,87,.06)',border:'1px solid rgba(235,87,87,.15)',color:'#eb5757'}}>✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>}
              </div>
            )}

            {sekme==='mutabakat'&&(
              <div>
                {!mutabakat
                  ?<div style={{padding:60,textAlign:'center',color:t.textMuted}}>⏳ Yükleniyor...</div>
                  :<div style={{display:'flex',flexDirection:'column',gap:16}}>
                    <div style={{padding:'16px 20px',borderRadius:14,
                      background:mutabakat.mutabakatDurumu==='eslesti'?'rgba(111,207,151,.08)':'rgba(235,87,87,.08)',
                      border:`1px solid ${mutabakat.mutabakatDurumu==='eslesti'?'rgba(111,207,151,.3)':'rgba(235,87,87,.3)'}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
                        <div>
                          <div style={{fontSize:15,fontWeight:700,color:mutabakat.mutabakatDurumu==='eslesti'?'#6fcf97':'#eb5757',marginBottom:4}}>
                            {mutabakat.mutabakatDurumu==='eslesti'?'✓ Mutabakat Tamam':'⚠ Mutabakat Uyuşmazlığı'}
                          </div>
                          <div style={{fontSize:12,color:t.textMuted}}>{AYLAR[ay-1]} {yil} · {secilenHesap?.ad||'Tüm Hesaplar'}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:11,color:t.textMuted,marginBottom:2}}>Fark</div>
                          <div style={{fontSize:22,fontWeight:700,color:mutabakat.fark===0?'#6fcf97':'#f2c94c'}}>{mutabakat.fark>=0?'+':''}{para(mutabakat.fark||0)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                      {[
                        {baslik:'Satış Ödemeleri (Kart+Havale)',renk:'#56ccf2',toplam:mutabakat.toplamSatisOdeme||0,
                          liste:mutabakat.satisOdemeleri||[],
                          render:o=><><div style={{color:t.text,fontWeight:500}}>{o.satis?.fisNo}</div><div style={{color:t.textMuted,fontSize:11}}>{tarihTR(o.satis?.tarih)} · {o.tip}</div></>},
                        {baslik:'Banka Gelir Hareketleri',renk:'#6fcf97',toplam:mutabakat.toplamBankaGelir||0,
                          liste:mutabakat.bankaHareketleri||[],
                          render:h=><><div style={{color:t.text,fontWeight:500}}>{h.aciklama||h.referans||'—'}</div><div style={{color:t.textMuted,fontSize:11}}>{tarihTR(h.tarih)} · {h.hesap?.ad}</div></>},
                      ].map(panel=>(
                        <div key={panel.baslik} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:18}}>
                          <div style={{fontSize:11,color:panel.renk,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>{panel.baslik}</div>
                          <div style={{fontSize:22,fontWeight:700,color:t.accent,marginBottom:14}}>{para(panel.toplam)}</div>
                          <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:280,overflowY:'auto'}}>
                            {panel.liste.length===0
                              ?<div style={{color:t.textMuted,fontSize:12,textAlign:'center',padding:20}}>Kayıt yok</div>
                              :panel.liste.map((item,i)=>(
                                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 10px',background:t.hover,borderRadius:8,fontSize:12}}>
                                  <div>{panel.render(item)}</div>
                                  <span style={{color:panel.renk,fontWeight:600}}>{para(item.tutar)}</span>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                }
              </div>
            )}

            {sekme==='stok'&&(
              <div>
                {stokYukleniyor&&!stokYuklendi
                  ?<div style={{padding:60,textAlign:'center',color:t.textMuted}}>⏳ Stok verileri çekiliyor (Silver Polo'nun tamamı dahil biraz sürebilir)...</div>
                  :<div style={{display:'flex',flexDirection:'column',gap:20}}>

                    {/* Genel toplam */}
                    <div style={{background:t.card,border:`1px solid ${t.accent}44`,borderRadius:14,padding:'18px 20px'}}>
                      <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Genel Toplam Stok Değeri</div>
                      <div style={{fontSize:26,fontWeight:700,color:t.accent,fontFamily:"'Playfair Display',serif"}}>
                        {para(yerelToplamDeger+nasbagToplamDeger+silverpoloToplamDeger)}
                      </div>
                      <div style={{fontSize:12,color:t.textMuted,marginTop:4}}>Yerel + Nas Bag + Silver Polo (tedarikçi maliyeti üzerinden)</div>
                    </div>

                    {/* Mağaza bazlı yerel stok */}
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:10}}>🏪 Mağaza Bazlı Stok Değeri (Yerel)</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
                        {magazaStokDegeri.map(({magaza,adet,deger,cesit})=>(
                          <div key={magaza.id} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:'16px 18px'}}>
                            <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:8}}>{magaza.ikon||'🏪'} {magaza.ad}</div>
                            <div style={{fontSize:20,fontWeight:700,color:t.accent,fontFamily:"'Playfair Display',serif",marginBottom:6}}>{para(deger)}</div>
                            <div style={{fontSize:11,color:t.textMuted}}>{adet} adet · {cesit} ürün çeşidi</div>
                          </div>
                        ))}
                        <div style={{background:'rgba(201,184,130,.06)',border:`1px solid ${t.accent}33`,borderRadius:14,padding:'16px 18px'}}>
                          <div style={{fontSize:13,fontWeight:600,color:t.accent,marginBottom:8}}>📊 Yerel Toplam</div>
                          <div style={{fontSize:20,fontWeight:700,color:t.accent,fontFamily:"'Playfair Display',serif",marginBottom:6}}>{para(yerelToplamDeger)}</div>
                          <div style={{fontSize:11,color:t.textMuted}}>{yerelToplamAdet} adet · tüm mağazalar</div>
                        </div>
                      </div>
                    </div>

                    {/* Tedarikçi stokları (Nas Bag / Silver Polo) */}
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:10}}>📦 Tedarikçi Stok Değeri (Canlı XML)</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
                        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:'16px 18px'}}>
                          <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:8}}>Nas Bag</div>
                          <div style={{fontSize:20,fontWeight:700,color:'#56ccf2',fontFamily:"'Playfair Display',serif",marginBottom:6}}>{para(nasbagToplamDeger)}</div>
                          <div style={{fontSize:11,color:t.textMuted}}>{nasbagToplamAdet} adet · {nasbagStok.length} kalem · Fiyat1 üzerinden</div>
                        </div>
                        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:'16px 18px'}}>
                          <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:8}}>Silver Polo</div>
                          <div style={{fontSize:20,fontWeight:700,color:'#bb87fc',fontFamily:"'Playfair Display',serif",marginBottom:6}}>{para(silverpoloToplamDeger)}</div>
                          <div style={{fontSize:11,color:t.textMuted}}>{silverpoloToplamAdet} adet · {silverpoloStok.length} kalem · alış fiyatı üzerinden</div>
                        </div>
                      </div>
                    </div>

                    <button onClick={()=>{setStokYuklendi(false)}} style={{alignSelf:'flex-start',padding:'8px 16px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>
                      ↻ Stok Verilerini Yenile
                    </button>
                  </div>
                }
              </div>
            )}
          </>
        }
      </div>

      {virmanModal&&<VirmanModal hesaplar={hesaplar} magazalar={magazalar} tip={virmanModal} t={t} onKaydet={()=>{setVirmanModal(null);yukle()}} onKapat={()=>setVirmanModal(null)}/>}
      {hesapModal&&<HesapModal hesap={hesapModal==='yeni'?null:hesapModal} magazalar={magazalar} t={t} onKaydet={()=>{setHesapModal(null);yukle()}} onKapat={()=>setHesapModal(null)}/>}
      {hareketModal&&<HareketModal hesap={hareketModal} kategoriler={kategoriler} t={t} onKaydet={()=>{setHareketModal(null);yukle()}} onKapat={()=>setHareketModal(null)}/>}
    </div>
  )
}