import { useState, useEffect } from 'react'
import * as api from './api'

const para = v => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const tarihTR = iso => iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const gunFark = iso => Math.floor((new Date() - new Date(iso)) / 86400000)

// ─── SEGMENT ──────────────────────────────────────────────────
function segmentBelirle(musteri) {
  const top = (musteri._count?.satislar||0) + (musteri._count?.siparisler||0)
  if (top === 0) return { label: 'Yeni',     renk: '#56ccf2' }
  if (top >= 10) return { label: 'VIP',      renk: '#c9b882' }
  if (top >= 5)  return { label: 'Düzenli',  renk: '#6fcf97' }
  return              { label: 'Standart',  renk: '#888'    }
}

// ─── MODAL ────────────────────────────────────────────────────
function MusteriModal({ musteri, onKaydet, onKapat, t }) {
  const bos = { ad: '', soyad: '', telefon: '', email: '', adres: '', notlar: '' }
  const [form, setForm] = useState(musteri ? { ...musteri } : bos)
  const [hata, setHata] = useState('')
  const [kayit, setKayit] = useState(false)
  const g = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const kaydet = async () => {
    if (!form.ad.trim()) return setHata('Ad zorunlu')
    setHata(''); setKayit(true)
    try {
      if (musteri) await api.musteriGuncelle(musteri.id, form)
      else         await api.musteriEkle(form)
      onKaydet()
    } catch (e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  const inp = (label, key, type = 'text') => (
    <div>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <input type={type} value={form[key] || ''} onChange={e => g(key, e.target.value)}
        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }} />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: t.sidebar || '#14120f', border: `1px solid ${t.border}`, borderRadius: 18, padding: '28px 32px', width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: t.text }}>{musteri ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</div>
          <button onClick={onKapat} style={{ color: t.textMuted, fontSize: 20 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="vega-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {inp('Ad', 'ad')} {inp('Soyad', 'soyad')}
          </div>
          {inp('Telefon', 'telefon', 'tel')}
          {inp('E-posta', 'email', 'email')}
          {inp('Adres', 'adres')}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>Notlar</div>
            <textarea value={form.notlar || ''} onChange={e => g('notlar', e.target.value)} rows={3}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none', resize: 'vertical' }} />
          </div>
        </div>
        {hata && <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(235,87,87,0.1)', border: '1px solid rgba(235,87,87,0.3)', borderRadius: 8, fontSize: 12, color: '#eb5757' }}>{hata}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onKapat} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 13 }}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{ flex: 2, padding: '10px 0', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}55`, color: t.accent, fontSize: 13, fontWeight: 600 }}>
            {kayit ? 'Kaydediliyor...' : musteri ? 'Güncelle' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DETAY PANEL ──────────────────────────────────────────────
function MusteriDetay({ musteriId, onKapat, t }) {
  const [musteri, setMusteri] = useState(null)

  useEffect(() => {
    api.musteriGetir(musteriId).then(setMusteri).catch(console.error)
  }, [musteriId])

  if (!musteri) return null

  const toplamHarcama = musteri.satislar?.reduce((t, s) => t + Number(s.genelToplam), 0) || 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: t.sidebar || '#14120f', border: `1px solid ${t.border}`, borderRadius: 18, padding: '28px 32px', width: '100%', maxWidth: 540, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: t.text }}>{musteri.ad} {musteri.soyad || ''}</div>
          <button onClick={onKapat} style={{ color: t.textMuted, fontSize: 20 }}>✕</button>
        </div>

        <div className="vega-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'Toplam Harcama',  v: para(toplamHarcama),                     c: t.accent },
            { l: 'Satış Sayısı',    v: (musteri.satislar?.length||0) + ' mağaza / ' + (musteri.siparisler?.length||0) + ' online', c: t.text },
            { l: 'Ort. Sepet',      v: para(toplamHarcama / (musteri.satislar?.length || 1)), c: t.text },
            { l: 'Puan',            v: musteri.puan + ' puan',                  c: '#6fcf97' },
          ].map(k => (
            <div key={k.l} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* En çok aldığı ürünler */}
        {musteri.satislar?.length > 0 && (() => {
          const urunSayac = {}
          musteri.satislar.forEach(s => (s.kalemler||[]).forEach(k => {
            const key = k.urunAd
            urunSayac[key] = urunSayac[key] || { adet: 0, toplam: 0 }
            urunSayac[key].adet  += Number(k.adet || 1)
            urunSayac[key].toplam += Number(k.toplam || 0)
          }))
          const sirali = Object.entries(urunSayac).sort((a,b) => b[1].adet - a[1].adet).slice(0,5)
          if (!sirali.length) return null
          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>En Çok Aldığı Ürünler</div>
              {sirali.map(([ad, d]) => (
                <div key={ad} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${t.border}` }}>
                  <div>
                    <div style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{ad}</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>{d.adet} adet · {para(d.toplam)}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>{d.adet}×</div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Online Siparişler */}
        {musteri.siparisler?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>Online Siparişler</div>
            {musteri.siparisler.slice(0, 10).map(s => (
              <div key={s.id} style={{ padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 12, color: t.text, fontFamily: 'monospace', fontWeight: 600 }}>{s.siparisNo}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{tarihTR(s.tarih)} · {s.kanal||'online'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{para(s.genelToplam)}</div>
                    <div style={{ fontSize: 10, color: s.durum==='teslim_edildi'?'#6fcf97':s.durum==='iptal'?'#eb5757':'#f2c94c' }}>{s.durum?.replace(/_/g,' ')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {musteri.satislar?.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>Mağaza Satışları</div>
            {musteri.satislar.slice(0, 10).map(s => (
              <div key={s.id} style={{ padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, color: t.text, fontFamily: 'monospace', fontWeight: 600 }}>{s.fisNo}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{tarihTR(s.tarih)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{para(s.genelToplam)}</div>
                </div>
                {/* Satılan ürünler */}
                {(s.kalemler||[]).length > 0 && (
                  <div style={{ paddingLeft: 12, borderLeft: `2px solid ${t.border}` }}>
                    {s.kalemler.map((k, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{ fontSize: 11, color: t.text }}>
                          {k.urunAd}
                          {k.renk && <span style={{ color: t.textMuted }}> · {k.renk}</span>}
                          {k.beden && <span style={{ color: t.textMuted }}>/{k.beden}</span>}
                          <span style={{ color: t.textMuted }}> × {k.adet}</span>
                        </div>
                        <div style={{ fontSize: 11, color: t.accent }}>{para(k.toplam)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function MusteriCRM({ t }) {
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

  const sil = async (id) => {
    if (!window.confirm('Müşteri silinsin mi?')) return
    try { await api.musteriSil(id); yukle() }
    catch (e) { alert(e.message) }
  }

  return (
    <div className="vega-page-pad" style={{ padding: '22px 28px' }}>
      <style>{`
        .vega-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-scroll-x table{min-width:640px;}
        @media (max-width:860px){
          .vega-page-pad{padding-left:14px!important;padding-right:14px!important;}
          .vega-grid-2{grid-template-columns:1fr!important;}
        }
        @media (max-width:600px){
          .vega-header-row{flex-direction:column;align-items:stretch!important;gap:12px;}
          .vega-header-row button{width:100%;}
        }
      `}</style>
      <div className="vega-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: t.text }}>Müşteri CRM</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>{musteriler.length} müşteri</div>
        </div>
        <button onClick={() => setModal('yeni')} style={{ padding: '10px 20px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}55`, color: t.accent, fontSize: 13, fontWeight: 600 }}>
          + Yeni Müşteri
        </button>
      </div>

      {/* Arama */}
      <div style={{ marginBottom: 20 }}>
        <input value={arama} onChange={e => aramaYap(e.target.value)} placeholder="Ad, telefon veya e-posta ile ara..."
          style={{ width: '100%', maxWidth: 400, padding: '10px 16px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }} />
      </div>

      {/* Liste */}
      {yukleniyor ? (
        <div style={{ color: t.textMuted }}>Yükleniyor...</div>
      ) : (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div className="vega-scroll-x">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${t.border}`, background: t.hover }}>
              {['Müşteri', 'Telefon', 'E-posta', 'Satış', 'Segment', 'İşlem'].map(h => (
                <th key={h} style={{ padding: '12px 14px', fontSize: 10, color: t.textMuted, fontWeight: 500, textAlign: 'left', letterSpacing: .3 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {musteriler.map(m => {
                const seg = segmentBelirle(m)
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{m.ad} {m.soyad || ''}</div>
                      {m.adres && <div style={{ fontSize: 11, color: t.textMuted }}>{m.adres}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: t.text }}>{m.telefon || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: t.text }}>{m.email || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: t.accent }}>
                      {(m._count?.satislar||0) + (m._count?.siparisler||0)} işlem
                      {m._count?.siparisler>0 && <div style={{fontSize:10,color:t.textMuted}}>{m._count.satislar||0} mağaza · {m._count.siparisler} online</div>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: `${seg.renk}18`, color: seg.renk, fontWeight: 600 }}>{seg.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setDetay(m.id)} style={{ padding: '5px 10px', borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 11 }}>Detay</button>
                        <button onClick={() => setModal(m)} style={{ padding: '5px 10px', borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 11 }}>Düzenle</button>
                        <button onClick={() => sil(m.id)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(235,87,87,0.08)', border: '1px solid rgba(235,87,87,0.2)', color: '#eb5757', fontSize: 11 }}>Sil</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {musteriler.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>Müşteri bulunamadı</div>}
        </div>
      )}

      {modal && <MusteriModal musteri={modal === 'yeni' ? null : modal} t={t} onKaydet={() => { setModal(null); yukle(arama) }} onKapat={() => setModal(null)} />}
      {detay && <MusteriDetay musteriId={detay} t={t} onKapat={() => setDetay(null)} />}
    </div>
  )
}
