import { useState } from 'react'
import { usePrint } from '../print/usePrint'
import { Button, Select } from '../ui'
import { Printer, Plug } from 'lucide-react'

// Satış, iade ve değişim fişlerinin paylaşılan QZ Tray kutusu.
// Üç ekran da aynı fiziksel fiş yazıcısını kullanıyor; yazıcı seçimi usePrint
// içinde localStorage'a yazıldığı için bir kere seçmek yeterli.
//
// `yazdir` prop'u fişi basan async fonksiyon (usePrint'ten gelen fisYazdir /
// iadeFisiYazdir / degisimFisiYazdir gibi), `veri` ise ona verilecek kayıt.
export default function QzFisPaneli({ yazdir, veri, etiket = 'QZ ile fiş bas', tarayicidanYazdir = null }) {
  const print = usePrint()
  const [yazdiriliyor, setYazdiriliyor] = useState(false)
  const [sonuc, setSonuc] = useState(null)

  const bas = async () => {
    setYazdiriliyor(true)
    setSonuc(null)
    try {
      await yazdir(veri)
      setSonuc({ tip: 'ok', mesaj: 'Fiş yazıcıya gönderildi.' })
    } catch (err) {
      setSonuc({ tip: 'hata', mesaj: err.message || 'Yazdırılamadı.' })
    } finally {
      setYazdiriliyor(false)
    }
  }

  return (
    <div className="vg-tile vg-stack vg-no-print" style={{ gap: 8 }}>
      <div className="vg-row" style={{ gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: print.bagli ? 'var(--success)' : 'var(--critical)' }} />
        <span className="vg-muted" style={{ fontSize: 12 }}>QZ Tray {print.bagli ? 'bağlı' : 'bağlı değil'}</span>
        {!print.bagli && <Button size="sm" icon={Plug} onClick={print.baglan} loading={print.baglaniyor}>{print.baglaniyor ? 'Bağlanıyor…' : 'Bağlan'}</Button>}
        {tarayicidanYazdir && <Button size="sm" variant="plain" icon={Printer} onClick={tarayicidanYazdir} style={{ marginLeft: 'auto' }}>Tarayıcıdan yazdır</Button>}
      </div>

      {print.bagli && (
        <div className="vg-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <Select size="sm" value={print.fisYazici} onChange={e => print.fisYaziciSec(e.target.value)} aria-label="Fiş yazıcısı" style={{ flex: 1, minWidth: 0 }}>
            <option value="">Fiş yazıcısı seçin</option>
            {print.yazicilar.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Button size="sm" variant="primary" icon={Printer} onClick={bas} disabled={!print.fisYazici} loading={yazdiriliyor}>{etiket}</Button>
        </div>
      )}

      {print.hata && <div className="vg-error">{print.hata}</div>}
      {sonuc && <div className={sonuc.tip === 'ok' ? 'vg-text-success' : 'vg-error'} style={{ fontSize: 12 }}>{sonuc.mesaj}</div>}
    </div>
  )
}
