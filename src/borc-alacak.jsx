import { useState, useEffect } from 'react'
import * as api from './api'
import { Page, PageHeader, Button, Field, Input, Textarea, SearchInput, Segmented, Badge, Banner, Modal, StatCard, Tile, EmptyState, LoadingRows, toast } from './ui'
import { Plus, Pencil, HandCoins, AlarmClock, ArrowLeftRight } from 'lucide-react'

const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const tarihTR = iso => iso ? new Date(iso).toLocaleDateString('tr-TR') : '—'

const TIP_RENK = {
  borc:      { label: 'Borç',      ton: 'critical' },
  alacak:    { label: 'Alacak',    ton: 'warning' },
  odeme:     { label: 'Ödeme',     ton: 'success' },
  tahsilat:  { label: 'Tahsilat',  ton: 'success' },
}

const vadeMetni = gun => gun < 0 ? `${Math.abs(gun)} gün geçti` : gun === 0 ? 'Bugün vadesi doluyor' : `${gun} gün kaldı`
const vadeTon = gun => gun < 0 ? 'critical' : gun <= 7 ? 'warning' : 'success'

// ─── CARİ MODAL ───────────────────────────────────────────────
function CariModal({ cari, onKaydet, onKapat }) {
  const bos = { ad:'', telefon:'', email:'', adres:'', vergiNo:'', tip:'musteri', notlar:'' }
  const [form, setForm] = useState(cari ? {...cari} : bos)
  const [kayit, setKayit] = useState(false)
  const [hata, setHata] = useState('')
  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  const kaydet = async () => {
    if (!form.ad.trim()) return setHata('Ad zorunlu.')
    setHata(''); setKayit(true)
    try {
      if (cari) await api.cariGuncelle(cari.id, form)
      else       await api.cariEkle(form)
      toast.success(cari ? 'Cari hesap güncellendi.' : 'Cari hesap eklendi.')
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <Modal title={cari?'Cari hesabı düzenle':'Yeni cari hesap'} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit?'Kaydediliyor…':cari?'Değişiklikleri kaydet':'Hesap ekle'}</Button>
      </>}>
      <Segmented label="Cari tipi" value={form.tip} onChange={v=>g('tip',v)} className="vg-segmented--block"
        options={[{ value:'musteri', label:'Müşteri' }, { value:'tedarikci', label:'Tedarikçi' }]} />
      <Field label="Ad" htmlFor="c-ad"><Input id="c-ad" value={form.ad} onChange={e=>g('ad',e.target.value)} /></Field>
      <div className="vg-grid-2">
        <Field label="Telefon" htmlFor="c-tel"><Input id="c-tel" value={form.telefon||''} onChange={e=>g('telefon',e.target.value)} /></Field>
        <Field label="Vergi no" htmlFor="c-vergi"><Input id="c-vergi" mono value={form.vergiNo||''} onChange={e=>g('vergiNo',e.target.value)} /></Field>
      </div>
      <Field label="Adres" htmlFor="c-adres"><Input id="c-adres" value={form.adres||''} onChange={e=>g('adres',e.target.value)} /></Field>
      <Field label="Notlar" htmlFor="c-not"><Textarea id="c-not" value={form.notlar||''} onChange={e=>g('notlar',e.target.value)} rows={2} /></Field>
      {hata && <Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

// ─── HAREKET MODAL ────────────────────────────────────────────
function HareketModal({ cari, onKaydet, onKapat }) {
  const [form, setForm] = useState({ tip: cari.tip==='tedarikci'?'borc':'alacak', tutar:'', aciklama:'', belgeNo:'', vadeTarihi:'' })
  const [kayit, setKayit] = useState(false)
  const [hata, setHata] = useState('')
  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  const tipSecenekleri = cari.tip==='tedarikci' ? ['borc','odeme'] : ['alacak','tahsilat']

  const kaydet = async () => {
    if (!form.tutar || Number(form.tutar) <= 0) return setHata('Tutar zorunlu.')
    setHata(''); setKayit(true)
    try {
      await api.cariHareketEkle({
        cariId: cari.id,
        tip: form.tip,
        tutar: Number(form.tutar),
        aciklama: form.aciklama || null,
        belgeNo: form.belgeNo || null,
        bakiyeSonrasi: 0,
        vadeTarihi: form.vadeTarihi ? form.vadeTarihi + 'T12:00:00.000Z' : null,
      })
      toast.success(`${TIP_RENK[form.tip]?.label} hareketi eklendi.`)
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <Modal title="Hareket ekle" subtitle={cari.ad} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit?'Kaydediliyor…':`${TIP_RENK[form.tip]?.label} ekle`}</Button>
      </>}>
      <Segmented label="Hareket tipi" value={form.tip} onChange={v=>g('tip',v)} className="vg-segmented--block"
        options={tipSecenekleri.map(k=>({ value:k, label:TIP_RENK[k]?.label }))} />
      <Field label="Tutar" htmlFor="h-tutar">
        <div className="vg-input-group">
          <Input id="h-tutar" type="number" className="vg-num" value={form.tutar} onChange={e=>g('tutar',e.target.value)} style={{ paddingRight: 28 }} />
          <span className="vg-input-suffix">₺</span>
        </div>
      </Field>
      <Field label="Açıklama" htmlFor="h-aciklama"><Input id="h-aciklama" value={form.aciklama} onChange={e=>g('aciklama',e.target.value)} placeholder="Fatura açıklaması" /></Field>
      <div className="vg-grid-2">
        <Field label="Belge no" htmlFor="h-belge"><Input id="h-belge" mono value={form.belgeNo} onChange={e=>g('belgeNo',e.target.value)} placeholder="F-001" /></Field>
        <Field label="Vade tarihi" htmlFor="h-vade"><Input id="h-vade" type="date" value={form.vadeTarihi} onChange={e=>g('vadeTarihi',e.target.value)} /></Field>
      </div>
      {hata && <Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

// ─── TAHSİLAT / ÖDEME MODAL ───────────────────────────────────
function TahsilatModal({ hareket, cari, onKaydet, onKapat }) {
  const [tutar, setTutar] = useState(String(hareket.tutar))
  const [aciklama, setAciklama] = useState('')
  const [kayit, setKayit] = useState(false)
  const [hata, setHata] = useState('')
  const karsiTip = hareket.tip === 'alacak' ? 'tahsilat' : 'odeme'
  const baslik = hareket.tip==='alacak' ? 'Tahsilat' : 'Ödeme'

  const kaydet = async () => {
    if (!tutar || Number(tutar) <= 0) return setHata('Tutar zorunlu.')
    setHata(''); setKayit(true)
    try {
      // Karşı hareket oluştur (tahsilat/ödeme)
      await api.cariHareketEkle({
        cariId: cari.id,
        tip: karsiTip,
        tutar: Number(tutar),
        aciklama: aciklama || `${baslik} - ${hareket.aciklama||hareket.belgeNo||''}`,
        bakiyeSonrasi: 0,
      })
      // Orijinali ödendi işaretle
      await fetch(`${api.API_BASE}/cari/hareket/${hareket.id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ odendi: true })
      })
      toast.success(`${baslik} kaydedildi.`)
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  const gun = hareket.vadeTarihi ? Math.ceil((new Date(hareket.vadeTarihi)-new Date())/86400000) : null

  return (
    <Modal title={baslik} subtitle={cari.ad} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit?'İşleniyor…':hareket.tip==='alacak'?'Tahsil et':'Ödemeyi kaydet'}</Button>
      </>}>
      <div className="vg-tile">
        <div className="vg-kv" style={{ padding: 0 }}><span>Hareket</span><span>{hareket.aciklama||hareket.belgeNo||'—'}</span></div>
        <div className="vg-kv" style={{ padding: '4px 0 0' }}><span>Tutar</span><span>{para(hareket.tutar)}</span></div>
        {gun !== null && <div style={{ marginTop: 6 }}><Badge tone={vadeTon(gun)}>Vade {tarihTR(hareket.vadeTarihi)} · {vadeMetni(gun)}</Badge></div>}
      </div>
      <Field label={hareket.tip==='alacak'?'Tahsil edilecek tutar':'Ödenecek tutar'} htmlFor="t-tutar">
        <div className="vg-input-group">
          <Input id="t-tutar" type="number" className="vg-num" value={tutar} onChange={e=>setTutar(e.target.value)} style={{ paddingRight: 28 }} />
          <span className="vg-input-suffix">₺</span>
        </div>
      </Field>
      <Field label="Açıklama" help="İsteğe bağlı" htmlFor="t-aciklama"><Input id="t-aciklama" value={aciklama} onChange={e=>setAciklama(e.target.value)} /></Field>
      {hata && <Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

// ─── HESAP DÖKÜMÜ ─────────────────────────────────────────────
function HesapDokumu({ cari, onKapat, onGuncelle, onDuzenle }) {
  const [hareketler, setHareketler] = useState([])
  const [tahsilatModal, setTahsilatModal] = useState(null)
  const [hareketModal, setHareketModal] = useState(false)

  const yukle = () => api.cariHareketleriGetir(cari.id).then(setHareketler).catch(()=>setHareketler([]))

  useEffect(() => { yukle() }, [cari?.id])

  // Güncel bakiyeyi hareketlerden hesapla
  const guncelBakiye = hareketler.reduce((t, h) => {
    if (h.tip === 'alacak' || h.tip === 'borc') return t + Number(h.tutar)
    if (h.tip === 'tahsilat' || h.tip === 'odeme') return t - Number(h.tutar)
    return t
  }, 0)
  const bekleyenler = hareketler.filter(h => (h.tip==='alacak'||h.tip==='borc') && !h.odendi)
  const toplamBekleyen = bekleyenler.reduce((t,h)=>t+Number(h.tutar),0)

  return (
    <>
      <Modal title={cari.ad} subtitle={[cari.tip==='musteri'?'Müşteri':'Tedarikçi', cari.telefon].filter(Boolean).join(' · ')} onClose={onKapat} size="lg"
        headerExtra={<Button size="sm" icon={Pencil} onClick={onDuzenle}>Düzenle</Button>}>
        <div className="vg-grid-3" style={{ gap: 8 }}>
          <Tile label="Güncel bakiye" value={para(Math.abs(guncelBakiye))} tone={guncelBakiye>0?'critical':guncelBakiye<0?'success':undefined}>
            <div className="vg-help">{guncelBakiye>0?'Borçlu':guncelBakiye<0?'Alacaklı':'Dengede'}</div>
          </Tile>
          <Tile label="Bekleyen" value={para(toplamBekleyen)} tone={toplamBekleyen > 0 ? 'warning' : undefined}>
            <div className="vg-help">{bekleyenler.length} hareket</div>
          </Tile>
          <Tile label="Toplam işlem" value={hareketler.length}><div className="vg-help">hareket</div></Tile>
        </div>

        {bekleyenler.some(h=>h.vadeTarihi)&&(
          <Banner tone="warning" icon={AlarmClock} title="Bekleyen vadeler">
            <div className="vg-stack" style={{ gap: 6, marginTop: 6 }}>
              {bekleyenler.filter(h=>h.vadeTarihi).map(h=>{
                const gun=Math.ceil((new Date(h.vadeTarihi)-new Date())/86400000)
                return (
                  <div key={h.id} className="vg-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <span className="vg-truncate">{h.aciklama||h.belgeNo||'—'}</span>
                    <span className="vg-row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                      <Badge tone={vadeTon(gun)} size="sm">{vadeMetni(gun)}</Badge>
                      <strong className="vg-num">{para(h.tutar)}</strong>
                      <Button size="sm" icon={HandCoins} onClick={()=>setTahsilatModal(h)}>{h.tip==='alacak'?'Tahsil et':'Öde'}</Button>
                    </span>
                  </div>
                )
              })}
            </div>
          </Banner>
        )}

        <div className="vg-row" style={{ justifyContent: 'space-between' }}>
          <div className="vg-section-label">Hareketler</div>
          <Button size="sm" variant="primary" icon={Plus} onClick={()=>setHareketModal(true)}>Hareket ekle</Button>
        </div>

        {hareketler.length===0 ? <EmptyState compact icon={ArrowLeftRight} title="Hareket yok" /> : (
          <div className="vg-table-wrap" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            <table className="vg-table">
              <thead><tr><th>Tarih</th><th>Tip</th><th>Açıklama</th><th className="is-num">Tutar</th><th></th></tr></thead>
              <tbody>
                {hareketler.map(h=>{
                  const ht = TIP_RENK[h.tip] || TIP_RENK.borc
                  const gun = h.vadeTarihi ? Math.ceil((new Date(h.vadeTarihi)-new Date())/86400000) : null
                  return (
                    <tr key={h.id} className={h.odendi ? 'is-muted' : undefined}>
                      <td className="vg-nowrap">{tarihTR(h.tarih||h.olusturuldu)}</td>
                      <td><div className="vg-row" style={{ gap: 4 }}>
                        <Badge tone={h.odendi ? 'neutral' : ht.ton}>{ht.label}</Badge>
                        {h.odendi && <Badge tone="success" size="sm">Ödendi</Badge>}
                      </div></td>
                      <td>
                        <div>{h.aciklama||'—'}</div>
                        <div className="vg-row" style={{ gap: 6, marginTop: 2 }}>
                          {h.belgeNo && <span className="vg-code vg-muted">#{h.belgeNo}</span>}
                          {gun!==null && !h.odendi && <Badge tone={vadeTon(gun)} size="sm">{vadeMetni(gun)}</Badge>}
                        </div>
                      </td>
                      <td className="is-num is-strong" style={{ textDecoration: h.odendi ? 'line-through' : 'none' }}>
                        {['alacak','borc'].includes(h.tip)?'+':'−'}{para(h.tutar)}
                      </td>
                      <td>
                        {!h.odendi && (h.tip==='alacak'||h.tip==='borc') && (
                          <Button size="sm" icon={HandCoins} onClick={()=>setTahsilatModal(h)}>{h.tip==='alacak'?'Tahsil et':'Öde'}</Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {tahsilatModal&&(
        <TahsilatModal hareket={tahsilatModal} cari={cari}
          onKapat={()=>setTahsilatModal(null)}
          onKaydet={()=>{ setTahsilatModal(null); yukle(); onGuncelle() }}
        />
      )}
      {hareketModal&&(
        <HareketModal cari={cari}
          onKapat={()=>setHareketModal(false)}
          onKaydet={()=>{ setHareketModal(false); yukle(); onGuncelle() }}
        />
      )}
    </>
  )
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function BorcAlacak() {
  const [cariler, setCariler]       = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [arama, setArama]           = useState('')
  const [tipFiltre, setTipFiltre]   = useState('hepsi')
  const [cariModal, setCariModal]   = useState(null)
  const [secilenCari, setSecilenCari] = useState(null)

  const yukle = () => {
    setYukleniyor(true)
    api.carileriGetir().then(setCariler).catch(console.error).finally(()=>setYukleniyor(false))
  }

  useEffect(() => { yukle() }, [])

  const filtreli = cariler.filter(c => {
    const aramaEsles = !arama || c.ad.toLowerCase().includes(arama.toLowerCase()) || c.telefon?.includes(arama)
    const tipEsles = tipFiltre==='hepsi' || c.tip===tipFiltre
    return aramaEsles && tipEsles
  })

  const toplamBorc = cariler.filter(c=>Number(c.bakiye)>0).reduce((t,c)=>t+Number(c.bakiye),0)
  const toplamAlacak = cariler.filter(c=>Number(c.bakiye)<0).reduce((t,c)=>t+Math.abs(Number(c.bakiye)),0)
  const net = toplamAlacak - toplamBorc

  return (
    <Page>
      <PageHeader title="Borç / alacak" subtitle={`${cariler.length} cari hesap`}
        actions={<Button variant="primary" icon={Plus} onClick={()=>setCariModal('yeni')}>Cari hesap ekle</Button>} />

      <div className="vg-grid-3">
        <StatCard label="Toplam alacak" value={para(toplamAlacak)} />
        <StatCard label="Toplam borç" value={para(toplamBorc)} />
        <StatCard label="Net bakiye" value={para(Math.abs(net))}
          meta={<Badge tone={net>=0?'success':'critical'}>{net>=0?'Net alacak':'Net borç'}</Badge>} />
      </div>

      <div className="vg-table-wrap">
        <div className="vg-table-toolbar">
          <SearchInput value={arama} onChange={e=>setArama(e.target.value)} placeholder="Ad veya telefon" aria-label="Cari ara" style={{ flex: 1, minWidth: 200, maxWidth: 360 }} />
          <Segmented label="Cari tipi" value={tipFiltre} onChange={setTipFiltre}
            options={[{ value:'hepsi', label:'Tümü' }, { value:'musteri', label:'Müşteriler' }, { value:'tedarikci', label:'Tedarikçiler' }]} />
        </div>
        {yukleniyor ? <LoadingRows card={false} /> : filtreli.length===0 ? (
          <EmptyState icon={ArrowLeftRight} title={arama ? `"${arama}" ile eşleşen hesap yok` : 'Kayıt bulunamadı'} />
        ) : (
          <div className="vg-table-scroll">
            <table className="vg-table" style={{ minWidth: 560 }}>
              <thead><tr><th>Hesap</th><th>Tip</th><th>Telefon</th><th className="is-num">Bakiye</th><th>Durum</th></tr></thead>
              <tbody>
                {filtreli.map(c=>{
                  const bakiye = Number(c.bakiye)
                  const durum = bakiye > 0 ? 'borc' : bakiye < 0 ? 'alacak' : 'sifir'
                  return (
                    <tr key={c.id} className="is-clickable" onClick={()=>setSecilenCari(c)}>
                      <td className="is-strong">{c.ad}</td>
                      <td><Badge dot={false}>{c.tip==='musteri'?'Müşteri':'Tedarikçi'}</Badge></td>
                      <td className="vg-muted">{c.telefon || '—'}</td>
                      <td className="is-num is-strong">{para(Math.abs(bakiye))}</td>
                      <td><Badge tone={durum==='borc'?'critical':durum==='alacak'?'success':'neutral'}>{durum==='borc'?'Borçlu':durum==='alacak'?'Alacaklı':'Dengede'}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {secilenCari&&(
        <HesapDokumu cari={secilenCari}
          onKapat={()=>setSecilenCari(null)}
          onDuzenle={()=>setCariModal(secilenCari)}
          onGuncelle={()=>{
            yukle()
            // Güncel bakiyeyi çek
            api.carileriGetir().then(liste => {
              const guncel = liste.find(c => c.id === secilenCari?.id)
              if (guncel) setSecilenCari(guncel)
            }).catch(()=>{})
          }}
        />
      )}
      {cariModal&&(
        <CariModal cari={cariModal==='yeni'?null:cariModal}
          onKaydet={()=>{
            const duzenlenen = cariModal !== 'yeni' ? cariModal.id : null
            setCariModal(null); yukle()
            if (duzenlenen) api.carileriGetir().then(liste => { const g = liste.find(c => c.id === duzenlenen); if (g) setSecilenCari(s => s ? g : s) }).catch(()=>{})
          }}
          onKapat={()=>setCariModal(null)}
        />
      )}
    </Page>
  )
}
