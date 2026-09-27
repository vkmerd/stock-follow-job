import { useState, useEffect } from 'react'
import * as api from './api'
// Rapor verisi backend'den aggregate olarak geliyor - ham veri değil

const para = v => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const tarihTR = iso => iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// ─── XLSX EXPORT ──────────────────────────────────────────────
const xlsxExport = (rows, baslik, dosyaAd) => {
  if (!rows.length) return alert('Dışa aktarılacak veri yok')
  const esc = v => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const cols = Object.keys(rows[0])
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${esc(baslik)}"><Table>
  <Row>${cols.map(c => `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>
  ${rows.map(r => `<Row>${cols.map(c => `<Cell><Data ss:Type="String">${esc(r[c])}</Data></Cell>`).join('')}</Row>`).join('')}
  </Table></Worksheet></Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `${dosyaAd}.xls`; a.click()
}

// ─── TARIH ARALIK SEÇİCİ ─────────────────────────────────────
function TarihAralik({ baslangic, bitis, onChange, t }) {
  const bugun = new Date().toISOString().slice(0, 10)
  const hazir = [
    { l: 'Bugün',     b: bugun, e: bugun },
    { l: 'Bu Hafta',  b: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), e: bugun },
    { l: 'Bu Ay',     b: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), e: bugun },
    { l: 'Geçen Ay',  b: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10), e: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10) },
    { l: 'Bu Yıl',    b: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10), e: bugun },
  ]
  const inp = { padding: '8px 12px', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 12, outline: 'none' }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {hazir.map(h => (
        <button key={h.l} onClick={() => onChange(h.b, h.e)} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, background: baslangic === h.b && bitis === h.e ? t.accentBg : 'transparent', border: `1px solid ${baslangic === h.b && bitis === h.e ? t.accent + '55' : t.border}`, color: baslangic === h.b && bitis === h.e ? t.accent : t.textMuted }}>{h.l}</button>
      ))}
      <div className="vega-daterange-dates" style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
        <input type="date" value={baslangic} onChange={e => onChange(e.target.value, bitis)} style={inp} />
        <span style={{ color: t.textMuted, fontSize: 12 }}>—</span>
        <input type="date" value={bitis} onChange={e => onChange(baslangic, e.target.value)} style={inp} />
      </div>

    </div>
  )
}

export default function Raporlar({ t }) {
  const bugun = new Date().toISOString().slice(0, 10)
  const ayBasi = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [baslangic, setBaslangic]   = useState(ayBasi)
  const [bitis, setBitis]           = useState(bugun)
  const [satislar, setSatislar]     = useState([])
  const [kullanicilar, setKullanicilar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [masraflar, setMasraflar]   = useState([])
  const [iadeler, setIadeler]       = useState([])
  const [musteriler, setMusteriler] = useState([])
  const [aktifTab, setAktifTab]     = useState('satis')

  // Filtreler
  const [filtreMarka, setFiltreMarka]     = useState('')
  const [filtreMagaza, setFiltreMagaza]   = useState('')
  const [hizliTarih, setHizliTarih]       = useState('bu_ay')
  const [filtreRenk, setFiltreRenk]       = useState('')
  const [filtreMalzeme, setFiltreMalzeme] = useState('')
  const [filtrePersonel, setFiltrePersonel] = useState('')
  const [filtreKategori, setFiltreKategori] = useState('')

  const yukle = async () => {
    setYukleniyor(true)
    try {
      const [s, k, m, i, mu] = await Promise.all([
        api.satislariGetir({ baslangic: baslangic + 'T00:00:00', bitis: bitis + 'T23:59:59', limit: 1000 }),
        api.kullanicilariGetir(),
        api.masraflariGetir({ baslangic: baslangic + 'T00:00:00', bitis: bitis + 'T23:59:59', limit: 500 }).catch(()=>[]),
        api.iadelerGetir({ baslangic: baslangic + 'T00:00:00', bitis: bitis + 'T23:59:59', limit: 500 }).catch(()=>[]),
        api.musterileriGetir({ limit: 200 }).catch(()=>[]),
      ])
      setSatislar(s)
      setKullanicilar(k)
      setMasraflar(Array.isArray(m)?m:[])
      setIadeler(Array.isArray(i)?i:[])
      setMusteriler(Array.isArray(mu)?mu:[])
    } catch (e) { console.error(e) }
    finally { setYukleniyor(false) }
  }

  useEffect(() => { yukle() }, [baslangic, bitis])

  // ─── Hesaplamalar ─────────────────────────────────────────
  const tumKalemler = satislar.flatMap(s => (s.kalemler || []).map(k => ({
    ...k,
    tarih:      s.tarih,
    fisNo:      s.fisNo,
    magaza:     typeof s.magaza === 'object' ? s.magaza?.ad : s.magaza,
    kasiyer:    s.kasiyer || s.kullanici?.ad || s.kullaniciAd || '—',
    kullaniciId: s.kullaniciId,
    odemeTipi:  (s.odemeler || [])[0]?.tip || '—',
    marka:      k.marka || k.urun?.marka || '—',
    kategori:   k.kategori || k.urun?.kategori || '—',
    malzeme:    k.malzeme || k.urun?.malzeme || '—',
  })))

  // Filtrele
  const filtreli = tumKalemler.filter(k =>
    (!filtreMarka    || k.marka?.toLowerCase().includes(filtreMarka.toLowerCase())) &&
    (!filtreRenk     || k.renk?.toLowerCase().includes(filtreRenk.toLowerCase())) &&
    (!filtreMalzeme  || k.malzeme?.toLowerCase().includes(filtreMalzeme.toLowerCase())) &&
    (!filtrePersonel || k.kullaniciId === filtrePersonel) &&
    (!filtreKategori || k.kategori?.toLowerCase().includes(filtreKategori.toLowerCase())) &&
    (!filtreMagaza   || k.magaza === filtreMagaza)
  )

  // Özet
  const toplamCiro   = satislar.reduce((t, s) => t + Number(s.genelToplam || 0), 0)
  const toplamAdet   = filtreli.reduce((t, k) => t + Number(k.adet || 1), 0)
  const toplamFiltre = filtreli.reduce((t, k) => t + Number(k.toplam || 0), 0)

  // Marka bazlı
  const markaBazli = Object.entries(filtreli.reduce((acc, k) => {
    const m = k.marka || 'Belirtilmemiş'
    acc[m] = acc[m] || { adet: 0, ciro: 0 }
    acc[m].adet += Number(k.adet || 1)
    acc[m].ciro += Number(k.toplam || 0)
    return acc
  }, {})).sort((a, b) => b[1].ciro - a[1].ciro)

  // Renk bazlı
  const renkBazli = Object.entries(filtreli.reduce((acc, k) => {
    const r = k.renk || 'Belirtilmemiş'
    acc[r] = acc[r] || { adet: 0, ciro: 0 }
    acc[r].adet += Number(k.adet || 1)
    acc[r].ciro += Number(k.toplam || 0)
    return acc
  }, {})).sort((a, b) => b[1].adet - a[1].adet).slice(0, 10)

  // Personel bazlı
  const personelBazli = Object.entries(satislar.reduce((acc, s) => {
    const kid = s.kullaniciId || 'bilinmiyor'
    const kad = s.kasiyer || s.kullanici?.ad || 'Bilinmiyor'
    acc[kid] = acc[kid] || { ad: kad, satis: 0, ciro: 0, kullanici: s.kullanici }
    acc[kid].satis++
    acc[kid].ciro += Number(s.genelToplam || 0)
    return acc
  }, {})).sort((a, b) => b[1].ciro - a[1].ciro)

  // Gün bazlı ciro (grafik için)
  const gunBazli = Object.entries(satislar.reduce((acc, s) => {
    const gun = s.tarih?.slice(0, 10)
    acc[gun] = (acc[gun] || 0) + Number(s.genelToplam || 0)
    return acc
  }, {})).sort((a, b) => a[0].localeCompare(b[0]))

  const maxGunCiro = Math.max(...gunBazli.map(g => g[1]), 1)

  // Excel satış detay
  const satisExcel = () => {
    const rows = filtreli.map(k => ({
      'Tarih':      tarihTR(k.tarih),
      'Fiş No':     k.fisNo || '',
      'Ürün':       k.urunAd || '',
      'Marka':      k.marka || '',
      'Renk':       k.renk || '',
      'Beden':      k.beden || '',
      'Malzeme':    k.malzeme || '',
      'Adet':       String(k.adet || 1),
      'Birim Fiyat': Number(k.birimFiyat || 0).toFixed(2),
      'İndirim %':  String(k.indirim || 0),
      'Toplam':     Number(k.toplam || 0).toFixed(2),
      'Maliyet':    k.maliyet ? (Number(k.maliyet) * Number(k.adet)).toFixed(2) : '',
      'Kar':        k.karMarji != null ? Number(k.karMarji).toFixed(2) : '',
      'Mağaza':     k.magaza || '',
      'Kasiyer':    k.kasiyer || '',
    }))
    xlsxExport(rows, 'Satış Detayı', `satis_detay_${baslangic}_${bitis}`)
  }

  const personelExcel = () => {
    const rows = personelBazli.map(([, p]) => ({
      'Personel':    p.ad,
      'Satış Sayısı': String(p.satis),
      'Ciro':        p.ciro.toFixed(2),
      'Ort. Satış':  (p.ciro / (p.satis || 1)).toFixed(2),
    }))
    xlsxExport(rows, 'Personel Raporu', `personel_raporu_${baslangic}_${bitis}`)
  }

  const TABS = [
    { id: 'satis',    l: '📊 Satış Detayı' },
    { id: 'urun',     l: '📦 Ürün Analizi' },
    { id: 'personel', l: '👤 Personel' },
    { id: 'grafik',   l: '📈 Grafik' },
    { id: 'iade',     l: '↩ İadeler' },
    { id: 'masraf',   l: '💸 Masraflar' },
    { id: 'musteri',  l: '👥 Müşteri Analizi' },
    { id: 'magaza',   l: '🏪 Mağaza Bazlı' },
  ]

  const Kart = ({ l, v, c = t.accent }) => (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>{l}</div>
      <div style={{ fontSize: 20, fontFamily: "'Playfair Display',serif", fontWeight: 700, color: c }}>{v}</div>
    </div>
  )

  return (
    <div className="vega-page-pad" style={{ padding: '22px 28px' }}>
      <style>{`
        .vega-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-scroll-x table{min-width:640px;}
        .vega-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap!important;}
        .vega-tabs button{white-space:nowrap;flex-shrink:0;}
        @media (max-width:860px){
          .vega-page-pad{padding-left:14px!important;padding-right:14px!important;}
          .vega-grid-2,.vega-grid-3,.vega-grid-4{grid-template-columns:1fr!important;}
        }
        @media (max-width:600px){
          .vega-header-row{flex-direction:column;align-items:stretch!important;}
          .vega-header-actions{width:100%;}
          .vega-header-actions button{flex:1;}
          .vega-daterange-dates{margin-left:0!important;width:100%!important;justify-content:space-between!important;}
          .vega-filter-input{width:auto!important;flex:1 1 140px!important;}
        }
      `}</style>
      {/* Başlık */}
      <div className="vega-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: t.text }}>Raporlar</div>
        <div className="vega-header-actions" style={{ display: 'flex', gap: 8 }}>
          <button onClick={satisExcel} style={{ padding: '9px 16px', borderRadius: 10, background: 'rgba(111,207,151,.1)', border: '1px solid rgba(111,207,151,.3)', color: '#6fcf97', fontSize: 13 }}>⬇ Satış Excel</button>
          <button onClick={personelExcel} style={{ padding: '9px 16px', borderRadius: 10, background: 'rgba(187,135,252,.1)', border: '1px solid rgba(187,135,252,.3)', color: '#bb87fc', fontSize: 13 }}>⬇ Personel Excel</button>
        </div>
      </div>

      {/* Tarih aralığı */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
        <TarihAralik baslangic={baslangic} bitis={bitis} onChange={(b, e) => { setBaslangic(b); setBitis(e) }} t={t} />
      </div>

      {/* KPI */}
      <div className="vega-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <Kart l="Toplam Ciro"    v={para(toplamCiro)} />
        <Kart l="Satış Sayısı"  v={satislar.length} c="#56ccf2" />
        <Kart l="Satılan Adet"  v={toplamAdet} c="#6fcf97" />
        <Kart l="Ort. Sepet"    v={para(toplamCiro / (satislar.length || 1))} c="#bb87fc" />
      </div>

      {/* Filtreler */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          ['🏷 Marka', filtreMarka, setFiltreMarka],
          ['🎨 Renk', filtreRenk, setFiltreRenk],
          ['🧵 Malzeme', filtreMalzeme, setFiltreMalzeme],
          ['📂 Kategori', filtreKategori, setFiltreKategori],
        ].map(([ph, val, set]) => (
          <input key={ph} className="vega-filter-input" value={val} onChange={e => set(e.target.value)} placeholder={ph}
            style={{ padding: '7px 12px', borderRadius: 20, background: t.input, border: `1px solid ${val ? t.accent + '55' : t.border}`, color: t.text, fontSize: 12, outline: 'none', width: 150 }} />
        ))}
        <select value={filtrePersonel} onChange={e => setFiltrePersonel(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 20, background: t.input, border: `1px solid ${filtrePersonel ? t.accent + '55' : t.border}`, color: t.text, fontSize: 12, outline: 'none' }}>
          <option value="">👤 Tüm Personel</option>
          {kullanicilar.map(k => <option key={k.id} value={k.id}>{k.ad} {k.soyad || ''}</option>)}
        </select>
        {(filtreMarka || filtreRenk || filtreMalzeme || filtrePersonel || filtreKategori) && (
          <button onClick={() => { setFiltreMarka(''); setFiltreRenk(''); setFiltreMalzeme(''); setFiltrePersonel(''); setFiltreKategori('') }}
            style={{ padding: '7px 14px', borderRadius: 20, background: 'rgba(235,87,87,.08)', border: '1px solid rgba(235,87,87,.2)', color: '#eb5757', fontSize: 12 }}>✕ Temizle</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: t.textMuted, alignSelf: 'center' }}>{filtreli.length} kalem · {para(toplamFiltre)}</span>
      </div>

      {/* Sekmeler */}
      <div className="vega-tabs" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setAktifTab(tab.id)} style={{ padding: '8px 18px', borderRadius: 20, fontSize: 12, background: aktifTab === tab.id ? t.accentBg : 'transparent', border: `1px solid ${aktifTab === tab.id ? t.accent + '55' : t.border}`, color: aktifTab === tab.id ? t.accent : t.textMuted }}>{tab.l}</button>
        ))}
      </div>

      {yukleniyor && <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>Yükleniyor...</div>}

      {/* SATIŞ DETAYI */}
      {!yukleniyor && aktifTab === 'satis' && (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div className="vega-scroll-x" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead><tr style={{ borderBottom: `1px solid ${t.border}`, background: t.hover }}>
                {['Tarih', 'Fiş No', 'Ürün', 'Marka', 'Renk', 'Beden', 'Adet', 'Fiyat', 'İnd%', 'Toplam', 'Maliyet', 'Kar', 'Mağaza', 'Kasiyer'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: 10, color: t.textMuted, fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtreli.slice(0, 200).map((k, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>{tarihTR(k.tarih)}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: t.textMuted, fontFamily: 'monospace' }}>{k.fisNo}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: t.text, fontWeight: 500 }}>{k.urunAd}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: t.textMuted }}>{k.marka || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: t.textMuted }}>{k.renk || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: t.textMuted }}>{k.beden || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: t.text, textAlign: 'center' }}>{k.adet}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: t.text }}>{para(k.birimFiyat)}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: k.indirim > 0 ? '#eb5757' : t.textMuted }}>{k.indirim > 0 ? `%${k.indirim}` : '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: t.accent }}>{para(k.toplam)}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: t.textMuted }}>{k.maliyet?para(k.maliyet*k.adet):'—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: k.karMarji>0?'#6fcf97':'#eb5757' }}>{k.karMarji!=null?para(k.karMarji):'—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: t.textMuted }}>{k.magaza}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: t.textMuted }}>{k.kasiyer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtreli.length > 200 && <div style={{ padding: '12px 18px', fontSize: 12, color: t.textMuted, borderTop: `1px solid ${t.border}` }}>İlk 200 kayıt gösteriliyor. Tümünü görmek için Excel'e aktarın.</div>}
          {filtreli.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>Seçilen kriterlere uygun satış bulunamadı</div>}
        </div>
      )}

      {/* ÜRÜN ANALİZİ */}
      {!yukleniyor && aktifTab === 'urun' && (
        <div className="vega-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Marka bazlı */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, color: t.text }}>Marka Bazlı Ciro</div>
            <div style={{ padding: '8px 0' }}>
              {markaBazli.slice(0, 10).map(([m, d]) => (
                <div key={m} style={{ padding: '10px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{m}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{d.adet} adet</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>{para(d.ciro)}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Renk bazlı */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, color: t.text }}>En Çok Satan Renkler</div>
            <div style={{ padding: '8px 0' }}>
              {renkBazli.map(([r, d]) => (
                <div key={r} style={{ padding: '10px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: t.text }}>{r}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{d.adet} adet</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.accent }}>{para(d.ciro)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PERSONEL */}
      {!yukleniyor && aktifTab === 'personel' && (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div className="vega-scroll-x">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${t.border}`, background: t.hover }}>
              {['Personel', 'Satış Sayısı', 'Toplam Ciro', 'Ort. Sepet', 'Hedef', 'Gerçekleşme'].map(h => (
                <th key={h} style={{ padding: '12px 14px', fontSize: 10, color: t.textMuted, fontWeight: 500, textAlign: 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {personelBazli.map(([kid, p]) => {
                const kul = kullanicilar.find(k => k.id === kid)
                const buAyHedef = kul?.hedefler?.[0]
                const hedef = buAyHedef ? Number(buAyHedef.hedef) : Number(kul?.aylikHedef || 0)
                const yuzde = hedef > 0 ? Math.min(100, Math.round((p.ciro / hedef) * 100)) : null
                return (
                  <tr key={kid} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{p.ad}</div>
                      {kul && <div style={{ fontSize: 11, color: t.textMuted }}>{kul.email}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 600, color: '#56ccf2' }}>{p.satis}</td>
                    <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: t.accent }}>{para(p.ciro)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: t.textMuted }}>{para(p.ciro / (p.satis || 1))}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: t.textMuted }}>{hedef > 0 ? para(hedef) : '—'}</td>
                    <td style={{ padding: '12px 14px', minWidth: 140 }}>
                      {yuzde !== null ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                            <span style={{ color: t.textMuted }}>{yuzde}%</span>
                            <span style={{ color: yuzde >= 100 ? '#6fcf97' : yuzde >= 60 ? t.accent : '#eb5757', fontWeight: 600 }}>{yuzde >= 100 ? '✓ Hedef Aşıldı' : 'Devam ediyor'}</span>
                          </div>
                          <div style={{ height: 6, background: t.input, borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${yuzde}%`, background: yuzde >= 100 ? '#6fcf97' : yuzde >= 60 ? t.accent : '#eb5757', borderRadius: 3 }} />
                          </div>
                        </div>
                      ) : <span style={{ fontSize: 11, color: t.textMuted }}>Hedef tanımlanmamış</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {personelBazli.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>Bu dönemde satış kaydı bulunamadı</div>}
        </div>
      )}

      {/* GRAFİK */}
      {!yukleniyor && aktifTab === 'grafik' && (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 20 }}>Günlük Ciro Grafiği</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200, overflowX: 'auto' }}>
            {gunBazli.map(([gun, ciro]) => {
              const yuzde = (ciro / maxGunCiro) * 100
              return (
                <div key={gun} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 40, flex: 1 }}>
                  <div style={{ fontSize: 9, color: t.textMuted, whiteSpace: 'nowrap' }}>{para(ciro).replace('₺', '')}</div>
                  <div style={{ width: '100%', background: `${t.accent}88`, borderRadius: '3px 3px 0 0', height: `${yuzde * 1.8}px`, minHeight: 2, transition: 'height .4s' }} />
                  <div style={{ fontSize: 9, color: t.textMuted, whiteSpace: 'nowrap' }}>{gun.slice(5)}</div>
                </div>
              )
            })}
          </div>
          {gunBazli.length === 0 && <div style={{ textAlign: 'center', color: t.textMuted, padding: 40 }}>Bu dönemde satış bulunamadı</div>}
        </div>
      )}
      {/* MASRAF SEKMESİ */}
      {!yukleniyor && aktifTab === 'masraf' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* Masraf KPI */}
          <div className="vega-grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
            <Kart l="Toplam Masraf" v={para(masraflar.reduce((t,m)=>t+Number(m.tutar||0),0))} c="#eb5757"/>
            <Kart l="Masraf Sayısı" v={masraflar.length} c={t.textMuted}/>
            <Kart l="Nakit Masraf" v={para(masraflar.filter(m=>m.odemeKaynagi==='nakit').reduce((t,m)=>t+Number(m.tutar||0),0))} c="#f2c94c"/>
            <Kart l="Banka Masraf" v={para(masraflar.filter(m=>m.odemeKaynagi==='banka').reduce((t,m)=>t+Number(m.tutar||0),0))} c="#bb87fc"/>
          </div>
          {/* Kategori bazlı */}
          <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20}}>
              <div style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:14}}>Kategori Bazlı</div>
              {Object.entries(masraflar.reduce((acc,m)=>{
                const k=m.kategori?.ad||'Kategorisiz'
                acc[k]=(acc[k]||0)+Number(m.tutar||0)
                return acc
              },{})).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${t.border}`,fontSize:12}}>
                  <span style={{color:t.text}}>{k}</span>
                  <span style={{color:'#eb5757',fontWeight:600}}>{para(v)}</span>
                </div>
              ))}
            </div>
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20}}>
              <div style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:14}}>Ödeme Kaynağı</div>
              {[['nakit','💵 Nakit'],['kart','💳 Kart'],['banka','🏦 Banka']].map(([k,l])=>{
                const top=masraflar.filter(m=>m.odemeKaynagi===k).reduce((t,m)=>t+Number(m.tutar||0),0)
                const oran=masraflar.length>0?(masraflar.filter(m=>m.odemeKaynagi===k).length/masraflar.length*100).toFixed(0):0
                return top>0&&(
                  <div key={k} style={{padding:'8px 0',borderBottom:`1px solid ${t.border}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                      <span style={{color:t.text}}>{l}</span>
                      <span style={{color:'#eb5757',fontWeight:600}}>{para(top)}</span>
                    </div>
                    <div style={{height:6,background:t.input,borderRadius:3}}>
                      <div style={{height:'100%',width:`${oran}%`,background:'#eb5757',borderRadius:3}}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Masraf listesi */}
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden'}}>
            <div className="vega-scroll-x">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
                {['Tarih','Kategori','Açıklama','Fatura No','Mağaza','Kaynak','Tutar'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {masraflar.length===0?<tr><td colSpan={7} style={{padding:40,textAlign:'center',color:t.textMuted}}>Bu dönemde masraf yok</td></tr>
                :masraflar.map(m=>(
                  <tr key={m.id} style={{borderBottom:`1px solid ${t.border}`}}>
                    <td style={{padding:'9px 12px',fontSize:11,color:t.textMuted}}>{new Date(m.tarih).toLocaleDateString('tr-TR')}</td>
                    <td style={{padding:'9px 12px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:t.hover,color:t.textMuted}}>{m.kategori?.ikon||'💰'} {m.kategori?.ad||'—'}</span></td>
                    <td style={{padding:'9px 12px',fontSize:12,color:t.text}}>{m.aciklama||'—'}</td>
                    <td style={{padding:'9px 12px',fontSize:11,fontFamily:'monospace',color:t.textMuted}}>{m.faturaNo||'—'}</td>
                    <td style={{padding:'9px 12px',fontSize:12,color:t.textMuted}}>{m.magaza?.ad||'Genel'}</td>
                    <td style={{padding:'9px 12px'}}><span style={{fontSize:10,padding:'2px 6px',borderRadius:20,background:m.odemeKaynagi==='nakit'?'rgba(111,207,151,.1)':'rgba(187,135,252,.1)',color:m.odemeKaynagi==='nakit'?'#6fcf97':'#bb87fc'}}>{m.odemeKaynagi==='nakit'?'💵':'🏦'}</span></td>
                    <td style={{padding:'9px 12px',fontSize:13,fontWeight:700,color:'#eb5757'}}>-{para(m.tutar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* MÜŞTERİ ANALİZİ SEKMESİ */}
      {!yukleniyor && aktifTab === 'musteri' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="vega-grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
            <Kart l="Toplam Müşteri" v={musteriler.length} c={t.accent}/>
            <Kart l="Alışveriş Yapan" v={[...new Set(satislar.filter(s=>s.musteriId).map(s=>s.musteriId))].length} c="#6fcf97"/>
            <Kart l="Ort. Müşteri Sepeti" v={para(satislar.filter(s=>s.musteriId).reduce((t,s)=>t+Number(s.genelToplam||0),0)/Math.max([...new Set(satislar.filter(s=>s.musteriId).map(s=>s.musteriId))].length,1))} c="#bb87fc"/>
          </div>
          {/* En çok alışveriş yapan müşteriler */}
          <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20}}>
              <div style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:14}}>En Çok Harcayan</div>
              {Object.entries(satislar.filter(s=>s.musteriId).reduce((acc,s)=>{
                const k=s.musteriId
                const ad=s.musteriAd||`${s.musteri?.ad||''} ${s.musteri?.soyad||''}`.trim()||'—'
                if(!acc[k]) acc[k]={ad,ciro:0,sayi:0}
                acc[k].ciro+=Number(s.genelToplam||0)
                acc[k].sayi++
                return acc
              },{})).sort((a,b)=>b[1].ciro-a[1].ciro).slice(0,8).map(([id,d])=>(
                <div key={id} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${t.border}`,fontSize:12}}>
                  <div><div style={{color:t.text,fontWeight:500}}>{d.ad}</div><div style={{fontSize:10,color:t.textMuted}}>{d.sayi} alışveriş</div></div>
                  <span style={{color:t.accent,fontWeight:700}}>{para(d.ciro)}</span>
                </div>
              ))}
            </div>
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20}}>
              <div style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:14}}>İade Yapan Müşteriler</div>
              {iadeler.filter(i=>i.satis?.musteriId||i.siparis?.musteriId).length===0
                ?<div style={{color:t.textMuted,fontSize:13,textAlign:'center',padding:20}}>İade yok</div>
                :Object.entries(iadeler.reduce((acc,i)=>{
                  const musteriId=i.satis?.musteriId||i.siparis?.musteriId
                  const ad=i.satis?.musteri?.ad||i.siparis?.musteriAd||'—'
                  if(!musteriId) return acc
                  if(!acc[musteriId]) acc[musteriId]={ad,adet:0,tutar:0}
                  acc[musteriId].adet++
                  acc[musteriId].tutar+=Number(i.toplam||i.toplamIade||0)
                  return acc
                },{})).sort((a,b)=>b[1].adet-a[1].adet).slice(0,8).map(([id,d])=>(
                  <div key={id} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${t.border}`,fontSize:12}}>
                    <div><div style={{color:t.text,fontWeight:500}}>{d.ad}</div><div style={{fontSize:10,color:'#eb5757'}}>{d.adet} iade</div></div>
                    <span style={{color:'#eb5757',fontWeight:700}}>-{para(d.tutar)}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* MAĞAZA BAZLI SEKMESİ */}
      {/* İADE SEKMESİ */}
      {!yukleniyor && aktifTab === 'iade' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="vega-grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
            <Kart l="Toplam İade" v={para(iadeler.reduce((t,i)=>t+Number(i.toplam||i.toplamIade||0),0))} c="#eb5757"/>
            <Kart l="İade Sayısı" v={iadeler.length} c={t.textMuted}/>
            <Kart l="Onaylanan" v={iadeler.filter(i=>i.durum==='onaylandi').length} c="#6fcf97"/>
            <Kart l="Bekleyen" v={iadeler.filter(i=>i.durum==='beklemede').length} c="#f2c94c"/>
          </div>
          {iadeler.flatMap(i=>i.kalemler||[]).length>0&&(
            <div className="vega-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20}}>
                <div style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:14}}>En Çok İade Edilen</div>
                {Object.entries(iadeler.flatMap(i=>i.kalemler||[]).reduce((acc,k)=>{
                  acc[k.urunAd]=(acc[k.urunAd]||0)+Number(k.adet||1); return acc
                },{})).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([ad,adet])=>(
                  <div key={ad} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${t.border}`,fontSize:12}}>
                    <span style={{color:t.text}}>{ad}</span>
                    <span style={{color:'#eb5757',fontWeight:600}}>{adet} adet</span>
                  </div>
                ))}
              </div>
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20}}>
                <div style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:14}}>İade Nedenleri</div>
                {Object.entries(iadeler.reduce((acc,i)=>{
                  const n=i.neden||'Belirtilmemiş'; acc[n]=(acc[n]||0)+1; return acc
                },{})).sort((a,b)=>b[1]-a[1]).map(([n,s])=>(
                  <div key={n} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${t.border}`,fontSize:12}}>
                    <span style={{color:t.text}}>{n}</span>
                    <span style={{color:'#f2c94c',fontWeight:600}}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden'}}>
            <div className="vega-scroll-x">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
                {['Tarih','İade No','Fiş/Sipariş','Müşteri','Ürünler','Tutar','Durum'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:500,textAlign:'left'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {iadeler.length===0
                  ?<tr><td colSpan={7} style={{padding:40,textAlign:'center',color:t.textMuted}}>Bu dönemde iade yok</td></tr>
                  :iadeler.map(i=>(
                  <tr key={i.id} style={{borderBottom:`1px solid ${t.border}`}}>
                    <td style={{padding:'9px 12px',fontSize:11,color:t.textMuted}}>{new Date(i.tarih).toLocaleDateString('tr-TR')}</td>
                    <td style={{padding:'9px 12px',fontSize:11,fontFamily:'monospace',color:t.textMuted}}>{i.iadeNo||'—'}</td>
                    <td style={{padding:'9px 12px',fontSize:12,color:t.text}}>{i.satis?.fisNo||i.siparis?.siparisNo||'—'}</td>
                    <td style={{padding:'9px 12px',fontSize:12,color:t.text}}>{i.satis?.musteri?.ad||i.siparis?.musteriAd||'—'}</td>
                    <td style={{padding:'9px 12px',fontSize:11,color:t.textMuted}}>{(i.kalemler||[]).map(k=>k.urunAd).join(', ').slice(0,30)||'—'}</td>
                    <td style={{padding:'9px 12px',fontSize:13,fontWeight:700,color:'#eb5757'}}>-{para(i.toplam||i.toplamIade||0)}</td>
                    <td style={{padding:'9px 12px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                      background:i.durum==='onaylandi'?'rgba(111,207,151,.1)':i.durum==='reddedildi'?'rgba(235,87,87,.1)':'rgba(242,201,76,.1)',
                      color:i.durum==='onaylandi'?'#6fcf97':i.durum==='reddedildi'?'#eb5757':'#f2c94c'}}>
                      {i.durum==='onaylandi'?'✓ Onaylandı':i.durum==='reddedildi'?'✕ Reddedildi':'⏳ Bekliyor'}
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {!yukleniyor && aktifTab === 'magaza' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {Object.entries(satislar.reduce((acc,s)=>{
            const m=typeof s.magaza==='object'?s.magaza?.ad:s.magaza||'Belirtilmemiş'
            if(!acc[m]) acc[m]={ad:m,ciro:0,sayi:0,iadeTutar:0,masrafTutar:0}
            acc[m].ciro+=Number(s.genelToplam||0)
            acc[m].sayi++
            return acc
          },{}).constructor===Object ? satislar.reduce((acc,s)=>{
            const m=typeof s.magaza==='object'?s.magaza?.ad:s.magaza||'Belirtilmemiş'
            if(!acc[m]) acc[m]={ad:m,ciro:0,sayi:0}
            acc[m].ciro+=Number(s.genelToplam||0)
            acc[m].sayi++
            return acc
          },{}) : {}).length === 0 ? (
            <div style={{padding:40,textAlign:'center',color:t.textMuted}}>Veri yok</div>
          ) : Object.entries(satislar.reduce((acc,s)=>{
            const m=typeof s.magaza==='object'?s.magaza?.ad:s.magaza||'Belirtilmemiş'
            if(!acc[m]) acc[m]={ad:m,ciro:0,sayi:0,masraf:0}
            acc[m].ciro+=Number(s.genelToplam||0)
            acc[m].sayi++
            return acc
          },{})).sort((a,b)=>b[1].ciro-a[1].ciro).map(([mag,d])=>{
            const mMasraf=masraflar.filter(m=>m.magaza?.ad===mag).reduce((t,m)=>t+Number(m.tutar||0),0)
            const mIade=iadeler.filter(i=>(typeof i.satis?.magaza==='object'?i.satis?.magaza?.ad:i.satis?.magaza)===mag).reduce((t,i)=>t+Number(i.toplam||0),0)
            return (
              <div key={mag} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:20}}>
                <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:14}}>🏪 {mag}</div>
                <div className="vega-grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                  <div style={{background:t.hover,borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:10,color:t.textMuted,marginBottom:4}}>CİRO</div>
                    <div style={{fontSize:16,fontWeight:700,color:t.accent}}>{para(d.ciro)}</div>
                    <div style={{fontSize:10,color:t.textMuted}}>{d.sayi} satış</div>
                  </div>
                  <div style={{background:t.hover,borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:10,color:t.textMuted,marginBottom:4}}>MASRAF</div>
                    <div style={{fontSize:16,fontWeight:700,color:'#eb5757'}}>-{para(mMasraf)}</div>
                  </div>
                  <div style={{background:t.hover,borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:10,color:t.textMuted,marginBottom:4}}>İADE</div>
                    <div style={{fontSize:16,fontWeight:700,color:'#f2c94c'}}>-{para(mIade)}</div>
                  </div>
                  <div style={{background:t.hover,borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:10,color:t.textMuted,marginBottom:4}}>NET</div>
                    <div style={{fontSize:16,fontWeight:700,color:'#6fcf97'}}>{para(d.ciro-mMasraf-mIade)}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}