import { useState, useEffect } from 'react'
import * as api from './api'
import { Page, PageHeader, Card, Button, Field, Input, Select, Switch, Segmented, Badge, Banner, Modal, Progress, EmptyState, LoadingRows, toast } from './ui'
import { Plus, Pencil, Target, Pause, Play, Store, Clock, Users } from 'lucide-react'

const ROLLER = [
  { id: 'admin',   label: 'Admin',            ton: 'info',    aciklama: 'Tüm modüllere tam erişim' },
  { id: 'satis',   label: 'Satış Yetkilisi',  ton: 'success', aciklama: 'Satış, müşteri, stok görüntüleme' },
  { id: 'kasiyer', label: 'Kasiyer',          ton: 'warning', aciklama: 'Sadece kasa/satış ekranı' },
  { id: 'depo',    label: 'Depo Sorumlusu',   ton: 'violet',  aciklama: 'Stok görüntüleme ve düzenleme' },
]

function tarihTR(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── YENİ KULLANICI MODAL ─────────────────────────────────────
function KullaniciModal({ kullanici, magazalar, onKaydet, onKapat }) {
  const bos = { ad: '', soyad: '', email: '', sifre: '', rol: 'satis', magazaId: '', aktif: true }
  const [form, setForm] = useState(kullanici ? {
    ...kullanici, sifre: '', soyad: kullanici.soyad || ''
  } : bos)
  const [hata, setHata]     = useState('')
  const [kayit, setKayit]   = useState(false)

  const g = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const kaydet = async () => {
    if (!form.ad.trim())            return setHata('Ad zorunlu.')
    if (!form.email.includes('@'))  return setHata('Geçerli bir e-posta adresi girin.')
    if (!kullanici && form.sifre.length < 6) return setHata('Şifre en az 6 karakter olmalı.')
    setHata(''); setKayit(true)
    try {
      const veri = { ...form }
      if (!veri.sifre) delete veri.sifre
      if (!veri.magazaId) delete veri.magazaId
      if (kullanici) {
        await api.kullaniciGuncelle(kullanici.id, veri)
      } else {
        await api.kullaniciEkle(veri)
      }
      toast.success(kullanici ? 'Kullanıcı güncellendi.' : 'Kullanıcı eklendi.')
      onKaydet()
    } catch (e) {
      setHata(e.message)
    } finally {
      setKayit(false)
    }
  }

  const inp = (label, key, type = 'text', placeholder = '') => (
    <Field label={label} htmlFor={`k-${key}`}>
      <Input id={`k-${key}`} type={type} value={form[key]} onChange={e => g(key, e.target.value)} placeholder={placeholder} autoComplete={type === 'password' ? 'new-password' : undefined} />
    </Field>
  )

  return (
    <Modal title={kullanici ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı'} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit ? 'Kaydediliyor…' : kullanici ? 'Değişiklikleri kaydet' : 'Kullanıcı ekle'}</Button>
      </>}>
      <div className="vg-grid-2">{inp('Ad', 'ad')}{inp('Soyad', 'soyad')}</div>
      {inp('E-posta', 'email', 'email')}
      {inp('Şifre', 'sifre', 'password', kullanici ? 'Değiştirmek için doldurun' : 'En az 6 karakter')}

      <Field label="Rol" help={ROLLER.find(r => r.id === form.rol)?.aciklama}>
        <Segmented label="Rol" value={form.rol} onChange={v => g('rol', v)} options={ROLLER.map(r => ({ value: r.id, label: r.label }))} className="vg-segmented--block" />
      </Field>

      <Field label="Mağaza" htmlFor="k-magaza">
        <Select id="k-magaza" value={form.magazaId || ''} onChange={e => g('magazaId', e.target.value)}>
          <option value="">Tüm mağazalar</option>
          {magazalar.filter(m => m.tip !== 'online').map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
        </Select>
      </Field>

      <Switch checked={!!form.aktif} onChange={() => g('aktif', !form.aktif)} label={form.aktif ? 'Hesap aktif' : 'Hesap pasif'} />

      {hata && <Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

// ─── HEDEF MODAL ─────────────────────────────────────────────
function HedefModal({ kullanici, onKaydet, onKapat }) {
  const simdi = new Date()
  const buAy = simdi.toISOString().slice(0,7)
  const [hedef, setHedef]     = useState(Number(kullanici.aylikHedef||0))
  const [ay, setAy]           = useState(buAy)
  const [gecmisler, setGecmisler] = useState([])
  const [kayit, setKayit]     = useState(false)

  useEffect(() => {
    fetch(`${api.API_BASE}/kullanicilar/${kullanici.id}/hedefler`)
      .then(r=>r.json()).then(setGecmisler).catch(()=>[])
  }, [])

  const kaydet = async () => {
    setKayit(true)
    try {
      const [yil, ayNo] = ay.split('-').map(Number)
      await fetch(`${api.API_BASE}/kullanicilar/${kullanici.id}/hedef`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ yil, ay: ayNo, hedef: Number(hedef) })
      })
      // aylikHedef alanını da güncelle (bu ayki hedef için)
      await api.kullaniciGuncelle(kullanici.id, { aylikHedef: Number(hedef) })
      toast.success('Hedef kaydedildi.')
      onKaydet()
    } catch(e) { toast.error(e.message) }
    finally { setKayit(false) }
  }

  return (
    <Modal title="Satış hedefi" subtitle={`${kullanici.ad} ${kullanici.soyad || ''}`} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit ? 'Kaydediliyor…' : 'Hedefi kaydet'}</Button>
      </>}>
      <div className="vg-grid-2">
        <Field label="Ay" htmlFor="h-ay">
          <Input id="h-ay" type="month" value={ay} onChange={e=>setAy(e.target.value)} />
        </Field>
        <Field label="Aylık satış hedefi" htmlFor="h-hedef">
          <div className="vg-input-group">
            <Input id="h-hedef" type="number" className="vg-num" value={hedef} onChange={e=>setHedef(e.target.value)} style={{ paddingRight: 28 }} />
            <span className="vg-input-suffix">₺</span>
          </div>
        </Field>
      </div>
      {gecmisler.length>0&&(
        <div>
          <div className="vg-section-label" style={{ marginBottom: 4 }}>Geçmiş hedefler</div>
          {gecmisler.slice(0,6).map(h=>(
            <div key={h.id} className="vg-kv" style={{ borderTop: '1px solid var(--line)' }}>
              <span>{String(h.ay).padStart(2,'0')}.{h.yil}</span>
              <span>₺{Number(h.hedef).toLocaleString('tr-TR')}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function KullaniciYonetimi() {
  const [kullanicilar, setKullanicilar] = useState([])
  const [magazalar, setMagazalar]       = useState([])
  const [yukleniyor, setYukleniyor]     = useState(true)
  const [modal, setModal]               = useState(null) // null | 'yeni' | kullanici objesi
  const [hedefModal, setHedefModal]     = useState(null)

  const [performans, setPerformans] = useState({})

  const yukle = () => {
    setYukleniyor(true)
    Promise.all([api.kullanicilariGetir(), api.magazalariGetir()])
      .then(([k, m]) => {
        setKullanicilar(k); setMagazalar(m)
        // Bu ayki satış performansı
        const buAyBaslangic = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        api.satislariGetir({ baslangic: buAyBaslangic, limit: 500 })
          .then(satislar => {
            const p = {}
            satislar.forEach(s => {
              if (s.kullaniciId) {
                p[s.kullaniciId] = (p[s.kullaniciId] || 0) + Number(s.genelToplam || 0)
              }
            })
            setPerformans(p)
          }).catch(()=>{})
      })
      .catch(console.error)
      .finally(() => setYukleniyor(false))
  }

  useEffect(() => { yukle() }, [])

  const durumToggle = async (k) => {
    try {
      await api.kullaniciGuncelle(k.id, { aktif: !k.aktif })
      toast.success(k.aktif ? `${k.ad} pasif yapıldı.` : `${k.ad} aktif yapıldı.`)
    } catch (e) { toast.error(e.message) }
    yukle()
  }

  return (
    <Page>
      <PageHeader title="Kullanıcılar" subtitle={yukleniyor ? ' ' : `${kullanicilar.length} kullanıcı · ${kullanicilar.filter(k => k.aktif).length} aktif`}
        actions={<Button variant="primary" icon={Plus} onClick={() => setModal('yeni')}>Kullanıcı ekle</Button>} />

      {yukleniyor ? <LoadingRows /> : kullanicilar.length === 0 ? (
        <div className="vg-card"><EmptyState icon={Users} title="Henüz kullanıcı yok" actions={<Button variant="primary" icon={Plus} onClick={() => setModal('yeni')}>Kullanıcı ekle</Button>} /></div>
      ) : (
        <div className="vg-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {kullanicilar.map(k => {
            const rol = ROLLER.find(r => r.id === k.rol)
            const basHarf = `${k.ad?.[0] || ''}${k.soyad?.[0] || ''}`.toLocaleUpperCase('tr-TR')
            const gercek = performans[k.id] || 0
            const yuzde = k.aylikHedef > 0 ? (gercek / Number(k.aylikHedef)) * 100 : 0
            return (
              <Card key={k.id} style={{ opacity: k.aktif ? 1 : 0.65 }} bodyClassName="vg-stack" >
                <div className="vg-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <span className="vg-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{basHarf}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }} className="vg-truncate">{k.ad} {k.soyad || ''}</div>
                    <div className="vg-list__secondary vg-truncate">{k.email}</div>
                  </div>
                  <Badge tone={rol?.ton} dot={false}>{rol?.label || k.rol}</Badge>
                </div>

                <div className="vg-stack" style={{ gap: 4, fontSize: 12, color: 'var(--ink-muted)' }}>
                  <span className="vg-row" style={{ gap: 6 }}><Store className="vg-icon" style={{ width: 14, height: 14 }} />{k.magaza?.ad || 'Tüm mağazalar'}</span>
                  <span className="vg-row" style={{ gap: 6 }}><Clock className="vg-icon" style={{ width: 14, height: 14 }} />Son giriş: {tarihTR(k.sonGiris)}</span>
                  {!k.aktif && <span><Badge tone="neutral" size="sm">Pasif</Badge></span>}
                </div>

                {k.aylikHedef > 0 && (
                  <Progress name="Bu ay" figures={`₺${gercek.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} / ₺${Number(k.aylikHedef).toLocaleString('tr-TR')}`}
                    pct={yuzde} state={yuzde >= 100 ? 'done' : undefined} />
                )}

                <div className="vg-row" style={{ flexWrap: 'nowrap' }}>
                  <Button size="sm" icon={Pencil} onClick={() => setModal(k)} style={{ flex: 1 }}>Düzenle</Button>
                  <Button size="sm" icon={Target} onClick={() => setHedefModal(k)} style={{ flex: 1 }}>Hedef</Button>
                  <Button size="sm" variant={k.aktif ? 'critical-plain' : 'secondary'} icon={k.aktif ? Pause : Play} onClick={() => durumToggle(k)} style={{ flex: 1 }}>
                    {k.aktif ? 'Pasif yap' : 'Aktif yap'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {hedefModal && <HedefModal kullanici={hedefModal} onKaydet={()=>{setHedefModal(null);yukle()}} onKapat={()=>setHedefModal(null)}/>}
      {modal && (
        <KullaniciModal
          kullanici={modal === 'yeni' ? null : modal}
          magazalar={magazalar}
          onKaydet={() => { setModal(null); yukle() }}
          onKapat={() => setModal(null)}
        />
      )}
    </Page>
  )
}
