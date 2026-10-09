import { useState, useMemo } from 'react'
import { para, tarihFormat } from './utils'
import { Page, PageHeader, Card, Select, Segmented, StatCard, EmptyState } from '../ui'
import { CreditCard } from 'lucide-react'

export default function PosRapor({ gecmis, terminaller }) {
  const [donem, setDonem]           = useState('bugun')
  const [magazaFiltre, setMagazaFiltre] = useState('Tümü')

  const simdi = new Date()
  const filtreli = useMemo(() => {
    return gecmis.filter(s => {
      const tarih = new Date(s.tarih)
      if (donem === 'bugun')    return tarih.toDateString() === simdi.toDateString()
      if (donem === 'bu_hafta') return (simdi - tarih) <= 7 * 86400000
      if (donem === 'bu_ay')    return tarih.getMonth() === simdi.getMonth() && tarih.getFullYear() === simdi.getFullYear()
      return true
    }).filter(s => magazaFiltre === 'Tümü' || (typeof s.magaza==='object'?s.magaza?.ad:s.magaza) === magazaFiltre)
  }, [gecmis, donem, magazaFiltre])

  const kartOdemeleri = filtreli.flatMap(s => (s.odemeler||[]).filter(o => ['kart','taksit'].includes(o.tip)))
  const genelBrut     = kartOdemeleri.reduce((t,o) => t + Number(o.tutar), 0)
  const genelKomisyon = kartOdemeleri.reduce((t,o) => t + Number(o.komisyonTutar||0), 0)
  const genelNet      = genelBrut - genelKomisyon

  // Terminal bazlı gruplama
  const terminalRapor = terminaller.map(ter => {
    const odemeler = kartOdemeleri.filter(o => o.posId === ter.id)
    return {
      ...ter,
      islemSayisi:    odemeler.length,
      brutToplam:     odemeler.reduce((t,o) => t + Number(o.tutar), 0),
      komisyonToplam: odemeler.reduce((t,o) => t + Number(o.komisyonTutar||0), 0),
      netToplam:      odemeler.reduce((t,o) => t + Number(o.netTahsilat||o.tutar), 0),
    }
  }).filter(x => x.islemSayisi > 0)

  const magazalar = [...new Set(gecmis.map(s => typeof s.magaza==='object'?s.magaza?.ad:s.magaza).filter(Boolean))]
  const kartSatirlari = filtreli.flatMap(s => (s.odemeler||[]).filter(o=>['kart','taksit'].includes(o.tip)).map((o,i)=>({ s, o, key: `${s.fisNo}_${i}` })))

  return (
    <Page>
      <PageHeader title="POS ve banka raporu" subtitle={`${filtreli.length} satış işlemi`}>
        <div className="vg-row">
          <Segmented label="Dönem" value={donem} onChange={setDonem}
            options={[{ value:'bugun', label:'Bugün' }, { value:'bu_hafta', label:'Son 7 gün' }, { value:'bu_ay', label:'Bu ay' }, { value:'hepsi', label:'Tümü' }]} />
          <Select size="sm" value={magazaFiltre} onChange={e=>setMagazaFiltre(e.target.value)} aria-label="Mağaza" style={{ width: 'auto' }}>
            <option value="Tümü">Tüm mağazalar</option>
            {magazalar.map(m=><option key={m}>{m}</option>)}
          </Select>
        </div>
      </PageHeader>

      <div className="vg-grid-4">
        <StatCard label="Kartla brüt ciro" value={para(genelBrut)} />
        <StatCard label="Toplam komisyon" value={para(genelKomisyon)} />
        <StatCard label="Net tahsilat" value={para(genelNet)} />
        <StatCard label="Ortalama komisyon" value={`%${genelBrut>0?((genelKomisyon/genelBrut)*100).toFixed(2).replace('.', ','):0}`} />
      </div>

      {terminalRapor.length > 0 && (
        <Card title="Terminal bazlı komisyon" padded={false}>
          <div className="vg-table-scroll" style={{ marginTop: 10 }}>
            <table className="vg-table" style={{ minWidth: 640 }}>
              <thead><tr><th>Terminal</th><th>Banka</th><th className="is-num">İşlem</th><th className="is-num">Brüt</th><th className="is-num">Komisyon</th><th className="is-num">Net</th></tr></thead>
              <tbody>
                {terminalRapor.map(r=>(
                  <tr key={r.id}>
                    <td className="is-strong">{r.ad}</td>
                    <td className="vg-muted">{r.banka}</td>
                    <td className="is-num">{r.islemSayisi}</td>
                    <td className="is-num is-strong">{para(r.brutToplam)}</td>
                    <td className="is-num vg-text-critical">−{para(r.komisyonToplam)}</td>
                    <td className="is-num is-strong vg-text-success">{para(r.netToplam)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Kredi kartı işlemleri" padded={false}>
        {kartSatirlari.length === 0 ? <EmptyState compact icon={CreditCard} title="Bu dönemde kartla işlem yok" /> : (
          <div className="vg-table-scroll" style={{ marginTop: 10 }}>
            <table className="vg-table" style={{ minWidth: 760 }}>
              <thead><tr><th>Fiş no</th><th>Tarih</th><th>Mağaza</th><th>Ödeme</th><th className="is-num">Tutar</th><th className="is-num">Komisyon</th><th className="is-num">Net</th></tr></thead>
              <tbody>
                {kartSatirlari.map(({ s, o, key })=>(
                  <tr key={key}>
                    <td className="vg-code">{s.fisNo}</td>
                    <td className="vg-nowrap vg-muted">{tarihFormat(s.tarih)}</td>
                    <td>{typeof s.magaza==='object'?s.magaza?.ad:s.magaza}</td>
                    <td>{o.banka} {o.taksit>1?<span className="vg-muted">· {o.taksit} taksit</span>:''}</td>
                    <td className="is-num is-strong">{para(o.tutar)}</td>
                    <td className="is-num vg-text-critical">−{para(o.komisyonTutar)}</td>
                    <td className="is-num is-strong">{para(o.netTahsilat||o.tutar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  )
}
