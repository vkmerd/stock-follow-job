import Dashboard from './dashboard'
import { useState, useEffect, useRef } from 'react'
import { VegaProvider, useVega, ROLLER, izinVar } from './VegaContext'
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
import { Button, IconButton, Field, Input, Banner, Menu, UIHost, MagazaIkon } from './ui'
import {
  LayoutDashboard, Package, ShoppingBag, CreditCard, Landmark, ArrowLeftRight, UserRound,
  ChartColumn, Users, Store, Undo2, Wallet, Tag, Search, Bell, Moon, Sun, LogOut, Menu as MenuIcon,
  ChevronDown, ShoppingCart, Check,
} from 'lucide-react'

// ─── LOGO ─────────────────────────────────────────────────────
function VegaLogo({ size = 30 }) {
  return <img src="/assets/VegaLogo.jpg" width={size} height={size} alt="Vega" style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
}


// ─── GİRİŞ EKRANI ─────────────────────────────────────────────
function GirisEkrani() {
  const { girisYap, yukleniyor } = useVega()
  const [email, setEmail]   = useState('admin@vega.com')
  const [sifre, setSifre]   = useState('')
  const [hata, setHata]     = useState('')

  const giris = async (e) => {
    e?.preventDefault()
    if (!email || !sifre) return setHata('E-posta ve şifre zorunlu.')
    setHata('')
    try {
      await girisYap(email, sifre)
    } catch (err) {
      setHata(err.message || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.')
    }
  }

  return (
    <div className="vg-login">
      <aside className="vg-login__aside">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
          <VegaLogo size={36} /> Vega Panel
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 34, lineHeight: '40px', fontWeight: 600, letterSpacing: '-0.02em', maxWidth: 420, textWrap: 'balance' }}>
            Mağaza, stok ve siparişleriniz tek yerde.
          </div>
          <div style={{ marginTop: 12, color: 'var(--on-chrome-muted)', fontSize: 14, maxWidth: 380 }}>
            Satış ve kasa, online siparişler, stok, cari ve raporlar. Vega Ayakkabı & Çanta için.
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--on-chrome-muted)' }}>powered by KMM</div>
        <svg aria-hidden="true" viewBox="0 0 400 400" style={{ position: 'absolute', right: -60, top: 60, width: 360, opacity: 0.9 }}>
          <rect x="40" y="0" width="140" height="220" rx="12" fill="var(--brand-brush)" />
          <rect x="196" y="40" width="140" height="120" rx="12" fill="var(--accent)" />
          <rect x="196" y="176" width="140" height="120" rx="12" fill="#ffffff" opacity="0.08" />
          <rect x="212" y="196" width="80" height="10" rx="5" fill="#ffffff" opacity="0.3" />
          <rect x="212" y="220" width="104" height="10" rx="5" fill="#ffffff" opacity="0.3" />
          <rect x="212" y="244" width="56" height="10" rx="5" fill="#ffffff" opacity="0.3" />
        </svg>
      </aside>
      <main className="vg-login__main">
        <form className="vg-login__card" onSubmit={giris}>
          <VegaLogo size={64} />
          <div>
            <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, letterSpacing: '-0.01em' }}>Giriş yapın</h1>
            <p className="vg-page-subtitle">Mağaza yönetim sistemine hoş geldiniz.</p>
          </div>
          <Field label="E-posta" htmlFor="giris-email">
            <Input id="giris-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@vega.com" size="lg" />
          </Field>
          <Field label="Şifre" htmlFor="giris-sifre">
            <Input id="giris-sifre" type="password" autoComplete="current-password" value={sifre} onChange={e => { setSifre(e.target.value); setHata('') }} placeholder="Şifreniz" size="lg" />
          </Field>
          {hata && <Banner tone="critical">{hata}</Banner>}
          <Button type="submit" variant="primary" size="lg" block loading={yukleniyor}>
            {yukleniyor ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </Button>
        </form>
      </main>
    </div>
  )
}
//admin@vega.com / vega123

// ─── MENÜ ─────────────────────────────────────────────────────
const NAV_TANIM = [
  { id: 'dashboard',        label: 'Dashboard',          ikon: LayoutDashboard, izin: 'hepsi', bolum: null },
  { id: 'satis',            label: 'Satış ve kasa',      ikon: CreditCard,      izin: 'satis', bolum: 'Satış' },
  { id: 'siparisler',       label: 'Online siparişler',  ikon: ShoppingBag,     izin: 'satis', bolum: 'Satış', rozet: 'siparis' },
  { id: 'iadeler',          label: 'İadeler',            ikon: Undo2,           izin: 'hepsi', bolum: 'Satış' },
  { id: 'musteri',          label: 'Müşteriler',         ikon: UserRound,       izin: 'musteri', bolum: 'Satış' },
  { id: 'stok',             label: 'Stok yönetimi',      ikon: Package,         izin: 'stok_goruntule', bolum: 'Ürün' },
  { id: 'shopify-urunleri', label: 'Shopify ürünleri',   ikon: ShoppingCart,    izin: 'hepsi', bolum: 'Ürün' },
  { id: 'marka-urunleri',   label: 'Marka ürünleri',     ikon: Tag,             izin: 'hepsi', bolum: 'Ürün' },
  { id: 'banka',            label: 'Banka ve mutabakat', ikon: Landmark,        izin: 'hepsi', bolum: 'Finans' },
  { id: 'cari',             label: 'Borç / alacak',      ikon: ArrowLeftRight,  izin: 'hepsi', bolum: 'Finans' },
  { id: 'masraf',           label: 'Masraflar',          ikon: Wallet,          izin: 'hepsi', bolum: 'Finans' },
  { id: 'raporlar',         label: 'Raporlar',           ikon: ChartColumn,     izin: 'hepsi', bolum: 'Finans' },
  { id: 'kullanicilar',     label: 'Kullanıcılar',       ikon: Users,           izin: 'hepsi', bolum: 'Yönetim' },
  { id: 'magazalar',        label: 'Mağazalar',          ikon: Store,           izin: 'hepsi', bolum: 'Yönetim' },
]

// Üst bardaki sayfa arama (Ctrl K)
function SayfaArama({ nav, onGit }) {
  const [q, setQ] = useState('')
  const [acik, setAcik] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const kisayol = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus() } }
    document.addEventListener('keydown', kisayol)
    return () => document.removeEventListener('keydown', kisayol)
  }, [])
  const norm = s => s.toLocaleLowerCase('tr-TR')
  const sonuc = q ? nav.filter(n => norm(n.label).includes(norm(q)) || norm(n.bolum || '').includes(norm(q))) : nav
  const git = n => { onGit(n.id); setQ(''); setAcik(false); ref.current?.blur() }
  return (
    <div className="vg-topbar__search">
      <Search className="vg-icon" />
      <input ref={ref} value={q} placeholder="Sayfa ara" aria-label="Sayfa ara"
        onChange={e => { setQ(e.target.value); setAcik(true) }}
        onFocus={() => setAcik(true)} onBlur={() => setTimeout(() => setAcik(false), 150)}
        onKeyDown={e => { if (e.key === 'Enter' && sonuc[0]) git(sonuc[0]); if (e.key === 'Escape') ref.current?.blur() }} />
      <kbd>Ctrl K</kbd>
      {acik && (
        <div className="vg-menu" style={{ left: 0, right: 0 }}>
          {sonuc.length === 0 && <div className="vg-menu__label">"{q}" ile eşleşen sayfa yok</div>}
          {sonuc.map(n => (
            <button key={n.id} type="button" className="vg-menu__item" onMouseDown={e => e.preventDefault()} onClick={() => git(n)}>
              <n.ikon className="vg-icon" />{n.label}
              {n.bolum && <span style={{ marginLeft: 'auto', color: 'var(--ink-muted)', fontSize: 12 }}>{n.bolum}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ANA UYGULAMA (inner) ─────────────────────────────────────
function VegaAppInner() {
  const { kullanici, cikisYap, t, temaToggle, tema, rol, magazalar, aktifMagaza, setAktifMagaza } = useVega()
  const [aktifSayfa, setAktifSayfa]   = useState('dashboard')
  // Dashboard'daki "Kritik Stok" kartına tıklanınca Stok Yönetimi'nin hangi sekmesiyle
  // açılacağını taşır — StokYonetimi her giriş çıkışta unmount olduğu için bu, normal
  // sidebar tıklamasında (aşağıda sıfırlanıyor) varsayılan "liste" sekmesini bozmaz.
  const [stokHedefSekme, setStokHedefSekme] = useState(null)
  const [sidebarAcik, setSidebarAcik] = useState(true)
  const [cekmeceAcik, setCekmeceAcik] = useState(false)
  const [bekleyenSiparis, setBekleyenSiparis] = useState(0)

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

  const NAV = NAV_TANIM.filter(n => izinVar(rol, n.izin))
  const rozetler = { siparis: bekleyenSiparis }

  const sayfayaGit = (id) => { setStokHedefSekme(null); setAktifSayfa(id); setCekmeceAcik(false) }
  const menuDugme = () => {
    if (window.matchMedia('(max-width: 900px)').matches) setCekmeceAcik(a => !a)
    else setSidebarAcik(a => !a)
  }

  const aktifKanal = aktifMagaza === 'hepsi' ? null : magazalar.find(m => m.id === aktifMagaza)
  const KanalIkon = aktifKanal ? (p => <MagazaIkon ikon={aktifKanal.ikon} {...p} />) : Store
  const basHarf = `${kullanici.ad?.[0] || ''}${kullanici.soyad?.[0] || ''}`.toLocaleUpperCase('tr-TR') || 'V'

  return (
    <div className="vg-shell">
      {/* ÜST BAR */}
      <header className="vg-topbar">
        <IconButton icon={MenuIcon} label={sidebarAcik ? 'Menüyü daralt' : 'Menüyü aç'} onClick={menuDugme} />
        <div className="vg-topbar__brand"><VegaLogo size={30} /><span>Vega Panel</span></div>

        <Menu align="left" trigger={({ toggle }) => (
          <Button variant="plain" size="sm" icon={KanalIkon} iconRight={ChevronDown} onClick={toggle} style={{ color: 'var(--on-chrome)' }}>
            {aktifKanal ? aktifKanal.ad : 'Tüm kanallar'}
          </Button>
        )} items={[
          { label: 'Satış kanalı' },
          { text: 'Tüm kanallar', icon: aktifMagaza === 'hepsi' ? Check : Store, onClick: () => setAktifMagaza('hepsi') },
          ...magazalar.map(m => ({ text: m.ad, icon: aktifMagaza === m.id ? Check : (p => <MagazaIkon ikon={m.ikon} {...p} />), onClick: () => setAktifMagaza(m.id) })),
        ]} />

        <SayfaArama nav={NAV} onGit={sayfayaGit} />

        <div className="vg-topbar__end">
          <IconButton icon={tema === 'karanlik' ? Sun : Moon} label={tema === 'karanlik' ? 'Açık temaya geç' : 'Koyu temaya geç'} onClick={temaToggle} />
          <Menu trigger={({ toggle }) => (
            <Button variant="plain" icon={Bell} aria-label={`${bekleyenSiparis} bekleyen sipariş`} title="Bildirimler" onClick={toggle}>
              {bekleyenSiparis > 0 && <span className="vg-topbar__badge">{bekleyenSiparis}</span>}
            </Button>
          )} items={[
            { label: 'Bildirimler' },
            bekleyenSiparis > 0
              ? { text: `${bekleyenSiparis} online sipariş onay bekliyor`, icon: ShoppingBag, onClick: () => sayfayaGit('siparisler') }
              : { label: 'Yeni bildirim yok' },
          ]} />
          <Menu trigger={({ toggle }) => (
            <button className="vg-user" onClick={toggle} aria-label="Kullanıcı menüsü">
              <span className="vg-avatar">{basHarf}</span>
              <div>{kullanici.ad}<small>{ROLLER[rol]?.label}</small></div>
            </button>
          )} items={[
            { label: `${kullanici.ad} ${kullanici.soyad || ''} · ${kullanici.email || ROLLER[rol]?.label || ''}` },
            { text: tema === 'karanlik' ? 'Açık tema' : 'Koyu tema', icon: tema === 'karanlik' ? Sun : Moon, onClick: temaToggle },
            '-',
            { text: 'Çıkış yap', icon: LogOut, tone: 'critical', onClick: cikisYap },
          ]} />
        </div>
      </header>

      <div className={`vg-body${sidebarAcik ? '' : ' is-collapsed'}${cekmeceAcik ? ' is-drawer-open' : ''}`}>
        {/* SOL MENÜ */}
        <nav className="vg-sidebar" aria-label="Ana menü">
          {NAV.map((n, i) => {
            const bolumBasi = n.bolum && n.bolum !== NAV[i - 1]?.bolum
            const rozet = n.rozet ? rozetler[n.rozet] : 0
            return (
              <div key={n.id} style={{ display: 'contents' }}>
                {bolumBasi && <div className="vg-nav-section">{n.bolum}</div>}
                <button className="vg-nav-item" aria-current={aktifSayfa === n.id ? 'page' : undefined} onClick={() => sayfayaGit(n.id)}>
                  <n.ikon className="vg-icon" />
                  <span className="vg-truncate">{n.label}</span>
                  {rozet > 0 && <span className="vg-count">{rozet}</span>}
                </button>
              </div>
            )
          })}
          <div className="vg-sidebar__footer">Vega Ayakkabı & Çanta</div>
        </nav>
        <div className="vg-scrim" onClick={() => setCekmeceAcik(false)} />

        {/* İÇERİK */}
        <main className="vg-main">
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
          <div style={{ display: aktifSayfa === 'satis' ? 'flex' : 'none', flex: 1, overflow: 'hidden', flexDirection: 'column', height: '100%' }}><SatisKasa t={t} kullanici={kullanici} aktifMagaza={aktifMagaza} aktif={aktifSayfa === 'satis'} /></div>
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
        </main>
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────
export default function VegaApp() {
  return (
    <VegaProvider>
      <VegaAppInner />
      <UIHost />
    </VegaProvider>
  )
}
