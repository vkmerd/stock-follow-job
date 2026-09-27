import { useState, useEffect } from 'react'
import * as api from './api'

const ROLLER = [
  { id: 'admin',   label: 'Admin',            renk: '#c9b882', aciklama: 'Tüm modüllere tam erişim' },
  { id: 'satis',   label: 'Satış Yetkilisi',  renk: '#6fcf97', aciklama: 'Satış, müşteri, stok görüntüleme' },
  { id: 'kasiyer', label: 'Kasiyer',          renk: '#56ccf2', aciklama: 'Sadece kasa/satış ekranı' },
  { id: 'depo',    label: 'Depo Sorumlusu',   renk: '#bb87fc', aciklama: 'Stok görüntüleme ve düzenleme' },
]

function tarihTR(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── YENİ KULLANICI MODAL ─────────────────────────────────────
function KullaniciModal({ kullanici, magazalar, onKaydet, onKapat, t }) {
  const bos = { ad: '', soyad: '', email: '', sifre: '', rol: 'satis', magazaId: '', aktif: true }
  const [form, setForm] = useState(kullanici ? {
    ...kullanici, sifre: '', soyad: kullanici.soyad || ''
  } : bos)
  const [hata, setHata]     = useState('')
  const [kayit, setKayit]   = useState(false)

  const g = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const kaydet = async () => {
    if (!form.ad.trim())            return setHata('Ad zorunlu')
    if (!form.email.includes('@'))  return setHata('Geçerli e-posta giriniz')
    if (!kullanici && form.sifre.length < 6) return setHata('Şifre en az 6 karakter olmalı')
    setHata(''); setKayit(true)
    try {
      const veri = { ...form }
      if (!veri.sifre) delete veri.sifre
      if (!veri.magazaId) delete veri.magazaId
      if (kullanici) {
        await api.kullaniciGuncelle(kullanici.id, veri)
      } else {
        await api.kullaniciEkle(veri)
      }
      onKaydet()
    } catch (e) {
      setHata(e.message)
    } finally {
      setKayit(false)
    }
  }

  const inp = (label, key, type = 'text', placeholder = '') => (
    <div>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <input type={type} value={form[key]} onChange={e => g(key, e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }} />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: t.sidebar || '#14120f', border: `1px solid ${t.border}`, borderRadius: 18, padding: '28px 32px', width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: t.text }}>{kullanici ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}</div>
          <button onClick={onKapat} style={{ color: t.textMuted, fontSize: 20 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {inp('Ad', 'ad')}
            {inp('Soyad', 'soyad')}
          </div>
          {inp('E-posta', 'email', 'email')}
          {inp('Şifre', 'sifre', 'password', kullanici ? 'Değiştirmek için doldurun' : 'En az 6 karakter')}

          {/* Rol */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>Rol</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ROLLER.map(r => (
                <button key={r.id} onClick={() => g('rol', r.id)} style={{ flex: 1, minWidth: 100, padding: '8px 0', borderRadius: 8, fontSize: 12, background: form.rol === r.id ? `${r.renk}22` : t.input, border: `1px solid ${form.rol === r.id ? r.renk + '55' : t.border}`, color: form.rol === r.id ? r.renk : t.textMuted, fontWeight: form.rol === r.id ? 600 : 400 }}>
                  {r.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>{ROLLER.find(r => r.id === form.rol)?.aciklama}</div>
          </div>

          {/* Mağaza */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Mağaza</div>
            <select value={form.magazaId || ''} onChange={e => g('magazaId', e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }}>
              <option value="">Tüm Mağazalar</option>
              {magazalar.filter(m => m.tip !== 'online').map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
            </select>
          </div>

          {/* Aktif */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div onClick={() => g('aktif', !form.aktif)} style={{ width: 40, height: 22, borderRadius: 11, background: form.aktif ? t.accent : t.input, border: `1px solid ${t.border}`, cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
              <div style={{ position: 'absolute', top: 2, left: form.aktif ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </div>
            <span style={{ fontSize: 13, color: t.text }}>Hesap {form.aktif ? 'Aktif' : 'Pasif'}</span>
          </div>
        </div>

        {hata && <div style={{ marginTop: 14, padding: '8px 14px', background: 'rgba(235,87,87,0.1)', border: '1px solid rgba(235,87,87,0.3)', borderRadius: 8, fontSize: 12, color: '#eb5757' }}>{hata}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onKapat} style={{ flex: 1, padding: '11px 0', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 13 }}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{ flex: 2, padding: '11px 0', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}55`, color: t.accent, fontSize: 13, fontWeight: 600 }}>
            {kayit ? 'Kaydediliyor...' : kullanici ? 'Güncelle' : 'Kullanıcı Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── HEDEF MODAL ─────────────────────────────────────────────
function HedefModal({ kullanici, onKaydet, onKapat, t }) {
  const simdi = new Date()
  const buAy = simdi.toISOString().slice(0,7)
  const [hedef, setHedef]     = useState(Number(kullanici.aylikHedef||0))
  const [ay, setAy]           = useState(buAy)
  const [gecmisler, setGecmisler] = useState([])
  const [kayit, setKayit]     = useState(false)

  useEffect(() => {
    fetch(`${api.API_BASE}/kullanicilar/${kullanici.id}/hedefler`)
      .then(r=>r.json()).then(setGecmisler).catch(()=>[])
  }, [])

  const kaydet = async () => {
    setKayit(true)
    try {
      const [yil, ayNo] = ay.split('-').map(Number)
      await fetch(`${api.API_BASE}/kullanicilar/${kullanici.id}/hedef`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ yil, ay: ayNo, hedef: Number(hedef) })
      })
      // aylikHedef alanını da güncelle (bu ayki hedef için)
      await api.kullaniciGuncelle(kullanici.id, { aylikHedef: Number(hedef) })
      onKaydet()
    } catch(e) { alert(e.message) }
    finally { setKayit(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1001,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:t.sidebar||'#14120f',border:`1px solid ${t.border}`,borderRadius:18,padding:'28px 32px',width:'100%',maxWidth:380}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>Hedef Tanımla — {kullanici.ad}</div>
          <button onClick={onKapat} style={{color:t.textMuted,fontSize:20}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Ay</div>
            <input type="month" value={ay} onChange={e=>setAy(e.target.value)}
              style={{width:'100%',padding:'10px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Aylık Satış Hedefi (₺)</div>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:t.textMuted}}>₺</span>
              <input type="number" value={hedef} onChange={e=>setHedef(e.target.value)}
                style={{width:'100%',padding:'10px 14px 10px 28px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.accent,fontSize:16,fontWeight:700,outline:'none'}}/>
            </div>
          </div>
          {gecmisler.length>0&&(
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,overflow:'hidden'}}>
              <div style={{fontSize:11,color:t.textMuted,padding:'8px 12px',borderBottom:`1px solid ${t.border}`,textTransform:'uppercase',letterSpacing:.5}}>Geçmiş Hedefler</div>
              {gecmisler.slice(0,6).map(h=>(
                <div key={h.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 12px',borderBottom:`1px solid ${t.border}`,fontSize:12}}>
                  <span style={{color:t.textMuted}}>{h.yil}/{String(h.ay).padStart(2,'0')}</span>
                  <span style={{color:t.accent,fontWeight:600}}>₺{Number(h.hedef).toLocaleString('tr-TR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={onKapat} style={{flex:1,padding:'10px 0',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
          <button onClick={kaydet} disabled={kayit} style={{flex:2,padding:'10px 0',borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>
            {kayit?'Kaydediliyor...':'✓ Hedef Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function KullaniciYonetimi({ t }) {
  const [kullanicilar, setKullanicilar] = useState([])
  const [magazalar, setMagazalar]       = useState([])
  const [yukleniyor, setYukleniyor]     = useState(true)
  const [modal, setModal]               = useState(null) // null | 'yeni' | kullanici objesi
  const [hedefModal, setHedefModal]     = useState(null)

  const [performans, setPerformans] = useState({})

  const yukle = () => {
    setYukleniyor(true)
    Promise.all([api.kullanicilariGetir(), api.magazalariGetir()])
      .then(([k, m]) => {
        setKullanicilar(k); setMagazalar(m)
        // Bu ayki satış performansı
        const buAyBaslangic = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        api.satislariGetir({ baslangic: buAyBaslangic, limit: 500 })
          .then(satislar => {
            const p = {}
            satislar.forEach(s => {
              if (s.kullaniciId) {
                p[s.kullaniciId] = (p[s.kullaniciId] || 0) + Number(s.genelToplam || 0)
              }
            })
            setPerformans(p)
          }).catch(()=>{})
      })
      .catch(console.error)
      .finally(() => setYukleniyor(false))
  }

  useEffect(() => { yukle() }, [])

  const durumToggle = async (k) => {
    await api.kullaniciGuncelle(k.id, { aktif: !k.aktif })
    yukle()
  }

  if (yukleniyor) return <div style={{ padding: 40, color: t.textMuted }}>Yükleniyor...</div>

  return (
    <div style={{ padding: '22px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: t.text }}>Kullanıcı Yönetimi</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>{kullanicilar.length} kullanıcı</div>
        </div>
        <button onClick={() => setModal('yeni')} style={{ padding: '10px 20px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}55`, color: t.accent, fontSize: 13, fontWeight: 600 }}>
          + Yeni Kullanıcı
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {kullanicilar.map(k => {
          const rol = ROLLER.find(r => r.id === k.rol)
          return (
            <div key={k.id} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, opacity: k.aktif ? 1 : .6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{k.ad} {k.soyad || ''}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{k.email}</div>
                </div>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${rol?.renk || t.accent}18`, color: rol?.renk || t.accent, fontWeight: 600 }}>
                  {rol?.label || k.rol}
                </span>
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>
                🏪 {k.magaza?.ad || 'Tüm Mağazalar'}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: k.aylikHedef ? 10 : 14 }}>
                Son giriş: {tarihTR(k.sonGiris)}
              </div>
              {/* Hedef & Performans */}
              {k.aylikHedef > 0 && (() => {
                const gercek = performans[k.id] || 0
                const yuzde  = Math.min(100, Math.round((gercek / Number(k.aylikHedef)) * 100))
                return (
                  <div style={{marginBottom:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
                      <span style={{color:t.textMuted}}>Bu ay: ₺{gercek.toLocaleString('tr-TR',{minimumFractionDigits:0})}</span>
                      <span style={{color:yuzde>=100?'#6fcf97':yuzde>=60?t.accent:'#eb5757',fontWeight:600}}>{yuzde}%</span>
                    </div>
                    <div style={{height:6,background:t.input,borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${yuzde}%`,background:yuzde>=100?'#6fcf97':yuzde>=60?t.accent:'#eb5757',borderRadius:3,transition:'width .5s'}}/>
                    </div>
                    <div style={{fontSize:10,color:t.textMuted,marginTop:3}}>Hedef: ₺{Number(k.aylikHedef).toLocaleString('tr-TR')}</div>
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModal(k)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 12 }}>✏ Düzenle</button>
                <button onClick={() => setHedefModal(k)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(201,184,130,.08)', border: `1px solid rgba(201,184,130,.3)`, color: t.accent, fontSize: 12 }}>🎯 Hedef</button>
                <button onClick={() => durumToggle(k)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: k.aktif ? 'rgba(235,87,87,0.08)' : 'rgba(111,207,151,0.08)', border: `1px solid ${k.aktif ? 'rgba(235,87,87,0.3)' : 'rgba(111,207,151,0.3)'}`, color: k.aktif ? '#eb5757' : '#6fcf97', fontSize: 12 }}>
                  {k.aktif ? '⏸' : '▶'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {hedefModal && <HedefModal kullanici={hedefModal} t={t} onKaydet={()=>{setHedefModal(null);yukle()}} onKapat={()=>setHedefModal(null)}/>}
      {modal && (
        <KullaniciModal
          kullanici={modal === 'yeni' ? null : modal}
          magazalar={magazalar}
          t={t}
          onKaydet={() => { setModal(null); yukle() }}
          onKapat={() => setModal(null)}
        />
      )}
    </div>
  )
}