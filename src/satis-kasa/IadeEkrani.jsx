import { useState } from 'react'
import { satislariGetir, iadeOlustur } from '../api'
import { para, tarihFormat, ODEME_TIPLERI, FIS_CSS } from './utils'
import QzFisPaneli from './QzFisPaneli'
import { usePrint } from '../print/usePrint'
import { Page, PageHeader, Card, Button, Field, Input, Textarea, Segmented, Badge, Banner, EmptyState, LoadingRows, toast } from '../ui'
import { Search, ArrowLeft, Undo2, Plus, CircleCheck } from 'lucide-react'

const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export default function IadeEkrani({ magazaAd }) {
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
  const [arandi, setArandi]         = useState(false)
  const print = usePrint()

  const NEDENLER = [
    { id:'musteri_istegi', label:'Müşteri isteği' },
    { id:'urun_hatali',    label:'Ürün hatalı/bozuk' },
    { id:'beden_uyumsuz', label:'Beden/numara uyumsuz' },
    { id:'diger',          label:'Diğer' },
  ]

  const ara = async () => {
    if (!aramaQ.trim()) return
    setYukleniyor(true)
    setSonuclar([])
    setSecilenSatis(null)
    setArandi(true)
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
      toast.error('Arama yapılamadı: ' + e.message)
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
    if (seciliKalemler.length === 0) return toast.warning('En az bir ürün seçin.')
    if (!iadeTip) return toast.warning('İade ödeme tipini seçin.')

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
      setArandi(false)
      toast.success(`${iadeNo} numaralı iade oluşturuldu.`)
    } catch(e) {
      toast.error('İade oluşturulamadı: ' + e.message)
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

  const IADE_TIPLERI = ODEME_TIPLERI.filter(o=>!['taksit','veresiye'].includes(o.id))
  const odemeEtiketi = o => o.tip==='nakit'?'Nakit':o.tip==='kart'?'Kart':o.tip==='taksit'?`${o.taksitSayisi||2} taksit`:o.tip==='veresiye'?'Veresiye':'Havale'

  return (
    <Page style={{ maxWidth: 960 }}>
      <PageHeader title="İade al" subtitle="Satışı fiş numarası ya da ürün adıyla bulun." />

      {basarili && (
        <Card>
          <div className="vg-stack">
            <Banner tone="success" icon={CircleCheck} title="İade oluşturuldu.">
              İade no <strong className="vg-code">{basarili.iadeNo}</strong> · tutar <strong className="vg-num">{para(basarili.tutar)}</strong>. Yönetici onayı bekleniyor.
            </Banner>
            {/* Termal fiş yazıcısına doğrudan ESC/POS; QZ Tray bağlı değilse
                paneldeki "Tarayıcıdan" butonu yedek yol olarak duruyor. */}
            <QzFisPaneli yazdir={print.iadeFisiYazdir} veri={basarili} etiket="QZ ile fiş bas" tarayicidanYazdir={tarayicidanYazdir} />
            <div><Button variant="primary" icon={Plus} onClick={()=>setBasarili(null)}>Yeni iade</Button></div>
          </div>
        </Card>
      )}

      {!basarili && (
        <>
          {!secilenSatis && (
            <div className="vg-card vg-pad vg-stack" style={{ gap: 10 }}>
              <Segmented label="Arama tipi" value={aramaTip} onChange={setAramaTip} options={[{ value:'fis', label:'Fiş no' }, { value:'urun', label:'Ürün adı' }]} />
              <div className="vg-row" style={{ flexWrap: 'nowrap' }}>
                <div className="vg-input-group" style={{ flex: 1 }}>
                  <Search className="vg-icon" />
                  <Input value={aramaQ} onChange={e=>setAramaQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ara()} mono={aramaTip==='fis'}
                    placeholder={aramaTip==='fis'?'F-0001':'Ürün adı'} aria-label="İade için satış ara" style={{ paddingLeft: 32 }} />
                </div>
                <Button variant="primary" icon={Search} onClick={ara} loading={yukleniyor}>{yukleniyor?'Aranıyor…':'Ara'}</Button>
              </div>
            </div>
          )}

          {yukleniyor && <LoadingRows rows={4} />}

          {sonuclar.length > 0 && !secilenSatis && (
            <div className="vg-table-wrap">
              <div className="vg-table-toolbar"><span className="vg-muted" style={{ fontSize: 13 }}>{sonuclar.length} satış bulundu</span></div>
              <div className="vg-table-scroll">
                <table className="vg-table" style={{ minWidth: 640 }}>
                  <thead><tr><th>Fiş no</th><th>Tarih</th><th>Mağaza</th><th>Müşteri</th><th className="is-num">Toplam</th><th></th></tr></thead>
                  <tbody>
                    {sonuclar.map(s=>(
                      <tr key={s.id} className="is-clickable" onClick={()=>satisSec(s)}>
                        <td className="vg-code is-strong">{s.fisNo}</td>
                        <td className="vg-nowrap vg-muted">{tarihFormat(s.tarih)}</td>
                        <td>{s.magaza?.ad||s.magaza||'—'}</td>
                        <td>{s.musteri?.ad||s.musteriAd||'—'}</td>
                        <td className="is-num is-strong">{para(s.genelToplam)}</td>
                        <td><Button size="sm" onClick={e=>{e.stopPropagation();satisSec(s)}}>Seç</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sonuclar.length === 0 && arandi && aramaQ && !yukleniyor && !secilenSatis && (
            <div className="vg-card"><EmptyState title={`"${aramaQ}" ile eşleşen satış yok`} text="Fiş numarasını kontrol edin ya da ürün adıyla arayın." /></div>
          )}

          {secilenSatis && (
            <>
              <Card title={<>Fiş <span className="vg-code">{secilenSatis.fisNo}</span></>} subtitle={`${tarihFormat(secilenSatis.tarih)} · ${secilenSatis.magaza?.ad||secilenSatis.magaza||'—'}`}
                action={<Button size="sm" variant="plain" icon={ArrowLeft} onClick={()=>setSecilenSatis(null)}>Geri</Button>} bodyClassName="vg-stack">
                {(secilenSatis.odemeler||[]).length>0&&(
                  <div className="vg-row" style={{ gap: 6 }}>
                    <span className="vg-help">Orijinal ödeme</span>
                    {secilenSatis.odemeler.map((o,i)=>(
                      <Badge key={i} tone={o.tip==='nakit'?'success':o.tip==='kart'||o.tip==='taksit'?'info':'violet'}>{odemeEtiketi(o)} · {para(o.tutar)}</Badge>
                    ))}
                  </div>
                )}

                <div>
                  <div className="vg-section-label" style={{ marginBottom: 6 }}>İade edilecek ürünler</div>
                  <div className="vg-stack" style={{ gap: 6 }}>
                    {iadeKalemleri.map((k,i)=>(
                      <div key={i} className="vg-tile vg-row" style={{ flexWrap: 'wrap', gap: 12, boxShadow: k.secili ? 'inset 0 0 0 2px var(--accent)' : undefined, background: k.secili ? 'var(--accent-soft)' : undefined, opacity: k.tamIadeEdildi ? .6 : 1 }}>
                        <label className="vg-check" style={{ flex: 1, minWidth: 220, cursor: k.tamIadeEdildi ? 'not-allowed' : 'pointer' }}>
                          <input type="checkbox" checked={!!k.secili} disabled={k.tamIadeEdildi} onChange={()=>!k.tamIadeEdildi&&kalemGuncelle(i,'secili',!k.secili)} />
                          <span>
                            <span style={{ fontWeight: 500 }}>{k.urunAd}</span>
                            <span className="vg-list__secondary" style={{ display: 'block' }}>{k.renk}{k.beden?` / ${k.beden}`:''} · {k.adet} adet · {para(k.birimFiyat)}{k.barkod && <span className="vg-code"> · {k.barkod}</span>}</span>
                            {k.tamIadeEdildi && <Badge tone="critical" size="sm">Daha önce iade edildi</Badge>}
                          </span>
                        </label>
                        {k.secili && (
                          <div className="vg-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                            <Input size="sm" type="number" min={1} max={k.adet} className="vg-num" value={k.iadeAdet||1} aria-label="İade adedi"
                              onChange={e=>kalemGuncelle(i,'iadeAdet',Math.min(k.adet,Math.max(1,parseInt(e.target.value)||1)))} style={{ width: 60, textAlign: 'center' }} />
                            <span className="vg-muted" style={{ fontSize: 12 }}>/ {k.adet} ×</span>
                            <Input size="sm" type="number" min={0} step="0.01" className="vg-num" value={k.birimFiyat} aria-label="Birim fiyat"
                              onChange={e=>kalemGuncelle(i,'birimFiyat',Math.max(0,parseFloat(e.target.value)||0))} style={{ width: 92, textAlign: 'right' }} />
                            <strong className="vg-num" style={{ minWidth: 90, textAlign: 'right' }}>{para((k.iadeAdet||1)*Number(k.birimFiyat))}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {iadeKalemleri.some(k=>k.secili) && (
                <Card title="İade detayları" bodyClassName="vg-stack">
                  <div className="vg-grid-2">
                    <Field label="İade nedeni">
                      <div className="vg-stack" style={{ gap: 4 }}>
                        {NEDENLER.map(n=>(
                          <label key={n.id} className="vg-check"><input type="radio" name="iade-neden" checked={neden===n.id} onChange={()=>setNeden(n.id)} />{n.label}</label>
                        ))}
                      </div>
                    </Field>
                    <Field label="İade ödeme tipi">
                      <div className="vg-stack" style={{ gap: 4 }}>
                        {IADE_TIPLERI.map(o=>(
                          <label key={o.id} className="vg-check"><input type="radio" name="iade-tip" checked={iadeTip===o.id} onChange={()=>setIadeTip(o.id)} /><o.ikon className="vg-icon" style={{ width: 14, height: 14, color: 'var(--ink-muted)' }} />{o.label}</label>
                        ))}
                      </div>
                    </Field>
                  </div>
                  <Field label="Not" help="İsteğe bağlı" htmlFor="iade-not"><Textarea id="iade-not" value={notlar} onChange={e=>setNotlar(e.target.value)} rows={2} /></Field>
                  <div className="vg-kv vg-kv--total"><span>İade tutarı</span><span style={{ fontSize: 20 }}>{para(toplamIade)}</span></div>
                  <Button variant="primary" size="lg" icon={Undo2} block onClick={iadeOlusturFn} disabled={toplamIade===0} loading={kaydediliyor}>{kaydediliyor?'İşleniyor…':'İadeyi oluştur'}</Button>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </Page>
  )
}
