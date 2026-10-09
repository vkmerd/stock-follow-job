import { useState, useEffect } from 'react'
import * as api from './api'
import { useVega } from './VegaContext'
import { Page, PageHeader, Card, Button, Field, Input, Switch, Segmented, Badge, Banner, Modal, StatCard, LoadingRows, MagazaIkon, MAGAZA_IKONLARI, alpha, toast } from './ui'
import { Plus, Pencil, Pause, Play, MapPin, Phone, Mail, Target } from 'lucide-react'

const MAGAZA_TIPLERI = [
  { id: 'fiziksel', label: 'Fiziksel mağaza' },
  { id: 'online',   label: 'Online kanal' },
]

const IKONLAR = ['magaza', 'canta', 'web', 'telefon', 'avm', 'ofis', 'depo', 'hedef']
// Mağazayı listelerde ayırt etmek için etiket renkleri (Vega mavisiyle uyumlu, iki temada da okunur)
const RENKLER = ['#2e6db4', '#16713f', '#6d4fc2', '#b4531a', '#9a5b00', '#c4312b', '#0f766e', '#5b6270']

// ─── MAĞAZA MODAL ─────────────────────────────────────────────
function MagazaModal({ magaza, onKaydet, onKapat }) {
  const bos = { ad: '', kod: '', adres: '', telefon: '', email: '', tip: 'fiziksel', ikon: 'magaza', renk: RENKLER[0], aktif: true, aylikHedef: '' }
  const [form, setForm] = useState(magaza || bos)
  const [hata, setHata]   = useState('')
  const [kayit, setKayit] = useState(false)
  const g = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Kod otomatik üret
  useEffect(() => {
    if (!magaza && form.ad && !form.kod) {
      const otokod = form.ad
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 4)
      g('kod', otokod)
    }
  }, [form.ad])

  const kaydet = async () => {
    if (!form.ad.trim()) return setHata('Mağaza adı zorunlu.')
    if (!form.kod.trim()) return setHata('Mağaza kodu zorunlu.')
    setHata(''); setKayit(true)
    try {
      if (magaza) await api.magazaGuncelle(magaza.id, form)
      else        await api.magazaEkle(form)
      toast.success(magaza ? 'Mağaza güncellendi.' : 'Mağaza eklendi.')
      onKaydet()
    } catch (e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  const inp = (label, key, type = 'text', placeholder = '') => (
    <Field label={label} htmlFor={`mg-${key}`}>
      <Input id={`mg-${key}`} type={type} value={form[key] || ''} onChange={e => g(key, e.target.value)} placeholder={placeholder} />
    </Field>
  )

  return (
    <Modal title={magaza ? 'Mağazayı düzenle' : 'Yeni mağaza'} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit ? 'Kaydediliyor…' : magaza ? 'Değişiklikleri kaydet' : 'Mağaza ekle'}</Button>
      </>}>
      <Segmented label="Mağaza tipi" value={form.tip} onChange={v => g('tip', v)} options={MAGAZA_TIPLERI.map(t => ({ value: t.id, label: t.label }))} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 12 }}>
        {inp('Mağaza adı', 'ad', 'text', 'örn. Merkez Mağaza')}
        <Field label="Kod" htmlFor="mg-kod">
          <Input id="mg-kod" mono value={form.kod || ''} onChange={e => g('kod', e.target.value.toUpperCase())} placeholder="M1" style={{ textAlign: 'center', fontSize: 14 }} />
        </Field>
      </div>

      {inp('Adres', 'adres', 'text', 'Mağaza adresi')}

      <div className="vg-grid-2">
        {inp('Telefon', 'telefon', 'tel')}
        {inp('E-posta', 'email', 'email')}
      </div>

      <Field label="İkon">
        <div className="vg-row" style={{ gap: 6 }}>
          {IKONLAR.map(ikon => (
            <Button key={ikon} variant={form.ikon === ikon ? 'primary' : 'secondary'} icon={MAGAZA_IKONLARI[ikon]} aria-label={ikon} aria-pressed={form.ikon === ikon} onClick={() => g('ikon', ikon)} />
          ))}
        </div>
      </Field>

      <Field label="Etiket rengi">
        <div className="vg-row" style={{ gap: 8 }}>
          {RENKLER.map(renk => (
            <button key={renk} type="button" aria-label={`Renk ${renk}`} aria-pressed={form.renk === renk} onClick={() => g('renk', renk)} style={{
              width: 24, height: 24, borderRadius: '50%', background: renk, cursor: 'pointer', border: 0,
              boxShadow: form.renk === renk ? `0 0 0 2px var(--surface), 0 0 0 4px ${renk}` : 'none'
            }} />
          ))}
        </div>
      </Field>

      <Field label="Aylık satış hedefi" htmlFor="mg-hedef">
        <div className="vg-input-group">
          <Input id="mg-hedef" type="number" className="vg-num" value={form.aylikHedef || ''} onChange={e => g('aylikHedef', e.target.value)} placeholder="0" style={{ paddingRight: 28 }} />
          <span className="vg-input-suffix">₺</span>
        </div>
      </Field>

      <Switch checked={!!form.aktif} onChange={() => g('aktif', !form.aktif)} label={form.aktif ? 'Mağaza aktif' : 'Mağaza pasif'} />

      {hata && <Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function MagazaYonetimi() {
  const { yukleMagazalar } = useVega()
  const [magazalar, setMagazalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [modal, setModal] = useState(null) // null | 'yeni' | magaza obj

  const yukle = () => {
    setYukleniyor(true)
    // aktif filtresi olmadan tüm mağazaları çek (yönetim ekranı)
    api.magazalariGetir({ hepsi: 'true' })
      .then(setMagazalar)
      .catch(console.error)
      .finally(() => setYukleniyor(false))
  }

  useEffect(() => { yukle() }, [])

  const yenileHepsi = async () => {
    yukle()
    if (typeof yukleMagazalar === 'function') {
      try {
        await yukleMagazalar()
      } catch (e) {
        console.error(e)
      }
    }
  }

  const durumToggle = async (m) => {
    try {
      await api.magazaGuncelle(m.id, { aktif: !m.aktif })
      toast.success(m.aktif ? `${m.ad} pasif yapıldı.` : `${m.ad} aktif yapıldı.`)
    } catch (e) { toast.error(e.message) }
    await yenileHepsi()
  }

  const aktifler = magazalar.filter(m => m.aktif)
  const pasifler = magazalar.filter(m => !m.aktif)

  return (
    <Page>
      <PageHeader title="Mağazalar" subtitle={yukleniyor ? ' ' : `${aktifler.length} aktif · ${pasifler.length} pasif`}
        actions={<Button variant="primary" icon={Plus} onClick={() => setModal('yeni')}>Mağaza ekle</Button>} />

      {yukleniyor ? <LoadingRows /> : <>
        <div className="vg-grid-3">
          <StatCard label="Toplam mağaza" value={magazalar.length} />
          <StatCard label="Fiziksel mağaza" value={magazalar.filter(m => m.tip !== 'online').length} />
          <StatCard label="Online kanal" value={magazalar.filter(m => m.tip === 'online').length} />
        </div>

        <div className="vg-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {magazalar.map(m => {
            const renk = m.renk?.startsWith('#') ? m.renk : 'var(--accent)'
            return (
              <Card key={m.id} style={{ opacity: m.aktif ? 1 : 0.6 }} bodyClassName="vg-stack">
                <div className="vg-row" style={{ flexWrap: 'nowrap' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: alpha(renk, 14), color: renk, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <MagazaIkon ikon={m.ikon} className="vg-icon vg-icon--lg" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }} className="vg-truncate">{m.ad}</div>
                    <div className="vg-row" style={{ gap: 6, marginTop: 2 }}>
                      <span className="vg-code" style={{ color: renk }}>{m.kod}</span>
                      <span className="vg-list__secondary">{m.tip === 'online' ? 'Online kanal' : 'Fiziksel mağaza'}</span>
                    </div>
                  </div>
                  <Badge tone={m.aktif ? 'success' : 'neutral'}>{m.aktif ? 'Aktif' : 'Pasif'}</Badge>
                </div>

                <div className="vg-stack" style={{ gap: 4, fontSize: 12, color: 'var(--ink-muted)' }}>
                  {m.adres && <span className="vg-row" style={{ gap: 6, flexWrap: 'nowrap' }}><MapPin className="vg-icon" style={{ width: 14, height: 14 }} /><span className="vg-truncate">{m.adres}</span></span>}
                  {m.telefon && <span className="vg-row" style={{ gap: 6 }}><Phone className="vg-icon" style={{ width: 14, height: 14 }} />{m.telefon}</span>}
                  {m.email && <span className="vg-row" style={{ gap: 6 }}><Mail className="vg-icon" style={{ width: 14, height: 14 }} />{m.email}</span>}
                  {m.aylikHedef && Number(m.aylikHedef) > 0 && (
                    <span className="vg-row" style={{ gap: 6 }}><Target className="vg-icon" style={{ width: 14, height: 14 }} />Aylık hedef: <strong className="vg-num" style={{ color: 'var(--ink)' }}>₺{Number(m.aylikHedef).toLocaleString('tr-TR')}</strong></span>
                  )}
                  {!m.adres && !m.telefon && !m.email && !m.aylikHedef && <span>Bilgi girilmemiş</span>}
                </div>

                <div className="vg-row" style={{ flexWrap: 'nowrap' }}>
                  <Button size="sm" icon={Pencil} onClick={() => setModal(m)} style={{ flex: 1 }}>Düzenle</Button>
                  <Button size="sm" variant={m.aktif ? 'critical-plain' : 'secondary'} icon={m.aktif ? Pause : Play} onClick={() => durumToggle(m)} style={{ flex: 1 }}>
                    {m.aktif ? 'Pasif yap' : 'Aktif yap'}
                  </Button>
                </div>
              </Card>
            )
          })}

          <button type="button" onClick={() => setModal('yeni')} className="vg-card vg-card--interactive" style={{
            border: '1px dashed var(--line-input)', boxShadow: 'none', background: 'transparent', minHeight: 160,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'var(--ink-muted)', font: 'inherit', cursor: 'pointer'
          }}>
            <Plus className="vg-icon vg-icon--lg" />
            Yeni mağaza ekle
          </button>
        </div>
      </>}

      {modal && (
        <MagazaModal
          magaza={modal === 'yeni' ? null : modal}
          onKaydet={() => { setModal(null); yenileHepsi() }}
          onKapat={() => setModal(null)}
        />
      )}
    </Page>
  )
}
