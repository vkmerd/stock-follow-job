import { useState, useEffect } from 'react'
import * as api from './api'

const para = v => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const tarihTR = iso => iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

function KPIKart({ ikon, baslik, deger, alt, renk = '#c9b882', trend, t, onClick }) {
  return (
    <div onClick={onClick} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 22 }}>{ikon}</div>
        {trend != null && (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: trend >= 0 ? 'rgba(111,207,151,.15)' : 'rgba(235,87,87,.15)', color: trend >= 0 ? '#6fcf97' : '#eb5757' }}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontFamily: "'Playfair Display',serif", fontWeight: 700, color: renk }}>{deger}</div>
      <div>
        <div style={{ fontSize: 12, color: t.textMuted }}>{baslik}</div>
        {alt && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{alt}</div>}
      </div>
    </div>
  )
}

function HedefBar({ ad, gercek, hedef, renk = '#c9b882', t }) {
  const yuzde = hedef > 0 ? Math.min(100, Math.round((gercek / hedef) * 100)) : 0
  const barRenk = yuzde >= 100 ? '#6fcf97' : yuzde >= 60 ? renk : '#eb5757'
  return (
    <div style={{ padding: '12px 0', borderBottom: `1px solid ${t.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{ad}</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>{para(gercek)}</span>
          <span style={{ fontSize: 12, color: t.textMuted }}>/ {para(hedef)}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: barRenk }}>{yuzde}%</span>
        </div>
      </div>
      <div style={{ height: 8, background: t.input, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${yuzde}%`, background: barRenk, borderRadius: 4, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

export default function Dashboard({ t, kullanici, onKritikStokTikla, onNavigate }) {
  // Dashboard'daki her kart/panel ilgili sayfaya yönlendirir. onNavigate izin
  // kontrolünü kendisi yapar; izin yoksa sessizce yok sayar.
  const git = (sayfa, sekme) => { if (onNavigate) onNavigate(sayfa, sekme) }
  // Tıklanabilir panel sarmalayıcısı için ortak stil + başlık oku
  const panelTikla = (sayfa, sekme) => ({
    onClick: () => git(sayfa, sekme),
    style: { cursor: 'pointer' },
    title: 'Aç →',
  })
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
  const ciroTrend        = gecenAyCiro > 0 ? Math.round(((aylikCiro - gecenAyCiro) / gecenAyCiro) * 100) : null

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
  const maxCiro = Math.max(...gunlukCiro.map(g => g.ciro), 1)

  if (yukleniyor) return <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>Yükleniyor...</div>

  return (
    <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Başlık */}
      <div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: t.text }}>
          Merhaba{kullanici?.ad ? `, ${kullanici.ad}` : ''} 👋
        </div>
        <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
          {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* KPI Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KPIKart ikon="💰" baslik="Bugünkü Ciro" deger={para(bugunCiro)} alt={`${bugunSatislar.length} satış`} renk={t.accent} t={t} onClick={() => git('raporlar')} />
        <KPIKart ikon="📊" baslik="Aylık Ciro" deger={para(aylikCiro)} alt={`${satislar.length} satış`} renk="#6fcf97" trend={ciroTrend} t={t} onClick={() => git('raporlar')} />
        <KPIKart ikon="⏳" baslik="Bekleyen Sipariş" deger={siparisler.length} alt="Online siparişler" renk="#f2c94c" t={t} onClick={() => git('siparisler')} />
        <KPIKart ikon="⚠" baslik="Kritik Stok" deger={stokUyari.length} alt="Stok uyarısı" renk="#eb5757" t={t} onClick={onKritikStokTikla || (() => git('stok', 'alim'))} />
      </div>

      {/* Grafik + Personel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* Günlük ciro grafiği */}
        <div {...panelTikla('raporlar')} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, cursor: 'pointer' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>📈 Son 14 Gün Ciro <span style={{ color: t.textMuted, fontWeight: 400 }}>↗</span></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
            {gunlukCiro.map(({ gun, ciro }) => {
              const pct = (ciro / maxCiro) * 100
              const isToday = gun === bugun
              return (
                <div key={gun} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div title={`${gun}: ${para(ciro)}`} style={{ width: '100%', background: isToday ? t.accent : `${t.accent}55`, borderRadius: '3px 3px 0 0', height: `${Math.max(pct * 1.4, 2)}px`, transition: 'height .4s', cursor: 'default' }} />
                  <div style={{ fontSize: 8, color: isToday ? t.accent : t.textMuted, fontWeight: isToday ? 700 : 400 }}>{gun.slice(8)}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: t.textMuted }}>
            <span>{son14gun[0].slice(5)}</span>
            <span>Bugün: {para(bugunCiro)}</span>
          </div>
        </div>

        {/* Mağaza hedef takibi */}
        <div {...panelTikla('magazalar')} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, cursor: 'pointer' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>🏪 Mağaza Hedef Takibi <span style={{ color: t.textMuted, fontWeight: 400 }}>↗</span></div>
          {magazalar.filter(m => Number(m.aylikHedef) > 0).length === 0 ? (
            <div style={{ color: t.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Hedef tanımlanmamış</div>
          ) : (
            magazalar.filter(m => Number(m.aylikHedef) > 0).map(m => {
              const mCiro = satislar.filter(s => s.magazaId === m.id).reduce((t, s) => t + Number(s.genelToplam || 0), 0)
              return <HedefBar key={m.id} ad={m.ad} gercek={mCiro} hedef={Number(m.aylikHedef)} renk={m.renk||'#c9b882'} t={t} />
            })
          )}
        </div>

        {/* Personel hedef takibi */}
        <div {...panelTikla('kullanicilar')} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, cursor: 'pointer' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>🎯 Personel Hedef Takibi <span style={{ color: t.textMuted, fontWeight: 400 }}>↗</span></div>
          {personelPerf.length === 0 ? (
            <div style={{ color: t.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Personel verisi bulunamadı</div>
          ) : (
            personelPerf.map(p => (
              <HedefBar key={p.id} ad={`${p.ad} ${p.soyad || ''}`} gercek={p.buAyCiro} hedef={Number(p.aylikHedef || 0)} t={t} />
            ))
          )}
          {personelPerf.every(p => !p.aylikHedef) && (
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>Hedef tanımlamak için Kullanıcılar sayfasına gidin.</div>
          )}
        </div>
      </div>

      {/* Bekleyen siparişler + Aktivite */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Bekleyen siparişler */}
        <div {...panelTikla('siparisler')} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, cursor: 'pointer' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>📦 Bekleyen Siparişler <span style={{ color: t.textMuted, fontWeight: 400 }}>↗</span></div>
          {siparisler.length === 0 ? (
            <div style={{ color: '#6fcf97', fontSize: 13, textAlign: 'center', padding: 20 }}>✓ Bekleyen sipariş yok</div>
          ) : (
            siparisler.map(s => (
              <div key={s.id} style={{ padding: '10px 0', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>#{s.siparisNo}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{s.musteriAd || s.adres || '—'} · {tarihTR(s.tarih)}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{para(s.genelToplam)}</div>
              </div>
            ))
          )}
        </div>

        {/* Son satışlar */}
        <div {...panelTikla('raporlar')} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, cursor: 'pointer' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>🧾 Son Satışlar <span style={{ color: t.textMuted, fontWeight: 400 }}>↗</span></div>
          {satislar.slice(0, 6).map(s => (
            <div key={s.id} style={{ padding: '10px 0', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{s.fisNo}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>
                  {s.kasiyer || s.kullanici?.ad || '—'} · {s.kalemler?.length || 0} kalem
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{para(s.genelToplam)}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{tarihTR(s.tarih)}</div>
              </div>
            </div>
          ))}
          {satislar.length === 0 && <div style={{ color: t.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Bu ay satış bulunamadı</div>}
        </div>
      </div>

    </div>
  )
}
