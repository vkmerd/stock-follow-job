import qz from 'qz-tray'

// ─── ZDESIGNER + RAW ZPL KURULUM NOTU ─────────────────────────
// Zebra ZD220/ZD230/ZD420 gibi yazıcılarda Windows'a kurulu olan normal
// "ZDesigner ZD420" sürücüsü RAW ZPL verisini bazen kendi içinde yorumlamaya
// çalışır ve sessizce hiçbir şey basmaz (job kuyrukta "gönderildi" görünür).
// Bu yüzden ZPL modunu kullanmak için, AYNI yazıcı için Windows'ta EK bir
// "Generic / Text Only" (veya port türü RAW) yazıcı kuyruğu oluşturulmalı:
//   1) Ayarlar > Yazıcılar ve Tarayıcılar > Yazıcı/Tarayıcı Ekle
//   2) "İhtiyacım olan yazıcı listede yok" > Yerel yazıcı, var olan portu seç
//      (zaten kurulu ZD420'nin kullandığı USB00x portunu seç)
//   3) Sürücü olarak Generic > Generic / Text Only seç
//   4) Yeni kuyruğa "ZD420-RAW" gibi bir isim ver
// QZ Tray'de yazıcı listesinde bu "ZD420-RAW" kuyruğu seçilmeli — normal
// "ZDesigner ZD420" sürücüsü değil. Bu sayede ZPL komutu hiçbir
// sürücü işlemesinden geçmeden doğrudan yazıcıya ulaşır.

// ─── GÜVENLİK AYARLARI (PROD UYUMLU) ──────────────────────────
// Eğer özel bir .pem sertifikan yoksa, bu ayarlar "anonim" bağlantı sağlar.
// Tarayıcı ilk bağlantıda "İzin verilsin mi?" diye soracaktır, "Always Allow" demen yeterli.
qz.security.setSignatureAlgorithm('SHA512');
qz.security.setSignaturePromise((toSign) => {
    return (resolve) => resolve(); 
});
qz.security.setCertificatePromise((resolve) => resolve());

// Türkçe karakter → ASCII fallback (yazıcı uyumlu)
function trChar(str) {
  if (!str) return ''
  return String(str)
    .replace(/"/g, "'") // Komut hatasını önlemek için tırnakları değiştir
    .replace(/İ/g, 'I').replace(/ı/g, 'i')
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c')
    // Şapkalı harfler (kâğıt, şikâyet, hâlâ...) termal yazıcının kod sayfasında
    // çoğu zaman yok — dönüştürülmezse boş kutu ya da yanlış glif basıyor.
    .replace(/Â/g, 'A').replace(/â/g, 'a')
    .replace(/Î/g, 'I').replace(/î/g, 'i')
    .replace(/Û/g, 'U').replace(/û/g, 'u')
    // Tipografik işaretler (Word'den/web'den yapıştırılan notlarda sık çıkıyor)
    .replace(/[‐-―]/g, '-')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, "'")
    .replace(/…/g, '...')
}

// Font adı ('1','2','3','3.5','4') → yaklaşık yükseklik (dot). Hem TSPL hem ZPL
// motoru aynı koordinat/font isim sistemini paylaştığı için genişlik tahmini de
// (fitText içinde) buradan tek yerden besleniyor.
const FONT_YUKSEKLIK = { '1': 18, '2': 24, '3': 32, '3.5': 40, '4': 48 }

// Bir fontta bir karakterin yaklaşık genişliği (dot). ZPL'in ^A0 font genişliği
// hesabıyla aynı oran (yükseklik * 0.85) kullanılıyor — tam ölçüm değil ama etiket
// üzerinde sığdırma kararı vermek için yeterli bir tahmin.
function karakterGenisligi(font, xMul = 1) {
  return Math.round((FONT_YUKSEKLIK[String(font)] || 24) * xMul * 0.85) || 1
}

// Code128'in bir modülünün (en dar çubuk/boşluk biriminin) kaç dot olacağını
// firmware belirler. Gerçek dot genişliği = modül sayısı × seçilen modül
// (narrow) genişliği — barkodu bir alana ortalamak için genişliğini tahmin
// etmekte kullanılıyor. NOT: bu yazıcının kendi Code128 kod seçici mantığı
// rakam çiftlerini tek sembole sıkıştırmıyor gibi görünüyor (Code128C
// varsayımıyla hesaplanan tahmin gerçekte basılandan daha DAR çıkıp barkodun
// sağa kaymasına yol açtı) — bu yüzden her hane kendi sembolüymüş gibi
// (Code128B, sıkıştırmasız) daha geniş ve gerçeğe daha yakın hesaplıyoruz.
function barkodModulSayisi(data) {
  const str = String(data || '').trim() || '0'
  const sembolSayisi = str.length // her karakter kendi sembolü — sıkıştırma yok
  const kodModul = 11 * sembolSayisi + 11 /* start */ + 11 /* checksum */ + 13 /* stop */
  const sessizBolgeModul = 10 * 2 // her iki yanda ~10 modüllük quiet zone
  return kodModul + sessizBolgeModul
}

// Verilen genişliğe sığmayan metni önce daha küçük bir fonta düşürür; o da tek
// satıra sığmıyorsa metni `maxLines`'a kadar satıra bölüp aşağı kaydırır (metin
// hiçbir zaman sessizce kesilmez — eskiden sabit 2 satır sınırı vardı, bundan
// uzun metinler sessizce yarım basılıyordu). Bir sonraki elemanın
// başlayabileceği y konumunu döndürür.
// mul: TSPL'de KESİN desteklenen tam sayı büyütme (x-mul/y-mul) — font adı
// değiştirmeden ince ayarlı büyütme gerektiğinde kullanılır (bkz. çağıran taraf).
// minMul: fallback (sığmadığında düşülen) fontun kendi büyütmesi — mul'dan
// AYRI tutuluyor, yoksa mul>1 olduğunda "küçük fonta düş" adımı da aynı
// oranda büyütülüp gerçekte hiç küçülmüyor, metin sessizce yarım kesiliyordu.
function fitText(e, x, y, text, maxWidthDot, { font = '2', minFont = '1', lineGap = 20, maxLines = 4, mul = 1, minMul = 1 } = {}) {
  text = String(text || '').trim()
  if (!text) return y

  const sigar = (t, f, m) => t.length * karakterGenisligi(f, m) <= maxWidthDot

  if (sigar(text, font, mul)) {
    e.text(x, y, font, 0, mul, mul, text)
    return y + lineGap
  }

  // Tek satıra sığmıyor — küçük fontla, gerektiği kadar (maxLines'a kadar) satıra böl.
  const maxChars = Math.max(1, Math.floor(maxWidthDot / karakterGenisligi(minFont, minMul)))
  let kalan = text
  let satirY = y
  let satirSayisi = 0
  while (kalan && satirSayisi < maxLines) {
    e.text(x, satirY, minFont, 0, minMul, minMul, kalan.slice(0, maxChars))
    kalan = kalan.slice(maxChars)
    satirY += lineGap
    satirSayisi++
  }
  return satirY
}

// ─── TSPL ENGINE (EML 400L - mm bazlı) ───────────────────────
export const createTsplEngine = (genislik = 50, yukseklik = 30) => {
  let lines = [
    `SIZE ${genislik} mm, ${yukseklik} mm`,
    'GAP 2 mm, 0 mm',
    'SPEED 2',
    'DENSITY 7',
    'DIRECTION 0',
    'CLS',
  ]
  return {
    text: (x, y, font, rotation, xMul, yMul, text) => {
      lines.push(`TEXT ${x},${y},"${font}",${rotation},${xMul},${yMul},"${trChar(text)}"`)
    },
    barcode: (x, y, type, height, readable, rotation, narrow, wide, data) => {
      lines.push(`BARCODE ${x},${y},"${type}",${height},${readable},${rotation},${narrow},${wide},"${data}"`)
    },
    qr: (x, y, eccLevel, cellWidth, mode, rotation, data) => {
      lines.push(`QRCODE ${x},${y},${eccLevel},${cellWidth},${mode},${rotation},"${data}"`)
    },
    line: (x, y, x2, y2, color) => {
      lines.push(`LINE ${x},${y},${x2},${y2},${color||1}`)
    },
    bar: (x, y, width, height) => {
      lines.push(`BAR ${x},${y},${width},${height}`)
    },
    // radius: köşe yuvarlaklığı (dot) — TSPL'in BOX komutu 5. parametre olarak kabul ediyor.
    box: (x, y, x2, y2, thickness, radius) => {
      lines.push(`BOX ${x},${y},${x2},${y2},${thickness||1},${radius||0}`)
    },
    print: (adet = 1) => {
      lines.push(`PRINT ${adet},1`)
    },
    getTspl: () => lines.join('\n') + '\n'
  }
}

// ─── ZPL ENGINE (Zebra ZD220/ZD230/ZD420 - dot bazlı, 203dpi) ─
// ZDesigner sürücüsü kurulu yazıcılarda RAW formatla gönderilir.
// Koordinat sistemi TSPL ile aynı (x,y dot) tutuldu; şablon
// fonksiyonları her iki motoru da aynı parametrelerle besler.
export const createZplEngine = (genislikMm = 50, yukseklikMm = 30, dpi = 203) => {
  const dotPerMm = dpi / 25.4
  const genislikDot = Math.round(genislikMm * dotPerMm)
  const yukseklikDot = Math.round(yukseklikMm * dotPerMm)
  let fields = []

  return {
    text: (x, y, font, rotation, xMul, yMul, text) => {
      const h = Math.round((FONT_YUKSEKLIK[String(font)] || 24) * (yMul || 1))
      const w = Math.round((FONT_YUKSEKLIK[String(font)] || 24) * (xMul || 1) * 0.85)
      const orient = rotation === 90 ? 'R' : rotation === 180 ? 'I' : rotation === 270 ? 'B' : 'N'
      fields.push(`^FO${x},${y}^A0${orient},${h},${w}^FD${trChar(text)}^FS`)
    },
    // ZPL ^BC: Code128. height=dot, readable: TSPL'deki 0/1/2 -> Y/N eşlemesi
    barcode: (x, y, type, height, readable, rotation, narrow, wide, data) => {
      const orient = rotation === 90 ? 'R' : rotation === 180 ? 'I' : rotation === 270 ? 'B' : 'N'
      const altYazi = readable && readable !== 0 ? 'Y' : 'N'
      fields.push(`^FO${x},${y}^BY${narrow || 2}^BC${orient},${height},${altYazi},N,N^FD${String(data)}^FS`)
    },
    // ZPL ^BQ: QR Code
    qr: (x, y, eccLevel, cellWidth, mode, rotation, data) => {
      const orient = rotation === 90 ? 'R' : rotation === 180 ? 'I' : rotation === 270 ? 'B' : 'N'
      fields.push(`^FO${x},${y}^BQ${orient},2,${cellWidth || 4}^FDQA,${String(data)}^FS`)
    },
    line: (x, y, x2, y2) => {
      const w = Math.max(1, Math.abs(x2 - x))
      const h = Math.max(1, Math.abs(y2 - y))
      fields.push(`^FO${Math.min(x, x2)},${Math.min(y, y2)}^GB${w},${h},${Math.min(w, h) || 1}^FS`)
    },
    bar: (x, y, width, height) => {
      fields.push(`^FO${x},${y}^GB${width},${height},${height}^FS`)
    },
    // radius: köşe yuvarlaklığı 0-8 arası derece — ZPL'in ^GB komutunun son parametresi.
    box: (x, y, x2, y2, thickness, radius) => {
      const w = Math.abs(x2 - x)
      const h = Math.abs(y2 - y)
      fields.push(`^FO${Math.min(x, x2)},${Math.min(y, y2)}^GB${w},${h},${thickness || 2},B,${Math.min(8, radius || 0)}^FS`)
    },
    print: (adet = 1) => {
      fields.__adet = adet
    },
    getZpl: () => {
      const adet = fields.__adet || 1
      return [
        '^XA',
        `^PW${genislikDot}`,
        `^LL${yukseklikDot}`,
        '^CI28', // UTF-8 (trChar fallback'i de korunuyor)
        ...fields,
        `^PQ${adet}`,
        '^XZ',
      ].join('\n') + '\n'
    },
  }
}

// ─── YAZICI KALİBRASYONU (etiket boşluğu/gap algılama) ────────
// Belirti: iş "başarılı" gönderiliyor (QZ hata vermiyor), ama yazıcı basılan
// etiketi dışarı itmiyor — ancak yazıcının kendi FEED tuşuna basılınca çıkıyor.
// Bu, yazıcının gap/notch sensörünün takılı etikete göre KALİBRE OLMADIĞI
// anlamına gelir (yazıcı etiketin nerede bittiğini bilmiyor). Fiziksel
// FEED-basılı-açma prosedürü yerine, aynı işi tetikleyen ham komutu
// doğrudan QZ Tray üzerinden gönderiyoruz — kullanıcı yazıcıya dokunmadan
// yazılımdan kalibre edebilsin diye.
function kalibrasyonKomutu(motor = 'tspl') {
  // ZPL: önce medya takip modunu AÇIKÇA gap/web sensing'e ayarlayıp kalıcı
  // hafızaya kaydediyoruz (^MNY + ^JUS), SONRA "~JC" (Set Media Sensor
  // Calibration) ile autocalibration'ı tetikliyoruz. Sıra önemli: ~JC modu
  // DEĞİL, o an ayarlı olan modun sensör eşiklerini kalibre eder — mod
  // yanlışsa (örn. continuous'a düşmüşse) kalibrasyon "başarılı" görünür
  // ama yazıcı hâlâ gerçek gap'i değil ^LL'i baz alır ve baskı sayısı
  // arttıkça biriken bir kaymaya yol açar.
  if (motor === 'zpl') return '^XA\n^MNY\n^JUS\n^XZ\n~JC\n'
  // TSPL ailesi (EML 400L ve benzeri): GAP DETECT komutu aynı işi yapar.
  return 'GAP DETECT\n'
}

// Belirti: içerik doğru basılıyor ama yazıcı her etiketi TEK TEK dışarı atmıyor —
// birden fazla iş gönderilince hepsi kafanın altında birikip ancak FEED tuşuna
// basınca (ya da yeterince biriktiğinde) toplu halde çıkıyor. Bu, yazıcının
// "Print Mode" ayarının Tear-off (her format sonunda otomatik ileri at) yerine
// batch/rewind gibi bir moda ayarlı olduğunu gösteriyor. `^MMT` komutunu HER
// işte göndermek bu yazıcıda çakışıp baskıyı tamamen durdurdu — bu yüzden bunun
// yerine aynı ayarı yazıcının kendi kalıcı hafızasına BİR KERE kaydediyoruz
// (`^JUS`), böylece her iş için tekrar göndermeye gerek kalmıyor.
function yaziciModuKaydetKomutu(motor = 'tspl') {
  if (motor === 'zpl') return '^XA\n^MMT\n^JUS\n^XZ\n'
  return '' // TSPL ailesinde bu batch davranışı görülmüyor, gönderilecek bir şey yok.
}

// ─── ESC/POS FİŞ MOTORU (Zjiang ve benzeri 80mm termal fiş yazıcılar) ──
// Tarayıcı (window.print) ile fiş basmak, Windows yazıcı sürücüsünün sayfa
// boyutunu doğru yorumlamasına bağlıdır — bazı termal fiş sürücülerinde bu
// üstte boşluk bırakma / sonda kağıdın tam kesilmemesi şeklinde sorun
// çıkarır. Ham ESC/POS ile doğrudan yazıcıya bayt göndermek bu belirsizliği
// ortadan kaldırır ve sonunda açık bir "besle + kes" komutu içerir.
const ESC = '\x1B'
const GS  = '\x1D'

function esLine(left = '', right = '', width = 48) {
  left = trChar(String(left))
  right = trChar(String(right))
  if (left.length + right.length >= width) {
    return (left.slice(0, Math.max(0, width - right.length - 1)) + ' ' + right).slice(0, width) + '\n'
  }
  return left + ' '.repeat(width - left.length - right.length) + right + '\n'
}

function esDashedLine(width = 48) {
  return '-'.repeat(width) + '\n'
}

// ─── FİŞ ALT BİLGİ GÖRSELİ (Instagram + Web ikonu) ─────────────
// Termal yazıcının yerleşik ESC/POS fontu emoji/ikon içermiyor — 📷/🌐 gibi
// karakterleri ham metin olarak göndermek boş kutucuk ya da yanlış glif
// basar. Bu yüzden bu satırı gerçek bir görsel olarak bastırıyoruz: tarayıcı
// emoji'yi zaten doğru render ediyor (bkz. fiş önizlemesi), o çizimi
// canvas'tan PNG'ye çevirip QZ Tray'in ESC/POS resim modunu (GS v 0 raster
// bit image) kullanarak gönderiyoruz. Bit paketleme işini elle yapmak
// yerine (yanlış paketlenirse fişin geri kalanını da bozma riski var) bu
// işi QZ Tray'in kendi resim dönüştürücüsüne bırakıyoruz.
function sosyalMedyaGorseli(dotGenislik = 576) {
  const canvas = document.createElement('canvas')
  canvas.width = dotGenislik
  canvas.height = 90
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '30px "Segoe UI Emoji", "Noto Color Emoji", Arial, sans-serif'
  ctx.fillText('📷  vegacantastore', canvas.width / 2, 30)
  ctx.fillText('🌐  www.vegacantastore.com', canvas.width / 2, 65)
  return canvas.toDataURL('image/png')
}

// Fişin gövdesini iki parçaya ayırarak üretir: `ust` (başlıktan teşekkür
// satırına kadar her şey) ve `alt` (besleme + kesim). Aradaki sosyal medya
// satırı çağıran tarafından eklenir — buildFisEscPos düz metin fallback'i,
// buildFisYazdirmaKomutlari ise gerçek görseli ekler.
function buildFisGovde(satis, width = 48) {
  const magazaAd = typeof satis.magaza === 'object' ? satis.magaza?.ad : satis.magaza
  const para = v => `${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
  const musteriAdi = typeof satis.musteri === 'object'
    ? `${satis.musteri?.ad || ''} ${satis.musteri?.soyad || ''}`.trim()
    : (satis.musteri || satis.musteriAd || '')
  const tarihStr = (() => {
    const d = new Date(satis.tarih)
    return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  })()

  let ust = ESC + '@' // yazıcıyı sıfırla

  ust += ESC + 'a' + '\x01' // ortala
  ust += GS + '!' + '\x11'  // çift genişlik + yükseklik
  ust += trChar('VEGA') + '\n'
  ust += GS + '!' + '\x00'  // normal boyut
  ust += trChar('Canta & Ayakkabi') + '\n'
  if (magazaAd) ust += trChar(magazaAd) + '\n'
  ust += ESC + 'a' + '\x00' // sola yasla

  ust += esDashedLine(width)
  ust += esLine('Tarih:', tarihStr, width)
  ust += esLine('Fis No:', satis.fisNo, width)
  if (musteriAdi) ust += esLine('Musteri:', musteriAdi, width)
  if (satis.kasiyer) ust += esLine('Kasiyer:', satis.kasiyer, width)
  ust += esDashedLine(width)

  ;(satis.kalemler || []).forEach(k => {
    const varyant = [k.renk, k.beden].filter(Boolean).join('/')
    const indirimStr = k.indirim > 0 ? ` (-%${k.indirim})` : ''
    const ad = (k.marka ? k.marka + ' ' : '') + (k.urunAd || '')
    ust += esLine(ad, para(k.toplam), width)
    ust += trChar(`  ${varyant} x${k.adet} x${para(k.birimFiyat)}${indirimStr}`).slice(0, width) + '\n'
    if (k.barkod) ust += trChar(`  #${k.barkod}`).slice(0, width) + '\n'
  })

  ust += esDashedLine(width)
  ust += esLine('Ara Toplam', para(satis.araToplam), width)
  if (satis.genelIndirimTutar > 0) ust += esLine(`Indirim (%${satis.genelIndirim})`, '-' + para(satis.genelIndirimTutar), width)
  ust += esLine('KDV (Dahil)', para(satis.kdvToplam), width)
  ust += GS + '!' + '\x01' // çift yükseklik — TOPLAM vurgusu
  ust += esLine('TOPLAM', para(satis.genelToplam), width)
  ust += GS + '!' + '\x00'
  ust += esDashedLine(width)

  ;(satis.odemeler || []).forEach(o => {
    const label = { nakit: 'Nakit', kart: 'Kredi Karti', havale: 'Havale/EFT', taksit: 'Taksit', veresiye: 'Veresiye (Borc)' }[o.tip] || o.tip
    ust += esLine(label, para(o.tutar), width)
    if (o.banka) ust += trChar(`  ${o.banka}${o.taksit > 1 ? ' - ' + o.taksit + ' Taksit' : ''}`).slice(0, width) + '\n'
    if (o.komisyonTutar > 0) ust += trChar(`  Komisyon: -${para(o.komisyonTutar)}`).slice(0, width) + '\n'
  })
  if (satis.paraUstu > 0) ust += esLine('Para Ustu', para(satis.paraUstu), width)

  const toplamKomisyon = (satis.odemeler || []).reduce((t, o) => t + (o.komisyonTutar || 0), 0)
  if (toplamKomisyon > 0) {
    ust += esDashedLine(width)
    ust += esLine('Toplam Komisyon', '-' + para(toplamKomisyon), width)
    ust += esLine('Net Tahsilat', para((satis.odemeler || []).reduce((t, o) => t + (o.netTahsilat || 0), 0)), width)
  }

  ust += esDashedLine(width)
  // Ortalama işini karakter genişliği tahminiyle elle boşluk ekleyerek değil,
  // yazıcının kendi hizalama komutuyla yaptırıyoruz — böylece gerçek satır
  // genişliği (font/model'e göre değişebilir) bir önemi kalmıyor, her zaman
  // doğru ortalanıyor.
  ust += ESC + 'a' + '\x01' // ortala
  ust += trChar('Alisverisiniz icin tesekkurler') + '\n'
  ust += trChar('Vega Canta & Ayakkabi') + '\n'

  // Yazıcı ağzından tam çıkması için bolca besle (kesici olmayan modellerde
  // bu besleme fişin elle çekmeden kendiliğinden dışarı çıkmasını sağlar).
  const alt = '\n'.repeat(8) + GS + 'V' + '\x00' // destekleyen modellerde tam kesim (GS V 0) — desteklemeyen yazıcılarda zararsız şekilde yok sayılır

  return { ust, alt }
}

// Tek parça string döner — sosyal medya satırı burada düz ASCII metin olarak
// basılır (gerçek ikon yok ama her yazıcıda garanti basar). `yazdir()` gibi
// tek-string kabul eden eski yollarla geriye dönük uyumluluk için.
export function buildFisEscPos(satis, width = 48) {
  const { ust, alt } = buildFisGovde(satis, width)
  let sosyalMetin = ESC + 'a' + '\x01' // ortala
  sosyalMetin += trChar('Instagram: vegacantastore') + '\n'
  sosyalMetin += trChar('www.vegacantastore.com') + '\n'
  sosyalMetin += ESC + 'a' + '\x00' // sola yasla
  return ust + sosyalMetin + alt
}

// QZ Tray'e doğrudan verilecek karışık (metin + görsel) print job dizisini
// üretir — sosyal medya satırı burada gerçek bir görsel (Instagram/web
// ikonlu PNG) olarak basılır. usePrint.js -> fisYazdir bunu kullanır.
export function buildFisYazdirmaKomutlari(satis, width = 48) {
  const { ust, alt } = buildFisGovde(satis, width)
  return [
    { type: 'raw', format: 'plain', data: ust },
    { type: 'raw', format: 'image', data: sosyalMedyaGorseli(), options: { language: 'ESCPOS' } },
    { type: 'raw', format: 'plain', data: alt },
  ]
}

// ─── İADE FİŞİ ─────────────────────────────────────────────────
// Satış fişiyle aynı 80mm termal cihazdan basılır (bkz. buildFisGovde).
// İade ekranında daha önce hiç fiş basımı yoktu; müşteriye verilecek belge
// ve kasa kaydı için gerekli asgari bilgiyi taşır.
export function buildIadeFisiEscPos(iade, width = 48) {
  const para = v => `${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
  const tarihStr = (() => {
    const d = new Date(iade.tarih || Date.now())
    return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  })()
  const odemeLabel = { nakit: 'Nakit', kart: 'Kredi Karti', havale: 'Havale/EFT', taksit: 'Taksit' }[iade.iadeTip] || iade.iadeTip || '-'

  let s = ESC + '@'

  s += ESC + 'a' + '\x01'
  s += GS + '!' + '\x11'
  s += trChar('VEGA') + '\n'
  s += GS + '!' + '\x00'
  s += trChar('Canta & Ayakkabi') + '\n'
  s += trChar('IADE FISI') + '\n'
  if (iade.magazaAd) s += trChar(iade.magazaAd) + '\n'
  s += ESC + 'a' + '\x00'

  s += esDashedLine(width)
  s += esLine('Tarih:', tarihStr, width)
  s += esLine('Iade No:', iade.iadeNo || '-', width)
  if (iade.satisFisNo) s += esLine('Orijinal Fis:', iade.satisFisNo, width)
  if (iade.nedenLabel) s += esLine('Neden:', iade.nedenLabel, width)
  s += esDashedLine(width)

  s += trChar('IADE EDILEN URUNLER') + '\n'
  ;(iade.kalemler || []).forEach(k => {
    const adet = Number(k.iadeAdet || k.adet || 1)
    const birim = Number(k.birimFiyat || 0)
    const varyant = [k.renk, k.beden].filter(Boolean).join('/')
    s += esLine(k.urunAd || '', para(adet * birim), width)
    s += trChar(`  ${varyant} x${adet} x${para(birim)}`).slice(0, width) + '\n'
    if (k.barkod) s += trChar(`  #${k.barkod}`).slice(0, width) + '\n'
  })

  s += esDashedLine(width)
  s += GS + '!' + '\x01'
  s += esLine('TOPLAM IADE', para(iade.tutar), width)
  s += GS + '!' + '\x00'
  s += esLine('Iade Sekli:', odemeLabel, width)
  if (iade.notlar) s += trChar(`Not: ${iade.notlar}`).slice(0, width) + '\n'
  s += esDashedLine(width)

  s += ESC + 'a' + '\x01'
  s += trChar('Durum: Yonetici onayi bekliyor') + '\n'
  s += ESC + 'a' + '\x00'
  s += '\n'
  s += trChar('Musteri Imza: ______________________') + '\n'
  s += '\n'
  s += ESC + 'a' + '\x01'
  s += trChar('Vega Canta & Ayakkabi') + '\n'

  s += '\n'.repeat(8) + GS + 'V' + '\x00'
  return s
}

// ─── DEĞİŞİM FİŞİ ──────────────────────────────────────────────
// DegisimEkrani'ndaki tarayıcı fişiyle AYNI içerik — tek fark hedefin
// doğrudan termal yazıcı olması.
export function buildDegisimFisiEscPos(degisim, width = 48) {
  const para = v => `${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
  const tarihStr = (() => {
    const d = new Date(degisim.tarih || Date.now())
    return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  })()
  // Değişim ekranında satır tutarı elle değiştirilebiliyor — ekranda/kayıtta ne
  // varsa fişe de o basılmalı, adet x birim fiyat yeniden hesaplanmamalı.
  const iadeSatirTutar = k => Number(k?.iadeSatirToplam ?? (Number(k?.iadeAdet || 0) * Number(k?.birimFiyat || 0)))
  const fark = Number(degisim.fark || 0)
  const odemeLabel = { nakit: 'Nakit', kart: 'Kredi Karti', havale: 'Havale/EFT', taksit: 'Taksit' }[degisim.farkOdeme] || degisim.farkOdeme || '-'

  let s = ESC + '@'

  s += ESC + 'a' + '\x01'
  s += GS + '!' + '\x11'
  s += trChar('VEGA') + '\n'
  s += GS + '!' + '\x00'
  s += trChar('Canta & Ayakkabi') + '\n'
  s += trChar('DEGISIM FISI') + '\n'
  if (degisim.magazaAd) s += trChar(degisim.magazaAd) + '\n'
  s += ESC + 'a' + '\x00'

  s += esDashedLine(width)
  s += esLine('Tarih:', tarihStr, width)
  s += esLine('Degisim No:', degisim.degisimNo || '-', width)
  if (degisim.satisFisNo) s += esLine('Orijinal Fis:', degisim.satisFisNo, width)
  s += esDashedLine(width)

  s += trChar('IADE EDILEN') + '\n'
  ;(degisim.iadeKalemler || []).forEach(k => {
    const varyant = [k.renk, k.beden].filter(Boolean).join('/')
    s += esLine(k.urunAd || '', '-' + para(iadeSatirTutar(k)), width)
    s += trChar(`  ${varyant} x${k.iadeAdet}${k.barkod ? ' #' + k.barkod : ''}`).slice(0, width) + '\n'
  })

  s += esDashedLine(width)
  s += trChar('VERILEN') + '\n'
  ;(degisim.yeniKalemler || []).forEach(k => {
    const varyant = [k.renk, k.beden].filter(Boolean).join('/')
    s += esLine(k.urunAd || '', para(k.toplam), width)
    s += trChar(`  ${varyant} x${k.adet}${k.barkod ? ' #' + k.barkod : ''}`).slice(0, width) + '\n'
  })

  s += esDashedLine(width)
  if (fark === 0) {
    s += ESC + 'a' + '\x01' + trChar('FARK YOK') + '\n' + ESC + 'a' + '\x00'
  } else {
    s += GS + '!' + '\x01'
    s += esLine(fark > 0 ? 'MUSTERI ODEDI' : 'MUSTERIYE IADE', para(Math.abs(fark)), width)
    s += GS + '!' + '\x00'
    s += esLine('Odeme:', fark > 0 ? odemeLabel : 'Iade', width)
  }
  s += esDashedLine(width)

  s += ESC + 'a' + '\x01'
  s += trChar('Tesekkurler') + '\n'
  s += trChar('Vega Canta & Ayakkabi') + '\n'

  s += '\n'.repeat(8) + GS + 'V' + '\x00'
  return s
}

// Günlük kasa "Z Raporu"nu fiş yazıcısından (aynı 80mm termal ESC/POS cihazı,
// bkz. buildFisGovde) ham komut olarak üretir — satis-kasa/GunlukKasa.jsx'teki
// tarayıcı popup'ıyla basılan HTML şablonuyla aynı içeriği taşır, sadece hedef
// QZ Tray üzerinden doğrudan yazıcıdır (tarayıcı yazdırma penceresi açılmaz).
export function buildZRaporuEscPos(kasa, magazaAd, ekstraNakitAktarim = null, width = 48) {
  const o = kasa.ozet || {}
  const _nakitAktarim = ekstraNakitAktarim || kasa.nakitAktarim || null
  const satislar = kasa.satislar || []
  const masraflar = kasa.masraflar || []
  const para = v => `${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
  const simdi = new Date()

  let s = ESC + '@' // yazıcıyı sıfırla

  s += ESC + 'a' + '\x01' // ortala
  s += GS + '!' + '\x11'  // çift genişlik + yükseklik
  s += trChar('VEGA') + '\n'
  s += GS + '!' + '\x00'  // normal boyut
  s += trChar('Canta & Ayakkabi') + '\n'
  if (magazaAd) s += trChar(magazaAd) + '\n'
  s += esDashedLine(width)
  s += GS + '!' + '\x01' // çift yükseklik
  s += trChar('*** Z RAPORU ***') + '\n'
  s += GS + '!' + '\x00'
  s += ESC + 'a' + '\x00' // sola yasla
  s += esDashedLine(width)

  s += esLine('Tarih:', simdi.toLocaleDateString('tr-TR'), width)
  s += esLine('Saat:', simdi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), width)
  s += esDashedLine(width)
  s += esLine('Acilis Bakiyesi:', para(kasa.acilisBakiyesi), width)
  s += esDashedLine(width)

  s += ESC + 'a' + '\x01'
  s += trChar('SATIS OZETI') + '\n'
  s += ESC + 'a' + '\x00'
  s += esLine('Satis Sayisi:', String(o.satisSayisi ?? 0), width)
  s += esLine('Toplam Satis:', para(o.toplamSatis), width)
  s += trChar('  Nakit: ' + para(o.nakitSatis)) + '\n'
  s += trChar('  Kredi Karti: ' + para(o.kartSatis)) + '\n'
  s += trChar('  Havale/EFT: ' + para(o.havaleSatis)) + '\n'
  s += esDashedLine(width)

  s += ESC + 'a' + '\x01'
  s += trChar('SATILAN URUNLER') + '\n'
  s += ESC + 'a' + '\x00'
  satislar.forEach(sat => (sat.kalemler || []).forEach(k => {
    const varyant = [k.renk, k.beden].filter(Boolean).join('/')
    s += esLine(k.urunAd + (varyant ? ` (${varyant})` : ''), para(k.toplam), width)
  }))
  s += esDashedLine(width)

  s += esLine('Iade Sayisi:', String(o.iadeSayisi ?? 0), width)
  s += esLine('Toplam Iade:', '-' + para(o.toplamIade), width)
  s += esDashedLine(width)

  s += ESC + 'a' + '\x01'
  s += trChar('MASRAFLAR') + '\n'
  s += ESC + 'a' + '\x00'
  if (masraflar.length > 0) {
    masraflar.forEach(m => { s += esLine(m.kategori?.ad || 'Masraf', '-' + para(m.tutar), width) })
  } else {
    s += ESC + 'a' + '\x01' + trChar('Masraf yok') + '\n' + ESC + 'a' + '\x00'
  }
  s += esLine('Toplam Masraf:', '-' + para(o.toplamMasraf), width)
  s += esDashedLine(width)

  s += GS + '!' + '\x01'
  s += esLine('KASADAKI NAKIT:', para(o.nakitNet), width)
  s += GS + '!' + '\x00'

  if ((kasa.manuelHareketler || []).length > 0) {
    s += esDashedLine(width)
    s += ESC + 'a' + '\x01'
    s += trChar('MANUEL HAREKETLER') + '\n'
    s += ESC + 'a' + '\x00'
    kasa.manuelHareketler.forEach(h => {
      s += esLine(h.aciklama || h.tip, (h.tip === 'nakit_giris' ? '+' : '-') + para(h.tutar), width)
    })
  }

  if (_nakitAktarim) {
    s += esDashedLine(width)
    s += esLine('Nakit Kasa Aktarimi:', para(_nakitAktarim), width)
  }

  s += esDashedLine(width)
  s += ESC + 'a' + '\x01'
  s += trChar('Vega Canta & Ayakkabi') + '\n'
  s += trChar('Tesekkurler') + '\n'

  s += '\n'.repeat(6) + GS + 'V' + '\x00' // besle + tam kesim (destekliyorsa)

  return s
}

// stok-yonetimi.jsx > Alım Listesi'ndeki KENDİ liste'sini (otomatik eklenen kritik
// ürünler + kullanıcının kendi eklediği ürünler, her ikisi de aynı `istenenAdet`
// alanına sahip) fiş yazıcısından bastırır — Alım Listesi'nin A4 tarayıcı
// popup'ıyla aynı veriyi kullanır, sadece hedef QZ Tray üzerinden doğrudan fiş
// yazıcısıdır. Her satır: solda "Marka - Stok Kodu - Renk Adı", sağda başlık
// satırıyla (Toplam / Istenen) hizalı, sabit genişlikte iki sayı sütunu.
const SAYI_KOLON_GENISLIK = 9 // "Istenen" (7 karakter) + boşluk payı
function sayiSutunlari(a, b) {
  return String(a).padStart(SAYI_KOLON_GENISLIK) + String(b).padStart(SAYI_KOLON_GENISLIK)
}

export function buildKritikStokFisiEscPos(liste, magazaAd, genelToplam = 0, width = 48) {
  const simdi = new Date()
  const para = v => `${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
  let s = ESC + '@' // yazıcıyı sıfırla

  s += ESC + 'a' + '\x01' // ortala
  s += GS + '!' + '\x11'  // çift genişlik + yükseklik
  s += trChar('VEGA') + '\n'
  s += GS + '!' + '\x00'  // normal boyut
  s += trChar('Canta & Ayakkabi') + '\n'
  if (magazaAd) s += trChar(magazaAd) + '\n'
  s += esDashedLine(width)
  s += GS + '!' + '\x01' // çift yükseklik
  s += trChar('*** ALIM LISTESI ***') + '\n'
  s += GS + '!' + '\x00'
  s += ESC + 'a' + '\x00' // sola yasla
  s += esDashedLine(width)

  s += esLine('Tarih:', simdi.toLocaleDateString('tr-TR'), width)
  s += esDashedLine(width)

  // Ürün satırları küçük fontla (ESC/POS Font B) basılıyor — "Marka - Stok
  // Kodu - Renk Adı" fişin dar Font A genişliğinde (48 karakter, sağda 2x13
  // karakterlik sayı sütunları çıkınca sola sadece ~21 karakter kalıyordu)
  // sığmayıp renk adı satır sonunda sessizce kesiliyordu. Font B daha dar
  // karakterlerle aynı fiziksel genişliğe daha fazla karakter sığdırır.
  const widthB = Math.round(width * 4 / 3)
  s += ESC + 'M' + '\x01' // Font B
  s += esLine('', sayiSutunlari('Toplam', 'Istenen'), widthB)
  s += esDashedLine(widthB)

  let toplamIstenen = 0
  ;(liste || []).forEach(l => {
    const renkGosterilecek = l.renk && l.renk.trim().toLowerCase() !== 'standart' ? l.renk.trim() : ''
    const sol = [l.marka, l.sku || l.urunAdi, renkGosterilecek].filter(Boolean).join(' - ')
    const sag = sayiSutunlari(l.mevcutStok ?? 0, l.istenenAdet ?? 0)
    s += esLine(sol, sag, widthB)
    toplamIstenen += Number(l.istenenAdet || 0)
  })
  s += ESC + 'M' + '\x00' // Font A'ya geri dön

  s += esDashedLine(width)
  s += esLine('Toplam Kalem:', String((liste || []).length), width)
  s += esLine('Toplam Istenen Adet:', String(toplamIstenen), width)
  if (genelToplam > 0) s += esLine('Tahmini Toplam:', para(genelToplam), width)

  s += '\n'.repeat(6) + GS + 'V' + '\x00' // besle + tam kesim (destekliyorsa)

  return s
}

// ─── LABEL TEMPLATES (TSPL + ZPL) ─────────────────────────────
// motor='tspl' (RAW/EML 400L gibi yazıcılar) veya motor='zpl'
// (ZDesigner sürücüsü kurulu Zebra ZD220/ZD230/ZD420 vb.)
export const LabelTemplates = {
  // Ürün etiketi 55x40mm (yaklaşık 440x320 dot, 203dpi)
  URUN_ETIKETI: ({ urunAd, urunKod, urunSku, urunRenkAdi, marka, malzeme, barkod, satisF, renk, beden, kategori, indirimOran = 0, adet = 1, motor = 'tspl' }) => {
    const e = motor === 'zpl' ? createZplEngine(55, 40) : createTsplEngine(55, 40)
    const ETIKET_GENISLIK_DOT = Math.round(55 * (203 / 25.4)) // 55mm @ 203dpi ≈ 440dot
    const listeF = indirimOran > 0 ? Math.ceil(satisF / (1 - indirimOran / 100) / 10) * 10 : null
    const guvenliBarkod = barkod ? String(barkod).trim() : '000000000000'
    const ayakkabi = kategori === 'Ayakkabı' || /sneaker|bot|topuklu|loafer|sandalet|terlik/i.test(urunAd || '')

    // Tüm etiket kenarlarından 3mm (~24dot) boşluk — VEGA/numara kutusu/barkod
    // hepsi bu içerik alanına göre hizalanıyor.
    const KENAR_BOSLUK = Math.round(3 * (203 / 25.4))
    const icerikSol = KENAR_BOSLUK
    const icerikSag = ETIKET_GENISLIK_DOT - KENAR_BOSLUK
    const icerikGenislik = icerikSag - icerikSol

    // ─ ÜST SATIR: solda VEGA + alt yazısı, sağda (ayakkabıysa) numara kutusu ─
    const vegaFont = '4', vegaFontYukseklik = FONT_YUKSEKLIK[vegaFont] // 48dot
    e.text(icerikSol, KENAR_BOSLUK, vegaFont, 0, 1, 1, 'VEGA')
    // "Çanta & Ayakkabı" — VEGA'nın yarısı büyüklüğünde (48/2=24dot → font '2').
    // Numara kutusu varsa (ayakkabı ürünü) kutunun sol kenarını aşmayacak
    // şekilde sığdırılıyor (fitText), yoksa tüm içerik genişliğini kullanabilir.
    const vegaAltFont = '2'
    const vegaAltY = KENAR_BOSLUK + vegaFontYukseklik + 4
    const kutuGenislikOnizleme = 78 // aşağıdaki kutuGenislik ile aynı — genişlik hesabı için erken lazım
    const vegaAltGenislik = (ayakkabi && beden)
      ? (icerikSag - kutuGenislikOnizleme - 10) - icerikSol
      : icerikGenislik
    fitText(e, icerikSol, vegaAltY, 'Çanta & Ayakkabı', vegaAltGenislik, { font: vegaAltFont, minFont: '1', lineGap: 20, maxLines: 1 })
    const vegaBlokYukseklik = vegaFontYukseklik + 4 + FONT_YUKSEKLIK[vegaAltFont] // 48+4+24=76

    // Tam sayı büyütmeyle (TSPL'de KESİN desteklenen tek yol) ölçekliyoruz.
    // font '3' (32dot) × 2 = 64dot — bir önceki denemedeki 72dot'tan ~%11 küçük
    // (istenen %10 küçültmeye en yakın tam sayı kombinasyon).
    const bedenMul = 2
    const kutuGenislik = kutuGenislikOnizleme, kutuYukseklik = 76
    if (ayakkabi && beden) {
      const kutuX1 = icerikSag - kutuGenislik, kutuY1 = KENAR_BOSLUK
      const kutuX2 = icerikSag, kutuY2 = kutuY1 + kutuYukseklik
      e.box(kutuX1, kutuY1, kutuX2, kutuY2, 2, 4) // köşeler hafif yuvarlak (radius=4)
      const bedenFont = '3'
      const bedenMetni = String(beden).slice(0, 4)
      const metinYukseklik = FONT_YUKSEKLIK[bedenFont] * bedenMul
      // NOT: gerçek yazıcı çıktısını göremediğimiz için bu oran deneme-yanılmayla
      // ayarlandı (0.85 → sağa kaymış, 0.6 → sola kaymış, 0.4 → ortalandı) —
      // büyütme (mul) her iki boyutu da orantılı ölçeklediği için aynı oran
      // burada da geçerli olmalı.
      const bedenKarakterGenisligi = Math.round(metinYukseklik * 0.4)
      const metinGenislik = bedenMetni.length * bedenKarakterGenisligi
      const bedenX = kutuX1 + Math.round((kutuGenislik - metinGenislik) / 2)
      // Tam ortalanan değere göre birkaç dot aşağı kaydırıyoruz — üstten daha
      // fazla boşluk bıraksın diye (dikeyde matematiksel merkez yerine alta yaslı).
      const bedenY = kutuY1 + Math.round((kutuYukseklik - metinYukseklik) / 2) + 5
      e.text(bedenX, bedenY, bedenFont, 0, bedenMul, bedenMul, bedenMetni)
    }

    // ─ ORTA BÖLÜM: "Marka Adı - Stok Kodu - Renk Adı" TEK satır, hemen altında barkod ─
    // "renk" parametresi (varyant seviyesi) mağaza bazlı tekil stok modelinde hep
    // "Standart" placeholder'ı taşıdığı için (bkz. shopify.js, urunler.js) gerçek
    // bir bilgi taşımıyor — gerçek bir değer varsa onu, yoksa ürünün kendi
    // renkAdi'nı kullanıyoruz. Bu satır, VEGA+alt yazısı bloğu ile (ayakkabıysa)
    // numara kutusundan HANGİSİ daha uzunsa onun altına göre konumlanıyor.
    // NOT: TSPL'de font boyutu ya isimli bir font (32,40,48dot...) ya da o
    // fontun TAM SAYI katı (×2,×3...) olabiliyor — en yakın basamak: font '1'
    // (18dot) × 2 = 36dot.
    const ortaFont = '1', ortaMul = 2 // 18×2=36dot
    const ortaSatirYukseklik = FONT_YUKSEKLIK[ortaFont] * ortaMul
    const ustBolumYukseklik = Math.max(vegaBlokYukseklik, (ayakkabi && beden) ? kutuYukseklik : 0)
    const ortaY = KENAR_BOSLUK + ustBolumYukseklik + 10
    const renkGosterilecek = renk && renk.trim().toLowerCase() !== 'standart' ? renk.trim() : ''
    const stokKodu = urunSku || urunKod || urunAd
    const renkAdiGercek = renkGosterilecek || (urunRenkAdi ? urunRenkAdi.trim() : '')
    // Marka artık sağa ayrı basılmıyor, aynı satırda soldan başlayarak birleşik
    // metnin bir parçası — sabit boyutta (36dot) ve TAM olarak basılır, karakter
    // sayısı ne olursa olsun küçültülmez/kesilmez.
    const solMetin = [marka, stokKodu, renkAdiGercek].filter(Boolean).join(' - ')
    e.text(icerikSol, ortaY, ortaFont, 0, ortaMul, ortaMul, solMetin)

    const barkodY = ortaY + ortaSatirYukseklik + 10 // orta satırın hemen altı + boşluk
    const barkodCubukYukseklik = 55

    // Barkodu, kenar boşluklarına göre TAM ORTALI basıyoruz. NOT: modül sayısını
    // (Code128) rakam ÇİFTLERİNİN tek sembole sıkıştığı "Code128C" varsayımıyla
    // DEĞİL — bu yazıcının kendi otomatik kod seçimi sıkıştırma yapmıyor gibi
    // görünüyor (önceki denemede barkod tahminden daha geniş basıp sağa
    // kaymıştı) — her hanenin kendi sembolü olduğu (Code128B) varsayımıyla
    // hesaplıyoruz; bu daha geniş ama gerçek basılan genişliğe daha yakın bir
    // tahmin. narrow SABİT (2) tutuluyor — modülü içeriğe göre küçültüp
    // büyütmek (önceki "tam genişlik" denemesi) hem okunamayacak kadar ince
    // çubuğa hem de tahmin hatasını büyütüp kaymaya yol açabiliyordu.
    const narrow = 2
    const modulSayisi = barkodModulSayisi(guvenliBarkod)
    const barkodTahminiGenislik = modulSayisi * narrow
    const barkodX = icerikSol + Math.round((icerikGenislik - barkodTahminiGenislik) / 2)
    e.barcode(barkodX, barkodY, '128', barkodCubukYukseklik, 1, 0, narrow, narrow, guvenliBarkod)

    // ─ ALT: fiyat satırı — konumu değişmedi ─
    const fiyatY = 245
    if (listeF) {
      e.text(20, fiyatY, '3', 0, 1, 1, `${listeF} TL`)
      e.bar(15, fiyatY + 12, 105, 3)
    }
    if (listeF) e.text(155, fiyatY - 2, '3.5', 0, 1, 1, `%${indirimOran}`)
    e.text(listeF ? 280 : 160, fiyatY - 4, '4', 0, 1, 1, `${satisF} TL`)

    e.print(adet)
    return motor === 'zpl' ? e.getZpl() : e.getTspl()
  },

  RAF_ETIKETI: ({ urunAd, urunKod, barkod, renk, beden, rafAdet = 1, motor = 'tspl' }) => {
    const e = motor === 'zpl' ? createZplEngine(50, 30) : createTsplEngine(50, 30)
    e.text(5, 5, '3', 0, 1, 1, (urunAd || '').slice(0, 22))
    e.text(5, 30, '2', 0, 1, 1, [renk, beden].filter(Boolean).join(' / '))
    e.text(5, 50, '2', 0, 1, 1, `Kod: ${urunKod || ''}`)
    e.text(5, 68, '2', 0, 1, 1, `Adet: ${rafAdet}`)
    e.barcode(200, 5, '128', 80, 2, 0, 2, 2, barkod)
    e.print(1)
    return motor === 'zpl' ? e.getZpl() : e.getTspl()
  },

  KARGO_ETIKETI: ({ siparisNo, musteriAd, adres, kargoFirma, kargoNo, toplam, kanal, motor = 'tspl' }) => {
    const e = motor === 'zpl' ? createZplEngine(100, 150) : createTsplEngine(100, 150)
    e.text(20, 10, '3', 0, 1, 1, 'Vega Canta & Ayakkabi')
    e.line(10, 45, 750, 45)
    e.text(20, 55, '3', 0, 1, 1, kargoFirma || 'Kargo')
    e.text(20, 85, '4', 0, 1, 1, kargoNo || 'TAKIP NO YOK')
    e.line(10, 130, 750, 130)
    e.text(20, 140, '3', 0, 1, 1, `Alici: ${(musteriAd || '').slice(0, 28)}`)
    const adresSatirlar = (adres || '').match(/.{1,35}/g) || ['']
    adresSatirlar.forEach((s, i) => e.text(20, 170 + i * 30, '2', 0, 1, 1, s))
    const sonY = 180 + adresSatirlar.length * 30
    e.line(10, sonY, 750, sonY)
    e.text(20, sonY + 15, '2', 0, 1, 1, `Siparis: ${siparisNo}`)
    e.text(20, sonY + 40, '2', 0, 1, 1, `Kanal: ${kanal || 'online'}`)
    e.text(20, sonY + 65, '3', 0, 1, 1, `Tutar: ${toplam} TL`)
    e.barcode(60, sonY + 100, '128', 80, 2, 0, 2, 2, siparisNo)
    e.print(1)
    return motor === 'zpl' ? e.getZpl() : e.getTspl()
  },
}

// ─── BAĞLANTI ─────────────────────────────────────────────────
export async function baglan() {
  if (qz.websocket.isActive()) return;

  const isHttps = window.location.protocol === 'https:';
  
  // Hata muhtemelen port veya host string değilken çıkıyor.
  // Options objesini en sade haline getiriyoruz.
  const connectOptions = {
    host: 'localhost',
    port: isHttps ? 8181 : 8182,
    usingSecure: isHttps // 'protocol' yerine bunu kullanmayı deneyelim
  };

  try {
    // connectOptions'ı doğrudan veriyoruz
    await qz.websocket.connect(connectOptions);
    console.log("QZ Bağlantısı Başarılı");
  } catch (err) {
    // Eğer üstteki hata verirse, bir de parametresiz dene (fallback)
    try {
      console.warn("Parametreli bağlantı başarısız, varsayılan deneniyor...");
      await qz.websocket.connect();
    } catch (retryErr) {
      console.error("QZ Bağlantı Hatası:", retryErr);
      throw retryErr;
    }
  }
}

export function bagliMi() {
  return qz.websocket.isActive()
}

// ─── YAZICI İŞLEMLERİ ──────────────────────────────────────────
const YAZICI_KEY = 'vega_etiket_yazici'
const YAZICI_MOD_KEY = 'vega_etiket_yazici_mod' // 'tspl' (RAW) | 'zpl' (ZDesigner sürücüsü)

export function kayitliYaziciGetir() {
  return localStorage.getItem(YAZICI_KEY) || ''
}

export function yaziciKaydet(ad) {
  localStorage.setItem(YAZICI_KEY, ad)
}

// Varsayılan 'tspl': mevcut EML 400L gibi RAW yazıcılarla geriye dönük uyumluluk için.
export function kayitliYaziciModuGetir() {
  return localStorage.getItem(YAZICI_MOD_KEY) || 'tspl'
}

export function yaziciModuKaydet(mod) {
  localStorage.setItem(YAZICI_MOD_KEY, mod === 'zpl' ? 'zpl' : 'tspl')
}

// Fiş yazıcısı (Zjiang vb. termal) etiket yazıcısından AYRI, farklı bir fiziksel
// cihaz olduğu için ayrı bir localStorage anahtarında tutulur.
const FIS_YAZICI_KEY = 'vega_fis_yazici'

export function kayitliFisYaziciGetir() {
  return localStorage.getItem(FIS_YAZICI_KEY) || ''
}

export function fisYaziciKaydet(ad) {
  localStorage.setItem(FIS_YAZICI_KEY, ad)
}

export async function yazicilariBul() {
  await baglan()
  const sonuc = await qz.printers.find()
  const liste = Array.isArray(sonuc) ? sonuc : [sonuc]
  console.log('[DEBUG] QZ Tray yazıcı listesi:', JSON.stringify(liste))
  return liste
}

export async function varsayilanYaziciGetir() {
  await baglan()
  return await qz.printers.getDefault()
}

// Yazıcının gap/notch sensörünü kalibre eder (bkz. kalibrasyonKomutu notu) —
// "iş gidiyor ama etiket dışarı çıkmıyor, FEED'e basınca çıkıyor" belirtisinin
// yazılımdan (fiziksel FEED-basılı-açma prosedürüne gerek kalmadan) çözümü.
export async function kalibreEt(yaziciAdi, motor = 'tspl') {
  await baglan()
  const config = qz.configs.create(yaziciAdi)
  await qz.print(config, [{ type: 'raw', format: 'plain', data: kalibrasyonKomutu(motor) }])
}

// Etiketlerin toplu değil TEK TEK (her biri kendi işi bittiğinde) dışarı
// atılması için yazıcının Print Mode ayarını Tear-off'a sabitleyip kalıcı
// hafızaya kaydeder — bkz. yaziciModuKaydetKomutu notu. Tek seferlik bir
// ayardır, her print job'ında tekrarlanmasına gerek yoktur (aksine zararlıdır).
export async function yaziciModunuKaydet(yaziciAdi, motor = 'tspl') {
  const komut = yaziciModuKaydetKomutu(motor)
  if (!komut) return
  await baglan()
  const config = qz.configs.create(yaziciAdi)
  await qz.print(config, [{ type: 'raw', format: 'plain', data: komut }])
}

// ─── YAZDIRMA FONKSİYONLARI ────────────────────────────────────
// mod: 'tspl' → RAW komut, EML 400L gibi doğrudan TSPL/RAW dili konuşan yazıcılar için.
// mod: 'zpl'  → Zebra için ZPL komutu üretir. Bunun yazıcıya ulaşması için
//              Windows'ta yazıcının "Generic / Text Only" ya da port türü
//              RAW olan bir kuyruk olarak eklenmiş olması gerekir — bkz.
//              qzService.js dosyasının başındaki kurulum notu.
export async function yazdir(yaziciAdi, komut) {
  await baglan()
  console.log('[DEBUG] yazdir çağrıldı. Yazıcı adı:', JSON.stringify(yaziciAdi))
  console.log('[DEBUG] Gönderilecek komut (ilk 200 karakter):', String(komut).slice(0, 200))
  const config = qz.configs.create(yaziciAdi)
  console.log('[DEBUG] config oluşturuldu:', config)
  try {
    const sonuc = await qz.print(config, [{ type: 'raw', format: 'plain', data: komut }])
    console.log('[DEBUG] qz.print BAŞARILI, dönen değer:', sonuc)
  } catch (e) {
    console.error('[DEBUG] qz.print HATA VERDİ:', e)
    throw e
  }
}

// Metin (raw/plain) ve görsel (raw/image) parçalarını KARIŞIK içeren, önceden
// hazırlanmış bir QZ print job dizisini olduğu gibi gönderir — buildFisYazdirmaKomutlari
// gibi tek bir string yerine dizi üreten fonksiyonlarla kullanılır.
export async function yazdirParcalar(yaziciAdi, parcalar) {
  await baglan()
  console.log('[DEBUG] yazdirParcalar çağrıldı. Yazıcı adı:', JSON.stringify(yaziciAdi), 'parça sayısı:', parcalar.length)
  const config = qz.configs.create(yaziciAdi)
  try {
    const sonuc = await qz.print(config, parcalar)
    console.log('[DEBUG] qz.print BAŞARILI, dönen değer:', sonuc)
  } catch (e) {
    console.error('[DEBUG] qz.print HATA VERDİ:', e)
    throw e
  }
}

export async function topluYazdir(yaziciAdi, komutlar) {
  await baglan()
  console.log('[DEBUG] topluYazdir çağrıldı. Yazıcı adı:', JSON.stringify(yaziciAdi))
  console.log('[DEBUG] Komut sayısı:', komutlar.length)
  console.log('[DEBUG] İlk komut (ilk 200 karakter):', String(komutlar[0]).slice(0, 200))
  const config = qz.configs.create(yaziciAdi)
  console.log('[DEBUG] config oluşturuldu:', config)
  const data = komutlar.map(k => ({ type: 'raw', format: 'plain', data: k }));
  try {
    const sonuc = await qz.print(config, data);
    console.log('[DEBUG] qz.print BAŞARILI, dönen değer:', sonuc)
  } catch (e) {
    console.error('[DEBUG] qz.print HATA VERDİ:', e)
    throw e
  }
}