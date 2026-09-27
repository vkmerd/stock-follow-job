import { useState, useEffect } from 'react'
import { kasaBugunGetir, kasaAc, kasaKapat, kasaIslemEkle } from '../api'

const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const saat  = iso => new Date(iso).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})

export default function GunlukKasa({ t, magazaId, magazaAd }) {
  const [kasa, setKasa]             = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [acilisModal, setAcilisModal] = useState(false)
  const [kapanisModal, setKapanisModal] = useState(false)
  const [nakitAktarModal, setNakitAktarModal] = useState(false)
  const [nakitAktarTutar, setNakitAktarTutar] = useState('')
  const [islemModal, setIslemModal] = useState(false)
  const [acilisBakiye, setAcilisBakiye] = useState('')
  const [kapanisBakiye, setKapanisBakiye] = useState('')
  const [islemForm, setIslemForm] = useState({ tip:'giris', odeme:'nakit', tutar:'', aciklama:'' })
  const [kayit, setKayit] = useState(false)

  const yukle = async () => {
    if (!magazaId) return setYukleniyor(false)
    setYukleniyor(true)
    try {
      const data = await kasaBugunGetir({ magazaId })
      setKasa(data)
    } catch(e) { console.error(e) }
    finally { setYukleniyor(false) }
  }

  useEffect(() => { yukle() }, [magazaId])

  const kasaAcFn = async () => {
    setKayit(true)
    try {
      await kasaAc({ magazaId, acilisBakiyesi: Number(acilisBakiye)||0 })
      setAcilisModal(false)
      yukle()
    } catch(e) { alert(e.message) }
    finally { setKayit(false) }
  }

  const kasaKapatFn = async () => {
    setKayit(true)
    try {
      await kasaKapat({ kasaId: kasa.id, kapanisBakiyesi: Number(kapanisBakiye)||0 })
      setKapanisModal(false)
      yukle()
    } catch(e) { alert(e.message) }
    finally { setKayit(false) }
  }

  const islemEkleFn = async () => {
    if (!islemForm.tutar || Number(islemForm.tutar) <= 0) return alert('Tutar giriniz')
    setKayit(true)
    try {
      await kasaIslemEkle({ kasaId: kasa.id, ...islemForm, tutar: Number(islemForm.tutar) })
      setIslemModal(false)
      setIslemForm({ tip:'giris', odeme:'nakit', tutar:'', aciklama:'' })
      yukle()
    } catch(e) { alert(e.message) }
    finally { setKayit(false) }
  }

  const yazdirZRaporu = () => {
    if (!kasa) return
    const o = kasa.ozet
    const satislar = kasa.satislar || []
    const masraflar = kasa.masraflar || []
    const win = window.open('','_blank','width=400,height=800')
    win.document.write(`<!DOCTYPE html><html><head><title>Z Raporu</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:monospace;font-size:11px;width:80mm;padding:8px;}
      .c{text-align:center;} .r{display:flex;justify-content:space-between;margin-bottom:2px;}
      .bold{font-weight:700;} .sm{font-size:9px;color:#444;}
      hr{border:none;border-top:1px dashed #000;margin:5px 0;}
    </style></head><body>
    <div class="c bold" style="font-size:16px;letter-spacing:2px;margin-bottom:4px">VEGA</div>
    <div class="c sm">Çanta & Ayakkabı</div>
    <div class="c sm">${magazaAd||''}</div>
    <hr/>
    <div class="c bold" style="font-size:13px">*** Z RAPORU ***</div>
    <hr/>
    <div class="r sm"><span>Tarih:</span><span>${new Date().toLocaleDateString('tr-TR')}</span></div>
    <div class="r sm"><span>Saat:</span><span>${new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span></div>
    <hr/>
    <div class="r bold"><span>Açılış Bakiyesi:</span><span>${para(kasa.acilisBakiyesi)}</span></div>
    <hr/>
    <div class="c sm bold" style="margin-bottom:3px">SATIŞ ÖZETİ</div>
    <div class="r"><span>Satış Sayısı:</span><span>${o.satisSayisi}</span></div>
    <div class="r"><span>Toplam Satış:</span><span>${para(o.toplamSatis)}</span></div>
    <div class="r sm"><span>  Nakit:</span><span>${para(o.nakitSatis)}</span></div>
    <div class="r sm"><span>  Kredi Kartı:</span><span>${para(o.kartSatis)}</span></div>
    <div class="r sm"><span>  Havale/EFT:</span><span>${para(o.havaleSatis)}</span></div>
    <hr/>
    <div class="c sm bold" style="margin-bottom:3px">SATILAN ÜRÜNLER</div>
    ${satislar.flatMap(s=>(s.kalemler||[]).map(k=>
      '<div class="r sm"><span style="max-width:65%">'+k.urunAd+(k.renk?' ('+k.renk+(k.beden?'/'+k.beden:'')+')':'')+'</span><span>'+para(k.toplam)+'</span></div>'
    )).join('')}
    <hr/>
    <div class="r"><span>İade Sayısı:</span><span>${o.iadeSayisi}</span></div>
    <div class="r"><span>Toplam İade:</span><span>-${para(o.toplamIade)}</span></div>
    <hr/>
    <div class="c sm bold" style="margin-bottom:3px">MASRAFLAR</div>
    ${masraflar.length>0 ? masraflar.map(m=>
      '<div class="r sm"><span>'+(m.kategori?.ad||'Masraf')+'</span><span>-'+para(m.tutar)+'</span></div>'
    ).join('') : '<div class="c sm">Masraf yok</div>'}
    <div class="r"><span>Toplam Masraf:</span><span>-${para(o.toplamMasraf)}</span></div>
    <hr/>
    <div class="r bold" style="font-size:13px"><span>KASADAKİ NAKİT:</span><span>${para(o.nakitNet)}</span></div>
    ${(kasa.manuelHareketler||[]).length>0?`
    <hr/>
    <div class="c sm bold" style="margin-bottom:3px">MANUEL HAREKETLER</div>
    ${(kasa.manuelHareketler||[]).map(h=>
      '<div class="r sm"><span>'+(h.aciklama||h.tip)+'</span><span>'+(h.tip==='nakit_giris'?'+':'-')+para(h.tutar)+'</span></div>'
    ).join('')}`:''}
    <hr/>
    <div class="c sm" style="margin-top:6px">Vega Çanta & Ayakkabı</div>
    <div class="c sm">Teşekkürler</div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  if (!magazaId) return (
    <div style={{padding:40,textAlign:'center',color:t.textMuted}}>
      Günlük kasa için üstten mağaza seçiniz
    </div>
  )

  if (yukleniyor) return <div style={{padding:40,textAlign:'center',color:t.textMuted}}>⏳ Yükleniyor...</div>

  const o = kasa?.ozet || {}
  const kapali = !kasa || kasa?.durum === 'kapali'

  // Kasa kapalıysa veya bugün hiç açılmamışsa açma ekranı göster
  if (kapali && !acilisModal) return (
    <div style={{padding:60,textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:16}}>🏧</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:t.text,marginBottom:8}}>
        Kasa {kasa?.durum==='kapali'?'Kapalı':'Bugün Açılmamış'}
      </div>
      <div style={{fontSize:13,color:t.textMuted,marginBottom:24}}>
        {magazaAd} — {new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'})}
      </div>
      <button onClick={()=>setAcilisModal(true)} style={{
        padding:'14px 36px',borderRadius:14,fontSize:16,fontWeight:700,
        background:'rgba(111,207,151,.15)',border:'1px solid rgba(111,207,151,.4)',color:'#6fcf97'}}>
        🔓 Kasayı Aç
      </button>
    </div>
  )

  return (
    <div style={{padding:'24px 28px'}}>
      {/* Başlık */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:t.text}}>
            Günlük Kasa — {magazaAd}
          </div>
          <div style={{fontSize:13,color:t.textMuted,marginTop:3}}>
            {new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            {' · '}
            <span style={{color:kapali?'#eb5757':'#6fcf97',fontWeight:600}}>
              {kapali?'● Kapalı':'● Açık'}
            </span>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setIslemModal(true)} disabled={kapali} style={{
            padding:'9px 18px',borderRadius:10,background:t.accentBg,
            border:`1px solid ${t.accent}55`,color:t.accent,fontSize:12,fontWeight:600}}>
            + Nakit Hareket
          </button>
          <button onClick={yazdirZRaporu} style={{
            padding:'9px 18px',borderRadius:10,background:t.input,
            border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>
            🖨 Z Raporu
          </button>
          {!kapali && (
            <button onClick={()=>{setKapanisBakiye(String(o.nakitNet||0));setKapanisModal(true)}} style={{
              padding:'9px 18px',borderRadius:10,background:'rgba(235,87,87,.12)',
              border:'1px solid rgba(235,87,87,.35)',color:'#eb5757',fontSize:12,fontWeight:600}}>
              Kasayı Kapat
            </button>
          )}
        </div>
      </div>

      {/* KPI Kartlar */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:22}}>
        {[
          {l:'Açılış Bakiyesi', v:para(kasa?.acilisBakiyesi||0), c:t.accent},
          {l:'Toplam Satış',    v:para(o.toplamSatis),           c:'#6fcf97'},
          {l:'Nakit Satış',     v:para(o.nakitSatis),            c:'#6fcf97'},
          {l:'Kart Satış',      v:para(o.kartSatis),             c:'#56ccf2'},
          {l:'Havale',          v:para(o.havaleSatis),           c:'#bb87fc'},
          {l:'İadeler',         v:`-${para(o.toplamIade)}`,      c:'#f2c94c'},
          {l:'Masraflar',       v:`-${para(o.toplamMasraf)}`,    c:'#eb5757'},
          {l:'Kasadaki Nakit',  v:para(o.nakitNet),              c:t.accent, bold:true},
        ].map(k=>(
          <div key={k.l} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.4}}>{k.l}</div>
            <div style={{fontSize:k.bold?20:16,fontWeight:k.bold?700:600,color:k.c,fontFamily:"'Playfair Display',serif"}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Satışlar */}
      {(kasa?.satislar||[]).length > 0 && (
        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden',marginBottom:16}}>
          <div style={{padding:'12px 18px',borderBottom:`1px solid ${t.border}`,fontSize:11,color:t.textMuted,textTransform:'uppercase',letterSpacing:.5}}>
            Bugünkü Satışlar ({kasa.satislar.length})
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
              {['Saat','Fiş No','Kalem','Ödeme','Tutar'].map(h=>(
                <th key={h} style={{padding:'9px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {kasa.satislar.map(s=>(
                <tr key={s.id} style={{borderBottom:`1px solid ${t.border}`}}>
                  <td style={{padding:'9px 14px',fontSize:11,color:t.textMuted}}>{saat(s.tarih)}</td>
                  <td style={{padding:'9px 14px',fontSize:12,color:t.accent,fontFamily:'monospace'}}>{s.fisNo}</td>
                  <td style={{padding:'9px 14px',fontSize:12,color:t.text}}>{s.kalemler?.length||0} ürün</td>
                  <td style={{padding:'9px 14px',fontSize:11,color:t.textMuted}}>
                    {s.odemeler?.map(o=>o.tip).join(', ')}
                  </td>
                  <td style={{padding:'9px 14px',fontSize:13,fontWeight:600,color:'#6fcf97'}}>{para(s.genelToplam)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manuel İşlemler */}
      {(kasa?.islemler||[]).length > 0 && (
        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden'}}>
          <div style={{padding:'12px 18px',borderBottom:`1px solid ${t.border}`,fontSize:11,color:t.textMuted,textTransform:'uppercase',letterSpacing:.5}}>
            Manuel Nakit Hareketler
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <tbody>
              {kasa.islemler.map(i=>(
                <tr key={i.id} style={{borderBottom:`1px solid ${t.border}`}}>
                  <td style={{padding:'9px 14px',fontSize:11,color:t.textMuted}}>{saat(i.tarih)}</td>
                  <td style={{padding:'9px 14px'}}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,
                      background:i.tip==='giris'?'rgba(111,207,151,.1)':'rgba(235,87,87,.1)',
                      color:i.tip==='giris'?'#6fcf97':'#eb5757'}}>
                      {i.tip==='giris'?'↑ Giriş':'↓ Çıkış'}
                    </span>
                  </td>
                  <td style={{padding:'9px 14px',fontSize:12,color:t.text}}>{i.aciklama||'—'}</td>
                  <td style={{padding:'9px 14px',fontSize:13,fontWeight:600,
                    color:i.tip==='giris'?'#6fcf97':'#eb5757'}}>
                    {i.tip==='giris'?'+':'-'}{para(i.tutar)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Kasa Açılış Modal */}
      {acilisModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:360}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text,marginBottom:18}}>Kasayı Aç</div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase'}}>Açılış Nakit Bakiyesi</div>
            <div style={{position:'relative',marginBottom:18}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
              <input type="number" value={acilisBakiye} onChange={e=>setAcilisBakiye(e.target.value)}
                placeholder="0,00" autoFocus
                style={{width:'100%',padding:'12px 14px 12px 28px',borderRadius:10,background:t.input,
                  border:`1px solid ${t.border}`,color:t.accent,fontSize:18,fontWeight:700,outline:'none'}}/>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setAcilisModal(false)} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
              <button onClick={kasaAcFn} disabled={kayit} style={{flex:2,padding:'11px 0',borderRadius:10,background:'rgba(111,207,151,.14)',border:'1px solid rgba(111,207,151,.4)',color:'#6fcf97',fontSize:13,fontWeight:700}}>
                {kayit?'...':'✓ Kasayı Aç'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kapanış Modal */}
      {kapanisModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:400}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text,marginBottom:18}}>Kasayı Kapat</div>
            <div style={{padding:'12px 16px',background:'rgba(242,201,76,.06)',border:'1px solid rgba(242,201,76,.2)',borderRadius:10,marginBottom:16}}>
              <div style={{fontSize:11,color:'#f2c94c',marginBottom:4}}>Sistem Hesabı</div>
              <div style={{fontSize:20,fontWeight:700,color:t.accent}}>{para(o.nakitNet)}</div>
            </div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase'}}>Sayılan Nakit</div>
            <div style={{position:'relative',marginBottom:18}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
              <input type="number" value={kapanisBakiye} onChange={e=>setKapanisBakiye(e.target.value)}
                style={{width:'100%',padding:'12px 14px 12px 28px',borderRadius:10,background:t.input,
                  border:`1px solid ${t.border}`,color:t.accent,fontSize:18,fontWeight:700,outline:'none'}}/>
            </div>
            {kapanisBakiye && (
              <div style={{padding:'10px 14px',borderRadius:8,marginBottom:14,
                background: Math.abs(Number(kapanisBakiye)-o.nakitNet)<1 ? 'rgba(111,207,151,.08)' : 'rgba(235,87,87,.08)',
                border: `1px solid ${Math.abs(Number(kapanisBakiye)-o.nakitNet)<1 ? 'rgba(111,207,151,.3)' : 'rgba(235,87,87,.3)'}`}}>
                <div style={{fontSize:12,color:t.textMuted}}>Fark</div>
                <div style={{fontSize:16,fontWeight:700,color:Number(kapanisBakiye)-o.nakitNet>=0?'#6fcf97':'#eb5757'}}>
                  {Number(kapanisBakiye)-o.nakitNet >= 0 ? '+' : ''}{para(Number(kapanisBakiye)-o.nakitNet)}
                </div>
              </div>
            )}
            <button onClick={()=>{setNakitAktarTutar(String(o.nakitNet||0));setNakitAktarModal(true);setKapanisModal(false)}}
              style={{width:'100%',padding:'10px 0',borderRadius:10,marginBottom:10,
                background:'rgba(86,204,242,.08)',border:'1px solid rgba(86,204,242,.25)',
                color:'#56ccf2',fontSize:13,fontWeight:600}}>
              🏦 Nakit Kasaya Aktar
            </button>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setKapanisModal(false)} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
              <button onClick={kasaKapatFn} disabled={kayit} style={{flex:2,padding:'11px 0',borderRadius:10,background:'rgba(235,87,87,.12)',border:'1px solid rgba(235,87,87,.35)',color:'#eb5757',fontSize:13,fontWeight:700}}>
                {kayit?'...':'Kasayı Kapat & Z Raporu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nakit Kasaya Aktar Modal */}
      {nakitAktarModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:420}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text,marginBottom:18}}>🏦 Nakit Kasaya Aktar</div>
            <div style={{padding:'12px 16px',background:'rgba(86,204,242,.06)',border:'1px solid rgba(86,204,242,.2)',borderRadius:10,marginBottom:16,fontSize:12,color:'#56ccf2'}}>
              Günlük nakit tahsilatı "Nakit Kasa" banka hesabına aktarılacak.
            </div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase'}}>Aktarılacak Tutar</div>
            <div style={{position:'relative',marginBottom:18}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
              <input type="number" value={nakitAktarTutar} onChange={e=>setNakitAktarTutar(e.target.value)}
                style={{width:'100%',padding:'12px 14px 12px 28px',borderRadius:10,background:t.input,
                  border:`1px solid ${t.border}`,color:'#56ccf2',fontSize:18,fontWeight:700,outline:'none'}}/>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setNakitAktarModal(false)} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
              <button 
              onClick={async () => {
                try {
                  // .env'den gelen url'i alıyoruz, eğer env okunamazsa fallback olarak localhost'a düşüyor
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                  
                  const res = await fetch(`${apiUrl}/api/kasa/nakite-aktar`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      kasaId: kasa.id, 
                      tutar: Number(nakitAktarTutar),
                      aciklama: `Günlük Kasa Nakdi - ${new Date().toLocaleDateString('tr-TR')} - ${magazaAd}`
                    })
                  });

                  if (!res.ok) throw new Error('Aktarım başarısız');
                  
                  alert('✓ Nakit kasaya aktarıldı');
                  setNakitAktarModal(false);
                  yukle();
                } catch(e) { 
                  alert('Hata: ' + e.message); 
                }
              }} 
              style={{
                flex: 2,
                padding: '11px 0',
                borderRadius: 10,
                background: 'rgba(86,204,242,.12)',
                border: '1px solid rgba(86,204,242,.35)',
                color: '#56ccf2',
                fontSize: 13,
                fontWeight: 700
              }}
            >
              ✓ Aktar
            </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Manuel İşlem Modal */}
      {islemModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:400}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:18}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>Nakit Hareket</div>
              <button onClick={()=>setIslemModal(false)} style={{color:t.textMuted,fontSize:20}}>✕</button>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              {[['giris','↑ Para Girişi','#6fcf97'],['cikis','↓ Para Çıkışı','#eb5757']].map(([k,l,c])=>(
                <button key={k} onClick={()=>setIslemForm(p=>({...p,tip:k}))} style={{
                  flex:1,padding:'10px 0',borderRadius:10,fontSize:13,
                  background:islemForm.tip===k?`${c}18`:t.input,
                  border:`1px solid ${islemForm.tip===k?c+'55':t.border}`,
                  color:islemForm.tip===k?c:t.textMuted,fontWeight:islemForm.tip===k?600:400}}>{l}</button>
              ))}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase'}}>Tutar *</div>
                <div style={{position:'relative'}}>
                  <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
                  <input type="number" value={islemForm.tutar} onChange={e=>setIslemForm(p=>({...p,tutar:e.target.value}))}
                    placeholder="0,00" autoFocus
                    style={{width:'100%',padding:'11px 14px 11px 28px',borderRadius:10,background:t.input,
                      border:`1px solid ${t.border}`,color:t.accent,fontSize:16,fontWeight:700,outline:'none'}}/>
                </div>
              </div>
              <div>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase'}}>Açıklama</div>
                <input value={islemForm.aciklama} onChange={e=>setIslemForm(p=>({...p,aciklama:e.target.value}))}
                  placeholder="örn. Kasa açılış, avans..."
                  style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,
                    border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:18}}>
              <button onClick={()=>setIslemModal(false)} style={{flex:1,padding:'11px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
              <button onClick={islemEkleFn} disabled={kayit} style={{flex:2,padding:'11px 0',borderRadius:10,
                background:islemForm.tip==='giris'?'rgba(111,207,151,.14)':'rgba(235,87,87,.12)',
                border:`1px solid ${islemForm.tip==='giris'?'rgba(111,207,151,.4)':'rgba(235,87,87,.35)'}`,
                color:islemForm.tip==='giris'?'#6fcf97':'#eb5757',fontSize:13,fontWeight:700}}>
                {kayit?'...':'✓ Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
