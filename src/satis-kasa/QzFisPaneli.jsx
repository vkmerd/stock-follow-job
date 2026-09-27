import { useState } from 'react'
import { usePrint } from '../print/usePrint'

// Satış fişindeki (satis-kasa.jsx > FisModal) QZ Tray kutusunun paylaşılan hâli.
// İade ve Değişim ekranları da aynı fiziksel fiş yazıcısını kullanıyor; yazıcı
// seçimi usePrint içinde localStorage'a yazıldığı için bir kere seçmek yeterli,
// üç ekran da aynı seçimi görüyor.
//
// `yazdir` prop'u fişi basan async fonksiyon (usePrint'ten gelen iadeFisiYazdir /
// degisimFisiYazdir gibi), `veri` ise ona verilecek kayıt.
export default function QzFisPaneli({ t, yazdir, veri, etiket = '🖨 QZ ile Fiş Bas', tarayicidanYazdir = null }) {
  const print = usePrint()
  const [yazdiriliyor, setYazdiriliyor] = useState(false)
  const [sonuc, setSonuc] = useState(null)

  const bas = async () => {
    setYazdiriliyor(true)
    setSonuc(null)
    try {
      await yazdir(veri)
      setSonuc({ tip: 'ok', mesaj: '✓ Fiş yazıcıya gönderildi' })
    } catch (err) {
      setSonuc({ tip: 'hata', mesaj: '✗ ' + (err.message || 'Yazdırılamadı') })
    } finally {
      setYazdiriliyor(false)
    }
  }

  return (
    <div style={{ marginTop: 12, padding: '10px 12px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: print.bagli ? '#6fcf97' : '#eb5757' }} />
        <span style={{ fontSize: 11, color: t.textMuted }}>QZ Tray: {print.bagli ? 'Bağlı' : 'Bağlı Değil'}</span>
        {!print.bagli && (
          <button onClick={print.baglan} disabled={print.baglaniyor}
            style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, color: t.accent, cursor: 'pointer' }}>
            {print.baglaniyor ? 'Bağlanıyor...' : 'Bağlan'}
          </button>
        )}
        {tarayicidanYazdir && (
          <button onClick={tarayicidanYazdir}
            style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'transparent', border: `1px solid ${t.border}`, color: t.textMuted, cursor: 'pointer' }}>
            🖨 Tarayıcıdan
          </button>
        )}
      </div>

      {print.bagli && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select value={print.fisYazici} onChange={e => print.fisYaziciSec(e.target.value)}
            style={{ flex: 1, minWidth: 140, padding: '6px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}>
            <option value="">Fiş yazıcısı seçin...</option>
            {print.yazicilar.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={bas} disabled={yazdiriliyor || !print.fisYazici}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              cursor: (yazdiriliyor || !print.fisYazici) ? 'default' : 'pointer',
              background: 'rgba(111,207,151,.15)', border: '1px solid rgba(111,207,151,.35)', color: '#6fcf97',
              opacity: (yazdiriliyor || !print.fisYazici) ? 0.5 : 1
            }}>
            {yazdiriliyor ? '...' : etiket}
          </button>
        </div>
      )}

      {print.hata && <div style={{ marginTop: 6, fontSize: 10, color: '#eb5757' }}>{print.hata}</div>}
      {sonuc && <div style={{ marginTop: 6, fontSize: 10, color: sonuc.tip === 'ok' ? '#6fcf97' : '#eb5757' }}>{sonuc.mesaj}</div>}
    </div>
  )
}
