import { useState } from 'react'
import { satislariGetir, degisimOlustur, urunleriGetir } from '../api'
import { para, ODEME_TIPLERI, FIS_CSS } from './utils'
import QzFisPaneli from './QzFisPaneli'
import { usePrint } from '../print/usePrint'
import { Page, PageHeader, Card, Button, IconButton, Field, Input, SearchInput, Segmented, Badge, Banner, EmptyState, toast } from '../ui'
import { Search, ArrowLeft, ArrowRight, Plus, X, Check, CircleCheck } from 'lucide-react'

const tarihFormat = iso => new Date(iso).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})

const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// İade satırının tutarı. 4. adımda tutar elle değiştirilebildiği için adet×birimFiyat
// her zaman doğru sonucu vermiyor (kullanıcının yazdığı tutar esas alınıyor); elle
// girilmemişse adet×birimFiyat'a düşüyor.
const iadeSatirTutar = k => Number(k?.iadeSatirToplam ?? (Number(k?.iadeAdet || 0) * Number(k?.birimFiyat || 0)))

export default function DegisimEkrani({ magazaId, magazaAd }) {
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
    } catch(e) { toast.error('Arama yapılamadı: ' + e.message) }
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
    if (seciliIadeler.length === 0) return toast.warning('En az bir iade kalemi seçin.')
    if (yeniKalemler.length === 0)  return toast.warning('En az bir yeni ürün ekleyin.')
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
      toast.success(`${degisimNo} numaralı değişim tamamlandı.`)
    } catch(e) { toast.error('Değişim kaydedilemedi: '+e.message) }
    finally { setKaydediliyor(false) }
  }

  const filtreliUrunler = urunler.filter(u=>
    !urunArama || u.ad?.toLowerCase().includes(urunArama.toLowerCase()) || u.barkod?.includes(urunArama)
  )

  // Tarayıcının yazdırma penceresinden değişim fişi — QZ Tray yoksa yedek yol
  const tarayicidanYazdir = () => {
    const b = basarili
    if (!b) return
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
  }

  const FARK_TIPLERI = ODEME_TIPLERI.filter(o=>!['taksit','veresiye'].includes(o.id))
  const ADIMLAR = ['Satış bul','İade seç','Yeni ürün','Onay']
  const farkMetni = fark===0 ? 'Fark yok' : farkPozitif ? 'Müşteri öder' : 'Müşteriye iade'

  return (
    <Page>
      <PageHeader title="Ürün değişimi" subtitle="Müşterinin aldığı ürünü başka bir ürünle değiştirin." />

      {basarili && (
        <Card bodyClassName="vg-stack">
          <Banner tone="success" icon={CircleCheck} title="Değişim tamamlandı.">
            Değişim no <strong className="vg-code">{basarili.degisimNo}</strong>
            {basarili.fark !== 0 && <> · {basarili.fark>0?'müşteri ödedi':'müşteriye iade'} <strong className="vg-num">{para(Math.abs(basarili.fark))}</strong></>}
          </Banner>
          {/* Termal fiş yazıcısına doğrudan ESC/POS; tarayıcıdan yazdırma yedek yol */}
          <QzFisPaneli yazdir={print.degisimFisiYazdir} veri={basarili} etiket="QZ ile fiş bas" tarayicidanYazdir={tarayicidanYazdir} />
          <div><Button variant="primary" icon={Plus} onClick={()=>setBasarili(null)}>Yeni değişim</Button></div>
        </Card>
      )}

      {/* Adım göstergesi */}
      <ol className="vg-steps" aria-label="Değişim adımları">
        {ADIMLAR.map((l,i)=>{
          const durum = adim===i+1 ? 'current' : adim>i+1 ? 'done' : 'todo'
          return (
            <li key={l} className={`vg-step is-${durum}`} aria-current={durum==='current' ? 'step' : undefined}>
              <span className="vg-step__dot">{durum==='done' ? <Check className="vg-icon" style={{ width: 12, height: 12 }} /> : i+1}</span>
              <span className="vg-step__label">{l}</span>
            </li>
          )
        })}
      </ol>

      {/* ADIM 1 — Satış bul */}
      {adim===1&&(
        <Card bodyClassName="vg-stack">
          <Segmented label="Arama tipi" value={aramaTip} onChange={setAramaTip} options={[{ value:'fis', label:'Fiş no' }, { value:'urun', label:'Ürün adı veya barkod' }]} />
          <div className="vg-row" style={{ flexWrap: 'nowrap' }}>
            <div className="vg-input-group" style={{ flex: 1 }}>
              <Search className="vg-icon" />
              <Input value={aramaQ} onChange={e=>setAramaQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ara()} mono={aramaTip==='fis'}
                placeholder={aramaTip==='fis'?'F-0001':'Ürün adı veya barkod'} aria-label="Değişim için satış ara" style={{ paddingLeft: 32 }} />
            </div>
            <Button variant="primary" icon={Search} onClick={ara} loading={yukleniyor}>Ara</Button>
          </div>

          {sonuclar.length>0&&(
            <ul className="vg-list vg-tile" style={{ padding: 0 }}>
              {sonuclar.map(s=>(
                <li key={s.id}>
                  <button type="button" className="vg-list__item vg-list__item--button" onClick={()=>satisSec(s)}>
                    <div className="vg-list__main">
                      <div className="vg-list__primary vg-code">{s.fisNo}</div>
                      <div className="vg-list__secondary">{tarihFormat(s.tarih)} · {s.kalemler?.length||0} ürün</div>
                    </div>
                    <div className="vg-list__value">{para(s.genelToplam)}</div>
                    <ArrowRight className="vg-icon" style={{ color: 'var(--ink-muted)' }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ADIM 2 — İade seç */}
      {adim===2&&secilenSatis&&(
        <>
          <Card title={<>Fiş <span className="vg-code">{secilenSatis.fisNo}</span></>} subtitle={tarihFormat(secilenSatis.tarih)}
            action={<Button size="sm" variant="plain" icon={ArrowLeft} onClick={()=>{setAdim(1);setSecilenSatis(null)}}>Geri</Button>} bodyClassName="vg-stack">
            {(secilenSatis.odemeler||[]).length>0&&(
              <div className="vg-row" style={{ gap: 6 }}>
                <span className="vg-help">Orijinal ödeme</span>
                {secilenSatis.odemeler.map((o,i)=>(
                  <Badge key={i} tone={o.tip==='nakit'?'success':'info'}>{o.tip==='nakit'?'Nakit':o.tip==='taksit'?`${o.taksitSayisi} taksit`:'Kart'} · {para(o.tutar)}</Badge>
                ))}
              </div>
            )}
            <div className="vg-section-label">Değiştirilecek ürünler</div>
            <div className="vg-stack" style={{ gap: 6 }}>
              {iadeKalemler.map((k,i)=>(
                <div key={i} className="vg-tile vg-row" style={{ flexWrap: 'wrap', gap: 12, boxShadow: k.secili ? 'inset 0 0 0 2px var(--accent)' : undefined, background: k.secili ? 'var(--accent-soft)' : undefined }}>
                  <label className="vg-check" style={{ flex: 1, minWidth: 220 }}>
                    <input type="checkbox" checked={!!k.secili} onChange={()=>kalemToggle(i)} />
                    <span>
                      <span style={{ fontWeight: 500 }}>{k.urunAd}</span>
                      <span className="vg-list__secondary" style={{ display: 'block' }}>{k.renk}{k.beden?` / ${k.beden}`:''} · {k.adet} adet · {para(k.birimFiyat)}</span>
                    </span>
                  </label>
                  {k.secili&&(
                    <div className="vg-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <Input size="sm" type="number" value={k.iadeAdet} min={1} max={k.adet} className="vg-num" aria-label="Adet" onChange={e=>iadeAdetGuncelle(i,e.target.value)} style={{ width: 60, textAlign: 'center' }} />
                      <span className="vg-muted" style={{ fontSize: 12 }}>×</span>
                      <Input size="sm" type="number" value={k.birimFiyat} min={0} step="0.01" className="vg-num" aria-label="Birim fiyat" onChange={e=>iadeFiyatGuncelle(i,e.target.value)} style={{ width: 92, textAlign: 'right' }} />
                      <strong className="vg-num" style={{ minWidth: 90, textAlign: 'right' }}>{para(iadeSatirTutar(k))}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
          {seciliIadeler.length>0&&(
            <div className="vg-row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={()=>setAdim(3)}>Yeni ürün seç · {seciliIadeler.length} ürün, {para(iadeToplam)}</Button>
            </div>
          )}
        </>
      )}

      {/* ADIM 3 — Yeni ürün */}
      {adim===3&&(
        <div className="vg-master-detail" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
          <Card title="Yeni ürün seçin" action={<Button size="sm" variant="plain" icon={ArrowLeft} onClick={()=>setAdim(2)}>Geri</Button>} bodyClassName="vg-stack">
            <SearchInput value={urunArama} onChange={e=>setUrunArama(e.target.value)} placeholder="Ürün adı veya barkod" aria-label="Yeni ürün ara" />
            <div className="vg-stack" style={{ gap: 6, maxHeight: 460, overflowY: 'auto' }}>
              {filtreliUrunler.slice(0,20).map(u=>{
                const varyantlar = (u.varyantlar||[]).filter(v=>v.magazaId===magazaId||!magazaId)
                if(varyantlar.length===0) return null
                return (
                  <div key={u.id} className="vg-tile">
                    <div className="vg-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginBottom: 8 }}>
                      <div><div style={{ fontWeight: 600 }}>{u.ad}</div><div className="vg-list__secondary">{u.marka}</div></div>
                      <span className="vg-num" style={{ fontWeight: 600 }}>{para(u.satisF)}</span>
                    </div>
                    <div className="vg-row" style={{ gap: 6 }}>
                      {varyantlar.filter(v=>v.adet>0).map((v,i)=>(
                        <button key={i} type="button" className="vg-chip" onClick={()=>yeniUrunEkle(u,v)}>
                          <Plus className="vg-icon" style={{ width: 14, height: 14 }} />
                          {v.renk||v.beden ? `${v.renk||''}${v.beden?'/'+v.beden:''}` : 'Tekil'}
                          <span className="vg-muted">({v.adet})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              {filtreliUrunler.length === 0 && <EmptyState compact title="Ürün bulunamadı" />}
            </div>
          </Card>

          <Card title="Değişim özeti" className="vg-sticky" bodyClassName="vg-stack">
            <div>
              <div className="vg-section-label" style={{ marginBottom: 4 }}>İade edilecek</div>
              {seciliIadeler.map((k,i)=>(
                <div key={i} className="vg-kv" style={{ fontSize: 12 }}><span>{k.urunAd} ×{k.iadeAdet}</span><span>−{para(iadeSatirTutar(k))}</span></div>
              ))}
            </div>

            {yeniKalemler.length>0&&(
              <div>
                <div className="vg-section-label" style={{ marginBottom: 4 }}>Verilecek</div>
                <div className="vg-stack" style={{ gap: 6 }}>
                  {yeniKalemler.map((k,i)=>(
                    <div key={i} className="vg-stack" style={{ gap: 4 }}>
                      <div className="vg-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', fontSize: 12 }}>
                        <span className="vg-truncate">{k.urunAd}</span>
                        <IconButton icon={X} label="Kaldır" size="sm" variant="critical-plain" onClick={()=>yeniKalemSil(i)} />
                      </div>
                      <div className="vg-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        <Input size="sm" type="number" value={k.adet} min={1} className="vg-num" aria-label="Adet" onChange={e=>yeniAdetGuncelle(i,e.target.value)} style={{ width: 52, textAlign: 'center' }} />
                        <span className="vg-muted" style={{ fontSize: 12 }}>×</span>
                        <Input size="sm" type="number" value={k.birimFiyat} min={0} step="0.01" className="vg-num" aria-label="Birim fiyat" onChange={e=>yeniFiyatGuncelle(i,e.target.value)} style={{ width: 84, textAlign: 'right' }} />
                        <strong className="vg-num" style={{ marginLeft: 'auto' }}>{para(k.toplam)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="vg-kv"><span>İade</span><span>{para(iadeToplam)}</span></div>
              <div className="vg-kv"><span>Yeni ürün</span><span>{para(yeniToplam)}</span></div>
              <div className="vg-kv vg-kv--total"><span>{farkMetni}</span><span className={fark===0?'':farkPozitif?'vg-text-warning':'vg-text-success'}>{fark!==0&&(farkPozitif?'+':'−')}{para(Math.abs(fark))}</span></div>
            </div>

            {farkPozitif&&(
              <Field label="Fark ödemesi">
                <div className="vg-stack" style={{ gap: 4 }}>
                  {FARK_TIPLERI.map(o=>(
                    <label key={o.id} className="vg-check"><input type="radio" name="fark-odeme" checked={farkOdeme===o.id} onChange={()=>setFarkOdeme(o.id)} /><o.ikon className="vg-icon" style={{ width: 14, height: 14, color: 'var(--ink-muted)' }} />{o.label}</label>
                  ))}
                </div>
              </Field>
            )}

            <Button variant="primary" block iconRight={ArrowRight} onClick={()=>setAdim(4)} disabled={yeniKalemler.length===0}>Onaya geç</Button>
          </Card>
        </div>
      )}

      {/* ADIM 4 — Onay */}
      {adim===4&&(
        <Card title="Değişim onayı" subtitle="Tutarlar bu ekranda da değiştirilebilir; fark anında güncellenir."
          action={<Button size="sm" variant="plain" icon={ArrowLeft} onClick={()=>setAdim(3)}>Geri</Button>} style={{ maxWidth: 560 }} bodyClassName="vg-stack">
          <div>
            <div className="vg-section-label" style={{ marginBottom: 4 }}>İade edilecek</div>
            {/* İade satırlarında ORİJİNAL index (i) kullanılmalı: seciliIadeler filtrelenmiş
                bir dizi, onun index'i iadeKalemler'deki satıra denk gelmiyor. */}
            {iadeKalemler.map((k,i)=>!k.secili?null:(
              <div key={i} className="vg-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                <span className="vg-truncate">{k.urunAd} · {[k.renk,k.beden].filter(Boolean).join('/')} · ×{k.iadeAdet}</span>
                <div className="vg-input-group" style={{ flexShrink: 0 }}>
                  <Input size="sm" type="number" value={iadeSatirTutar(k)} min={0} step="0.01" className="vg-num" aria-label="İade satır tutarı"
                    onChange={e=>iadeSatirTutarGuncelle(i,e.target.value)} style={{ width: 110, textAlign: 'right', paddingRight: 22 }} />
                  <span className="vg-input-suffix" style={{ right: 8 }}>₺</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="vg-section-label" style={{ marginBottom: 4 }}>Verilecek</div>
            {yeniKalemler.map((k,i)=>(
              <div key={i} className="vg-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                <span className="vg-truncate">{k.urunAd} · {[k.renk,k.beden].filter(Boolean).join('/')} · ×{k.adet}</span>
                <div className="vg-input-group" style={{ flexShrink: 0 }}>
                  <Input size="sm" type="number" value={k.toplam} min={0} step="0.01" className="vg-num" aria-label="Yeni ürün satır tutarı"
                    onChange={e=>yeniSatirTutarGuncelle(i,e.target.value)} style={{ width: 110, textAlign: 'right', paddingRight: 22 }} />
                  <span className="vg-input-suffix" style={{ right: 8 }}>₺</span>
                </div>
              </div>
            ))}
          </div>
          <div className="vg-kv vg-kv--total"><span>{farkMetni}</span><span style={{ fontSize: 20 }}>{para(Math.abs(fark))}</span></div>
          {farkPozitif&&<div className="vg-help">Ödeme: {ODEME_TIPLERI.find(o=>o.id===farkOdeme)?.label}</div>}
          <Button variant="primary" size="lg" block icon={Check} onClick={kaydet} loading={kaydediliyor}>{kaydediliyor?'İşleniyor…':'Değişimi tamamla'}</Button>
        </Card>
      )}
    </Page>
  )
}
