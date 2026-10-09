import { useState, useEffect } from 'react'
import * as api from './api'
import { Page, PageHeader, Card, Button, Input, Select, SearchInput, Tabs, Segmented, Badge, StatCard, Tile, Progress, EmptyState, LoadingRows, BarChart, toast } from './ui'
import { Download, X, Store } from 'lucide-react'
// Rapor verisi backend'den aggregate olarak geliyor - ham veri değil

const para = v => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const paraKisa = v => `₺${Number(v || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`
const tarihTR = iso => iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// ─── XLSX EXPORT ──────────────────────────────────────────────
const xlsxExport = (rows, baslik, dosyaAd) => {
  if (!rows.length) return toast.warning('Dışa aktarılacak veri yok.')
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
  toast.success(`${baslik} Excel'e aktarıldı.`)
}

// ─── TARIH ARALIK SEÇİCİ ─────────────────────────────────────
function TarihAralik({ baslangic, bitis, onChange }) {
  const bugun = new Date().toISOString().slice(0, 10)
  const hazir = [
    { l: 'Bugün',     b: bugun, e: bugun },
    { l: 'Son 7 gün', b: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), e: bugun },
    { l: 'Bu ay',     b: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), e: bugun },
    { l: 'Geçen ay',  b: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10), e: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10) },
    { l: 'Bu yıl',    b: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10), e: bugun },
  ]
  const secili = hazir.find(h => h.b === baslangic && h.e === bitis)?.l || ''
  return (
    <div className="vg-row">
      <Segmented label="Dönem" value={secili} onChange={l => { const h = hazir.find(x => x.l === l); onChange(h.b, h.e) }} options={hazir.map(h => h.l)} />
      <div className="vg-row" style={{ gap: 6, marginLeft: 'auto', flexWrap: 'nowrap' }}>
        <Input size="sm" type="date" value={baslangic} onChange={e => onChange(e.target.value, bitis)} aria-label="Başlangıç" />
        <span className="vg-muted">–</span>
        <Input size="sm" type="date" value={bitis} onChange={e => onChange(baslangic, e.target.value)} aria-label="Bitiş" />
      </div>
    </div>
  )
}

const IADE_DURUM = { onaylandi: ['success', 'Onaylandı'], reddedildi: ['critical', 'Reddedildi'] }

function SiraliListe({ satirlar, bos = 'Veri yok' }) {
  if (!satirlar.length) return <EmptyState compact title={bos} />
  return (
    <ul className="vg-list">
      {satirlar.map(s => (
        <li key={s.key} className="vg-list__item" style={{ padding: '8px 0' }}>
          <div className="vg-list__main">
            <div className="vg-list__primary">{s.ad}</div>
            {s.alt && <div className="vg-list__secondary">{s.alt}</div>}
          </div>
          <div className="vg-list__value">{s.deger}</div>
        </li>
      ))}
    </ul>
  )
}

export default function Raporlar() {
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

  // Mağaza bazlı
  const magazaBazli = Object.entries(satislar.reduce((acc,s)=>{
    const m=typeof s.magaza==='object'?s.magaza?.ad:s.magaza||'Belirtilmemiş'
    if(!acc[m]) acc[m]={ad:m,ciro:0,sayi:0}
    acc[m].ciro+=Number(s.genelToplam||0)
    acc[m].sayi++
    return acc
  },{})).sort((a,b)=>b[1].ciro-a[1].ciro)

  const musteriSatis = satislar.filter(s=>s.musteriId)
  const alisverisYapan = [...new Set(musteriSatis.map(s=>s.musteriId))].length
  const masrafToplam = masraflar.reduce((t,m)=>t+Number(m.tutar||0),0)

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
    { id: 'satis',    label: 'Satış detayı' },
    { id: 'urun',     label: 'Ürün analizi' },
    { id: 'personel', label: 'Personel' },
    { id: 'grafik',   label: 'Grafik' },
    { id: 'iade',     label: 'İadeler' },
    { id: 'masraf',   label: 'Masraflar' },
    { id: 'musteri',  label: 'Müşteri analizi' },
    { id: 'magaza',   label: 'Mağaza bazlı' },
  ]

  const filtreVar = filtreMarka || filtreRenk || filtreMalzeme || filtrePersonel || filtreKategori

  return (
    <Page>
      <PageHeader title="Raporlar" subtitle={`${tarihTR(baslangic)} – ${tarihTR(bitis)}`}
        actions={<>
          <Button icon={Download} onClick={satisExcel}>Satış Excel</Button>
          <Button icon={Download} onClick={personelExcel}>Personel Excel</Button>
        </>} />

      <div className="vg-card vg-pad">
        <TarihAralik baslangic={baslangic} bitis={bitis} onChange={(b, e) => { setBaslangic(b); setBitis(e) }} />
      </div>

      <div className="vg-grid-4">
        <StatCard label="Toplam ciro" value={para(toplamCiro)} />
        <StatCard label="Satış sayısı" value={satislar.length} />
        <StatCard label="Satılan adet" value={toplamAdet} />
        <StatCard label="Ortalama sepet" value={para(toplamCiro / (satislar.length || 1))} />
      </div>

      {/* Filtreler */}
      <div className="vg-card vg-pad vg-row" style={{ gap: 8 }}>
        {[
          ['Marka', filtreMarka, setFiltreMarka],
          ['Renk', filtreRenk, setFiltreRenk],
          ['Malzeme', filtreMalzeme, setFiltreMalzeme],
          ['Kategori', filtreKategori, setFiltreKategori],
        ].map(([ph, val, set]) => (
          <SearchInput key={ph} size="sm" value={val} onChange={e => set(e.target.value)} placeholder={ph} aria-label={`${ph} filtresi`} style={{ width: 150 }} />
        ))}
        <Select size="sm" value={filtrePersonel} onChange={e => setFiltrePersonel(e.target.value)} aria-label="Personel" style={{ width: 'auto' }}>
          <option value="">Tüm personel</option>
          {kullanicilar.map(k => <option key={k.id} value={k.id}>{k.ad} {k.soyad || ''}</option>)}
        </Select>
        {filtreVar && (
          <Button size="sm" variant="plain" icon={X} onClick={() => { setFiltreMarka(''); setFiltreRenk(''); setFiltreMalzeme(''); setFiltrePersonel(''); setFiltreKategori(''); setFiltreMagaza('') }}>Filtreleri temizle</Button>
        )}
        <span className="vg-muted vg-num" style={{ marginLeft: 'auto', fontSize: 12 }}>{filtreli.length} kalem · {para(toplamFiltre)}</span>
      </div>

      <Tabs items={TABS} value={aktifTab} onChange={setAktifTab} />

      {yukleniyor && <LoadingRows />}

      {/* SATIŞ DETAYI */}
      {!yukleniyor && aktifTab === 'satis' && (
        <div className="vg-table-wrap">
          {filtreli.length === 0 ? <EmptyState title="Seçilen kriterlere uygun satış yok" text="Tarih aralığını genişletin ya da filtreleri temizleyin." /> : (
            <div className="vg-table-scroll">
              <table className="vg-table vg-table--compact" style={{ minWidth: 1100 }}>
                <thead><tr>
                  <th>Tarih</th><th>Fiş no</th><th>Ürün</th><th>Marka</th><th>Renk</th><th>Beden</th><th className="is-num">Adet</th><th className="is-num">Fiyat</th><th className="is-num">İnd.</th><th className="is-num">Toplam</th><th className="is-num">Maliyet</th><th className="is-num">Kâr</th><th>Mağaza</th><th>Kasiyer</th>
                </tr></thead>
                <tbody>
                  {filtreli.slice(0, 200).map((k, i) => (
                    <tr key={i}>
                      <td className="vg-nowrap vg-muted">{tarihTR(k.tarih)}</td>
                      <td className="vg-code vg-muted">{k.fisNo}</td>
                      <td className="is-strong">{k.urunAd}</td>
                      <td className="vg-muted">{k.marka || '—'}</td>
                      <td className="vg-muted">{k.renk || '—'}</td>
                      <td className="vg-muted">{k.beden || '—'}</td>
                      <td className="is-num">{k.adet}</td>
                      <td className="is-num">{para(k.birimFiyat)}</td>
                      <td className={`is-num${k.indirim > 0 ? ' vg-text-critical' : ' vg-muted'}`}>{k.indirim > 0 ? `%${k.indirim}` : '—'}</td>
                      <td className="is-num is-strong">{para(k.toplam)}</td>
                      <td className="is-num vg-muted">{k.maliyet?para(k.maliyet*k.adet):'—'}</td>
                      <td className={`is-num is-strong ${k.karMarji>0?'vg-text-success':'vg-text-critical'}`}>{k.karMarji!=null?para(k.karMarji):'—'}</td>
                      <td className="vg-muted">{k.magaza}</td>
                      <td className="vg-muted">{k.kasiyer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtreli.length > 200 && <div className="vg-table-footer">İlk 200 kayıt gösteriliyor. Tümü için Excel'e aktarın.</div>}
        </div>
      )}

      {/* ÜRÜN ANALİZİ */}
      {!yukleniyor && aktifTab === 'urun' && (
        <div className="vg-grid-2">
          <Card title="Marka bazlı ciro">
            <SiraliListe satirlar={markaBazli.slice(0, 10).map(([m, d]) => ({ key: m, ad: m, alt: `${d.adet} adet`, deger: para(d.ciro) }))} />
          </Card>
          <Card title="En çok satan renkler">
            <SiraliListe satirlar={renkBazli.map(([r, d]) => ({ key: r, ad: r, alt: `${d.adet} adet`, deger: para(d.ciro) }))} />
          </Card>
        </div>
      )}

      {/* PERSONEL */}
      {!yukleniyor && aktifTab === 'personel' && (
        <div className="vg-table-wrap">
          {personelBazli.length === 0 ? <EmptyState title="Bu dönemde satış kaydı yok" /> : (
            <div className="vg-table-scroll">
              <table className="vg-table" style={{ minWidth: 760 }}>
                <thead><tr><th>Personel</th><th className="is-num">Satış</th><th className="is-num">Toplam ciro</th><th className="is-num">Ort. sepet</th><th className="is-num">Hedef</th><th style={{ width: 220 }}>Gerçekleşme</th></tr></thead>
                <tbody>
                  {personelBazli.map(([kid, p]) => {
                    const kul = kullanicilar.find(k => k.id === kid)
                    const buAyHedef = kul?.hedefler?.[0]
                    const hedef = buAyHedef ? Number(buAyHedef.hedef) : Number(kul?.aylikHedef || 0)
                    const yuzde = hedef > 0 ? (p.ciro / hedef) * 100 : null
                    return (
                      <tr key={kid}>
                        <td><div className="is-strong">{p.ad}</div>{kul && <div className="vg-list__secondary">{kul.email}</div>}</td>
                        <td className="is-num">{p.satis}</td>
                        <td className="is-num is-strong">{para(p.ciro)}</td>
                        <td className="is-num">{para(p.ciro / (p.satis || 1))}</td>
                        <td className="is-num vg-muted">{hedef > 0 ? para(hedef) : '—'}</td>
                        <td>{yuzde !== null ? <Progress name={yuzde >= 100 ? 'Hedef aşıldı' : 'Devam ediyor'} pct={yuzde} state={yuzde >= 100 ? 'done' : undefined} /> : <span className="vg-muted" style={{ fontSize: 12 }}>Hedef tanımlanmamış</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GRAFİK */}
      {!yukleniyor && aktifTab === 'grafik' && (
        <Card title="Günlük ciro" subtitle={`${gunBazli.length} gün · toplam ${para(toplamCiro)}`}>
          {gunBazli.length === 0 ? <EmptyState compact title="Bu dönemde satış yok" /> : (
            <BarChart height={220} format={paraKisa} minBarWidth={gunBazli.length > 31 ? 28 : undefined}
              veri={gunBazli.map(([gun, ciro]) => ({ key: gun, label: gun.slice(8) + '.' + gun.slice(5, 7), value: ciro, current: gun === bugun, title: `${tarihTR(gun)}: ${para(ciro)}` }))} />
          )}
        </Card>
      )}

      {/* MASRAF SEKMESİ */}
      {!yukleniyor && aktifTab === 'masraf' && (
        <>
          <div className="vg-grid-4">
            <StatCard label="Toplam masraf" value={para(masrafToplam)} />
            <StatCard label="Masraf sayısı" value={masraflar.length} />
            <StatCard label="Nakit masraf" value={para(masraflar.filter(m=>m.odemeKaynagi==='nakit').reduce((t,m)=>t+Number(m.tutar||0),0))} />
            <StatCard label="Banka masrafı" value={para(masraflar.filter(m=>m.odemeKaynagi==='banka').reduce((t,m)=>t+Number(m.tutar||0),0))} />
          </div>
          <div className="vg-grid-2">
            <Card title="Kategori bazlı">
              <SiraliListe bos="Masraf yok" satirlar={Object.entries(masraflar.reduce((acc,m)=>{
                const k=m.kategori?.ad||'Kategorisiz'
                acc[k]=(acc[k]||0)+Number(m.tutar||0)
                return acc
              },{})).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({ key:k, ad:k, deger:para(v) }))} />
            </Card>
            <Card title="Ödeme kaynağı">
              <div className="vg-stack" style={{ gap: 12 }}>
                {[['nakit','Nakit'],['kart','Kart'],['banka','Banka']].map(([k,l])=>{
                  const top=masraflar.filter(m=>m.odemeKaynagi===k).reduce((t,m)=>t+Number(m.tutar||0),0)
                  const oran=masraflar.length>0?(masraflar.filter(m=>m.odemeKaynagi===k).length/masraflar.length*100):0
                  return top>0&&<Progress key={k} name={l} figures={para(top)} pct={oran} />
                })}
                {masrafToplam === 0 && <EmptyState compact title="Masraf yok" />}
              </div>
            </Card>
          </div>
          <div className="vg-table-wrap">
            {masraflar.length===0 ? <EmptyState title="Bu dönemde masraf yok" /> : (
              <div className="vg-table-scroll">
                <table className="vg-table" style={{ minWidth: 760 }}>
                  <thead><tr><th>Tarih</th><th>Kategori</th><th>Açıklama</th><th>Fatura no</th><th>Mağaza</th><th>Kaynak</th><th className="is-num">Tutar</th></tr></thead>
                  <tbody>
                    {masraflar.map(m=>(
                      <tr key={m.id}>
                        <td className="vg-nowrap vg-muted">{new Date(m.tarih).toLocaleDateString('tr-TR')}</td>
                        <td>{m.kategori ? <Badge color={m.kategori.renk}>{m.kategori.ad}</Badge> : '—'}</td>
                        <td>{m.aciklama||'—'}</td>
                        <td className="vg-code vg-muted">{m.faturaNo||'—'}</td>
                        <td className="vg-muted">{m.magaza?.ad||'Genel'}</td>
                        <td><Badge dot={false}>{m.odemeKaynagi==='nakit'?'Nakit':m.odemeKaynagi==='kart'?'Kart':'Banka'}</Badge></td>
                        <td className="is-num is-strong">−{para(m.tutar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MÜŞTERİ ANALİZİ SEKMESİ */}
      {!yukleniyor && aktifTab === 'musteri' && (
        <>
          <div className="vg-grid-3">
            <StatCard label="Toplam müşteri" value={musteriler.length} />
            <StatCard label="Alışveriş yapan" value={alisverisYapan} />
            <StatCard label="Ort. müşteri sepeti" value={para(musteriSatis.reduce((t,s)=>t+Number(s.genelToplam||0),0)/Math.max(alisverisYapan,1))} />
          </div>
          <div className="vg-grid-2">
            <Card title="En çok harcayan">
              <SiraliListe bos="Müşterili satış yok" satirlar={Object.entries(musteriSatis.reduce((acc,s)=>{
                const k=s.musteriId
                const ad=s.musteriAd||`${s.musteri?.ad||''} ${s.musteri?.soyad||''}`.trim()||'—'
                if(!acc[k]) acc[k]={ad,ciro:0,sayi:0}
                acc[k].ciro+=Number(s.genelToplam||0)
                acc[k].sayi++
                return acc
              },{})).sort((a,b)=>b[1].ciro-a[1].ciro).slice(0,8).map(([id,d])=>({ key:id, ad:d.ad, alt:`${d.sayi} alışveriş`, deger:para(d.ciro) }))} />
            </Card>
            <Card title="İade yapan müşteriler">
              <SiraliListe bos="İade yok" satirlar={Object.entries(iadeler.reduce((acc,i)=>{
                const musteriId=i.satis?.musteriId||i.siparis?.musteriId
                const ad=i.satis?.musteri?.ad||i.siparis?.musteriAd||'—'
                if(!musteriId) return acc
                if(!acc[musteriId]) acc[musteriId]={ad,adet:0,tutar:0}
                acc[musteriId].adet++
                acc[musteriId].tutar+=Number(i.toplam||i.toplamIade||0)
                return acc
              },{})).sort((a,b)=>b[1].adet-a[1].adet).slice(0,8).map(([id,d])=>({ key:id, ad:d.ad, alt:`${d.adet} iade`, deger:`−${para(d.tutar)}` }))} />
            </Card>
          </div>
        </>
      )}

      {/* İADE SEKMESİ */}
      {!yukleniyor && aktifTab === 'iade' && (
        <>
          <div className="vg-grid-4">
            <StatCard label="Toplam iade" value={para(iadeler.reduce((t,i)=>t+Number(i.toplam||i.toplamIade||0),0))} />
            <StatCard label="İade sayısı" value={iadeler.length} />
            <StatCard label="Onaylanan" value={iadeler.filter(i=>i.durum==='onaylandi').length} />
            <StatCard label="Bekleyen" value={iadeler.filter(i=>i.durum==='beklemede').length} />
          </div>
          {iadeler.flatMap(i=>i.kalemler||[]).length>0&&(
            <div className="vg-grid-2">
              <Card title="En çok iade edilen">
                <SiraliListe satirlar={Object.entries(iadeler.flatMap(i=>i.kalemler||[]).reduce((acc,k)=>{
                  acc[k.urunAd]=(acc[k.urunAd]||0)+Number(k.adet||1); return acc
                },{})).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([ad,adet])=>({ key:ad, ad, deger:`${adet} adet` }))} />
              </Card>
              <Card title="İade nedenleri">
                <SiraliListe satirlar={Object.entries(iadeler.reduce((acc,i)=>{
                  const n=i.neden||'Belirtilmemiş'; acc[n]=(acc[n]||0)+1; return acc
                },{})).sort((a,b)=>b[1]-a[1]).map(([n,s])=>({ key:n, ad:n.replace(/_/g,' '), deger:s }))} />
              </Card>
            </div>
          )}
          <div className="vg-table-wrap">
            {iadeler.length===0 ? <EmptyState title="Bu dönemde iade yok" /> : (
              <div className="vg-table-scroll">
                <table className="vg-table" style={{ minWidth: 760 }}>
                  <thead><tr><th>Tarih</th><th>İade no</th><th>Fiş/sipariş</th><th>Müşteri</th><th>Ürünler</th><th className="is-num">Tutar</th><th>Durum</th></tr></thead>
                  <tbody>
                    {iadeler.map(i=>{
                      const [ton, etiket] = IADE_DURUM[i.durum] || ['warning', 'Bekliyor']
                      return (
                        <tr key={i.id}>
                          <td className="vg-nowrap vg-muted">{new Date(i.tarih).toLocaleDateString('tr-TR')}</td>
                          <td className="vg-code">{i.iadeNo||'—'}</td>
                          <td className="vg-code">{i.satis?.fisNo||i.siparis?.siparisNo||'—'}</td>
                          <td>{i.satis?.musteri?.ad||i.siparis?.musteriAd||'—'}</td>
                          <td className="vg-muted" style={{ maxWidth: 220 }}><div className="vg-truncate">{(i.kalemler||[]).map(k=>k.urunAd).join(', ')||'—'}</div></td>
                          <td className="is-num is-strong">−{para(i.toplam||i.toplamIade||0)}</td>
                          <td><Badge tone={ton}>{etiket}</Badge></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MAĞAZA BAZLI SEKMESİ */}
      {!yukleniyor && aktifTab === 'magaza' && (
        magazaBazli.length === 0 ? <div className="vg-card"><EmptyState icon={Store} title="Veri yok" /></div> : (
          <div className="vg-stack">
            {magazaBazli.map(([mag,d])=>{
              const mMasraf=masraflar.filter(m=>m.magaza?.ad===mag).reduce((t,m)=>t+Number(m.tutar||0),0)
              const mIade=iadeler.filter(i=>(typeof i.satis?.magaza==='object'?i.satis?.magaza?.ad:i.satis?.magaza)===mag).reduce((t,i)=>t+Number(i.toplam||0),0)
              const net = d.ciro-mMasraf-mIade
              return (
                <Card key={mag} title={mag}>
                  <div className="vg-grid-4" style={{ gap: 8 }}>
                    <Tile label="Ciro" value={para(d.ciro)}><div className="vg-help">{d.sayi} satış</div></Tile>
                    <Tile label="Masraf" value={`−${para(mMasraf)}`} />
                    <Tile label="İade" value={`−${para(mIade)}`} />
                    <Tile label="Net" value={para(net)} tone={net >= 0 ? 'success' : 'critical'} />
                  </div>
                </Card>
              )
            })}
          </div>
        )
      )}
    </Page>
  )
}
