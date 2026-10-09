import { useState, useEffect } from 'react'
import { iadelerGetir, iadeOnayla, iadeReddet } from './api'
import { Page, PageHeader, Card, Button, IconButton, Tabs, Badge, Banner, Tile, EmptyState, LoadingRows, onayla as onayIste, toast } from './ui'
import { RefreshCw, Check, X, Undo2, StickyNote } from 'lucide-react'

const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const tarih = iso => new Date(iso).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})

const DURUMLAR = [
  { id:'hepsi',      label:'Tümü',         ton:'neutral' },
  { id:'beklemede',  label:'Beklemede',     ton:'warning' },
  { id:'onaylandi',  label:'Onaylandı',     ton:'success' },
  { id:'reddedildi', label:'Reddedildi',    ton:'critical' },
]

const NEDENLER = {
  musteri_istegi: 'Müşteri isteği',
  urun_hatali:    'Ürün hatalı/bozuk',
  beden_uyumsuz:  'Beden/numara uyumsuz',
  diger:          'Diğer',
}

export default function IadeYonetimi({ rol }) {
  const [iadeler, setIadeler]       = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [durum, setDurum]           = useState('beklemede')
  const [secilen, setSecilen]       = useState(null)
  const [islem, setIslem]           = useState(null) // 'onaylaniyor' | 'reddediliyor'

  const yukle = () => {
    setYukleniyor(true)
    iadelerGetir(durum === 'hepsi' ? {} : { durum })
      .then(setIadeler)
      .catch(console.error)
      .finally(() => setYukleniyor(false))
  }

  useEffect(() => { yukle() }, [durum])

  const onayla = async (id) => {
    if (!await onayIste('İade onaylandığında ürünler stoğa geri eklenir.', { title: 'İadeyi onayla', confirmLabel: 'İadeyi onayla', tone: 'primary' })) return
    setIslem('onaylaniyor')
    try {
      await iadeOnayla(id)
      toast.success('İade onaylandı, stok güncellendi.')
      yukle()
      setSecilen(null)
    } catch(e) { toast.error('İade onaylanamadı: ' + e.message) }
    finally { setIslem(null) }
  }

  const reddet = async (id) => {
    if (!await onayIste('İade reddedilecek; stok değişmez.', { title: 'İadeyi reddet', confirmLabel: 'İadeyi reddet', tone: 'critical' })) return
    setIslem('reddediliyor')
    try {
      await iadeReddet(id)
      toast.success('İade reddedildi.')
      yukle()
      setSecilen(null)
    } catch(e) { toast.error('İade reddedilemedi: ' + e.message) }
    finally { setIslem(null) }
  }

  const bekleyenSayi = iadeler.filter(i => i.durum === 'beklemede').length

  return (
    <Page>
      <PageHeader title="İadeler"
        subtitle={bekleyenSayi > 0 ? `${bekleyenSayi} iade onay bekliyor` : 'Bekleyen iade yok'}
        actions={<Button icon={RefreshCw} onClick={yukle}>Yenile</Button>}>
        <Tabs value={durum} onChange={setDurum}
          items={DURUMLAR.map(d => ({ id: d.id, label: d.label, count: d.id === 'beklemede' ? bekleyenSayi : 0 }))} />
      </PageHeader>

      {yukleniyor ? <LoadingRows /> : iadeler.length === 0 ? (
        <div className="vg-card"><EmptyState icon={Undo2} title="Bu durumda iade yok" /></div>
      ) : (
        <div className={secilen ? 'vg-master-detail' : undefined}>
          {/* Liste */}
          <div className="vg-table-wrap">
            <div className="vg-table-scroll">
              <table className="vg-table" style={{ minWidth: 760 }}>
                <thead><tr>
                  <th>İade no</th><th>Tarih</th><th>Fiş no</th><th>Mağaza</th><th>Neden</th><th className="is-num">Tutar</th><th>Durum</th><th></th>
                </tr></thead>
                <tbody>
                  {iadeler.map(iade => {
                    const durumObj = DURUMLAR.find(d => d.id === iade.durum) || DURUMLAR[0]
                    const secilenMi = secilen?.id === iade.id
                    return (
                      <tr key={iade.id} className="is-clickable" aria-selected={secilenMi} onClick={() => setSecilen(secilenMi ? null : iade)}>
                        <td className="vg-code is-strong">{iade.iadeNo}</td>
                        <td className="vg-nowrap vg-muted">{tarih(iade.tarih)}</td>
                        <td className="vg-code">{iade.satis?.fisNo||'—'}</td>
                        <td>{iade.satis?.magaza?.ad||'—'}</td>
                        <td className="vg-muted">{NEDENLER[iade.neden]||iade.neden||'—'}</td>
                        <td className="is-num is-strong">{para(iade.toplamIade)}</td>
                        <td><Badge tone={durumObj.ton}>{durumObj.label}</Badge></td>
                        <td onClick={e=>e.stopPropagation()}>
                          {iade.durum === 'beklemede' && rol === 'admin' && (
                            <div className="vg-row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                              <Button size="sm" icon={Check} onClick={()=>onayla(iade.id)} disabled={!!islem} loading={islem==='onaylaniyor'}>Onayla</Button>
                              <IconButton size="sm" icon={X} label="Reddet" variant="critical-plain" onClick={()=>reddet(iade.id)} disabled={!!islem} />
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detay paneli */}
          {secilen && (
            <Card title={<span className="vg-code" style={{ fontSize: 14 }}>{secilen.iadeNo}</span>}
              subtitle={<Badge tone={(DURUMLAR.find(d => d.id === secilen.durum) || DURUMLAR[0]).ton}>{(DURUMLAR.find(d => d.id === secilen.durum) || DURUMLAR[0]).label}</Badge>}
              action={<IconButton icon={X} label="Detayı kapat" size="sm" onClick={()=>setSecilen(null)} />}
              className="vg-sticky" bodyClassName="vg-stack">
              <div className="vg-grid-2" style={{ gap: 8 }}>
                <Tile label="Tarih" value={tarih(secilen.tarih)} style={{ fontSize: 13 }} />
                <Tile label="Fiş no" value={<span className="vg-code">{secilen.satis?.fisNo||'—'}</span>} />
                <Tile label="Mağaza" value={secilen.satis?.magaza?.ad||'—'} />
                <Tile label="Neden" value={NEDENLER[secilen.neden]||secilen.neden||'—'} />
              </div>

              {secilen.notlar && <Banner tone="warning" icon={StickyNote}>{secilen.notlar}</Banner>}

              <div>
                <div className="vg-section-label" style={{ marginBottom: 4 }}>İade edilen ürünler</div>
                <ul className="vg-list">
                  {(secilen.kalemler||[]).map((k,i)=>(
                    <li key={i} className="vg-list__item" style={{ padding: '8px 0' }}>
                      <div className="vg-list__main">
                        <div className="vg-list__primary">{k.urunAd}</div>
                        <div className="vg-list__secondary">{k.renk}{k.beden?` / ${k.beden}`:''} · {k.adet} adet</div>
                      </div>
                      <div className="vg-list__value">{para(k.toplam)}</div>
                    </li>
                  ))}
                </ul>
                <div className="vg-kv vg-kv--total"><span>Toplam iade</span><span>{para(secilen.toplamIade)}</span></div>
              </div>

              <Banner tone={secilen.durum === 'onaylandi' ? 'success' : secilen.durum === 'reddedildi' ? 'critical' : 'info'}>
                {secilen.durum === 'onaylandi'
                  ? 'Stok geri eklendi.'
                  : secilen.durum === 'reddedildi'
                    ? 'Stok değişmedi.'
                    : 'Onay bekliyor. Stok henüz değişmedi.'}
              </Banner>

              {secilen.durum === 'beklemede' && rol === 'admin' && (
                <div className="vg-row" style={{ flexWrap: 'nowrap' }}>
                  <Button variant="primary" icon={Check} onClick={()=>onayla(secilen.id)} disabled={!!islem} loading={islem==='onaylaniyor'} style={{ flex: 1 }}>
                    {islem==='onaylaniyor'?'Onaylanıyor…':'İadeyi onayla'}
                  </Button>
                  <Button variant="critical-plain" icon={X} onClick={()=>reddet(secilen.id)} disabled={!!islem} loading={islem==='reddediliyor'}>
                    {islem==='reddediliyor'?'Reddediliyor…':'Reddet'}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </Page>
  )
}
