// ─── PAYLAŞILAN YARDIMCILAR ───────────────────────────────────

export const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`

export const tarihFormat = iso => {
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'})
    + ' ' + d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})
}

export const ODEME_TIPLERI = [
  { id:'nakit',  label:'Nakit',        ikon:'💵', renk:'#6fcf97' },
  { id:'kart',   label:'Kredi Kartı',  ikon:'💳', renk:'#56ccf2' },
  { id:'havale', label:'Havale / EFT', ikon:'🏦', renk:'#bb87fc' },
  { id:'taksit', label:'Taksit',       ikon:'📅', renk:'#f2c94c' },
]

export const BANKALAR = [
  'İş Bankası','Garanti BBVA','Yapı Kredi','Akbank','Ziraat Bankası',
  'Halkbank','Vakıfbank','Denizbank','QNB Finansbank','TEB','HSBC','ING'
]

export const TAKSIT_SECENEKLERI = [1,2,3,6,9,12]

// ─── FİŞ YAZDIRMA STİLİ (termal yazıcı) ──────────────────────
// Termal kafa gri tonları noktalı (dither) basar; ekranda şık duran #666/#999/#aaa
// gibi renkler kağıtta soluk, hatta okunmaz çıkıyordu. Fişlerde bu yüzden:
//   • her şey saf siyah (yazdırmada `!important` ile inline renkler de eziliyor),
//   • gövde kalın (kalın monospace termal kafada belirgin daha koyu basar),
//   • punto bir tık büyük, ayraçlar kesikli değil düz çizgi.
// Tüm fişler (satış, değişim, Z raporu) bu tek kaynağı kullanır.
export const FIS_CSS = `
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{ size:80mm auto; margin:0; }
  html,body{
    font-family:'Courier New',monospace;
    font-size:13px;
    font-weight:700;
    color:#000;
    background:#fff;
    width:76mm;
    padding:8px;
    margin:0;
    -webkit-font-smoothing:none;
  }
  .c{text-align:center;}
  .row,.r{display:flex;justify-content:space-between;margin-bottom:3px;}
  .bold{font-weight:900;}
  .sm{font-size:11px;font-weight:700;color:#000;}
  .lg{font-size:17px;font-weight:900;}
  hr{border:none;border-top:2px solid #000;margin:7px 0;}
  @media print{
    html,body{height:auto;}
    body{padding-bottom:14px;}
    /* Inline gri/renkli metinleri de siyaha çeviriyoruz — asıl "silik baskı" sebebi bu. */
    *{color:#000 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }
`
