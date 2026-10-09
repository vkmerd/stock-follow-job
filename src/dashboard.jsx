import { useState, useEffect } from 'react'
import * as api from './api'
import { Page, Card, StatCard, Progress, Badge, Button, EmptyState, Skeleton, Spark, BarChart } from './ui'
import { ArrowRight, CircleCheck, Receipt } from 'lucide-react'

const para = v => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const paraKisa = v => `₺${Number(v || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`
const tarihTR = iso => iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const saatTR = iso => iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''

// Ayın kaçta kaçı geçti — hedef çubuğunun "geride" sayılıp sayılmayacağını belirler
const ayIlerleme = () => {
  const d = new Date()
  const gunSayisi = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return (d.getDate() / gunSayisi) * 100
}
const hedefDurum = (yuzde) => yuzde >= 100 ? 'done' : yuzde < ayIlerleme() - 10 ? 'behind' : undefined

function HedefSatiri({ ad, gercek, hedef }) {
  const yuzde = hedef > 0 ? (gercek / hedef) * 100 : 0
  return <Progress name={ad} figures={`${paraKisa(gercek)} / ${paraKisa(hedef)}`} pct={yuzde} state={hedefDurum(yuzde)} />
}

export default function Dashboard({ kullanici, onKritikStokTikla, onNavigate }) {
  // Dashboard'daki her kart/panel ilgili sayfaya yönlendirir. onNavigate izin
  // kontrolünü kendisi yapar; izin yoksa sessizce yok sayar.
  const git = (sayfa, sekme) => { if (onNavigate) onNavigate(sayfa, sekme) }
  const bugun = new Date().toISOString().slice(0, 10)
  const ayBasi = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const gecenAyBasi = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10)
  const gecenAySonu = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10)

  const [satislar, setSatislar]         = useState([])
  const [gecenAySatis, setGecenAySatis] = useState([])
  const [kullanicilar, setKullanicilar] = useState([])
  const [siparisler, setSiparisler]     = useState([])
  const [stokUyari, setStokUyari]       = useState([])
  const [magazalar, setMagazalar]       = useState([])
  const [yukleniyor, setYukleniyor]     = useState(true)

  useEffect(() => {
    setYukleniyor(true)
    Promise.all([
      api.satislariGetir({ baslangic: ayBasi + 'T00:00:00', limit: 1000 }),
      api.satislariGetir({ baslangic: gecenAyBasi + 'T00:00:00', bitis: gecenAySonu + 'T23:59:59', limit: 1000 }),
      api.kullanicilariGetir(),
      api.siparisleriGetir({ durum: 'beklemede', limit: 10 }),
      api.urunleriGetir({ kritikStok: true }).catch(() => []),
      api.magazalariGetir().catch(() => []),
    ]).then(([s, gs, k, sp, uk, mg]) => {
      setSatislar(s)
      setGecenAySatis(gs)
      setKullanicilar(k)
      setSiparisler(sp)
      setStokUyari(uk?.filter?.(u => u.kritikStok) || [])
      setMagazalar(Array.isArray(mg) ? mg.filter(m => m.aktif && m.tip !== 'online') : [])
    }).catch(console.error)
    .finally(() => setYukleniyor(false))
  }, [])

  // Hesaplamalar
  const bugunSatislar    = satislar.filter(s => s.tarih?.slice(0, 10) === bugun)
  const bugunCiro        = bugunSatislar.reduce((t, s) => t + Number(s.genelToplam || 0), 0)
  const aylikCiro        = satislar.reduce((t, s) => t + Number(s.genelToplam || 0), 0)
  const gecenAyCiro      = gecenAySatis.reduce((t, s) => t + Number(s.genelToplam || 0), 0)
  const ciroTrend        = gecenAyCiro > 0 ? Math.round(((aylikCiro - gecenAyCiro) / gecenAyCiro) * 1000) / 10 : null

  // Personel performansı
  const personelPerf = kullanicilar
    .filter(k => k.rol !== 'admin' && k.aktif)
    .map(k => {
      const kSatis = satislar.filter(s => s.kullaniciId === k.id)
      const ciro = kSatis.reduce((t, s) => t + Number(s.genelToplam || 0), 0)
      return { ...k, buAyCiro: ciro, satisSayisi: kSatis.length }
    })
    .sort((a, b) => b.buAyCiro - a.buAyCiro)

  // Günlük grafik (son 14 gün)
  const son14gun = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i))
    return d.toISOString().slice(0, 10)
  })
  const gunlukCiro = son14gun.map(gun => ({
    gun,
    ciro: satislar.filter(s => s.tarih?.slice(0, 10) === gun).reduce((t, s) => t + Number(s.genelToplam || 0), 0)
  }))
  const donemCiro = gunlukCiro.reduce((t, g) => t + g.ciro, 0)

  const saat = new Date().getHours()
  const selam = saat < 12 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar'
  const ayAdi = new Date().toLocaleDateString('tr-TR', { month: 'long' })
  const hedefliMagazalar = magazalar.filter(m => Number(m.aylikHedef) > 0)

  const tumu = (sayfa, sekme) => <Button variant="plain" size="sm" iconRight={ArrowRight} onClick={() => git(sayfa, sekme)}>Tümü</Button>

  return (
    <Page>
      <div className="vg-page-header">
        <div className="vg-page-header__text">
          <h1 className="vg-page-title" style={{ fontSize: 26, lineHeight: '32px', letterSpacing: '-0.02em' }}>
            {selam}{kullanici?.ad ? `, ${kullanici.ad}` : ''}
          </h1>
          <p className="vg-page-subtitle">
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPI Kartları */}
      <div className="vg-grid-4">
        {yukleniyor ? Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="vg-card vg-stat"><Skeleton h={14} w="50%" /><Skeleton h={28} w="70%" /><Skeleton h={12} w="40%" /></div>
        )) : <>
          <StatCard label="Bugünkü ciro" value={para(bugunCiro)} onClick={() => git('raporlar')}
            meta={bugunSatislar.length ? `${bugunSatislar.length} satış · ort. ${para(bugunCiro / bugunSatislar.length)}` : 'Henüz satış yok'} />
          <StatCard label={`${ayAdi.charAt(0).toLocaleUpperCase('tr-TR') + ayAdi.slice(1)} cirosu`} value={para(aylikCiro)} onClick={() => git('raporlar')}
            meta={ciroTrend != null
              ? <><span className={`vg-delta vg-delta--${ciroTrend >= 0 ? 'up' : 'down'}`}>{ciroTrend >= 0 ? '▲' : '▼'} %{Math.abs(ciroTrend).toLocaleString('tr-TR')}</span> geçen aya göre</>
              : `${satislar.length} satış`}>
            <Spark values={gunlukCiro.map(g => g.ciro)} />
          </StatCard>
          <StatCard label="Bekleyen sipariş" value={siparisler.length} onClick={() => git('siparisler')}
            meta={siparisler.length ? <Badge tone="warning">Onay bekliyor</Badge> : 'Online kanallar'} />
          <StatCard label="Kritik stok" value={stokUyari.length} onClick={onKritikStokTikla || (() => git('stok', 'alim'))}
            meta={stokUyari.length ? <Badge tone="critical">Alım gerekli</Badge> : 'Stok seviyeleri normal'} />
        </>}
      </div>

      {/* Grafik + Mağaza hedefleri */}
      <div className="vg-grid-3">
        <Card title="Son 14 gün ciro" subtitle={yukleniyor ? ' ' : `Toplam ${para(donemCiro)} · bugün ${para(bugunCiro)}`}
          action={tumu('raporlar')} className="vg-span-2">
          {yukleniyor ? <Skeleton h={180} /> : <BarChart format={paraKisa} veri={gunlukCiro.map(g => ({ key: g.gun, label: g.gun.slice(8), value: g.ciro, current: g.gun === bugun, title: `${tarihTR(g.gun)}: ${para(g.ciro)}` }))} />}
        </Card>

        <Card title="Mağaza hedefleri" subtitle={`${ayAdi} ayı`} action={tumu('magazalar')}>
          {yukleniyor ? <Skeleton h={120} /> : hedefliMagazalar.length === 0 ? (
            <EmptyState compact title="Hedef tanımlanmamış" text="Mağazalar sayfasından aylık hedef girin." />
          ) : (
            <div className="vg-stack" style={{ gap: 14 }}>
              {hedefliMagazalar.map(m => {
                const mCiro = satislar.filter(s => s.magazaId === m.id).reduce((t, s) => t + Number(s.genelToplam || 0), 0)
                return <HedefSatiri key={m.id} ad={m.ad} gercek={mCiro} hedef={Number(m.aylikHedef)} />
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Personel + Bekleyen siparişler + Son satışlar */}
      <div className="vg-grid-3">
        <Card title="Personel hedefleri" subtitle={`${ayAdi} ayı`} action={tumu('kullanicilar')}>
          {yukleniyor ? <Skeleton h={120} /> : personelPerf.length === 0 ? (
            <EmptyState compact title="Personel verisi yok" />
          ) : (
            <div className="vg-stack" style={{ gap: 14 }}>
              {personelPerf.map(p => (
                <HedefSatiri key={p.id} ad={`${p.ad} ${p.soyad || ''}`} gercek={p.buAyCiro} hedef={Number(p.aylikHedef || 0)} />
              ))}
              {personelPerf.every(p => !p.aylikHedef) && (
                <div className="vg-help">Hedef tanımlamak için Kullanıcılar sayfasına gidin.</div>
              )}
            </div>
          )}
        </Card>

        <Card title="Bekleyen siparişler" action={tumu('siparisler')} padded={false}>
          {yukleniyor ? <div className="vg-card__body"><Skeleton h={120} /></div> : siparisler.length === 0 ? (
            <EmptyState compact tone="success" icon={CircleCheck} title="Bekleyen sipariş yok" />
          ) : (
            <ul className="vg-list" style={{ paddingTop: 6 }}>
              {siparisler.map(s => (
                <li key={s.id}>
                  <button className="vg-list__item vg-list__item--button" onClick={() => git('siparisler')}>
                    <div className="vg-list__main">
                      <div className="vg-list__primary"><span className="vg-code">#{s.siparisNo}</span></div>
                      <div className="vg-list__secondary vg-truncate">{s.musteriAd || s.adres || '—'} · {tarihTR(s.tarih)}</div>
                    </div>
                    <div className="vg-list__value">{para(s.genelToplam)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Son satışlar" action={tumu('raporlar')} padded={false}>
          {yukleniyor ? <div className="vg-card__body"><Skeleton h={120} /></div> : satislar.length === 0 ? (
            <EmptyState compact icon={Receipt} title="Bu ay satış yok" />
          ) : (
            <ul className="vg-list" style={{ paddingTop: 6 }}>
              {satislar.slice(0, 6).map(s => (
                <li key={s.id}>
                  <button className="vg-list__item vg-list__item--button" onClick={() => git('raporlar')}>
                    <div className="vg-list__main">
                      <div className="vg-list__primary"><span className="vg-code">{s.fisNo}</span></div>
                      <div className="vg-list__secondary vg-truncate">{s.kasiyer || s.kullanici?.ad || '—'} · {s.kalemler?.length || 0} kalem</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="vg-list__value">{para(s.genelToplam)}</div>
                      <div className="vg-list__secondary">{tarihTR(s.tarih)} {saatTR(s.tarih)}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  )
}
