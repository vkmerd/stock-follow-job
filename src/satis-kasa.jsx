import { useState, useEffect, useRef, useCallback } from "react";
import { useVega } from "./VegaContext";
import { usePrint } from "./print/usePrint";
import PosYonetimModule from "./satis-kasa/PosYonetim";
import PosRaporModule from "./satis-kasa/PosRapor";
import IadeEkraniModule from "./satis-kasa/IadeEkrani";
import GunlukKasaModule from "./satis-kasa/GunlukKasa";
import DegisimEkraniModule from "./satis-kasa/DegisimEkrani";
import { FIS_CSS } from './satis-kasa/utils';
import { urunleriGetir, posTerminalleriniGetir, satislariGetir, satisKaydet, sonFisNoGetir, magazalariGetir, posTerminaliKaydet, posTerminaliGuncelle, posTerminaliSil, stokDus, stokHareketKaydet, barkodIleUrunBul } from './api';

// ─── POS TERMİNALLER ─────────────────────────────────────────────────────
// POS terminaller API'den yükleniyor
const BANKALAR = ["İş Bankası","Garanti BBVA","Yapı Kredi","Akbank","Ziraat Bankası","Halkbank","Vakıfbank","Denizbank","QNB Finansbank","TEB","HSBC","ING"];
const TAKSIT_SECENEKLERI = [1,2,3,6,9,12];

// Ürünler ve mağazalar API'den yükleniyor
// Mağazalar context'ten yükleniyor

const ODEME_TIPLERI = [
  { id:"nakit",  label:"Nakit",        ikon:"💵", renk:"#6fcf97" },
  { id:"kart",   label:"Kredi Kartı",  ikon:"💳", renk:"#56ccf2" },
  { id:"havale", label:"Havale / EFT", ikon:"🏦", renk:"#bb87fc" },
  { id:"taksit", label:"Taksit",       ikon:"📅", renk:"#f2c94c" },
  // Veresiye de bir ödeme tipi: satış normal akıştan kaydediliyor (stok düşüyor, fişe
  // yazılıyor), tutar kasaya girmiyor, müşterinin cari hesabına alacak olarak işleniyor.
  { id:"veresiye", label:"Veresiye",    ikon:"🧾", renk:"#eb5757" },
];

// Satış geçmişi API'den yükleniyor

// ─── YARDIMCI ─────────────────────────────────────────────────────────────
// FiĹź numarası backend'den alınıyor - local sayaç yok
function yeniId()    { return `s${Date.now()}${Math.random().toString(36).slice(2,5)}`; }
function para(v)     { return `₺${Number(v||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function tarihFormat(iso) {
  const d=new Date(iso);
  return d.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})+" "+d.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
}
function stokVar(urun, renk, beden, magazaAdi, magazaIdMap = {}) { // magaza -> magazaAdi olarak değiştirildi
  const magazaId = magazaIdMap[magazaAdi]; // magazaAdi'nın ID'sini al
  // "Tek Ebat" ile null/empty beden eşit say
  const bedenEsit = (a, b) => {
    const norm = v => (v === "Tek Ebat" || v === null || v === undefined || v === "") ? "" : v;
    return norm(a) === norm(b);
  };
  return (urun.stok || []).find(s =>
    s.renk === renk && bedenEsit(s.beden, beden) &&
    (s.magazaId === magazaId) // Sadece magazaId'ye göre filtrele
  )?.adet || 0;
}
function komisyonHesapla(tutar, oran) { return tutar * (oran/100); }

// ─── POS YÖNETİM SAYFASI ─────────────────────────────────────────────────
function PosYonetim({ terminaller, setTerminaller, magazalar = [] }) {
  const [modal, setModal] = useState(null); // null | "yeni" | terminal obj
  const bos = { id:"", ad:"", banka:BANKALAR[0], terminalno:"", magaza:magazalar[0] || "Merkez Mağaza", komisyon:{1:1.49,2:1.79,3:1.99,6:2.49,9:2.99,12:3.49}, aktif:true };
  const [form, setForm] = useState(bos);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const setKom = (taksit,v) => setForm(f=>({...f,komisyon:{...f.komisyon,[taksit]:Number(v)}}));

  const kaydet = async () => {
    if(!form.ad.trim()||!form.terminalno.trim()) return alert("Ad ve terminal no zorunlu.");
    try {
      const kaydedilen = await posTerminaliKaydet(form);
      const guncel = await posTerminalleriniGetir();
      setTerminaller(guncel);
      setModal(null);
    } catch(err) {
      alert("Kayıt hatası: " + err.message);
    }
  };

  const inp={background:t.input,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.text,fontSize:13,fontFamily:"inherit",width:"100%",outline:"none"};
  const lbl={fontSize:11,color:t.textMuted,marginBottom:5,letterSpacing:.5,textTransform:"uppercase"};

  return (
    <div style={{padding:"24px 28px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:t.text}}>POS Terminal Yönetimi</div>
          <div style={{fontSize:13,color:t.textMuted,marginTop:3}}>{terminaller.filter(t=>t.aktif).length} aktif terminal</div>
        </div>
        <button onClick={()=>{setForm(bos);setModal("yeni");}} style={{padding:"10px 20px",borderRadius:12,background:"linear-gradient(135deg,rgba(201,184,130,0.25),rgba(201,184,130,0.12))",border:"1px solid rgba(201,184,130,0.4)",color:"#c9b882",fontSize:14,fontWeight:600}}>+ Yeni Terminal</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
        {terminaller.map(t=>(
          <div key={t.id} style={{background:t.card,border:`1px solid ${t.aktif?t.border:"rgba(255,255,255,0.04)"}`,borderRadius:14,padding:20,opacity:t.aktif?1:.5}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <div style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:3}}>{t.ad}</div>
                <div style={{fontSize:12,color:t.textMuted}}>{t.banka}</div>
                <div style={{fontSize:11,color:t.textMuted,marginTop:2}}>No: {t.terminalno}</div>
                <div style={{fontSize:11,color:t.textMuted}}>{t.magaza.split("—")[1]?.trim()}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:t.aktif?"rgba(111,207,151,0.1)":"rgba(255,255,255,0.05)",color:t.aktif?"#6fcf97":t.textMuted}}>{t.aktif?"Aktif":"Pasif"}</span>
                <button onClick={()=>{setForm(t);setModal("duzenle");}} style={{padding:"5px 12px",borderRadius:8,background:t.input,border:`1px solid ${t.border}`,color:"#aaa",fontSize:12}}>✎</button>
              </div>
            </div>
            <div style={{background:t.card,borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:t.textMuted,marginBottom:8,letterSpacing:.5}}>KOMİSYON ORANLARI</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {TAKSIT_SECENEKLERI.map(n=>(
                  <div key={n} style={{textAlign:"center",background:t.hover,borderRadius:8,padding:"6px 10px",minWidth:52}}>
                    <div style={{fontSize:10,color:t.textMuted}}>{n===1?"Peşin":`${n} Taksit`}</div>
                    <div style={{fontSize:13,fontWeight:600,color:"#c9b882",marginTop:2}}>%{t.komisyon[n]??"-"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Terminal formu modal */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:t.sidebar,border:`1px solid ${t.border}`,borderRadius:18,width:"100%",maxWidth:580,maxHeight:"90vh",overflow:"auto",padding:28}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>{modal==="yeni"?"Yeni Terminal Ekle":"Terminal Düzenle"}</div>
              <button onClick={()=>setModal(null)} style={{color:t.textMuted,fontSize:20}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div><div style={lbl}>Terminal Adı</div><input style={inp} value={form.ad} onChange={e=>set("ad",e.target.value)} placeholder="İş Bankası Merkez"/></div>
                <div><div style={lbl}>Terminal No</div><input style={inp} value={form.terminalno} onChange={e=>set("terminalno",e.target.value)} placeholder="T-1234567"/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div><div style={lbl}>Banka</div>
                  <select style={inp} value={form.banka} onChange={e=>set("banka",e.target.value)}>
                    {BANKALAR.map(b=><option key={b}>{b}</option>)}
                  </select>
                </div>
                <div><div style={lbl}>Mağaza</div>
                  <select style={inp} value={form.magaza} onChange={e=>set("magaza",e.target.value)}>
                    {magazalar.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Komisyon oranları */}
              <div>
                <div style={lbl}>Komisyon Oranları (%)</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                  {TAKSIT_SECENEKLERI.map(n=>(
                    <div key={n}>
                      <div style={{fontSize:11,color:t.textMuted,marginBottom:4}}>{n===1?"Peşin":`${n} Taksit`}</div>
                      <div style={{position:"relative"}}>
                        <input style={{...inp,paddingRight:28}} type="number" step="0.01" min={0} max={10}
                          value={form.komisyon[n]??""} onChange={e=>setKom(n,e.target.value)}/>
                        <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:t.textMuted,pointerEvents:"none"}}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div onClick={()=>set("aktif",!form.aktif)} style={{width:40,height:22,borderRadius:11,background:form.aktif?"#6fcf97":t.input,position:"relative",transition:"background .2s",cursor:"pointer"}}>
                  <div style={{position:"absolute",top:3,left:form.aktif?21:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
                </div>
                <span style={{fontSize:13,color:form.aktif?"#6fcf97":t.textMuted}}>{form.aktif?"Aktif":"Pasif"}</span>
              </div>

              <div style={{display:"flex",gap:12,marginTop:6}}>
                <button onClick={()=>setModal(null)} style={{flex:1,padding:"10px 0",borderRadius:10,background:"transparent",border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13}}>İptal</button>
                <button onClick={kaydet} style={{flex:2,padding:"10px 0",borderRadius:10,background:"linear-gradient(135deg,rgba(201,184,130,0.3),rgba(201,184,130,0.15))",border:"1px solid rgba(201,184,130,0.4)",color:"#c9b882",fontSize:13,fontWeight:600}}>✓ Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VARYANT SEÇİCİ ───────────────────────────────────────────────────────
function VaryantSecici({ urun, magaza, onSec, onIptal, magazaIdMap={}, t={} }) {
  t = Object.keys(t).length ? t : {
    bg:'#0c0b09', card:'rgba(255,255,255,.04)', border:'rgba(255,255,255,.08)',
    text:'#e8e0d4', textMuted:'#666', accent:'#c9b882', accentBg:'rgba(201,184,130,.15)',
    input:'rgba(255,255,255,.06)', hover:'rgba(255,255,255,.06)', sidebar:'#14120f'
  };
  const magazaKodu = magazaIdMap?.[magaza] || magaza;
  const renkler=[...new Set(urun.stok.filter(s=>s.magaza===magaza||s.magaza===magazaKodu||s.magazaId===magazaIdMap?.[magaza]).map(s=>s.renk))];
  const [renk,setRenk]=useState(renkler[0]||"");
  const bedenler=[...new Set(urun.stok.filter(s=>(s.magaza===magaza||s.magazaId===magazaIdMap?.[magaza])&&s.renk===renk).map(s=>s.beden||"Tek Ebat"))];
  const [beden,setBeden]=useState(bedenler[0]||"");
  const mevcut=stokVar(urun,renk,beden,magaza, magazaIdMap);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:t.sidebar,border:`1px solid ${t.border}`,borderRadius:18,width:"100%",maxWidth:440,padding:28}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:t.text,marginBottom:4}}>{urun.ad}</div>
        <div style={{fontSize:12,color:t.textMuted,marginBottom:22}}>{urun.marka} · {urun.altKategori} · {para(urun.satisF)}</div>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,color:t.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:10}}>Renk</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {renkler.map(r=><button key={r} onClick={()=>{setRenk(r);setBeden(urun.stok.find(s=>s.magaza===magaza&&s.renk===r)?.beden||"");}} style={{padding:"7px 16px",borderRadius:8,fontSize:13,fontFamily:"inherit",background:renk===r?"rgba(201,184,130,0.18)":"rgba(255,255,255,0.04)",border:`1px solid ${renk===r?"rgba(201,184,130,0.5)":t.border}`,color:renk===r?"#c9b882":t.textMuted}}>{r}</button>)}
          </div>
        </div>
        <div style={{marginBottom:22}}>
          <div style={{fontSize:11,color:t.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:10}}>Beden / Numara</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {bedenler.length===0?<span style={{fontSize:12,color:t.textMuted}}>Beden bilgisi yok</span>:bedenler.map(b=>{ const gercekB=b==="Tek Ebat"?"":b; const stk=stokVar(urun,renk,gercekB,magaza, magazaIdMap)||stokVar(urun,renk,b,magaza, magazaIdMap); return (
              <button key={b} onClick={()=>stk>0&&setBeden(b)} style={{padding:"7px 16px",borderRadius:8,fontSize:13,fontFamily:"inherit",background:beden===b?"rgba(201,184,130,0.18)":"rgba(255,255,255,0.04)",border:`1px solid ${beden===b?"rgba(201,184,130,0.5)":stk===0?"rgba(255,255,255,0.04)":t.border}`,color:beden===b?"#c9b882":stk===0?"#333":t.textMuted,opacity:stk===0?.4:1,cursor:stk===0?"not-allowed":"pointer",position:"relative"}}>
                {b}{stk>0&&stk<=3&&<span style={{position:"absolute",top:-5,right:-5,fontSize:9,background:"#eb5757",color:"#fff",borderRadius:8,padding:"1px 5px"}}>{stk}</span>}
              </button>
            );})}
          </div>
        </div>
        <div style={{padding:"10px 14px",background:t.card,borderRadius:10,marginBottom:22,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,color:t.textMuted}}>Mevcut Stok</span>
          <span style={{fontSize:16,fontWeight:700,color:mevcut===0?"#eb5757":mevcut<=3?"#f2c94c":"#6fcf97"}}>{mevcut} adet</span>
        </div>
        <div style={{display:"flex",gap:12}}>
          <button onClick={onIptal} style={{flex:1,padding:"11px 0",borderRadius:10,background:"transparent",border:`1px solid ${t.border}`,color:t.textMuted,fontSize:13,fontFamily:"inherit"}}>İptal</button>
          <button onClick={()=>mevcut>0&&onSec(renk,beden)} disabled={!mevcut} style={{flex:2,padding:"11px 0",borderRadius:10,fontFamily:"inherit",fontWeight:600,fontSize:14,background:mevcut>0?"linear-gradient(135deg,rgba(201,184,130,0.3),rgba(201,184,130,0.15))":"rgba(255,255,255,0.04)",border:`1px solid ${mevcut>0?"rgba(201,184,130,0.5)":t.border}`,color:mevcut>0?"#c9b882":"#444",cursor:mevcut>0?"pointer":"not-allowed"}}>Sepete Ekle — {para(urun.satisF)}</button>
        </div>
      </div>
    </div>
  );
}

// ─── ÖDEME MODAL (POS + KOMİSYON) ────────────────────────────────────────
function OdemeModal({ toplam, magaza, terminaller, onTamamla, onIptal, t={} }) {
  t = Object.keys(t).length ? t : {
    bg:'#0c0b09', card:'rgba(255,255,255,.04)', border:'rgba(255,255,255,.08)',
    text:'#e8e0d4', textMuted:'#666', accent:'#c9b882', accentBg:'rgba(201,184,130,.15)',
    input:'rgba(255,255,255,.06)', hover:'rgba(255,255,255,.06)', sidebar:'#14120f'
  };
  const [odemeler, setOdemeler] = useState([{ tip:"nakit", tutar:toplam, posId:null, taksit:1 }]);

  const odenenToplam = odemeler.reduce((t,o)=>t+Number(o.tutar||0),0);
  const kalan        = Math.max(0, toplam - odenenToplam);
  const fazla        = Math.max(0, odenenToplam - toplam);
  // Eksik ödeme artık satışı bloklamıyor — kalan tutar otomatik olarak indirime dönüştürülüp
  // fişte "İndirim" satırı olarak basılıyor. Sadece fazla ödeme (para üstü) hâlâ eşitlik istiyor.
  const tamam        = fazla < 0.01;

  const magazaTerminalleri = terminaller.filter(t=>t.aktif&&t.magaza===magaza);

  const tipEkle = (tip) => {
    if(odemeler.some(o=>o.tip===tip)) return;
    const ilkPos = magazaTerminalleri[0]?.id||null;
    setOdemeler(prev=>[...prev,{tip, tutar:Number(kalan.toFixed(2)), posId:["kart","taksit"].includes(tip)?ilkPos:null, taksit:tip==="taksit"?3:1}]);
  };
  const tipSil = (tip) => setOdemeler(prev=>prev.filter(o=>o.tip!==tip));
  const guncelle = (tip,alan,val) => setOdemeler(prev=>prev.map(o=>o.tip===tip?{...o,[alan]:val}:o));

  // Komisyon hesapla
  const komisyonBilgi = (o) => {
    if(!["kart","taksit"].includes(o.tip)||!o.posId) return {oran:0,tutar:0,net:Number(o.tutar||0)};
    const pos = terminaller.find(t=>t.id===o.posId);
    if(!pos) return {oran:0,tutar:0,net:Number(o.tutar||0)};
    const oran = pos.komisyon[o.taksit]??pos.komisyon[1]??0;
    const tutar = komisyonHesapla(Number(o.tutar||0), oran);
    return {oran, tutar, net:Number(o.tutar||0)-tutar, banka:pos.banka, terminalno:pos.terminalno};
  };

  const toplamKomisyon = odemeler.reduce((t,o)=>t+komisyonBilgi(o).tutar,0);
  const netTahsilat    = odemeler.reduce((t,o)=>t+komisyonBilgi(o).net,0);

  const inp={background:t.input,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.text,fontSize:14,fontFamily:"inherit",outline:"none"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:t.sidebar,border:`1px solid ${t.border}`,borderRadius:20,width:"100%",maxWidth:580,overflow:"hidden"}}>
        {/* Başlık */}
        <div style={{padding:"20px 26px",background:"rgba(201,184,130,0.06)",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:t.text}}>Ödeme Al</div>
            <div style={{fontSize:32,fontWeight:700,color:"#c9b882",marginTop:4,fontFamily:"'Playfair Display',serif"}}>{para(toplam)}</div>
          </div>
          <button onClick={onIptal} style={{color:t.textMuted,fontSize:20,marginTop:4}}>✕</button>
        </div>

        <div style={{padding:"20px 26px",display:"flex",flexDirection:"column",gap:16,maxHeight:"75vh",overflowY:"auto"}}>
          {/* Ödeme yöntemi seç */}
          <div>
            <div style={{fontSize:11,color:t.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:10}}>Ödeme Yöntemi</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {ODEME_TIPLERI.map(t=>{
                const secili=odemeler.some(o=>o.tip===t.id);
                return <button key={t.id} onClick={()=>secili?undefined:tipEkle(t.id)} style={{padding:"8px 16px",borderRadius:10,fontSize:13,fontFamily:"inherit",display:"flex",alignItems:"center",gap:7,background:secili?"rgba(86,204,242,0.1)":"rgba(255,255,255,0.04)",border:`1px solid ${secili?"rgba(86,204,242,0.4)":t.border}`,color:secili?"#56ccf2":t.textMuted,cursor:secili?"default":"pointer"}}>{t.ikon} {t.label} {secili&&"✓"}</button>;
              })}
            </div>
          </div>

          {/* Her ödeme satırı */}
          {odemeler.map(o=>{
            const tipBilgi=ODEME_TIPLERI.find(t=>t.id===o.tip);
            const kb=komisyonBilgi(o);
            const kartOdeme=["kart","taksit"].includes(o.tip);
            const selectedPos=terminaller.find(t=>t.id===o.posId);
            return (
              <div key={o.tip} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden"}}>
                {/* Ödeme başlığı */}
                <div style={{padding:"12px 16px",borderBottom:kartOdeme?`1px solid ${t.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:14,color:tipBilgi.renk,fontWeight:600}}>{tipBilgi.ikon} {tipBilgi.label}</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <input style={{...inp,width:120,textAlign:"right",fontSize:15,fontWeight:600}} type="number" value={o.tutar} onChange={e=>guncelle(o.tip,"tutar",e.target.value)}/>
                      {kalan>0&&Number(o.tutar)<toplam&&<button onClick={()=>guncelle(o.tip,"tutar",Number(Number(o.tutar||0)+kalan).toFixed(2))} style={{padding:"6px 10px",borderRadius:7,background:t.input,border:`1px solid ${t.border}`,color:t.textMuted,fontSize:11,whiteSpace:"nowrap",fontFamily:"inherit"}}>+Kalan</button>}
                    </div>
                    {odemeler.length>1&&<button onClick={()=>tipSil(o.tip)} style={{color:"#444",fontSize:16,padding:"2px 6px"}}>✕</button>}
                  </div>
                </div>

                {/* POS & Taksit seçimi */}
                {kartOdeme&&(
                  <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
                    {/* POS Seç */}
                    <div>
                      <div style={{fontSize:10,color:t.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>POS Terminal Seç</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {magazaTerminalleri.length===0
                          ? <div style={{fontSize:12,color:"#eb5757"}}>⚠ Bu mağazada aktif POS terminali yok</div>
                          : magazaTerminalleri.map(t=>(
                            <button key={t.id} onClick={()=>guncelle(o.tip,"posId",t.id)} style={{
                              padding:"8px 14px",borderRadius:10,fontSize:12,fontFamily:"inherit",textAlign:"left",
                              background:o.posId===t.id?"rgba(86,204,242,0.12)":"rgba(255,255,255,0.03)",
                              border:`1px solid ${o.posId===t.id?"rgba(86,204,242,0.4)":"rgba(255,255,255,0.07)"}`,
                              color:o.posId===t.id?"#56ccf2":t.textMuted,
                            }}>
                              <div style={{fontWeight:600}}>{t.banka}</div>
                              <div style={{fontSize:10,color:o.posId===t.id?"rgba(86,204,242,0.7)":"#444",marginTop:1}}>{t.ad} · {t.terminalno}</div>
                            </button>
                          ))}
                      </div>
                    </div>

                    {/* Taksit */}
                    <div>
                      <div style={{fontSize:10,color:t.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Taksit Sayısı</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {TAKSIT_SECENEKLERI.map(n=>{
                          const oran=selectedPos?.komisyon[n];
                          return (
                            <button key={n} onClick={()=>guncelle(o.tip,"taksit",n)} style={{
                              padding:"7px 12px",borderRadius:9,fontSize:12,fontFamily:"inherit",textAlign:"center",minWidth:64,
                              background:o.taksit===n?"rgba(242,201,76,0.15)":"rgba(255,255,255,0.03)",
                              border:`1px solid ${o.taksit===n?"rgba(242,201,76,0.5)":"rgba(255,255,255,0.07)"}`,
                              color:o.taksit===n?"#f2c94c":t.textMuted,
                            }}>
                              <div>{n===1?"Peşin":`${n} Taksit`}</div>
                              {oran!=null&&<div style={{fontSize:10,color:o.taksit===n?"rgba(242,201,76,0.7)":"#444",marginTop:1}}>%{oran}</div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Komisyon özeti */}
                    {o.posId&&Number(o.tutar)>0&&(
                      <div className="vega-grid-3" style={{background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"10px 14px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                        <div><div style={{fontSize:10,color:t.textMuted,marginBottom:3}}>Komisyon Oranı</div><div style={{fontSize:13,color:"#f2c94c",fontWeight:600}}>%{kb.oran}</div></div>
                        <div><div style={{fontSize:10,color:t.textMuted,marginBottom:3}}>Komisyon Tutarı</div><div style={{fontSize:13,color:"#eb5757",fontWeight:600}}>-{para(kb.tutar)}</div></div>
                        <div><div style={{fontSize:10,color:t.textMuted,marginBottom:3}}>Net Tahsilat</div><div style={{fontSize:13,color:"#6fcf97",fontWeight:600}}>{para(kb.net)}</div></div>
                      </div>
                    )}
                    {o.taksit>1&&Number(o.tutar)>0&&(
                      <div style={{fontSize:12,color:t.textMuted}}>Aylık {para(Number(o.tutar)/o.taksit)} × {o.taksit} = {para(Number(o.tutar))}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Genel özet */}
          <div style={{background:"rgba(255,255,255,0.02)",borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:t.textMuted}}><span>Ödenen</span><span style={{color:kalan>0?"#f2c94c":fazla>0?"#f2c94c":"#6fcf97",fontWeight:700}}>{para(odenenToplam)}</span></div>
            {kalan>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#f2c94c"}}><span>Kalan (indirim olarak fişe yazılacak)</span><span style={{fontWeight:700}}>{para(kalan)}</span></div>}
            {fazla>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#f2c94c"}}><span>Para Üstü</span><span style={{fontWeight:700}}>{para(fazla)}</span></div>}
            {toplamKomisyon>0&&(
              <>
                <div style={{height:1,background:t.hover,margin:"4px 0"}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#eb5757"}}><span>Toplam Komisyon</span><span>-{para(toplamKomisyon)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#6fcf97",fontWeight:600}}><span>Net Tahsilat</span><span>{para(netTahsilat)}</span></div>
              </>
            )}
          </div>

          <div style={{display:"flex",gap:12}}>
            <button onClick={onIptal} style={{flex:1,padding:"13px 0",borderRadius:12,background:"transparent",border:`1px solid ${t.border}`,color:t.textMuted,fontSize:14,fontFamily:"inherit"}}>İptal</button>
            <button onClick={()=>{
              if(!tamam) return;
              const odemeDetay = odemeler.map(o=>{
                const kb=komisyonBilgi(o);
                const pos=terminaller.find(t=>t.id===o.posId);
                return {...o,banka:pos?.banka||null,terminalno:pos?.terminalno||null,posAd:pos?.ad||null,komisyon:kb.oran,komisyonTutar:kb.tutar,netTahsilat:kb.net};
              });
              onTamamla(odemeDetay,fazla,kalan);
            }} disabled={!tamam} style={{flex:2,padding:"13px 0",borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:15,background:tamam?"linear-gradient(135deg,rgba(111,207,151,0.35),rgba(111,207,151,0.18))":"rgba(255,255,255,0.04)",border:`1px solid ${tamam?"rgba(111,207,151,0.5)":t.border}`,color:tamam?"#6fcf97":"#333",cursor:tamam?"pointer":"not-allowed"}}>
              {!tamam ? "Ödeme fazla" : kalan>0.01 ? `✓ Satışı Tamamla — ${para(kalan)} indirim` : "✓ Satışı Tamamla"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FİŞ MODAL ────────────────────────────────────────────────────────────
function FisModal({ satis, onKapat, t={} }) {
  t = Object.keys(t).length ? t : {
    bg:'#0c0b09', card:'rgba(255,255,255,.04)', border:'rgba(255,255,255,.08)',
    text:'#e8e0d4', textMuted:'#666', accent:'#c9b882', accentBg:'rgba(201,184,130,.15)',
    input:'rgba(255,255,255,.06)', hover:'rgba(255,255,255,.06)', sidebar:'#14120f'
  };
  const print = usePrint();
  const [qzYazdiriliyor, setQzYazdiriliyor] = useState(false);
  const qzFisYazdir = async () => {
    setQzYazdiriliyor(true);
    try {
      await print.fisYazdir(satis);
    } catch (err) {
      alert("Fiş yazdırma hatası: " + err.message);
    } finally {
      setQzYazdiriliyor(false);
    }
  };
  const magazaAd = typeof satis.magaza==="object" ? satis.magaza?.ad : satis.magaza
  const sat = (l,r,bold=false) => (
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
      <span style={{color:bold?"#111":t.textMuted,fontWeight:bold?700:400}}>{l}</span>
      <span style={{color:bold?"#111":t.textMuted,fontWeight:bold?700:400}}>{r}</span>
    </div>
  )
  const cizgi = (style="dashed") => <div style={{borderTop:`1px style #ccc`,margin:"10px 0"}}/>

  const yazdir = () => {
    const win = window.open("","_blank","width=400,height=700")
    win.document.write(`<!DOCTYPE html><html><head><title>Fiş</title>
    <style>${FIS_CSS}</style></head><body>
    <div class="c" style="margin-bottom:12px">
      <div style="font-size:20px;font-weight:900;letter-spacing:3px">VEGA</div>
      <div class="sm">Çanta & Ayakkabı</div>
      <div class="sm">${magazaAd||""}</div>
    </div>
    <hr/>
    <div class="row sm"><span>Tarih:</span><span>${tarihFormat(satis.tarih)}</span></div>
    <div class="row sm"><span>Fiş No:</span><span style="font-weight:700">${satis.fisNo}</span></div>
    ${(satis.musteri||satis.musteriAd)?`<div class="row sm"><span>Müşteri:</span><span>${typeof satis.musteri==="object"?(satis.musteri?.ad||"")+" "+(satis.musteri?.soyad||""):satis.musteri||satis.musteriAd||""}</span></div>`:""}
    ${satis.kasiyer?`<div class="row sm"><span>Kasiyer:</span><span>${satis.kasiyer}</span></div>`:""}
    <hr/>
    ${(satis.kalemler||[]).map(k=>{
      const varyant=[k.renk,k.beden].filter(Boolean).join("/")
      const indirimStr=k.indirim>0?" (-%"+k.indirim+")":""
      const barkodStr=k.barkod?'<div class="sm" style="padding-left:4px;color:#aaa;font-family:monospace">#'+k.barkod+"</div>":""
      const markaStr=k.marka?'<span style="color:#888;margin-right:4px">'+k.marka+'</span>':""
      return '<div class="row bold"><span style="max-width:60%">'+markaStr+k.urunAd+"</span><span>"+para(k.toplam)+"</span></div>"
        +'<div class="sm" style="margin-bottom:2px;padding-left:4px">'+varyant+" × "+k.adet+" × "+para(k.birimFiyat)+indirimStr+"</div>"
        +barkodStr
    }).join("")}
    <hr/>
    <div class="row sm"><span>Ara Toplam</span><span>${para(satis.araToplam)}</span></div>
    ${satis.genelIndirimTutar>0?`<div class="row sm" style="color:#e74c3c"><span>İndirim (%${satis.genelIndirim})</span><span>-${para(satis.genelIndirimTutar)}</span></div>`:""}
    <div class="row sm"><span>KDV (Dahil)</span><span>${para(satis.kdvToplam)}</span></div>
    <div class="row lg" style="margin-top:6px"><span>TOPLAM</span><span>${para(satis.genelToplam)}</span></div>
    <hr/>
    ${satis.odemeler.map(o=>{
      const tip=ODEME_TIPLERI.find(x=>x.id===o.tip)
      return `<div class="row sm"><span>${tip?.ikon||""} ${tip?.label||o.tip}</span><span>${para(o.tutar)}</span></div>
      ${o.banka?`<div class="sm" style="padding-left:16px">${o.banka}${o.taksit>1?" · "+o.taksit+" Taksit":""}</div>`:""}
      ${o.komisyonTutar>0?`<div class="sm" style="padding-left:16px;color:#e74c3c">Komisyon: -${para(o.komisyonTutar)}</div>`:""}`
    }).join("")}
    ${satis.paraUstu>0?`<div class="row sm" style="margin-top:4px"><span>Para Üstü</span><span>${para(satis.paraUstu)}</span></div>`:""}
    ${satis.odemeler.some(o=>o.komisyonTutar>0)?`
    <hr/>
    <div class="row sm" style="color:#e74c3c"><span>Toplam Komisyon</span><span>-${para(satis.odemeler.reduce((t,o)=>t+o.komisyonTutar,0))}</span></div>
    <div class="row bold" style="color:#27ae60"><span>Net Tahsilat</span><span>${para(satis.odemeler.reduce((t,o)=>t+o.netTahsilat,0))}</span></div>`:""}
    <hr/>
    <div class="c sm" style="margin-top:8px">Alışverişiniz için teşekkürler :)</div>
    <div class="c sm">Vega Çanta & Ayakkabı</div>
    <div class="c sm">Instagram: vegacantastore - www.vegacantastore.com</div>
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:340,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,.6)"}}>
        <div style={{padding:"20px 20px 0",fontFamily:"monospace",fontSize:12,color:t.text,maxHeight:"80vh",overflowY:"auto"}}>

          {/* Başlık */}
          <div style={{textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:22,fontWeight:900,letterSpacing:3,color:"#111"}}>VEGA</div>
            <div style={{fontSize:10,color:t.textMuted}}>Çanta & Ayakkabı</div>
            <div style={{fontSize:10,color:t.textMuted}}>{magazaAd}</div>
          </div>
          {cizgi()}

          {/* Fiş bilgileri */}
          {sat("Tarih:", tarihFormat(satis.tarih))}
          {sat("Fiş No:", satis.fisNo, true)}
          {(satis.musteri||satis.musteriAd) && sat("Müşteri:", typeof satis.musteri==="object"?`${satis.musteri?.ad||""} ${satis.musteri?.soyad||""}`.trim():(satis.musteri||satis.musteriAd||""))}
          {satis.kasiyer && sat("Kasiyer:", satis.kasiyer)}
          {cizgi()}

          {/* Ürünler */}
          {(satis.kalemler||[]).map((k,i)=>(
            <div key={i} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:12}}>
                <span style={{maxWidth:"65%",wordBreak:"break-word"}}>{k.urunAd}</span>
                <span>{para(k.toplam)}</span>
              </div>
              <div style={{color:"#999",fontSize:10,marginTop:1}}>
                {k.marka&&<span style={{marginRight:6,color:"#888"}}>{k.marka}</span>}
                {[k.renk,k.beden].filter(Boolean).join("/")} × {k.adet} × {para(k.birimFiyat)}
                {k.indirim>0&&<span style={{color:"#e74c3c"}}> (-%{k.indirim})</span>}
              </div>
            </div>
          ))}
          {cizgi()}

          {/* Toplamlar */}
          {sat("Ara Toplam", para(satis.araToplam))}
          {satis.genelIndirimTutar>0&&(
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,color:"#e74c3c",fontSize:11}}>
              <span>İndirim (%{satis.genelIndirim})</span><span>-{para(satis.genelIndirimTutar)}</span>
            </div>
          )}
          {sat("KDV (Dahil)", para(satis.kdvToplam))}
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:900,fontSize:18,color:"#111",margin:"8px 0 4px"}}>
            <span>TOPLAM</span><span>{para(satis.genelToplam)}</span>
          </div>
          {cizgi()}

          {/* Ödemeler */}
          {satis.odemeler.map((o,i)=>{
            const tip=ODEME_TIPLERI.find(x=>x.id===o.tip)
            return (
              <div key={i} style={{marginBottom:5}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.text,fontWeight:600}}>
                  <span>{tip?.ikon} {tip?.label||o.tip}</span><span>{para(o.tutar)}</span>
                </div>
                {o.banka&&<div style={{fontSize:10,color:"#aaa",paddingLeft:16}}>{o.banka}{o.taksit>1&&` · ${o.taksit} Taksit`}</div>}
                {o.komisyonTutar>0&&<div style={{fontSize:10,color:"#e74c3c",paddingLeft:16}}>Komisyon: -${para(o.komisyonTutar)}</div>}
              </div>
            )
          })}
          {satis.paraUstu>0&&sat("Para Üstü", para(satis.paraUstu))}

          {satis.odemeler.some(o=>o.komisyonTutar>0)&&(<>
            {cizgi()}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#e74c3c"}}>
              <span>Toplam Komisyon</span><span>-{para(satis.odemeler.reduce((t,o)=>t+o.komisyonTutar,0))}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#27ae60"}}>
              <span>Net Tahsilat</span><span>{para(satis.odemeler.reduce((t,o)=>t+o.netTahsilat,0))}</span>
            </div>
          </>)}

          {cizgi()}
          <div style={{textAlign:"center",color:"#aaa",fontSize:10,paddingBottom:16}}>
            Alışverişiniz için teşekkürler 🛍<br/>Vega Çanta & Ayakkabı
            <div style={{marginTop:4}}>Instagram: vegacantastore &nbsp;·&nbsp;  www.vegacantastore.com</div>
          </div>

          {/* QZ Tray — termal fiş yazıcısı (Zjiang vb.), ham ESC/POS */}
          <div style={{padding:"10px 12px",background:"#f7f7f7",border:"1px solid #e5e5e5",borderRadius:10,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:print.bagli?"#6fcf97":"#eb5757"}}/>
              <span style={{fontSize:11,color:"#777"}}>QZ Tray: {print.bagli?"Bağlı":"Bağlı Değil"}</span>
              {!print.bagli&&<button onClick={print.baglan} disabled={print.baglaniyor} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"#eef7fb",border:"1px solid #cce8f2",color:"#2596be",cursor:"pointer"}}>
                {print.baglaniyor?"Bağlanıyor...":"Bağlan"}
              </button>}
            </div>
            {print.bagli&&(
              <div style={{display:"flex",gap:6}}>
                <select value={print.fisYazici} onChange={e=>print.fisYaziciSec(e.target.value)}
                  style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid #ddd",fontSize:11,fontFamily:"inherit",outline:"none"}}>
                  <option value="">Fiş yazıcısı seçin...</option>
                  {print.yazicilar.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={qzFisYazdir} disabled={qzYazdiriliyor||!print.fisYazici} style={{
                  padding:"6px 12px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",
                  background:"#eaf7ef",border:"1px solid #bfe8cf",color:"#2f9e5c"}}>
                  {qzYazdiriliyor?"...":"🖨 QZ"}
                </button>
              </div>
            )}
            {print.hata&&<div style={{marginTop:6,fontSize:10,color:"#eb5757"}}>{print.hata}</div>}
          </div>
        </div>

        <div style={{display:"flex",borderTop:"1px solid #e0e0e0"}}>
          <button onClick={yazdir} style={{flex:1,padding:"14px 0",background:"#f5f5f5",color:t.textMuted,fontSize:13,fontFamily:"inherit",fontWeight:600,border:"none",cursor:"pointer"}}>🖨 Tarayıcıdan</button>
          <button onClick={onKapat} style={{flex:1,padding:"14px 0",background:t.sidebar,color:"#c9b882",fontSize:13,fontFamily:"inherit",fontWeight:700,border:"none",cursor:"pointer"}}>✓ Yeni Satış</button>
        </div>
      </div>
    </div>
  );
}

// ─── POS RAPOR SAYFASI ────────────────────────────────────────────────────
function PosRapor({ gecmis, terminaller, magazalar = [] }) {
  const [donem, setDonem] = useState("bugun");
  const [magazaFiltre, setMagazaFiltre] = useState("Tümü");

  const simdi = new Date();
  const filtrele = (s) => {
    const t=new Date(s.tarih);
    const magazaOk = magazaFiltre==="Tümü"||(typeof s.magaza==="object"?s.magaza?.ad:s.magaza)===magazaFiltre;
    if(!magazaOk) return false;
    if(donem==="bugun") return t.toDateString()===simdi.toDateString();
    if(donem==="bu_hafta") { const h=new Date(simdi); h.setDate(simdi.getDate()-7); return t>=h; }
    if(donem==="bu_ay") return t.getMonth()===simdi.getMonth()&&t.getFullYear()===simdi.getFullYear();
    return true;
  };

  const filtreli = gecmis.filter(filtrele);

  // POS bazlı gruplama
  const posBazli = {};
  filtreli.forEach(s=>{
    s.odemeler.forEach(o=>{
      if(!["kart","taksit"].includes(o.tip)||!o.posId) return;
      const pos=terminaller.find(t=>t.id===o.posId)||{ad:o.posAd||"Bilinmeyen",banka:o.banka||"—",id:o.posId};
      if(!posBazli[o.posId]) posBazli[o.posId]={pos,islemSayisi:0,brutToplam:0,komisyonToplam:0,netToplam:0,taksitDagilim:{}};
      posBazli[o.posId].islemSayisi++;
      posBazli[o.posId].brutToplam+=Number(o.tutar||0);
      posBazli[o.posId].komisyonToplam+=Number(o.komisyonTutar||0);
      posBazli[o.posId].netToplam+=Number(o.netTahsilat||0);
      const tk=o.taksit||1;
      posBazli[o.posId].taksitDagilim[tk]=(posBazli[o.posId].taksitDagilim[tk]||0)+1;
    });
  });

  // Ödeme tipi özeti
  const odemeTipiOzeti = {};
  filtreli.forEach(s=>s.odemeler.forEach(o=>{
    if(!odemeTipiOzeti[o.tip]) odemeTipiOzeti[o.tip]={sayi:0,toplam:0};
    odemeTipiOzeti[o.tip].sayi++;
    odemeTipiOzeti[o.tip].toplam+=Number(o.tutar||0);
  }));

  const genelBrut    = filtreli.reduce((t,s)=>t+Number(s.genelToplam||0),0);
  const genelKomisyon= filtreli.reduce((t,s)=>t+s.odemeler.reduce((a,o)=>a+(o.komisyonTutar||0),0),0);
  const genelNet     = genelBrut-genelKomisyon;

  return (
    <div style={{padding:"24px 28px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:t.text}}>POS & Banka Raporu</div>
          <div style={{fontSize:13,color:t.textMuted,marginTop:3}}>{filtreli.length} satış işlemi</div>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {[["bugun","Bugün"],["bu_hafta","Bu Hafta"],["bu_ay","Bu Ay"],["hepsi","Tümü"]].map(([k,l])=>(
            <button key={k} onClick={()=>setDonem(k)} style={{padding:"7px 16px",borderRadius:20,fontSize:12,background:donem===k?"rgba(201,184,130,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${donem===k?"rgba(201,184,130,0.4)":t.border}`,color:donem===k?"#c9b882":t.textMuted,fontFamily:"inherit"}}>{l}</button>
          ))}
          <select value={magazaFiltre} onChange={e=>setMagazaFiltre(e.target.value)} style={{padding:"7px 14px",borderRadius:20,fontSize:12,background:t.hover,border:`1px solid ${t.border}`,color:t.textMuted,fontFamily:"inherit",outline:"none"}}>
            <option>Tümü</option>{magazalar.map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Genel KPI */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
        {[
          {l:"Brüt Ciro",       v:para(genelBrut),    c:"#c9b882"},
          {l:"Toplam Komisyon", v:para(genelKomisyon), c:"#eb5757"},
          {l:"Net Tahsilat",    v:para(genelNet),      c:"#6fcf97"},
          {l:"Komisyon Oranı",  v:`%${genelBrut>0?((genelKomisyon/genelBrut)*100).toFixed(2):0}`, c:"#f2c94c"},
        ].map(k=>(
          <div key={k.l} style={{background:t.hover,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px 18px"}}>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>{k.l}</div>
            <div style={{fontSize:20,fontFamily:"'Playfair Display',serif",color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:18,marginBottom:24}}>
        {/* POS Bazlı */}
        <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${t.border}`,fontSize:13,color:t.textMuted,letterSpacing:.5}}>POS / BANKA BAZINDA TAHSİLAT</div>
          {Object.keys(posBazli).length===0
            ? <div style={{padding:"32px 0",textAlign:"center",color:t.text,fontSize:13}}>Bu dönemde kart işlemi yok</div>
            : (
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${t.border}`}}>
                  {["Terminal","Banka","İşlem","Brüt","Komisyon","Net"].map(h=><th key={h} style={{padding:"10px 14px",fontSize:10,color:t.textMuted,fontWeight:500,textAlign:"left",letterSpacing:.3}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {Object.values(posBazli).map(p=>(
                    <tr key={p.pos.id} style={{borderBottom:`1px solid ${t.border}`}}>
                      <td style={{padding:"11px 14px"}}>
                        <div style={{fontSize:13,color:"#ddd",fontWeight:500}}>{p.pos.ad}</div>
                        <div style={{fontSize:10,color:"#444"}}>{p.pos.terminalno||terminaller.find(t=>t.id===p.pos.id)?.terminalno}</div>
                      </td>
                      <td style={{padding:"11px 14px",fontSize:13,color:"#aaa"}}>{p.pos.banka}</td>
                      <td style={{padding:"11px 14px",fontSize:13,color:"#aaa"}}>{p.islemSayisi}</td>
                      <td style={{padding:"11px 14px",fontSize:13,color:"#c9b882",fontWeight:600}}>{para(p.brutToplam)}</td>
                      <td style={{padding:"11px 14px",fontSize:13,color:"#eb5757"}}>-{para(p.komisyonToplam)}</td>
                      <td style={{padding:"11px 14px",fontSize:13,color:"#6fcf97",fontWeight:600}}>{para(p.netToplam)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        {/* Ödeme Tipi Dağılımı */}
        <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${t.border}`,borderRadius:14,padding:18}}>
          <div style={{fontSize:13,color:t.textMuted,letterSpacing:.5,marginBottom:16}}>ÖDEME TİPİ DAĞILIMI</div>
          {Object.keys(odemeTipiOzeti).length===0
            ? <div style={{textAlign:"center",color:t.text,fontSize:13,paddingTop:20}}>Veri yok</div>
            : Object.entries(odemeTipiOzeti).map(([tip,v])=>{
              const t=ODEME_TIPLERI.find(x=>x.id===tip);
              const yuzde=genelBrut>0?((v.toplam/genelBrut)*100):0;
              return (
                <div key={tip} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:13,color:"#ddd"}}>{t?.ikon} {t?.label}</span>
                    <span style={{fontSize:13,color:"#c9b882",fontWeight:600}}>{para(v.toplam)}</span>
                  </div>
                  <div style={{background:t.hover,borderRadius:4,height:6}}>
                    <div style={{width:`${yuzde}%`,background:t?.renk||"#c9b882",borderRadius:4,height:6,transition:"width .5s ease"}}/>
                  </div>
                  <div style={{fontSize:11,color:t.textMuted,marginTop:3}}>{v.sayi} işlem · %{yuzde.toFixed(1)}</div>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* İşlem Detayları */}
      <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${t.border}`,fontSize:13,color:t.textMuted,letterSpacing:.5}}>SATIŞ DETAYLARI</div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:"rgba(255,255,255,0.02)"}}>
            {["Fiş","Tarih","Mağaza","Müşteri","Tutar","Ödeme Detayı","Komisyon","Net"].map(h=>(
              <th key={h} style={{padding:"10px 14px",fontSize:10,color:t.textMuted,fontWeight:500,textAlign:"left",letterSpacing:.3}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtreli.length===0&&<tr><td colSpan={8} style={{textAlign:"center",padding:"40px 0",color:t.text,fontSize:13}}>Bu dönemde işlem yok</td></tr>}
            {filtreli.map(s=>{
              const topKom=s.odemeler.reduce((t,o)=>t+(o.komisyonTutar||0),0);
              return (
                <tr key={s.fisNo} style={{borderBottom:`1px solid ${t.border}`}}>
                  <td style={{padding:"11px 14px",fontSize:12,color:"#c9b882",fontFamily:"monospace",fontWeight:600}}>{s.fisNo}</td>
                  <td style={{padding:"11px 14px",fontSize:11,color:t.textMuted,whiteSpace:"nowrap"}}>{tarihFormat(s.tarih)}</td>
                  <td style={{padding:"11px 14px",fontSize:12,color:"#777"}}>{typeof s.magaza==="object"?s.magaza?.ad:(s.magaza||"-")}</td>
                  <td style={{padding:"11px 14px",fontSize:12,color:"#aaa"}}>{typeof s.musteri==="object"?`${s.musteri?.ad||""} ${s.musteri?.soyad||""}`.trim()||(s.musteriAd||"—"):(s.musteri||s.musteriAd||"—")}</td>
                  <td style={{padding:"11px 14px",fontSize:14,fontWeight:700,color:"#c9b882"}}>{para(s.genelToplam)}</td>
                  <td style={{padding:"11px 14px"}}>
                    {s.odemeler.map((o,i)=>{
                      const tp=ODEME_TIPLERI.find(x=>x.id===o.tip);
                      return (
                        <div key={i} style={{fontSize:11,color:"#777",marginBottom:2}}>
                          {tp?.ikon} {para(o.tutar)}
                          {o.banka&&<span style={{color:"#56ccf2"}}> · {o.banka}{o.taksit>1&&` ${o.taksit}T`}</span>}
                        </div>
                      );
                    })}
                  </td>
                  <td style={{padding:"11px 14px",fontSize:12,color:topKom>0?"#eb5757":"#333"}}>{topKom>0?"-"+para(topKom):"—"}</td>
                  <td style={{padding:"11px 14px",fontSize:13,fontWeight:600,color:"#6fcf97"}}>{para(s.genelToplam-topKom)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ANA POS EKRANI ───────────────────────────────────────────────────────
export default function SatisKasa({ t: tProp, kullanici, aktifMagaza, aktif }) {
  const t = tProp || {
    bg:'#0c0b09', card:'rgba(255,255,255,.04)', border:'rgba(255,255,255,.08)',
    text:'#e8e0d4', textMuted:'#666', accent:'#c9b882', accentBg:'rgba(201,184,130,.15)',
    input:'rgba(255,255,255,.06)', hover:'rgba(255,255,255,.06)', sidebar:'#0a0908'
  };
  // Context'ten mağazaları al
  let ctxMagazalar = [];
  try { const ctx = useVega(); ctxMagazalar = (ctx.magazalar||[]).filter(m=>m.tip!=='online'); } catch(e) {}
  const [magazalar,setMagazalar]         = useState([]);
  const [magaza,setMagaza]               = useState("");
  const [magazaKilit,setMagazaKilit]     = useState(true); // kasada mağaza yanlışlıkla değişmesin diye kilitli başlar
  const [sepet,setSepet]                 = useState([]);
  const [barkodInput,setBarkodInput]     = useState("");
  const [aramaQuery,setAramaQuery]       = useState("");
  const [aramaSonuc,setAramaSonuc]       = useState([]);
  const [varyantModal,setVaryantModal]   = useState(null);
  const [odemeModal,setOdemeModal]       = useState(false);
  const [fisModal,setFisModal]           = useState(null);
  const [genelIndirim,setGenelIndirim]   = useState(0);
  const [musteri,setMusteri]             = useState("");
  const [musteriId,setMusteriId]         = useState(null);
  const [musteriOneri,setMusteriOneri]   = useState([]);
  const [musteriOneriAcik,setMusteriOneriAcik] = useState(false);
  const [satisNot,setSatisNot]           = useState("");
  const [gecmis,setGecmis]               = useState([]);
  const [terminaller,setTerminaller]     = useState([]);
  const [ekran,setEkran]                 = useState("pos");
  const [bildirim,setBildirim]           = useState(null);
  const [urunDb,setUrunDb]               = useState([]);
  const [magazaIdMap,setMagazaIdMap]     = useState({});
  const [yukleniyor,setYukleniyor]       = useState(true);

  const barkodRef = useRef(null);

// Sabah kasa açılış kontrolü
useEffect(() => {
  const kontrol = () => {
    const saat = new Date().getHours()
    const dakika = new Date().getMinutes()
    if (saat === 5 && dakika >= 0 && dakika <= 30) {
      const sonKontrol = localStorage.getItem('vega_kasa_kontrol')
      const bugun = new Date().toDateString()
      if (sonKontrol !== bugun) {
        localStorage.setItem('vega_kasa_kontrol', bugun)
        setTimeout(() => {
          if (window.confirm('🌅 Yeni gün başlıyor! Günlük kasayı açmak ister misiniz?')) {
            setEkran('kasa')
          }
        }, 1000)
      }
    }
  }
  kontrol()
  const iv = setInterval(kontrol, 60000)
  return () => clearInterval(iv)
}, [])

    useEffect(()=>{
    async function yukle() {
      try {
        const magazaVerisi = ctxMagazalar.length > 0 ? ctxMagazalar :
          await magazalariGetir().then(d=>d.filter(m=>m.tip!=='online')).catch(()=>[]);
        const magazaAdlari = magazaVerisi.map(m => m.ad);
        if (magazaAdlari.length > 0) {
          setMagazalar(magazaAdlari)
          if (aktifMagaza && aktifMagaza !== 'hepsi') {
            const aktifM = magazaVerisi.find(m => m.id === aktifMagaza)
            setMagaza(aktifM?.ad || magazaAdlari[0])
          } else {
            setMagaza(magazaAdlari[0])
          }
        }
        const idMap = {};
        magazaVerisi.forEach(m => { 
          idMap[m.ad] = m.id;
          if (m.kod) idMap[m.kod] = m.id; // Mağaza kodu da eklendi
        });
        setMagazaIdMap(idMap);

        const poslar = await posTerminalleriniGetir();
        setTerminaller(poslar);

        const urunler = await urunleriGetir();
        setUrunDb(urunler.map(u => ({
          ...u,
          satisF:   Number(u.satisF) || 0, // Number dönüşümü eklendi
          varyantlar: u.varyantlar || [],
          stok: (u.varyantlar || []).map(v => ({
            renk:     v.renk,
            beden:    v.beden,
            barkod:   v.barkod ? String(v.barkod) : null, // Barkodları string olarak sakla
            magazaId: v.magazaId, // magazaId doğrudan kullanılıyor
            magaza: idMap ? (Object.entries(idMap).find(([ad,id])=>id===v.magazaId)?.[0] || v.magaza || v.magazaId || "Merkez") : (v.magaza || v.magazaId || "Merkez"),
            adet:   Number(v.adet) || 0, // Number dönüşümü eklendi
          })),
        })));
        
        const satisVerisi = await satislariGetir({ limit: 50 });
        const formatted = (satisVerisi||[]).map(s => ({
          ...s,
          araToplam: Number(s.araToplam),
          genelIndirim: Number(s.genelIndirimOran),
          genelIndirimTutar: Number(s.genelIndirimTutar),
          kdvToplam: Number(s.kdvToplam),
          genelToplam: Number(s.genelToplam),
          paraUstu: Number(s.paraUstu),
          kalemler: (s.kalemler||[]).map(k=>({...k,birimFiyat:Number(k.birimFiyat),indirim:Number(k.indirimOran||0),toplam:Number(k.toplam)})),
          odemeler: (s.odemeler||[]).map(o=>({...o,tutar:Number(o.tutar),komisyon:Number(o.komisyonOran||0),komisyonTutar:Number(o.komisyonTutar||0),netTahsilat:Number(o.netTahsilat)})),
        }));
        setGecmis(formatted);
      } catch(err) {
        console.error("Yükleme hatası:", err);
      } finally {
        setYukleniyor(false);
      }
    }
    yukle();
  }, []);

  // Satış Kasa sekmesi kapatılıp açılmıyor, sadece CSS ile gizleniyor (bkz. vega-app.jsx),
  // bu yüzden yukarıdaki ilk yükleme sadece uygulama açılışında (arka planda, sekme
  // görünmese bile) bir kere çalışıyor. Başka bir sekmede (örn. Shopify'dan aktarma /
  // barkod kaydetme) ürün eklenip Satış Kasa'ya geri dönüldüğünde — bu sekmeye o oturumda
  // İLK kez gelinse bile — ürün listesi bayatlamış olabiliyordu, çünkü arka plandaki ilk
  // yükleme çoktan (ürün eklenmeden önce) tamamlanmış oluyordu. Bu yüzden "ilk giriş"i
  // atlamadan, sekme her aktif olduğunda ürün listesini sessizce tazeliyoruz.
  useEffect(() => {
    if (!aktif) return;
    urunleriGetir().then(urunler => {
      setUrunDb(urunler.map(u => ({
        ...u,
        satisF:   Number(u.satisF) || 0,
        varyantlar: u.varyantlar || [],
        stok: (u.varyantlar || []).map(v => ({
          renk:     v.renk,
          beden:    v.beden,
          barkod:   v.barkod ? String(v.barkod) : null,
          magazaId: v.magazaId,
          magaza: magazaIdMap ? (Object.entries(magazaIdMap).find(([ad,id])=>id===v.magazaId)?.[0] || v.magaza || v.magazaId || "Merkez") : (v.magaza || v.magazaId || "Merkez"),
          adet:   Number(v.adet) || 0,
        })),
      })));
    }).catch(err => console.error("Ürün listesi tazeleme hatası:", err));
  }, [aktif]);

  useEffect(()=>{ if(ekran==="pos") barkodRef.current?.focus(); },[ekran]);

  // Topbar'dan mağaza değişince kasayı güncelle
  useEffect(()=>{
    if(!aktifMagaza || aktifMagaza==='hepsi') return
    const ad = Object.entries(magazaIdMap).find(([k,v])=>v===aktifMagaza)?.[0]
    if(ad) setMagaza(ad)
  },[aktifMagaza, magazaIdMap]);

  const goster = useCallback((mesaj,tip="ok")=>{ setBildirim({mesaj,tip}); setTimeout(()=>setBildirim(null),2200); },[]);

  // Aranan alanların hepsi veritabanında BOŞ olabiliyor (marka, kod, barkod, altKategori
  // hiçbiri zorunlu değil). Eskiden doğrudan `u.marka.toLowerCase()` çağrılıyordu ve ekran
  // şöyle çöküyordu: TEK harf yazarken `u.ad` neredeyse her üründe eşleştiği için || zinciri
  // kısa devre yapıyor, marka/barkod hiç okunmuyordu. İKİNCİ harfte eşleşme azalınca zincir
  // marka/barkod/altKategori'ye kadar ilerliyor, null bir alanda TypeError atıyordu; efekt
  // içinden fırlayan hata React ağacını düşürdüğü için ekran kararıyordu.
  useEffect(()=>{
    if(!aramaQuery.trim()){setAramaSonuc([]);return;}
    const q=aramaQuery.toLowerCase();
    const esler = deger => String(deger ?? "").toLowerCase().includes(q);
    setAramaSonuc(
      urunDb.filter(u=>esler(u.ad)||esler(u.marka)||esler(u.kod)||esler(u.barkod)||esler(u.altKategori)).slice(0,8)
    );
  },[aramaQuery,urunDb]);

  const barkodOku = async (e)=>{
    if(e.key !== "Enter") return;

    // Tarayıcının varsayılan Enter davranışını durdur
    e.preventDefault();

    let val = barkodInput.trim();
    if(!val) return;

    // Inputu HEMEN temizle ki ikinci bir tetikleme olmasın
    setBarkodInput("");

    // Denenecek varyasyonları bir Set kullanarak tekilleştirelim
    const variations = Array.from(new Set([
      val,
      val.replace(/^0+/, '') || "0",
      String(Number(val) || val)
    ]));

    console.log('--- Barkod Aranıyor ---', variations);
    let eslesenUrun = null;
    let eslesenVaryant = null; // mağaza farketmeksizin barkodun eşleştiği HERHANGİ bir varyant kaydı

    const magId = magazaIdMap[magaza];

    // urunDb, sekme her aktif olduğunda tazeleniyor ama yine de birkaç saniyelik bir
    // gecikme payı olabilir (ör. sekme değişir değişmez hemen okutma). Yerel önbellekte
    // ürün bulunamadığında ya da bu mağazada stok/kayıt görünmediğinde, kullanıcıya
    // "bulunamadı/stokta yok" demeden ÖNCE backend'e tek bir barkod için canlı bir
    // kontrol atıyoruz — gerçekte stokta olan bir ürünü yanlışlıkla reddetmek, ekstra
    // bir ağ isteğinden çok daha kötü bir kullanıcı deneyimi.
    const canliKontrolEt = async () => {
      try {
        const sonuc = await barkodIleUrunBul(val, magId ? { magazaId: magId } : {});
        if (!sonuc?.bulundu || Number(sonuc.stok) <= 0) return false;
        const canliUrun = sonuc.urun;
        const canliVaryant = sonuc.varyant;
        const renk = canliVaryant?.renk || 'Standart';
        const beden = canliVaryant?.beden || null;
        const barkodDeger = String(canliVaryant?.barkod || val);
        const yeniStokSatiri = { renk, beden, barkod: barkodDeger, magazaId: magId, magaza, adet: Number(sonuc.stok) || 0 };

        // urunDb önbelleğini bu ürün için tazele — bir sonraki okutmada tekrar ağa gitmesin.
        setUrunDb(prev => {
          const idx = prev.findIndex(u => u.id === canliUrun.id);
          if (idx === -1) {
            return [...prev, { ...canliUrun, satisF: Number(canliUrun.satisF) || 0, varyantlar: [], stok: [yeniStokSatiri] }];
          }
          const guncel = [...prev];
          const mevcutStok = guncel[idx].stok || [];
          const sIdx = mevcutStok.findIndex(s => s.magazaId === magId);
          const yeniStok = sIdx === -1 ? [...mevcutStok, yeniStokSatiri] : mevcutStok.map((s, i) => i === sIdx ? { ...s, ...yeniStokSatiri } : s);
          guncel[idx] = { ...guncel[idx], stok: yeniStok };
          return guncel;
        });

        sepeteEkle({ ...canliUrun, satisF: Number(canliUrun.satisF) || 0, stok: [yeniStokSatiri] }, renk, beden, barkodDeger);
        return true;
      } catch (e) {
        console.error('Canlı barkod kontrolü hatası:', e);
        return false;
      }
    };

    // 1. Varyantlarda ara — TÜM mağazalardaki TÜM varyantlara bak (mağaza filtresi YOK).
    //    Mağaza bazlı stok yapısında her mağaza için ayrı bir varyant satırı olabilir;
    //    barkod genelde ürün/etiket seviyesinde sabittir, hangi mağazada okutulursa okutulsun
    //    ürünü bulabilmemiz gerekir.
    for (const u of urunDb) {
      const vMatch = (u.stok || []).find(s => s.barkod && variations.includes(String(s.barkod).trim()));
      if (vMatch) {
        eslesenUrun = u;
        eslesenVaryant = vMatch;
        break;
      }
    }

    // 2. Bulunamadıysa ürünün kendi barkod/kod alanında ara (varyant barkodu boş olabilir)
    if (!eslesenUrun) {
      eslesenUrun = urunDb.find(u =>
        variations.includes(String(u.barkod || '').trim()) ||
        variations.includes(String(u.kod || '').trim())
      );
    }

    if (!eslesenUrun) {
      if (await canliKontrolEt()) return;
      goster(`"${val}" bulunamadı`,"hata");
      return;
    }

    // Aktif mağazada bu ürünün varyant kaydı var mı? (renk/beden ayrımı YOK — mağaza bazlı tekil stok)
    const aktifMagazaVaryanti = (eslesenUrun.stok || []).find(s => s.magazaId === magId);

    if (!aktifMagazaVaryanti) {
      // Ürün sistemde var ve barkodu eşleşti, ama aktif mağazada hiç stok kaydı yok.
      if (await canliKontrolEt()) return;
      goster(`"${eslesenUrun.ad}" bu mağazada (${magaza}) tanımlı değil.`,"hata");
      return;
    }

    if (Number(aktifMagazaVaryanti.adet) <= 0) {
      if (await canliKontrolEt()) return;
      goster(`"${eslesenUrun.ad}" bu mağazada stokta yok.`,"hata");
      return;
    }

    // Birden fazla renk/beden varyantı bu mağazada varsa (eski veri / karışık yapı),
    // kullanıcıya seçim modalını göster. Mağaza bazlı tekil stokta normalde tek satır olur.
    const ayniMagazaVaryantlari = (eslesenUrun.stok || []).filter(s => s.magazaId === magId && Number(s.adet) > 0);
    if (ayniMagazaVaryantlari.length > 1) {
      setVaryantModal(eslesenUrun);
      return;
    }

    sepeteEkle(eslesenUrun, aktifMagazaVaryanti.renk, aktifMagazaVaryanti.beden, aktifMagazaVaryanti.barkod);
  };

  const sepeteEkle=(urun,renk,beden,barkodOverride)=>{
    const mevcut=stokVar(urun,renk,beden,magaza, magazaIdMap); // magazaIdMap gönderildi
    if(mevcut===0){goster(`"${urun.ad}" için stok tükendi`,"hata");return;}

    // Varyant barkodunu bul
    const magazaId = magazaIdMap[magaza];
    const varyantBarkod = barkodOverride ||
      urun.stok?.find(s=>(s.magazaId === magazaId)&&s.renk===renk&&(s.beden===beden||(!s.beden&&!beden)))?.barkod ||
      urun.barkod || null;

    setSepet(prev=>{
      const idx=prev.findIndex(s=>s.urunId===urun.id && s.renk===renk && s.beden===beden);
      if(idx>=0){
        if(prev[idx].adet>=mevcut){goster(`Maks. ${mevcut} adet "${urun.ad}"`,"uyari");return prev;}
        const y=[...prev];y[idx]={...y[idx],adet:y[idx].adet+1};return y;
      }
      return [...prev,{id:yeniId(),urunId:urun.id,urunAd:urun.ad,marka:urun.marka,barkod:varyantBarkod,renk,beden,adet:1,birimFiyat:urun.satisF,alisF:urun.alisF||0,indirim:0,kdv:urun.kdv,maxAdet:mevcut}];
    });
    setVaryantModal(null); setAramaQuery(""); setAramaSonuc([]);
    goster(`${urun.ad} sepete eklendi`,"ok");
  };

  const kalemGuncelle=(id,alan,deger)=>setSepet(prev=>prev.map(s=>{
    if(s.id!==id) return s;
    if(alan==="adet") return {...s,adet:Math.max(1,Math.min(s.maxAdet,Number(deger)))};
    if(alan==="indirim") return {...s,indirim:Math.max(0,Math.min(100,Number(deger)))};
    if(alan==="birimFiyat") return {...s,birimFiyat:Math.max(0,Number(deger))};
    return s;
  }));
  const kalemSil=(id)=>setSepet(prev=>prev.filter(s=>s.id!==id));

  // Geçmiş listesindeki "Ürünler" sütunu için satır etiketi: "Marka - Stok Kodu - Renk Adı"
  // (etiket basımındaki biçimin aynısı, bkz. print/qzService.js > solMetin).
  // ESKİ GÖSTERİM ürün adının ilk kelimesiydi (`urunAd.split(" ")[0]`) — bu pratikte
  // markayı yazıyordu ("Guess×1" gibi) ve hangi ürünün satıldığı anlaşılmıyordu.
  // Kod ve renk adı satış satırında saklanmıyor, ürün kaydından geliyor: sunucudan gelen
  // kayıtlarda `k.urun` ilişkisi dolu (bkz. routes/satislar.js), yeni kaydedilen satışta
  // ise henüz dolu olmadığı için yerel ürün listesinden urunId ile çözülüyor.
  const kalemEtiketi = (k) => {
    const urun = k.urun || urunDb.find(u => u.id === k.urunId) || null;
    // STOK KODU = sku; yoksa ürünün kendi kodu. Etiket basımındaki sıra ile aynı
    // (bkz. print/qzService.js > stokKodu), iki yerde farklı kod görünmesin.
    const kod = (urun?.sku || urun?.kod || k.urunAd || "—").trim();
    // Varyant rengi mağaza bazlı tekil stok modelinde hep "Standart" placeholder'ını
    // taşıyor (bkz. urunler.js) — gerçek bir değer varsa onu, yoksa ürünün renk adını
    // kullanıyoruz; etiket basımındaki mantığın aynısı.
    const varyantRenk = (k.renk || "").trim();
    const renk = (varyantRenk.toLowerCase() !== "standart" ? varyantRenk : "") || (urun?.renkAdi || "").trim();
    const marka = (urun?.marka || k.marka || "").trim();
    return [marka, kod, renk].filter(Boolean).join(" - ");
  };

  const kalemToplam=(s)=>s.birimFiyat*s.adet*(1-s.indirim/100);
  const araToplam  = sepet.reduce((t,s)=>t+kalemToplam(s),0);
  const indirimTutar= araToplam*genelIndirim/100;
  const kdvToplam  = (araToplam-indirimTutar)*0.2/1.2;
  const genelToplam= araToplam-indirimTutar;

    const satisiTamamla=async(odemelerData,paraUstu,ekIndirim=0)=>{ // `odemeler` değişken adı `odemelerData` olarak değiştirildi
    const fisNo = await sonFisNoGetir().catch(()=>'F-'+Date.now().toString().slice(-4));
    const magaza_id = magazaIdMap[magaza] || null;

    // Ödemede kalan (eksik) tutar varsa, satışı bloklamak yerine bu tutarı otomatik
    // indirime dönüştürüp fişte "İndirim" olarak gösteriyoruz — "Eksik" yazısı basılmıyor.
    const finalIndirimTutar = indirimTutar + Number(ekIndirim || 0);
    const finalGenelToplam  = Math.max(0, araToplam - finalIndirimTutar);
    const finalKdvToplam    = finalGenelToplam * 0.2 / 1.2;
    const finalGenelIndirimOran = araToplam > 0 ? Number(((finalIndirimTutar / araToplam) * 100).toFixed(2)) : genelIndirim;

    // API'ye gönderilecek satış kalemleri verisini hazırla (Prisma'nın beklediği format)
    // ESKİ HATA: ürün bağı `urun: { connect: { id } }` olarak gönderiliyordu, oysa backend
    // düz `urunId` alanını okuyor (routes/satislar.js). Sonuç: satış kalemlerinin urunId'si
    // hep null kalıyor ve stok düşme döngüsü (`if (!kalem.urunId) continue`) HER kalemi
    // atlıyordu — mağaza satışlarında stok hiç düşmüyordu. Ekranda düşmüş görünmesinin
    // sebebi, kayıttan sonra yerel ürün listesinin elle güncellenmesiydi.
    // `barkod` da gönderiliyor: backend doğru varyantı önce barkodla arıyor.
    const satisKalemleriForApi = sepet.map(s => ({
      urunId: s.urunId || null,
      barkod: s.barkod || null,
      urunAd: s.urunAd,
      marka: s.marka || null,
      renk: s.renk,
      beden: s.beden,
      adet: s.adet,
      birimFiyat: s.birimFiyat,
      indirimOran: s.indirim,
      toplam: kalemToplam(s),
      maliyet: s.alisF || null,
      karMarji: s.alisF ? (kalemToplam(s) - s.alisF * s.adet) : null,
    }));

    // API'ye gönderilecek odemeler verisini hazırla
    const odemelerForApi = odemelerData.map(o=>({
            tip: o.tip,
            tutar: Number(o.tutar),
            posId: o.posId || null,
            banka: o.banka || null,
            taksitSayisi: o.taksit || 1,
            komisyonOran: o.komisyon || 0,
            komisyonTutar: o.komisyonTutar || 0,
            netTahsilat: o.netTahsilat || Number(o.tutar)
    }));

    // Local state ve FisModal için kullanılacak nihai satış objesi
    const yeniSatisObjesi = {
      fisNo,
      tarih: new Date().toISOString(),
      magaza, // Mağaza adı
      magazaId: magaza_id, // Mağaza ID'si (raporlama için)
      kasiyer: kullanici?.ad || "Admin",
      musteri,
        musteriId: musteriId || null,
        notlar: satisNot,
      kalemler: sepet.map(s=>({ // FisModal ve Geçmiş için daha basit kalemler
        // urunId, Geçmiş'teki "ÜRÜN KODU - Renk Adı" gösterimi için gerekli: satış hemen
        // listeye eklendiğinde henüz sunucudan dönmüş bir `urun` ilişkisi olmuyor,
        // etiket yerel ürün listesinden bu id ile çözülüyor (bkz. kalemEtiketi).
        urunId:s.urunId,
        urunAd:s.urunAd,
        marka:s.marka,
        renk:s.renk,
        beden:s.beden,
        adet:s.adet,
        birimFiyat:s.birimFiyat,
        indirim:s.indirim,
        toplam:kalemToplam(s)
      })),
      araToplam,
      genelIndirim: finalGenelIndirimOran,
      genelIndirimTutar: finalIndirimTutar,
      kdvToplam: finalKdvToplam,
      genelToplam: finalGenelToplam,
        paraUstu,
      odemeler: odemelerData.map(o=>({ // FisModal ve Geçmiş için daha basit ödemeler
        tip:o.tip,
        tutar:o.tutar,
        banka:o.banka,
        taksit:o.taksit,
        komisyonTutar:o.komisyonTutar,
        netTahsilat:o.netTahsilat
      })),
  };

                        try {
      // API üzerinden kaydet
      await satisKaydet({
        fisNo,
        magazaId: magaza_id,
        musteriAd: musteri || null,
        musteriId: musteriId || null,
        kullaniciId: kullanici?.id || null,
        notlar: satisNot,
        araToplam,
        genelIndirimOran: finalGenelIndirimOran,
        genelIndirimTutar: finalIndirimTutar,
        kdvToplam: finalKdvToplam,
        genelToplam: finalGenelToplam,
        paraUstu,
        kalemler: satisKalemleriForApi,
        odemeler: odemelerForApi,
      });

      // Local state güncelle
      setUrunDb(prev=>prev.map(u=>{
        const k=sepet.find(s=>s.urunId===u.id);
        if(!k) return u;
        return {
          ...u,
          stok:u.stok.map(s=>
            s.renk===k.renk && s.beden===k.beden && s.magazaId===magaza_id
              ? {...s,adet:Math.max(0,s.adet-k.adet)}
              : s
          )};
      }));

      // `setGecmis`'e doğru formatta objeyi ekle
      setGecmis(prev=>[yeniSatisObjesi,...prev]);
      goster("Satış başarıyla kaydedildi!","ok");

    } catch(err) {
      console.error("Satış kayıt hatası:", err);
      goster("Satış kaydedilemedi: " + err.message, "hata");
    }

    setOdemeModal(false);
    setFisModal(yeniSatisObjesi); // Fis modalına da doğru objeyi gönder
  };


  const yeniSatis=()=>{setSepet([]);setGenelIndirim(0);setMusteri("");setMusteriId(null);setSatisNot("");setFisModal(null);setTimeout(()=>barkodRef.current?.focus(),100);};

  const inp={background:t.input,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.text,fontSize:13,fontFamily:"inherit",outline:"none"};

  return (
    <div style={{minHeight:"100vh",background:t.bg,color:t.text,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        select option{background:t.card;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px;}
        button{cursor:pointer;border:none;background:none;font-family:inherit;}
        input,select,textarea{font-family:inherit;}
        tbody tr:hover td{background:rgba(255,255,255,0.012);}
        @keyframes slideIn{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}
        .vega-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-scroll-x table{min-width:640px;}
        .vega-topbar-nav{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .vega-topbar-nav button{white-space:nowrap;flex-shrink:0;}
        @media (max-width:1000px){
          .vega-pos-layout{grid-template-columns:1fr!important;}
          .vega-pos-right{height:auto!important;}
        }
        @media (max-width:860px){
          .vega-page-pad{padding-left:14px!important;padding-right:14px!important;}
          .vega-grid-2,.vega-grid-3,.vega-grid-4{grid-template-columns:1fr!important;}
        }
        @media (max-width:700px){
          .vega-topbar{flex-wrap:wrap;height:auto!important;padding:10px 14px!important;}
          .vega-topbar-nav{margin-left:0!important;width:100%;}
        }
      `}</style>

      {/* TOPBAR */}
      <div className="vega-topbar" style={{height:52,background:t.sidebar||t.bg,borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",padding:"0 20px",gap:16,flexShrink:0,zIndex:10}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#c9b882",letterSpacing:.5}}>çanta<span style={{color:t.text}}>&</span>ayakkabı</div>
        <div style={{width:1,height:20,background:t.border}}/>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <select value={magaza} onChange={e=>setMagaza(e.target.value)} disabled={magazaKilit}
            style={{...inp,padding:"5px 12px",fontSize:12,opacity:magazaKilit?0.6:1,cursor:magazaKilit?"not-allowed":"pointer"}}>
            {magazalar.map(m=><option key={m}>{m}</option>)}
          </select>
          <button
            onClick={()=>{
              if(magazaKilit){ if(window.confirm("Mağaza seçimini değiştirmek için kilidi açıyorsun. Devam?")) setMagazaKilit(false); }
              else setMagazaKilit(true);
            }}
            title={magazaKilit?"Mağaza kilitli — değiştirmek için tıkla":"Mağaza kilidini kapat"}
            style={{
              display:"flex",alignItems:"center",justifyContent:"center",
              width:28,height:28,borderRadius:8,fontSize:13,cursor:"pointer",
              background:magazaKilit?"transparent":"rgba(242,201,76,0.15)",
              border:`1px solid ${magazaKilit?t.border:"rgba(242,201,76,0.5)"}`,
              color:magazaKilit?t.textMuted:"#f2c94c"
            }}>
            {magazaKilit?"🔒":"🔓"}
          </button>
        </div>
        <div className="vega-topbar-nav" style={{marginLeft:"auto",display:"flex",gap:6}}>
          {[["pos","◎ Satış"],["gecmis","⏱ Geçmiş"],["iade","↩ İade"],["degisim","🔄 Değişim"],["kasa","🏧 Günlük Kasa"],["pos_rapor","▣ POS Raporu"],["pos_yonetim","⚙ Terminaller"]].map(([k,l])=>(
            <button key={k} onClick={()=>setEkran(k)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,background:ekran===k?t.accentBg:"transparent",border:`1px solid ${ekran===k?t.accent+"44":t.border}`,color:ekran===k?t.accent:t.textMuted}}>{l}</button>
                      ))}
                        </div>
                </div>

      {/* BİLDİRİM */}
      {bildirim&&<div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:1000,padding:"10px 22px",borderRadius:30,fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",background:bildirim.tip==="ok"?"rgba(111,207,151,0.2)":bildirim.tip==="hata"?"rgba(235,87,87,0.2)":"rgba(242,201,76,0.2)",border:`1px solid ${bildirim.tip==="ok"?"rgba(111,207,151,0.5)":bildirim.tip==="hata"?"rgba(235,87,87,0.5)":"rgba(242,201,76,0.5)"}`,color:bildirim.tip==="ok"?"#6fcf97":bildirim.tip==="hata"?"#eb5757":"#f2c94c",animation:"slideIn .2s ease",backdropFilter:"blur(10px)"}}>{bildirim.tip==="ok"?"✓":bildirim.tip==="hata"?"✕":"⚠"} {bildirim.mesaj}</div>}

      {/* SAYFALAR */}
      {ekran==="pos_yonetim"&&<div style={{flex:1,overflowY:"auto"}}><PosYonetimModule terminaller={terminaller} setTerminaller={setTerminaller} magazalar={ctxMagazalar.filter(m=>m.tip!=="online")} t={t}/></div>}
      {ekran==="iade"&&<div style={{flex:1,overflowY:"auto"}}><IadeEkraniModule t={t} magazalar={ctxMagazalar.filter(m=>m.tip!=="online")} magazaAd={magaza}/></div>}
      {ekran==="degisim"&&<div style={{flex:1,overflowY:"auto"}}><DegisimEkraniModule t={t} magazaId={magazaIdMap[magaza]||null} magazaAd={magaza}/></div>}
      {ekran==="kasa"&&<div style={{flex:1,overflowY:"auto"}}><GunlukKasaModule t={t} magazaId={magazaIdMap[magaza]||null} magazaAd={magaza}/></div>}
      {ekran==="pos_rapor"&&<div style={{flex:1,overflowY:"auto"}}><PosRaporModule gecmis={gecmis} terminaller={terminaller} t={t}/></div>}

      {/* GEÇMİŞ */}
      {ekran==="gecmis"&&(
        <div className="vega-page-pad" style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>
          <div className="vega-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
            {[
              {l:"Bugün Satış",   v:para(gecmis.filter(s=>new Date(s.tarih).toDateString()===new Date().toDateString()).reduce((t,s)=>t+Number(s.genelToplam||0),0)),c:"#c9b882"},
              {l:"Toplam İşlem",  v:gecmis.length+" adet",c:"#c9b882"},
              {l:"Toplam Ciro",   v:para(gecmis.reduce((t,s)=>t+Number(s.genelToplam||0),0)),c:"#6fcf97"},
              {l:"Toplam Komisyon",v:para(gecmis.reduce((t,s)=>t+s.odemeler.reduce((a,o)=>a+(o.komisyonTutar||0),0),0)),c:"#eb5757"},
            ].map(k=>(
              <div key={k.l} style={{background:t.hover,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>{k.l}</div>
                <div style={{fontSize:20,fontFamily:"'Playfair Display',serif",color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden"}}>
            <div className="vega-scroll-x">
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:"rgba(255,255,255,0.02)"}}>
                {["Fiş No","Tarih","Mağaza","Müşteri","Ürünler","Tutar","İndirim","Ödeme","Komisyon","Not"].map(h=><th key={h} style={{padding:"12px 14px",fontSize:11,color:t.textMuted,fontWeight:500,textAlign:"left",letterSpacing:.3}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {gecmis.map(s=>{
                  const topKom=s.odemeler.reduce((t,o)=>t+(o.komisyonTutar||0),0);
                  return (
                    <tr key={s.fisNo} style={{borderBottom:`1px solid ${t.border}`}}>
                      <td style={{padding:"12px 14px",fontSize:13,color:"#c9b882",fontFamily:"monospace",fontWeight:600}}>{s.fisNo}</td>
                      <td style={{padding:"12px 14px",fontSize:11,color:t.textMuted,whiteSpace:"nowrap"}}>{tarihFormat(s.tarih)}</td>
                      <td style={{padding:"12px 14px",fontSize:12,color:"#777"}}>{typeof s.magaza === "object" ? (s.magaza?.ad||"-") : (s.magaza||"-")}</td>
                      <td style={{padding:"12px 14px",fontSize:13,color:"#aaa"}}>{typeof s.musteri==="object"?`${s.musteri?.ad||""} ${s.musteri?.soyad||""}`.trim()||(s.musteriAd||"—"):(s.musteri||s.musteriAd||"—")}</td>
                      <td style={{padding:"12px 14px",fontSize:12,color:"#aaa"}}>{(s.kalemler||[]).map(k=>`${kalemEtiketi(k)}×${k.adet}`).join(", ")}</td>
                      <td style={{padding:"12px 14px",fontSize:15,fontWeight:700,color:"#c9b882"}}>{para(s.genelToplam)}</td>
                      <td style={{padding:"12px 14px",fontSize:13,color:s.genelIndirimTutar>0?"#f2c94c":"#333"}}>{s.genelIndirimTutar>0?"-"+para(s.genelIndirimTutar):"—"}</td>
                      <td style={{padding:"12px 14px"}}>
                        {s.odemeler.map((o,i)=>{
                          const t=ODEME_TIPLERI.find(x=>x.id===o.tip);
                          return <div key={i} style={{fontSize:11,marginBottom:2}}><span style={{color:"#777"}}>{t?.ikon} {para(o.tutar)}</span>{o.banka&&<span style={{color:"#56ccf2"}}> {o.banka}{o.taksit>1&&` ${o.taksit}T`}</span>}</div>;
                        })}
                      </td>
                      <td style={{padding:"12px 14px",fontSize:12,color:topKom>0?"#eb5757":"#333"}}>{topKom>0?"-"+para(topKom):"—"}</td>
                      <td style={{padding:"12px 14px",fontSize:12,color:t.textMuted}}>{s.not||"—"}</td>
                      <td style={{padding:"8px 14px"}}>
                        <button onClick={()=>setFisModal(s)} style={{padding:"4px 10px",borderRadius:6,background:"rgba(201,184,130,.1)",border:"1px solid rgba(201,184,130,.3)",color:t.accent,fontSize:11,cursor:"pointer"}}>🖨 Fiş</button>
                      </td>
                    </tr>
  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* SATIŞ EKRANI */}
      {ekran==="pos"&&(
        <div className="vega-pos-layout" style={{flex:1,display:"grid",gridTemplateColumns:"1fr 420px",overflow:"auto",width:"100%",height:"100%"}}>
          {/* SOL */}
          <div style={{display:"flex",flexDirection:"column",borderRight:`1px solid ${t.border}`}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${t.border}`,background:"rgba(255,255,255,0.01)"}}>
              <div className="vega-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{position:"relative"}}>
                  <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"#444",pointerEvents:"none"}}>▦</div>
                  <input ref={barkodRef} style={{...inp,width:"100%",paddingLeft:36,fontSize:14,letterSpacing:1}} value={barkodInput} onChange={e=>setBarkodInput(e.target.value)} onKeyDown={barkodOku} placeholder="Barkod okut → Enter" autoComplete="off"/>
                </div>
                <div style={{position:"relative"}}>
                  <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#444",pointerEvents:"none"}}>🔍</div>
                  <input style={{...inp,width:"100%",paddingLeft:34,fontSize:13}} value={aramaQuery} onChange={e=>setAramaQuery(e.target.value)} placeholder="Ürün adı veya marka ara..."/>
                  {aramaSonuc.length>0&&(
                    <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:t.card,border:`1px solid ${t.border}`,borderRadius:12,overflow:"hidden",zIndex:50,boxShadow:"0 20px 40px rgba(0,0,0,.5)"}}>
                      {aramaSonuc.map((u, index) => { // 'index' parametresini ekledik
                        const var_ = u.stok.some(s => s.magazaId === magazaIdMap[magaza] && s.adet > 0);
                        return (
                          <button
                            key={`${u.id}-${index}`} // Sadece u.id yerine index ile birleştirerek kesin benzersiz yapıyoruz
                            onClick={() => { setAramaQuery(""); setAramaSonuc([]); setVaryantModal(u); }}
                            style={{width:"100%",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${t.border}`,textAlign:"left",fontFamily:"inherit",background:"transparent",opacity:var_?1:.4}}
                          >
                            <div><div style={{fontSize:13,color:t.text,fontWeight:500}}>{u.ad}</div><div style={{fontSize:11,color:t.textMuted,marginTop:1}}>{u.marka} · {u.altKategori}</div></div>
                            <div style={{textAlign:"right"}}><div style={{fontSize:14,color:"#c9b882",fontWeight:600}}>{para(u.satisF)}</div><div style={{fontSize:10,color:var_?"#6fcf97":"#eb5757"}}>{var_?"Stok var":"Stok yok"}</div></div>
                  </button>
                        );
                      })}
            </div>
                  )}
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                {urunDb.filter(u=>{ const ms=u.stok.filter(s=>s.magaza===magaza||s.magazaId===magazaIdMap[magaza]); return ms.length===0||ms.some(s=>s.adet>0); }).slice(0,6).map(u=>(
                  <button key={u.id} onClick={()=>setVaryantModal(u)} style={{padding:"8px 12px",borderRadius:10,fontSize:11,
                    background:"rgba(0,0,0,0.06)",border:"1px solid rgba(0,0,0,0.12)",
                    color:"inherit",textAlign:"left",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,.08)"}}>
                    <div style={{color:"inherit",fontWeight:600,marginBottom:2,fontSize:11}}>{u.ad.length>16?u.ad.slice(0,16)+"…":u.ad}</div>
                    <div style={{color:t.accent,fontSize:12,fontWeight:700}}>{para(u.satisF)}</div>
                    </button>
                ))}
              </div>
              </div>

            <div style={{flex:1,overflowY:"auto"}}>
              {sepet.length===0
                ? <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",color:t.textMuted,gap:12}}><div style={{fontSize:44}}>◫</div><div style={{fontSize:14}}>Barkod okutun veya ürün arayın</div></div>
                : <div className="vega-scroll-x"><table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:"rgba(255,255,255,0.02)",position:"sticky",top:0,zIndex:1}}>
                      {["Ürün","R/B","Fiyat","İnd%","Adet","Toplam",""].map(h=><th key={h} style={{padding:"9px 12px",fontSize:10,color:t.textMuted,fontWeight:500,textAlign:"left",letterSpacing:.3}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {sepet.map(s=>(
                        <tr key={s.id} style={{borderBottom:`1px solid ${t.border}`,animation:"slideIn .15s ease"}}>
                          <td style={{padding:"11px 12px"}}><div style={{fontSize:13,color:t.text,fontWeight:500}}>{s.urunAd}</div><div style={{fontSize:10,color:t.textMuted,marginTop:1}}>{s.barkod}</div></td>
                          <td style={{padding:"11px 12px",fontSize:11,color:"#777"}}>{s.renk}<br/>{s.beden}</td>
                          <td style={{padding:"11px 12px"}}><input style={{...inp,width:82,padding:"5px 8px",fontSize:12,textAlign:"right"}} type="number" value={s.birimFiyat} onChange={e=>kalemGuncelle(s.id,"birimFiyat",e.target.value)}/></td>
                          <td style={{padding:"11px 12px"}}><input style={{...inp,width:54,padding:"5px 8px",fontSize:12,textAlign:"right",background:s.indirim>0?"rgba(242,201,76,0.08)":"rgba(255,255,255,0.05)",border:s.indirim>0?"1px solid rgba(242,201,76,0.3)":`1px solid ${t.border}`,color:s.indirim>0?"#f2c94c":t.text}} type="number" min={0} max={100} value={s.indirim} onChange={e=>kalemGuncelle(s.id,"indirim",e.target.value)}/></td>
                          <td style={{padding:"11px 12px"}}><div style={{display:"flex",alignItems:"center",gap:5}}><button onClick={()=>kalemGuncelle(s.id,"adet",s.adet-1)} style={{width:22,height:22,borderRadius:5,background:"rgba(255,255,255,0.07)",color:"#aaa",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button><span style={{fontSize:13,minWidth:20,textAlign:"center"}}>{s.adet}</span><button onClick={()=>kalemGuncelle(s.id,"adet",s.adet+1)} style={{width:22,height:22,borderRadius:5,background:"rgba(255,255,255,0.07)",color:"#aaa",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button></div></td>
                          <td style={{padding:"11px 12px",fontSize:13,fontWeight:700,color:s.indirim>0?"#f2c94c":"#c9b882"}}>{para(kalemToplam(s))}</td>
                          <td style={{padding:"11px 12px"}}><button onClick={()=>kalemSil(s.id)} style={{color:"#2a2a2a",fontSize:15}} onMouseEnter={e=>e.target.style.color="#eb5757"} onMouseLeave={e=>e.target.style.color="#2a2a2a"}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
}
              </div>

            {sepet.length>0&&(
              <div className="vega-grid-2" style={{padding:"10px 14px",borderTop:`1px solid ${t.border}`,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div style={{position:'relative'}}>
                  <input style={{...inp,fontSize:12,width:'100%'}} value={musteri}
                    onChange={async e=>{
                      setMusteri(e.target.value);
                      if(e.target.value.length>=2) {
                        try {
const res = await fetch(`${import.meta.env.VITE_API_URL}/musteriler?q=${encodeURIComponent(e.target.value)}&limit=5`);                          const d = await res.json();
                          setMusteriOneri(Array.isArray(d)?d:[]);
                          setMusteriOneriAcik((Array.isArray(d)?d:[]).length>0);
                        } catch(err) { setMusteriOneri([]); }
                      } else { setMusteriOneri([]); }
                    }}
                    onFocus={()=>musteri.length>=2&&setMusteriOneriAcik(true)}
                    onBlur={()=>setTimeout(()=>setMusteriOneriAcik(false),200)}
                    placeholder="👤 Müşteri adı veya tel"/>
                  {musteriOneriAcik&&musteriOneri.length>0&&(
                    <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:100,
                      background:t.sidebar,border:`1px solid ${t.border}`,borderRadius:8,overflow:'hidden',boxShadow:'0 8px 24px rgba(0,0,0,.4)',bottom:'100%',top:'auto',zIndex:999}}>
                      {musteriOneri.map(m=>(
                        <div key={m.id} onClick={()=>{
                          setMusteri(`${m.ad} ${m.soyad||''}`.trim());
                          setMusteriId(m.id);
                          setMusteriOneriAcik(false);
                          setMusteriOneri([]);
                        }} style={{padding:'8px 12px',cursor:'pointer',fontSize:12,color:t.text,
                          borderBottom:`1px solid ${t.border}`}}
                          onMouseEnter={e=>e.target.style.background='rgba(255,255,255,.05)'}
                          onMouseLeave={e=>e.target.style.background='transparent'}>
                          <div style={{fontWeight:500}}>{m.ad} {m.soyad||''}</div>
                          <div style={{fontSize:10,color:t.textMuted}}>{m.telefon||''}</div>
              </div>
                      ))}
                </div>
                  )}
              </div>
                <input style={{...inp,fontSize:12}} value={satisNot} onChange={e=>setSatisNot(e.target.value)} placeholder="📝 Not"/>
                {musteriId && (
                  <button onClick={async()=>{
                    const tutar = Number(genelToplam||0)
                    if (!tutar) return alert('Sepet boş')
                    if (!musteriId) return alert('Veresiye için önce CRM müşterisi seçin')
                    if (!window.confirm(`${musteri} için ₺${tutar.toLocaleString('tr-TR')} borç kaydedilsin mi?\n\nSatış kaydedilecek, stok düşülecek ve müşterinin cari hesabına alacak yazılacak.`)) return
                    // Veresiye artık NORMAL satış akışından geçiyor: 'veresiye' tipinde tek
                    // ödeme satırıyla satış kaydediliyor. Stok düşümü ve cari alacak kaydı
                    // backend'de aynı transaction içinde yapılıyor (routes/satislar.js).
                    // ESKİ DAVRANIŞ: satış hiç kaydedilmeden doğrudan /cari/hareket çağrılıyordu —
                    // ne satış, ne stok, ne de (bozuk uç yüzünden) cari kaydı oluşuyordu.
                    await satisiTamamla([{ tip:'veresiye', tutar, taksit:1, komisyon:0, komisyonTutar:0, netTahsilat:tutar }], 0, 0)
                  }} style={{width:'100%',padding:'8px 0',borderRadius:8,background:'rgba(235,87,87,.08)',
                    border:'1px solid rgba(235,87,87,.25)',color:'#eb5757',fontSize:12,fontWeight:600}}>
                    📋 Veresiye / Alacak Olarak Kaydet
                  </button>
      )}
    </div>
            )}
          </div>

          {/* SAĞ — Kasa */}
          <div className="vega-pos-right" style={{display:"flex",flexDirection:"column",background:t.sidebar||t.bg,height:"100%",minHeight:0,overflow:"auto"}}>
            <div style={{flex:1,overflowY:"auto",padding:"18px 16px"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#c9b882",marginBottom:12,letterSpacing:.5}}>Kasa</div>

              {/* Müşteri Bölümü - Ara toplam üstünde */}
              <div style={{marginBottom:14,padding:"10px 12px",background:t.card,border:`1px solid ${t.border}`,borderRadius:10}}>
                <div style={{fontSize:10,color:"#444",letterSpacing:.5,textTransform:"uppercase",marginBottom:7}}>Müşteri</div>
                <div style={{position:"relative"}}>
                  <input value={musteri} onChange={async e=>{
                    const v=e.target.value; setMusteri(v); setMusteriId(null);
                    if(v.length>=2){
                      const res=await fetch(`${import.meta.env.VITE_API_URL}/musteriler?q=${encodeURIComponent(v)}&limit=5`);
                      const d=await res.json();
                      setMusteriOneri(Array.isArray(d)?d:[]);
                      setMusteriOneriAcik((Array.isArray(d)?d:[]).length>0);
                    } else { setMusteriOneri([]); setMusteriOneriAcik(false); }
                  }} onBlur={()=>setTimeout(()=>setMusteriOneriAcik(false),200)}
                  placeholder="Müşteri ara..." style={{...inp,width:"100%",fontSize:12,padding:"7px 10px"}}/>
                  {musteriOneriAcik&&musteriOneri.length>0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:999,
                      background:t.sidebar,border:`1px solid ${t.border}`,borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
                      {musteriOneri.map(m=>(
                        <div key={m.id} onClick={()=>{
                          setMusteri(`${m.ad} ${m.soyad||''}`.trim());
                          setMusteriId(m.id);
                          setMusteriOneriAcik(false);
                        }} style={{padding:"8px 12px",cursor:"pointer",fontSize:12,color:t.text,borderBottom:`1px solid ${t.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <div style={{fontWeight:500}}>{m.ad} {m.soyad||''}</div>
                          <div style={{fontSize:10,color:t.textMuted}}>{m.telefon||''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {musteriId&&(
                  <div style={{marginTop:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,color:"#6fcf97"}}>✓ CRM müşterisi</span>
                    <button onClick={async()=>{
                    const tutar = Number(genelToplam||0)
                    if (!tutar) return alert('Sepet boş')
                    if (!musteriId) return alert('Veresiye için önce CRM müşterisi seçin')
                    if (!window.confirm(`${musteri} için ₺${tutar.toLocaleString('tr-TR')} borç kaydedilsin mi?\n\nSatış kaydedilecek, stok düşülecek ve müşterinin cari hesabına alacak yazılacak.`)) return
                    // Veresiye artık NORMAL satış akışından geçiyor: 'veresiye' tipinde tek
                    // ödeme satırıyla satış kaydediliyor. Stok düşümü ve cari alacak kaydı
                    // backend'de aynı transaction içinde yapılıyor (routes/satislar.js).
                    // ESKİ DAVRANIŞ: satış hiç kaydedilmeden doğrudan /cari/hareket çağrılıyordu —
                    // ne satış, ne stok, ne de (bozuk uç yüzünden) cari kaydı oluşuyordu.
                    await satisiTamamla([{ tip:'veresiye', tutar, taksit:1, komisyon:0, komisyonTutar:0, netTahsilat:tutar }], 0, 0)
                    }} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(235,87,87,.08)",border:"1px solid rgba(235,87,87,.25)",color:"#eb5757",cursor:"pointer"}}>
                      📋 Veresiye
                    </button>
                  </div>
                )}
                {musteri&&<input style={{...inp,width:"100%",fontSize:12,padding:"7px 10px",marginTop:7}} value={satisNot} onChange={e=>setSatisNot(e.target.value)} placeholder="📝 Not"/>}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:18}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:t.textMuted}}><span>Kalem</span><span style={{color:"#aaa"}}>{sepet.reduce((t,s)=>t+s.adet,0)} adet</span></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:t.textMuted}}><span>Ara Toplam</span><span style={{color:"#aaa"}}>{para(araToplam)}</span></div>
                {genelIndirim>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#f2c94c"}}><span>İndirim (%{genelIndirim})</span><span>-{para(indirimTutar)}</span></div>}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#444"}}><span>KDV (dahil)</span><span>{para(kdvToplam)}</span></div>
              </div>

              <div style={{padding:"16px",background:"rgba(201,184,130,0.06)",border:"1px solid rgba(201,184,130,0.15)",borderRadius:14,marginBottom:18,textAlign:"center"}}>
                <div style={{fontSize:10,color:t.textMuted,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>Genel Toplam</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,color:"#c9b882",fontWeight:700}}>{para(genelToplam)}</div>
              </div>

              {/* Genel indirim */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:"#444",letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Sepet İndirimi</div>
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  {[0,5,10,15,20].map(v=><button key={v} onClick={()=>setGenelIndirim(v)} style={{flex:1,padding:"6px 0",borderRadius:7,fontSize:11,fontWeight:600,background:genelIndirim===v?"rgba(242,201,76,0.18)":"rgba(255,255,255,0.04)",border:`1px solid ${genelIndirim===v?"rgba(242,201,76,0.5)":"rgba(255,255,255,0.07)"}`,color:genelIndirim===v?"#f2c94c":"#444"}}>{v===0?"—":"%"+v}</button>)}
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input style={{...inp,flex:1}} type="number" min={0} max={100} value={genelIndirim} onChange={e=>setGenelIndirim(Math.min(100,Math.max(0,Number(e.target.value))))} placeholder="Özel %"/>
                  <span style={{fontSize:12,color:"#444"}}>%</span>
                </div>
              </div>
            </div>

            <div style={{padding:"14px 16px",borderTop:`1px solid ${t.border}`}}>
              <button onClick={()=>sepet.length>0&&setOdemeModal(true)} disabled={sepet.length===0} style={{width:"100%",padding:"15px 0",borderRadius:13,fontFamily:"inherit",fontWeight:700,fontSize:16,background:sepet.length>0?"linear-gradient(135deg,rgba(111,207,151,0.35),rgba(111,207,151,0.18))":"rgba(255,255,255,0.03)",border:`1px solid ${sepet.length>0?"rgba(111,207,151,0.5)":"rgba(255,255,255,0.07)"}`,color:sepet.length>0?"#6fcf97":"#2a2a2a",cursor:sepet.length>0?"pointer":"not-allowed"}}>
                {sepet.length>0?`✓  Ödeme Al — ${para(genelToplam)}`:"Sepet boş"}
              </button>
              {sepet.length>0&&<button onClick={()=>window.confirm("Sepet temizlensin mi?")&&setSepet([])} style={{width:"100%",padding:"8px 0",marginTop:6,borderRadius:10,color:t.text,fontSize:12}}>✕ Temizle</button>}
            </div>
          </div>
        </div>
      )}

      {/* MODALLER */}
      {varyantModal&&<VaryantSecici urun={varyantModal} magaza={magaza} onSec={(r,b)=>sepeteEkle(varyantModal,r,b)} onIptal={()=>setVaryantModal(null)} magazaIdMap={magazaIdMap} t={t}/>}
      {odemeModal&&<OdemeModal toplam={genelToplam} magaza={magaza} terminaller={terminaller} onTamamla={satisiTamamla} onIptal={()=>setOdemeModal(false)} t={t}/>}
      {fisModal&&<FisModal satis={fisModal} onKapat={yeniSatis} t={t}/>}
    </div>
  );
}