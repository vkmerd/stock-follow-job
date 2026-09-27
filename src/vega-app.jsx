import Dashboard from './dashboard'
import { useState, useEffect, useCallback } from 'react'
import { VegaProvider, useVega, TEMALAR, ROLLER, izinVar } from './VegaContext'
import * as api from './api'
import StokYonetimi from './stok-yonetimi'
import SatisKasa from './satis-kasa'
import BankaMutabakat from './banka-mutabakat'
import BorcAlacak from './borc-alacak'
import MusteriCRM from './musteri-crm'
import Raporlar from './raporlar'
import KullaniciYonetimi from './kullanici-yonetimi'
import MagazaYonetimi from './magaza-yonetimi'
import IadeYonetimi from './iade-yonetimi'
import MasrafYonetimi from './masraf-yonetimi'
import OnlineSiparisler from './online-siparisler'
import ShopifyUrunleri from './shopify-urunleri'
import MarkaUrunleri from './MarkaUrunleri'

// ─── YARDIMCI ─────────────────────────────────────────────────
const para = v => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const tarihTR = iso => { const d = new Date(iso); return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) }

// ─── LOGO ─────────────────────────────────────────────────────
function VegaLogo({ size = 32 }) {
  return <img src="/assets/VegaLogo.jpg" height={size} alt="Vega Logo" style={{ objectFit: 'contain' }} />
}

// ─── GİRİŞ EKRANI ─────────────────────────────────────────────
function GirisEkrani() {
  const { girisYap, yukleniyor, t } = useVega()
  const [email, setEmail]   = useState('admin@vega.com')
  const [sifre, setSifre]   = useState('')
  const [hata, setHata]     = useState('')

  const giris = async () => {
    if (!email || !sifre) return setHata('Email ve şifre zorunlu')
    setHata('')
    try {
      await girisYap(email, sifre)
    } catch (e) {
      setHata(e.message || 'Giriş başarısız')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,600;0,700&family=DM+Sans:wght@300;400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}button{cursor:pointer;border:none;background:none;font-family:inherit;}input,select{font-family:inherit;}`}</style>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 20, padding: '40px 44px', width: 380, textAlign: 'center' }}>
        <div style={{ marginBottom: 28 }}><VegaLogo size={150} /></div>
        <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 20, color: t.text, marginBottom: 6 }}>Mağaza Yönetim Sistemi</div>
        <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 28 }}>Lütfen giriş yapın</div>

        <div style={{ textAlign: 'left', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Email</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="email@vega.com"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 14, outline: 'none' }} />
        </div>

        <div style={{ textAlign: 'left', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Şifre</div>
          <input type="password" value={sifre} onChange={e => { setSifre(e.target.value); setHata('') }}
            onKeyDown={e => e.key === 'Enter' && giris()}
            placeholder="Şifrenizi girin..."
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 14, outline: 'none' }} />
        </div>

        {hata && <div style={{ padding: '8px 14px', background: 'rgba(235,87,87,0.1)', border: '1px solid rgba(235,87,87,0.3)', borderRadius: 8, fontSize: 12, color: '#eb5757', marginBottom: 16, textAlign: 'left' }}>{hata}</div>}

        <button onClick={giris} disabled={yukleniyor} style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: `linear-gradient(135deg,${t.accentBg},rgba(201,184,130,0.08))`, border: `1px solid ${t.accent}55`, color: t.accent, fontSize: 15, fontWeight: 700, opacity: yukleniyor ? .7 : 1 }}>
          {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap →'}
        </button>
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 14 }}>powered by KMM</div>
      </div>
    </div>
  )
}
//admin@vega.com / vega123
// ─── ONLINE SİPARİŞLER ────────────────────────────────────────


// ─── DASHBOARD ────────────────────────────────────────────────


// ─── ANA UYGULAMA (inner) ─────────────────────────────────────
function VegaAppInner() {
  const { kullanici, cikisYap, t, temaToggle, tema, rol, magazalar, aktifMagaza, setAktifMagaza } = useVega()
  const [aktifSayfa, setAktifSayfa]   = useState('dashboard')
  // Dashboard'daki "Kritik Stok" kartına tıklanınca Stok Yönetimi'nin hangi sekmesiyle
  // açılacağını taşır — StokYonetimi her giriş çıkışta unmount olduğu için bu, normal
  // sidebar tıklamasında (aşağıda sıfırlanıyor) varsayılan "liste" sekmesini bozmaz.
  const [stokHedefSekme, setStokHedefSekme] = useState(null)
  const [sidebarAcik, setSidebarAcik] = useState(true)
  const [bekleyenSiparis, setBekleyenSiparis] = useState(0)
  const [bekleyenIade, setBekleyenIade] = useState(0)

  useEffect(() => {
    if (!kullanici) return
    const interval = setInterval(() => {
      api.siparisleriGetir({ durum: 'beklemede', limit: 1 })
        .then(d => setBekleyenSiparis(d.length))
        .catch(() => {})
    }, 30000)
    api.siparisleriGetir({ durum: 'beklemede', limit: 1 })
      .then(d => setBekleyenSiparis(d.length))
      .catch(() => {})
    return () => clearInterval(interval)
  }, [kullanici])

  if (!kullanici) return <GirisEkrani />

  const NAV = [
    { id: 'dashboard',    label: 'Dashboard',        ikon: '◈', izin: 'hepsi' },
    { id: 'stok',         label: 'Stok Yönetimi',    ikon: '◫', izin: 'stok_goruntule' },
    { id: 'siparisler',   label: 'Online Siparişler', ikon: '📱', izin: 'satis', rozet: bekleyenSiparis },
    { id: 'satis',        label: 'Satış & Kasa',      ikon: '◎', izin: 'satis' },
    { id: 'banka',        label: 'Banka & Mutabakat', ikon: '▣', izin: 'hepsi' },
    { id: 'cari',         label: 'Borç / Alacak',     ikon: '◐', izin: 'hepsi' },
    { id: 'musteri',      label: 'Müşteri CRM',       ikon: '◑', izin: 'musteri' },
    { id: 'raporlar',     label: 'Raporlar',          ikon: '◉', izin: 'hepsi' },
    { id: 'kullanicilar', label: 'Kullanıcılar',      ikon: '👥', izin: 'hepsi' },
    { id: 'magazalar',    label: 'Mağazalar',          ikon: '🏪', izin: 'hepsi' },
    { id: 'iadeler', label: 'İadeler', ikon: '↩', izin: 'hepsi' },
    { id: 'masraf',  label: 'Masraf Yönetimi', ikon: '💸', izin: 'hepsi' },
    { id: 'shopify-urunleri',  label: 'Shopify Ürünleri', ikon: '️💸', izin: 'hepsi' },
    { id: 'marka-urunleri',  label: 'Marka Ürünleri', ikon: '️📦', izin: 'hepsi' },
  ].filter(n => izinVar(rol, n.izin))

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'DM Sans',sans-serif", display: 'flex', flexDirection: 'column',
      '--bg-color': t.sidebar||t.bg, '--text-color': t.text, '--input-color': t.input }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        select option{background:var(--bg-color);color:var(--text-color);}
        select{color:var(--text-color);}select option{background:var(--bg-color)!important;color:var(--text-color)!important;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#333;border-radius:4px;}
        button{cursor:pointer;border:none;background:none;font-family:inherit;}
        input,select,textarea{font-family:inherit;}
        tbody tr:hover td{background:rgba(255,255,255,0.015);}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
      `}</style>

      {/* TOPBAR */}
      <div style={{ height: 56, background: t.sidebar, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, flexShrink: 0, zIndex: 10 }}>
        <button onClick={() => setSidebarAcik(!sidebarAcik)} style={{ color: t.textMuted, fontSize: 18 }}>☰</button>
        <VegaLogo size={28} />
        <div style={{ width: 1, height: 20, background: t.border }} />

        {/* Mağaza seçici */}
        <div style={{ display: 'flex', gap: 6, flex: 1, overflowX: 'auto' }}>
          <button onClick={() => setAktifMagaza('hepsi')} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, background: aktifMagaza === 'hepsi' ? t.accentBg : 'transparent', border: `1px solid ${aktifMagaza === 'hepsi' ? t.accent + '55' : t.border}`, color: aktifMagaza === 'hepsi' ? t.accent : t.textMuted, whiteSpace: 'nowrap' }}>Tüm Kanallar</button>
          {magazalar.map(m => (
            <button key={m.id} onClick={() => setAktifMagaza(m.id)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, whiteSpace: 'nowrap', background: aktifMagaza === m.id ? `${m.renk || t.accent}18` : 'transparent', border: `1px solid ${aktifMagaza === m.id ? (m.renk || t.accent) + '55' : t.border}`, color: aktifMagaza === m.id ? (m.renk || t.accent) : t.textMuted }}>
              {m.ikon} {m.ad}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
          <button onClick={temaToggle} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, background: t.accentBg, border: `1px solid ${t.accent}44`, color: t.accent }}>
            {tema === 'karanlik' ? '☀ Açık' : '🌙 Koyu'}
          </button>

          {bekleyenSiparis > 0 && (
            <button onClick={() => setAktifSayfa('siparisler')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, background: 'rgba(242,201,76,0.15)', border: '1px solid rgba(242,201,76,0.4)', color: '#f2c94c', fontWeight: 600 }}>
              ⏳ {bekleyenSiparis} Yeni Sipariş
            </button>
          )}

          <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, background: `${ROLLER[rol]?.renk || t.accent}18`, color: ROLLER[rol]?.renk || t.accent, fontWeight: 600 }}>
            {kullanici.ad} · {ROLLER[rol]?.label}
          </div>

          <button onClick={cikisYap} style={{ color: t.textMuted, fontSize: 12, padding: '5px 10px', borderRadius: 8, border: `1px solid ${t.border}` }}>Çıkış</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SIDEBAR */}
        <div style={{ width: sidebarAcik ? 220 : 0, overflow: 'hidden', transition: 'width .25s ease', background: t.sidebar, borderRight: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => { setStokHedefSekme(null); setAktifSayfa(n.id) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, textAlign: 'left', whiteSpace: 'nowrap', position: 'relative', background: aktifSayfa === n.id ? t.accentBg : 'transparent', color: aktifSayfa === n.id ? t.accent : t.textMuted, fontSize: 13, fontWeight: aktifSayfa === n.id ? 600 : 400 }}>
                <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{n.ikon}</span>
                {n.label}
                {n.rozet > 0 && <span style={{ marginLeft: 'auto', background: '#f2c94c', color: '#111', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>{n.rozet}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* İÇERİK */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {aktifSayfa === 'dashboard'    && <Dashboard t={t} kullanici={kullanici}
            onKritikStokTikla={() => { setStokHedefSekme('alim'); setAktifSayfa('stok') }}
            onNavigate={(sayfa, sekme) => {
              // Yalnızca kullanıcının erişebildiği (NAV'da yer alan) sayfalara git
              if (!NAV.some(n => n.id === sayfa)) return
              setStokHedefSekme(sekme || null)
              setAktifSayfa(sayfa)
            }} />}
          {aktifSayfa === 'siparisler' && <OnlineSiparisler t={t} />}
          {aktifSayfa === 'stok'         && <StokYonetimi t={t} rol={rol} hedefSekme={stokHedefSekme} />}
          <div style={{display:aktifSayfa==='satis'?'flex':'none',flex:1,overflow:'hidden',flexDirection:'column',height:'100%'}}><SatisKasa t={t} kullanici={kullanici} aktifMagaza={aktifMagaza} aktif={aktifSayfa==='satis'} /></div>
          {aktifSayfa === 'banka'        && <BankaMutabakat t={t} />}
          {aktifSayfa === 'cari'         && <BorcAlacak t={t} />}
          {aktifSayfa === 'musteri'      && <MusteriCRM t={t} />}
          {aktifSayfa === 'raporlar'     && <Raporlar t={t} />}
          {aktifSayfa === 'shopify-urunleri' && <ShopifyUrunleri t={t} />}
          {aktifSayfa === 'kullanicilar' && izinVar(rol, 'hepsi') && <KullaniciYonetimi t={t} />}
          {aktifSayfa === 'magazalar'    && izinVar(rol, 'hepsi') && <MagazaYonetimi t={t} />}
          {aktifSayfa === 'iadeler'      && <IadeYonetimi t={t} rol={rol} />}
          {aktifSayfa === 'masraf'       && <MasrafYonetimi t={t} />}
          {aktifSayfa === 'marka-urunleri' && <MarkaUrunleri />}
        </div>
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────
export default function VegaApp() {
  return (
    <VegaProvider>
      <VegaAppInner />
    </VegaProvider>
  )
}
