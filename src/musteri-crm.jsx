import { useState, useEffect } from 'react'
import * as api from './api'
import { Page, PageHeader, Button, IconButton, Field, Input, Textarea, SearchInput, Badge, Banner, Modal, Tile, EmptyState, LoadingRows, Menu, onayla, toast } from './ui'
import { Plus, MoreHorizontal, Eye, Pencil, Trash2, UserRound } from 'lucide-react'

const para = v => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const tarihTR = iso => iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// ─── SEGMENT ──────────────────────────────────────────────────
function segmentBelirle(musteri) {
  const top = (musteri._count?.satislar||0) + (musteri._count?.siparisler||0)
  if (top === 0) return { label: 'Yeni',     ton: 'info' }
  if (top >= 10) return { label: 'VIP',      ton: 'violet' }
  if (top >= 5)  return { label: 'Düzenli',  ton: 'success' }
  return              { label: 'Standart',  ton: 'neutral' }
}

const SIPARIS_TON = { teslim_edildi: 'success', iptal: 'critical', iade: 'neutral' }

// ─── MODAL ────────────────────────────────────────────────────
function MusteriModal({ musteri, onKaydet, onKapat }) {
  const bos = { ad: '', soyad: '', telefon: '', email: '', adres: '', notlar: '' }
  const [form, setForm] = useState(musteri ? { ...musteri } : bos)
  const [hata, setHata] = useState('')
  const [kayit, setKayit] = useState(false)
  const g = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const kaydet = async () => {
    if (!form.ad.trim()) return setHata('Ad zorunlu.')
    setHata(''); setKayit(true)
    try {
      if (musteri) await api.musteriGuncelle(musteri.id, form)
      else         await api.musteriEkle(form)
      toast.success(musteri ? 'Müşteri güncellendi.' : 'Müşteri eklendi.')
      onKaydet()
    } catch (e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  const inp = (label, key, type = 'text') => (
    <Field label={label} htmlFor={`m-${key}`}>
      <Input id={`m-${key}`} type={type} value={form[key] || ''} onChange={e => g(key, e.target.value)} />
    </Field>
  )

  return (
    <Modal title={musteri ? 'Müşteriyi düzenle' : 'Yeni müşteri'} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit ? 'Kaydediliyor…' : musteri ? 'Değişiklikleri kaydet' : 'Müşteri ekle'}</Button>
      </>}>
      <div className="vg-grid-2">{inp('Ad', 'ad')}{inp('Soyad', 'soyad')}</div>
      {inp('Telefon', 'telefon', 'tel')}
      {inp('E-posta', 'email', 'email')}
      {inp('Adres', 'adres')}
      <Field label="Notlar" htmlFor="m-notlar">
        <Textarea id="m-notlar" value={form.notlar || ''} onChange={e => g('notlar', e.target.value)} rows={3} />
      </Field>
      {hata && <Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

// ─── DETAY PANEL ──────────────────────────────────────────────
function MusteriDetay({ musteriId, onKapat }) {
  const [musteri, setMusteri] = useState(null)

  useEffect(() => {
    api.musteriGetir(musteriId).then(setMusteri).catch(console.error)
  }, [musteriId])

  if (!musteri) return null

  const toplamHarcama = musteri.satislar?.reduce((t, s) => t + Number(s.genelToplam), 0) || 0

  const urunSayac = {}
  ;(musteri.satislar || []).forEach(s => (s.kalemler||[]).forEach(k => {
    const key = k.urunAd
    urunSayac[key] = urunSayac[key] || { adet: 0, toplam: 0 }
    urunSayac[key].adet  += Number(k.adet || 1)
    urunSayac[key].toplam += Number(k.toplam || 0)
  }))
  const sirali = Object.entries(urunSayac).sort((a,b) => b[1].adet - a[1].adet).slice(0,5)

  return (
    <Modal title={`${musteri.ad} ${musteri.soyad || ''}`} subtitle={[musteri.telefon, musteri.email].filter(Boolean).join(' · ')} onClose={onKapat} size="lg">
      <div className="vg-grid-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Tile label="Toplam harcama" value={para(toplamHarcama)} />
        <Tile label="İşlem" value={`${musteri.satislar?.length||0} mağaza · ${musteri.siparisler?.length||0} online`} style={{ fontSize: 13 }} />
        <Tile label="Ortalama sepet" value={para(toplamHarcama / (musteri.satislar?.length || 1))} />
        <Tile label="Puan" value={`${musteri.puan ?? 0} puan`} tone="success" />
      </div>

      {sirali.length > 0 && (
        <div>
          <div className="vg-section-label" style={{ marginBottom: 6 }}>En çok aldığı ürünler</div>
          <ul className="vg-list">
            {sirali.map(([ad, d]) => (
              <li key={ad} className="vg-list__item" style={{ padding: '8px 0' }}>
                <div className="vg-list__main">
                  <div className="vg-list__primary">{ad}</div>
                  <div className="vg-list__secondary">{d.adet} adet · {para(d.toplam)}</div>
                </div>
                <div className="vg-list__value">{d.adet}×</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {musteri.siparisler?.length > 0 && (
        <div>
          <div className="vg-section-label" style={{ marginBottom: 6 }}>Online siparişler</div>
          <ul className="vg-list">
            {musteri.siparisler.slice(0, 10).map(s => (
              <li key={s.id} className="vg-list__item" style={{ padding: '8px 0' }}>
                <div className="vg-list__main">
                  <div className="vg-list__primary vg-code">{s.siparisNo}</div>
                  <div className="vg-list__secondary">{tarihTR(s.tarih)} · {s.kanal||'online'}</div>
                </div>
                <Badge tone={SIPARIS_TON[s.durum] || 'warning'}>{s.durum?.replace(/_/g,' ')}</Badge>
                <div className="vg-list__value">{para(s.genelToplam)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {musteri.satislar?.length > 0 && (
        <div>
          <div className="vg-section-label" style={{ marginBottom: 6 }}>Mağaza satışları</div>
          <ul className="vg-list">
            {musteri.satislar.slice(0, 10).map(s => (
              <li key={s.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                <div className="vg-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <div>
                    <div className="vg-list__primary vg-code">{s.fisNo}</div>
                    <div className="vg-list__secondary">{tarihTR(s.tarih)}</div>
                  </div>
                  <div className="vg-list__value">{para(s.genelToplam)}</div>
                </div>
                {(s.kalemler||[]).length > 0 && (
                  <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {s.kalemler.map((k, i) => (
                      <div key={i} className="vg-row" style={{ justifyContent: 'space-between', fontSize: 12, flexWrap: 'nowrap' }}>
                        <span>
                          {k.urunAd}
                          <span className="vg-muted">{k.renk && ` · ${k.renk}`}{k.beden && `/${k.beden}`} × {k.adet}</span>
                        </span>
                        <span className="vg-num">{para(k.toplam)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function MusteriCRM() {
  const [musteriler, setMusteriler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [arama, setArama]           = useState('')
  const [modal, setModal]           = useState(null)
  const [detay, setDetay]           = useState(null)

  const yukle = (q = '') => {
    setYukleniyor(true)
    api.musterileriGetir(q ? { q } : {})
      .then(setMusteriler)
      .catch(console.error)
      .finally(() => setYukleniyor(false))
  }

  useEffect(() => { yukle() }, [])

  const aramaYap = (v) => { setArama(v); yukle(v) }

  const sil = async (m) => {
    if (!await onayla(`${m.ad} ${m.soyad || ''} kalıcı olarak silinecek.`, { title: 'Müşteriyi sil', confirmLabel: 'Müşteriyi sil' })) return
    try { await api.musteriSil(m.id); toast.success('Müşteri silindi.'); yukle(arama) }
    catch (e) { toast.error(e.message) }
  }

  return (
    <Page>
      <PageHeader title="Müşteriler" subtitle={`${musteriler.length} müşteri`}
        actions={<Button variant="primary" icon={Plus} onClick={() => setModal('yeni')}>Müşteri ekle</Button>} />

      <div className="vg-table-wrap">
        <div className="vg-table-toolbar">
          <SearchInput value={arama} onChange={e => aramaYap(e.target.value)} placeholder="Ad, telefon veya e-posta" aria-label="Müşteri ara" style={{ flex: 1, maxWidth: 360 }} />
        </div>
        {yukleniyor ? <LoadingRows card={false} /> : musteriler.length === 0 ? (
          <EmptyState icon={UserRound} title={arama ? `"${arama}" ile eşleşen müşteri yok` : 'Henüz müşteri yok'}
            text={arama ? 'Telefon numarası ya da e-posta ile aramayı deneyin.' : 'İlk müşterinizi ekleyin.'}
            actions={!arama && <Button variant="primary" icon={Plus} onClick={() => setModal('yeni')}>Müşteri ekle</Button>} />
        ) : (
          <div className="vg-table-scroll">
            <table className="vg-table" style={{ minWidth: 720 }}>
              <thead><tr>
                <th>Müşteri</th><th>Telefon</th><th>E-posta</th><th>İşlem</th><th>Segment</th><th style={{ width: 48 }}></th>
              </tr></thead>
              <tbody>
                {musteriler.map(m => {
                  const seg = segmentBelirle(m)
                  return (
                    <tr key={m.id} className="is-clickable" onClick={() => setDetay(m.id)}>
                      <td>
                        <div className="is-strong">{m.ad} {m.soyad || ''}</div>
                        {m.adres && <div className="vg-list__secondary vg-truncate" style={{ maxWidth: 260 }}>{m.adres}</div>}
                      </td>
                      <td className="vg-nowrap">{m.telefon || '—'}</td>
                      <td>{m.email || '—'}</td>
                      <td>
                        <div className="vg-num">{(m._count?.satislar||0) + (m._count?.siparisler||0)} işlem</div>
                        {m._count?.siparisler>0 && <div className="vg-list__secondary">{m._count.satislar||0} mağaza · {m._count.siparisler} online</div>}
                      </td>
                      <td><Badge tone={seg.ton}>{seg.label}</Badge></td>
                      <td onClick={e => e.stopPropagation()}>
                        <Menu trigger={({ toggle }) => <IconButton icon={MoreHorizontal} label="İşlemler" size="sm" onClick={toggle} />}
                          items={[
                            { text: 'Detay', icon: Eye, onClick: () => setDetay(m.id) },
                            { text: 'Düzenle', icon: Pencil, onClick: () => setModal(m) },
                            '-',
                            { text: 'Sil', icon: Trash2, tone: 'critical', onClick: () => sil(m) },
                          ]} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <MusteriModal musteri={modal === 'yeni' ? null : modal} onKaydet={() => { setModal(null); yukle(arama) }} onKapat={() => setModal(null)} />}
      {detay && <MusteriDetay musteriId={detay} onKapat={() => setDetay(null)} />}
    </Page>
  )
}
