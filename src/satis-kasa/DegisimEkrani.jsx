import { useState } from 'react'
import { satislariGetir, degisimOlustur, urunleriGetir } from '../api'
import { para, ODEME_TIPLERI, FIS_CSS } from './utils'
import QzFisPaneli from './QzFisPaneli'
import { usePrint } from '../print/usePrint'

const tarihFormat = iso => new Date(iso).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})

const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// İade satırının tutarı. 4. adımda tutar elle değiştirilebildiği için adet×birimFiyat
// her zaman doğru sonucu vermiyor (kullanıcının yazdığı tutar esas alınıyor); elle
// girilmemişse adet×birimFiyat'a düşüyor.
const iadeSatirTutar = k => Number(k?.iadeSatirToplam ?? (Number(k?.iadeAdet || 0) * Number(k?.birimFiyat || 0)))

export default function DegisimEkrani({ t, magazaId, magazaAd }) {
  const [adim, setAdim]           = useState(1) // 1: Satış bul, 2: Seç, 3: Yeni ürün, 4: Onay
  const [aramaQ, setAramaQ]       = useState('')
  const [aramaTip, setAramaTip]   = useState('fis')
  const [sonuclar, setSonuclar]   = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [secilenSatis, setSecilenSatis] = useState(null)
  const [iadeKalemler, setIadeKalemler] = useState([]) // iade edilecek ürünler
  const [yeniKalemler, setYeniKalemler] = useState([]) // verilecek yeni ürünler
  const [urunler, setUrunler]     = useState([])
  const [urunArama, setUrunArama] = useState('')
  const [farkOdeme, setFarkOdeme] = useState('nakit')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [basarili, setBasarili]   = useState(null)
  const print = usePrint()

  // Satış ara
  const ara = async () => {
    if (!aramaQ.trim()) return
    setYukleniyor(true)
    try {
      const tumSatislar = await satislariGetir({ limit: 500 })
      const q = normalize(aramaQ)
      const filtreli = tumSatislar.filter(s =>
        aramaTip === 'fis'
          ? normalize(s.fisNo).includes(q)
          : (s.kalemler||[]).some(k =>
              k.urunAd?.toLowerCase().includes(aramaQ.toLowerCase()) ||
              normalize(k.barkod).includes(q)
            )
      )
      setSonuclar(filtreli)
    } catch(e) { alert(e.message) }
    finally { setYukleniyor(false) }
  }

  const satisSec = async (satis) => {
    setSecilenSatis(satis)
    setIadeKalemler((satis.kalemler||[]).map(k=>({...k, secili:false, iadeAdet:1, iadeSatirToplam:Number(k.birimFiyat)})))
    // Ürünleri yükle
    const u = await urunleriGetir().catch(()=>[])
    setUrunler(u)
    setAdim(2)
  }

  const kalemToggle = (idx) => {
    setIadeKalemler(p=>p.map((k,i)=>i===idx?{...k,secili:!k.secili}:k))
  }

  const iadeAdetGuncelle = (idx, adet) => {
    setIadeKalemler(p=>p.map((k,i)=>{
      if(i!==idx) return k
      const iadeAdet = Math.min(k.adet,Math.max(1,parseInt(adet)||1))
      return {...k, iadeAdet, iadeSatirToplam: iadeAdet*Number(k.birimFiyat)}
    }))
  }

  const iadeFiyatGuncelle = (idx, fiyat) => {
    setIadeKalemler(p=>p.map((k,i)=>{
      if(i!==idx) return k
      const birimFiyat = Math.max(0,parseFloat(fiyat)||0)
      return {...k, birimFiyat, iadeSatirToplam: k.iadeAdet*birimFiyat}
    }))
  }

  // 4. adım: satırın TUTARI doğrudan yazılıyor, birim fiyat buna göre geri hesaplanıyor
  // (kasiyer ×2 bir satırda 450 yazmak isterse 225 hesaplamak zorunda kalmasın).
  const iadeSatirTutarGuncelle = (idx, tutar) => {
    setIadeKalemler(p=>p.map((k,i)=>{
      if(i!==idx) return k
      const iadeSatirToplam = Math.max(0,parseFloat(tutar)||0)
      const adet = Math.max(1, Number(k.iadeAdet)||1)
      return {...k, iadeSatirToplam, birimFiyat: iadeSatirToplam/adet}
    }))
  }

  // Yeni ürün ekle sepete
  const yeniUrunEkle = (urun, varyant) => {
    setYeniKalemler(p=>[...p,{
      urunId:    urun.id,
      urunAd:    urun.ad,
      renk:      varyant.renk,
      beden:     varyant.beden,
      adet:      1,
      birimFiyat: Number(urun.satisF),
      toplam:    Number(urun.satisF),
      magazaId,
    }])
  }

  const yeniAdetGuncelle = (idx, adet) => {
    setYeniKalemler(p=>p.map((k,i)=>i===idx?{...k,adet:Math.max(1,parseInt(adet)||1),toplam:(Math.max(1,parseInt(adet)||1))*k.birimFiyat}:k))
  }

  const yeniFiyatGuncelle = (idx, fiyat) => {
    setYeniKalemler(p=>p.map((k,i)=>{
      if(i!==idx) return k
      const birimFiyat = Math.max(0,parseFloat(fiyat)||0)
      return {...k, birimFiyat, toplam: k.adet*birimFiyat}
    }))
  }

  const yeniSatirTutarGuncelle = (idx, tutar) => {
    setYeniKalemler(p=>p.map((k,i)=>{
      if(i!==idx) return k
      const toplam = Math.max(0,parseFloat(tutar)||0)
      const adet = Math.max(1, Number(k.adet)||1)
      return {...k, toplam, birimFiyat: toplam/adet}
    }))
  }

  const yeniKalemSil = (idx) => {
    setYeniKalemler(p=>p.filter((_,i)=>i!==idx))
  }

  // Hesaplamalar
  const seciliIadeler  = iadeKalemler.filter(k=>k.secili)
  const iadeToplam     = seciliIadeler.reduce((t,k)=>t+iadeSatirTutar(k),0)
  const yeniToplam     = yeniKalemler.reduce((t,k)=>t+k.toplam,0)
  const fark           = yeniToplam - iadeToplam
  const farkPozitif    = fark > 0 // müşteri fark öder
  const farkNegatif    = fark < 0 // müşteriye iade

  // Değişimi kaydet
  const kaydet = async () => {
    if (seciliIadeler.length === 0) return alert('En az bir iade kalemi seçin')
    if (yeniKalemler.length === 0)  return alert('En az bir yeni ürün ekleyin')
    setKaydediliyor(true)
    try {
      const degisimNo = `D-${Date.now().toString().slice(-6)}`
      await degisimOlustur({
        satisId:   secilenSatis.id,
        magazaId,
        farkTutar: Math.abs(fark),
        farkOdeme: fark === 0 ? null : fark > 0 ? farkOdeme : 'iade',
        kalemler: [
          ...seciliIadeler.map(k=>({ tip:'iade', urunId:k.urunId||null, urunAd:k.urunAd, renk:k.renk, beden:k.beden, adet:k.iadeAdet, birimFiyat:Number(k.birimFiyat), toplam:iadeSatirTutar(k) })),
          ...yeniKalemler.map(k=>({ tip:'yeni', urunId:k.urunId, urunAd:k.urunAd, renk:k.renk, beden:k.beden, adet:k.adet, birimFiyat:k.birimFiyat, toplam:k.toplam })),
        ]
      })
      setBasarili({ 
        degisimNo, fark,
        satisFisNo: secilenSatis.fisNo,
        tarih: new Date().toISOString(),
        iadeKalemler: seciliIadeler,
        yeniKalemler,
        farkOdeme,
        magazaAd: magazaAd,
      })
      setAdim(1); setSecilenSatis(null); setSonuclar([]); setAramaQ('')
      setIadeKalemler([]); setYeniKalemler([])
    } catch(e) { alert('Hata: '+e.message) }
    finally { setKaydediliyor(false) }
  }

  const filtreliUrunler = urunler.filter(u=>
    !urunArama || u.ad?.toLowerCase().includes(urunArama.toLowerCase()) || u.barkod?.includes(urunArama)
  )

  return (
    <div className="vega-page-pad" style={{padding:'24px 28px'}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:t.text,marginBottom:6}}>Ürün Değişimi</div>
      <div style={{fontSize:13,color:t.textMuted,marginBottom:22}}>Müşterinin aldığı ürünü değiştir</div>

      {/* Başarı */}
      {basarili && (
        <div style={{marginBottom:20,padding:'16px 20px',background:'rgba(111,207,151,.1)',border:'1px solid rgba(111,207,151,.3)',borderRadius:12}}>
          <div style={{fontSize:15,fontWeight:600,color:'#6fcf97',marginBottom:4}}>✓ Değişim tamamlandı</div>
          <div style={{fontSize:13,color:t.textMuted,marginBottom:10}}>
            Değişim No: <strong style={{color:t.text}}>{basarili.degisimNo}</strong>
            {basarili.fark !== 0 && <> · Fark: <strong style={{color:basarili.fark>0?'#eb5757':'#6fcf97'}}>{para(Math.abs(basarili.fark))}</strong></>}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{
              const b = basarili
              const win = window.open('','_blank','width=400,height=600')
              const tarihStr = new Date(b.tarih).toLocaleString('tr-TR')
              win.document.write(`<!DOCTYPE html><html><head><title>Değişim Fişi</title>
              <style>${FIS_CSS}</style></head><body>
              <div class="c" style="margin-bottom:10px">
                <div style="font-size:20px;font-weight:900;letter-spacing:3px">VEGA</div>
                <div class="sm">Değişim Fişi</div>
                <div class="sm">${b.magazaAd||''}</div>
              </div><hr/>
              <div class="row sm"><span>Tarih:</span><span>${tarihStr}</span></div>
              <div class="row sm"><span>Değişim No:</span><span style="font-weight:700">${b.degisimNo}</span></div>
              <div class="row sm"><span>Orijinal Fiş:</span><span>${b.satisFisNo}</span></div>
              <hr/>
              <div class="bold sm" style="margin-bottom:5px">İADE EDİLEN</div>
              ${b.iadeKalemler.map(k=>`
                <div class="row"><span style="max-width:60%">${k.urunAd}</span><span>-${para(iadeSatirTutar(k))}</span></div>
                <div class="sm" style="padding-left:4px">${[k.renk,k.beden].filter(Boolean).join('/')} × ${k.iadeAdet}${k.barkod?' #'+k.barkod:''}</div>
              `).join('')}
              <hr/>
              <div class="bold sm" style="margin-bottom:5px">VERİLEN</div>
              ${b.yeniKalemler.map(k=>`
                <div class="row"><span style="max-width:60%">${k.urunAd}</span><span>${para(k.toplam)}</span></div>
                <div class="sm" style="padding-left:4px">${[k.renk,k.beden].filter(Boolean).join('/')} × ${k.adet}${k.barkod?' #'+k.barkod:''}</div>
              `).join('')}
              <hr/>
              ${b.fark!==0?`<div class="row bold"><span>${b.fark>0?'Müşteri Ödedi':'Müşteriye İade'}</span><span>${para(Math.abs(b.fark))}</span></div>
              <div class="row sm"><span>Ödeme:</span><span>${b.farkOdeme||'-'}</span></div>`:'<div class="c sm">Fark Yok</div>'}
              <hr/>
              <div class="c sm" style="margin-top:8px">Teşekkürler · Vega Çanta & Ayakkabı</div>
              <script>window.onload=function(){window.print()}<\/script>
              </body></html>`)
              win.document.close()
            }} style={{padding:'7px 14px',borderRadius:8,background:'rgba(111,207,151,.15)',border:'1px solid rgba(111,207,151,.3)',color:'#6fcf97',fontSize:12,cursor:'pointer'}}>
              🖨 Fiş Yazdır
            </button>
            <button onClick={()=>setBasarili(null)} style={{padding:'7px 14px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12,cursor:'pointer'}}>
              Yeni Değişim
            </button>
          </div>
          {/* Termal fiş yazıcısına doğrudan ESC/POS — yukarıdaki buton tarayıcının
              yazdırma penceresini açar, bu ise doğrudan yazıcıya gönderir. */}
          <QzFisPaneli t={t} yazdir={print.degisimFisiYazdir} veri={basarili} etiket="🖨 QZ ile Fiş Bas" />
        </div>
      )}

      {/* Adım göstergesi */}
      <div style={{display:'flex',gap:4,marginBottom:22}}>
        {['Satış Bul','İade Seç','Yeni Ürün','Onay'].map((l,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,
              background:adim===i+1?t.accent:adim>i+1?'rgba(111,207,151,.2)':t.input,
              color:adim===i+1?'#111':adim>i+1?'#6fcf97':t.textMuted}}>
              {adim>i+1?'✓':i+1}
            </div>
            <span style={{fontSize:12,color:adim===i+1?t.text:t.textMuted}}>{l}</span>
            {i<3&&<div style={{width:20,height:1,background:t.border,marginLeft:4}}/>}
          </div>
        ))}
      </div>

      {/* ADIM 1 — Satış Bul */}
      {adim===1&&(
        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20,marginBottom:16}}>
          <div style={{display:'flex',gap:8,marginBottom:14}}>
            {[['fis','🧾 Fiş No'],['urun','📦 Ürün Adı']].map(([k,l])=>(
              <button key={k} onClick={()=>setAramaTip(k)} style={{padding:'7px 16px',borderRadius:20,fontSize:12,
                background:aramaTip===k?t.accentBg:t.input,border:`1px solid ${aramaTip===k?t.accent+'55':t.border}`,
                color:aramaTip===k?t.accent:t.textMuted}}>{l}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:10}}>
            <input value={aramaQ} onChange={e=>setAramaQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ara()}
              placeholder={aramaTip==='fis'?'F-0001':'Ürün adı...'}
              style={{flex:1,padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
            <button onClick={ara} disabled={yukleniyor} style={{padding:'10px 24px',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>
              {yukleniyor?'...':'🔍 Ara'}
            </button>
          </div>

          {sonuclar.length>0&&(
            <div style={{marginTop:14,border:`1px solid ${t.border}`,borderRadius:10,overflow:'hidden'}}>
              {sonuclar.map(s=>(
                <div key={s.id} onClick={()=>satisSec(s)} style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'12px 16px',cursor:'pointer',borderBottom:`1px solid ${t.border}`,
                  background:'transparent'}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:t.accent,fontFamily:'monospace'}}>{s.fisNo}</div>
                    <div style={{fontSize:11,color:t.textMuted}}>{tarihFormat(s.tarih)} · {s.kalemler?.length||0} ürün</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:14,fontWeight:700,color:t.accent}}>{para(s.genelToplam)}</span>
                    <span style={{fontSize:12,color:t.accent}}>Seç →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADIM 2 — İade Seç */}
      {adim===2&&secilenSatis&&(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:18}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div>
                <div style={{fontSize:15,fontWeight:600,color:t.text}}>Fiş: {secilenSatis.fisNo}</div>
                <div style={{fontSize:12,color:t.textMuted}}>{tarihFormat(secilenSatis.tarih)}</div>
                {(secilenSatis.odemeler||[]).length>0&&(
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>
                    <span style={{fontSize:10,color:t.textMuted,alignSelf:'center'}}>Orijinal ödeme:</span>
                    {secilenSatis.odemeler.map((o,i)=>(
                      <span key={i} style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                        background:o.tip==='nakit'?'rgba(111,207,151,.12)':'rgba(86,204,242,.12)',
                        color:o.tip==='nakit'?'#6fcf97':'#56ccf2',fontWeight:600}}>
                        {o.tip==='nakit'?'💵 Nakit':o.tip==='taksit'?`💳 ${o.taksitSayisi}T`:'💳 Kart'} ₺{Number(o.tutar).toLocaleString('tr-TR')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={()=>{setAdim(1);setSecilenSatis(null)}} style={{padding:'6px 12px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>← Geri</button>
            </div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>Değiştirilecek Ürünler</div>
            {iadeKalemler.map((k,i)=>(
              <div key={i} onClick={()=>kalemToggle(i)} style={{
                display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                borderRadius:10,cursor:'pointer',marginBottom:6,
                background:k.secili?t.accentBg:t.hover,border:`1px solid ${k.secili?t.accent+'44':t.border}`}}>
                <div style={{width:20,height:20,borderRadius:6,flexShrink:0,
                  background:k.secili?t.accent:t.input,border:`1px solid ${t.border}`,
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {k.secili&&<span style={{fontSize:11,color:'#111',fontWeight:700}}>✓</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:t.text,fontWeight:500}}>{k.urunAd}</div>
                  <div style={{fontSize:11,color:t.textMuted}}>{k.renk}{k.beden?` / ${k.beden}`:''} · {k.adet} adet · {para(k.birimFiyat)}</div>
                </div>
                {k.secili&&(
                  <div onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:11,color:t.textMuted}}>Adet:</span>
                    <input type="number" value={k.iadeAdet} min={1} max={k.adet}
                      onChange={e=>iadeAdetGuncelle(i,e.target.value)}
                      style={{width:55,padding:'4px 8px',borderRadius:6,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,textAlign:'center',outline:'none'}}/>
                    <span style={{fontSize:11,color:t.textMuted}}>@</span>
                    <input type="number" value={k.birimFiyat} min={0} step="0.01"
                      onChange={e=>iadeFiyatGuncelle(i,e.target.value)}
                      style={{width:75,padding:'4px 8px',borderRadius:6,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,textAlign:'center',outline:'none'}}/>
                    <span style={{fontSize:12,fontWeight:600,color:t.accent}}>{para(iadeSatirTutar(k))}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {seciliIadeler.length>0&&(
            <button onClick={()=>setAdim(3)} style={{padding:'12px 0',borderRadius:12,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:14,fontWeight:700}}>
              Devam → Yeni Ürün Seç ({seciliIadeler.length} ürün · {para(iadeToplam)})
            </button>
          )}
        </div>
      )}

      {/* ADIM 3 — Yeni Ürün */}
      {adim===3&&(
        <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,alignItems:'start'}}>
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>Yeni Ürün Seç</div>
              <button onClick={()=>setAdim(2)} style={{padding:'7px 14px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>← Geri</button>
            </div>
            <input value={urunArama} onChange={e=>setUrunArama(e.target.value)} placeholder="🔍 Ürün adı veya barkod..."
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none',marginBottom:14}}/>
            <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:400,overflowY:'auto'}}>
              {filtreliUrunler.slice(0,20).map(u=>{
                const varyantlar = (u.varyantlar||[]).filter(v=>v.magazaId===magazaId||!magazaId)
                if(varyantlar.length===0) return null
                return (
                  <div key={u.id} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:t.text}}>{u.ad}</div>
                        <div style={{fontSize:11,color:t.textMuted}}>{u.marka} · {para(u.satisF)}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {varyantlar.filter(v=>v.adet>0).map((v,i)=>(
                        <button key={i} onClick={()=>yeniUrunEkle(u,v)} style={{
                          padding:'5px 10px',borderRadius:8,fontSize:11,
                          background:t.input,border:`1px solid ${t.border}`,color:t.text}}>
                          {v.renk||v.beden ? `${v.renk||''}${v.beden?'/'+v.beden:''}` : 'Tekil'} ({v.adet})
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sağ panel — özet */}
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:18,position:'sticky',top:20}}>
            <div style={{fontSize:12,color:t.textMuted,marginBottom:12,textTransform:'uppercase',letterSpacing:.5}}>Değişim Özeti</div>

            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:'#f2c94c',marginBottom:6}}>İade Edilecek</div>
              {seciliIadeler.map((k,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:t.textMuted,marginBottom:3}}>
                  <span>{k.urunAd} ×{k.iadeAdet}</span>
                  <span style={{color:'#f2c94c'}}>-{para(iadeSatirTutar(k))}</span>
                </div>
              ))}
            </div>

            {yeniKalemler.length>0&&(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:'#6fcf97',marginBottom:6}}>Verilecek</div>
                {yeniKalemler.map((k,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:t.textMuted,marginBottom:3,gap:6}}>
                    <span style={{whiteSpace:'nowrap'}}>{k.urunAd} ×
                      <input type="number" value={k.adet} min={1} onChange={e=>yeniAdetGuncelle(i,e.target.value)}
                        style={{width:36,padding:'1px 4px',borderRadius:4,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:11,textAlign:'center',outline:'none',marginLeft:4}}/>
                    </span>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{fontSize:10,color:t.textMuted}}>@</span>
                      <input type="number" value={k.birimFiyat} min={0} step="0.01" onChange={e=>yeniFiyatGuncelle(i,e.target.value)}
                        style={{width:60,padding:'1px 4px',borderRadius:4,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:11,textAlign:'center',outline:'none'}}/>
                      <span style={{color:'#6fcf97'}}>{para(k.toplam)}</span>
                      <button onClick={()=>yeniKalemSil(i)} style={{color:'#eb5757',fontSize:12,padding:'0 4px'}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{borderTop:`1px solid ${t.border}`,paddingTop:12,marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                <span style={{color:t.textMuted}}>İade</span>
                <span style={{color:'#f2c94c'}}>{para(iadeToplam)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:8}}>
                <span style={{color:t.textMuted}}>Yeni Ürün</span>
                <span style={{color:'#6fcf97'}}>{para(yeniToplam)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'10px 12px',borderRadius:10,
                background:fark===0?t.hover:farkPozitif?'rgba(235,87,87,.08)':'rgba(111,207,151,.08)',
                border:`1px solid ${fark===0?t.border:farkPozitif?'rgba(235,87,87,.2)':'rgba(111,207,151,.2)'}`}}>
                <span style={{fontSize:13,color:t.textMuted}}>{fark===0?'Fark Yok':farkPozitif?'Müşteri Öder':'Müşteriye İade'}</span>
                <span style={{fontSize:16,fontWeight:700,color:fark===0?t.textMuted:farkPozitif?'#eb5757':'#6fcf97'}}>
                  {fark!==0&&(farkPozitif?'+':'-')}{para(Math.abs(fark))}
                </span>
              </div>
            </div>

            {farkPozitif&&(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase'}}>Ödeme Tipi</div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {ODEME_TIPLERI.filter(o=>o.id!=='taksit').map(o=>(
                    <button key={o.id} onClick={()=>setFarkOdeme(o.id)} style={{
                      padding:'7px 12px',borderRadius:8,textAlign:'left',fontSize:12,
                      background:farkOdeme===o.id?`${o.renk}18`:t.input,
                      border:`1px solid ${farkOdeme===o.id?o.renk+'55':t.border}`,
                      color:farkOdeme===o.id?o.renk:t.textMuted}}>
                      {o.ikon} {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={()=>setAdim(4)} disabled={yeniKalemler.length===0} style={{
              width:'100%',padding:'12px 0',borderRadius:12,fontSize:13,fontWeight:700,
              background:yeniKalemler.length>0?t.accentBg:t.input,
              border:`1px solid ${yeniKalemler.length>0?t.accent+'55':t.border}`,
              color:yeniKalemler.length>0?t.accent:t.textMuted}}>
              Devam → Onay
            </button>
          </div>
        </div>
      )}

      {/* ADIM 4 — Onay */}
      {adim===4&&(
        <div style={{maxWidth:500}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:t.text}}>Değişim Onayı</div>
            <button onClick={()=>setAdim(3)} style={{padding:'7px 14px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>← Geri</button>
          </div>

          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20,marginBottom:16}}>
            <div style={{fontSize:12,color:'#f2c94c',marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>İade Edilecek</div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:8}}>Tutarlar bu ekranda da değiştirilebilir — fark anında güncellenir.</div>
            {/* İade satırlarında ORİJİNAL index (i) kullanılmalı: seciliIadeler filtrelenmiş
                bir dizi, onun index'i iadeKalemler'deki satıra denk gelmiyor. */}
            {iadeKalemler.map((k,i)=>!k.secili?null:(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${t.border}`,fontSize:13}}>
                <span style={{color:t.text,flex:1,minWidth:0}}>{k.urunAd} · {k.renk}/{k.beden} · ×{k.iadeAdet}</span>
                <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                  <span style={{color:'#f2c94c',fontWeight:600}}>-₺</span>
                  <input type="number" value={iadeSatirTutar(k)} min={0} step="0.01"
                    onChange={e=>iadeSatirTutarGuncelle(i,e.target.value)}
                    style={{width:90,padding:'5px 8px',borderRadius:6,background:t.input,border:`1px solid ${t.border}`,color:'#f2c94c',fontSize:13,fontWeight:600,textAlign:'right',outline:'none'}}/>
                </div>
              </div>
            ))}

            <div style={{fontSize:12,color:'#6fcf97',margin:'14px 0 10px',textTransform:'uppercase',letterSpacing:.5}}>Verilecek</div>
            {yeniKalemler.map((k,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${t.border}`,fontSize:13}}>
                <span style={{color:t.text,flex:1,minWidth:0}}>{k.urunAd} · {k.renk}/{k.beden} · ×{k.adet}</span>
                <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                  <span style={{color:'#6fcf97',fontWeight:600}}>₺</span>
                  <input type="number" value={k.toplam} min={0} step="0.01"
                    onChange={e=>yeniSatirTutarGuncelle(i,e.target.value)}
                    style={{width:90,padding:'5px 8px',borderRadius:6,background:t.input,border:`1px solid ${t.border}`,color:'#6fcf97',fontSize:13,fontWeight:600,textAlign:'right',outline:'none'}}/>
                </div>
              </div>
            ))}

            <div style={{display:'flex',justifyContent:'space-between',marginTop:14,padding:'12px 0'}}>
              <span style={{fontSize:15,color:t.textMuted}}>Fark</span>
              <span style={{fontSize:20,fontWeight:700,color:fark===0?t.textMuted:farkPozitif?'#eb5757':'#6fcf97'}}>
                {fark===0?'Fark Yok':(farkPozitif?'Müşteri Öder ':'Müşteriye İade ')+para(Math.abs(fark))}
              </span>
            </div>
            {farkPozitif&&<div style={{fontSize:12,color:t.textMuted}}>Ödeme: {ODEME_TIPLERI.find(o=>o.id===farkOdeme)?.label}</div>}
          </div>

          <button onClick={kaydet} disabled={kaydediliyor} style={{
            width:'100%',padding:'14px 0',borderRadius:14,fontSize:15,fontWeight:700,
            background:'rgba(111,207,151,.15)',border:'1px solid rgba(111,207,151,.4)',color:'#6fcf97'}}>
            {kaydediliyor?'İşleniyor...':'✓ Değişimi Tamamla'}
          </button>
        </div>
      )}
    </div>
  )
}