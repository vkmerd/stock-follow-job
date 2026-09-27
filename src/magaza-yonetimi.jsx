import { useState, useEffect } from 'react'
import * as api from './api'
import { useVega } from './VegaContext'

const MAGAZA_TIPLERI = [
  { id: 'fiziksel', label: 'Fiziksel Mağaza', ikon: '🏪', renk: '#c9b882' },
  { id: 'online',   label: 'Online Kanal',    ikon: '🌐', renk: '#56ccf2' },
]

const IKONLAR = ['🏪', '🛍', '🌐', '📱', '🏬', '🏢', '🏭', '🎯']
const RENKLER = ['#c9b882', '#6fcf97', '#56ccf2', '#bb87fc', '#f2c94c', '#eb5757', '#ff9f43', '#a29bfe']

// ─── MAĞAZA MODAL ─────────────────────────────────────────────
function MagazaModal({ magaza, onKaydet, onKapat, t }) {
  const bos = { ad: '', kod: '', adres: '', telefon: '', email: '', tip: 'fiziksel', ikon: '🏪', renk: '#c9b882', aktif: true, aylikHedef: '' }
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
    if (!form.ad.trim()) return setHata('Mağaza adı zorunlu')
    if (!form.kod.trim()) return setHata('Mağaza kodu zorunlu')
    setHata(''); setKayit(true)
    try {
      if (magaza) await api.magazaGuncelle(magaza.id, form)
      else        await api.magazaEkle(form)
      onKaydet()
    } catch (e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  const inp = (label, key, type = 'text', placeholder = '') => (
    <div>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <input type={type} value={form[key] || ''} onChange={e => g(key, e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }} />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: t.sidebar || '#14120f', border: `1px solid ${t.border}`, borderRadius: 18, padding: '28px 32px', width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: t.text }}>{magaza ? 'Mağaza Düzenle' : 'Yeni Mağaza'}</div>
          <button onClick={onKapat} style={{ color: t.textMuted, fontSize: 20 }}>✕</button>
        </div>

        {/* Tip seçimi */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {MAGAZA_TIPLERI.map(tip => (
            <button key={tip.id} onClick={() => g('tip', tip.id)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13,
              background: form.tip === tip.id ? `${tip.renk}18` : t.input,
              border: `1px solid ${form.tip === tip.id ? tip.renk + '55' : t.border}`,
              color: form.tip === tip.id ? tip.renk : t.textMuted,
              fontWeight: form.tip === tip.id ? 600 : 400
            }}>
              {tip.ikon} {tip.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
            {inp('Mağaza Adı *', 'ad', 'text', 'örn. Merkez Mağaza')}
            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>Kod *</div>
              <input value={form.kod || ''} onChange={e => g('kod', e.target.value.toUpperCase())} placeholder="M1"
                style={{ width: 80, padding: '10px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.accent, fontSize: 14, fontWeight: 700, outline: 'none', textAlign: 'center', fontFamily: 'monospace' }} />
            </div>
          </div>

          {inp('Adres', 'adres', 'text', 'Mağaza adresi...')}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {inp('Telefon', 'telefon', 'tel')}
            {inp('E-posta', 'email', 'email')}
          </div>

          {/* İkon seçimi */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>İkon</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {IKONLAR.map(ikon => (
                <button key={ikon} onClick={() => g('ikon', ikon)} style={{
                  width: 40, height: 40, borderRadius: 10, fontSize: 18,
                  background: form.ikon === ikon ? t.accentBg : t.input,
                  border: `1px solid ${form.ikon === ikon ? t.accent + '55' : t.border}`
                }}>{ikon}</button>
              ))}
            </div>
          </div>

          {/* Renk seçimi */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>Renk</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {RENKLER.map(renk => (
                <button key={renk} onClick={() => g('renk', renk)} style={{
                  width: 28, height: 28, borderRadius: '50%', background: renk,
                  border: `2px solid ${form.renk === renk ? '#fff' : 'transparent'}`,
                  boxShadow: form.renk === renk ? `0 0 0 2px ${renk}` : 'none'
                }} />
              ))}
            </div>
          </div>

          {/* Aylık Hedef */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>Aylık Satış Hedefi (₺)</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }}>₺</span>
              <input type="number" value={form.aylikHedef || ''} onChange={e => g('aylikHedef', e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '10px 14px 10px 28px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.accent, fontSize: 14, fontWeight: 600, outline: 'none' }} />
            </div>
          </div>

          {/* Aktif toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div onClick={() => g('aktif', !form.aktif)} style={{
              width: 40, height: 22, borderRadius: 11,
              background: form.aktif ? t.accent : t.input,
              border: `1px solid ${t.border}`, cursor: 'pointer', position: 'relative', transition: 'background .2s'
            }}>
              <div style={{ position: 'absolute', top: 2, left: form.aktif ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </div>
            <span style={{ fontSize: 13, color: t.text }}>Mağaza {form.aktif ? 'Aktif' : 'Pasif'}</span>
          </div>
        </div>

        {hata && <div style={{ marginTop: 14, padding: '8px 14px', background: 'rgba(235,87,87,0.1)', border: '1px solid rgba(235,87,87,0.3)', borderRadius: 8, fontSize: 12, color: '#eb5757' }}>{hata}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onKapat} style={{ flex: 1, padding: '11px 0', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 13 }}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{ flex: 2, padding: '11px 0', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}55`, color: t.accent, fontSize: 13, fontWeight: 600 }}>
            {kayit ? 'Kaydediliyor...' : magaza ? 'Güncelle' : 'Mağaza Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function MagazaYonetimi({ t }) {
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
    await api.magazaGuncelle(m.id, { aktif: !m.aktif })
    await yenileHepsi()
  }

  if (yukleniyor) return <div style={{ padding: 40, color: t.textMuted }}>Yükleniyor...</div>

  const aktifler = magazalar.filter(m => m.aktif)
  const pasifler = magazalar.filter(m => !m.aktif)

  return (
    <div style={{ padding: '22px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: t.text }}>Mağaza Yönetimi</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
            {aktifler.length} aktif · {pasifler.length} pasif mağaza
          </div>
        </div>
        <button onClick={() => setModal('yeni')} style={{ padding: '10px 20px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}55`, color: t.accent, fontSize: 13, fontWeight: 600 }}>
          + Yeni Mağaza
        </button>
      </div>

      {/* Özet kartlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { l: 'Toplam Mağaza',     v: magazalar.length,                              c: t.accent },
          { l: 'Fiziksel Mağaza',   v: magazalar.filter(m => m.tip !== 'online').length, c: '#6fcf97' },
          { l: 'Online Kanal',      v: magazalar.filter(m => m.tip === 'online').length,  c: '#56ccf2' },
        ].map(k => (
          <div key={k.l} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>{k.l}</div>
            <div style={{ fontSize: 24, fontFamily: "'Playfair Display',serif", fontWeight: 700, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Mağaza kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
        {magazalar.map(m => (
          <div key={m.id} style={{
            background: t.card, border: `1px solid ${m.aktif ? t.border : t.border}`,
            borderRadius: 14, padding: 20, opacity: m.aktif ? 1 : .55,
            borderLeft: `3px solid ${m.renk || t.accent}`
          }}>
            {/* Başlık */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: `${m.renk || t.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {m.ikon || '🏪'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{m.ad}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${m.renk || t.accent}18`, color: m.renk || t.accent, fontFamily: 'monospace', fontWeight: 700 }}>{m.kod}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: t.hover, color: t.textMuted }}>
                    {m.tip === 'online' ? '🌐 Online' : '🏪 Fiziksel'}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: m.aktif ? 'rgba(111,207,151,0.1)' : 'rgba(235,87,87,0.1)', color: m.aktif ? '#6fcf97' : '#eb5757' }}>
                {m.aktif ? '● Aktif' : '● Pasif'}
              </div>
            </div>

            {/* Bilgiler */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
              {m.adres && <div style={{ fontSize: 12, color: t.textMuted }}>📍 {m.adres}</div>}
              {m.telefon && <div style={{ fontSize: 12, color: t.textMuted }}>📞 {m.telefon}</div>}
              {m.email && <div style={{ fontSize: 12, color: t.textMuted }}>✉ {m.email}</div>}
              {m.aylikHedef && Number(m.aylikHedef) > 0 && (
                <div style={{ fontSize: 12, color: t.textMuted }}>🎯 Hedef: <span style={{ color: t.accent, fontWeight: 600 }}>₺{Number(m.aylikHedef).toLocaleString('tr-TR')}</span></div>
              )}
              {!m.adres && !m.telefon && !m.email && !m.aylikHedef && (
                <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>Bilgi girilmemiş</div>
              )}
            </div>

            {/* İşlemler */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(m)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 12 }}>
                ✏ Düzenle
              </button>
              <button onClick={() => durumToggle(m)} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12,
                background: m.aktif ? 'rgba(235,87,87,0.08)' : 'rgba(111,207,151,0.08)',
                border: `1px solid ${m.aktif ? 'rgba(235,87,87,0.3)' : 'rgba(111,207,151,0.3)'}`,
                color: m.aktif ? '#eb5757' : '#6fcf97'
              }}>
                {m.aktif ? '⏸ Pasif Yap' : '▶ Aktif Yap'}
              </button>
            </div>
          </div>
        ))}

        {/* Yeni mağaza ekle kartı */}
        <button onClick={() => setModal('yeni')} style={{
          background: 'transparent', border: `2px dashed ${t.border}`, borderRadius: 14,
          padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 160,
          color: t.textMuted, fontSize: 13, transition: 'border-color .2s'
        }}>
          <span style={{ fontSize: 32 }}>+</span>
          <span>Yeni Mağaza Ekle</span>
        </button>
      </div>

      {modal && (
        <MagazaModal
          magaza={modal === 'yeni' ? null : modal}
          t={t}
          onKaydet={() => { setModal(null); yenileHepsi() }}
          onKapat={() => setModal(null)}
        />
      )}
    </div>
  )
}
