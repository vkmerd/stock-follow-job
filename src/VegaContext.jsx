import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as api from './api'

// ─── TEMA ─────────────────────────────────────────────────────
// Renkler src/styles/tokens.css içindeki CSS değişkenlerinden gelir; tema
// <html data-theme> ile değişir, bu yüzden iki temada da aynı değerler kullanılır.
const RENKLER = {
  bg: 'var(--canvas)', sidebar: 'var(--surface)', card: 'var(--surface)',
  border: 'var(--line)', text: 'var(--ink)', textMuted: 'var(--ink-muted)',
  accent: 'var(--accent)', accentBg: 'var(--accent-soft)',
  input: 'var(--surface)', hover: 'var(--surface-hover)',
  success: 'var(--success)', successBg: 'var(--success-soft)',
  warning: 'var(--warning)', warningBg: 'var(--warning-soft)',
  critical: 'var(--critical)', criticalBg: 'var(--critical-soft)',
  violet: 'var(--violet)', violetBg: 'var(--violet-soft)',
}
export const TEMALAR = {
  aydinlik: { ...RENKLER, id: 'aydinlik' },
  karanlik: { ...RENKLER, id: 'karanlik' },
}

// ─── ROL ──────────────────────────────────────────────────────
export const ROLLER = {
  admin:   { label: 'Admin',            ton: 'info',    renk: 'var(--accent)',  izinler: ['hepsi'] },
  satis:   { label: 'Satış Yetkilisi',  ton: 'success', renk: 'var(--success)', izinler: ['satis', 'musteri', 'stok_goruntule'] },
  kasiyer: { label: 'Kasiyer',          ton: 'warning', renk: 'var(--warning)', izinler: ['satis'] },
  depo:    { label: 'Depo Sorumlusu',   ton: 'violet',  renk: 'var(--violet)',  izinler: ['stok_goruntule', 'stok_duzenle'] },
}

export function izinVar(rol, izin) {
  return ROLLER[rol]?.izinler.includes('hepsi') || ROLLER[rol]?.izinler.includes(izin)
}

// ─── CONTEXT ──────────────────────────────────────────────────
const VegaCtx = createContext(null)

export function useVega() {
  const ctx = useContext(VegaCtx)
  if (!ctx) throw new Error('useVega must be inside VegaProvider')
  return ctx
}

// ─── PROVIDER ─────────────────────────────────────────────────
export function VegaProvider({ children }) {
  const [tema, setTema]             = useState(() => {
    try { return localStorage.getItem('vega-tema') || 'aydinlik' } catch { return 'aydinlik' }
  })
  const [kullanici, setKullanici]   = useState(null)   // giriş yapan kullanıcı
  const [magazalar, setMagazalar]   = useState([])
  const [aktifMagaza, setAktifMagaza] = useState('hepsi')
  const [yukleniyor, setYukleniyor] = useState(false)

  const t = TEMALAR[tema]

  useEffect(() => {
    const root = document.documentElement

    if (tema === 'karanlik') root.dataset.theme = 'dark'
    else delete root.dataset.theme

    try { localStorage.setItem('vega-tema', tema) } catch (error) { void error }
  }, [tema])

  // Giriş yap
  const girisYap = useCallback(async (email, sifre) => {
    setYukleniyor(true)
    try {
      const data = await api.girisYap({ email, sifre })
      setKullanici(data)
      return data
    } finally {
      setYukleniyor(false)
    }
  }, [])

  // Çıkış yap
  const cikisYap = useCallback(() => {
    setKullanici(null)
    setAktifMagaza('hepsi')
  }, [])

  // Mağazaları yükle (giriş yapıldıktan sonra)
  const yukleMagazalar = useCallback(async () => {
    if (!kullanici) return
    const data = await api.magazalariGetir()

    // Online kanalları da ekle
    const onlineKanallar = [
      { id: 'online-instagram', ad: 'Instagram', tip: 'online', ikon: 'instagram', renk: 'var(--violet)' },
      { id: 'online-web', ad: 'Web Sitesi', tip: 'online', ikon: 'web', renk: 'var(--accent)' },
    ]

    setMagazalar([
      ...data.map(m => ({ ...m, tip: 'fiziksel', ikon: m.ikon || 'magaza', renk: m.renk || 'var(--ink-muted)' })),
      ...onlineKanallar,
    ])
  }, [kullanici])

  useEffect(() => {
    yukleMagazalar().catch(console.error)
  }, [yukleMagazalar])

  const tema_toggle = useCallback(() => {
    setTema(prev => prev === 'karanlik' ? 'aydinlik' : 'karanlik')
  }, [])

  return (
    <VegaCtx.Provider value={{
      // Tema
      tema, t, temaToggle: tema_toggle,
      // Auth
      kullanici, girisYap, cikisYap, yukleniyor,
      rol: kullanici?.rol || 'kasiyer',
      // Mağaza
      magazalar, aktifMagaza, setAktifMagaza, yukleMagazalar,
    }}>
      {children}
    </VegaCtx.Provider>
  )
}
