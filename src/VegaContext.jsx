import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as api from './api'

// ─── TEMA ─────────────────────────────────────────────────────
export const TEMALAR = {
  karanlik: {
    bg: '#0c0b09', sidebar: '#0a0908', card: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)', text: '#e8e0d4', textMuted: '#666',
    accent: '#c9b882', accentBg: 'rgba(201,184,130,0.15)',
    input: 'rgba(255,255,255,0.06)', hover: 'rgba(255,255,255,0.06)',
  },
  aydinlik: {
    bg: '#f5f2ee', sidebar: '#fff', card: '#ffffff',
    border: 'rgba(0,0,0,0.1)', text: '#2a2520', textMuted: '#888',
    accent: '#8b6914', accentBg: 'rgba(139,105,20,0.1)',
    input: 'rgba(0,0,0,0.06)', hover: 'rgba(0,0,0,0.04)',
  },
}

// ─── ROL ──────────────────────────────────────────────────────
export const ROLLER = {
  admin:   { label: 'Admin',            renk: '#c9b882', izinler: ['hepsi'] },
  satis:   { label: 'Satış Yetkilisi',  renk: '#6fcf97', izinler: ['satis', 'musteri', 'stok_goruntule'] },
  kasiyer: { label: 'Kasiyer',          renk: '#56ccf2', izinler: ['satis'] },
  depo:    { label: 'Depo Sorumlusu',   renk: '#bb87fc', izinler: ['stok_goruntule', 'stok_duzenle'] },
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
  const [tema, setTema]             = useState('karanlik')
  const [kullanici, setKullanici]   = useState(null)   // giriş yapan kullanıcı
  const [magazalar, setMagazalar]   = useState([])
  const [aktifMagaza, setAktifMagaza] = useState('hepsi')
  const [yukleniyor, setYukleniyor] = useState(false)

  const t = TEMALAR[tema]

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
      { id: 'online-instagram', ad: 'Instagram', tip: 'online', ikon: '📱', renk: '#56ccf2' },
      { id: 'online-web', ad: 'Web Sitesi', tip: 'online', ikon: '🌐', renk: '#bb87fc' },
    ]

    setMagazalar([
      ...data.map(m => ({ ...m, tip: 'fiziksel', ikon: '🏪', renk: '#c9b882' })),
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
