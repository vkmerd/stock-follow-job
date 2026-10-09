import { useState, useEffect, useRef, useCallback } from 'react'
import { useVega } from './VegaContext'
import {
  bankaHesaplariGetir, bankaHesapEkle, bankaHesapGuncelle, bankaHesapSil,
  bankaHareketleriGetir, bankaHareketEkle, bankaHareketSil,
  bankaKategorileriniGetir, bankaOzetGetir, bankaMutabakatGetir,
  urunleriGetir
, API_BASE } from './api'
import { Page, PageHeader, Card, Button, IconButton, Field, Input, Select, Segmented, Tabs, Badge, Banner, Modal, StatCard, Tile, EmptyState, LoadingRows, MagazaIkon, Menu, onayla, toast } from './ui'
import { Plus, Pencil, Trash2, ArrowRightLeft, Banknote, List, RefreshCw, X, MoreHorizontal, Landmark, CircleCheck, TriangleAlert, MapPin } from 'lucide-react'

const para    = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const tarihTR = iso => iso ? new Date(iso).toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const saatTR  = iso => iso ? new Date(iso).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : ''
const AYLAR   = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const BANKALAR = ['Ziraat Bankası','İş Bankası','Garanti BBVA','Yapı Kredi','Akbank','Halkbank','Vakıfbank','Denizbank','QNB Finansbank','TEB','HSBC','ING','Diğer']

// ─── VİRMAN MODAL ────────────────────────────────────────────
function VirmanModal({ hesaplar, magazalar=[], onKaydet, onKapat, tip='banka' }) {
  const bugun = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({ kaynakId:'', hedefId:'', magazaId:'', tutar:'', aciklama:'', tarih:bugun })
  const [kayit, setKayit] = useState(false)
  const [hata, setHata] = useState('')
  const [kasaNakiti, setKasaNakiti] = useState(null)
  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  // Seçili mağazanın kasa bakiyesini çek
  useEffect(() => {
    if (tip !== 'kasa' || !form.magazaId) return
    fetch(`${API_BASE}/kasa/bugun?magazaId=${form.magazaId}`)
      .then(r=>r.json())
      .then(kasa => {
        const nakit = kasa?.ozet?.nakitNet || 0
        setKasaNakiti(nakit)
        g('tutar', Number(nakit).toFixed(2))
      })
      .catch(()=>{ setKasaNakiti(0) })
  }, [tip, form.magazaId])

  const kaydet = async () => {
    if (!form.tutar || Number(form.tutar)<=0) return setHata('Tutar zorunlu.')
    if (tip==='banka' && (!form.kaynakId||!form.hedefId)) return setHata('Kaynak ve hedef hesabı seçin.')
    if (tip==='banka' && form.kaynakId===form.hedefId) return setHata('Kaynak ve hedef aynı hesap olamaz.')
    if (tip==='kasa' && !form.hedefId) return setHata('Hedef hesabı seçin.')
    setHata(''); setKayit(true)
    try {
      const res = await fetch(`${API_BASE}/banka/virman`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tip, kaynakId:form.kaynakId||null, hedefId:form.hedefId, magazaId:form.magazaId||null, tutar:Number(form.tutar), aciklama:form.aciklama||null, tarih: form.tarih + 'T12:00:00.000Z' })
      })
      if (!res.ok) { const e=await res.json(); throw new Error(e.hata||'Aktarım yapılamadı') }
      toast.success(tip==='banka' ? 'Virman yapıldı.' : 'Kasadan bankaya aktarıldı.')
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <Modal title={tip==='banka'?'Bankalar arası virman':'Kasadan bankaya aktarım'} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit?'Aktarılıyor…':'Aktarımı yap'}</Button>
      </>}>
      {tip==='banka'&&(
        <Field label="Kaynak hesap" htmlFor="v-kaynak">
          <Select id="v-kaynak" value={form.kaynakId} onChange={e=>g('kaynakId',e.target.value)}>
            <option value="">Seçin</option>
            {hesaplar.map(h=><option key={h.id} value={h.id}>{h.ad} · {h.banka} ({para(h.bakiye)})</option>)}
          </Select>
        </Field>
      )}
      {tip==='kasa'&&(
        <>
          <Field label="Kaynak mağaza" htmlFor="v-magaza">
            <Select id="v-magaza" value={form.magazaId} onChange={e=>g('magazaId',e.target.value)}>
              <option value="">Mağaza seçin</option>
              {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
            </Select>
          </Field>
          {kasaNakiti!==null&&<Banner icon={Banknote}>Kasadaki nakit: <strong className="vg-num">{para(kasaNakiti)}</strong></Banner>}
        </>
      )}
      <Field label="Hedef hesap" htmlFor="v-hedef">
        <Select id="v-hedef" value={form.hedefId} onChange={e=>g('hedefId',e.target.value)}>
          <option value="">Seçin</option>
          {hesaplar.filter(h=>h.id!==form.kaynakId).map(h=><option key={h.id} value={h.id}>{h.ad} · {h.banka}</option>)}
        </Select>
      </Field>
      <div className="vg-grid-2">
        <Field label="Tutar" htmlFor="v-tutar">
          <div className="vg-input-group">
            <Input id="v-tutar" type="number" className="vg-num" value={form.tutar} onChange={e=>g('tutar',e.target.value)} style={{ paddingRight: 28 }} />
            <span className="vg-input-suffix">₺</span>
          </div>
        </Field>
        <Field label="Tarih" htmlFor="v-tarih"><Input id="v-tarih" type="date" value={form.tarih} onChange={e=>g('tarih',e.target.value)} /></Field>
      </div>
      <Field label="Açıklama" htmlFor="v-aciklama"><Input id="v-aciklama" value={form.aciklama} onChange={e=>g('aciklama',e.target.value)} placeholder="Virman açıklaması" /></Field>
      {hata&&<Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

function HesapModal({ hesap, magazalar, onKaydet, onKapat }) {
  const bos = { ad:'', banka:BANKALAR[0], iban:'', magazaId:'', bakiye:0 }
  const [form, setForm] = useState(hesap ? { ad:hesap.ad, banka:hesap.banka, iban:hesap.iban||'', magazaId:hesap.magazaId||'' } : bos)
  const [hata, setHata] = useState('')
  const [kayit, setKayit] = useState(false)
  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  const kaydet = async () => {
    if (!form.ad.trim()) return setHata('Hesap adı zorunlu.')
    setHata(''); setKayit(true)
    try {
      const temizForm = { ...form, bakiye: Number(form.bakiye)||0, magazaId: form.magazaId || null }
      if (hesap) await bankaHesapGuncelle(hesap.id, temizForm)
      else       await bankaHesapEkle(temizForm)
      toast.success(hesap ? 'Hesap güncellendi.' : 'Hesap eklendi.')
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <Modal title={hesap?'Hesabı düzenle':'Yeni banka hesabı'} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit?'Kaydediliyor…':hesap?'Değişiklikleri kaydet':'Hesap ekle'}</Button>
      </>}>
      <Field label="Hesap adı" htmlFor="bh-ad"><Input id="bh-ad" value={form.ad||''} onChange={e=>g('ad',e.target.value)} placeholder="örn. İş Bankası Merkez" /></Field>
      <Field label="IBAN" htmlFor="bh-iban"><Input id="bh-iban" mono value={form.iban||''} onChange={e=>g('iban',e.target.value)} placeholder="TR" /></Field>
      <div className="vg-grid-2">
        <Field label="Banka" htmlFor="bh-banka">
          <Select id="bh-banka" value={form.banka} onChange={e=>g('banka',e.target.value)}>
            {BANKALAR.map(b=><option key={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Mağaza" htmlFor="bh-magaza">
          <Select id="bh-magaza" value={form.magazaId||''} onChange={e=>g('magazaId',e.target.value)}>
            <option value="">Genel</option>
            {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
          </Select>
        </Field>
      </div>
      {!hesap && (
        <Field label="Başlangıç bakiyesi" htmlFor="bh-bakiye">
          <div className="vg-input-group">
            <Input id="bh-bakiye" type="number" className="vg-num" value={form.bakiye||0} onChange={e=>g('bakiye',e.target.value)} style={{ paddingRight: 28 }} />
            <span className="vg-input-suffix">₺</span>
          </div>
        </Field>
      )}
      {hata&&<Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

function HareketModal({ hesap, kategoriler, onKaydet, onKapat }) {
  const bugun = new Date().toISOString().slice(0,10)
  const duzenle = hesap?.duzenle || null

  // Çoklu kalem sistemi — duzenle modunda tek kalem
  const bosKalem = () => ({ id: Date.now(), tip:'gider', kategoriId:'', aciklama:'', tutar:'', referans:'', tarih:bugun })
  const [kalemler, setKalemler] = useState(duzenle ? [{
    id: 1, tip: duzenle.tip,
    tutar: String(duzenle.tutar),
    aciklama: duzenle.aciklama||'',
    kategoriId: duzenle.kategoriId||'',
    referans: duzenle.referans||'',
    tarih: duzenle.tarih?.slice(0,10)||bugun
  }] : [bosKalem()])
  const [hata, setHata] = useState('')
  const [kayit, setKayit] = useState(false)
  const tutarRefs = useRef({}) // kalem id → input ref
  const ekleRef = useRef(null)

  // Son kalemin referans inputundan Tab → kalem ekle butonu
  // Enter on kalem ekle → yeni kalem aç, tutarına fokus
  const yeniKalemEkleVeFokusla = useCallback(() => {
    const yeniKalem = bosKalem()
    setKalemler(p => [...p, yeniKalem])
    // Sonraki render'da yeni kalemin tutar inputuna fokus
    setTimeout(() => {
      tutarRefs.current[yeniKalem.id]?.focus()
    }, 50)
  }, [])

  const gKalem = (id, k, v) => setKalemler(p => p.map(k2 => k2.id===id ? {...k2, [k]:v} : k2))
  const kalemSil = (id) => setKalemler(p => p.filter(k => k.id !== id))

  const genelToplam = kalemler.reduce((t, k) => t + (Number(k.tutar)||0), 0)

  const kaydet = async () => {
    const gecersiz = kalemler.find(k => !k.tutar || Number(k.tutar) <= 0)
    if (gecersiz) return setHata('Tüm kalemlere geçerli bir tutar girin.')
    setHata(''); setKayit(true)
    try {
      if (duzenle) await bankaHareketSil(duzenle.id)
      // Her kalemi sırayla kaydet
      for (const k of kalemler) {
        await bankaHareketEkle({
          hesapId: duzenle ? duzenle.hesapId : hesap.id,
          kategoriId: k.kategoriId||null,
          tip: k.tip,
          aciklama: k.aciklama||null,
          tutar: Number(k.tutar),
          referans: k.referans||null,
          tarih: k.tarih + 'T12:00:00.000Z'
        })
      }
      toast.success(duzenle ? 'Hareket güncellendi.' : `${kalemler.length} hareket kaydedildi.`)
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <Modal title={duzenle ? 'Hareketi düzenle' : 'Hareket ekle'} subtitle={hesap.ad} onClose={onKapat} size="lg"
      footer={<>
        {kalemler.length > 1 && <span className="vg-muted vg-num" style={{ marginRight: 'auto', fontSize: 13 }}>{kalemler.length} kalem · <strong style={{ color: 'var(--ink)' }}>{para(genelToplam)}</strong></span>}
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>
          {kayit ? 'Kaydediliyor…' : kalemler.length > 1 ? `${kalemler.length} kalemi kaydet` : 'Kaydet'}
        </Button>
      </>}>
      {kalemler.map((k, ki) => {
        const aktifKat = kategoriler.filter(kat => kat.tip === k.tip)
        return (
          <div key={k.id} className="vg-tile vg-stack" style={{ gap: 10, padding: 12 }}>
            <div className="vg-row" style={{ justifyContent: 'space-between' }}>
              <Segmented label="Hareket tipi" value={k.tip} onChange={v=>gKalem(k.id,'tip',v)} options={[{ value:'gelir', label:'Gelir' }, { value:'gider', label:'Gider' }]} />
              {kalemler.length > 1 && <Button size="sm" variant="critical-plain" icon={X} onClick={()=>kalemSil(k.id)}>Kaldır</Button>}
            </div>

            {aktifKat.length > 0 && (
              <div className="vg-row" style={{ gap: 6 }}>
                {aktifKat.map(kat=>(
                  <button key={kat.id} type="button" className="vg-chip" aria-pressed={k.kategoriId===kat.id} onClick={()=>gKalem(k.id,'kategoriId',kat.id)}>{kat.ad}</button>
                ))}
              </div>
            )}

            <div className="vg-grid-2" style={{ gap: 10 }}>
              <div className="vg-input-group">
                <Input ref={el => { tutarRefs.current[k.id] = el }} type="number" className="vg-num" value={k.tutar}
                  onChange={e=>gKalem(k.id,'tutar',e.target.value)} placeholder="Tutar" aria-label="Tutar" style={{ paddingRight: 28, fontWeight: 600 }} />
                <span className="vg-input-suffix">₺</span>
              </div>
              <Input type="date" value={k.tarih} onChange={e=>gKalem(k.id,'tarih',e.target.value)} aria-label="Tarih" />
            </div>
            <div className="vg-grid-2" style={{ gap: 10 }}>
              <Input value={k.aciklama} onChange={e=>gKalem(k.id,'aciklama',e.target.value)} placeholder="Açıklama" aria-label="Açıklama" />
              <Input mono value={k.referans} onChange={e=>gKalem(k.id,'referans',e.target.value)} placeholder="Referans no" aria-label="Referans no"
                onKeyDown={e => {
                  // Son kalemin referans inputundan Tab → kalem ekle butonuna fokus
                  if (e.key === 'Tab' && !e.shiftKey && ki === kalemler.length - 1 && !duzenle) {
                    e.preventDefault()
                    ekleRef.current?.focus()
                  }
                }} />
            </div>
          </div>
        )
      })}

      {!duzenle && (
        <Button ref={ekleRef} icon={Plus} block onClick={yeniKalemEkleVeFokusla}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); yeniKalemEkleVeFokusla(); } }}
          style={{ borderStyle: 'dashed', boxShadow: 'none' }}>
          Kalem ekle <kbd className="vg-code vg-muted" style={{ fontSize: 11 }}>Enter</kbd>
        </Button>
      )}

      {hata && <Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

export default function BankaMutabakat() {
  const { magazalar:ctxMagazalar } = useVega()
  const magazalar = (ctxMagazalar||[]).filter(m=>m.tip!=='online')
  const simdi = new Date()
  const [sekme, setSekme]             = useState('hesaplar')
  const [hesaplar, setHesaplar]       = useState([])
  const [hareketler, setHareketler]   = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [ozet, setOzet]               = useState(null)
  const [mutabakat, setMutabakat]     = useState(null)
  const [yukleniyor, setYukleniyor]   = useState(true)
  const [secilenHesap, setSecilenHesap] = useState(null)
  const [hesapModal, setHesapModal]   = useState(null)
  const [hareketModal, setHareketModal] = useState(null)
  const [virmanModal, setVirmanModal]   = useState(null) // null | 'banka' | 'kasa'
  const [yil, setYil]                 = useState(simdi.getFullYear())
  const [ay, setAy]                   = useState(simdi.getMonth()+1)
  const [tipFiltre, setTipFiltre]     = useState('hepsi')

  // Stok Değeri sekmesi — mağaza bazlı yerel stok + Nas Bag/Silver Polo tedarikçi stoğu
  const [stokUrunler, setStokUrunler]       = useState([])
  const [nasbagStok, setNasbagStok]         = useState([])
  const [silverpoloStok, setSilverpoloStok] = useState([])
  const [stokYukleniyor, setStokYukleniyor] = useState(false)
  const [stokYuklendi, setStokYuklendi]     = useState(false)

  const yukle = async () => {
    setYukleniyor(true)
    try {
      const [h,har,kat,o] = await Promise.all([
        bankaHesaplariGetir(),
        bankaHareketleriGetir({limit:200,...(secilenHesap&&{hesapId:secilenHesap.id})}),
        bankaKategorileriniGetir().catch(()=>[]),
        bankaOzetGetir({yil,ay,...(secilenHesap&&{hesapId:secilenHesap.id})}).catch(()=>null),
      ])
      setHesaplar(Array.isArray(h)?h:[])
      setHareketler(Array.isArray(har)?har:[])
      setKategoriler(Array.isArray(kat)?kat:[])
      setOzet(o)
    } catch(e){ console.error(e) }
    finally { setYukleniyor(false) }
  }

  const mutabakatYukle = async () => {
    const bas = new Date(yil,ay-1,1).toISOString()
    const bit = new Date(yil,ay,0,23,59,59).toISOString()
    const m = await bankaMutabakatGetir({baslangic:bas,bitis:bit,...(secilenHesap&&{hesapId:secilenHesap.id})}).catch(()=>null)
    setMutabakat(m)
  }

  useEffect(()=>{ yukle() },[secilenHesap,yil,ay])
  useEffect(()=>{
    const iv = setInterval(()=>{ if(document.visibilityState==='visible') yukle() }, 60000)
    return ()=>clearInterval(iv)
  },[secilenHesap,yil,ay])
  useEffect(()=>{ if(sekme==='mutabakat') mutabakatYukle() },[sekme,yil,ay,secilenHesap])

  // "Stok Değeri" sekmesi ilk açıldığında yükle — Banka sayfasının normal açılışını
  // yavaşlatmasın diye (335+ Silver Polo ürünü içeren XML dahil) sadece sekmeye
  // gerçekten girilince çekiliyor.
  useEffect(() => {
    if (sekme !== 'stok' || stokYuklendi) return
    setStokYukleniyor(true)
    Promise.all([
      urunleriGetir().catch(() => []),
      fetch(`${API_BASE}/nasbag-urunler`).then(r => r.ok ? r.text() : Promise.reject(r.statusText)).catch(() => null),
      fetch(`${API_BASE}/ticimax-urunler`).then(r => r.ok ? r.text() : Promise.reject(r.statusText)).catch(() => null),
    ]).then(([u, nasbagXml, spXml]) => {
      setStokUrunler(Array.isArray(u) ? u : (u?.items || []))

      if (nasbagXml) {
        const doc = new DOMParser().parseFromString(nasbagXml, 'text/xml')
        const nodes = Array.from(doc.querySelectorAll('Urunler > Urun'))
        setNasbagStok(nodes.map(n => ({
          stok:   parseInt(n.querySelector('StokKalanMiktari')?.textContent ?? '0') || 0,
          fiyat1: parseFloat((n.querySelector('Fiyat1')?.textContent ?? '0').replace(',', '.')) || 0,
        })))
      }

      if (spXml) {
        const doc = new DOMParser().parseFromString(spXml, 'text/xml')
        const nodes = Array.from(doc.querySelectorAll('Root > Urunler > Urun'))
        setSilverpoloStok(nodes.flatMap(n =>
          Array.from(n.querySelectorAll('UrunSecenek > Secenek'))
            .filter(s => s.querySelector('Aktif')?.textContent !== '0')
            .map(s => ({
              stok:  parseInt(s.querySelector('StokAdedi')?.textContent ?? '0') || 0,
              alisF: parseFloat(s.querySelector('AlisFiyati')?.textContent ?? '0') || 0,
            }))
        ))
      }

      setStokYuklendi(true)
    }).catch(console.error)
    .finally(() => setStokYukleniyor(false))
  }, [sekme, stokYuklendi])

  // Mağaza bazlı yerel stok değeri: her mağaza için Σ(adet × alışFiyatı)
  const magazaStokDegeri = magazalar.map(m => {
    let adet = 0, deger = 0, cesit = 0
    stokUrunler.forEach(u => {
      const buMagazaVaryantlari = (u.varyantlar || []).filter(v => v.magazaId === m.id)
      if (buMagazaVaryantlari.length === 0) return
      const buMagazaAdet = buMagazaVaryantlari.reduce((t, v) => t + (Number(v.adet) || 0), 0)
      if (buMagazaAdet > 0) cesit++
      adet += buMagazaAdet
      deger += buMagazaAdet * (Number(u.alisF) || 0)
    })
    return { magaza: m, adet, deger, cesit }
  })
  const yerelToplamDeger = magazaStokDegeri.reduce((t, m) => t + m.deger, 0)
  const yerelToplamAdet  = magazaStokDegeri.reduce((t, m) => t + m.adet, 0)

  const nasbagToplamDeger = nasbagStok.reduce((t, u) => t + u.stok * u.fiyat1, 0)
  const nasbagToplamAdet  = nasbagStok.reduce((t, u) => t + u.stok, 0)

  const silverpoloToplamDeger = silverpoloStok.reduce((t, s) => t + s.stok * s.alisF, 0)
  const silverpoloToplamAdet  = silverpoloStok.reduce((t, s) => t + s.stok, 0)

  const toplamBakiye = hesaplar.reduce((t,h)=>t+Number(h.bakiye),0)
  const filtreli = hareketler.filter(h=>tipFiltre==='hepsi'||h.tip===tipFiltre)

  const hesapSil = async (h) => {
    if (!await onayla(`${h.ad} hesabı silinecek.`, { title: 'Hesabı sil', confirmLabel: 'Hesabı sil' })) return
    try { await bankaHesapSil(h.id); toast.success('Hesap silindi.'); yukle() } catch (e) { toast.error(e.message) }
  }
  const hareketSil = async (h) => {
    if (!await onayla(`${para(h.tutar)} tutarındaki hareket silinecek.`, { title: 'Hareketi sil', confirmLabel: 'Hareketi sil' })) return
    try { await bankaHareketSil(h.id); toast.success('Hareket silindi.'); yukle() } catch (e) { toast.error(e.message) }
  }

  return (
    <Page>
      <PageHeader title="Banka ve mutabakat" subtitle={`Toplam bakiye ${para(toplamBakiye)}`}
        actions={<>
          {sekme==='hareketler'&&secilenHesap&&<Button icon={Plus} onClick={()=>setHareketModal(secilenHesap)}>Hareket ekle</Button>}
          <Button icon={Banknote} onClick={()=>setVirmanModal('kasa')}>Kasadan aktar</Button>
          <Button icon={ArrowRightLeft} onClick={()=>setVirmanModal('banka')}>Virman</Button>
          <Button variant="primary" icon={Plus} onClick={()=>setHesapModal('yeni')}>Hesap ekle</Button>
        </>}>
        <div className="vg-row">
          <Select size="sm" value={secilenHesap?.id||''} onChange={e=>setSecilenHesap(hesaplar.find(x=>x.id===e.target.value)||null)} aria-label="Hesap" style={{ width: 'auto' }}>
            <option value="">Tüm hesaplar</option>
            {hesaplar.map(h=><option key={h.id} value={h.id}>{h.ad} · {h.banka}</option>)}
          </Select>
          <Select size="sm" value={ay} onChange={e=>setAy(Number(e.target.value))} aria-label="Ay" style={{ width: 'auto' }}>
            {AYLAR.map((a,i)=><option key={i} value={i+1}>{a}</option>)}
          </Select>
          <Select size="sm" value={yil} onChange={e=>setYil(Number(e.target.value))} aria-label="Yıl" style={{ width: 'auto' }}>
            {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
          </Select>
        </div>
        <Tabs value={sekme} onChange={setSekme} items={[
          { id:'hesaplar', label:'Hesaplar' }, { id:'hareketler', label:'Hareketler' },
          { id:'mutabakat', label:'Mutabakat' }, { id:'stok', label:'Stok değeri' },
        ]} />
      </PageHeader>

      {yukleniyor ? <LoadingRows /> : <>
        {sekme==='hesaplar'&&(
          <>
            {ozet&&(
              <div className="vg-grid-3">
                <StatCard label={`${AYLAR[ay-1]} gelir`} value={para(ozet.gelir||0)} />
                <StatCard label={`${AYLAR[ay-1]} gider`} value={para(ozet.gider||0)} />
                <StatCard label="Net" value={para((ozet.gelir||0)-(ozet.gider||0))}
                  meta={<Badge tone={(ozet.gelir||0)>=(ozet.gider||0)?'success':'critical'}>{(ozet.gelir||0)>=(ozet.gider||0)?'Pozitif':'Negatif'}</Badge>} />
              </div>
            )}
            <div className="vg-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {hesaplar.map(h=>(
                <Card key={h.id} bodyClassName="vg-stack">
                  <div className="vg-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Landmark className="vg-icon" /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }} className="vg-truncate">{h.ad}</div>
                      <div className="vg-list__secondary">{h.banka}</div>
                    </div>
                    <Menu trigger={({ toggle }) => <IconButton icon={MoreHorizontal} label="İşlemler" size="sm" onClick={toggle} />}
                      items={[
                        { text: 'Düzenle', icon: Pencil, onClick: () => setHesapModal(h) },
                        '-',
                        { text: 'Sil', icon: Trash2, tone: 'critical', onClick: () => hesapSil(h) },
                      ]} />
                  </div>
                  <div>
                    <div className="vg-stat__value" style={{ color: Number(h.bakiye) < 0 ? 'var(--critical)' : undefined }}>{para(h.bakiye)}</div>
                    {h.iban&&<div className="vg-code vg-muted" style={{ marginTop: 2 }}>{h.iban}</div>}
                    {h.magaza&&<div className="vg-row vg-muted" style={{ gap: 4, fontSize: 12, marginTop: 2 }}><MapPin className="vg-icon" style={{ width: 13, height: 13 }} />{h.magaza.ad}</div>}
                  </div>
                  <div className="vg-row" style={{ flexWrap: 'nowrap' }}>
                    <Button size="sm" icon={List} onClick={()=>{setSecilenHesap(h);setSekme('hareketler')}} style={{ flex: 1 }}>Hareketler</Button>
                    <Button size="sm" icon={Plus} onClick={()=>{setSecilenHesap(h);setHareketModal(h)}} style={{ flex: 1 }}>Hareket ekle</Button>
                  </div>
                </Card>
              ))}
              <button type="button" onClick={()=>setHesapModal('yeni')} className="vg-card vg-card--interactive" style={{
                border:'1px dashed var(--line-input)',boxShadow:'none',background:'transparent',minHeight:140,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,color:'var(--ink-muted)',font:'inherit',cursor:'pointer'}}>
                <Plus className="vg-icon vg-icon--lg" /> Yeni hesap
              </button>
            </div>
          </>
        )}

        {sekme==='hareketler'&&(
          <div className="vg-table-wrap">
            <div className="vg-table-toolbar">
              <Segmented label="Hareket tipi" value={tipFiltre} onChange={setTipFiltre} options={[{ value:'hepsi', label:'Tümü' }, { value:'gelir', label:'Gelir' }, { value:'gider', label:'Gider' }]} />
              {secilenHesap && <Badge dot={false}>{secilenHesap.ad}</Badge>}
            </div>
            {filtreli.length===0 ? <EmptyState icon={List} title="Hareket yok" /> : (
              <div className="vg-table-scroll">
                <table className="vg-table" style={{ minWidth: 860 }}>
                  <thead><tr><th>Tarih</th><th>Hesap</th><th>Kategori</th><th>Açıklama</th><th>Referans</th><th className="is-num">Tutar</th><th className="is-num">Bakiye</th><th></th></tr></thead>
                  <tbody>
                    {filtreli.map(h=>(
                      <tr key={h.id}>
                        <td className="vg-nowrap"><div>{tarihTR(h.tarih)}</div><div className="vg-list__secondary">{saatTR(h.tarih)}</div></td>
                        <td>{h.hesap?.ad||'—'}</td>
                        <td>{h.kategori?<Badge dot={false}>{h.kategori.ad}</Badge>:<span className="vg-muted">—</span>}</td>
                        <td style={{ maxWidth: 200 }}><div className="vg-truncate">{h.aciklama||'—'}</div></td>
                        <td className="vg-code vg-muted">{h.referans||'—'}</td>
                        <td className={`is-num is-strong ${h.tip==='gelir'?'vg-text-success':''}`}>{h.tip==='gelir'?'+':'−'}{para(h.tutar)}</td>
                        <td className="is-num vg-muted">{para(h.bakiye)}</td>
                        <td>
                          <div className="vg-row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                            <IconButton icon={Pencil} label="Düzenle" size="sm" onClick={()=>setHareketModal({...secilenHesap||hesaplar[0], duzenle:h})} />
                            <IconButton icon={Trash2} label="Sil" size="sm" variant="critical-plain" onClick={()=>hareketSil(h)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {sekme==='mutabakat'&&(
          !mutabakat ? <LoadingRows /> : (
            <>
              <Banner tone={mutabakat.mutabakatDurumu==='eslesti'?'success':'critical'}
                icon={mutabakat.mutabakatDurumu==='eslesti'?CircleCheck:TriangleAlert}
                title={mutabakat.mutabakatDurumu==='eslesti'?'Mutabakat tamam.':'Mutabakat uyuşmazlığı.'}
                action={<div style={{ textAlign: 'right' }}><div className="vg-help">Fark</div><div className="vg-num" style={{ fontSize: 18, fontWeight: 600 }}>{mutabakat.fark>=0?'+':''}{para(mutabakat.fark||0)}</div></div>}>
                {AYLAR[ay-1]} {yil} · {secilenHesap?.ad||'Tüm hesaplar'}
              </Banner>

              <div className="vg-grid-2">
                {[
                  {baslik:'Satış ödemeleri (kart + havale)',toplam:mutabakat.toplamSatisOdeme||0,
                    liste:mutabakat.satisOdemeleri||[],
                    render:o=>({ ana:<span className="vg-code">{o.satis?.fisNo}</span>, alt:`${tarihTR(o.satis?.tarih)} · ${o.tip}` })},
                  {baslik:'Banka gelir hareketleri',toplam:mutabakat.toplamBankaGelir||0,
                    liste:mutabakat.bankaHareketleri||[],
                    render:h=>({ ana:h.aciklama||h.referans||'—', alt:`${tarihTR(h.tarih)} · ${h.hesap?.ad||''}` })},
                ].map(panel=>(
                  <Card key={panel.baslik} title={panel.baslik} subtitle={<span className="vg-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{para(panel.toplam)}</span>} padded={false}>
                    {panel.liste.length===0 ? <EmptyState compact title="Kayıt yok" /> : (
                      <ul className="vg-list" style={{ maxHeight: 300, overflowY: 'auto', marginTop: 8 }}>
                        {panel.liste.map((item,i)=>{
                          const r = panel.render(item)
                          return (
                            <li key={i} className="vg-list__item">
                              <div className="vg-list__main"><div className="vg-list__primary">{r.ana}</div><div className="vg-list__secondary">{r.alt}</div></div>
                              <div className="vg-list__value">{para(item.tutar)}</div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )
        )}

        {sekme==='stok'&&(
          stokYukleniyor&&!stokYuklendi ? (
            <div className="vg-card"><EmptyState icon={RefreshCw} title="Stok verileri çekiliyor" text="Silver Polo'nun tüm ürünleri dahil olduğu için biraz sürebilir." /></div>
          ) : (
            <>
              <StatCard label="Genel toplam stok değeri" value={para(yerelToplamDeger+nasbagToplamDeger+silverpoloToplamDeger)}
                meta="Yerel + Nas Bag + Silver Polo (tedarikçi maliyeti üzerinden)" />

              <Card title="Mağaza bazlı stok değeri (yerel)">
                <div className="vg-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {magazaStokDegeri.map(({magaza,adet,deger,cesit})=>(
                    <Tile key={magaza.id} label={<span className="vg-row" style={{ gap: 6 }}><MagazaIkon ikon={magaza.ikon} style={{ width: 14, height: 14 }} />{magaza.ad}</span>} value={para(deger)}>
                      <div className="vg-help">{adet} adet · {cesit} ürün çeşidi</div>
                    </Tile>
                  ))}
                  <Tile label="Yerel toplam" value={para(yerelToplamDeger)} style={{ background: 'var(--accent-soft)' }}>
                    <div className="vg-help">{yerelToplamAdet} adet · tüm mağazalar</div>
                  </Tile>
                </div>
              </Card>

              <Card title="Tedarikçi stok değeri (canlı XML)">
                <div className="vg-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  <Tile label="Nas Bag" value={para(nasbagToplamDeger)}><div className="vg-help">{nasbagToplamAdet} adet · {nasbagStok.length} kalem · Fiyat1 üzerinden</div></Tile>
                  <Tile label="Silver Polo" value={para(silverpoloToplamDeger)}><div className="vg-help">{silverpoloToplamAdet} adet · {silverpoloStok.length} kalem · alış fiyatı üzerinden</div></Tile>
                </div>
              </Card>

              <div><Button icon={RefreshCw} onClick={()=>{setStokYuklendi(false)}}>Stok verilerini yenile</Button></div>
            </>
          )
        )}
      </>}

      {virmanModal&&<VirmanModal hesaplar={hesaplar} magazalar={magazalar} tip={virmanModal} onKaydet={()=>{setVirmanModal(null);yukle()}} onKapat={()=>setVirmanModal(null)}/>}
      {hesapModal&&<HesapModal hesap={hesapModal==='yeni'?null:hesapModal} magazalar={magazalar} onKaydet={()=>{setHesapModal(null);yukle()}} onKapat={()=>setHesapModal(null)}/>}
      {hareketModal&&<HareketModal hesap={hareketModal} kategoriler={kategoriler} onKaydet={()=>{setHareketModal(null);yukle()}} onKapat={()=>setHareketModal(null)}/>}
    </Page>
  )
}
