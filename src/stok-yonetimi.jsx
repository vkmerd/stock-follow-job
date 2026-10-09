import React, { useState, useEffect, useRef } from "react";
import { useVega } from "./VegaContext";
import { usePrint } from "./print/usePrint";
import { Page, PageHeader, Card, Button, IconButton, Field, Input, Select, Textarea, SearchInput, Tabs, Segmented, Badge, Banner, Modal, StatCard, Tile, Progress, EmptyState, LoadingRows, Menu, MagazaIkon, onayla, sor, toast } from "./ui";
import { Check, Plug, Printer, Settings2, Save, Upload, Link2, Image as ImageIcon, Trash2, X, Plus, ArrowLeft, ArrowRight, PackageSearch, Send, ShoppingBag, Download, Minus, TriangleAlert, CircleCheck, MapPin, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Package, ReceiptText, ShoppingCart, History, Palette } from "lucide-react";
import { urunleriGetir, urunEkle, urunGuncelle, urunSil, sonKoduGetir, stokHareketleriGetir, stokHareketKaydet, markalariGetir, markaEkle, markaSil, kategorileriGetir, shopifyYayinla, shopifyRenkAdlariniGonder, stokTransfer } from './api';

// ─── YARDIMCI ─────────────────────────────────────────────────
const para = v => `₺${Number(v||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
// EAN-13 checksum
const ean13Checksum = (kod12) => {
  let t = 0;
  for (let i = 0; i < 12; i++) t += parseInt(kod12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (t % 10)) % 10;
};
const strHash = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h);
};
const urunBarkod = (ad='', marka='', renk='', beden='', alisF=0) => {
  const hash9 = strHash([ad,marka,renk,beden,String(alisF)].join('|').toLowerCase()).toString().padStart(9,'0').slice(-9);
  const kod12 = '869' + hash9;
  return kod12 + ean13Checksum(kod12);
};
const yeniBarkod = (ad, marka, renk, beden, alisF) => {
  if (ad || renk || beden) return urunBarkod(ad, marka, renk, beden, alisF);
  const kod12 = '869' + Date.now().toString().slice(-9);
  return kod12 + ean13Checksum(kod12);
};



const KATEGORILER = {
  "Çanta":    ["Omuz Çantası","Sırt Çantası","El Çantası","Bel Çantası","Clutch","Seyahat"],
  "Ayakkabı": ["Sneaker","Bot","Topuklu","Loafer","Sandalet","Terlik"],
  "Cüzdan":   ["Kadın Cüzdan","Erkek Cüzdan","Kart Cüzdanı","Bozuk Para Cüzdanı","Anahtarlık"],
};
// Markalar API'den yükleniyor
const RENKLER = ["Siyah","Beyaz","Krem","Kahve","Lacivert","Bordo","Gri","Bej","Yeşil","Pembe","Sarı","Turuncu","Mor"];
const BEDENLER_AYAKKABI = Array.from({length: 48-20+1}, (_,i) => String(20+i));
const BEDENLER_CANTA    = []; // Çanta için ebat yok

// ─── BARKOD SVG ───────────────────────────────────────────────
function BarkodSVG({ deger, w=180, h=48 }) {
  if(!deger) return null;
  const L={0:[0,0,0,1,1,0,1],1:[0,0,1,1,0,0,1],2:[0,0,1,0,0,1,1],3:[0,1,1,1,1,0,1],
           4:[0,1,0,0,0,1,1],5:[0,1,1,0,0,0,1],6:[0,1,0,1,1,1,1],7:[0,1,1,1,0,1,1],
           8:[0,1,1,0,1,1,1],9:[0,0,0,1,0,1,1]};
  const R={0:[1,1,1,0,0,1,0],1:[1,1,0,0,1,1,0],2:[1,1,0,1,1,0,0],3:[1,0,0,0,0,1,0],
           4:[1,0,1,1,1,0,0],5:[1,0,0,1,1,1,0],6:[1,0,1,0,0,0,0],7:[1,0,0,0,1,0,0],
           8:[1,0,0,1,0,0,0],9:[1,1,1,0,1,0,0]};
  const s = deger.toString().replace(/\D/g,"").padStart(12,"0").slice(0,12);
  let bits = [1,1,0,1,1,0,1];
  for(let i=0;i<6;i++) bits.push(...(L[parseInt(s[i])]||L[0]));
  bits.push(0,1,0,1,0);
  for(let i=6;i<12;i++) bits.push(...(R[parseInt(s[i])]||R[0]));
  bits.push(1,0,1,0,0,0,1,0,1);
  const bw = w/bits.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      {bits.map((b,i)=>b?<rect key={i} x={i*bw} y={0} width={bw} height={h*0.88} fill="#111"/>:null)}
    </svg>
  );
}

// ─── ETİKET ───────────────────────────────────────────────────
function Etiket({ varyant, urun, indirimOran=15 }) {
  const satisF = Number(urun?.satisF||0);
  const listeF = Math.ceil(satisF/(1-indirimOran/100)/10)*10;
  return (
    <div style={{width:240,height:155,background:"#fff",border:"1.5px solid #ccc",borderRadius:6,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",
      padding:"10px 14px",fontFamily:"var(--font-sans)",boxShadow:"0 4px 16px rgba(0,0,0,.15)",flexShrink:0}}>
      <svg width={80} height={20} viewBox="0 0 120 22" fill="none">
        <ellipse cx="46" cy="11" rx="32" ry="8" fill="#7BBFE8" opacity=".7" transform="rotate(-2 46 11)"/>
        <text x="12" y="15" fontFamily="Georgia,serif" fontSize="16" fontStyle="italic" fontWeight="bold" fill="#111">Vega</text>
        <text x="13" y="21" fontFamily="Georgia,serif" fontSize="5" fill="#555" letterSpacing=".3">Her Sezon İçin</text>
      </svg>
      <div style={{fontSize:9,fontWeight:700,color:"#111",textAlign:"center",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {urun?.ad?.slice(0,30)||"Ürün"}
      </div>
      <div style={{display:"flex",gap:3}}>
        {[varyant?.renk,varyant?.beden].map((x,i)=>x&&(
          <span key={i} style={{fontSize:7,background:"#f0f0f0",borderRadius:2,padding:"1px 5px",color:"#333",fontWeight:600}}>{x}</span>
        ))}
      </div>
      <BarkodSVG deger={varyant?.barkod||"000000000000"} w={210} h={38}/>
      <div style={{fontSize:8,color:"#444",letterSpacing:1,fontFamily:"monospace",fontWeight:500}}>{varyant?.barkod}</div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:8,color:"#999",textDecoration:"line-through",textDecorationColor:"#e53935"}}>₺{listeF.toLocaleString("tr-TR")}</span>
          <span style={{fontSize:7,background:"#e53935",color:"#fff",borderRadius:2,padding:"1px 4px",fontWeight:700}}>%{indirimOran} İND.</span>
        </div>
        <div style={{fontSize:14,fontWeight:900,color:"#111"}}>₺{satisF.toLocaleString("tr-TR")}</div>
      </div>
    </div>
  );
}

// ─── VARYANT EDİTÖRÜ (Mağaza Bazlı; Ayakkabıda mağaza+numara bazlı) ────
function VaryantEditor({ kategori, varyantlar, onChange, magazalar, urunBilgi={} }) {
  const urunBarkodu = urunBilgi?.barkod || '';
  // Ayakkabıda tek "Standart" satır yerine, her mağaza için birden fazla numara (beden)
  // satırı olabilir — stok VE barkod numara bazlı ayrı ayrı tutulur.
  const ayakkabiMi = kategori === 'Ayakkabı';

  // "Seçili mağaza" = stoğu girilmiş (varyantlar içinde gerçekten kaydı olan) mağaza.
  // Ürün ilk açıldığında, mevcut varyantı olan mağazalar otomatik seçili gelir.
  const [seciliMagazaIdler, setSeciliMagazaIdler] = useState(
    () => [...new Set((varyantlar || []).map(v => v.magazaId).filter(Boolean))]
  );

  const magazaToggle = (magazaId) => {
    setSeciliMagazaIdler(prev => {
      const magazaZatenSeciliydi = prev.includes(magazaId);
      const yeniSecili = magazaZatenSeciliydi ? prev.filter(id => id !== magazaId) : [...prev, magazaId];

      if (magazaZatenSeciliydi) {
        // Mağaza kaldırıldı — o mağazaya ait TÜM satırları (ayakkabıda birden fazla
        // numara satırı olabilir) listeden çıkar.
        onChange((varyantlar || []).filter(v => v.magazaId !== magazaId));
      } else if (!ayakkabiMi) {
        // Çanta/diğer kategoriler: mağaza eklenince hemen tek "Standart" satır oluştur.
        // Ayakkabıda satır oluşturmuyoruz — kullanıcı aşağıdan numara seçince oluşacak.
        const mevcutListe = varyantlar || [];
        if (!mevcutListe.some(v => v.magazaId === magazaId)) {
          const mag = magazalar.find(m => m.id === magazaId);
          onChange([...mevcutListe, { renk: 'Standart', beden: '', magazaId, magazaAd: mag?.ad, adet: 0, barkod: urunBarkodu || '' }]);
        }
      }
      return yeniSecili;
    });
  };

  const adetGuncelle = (magazaId, adet) => {
    const yeniAdet = Math.max(0, parseInt(adet) || 0);
    const mevcutListe = varyantlar || [];
    const varMi = mevcutListe.some(s => s.magazaId === magazaId);
    const guncel = varMi
      ? mevcutListe.map(s => s.magazaId === magazaId ? { ...s, adet: yeniAdet } : s)
      : [...mevcutListe, { renk: 'Standart', beden: '', magazaId, adet: yeniAdet, barkod: urunBarkodu || '' }];
    onChange(guncel);
  };

  const barkodGuncelle = (magazaId, barkod) => {
    const mevcutListe = varyantlar || [];
    const varMi = mevcutListe.some(s => s.magazaId === magazaId);
    const guncel = varMi
      ? mevcutListe.map(s => s.magazaId === magazaId ? { ...s, barkod } : s)
      : [...mevcutListe, { renk: 'Standart', beden: '', magazaId, adet: 0, barkod }];
    onChange(guncel);
  };

  // ─ Ayakkabıya özel: mağaza + numara bazlı satır işlemleri ─
  const numaraToggle = (magazaId, beden) => {
    const mevcutListe = varyantlar || [];
    const varMi = mevcutListe.some(s => s.magazaId === magazaId && s.beden === beden);
    // Aynı ürün içinde bu beden daha önce başka bir mağazada eklenmişse onun barkodunu
    // kullan (numara bazında tek barkod, mağazalar arası tutarlı) — yoksa yeni üret.
    const ayniBedenKaydi = mevcutListe.find(s => s.beden === beden && s.barkod);
    const numaraBarkod = ayniBedenKaydi?.barkod
      || yeniBarkod(urunBilgi?.ad, urunBilgi?.marka, urunBilgi?.renkAdi || 'Standart', beden, urunBilgi?.alisF);
    onChange(varMi
      ? mevcutListe.filter(s => !(s.magazaId === magazaId && s.beden === beden))
      : [...mevcutListe, { renk: 'Standart', beden, magazaId, adet: 0, barkod: numaraBarkod }]);
  };

  const numaraAdetGuncelle = (magazaId, beden, adet) => {
    const yeniAdet = Math.max(0, parseInt(adet) || 0);
    onChange((varyantlar || []).map(s =>
      (s.magazaId === magazaId && s.beden === beden) ? { ...s, adet: yeniAdet } : s
    ));
  };

  const numaraBarkodGuncelle = (magazaId, beden, barkod) => {
    onChange((varyantlar || []).map(s =>
      (s.magazaId === magazaId && s.beden === beden) ? { ...s, barkod } : s
    ));
  };

  if (magazalar.length === 0) return (
    <Banner tone="warning">Önce Mağazalar sayfasından en az bir mağaza ekleyin.</Banner>
  );

  const magazaSecici = (
    <Field label="Bu ürün hangi mağazalarda var?">
      <div className="vg-row" style={{ gap: 6 }}>
        {magazalar.map(m=>{
          const secili = seciliMagazaIdler.includes(m.id);
          return (
            <button key={m.id} type="button" className="vg-chip" aria-pressed={secili} onClick={()=>magazaToggle(m.id)}>
              {secili ? <Check className="vg-icon" style={{ width: 14, height: 14 }} /> : <MagazaIkon ikon={m.ikon} style={{ width: 14, height: 14 }} />}{m.ad}
            </button>
          );
        })}
      </div>
    </Field>
  );

  const bosSecim = (
    <div className="vg-tile" style={{ textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13, padding: 20 }}>
      Yukarıdan bu ürünün satıldığı mağazaları seçin.
    </div>
  );

  // ─── Ayakkabı: mağaza + numara bazlı grid ───
  if (ayakkabiMi) {
    const toplamAdet = (varyantlar || []).reduce((t,s)=>t+(Number(s.adet)||0),0);
    return (
      <div className="vg-stack">
        {magazaSecici}
        {seciliMagazaIdler.length === 0 ? bosSecim : (
          <>
            <div className="vg-help">Toplam <strong className="vg-num" style={{ color: 'var(--ink)' }}>{toplamAdet}</strong> adet (tüm numaralar)</div>
            {seciliMagazaIdler.map(magazaId => {
              const mag = magazalar.find(m=>m.id===magazaId);
              const buMagazaSatirlari = (varyantlar || []).filter(v => v.magazaId === magazaId);
              const aktifBedenler = new Set(buMagazaSatirlari.map(v => v.beden));
              const siraliSatirlar = [...buMagazaSatirlari].sort((a,b) => (parseInt(a.beden)||0) - (parseInt(b.beden)||0));
              return (
                <div key={magazaId} className="vg-card" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                  <div className="vg-row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: 13, gap: 6 }}>
                    <MagazaIkon ikon={mag?.ikon} style={{ width: 14, height: 14, color: 'var(--ink-muted)' }} />{mag?.ad||magazaId}
                  </div>
                  <div style={{ padding: '12px 14px', borderBottom: siraliSatirlar.length ? '1px solid var(--line)' : 0 }}>
                    <div className="vg-label" style={{ marginBottom: 6 }}>Numara seçin</div>
                    <div className="vg-row" style={{ gap: 4 }}>
                      {BEDENLER_AYAKKABI.map(beden => {
                        const secili = aktifBedenler.has(beden);
                        return (
                          <button key={beden} type="button" className="vg-chip vg-num" aria-pressed={secili} onClick={()=>numaraToggle(magazaId,beden)}
                            style={{ width: 40, justifyContent: 'center', padding: 0, borderRadius: 6 }}>
                            {beden}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {siraliSatirlar.length > 0 && (
                    <div className="vg-table-scroll">
                      <table className="vg-table vg-table--compact" style={{ minWidth: 340 }}>
                        <thead><tr><th>Numara</th><th>Adet</th><th>Barkod</th></tr></thead>
                        <tbody>
                          {siraliSatirlar.map(s=>(
                            <tr key={s.beden}>
                              <td className="is-strong vg-num">{s.beden}</td>
                              <td><Input size="sm" type="number" value={s.adet} min={0} className="vg-num" aria-label={`${s.beden} numara adedi`} onChange={e=>numaraAdetGuncelle(magazaId,s.beden,e.target.value)} style={{ width: 76, textAlign: 'center' }} /></td>
                              <td><Input size="sm" mono value={s.barkod||""} onChange={e=>numaraBarkodGuncelle(magazaId,s.beden,e.target.value)} placeholder={`${s.beden} numara barkodu`} aria-label={`${s.beden} numara barkodu`} style={{ width: 180 }} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  // ─── Çanta/diğer kategoriler: mağaza bazlı tekil stok ───
  const tumSatirlar = magazalar.map(m => {
    const mevcut = (varyantlar || []).find(v => v.magazaId === m.id);
    return mevcut
      ? { ...mevcut, magazaAd: m.ad }
      : { renk: 'Standart', beden: '', magazaId: m.id, magazaAd: m.ad, adet: 0, barkod: urunBarkodu || '' };
  });
  const gorunenSatirlar = tumSatirlar.filter(s => seciliMagazaIdler.includes(s.magazaId));
  const toplamAdet = gorunenSatirlar.reduce((t,s)=>t+(Number(s.adet)||0),0);

  return (
    <div className="vg-stack">
      {magazaSecici}
      {gorunenSatirlar.length === 0 ? bosSecim : (
        <>
          <div className="vg-help"><strong style={{ color: 'var(--ink)' }}>{gorunenSatirlar.length}</strong> mağazada stok · toplam <strong className="vg-num" style={{ color: 'var(--ink)' }}>{toplamAdet}</strong> adet</div>
          <div className="vg-table-wrap" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            <div className="vg-table-scroll" style={{ maxHeight: 420 }}>
              <table className="vg-table vg-table--compact" style={{ minWidth: 400 }}>
                <thead><tr><th>Mağaza</th><th>Adet</th><th>Barkod</th></tr></thead>
                <tbody>
                  {gorunenSatirlar.map(s=>{
                    const mag = magazalar.find(m=>m.id===s.magazaId);
                    return (
                      <tr key={s.magazaId}>
                        <td className="is-strong"><span className="vg-row" style={{ gap: 6 }}><MagazaIkon ikon={mag?.ikon} style={{ width: 14, height: 14, color: 'var(--ink-muted)' }} />{mag?.ad||s.magazaAd||s.magazaId}</span></td>
                        <td><Input size="sm" type="number" value={s.adet} min={0} className="vg-num" aria-label="Adet" onChange={e=>adetGuncelle(s.magazaId,e.target.value)} style={{ width: 84, textAlign: 'center' }} /></td>
                        <td><Input size="sm" mono value={s.barkod||""} onChange={e=>barkodGuncelle(s.magazaId,e.target.value)} placeholder="Ürün barkodu" aria-label="Barkod" style={{ width: 170 }} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


// ─── BARKOD ETİKET ────────────────────────────────────────────
function BarkodEtiketSayfasi({ urun, magazalar }) {
  const print = usePrint();
  const varyantlar = urun?.varyantlar || [];
  const [secili, setSecili]         = useState([]);
  const [adetler, setAdetler]       = useState({});
  const [indirimOran, setIndirimOran] = useState(15);
  const satisF = Number(urun?.satisF||0);
  const listeF = Math.ceil(satisF/(1-indirimOran/100)/10)*10;
  const vKey = v => v.id||v.barkod;
  const toggle = id => setSecili(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  // QZ ile yazdırma
  const [qzYazdiriliyor, setQzYazdiriliyor] = useState(false);
  const [kalibreEdiliyor, setKalibreEdiliyor] = useState(false);
  const [modKaydediliyor, setModKaydediliyor] = useState(false);
  const kalibreEt = async () => {
    setKalibreEdiliyor(true);
    try {
      await print.yaziciKalibreEt();
      toast.success("Kalibrasyon komutu gönderildi. Yazıcı birkaç etiket ileri-geri besleyip kendini ayarlayacak.", 6000);
    } catch (err) {
      toast.error("Kalibre edilemedi: " + err.message);
    } finally {
      setKalibreEdiliyor(false);
    }
  };
  const modKaydet = async () => {
    setModKaydediliyor(true);
    try {
      await print.yaziciModuKaydetVeAyarla();
      toast.success("Yazıcı ayarı kaydedildi. Etiketler artık tek tek çıkmalı; bir sonraki baskıda test edin.", 6000);
    } catch (err) {
      toast.error("Ayar kaydedilemedi: " + err.message);
    } finally {
      setModKaydediliyor(false);
    }
  };
  const qzYazdir = async () => {
    setQzYazdiriliyor(true);
    try {
      const vKey = v => v.id || v.barkod;
      const secilenVaryantlar = varyantlar.filter(v => secili.includes(vKey(v)));
      await print.urunEtiketiYazdir(secilenVaryantlar, urun, indirimOran, adetler);
      toast.success("Etiketler yazıcıya gönderildi.");
    } catch (err) {
      toast.error("Yazdırılamadı: " + err.message);
    } finally {
      setQzYazdiriliyor(false);
    }
  };

  const yazdir = () => {
    const sv = varyantlar.filter(v=>secili.includes(vKey(v)));
    if(!sv.length){ toast.warning("En az bir varyant seçin."); return; }
    const win = window.open("","_blank","width=900,height=700");
    win.document.write(`<!DOCTYPE html><html><head><title>Etiket</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial;}
    @page{size:50mm 30mm landscape;margin:0;}.et{page-break-after:always;width:50mm;height:30mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:2mm 3mm;background:#fff;}
    .ad{font-size:6.5pt;font-weight:700;color:#111;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;}
    .var span{font-size:5.5pt;background:#eee;border-radius:2px;padding:.5px 3px;font-weight:700;}
    .bnum{font-size:4.5pt;font-family:monospace;color:#555;}
    .gercek{font-size:10pt;font-weight:900;color:#111;}
    .liste{font-size:6pt;color:#999;text-decoration:line-through;text-decoration-color:#e53935;}
    .ind{font-size:5pt;background:#e53935;color:#fff;border-radius:2px;padding:0 2px;font-weight:700;}</style></head><body>
    ${sv.flatMap(v=>Array.from({length:adetler[vKey(v)]||1},()=>`
      <div class="et">
        <svg width="76" height="19" viewBox="0 0 120 22"><ellipse cx="46" cy="11" rx="32" ry="8" fill="#7BBFE8" opacity=".7" transform="rotate(-2 46 11)"/>
        <text x="12" y="15" font-family="Georgia,serif" font-size="16" font-style="italic" font-weight="bold" fill="#111">Vega</text>
        <text x="13" y="21" font-family="Georgia,serif" font-size="5" fill="#555">Her Sezon İçin</text></svg>
        <div class="ad">${[urun?.sku||urun?.kod||"", urun?.renkAdi?.trim()].filter(Boolean).join(" - ").slice(0,30)}</div>
        <div class="var"><span>${v.renk||""}</span> <span>${v.beden||""}</span></div>
        <svg id="b_${v.barkod}" viewBox="0 0 190 30" width="190" height="30"></svg>
        <div class="bnum">${v.barkod}</div>
        <div style="text-align:center"><div class="liste">₺${listeF.toLocaleString("tr-TR")} <span class="ind">%${indirimOran}</span></div><div class="gercek">₺${satisF.toLocaleString("tr-TR")}</div></div>
      </div>`)).join("")}
    <script>(function(){var L={0:[0,0,0,1,1,0,1],1:[0,0,1,1,0,0,1],2:[0,0,1,0,0,1,1],3:[0,1,1,1,1,0,1],4:[0,1,0,0,0,1,1],5:[0,1,1,0,0,0,1],6:[0,1,0,1,1,1,1],7:[0,1,1,1,0,1,1],8:[0,1,1,0,1,1,1],9:[0,0,0,1,0,1,1]};
    var R={0:[1,1,1,0,0,1,0],1:[1,1,0,0,1,1,0],2:[1,1,0,1,1,0,0],3:[1,0,0,0,0,1,0],4:[1,0,1,1,1,0,0],5:[1,0,0,1,1,1,0],6:[1,0,1,0,0,0,0],7:[1,0,0,0,1,0,0],8:[1,0,0,1,0,0,0],9:[1,1,1,0,1,0,0]};
    document.querySelectorAll("[id^='b_']").forEach(function(el){var d=el.id.slice(2).replace(/\\D/g,"").padStart(12,"0").slice(0,12);
    var bits=[1,1,0,1,1,0,1];for(var i=0;i<6;i++)bits=bits.concat(L[+d[i]]||L[0]);bits=bits.concat([0,1,0,1,0]);
    for(var i=6;i<12;i++)bits=bits.concat(R[+d[i]]||R[0]);bits=bits.concat([1,0,1,0,0,0,1,0,1]);
    var bw=190/bits.length,ns="http://www.w3.org/2000/svg";bits.forEach(function(b,i){if(b){var r=document.createElementNS(ns,"rect");r.setAttribute("x",i*bw);r.setAttribute("y",0);r.setAttribute("width",bw);r.setAttribute("height",26);r.setAttribute("fill","#111");el.appendChild(r);}});});
    window.onload=function(){window.print();};})()</s`+"cript></body></html>");
    win.document.close();
  };

  const toplamEtiket = secili.reduce((t,id)=>t+(adetler[id]||1),0);

  return (
    <div className="vg-master-detail" style={{ gridTemplateColumns: 'minmax(0,1fr) 270px' }}>
      <div className="vg-stack">
        <div className="vg-row" style={{ justifyContent: 'space-between' }}>
          <div className="vg-section-label">Etiket seçimi</div>
          <Button size="sm" variant="plain" onClick={()=>setSecili(secili.length===varyantlar.length?[]:varyantlar.map(vKey))}>
            {secili.length===varyantlar.length?"Seçimi kaldır":"Tümünü seç"}
          </Button>
        </div>
        <div className="vg-row" style={{ gap: 8 }}>
          <span className="vg-label">Etikette gösterilecek indirim</span>
          <Segmented label="İndirim" value={indirimOran} onChange={setIndirimOran} options={[10,15,20,25,30].map(o=>({ value:o, label:`%${o}` }))} />
        </div>
        {varyantlar.length===0&&<div className="vg-tile" style={{ textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13, padding: 20 }}>Önce "Mağaza ve stok" sekmesinde varyant ekleyin.</div>}
        <div className="vg-stack" style={{ gap: 6 }}>
          {varyantlar.map(v=>{
            const mag = magazalar.find(m=>m.id===v.magazaId);
            const sec = secili.includes(vKey(v));
            return (
              <div key={vKey(v)} className="vg-tile vg-row" style={{ flexWrap: 'wrap', gap: 10, boxShadow: sec ? 'inset 0 0 0 2px var(--accent)' : undefined, background: sec ? 'var(--accent-soft)' : undefined }}>
                <label className="vg-check" style={{ flex: 1, minWidth: 200 }}>
                  <input type="checkbox" checked={sec} onChange={()=>toggle(vKey(v))} />
                  <Badge dot={false}>{v.renk}</Badge>
                  {v.beden && <Badge dot={false}>{v.beden}</Badge>}
                  <span className="vg-muted" style={{ fontSize: 12 }}>{mag?.ad||v.magazaAd||"—"}</span>
                  {v.barkod&&<span className="vg-code vg-muted">{v.barkod}</span>}
                </label>
                <Badge tone={Number(v.adet) > 0 ? 'success' : 'critical'} size="sm">{v.adet} adet</Badge>
                {sec&&(
                  <div className="vg-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <span className="vg-muted" style={{ fontSize: 12 }}>×</span>
                    <Input size="sm" type="number" value={adetler[vKey(v)]||1} min={1} className="vg-num" aria-label="Etiket adedi"
                      onChange={e=>setAdetler(p=>({...p,[vKey(v)]:Math.max(1,parseInt(e.target.value)||1)}))} style={{ width: 56, textAlign: 'center' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* QZ Tray */}
        <div className="vg-tile vg-stack" style={{ gap: 8 }}>
          <div className="vg-row" style={{ gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: print.bagli ? 'var(--success)' : 'var(--critical)' }} />
            <span className="vg-muted" style={{ fontSize: 12 }}>QZ Tray {print.bagli ? 'bağlı' : 'bağlı değil'}</span>
            {!print.bagli&&<Button size="sm" icon={Plug} onClick={print.baglan} loading={print.baglaniyor}>{print.baglaniyor?'Bağlanıyor…':'Bağlan'}</Button>}
          </div>
          {print.bagli&&(
            <div className="vg-row" style={{ gap: 6 }}>
              <Select size="sm" value={print.seciliYazici} onChange={e=>print.yaziciSec(e.target.value)} aria-label="Etiket yazıcısı" style={{ flex: 1, minWidth: 160 }}>
                <option value="">Yazıcı seçin</option>
                {print.yazicilar.map(y=><option key={y} value={y}>{y}</option>)}
              </Select>
              <Select size="sm" value={print.yaziciModu} onChange={e=>print.yaziciModuSec(e.target.value)} aria-label="Yazıcı dili" style={{ width: 'auto' }}
                title="Yazıcınız 'ZDesigner ... ZPL' sürücüsüyle kuruluysa ZPL, RAW/EML 400L gibi bir yazıcıysa TSPL seçin">
                <option value="tspl">TSPL (RAW)</option>
                <option value="zpl">ZPL (ZDesigner)</option>
              </Select>
              <Button size="sm" variant="primary" icon={Printer} onClick={qzYazdir} disabled={!print.seciliYazici||secili.length===0} loading={qzYazdiriliyor}>
                {qzYazdiriliyor?'Gönderiliyor…':'QZ ile yazdır'}
              </Button>
            </div>
          )}
          {print.bagli&&print.seciliYazici&&(
            <div className="vg-row" style={{ gap: 6 }}>
              <Button size="sm" icon={Settings2} onClick={kalibreEt} loading={kalibreEdiliyor} title="Etiket basılıyor ama dışarı çıkmıyor, FEED tuşuna basınca çıkıyorsa kullanın">
                {kalibreEdiliyor?'Kalibre ediliyor…':'Yazıcıyı kalibre et'}
              </Button>
              {print.yaziciModu==='zpl' && (
                <Button size="sm" icon={Save} onClick={modKaydet} loading={modKaydediliyor} title="Etiketler tek tek değil, FEED'e basınca toplu çıkıyorsa kullanın (bir kere yeterli)">
                  {modKaydediliyor?'Kaydediliyor…':'Yazıcı modunu kaydet (tek tek çıksın)'}
                </Button>
              )}
            </div>
          )}
          {print.hata&&<div className="vg-error">{print.hata}</div>}
        </div>

        <Button size="lg" icon={Printer} onClick={yazdir} disabled={secili.length===0}>
          Tarayıcıdan yazdır{secili.length>0?` (${toplamEtiket} etiket)`:""}
        </Button>
      </div>

      <div className="vg-stack vg-sticky" style={{ gap: 8 }}>
        <div className="vg-section-label">Önizleme</div>
        {secili.length===0
          ? <div className="vg-tile" style={{ textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12, padding: '28px 12px' }}>Etiket seçince burada görünür.</div>
          : <div className="vg-stack" style={{ gap: 10, maxHeight: 520, overflowY: 'auto', alignItems: 'center' }}>
              {varyantlar.filter(v=>secili.includes(vKey(v))).map(v=>(
                <Etiket key={vKey(v)} urun={urun} varyant={v} indirimOran={indirimOran}/>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

// ─── ÜRÜN FORMU (Ticimax merkezli) ────────────────────────────
function ResimYonetimi({ resimler=[], onChange }) {
  const fileRef = React.useRef();
  const [yukleniyor, setYukleniyor] = React.useState(false);
  const [hata, setHata] = React.useState(null);

  const dosyaEkle = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setYukleniyor(true);
    setHata(null);
    try {
      const yeniResimler = [...resimler];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.hata || `HTTP ${res.status}`);
        }
        const data = await res.json();
        yeniResimler.push({ url: data.url, kaynak: 'yuklu', ad: file.name });
      }
      onChange(yeniResimler);
    } catch (err) {
      setHata('Yüklenemedi: ' + err.message);
    } finally {
      setYukleniyor(false);
      e.target.value = '';
    }
  };

  const urlEkle = async () => {
    const url = await sor("Resim URL'si", '', { title: 'URL ile resim ekle', confirmLabel: 'Resmi ekle', type: 'url' });
    if (url?.trim()) onChange([...resimler, { url: url.trim(), kaynak: 'url', ad: url.trim().split('/').pop() }]);
  };

  const sil = (i) => onChange(resimler.filter((_, idx) => idx !== i));

  return (
    <div className="vg-stack">
      <div className="vg-row">
        <Button icon={Upload} onClick={() => fileRef.current?.click()} loading={yukleniyor}>{yukleniyor ? 'Yükleniyor…' : 'Dosyadan ekle'}</Button>
        <Button icon={Link2} onClick={urlEkle}>URL ile ekle</Button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={dosyaEkle} />
        <span className="vg-muted" style={{ fontSize: 12 }}>{resimler.length} resim · ilk resim ana görseldir</span>
        {hata && <span className="vg-error">{hata}</span>}
      </div>

      {resimler.length === 0 && (
        <button type="button" onClick={() => fileRef.current?.click()} className="vg-empty" style={{ border: '1px dashed var(--line-input)', borderRadius: 12, background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
          <div className="vg-empty__icon"><ImageIcon className="vg-icon vg-icon--lg" /></div>
          <div className="vg-empty__title">Henüz resim yok</div>
          <div className="vg-empty__text">Dosya yükleyin ya da URL ekleyin.</div>
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {resimler.map((r, i) => (
          <div key={`upload_resim_${i}`} className="vg-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <img src={r.url || r} alt={r.ad || `Resim ${i+1}`} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block', background: 'var(--surface-sunken)' }}
              onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="130"><rect fill="%23eff1f4" width="150" height="130"/><text x="75" y="65" fill="%238b929d" font-family="sans-serif" font-size="12" text-anchor="middle" dy=".35em">Yüklenemedi</text></svg>' }} />
            <div className="vg-row" style={{ padding: '4px 4px 4px 10px', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <span className="vg-help">{r.kaynak === 'ticimax' ? 'Ticimax' : r.kaynak === 'yuklu' ? 'Yüklendi' : 'URL'}</span>
              <IconButton icon={Trash2} label="Resmi sil" size="sm" variant="critical-plain" onClick={() => sil(i)} />
            </div>
            {i === 0 && <Badge tone="info" dot={false} size="sm" style={{ position: 'absolute', top: 6, left: 6 }}>Ana görsel</Badge>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RenkGruplariEditor({ value = '', onChange }) {
  const [yeniGrup, setYeniGrup] = useState('')
  const seciliGruplar = value
    .split(/[;,]+/)
    .map(item => item.trim())
    .filter(Boolean)

  const guncelle = (items) => {
    const unique = Array.from(new Set(items.map(item => item.trim()).filter(Boolean)))
    onChange(unique.join(', '))
  }

  const toggle = (grup) => {
    if (seciliGruplar.includes(grup)) {
      guncelle(seciliGruplar.filter(item => item !== grup))
    } else {
      guncelle([...seciliGruplar, grup])
    }
  }

  const ekle = () => {
    const grup = yeniGrup.trim()
    if (!grup) return
    guncelle([...seciliGruplar, grup])
    setYeniGrup('')
  }

  return (
    <Field label="Renk grupları" help="Shopify metafield: custom.renk_gruplari">
      <div className="vg-row" style={{ gap: 6 }}>
        {seciliGruplar.length > 0 ? seciliGruplar.map(grup => (
          <button key={grup} type="button" className="vg-chip" aria-pressed="true" onClick={() => toggle(grup)} title="Kaldır">
            {grup}<X className="vg-icon" style={{ width: 12, height: 12 }} />
          </button>
        )) : <span className="vg-help">Henüz seçim yok</span>}
      </div>
      <div className="vg-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        <Input value={yeniGrup} onChange={e => setYeniGrup(e.target.value)} onKeyDown={e => e.key === 'Enter' && ekle()} placeholder="Grup adı ekle" aria-label="Yeni renk grubu" />
        <Button icon={Plus} onClick={ekle}>Ekle</Button>
        {seciliGruplar.length > 0 && <Button variant="plain" onClick={() => onChange('')}>Temizle</Button>}
      </div>
      <div className="vg-row" style={{ gap: 4 }}>
        {['Siyah', 'Beyaz', 'Krem', 'Kahve', 'Lacivert', 'Bordo', 'Gri', 'Bej', 'Yeşil', 'Pembe', 'Sarı', 'Turuncu', 'Mor'].map(grup => (
          <button key={grup} type="button" className="vg-chip" aria-pressed={seciliGruplar.includes(grup)} onClick={() => toggle(grup)} style={{ height: 24, fontSize: 11, padding: '0 10px' }}>
            {grup}
          </button>
        ))}
      </div>
    </Field>
  )
}


function UrunForm({ urun, onKaydet, onIptal, magazalar, markalar=[], kategoriler=[], onMarkaEkle, onMarkaSil, ticimaxUrunler=[] }) {
  const [form, setForm]       = useState(null);
  const [sekme, setSekme]     = useState('temel');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [ticimaxSec, setTicimaxSec] = useState(false); // Ticimax seçim paneli
  const [txArama, setTxArama] = useState('');
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState(null);
  const videoInputRef = useRef(null);
  const [yeniAltKategori, setYeniAltKategori] = useState('');

  useEffect(() => {
    const init = async () => {
      const kod = await sonKoduGetir().catch(() => `V-${Date.now().toString().slice(-5)}`);
      if (!urun) {
        setForm({
          kod, ad: '', marka: '', kategori: 'Çanta', altKategori: '',
          alisF: '', satisF: '', kdv: 20, aciklama: '', kritikStok: 0,
          sku: '', barkod: yeniBarkod(),
          varyantlar: [], resimler: [],
          video: '', renkGruplari: '', renkAdi: '',
          // Ticimax referans (gösterim için)
          _ticimaxId: '', _ticimaxKaynakli: false,
        });
      } else {
        setForm({
          ...urun,
          alisF:      Number(urun.alisF) || 0,
          satisF:     Number(urun.satisF) || 0,
          kritikStok: urun.kritikStok ?? 0,
          resimler:   urun.resimler || [],
          sku:        urun.sku || '',
          barkod:     urun.barkod || urun.varyantlar?.find(v => v.barkod)?.barkod || yeniBarkod(),
          varyantlar: (urun.varyantlar || []).map(v => ({
            ...v, magazaAd: magazalar.find(m => m.id === v.magazaId)?.ad || v.magazaId
          })),
          video: urun.video || '',
          renkGruplari: urun.renkGruplari || '',
          renkAdi: urun.renkAdi || '',
          _ticimaxId: '', _ticimaxKaynakli: false,
        });
      }
    };
    init();
  }, []);

  const uploadVideoFile = async (file) => {
    if (!file) return;
    setVideoUploading(true);
    setVideoUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.hata || res.statusText || 'Yükleme başarısız');
      }
      const data = await res.json();
      g('video', data.url);
    } catch (err) {
      setVideoUploadError(err.message || 'Video yüklenirken hata oluştu');
    } finally {
      setVideoUploading(false);
    }
  };

  if (!form) return <LoadingRows />;

  const g = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const buildShopifyPayload = () => {
    const { _ticimaxId, _ticimaxKaynakli, resimler: formResimler, malzeme: formMalzeme, magazaAd, varyantlar: formVaryantlar, video, renkGruplari, sku, barkod, ...temel } = form
    return {
      ...temel,
      alisF: parseFloat(form.alisF) || 0,
      satisF: parseFloat(form.satisF) || 0,
      kritikStok: Number.isNaN(parseInt(form.kritikStok)) ? 0 : parseInt(form.kritikStok),
      sku: sku?.trim() || form.kod,
      barkod: barkod?.trim() || undefined,
      resimler: (formResimler || []).map(r => (typeof r === 'string' ? r : r.url)).filter(Boolean),
      ...(formMalzeme && { malzeme: formMalzeme }),
      ...(video ? { video: video.trim() } : {}),
      ...(renkGruplari ? { renkGruplari: renkGruplari.trim() } : {}),
      ...(_ticimaxId && { ticimaxId: _ticimaxId }),
      varyantlar: (formVaryantlar || []).map(v => ({
        renk: v.renk || null,
        beden: v.beden || null,
        magazaId: v.magazaId,
        adet: Number(v.adet || 0),
        barkod: v.barkod?.trim() || barkod?.trim() || null
      }))
    }
  }

  const publishToShopify = async () => {
    if (!form?.ad || !form?.satisF) return toast.warning('Ürün adı ve satış fiyatı zorunlu.')
    setPublishing(true)
    try {
      await shopifyYayinla({ urun: buildShopifyPayload(), urunId: form.id })
      toast.success('Ürün Shopify\'da yayınlandı.')
    } catch (err) {
      toast.error('Shopify\'a gönderilemedi: ' + (err.message || err))
    } finally {
      setPublishing(false)
    }
  }

  // Ticimax ürünü seçilince formu doldur
  const ticimaxDoldur = (tx) => {
    const ilkSec = tx.secenekler?.find(s => s.aktif !== '0') || tx.secenekler?.[0] || {};

    // Resimler: Ticimax URL'leri
    const resimler = (tx.resimler || []).map(url => ({ url, kaynak: 'ticimax', ad: url.split('/').pop() }));

    // Varyantları Ticimax seçeneklerinden üret
    const varyantMatris = [];
    let ilkSecenekBarkod = '';
    (tx.secenekler || []).filter(s => s.aktif !== '0').forEach(s => {
      let renk = '', beden = '';
      (s.ekSecenekOzellik || []).forEach(o => {
        const tanim = (o.tanim || '').toLowerCase();
        if (tanim.includes('renk') || tanim.includes('color')) renk = o.deger || o.text || '';
        if (tanim.includes('beden') || tanim.includes('numara') || tanim.includes('size')) beden = o.deger || o.text || '';
      });
      // Fallback: stok kodundan parse
      if (!renk && !beden && s.stokKodu) {
        const parts = s.stokKodu.split('-');
        if (parts.length >= 3) { beden = parts[parts.length - 1]; renk = parts[parts.length - 2]; }
      }

      // Her numara/renk kendi barkodunu alır — Ticimax'ın gönderdiği barkod varsa o
      // kullanılır, yoksa renk+beden'e göre BENZERSİZ bir barkod üretilir (tüm
      // numaralara aynı barkodu vermek yanlış olur, taramada karışıklığa yol açar).
      const secenekBarkod = s.barkod?.trim() || yeniBarkod(tx.urunAdi, tx.marka, renk, beden, parseFloat(s.alisFiyati || ilkSec.alisFiyati) || 0);
      if (!ilkSecenekBarkod) ilkSecenekBarkod = secenekBarkod;

      // Her mağaza için bir satır
      magazalar.forEach(mag => {
        const key = `${renk}__${beden}__${mag.id}`;
        const dup = varyantMatris.find(v => v.renk === renk && v.beden === beden && v.magazaId === mag.id);
        if (!dup) {
          varyantMatris.push({
            renk:      renk || 'Standart',
            beden:     beden || '',
            magazaId:  mag.id,
            magazaAd:  mag.ad,
            adet:      parseInt(s.stokAdedi) || 0,
            barkod:    secenekBarkod,
          });
        }
      });
    });

    // Kategori eşleştir
    const kTree = (tx.kategoriTree || '').toLowerCase();
    let kategori = 'Çanta', altKategori = '';
    if (kTree.includes('ayakkabı') || kTree.includes('bot') || kTree.includes('sneaker')) kategori = 'Ayakkabı';
    else if (kTree.includes('cüzdan') || kTree.includes('cuzdan')) kategori = 'Cüzdan';
    if (kTree.includes('sırt') || kTree.includes('sirt')) altKategori = 'Sırt Çantası';
    else if (kTree.includes('omuz')) altKategori = 'Omuz Çantası';
    else if (kTree.includes('el ç')) altKategori = 'El Çantası';
    else if (kTree.includes('bel')) altKategori = 'Bel Çantası';
    else if (kTree.includes('clutch')) altKategori = 'Clutch';
    else if (kTree.includes('kart cüzdan') || kTree.includes('kart cuzdan')) altKategori = 'Kart Cüzdanı';
    else if (kTree.includes('anahtarlık') || kTree.includes('anahtarlik')) altKategori = 'Anahtarlık';

    setForm(p => ({
      ...p,
      ad:          tx.urunAdi || '',
      marka:       tx.marka || '',
      kategori,
      altKategori,
      aciklama:    tx.aciklama || tx.onYazi || '',
      sku:         ilkSec.stokKodu?.trim() || tx.urunKartiID || '',
      barkod:      ilkSecenekBarkod || yeniBarkod(tx.urunAdi, tx.marka, '', '', parseFloat(ilkSec.alisFiyati) || 0),
      alisF:       parseFloat(ilkSec.indirimliFiyat || ilkSec.alisFiyati) || 0,
      satisF:      Math.ceil((parseFloat(ilkSec.indirimliFiyat || ilkSec.alisFiyati) || 0) * 2 * 1.1),
      resimler,
      varyantlar:  varyantMatris,
      _ticimaxId:  tx.urunKartiID,
      _ticimaxKaynakli: true,
    }));
    setTicimaxSec(false);
    setSekme('temel');
  };

  const kaydet = async () => {
    if (!form.ad || !form.satisF) return toast.warning('Ürün adı ve satış fiyatı zorunlu.');
    setYukleniyor(true);
    try {
      // Schema dışı frontend alanları çıkar, URL'leri düzleştir
      const {
        _ticimaxId, _ticimaxKaynakli,
        resimler: formResimler,
        malzeme: formMalzeme,
        magazaAd,
        varyantlar: formVaryantlar,
        sku: formSku,
        barkod: formBarkod,
        ...temel
      } = form;

      const veri = {
        ...temel,
        alisF:      parseFloat(form.alisF) || 0,
        satisF:     parseFloat(form.satisF) || 0,
        kritikStok: Number.isNaN(parseInt(form.kritikStok)) ? 0 : parseInt(form.kritikStok),
        sku:        formSku?.trim() || form.kod,
        barkod:     formBarkod?.trim() || undefined,
        // resimler: obje dizisini saf URL dizisine çevir
        resimler:   (formResimler || []).map(r => (typeof r === 'string' ? r : r.url)).filter(Boolean),
        // malzeme: schema'da var
        ...(formMalzeme && { malzeme: formMalzeme }),
        ...(form.video?.trim() && { video: form.video.trim() }),
        ...(form.renkGruplari?.trim() && { renkGruplari: form.renkGruplari.trim() }),
        // ticimaxId: schema'da var
        ...(_ticimaxId && { ticimaxId: _ticimaxId }),
        varyantlar: (formVaryantlar || []).map(v => ({
          renk:     v.renk || null,
          beden:    v.beden || null,
          magazaId: v.magazaId,
          adet:     v.adet || 0,
          barkod:   v.barkod?.trim() || formBarkod?.trim() || null,
        })),
      };

      if (urun?.id) await urunGuncelle(urun.id, veri);
      else          await urunEkle(veri);
      toast.success(urun?.id ? 'Ürün güncellendi.' : 'Ürün eklendi.');
      onKaydet();
    } catch (err) {
      toast.error('Kaydedilemedi: ' + err.message);
    } finally {
      setYukleniyor(false);
    }
  };

  const kar = form.alisF && form.satisF
    ? (((form.satisF - form.alisF) / form.satisF) * 100).toFixed(1)
    : null;

  const txFiltreli = ticimaxUrunler.filter(u => {
    if (!txArama) return true;
    const q = txArama.toLowerCase();
    return (u.urunAdi || '').toLowerCase().includes(q) || (u.marka || '').toLowerCase().includes(q);
  });

  return (
    <div className="vg-stack">
      <PageHeader
        breadcrumb={<button type="button" className="vg-link" onClick={onIptal} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft className="vg-icon" style={{ width: 14, height: 14 }} />Ürün listesi</button>}
        title={urun ? (form.ad || 'Ürünü düzenle') : 'Yeni ürün'}
        subtitle={<span className="vg-row" style={{ gap: 8, display: 'inline-flex' }}>
          <span>Kod <span className="vg-code">{form.kod}</span></span>
          {form._ticimaxKaynakli && <Badge tone="info" size="sm">Ticimax #{form._ticimaxId}</Badge>}
        </span>}
        actions={<>
          {!urun && ticimaxUrunler.length > 0 && (
            <Button icon={PackageSearch} active={ticimaxSec} onClick={() => setTicimaxSec(v => !v)}>Ticimax'tan doldur</Button>
          )}
          <Button variant="plain" onClick={onIptal}>Vazgeç</Button>
          <Button icon={Send} onClick={publishToShopify} loading={publishing}>{publishing ? 'Gönderiliyor…' : "Shopify'a gönder"}</Button>
          <Button variant="primary" icon={Save} onClick={kaydet} loading={yukleniyor}>{yukleniyor ? 'Kaydediliyor…' : 'Kaydet'}</Button>
        </>}
      />

      {/* Ticimax seçim paneli */}
      {ticimaxSec && (
        <div className="vg-table-wrap">
          <div className="vg-table-toolbar">
            <SearchInput value={txArama} onChange={e => setTxArama(e.target.value)} placeholder="Ticimax ürünlerinde ara" aria-label="Ticimax ürünlerinde ara" autoFocus style={{ flex: 1 }} />
            <span className="vg-muted" style={{ fontSize: 12 }}>{txFiltreli.length} ürün</span>
          </div>
          <ul className="vg-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {txFiltreli.slice(0, 50).map(tx => {
              const ilkSec = tx.secenekler?.[0] || {};
              return (
                <li key={tx.urunKartiID}>
                  <button type="button" className="vg-list__item vg-list__item--button" onClick={() => ticimaxDoldur(tx)}>
                    {tx.resimler?.[0]
                      ? <img src={tx.resimler[0]} alt="" className="vg-thumb" onError={e => e.target.style.visibility = 'hidden'} />
                      : <span className="vg-thumb" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-subtle)' }}><ShoppingBag className="vg-icon" /></span>}
                    <div className="vg-list__main">
                      <div className="vg-list__primary vg-truncate">{tx.urunAdi}</div>
                      <div className="vg-list__secondary">{tx.marka && `${tx.marka} · `}{tx.secenekler?.filter(s => s.aktif !== '0').length || 0} varyant</div>
                    </div>
                    <div className="vg-list__value">{ilkSec.satisFiyati ? `₺${Number(ilkSec.satisFiyati).toLocaleString('tr-TR')}` : '—'}</div>
                  </button>
                </li>
              );
            })}
          </ul>
          {txFiltreli.length === 0 && <EmptyState compact title="Sonuç bulunamadı" />}
        </div>
      )}

      <Tabs value={sekme} onChange={setSekme} items={[
        { id: 'temel', label: 'Temel bilgiler' },
        { id: 'resimler', label: `Resimler${form.resimler?.length ? ` (${form.resimler.length})` : ''}` },
        { id: 'varyantlar', label: 'Mağaza ve stok' },
        { id: 'barkod', label: 'Barkod ve etiket' },
      ]} />

      {/* TEMEL BİLGİLER */}
      {sekme === 'temel' && (
        <div className="vg-master-detail" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }}>
          <div className="vg-stack">
            <Card title="Ürün" bodyClassName="vg-stack">
              <Field label="Ürün adı" htmlFor="uf-ad">
                <Input id="uf-ad" value={form.ad} onChange={e => g('ad', e.target.value)} placeholder="örn. Deri omuz çantası" />
              </Field>

              <Field label="Marka" htmlFor="uf-marka">
                <div className="vg-row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                  <Select id="uf-marka" value={form.marka || ''} onChange={e => g('marka', e.target.value)}>
                    <option value="">Seçin</option>
                    {markalar.map(m => <option key={m.id} value={m.ad}>{m.ad}</option>)}
                  </Select>
                  <Button icon={Plus} onClick={async () => {
                    const ad = await sor('Marka adı', '', { title: 'Yeni marka', confirmLabel: 'Markayı ekle' });
                    if (ad?.trim()) { await onMarkaEkle(ad.trim()); g('marka', ad.trim()); }
                  }}>Yeni</Button>
                  {form.marka && markalar.find(m => m.ad === form.marka) && (
                    <IconButton icon={Trash2} label={`${form.marka} markasını sil`} variant="critical-plain" onClick={async () => {
                      if (!await onayla(`"${form.marka}" markası silinecek.`, { title: 'Markayı sil', confirmLabel: 'Markayı sil' })) return;
                      const m = markalar.find(x => x.ad === form.marka);
                      if (m) { await onMarkaSil(m.id); g('marka', ''); }
                    }} />
                  )}
                </div>
              </Field>

              <Field label="Açıklama" htmlFor="uf-aciklama">
                <Textarea id="uf-aciklama" value={form.aciklama || ''} onChange={e => g('aciklama', e.target.value)} rows={4} />
              </Field>

              <div className="vg-grid-2">
                <Field label="SKU" htmlFor="uf-sku">
                  <Input id="uf-sku" mono value={form.sku || ''} onChange={e => g('sku', e.target.value)} placeholder="SKU-001" />
                </Field>
                <Field label="Barkod" htmlFor="uf-barkod" help={form.kategori === 'Ayakkabı' ? 'Ayakkabıda her numaranın kendi barkodu vardır.' : 'Mağaza stoklarının barkoduna da yazılır.'}>
                  <Input id="uf-barkod" mono value={form.barkod || ''} placeholder="Ürün barkodu" onChange={e => {
                    const value = e.target.value
                    g('barkod', value)
                    // Ayakkabıda her numaranın kendi ayrı barkodu var — buradan tek bir
                    // değer girilip TÜM numaralara aynı barkodun basılması yanlış olur,
                    // bu yüzden mirror sadece ayakkabı olmayan (tekil stoklu) ürünlerde yapılır.
                    if (form.kategori !== 'Ayakkabı') {
                      g('varyantlar', (form.varyantlar || []).map(v => ({ ...v, barkod: value })))
                    }
                  }} />
                </Field>
              </div>
            </Card>

            <Card title="Shopify alanları" bodyClassName="vg-stack">
              <div className="vg-grid-2">
                <Field label="Renk adı" htmlFor="uf-renk">
                  <Input id="uf-renk" value={form.renkAdi || ''} onChange={e => g('renkAdi', e.target.value)} placeholder="örn. Siyah" />
                </Field>
                <Field label="Malzeme" help="custom.malzeme" htmlFor="uf-malzeme">
                  <Input id="uf-malzeme" value={form.malzeme || ''} onChange={e => g('malzeme', e.target.value)} placeholder="Deri, süet, tekstil" />
                </Field>
              </div>

              <Field label="Video" help="MP4 · custom.video" htmlFor="uf-video" error={videoUploadError}>
                <div className="vg-row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                  <Input id="uf-video" value={form.video || ''} onChange={e => g('video', e.target.value)} placeholder="Video URL'si girin ya da yükleyin" />
                  <Button icon={Upload} onClick={() => videoInputRef.current?.click()} loading={videoUploading}>{videoUploading ? 'Yükleniyor…' : 'Yükle'}</Button>
                </div>
                <input ref={videoInputRef} type="file" accept=".mp4,video/mp4" style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadVideoFile(file);
                  e.target.value = '';
                }} />
              </Field>

              <RenkGruplariEditor value={form.renkGruplari || ''} onChange={v => g('renkGruplari', v)} />
            </Card>
          </div>

          <div className="vg-stack">
            <Card title="Kategori" bodyClassName="vg-stack">
              <Segmented label="Kategori" value={form.kategori} onChange={k => g('kategori', k)} className="vg-segmented--block"
                options={Object.keys(KATEGORILER)} />
              <Field label="Alt kategori">
                <div className="vg-row" style={{ gap: 6 }}>
                  {(KATEGORILER[form.kategori] || []).map(k => (
                    <button key={k} type="button" className="vg-chip" aria-pressed={form.altKategori === k} onClick={() => g('altKategori', k)}>{k}</button>
                  ))}
                  {form.altKategori && !(KATEGORILER[form.kategori] || []).includes(form.altKategori) && (
                    <button type="button" className="vg-chip" aria-pressed="true" onClick={() => g('altKategori', '')} title="Kaldır">{form.altKategori}<X className="vg-icon" style={{ width: 12, height: 12 }} /></button>
                  )}
                </div>
                <div className="vg-row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                  <Input size="sm" value={yeniAltKategori} onChange={e => setYeniAltKategori(e.target.value)} aria-label="Yeni alt kategori"
                    onKeyDown={e => { if (e.key === 'Enter' && yeniAltKategori.trim()) { g('altKategori', yeniAltKategori.trim()); setYeniAltKategori(''); } }}
                    placeholder="Listede yoksa yeni alt kategori" />
                  <Button size="sm" icon={Plus} onClick={() => { if (yeniAltKategori.trim()) { g('altKategori', yeniAltKategori.trim()); setYeniAltKategori(''); } }}>Ekle</Button>
                </div>
              </Field>
            </Card>

            <Card title="Fiyat" bodyClassName="vg-stack">
              <div className="vg-grid-2">
                {[{ l: 'Alış fiyatı', k: 'alisF' }, { l: 'Satış fiyatı', k: 'satisF' }].map(f => (
                  <Field key={f.k} label={f.l} htmlFor={`uf-${f.k}`}>
                    <div className="vg-input-group">
                      <Input id={`uf-${f.k}`} type="number" className="vg-num" value={form[f.k]} onChange={e => g(f.k, e.target.value)} style={{ paddingRight: 26, fontWeight: 600 }} />
                      <span className="vg-input-suffix">₺</span>
                    </div>
                  </Field>
                ))}
              </div>

              {kar && (
                <Progress name="Kâr marjı" pct={Number(kar)} state={kar > 40 ? 'done' : kar > 25 ? undefined : 'behind'} />
              )}

              <Field label="KDV">
                <Segmented label="KDV" value={form.kdv} onChange={k => g('kdv', k)} className="vg-segmented--block" options={[0, 10, 20].map(k => ({ value: k, label: `%${k}` }))} />
              </Field>

              <Field label="Kritik stok" help="Toplam stok bu sayının altına düşünce uyarı verilir." htmlFor="uf-kritik">
                <Input id="uf-kritik" type="number" min={0} className="vg-num" value={form.kritikStok} onChange={e => g('kritikStok', e.target.value)} />
              </Field>
            </Card>
          </div>
        </div>
      )}

      {/* RESİMLER */}
      {sekme === 'resimler' && (
        <Card><ResimYonetimi resimler={form.resimler || []} onChange={r => g('resimler', r)} /></Card>
      )}

      {sekme === 'varyantlar' && (
        <Card>
          <VaryantEditor
            kategori={form.kategori}
            varyantlar={form.varyantlar || []}
            onChange={v => g('varyantlar', v)}
            magazalar={magazalar}
            urunBilgi={form}
          />
        </Card>
      )}
      {sekme === 'barkod' && <Card><BarkodEtiketSayfasi urun={form} magazalar={magazalar} /></Card>}
    </div>
  );
}


// ─── TİCİMAX IMPORT MODAL ─────────────────────────────────────
// Ticimax XML'den ürün çekip yerel DB'ye import eden component
// Barkodlar: sistemin kendi yeniBarkod() fonksiyonu ile üretilir
// Ticimax'tan alınanlar: ad, marka, kategori, fiyat, aciklama

const TICIMAX_API = `${import.meta.env.VITE_API_URL}/ticimax-urunler`;

// Ticimax kategori adını yerel kategori sistemine eşle
const kategoriEsle = (kategoriTree = '') => {
  const k = kategoriTree.toLowerCase();
  if (k.includes('ayakkabı') || k.includes('bot') || k.includes('sneaker') || k.includes('sandalet')) {
    return { kategori: 'Ayakkabı', altKategori: '' };
  }
  if (k.includes('cüzdan') || k.includes('cuzdan')) {
    if (k.includes('kart'))       return { kategori: 'Cüzdan', altKategori: 'Kart Cüzdanı' };
    if (k.includes('bozuk para') || k.includes('bozukpara')) return { kategori: 'Cüzdan', altKategori: 'Bozuk Para Cüzdanı' };
    if (k.includes('kadın') || k.includes('kadin')) return { kategori: 'Cüzdan', altKategori: 'Kadın Cüzdan' };
    if (k.includes('erkek'))     return { kategori: 'Cüzdan', altKategori: 'Erkek Cüzdan' };
    return { kategori: 'Cüzdan', altKategori: '' };
  }
  if (k.includes('anahtarlık') || k.includes('anahtarlik')) return { kategori: 'Cüzdan', altKategori: 'Anahtarlık' };
  if (k.includes('sırt') || k.includes('sirt')) return { kategori: 'Çanta', altKategori: 'Sırt Çantası' };
  if (k.includes('omuz'))   return { kategori: 'Çanta', altKategori: 'Omuz Çantası' };
  if (k.includes('el ç'))   return { kategori: 'Çanta', altKategori: 'El Çantası' };
  if (k.includes('bel'))    return { kategori: 'Çanta', altKategori: 'Bel Çantası' };
  if (k.includes('clutch')) return { kategori: 'Çanta', altKategori: 'Clutch' };
  if (k.includes('seyahat'))return { kategori: 'Çanta', altKategori: 'Seyahat' };
  return { kategori: 'Çanta', altKategori: '' };
};

// Ticimax seçenek özelliklerinden renk/beden çıkar
const secenektenRenkBeden = (secenek) => {
  let renk = '', beden = '';
  (secenek.ekSecenekOzellik || []).forEach(o => {
    const tanim = (o.tanim || '').toLowerCase();
    const deger = o.deger || o.text || '';
    if (tanim.includes('renk') || tanim.includes('color')) renk = deger;
    if (tanim.includes('beden') || tanim.includes('numara') || tanim.includes('ebat') || tanim.includes('size')) beden = deger;
  });
  // Fallback: stok kodundan çıkar (örn: "URUNKODU-SIYAH-38")
  if (!renk && !beden && secenek.stokKodu) {
    const parts = secenek.stokKodu.split('-');
    if (parts.length >= 3) {
      beden = parts[parts.length - 1];
      renk  = parts[parts.length - 2];
    }
  }
  return { renk, beden };
};

function TicimaxImportModal({ onKapat, onImportTamamlandi, magazalar, markalar, setMarkalar }) {
  const [adim, setAdim]               = useState('yukleniyor'); // yukleniyor | secim | stokGiris | importing | tamamlandi
  const [ticimaxUrunler, setTicimaxUrunler] = useState([]);
  const [secilenler, setSecilenler]   = useState(new Set());
  const [hata, setHata]               = useState(null);
  const [ilerleme, setIlerleme]       = useState({ tamamlanan: 0, toplam: 0, hatalar: [] });
  const [aramaQ, setAramaQ]           = useState('');
  const [seciliMagazaId, setSeciliMagazaId] = useState(magazalar[0]?.id || '');
  // stokGiris adımı için: { 'urunKartiID__renk__beden': adet }
  const [stokAdetleri, setStokAdetleri] = useState({});

  // Ticimax'tan ürünleri çek
  useEffect(() => {
    const cek = async () => {
      try {
        const res = await fetch(TICIMAX_API);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const xml = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const nodes = Array.from(doc.querySelectorAll('Root > Urunler > Urun'));
        const parsed = nodes.map(u => ({
          urunKartiID:  u.querySelector('UrunKartiID')?.textContent ?? '',
          urunAdi:      u.querySelector('UrunAdi')?.textContent ?? '',
          marka:        u.querySelector('Marka')?.textContent ?? '',
          kategoriTree: u.querySelector('KategoriTree')?.textContent ?? '',
          aciklama:     u.querySelector('Aciklama')?.textContent ?? '',
          onYazi:       u.querySelector('OnYazi')?.textContent ?? '',
          aktif:        u.querySelector('Aktif')?.textContent ?? '',
          resimler:     Array.from(u.querySelectorAll('Resimler > Resim')).map(r => r.textContent ?? ''),
          secenekler:   Array.from(u.querySelectorAll('UrunSecenek > Secenek')).map(s => ({
            stokKodu:     s.querySelector('StokKodu')?.textContent ?? '',
            barkod:       s.querySelector('Barkod')?.textContent ?? '',
            stokAdedi:    parseInt(s.querySelector('StokAdedi')?.textContent ?? '0') || 0,
            alisFiyati:   parseFloat(s.querySelector('AlisFiyati')?.textContent ?? '0') || 0,
            satisFiyati:  parseFloat(s.querySelector('SatisFiyati')?.textContent ?? '0') || 0,
            indirimliFiyat: parseFloat(s.querySelector('IndirimliFiyat')?.textContent ?? '0') || 0,
            aktif:        s.querySelector('Aktif')?.textContent ?? '',
            ekSecenekOzellik: Array.from(s.querySelectorAll('EkSecenekOzellik > Ozellik')).map(o => ({
              tanim: o.getAttribute('Tanim') ?? '',
              deger: o.getAttribute('Deger') ?? '',
              text:  o.textContent ?? ''
            }))
          }))
        }));
        setTicimaxUrunler(parsed);
        setAdim('secim');
      } catch (e) {
        setHata(e.message);
        setAdim('hata');
      }
    };
    cek();
  }, []);

  const tumunuSec = () => {
    const gorunenler = filtreliUrunler.map(u => u.urunKartiID);
    const hepsiSecili = gorunenler.every(id => secilenler.has(id));
    if (hepsiSecili) {
      setSecilenler(prev => { const next = new Set(prev); gorunenler.forEach(id => next.delete(id)); return next; });
    } else {
      setSecilenler(prev => { const next = new Set(prev); gorunenler.forEach(id => next.add(id)); return next; });
    }
  };

  const toggle = (id) => {
    setSecilenler(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtreliUrunler = ticimaxUrunler.filter(u => {
    if (!aramaQ) return true;
    const q = aramaQ.toLowerCase();
    return u.urunAdi.toLowerCase().includes(q) || u.marka.toLowerCase().includes(q) || u.urunKartiID.includes(q);
  });

  // Seçilen Ticimax ürünlerini yerel DB formatına dönüştür ve kaydet
  // Seçim tamamlandı → stok giriş adımına geç
  const stokGirisineGec = () => {
    const seciliUrunler = ticimaxUrunler.filter(u => secilenler.has(u.urunKartiID));
    if (!seciliUrunler.length) return toast.warning('En az bir ürün seçin.');
    if (!seciliMagazaId) return toast.warning('Bir mağaza seçin.');
    // Varsayılan adetleri 0 olarak başlat
    const varsayilan = {};
    seciliUrunler.forEach(u => {
      u.secenekler.filter(s => s.aktif !== '0').forEach(s => {
        const { renk, beden } = secenektenRenkBeden(s);
        const key = `${u.urunKartiID}__${renk||'Standart'}__${beden||''}`;
        varsayilan[key] = 0; // kullanıcı girecek
      });
    });
    setStokAdetleri(varsayilan);
    setAdim('stokGiris');
  };

  const importBaslat = async () => {
    const seciliUrunler = ticimaxUrunler.filter(u => secilenler.has(u.urunKartiID));
    if (!seciliUrunler.length) return;
    if (!seciliMagazaId) { toast.warning('Bir mağaza seçin.'); return; }

    setAdim('importing');
    setIlerleme({ tamamlanan: 0, toplam: seciliUrunler.length, hatalar: [] });

    for (let i = 0; i < seciliUrunler.length; i++) {
      const tu = seciliUrunler[i];
      try {
        const { kategori, altKategori } = kategoriEsle(tu.kategoriTree);

        // Marka yoksa ekle
        let markaAdi = tu.marka || '';
        if (markaAdi && !markalar.find(m => m.ad === markaAdi)) {
          try {
            const yeniMarka = await markaEkle({ ad: markaAdi });
            setMarkalar(prev => [...prev, yeniMarka]);
          } catch { /* marka zaten var olabilir */ }
        }

        // İlk seçeneğin fiyatını al
        const ilkSec = tu.secenekler.find(s => s.aktif !== '0') || tu.secenekler[0] || {};

        // Varyantları dönüştür — her numara/renk kendi barkodunu alır (Ticimax'ın
        // gönderdiği barkod varsa o kullanılır, yoksa renk+beden'e göre benzersiz
        // üretilir). Tüm numaralara aynı barkodu vermek taramada karışıklığa yol açar.
        let urunBarkod = '';
        const varyantlar = tu.secenekler
          .filter(s => s.aktif !== '0')
          .map(s => {
            const { renk, beden } = secenektenRenkBeden(s);
            const stokKey = `${tu.urunKartiID}__${renk||'Standart'}__${beden||''}`;
            const girilecekAdet = stokAdetleri[stokKey] ?? 0;
            const secenekBarkod = s.barkod?.trim() || yeniBarkod(tu.urunAdi, markaAdi, renk, beden, parseFloat(s.alisFiyati || ilkSec.alisFiyati) || 0);
            if (!urunBarkod) urunBarkod = secenekBarkod;
            return {
              renk:      renk || 'Standart',
              beden:     beden || '',
              magazaId:  seciliMagazaId,
              adet:      girilecekAdet, // kullanıcının girdiği mağaza stoğu
              barkod:    secenekBarkod,
            };
          });

        // Duplikat varyant temizle (aynı renk+beden+mağaza)
        const tekVaryantlar = [];
        const goruldu = new Set();
        varyantlar.forEach(v => {
          const key = `${v.renk}__${v.beden}__${v.magazaId}`;
          if (!goruldu.has(key)) { goruldu.add(key); tekVaryantlar.push(v); }
        });

        // Yerel DB'ye kaydet — kod backend'de üretilir
        const veri = {
          ad:         tu.urunAdi,
          marka:      markaAdi,
          kategori,
          altKategori,
          aciklama:   tu.aciklama || tu.onYazi || '',
          sku:        ilkSec.stokKodu?.trim() || tu.urunKartiID || '',
          barkod:     urunBarkod,
          alisF:      parseFloat(ilkSec.indirimliFiyat || ilkSec.alisFiyati) || 0,
          satisF:     Math.ceil((parseFloat(ilkSec.indirimliFiyat || ilkSec.alisFiyati) || 0) * 2 * 1.1),
          kdv:        20,
          kritikStok: 0,
          varyantlar: tekVaryantlar,
          ticimaxId:  tu.urunKartiID,
        };
        await urunEkle(veri);

        setIlerleme(prev => ({ ...prev, tamamlanan: prev.tamamlanan + 1 }));
      } catch (e) {
        setIlerleme(prev => ({
          ...prev,
          tamamlanan: prev.tamamlanan + 1,
          hatalar: [...prev.hatalar, { ad: tu.urunAdi, hata: e.message }]
        }));
      }
    }
    setAdim('tamamlandi');
  };

  const altBaslik = {
    yukleniyor: 'Ticimax bağlantısı kuruluyor',
    secim: `${ticimaxUrunler.length} ürün bulundu · ${secilenler.size} seçildi`,
    stokGiris: `${secilenler.size} ürün için mağaza stok girişi`,
    importing: `İçe aktarılıyor · ${ilerleme.tamamlanan}/${ilerleme.toplam}`,
    tamamlandi: 'İşlem tamamlandı',
    hata: 'Bağlantı kurulamadı',
  }[adim];

  const altBar = adim === 'secim' ? (<>
    <span className="vg-muted" style={{ marginRight: 'auto', fontSize: 13 }}>
      <strong style={{ color: 'var(--ink)' }}>{secilenler.size}</strong> ürün seçildi
      {seciliMagazaId && <> · {magazalar.find(m => m.id === seciliMagazaId)?.ad} mağazasına</>}
    </span>
    <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
    <Button variant="primary" iconRight={ArrowRight} onClick={stokGirisineGec} disabled={secilenler.size === 0 || !seciliMagazaId}>
      {secilenler.size > 0 ? 'Stok girişine geç' : 'Ürün seçin'}
    </Button>
  </>) : adim === 'stokGiris' ? (<>
    <Button variant="plain" icon={ArrowLeft} onClick={() => setAdim('secim')} style={{ marginRight: 'auto' }}>Geri</Button>
    <Button variant="primary" icon={Download} onClick={importBaslat}>Aktarımı başlat</Button>
  </>) : adim === 'tamamlandi' ? (
    <Button variant="primary" icon={Check} onClick={() => { onImportTamamlandi(); onKapat(); }}>Tamam, listeyi yenile</Button>
  ) : adim === 'hata' ? <Button onClick={onKapat}>Kapat</Button> : null;

  return (
    <Modal title="Ticimax'tan ürün içe aktar" subtitle={altBaslik} onClose={adim === 'importing' ? undefined : onKapat} size="lg" footer={altBar}
      bodyStyle={adim === 'secim' || adim === 'stokGiris' ? { padding: 0, gap: 0 } : undefined}>
      {adim === 'yukleniyor' && <LoadingRows card={false} rows={6} />}

      {adim === 'hata' && (
        <EmptyState icon={TriangleAlert} title="Ticimax bağlantısı kurulamadı"
          text={<>Backend'in <span className="vg-code">/api/ticimax-urunler</span> adresinin çalıştığını kontrol edin.<br /><span className="vg-code vg-text-critical">{hata}</span></>} />
      )}

      {adim === 'secim' && (
        <>
          <div className="vg-table-toolbar">
            <SearchInput placeholder="Ürün adı, marka, ID" aria-label="Ticimax ürünlerinde ara" value={aramaQ} onChange={e => setAramaQ(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <Select size="sm" value={seciliMagazaId} onChange={e => setSeciliMagazaId(e.target.value)} aria-label="Hedef mağaza" style={{ width: 'auto' }}>
              {magazalar.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
            </Select>
            <Button size="sm" onClick={tumunuSec}>{filtreliUrunler.every(u => secilenler.has(u.urunKartiID)) ? 'Tümünü kaldır' : 'Tümünü seç'}</Button>
          </div>
          <ul className="vg-list">
            {filtreliUrunler.length === 0 && <EmptyState compact title="Sonuç bulunamadı" />}
            {filtreliUrunler.map(u => {
              const secili = secilenler.has(u.urunKartiID);
              const ilkSec = u.secenekler[0] || {};
              const { kategori } = kategoriEsle(u.kategoriTree);
              const aktifSecSayisi = u.secenekler.filter(s => s.aktif !== '0').length;
              return (
                <li key={u.urunKartiID}>
                  <label className="vg-list__item vg-list__item--button" style={{ background: secili ? 'var(--accent-soft)' : undefined }}>
                    <span className="vg-check"><input type="checkbox" checked={secili} onChange={() => toggle(u.urunKartiID)} /></span>
                    {u.resimler[0]
                      ? <img src={u.resimler[0]} alt="" className="vg-thumb" onError={e => e.target.style.visibility = 'hidden'} />
                      : <span className="vg-thumb" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-subtle)' }}><ShoppingBag className="vg-icon" /></span>}
                    <div className="vg-list__main">
                      <div className="vg-list__primary vg-truncate">{u.urunAdi}</div>
                      <div className="vg-list__secondary">{[u.marka, kategori, `${aktifSecSayisi} varyant`].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="vg-list__value">{ilkSec.satisFiyati ? `₺${Number(ilkSec.satisFiyati).toLocaleString('tr-TR')}` : '—'}</div>
                      <div className="vg-list__secondary">Alış {ilkSec.alisFiyati ? `₺${Number(ilkSec.alisFiyati).toLocaleString('tr-TR')}` : '—'}</div>
                    </div>
                    <Badge tone={u.aktif === '1' ? 'success' : 'neutral'} size="sm">{u.aktif === '1' ? 'Aktif' : 'Pasif'}</Badge>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {adim === 'stokGiris' && (
        <div className="vg-stack" style={{ padding: 16 }}>
          <Banner>Mağazaya kaç adet alınacağını girin. Tedarikçi stoğu yalnızca referanstır.</Banner>
          {ticimaxUrunler.filter(u => secilenler.has(u.urunKartiID)).map(u => (
            <div key={u.urunKartiID} className="vg-card" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              <div className="vg-row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap' }}>
                {u.resimler?.[0] && <img src={u.resimler[0]} alt="" className="vg-thumb" onError={e => e.target.style.visibility = 'hidden'} />}
                <div><div style={{ fontWeight: 600 }}>{u.urunAdi}</div><div className="vg-list__secondary">{u.marka}</div></div>
              </div>
              <ul className="vg-list">
                {u.secenekler.filter(s => s.aktif !== '0').map((s, si) => {
                  const { renk, beden } = secenektenRenkBeden(s);
                  const stokKey = `${u.urunKartiID}__${renk||'Standart'}__${beden||''}`;
                  const tedarikciStok = parseInt(s.stokAdedi) || 0;
                  const mevcutAdet = stokAdetleri[stokKey] ?? 0;
                  return (
                    <li key={`stokgiris_${stokKey}_${si}`} className="vg-list__item" style={{ flexWrap: 'wrap' }}>
                      <div className="vg-row" style={{ gap: 4, flex: 1 }}>
                        {renk && <Badge dot={false}>{renk}</Badge>}
                        {beden && <Badge dot={false}>{beden}</Badge>}
                      </div>
                      <span className="vg-muted" style={{ fontSize: 12 }}>Tedarikçi <strong className="vg-num" style={{ color: 'var(--ink)' }}>{tedarikciStok}</strong></span>
                      <div className="vg-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        <span className="vg-muted" style={{ fontSize: 12 }}>Mağazaya</span>
                        <IconButton icon={Minus} label="Azalt" variant="secondary" size="sm" onClick={() => setStokAdetleri(p => ({ ...p, [stokKey]: Math.max(0, (p[stokKey]??0) - 1) }))} />
                        <Input size="sm" type="number" min={0} max={tedarikciStok} value={mevcutAdet} className="vg-num" aria-label="Mağazaya alınacak adet"
                          onChange={e => setStokAdetleri(p => ({ ...p, [stokKey]: Math.max(0, parseInt(e.target.value)||0) }))} style={{ width: 60, textAlign: 'center', fontWeight: 600 }} />
                        <IconButton icon={Plus} label="Arttır" variant="secondary" size="sm" onClick={() => setStokAdetleri(p => ({ ...p, [stokKey]: Math.min(tedarikciStok, (p[stokKey]??0) + 1) }))} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {adim === 'importing' && (
        <div className="vg-stack" style={{ padding: '24px 8px', alignItems: 'stretch' }}>
          <Progress name={`${ilerleme.tamamlanan} / ${ilerleme.toplam} ürün aktarıldı`} pct={(ilerleme.tamamlanan / (ilerleme.toplam || 1)) * 100} />
          <div className="vg-help">Barkodlar sistem tarafından üretiliyor.</div>
        </div>
      )}

      {adim === 'tamamlandi' && (
        <div className="vg-stack">
          <EmptyState compact tone="success" icon={CircleCheck} title={`${ilerleme.tamamlanan - ilerleme.hatalar.length} ürün aktarıldı`} />
          {ilerleme.hatalar.length > 0 && (
            <Banner tone="critical" title={`${ilerleme.hatalar.length} ürün aktarılamadı.`}>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, maxHeight: 140, overflowY: 'auto' }}>
                {ilerleme.hatalar.map((h, i) => <li key={i}>{h.ad}: <span className="vg-code">{h.hata}</span></li>)}
              </ul>
            </Banner>
          )}
        </div>
      )}
    </Modal>
  );
}



// ─── ÜRÜN LİSTESİ ─────────────────────────────────────────────
const URUN_SAYFA_BOYUTU = 30;

function UrunListesi({
  magazalar, markalar=[], onDuzenle, onSil, rol, aktifMagazaId, ticimaxUrunler=[], q, setQ,
  marka, setMarka, kat, setKat, stokDurum, setStokDurum, fiyatMin, setFiyatMin, fiyatMax, setFiyatMax,
  sayfa, setSayfa
}) {
  const [aciklar, setAciklar] = useState({});
  const [detaySekme, setDetaySekme] = useState({}); // urun.id -> 'magaza'|'tedarik'|'resimler'
  const maliyetGorebilir = !rol || rol === "admin";

  // Sunucudan gelen, zaten filtrelenmiş+sayfalanmış ürünler
  const [sayfaliUrunler, setSayfaliUrunler] = useState([]);
  const [toplamUrun, setToplamUrun] = useState(0);
  const [toplamSayfa, setToplamSayfa] = useState(1);
  const [yukleniyor, setYukleniyor] = useState(true);
  // Filtreye uyan TÜM ürünlerin mağaza bazlı stok toplamı: { [magazaId]: adet }
  const [magazaStoklari, setMagazaStoklari] = useState({});

  // Metin/fiyat girişlerinde her tuş vuruşunda istek atmamak için debounce
  const [qDeb, setQDeb] = useState(q);
  const [fiyatMinDeb, setFiyatMinDeb] = useState(fiyatMin);
  const [fiyatMaxDeb, setFiyatMaxDeb] = useState(fiyatMax);
  useEffect(() => {
    const zamanlayici = setTimeout(() => {
      setQDeb(q); setFiyatMinDeb(fiyatMin); setFiyatMaxDeb(fiyatMax);
    }, 350);
    return () => clearTimeout(zamanlayici);
  }, [q, fiyatMin, fiyatMax]);

  const fetchSayfa = () => {
    setYukleniyor(true);
    urunleriGetir({
      ...(qDeb && { q: qDeb }),
      ...(marka && { marka }),
      ...(kat !== "Tümü" && { kategori: kat }),
      ...(stokDurum !== "hepsi" && { stokDurum }),
      ...(fiyatMinDeb && { fiyatMin: fiyatMinDeb }),
      ...(fiyatMaxDeb && { fiyatMax: fiyatMaxDeb }),
      ...(aktifMagazaId && { magazaId: aktifMagazaId }),
      page: sayfa, limit: URUN_SAYFA_BOYUTU
    }).then(res => {
      setSayfaliUrunler(res.items || []);
      setToplamUrun(res.total || 0);
      setToplamSayfa(res.totalPages || 1);
      setMagazaStoklari(res.magazaStoklari || {});
    }).catch(console.error).finally(() => setYukleniyor(false));
  };

  useEffect(fetchSayfa, [qDeb, marka, kat, stokDurum, fiyatMinDeb, fiyatMaxDeb, aktifMagazaId, sayfa]);

  // Filtre değişince 1. sayfaya dön
  const filtreDegisti = (setter) => (deger) => { setter(deger); setSayfa(1); };

  const handleSil = async (id) => { await onSil(id); fetchSayfa(); };

  // Ürün adına göre Ticimax'tan eşleşen ürünü bul
  const ticimaxEsles = (u) => {
    if (!ticimaxUrunler.length) return null;
    // Önce tam ad eşleşmesi
    let esles = ticimaxUrunler.find(t =>
      t.urunAdi?.toLowerCase().trim() === (u.ad || '').toLowerCase().trim()
    );
    // Yoksa marka+kısmi ad
    if (!esles && u.marka) {
      esles = ticimaxUrunler.find(t =>
        t.marka?.toLowerCase() === u.marka?.toLowerCase() &&
        (t.urunAdi?.toLowerCase().includes((u.ad || '').toLowerCase().slice(0, 8)))
      );
    }
    return esles || null;
  };

  // Ticimax toplam tedarikçi stoğu
  const tedarikStok = (tx) => {
    if (!tx) return null;
    return tx.secenekler.reduce((s, sec) => s + (parseInt(sec.stokAdedi) || 0), 0);
  };

  const stokTopla = (u, magId) => {
    const v = magId ? (u.varyantlar||[]).filter(v=>v.magazaId===magId) : (u.varyantlar||[]);
    return v.reduce((t,v)=>t+v.adet,0);
  };

  const stokTon = n => n<=0?"critical":n<=3?"warning":"success";
  const filtreVar = marka||kat!=="Tümü"||stokDurum!=="hepsi"||fiyatMin||fiyatMax||q;
  const sutunSayisi = maliyetGorebilir ? 10 : 8;

  const gorunenMagazalar = magazalar.filter(m => !aktifMagazaId || m.id === aktifMagazaId);
  const genelToplam = gorunenMagazalar.reduce((s,m)=>s+(magazaStoklari[m.id]||0),0);

  return (
    <div className="vg-stack">
      {/* Mağaza bazlı stok özeti — uygulanan filtreye uyan TÜM ürünlerin toplamı */}
      {gorunenMagazalar.length > 0 && (
        <div className="vg-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {gorunenMagazalar.map(m=>{
            const adet = magazaStoklari[m.id] || 0;
            return (
              <div key={m.id} className="vg-card" style={{ padding: '10px 14px' }}>
                <div className="vg-row vg-muted" style={{ gap: 6, fontSize: 12, flexWrap: 'nowrap' }}><MagazaIkon ikon={m.ikon} style={{ width: 14, height: 14 }} /><span className="vg-truncate">{m.ad}</span></div>
                <div className="vg-row" style={{ gap: 6, marginTop: 2 }}>
                  <span className="vg-num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{adet}</span>
                  <span className="vg-help">adet</span>
                  {adet <= 0 && <Badge tone="critical" size="sm">Boş</Badge>}
                </div>
              </div>
            );
          })}
          {gorunenMagazalar.length > 1 && (
            <div className="vg-card" style={{ padding: '10px 14px', background: 'var(--accent-soft)', boxShadow: 'none' }}>
              <div className="vg-muted" style={{ fontSize: 12 }}>Toplam</div>
              <div className="vg-row" style={{ gap: 6, marginTop: 2 }}>
                <span className="vg-num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{genelToplam}</span>
                <span className="vg-help">adet</span>
              </div>
            </div>
          )}
        </div>
      )}

      {aktifMagazaId && (
        <Banner icon={MapPin}>{magazalar.find(m=>m.id===aktifMagazaId)?.ad||"Seçili mağaza"} stoğu gösteriliyor.</Banner>
      )}

      <div className="vg-table-wrap">
        <div className="vg-table-toolbar">
          <SearchInput value={q} onChange={e=>{setQ(e.target.value);setSayfa(1);}} placeholder="Ad, kod, barkod, marka" aria-label="Ürün ara" style={{ flex: 1, minWidth: 200, maxWidth: 340 }} />
          <Segmented label="Kategori" value={kat} onChange={k=>filtreDegisti(setKat)(k)} options={["Tümü","Çanta","Ayakkabı","Cüzdan"]} />
          <Select size="sm" value={marka} onChange={e=>filtreDegisti(setMarka)(e.target.value)} aria-label="Marka" style={{ width: 'auto', minWidth: 140 }}>
            <option value="">Tüm markalar</option>
            {markalar.map(m=><option key={m.id||m.ad} value={m.ad}>{m.ad}</option>)}
          </Select>
          <Select size="sm" value={stokDurum} onChange={e=>filtreDegisti(setStokDurum)(e.target.value)} aria-label="Stok durumu" style={{ width: 'auto' }}>
            <option value="hepsi">Tüm stoklar</option>
            <option value="stokta">Stokta var</option>
            <option value="kritik">Kritik stok</option>
            <option value="tukendi">Tükendi</option>
          </Select>
          <div className="vg-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
            <Input size="sm" value={fiyatMin} onChange={e=>setFiyatMin(e.target.value)} placeholder="Min ₺" type="number" aria-label="En düşük fiyat" style={{ width: 84 }} />
            <span className="vg-muted">–</span>
            <Input size="sm" value={fiyatMax} onChange={e=>setFiyatMax(e.target.value)} placeholder="Max ₺" type="number" aria-label="En yüksek fiyat" style={{ width: 84 }} />
          </div>
          {filtreVar && (
            <Button size="sm" variant="plain" icon={X} onClick={()=>{setQ("");setMarka("");setKat("Tümü");setStokDurum("hepsi");setFiyatMin("");setFiyatMax("");setSayfa(1);}}>Filtreleri temizle</Button>
          )}
          {yukleniyor && <Loader2 className="vg-icon vg-spin" style={{ color: 'var(--ink-muted)' }} />}
        </div>

        <div className="vg-table-scroll">
          <table className="vg-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }} />
                <th>Ürün</th><th>Kod</th><th>Kategori</th><th className="is-num">Mağaza stok</th><th className="is-num">Tedarikçi</th>
                <th className="is-num">Satış</th>
                {maliyetGorebilir && <><th className="is-num">Alış</th><th className="is-num">Kâr</th></>}
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {sayfaliUrunler.map(u=>{
                const toplam = stokTopla(u, aktifMagazaId);
                const kritik = toplam<=(u.kritikStok??0);
                const kar = maliyetGorebilir&&u.alisF&&u.satisF?(((u.satisF-u.alisF)/u.satisF)*100).toFixed(1):null;
                const acik = aciklar[u.id];
                const tx = ticimaxEsles(u);
                const ts = tedarikStok(tx);
                const imgUrl = (u.resimler&&u.resimler[0]) || tx?.resimler?.[0];

                return [
                  <tr key={u.id} className="is-clickable" aria-selected={!!acik} onClick={()=>setAciklar(p=>({...p,[u.id]:!p[u.id]}))}>
                    <td><IconButton icon={acik ? ChevronUp : ChevronDown} label={acik ? 'Detayı kapat' : 'Detayı aç'} size="sm" onClick={e=>{e.stopPropagation();setAciklar(p=>({...p,[u.id]:!p[u.id]}))}} /></td>
                    <td>
                      <div className="vg-row" style={{ flexWrap: 'nowrap', gap: 10 }}>
                        {imgUrl
                          ? <img src={imgUrl} alt="" className="vg-thumb" onError={e=>e.target.style.visibility="hidden"}/>
                          : <span className="vg-thumb" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-subtle)' }}><ShoppingBag className="vg-icon" /></span>}
                        <div style={{ minWidth: 0 }}>
                          <div className="is-strong vg-truncate" style={{ maxWidth: 280 }}>{u.ad}</div>
                          <div className="vg-list__secondary">{u.marka}</div>
                        </div>
                      </div>
                    </td>
                    <td className="vg-code vg-muted">{u.kod}</td>
                    <td><Badge dot={false}>{u.kategori}</Badge></td>
                    <td className="is-num">
                      <div className="vg-row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        {kritik && <Badge tone={stokTon(toplam)} size="sm">{toplam<=0?'Tükendi':'Kritik'}</Badge>}
                        <span className="is-strong">{toplam}</span>
                      </div>
                    </td>
                    <td className="is-num">{ts!=null?<span className={ts>10?'':ts>0?'vg-text-warning':'vg-muted'}>{ts}</span>:<span className="vg-muted">—</span>}</td>
                    <td className="is-num is-strong">{para(u.satisF)}</td>
                    {maliyetGorebilir&&<td className="is-num vg-muted">{para(u.alisF)}</td>}
                    {maliyetGorebilir&&<td className="is-num">{kar&&<span className={kar>40?'vg-text-success':kar>25?'vg-text-warning':'vg-text-critical'} style={{ fontWeight: 600 }}>%{kar}</span>}</td>}
                    <td onClick={e=>e.stopPropagation()}>
                      <Menu trigger={({ toggle }) => <IconButton icon={MoreHorizontal} label="İşlemler" size="sm" onClick={toggle} />}
                        items={[
                          { text: 'Düzenle', icon: Pencil, onClick: () => onDuzenle(u) },
                          '-',
                          { text: 'Sil', icon: Trash2, tone: 'critical', onClick: () => handleSil(u.id) },
                        ]} />
                    </td>
                  </tr>,

                  acik && (
                    <tr key={`${u.id}_d`}>
                      <td colSpan={sutunSayisi} style={{ padding: 0, background: 'var(--surface-sunken)' }}>
                        {(()=>{
                          const sek = detaySekme[u.id] || 'magaza';
                          const setSek = (s) => setDetaySekme(p=>({...p,[u.id]:s}));
                          return (
                            <div className="vg-stack" style={{ padding: '4px 20px 20px 56px', gap: 14 }}>
                              <div className="vg-row" style={{ justifyContent: 'space-between' }}>
                                <Tabs value={sek} onChange={setSek} items={[
                                  {id:"magaza",   label:"Mağaza stokları"},
                                  tx && {id:"tedarik",  label:"Tedarikçi stoğu"},
                                  {id:"resimler", label:"Resimler"},
                                  {id:"detay",    label:"Ürün bilgisi"},
                                ]} />
                                {tx && <span className="vg-help">Ticimax ID <span className="vg-code">{tx.urunKartiID}</span></span>}
                              </div>

                              {/* MAĞAZA STOKLARI */}
                              {sek==="magaza"&&(
                                <div className="vg-stack" style={{ gap: 10 }}>
                                  <div className="vg-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                                    {magazalar.map(m=>{
                                      const adet=(u.varyantlar||[]).filter(v=>v.magazaId===m.id).reduce((t,v)=>t+v.adet,0);
                                      return (
                                        <Tile key={m.id} label={<span className="vg-row" style={{ gap: 6 }}><MagazaIkon ikon={m.ikon} style={{ width: 13, height: 13 }} />{m.ad}</span>} value={adet} tone={adet<=0?'critical':undefined} style={{ background: 'var(--surface)' }} />
                                      );
                                    })}
                                    <Tile label="Tüm mağazalar" value={(u.varyantlar||[]).reduce((t,v)=>t+v.adet,0)} style={{ background: 'var(--accent-soft)' }} />
                                  </div>
                                  <div className="vg-row" style={{ gap: 4 }}>
                                    {(u.varyantlar||[])
                                      .filter(v=>!aktifMagazaId||v.magazaId===aktifMagazaId)
                                      .sort((a,b)=>(a.magazaId||"").localeCompare(b.magazaId||""))
                                      .map((v,i)=>{
                                        const mag=magazalar.find(m=>m.id===v.magazaId);
                                        return (
                                          <Badge key={`var_${u?.id||i}_${v?.renk||""}_${v?.beden||""}_${v?.magazaId||""}`} tone={stokTon(v.adet)}>
                                            {mag?.ad ? `${mag.ad} · ` : ''}{v.renk}{v.beden?` / ${v.beden}`:""} · {v.adet}
                                            {v.barkod&&<span className="vg-code" style={{ opacity: .7 }}>{v.barkod}</span>}
                                          </Badge>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}

                              {/* TEDARİKÇİ STOĞU */}
                              {sek==="tedarik"&&tx&&(
                                <div className="vg-stack" style={{ gap: 10 }}>
                                  <div className="vg-grid-3" style={{ gap: 8 }}>
                                    <Tile label="Toplam tedarikçi stoğu" value={tedarikStok(tx)} style={{ background: 'var(--surface)' }} />
                                    <Tile label="Aktif varyant" value={tx.secenekler.filter(s=>s.aktif!=="0").length} style={{ background: 'var(--surface)' }} />
                                    <Tile label="Tedarikçi fiyatı (ilk seçenek)" value={tx.secenekler[0]?.satisFiyati?`₺${Number(tx.secenekler[0].satisFiyati).toLocaleString("tr-TR")}`:"—"} style={{ background: 'var(--surface)' }} />
                                  </div>
                                  <div className="vg-table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                    <table className="vg-table vg-table--compact">
                                      <thead><tr><th>Stok kodu</th><th>Barkod (tedarikçi)</th><th className="is-num">Stok</th><th className="is-num">Alış</th><th className="is-num">Satış</th><th>Özellikler</th></tr></thead>
                                      <tbody>
                                        {tx.secenekler.filter(s=>s.aktif!=="0").map((s,i)=>(
                                          <tr key={`tx_sec_${i}`}>
                                            <td className="vg-code">{s.stokKodu||"—"}</td>
                                            <td className="vg-code vg-muted">{s.barkod||"—"}</td>
                                            <td className="is-num is-strong">{s.stokAdedi||"0"}</td>
                                            <td className="is-num vg-muted">{s.alisFiyati?`₺${Number(s.alisFiyati).toLocaleString("tr-TR")}`:"—"}</td>
                                            <td className="is-num is-strong">{s.satisFiyati?`₺${Number(s.satisFiyati).toLocaleString("tr-TR")}`:"—"}</td>
                                            <td><div className="vg-row" style={{ gap: 3 }}>{(s.ekSecenekOzellik||[]).map((o,j)=>(<Badge key={j} dot={false} size="sm">{o.tanim}: {o.deger||o.text}</Badge>))}</div></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* RESİMLER — yerel DB + Ticimax */}
                              {sek==="resimler"&&(()=>{
                                // Yerel DB'deki resimler önce, sonra Ticimax
                                const yerelResimler = (u.resimler||[]).map(url=>({url, kaynak:'yerel'}));
                                const txResimler    = (tx?.resimler||[])
                                  .filter(url=>!yerelResimler.some(r=>r.url===url))
                                  .map(url=>({url, kaynak:'ticimax'}));
                                const tumResimler   = [...yerelResimler, ...txResimler];
                                return tumResimler.length > 0 ? (
                                  <div className="vg-stack" style={{ gap: 8 }}>
                                    <div className="vg-help">{yerelResimler.length} yerel · {txResimler.length} Ticimax</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                                      {tumResimler.map((r,i)=>(
                                        <div key={`resim_${i}_${r.url?.slice(-10)||i}`} className="vg-card" style={{ overflow: 'hidden', position: 'relative' }}>
                                          <img src={r.url} alt={`Resim ${i+1}`} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} onError={e=>{e.target.parentElement.style.display="none"}}/>
                                          <Badge tone={r.kaynak==="yerel"?'info':'neutral'} dot={false} size="sm" style={{ position: 'absolute', top: 6, left: 6 }}>{r.kaynak==="yerel"?"Yerel":"Ticimax"}</Badge>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : <EmptyState compact icon={ImageIcon} title="Bu ürüne henüz resim eklenmemiş" />;
                              })()}

                              {/* ÜRÜN BİLGİSİ */}
                              {sek==="detay"&&(
                                <div className="vg-grid-2">
                                  <div>
                                    {[
                                      {l:"Ürün kodu",v:u.kod},
                                      {l:"Kategori",v:[u.kategori,u.altKategori].filter(Boolean).join(" › ")},
                                      {l:"Satış birimi",v:tx?.satisBirimi||"Adet"},
                                      {l:"KDV",v:`%${u.kdv||20}`},
                                      {l:"Kritik stok",v:`${u.kritikStok??0} adet`},
                                    ].map(({l,v})=>v?(<div key={l} className="vg-kv" style={{ borderBottom: '1px solid var(--line)' }}><span>{l}</span><span>{v}</span></div>):null)}
                                  </div>
                                  <div className="vg-stack" style={{ gap: 10 }}>
                                    {tx?.teknikDetaylar?.length>0&&(
                                      <div>
                                        <div className="vg-section-label" style={{ marginBottom: 4 }}>Teknik özellikler</div>
                                        {tx.teknikDetaylar.slice(0,8).map((d,i)=>(<div key={`detay_${i}`} className="vg-kv" style={{ borderBottom: '1px solid var(--line)' }}><span>{d.ozellikTanim}</span><span>{d.degerTanim}</span></div>))}
                                      </div>
                                    )}
                                    {(u.aciklama||tx?.aciklama)&&(
                                      <div>
                                        <div className="vg-section-label" style={{ marginBottom: 4 }}>Açıklama</div>
                                        <div className="vg-muted" style={{ fontSize: 13, lineHeight: '20px', maxHeight: 100, overflowY: 'auto' }}>{u.aciklama||tx?.aciklama}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Ticimax bağlantısı yok uyarısı */}
                              {!tx&&(sek==="tedarik")&&(
                                <Banner>Bu ürün için Ticimax'ta eşleşen kayıt bulunamadı. Eşleştirme ürün adı benzerliğine göre yapılır.</Banner>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        {yukleniyor && sayfaliUrunler.length===0 && <LoadingRows card={false} rows={8} />}
        {!yukleniyor&&sayfaliUrunler.length===0&&(
          <EmptyState icon={Package} title={filtreVar ? 'Filtrelere uyan ürün yok' : 'Henüz ürün yok'} text={filtreVar ? 'Filtreleri değiştirin ya da temizleyin.' : 'Yeni ürün ekleyin ya da Ticimax\'tan içe aktarın.'} />
        )}

        {toplamUrun>0&&(
          <div className="vg-table-footer">
            <span className="vg-num">{(sayfa-1)*URUN_SAYFA_BOYUTU+1}–{Math.min(toplamUrun,sayfa*URUN_SAYFA_BOYUTU)} / {toplamUrun} ürün</span>
            <div className="vg-row" style={{ gap: 6 }}>
              <Button size="sm" icon={ChevronLeft} onClick={()=>setSayfa(p=>Math.max(1,p-1))} disabled={sayfa<=1}>Önceki</Button>
              <span className="vg-num">{sayfa} / {toplamSayfa}</span>
              <Button size="sm" iconRight={ChevronRight} onClick={()=>setSayfa(p=>Math.min(toplamSayfa,p+1))} disabled={sayfa>=toplamSayfa}>Sonraki</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STOK HAREKETLERİ ─────────────────────────────────────────
// ─── ALIM LİSTESİ ─────────────────────────────────────────────
function AlimListesi({ urunler, ticimaxUrunler, magazalar, markalar=[], aktifMagazaId }) {
  const [liste, setListe] = useState([]); // { id, urunId?, urunAdi, marka, resim, renk, beden, mevcutStok, istenenAdet, not, kaynak }
  const [arama, setArama] = useState('');
  const [aramaAcik, setAramaAcik] = useState(false);
  // Stok Yönetimi'ndeki filtrelerle aynı mantık — ürün ara/ekle panelini daraltmak için
  const [markaFiltre, setMarkaFiltre] = useState('');
  const [stokFiltre, setStokFiltre] = useState('hepsi');
  const [fiyatMinF, setFiyatMinF] = useState('');
  const [fiyatMaxF, setFiyatMaxF] = useState('');
  const aramaRef = React.useRef(null);
  const print = usePrint();
  const [fisYazdiriliyor, setFisYazdiriliyor] = useState(false);

  const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}`;

  // Kritik stokta olan ürünleri otomatik öner
  const kritikUrunler = urunler.filter(u => {
    const toplam = (u.varyantlar||[])
      .filter(v => !aktifMagazaId || v.magazaId === aktifMagazaId)
      .reduce((t,v) => t+v.adet, 0);
    return toplam <= (u.kritikStok??0);
  });

  const otomatikEkle = () => {
    const yeniler = kritikUrunler
      .filter(u => !liste.find(l => l.urunId === u.id))
      .map(u => {
        const txEsles = ticimaxUrunler.find(tx =>
          tx.urunAdi?.toLowerCase().trim() === u.ad?.toLowerCase().trim()
        );
        const mevcutStok = (u.varyantlar||[])
          .filter(v => !aktifMagazaId || v.magazaId === aktifMagazaId)
          .reduce((t,v) => t+v.adet, 0);
        return {
          id: `auto_${u.id}_${Date.now()}`,
          urunId: u.id,
          urunAdi: u.ad,
          sku: u.sku || u.kod || '',
          marka: u.marka || '',
          resim: (u.resimler||[])[0] || txEsles?.resimler?.[0] || '',
          renk: u.renkAdi || '',
          beden: '',
          mevcutStok,
          istenenAdet: 1,
          not: '',
          kaynak: 'otomatik',
          alisF: Number(u.alisF)||0,
        };
      });
    setListe(p => [...p, ...yeniler]);
  };

  const kalemEkle = (urun, tx = null) => {
    const resim = (urun.resimler||[])[0] || tx?.resimler?.[0] || '';
    const mevcutStok = (urun.varyantlar||[])
      .filter(v => !aktifMagazaId || v.magazaId === aktifMagazaId)
      .reduce((t,v) => t+v.adet, 0);
    setListe(p => [...p, {
      id: `manual_${urun.id}_${Date.now()}`,
      urunId: urun.id,
      urunAdi: urun.ad,
      sku: urun.sku || urun.kod || '',
      marka: urun.marka || '',
      resim,
      renk: urun.renkAdi || '',
      beden: '',
      mevcutStok,
      istenenAdet: 1,
      not: '',
      kaynak: 'manuel',
      alisF: Number(urun.alisF)||0,
    }]);
    setAramaAcik(false);
    setArama('');
  };

  const txKalemEkle = (tx) => {
    const ilkSec = tx.secenekler?.find(s => s.aktif !== '0') || tx.secenekler?.[0] || {};
    const renkOzellik = ilkSec.ekSecenekOzellik?.find(o => o.tanim?.toLowerCase().includes('renk'));
    setListe(p => [...p, {
      id: `tx_${tx.urunKartiID}_${Date.now()}`,
      urunId: null,
      urunAdi: tx.urunAdi,
      sku: ilkSec.stokKodu || tx.urunKartiID || '',
      marka: tx.marka || '',
      resim: tx.resimler?.[0] || '',
      renk: renkOzellik?.text || renkOzellik?.deger || '',
      beden: '',
      mevcutStok: 0,
      istenenAdet: 1,
      not: '',
      kaynak: 'ticimax',
      alisF: parseFloat(ilkSec.indirimliFiyat || ilkSec.alisFiyati) || 0,
    }]);
    setAramaAcik(false);
    setArama('');
  };

  const guncelle = (id, k, v) => setListe(p => p.map(l => l.id===id ? {...l,[k]:v} : l));
  const sil = (id) => setListe(p => p.filter(l => l.id !== id));
  const temizle = async () => { if(await onayla('Alım listesindeki tüm kalemler kaldırılacak.', { title: 'Listeyi temizle', confirmLabel: 'Listeyi temizle' })) setListe([]); };

  const genelToplam = liste.reduce((t, l) => t + l.istenenAdet * l.alisF, 0);

  // Arama kutusu — ürün ara/ekle için, alım listesindeki filtrelerden bağımsız düz metin arama.
  const aramaFiltreli = arama.length > 1 ? [
    ...urunler.filter(u =>
      u.ad?.toLowerCase().includes(arama.toLowerCase()) ||
      u.marka?.toLowerCase().includes(arama.toLowerCase())
    ).slice(0, 8).map(u => ({...u, _tip: 'yerel'})),
    ...ticimaxUrunler.filter(tx =>
      !urunler.find(u => u.ad?.toLowerCase().trim() === tx.urunAdi?.toLowerCase().trim()) &&
      (tx.urunAdi?.toLowerCase().includes(arama.toLowerCase()) || tx.marka?.toLowerCase().includes(arama.toLowerCase()))
    ).slice(0, 5).map(tx => ({...tx, _tip: 'ticimax'})),
  ] : [];

  const filtreAktif = markaFiltre || stokFiltre !== 'hepsi' || fiyatMinF || fiyatMaxF;

  // Marka/stok/fiyat filtreleri, YENİ ürün aramak için değil — zaten alım listesine
  // eklenmiş kalemleri (liste) daraltmak için. Örn. marka=Nas Bag seçilince, listeye
  // otomatik/manuel eklenmiş Nas Bag kalemleri mevcut tabloda görünür kalır.
  const listeFiltreUyar = (l) => {
    if (markaFiltre && l.marka !== markaFiltre) return false;
    if (fiyatMinF && Number(l.alisF||0) < Number(fiyatMinF)) return false;
    if (fiyatMaxF && Number(l.alisF||0) > Number(fiyatMaxF)) return false;
    if (stokFiltre !== 'hepsi') {
      const esik = 0; // liste kalemlerinde ürünün kritikStok'u saklanmıyor, varsayılan eşik kullanılır
      if (stokFiltre==='stokta'  && !(l.mevcutStok>0))    return false;
      if (stokFiltre==='kritik'  && !(l.mevcutStok<=esik))return false;
      if (stokFiltre==='tukendi' && !(l.mevcutStok<=0))   return false;
    }
    return true;
  };
  const filtreliListe = filtreAktif ? liste.filter(listeFiltreUyar) : liste;
  // Yazdırma/fiş çıktıları da ekrandaki filtreye uysun — filtre aktifken sadece
  // görünen kalemler bastırılır, tüm liste değil.
  const filtreliToplam = filtreliListe.reduce((t, l) => t + l.istenenAdet * l.alisF, 0);

  // Alım Listesi'ndeki (otomatik eklenen kritik ürünler + kullanıcının kendi
  // eklediği ürünler) tüm kalemleri, istenen adetleriyle birlikte fiş
  // yazıcısından bastırır — PDF/Yazdır'daki A4 çıktının aynısı, ESC/POS ile.
  const fiseYazdir = async () => {
    if (filtreliListe.length === 0) { toast.warning('Alım listesi boş.'); return; }
    setFisYazdiriliyor(true);
    try {
      const magazaAd = magazalar?.find(m => m.id === aktifMagazaId)?.ad;
      await print.kritikStokFisiYazdir(filtreliListe, magazaAd, filtreliToplam);
      toast.success('Alım listesi fiş yazıcısına gönderildi.');
    } catch (err) {
      toast.error('Fiş yazdırılamadı: ' + err.message);
    } finally {
      setFisYazdiriliyor(false);
    }
  };

  const yazdir = () => {
    if (filtreliListe.length === 0) { toast.warning('Yazdırılacak kalem yok.'); return; }
    const cikti = filtreliListe;
    const ciktiToplam = filtreliToplam;
    const tarih = new Date().toLocaleDateString('tr-TR');
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html><html><head><title>Alım Listesi</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;padding:32px;}
      @page{size:A4;margin:20mm;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #2e6db4;}
      .logo{font-size:26px;font-weight:900;color:#2e6db4;letter-spacing:1px;}
      .logo span{color:#1a1a1a;}
      .meta{text-align:right;font-size:12px;color:#666;}
      .meta strong{display:block;font-size:14px;color:#1a1a1a;margin-bottom:4px;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      thead tr{background:#f3f4f6;}
      th{padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#666;border-bottom:2px solid #2e6db4;}
      td{padding:12px;border-bottom:1px solid #eee;vertical-align:middle;}
      .foto{width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #eee;}
      .foto-placeholder{width:60px;height:60px;background:#f0f0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px;}
      .urun-ad{font-weight:600;font-size:13px;color:#1a1a1a;}
      .urun-marka{font-size:11px;color:#888;margin-top:2px;}
      .stok-mev{font-size:13px;font-weight:700;color:#e53935;}
      .stok-ist{font-size:14px;font-weight:900;color:#2e7d32;background:#e8f5e9;padding:3px 10px;border-radius:12px;}
      .fiyat{font-size:12px;color:#666;}
      .not{font-size:11px;color:#888;font-style:italic;}
      .footer{margin-top:32px;padding-top:16px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;}
      .toplam{font-size:18px;font-weight:900;color:#2e6db4;}
      .imza{font-size:11px;color:#aaa;}
      .onay-box{border:1px solid #ccc;padding:12px 24px;border-radius:8px;font-size:12px;color:#666;}
      @media print{body{padding:0;}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="logo">VEGA <span>Çanta</span></div>
        <div style="font-size:13px;color:#666;margin-top:4px;">Alım İhtiyaç Listesi</div>
      </div>
      <div class="meta">
        <strong>Tarih: ${tarih}</strong>
        <div>${cikti.length} kalem · ${cikti.reduce((t,l)=>t+l.istenenAdet,0)} adet</div>
        <div style="margin-top:4px;font-weight:600;color:#2e6db4;">Tahmini Toplam: ₺${ciktiToplam.toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:72px">Foto</th>
          <th>Ürün</th>
          <th style="width:90px">Renk/Beden</th>
          <th style="width:80px;text-align:center">Mevcut</th>
          <th style="width:80px;text-align:center">İstenen</th>
          <th style="width:90px;text-align:right">Birim Fiyat</th>
          <th style="width:100px;text-align:right">Toplam</th>
          <th>Not</th>
        </tr>
      </thead>
      <tbody>
        ${cikti.map((l,i) => `
          <tr style="background:${i%2===0?'#fff':'#fafafa'}">
            <td>${l.resim
              ? `<img src="${l.resim}" class="foto" onerror="this.style.display='none'">`
              : `<div class="foto-placeholder">👜</div>`}
            </td>
            <td>
              <div class="urun-ad">${l.urunAdi||'—'}</div>
              <div class="urun-marka">${l.marka||''}</div>
            </td>
            <td style="font-size:12px;color:#555">${[l.renk,l.beden].filter(Boolean).join(' / ')||'—'}</td>
            <td style="text-align:center"><span class="stok-mev">${l.mevcutStok}</span></td>
            <td style="text-align:center"><span class="stok-ist">${l.istenenAdet}</span></td>
            <td style="text-align:right" class="fiyat">${l.alisF ? `₺${Number(l.alisF).toLocaleString('tr-TR',{minimumFractionDigits:2})}` : '—'}</td>
            <td style="text-align:right;font-weight:700;font-size:13px">₺${(l.istenenAdet*(l.alisF||0)).toLocaleString('tr-TR',{minimumFractionDigits:2})}</td>
            <td class="not">${l.not||''}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="footer">
      <div>
        <div class="toplam">Genel Toplam: ₺${ciktiToplam.toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
        <div class="imza" style="margin-top:6px">Hazırlayan: _______________  Onaylayan: _______________</div>
      </div>
      <div class="onay-box">□ Onaylandı &nbsp;&nbsp; □ Beklemede &nbsp;&nbsp; □ Reddedildi</div>
    </div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`);
    win.document.close();
  };

  return (
    <div className="vg-stack">
      {kritikUrunler.length > 0 && (
        <Banner tone="warning" title={`${kritikUrunler.length} ürün kritik stokta.`}
          action={<Button size="sm" icon={Plus} onClick={otomatikEkle}>Listeye ekle</Button>}>
          {aktifMagazaId ? 'Seçili mağazada' : 'Tüm mağazalarda'} kritik seviyenin altındaki ürünleri alım listesine ekleyebilirsiniz.
        </Banner>
      )}

      <div className="vg-table-wrap" style={{ overflow: 'visible' }}>
        <div className="vg-table-toolbar">
          {/* Manuel arama: yerel + Ticimax ürünlerinden ekle */}
          <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 380 }}>
            <SearchInput ref={aramaRef} value={arama} onChange={e=>{setArama(e.target.value);setAramaAcik(true);}} onFocus={()=>setAramaAcik(true)}
              onBlur={()=>setTimeout(()=>setAramaAcik(false),200)} placeholder="Ürün ara ve listeye ekle" aria-label="Alım listesine ürün ekle" />
            {aramaAcik && arama.length > 1 && (
              <div className="vg-menu" style={{ left: 0, right: 0, maxHeight: 300, overflowY: 'auto' }}>
                {aramaFiltreli.length === 0 && <div className="vg-menu__label">Sonuç bulunamadı</div>}
                {aramaFiltreli.map((u,i) => {
                  const isTx = u._tip === 'ticimax';
                  const resim = isTx ? u.resimler?.[0] : (u.resimler||[])[0];
                  const ad = isTx ? u.urunAdi : u.ad;
                  return (
                    <button key={i} type="button" className="vg-list__item vg-list__item--button" style={{ borderRadius: 6, padding: '6px 8px' }}
                      onMouseDown={e=>e.preventDefault()} onClick={()=>isTx?txKalemEkle(u):kalemEkle(u)}>
                      {resim ? <img src={resim} alt="" className="vg-thumb" onError={e=>e.target.style.visibility='hidden'}/> : <span className="vg-thumb" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-subtle)' }}><ShoppingBag className="vg-icon" /></span>}
                      <div className="vg-list__main">
                        <div className="vg-list__primary vg-truncate">{ad}</div>
                        <div className="vg-list__secondary">{isTx ? 'Ticimax' : 'Yerel'}{u.marka ? ` · ${u.marka}` : ''}</div>
                      </div>
                      <Plus className="vg-icon" style={{ color: 'var(--ink-muted)' }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Marka/Stok/Fiyat filtreleri — alım listesine ZATEN eklenmiş kalemleri daraltır */}
          <Select size="sm" value={markaFiltre} onChange={e=>setMarkaFiltre(e.target.value)} aria-label="Marka" style={{ width: 'auto', minWidth: 120 }}>
            <option value="">Tüm markalar</option>
            {markalar.map(m=><option key={m.id||m.ad} value={m.ad}>{m.ad}</option>)}
          </Select>
          <Select size="sm" value={stokFiltre} onChange={e=>setStokFiltre(e.target.value)} aria-label="Stok durumu" style={{ width: 'auto' }}>
            <option value="hepsi">Tüm stoklar</option>
            <option value="stokta">Stokta var</option>
            <option value="kritik">Kritik stok</option>
            <option value="tukendi">Tükendi</option>
          </Select>
          <div className="vg-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
            <Input size="sm" value={fiyatMinF} onChange={e=>setFiyatMinF(e.target.value)} placeholder="Min ₺" type="number" aria-label="En düşük alış" style={{ width: 80 }} />
            <span className="vg-muted">–</span>
            <Input size="sm" value={fiyatMaxF} onChange={e=>setFiyatMaxF(e.target.value)} placeholder="Max ₺" type="number" aria-label="En yüksek alış" style={{ width: 80 }} />
          </div>
          {filtreAktif && <Button size="sm" variant="plain" icon={X} onClick={()=>{setMarkaFiltre('');setStokFiltre('hepsi');setFiyatMinF('');setFiyatMaxF('');}}>Temizle</Button>}

          {liste.length > 0 && (
            <div className="vg-row" style={{ gap: 6, marginLeft: 'auto' }}>
              <Button size="sm" variant="plain" icon={Trash2} onClick={temizle}>Listeyi temizle</Button>
              <Button size="sm" icon={Printer} onClick={yazdir}>PDF / yazdır</Button>
              <Button size="sm" variant="primary" icon={ReceiptText} onClick={fiseYazdir} loading={fisYazdiriliyor}>{fisYazdiriliyor?'Gönderiliyor…':'Fişe yazdır'}</Button>
            </div>
          )}
        </div>

        {/* Fiş yazıcısı bağlantı/seçim — "Fiş yazıcısı seçilmedi" hatasını burada çözün */}
        {liste.length > 0 && (
          <div className="vg-row" style={{ gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--line)', background: 'var(--surface-sunken)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: print.bagli ? 'var(--success)' : 'var(--critical)' }} />
            <span className="vg-muted" style={{ fontSize: 12 }}>Fiş yazıcısı: {print.bagli ? (print.fisYazici || 'henüz seçilmedi') : 'QZ Tray bağlı değil'}</span>
            {!print.bagli && <Button size="sm" icon={Plug} onClick={print.baglan} loading={print.baglaniyor}>{print.baglaniyor?'Bağlanıyor…':'Bağlan'}</Button>}
            {print.bagli && (
              <Select size="sm" value={print.fisYazici} onChange={e=>print.fisYaziciSec(e.target.value)} aria-label="Fiş yazıcısı" style={{ width: 'auto', minWidth: 180 }}>
                <option value="">Yazıcı seçin</option>
                {print.yazicilar.map(y=><option key={y} value={y}>{y}</option>)}
              </Select>
            )}
            {print.hata && <span className="vg-error">{print.hata}</span>}
          </div>
        )}

        {liste.length === 0 && (
          <EmptyState icon={ShoppingCart} title="Alım listesi boş" text="Kritik stok önerisini kullanın ya da yukarıdan ürün arayıp ekleyin." />
        )}

        {liste.length > 0 && filtreliListe.length === 0 && <EmptyState compact title="Bu filtreye uyan kalem yok" />}

        {filtreliListe.length > 0 && (
          <>
            <div className="vg-table-scroll">
              <table className="vg-table" style={{ minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th>Ürün</th><th style={{ width: 120 }}>Renk</th><th style={{ width: 96 }}>Beden</th>
                    <th className="is-num" style={{ width: 80 }}>Mevcut</th><th style={{ width: 128, textAlign: 'center' }}>İstenen</th>
                    <th className="is-num" style={{ width: 120 }}>Alış</th><th className="is-num" style={{ width: 110 }}>Toplam</th>
                    <th>Not</th><th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtreliListe.map(l => (
                    <tr key={l.id}>
                      <td>
                        <div className="vg-row" style={{ flexWrap: 'nowrap', gap: 10 }}>
                          {l.resim ? <img src={l.resim} alt="" className="vg-thumb" onError={e=>e.target.style.visibility='hidden'}/> : <span className="vg-thumb" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-subtle)' }}><ShoppingBag className="vg-icon" /></span>}
                          <div style={{ minWidth: 0 }}>
                            <div className="is-strong vg-truncate" style={{ maxWidth: 240 }}>{l.urunAdi}</div>
                            <div className="vg-row" style={{ gap: 4 }}>
                              <span className="vg-list__secondary">{l.marka}</span>
                              {l.kaynak==='otomatik'&&<Badge tone="critical" size="sm">Kritik</Badge>}
                              {l.kaynak==='ticimax'&&<Badge tone="info" size="sm">Ticimax</Badge>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><Input size="sm" value={l.renk} onChange={e=>guncelle(l.id,'renk',e.target.value)} placeholder="Renk" aria-label="Renk" /></td>
                      <td><Input size="sm" value={l.beden} onChange={e=>guncelle(l.id,'beden',e.target.value)} placeholder="Beden" aria-label="Beden" /></td>
                      <td className="is-num"><Badge tone={l.mevcutStok<=0?'critical':l.mevcutStok<=3?'warning':'success'} size="sm">{l.mevcutStok}</Badge></td>
                      <td>
                        <div className="vg-row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'center' }}>
                          <IconButton icon={Minus} label="Azalt" variant="secondary" size="sm" onClick={()=>guncelle(l.id,'istenenAdet',Math.max(1,l.istenenAdet-1))} />
                          <Input size="sm" type="number" min={1} value={l.istenenAdet} className="vg-num" aria-label="İstenen adet"
                            onChange={e=>guncelle(l.id,'istenenAdet',Math.max(1,parseInt(e.target.value)||1))} style={{ width: 48, textAlign: 'center', fontWeight: 600 }} />
                          <IconButton icon={Plus} label="Arttır" variant="secondary" size="sm" onClick={()=>guncelle(l.id,'istenenAdet',l.istenenAdet+1)} />
                        </div>
                      </td>
                      <td>
                        <div className="vg-input-group">
                          <Input size="sm" type="number" value={l.alisF||''} onChange={e=>guncelle(l.id,'alisF',parseFloat(e.target.value)||0)} className="vg-num" aria-label="Alış fiyatı" style={{ textAlign: 'right', paddingRight: 20 }} />
                          <span className="vg-input-suffix" style={{ right: 7, fontSize: 12 }}>₺</span>
                        </div>
                      </td>
                      <td className="is-num is-strong">{para(l.istenenAdet*(l.alisF||0))}</td>
                      <td><Input size="sm" value={l.not} onChange={e=>guncelle(l.id,'not',e.target.value)} placeholder="Not" aria-label="Not" /></td>
                      <td><IconButton icon={X} label="Kalemi kaldır" size="sm" variant="critical-plain" onClick={()=>sil(l.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Alt özet — filtre aktifse görünen (filtrelenmiş) kalemleri özetler */}
            <div className="vg-table-footer">
              <span className="vg-num">
                {filtreliListe.length} kalem · {filtreliListe.reduce((t,l)=>t+l.istenenAdet,0)} adet
                {filtreAktif && filtreliListe.length !== liste.length && ` (toplam ${liste.length})`}
              </span>
              <span className="vg-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Tahmini toplam {para(filtreliListe.reduce((t,l)=>t+l.istenenAdet*l.alisF,0))}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// Stok Geçmişi: bir ürünün stoğunun NE ZAMAN, NE KADAR, NEDEN ve HANGİ BELGEYLE
// değiştiğini gösteren defter. Filtrelerin tamamı SUNUCUYA gidiyor — istemcide
// süzmek, limitin dışında kalan eski hareketleri aramanın dışında bırakırdı.
function StokHareketler({ urunler, magazalar }) {
  const [hareketler, setHareketler] = useState([]);
  const [ozet, setOzet]             = useState({ giris:0, cikis:0, net:0 });
  const [toplam, setToplam]         = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [modal, setModal]           = useState(false);

  const [arama, setArama]               = useState("");
  const [tipFiltre, setTipFiltre]       = useState("hepsi");
  const [magazaFiltre, setMagazaFiltre] = useState("hepsi");
  const [yonFiltre, setYonFiltre]       = useState("hepsi");
  const [baslangic, setBaslangic]       = useState("");
  const [bitis, setBitis]               = useState("");
  const [limit, setLimit]               = useState(200);

  const bos = { urunId:"", renk:"", beden:"", magazaId:magazalar[0]?.id||"", hedefMagazaId:"", tip:"alis", adet:1, birimFiyat:"", notlar:"" };
  const [form, setForm] = useState(bos);

  // Manuel hareket formunda seçilebilen tipler.
  const tipRenkler = {
    alis:    {label:"Alış"},
    satis:   {label:"Satış"},
    iade:    {label:"İade"},
    transfer:{label:"Transfer"},
    sayim:   {label:"Sayım"},
    fire:    {label:"Fire/kayıp"},
  };
  // Sistemin kendi ürettiği, formda seçilemeyen tipler — tabloda ham "iptal" /
  // "degisim" yazmasın diye ayrı tutuluyor (bkz. routes/siparisler.js, degisim.js).
  const OTOMATIK_TIPLER = {
    iptal:   {label:"Sipariş iptali"},
    degisim: {label:"Değişim"},
  };
  const tipBilgi = (tip) => tipRenkler[tip] || OTOMATIK_TIPLER[tip] || {label:tip||"—"};
  const KAYNAK_ETIKET = { satis:"Satış Fişi", siparis:"Sipariş", iade:"İade", degisim:"Değişim" };

  const yukle = () => {
    setYukleniyor(true);
    stokHareketleriGetir({
      limit,
      ...(arama.trim()             && { q: arama.trim() }),
      ...(tipFiltre !== "hepsi"    && { tip: tipFiltre }),
      ...(magazaFiltre !== "hepsi" && { magazaId: magazaFiltre }),
      ...(yonFiltre !== "hepsi"    && { yon: yonFiltre }),
      ...(baslangic && { baslangic }),
      ...(bitis     && { bitis }),
    })
      .then(d => {
        // Uç { hareketler, toplam, ozet } dönüyor; eski dizi biçimi de destekleniyor
        // (backend güncellenmeden frontend yayınlanırsa ekran boş kalmasın).
        const liste = Array.isArray(d) ? d : (d?.hareketler || []);
        setHareketler(liste);
        setToplam(Array.isArray(d) ? liste.length : (d?.toplam ?? liste.length));
        setOzet(d?.ozet || { giris:0, cikis:0, net:0 });
      })
      .catch(console.error)
      .finally(()=>setYukleniyor(false));
  };

  // Arama kutusunda her harfte istek atmasın diye kısa gecikme.
  useEffect(()=>{
    const zamanlayici = setTimeout(yukle, 300);
    return ()=>clearTimeout(zamanlayici);
  },[arama,tipFiltre,magazaFiltre,yonFiltre,baslangic,bitis,limit]);

  const kaydet = async () => {
    if(!form.urunId||!form.adet) return toast.warning("Ürün ve adet zorunlu.");
    if(!form.magazaId) return toast.warning("Mağaza seçin.");
    if(form.tip==='transfer'&&!form.hedefMagazaId) return toast.warning("Hedef mağazayı seçin.");
    if(form.tip==='transfer'&&form.magazaId===form.hedefMagazaId) return toast.warning("Kaynak ve hedef mağaza aynı olamaz.");
    try {
      if(form.tip==='transfer') {
        await stokTransfer({
          urunId:form.urunId, kaynakMagazaId:form.magazaId, hedefMagazaId:form.hedefMagazaId,
          renk:form.renk, beden:form.beden, adet:Math.abs(form.adet), notlar:form.notlar,
        });
      } else {
      await stokHareketKaydet({
        urunId:form.urunId, magazaId:form.magazaId, tip:form.tip,
        renk:form.renk, beden:form.beden,
        adet:["alis","iade"].includes(form.tip)?Math.abs(form.adet):-Math.abs(form.adet),
        birimFiyat:parseFloat(form.birimFiyat)||0, notlar:form.notlar,
      }); }
      setModal(false);
      setForm({...bos, magazaId:magazalar[0]?.id||""});
      toast.success(form.tip==='transfer' ? 'Transfer kaydedildi.' : 'Stok hareketi kaydedildi.');
      yukle();
    } catch(err){ toast.error("Kaydedilemedi: "+err.message); }
  };

  // Ekrandaki satırları CSV olarak indirir (sayım/muhasebe tarafı Excel'de inceleyebilsin).
  const disaAktar = () => {
    const basliklar = ["Tarih","Saat","Ürün","SKU","Kod","Marka","Renk","Beden","Mağaza","İşlem","Miktar","Birim Fiyat","Tutar","Kaynak","Not"];
    const satirlar = hareketler.map(h=>{
      const d = new Date(h.tarih);
      return [
        d.toLocaleDateString("tr-TR"),
        d.toLocaleTimeString("tr-TR"),
        h.urun?.ad||"", h.urun?.sku||"", h.urun?.kod||"", h.urun?.marka||"",
        h.renk||"", h.beden||"", h.magaza?.ad||"",
        tipBilgi(h.tip).label, h.adet,
        Number(h.birimFiyat||0).toFixed(2),
        (Math.abs(h.adet)*Number(h.birimFiyat||0)).toFixed(2),
        h.kaynak ? (KAYNAK_ETIKET[h.kaynak.tur]||h.kaynak.tur)+" "+h.kaynak.no : "",
        h.notlar||"",
      ];
    });
    // Baştaki BOM olmadan Excel Türkçe karakterleri bozuk gösteriyor.
    const csv = "\uFEFF" + [basliklar,...satirlar]
      .map(r=>r.map(h=>'"'+String(h??"").replace(/"/g,'""')+'"').join(";")).join("\n");
    const baglanti = document.createElement("a");
    baglanti.href = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    baglanti.download = "stok-gecmisi-"+new Date().toISOString().slice(0,10)+".csv";
    baglanti.click();
    URL.revokeObjectURL(baglanti.href);
  };

  const filtreAktif = arama||tipFiltre!=="hepsi"||magazaFiltre!=="hepsi"||yonFiltre!=="hepsi"||baslangic||bitis;
  const filtreleriTemizle = () => { setArama(""); setTipFiltre("hepsi"); setMagazaFiltre("hepsi"); setYonFiltre("hepsi"); setBaslangic(""); setBitis(""); };

  const tipTon = (tip) => ({ alis:'success', satis:'info', iade:'warning', transfer:'violet', sayim:'neutral', fire:'critical', iptal:'critical', degisim:'violet' }[tip] || 'neutral');

  return (
    <div className="vg-stack">
      <div className="vg-row" style={{ justifyContent: 'space-between' }}>
        <div className="vg-muted" style={{ fontSize: 13 }}>
          {toplam} kayıt{hareketler.length<toplam?` · ${hareketler.length} tanesi gösteriliyor`:""}
        </div>
        <div className="vg-row" style={{ gap: 6 }}>
          <Button icon={Download} onClick={disaAktar} disabled={hareketler.length===0}>CSV</Button>
          <Button variant="primary" icon={Plus} onClick={()=>setModal(true)}>Stok hareketi ekle</Button>
        </div>
      </div>

      {/* Dönem özeti — filtrelenen kayıtların TAMAMI üzerinden (sunucuda) hesaplanıyor */}
      <div className="vg-grid-4">
        <StatCard label="Toplam giriş" value={`+${ozet.giris}`} />
        <StatCard label="Toplam çıkış" value={`−${ozet.cikis}`} />
        <StatCard label="Net değişim" value={`${ozet.net>0?"+":""}${ozet.net}`} meta={<Badge tone={ozet.net>=0?'success':'critical'}>{ozet.net>=0?'Artış':'Azalış'}</Badge>} />
        <StatCard label="Kayıt" value={toplam} />
      </div>

      <div className="vg-table-wrap">
        <div className="vg-table-toolbar">
          <SearchInput value={arama} onChange={e=>setArama(e.target.value)} placeholder="Ürün adı, SKU, kod, barkod veya not" aria-label="Stok hareketlerinde ara" style={{ flex: '1 1 240px', minWidth: 200 }} />
          <Select size="sm" value={tipFiltre} onChange={e=>setTipFiltre(e.target.value)} aria-label="İşlem tipi" style={{ width: 'auto' }}>
            <option value="hepsi">Tüm işlemler</option>
            {Object.entries({...tipRenkler,...OTOMATIK_TIPLER}).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Segmented label="Yön" value={yonFiltre} onChange={setYonFiltre} options={[{ value:'hepsi', label:'Tümü' }, { value:'giris', label:'Giriş' }, { value:'cikis', label:'Çıkış' }]} />
          <Select size="sm" value={magazaFiltre} onChange={e=>setMagazaFiltre(e.target.value)} aria-label="Mağaza" style={{ width: 'auto' }}>
            <option value="hepsi">Tüm mağazalar</option>
            {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
          </Select>
          <div className="vg-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
            <Input size="sm" type="date" value={baslangic} onChange={e=>setBaslangic(e.target.value)} aria-label="Başlangıç tarihi" />
            <span className="vg-muted">–</span>
            <Input size="sm" type="date" value={bitis} onChange={e=>setBitis(e.target.value)} aria-label="Bitiş tarihi" />
          </div>
          {filtreAktif&&<Button size="sm" variant="plain" icon={X} onClick={filtreleriTemizle}>Temizle</Button>}
        </div>

        {yukleniyor ? <LoadingRows card={false} rows={8} />
        : hareketler.length===0
          ? <EmptyState icon={History} title={filtreAktif?"Bu filtrelerle hareket bulunamadı":"Henüz stok hareketi yok"} />
          : <>
            <div className="vg-table-scroll">
              <table className="vg-table" style={{ minWidth: 1180 }}>
                <thead><tr>
                  <th>Tarih / saat</th><th>Ürün</th><th>Renk / beden</th><th>Mağaza</th><th>İşlem</th>
                  <th className="is-num">Miktar</th><th className="is-num">Birim fiyat</th><th className="is-num">Tutar</th><th>Kaynak</th><th>Açıklama</th>
                </tr></thead>
                <tbody>
                  {hareketler.map((h,i)=>{
                    const tip=tipBilgi(h.tip);
                    const zaman=new Date(h.tarih);
                    const stokKodu=h.urun?.sku||h.urun?.kod||"";
                    const renkGoster=(h.renk&&h.renk.trim().toLowerCase()!=="standart")?h.renk.trim():(h.urun?.renkAdi||"");
                    const tutar=Math.abs(h.adet)*Number(h.birimFiyat||0);
                    return (
                      <tr key={h.id||`hareket_${i}`}>
                        <td className="vg-nowrap">
                          <div>{zaman.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})}</div>
                          <div className="vg-code vg-muted">{zaman.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
                        </td>
                        <td style={{ minWidth: 190 }}>
                          <div className="is-strong">{h.urun?.ad||"—"}</div>
                          <div className="vg-list__secondary">{[h.urun?.marka,stokKodu].filter(Boolean).join(" · ")||"—"}</div>
                        </td>
                        <td className="vg-muted vg-nowrap">{[renkGoster,h.beden].filter(Boolean).join(" / ")||"—"}</td>
                        <td className="vg-muted vg-nowrap">{h.magaza?.ad||"—"}</td>
                        <td><Badge tone={tipTon(h.tip)}>{tip.label}</Badge></td>
                        <td className={`is-num is-strong ${h.adet>0?'vg-text-success':'vg-text-critical'}`}>{h.adet>0?"+":""}{h.adet}</td>
                        <td className="is-num vg-muted">{h.birimFiyat>0?para(h.birimFiyat):"—"}</td>
                        <td className={`is-num ${tutar>0?'':'vg-muted'}`}>{tutar>0?para(tutar):"—"}</td>
                        <td className="vg-nowrap">{h.kaynak ? <span className="vg-code">{KAYNAK_ETIKET[h.kaynak.tur]||h.kaynak.tur} {h.kaynak.no}</span> : <span className="vg-muted">Manuel</span>}</td>
                        <td className="vg-muted" style={{ maxWidth: 220 }}>{h.notlar||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hareketler.length<toplam&&(
              <div className="vg-table-footer" style={{ justifyContent: 'center' }}>
                <Button size="sm" icon={ChevronDown} onClick={()=>setLimit(l=>l+200)}>Daha eski kayıtları göster ({toplam-hareketler.length} kayıt daha)</Button>
              </div>
            )}
          </>}
      </div>

      {modal&&(
        <Modal title="Yeni stok hareketi" onClose={()=>setModal(false)}
          footer={<>
            <Button variant="plain" onClick={()=>setModal(false)}>Vazgeç</Button>
            <Button variant="primary" icon={Check} onClick={kaydet}>Hareketi kaydet</Button>
          </>}>
          <Field label="İşlem tipi">
            <div className="vg-row" style={{ gap: 6 }}>
              {Object.entries(tipRenkler).map(([k,v])=>(
                <button key={k} type="button" className="vg-chip" aria-pressed={form.tip===k} onClick={()=>setForm(p=>({...p,tip:k}))}>{v.label}</button>
              ))}
            </div>
          </Field>
          <Field label="Ürün" htmlFor="sh-urun">
            <Select id="sh-urun" value={form.urunId} onChange={e=>setForm(p=>({...p,urunId:e.target.value}))}>
              <option value="">Seçin</option>
              {urunler.map(u=><option key={u.id} value={u.id}>{u.ad} ({u.kod})</option>)}
            </Select>
          </Field>
          <div className={form.tip==='transfer' ? 'vg-grid-2' : undefined}>
            <Field label={form.tip==='transfer' ? 'Kaynak mağaza' : 'Mağaza'} htmlFor="sh-magaza">
              <Select id="sh-magaza" value={form.magazaId} onChange={e=>setForm(p=>({...p,magazaId:e.target.value}))}>
                <option value="">Seçin</option>
                {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
              </Select>
            </Field>
            {form.tip==='transfer'&&(
              <Field label="Hedef mağaza" htmlFor="sh-hedef">
                <Select id="sh-hedef" value={form.hedefMagazaId} onChange={e=>setForm(p=>({...p,hedefMagazaId:e.target.value}))}>
                  <option value="">Seçin</option>
                  {magazalar.filter(m=>m.id!==form.magazaId).map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
                </Select>
              </Field>
            )}
          </div>
          <div className="vg-grid-3" style={{ gap: 10 }}>
            {[{l:"Renk",k:"renk",ph:"örn. Siyah"},{l:"Beden",k:"beden",ph:"örn. 40"},{l:"Adet",k:"adet",tip:"number",ph:"1"}].map(f=>(
              <Field key={f.k} label={f.l} htmlFor={`sh-${f.k}`}>
                <Input id={`sh-${f.k}`} type={f.tip||"text"} className={f.tip ? 'vg-num' : undefined} value={form[f.k]} placeholder={f.ph}
                  onChange={e=>setForm(p=>({...p,[f.k]:f.tip==="number"?parseInt(e.target.value)||0:e.target.value}))} />
              </Field>
            ))}
          </div>
          <div className="vg-grid-2">
            <Field label="Birim fiyat" htmlFor="sh-fiyat">
              <div className="vg-input-group">
                <Input id="sh-fiyat" type="number" className="vg-num" value={form.birimFiyat} onChange={e=>setForm(p=>({...p,birimFiyat:e.target.value}))} placeholder="0" style={{ paddingRight: 26 }} />
                <span className="vg-input-suffix">₺</span>
              </div>
            </Field>
            <Field label="Not" htmlFor="sh-not"><Input id="sh-not" value={form.notlar} onChange={e=>setForm(p=>({...p,notlar:e.target.value}))} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function StokYonetimi({ rol, hedefSekme }) {

  // Context'ten mağaza ve aktif mağaza bilgisi
  const { magazalar: ctxMagazalar, aktifMagaza } = useVega();
  const magazalar    = (ctxMagazalar||[]).filter(m => m.tip !== 'online');
  // Üst bardaki "Mağaza seçici" (Tüm Kanallar / Vega Ayakkabı / Vega Çanta …) seçimi.
  // Yalnızca fiziksel bir mağaza seçiliyse o mağazaya kilitle; "Tüm Kanallar" veya
  // online bir kanal (Instagram/Web) seçiliyse tüm mağazalar ayrı ayrı gösterilir.
  const aktifMagazaId = (aktifMagaza && aktifMagaza !== "hepsi" && magazalar.some(m => m.id === aktifMagaza))
    ? aktifMagaza
    : null;

  const [urunler, setUrunler]         = useState([]);
  const [markalar, setMarkalar]       = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [yukleniyor, setYukleniyor]   = useState(true);
  const [sekme, setSekme]             = useState(hedefSekme || "liste");
  const [duzenleUrun, setDuzenleUrun] = useState(null);
  // Ürün listesi arama kutusu — burada tutuluyor (UrunListesi'nde değil) ki bir ürünü
  // düzenlemeye girip "İptal"/"Kaydet" ile listeye dönünce arama sıfırlanmasın.
  const [urunArama, setUrunArama] = useState("");
  // Ürün listesi filtreleri + sayfalama — arama kutusuyla aynı sebeple burada
  // tutuluyor: düzenlemeye girip listeye dönünce sıfırlanmasınlar.
  const [urunMarkaFiltre, setUrunMarkaFiltre] = useState("");
  const [urunKatFiltre, setUrunKatFiltre] = useState("Tümü");
  const [urunStokFiltre, setUrunStokFiltre] = useState("hepsi");
  const [urunFiyatMin, setUrunFiyatMin] = useState("");
  const [urunFiyatMax, setUrunFiyatMax] = useState("");
  const [urunSayfa, setUrunSayfa] = useState(1);
  const [ticimaxModal, setTicimaxModal] = useState(false);
  const [ticimaxUrunler, setTicimaxUrunler] = useState([]);
  const [ticimaxYukleniyor, setTicimaxYukleniyor] = useState(false);
  const [renkAdiGonderiliyor, setRenkAdiGonderiliyor] = useState(false);

  const yukle = () => {
    setYukleniyor(true);
    Promise.all([urunleriGetir(), markalariGetir(), kategorileriGetir()])
      .then(([u, m, k]) => { setUrunler(u); setMarkalar(m); setKategoriler(k); })
      .catch(console.error)
      .finally(()=>setYukleniyor(false));
  };

  // Paneldeki tüm renk adlarını Shopify'daki metafield'e yazar. Ürünleri yeniden
  // yayınlamaz (fiyat/stok/varyantlara dokunmaz), sadece renk adı alanını doldurur.
  // Önce KURU çalıştırıp kaç ürün gideceğini gösterir, onaylanırsa gerçekten gönderir.
  const renkAdlariniGonder = async () => {
    setRenkAdiGonderiliyor(true);
    try {
      const rapor = await shopifyRenkAdlariniGonder({ kuru: true });
      if (!rapor.aday) {
        toast.info('Gönderilecek renk adı yok. Renk adı dolu ve Shopify\'da yayınlanmış aktif ürün bulunamadı.', 6000);
        return;
      }
      const onay = await onayla(
        `${rapor.aday} ürünün renk adı Shopify'a gönderilecek.\n` +
        `Hedef metafield: ${rapor.namespace}.${rapor.key}`,
        { title: 'Renk adlarını gönder', confirmLabel: `${rapor.aday} ürünü gönder`, tone: 'primary' }
      );
      if (!onay) return;

      const sonuc = await shopifyRenkAdlariniGonder({ kuru: false });
      let mesaj = `${sonuc.gonderilen} ürünün renk adı gönderildi.`;
      if (sonuc.atlanan?.length) mesaj += `\n${sonuc.atlanan.length} ürün atlandı (Shopify ID okunamadı).`;
      if (sonuc.hatalar?.length) {
        mesaj += `\n${sonuc.hatalar.length} üründe hata:\n` +
          sonuc.hatalar.slice(0, 5).map(h => `• ${h.kod || '?'}: ${h.hata}`).join('\n');
      }
      if (sonuc.hatalar?.length || sonuc.atlanan?.length) toast.warning(mesaj, 9000); else toast.success(mesaj);
    } catch (err) {
      toast.error('Renk adları gönderilemedi: ' + (err.message || err));
    } finally {
      setRenkAdiGonderiliyor(false);
    }
  };

  const ticimaxYukle = () => {
    setTicimaxYukleniyor(true);
      fetch(`${API_BASE_URL}/ticimax-urunler`)
      .then(r => r.ok ? r.text() : Promise.reject(r.statusText))
      .then(xml => {
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const nodes = Array.from(doc.querySelectorAll('Root > Urunler > Urun'));
        const parsed = nodes.map(u => ({
          urunKartiID:    u.querySelector('UrunKartiID')?.textContent ?? '',
          urunAdi:        u.querySelector('UrunAdi')?.textContent ?? '',
          marka:          u.querySelector('Marka')?.textContent ?? '',
          kategoriTree:   u.querySelector('KategoriTree')?.textContent ?? '',
          aciklama:       u.querySelector('Aciklama')?.textContent ?? '',
          satisBirimi:    u.querySelector('SatisBirimi')?.textContent ?? '',
          resimler:       Array.from(u.querySelectorAll('Resimler > Resim')).map(r => r.textContent ?? ''),
          teknikDetaylar: Array.from(u.querySelectorAll('TeknikDetaylar > TeknikDetay')).map(d => ({
            ozellikTanim: d.querySelector('OzellikTanim')?.textContent ?? '',
            degerTanim:   d.querySelector('DegerTanim')?.textContent ?? '',
          })),
          secenekler: Array.from(u.querySelectorAll('UrunSecenek > Secenek')).map(s => ({
            stokKodu:    s.querySelector('StokKodu')?.textContent ?? '',
            barkod:      s.querySelector('Barkod')?.textContent ?? '',
            stokAdedi:   s.querySelector('StokAdedi')?.textContent ?? '0',
            alisFiyati:  s.querySelector('AlisFiyati')?.textContent ?? '0',
            satisFiyati:   s.querySelector('SatisFiyati')?.textContent ?? '0',
            indirimliFiyat: s.querySelector('IndirimliFiyat')?.textContent ?? '0',
            aktif:         s.querySelector('Aktif')?.textContent ?? '1',
            ekSecenekOzellik: Array.from(s.querySelectorAll('EkSecenekOzellik > Ozellik')).map(o => ({
              tanim: o.getAttribute('Tanim') ?? '',
              deger: o.getAttribute('Deger') ?? '',
              text:  o.textContent ?? ''
            }))
          }))
        }));
        setTicimaxUrunler(parsed);
      })
      .catch(e => console.warn('Ticimax yüklenemedi:', e))
      .finally(() => setTicimaxYukleniyor(false));
  };

  useEffect(()=>{ yukle(); ticimaxYukle(); },[]);

  // Dashboard'dan "Kritik Stok" kartıyla gelindiğinde hedef sekmeyi (alim) zorla —
  // sadece mount anındaki useState başlangıç değerine güvenmek yerine, prop her
  // değiştiğinde bunu uyguluyoruz (component zaten mount'lu olsa bile çalışır).
  useEffect(()=>{ if (hedefSekme) setSekme(hedefSekme); }, [hedefSekme]);

  const kaydet = async () => { await yukle(); setSekme("liste"); setDuzenleUrun(null); };
  const sil = async id => {
    const u = urunler.find(x=>x.id===id);
    if(!await onayla(`${u?.ad || 'Bu ürün'} ve tüm mağaza stokları silinecek.`, { title: 'Ürünü sil', confirmLabel: 'Ürünü sil' })) return;
    try { await urunSil(id); setUrunler(p=>p.filter(u=>u.id!==id)); toast.success('Ürün silindi.'); }
    catch(err){ toast.error("Silinemedi: "+err.message); }
  };

  if (yukleniyor) return <Page><LoadingRows rows={8} /></Page>;

  const kritikSayisi = urunler.filter(u=>(u.varyantlar||[]).reduce((t,v)=>t+v.adet,0)<=(u.kritikStok??0)).length;
  const formModu = sekme==="yeni" || sekme==="duzenle";

  // Ürün ekleme/düzenleme tam sayfa form olarak açılır
  if (formModu) return (
    <Page>
      <UrunForm key={sekme==="duzenle" ? duzenleUrun?.id : 'yeni'} urun={sekme==="duzenle"?duzenleUrun:null}
        onKaydet={kaydet} onIptal={()=>setSekme("liste")} magazalar={magazalar}
        markalar={markalar} kategoriler={kategoriler}
        ticimaxUrunler={ticimaxUrunler}
        onMarkaEkle={async (ad)=>{ const m=await markaEkle({ad}); setMarkalar(p=>[...p,m]); return m; }}
        onMarkaSil={async (id)=>{ await markaSil(id); setMarkalar(p=>p.filter(m=>m.id!==id)); }}/>
    </Page>
  );

  return (
    <Page>
      <PageHeader title="Stok yönetimi"
        subtitle={<span className="vg-row" style={{ gap: 6, display: 'inline-flex' }}>
          <span>{urunler.length} ürün</span>
          {kritikSayisi>0&&<Badge tone="critical" size="sm">{kritikSayisi} kritik</Badge>}
          {aktifMagazaId&&<Badge tone="info" size="sm" dot={false}>{magazalar.find(m=>m.id===aktifMagazaId)?.ad}</Badge>}
          {ticimaxUrunler.length>0&&<span>· {ticimaxUrunler.length} tedarikçi ürünü</span>}
          {ticimaxYukleniyor&&<span className="vg-row" style={{ gap: 4, display: 'inline-flex' }}><Loader2 className="vg-icon vg-spin" style={{ width: 12, height: 12 }} />Ticimax yükleniyor</span>}
        </span>}
        actions={<>
          <Menu trigger={({ toggle }) => <Button icon={MoreHorizontal} onClick={toggle} loading={renkAdiGonderiliyor}>Diğer</Button>}
            items={[
              { text: "Ticimax'tan içe aktar", icon: Download, onClick: () => setTicimaxModal(true) },
              { text: renkAdiGonderiliyor ? 'Renk adları gönderiliyor…' : "Renk adlarını Shopify'a gönder", icon: Palette, onClick: renkAdlariniGonder, disabled: renkAdiGonderiliyor },
            ]} />
          <Button variant="primary" icon={Plus} onClick={()=>{setDuzenleUrun(null);setSekme('yeni');}}>Ürün ekle</Button>
        </>}>
        <Tabs value={sekme} onChange={setSekme} items={[
          { id: "liste",      label: "Ürün listesi" },
          { id: "hareketler", label: "Stok geçmişi" },
          { id: "alim",       label: "Alım listesi", count: kritikSayisi },
        ]} />
      </PageHeader>

      {sekme==="liste"&&<UrunListesi magazalar={magazalar} markalar={markalar} rol={rol} aktifMagazaId={aktifMagazaId}
        ticimaxUrunler={ticimaxUrunler} q={urunArama} setQ={setUrunArama}
        marka={urunMarkaFiltre} setMarka={setUrunMarkaFiltre}
        kat={urunKatFiltre} setKat={setUrunKatFiltre}
        stokDurum={urunStokFiltre} setStokDurum={setUrunStokFiltre}
        fiyatMin={urunFiyatMin} setFiyatMin={setUrunFiyatMin}
        fiyatMax={urunFiyatMax} setFiyatMax={setUrunFiyatMax}
        sayfa={urunSayfa} setSayfa={setUrunSayfa}
        onDuzenle={u=>{setDuzenleUrun(u);setSekme("duzenle");}} onSil={sil}/>}
      {sekme==="hareketler"&&<StokHareketler urunler={urunler} magazalar={magazalar}/>}
      {sekme==="alim"&&<AlimListesi urunler={urunler} ticimaxUrunler={ticimaxUrunler} magazalar={magazalar} markalar={markalar} aktifMagazaId={aktifMagazaId}/>}

      {/* Ticimax Import Modal */}
      {ticimaxModal && (
        <TicimaxImportModal
          magazalar={magazalar}
          markalar={markalar}
          setMarkalar={setMarkalar}
          onKapat={()=>setTicimaxModal(false)}
          onImportTamamlandi={()=>{ yukle(); setSekme('liste'); }}
        />
      )}
    </Page>
  );
}
