import { useState, useEffect, useCallback } from 'react'
import {
  baglan, bagliMi, yazicilariBul, varsayilanYaziciGetir,
  kayitliYaziciGetir, yaziciKaydet,
  kayitliYaziciModuGetir, yaziciModuKaydet,
  kayitliFisYaziciGetir, fisYaziciKaydet,
  yazdir, yazdirParcalar, topluYazdir, kalibreEt, yaziciModunuKaydet, LabelTemplates, buildFisEscPos, buildFisYazdirmaKomutlari,
  buildZRaporuEscPos, buildKritikStokFisiEscPos,
  buildIadeFisiEscPos, buildDegisimFisiEscPos,
} from './qzService'

export function usePrint() {
  const [bagli, setBagli]               = useState(false)
  const [yazicilar, setYazicilar]       = useState([])
  const [seciliYazici, setSeciliYazici] = useState(kayitliYaziciGetir)
  // 'tspl' = RAW/EML 400L gibi yazıcılar, 'zpl' = Zebra ZDesigner sürücüsü (ZD220/ZD230/ZD420)
  const [yaziciModu, setYaziciModu]     = useState(kayitliYaziciModuGetir)
  // Fiş (termal makbuz) yazıcısı — etiket yazıcısından ayrı, farklı bir fiziksel cihaz
  const [fisYazici, setFisYazici]       = useState(kayitliFisYaziciGetir)
  const [hata, setHata]                 = useState(null)
  const [baglaniyor, setBaglaniyor]     = useState(false)

  useEffect(() => {
    // QZ Tray websocket'i başka bir sayfadan (örn. etiket yazıcısı ekranı) zaten
    // bağlı olabilir. Bu durumda "Bağlan" butonu hiç görünmez, dolayısıyla yazıcı
    // listesi de hiç çekilmez ve seçim kutusu boş kalırdı — bağlıysa listeyi burada
    // da çekiyoruz.
    const zatenBagli = bagliMi()
    setBagli(zatenBagli)
    if (zatenBagli) {
      yazicilariBul().then(setYazicilar).catch(() => {})
    }
  }, [])

  const baglanFn = useCallback(async () => {
    setBaglaniyor(true)
    setHata(null)
    try {
      await baglan()
      setBagli(true)
      const liste = await yazicilariBul()
      setYazicilar(liste)
      // Not: fiş yazıcısı otomatik seçilmiyor — Windows'un varsayılan yazıcısı
      // etiket yazıcısıyla aynı olabilir, iki farklı fiziksel cihaz olduğu için
      // yanlış tahmin riskli. Bir kere elle seçilmesi yeterli, sonra hatırlanır.
      if (!seciliYazici) {
        const varsayilan = await varsayilanYaziciGetir()
        setSeciliYazici(varsayilan)
        yaziciKaydet(varsayilan)
      }
    } catch (e) {
      setHata('QZ Tray bağlantısı kurulamadı — QZ Tray çalışıyor mu?')
      setBagli(false)
    } finally {
      setBaglaniyor(false)
    }
  }, [seciliYazici])

  const yaziciSec = (ad) => {
    setSeciliYazici(ad)
    yaziciKaydet(ad)
  }

  // Yazıcı modu: 'tspl' (RAW) veya 'zpl' (ZDesigner sürücüsü)
  const yaziciModuSec = (mod) => {
    setYaziciModu(mod)
    yaziciModuKaydet(mod)
  }

  const fisYaziciSec = (ad) => {
    setFisYazici(ad)
    fisYaziciKaydet(ad)
  }

  // Etiket yazıcısını kalibre et — "iş gidiyor ama etiket dışarı çıkmıyor, FEED
  // tuşuna basınca çıkıyor" belirtisinin çözümü (yazıcının gap sensörü kalibre değil).
  const yaziciKalibreEt = async () => {
    if (!seciliYazici) throw new Error('Yazıcı seçilmedi')
    await kalibreEt(seciliYazici, yaziciModu)
  }

  // Etiketlerin toplu değil tek tek dışarı atılması için yazıcının Print Mode
  // ayarını kalıcı olarak kaydeder — tek seferlik bir ayardır (bkz. qzService.js).
  const yaziciModuKaydetVeAyarla = async () => {
    if (!seciliYazici) throw new Error('Yazıcı seçilmedi')
    await yaziciModunuKaydet(seciliYazici, yaziciModu)
  }

  // Fiş yazdır — ESC/POS, doğrudan QZ Tray üzerinden (tarayıcı print penceresi yok).
  // Sosyal medya satırı (Instagram/web ikonu) görsel olarak basılıyor; bu iş bazı
  // QZ Tray/yazıcı kombinasyonlarında desteklenmeyebilir — desteklenmezse fişin
  // tamamen basılmaması yerine düz metin (ikonsuz) fallback'e geçiyoruz.
  const fisYazdir = async (satis) => {
    if (!fisYazici) throw new Error('Fiş yazıcısı seçilmedi')
    try {
      await yazdirParcalar(fisYazici, buildFisYazdirmaKomutlari(satis))
    } catch (e) {
      console.warn('[fisYazdir] Görselli fiş basılamadı, düz metin fallback deneniyor:', e)
      await yazdir(fisYazici, buildFisEscPos(satis))
    }
  }

  // İade fişi yazdır — satış fişiyle aynı fiş yazıcısı/seçimi kullanılır.
  const iadeFisiYazdir = async (iade) => {
    if (!fisYazici) throw new Error('Fiş yazıcısı seçilmedi')
    await yazdir(fisYazici, buildIadeFisiEscPos(iade))
  }

  // Değişim fişi yazdır — aynı fiş yazıcısı.
  const degisimFisiYazdir = async (degisim) => {
    if (!fisYazici) throw new Error('Fiş yazıcısı seçilmedi')
    await yazdir(fisYazici, buildDegisimFisiEscPos(degisim))
  }

  // Ürün etiketi yazdır
  const urunEtiketiYazdir = async (varyantlar, urun, indirimOran = 0, adetler = {}) => {
    if (!seciliYazici) throw new Error('Yazıcı seçilmedi')
    const komutlar = []
    for (const v of varyantlar) {
      const adet = adetler[v.id || v.barkod] || 1
      const komut = LabelTemplates.URUN_ETIKETI({
        urunAd:    urun.ad,
        urunKod:   urun.kod,
        urunSku:   urun.sku,
        urunRenkAdi: urun.renkAdi,
        marka:     urun.marka,
        malzeme:   urun.malzeme,
        kategori:  urun.kategori,
        barkod:    v.barkod,
        satisF:    Number(urun.satisF),
        renk:      v.renk,
        beden:     v.beden,
        indirimOran,
        motor:     yaziciModu,
      })
      for (let i = 0; i < adet; i++) komutlar.push(komut)
    }
    await topluYazdir(seciliYazici, komutlar)
  }

  // Günlük kasa Z Raporu yazdır — fiş yazıcısıyla aynı cihaz/seçim kullanılır.
  const zRaporuYazdir = async (kasa, magazaAd, ekstraNakitAktarim = null) => {
    if (!fisYazici) throw new Error('Fiş yazıcısı seçilmedi')
    await yazdir(fisYazici, buildZRaporuEscPos(kasa, magazaAd, ekstraNakitAktarim))
  }

  // Alım Listesi yazdır — Alım Listesi'ndeki A4 tarayıcı popup'ıyla aynı veri
  // (otomatik eklenen kritik ürünler + kullanıcının kendi eklediği ürünler),
  // fiş yazıcısıyla aynı cihaz/seçim kullanılır.
  const kritikStokFisiYazdir = async (liste, magazaAd, genelToplam = 0) => {
    if (!fisYazici) throw new Error('Fiş yazıcısı seçilmedi')
    await yazdir(fisYazici, buildKritikStokFisiEscPos(liste, magazaAd, genelToplam))
  }

  // Raf etiketi yazdır
  const rafEtiketiYazdir = async (varyant, urun) => {
    if (!seciliYazici) throw new Error('Yazıcı seçilmedi')
    await yazdir(seciliYazici, LabelTemplates.RAF_ETIKETI({
      urunAd: urun.ad, urunKod: urun.kod,
      barkod: varyant.barkod, renk: varyant.renk,
      beden: varyant.beden, adet: varyant.adet,
      motor: yaziciModu,
    }))
  }

  // Kargo etiketi yazdır
  const kargoEtiketiYazdir = async (siparis) => {
    if (!seciliYazici) throw new Error('Yazıcı seçilmedi')
    await yazdir(seciliYazici, LabelTemplates.KARGO_ETIKETI({
      siparisNo:  siparis.siparisNo,
      musteriAd:  siparis.musteriAd || `${siparis.musteri?.ad || ''} ${siparis.musteri?.soyad || ''}`.trim(),
      adres:      siparis.adres,
      kargoFirma: siparis.kargoFirma,
      kargoNo:    siparis.kargoNo,
      toplam:     Number(siparis.genelToplam).toFixed(2),
      kanal:      siparis.kanal,
      motor:      yaziciModu,
    }))
  }

  return {
    bagli, baglaniyor, hata,
    yazicilar, seciliYazici, yaziciSec,
    yaziciModu, yaziciModuSec,
    fisYazici, fisYaziciSec, fisYazdir,
    iadeFisiYazdir, degisimFisiYazdir,
    zRaporuYazdir,
    kritikStokFisiYazdir,
    baglan: baglanFn,
    urunEtiketiYazdir,
    rafEtiketiYazdir,
    kargoEtiketiYazdir,
    yaziciKalibreEt,
    yaziciModuKaydetVeAyarla,
  }
}