import { useState } from 'react'
import { satislariGetir, iadeOlustur } from '../api'
import { para, tarihFormat, ODEME_TIPLERI, FIS_CSS } from './utils'
import QzFisPaneli from './QzFisPaneli'
import { usePrint } from '../print/usePrint'

const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export default function IadeEkrani({ t, magazalar, magazaAd }) {
  const [aramaQ, setAramaQ]         = useState('')
  const [aramaTip, setAramaTip]     = useState('fis')   // 'fis' | 'urun'
  const [sonuclar, setSonuclar]     = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [secilenSatis, setSecilenSatis] = useState(null)
  const [iadeKalemleri, setIadeKalemleri] = useState([])
  const [iadeTip, setIadeTip]       = useState('nakit')
  const [neden, setNeden]           = useState('musteri_istegi')
  const [notlar, setNotlar]         = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [basarili, setBasarili]     = useState(null)
  const print = usePrint()

  const NEDENLER = [
    { id:'musteri_istegi', label:'Müşteri İsteği' },
    { id:'urun_hatali',    label:'Ürün Hatalı/Bozuk' },
    { id:'beden_uyumsuz', label:'Beden/Numara Uyumsuz' },
    { id:'diger',          label:'Diğer' },
  ]

  const ara = async () => {
    if (!aramaQ.trim()) return
    setYukleniyor(true)
    setSonuclar([])
    setSecilenSatis(null)
    try {
      let data = []
      if (aramaTip === 'fis') {
        // Fiş no ile ara (tire/boşluk farkını yok say)
        const tumSatislar = await satislariGetir({ limit: 500 })
        const q = normalize(aramaQ)
        data = tumSatislar.filter(s => normalize(s.fisNo).includes(q))
      } else {
        // Ürün adıyla ara - kalemler içinde ara
        const tumSatislar = await satislariGetir({ limit: 500 })
        data = tumSatislar.filter(s =>
          (s.kalemler||[]).some(k =>
            k.urunAd?.toLowerCase().includes(aramaQ.toLowerCase())
          )
        )
      }
      setSonuclar(data)
    } catch(e) {
      alert('Arama hatası: ' + e.message)
    } finally {
      setYukleniyor(false)
    }
  }

  const satisSec = (satis) => {
    setSecilenSatis(satis)
    // Ödeme tiplerini kaydet - iade yöntemi önerisi için
    setIadeKalemleri(
      (satis.kalemler||[]).map(k => ({
        ...k,
        iadeAdet: 0,
        secili: false,
        // Daha önce tamamen iade edilmiş mi kontrol et
        tamIadeEdildi: (k.iadeAdet || 0) >= k.adet,
      }))
    )
  }

  const kalemGuncelle = (idx, alan, deger) => {
    setIadeKalemleri(p => p.map((k,i) => {
      if (i !== idx) return k
      const guncellendi = {...k, [alan]: deger}
      // Kalem seçilince iadeAdet otomatik 1 yap
      if (alan === 'secili' && deger === true && guncellendi.iadeAdet === 0) {
        guncellendi.iadeAdet = 1
      }
      return guncellendi
    }))
  }

  const toplamIade = iadeKalemleri
    .filter(k => k.secili)
    .reduce((t,k) => t + ((k.iadeAdet || 1) * Number(k.birimFiyat||0)), 0)

  const iadeOlusturFn = async () => {
    const seciliKalemler = iadeKalemleri.filter(k => k.secili).map(k => ({...k, iadeAdet: k.iadeAdet||1}))
    if (seciliKalemler.length === 0) return alert('En az bir ürün seçin.')
    if (!iadeTip) return alert('İade ödeme tipi seçin.')

    setKaydediliyor(true)
    try {
      const iadeNo = `I-${Date.now().toString().slice(-6)}`
      await iadeOlustur({
        iadeNo,
        satisId:    secilenSatis.id,
        neden,
        notlar,
        toplamIade,
        durum:      'beklemede',
        kalemler: seciliKalemler.map(k => ({
          urunId:     k.urunId || null,
          urunAd:     k.urunAd,
          renk:       k.renk,
          beden:      k.beden,
          adet:       k.iadeAdet,
          birimFiyat: Number(k.birimFiyat),
          toplam:     k.iadeAdet * Number(k.birimFiyat),
          stokaGeri:  true,
        })),
        odemeler: [{
          tip:   iadeTip,
          tutar: toplamIade,
        }],
      })
      // Fiş basımı için gereken her şey burada saklanıyor — hemen altında
      // setSecilenSatis(null) çağrıldığı için orijinal fiş no'yu sonradan
      // okumak mümkün değil.
      setBasarili({
        iadeNo,
        tutar: toplamIade,
        tarih: new Date().toISOString(),
        satisFisNo: secilenSatis.fisNo,
        magazaAd: magazaAd || (typeof secilenSatis.magaza === 'object' ? secilenSatis.magaza?.ad : secilenSatis.magaza) || '',
        iadeTip,
        nedenLabel: NEDENLER.find(n => n.id === neden)?.label || neden,
        notlar,
        kalemler: seciliKalemler,
      })
      setSecilenSatis(null)
      setSonuclar([])
      setAramaQ('')
    } catch(e) {
      alert('İade hatası: ' + e.message)
    } finally {
      setKaydediliyor(false)
    }
  }

  // Tarayıcının yazdırma penceresinden bas — QZ Tray kurulu değilse/bağlı
  // değilse yedek yol. Satış ve değişim fişleriyle aynı FIS_CSS kullanılıyor.
  const tarayicidanYazdir = () => {
    const b = basarili
    if (!b) return
    const win = window.open('','_blank','width=400,height=600')
    const tarihStr = new Date(b.tarih).toLocaleString('tr-TR')
    const odemeLabel = ODEME_TIPLERI.find(o => o.id === b.iadeTip)?.label || b.iadeTip || '-'
    win.document.write(`<!DOCTYPE html><html><head><title>İade Fişi</title>
    <style>${FIS_CSS}</style></head><body>
    <div class="c" style="margin-bottom:10px">
      <div style="font-size:20px;font-weight:900;letter-spacing:3px">VEGA</div>
      <div class="sm">İade Fişi</div>
      <div class="sm">${b.magazaAd||''}</div>
    </div><hr/>
    <div class="row sm"><span>Tarih:</span><span>${tarihStr}</span></div>
    <div class="row sm"><span>İade No:</span><span style="font-weight:700">${b.iadeNo}</span></div>
    <div class="row sm"><span>Orijinal Fiş:</span><span>${b.satisFisNo||'-'}</span></div>
    <div class="row sm"><span>Neden:</span><span>${b.nedenLabel||'-'}</span></div>
    <hr/>
    <div class="bold sm" style="margin-bottom:5px">İADE EDİLEN ÜRÜNLER</div>
    ${(b.kalemler||[]).map(k=>{
      const adet = Number(k.iadeAdet||k.adet||1)
      const birim = Number(k.birimFiyat||0)
      return `<div class="row"><span style="max-width:60%">${k.urunAd}</span><span>${para(adet*birim)}</span></div>
      <div class="sm" style="padding-left:4px">${[k.renk,k.beden].filter(Boolean).join('/')} × ${adet} × ${para(birim)}${k.barkod?' #'+k.barkod:''}</div>`
    }).join('')}
    <hr/>
    <div class="row lg"><span>TOPLAM İADE</span><span>${para(b.tutar)}</span></div>
    <div class="row sm"><span>İade Şekli:</span><span>${odemeLabel}</span></div>
    ${b.notlar?`<div class="sm">Not: ${b.notlar}</div>`:''}
    <hr/>
    <div class="c sm">Durum: Yönetici onayı bekliyor</div>
    <div class="sm" style="margin-top:14px">Müşteri İmza: ______________________</div>
    <hr/>
    <div class="c sm" style="margin-top:8px">Vega Çanta & Ayakkabı</div>
    <script>window.onload=function(){window.print()}</script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="vega-page-pad" style={{padding:'24px 28px', maxWidth:900}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:t.text,marginBottom:6}}>İade Al</div>
      <div style={{fontSize:13,color:t.textMuted,marginBottom:24}}>Fiş numarası veya ürün adıyla satışı bulun</div>

      {/* Başarı mesajı */}
      {basarili && (
        <div style={{marginBottom:20,padding:'16px 20px',background:'rgba(111,207,151,.1)',border:'1px solid rgba(111,207,151,.3)',borderRadius:12}}>
          <div style={{fontSize:15,fontWeight:600,color:'#6fcf97',marginBottom:4}}>✓ İade başarıyla oluşturuldu</div>
          <div style={{fontSize:13,color:t.textMuted}}>İade No: <strong style={{color:t.text}}>{basarili.iadeNo}</strong> · Tutar: <strong style={{color:t.accent}}>{para(basarili.tutar)}</strong></div>
          <div style={{fontSize:12,color:t.textMuted,marginTop:4}}>İade onay için beklemede — Yönetici onaylaması gerekiyor.</div>
          <button onClick={()=>setBasarili(null)} style={{marginTop:10,padding:'7px 16px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>
            Yeni İade
          </button>
          {/* Termal fiş yazıcısına doğrudan ESC/POS; QZ Tray bağlı değilse
              paneldeki "Tarayıcıdan" butonu yedek yol olarak duruyor. */}
          <QzFisPaneli t={t} yazdir={print.iadeFisiYazdir} veri={basarili}
            etiket="🖨 QZ ile Fiş Bas" tarayicidanYazdir={tarayicidanYazdir} />
        </div>
      )}

      {!basarili && (
        <>
          {/* Arama */}
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20,marginBottom:20}}>
            <div style={{display:'flex',gap:8,marginBottom:14}}>
              {[['fis','🧾 Fiş No'],['urun','📦 Ürün Adı']].map(([k,l])=>(
                <button key={k} onClick={()=>setAramaTip(k)} style={{padding:'8px 16px',borderRadius:20,fontSize:12,
                  background:aramaTip===k?t.accentBg:t.input,border:`1px solid ${aramaTip===k?t.accent+'55':t.border}`,
                  color:aramaTip===k?t.accent:t.textMuted}}>{l}</button>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <input value={aramaQ} onChange={e=>setAramaQ(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&ara()}
                placeholder={aramaTip==='fis'?'F-0001':'Ürün adı yazın...'}
                style={{flex:1,padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
              <button onClick={ara} disabled={yukleniyor} style={{padding:'10px 24px',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>
                {yukleniyor?'Aranıyor...':'🔍 Ara'}
              </button>
            </div>
          </div>

          {/* Sonuçlar */}
          {sonuclar.length > 0 && !secilenSatis && (
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden',marginBottom:20}}>
              <div style={{padding:'14px 18px',borderBottom:`1px solid ${t.border}`,fontSize:12,color:t.textMuted}}>
                {sonuclar.length} satış bulundu
              </div>
              <div className="vega-scroll-x">
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
                  {['Fiş No','Tarih','Mağaza','Müşteri','Toplam','Seç'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {sonuclar.map(s=>(
                    <tr key={s.id} style={{borderBottom:`1px solid ${t.border}`}}>
                      <td style={{padding:'10px 14px',fontSize:12,color:t.accent,fontFamily:'monospace',fontWeight:600}}>{s.fisNo}</td>
                      <td style={{padding:'10px 14px',fontSize:11,color:t.textMuted}}>{tarihFormat(s.tarih)}</td>
                      <td style={{padding:'10px 14px',fontSize:12,color:t.text}}>{s.magaza?.ad||s.magaza||'—'}</td>
                      <td style={{padding:'10px 14px',fontSize:12,color:t.text}}>{s.musteri?.ad||s.musteriAd||'—'}</td>
                      <td style={{padding:'10px 14px',fontSize:13,fontWeight:600,color:t.accent}}>{para(s.genelToplam)}</td>
                      <td style={{padding:'10px 14px'}}>
                        <button onClick={()=>satisSec(s)} style={{padding:'6px 14px',borderRadius:8,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:12,fontWeight:600}}>
                          Seç
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {sonuclar.length === 0 && aramaQ && !yukleniyor && (
            <div style={{padding:30,textAlign:'center',color:t.textMuted,background:t.card,border:`1px solid ${t.border}`,borderRadius:14,marginBottom:20}}>
              Sonuç bulunamadı
            </div>
          )}

          {/* İade formu */}
          {secilenSatis && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {/* Satış özeti */}
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:18}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:t.text}}>Fiş: {secilenSatis.fisNo}</div>
                    <div style={{fontSize:12,color:t.textMuted}}>{tarihFormat(secilenSatis.tarih)} · {secilenSatis.magaza?.ad||secilenSatis.magaza||'—'}</div>
                  </div>
                  <button onClick={()=>setSecilenSatis(null)} style={{padding:'6px 12px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>
                    ← Geri
                  </button>
                </div>
                {/* Orijinal ödeme bilgisi */}
                {(secilenSatis.odemeler||[]).length>0&&(
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
                    <span style={{fontSize:10,color:t.textMuted,alignSelf:'center'}}>Orijinal ödeme:</span>
                    {secilenSatis.odemeler.map((o,i)=>(
                      <span key={i} style={{fontSize:11,padding:'3px 10px',borderRadius:20,
                        background:o.tip==='nakit'?'rgba(111,207,151,.12)':o.tip==='kart'||o.tip==='taksit'?'rgba(86,204,242,.12)':'rgba(187,135,252,.12)',
                        color:o.tip==='nakit'?'#6fcf97':o.tip==='kart'||o.tip==='taksit'?'#56ccf2':'#bb87fc',fontWeight:600}}>
                        {o.tip==='nakit'?'💵 Nakit':o.tip==='kart'?'💳 Kart':o.tip==='taksit'?`💳 ${o.taksitSayisi||2} Taksit`:'🏦 Havale'} · ₺{Number(o.tutar).toLocaleString('tr-TR')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Kalem seçimi */}
                <div style={{fontSize:11,color:t.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>İade Edilecek Ürünler</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {iadeKalemleri.map((k,i)=>(
                    <div key={i} style={{
                      display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:10,
                      background:k.secili?t.accentBg:t.hover,border:`1px solid ${k.secili?t.accent+'44':t.border}`
                    }}>
                      <div onClick={()=>!k.tamIadeEdildi&&kalemGuncelle(i,'secili',!k.secili)} style={{
                        width:20,height:20,borderRadius:6,cursor:k.tamIadeEdildi?'not-allowed':'pointer',flexShrink:0,
                        background:k.tamIadeEdildi?'#333':k.secili?t.accent:t.input,border:`1px solid ${t.border}`,
                        display:'flex',alignItems:'center',justifyContent:'center',opacity:k.tamIadeEdildi?0.4:1}}>
                        {k.secili&&!k.tamIadeEdildi&&<span style={{fontSize:11,color:'#111',fontWeight:700}}>✓</span>}
                        {k.tamIadeEdildi&&<span style={{fontSize:11,color:'#666'}}>—</span>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,color:t.text,fontWeight:500}}>{k.urunAd}</div>
                        <div style={{fontSize:11,color:t.textMuted}}>{k.renk}{k.beden?` / ${k.beden}`:''} · {k.adet} adet · {para(k.birimFiyat)}</div>
                        {k.barkod&&<div style={{fontSize:9,color:t.textMuted,fontFamily:'monospace',marginTop:1}}>#{k.barkod}</div>}
                        {k.tamIadeEdildi&&<div style={{fontSize:10,color:'#eb5757',marginTop:2}}>⚠ Bu kalem daha önce iade edildi</div>}
                      </div>
                      {k.secili && (
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:12,color:t.textMuted}}>İade:</span>
                          <input type="number" min={1} max={k.adet} value={k.iadeAdet||1}
                            onChange={e=>kalemGuncelle(i,'iadeAdet',Math.min(k.adet,Math.max(1,parseInt(e.target.value)||1)))}
                            style={{width:60,padding:'5px 8px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,textAlign:'center',outline:'none'}}/>
                          <span style={{fontSize:12,color:t.textMuted}}>/ {k.adet} adet</span>
                          <span style={{fontSize:12,color:t.textMuted}}>@</span>
                          <input type="number" min={0} step="0.01" value={k.birimFiyat}
                            onChange={e=>kalemGuncelle(i,'birimFiyat',Math.max(0,parseFloat(e.target.value)||0))}
                            style={{width:80,padding:'5px 8px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,textAlign:'center',outline:'none'}}/>
                          <span style={{fontSize:13,fontWeight:600,color:t.accent,minWidth:80,textAlign:'right'}}>
                            {para((k.iadeAdet||1)*Number(k.birimFiyat))}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* İade detayları */}
              {iadeKalemleri.some(k=>k.secili) && (
                <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:18}}>
                  <div style={{fontSize:11,color:t.textMuted,marginBottom:14,textTransform:'uppercase',letterSpacing:.5}}>İade Detayları</div>
                  
                  <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                    {/* Neden */}
                    <div>
                      <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>İade Nedeni</div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {NEDENLER.map(n=>(
                          <button key={n.id} onClick={()=>setNeden(n.id)} style={{
                            padding:'8px 12px',borderRadius:8,textAlign:'left',fontSize:12,
                            background:neden===n.id?t.accentBg:t.input,
                            border:`1px solid ${neden===n.id?t.accent+'55':t.border}`,
                            color:neden===n.id?t.accent:t.textMuted}}>
                            {neden===n.id?'● ':''}{n.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ödeme tipi */}
                    <div>
                      <div style={{fontSize:11,color:t.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>İade Ödeme Tipi</div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {ODEME_TIPLERI.filter(o=>o.id!=='taksit').map(o=>(
                          <button key={o.id} onClick={()=>setIadeTip(o.id)} style={{
                            padding:'8px 12px',borderRadius:8,textAlign:'left',fontSize:12,
                            background:iadeTip===o.id?`${o.renk}18`:t.input,
                            border:`1px solid ${iadeTip===o.id?o.renk+'55':t.border}`,
                            color:iadeTip===o.id?o.renk:t.textMuted}}>
                            {o.ikon} {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Not */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Not</div>
                    <textarea value={notlar} onChange={e=>setNotlar(e.target.value)} rows={2} placeholder="İsteğe bağlı not..."
                      style={{width:'100%',padding:'9px 12px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none',resize:'vertical'}}/>
                  </div>

                  {/* Toplam ve kaydet */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',
                    background:t.hover,borderRadius:10,marginBottom:14}}>
                    <div style={{fontSize:13,color:t.textMuted}}>İade Tutarı</div>
                    <div style={{fontSize:22,fontWeight:700,color:t.accent}}>{para(toplamIade)}</div>
                  </div>

                  <button onClick={iadeOlusturFn} disabled={kaydediliyor||toplamIade===0} style={{
                    width:'100%',padding:'13px 0',borderRadius:12,fontSize:14,fontWeight:700,
                    background:toplamIade>0?'rgba(111,207,151,.15)':t.input,
                    border:`1px solid ${toplamIade>0?'rgba(111,207,151,.4)':t.border}`,
                    color:toplamIade>0?'#6fcf97':t.textMuted}}>
                    {kaydediliyor?'İşleniyor...':'✓ İadeyi Oluştur'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
