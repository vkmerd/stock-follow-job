import React, { useState, useEffect, useRef } from "react";
import { useVega } from "./VegaContext";
import { usePrint } from "./print/usePrint";
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
      padding:"10px 14px",fontFamily:"'DM Sans',sans-serif",boxShadow:"0 4px 16px rgba(0,0,0,.15)",flexShrink:0}}>
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
    <div style={{padding:24,textAlign:"center",color:"#888",background:"rgba(255,255,255,.03)",borderRadius:12}}>
      ⚠ Önce <strong>Mağaza Yönetimi</strong>'nden en az bir mağaza ekleyin.
    </div>
  );

  // ─── Ayakkabı: mağaza + numara bazlı grid ───
  if (ayakkabiMi) {
    const toplamAdet = (varyantlar || []).reduce((t,s)=>t+(Number(s.adet)||0),0);
    return (
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <div>
          <div style={{fontSize:11,color:"#888",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>
            🏪 Bu ürün hangi mağazalarda var?
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {magazalar.map(m=>{
              const secili = seciliMagazaIdler.includes(m.id);
              return (
                <button key={m.id} onClick={()=>magazaToggle(m.id)}
                  style={{padding:"6px 14px",borderRadius:20,fontSize:12,
                    background:secili?"rgba(86,204,242,.14)":"rgba(255,255,255,.04)",
                    border:`1.5px solid ${secili?"rgba(86,204,242,.6)":"rgba(255,255,255,.12)"}`,
                    color:secili?"#56ccf2":"#666",fontWeight:secili?600:400}}>
                  {secili && "✓ "}{m.ikon||"🏪"} {m.ad}
                </button>
              );
            })}
          </div>
        </div>

        {seciliMagazaIdler.length === 0 ? (
          <div style={{padding:20,textAlign:"center",color:"#666",fontSize:12,background:"rgba(255,255,255,.02)",borderRadius:10,border:"1px dashed rgba(255,255,255,.1)"}}>
            Yukarıdan bu ürünün satıldığı mağazaları seçin.
          </div>
        ) : (
          <>
            <div style={{fontSize:12,color:"#888"}}>
              toplam: <span style={{color:"#e8e0d4",fontWeight:700}}>{toplamAdet}</span> adet (tüm numaralar)
            </div>
            {seciliMagazaIdler.map(magazaId => {
              const mag = magazalar.find(m=>m.id===magazaId);
              const buMagazaSatirlari = (varyantlar || []).filter(v => v.magazaId === magazaId);
              const aktifBedenler = new Set(buMagazaSatirlari.map(v => v.beden));
              const siraliSatirlar = [...buMagazaSatirlari].sort((a,b) => (parseInt(a.beden)||0) - (parseInt(b.beden)||0));
              return (
                <div key={magazaId} style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.06)",fontSize:12,color:"#e8e0d4",fontWeight:600}}>
                    {mag?.ikon||"🏪"} {mag?.ad||magazaId}
                  </div>
                  <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                    <div style={{fontSize:10,color:"#666",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Numara Seç</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {BEDENLER_AYAKKABI.map(beden => {
                        const secili = aktifBedenler.has(beden);
                        return (
                          <button key={beden} onClick={()=>numaraToggle(magazaId,beden)}
                            style={{width:40,padding:"6px 0",borderRadius:8,fontSize:12,textAlign:"center",
                              background:secili?"rgba(201,184,130,.16)":"rgba(255,255,255,.04)",
                              border:`1.5px solid ${secili?"rgba(201,184,130,.6)":"rgba(255,255,255,.12)"}`,
                              color:secili?"#c9b882":"#666",fontWeight:secili?700:400}}>
                            {beden}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {siraliSatirlar.length > 0 && (
                    <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",minWidth:340}}>
                      <thead><tr style={{background:"rgba(255,255,255,.03)",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                        {["Numara","Adet","Barkod"].map(h=>(
                          <th key={h} style={{padding:"8px 12px",fontSize:10,color:"#555",fontWeight:500,textAlign:"left"}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {siraliSatirlar.map(s=>(
                          <tr key={s.beden} style={{borderBottom:"1px solid rgba(255,255,255,.03)"}}>
                            <td style={{padding:"8px 12px",fontSize:13,color:"#e8e0d4",fontWeight:600}}>{s.beden}</td>
                            <td style={{padding:"6px 12px"}}>
                              <input type="number" value={s.adet} min={0} onChange={e=>numaraAdetGuncelle(magazaId,s.beden,e.target.value)}
                                style={{width:70,padding:"5px 9px",borderRadius:6,background:"rgba(255,255,255,.07)",
                                  border:"1px solid rgba(255,255,255,.1)",color:"#e8e0d4",fontSize:13,textAlign:"center",outline:"none"}}/>
                            </td>
                            <td style={{padding:"6px 12px"}}>
                              <input value={s.barkod||""} onChange={e=>numaraBarkodGuncelle(magazaId,s.beden,e.target.value)}
                                placeholder={`${s.beden} numara barkodu`}
                                style={{width:170,padding:"5px 9px",borderRadius:6,background:"rgba(255,255,255,.07)",
                                  border:"1px solid rgba(255,255,255,.1)",color:"#e8e0d4",fontSize:11,fontFamily:"monospace",outline:"none"}}/>
                            </td>
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

  // ─── Çanta/diğer kategoriler: mağaza bazlı tekil stok (eskisi gibi) ───
  const tumSatirlar = magazalar.map(m => {
    const mevcut = (varyantlar || []).find(v => v.magazaId === m.id);
    return mevcut
      ? { ...mevcut, magazaAd: m.ad }
      : { renk: 'Standart', beden: '', magazaId: m.id, magazaAd: m.ad, adet: 0, barkod: urunBarkodu || '' };
  });
  const gorunenSatirlar = tumSatirlar.filter(s => seciliMagazaIdler.includes(s.magazaId));
  const toplamAdet = gorunenSatirlar.reduce((t,s)=>t+(Number(s.adet)||0),0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {/* Mağaza Seçimi — bu ürünün satıldığı mağazaları işaretleyin */}
      <div>
        <div style={{fontSize:11,color:"#888",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>
          🏪 Bu ürün hangi mağazalarda var?
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {magazalar.map(m=>{
            const secili = seciliMagazaIdler.includes(m.id);
            return (
              <button key={m.id} onClick={()=>magazaToggle(m.id)}
                style={{padding:"6px 14px",borderRadius:20,fontSize:12,
                  background:secili?"rgba(86,204,242,.14)":"rgba(255,255,255,.04)",
                  border:`1.5px solid ${secili?"rgba(86,204,242,.6)":"rgba(255,255,255,.12)"}`,
                  color:secili?"#56ccf2":"#666",fontWeight:secili?600:400}}>
                {secili && "✓ "}{m.ikon||"🏪"} {m.ad}
              </button>
            );
          })}
        </div>
      </div>

      {gorunenSatirlar.length === 0 ? (
        <div style={{padding:20,textAlign:"center",color:"#666",fontSize:12,background:"rgba(255,255,255,.02)",borderRadius:10,border:"1px dashed rgba(255,255,255,.1)"}}>
          Yukarıdan bu ürünün satıldığı mağazaları seçin.
        </div>
      ) : (
        <>
          <div style={{fontSize:12,color:"#888"}}>
            <span style={{color:"#6fcf97",fontWeight:600}}>{gorunenSatirlar.length}</span> mağazada stok ·{" "}
            toplam: <span style={{color:"#e8e0d4",fontWeight:700}}>{toplamAdet}</span> adet
          </div>

          <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.06)",fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>
              Mağaza Bazlı Stok Girişi
            </div>
            <div style={{maxHeight:420,overflowY:"auto",overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:400}}>
                <thead><tr style={{background:"rgba(255,255,255,.03)",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                  {["Mağaza","Adet","Barkod"].map(h=>(
                    <th key={h} style={{padding:"9px 12px",fontSize:10,color:"#555",fontWeight:500,textAlign:"left"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {gorunenSatirlar.map(s=>{
                    const mag = magazalar.find(m=>m.id===s.magazaId);
                    return (
                      <tr key={s.magazaId} style={{borderBottom:"1px solid rgba(255,255,255,.03)"}}>
                        <td style={{padding:"10px 12px",fontSize:13,color:"#e8e0d4",fontWeight:600}}>
                          {mag?.ikon||"🏪"} {mag?.ad||s.magazaAd||s.magazaId}
                        </td>
                        <td style={{padding:"8px 12px"}}>
                          <input type="number" value={s.adet} min={0} onChange={e=>adetGuncelle(s.magazaId,e.target.value)}
                            style={{width:80,padding:"6px 10px",borderRadius:6,background:"rgba(255,255,255,.07)",
                              border:"1px solid rgba(255,255,255,.1)",color:"#e8e0d4",fontSize:13,textAlign:"center",outline:"none"}}/>
                        </td>
                        <td style={{padding:"8px 12px"}}>
                          <input value={s.barkod||""} onChange={e=>barkodGuncelle(s.magazaId,e.target.value)}
                            placeholder="Ürün barkodu"
                            style={{width:150,padding:"5px 9px",borderRadius:6,background:"rgba(255,255,255,.07)",
                              border:"1px solid rgba(255,255,255,.1)",color:"#e8e0d4",fontSize:11,fontFamily:"monospace",outline:"none"}}/>
                        </td>
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
function BarkodEtiketSayfasi({ urun, magazalar, t }) {
  const print = usePrint();
  const varyantlar = urun?.varyantlar || [];
  const [secili, setSecili]         = useState([]);
  const [adetler, setAdetler]       = useState({});
  const [indirimOran, setIndirimOran] = useState(15);
  const satisF = Number(urun?.satisF||0);
  const listeF = Math.ceil(satisF/(1-indirimOran/100)/10)*10;
  const vKey = v => v.id||v.barkod;
  const toggle = id => setSecili(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

// 2. DÜZELTME: QZ ile yazdırma komutu eklendi
  const [qzYazdiriliyor, setQzYazdiriliyor] = useState(false);
  const [kalibreEdiliyor, setKalibreEdiliyor] = useState(false);
  const [modKaydediliyor, setModKaydediliyor] = useState(false);
  const kalibreEt = async () => {
    setKalibreEdiliyor(true);
    try {
      await print.yaziciKalibreEt();
      alert("Kalibrasyon komutu gönderildi. Yazıcı birkaç etiket ileri-geri besleyip kendi kendine ayarlanacak.");
    } catch (err) {
      alert("Kalibrasyon hatası: " + err.message);
    } finally {
      setKalibreEdiliyor(false);
    }
  };
  const modKaydet = async () => {
    setModKaydediliyor(true);
    try {
      await print.yaziciModuKaydetVeAyarla();
      alert("Yazıcı ayarı kaydedildi. Artık her etiket tek tek (toplu değil) dışarı atılmalı. Bir sonraki baskıda test edin.");
    } catch (err) {
      alert("Ayar kaydetme hatası: " + err.message);
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
    } catch (err) {
      alert("Yazdırma hatası: " + err.message);
    } finally {
      setQzYazdiriliyor(false);
    }
  };

  const yazdir = () => {
    const sv = varyantlar.filter(v=>secili.includes(vKey(v)));
    if(!sv.length){ alert("En az bir varyant seçin!"); return; }
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

  return (
    <div className="vega-flex-collapse" style={{display:"flex",gap:24}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12,color:t.textMuted,textTransform:"uppercase",letterSpacing:.5}}>Etiket Seçimi</div>
          <button onClick={()=>setSecili(secili.length===varyantlar.length?[]:varyantlar.map(vKey))}
            style={{fontSize:11,color:t.accent,background:t.accentBg,border:`1px solid ${t.accent}44`,borderRadius:6,padding:"4px 12px"}}>
            {secili.length===varyantlar.length?"Kaldır":"Tümünü Seç"}
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"rgba(229,57,53,.05)",border:"1px solid rgba(229,57,53,.2)",borderRadius:10}}>
          <span style={{fontSize:12,color:"#ef5350",fontWeight:600}}>🏷 İndirim:</span>
          {[10,15,20,25,30].map(o=>(
            <button key={o} onClick={()=>setIndirimOran(o)} style={{padding:"4px 10px",borderRadius:7,fontSize:11,
              background:indirimOran===o?"rgba(229,57,53,.2)":t.input,
              border:`1px solid ${indirimOran===o?"rgba(229,57,53,.5)":t.border}`,
              color:indirimOran===o?"#ef5350":t.textMuted}}>%{o}</button>
          ))}
        </div>
        {varyantlar.length===0&&<div style={{padding:24,background:t.card,border:`1px solid ${t.border}`,borderRadius:12,textAlign:"center",color:t.textMuted}}>Önce "Mağaza & Stok" sekmesinde varyant ekleyin</div>}
        {varyantlar.map(v=>{
          const mag = magazalar.find(m=>m.id===v.magazaId);
          return (
            <div key={vKey(v)} onClick={()=>toggle(vKey(v))} style={{display:"flex",alignItems:"center",gap:12,
              padding:"11px 14px",cursor:"pointer",borderRadius:10,
              background:secili.includes(vKey(v))?t.accentBg:t.card,
              border:`1px solid ${secili.includes(vKey(v))?t.accent+"44":t.border}`}}>
              <div style={{width:18,height:18,borderRadius:4,background:secili.includes(vKey(v))?t.accent:t.input,
                border:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {secili.includes(vKey(v))&&<span style={{fontSize:11,color:"#111",fontWeight:700}}>✓</span>}
              </div>
              <span style={{fontSize:12,padding:"2px 8px",borderRadius:6,background:"rgba(201,184,130,.1)",color:"#c9b882"}}>{v.renk}</span>
              <span style={{fontSize:12,padding:"2px 8px",borderRadius:6,background:"rgba(86,204,242,.1)",color:"#56ccf2"}}>{v.beden}</span>
              <span style={{fontSize:11,color:t.textMuted}}>{mag?.ad||v.magazaAd||"—"}</span>
              <span style={{marginLeft:"auto",fontSize:11,color:"#6fcf97"}}>{v.adet} adet</span>
              {v.barkod&&<span style={{fontSize:9,fontFamily:"monospace",color:t.textMuted,marginLeft:6}}>#{v.barkod}</span>}
              {secili.includes(vKey(v))&&(
                <div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:11,color:t.textMuted}}>×</span>
                  <input type="number" value={adetler[vKey(v)]||1} min={1}
                    onChange={e=>setAdetler(p=>({...p,[vKey(v)]:Math.max(1,parseInt(e.target.value)||1)}))}
                    style={{width:50,padding:"3px 6px",borderRadius:6,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,textAlign:"center",outline:"none"}}/>
                </div>
              )}
            </div>
          );
        })}
        {/* QZ Tray Bölümü */}
        <div style={{padding:'12px 14px',background:'rgba(86,204,242,.05)',border:'1px solid rgba(86,204,242,.15)',borderRadius:10,marginBottom:4}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:print.bagli?'#6fcf97':'#eb5757'}}/>
            <span style={{fontSize:12,color:t.textMuted}}>QZ Tray: {print.bagli?'Bağlı':'Bağlı Değil'}</span>
            {!print.bagli&&<button onClick={print.baglan} disabled={print.baglaniyor} style={{fontSize:11,padding:'3px 10px',borderRadius:6,background:'rgba(86,204,242,.1)',border:'1px solid rgba(86,204,242,.2)',color:'#56ccf2'}}>
              {print.baglaniyor?'Bağlanıyor...':'Bağlan'}
            </button>}
          </div>
          {print.bagli&&(
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <select value={print.seciliYazici} onChange={e=>print.yaziciSec(e.target.value)}
                style={{flex:1,padding:'6px 10px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}>
                <option value="">Yazıcı seçin...</option>
                {print.yazicilar.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <select value={print.yaziciModu} onChange={e=>print.yaziciModuSec(e.target.value)}
                title="Yazıcınız 'ZDesigner ... ZPL' sürücüsüyle kuruluysa ZPL, RAW/EML 400L gibi bir yazıcıysa TSPL seçin"
                style={{padding:'6px 10px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}>
                <option value="tspl">TSPL (RAW)</option>
                <option value="zpl">ZPL (ZDesigner)</option>
              </select>
              <button onClick={qzYazdir} disabled={qzYazdiriliyor||!print.seciliYazici||secili.length===0} style={{
                padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:700,
                background:'rgba(86,204,242,.12)',border:'1px solid rgba(86,204,242,.3)',color:'#56ccf2'}}>
                {qzYazdiriliyor?'Gönderiliyor...':'🖨 QZ Tray ile Yazdır'}
              </button>
            </div>
          )}
          {print.bagli&&print.seciliYazici&&(
            <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={kalibreEt} disabled={kalibreEdiliyor} title="Etiket basılıyor ama dışarı çıkmıyor, FEED tuşuna basınca çıkıyorsa kullanın"
                style={{padding:'6px 12px',borderRadius:8,fontSize:11,fontWeight:600,
                  background:'rgba(242,201,76,.1)',border:'1px solid rgba(242,201,76,.3)',color:'#f2c94c'}}>
                {kalibreEdiliyor?'Kalibre ediliyor...':'⚙ Yazıcıyı Kalibre Et'}
              </button>
              {print.yaziciModu==='zpl' && (
                <button onClick={modKaydet} disabled={modKaydediliyor} title="Etiketler tek tek değil, FEED'e basınca toplu çıkıyorsa kullanın (bir kere yeterli)"
                  style={{padding:'6px 12px',borderRadius:8,fontSize:11,fontWeight:600,
                    background:'rgba(111,207,151,.1)',border:'1px solid rgba(111,207,151,.3)',color:'#6fcf97'}}>
                  {modKaydediliyor?'Kaydediliyor...':'💾 Yazıcı Modunu Kaydet (tek tek çıksın)'}
                </button>
              )}
            </div>
          )}
          {print.hata&&<div style={{marginTop:6,fontSize:11,color:'#eb5757'}}>{print.hata}</div>}
        </div>

        <button onClick={yazdir} disabled={secili.length===0} style={{padding:"10px 24px",borderRadius:12,
          background:secili.length>0?"rgba(111,207,151,.12)":t.card,
          border:`1px solid ${secili.length>0?"rgba(111,207,151,.35)":t.border}`,
          color:secili.length>0?"#6fcf97":t.textMuted,fontSize:14,fontWeight:700}}>
          🖨 Tarayıcıdan Yazdır{secili.length>0?` (${secili.reduce((t,id)=>t+(adetler[id]||1),0)} adet)`:""}
        </button>
      </div>
      <div style={{width:250,flexShrink:0}}>
        <div style={{fontSize:12,color:t.textMuted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Önizleme</div>
        {secili.length===0
          ?<div style={{padding:"30px 16px",background:t.card,border:`1px solid ${t.border}`,borderRadius:12,textAlign:"center",color:t.textMuted,fontSize:12}}>Seçince görünür</div>
          :<div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:500,overflowY:"auto"}}>
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
function ResimYonetimi({ resimler=[], onChange, t }) {
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
      setHata('Yükleme hatası: ' + err.message);
    } finally {
      setYukleniyor(false);
      e.target.value = '';
    }
  };

  const urlEkle = () => {
    const url = window.prompt("Resim URL'si girin:");
    if (url?.trim()) onChange([...resimler, { url: url.trim(), kaynak: 'url', ad: url.trim().split('/').pop() }]);
  };

  const sil = (i) => onChange(resimler.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => fileRef.current?.click()} disabled={yukleniyor} style={{
          padding: '9px 16px', borderRadius: 10, background: t.accentBg,
          border: `1px solid ${t.accent}44`, color: t.accent, fontSize: 13,
          opacity: yukleniyor ? .6 : 1
        }}>{yukleniyor ? '⏳ Yükleniyor...' : '📁 Dosyadan Ekle'}</button>
        <button onClick={urlEkle} style={{
          padding: '9px 16px', borderRadius: 10, background: t.input,
          border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 13
        }}>🔗 URL'den Ekle</button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={dosyaEkle} />
        <span style={{ fontSize: 11, color: t.textMuted, alignSelf: 'center' }}>{resimler.length} resim</span>
        {hata && <span style={{ fontSize: 11, color: '#eb5757' }}>{hata}</span>}
      </div>

      {resimler.length === 0 && (
        <div style={{ padding: '32px', textAlign: 'center', border: `2px dashed ${t.border}`, borderRadius: 12, color: t.textMuted, fontSize: 13 }}>
          Henüz resim yok — dosya yükleyin veya URL ekleyin
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {resimler.map((r, i) => (
          <div key={`upload_resim_${i}`} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.bg }}>
            <img src={r.url || r} alt={r.ad || `Resim ${i+1}`} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
              onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="130"><rect fill="%23222" width="150" height="130"/><text x="75" y="65" fill="%23555" text-anchor="middle" dy=".35em">⚠ Yüklenemedi</text></svg>' }} />
            <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, color: t.textMuted }}>
                {r.kaynak === 'ticimax' ? '🔗 Ticimax' : r.kaynak === 'yuklu' ? '📁 Yüklendi' : '🔗 URL'}
              </span>
              <button onClick={() => sil(i)} style={{ fontSize: 11, color: '#eb5757', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
            </div>
            {i === 0 && <div style={{ position: 'absolute', top: 6, left: 6, fontSize: 9, background: t.accent, color: '#111', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>ANA</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RenkGruplariEditor({ value = '', onChange, t }) {
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
    <div>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Renk Grupları (custom.renk_gruplari)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {seciliGruplar.length > 0 ? seciliGruplar.map(grup => (
          <button
            key={grup}
            type="button"
            onClick={() => toggle(grup)}
            style={{
              padding: '5px 10px',
              borderRadius: 18,
              background: 'rgba(86,204,242,.12)',
              border: '1px solid rgba(86,204,242,.35)',
              color: '#56ccf2',
              fontSize: 11
            }}
          >
            {grup} ×
          </button>
        )) : (
          <div style={{ fontSize: 11, color: t.textMuted }}>Henüz seçim yok</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={yeniGrup}
          onChange={e => setYeniGrup(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ekle()}
          placeholder="Grup adı ekle"
          style={{ flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }}
        />
        <button
          type="button"
          onClick={ekle}
          style={{ padding: '9px 14px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}44`, color: t.accent, fontSize: 13 }}
        >
          Ekle
        </button>
        {seciliGruplar.length > 0 && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ padding: '9px 14px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 13 }}
          >
            Temizle
          </button>
        )}
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {['Siyah', 'Beyaz', 'Krem', 'Kahve', 'Lacivert', 'Bordo', 'Gri', 'Bej', 'Yeşil', 'Pembe', 'Sarı', 'Turuncu', 'Mor'].map(grup => (
          <button
            key={grup}
            type="button"
            onClick={() => toggle(grup)}
            style={{
              padding: '5px 10px',
              borderRadius: 18,
              background: seciliGruplar.includes(grup) ? 'rgba(201,184,130,.18)' : t.input,
              border: `1px solid ${seciliGruplar.includes(grup) ? 'rgba(201,184,130,.5)' : t.border}`,
              color: seciliGruplar.includes(grup) ? '#c9b882' : t.textMuted,
              fontSize: 11
            }}
          >
            {grup}
          </button>
        ))}
      </div>
    </div>
  )
}


function UrunForm({ urun, onKaydet, onIptal, t, magazalar, markalar=[], kategoriler=[], onMarkaEkle, onMarkaSil, ticimaxUrunler=[] }) {
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

  if (!form) return <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>⏳ Yükleniyor...</div>;

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
    if (!form?.ad || !form?.satisF) return alert('Ürün adı ve satış fiyatı zorunlu!')
    setPublishing(true)
    try {
      await shopifyYayinla({ urun: buildShopifyPayload(), urunId: form.id })
      alert('Shopify yayını başarıyla tamamlandı.')
    } catch (err) {
      alert('Shopify yayını hatası: ' + (err.message || err))
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
    if (!form.ad || !form.satisF) return alert('Ürün adı ve satış fiyatı zorunlu!');
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
      onKaydet();
    } catch (err) {
      alert('Kayıt hatası: ' + err.message);
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
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: t.text }}>
            {urun ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span>Kod: {form.kod}</span>
            {form._ticimaxKaynakli && <span style={{ color: '#56ccf2' }}>● Ticimax #{form._ticimaxId}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!urun && ticimaxUrunler.length > 0 && (
            <button onClick={() => setTicimaxSec(v => !v)} style={{
              padding: '9px 16px', borderRadius: 10, background: ticimaxSec ? 'rgba(86,204,242,.15)' : t.input,
              border: `1px solid ${ticimaxSec ? 'rgba(86,204,242,.4)' : t.border}`, color: ticimaxSec ? '#56ccf2' : t.textMuted, fontSize: 13
            }}>📦 Ticimax'tan Doldur</button>
          )}
          <button onClick={onIptal} style={{ padding: '9px 20px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 13 }}>← İptal</button>
          <button onClick={publishToShopify} disabled={publishing} style={{
            padding: '9px 20px', borderRadius: 10, background: '#1d7f53', border: '1px solid rgba(111,207,151,.4)', color: '#e8f7ed', fontSize: 13, fontWeight: 700
          }}>{publishing ? 'Gönderiliyor...' : "➡ Shopify'a Gönder"}</button>
          <button onClick={kaydet} disabled={yukleniyor} style={{
            padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: t.accentBg, border: `1px solid ${t.accent}55`, color: t.accent
          }}>{yukleniyor ? 'Kaydediliyor...' : '💾 Kaydet'}</button>
        </div>
      </div>

      {/* Ticimax seçim paneli */}
      {ticimaxSec && (
        <div style={{ marginBottom: 20, background: 'rgba(86,204,242,.04)', border: '1px solid rgba(86,204,242,.2)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(86,204,242,.15)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <input value={txArama} onChange={e => setTxArama(e.target.value)}
              placeholder="Ticimax'ta ara..." autoFocus
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(86,204,242,.3)', background: t.bg, color: t.text, fontSize: 13, outline: 'none' }} />
            <span style={{ fontSize: 12, color: '#56ccf2' }}>{txFiltreli.length} ürün</span>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {txFiltreli.slice(0, 50).map(tx => {
              const ilkSec = tx.secenekler?.[0] || {};
              return (
                <div key={tx.urunKartiID} onClick={() => ticimaxDoldur(tx)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(86,204,242,.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {tx.resimler?.[0]
                    ? <img src={tx.resimler[0]} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                    : <div style={{ width: 40, height: 40, borderRadius: 6, background: t.bg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👜</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.urunAdi}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>
                      {tx.marka && <span style={{ marginRight: 8 }}>{tx.marka}</span>}
                      <span style={{ color: '#56ccf2' }}>{tx.secenekler?.filter(s => s.aktif !== '0').length || 0} varyant</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>
                      {ilkSec.satisFiyati ? `₺${Number(ilkSec.satisFiyati).toLocaleString('tr-TR')}` : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: '#56ccf2' }}>Seç →</div>
                  </div>
                </div>
              );
            })}
            {txFiltreli.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>Sonuç bulunamadı</div>}
          </div>
        </div>
      )}

      {/* Sekmeler */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, borderBottom: `1px solid ${t.border}` }}>
        {[['temel','📋 Temel Bilgiler'],['resimler',`🖼 Resimler${form.resimler?.length ? ` (${form.resimler.length})` : ''}`],['varyantlar','🏪 Mağaza & Stok'],['barkod','▦ Barkod & Etiket']].map(([k,l]) => (
          <button key={k} onClick={() => setSekme(k)} style={{
            padding: '9px 18px', borderRadius: '10px 10px 0 0', fontSize: 12,
            background: sekme === k ? t.accentBg : 'transparent',
            border: `1px solid ${sekme === k ? t.accent + '44' : 'transparent'}`,
            borderBottom: sekme === k ? `1px solid ${t.bg}` : '',
            color: sekme === k ? t.accent : t.textMuted
          }}>{l}</button>
        ))}
      </div>

      {/* TEMEL BİLGİLER */}
      {sekme === 'temel' && (
        <div className="vega-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Ürün Adı *</div>
              <input value={form.ad} onChange={e => g('ad', e.target.value)} placeholder="örn. Deri Omuz Çantası"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Marka</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={form.marka || ''} onChange={e => g('marka', e.target.value)}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }}>
                  <option value="">Seçiniz...</option>
                  {markalar.map(m => <option key={m.id} value={m.ad}>{m.ad}</option>)}
                </select>
                <button onClick={async () => { const ad = window.prompt('Yeni marka adı:'); if (ad?.trim()) { await onMarkaEkle(ad.trim()); g('marka', ad.trim()); } }}
                  style={{ padding: '9px 12px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}44`, color: t.accent, fontSize: 13 }}>+ Ekle</button>
                {form.marka && markalar.find(m => m.ad === form.marka) && (
                  <button onClick={async () => {
                    if (!window.confirm(`"${form.marka}" markası silinsin mi?`)) return;
                    const m = markalar.find(x => x.ad === form.marka);
                    if (m) { await onMarkaSil(m.id); g('marka', ''); }
                  }} style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(235,87,87,.1)', border: '1px solid rgba(235,87,87,.3)', color: '#eb5757', fontSize: 13 }}>🗑</button>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Açıklama</div>
              <textarea value={form.aciklama || ''} onChange={e => g('aciklama', e.target.value)} rows={4}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>SKU</div>
                <input type="text" value={form.sku || ''} onChange={e => g('sku', e.target.value)}
                  placeholder="Örn. SKU-001"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Barkod</div>
                <input type="text" value={form.barkod || ''} onChange={e => {
                  const value = e.target.value
                  g('barkod', value)
                  // Ayakkabıda her numaranın kendi ayrı barkodu var — buradan tek bir
                  // değer girilip TÜM numaralara aynı barkodun basılması yanlış olur,
                  // bu yüzden mirror sadece ayakkabı olmayan (tekil stoklu) ürünlerde yapılır.
                  if (form.kategori !== 'Ayakkabı') {
                    g('varyantlar', (form.varyantlar || []).map(v => ({ ...v, barkod: value })))
                  }
                }}
                  placeholder="Ürün barkodu"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Renk Adı</div>
              <input type="text" value={form.renkAdi || ''} onChange={e => g('renkAdi', e.target.value)}
                placeholder="örn. Siyah"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Video (mp4, custom.video)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="text" value={form.video || ''} onChange={e => g('video', e.target.value)} placeholder="Video URL girin veya yükleyin"
                  style={{ flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }} />
                <button type="button" onClick={() => videoInputRef.current?.click()} disabled={videoUploading}
                  style={{ padding: '9px 16px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}44`, color: t.accent, fontSize: 13 }}>
                  {videoUploading ? 'Yükleniyor...' : 'Video Yükle'}
                </button>
              </div>
              {videoUploadError && <div style={{ marginTop: 8, fontSize: 11, color: '#eb5757' }}>{videoUploadError}</div>}
              <input ref={videoInputRef} type="file" accept=".mp4,video/mp4" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files?.[0];
                if (file) uploadVideoFile(file);
                e.target.value = '';
              }} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Malzeme (custom.malzeme)</div>
              <input
                type="text"
                value={form.malzeme || ''}
                onChange={e => g('malzeme', e.target.value)}
                placeholder="Deri, süet, tekstil..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }}
              />
            </div>

            <RenkGruplariEditor value={form.renkGruplari || ''} onChange={v => g('renkGruplari', v)} t={t} />

            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Kritik Stok</div>
              <input type="number" min={0} value={form.kritikStok} onChange={e => g('kritikStok', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>Kategori *</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.keys(KATEGORILER).map(k => (
                  <button key={k} onClick={() => g('kategori', k)} style={{
                    flex: 1, minWidth: 80, padding: '9px 0', borderRadius: 10,
                    background: form.kategori === k ? t.accentBg : t.input,
                    border: `1.5px solid ${form.kategori === k ? t.accent + '55' : t.border}`,
                    color: form.kategori === k ? t.accent : t.textMuted, fontSize: 13, fontWeight: form.kategori === k ? 600 : 400
                  }}>{k}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>Alt Kategori</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {(KATEGORILER[form.kategori] || []).map(k => (
                  <button key={k} onClick={() => g('altKategori', k)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11,
                    background: form.altKategori === k ? 'rgba(86,204,242,.12)' : t.input,
                    border: `1px solid ${form.altKategori === k ? 'rgba(86,204,242,.4)' : t.border}`,
                    color: form.altKategori === k ? '#56ccf2' : t.textMuted
                  }}>{k}</button>
                ))}
                {form.altKategori && !(KATEGORILER[form.kategori] || []).includes(form.altKategori) && (
                  <button onClick={() => g('altKategori', form.altKategori)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11,
                    background: 'rgba(86,204,242,.12)', border: '1px solid rgba(86,204,242,.4)', color: '#56ccf2'
                  }}>{form.altKategori} ×</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={yeniAltKategori}
                  onChange={e => setYeniAltKategori(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && yeniAltKategori.trim()) { g('altKategori', yeniAltKategori.trim()); setYeniAltKategori(''); } }}
                  placeholder="Listede yoksa yeni alt kategori yazıp ekleyin"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 12, outline: 'none' }}
                />
                <button onClick={() => { if (yeniAltKategori.trim()) { g('altKategori', yeniAltKategori.trim()); setYeniAltKategori(''); } }}
                  style={{ padding: '8px 14px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}44`, color: t.accent, fontSize: 12 }}>+ Ekle</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[{ l: 'Alış Fiyatı', k: 'alisF' }, { l: 'Satış Fiyatı *', k: 'satisF' }].map(f => (
                <div key={f.k}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>{f.l}</div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, fontSize: 13 }}>₺</span>
                    <input type="number" value={form[f.k]} onChange={e => g(f.k, e.target.value)}
                      style={{ width: '100%', padding: '9px 12px 9px 26px', borderRadius: 10, background: t.input, border: `1px solid ${t.border}`, color: t.accent, fontSize: 14, fontWeight: 600, outline: 'none' }} />
                  </div>
                </div>
              ))}
            </div>

            {kar && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: kar > 40 ? 'rgba(111,207,151,.08)' : kar > 25 ? 'rgba(242,201,76,.08)' : 'rgba(235,87,87,.08)',
                border: `1px solid ${kar > 40 ? 'rgba(111,207,151,.2)' : kar > 25 ? 'rgba(242,201,76,.2)' : 'rgba(235,87,87,.2)'}`
              }}>
                <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>Kar Marjı</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(kar, 100)}%`, height: '100%', borderRadius: 3, background: kar > 40 ? '#6fcf97' : kar > 25 ? '#f2c94c' : '#eb5757' }} />
                  </div>
                  <span style={{ fontSize: 17, fontWeight: 700, color: kar > 40 ? '#6fcf97' : kar > 25 ? '#f2c94c' : '#eb5757' }}>%{kar}</span>
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>KDV %</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 10, 20].map(k => (
                  <button key={k} onClick={() => g('kdv', k)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12,
                    background: form.kdv === k ? t.accentBg : t.input,
                    border: `1px solid ${form.kdv === k ? t.accent + '55' : t.border}`,
                    color: form.kdv === k ? t.accent : t.textMuted
                  }}>%{k}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESİMLER */}
      {sekme === 'resimler' && (
        <ResimYonetimi
          resimler={form.resimler || []}
          onChange={r => g('resimler', r)}
          t={t}
        />
      )}

      {sekme === 'varyantlar' && (
        <VaryantEditor
          kategori={form.kategori}
          varyantlar={form.varyantlar || []}
          onChange={v => g('varyantlar', v)}
          magazalar={magazalar}
          urunBilgi={form}
        />
      )}
      {sekme === 'barkod' && <BarkodEtiketSayfasi urun={form} magazalar={magazalar} t={t} />}
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

function TicimaxImportModal({ onKapat, onImportTamamlandi, t, magazalar, markalar, setMarkalar }) {
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
    if (!seciliUrunler.length) return alert('En az bir ürün seçin!');
    if (!seciliMagazaId) return alert('Lütfen bir mağaza seçin!');
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
    if (!seciliMagazaId) { alert('Lütfen bir mağaza seçin!'); return; }

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

  const modalStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
  };
  const boxStyle = {
    background:  '#000', border: `1px solid ${t.border}`, borderRadius: 16,
    width: '100%', maxWidth: 780, maxHeight: '88vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden'
  };

  return (
    <div style={modalStyle} onClick={onKapat}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>📥 Ticimax'tan Ürün İçe Aktar</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>
              {adim === 'yukleniyor' && 'Ticimax bağlantısı kuruluyor...'}
              {adim === 'secim' && `${ticimaxUrunler.length} ürün bulundu · ${secilenler.size} seçildi`}
              {adim === 'stokGiris' && `${secilenler.size} ürün için mağaza stok girişi`}
              {adim === 'importing' && `İçe aktarılıyor... ${ilerleme.tamamlanan}/${ilerleme.toplam}`}
              {adim === 'tamamlandi' && 'İşlem tamamlandı'}
            </div>
          </div>
          <button onClick={onKapat} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 18 }}>✕</button>
        </div>

        {/* Yükleniyor */}
        {adim === 'yukleniyor' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, fontSize: 14 }}>
            ⏳ Ticimax'tan ürünler çekiliyor...
          </div>
        )}

        {/* Hata */}
        {adim === 'hata' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ fontSize: 14, color: '#eb5757', textAlign: 'center' }}>Ticimax bağlantısı kurulamadı</div>
            <div style={{ fontSize: 12, color: t.textMuted, fontFamily: 'monospace', background: t.bg, padding: '8px 14px', borderRadius: 8 }}>{hata}</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>Backend'in <code>http://localhost:3001/api/ticimax-urunler</code> adresinin çalıştığından emin olun</div>
          </div>
        )}

        {/* Seçim ekranı */}
        {adim === 'secim' && (
          <>
            {/* Araç çubuğu */}
            <div style={{ padding: '12px 24px', borderBottom: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                placeholder="Ürün adı, marka, ID ara..."
                value={aramaQ}
                onChange={e => setAramaQ(e.target.value)}
                style={{ flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 13, outline: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap' }}>Mağaza:</span>
                <select value={seciliMagazaId} onChange={e => setSeciliMagazaId(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 13, outline: 'none' }}>
                  {magazalar.map(m => <option key={m.id} value={m.id}>{m.ikon || '🏪'} {m.ad}</option>)}
                </select>
              </div>
              <button onClick={tumunuSec} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>
                {filtreliUrunler.every(u => secilenler.has(u.urunKartiID)) ? '☐ Tümünü Kaldır' : '☑ Tümünü Seç'}
              </button>
            </div>

            {/* Liste */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtreliUrunler.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>Sonuç bulunamadı</div>
              )}
              {filtreliUrunler.map(u => {
                const secili = secilenler.has(u.urunKartiID);
                const ilkSec = u.secenekler[0] || {};
                const { kategori } = kategoriEsle(u.kategoriTree);
                const aktifSecSayisi = u.secenekler.filter(s => s.aktif !== '0').length;
                return (
                  <div key={u.urunKartiID} onClick={() => toggle(u.urunKartiID)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px',
                      borderBottom: `1px solid ${t.border}`, cursor: 'pointer',
                      background: secili ? `${t.accent}08` : 'transparent',
                      transition: 'background .15s'
                    }}>
                    {/* Checkbox */}
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${secili ? t.accent : t.border}`, background: secili ? t.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {secili && <span style={{ fontSize: 12, color: '#111', fontWeight: 900 }}>✓</span>}
                    </div>
                    {/* Küçük resim */}
                    {u.resimler[0]
                      ? <img src={u.resimler[0]} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: `1px solid ${t.border}`, flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                      : <div style={{ width: 44, height: 44, borderRadius: 6, border: `1px solid ${t.border}`, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👜</div>
                    }
                    {/* Bilgiler */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.urunAdi}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                        {u.marka && <span style={{ marginRight: 8 }}>🏷 {u.marka}</span>}
                        <span style={{ marginRight: 8 }}>📁 {kategori}</span>
                        <span style={{ color: '#56ccf2' }}>⚡ {aktifSecSayisi} varyant</span>
                      </div>
                    </div>
                    {/* Fiyat */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>
                        {ilkSec.satisFiyati ? `₺${Number(ilkSec.satisFiyati).toLocaleString('tr-TR')}` : '—'}
                      </div>
                      <div style={{ fontSize: 10, color: t.textMuted }}>
                        Alış: {ilkSec.alisFiyati ? `₺${Number(ilkSec.alisFiyati).toLocaleString('tr-TR')}` : '—'}
                      </div>
                    </div>
                    {/* Durum */}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: u.aktif === '1' ? '#6fcf97' : '#666', flexShrink: 0 }} title={u.aktif === '1' ? 'Aktif' : 'Pasif'} />
                  </div>
                );
              })}
            </div>

            {/* Alt bar */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: t.bg }}>
              <div style={{ fontSize: 12, color: t.textMuted }}>
                <span style={{ color: t.accent, fontWeight: 700 }}>{secilenler.size}</span> ürün seçildi
                {seciliMagazaId && <span style={{ marginLeft: 8 }}>→ <span style={{ color: '#56ccf2' }}>{magazalar.find(m => m.id === seciliMagazaId)?.ad}</span> mağazasına</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onKapat} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 13 }}>İptal</button>
                <button onClick={stokGirisineGec} disabled={secilenler.size === 0 || !seciliMagazaId}
                  style={{ padding: '9px 22px', borderRadius: 10, background: secilenler.size > 0 ? t.accentBg : t.bg, border: `1px solid ${secilenler.size > 0 ? t.accent + '55' : t.border}`, color: secilenler.size > 0 ? t.accent : t.textMuted, fontSize: 13, fontWeight: 700 }}>
                  {secilenler.size > 0 ? `${secilenler.size} Ürün Seçildi → Stok Girişi` : 'Ürün Seçin'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* STOK GİRİŞİ ADIMI */}
        {adim === 'stokGiris' && (
          <>
            <div style={{ padding: '12px 24px', borderBottom: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>
                Mağazaya kaç adet alınacak?
              </div>
              <div style={{ fontSize: 11, color: t.textMuted }}>
                Tedarikçi stoğu referans — siz mağaza adedini girin
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ticimaxUrunler.filter(u => secilenler.has(u.urunKartiID)).map(u => (
                <div key={u.urunKartiID} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {/* Ürün başlık */}
                  <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {u.resimler?.[0] && <img src={u.resimler[0]} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} onError={e => e.target.style.display='none'} />}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{u.urunAdi}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{u.marka}</div>
                    </div>
                  </div>
                  {/* Varyant satırları */}
                  <div>
                    {u.secenekler.filter(s => s.aktif !== '0').map((s, si) => {
                      const { renk, beden } = secenektenRenkBeden(s);
                      const stokKey = `${u.urunKartiID}__${renk||'Standart'}__${beden||''}`;
                      const tedarikciStok = parseInt(s.stokAdedi) || 0;
                      const mevcutAdet = stokAdetleri[stokKey] ?? 0;
                      return (
                        <div key={`stokgiris_${stokKey}_${si}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${t.border}` }}>
                          {renk && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(201,184,130,.1)', color: '#c9b882' }}>{renk}</span>}
                          {beden && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(86,204,242,.1)', color: '#56ccf2' }}>{beden}</span>}
                          {/* Tedarikçi stoğu - sadece referans */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                            <span style={{ fontSize: 11, color: t.textMuted }}>Tedarikçi:</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: tedarikciStok > 0 ? '#56ccf2' : '#555' }}>{tedarikciStok}</span>
                          </div>
                          {/* Mağaza giriş adedi */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: t.textMuted }}>Mağazaya:</span>
                            <button onClick={() => setStokAdetleri(p => ({ ...p, [stokKey]: Math.max(0, (p[stokKey]??0) - 1) }))}
                              style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 14, cursor: 'pointer' }}>−</button>
                            <input type="number" min={0} max={tedarikciStok}
                              value={mevcutAdet}
                              onChange={e => setStokAdetleri(p => ({ ...p, [stokKey]: Math.max(0, parseInt(e.target.value)||0) }))}
                              style={{ width: 56, padding: '4px 6px', borderRadius: 6, border: `1px solid ${t.accent}44`, background: t.bg, color: t.accent, fontSize: 14, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                            <button onClick={() => setStokAdetleri(p => ({ ...p, [stokKey]: Math.min(tedarikciStok, (p[stokKey]??0) + 1) }))}
                              style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 14, cursor: 'pointer' }}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0, background: t.bg }}>
              <button onClick={() => setAdim('secim')} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 13 }}>← Geri</button>
              <button onClick={importBaslat} style={{ padding: '9px 22px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accent}55`, color: t.accent, fontSize: 13, fontWeight: 700 }}>
                📥 Aktarımı Başlat
              </button>
            </div>
          </>
        )}

        {/* İçe aktarılıyor */}
        {adim === 'importing' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40 }}>
            <div style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>
              {ilerleme.tamamlanan} / {ilerleme.toplam} ürün aktarıldı
            </div>
            <div style={{ width: '100%', maxWidth: 400, height: 8, background: t.bg, borderRadius: 4, overflow: 'hidden', border: `1px solid ${t.border}` }}>
              <div style={{ height: '100%', background: t.accent, borderRadius: 4, width: `${(ilerleme.tamamlanan / ilerleme.toplam) * 100}%`, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 11, color: t.textMuted }}>Barkodlar sistem tarafından üretiliyor...</div>
          </div>
        )}

        {/* Tamamlandı */}
        {adim === 'tamamlandi' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
              {ilerleme.tamamlanan - ilerleme.hatalar.length} ürün başarıyla aktarıldı
            </div>
            {ilerleme.hatalar.length > 0 && (
              <div style={{ width: '100%', maxWidth: 480 }}>
                <div style={{ fontSize: 12, color: '#eb5757', marginBottom: 8 }}>⚠ {ilerleme.hatalar.length} ürün aktarılamadı:</div>
                <div style={{ maxHeight: 120, overflowY: 'auto', background: t.bg, borderRadius: 8, padding: '8px 12px', border: `1px solid ${t.border}` }}>
                  {ilerleme.hatalar.map((h, i) => (
                    <div key={i} style={{ fontSize: 11, color: t.textMuted, padding: '3px 0', borderBottom: `1px solid ${t.border}` }}>
                      <span style={{ color: '#eb5757' }}>✕</span> {h.ad} — <span style={{ fontFamily: 'monospace' }}>{h.hata}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => { onImportTamamlandi(); onKapat(); }}
              style={{ padding: '10px 28px', borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accent}55`, color: t.accent, fontSize: 13, fontWeight: 700 }}>
              ✓ Tamam — Listeyi Yenile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



// ─── ÜRÜN LİSTESİ ─────────────────────────────────────────────
const URUN_SAYFA_BOYUTU = 30;

function UrunListesi({
  magazalar, markalar=[], onDuzenle, onSil, rol, t, aktifMagazaId, ticimaxUrunler=[], q, setQ,
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

  const mc = n => n<=0?"#eb5757":n<=3?"#f2c94c":"#6fcf97";

  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
        <input value={q} onChange={e=>{setQ(e.target.value);setSayfa(1);}} placeholder="🔍 Ad, kod, barkod, marka..."
          style={{flex:1,minWidth:200,padding:"9px 14px",borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:"none"}}/>
        <div style={{display:"flex",gap:6}}>
          {["Tümü","Çanta","Ayakkabı","Cüzdan"].map(k=>(
            <button key={k} onClick={()=>filtreDegisti(setKat)(k)} style={{padding:"8px 14px",borderRadius:20,fontSize:12,
              background:kat===k?t.accentBg:t.input,border:`1px solid ${kat===k?t.accent+"44":t.border}`,
              color:kat===k?t.accent:t.textMuted}}>{k}</button>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <select value={marka} onChange={e=>filtreDegisti(setMarka)(e.target.value)}
          style={{padding:"9px 12px",borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,minWidth:140}}>
          <option value="">Tüm Markalar</option>
          {markalar.map(m=><option key={m.id||m.ad} value={m.ad}>{m.ad}</option>)}
        </select>

        <select value={stokDurum} onChange={e=>filtreDegisti(setStokDurum)(e.target.value)}
          style={{padding:"9px 12px",borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,minWidth:130}}>
          <option value="hepsi">Tüm Stoklar</option>
          <option value="stokta">Stokta Var</option>
          <option value="kritik">⚠ Kritik Stok</option>
          <option value="tukendi">Tükendi</option>
        </select>

        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <input value={fiyatMin} onChange={e=>setFiyatMin(e.target.value)} placeholder="Min ₺" type="number"
            style={{width:90,padding:"9px 10px",borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:"none"}}/>
          <span style={{color:t.textMuted,fontSize:12}}>—</span>
          <input value={fiyatMax} onChange={e=>setFiyatMax(e.target.value)} placeholder="Max ₺" type="number"
            style={{width:90,padding:"9px 10px",borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:"none"}}/>
        </div>

        {(marka||kat!=="Tümü"||stokDurum!=="hepsi"||fiyatMin||fiyatMax||q) && (
          <button onClick={()=>{setQ("");setMarka("");setKat("Tümü");setStokDurum("hepsi");setFiyatMin("");setFiyatMax("");setSayfa(1);}}
            style={{padding:"8px 14px",borderRadius:20,fontSize:12,background:"transparent",border:`1px solid ${t.border}`,color:t.textMuted}}>
            ✕ Filtreleri Temizle
          </button>
        )}

        {yukleniyor && <span style={{fontSize:11,color:t.textMuted}}>⏳ Yükleniyor...</span>}
      </div>

      {/* Mağaza bazlı stok özeti — uygulanan filtreye uyan TÜM ürünlerin toplamı.
          Her mağaza ayrı ayrı + genel toplam gösterilir. */}
      {(() => {
        const gorunenMagazalar = magazalar.filter(m => !aktifMagazaId || m.id === aktifMagazaId);
        const genelToplam = gorunenMagazalar.reduce((s,m)=>s+(magazaStoklari[m.id]||0),0);
        if (gorunenMagazalar.length === 0) return null;
        return (
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
            {gorunenMagazalar.map(m=>{
              const adet = magazaStoklari[m.id] || 0;
              return (
                <div key={m.id} style={{padding:"8px 14px",borderRadius:10,background:t.bg,border:`1px solid ${t.border}`,minWidth:104}}>
                  <div style={{fontSize:10,color:t.textMuted,marginBottom:2}}>{m.ikon||"🏪"} {m.ad}</div>
                  <div style={{fontSize:16,fontWeight:800,color:mc(adet)}}>
                    {adet}<span style={{fontSize:9,color:t.textMuted,fontWeight:400,marginLeft:3}}>adet</span>
                  </div>
                </div>
              );
            })}
            {gorunenMagazalar.length > 1 && (
              <div style={{padding:"8px 14px",borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}33`,minWidth:104}}>
                <div style={{fontSize:10,color:t.textMuted,marginBottom:2}}>📊 Toplam</div>
                <div style={{fontSize:16,fontWeight:800,color:t.accent}}>
                  {genelToplam}<span style={{fontSize:9,color:t.textMuted,fontWeight:400,marginLeft:3}}>adet</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {aktifMagazaId && (
        <div style={{marginBottom:14,padding:"10px 16px",background:t.accentBg,border:`1px solid ${t.accent}44`,borderRadius:10,fontSize:12,color:t.accent}}>
          📍 {magazalar.find(m=>m.id===aktifMagazaId)?.ad||"Seçili Mağaza"} stoğu gösteriliyor
        </div>
      )}

      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden"}}>
        <div className="vega-scroll-x">
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
              <th style={{padding:"11px 14px",width:32}}/>
              {["Kod","Ürün","Kategori","Mağaza Stok","Tedarikçi",...(maliyetGorebilir?["Satış","Alış","Kar %"]:["Satış"]),"İşlem"].map(h=>(
                <th key={h} style={{padding:"11px 14px",fontSize:10,color:t.textMuted,fontWeight:500,textAlign:"left",letterSpacing:.3}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sayfaliUrunler.map(u=>{
              const toplam = stokTopla(u, aktifMagazaId);
              const kritik = toplam<=(u.kritikStok??0);
              const kar = maliyetGorebilir&&u.alisF&&u.satisF?(((u.satisF-u.alisF)/u.satisF)*100).toFixed(1):null;
              const acik = aciklar[u.id];

              return [
                <tr key={u.id} style={{borderBottom:acik?"none":`1px solid ${t.border}`}}>
                  <td style={{padding:"11px 8px 11px 14px",textAlign:"center"}}>
                    <button onClick={()=>setAciklar(p=>({...p,[u.id]:!p[u.id]}))} style={{
                      width:22,height:22,borderRadius:6,fontSize:11,fontWeight:700,
                      background:acik?t.accentBg:t.input,border:`1px solid ${acik?t.accent+"44":t.border}`,
                      color:acik?t.accent:t.textMuted}}>{acik?"▲":"▼"}</button>
                  </td>
                  <td style={{padding:"11px 14px",fontSize:11,color:t.textMuted,fontFamily:"monospace"}}>{u.kod}</td>
                  <td style={{padding:"11px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      {(()=>{
                        const tx=ticimaxEsles(u);
                        const imgUrl = (u.resimler&&u.resimler[0]) || tx?.resimler?.[0];
                        return imgUrl
                          ? <img src={imgUrl} alt="" style={{width:36,height:36,objectFit:"cover",borderRadius:6,border:`1px solid ${t.border}`,flexShrink:0}} onError={e=>e.target.style.display="none"}/>
                          : <div style={{width:36,height:36,borderRadius:6,border:`1px solid ${t.border}`,background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>👜</div>;
                      })()}
                      <div>
                        <div style={{fontSize:13,color:t.text,fontWeight:500}}>{u.ad}</div>
                        <div style={{fontSize:10,color:t.textMuted}}>{u.marka}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:"11px 14px"}}>
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:t.hover,color:t.textMuted}}>{u.kategori}</span>
                  </td>
                  <td style={{padding:"11px 14px"}}>
                    <span style={{fontSize:14,fontWeight:700,color:mc(toplam)}}>{toplam}</span>
                    {kritik&&<span style={{fontSize:10,color:"#eb5757",marginLeft:4}}>⚠</span>}
                  </td>
                  <td style={{padding:"11px 14px"}}>
                    {(()=>{const tx=ticimaxEsles(u);const ts=tedarikStok(tx);return ts!=null?<span style={{fontSize:13,fontWeight:600,color:ts>10?"#56ccf2":ts>0?"#f2c94c":"#666"}}>{ts}<span style={{fontSize:9,color:t.textMuted,marginLeft:3}}>adet</span></span>:<span style={{fontSize:11,color:t.textMuted}}>—</span>;})()}
                  </td>
                  <td style={{padding:"11px 14px",fontSize:13,fontWeight:600,color:t.accent}}>{para(u.satisF)}</td>
                  {maliyetGorebilir&&<td style={{padding:"11px 14px",fontSize:12,color:t.textMuted}}>{para(u.alisF)}</td>}
                  {maliyetGorebilir&&<td style={{padding:"11px 14px"}}>
                    {kar&&<span style={{fontSize:12,fontWeight:600,color:kar>40?"#6fcf97":kar>25?"#f2c94c":"#eb5757"}}>%{kar}</span>}
                  </td>}
                  <td style={{padding:"11px 14px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>onDuzenle(u)} style={{fontSize:11,padding:"5px 10px",borderRadius:7,background:"rgba(86,204,242,.08)",border:"1px solid rgba(86,204,242,.2)",color:"#56ccf2"}}>Düzenle</button>
                      <button onClick={()=>handleSil(u.id)} style={{fontSize:11,padding:"5px 10px",borderRadius:7,background:"rgba(235,87,87,.06)",border:"1px solid rgba(235,87,87,.15)",color:"#eb5757"}}>Sil</button>
                    </div>
                  </td>
                </tr>,

                acik && (
                  <tr key={`${u.id}_d`} style={{borderBottom:`1px solid ${t.border}`}}>
                    <td colSpan={maliyetGorebilir?10:8} style={{padding:"0 0 0 0",background:"rgba(255,255,255,.015)"}}>
                      {(()=>{
                        const tx = ticimaxEsles(u);
                        const sek = detaySekme[u.id] || 'magaza';
                        const setSek = (s) => setDetaySekme(p=>({...p,[u.id]:s}));
                        return (
                          <div style={{padding:"16px 20px 20px 52px"}}>
                            {/* Sekme bar */}
                            <div style={{display:"flex",gap:3,marginBottom:14,borderBottom:`1px solid ${t.border}`,paddingBottom:0}}>
                              {[
                                {id:"magaza",   l:"🏪 Mağaza Stokları"},
                                {id:"tedarik",  l:"📦 Tedarikçi Stoku", disabled:!tx},
                                {id:"resimler", l:"🖼 Resimler", disabled:!tx?.resimler?.length},
                                {id:"detay",    l:"📋 Ürün Bilgisi"},
                              ].map(s=>(
                                <button key={s.id} onClick={()=>!s.disabled&&setSek(s.id)} style={{
                                  padding:"6px 14px",borderRadius:"8px 8px 0 0",fontSize:11,
                                  background:sek===s.id?t.accentBg:"transparent",
                                  border:`1px solid ${sek===s.id?t.accent+"44":"transparent"}`,
                                  borderBottom:sek===s.id?`1px solid ${t.bg}`:"",
                                  color:sek===s.id?t.accent:s.disabled?"#333":t.textMuted,
                                  opacity:s.disabled?.5:1,cursor:s.disabled?"default":"pointer"
                                }}>{s.l}</button>
                              ))}
                              {tx&&<div style={{marginLeft:"auto",fontSize:10,color:t.textMuted,alignSelf:"center",paddingRight:4}}>
                                Ticimax ID: {tx.urunKartiID}
                              </div>}
                            </div>

                            {/* MAĞAZA STOKLARI */}
                            {sek==="magaza"&&(
                              <div>
                                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
                                  {magazalar.map(m=>{
                                    const adet=(u.varyantlar||[]).filter(v=>v.magazaId===m.id).reduce((t,v)=>t+v.adet,0);
                                    return(
                                      <div key={m.id} style={{padding:"10px 16px",borderRadius:10,background:t.bg,border:`1px solid ${t.border}`,minWidth:130}}>
                                        <div style={{fontSize:11,color:t.textMuted,marginBottom:4}}>{m.ikon||"🏪"} {m.ad}</div>
                                        <div style={{fontSize:20,fontWeight:800,color:mc(adet)}}>{adet}</div>
                                        <div style={{fontSize:9,color:t.textMuted,marginTop:1}}>adet</div>
                                      </div>
                                    );
                                  })}
                                  <div style={{padding:"10px 16px",borderRadius:10,background:"rgba(201,184,130,.06)",border:`1px solid ${t.accent}33`,minWidth:130}}>
                                    <div style={{fontSize:11,color:t.textMuted,marginBottom:4}}>📊 Toplam</div>
                                    <div style={{fontSize:20,fontWeight:800,color:t.accent}}>
                                      {(u.varyantlar||[]).reduce((t,v)=>t+v.adet,0)}
                                    </div>
                                    <div style={{fontSize:9,color:t.textMuted,marginTop:1}}>tüm mağazalar</div>
                                  </div>
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                  {(u.varyantlar||[])
                                    .filter(v=>!aktifMagazaId||v.magazaId===aktifMagazaId)
                                    .sort((a,b)=>(a.magazaId||"").localeCompare(b.magazaId||""))
                                    .map((v,i)=>{
                                      const mag=magazalar.find(m=>m.id===v.magazaId);
                                      return(
                                        <span key={`var_${u?.id||i}_${v?.renk||""}_${v?.beden||""}_${v?.magazaId||""}`} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,fontSize:11,
                                          background:`${mc(v.adet)}10`,color:mc(v.adet),border:`1px solid ${mc(v.adet)}33`}}>
                                          <span style={{color:t.textMuted,fontSize:10}}>{mag?.ikon||"🏪"}</span>
                                          {v.renk}{v.beden?` / ${v.beden}`:""} · <b>{v.adet}</b>
                                          {v.barkod&&<span style={{fontSize:9,fontFamily:"monospace",opacity:.6}}>#{v.barkod}</span>}
                                        </span>
                                      );
                                    })}
                                </div>
                              </div>
                            )}

                            {/* TEDARİKÇİ STOĞU */}
                            {sek==="tedarik"&&tx&&(
                              <div>
                                <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                                  <div style={{padding:"10px 16px",borderRadius:10,background:"rgba(86,204,242,.06)",border:"1px solid rgba(86,204,242,.2)",minWidth:130}}>
                                    <div style={{fontSize:11,color:"#56ccf2",marginBottom:4}}>📦 Toplam Tedarikçi</div>
                                    <div style={{fontSize:22,fontWeight:800,color:"#56ccf2"}}>{tedarikStok(tx)}</div>
                                    <div style={{fontSize:9,color:t.textMuted,marginTop:1}}>adet (tüm varyantlar)</div>
                                  </div>
                                  <div style={{padding:"10px 16px",borderRadius:10,background:t.bg,border:`1px solid ${t.border}`,minWidth:130}}>
                                    <div style={{fontSize:11,color:t.textMuted,marginBottom:4}}>🔧 Varyant Sayısı</div>
                                    <div style={{fontSize:22,fontWeight:800,color:t.text}}>{tx.secenekler.filter(s=>s.aktif!=="0").length}</div>
                                    <div style={{fontSize:9,color:t.textMuted,marginTop:1}}>aktif seçenek</div>
                                  </div>
                                  <div style={{padding:"10px 16px",borderRadius:10,background:t.bg,border:`1px solid ${t.border}`,minWidth:130}}>
                                    <div style={{fontSize:11,color:t.textMuted,marginBottom:4}}>💰 Tedarikçi Fiyatı</div>
                                    <div style={{fontSize:16,fontWeight:700,color:t.accent}}>
                                      {tx.secenekler[0]?.satisFiyati?`₺${Number(tx.secenekler[0].satisFiyati).toLocaleString("tr-TR")}`:"—"}
                                    </div>
                                    <div style={{fontSize:9,color:t.textMuted,marginTop:1}}>ilk seçenek</div>
                                  </div>
                                </div>
                                <div style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden",maxHeight:260,overflowY:"auto"}}>
                                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                                    <thead><tr style={{background:"rgba(255,255,255,.03)"}}>
                                      {["Stok Kodu","Barkod (Tedarikçi)","Tedarikçi Stok","Alış","Satış","Renk/Özellik"].map(h=>(
                                        <th key={h} style={{padding:"8px 12px",fontSize:10,color:t.textMuted,fontWeight:500,textAlign:"left"}}>{h}</th>
                                      ))}
                                    </tr></thead>
                                    <tbody>
                                      {tx.secenekler.filter(s=>s.aktif!=="0").map((s,i)=>{
                                        const ozellikler=s.ekSecenekOzellik||[];
                                        return(
                                          <tr key={`tx_sec_${i}`} style={{borderTop:`1px solid ${t.border}`}}>
                                            <td style={{padding:"8px 12px",fontSize:11,fontFamily:"monospace",color:t.textMuted}}>{s.stokKodu||"—"}</td>
                                            <td style={{padding:"8px 12px",fontSize:10,fontFamily:"monospace",color:"#555"}}>{s.barkod||"—"}</td>
                                            <td style={{padding:"8px 12px"}}>
                                              <span style={{fontSize:13,fontWeight:700,color:parseInt(s.stokAdedi)>5?"#56ccf2":parseInt(s.stokAdedi)>0?"#f2c94c":"#666"}}>
                                                {s.stokAdedi||"0"}
                                              </span>
                                            </td>
                                            <td style={{padding:"8px 12px",fontSize:11,color:t.textMuted}}>{s.alisFiyati?`₺${Number(s.alisFiyati).toLocaleString("tr-TR")}`:"—"}</td>
                                            <td style={{padding:"8px 12px",fontSize:12,fontWeight:600,color:t.accent}}>{s.satisFiyati?`₺${Number(s.satisFiyati).toLocaleString("tr-TR")}`:"—"}</td>
                                            <td style={{padding:"8px 12px"}}>
                                              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                                                {ozellikler.map((o,j)=>(
                                                  <span key={j} style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:"rgba(201,184,130,.1)",color:"#c9b882"}}>
                                                    {o.tanim}: {o.deger||o.text}
                                                  </span>
                                                ))}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
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
                                <div>
                                  <div style={{fontSize:11,color:t.textMuted,marginBottom:10}}>
                                    <span style={{color:t.accent}}>{yerelResimler.length}</span> yerel ·{" "}
                                    <span style={{color:"#56ccf2"}}>{txResimler.length}</span> Ticimax
                                  </div>
                                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
                                    {tumResimler.map((r,i)=>(
                                      <div key={`resim_${i}_${r.url?.slice(-10)||i}`} style={{borderRadius:10,overflow:"hidden",border:`1px solid ${r.kaynak==="yerel"?t.accent+"44":t.border}`,background:t.bg,position:"relative"}}>
                                        <img src={r.url} alt={`Resim ${i+1}`} style={{width:"100%",height:140,objectFit:"cover",display:"block"}}
                                          onError={e=>{e.target.parentElement.style.display="none"}}/>
                                        <div style={{position:"absolute",top:5,left:5,fontSize:9,padding:"2px 6px",borderRadius:4,
                                          background:r.kaynak==="yerel"?t.accent:"#56ccf2",color:"#111",fontWeight:700}}>
                                          {r.kaynak==="yerel"?"📁 Yerel":"🔗 TX"}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div style={{padding:"20px",textAlign:"center",color:t.textMuted,fontSize:12,background:t.bg,borderRadius:10,border:`1px solid ${t.border}`}}>
                                  Bu ürüne henüz resim eklenmemiş
                                </div>
                              );
                            })()}

                            {/* ÜRÜN BİLGİSİ */}
                            {sek==="detay"&&(
                              <div className="vega-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                                  {[
                                    {l:"Ürün Kodu",v:u.kod},
                                    {l:"Kategori",v:[u.kategori,u.altKategori].filter(Boolean).join(" › ")},
                                    {l:"Satış Birimi",v:tx?.satisBirimi||"Adet"},
                                    {l:"KDV",v:`%${u.kdv||20}`},
                                    {l:"Kritik Stok",v:`${u.kritikStok??0} adet`},
                                  ].map(({l,v})=>v?(
                                    <div key={l}>
                                      <div style={{fontSize:10,color:t.textMuted,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{l}</div>
                                      <div style={{fontSize:13,color:t.text,fontWeight:500}}>{v}</div>
                                    </div>
                                  ):null)}
                                </div>
                                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                                  {tx?.teknikDetaylar?.length>0&&(
                                    <div>
                                      <div style={{fontSize:10,color:t.textMuted,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Teknik Özellikler</div>
                                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                                        {tx.teknikDetaylar.slice(0,8).map((d,i)=>(
                                          <div key={`detay_${i}`} style={{display:"flex",justifyContent:"space-between",padding:"4px 8px",borderRadius:6,background:t.bg,border:`1px solid ${t.border}`}}>
                                            <span style={{fontSize:11,color:t.textMuted}}>{d.ozellikTanim}</span>
                                            <span style={{fontSize:11,color:t.text,fontWeight:500}}>{d.degerTanim}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(u.aciklama||tx?.aciklama)&&(
                                    <div>
                                      <div style={{fontSize:10,color:t.textMuted,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Açıklama</div>
                                      <div style={{fontSize:12,color:t.textMuted,lineHeight:1.6,maxHeight:80,overflowY:"auto"}}>
                                        {u.aciklama||tx?.aciklama}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Ticimax bağlantısı yok uyarısı */}
                            {!tx&&(sek==="tedarik"||sek==="resimler")&&(
                              <div style={{padding:"20px",textAlign:"center",color:t.textMuted,fontSize:12,background:t.bg,borderRadius:10,border:`1px solid ${t.border}`}}>
                                Bu ürün için Ticimax'ta eşleşen kayıt bulunamadı.<br/>
                                <span style={{fontSize:10,opacity:.6}}>Ad benzerliğiyle eşleştirme yapılmaktadır.</span>
                              </div>
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
        {!yukleniyor&&sayfaliUrunler.length===0&&<div style={{padding:"30px",textAlign:"center",color:t.textMuted,fontSize:13}}>Sonuç bulunamadı</div>}

        {toplamUrun>0&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderTop:`1px solid ${t.border}`,flexWrap:"wrap",gap:10}}>
            <div style={{fontSize:12,color:t.textMuted}}>
              {(sayfa-1)*URUN_SAYFA_BOYUTU+1} - {Math.min(toplamUrun,sayfa*URUN_SAYFA_BOYUTU)} / {toplamUrun} ürün
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>setSayfa(p=>Math.max(1,p-1))} disabled={sayfa<=1}
                style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${t.border}`,background:"transparent",color:t.textMuted,opacity:sayfa<=1?.5:1}}>Önceki</button>
              <div style={{fontSize:12,color:t.textMuted}}>{sayfa} / {toplamSayfa}</div>
              <button onClick={()=>setSayfa(p=>Math.min(toplamSayfa,p+1))} disabled={sayfa>=toplamSayfa}
                style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${t.border}`,background:"transparent",color:t.textMuted,opacity:sayfa>=toplamSayfa?.5:1}}>Sonraki</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STOK HAREKETLERİ ─────────────────────────────────────────
// ─── ALIM LİSTESİ ─────────────────────────────────────────────
function AlimListesi({ urunler, ticimaxUrunler, magazalar, markalar=[], t, aktifMagazaId }) {
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
  const temizle = () => { if(window.confirm('Listeyi temizle?')) setListe([]); };

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
    if (filtreliListe.length === 0) { alert('Alım listesi boş'); return; }
    setFisYazdiriliyor(true);
    try {
      const magazaAd = magazalar?.find(m => m.id === aktifMagazaId)?.ad;
      await print.kritikStokFisiYazdir(filtreliListe, magazaAd, filtreliToplam);
    } catch (err) {
      alert('Fiş yazdırma hatası: ' + err.message);
    } finally {
      setFisYazdiriliyor(false);
    }
  };

  const yazdir = () => {
    if (filtreliListe.length === 0) { alert('Yazdırılacak kalem yok'); return; }
    const cikti = filtreliListe;
    const ciktiToplam = filtreliToplam;
    const tarih = new Date().toLocaleDateString('tr-TR');
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html><html><head><title>Alım Listesi</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;padding:32px;}
      @page{size:A4;margin:20mm;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #c9b882;}
      .logo{font-size:26px;font-weight:900;color:#c9b882;letter-spacing:1px;}
      .logo span{color:#1a1a1a;}
      .meta{text-align:right;font-size:12px;color:#666;}
      .meta strong{display:block;font-size:14px;color:#1a1a1a;margin-bottom:4px;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      thead tr{background:#f5f0e8;}
      th{padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#666;border-bottom:2px solid #c9b882;}
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
      .toplam{font-size:18px;font-weight:900;color:#c9b882;}
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
        <div style="margin-top:4px;font-weight:600;color:#c9b882;">Tahmini Toplam: ₺${ciktiToplam.toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
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
    <div style={{display:'flex',flexDirection:'column',gap:20}}>

      {/* Araç çubuğu */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        {/* Otomatik ekle */}
        {kritikUrunler.length > 0 && (
          <button onClick={otomatikEkle} style={{
            padding:'9px 16px',borderRadius:10,fontSize:13,fontWeight:600,
            background:'rgba(235,87,87,.1)',border:'1px solid rgba(235,87,87,.3)',color:'#eb5757'
          }}>
            ⚠ {kritikUrunler.length} Kritik Ürünü Ekle
          </button>
        )}

        {/* Marka/Stok/Fiyat filtreleri — alım listesine ZATEN eklenmiş kalemleri daraltır (aşağıdaki tablo) */}
        <select value={markaFiltre} onChange={e=>setMarkaFiltre(e.target.value)}
          style={{padding:'9px 10px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,minWidth:120}}>
          <option value="">Tüm Markalar</option>
          {markalar.map(m=><option key={m.id||m.ad} value={m.ad}>{m.ad}</option>)}
        </select>
        <select value={stokFiltre} onChange={e=>setStokFiltre(e.target.value)}
          style={{padding:'9px 10px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,minWidth:120}}>
          <option value="hepsi">Tüm Stoklar</option>
          <option value="stokta">Stokta Var</option>
          <option value="kritik">⚠ Kritik Stok</option>
          <option value="tukendi">Tükendi</option>
        </select>
        <input value={fiyatMinF} onChange={e=>setFiyatMinF(e.target.value)} placeholder="Min ₺" type="number"
          style={{width:80,padding:'9px 10px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}/>
        <input value={fiyatMaxF} onChange={e=>setFiyatMaxF(e.target.value)} placeholder="Max ₺" type="number"
          style={{width:80,padding:'9px 10px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}/>
        {filtreAktif && (
          <button onClick={()=>{setMarkaFiltre('');setStokFiltre('hepsi');setFiyatMinF('');setFiyatMaxF('');}}
            style={{padding:'8px 12px',borderRadius:10,fontSize:12,background:'transparent',border:`1px solid ${t.border}`,color:t.textMuted}}>
            ✕ Temizle
          </button>
        )}

        {/* Manuel arama */}
        <div style={{position:'relative',flex:1,minWidth:200}}>
          <input
            ref={aramaRef}
            value={arama}
            onChange={e=>{setArama(e.target.value);setAramaAcik(true);}}
            onFocus={()=>setAramaAcik(true)}
            placeholder="🔍 Ürün ara ve ekle..."
            style={{width:'100%',padding:'9px 14px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}
          />
          {aramaAcik && aramaFiltreli.length > 0 && (
            <div style={{
              position:'absolute',top:'100%',left:0,right:0,zIndex:100,
              background:t.card,border:`1px solid ${t.border}`,borderRadius:10,
              marginTop:4,maxHeight:280,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,.4)'
            }}>
              {aramaFiltreli.map((u,i) => {
                const isTx = u._tip === 'ticimax';
                const resim = isTx ? u.resimler?.[0] : (u.resimler||[])[0];
                const ad = isTx ? u.urunAdi : u.ad;
                return (
                  <div key={i} onClick={()=>isTx?txKalemEkle(u):kalemEkle(u)}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',borderBottom:`1px solid ${t.border}`}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {resim
                      ? <img src={resim} alt="" style={{width:36,height:36,objectFit:'cover',borderRadius:6,flexShrink:0}} onError={e=>e.target.style.display='none'}/>
                      : <div style={{width:36,height:36,borderRadius:6,background:t.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>👜</div>
                    }
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ad}</div>
                      <div style={{fontSize:10,color:t.textMuted}}>{isTx?<span style={{color:'#56ccf2'}}>Ticimax</span>:'Yerel'} · {u.marka}</div>
                    </div>
                    <span style={{fontSize:11,color:t.accent,flexShrink:0}}>+ Ekle</span>
                  </div>
                );
              })}
            </div>
          )}
          {aramaAcik && arama.length > 1 && aramaFiltreli.length === 0 && (
            <div style={{
              position:'absolute',top:'100%',left:0,right:0,zIndex:100,
              background:t.card,border:`1px solid ${t.border}`,borderRadius:10,
              marginTop:4,padding:'14px',textAlign:'center',fontSize:12,color:t.textMuted,
              boxShadow:'0 8px 24px rgba(0,0,0,.4)'
            }}>
              Sonuç bulunamadı
            </div>
          )}
        </div>

        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          {liste.length > 0 && <>
            <button onClick={temizle} style={{padding:'9px 14px',borderRadius:10,border:`1px solid ${t.border}`,background:'transparent',color:t.textMuted,fontSize:12}}>
              🗑 Temizle
            </button>
            <button onClick={yazdir} style={{
              padding:'9px 20px',borderRadius:10,fontSize:13,fontWeight:700,
              background:'rgba(111,207,151,.12)',border:'1px solid rgba(111,207,151,.3)',color:'#6fcf97'
            }}>
              🖨 PDF / Yazdır
            </button>
            <button onClick={fiseYazdir} disabled={fisYazdiriliyor} style={{
              padding:'9px 20px',borderRadius:10,fontSize:13,fontWeight:700,
              background:'rgba(201,184,130,.12)',border:'1px solid rgba(201,184,130,.3)',color:t.accent,
              opacity:fisYazdiriliyor?0.6:1
            }}>
              {fisYazdiriliyor?'Gönderiliyor...':'🧾 Fişe Yazdır'}
            </button>
          </>}
        </div>
      </div>

      {/* Fiş yazıcısı bağlantı/seçim — "Fiş yazıcısı seçilmedi" hatasını burada çözün */}
      {liste.length > 0 && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'rgba(201,184,130,.05)',border:'1px solid rgba(201,184,130,.15)',borderRadius:10,flexWrap:'wrap'}}>
          <div style={{width:9,height:9,borderRadius:'50%',background:print.bagli?'#6fcf97':'#eb5757',flexShrink:0}}/>
          <span style={{fontSize:12,color:t.textMuted}}>
            Fiş Yazıcısı: {print.bagli ? (print.fisYazici || 'henüz seçilmedi') : 'QZ Tray bağlı değil'}
          </span>
          {!print.bagli && (
            <button onClick={print.baglan} disabled={print.baglaniyor} style={{fontSize:11,padding:'4px 12px',borderRadius:6,background:'rgba(86,204,242,.1)',border:'1px solid rgba(86,204,242,.25)',color:'#56ccf2'}}>
              {print.baglaniyor?'Bağlanıyor...':'Bağlan'}
            </button>
          )}
          {print.bagli && (
            <select value={print.fisYazici} onChange={e=>print.fisYaziciSec(e.target.value)}
              style={{padding:'5px 10px',borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}>
              <option value="">Yazıcı seçin...</option>
              {print.yazicilar.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {print.hata && <span style={{fontSize:11,color:'#eb5757'}}>{print.hata}</span>}
        </div>
      )}

      {/* Liste boş */}
      {liste.length === 0 && (
        <div style={{padding:'48px 20px',textAlign:'center',background:t.card,border:`1px solid ${t.border}`,borderRadius:14}}>
          <div style={{fontSize:40,marginBottom:12}}>🛒</div>
          <div style={{fontSize:14,color:t.text,fontWeight:600,marginBottom:6}}>Alım listesi boş</div>
          <div style={{fontSize:12,color:t.textMuted}}>
            Kritik stok önerisi için ⚠ butonu kullan veya yukarıdan ürün ara
          </div>
        </div>
      )}

      {/* Liste dolu ama seçili filtreye uyan kalem yok */}
      {liste.length > 0 && filtreliListe.length === 0 && (
        <div style={{padding:'32px 20px',textAlign:'center',background:t.card,border:`1px solid ${t.border}`,borderRadius:14,color:t.textMuted,fontSize:13}}>
          Bu filtreye uyan kalem yok
        </div>
      )}

      {/* Kalemler */}
      {filtreliListe.length > 0 && (
        <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:'hidden'}}>
          <div className="vega-scroll-x">
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:t.hover,borderBottom:`1px solid ${t.border}`}}>
                <th style={{padding:'10px 14px',width:56,fontSize:10,color:t.textMuted,fontWeight:600,textAlign:'left'}}>Foto</th>
                <th style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:600,textAlign:'left'}}>Ürün</th>
                <th style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:600,textAlign:'left',width:100}}>Renk</th>
                <th style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:600,textAlign:'left',width:80}}>Beden</th>
                <th style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:600,textAlign:'center',width:80}}>Mevcut</th>
                <th style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:600,textAlign:'center',width:100}}>İstenen</th>
                <th style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:600,textAlign:'right',width:100}}>Alış</th>
                <th style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:600,textAlign:'right',width:110}}>Toplam</th>
                <th style={{padding:'10px 14px',fontSize:10,color:t.textMuted,fontWeight:600,textAlign:'left'}}>Not</th>
                <th style={{padding:'10px 14px',width:36}}></th>
              </tr>
            </thead>
            <tbody>
              {filtreliListe.map((l, i) => (
                <tr key={l.id} style={{borderBottom:`1px solid ${t.border}`,background:l.kaynak==='otomatik'?'rgba(235,87,87,.03)':'transparent'}}>
                  {/* Foto */}
                  <td style={{padding:'10px 14px'}}>
                    {l.resim
                      ? <img src={l.resim} alt="" style={{width:44,height:44,objectFit:'cover',borderRadius:8,border:`1px solid ${t.border}`}} onError={e=>e.target.style.display='none'}/>
                      : <div style={{width:44,height:44,borderRadius:8,background:t.bg,border:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>👜</div>
                    }
                  </td>
                  {/* Ürün */}
                  <td style={{padding:'10px 14px'}}>
                    <div style={{fontSize:13,fontWeight:600,color:t.text}}>{l.urunAdi}</div>
                    <div style={{fontSize:10,color:t.textMuted,marginTop:2}}>
                      {l.marka}
                      {l.kaynak==='otomatik'&&<span style={{marginLeft:6,color:'#eb5757',fontSize:9}}>⚠ KRİTİK</span>}
                      {l.kaynak==='ticimax'&&<span style={{marginLeft:6,color:'#56ccf2',fontSize:9}}>📦 TİCİMAX</span>}
                    </div>
                  </td>
                  {/* Renk */}
                  <td style={{padding:'8px 14px'}}>
                    <input value={l.renk} onChange={e=>guncelle(l.id,'renk',e.target.value)} placeholder="Renk..."
                      style={{width:'100%',padding:'5px 8px',borderRadius:6,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}/>
                  </td>
                  {/* Beden */}
                  <td style={{padding:'8px 14px'}}>
                    <input value={l.beden} onChange={e=>guncelle(l.id,'beden',e.target.value)} placeholder="Beden..."
                      style={{width:'100%',padding:'5px 8px',borderRadius:6,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}/>
                  </td>
                  {/* Mevcut stok */}
                  <td style={{padding:'10px 14px',textAlign:'center'}}>
                    <span style={{fontSize:14,fontWeight:700,color:l.mevcutStok<=0?'#eb5757':l.mevcutStok<=3?'#f2c94c':'#6fcf97'}}>{l.mevcutStok}</span>
                  </td>
                  {/* İstenen adet */}
                  <td style={{padding:'8px 14px',textAlign:'center'}}>
                    <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}>
                      <button onClick={()=>guncelle(l.id,'istenenAdet',Math.max(1,l.istenenAdet-1))}
                        style={{width:22,height:22,borderRadius:5,border:`1px solid ${t.border}`,background:t.bg,color:t.text,fontSize:14}}>−</button>
                      <input type="number" min={1} value={l.istenenAdet}
                        onChange={e=>guncelle(l.id,'istenenAdet',Math.max(1,parseInt(e.target.value)||1))}
                        style={{width:46,padding:'3px 4px',borderRadius:6,border:`1px solid ${t.accent}44`,background:t.bg,color:t.accent,fontSize:14,fontWeight:700,textAlign:'center',outline:'none'}}/>
                      <button onClick={()=>guncelle(l.id,'istenenAdet',l.istenenAdet+1)}
                        style={{width:22,height:22,borderRadius:5,border:`1px solid ${t.border}`,background:t.bg,color:t.text,fontSize:14}}>+</button>
                    </div>
                  </td>
                  {/* Alış fiyatı */}
                  <td style={{padding:'8px 14px',textAlign:'right'}}>
                    <div style={{position:'relative'}}>
                      <span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:t.textMuted,fontSize:11}}>₺</span>
                      <input type="number" value={l.alisF||''} onChange={e=>guncelle(l.id,'alisF',parseFloat(e.target.value)||0)}
                        style={{width:'100%',padding:'5px 6px 5px 20px',borderRadius:6,border:`1px solid ${t.border}`,background:t.input,color:t.accent,fontSize:12,fontWeight:600,textAlign:'right',outline:'none'}}/>
                    </div>
                  </td>
                  {/* Toplam */}
                  <td style={{padding:'10px 14px',textAlign:'right',fontSize:13,fontWeight:700,color:t.accent}}>
                    {para(l.istenenAdet*(l.alisF||0))}
                  </td>
                  {/* Not */}
                  <td style={{padding:'8px 14px'}}>
                    <input value={l.not} onChange={e=>guncelle(l.id,'not',e.target.value)} placeholder="Not..."
                      style={{width:'100%',padding:'5px 8px',borderRadius:6,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:'none'}}/>
                  </td>
                  {/* Sil */}
                  <td style={{padding:'10px 14px'}}>
                    <button onClick={()=>sil(l.id)} style={{color:'#eb5757',fontSize:14,opacity:.6}}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Alt özet — filtre aktifse görünen (filtrelenmiş) kalemleri özetler */}
          <div style={{padding:'12px 20px',borderTop:`1px solid ${t.border}`,background:t.bg,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontSize:12,color:t.textMuted}}>
              <span style={{color:t.accent,fontWeight:700}}>{filtreliListe.length}</span> kalem ·{' '}
              <span style={{color:t.accent,fontWeight:700}}>{filtreliListe.reduce((t,l)=>t+l.istenenAdet,0)}</span> adet
              {filtreAktif && filtreliListe.length !== liste.length && <span> (toplam {liste.length})</span>}
            </div>
            <div style={{fontSize:16,fontWeight:800,color:t.accent}}>
              Tahmini Toplam: {para(filtreliListe.reduce((t,l)=>t+l.istenenAdet*l.alisF,0))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// Stok Geçmişi: bir ürünün stoğunun NE ZAMAN, NE KADAR, NEDEN ve HANGİ BELGEYLE
// değiştiğini gösteren defter. Filtrelerin tamamı SUNUCUYA gidiyor — istemcide
// süzmek, limitin dışında kalan eski hareketleri aramanın dışında bırakırdı.
function StokHareketler({ urunler, magazalar, t }) {
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
    alis:    {renk:"#6fcf97",label:"Alış"},
    satis:   {renk:"#56ccf2",label:"Satış"},
    iade:    {renk:"#f2c94c",label:"İade"},
    transfer:{renk:"#bb87fc",label:"Transfer"},
    sayim:   {renk:"#c9b882",label:"Sayım"},
    fire:    {renk:"#eb5757",label:"Fire/Kayıp"},
  };
  // Sistemin kendi ürettiği, formda seçilemeyen tipler — tabloda ham "iptal" /
  // "degisim" yazmasın diye ayrı tutuluyor (bkz. routes/siparisler.js, degisim.js).
  const OTOMATIK_TIPLER = {
    iptal:   {renk:"#eb5757",label:"Sipariş İptali"},
    degisim: {renk:"#bb87fc",label:"Değişim"},
  };
  const tipBilgi = (tip) => tipRenkler[tip] || OTOMATIK_TIPLER[tip] || {renk:"#888",label:tip||"—"};
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
    if(!form.urunId||!form.adet) return alert("Ürün ve adet zorunlu!");
    if(!form.magazaId) return alert("Mağaza seçiniz!");
    if(form.tip==='transfer'&&!form.hedefMagazaId) return alert("Hedef mağaza seçiniz!");
    if(form.tip==='transfer'&&form.magazaId===form.hedefMagazaId) return alert("Kaynak ve hedef mağaza aynı olamaz!");
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
      yukle();
    } catch(err){ alert("Hata: "+err.message); }
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

  const secimStil = {padding:"8px 10px",borderRadius:9,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:12,outline:"none"};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>Stok Geçmişi</div>
          <div style={{fontSize:12,color:t.textMuted,marginTop:2}}>
            {toplam} kayıt{hareketler.length<toplam?` · ${hareketler.length} tanesi gösteriliyor`:""}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={disaAktar} disabled={hareketler.length===0} style={{padding:"9px 16px",borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13,opacity:hareketler.length===0?.5:1}}>
            ⭳ CSV
          </button>
          <button onClick={()=>setModal(true)} style={{padding:"9px 20px",borderRadius:10,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:600}}>
            + Yeni Hareket
          </button>
        </div>
      </div>

      {/* Dönem özeti — filtrelenen kayıtların TAMAMI üzerinden (sunucuda) hesaplanıyor,
          ekranda görünen ilk N satır üzerinden değil. */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:14}}>
        {[
          {l:"Toplam Giriş", v:`+${ozet.giris}`, c:"#6fcf97"},
          {l:"Toplam Çıkış", v:`-${ozet.cikis}`, c:"#eb5757"},
          {l:"Net Değişim",  v:`${ozet.net>0?"+":""}${ozet.net}`, c:ozet.net>=0?"#6fcf97":"#eb5757"},
          {l:"Kayıt",        v:String(toplam),   c:t.accent},
        ].map(k=>(
          <div key={k.l} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:10,color:t.textMuted,textTransform:"uppercase",letterSpacing:.5}}>{k.l}</div>
            <div style={{fontSize:20,fontFamily:"'Playfair Display',serif",color:k.c,marginTop:3}}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px",marginBottom:14,display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
        <input value={arama} onChange={e=>setArama(e.target.value)} placeholder="🔍 Ürün adı, SKU, kod, barkod veya not..."
          style={{...secimStil,flex:"1 1 240px",minWidth:200}}/>
        <select value={tipFiltre} onChange={e=>setTipFiltre(e.target.value)} style={secimStil}>
          <option value="hepsi">Tüm işlemler</option>
          {Object.entries({...tipRenkler,...OTOMATIK_TIPLER}).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={yonFiltre} onChange={e=>setYonFiltre(e.target.value)} style={secimStil}>
          <option value="hepsi">Giriş + Çıkış</option>
          <option value="giris">Sadece giriş</option>
          <option value="cikis">Sadece çıkış</option>
        </select>
        <select value={magazaFiltre} onChange={e=>setMagazaFiltre(e.target.value)} style={secimStil}>
          <option value="hepsi">Tüm mağazalar</option>
          {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
        </select>
        <input type="date" value={baslangic} onChange={e=>setBaslangic(e.target.value)} style={secimStil}/>
        <span style={{color:t.textMuted,fontSize:12}}>–</span>
        <input type="date" value={bitis} onChange={e=>setBitis(e.target.value)} style={secimStil}/>
        {filtreAktif&&(
          <button onClick={filtreleriTemizle} style={{...secimStil,color:t.accent,cursor:"pointer"}}>✕ Temizle</button>
        )}
      </div>

      {yukleniyor?<div style={{padding:40,textAlign:"center",color:t.textMuted}}>⏳ Yükleniyor...</div>
      :hareketler.length===0
        ?<div style={{padding:40,textAlign:"center",color:t.textMuted,background:t.card,border:`1px solid ${t.border}`,borderRadius:14}}>
          {filtreAktif?"Bu filtrelerle hareket bulunamadı":"Hareket kaydı yok"}
        </div>
        :<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden"}}>
          <div className="vega-scroll-x">
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:t.hover}}>
              {["Tarih / Saat","Ürün","Renk / Beden","Mağaza","İşlem","Miktar","Birim Fiyat","Tutar","Kaynak","Açıklama"].map(h=>(
                <th key={h} style={{padding:"11px 14px",fontSize:10,color:t.textMuted,fontWeight:500,textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {hareketler.map((h,i)=>{
                const tip=tipBilgi(h.tip);
                const zaman=new Date(h.tarih);
                const stokKodu=h.urun?.sku||h.urun?.kod||"";
                const renkGoster=(h.renk&&h.renk.trim().toLowerCase()!=="standart")?h.renk.trim():(h.urun?.renkAdi||"");
                const tutar=Math.abs(h.adet)*Number(h.birimFiyat||0);
                return (
                  <tr key={h.id||`hareket_${i}`} style={{borderBottom:`1px solid ${t.border}`}}>
                    <td style={{padding:"11px 14px",whiteSpace:"nowrap"}}>
                      <div style={{fontSize:12,color:t.text}}>{zaman.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})}</div>
                      <div style={{fontSize:11,color:t.textMuted,fontFamily:"monospace"}}>{zaman.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
                    </td>
                    <td style={{padding:"11px 14px",minWidth:190}}>
                      <div style={{fontSize:13,color:t.text,fontWeight:500}}>{h.urun?.ad||"—"}</div>
                      <div style={{fontSize:10,color:t.textMuted,fontFamily:"monospace"}}>
                        {[h.urun?.marka,stokKodu].filter(Boolean).join(" · ")||"—"}
                      </div>
                    </td>
                    <td style={{padding:"11px 14px",fontSize:12,color:t.textMuted,whiteSpace:"nowrap"}}>
                      {[renkGoster,h.beden].filter(Boolean).join(" / ")||"—"}
                    </td>
                    <td style={{padding:"11px 14px",fontSize:12,color:t.textMuted,whiteSpace:"nowrap"}}>{h.magaza?.ad||"—"}</td>
                    <td style={{padding:"11px 14px"}}>
                      <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:`${tip.renk}18`,color:tip.renk,fontWeight:600,whiteSpace:"nowrap"}}>{tip.label}</span>
                    </td>
                    <td style={{padding:"11px 14px",fontSize:14,fontWeight:700,color:h.adet>0?"#6fcf97":"#eb5757",whiteSpace:"nowrap"}}>
                      {h.adet>0?"+":""}{h.adet}
                    </td>
                    <td style={{padding:"11px 14px",fontSize:12,color:t.textMuted,whiteSpace:"nowrap"}}>{h.birimFiyat>0?para(h.birimFiyat):"—"}</td>
                    <td style={{padding:"11px 14px",fontSize:12,color:tutar>0?t.text:t.textMuted,whiteSpace:"nowrap"}}>{tutar>0?para(tutar):"—"}</td>
                    <td style={{padding:"11px 14px",fontSize:11,whiteSpace:"nowrap"}}>
                      {h.kaynak
                        ? <span style={{color:t.accent,fontFamily:"monospace"}}>{KAYNAK_ETIKET[h.kaynak.tur]||h.kaynak.tur} {h.kaynak.no}</span>
                        : <span style={{color:t.textMuted}}>Manuel</span>}
                    </td>
                    <td style={{padding:"11px 14px",fontSize:11,color:t.textMuted,maxWidth:220}}>{h.notlar||"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {hareketler.length<toplam&&(
            <div style={{padding:"12px 14px",textAlign:"center",borderTop:`1px solid ${t.border}`}}>
              <button onClick={()=>setLimit(l=>l+200)} style={{padding:"8px 20px",borderRadius:9,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:12}}>
                ↓ Daha eski kayıtları göster ({toplam-hareketler.length} kayıt daha)
              </button>
            </div>
          )}
        </div>}

      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:t.sidebar||"#14120f",border:`1px solid ${t.border}`,borderRadius:18,padding:"28px 32px",width:"100%",maxWidth:460}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>Yeni Stok Hareketi</div>
              <button onClick={()=>setModal(false)} style={{color:t.textMuted,fontSize:20}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Ürün */}
              <div>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Ürün *</div>
                <select value={form.urunId} onChange={e=>setForm(p=>({...p,urunId:e.target.value}))}
                  style={{width:"100%",padding:"9px 12px",borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:"none"}}>
                  <option value="">Seçin...</option>
                  {urunler.map(u=><option key={u.id} value={u.id}>{u.ad} ({u.kod})</option>)}
                </select>
              </div>
              {/* Mağaza */}
              <div>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Mağaza *</div>
                <select value={form.magazaId} onChange={e=>setForm(p=>({...p,magazaId:e.target.value}))}
                  style={{width:"100%",padding:"9px 12px",borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:"none"}}>
                  <option value="">Seçin...</option>
                  {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </div>
              {/* Hedef Mağaza (sadece transfer) */}
              {form.tip==='transfer'&&(
                <div>
                  <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Hedef Mağaza *</div>
                  <select value={form.hedefMagazaId} onChange={e=>setForm(p=>({...p,hedefMagazaId:e.target.value}))}
                    style={{width:'100%',padding:'9px 12px',borderRadius:10,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:'none'}}>
                    <option value="">Seçin...</option>
                    {magazalar.filter(m=>m.id!==form.magazaId).map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
                  </select>
                </div>
              )}
              {/* Tip */}
              <div>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>İşlem Tipi *</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {Object.entries(tipRenkler).map(([k,v])=>(
                    <button key={k} onClick={()=>setForm(p=>({...p,tip:k}))} style={{padding:"6px 12px",borderRadius:8,fontSize:12,
                      background:form.tip===k?`${v.renk}18`:t.input,border:`1px solid ${form.tip===k?v.renk+"55":t.border}`,
                      color:form.tip===k?v.renk:t.textMuted,fontWeight:form.tip===k?600:400}}>{v.label}</button>
                  ))}
                </div>
              </div>
              {/* Renk/Beden/Adet */}
              <div className="vega-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                {[{l:"Renk",k:"renk",ph:"örn. Siyah"},{l:"Beden",k:"beden",ph:"örn. 40"},{l:"Adet *",k:"adet",tip:"number",ph:"1"}].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>{f.l}</div>
                    <input type={f.tip||"text"} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:f.tip==="number"?parseInt(e.target.value)||0:e.target.value}))}
                      placeholder={f.ph} style={{width:"100%",padding:"8px 10px",borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:"none"}}/>
                  </div>
                ))}
              </div>
              <div className="vega-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Birim Fiyat</div>
                  <input type="number" value={form.birimFiyat} onChange={e=>setForm(p=>({...p,birimFiyat:e.target.value}))}
                    placeholder="₺0" style={{width:"100%",padding:"8px 10px",borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:"none"}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:t.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Not</div>
                  <input value={form.notlar} onChange={e=>setForm(p=>({...p,notlar:e.target.value}))}
                    style={{width:"100%",padding:"8px 10px",borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:t.text,fontSize:13,outline:"none"}}/>
                </div>
              </div>
              <button onClick={kaydet} style={{padding:"12px 0",borderRadius:12,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:14,fontWeight:700}}>
                ✓ Hareketi Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function StokYonetimi({ t, rol, hedefSekme }) {
  t = t || {
    bg:"#0c0b09", card:"rgba(255,255,255,.04)", border:"rgba(255,255,255,.08)",
    text:"#e8e0d4", textMuted:"#666", accent:"#c9b882", accentBg:"rgba(201,184,130,.15)",
    input:"rgba(255,255,255,.06)", hover:"rgba(255,255,255,.06)", sidebar:"#0a0908"
  };

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
        alert('Gönderilecek renk adı bulunamadı.\n\nRenk adı dolu ve Shopify\'a yayınlanmış aktif ürün yok.');
        return;
      }
      const onay = window.confirm(
        `${rapor.aday} ürünün renk adı Shopify'a gönderilecek.\n` +
        `Hedef metafield: ${rapor.namespace}.${rapor.key}\n\n` +
        `Devam edilsin mi?`
      );
      if (!onay) return;

      const sonuc = await shopifyRenkAdlariniGonder({ kuru: false });
      let mesaj = `✓ ${sonuc.gonderilen} ürünün renk adı gönderildi.`;
      if (sonuc.atlanan?.length) mesaj += `\n${sonuc.atlanan.length} ürün atlandı (Shopify ID okunamadı).`;
      if (sonuc.hatalar?.length) {
        mesaj += `\n${sonuc.hatalar.length} üründe hata:\n` +
          sonuc.hatalar.slice(0, 5).map(h => `• ${h.kod || '?'}: ${h.hata}`).join('\n');
      }
      alert(mesaj);
    } catch (err) {
      alert('✗ Renk adı gönderim hatası: ' + (err.message || err));
    } finally {
      setRenkAdiGonderiliyor(false);
    }
  };

  const ticimaxYukle = () => {
    setTicimaxYukleniyor(true);
      fetch(`${import.meta.env.VITE_API_URL}/ticimax-urunler`)
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
    if(!window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
    try { await urunSil(id); setUrunler(p=>p.filter(u=>u.id!==id)); }
    catch(err){ alert("Silme hatası: "+err.message); }
  };

  if (yukleniyor) return <div style={{padding:60,textAlign:"center",color:t.textMuted,fontFamily:"'DM Sans',sans-serif",fontSize:16}}>⏳ Yükleniyor...</div>;

  const kritikSayisi = urunler.filter(u=>(u.varyantlar||[]).reduce((t,v)=>t+v.adet,0)<=(u.kritikStok??0)).length;

  const SEKMELER = [
    {id:"liste",      l:"📦 Ürün Listesi"},
    {id:"hareketler", l:"📜 Stok Geçmişi"},
    {id:"alim",       l:"🛒 Alım Listesi"},
    ...(sekme==="yeni"?[{id:"yeni",l:"✏ Yeni Ürün"}]:[]),
    ...(sekme==="duzenle"&&duzenleUrun?[{id:"duzenle",l:"✏ Düzenle"}]:[]),
  ];

  return (
    <div style={{minHeight:"100vh",background:t.bg,color:t.text,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#333;border-radius:4px;}
        button{cursor:pointer;border:none;background:none;font-family:inherit;}
        input,select,textarea{font-family:inherit;}select option{background:#1a1814;}
        tbody tr:hover td{background:rgba(255,255,255,.015);}
        .vega-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-scroll-x table{min-width:600px;}
        .vega-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap!important;}
        .vega-tabs button{white-space:nowrap;flex-shrink:0;}
        @media (max-width:860px){
          .vega-page-pad{padding-left:14px!important;padding-right:14px!important;}
          .vega-grid-2,.vega-grid-3{grid-template-columns:1fr!important;}
          .vega-flex-collapse{flex-direction:column!important;}
          .vega-flex-collapse>*{width:100%!important;}
        }
        @media (max-width:600px){
          .vega-hide-mobile{display:none!important;}
          .vega-header-row{flex-direction:column;align-items:stretch!important;}
          .vega-header-actions{width:100%;}
          .vega-header-actions button{flex:1;}
        }
      `}</style>

      <div className="vega-page-pad" style={{padding:"22px 28px 0"}}>
        <div className="vega-header-row" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:t.text}}>Stok Yönetimi</div>
            <div style={{fontSize:13,color:t.textMuted,marginTop:2}}>
              {urunler.length} ürün
              {kritikSayisi>0&&<span style={{color:"#eb5757",marginLeft:8}}>· ⚠ {kritikSayisi} kritik</span>}
              {/* Stok değeri artık Banka & Mutabakat > Stok Değeri sekmesinde gösteriliyor */}
              {aktifMagazaId&&<span style={{marginLeft:8,color:t.accent}}>· 📍 {magazalar.find(m=>m.id===aktifMagazaId)?.ad}</span>}
              {ticimaxUrunler.length>0&&<span style={{marginLeft:8,color:"#56ccf2"}}>· 📦 {ticimaxUrunler.length} tedarikçi ürünü</span>}
              {ticimaxYukleniyor&&<span style={{marginLeft:8,color:t.textMuted,fontSize:11}}>⏳ Ticimax...</span>}
            </div>
          </div>
          <div className="vega-header-actions" style={{display:'flex',gap:8}}>
            <button onClick={renkAdlariniGonder} disabled={renkAdiGonderiliyor}
              title="Paneldeki tüm renk adlarını Shopify'daki Renk Adı metafield'ine yazar (ürünleri yeniden yayınlamaz)"
              style={{padding:'10px 18px',borderRadius:12,background:'rgba(155,107,224,.1)',border:'1px solid rgba(155,107,224,.3)',color:'#9b6be0',fontSize:13,fontWeight:600,opacity:renkAdiGonderiliyor?.6:1}}>
              {renkAdiGonderiliyor ? '⏳ Gönderiliyor...' : '🎨 Renk Adlarını Gönder'}
            </button>
            <button onClick={()=>setTicimaxModal(true)}
              style={{padding:'10px 18px',borderRadius:12,background:'rgba(86,204,242,.1)',border:'1px solid rgba(86,204,242,.3)',color:'#56ccf2',fontSize:13,fontWeight:600}}>
              📥 Ticimax'tan İçe Aktar
            </button>
            <button onClick={()=>{setDuzenleUrun(null);setSekme('yeni');}}
              style={{padding:'10px 22px',borderRadius:12,background:t.accentBg,border:`1px solid ${t.accent}55`,color:t.accent,fontSize:13,fontWeight:700}}>
              + Yeni Ürün
            </button>
          </div>
        </div>

        <div className="vega-tabs" style={{display:"flex",gap:4,borderBottom:`1px solid ${t.border}`}}>
          {SEKMELER.map(s=>(
            <button key={s.id} onClick={()=>setSekme(s.id)} style={{padding:"10px 18px",borderRadius:"10px 10px 0 0",fontSize:13,
              background:sekme===s.id?t.accentBg:"transparent",border:`1px solid ${sekme===s.id?t.accent+"44":"transparent"}`,
              borderBottom:sekme===s.id?`1px solid ${t.bg}`:"",color:sekme===s.id?t.accent:t.textMuted}}>{s.l}</button>
          ))}
        </div>
      </div>

      <div className="vega-page-pad" style={{padding:"24px 28px 48px"}}>
        {sekme==="liste"&&<UrunListesi magazalar={magazalar} markalar={markalar} rol={rol} t={t} aktifMagazaId={aktifMagazaId}
          ticimaxUrunler={ticimaxUrunler} q={urunArama} setQ={setUrunArama}
          marka={urunMarkaFiltre} setMarka={setUrunMarkaFiltre}
          kat={urunKatFiltre} setKat={setUrunKatFiltre}
          stokDurum={urunStokFiltre} setStokDurum={setUrunStokFiltre}
          fiyatMin={urunFiyatMin} setFiyatMin={setUrunFiyatMin}
          fiyatMax={urunFiyatMax} setFiyatMax={setUrunFiyatMax}
          sayfa={urunSayfa} setSayfa={setUrunSayfa}
          onDuzenle={u=>{setDuzenleUrun(u);setSekme("duzenle");}} onSil={sil}/>}
        {sekme==="hareketler"&&<StokHareketler urunler={urunler} magazalar={magazalar} t={t}/>}
        {sekme==="alim"&&<AlimListesi urunler={urunler} ticimaxUrunler={ticimaxUrunler} magazalar={magazalar} markalar={markalar} t={t} aktifMagazaId={aktifMagazaId}/>}
        {(sekme==="yeni"||sekme==="duzenle")&&<UrunForm urun={sekme==="duzenle"?duzenleUrun:null}
          onKaydet={kaydet} onIptal={()=>setSekme("liste")} t={t} magazalar={magazalar}
          markalar={markalar} kategoriler={kategoriler}
          ticimaxUrunler={ticimaxUrunler}
          onMarkaEkle={async (ad)=>{ const m=await markaEkle({ad}); setMarkalar(p=>[...p,m]); return m; }}
          onMarkaSil={async (id)=>{ await markaSil(id); setMarkalar(p=>p.filter(m=>m.id!==id)); }}/>}
      </div>

      {/* Ticimax Import Modal */}
      {ticimaxModal && (
        <TicimaxImportModal
          t={t}
          magazalar={magazalar}
          markalar={markalar}
          setMarkalar={setMarkalar}
          onKapat={()=>setTicimaxModal(false)}
          onImportTamamlandi={()=>{ yukle(); setSekme('liste'); }}
        />
      )}
    </div>
  );
}