import { useState, useEffect } from 'react'
import { kasaBugunGetir, kasaAc, kasaKapat, kasaIslemEkle , API_BASE } from '../api'
import { usePrint } from '../print/usePrint'
import { FIS_CSS } from './utils'
import { Page, PageHeader, Card, Button, Field, Input, Select, Segmented, Badge, Banner, Modal, StatCard, EmptyState, LoadingRows, toast } from '../ui'
import { Lock, LockOpen, Plus, Printer, Landmark, Plug, Store, ArrowUp, ArrowDown } from 'lucide-react'

const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const saat  = iso => new Date(iso).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})

export default function GunlukKasa({ magazaId, magazaAd }) {
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
  const print = usePrint()
  const [qzYazdiriliyor, setQzYazdiriliyor] = useState(false)

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
      toast.success('Kasa açıldı.')
      yukle()
    } catch(e) { toast.error(e.message) }
    finally { setKayit(false) }
  }

  const kasaKapatFn = async () => {
    setKayit(true)
    try {
      await kasaKapat({ kasaId: kasa.id, kapanisBakiyesi: Number(kapanisBakiye)||0 })
      setKapanisModal(false)
      toast.success('Kasa kapatıldı. Z raporu hazırlanıyor.')
      yukle()
      setTimeout(() => yazdirZRaporu(), 800)
    } catch(e) { toast.error(e.message) }
    finally { setKayit(false) }
  }

  const islemEkleFn = async () => {
    if (!islemForm.tutar || Number(islemForm.tutar) <= 0) return toast.warning('Tutar girin.')
    setKayit(true)
    try {
      await kasaIslemEkle({ kasaId: kasa.id, ...islemForm, tutar: Number(islemForm.tutar) })
      setIslemModal(false)
      setIslemForm({ tip:'giris', odeme:'nakit', tutar:'', aciklama:'' })
      toast.success('Nakit hareketi kaydedildi.')
      yukle()
    } catch(e) { toast.error(e.message) }
    finally { setKayit(false) }
  }

  // QZ Tray bağlıysa ve bir fiş yazıcısı seçiliyse doğrudan termal yazıcıya
  // (tarayıcı penceresi açılmadan) basar; değilse eskisi gibi tarayıcı
  // yazdırma penceresine düşer.
  const yazdirZRaporu = async (ekstraNakitAktarim=null) => {
    if (!kasa) return
    if (print.bagli && print.fisYazici) {
      setQzYazdiriliyor(true)
      try {
        await print.zRaporuYazdir(kasa, magazaAd, ekstraNakitAktarim ?? kasa.nakitAktarim ?? null)
        return
      } catch (err) {
        toast.warning('QZ Tray ile yazdırılamadı: ' + err.message + '. Tarayıcıdan yazdırılıyor.')
      } finally {
        setQzYazdiriliyor(false)
      }
    }
    yazdirZRaporuTarayici(ekstraNakitAktarim)
  }

  const yazdirZRaporuTarayici = (ekstraNakitAktarim=null) => {
    if (!kasa) return
    const o = kasa.ozet
    const _nakitAktarim = ekstraNakitAktarim || kasa.nakitAktarim || null
    const satislar = kasa.satislar || []
    const masraflar = kasa.masraflar || []
    const win = window.open('','_blank','width=400,height=800')
    win.document.write(`<!DOCTYPE html><html><head><title>Z Raporu</title>
    <style>${FIS_CSS}</style></head><body>
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
    ${_nakitAktarim ? `<hr/><div class="r bold" style="font-size:12px"><span>Nakit Kasa Aktarımı:</span><span>${para(_nakitAktarim)}</span></div>` : ''}
    <hr/>
    <div class="c sm" style="margin-top:6px">Vega Çanta & Ayakkabı</div>
    <div class="c sm">Teşekkürler</div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  const nakitAktar = async () => {
    try {
      const res = await fetch(`${API_BASE}/kasa/nakite-aktar`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          kasaId: kasa.id,
          tutar: Number(nakitAktarTutar),
          aciklama: `Günlük Kasa Nakdi - ${new Date().toLocaleDateString('tr-TR')} - ${magazaAd}`
        })
      })
      if (!res.ok) throw new Error('Aktarım yapılamadı')
      toast.success('Nakit kasaya aktarıldı.')
      setNakitAktarModal(false)
      // Aktarım tutarını kasa state'e ekle ve Z raporu bas
      setKasa(p => p ? {...p, nakitAktarim: Number(nakitAktarTutar)} : p)
      setTimeout(() => yazdirZRaporu(Number(nakitAktarTutar)), 300)
      yukle()
    } catch(e) { toast.error('Aktarılamadı: '+e.message) }
  }

  const bugunMetni = new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})

  if (!magazaId) return (
    <Page><div className="vg-card"><EmptyState icon={Store} title="Mağaza seçilmedi" text="Günlük kasa için üst şeritten bir mağaza seçin." /></div></Page>
  )

  if (yukleniyor) return <Page><LoadingRows /></Page>

  const o = kasa?.ozet || {}
  const kapali = !kasa || kasa?.durum === 'kapali'
  const fark = Number(kapanisBakiye) - (o.nakitNet || 0)

  const tutarAlani = (id, deger, setDeger, etiket, props = {}) => (
    <Field label={etiket} htmlFor={id}>
      <div className="vg-input-group">
        <Input id={id} type="number" size="lg" className="vg-num" value={deger} onChange={e=>setDeger(e.target.value)} placeholder="0,00" style={{ paddingRight: 28, fontWeight: 600 }} {...props} />
        <span className="vg-input-suffix">₺</span>
      </div>
    </Field>
  )

  return (
    <Page>
      {kapali ? (
        <div className="vg-card">
          <EmptyState icon={Lock} title={kasa?.durum==='kapali' ? 'Kasa kapalı' : 'Kasa bugün açılmadı'} text={`${magazaAd} · ${bugunMetni}`}
            actions={<Button variant="primary" size="lg" icon={LockOpen} onClick={()=>setAcilisModal(true)}>Kasayı aç</Button>} />
        </div>
      ) : (
        <>
          <PageHeader title={`Günlük kasa · ${magazaAd}`} subtitle={bugunMetni}
            actions={<>
              <Badge tone="success">Açık</Badge>
              <Button icon={Plus} onClick={()=>setIslemModal(true)}>Nakit hareketi</Button>
              <Button icon={Printer} onClick={()=>yazdirZRaporu()} loading={qzYazdiriliyor}>{qzYazdiriliyor?'Yazdırılıyor…':'Z raporu'}</Button>
              <Button variant="critical" icon={Lock} onClick={()=>{setKapanisBakiye(String(o.nakitNet||0));setKapanisModal(true)}}>Kasayı kapat</Button>
            </>} />

          {/* QZ Tray — Z Raporu'nun fiş yazıcısından (tarayıcı penceresi açmadan) basılabilmesi için */}
          <div className="vg-tile vg-row" style={{ gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: print.bagli ? 'var(--success)' : 'var(--critical)' }} />
            <span className="vg-muted" style={{ fontSize: 12 }}>QZ Tray {print.bagli ? 'bağlı' : 'bağlı değil'}</span>
            {!print.bagli && <Button size="sm" icon={Plug} onClick={print.baglan} loading={print.baglaniyor}>{print.baglaniyor?'Bağlanıyor…':'Bağlan'}</Button>}
            {print.bagli && (
              <>
                <Select size="sm" value={print.fisYazici} onChange={e=>print.fisYaziciSec(e.target.value)} aria-label="Fiş yazıcısı" style={{ width: 'auto', minWidth: 180 }}>
                  <option value="">Fiş yazıcısı seçin</option>
                  {print.yazicilar.map(y=><option key={y} value={y}>{y}</option>)}
                </Select>
                {print.fisYazici
                  ? <Badge tone="success">Z raporu bu yazıcıdan basılır</Badge>
                  : <Badge tone="warning">Seçilmezse tarayıcıdan basılır</Badge>}
              </>
            )}
            {print.hata && <span className="vg-error">{print.hata}</span>}
          </div>

          <div className="vg-grid-4">
            <StatCard label="Kasadaki nakit" value={para(o.nakitNet)} meta={`Açılış ${para(kasa?.acilisBakiyesi||0)}`} />
            <StatCard label="Toplam satış" value={para(o.toplamSatis)} meta={`${o.satisSayisi || 0} satış`} />
            <StatCard label="İadeler" value={`−${para(o.toplamIade)}`} meta={`${o.iadeSayisi || 0} iade`} />
            <StatCard label="Masraflar" value={`−${para(o.toplamMasraf)}`} />
          </div>
          <div className="vg-grid-3">
            <div className="vg-tile"><div className="vg-tile__label">Nakit satış</div><div className="vg-tile__value">{para(o.nakitSatis)}</div></div>
            <div className="vg-tile"><div className="vg-tile__label">Kartla satış</div><div className="vg-tile__value">{para(o.kartSatis)}</div></div>
            <div className="vg-tile"><div className="vg-tile__label">Havale / EFT</div><div className="vg-tile__value">{para(o.havaleSatis)}</div></div>
          </div>

          <div className="vg-grid-3">
            <Card title={`Bugünkü satışlar (${(kasa?.satislar||[]).length})`} padded={false} className="vg-span-2">
              {(kasa?.satislar||[]).length === 0 ? <EmptyState compact title="Bugün satış yok" /> : (
                <div className="vg-table-scroll" style={{ marginTop: 10 }}>
                  <table className="vg-table">
                    <thead><tr><th>Saat</th><th>Fiş no</th><th className="is-num">Kalem</th><th>Ödeme</th><th className="is-num">Tutar</th></tr></thead>
                    <tbody>
                      {kasa.satislar.map(s=>(
                        <tr key={s.id}>
                          <td className="vg-muted vg-num">{saat(s.tarih)}</td>
                          <td className="vg-code">{s.fisNo}</td>
                          <td className="is-num">{s.kalemler?.length||0}</td>
                          <td className="vg-muted">{s.odemeler?.map(o=>o.tip).join(', ')}</td>
                          <td className="is-num is-strong">{para(s.genelToplam)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Manuel nakit hareketleri" padded={false}>
              {(kasa?.islemler||[]).length === 0 ? <EmptyState compact title="Hareket yok" /> : (
                <ul className="vg-list" style={{ marginTop: 6 }}>
                  {kasa.islemler.map(i=>(
                    <li key={i.id} className="vg-list__item">
                      <div className="vg-list__main">
                        <div className="vg-list__primary">{i.aciklama||'—'}</div>
                        <div className="vg-list__secondary">{saat(i.tarih)} · {i.tip==='giris'?'Giriş':'Çıkış'}</div>
                      </div>
                      <div className={`vg-list__value ${i.tip==='giris'?'vg-text-success':'vg-text-critical'}`}>{i.tip==='giris'?'+':'−'}{para(i.tutar)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Kasa açılış */}
      {acilisModal && (
        <Modal title="Kasayı aç" subtitle={magazaAd} onClose={()=>setAcilisModal(false)}
          footer={<>
            <Button variant="plain" onClick={()=>setAcilisModal(false)}>Vazgeç</Button>
            <Button variant="primary" icon={LockOpen} onClick={kasaAcFn} loading={kayit}>Kasayı aç</Button>
          </>}>
          {tutarAlani('ka-acilis', acilisBakiye, setAcilisBakiye, 'Açılış nakit bakiyesi', { autoFocus: true })}
        </Modal>
      )}

      {/* Kapanış */}
      {kapanisModal && (
        <Modal title="Kasayı kapat" subtitle={magazaAd} onClose={()=>setKapanisModal(false)}
          footer={<>
            <Button icon={Landmark} onClick={()=>{setNakitAktarTutar(String(o.nakitNet||0));setNakitAktarModal(true);setKapanisModal(false)}} style={{ marginRight: 'auto' }}>Nakdi kasaya aktar</Button>
            <Button variant="plain" onClick={()=>setKapanisModal(false)}>Vazgeç</Button>
            <Button variant="critical" icon={Lock} onClick={kasaKapatFn} loading={kayit}>Kapat ve Z raporu bas</Button>
          </>}>
          <div className="vg-tile">
            <div className="vg-tile__label">Sistem hesabı (kasadaki nakit)</div>
            <div className="vg-tile__value" style={{ fontSize: 20 }}>{para(o.nakitNet)}</div>
          </div>
          {tutarAlani('ka-kapanis', kapanisBakiye, setKapanisBakiye, 'Sayılan nakit')}
          {kapanisBakiye && (
            <Banner tone={Math.abs(fark) < 1 ? 'success' : 'critical'} title={Math.abs(fark) < 1 ? 'Kasa tutuyor.' : 'Kasada fark var.'}>
              Fark: <strong className="vg-num">{fark >= 0 ? '+' : ''}{para(fark)}</strong>
            </Banner>
          )}
        </Modal>
      )}

      {/* Nakit kasaya aktar */}
      {nakitAktarModal && (
        <Modal title="Nakdi kasaya aktar" onClose={()=>setNakitAktarModal(false)}
          footer={<>
            <Button variant="plain" onClick={()=>setNakitAktarModal(false)}>Vazgeç</Button>
            <Button variant="primary" icon={Landmark} onClick={nakitAktar}>Aktar</Button>
          </>}>
          <Banner>Günlük nakit tahsilatı "Nakit Kasa" banka hesabına aktarılır ve Z raporu basılır.</Banner>
          {tutarAlani('ka-aktar', nakitAktarTutar, setNakitAktarTutar, 'Aktarılacak tutar')}
        </Modal>
      )}

      {/* Manuel işlem */}
      {islemModal && (
        <Modal title="Nakit hareketi" onClose={()=>setIslemModal(false)}
          footer={<>
            <Button variant="plain" onClick={()=>setIslemModal(false)}>Vazgeç</Button>
            <Button variant="primary" icon={islemForm.tip==='giris'?ArrowUp:ArrowDown} onClick={islemEkleFn} loading={kayit}>{islemForm.tip==='giris'?'Girişi kaydet':'Çıkışı kaydet'}</Button>
          </>}>
          <Segmented label="Hareket tipi" value={islemForm.tip} onChange={v=>setIslemForm(p=>({...p,tip:v}))} className="vg-segmented--block"
            options={[{ value:'giris', label:'Para girişi' }, { value:'cikis', label:'Para çıkışı' }]} />
          {tutarAlani('ka-islem', islemForm.tutar, v=>setIslemForm(p=>({...p,tutar:v})), 'Tutar', { autoFocus: true })}
          <Field label="Açıklama" htmlFor="ka-aciklama">
            <Input id="ka-aciklama" value={islemForm.aciklama} onChange={e=>setIslemForm(p=>({...p,aciklama:e.target.value}))} placeholder="örn. kasa açılışı, avans" />
          </Field>
        </Modal>
      )}
    </Page>
  )
}
