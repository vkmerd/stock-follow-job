import { useState, useEffect, useRef, useCallback } from "react";
import { useVega } from "./VegaContext";
import { usePrint } from "./print/usePrint";
import PosYonetimModule from "./satis-kasa/PosYonetim";
import PosRaporModule from "./satis-kasa/PosRapor";
import IadeEkraniModule from "./satis-kasa/IadeEkrani";
import GunlukKasaModule from "./satis-kasa/GunlukKasa";
import DegisimEkraniModule from "./satis-kasa/DegisimEkrani";
import QzFisPaneli from "./satis-kasa/QzFisPaneli";
import { FIS_CSS, ODEME_TIPLERI } from './satis-kasa/utils';
import { urunleriGetir, posTerminalleriniGetir, satislariGetir, satisKaydet, sonFisNoGetir, magazalariGetir, barkodIleUrunBul, API_BASE } from './api';
import { Button, IconButton, Field, Input, Select, Tabs, Badge, Banner, Modal, StatCard, EmptyState, LoadingRows, onayla, toast } from './ui';
import { ScanBarcode, Search, Lock, LockOpen, X, Minus, Plus, Trash2, Printer, Check, UserRound, NotebookPen, ReceiptText, ShoppingBasket } from 'lucide-react';

const TAKSIT_SECENEKLERI = [1,2,3,6,9,12];

// ─── YARDIMCI ─────────────────────────────────────────────────────────────
// Fiş numarası backend'den alınıyor - local sayaç yok
function yeniId()    { return `s${Date.now()}${Math.random().toString(36).slice(2,5)}`; }
function para(v)     { return `₺${Number(v||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function tarihFormat(iso) {
  const d=new Date(iso);
  return d.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})+" "+d.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
}
function stokVar(urun, renk, beden, magazaAdi, magazaIdMap = {}) {
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
const musteriMetni = s => typeof s.musteri==="object"?`${s.musteri?.ad||""} ${s.musteri?.soyad||""}`.trim()||(s.musteriAd||"—"):(s.musteri||s.musteriAd||"—");

// ─── VARYANT SEÇİCİ ───────────────────────────────────────────────────────
function VaryantSecici({ urun, magaza, onSec, onIptal, magazaIdMap={} }) {
  const magazaKodu = magazaIdMap?.[magaza] || magaza;
  const renkler=[...new Set(urun.stok.filter(s=>s.magaza===magaza||s.magaza===magazaKodu||s.magazaId===magazaIdMap?.[magaza]).map(s=>s.renk))];
  const [renk,setRenk]=useState(renkler[0]||"");
  const bedenler=[...new Set(urun.stok.filter(s=>(s.magaza===magaza||s.magazaId===magazaIdMap?.[magaza])&&s.renk===renk).map(s=>s.beden||"Tek Ebat"))];
  const [beden,setBeden]=useState(bedenler[0]||"");
  const mevcut=stokVar(urun,renk,beden,magaza, magazaIdMap);
  return (
    <Modal title={urun.ad} subtitle={`${urun.marka||''}${urun.altKategori ? ` · ${urun.altKategori}` : ''} · ${para(urun.satisF)}`} onClose={onIptal}
      footer={<>
        <Button variant="plain" onClick={onIptal}>Vazgeç</Button>
        <Button variant="primary" icon={Plus} onClick={()=>mevcut>0&&onSec(renk,beden)} disabled={!mevcut}>Sepete ekle · {para(urun.satisF)}</Button>
      </>}>
      <Field label="Renk">
        <div className="vg-row" style={{ gap: 6 }}>
          {renkler.map(r=><button key={r} type="button" className="vg-chip" aria-pressed={renk===r} onClick={()=>{setRenk(r);setBeden(urun.stok.find(s=>s.magaza===magaza&&s.renk===r)?.beden||"");}}>{r}</button>)}
        </div>
      </Field>
      <Field label="Beden / numara">
        <div className="vg-row" style={{ gap: 6 }}>
          {bedenler.length===0?<span className="vg-help">Beden bilgisi yok</span>:bedenler.map(b=>{ const gercekB=b==="Tek Ebat"?"":b; const stk=stokVar(urun,renk,gercekB,magaza, magazaIdMap)||stokVar(urun,renk,b,magaza, magazaIdMap); return (
            <button key={b} type="button" className="vg-chip" aria-pressed={beden===b} disabled={stk===0} onClick={()=>stk>0&&setBeden(b)}
              style={{ opacity: stk===0 ? .4 : 1, cursor: stk===0 ? 'not-allowed' : 'pointer' }}>
              {b}{stk>0&&stk<=3&&<Badge tone="warning" size="sm" dot={false}>{stk}</Badge>}
            </button>
          );})}
        </div>
      </Field>
      <div className="vg-kv vg-tile" style={{ padding: '10px 12px' }}>
        <span>Mevcut stok</span>
        <Badge tone={mevcut===0?"critical":mevcut<=3?"warning":"success"}>{mevcut} adet</Badge>
      </div>
    </Modal>
  );
}

// ─── ÖDEME MODAL (POS + KOMİSYON) ────────────────────────────────────────
function OdemeModal({ toplam, magaza, terminaller, onTamamla, onIptal }) {
  const [odemeler, setOdemeler] = useState([{ tip:"nakit", tutar:toplam, posId:null, taksit:1 }]);
  const [kaydediliyor, setKaydediliyor] = useState(false);

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

  const tamamla = async () => {
    if(!tamam || kaydediliyor) return;
    setKaydediliyor(true);
    const odemeDetay = odemeler.map(o=>{
      const kb=komisyonBilgi(o);
      const pos=terminaller.find(t=>t.id===o.posId);
      return {...o,banka:pos?.banka||null,terminalno:pos?.terminalno||null,posAd:pos?.ad||null,komisyon:kb.oran,komisyonTutar:kb.tutar,netTahsilat:kb.net};
    });
    try { await onTamamla(odemeDetay,fazla,kalan); } finally { setKaydediliyor(false); }
  };

  return (
    <Modal title="Ödeme al" onClose={onIptal} size="lg"
      headerExtra={<span className="vg-num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginRight: 8 }}>{para(toplam)}</span>}
      footer={<>
        <Button variant="plain" onClick={onIptal}>Vazgeç</Button>
        <Button variant="primary" size="lg" icon={Check} onClick={tamamla} disabled={!tamam} loading={kaydediliyor}>
          {!tamam ? "Ödeme toplamı fazla" : kalan>0.01 ? `Satışı tamamla · ${para(kalan)} indirim` : "Satışı tamamla"}
        </Button>
      </>}>
      <Field label="Ödeme yöntemi">
        <div className="vg-row" style={{ gap: 6 }}>
          {ODEME_TIPLERI.map(ot=>{
            const secili=odemeler.some(o=>o.tip===ot.id);
            return (
              <button key={ot.id} type="button" className="vg-chip" aria-pressed={secili} onClick={()=>secili?undefined:tipEkle(ot.id)} style={{ cursor: secili ? 'default' : 'pointer' }}>
                <ot.ikon className="vg-icon" style={{ width: 14, height: 14 }} />{ot.label}{secili && <Check className="vg-icon" style={{ width: 14, height: 14 }} />}
              </button>
            );
          })}
        </div>
      </Field>

      {odemeler.map(o=>{
        const tipBilgi=ODEME_TIPLERI.find(x=>x.id===o.tip);
        const kb=komisyonBilgi(o);
        const kartOdeme=["kart","taksit"].includes(o.tip);
        const selectedPos=terminaller.find(t=>t.id===o.posId);
        return (
          <div key={o.tip} className="vg-card" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            <div className="vg-row" style={{ padding: '10px 12px', justifyContent: 'space-between', flexWrap: 'nowrap', borderBottom: kartOdeme ? '1px solid var(--line)' : 0 }}>
              <span className="vg-row" style={{ gap: 8, fontWeight: 600 }}><tipBilgi.ikon className="vg-icon" style={{ color: 'var(--ink-muted)' }} />{tipBilgi.label}</span>
              <div className="vg-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                {kalan>0&&Number(o.tutar)<toplam&&<Button size="sm" onClick={()=>guncelle(o.tip,"tutar",Number(Number(o.tutar||0)+kalan).toFixed(2))}>+ Kalan</Button>}
                <div className="vg-input-group">
                  <Input type="number" className="vg-num" value={o.tutar} onChange={e=>guncelle(o.tip,"tutar",e.target.value)} aria-label={`${tipBilgi.label} tutarı`} style={{ width: 140, textAlign: 'right', paddingRight: 26, fontWeight: 600, fontSize: 15 }} />
                  <span className="vg-input-suffix">₺</span>
                </div>
                {odemeler.length>1&&<IconButton icon={X} label={`${tipBilgi.label} ödemesini kaldır`} size="sm" onClick={()=>tipSil(o.tip)} />}
              </div>
            </div>

            {kartOdeme&&(
              <div className="vg-stack" style={{ padding: 12, gap: 12 }}>
                <Field label="POS terminali">
                  <div className="vg-row" style={{ gap: 6 }}>
                    {magazaTerminalleri.length===0
                      ? <Banner tone="critical">Bu mağazada aktif POS terminali yok.</Banner>
                      : magazaTerminalleri.map(pt=>(
                        <button key={pt.id} type="button" className="vg-chip" aria-pressed={o.posId===pt.id} onClick={()=>guncelle(o.tip,"posId",pt.id)} style={{ height: 'auto', padding: '6px 12px', flexDirection: 'column', alignItems: 'flex-start', gap: 1, borderRadius: 8 }}>
                          <span style={{ fontWeight: 600 }}>{pt.banka}</span>
                          <span style={{ fontSize: 11, opacity: .75 }}>{pt.ad} · {pt.terminalno}</span>
                        </button>
                      ))}
                  </div>
                </Field>

                <Field label="Taksit">
                  <div className="vg-row" style={{ gap: 6 }}>
                    {TAKSIT_SECENEKLERI.map(n=>{
                      const oran=selectedPos?.komisyon[n];
                      return (
                        <button key={n} type="button" className="vg-chip" aria-pressed={o.taksit===n} onClick={()=>guncelle(o.tip,"taksit",n)} style={{ height: 'auto', padding: '6px 12px', flexDirection: 'column', gap: 1, borderRadius: 8, minWidth: 64 }}>
                          <span>{n===1?"Peşin":`${n} taksit`}</span>
                          {oran!=null&&<span style={{ fontSize: 11, opacity: .75 }}>%{oran}</span>}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {o.posId&&Number(o.tutar)>0&&(
                  <div className="vg-grid-3" style={{ gap: 8 }}>
                    <div className="vg-tile"><div className="vg-tile__label">Komisyon oranı</div><div className="vg-tile__value">%{kb.oran}</div></div>
                    <div className="vg-tile"><div className="vg-tile__label">Komisyon</div><div className="vg-tile__value vg-text-critical">−{para(kb.tutar)}</div></div>
                    <div className="vg-tile"><div className="vg-tile__label">Net tahsilat</div><div className="vg-tile__value vg-text-success">{para(kb.net)}</div></div>
                  </div>
                )}
                {o.taksit>1&&Number(o.tutar)>0&&<div className="vg-help">Aylık {para(Number(o.tutar)/o.taksit)} × {o.taksit} = {para(Number(o.tutar))}</div>}
              </div>
            )}
          </div>
        );
      })}

      <div className="vg-tile">
        <div className="vg-kv"><span>Ödenen</span><span>{para(odenenToplam)}</span></div>
        {kalan>0&&<div className="vg-kv vg-text-warning"><span>Kalan (fişe indirim olarak yazılır)</span><span>{para(kalan)}</span></div>}
        {fazla>0&&<div className="vg-kv vg-text-warning"><span>Para üstü</span><span>{para(fazla)}</span></div>}
        {toplamKomisyon>0&&(
          <>
            <div className="vg-kv vg-text-critical" style={{ borderTop: '1px solid var(--line)', marginTop: 4 }}><span>Toplam komisyon</span><span>−{para(toplamKomisyon)}</span></div>
            <div className="vg-kv"><span>Net tahsilat</span><span className="vg-text-success">{para(netTahsilat)}</span></div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── FİŞ MODAL ────────────────────────────────────────────────────────────
function FisModal({ satis, onKapat }) {
  const print = usePrint();
  const magazaAd = typeof satis.magaza==="object" ? satis.magaza?.ad : satis.magaza
  const satir = (l,r,cls="") => <div className={`vg-kv ${cls}`} style={{ padding: '2px 0', fontSize: 12 }}><span>{l}</span><span>{r}</span></div>
  const cizgi = () => <div style={{ borderTop: '1px dashed var(--line-input)', margin: '10px 0' }}/>

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
      return `<div class="row sm"><span>${tip?.label||o.tip}</span><span>${para(o.tutar)}</span></div>
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
    <Modal title="Satış tamamlandı" subtitle={<span className="vg-code">{satis.fisNo}</span>} onClose={onKapat}
      footer={<>
        <Button icon={Printer} onClick={yazdir} style={{ marginRight: 'auto' }}>Tarayıcıdan yazdır</Button>
        <Button variant="primary" icon={Plus} onClick={onKapat}>Yeni satış</Button>
      </>}>
      {/* Fiş önizlemesi: kâğıt görünümü her iki temada da beyaz kalır */}
      <div style={{ background: '#fff', color: '#15171c', borderRadius: 8, boxShadow: 'inset 0 0 0 1px var(--line)', padding: '16px 18px', fontFamily: 'var(--font-mono)', fontSize: 12, maxHeight: '48vh', overflowY: 'auto', ['--ink-muted']: '#5b6270', ['--line']: '#e4e7eb', ['--line-input']: '#8b929d' }}>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 4 }}>VEGA</div>
          <div style={{ fontSize: 11, color: '#5b6270' }}>Çanta & Ayakkabı · {magazaAd}</div>
        </div>
        {cizgi()}
        {satir("Tarih", tarihFormat(satis.tarih))}
        {satir("Fiş no", satis.fisNo)}
        {(satis.musteri||satis.musteriAd) && satir("Müşteri", typeof satis.musteri==="object"?`${satis.musteri?.ad||""} ${satis.musteri?.soyad||""}`.trim():(satis.musteri||satis.musteriAd||""))}
        {satis.kasiyer && satir("Kasiyer", satis.kasiyer)}
        {cizgi()}
        {(satis.kalemler||[]).map((k,i)=>(
          <div key={i} style={{ marginBottom: 6 }}>
            <div className="vg-kv" style={{ padding: 0, fontWeight: 600, color: '#15171c' }}><span style={{ color: '#15171c', maxWidth: '65%' }}>{k.urunAd}</span><span>{para(k.toplam)}</span></div>
            <div style={{ color: '#5b6270', fontSize: 11 }}>
              {k.marka&&`${k.marka} · `}{[k.renk,k.beden].filter(Boolean).join("/")} × {k.adet} × {para(k.birimFiyat)}
              {k.indirim>0&&<span style={{ color: '#c4312b' }}> (−%{k.indirim})</span>}
            </div>
          </div>
        ))}
        {cizgi()}
        {satir("Ara toplam", para(satis.araToplam))}
        {satis.genelIndirimTutar>0&&satir(`İndirim (%${satis.genelIndirim})`, `−${para(satis.genelIndirimTutar)}`)}
        {satir("KDV (dahil)", para(satis.kdvToplam))}
        <div className="vg-kv" style={{ padding: '6px 0 2px', fontWeight: 700, fontSize: 16, color: '#15171c' }}><span style={{ color: '#15171c' }}>TOPLAM</span><span>{para(satis.genelToplam)}</span></div>
        {cizgi()}
        {satis.odemeler.map((o,i)=>{
          const tip=ODEME_TIPLERI.find(x=>x.id===o.tip)
          return (
            <div key={i} style={{ marginBottom: 4 }}>
              {satir(tip?.label||o.tip, para(o.tutar))}
              {o.banka&&<div style={{ fontSize: 11, color: '#5b6270', paddingLeft: 12 }}>{o.banka}{o.taksit>1&&` · ${o.taksit} taksit`}</div>}
              {o.komisyonTutar>0&&<div style={{ fontSize: 11, color: '#c4312b', paddingLeft: 12 }}>Komisyon: −{para(o.komisyonTutar)}</div>}
            </div>
          )
        })}
        {satis.paraUstu>0&&satir("Para üstü", para(satis.paraUstu))}
        {satis.odemeler.some(o=>o.komisyonTutar>0)&&(<>
          {cizgi()}
          {satir("Toplam komisyon", `−${para(satis.odemeler.reduce((t,o)=>t+o.komisyonTutar,0))}`)}
          {satir("Net tahsilat", para(satis.odemeler.reduce((t,o)=>t+o.netTahsilat,0)))}
        </>)}
        {cizgi()}
        <div style={{ textAlign: 'center', color: '#5b6270', fontSize: 11 }}>
          Alışverişiniz için teşekkürler<br/>Instagram: vegacantastore · www.vegacantastore.com
        </div>
      </div>

      {/* QZ Tray — termal fiş yazıcısı (Zjiang vb.), ham ESC/POS */}
      <QzFisPaneli yazdir={print.fisYazdir} veri={satis} etiket="QZ ile bas" />
    </Modal>
  );
}

// ─── ANA POS EKRANI ───────────────────────────────────────────────────────
export default function SatisKasa({ t, kullanici, aktifMagaza, aktif }) {
  // Context'ten mağazaları al
  let ctxMagazalar = [];
  try { const ctx = useVega(); ctxMagazalar = (ctx.magazalar||[]).filter(m=>m.tip!=='online'); } catch { /* context dışında */ }
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
          setTimeout(async () => {
            if (await onayla('Yeni gün başlıyor. Günlük kasayı açmak ister misiniz?', { title: 'Günaydın', confirmLabel: 'Günlük kasayı aç', cancelLabel: 'Daha sonra', tone: 'primary' })) {
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
          satisF:   Number(u.satisF) || 0,
          varyantlar: u.varyantlar || [],
          stok: (u.varyantlar || []).map(v => ({
            renk:     v.renk,
            beden:    v.beden,
            barkod:   v.barkod ? String(v.barkod) : null, // Barkodları string olarak sakla
            magazaId: v.magazaId,
            magaza: idMap ? (Object.entries(idMap).find(([,id])=>id===v.magazaId)?.[0] || v.magaza || v.magazaId || "Merkez") : (v.magaza || v.magazaId || "Merkez"),
            adet:   Number(v.adet) || 0,
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
          magaza: magazaIdMap ? (Object.entries(magazaIdMap).find(([,id])=>id===v.magazaId)?.[0] || v.magaza || v.magazaId || "Merkez") : (v.magaza || v.magazaId || "Merkez"),
          adet:   Number(v.adet) || 0,
        })),
      })));
    }).catch(err => console.error("Ürün listesi tazeleme hatası:", err));
  }, [aktif]);

  useEffect(()=>{ if(ekran==="pos" && aktif) barkodRef.current?.focus(); },[ekran, aktif]);

  // Topbar'dan mağaza değişince kasayı güncelle
  useEffect(()=>{
    if(!aktifMagaza || aktifMagaza==='hepsi') return
    const ad = Object.entries(magazaIdMap).find(([,v])=>v===aktifMagaza)?.[0]
    if(ad) setMagaza(ad)
  },[aktifMagaza, magazaIdMap]);

  const goster = useCallback((mesaj,tip="ok")=>{ toast(mesaj, tip==="ok"?"success":tip==="hata"?"critical":"warning", 2600); },[]);

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

    let eslesenUrun = null;

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
      goster(`"${val}" barkodlu ürün bulunamadı.`,"hata");
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
    const mevcut=stokVar(urun,renk,beden,magaza, magazaIdMap);
    if(mevcut===0){goster(`"${urun.ad}" için stok tükendi.`,"hata");return;}

    // Varyant barkodunu bul
    const magazaId = magazaIdMap[magaza];
    const varyantBarkod = barkodOverride ||
      urun.stok?.find(s=>(s.magazaId === magazaId)&&s.renk===renk&&(s.beden===beden||(!s.beden&&!beden)))?.barkod ||
      urun.barkod || null;

    setSepet(prev=>{
      const idx=prev.findIndex(s=>s.urunId===urun.id && s.renk===renk && s.beden===beden);
      if(idx>=0){
        if(prev[idx].adet>=mevcut){goster(`"${urun.ad}" için en fazla ${mevcut} adet eklenebilir.`,"uyari");return prev;}
        const y=[...prev];y[idx]={...y[idx],adet:y[idx].adet+1};return y;
      }
      return [...prev,{id:yeniId(),urunId:urun.id,urunAd:urun.ad,marka:urun.marka,barkod:varyantBarkod,renk,beden,adet:1,birimFiyat:urun.satisF,alisF:urun.alisF||0,indirim:0,kdv:urun.kdv,maxAdet:mevcut}];
    });
    setVaryantModal(null); setAramaQuery(""); setAramaSonuc([]);
    goster(`${urun.ad} sepete eklendi.`,"ok");
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

  const satisiTamamla=async(odemelerData,paraUstu,ekIndirim=0)=>{
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
      kalemler: sepet.map(s=>({
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
      odemeler: odemelerData.map(o=>({
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

      setGecmis(prev=>[yeniSatisObjesi,...prev]);
      goster("Satış kaydedildi.","ok");

    } catch(err) {
      console.error("Satış kayıt hatası:", err);
      goster("Satış kaydedilemedi: " + err.message, "hata");
    }

    setOdemeModal(false);
    setFisModal(yeniSatisObjesi);
  };

  // Veresiye NORMAL satış akışından geçiyor: 'veresiye' tipinde tek ödeme satırıyla
  // satış kaydediliyor. Stok düşümü ve cari alacak kaydı backend'de aynı transaction
  // içinde yapılıyor (routes/satislar.js).
  // ESKİ DAVRANIŞ: satış hiç kaydedilmeden doğrudan /cari/hareket çağrılıyordu —
  // ne satış, ne stok, ne de (bozuk uç yüzünden) cari kaydı oluşuyordu.
  const veresiyeKaydet = async () => {
    const tutar = Number(genelToplam||0)
    if (!tutar) return toast.warning('Sepet boş.')
    if (!musteriId) return toast.warning('Veresiye için önce CRM müşterisi seçin.')
    if (!await onayla(`${musteri} için ${para(tutar)} borç kaydedilecek.\n\nSatış kaydedilir, stok düşülür ve müşterinin cari hesabına alacak yazılır.`, { title: 'Veresiye satış', confirmLabel: 'Veresiye olarak kaydet', tone: 'primary' })) return
    await satisiTamamla([{ tip:'veresiye', tutar, taksit:1, komisyon:0, komisyonTutar:0, netTahsilat:tutar }], 0, 0)
  }

  const musteriAra = async (v) => {
    setMusteri(v); setMusteriId(null);
    if (v.length >= 2) {
      try {
        const res = await fetch(`${API_BASE}/musteriler?q=${encodeURIComponent(v)}&limit=5`);
        const d = await res.json();
        setMusteriOneri(Array.isArray(d) ? d : []);
        setMusteriOneriAcik((Array.isArray(d) ? d : []).length > 0);
      } catch { setMusteriOneri([]); }
    } else { setMusteriOneri([]); setMusteriOneriAcik(false); }
  }

  const yeniSatis=()=>{setSepet([]);setGenelIndirim(0);setMusteri("");setMusteriId(null);setSatisNot("");setFisModal(null);setTimeout(()=>barkodRef.current?.focus(),100);};

  const kilitDegistir = async () => {
    if (magazaKilit) {
      if (await onayla('Kasada mağaza seçimini değiştirmek üzeresiniz.', { title: 'Mağaza kilidini aç', confirmLabel: 'Kilidi aç', tone: 'primary' })) setMagazaKilit(false)
    } else setMagazaKilit(true)
  }

  const EKRANLAR = [
    { id: 'pos', label: 'Satış' }, { id: 'gecmis', label: 'Geçmiş' }, { id: 'iade', label: 'İade' },
    { id: 'degisim', label: 'Değişim' }, { id: 'kasa', label: 'Günlük kasa' }, { id: 'pos_rapor', label: 'POS raporu' },
    { id: 'pos_yonetim', label: 'Terminaller' },
  ]

  const magazaStokluUrunler = urunDb.filter(u=>{ const ms=u.stok.filter(s=>s.magaza===magaza||s.magazaId===magazaIdMap[magaza]); return ms.length===0||ms.some(s=>s.adet>0); }).slice(0,6)
  const bugunCiro = gecmis.filter(s=>new Date(s.tarih).toDateString()===new Date().toDateString()).reduce((t,s)=>t+Number(s.genelToplam||0),0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Üst şerit: mağaza + alt ekranlar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '10px 24px 0', flexShrink: 0 }}>
        <div className="vg-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <div className="vg-row" style={{ gap: 8 }}>
            <h1 className="vg-page-title" style={{ fontSize: 18 }}>Satış ve kasa</h1>
            <div className="vg-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              <Select size="sm" value={magaza} onChange={e=>setMagaza(e.target.value)} disabled={magazaKilit} aria-label="Mağaza" style={{ width: 'auto' }}>
                {magazalar.map(m=><option key={m}>{m}</option>)}
              </Select>
              <IconButton icon={magazaKilit ? Lock : LockOpen} variant={magazaKilit ? 'plain' : 'secondary'} size="sm"
                label={magazaKilit ? "Mağaza kilitli, değiştirmek için tıklayın" : "Mağaza kilidini kapat"} onClick={kilitDegistir}
                style={!magazaKilit ? { color: 'var(--warning)', background: 'var(--warning-soft)' } : undefined} />
            </div>
          </div>
          <span className="vg-muted vg-num" style={{ fontSize: 12 }}>Bugün {para(bugunCiro)}</span>
        </div>
        <Tabs value={ekran} onChange={setEkran} items={EKRANLAR} className="vg-tabs--flush" />
      </div>

      {/* ALT EKRANLAR */}
      {ekran==="pos_yonetim"&&<div style={{flex:1,overflowY:"auto"}}><PosYonetimModule terminaller={terminaller} setTerminaller={setTerminaller} magazalar={ctxMagazalar.filter(m=>m.tip!=="online")} t={t}/></div>}
      {ekran==="iade"&&<div style={{flex:1,overflowY:"auto"}}><IadeEkraniModule t={t} magazalar={ctxMagazalar.filter(m=>m.tip!=="online")} magazaAd={magaza}/></div>}
      {ekran==="degisim"&&<div style={{flex:1,overflowY:"auto"}}><DegisimEkraniModule t={t} magazaId={magazaIdMap[magaza]||null} magazaAd={magaza}/></div>}
      {ekran==="kasa"&&<div style={{flex:1,overflowY:"auto"}}><GunlukKasaModule t={t} magazaId={magazaIdMap[magaza]||null} magazaAd={magaza}/></div>}
      {ekran==="pos_rapor"&&<div style={{flex:1,overflowY:"auto"}}><PosRaporModule gecmis={gecmis} terminaller={terminaller} t={t}/></div>}

      {/* GEÇMİŞ */}
      {ekran==="gecmis"&&(
        <div style={{flex:1,overflowY:"auto"}}>
          <div className="vg-page">
            <div className="vg-grid-4">
              <StatCard label="Bugünkü satış" value={para(bugunCiro)} />
              <StatCard label="Toplam işlem" value={`${gecmis.length} adet`} />
              <StatCard label="Toplam ciro" value={para(gecmis.reduce((t,s)=>t+Number(s.genelToplam||0),0))} />
              <StatCard label="Toplam komisyon" value={para(gecmis.reduce((t,s)=>t+s.odemeler.reduce((a,o)=>a+(o.komisyonTutar||0),0),0))} />
            </div>
            <div className="vg-table-wrap">
              {yukleniyor ? <LoadingRows card={false} /> : gecmis.length === 0 ? <EmptyState icon={ReceiptText} title="Henüz satış yok" /> : (
                <div className="vg-table-scroll">
                  <table className="vg-table" style={{ minWidth: 1100 }}>
                    <thead><tr><th>Fiş no</th><th>Tarih</th><th>Mağaza</th><th>Müşteri</th><th>Ürünler</th><th className="is-num">Tutar</th><th className="is-num">İndirim</th><th>Ödeme</th><th className="is-num">Komisyon</th><th>Not</th><th></th></tr></thead>
                    <tbody>
                      {gecmis.map(s=>{
                        const topKom=s.odemeler.reduce((t,o)=>t+(o.komisyonTutar||0),0);
                        return (
                          <tr key={s.fisNo}>
                            <td className="vg-code is-strong">{s.fisNo}</td>
                            <td className="vg-nowrap vg-muted">{tarihFormat(s.tarih)}</td>
                            <td className="vg-muted">{typeof s.magaza === "object" ? (s.magaza?.ad||"—") : (s.magaza||"—")}</td>
                            <td>{musteriMetni(s)}</td>
                            <td className="vg-muted" style={{ maxWidth: 260 }}><div className="vg-truncate" title={(s.kalemler||[]).map(k=>`${kalemEtiketi(k)}×${k.adet}`).join(", ")}>{(s.kalemler||[]).map(k=>`${kalemEtiketi(k)} ×${k.adet}`).join(", ")}</div></td>
                            <td className="is-num is-strong">{para(s.genelToplam)}</td>
                            <td className={`is-num ${s.genelIndirimTutar>0?'vg-text-warning':'vg-muted'}`}>{s.genelIndirimTutar>0?"−"+para(s.genelIndirimTutar):"—"}</td>
                            <td>
                              {s.odemeler.map((o,i)=>{
                                const ot=ODEME_TIPLERI.find(x=>x.id===o.tip);
                                return <div key={i} className="vg-nowrap" style={{ fontSize: 12 }}>{ot?.label||o.tip} {para(o.tutar)}{o.banka&&<span className="vg-muted"> · {o.banka}{o.taksit>1&&` ${o.taksit}T`}</span>}</div>;
                              })}
                            </td>
                            <td className={`is-num ${topKom>0?'vg-text-critical':'vg-muted'}`}>{topKom>0?"−"+para(topKom):"—"}</td>
                            <td className="vg-muted">{s.not||s.notlar||"—"}</td>
                            <td><Button size="sm" icon={Printer} onClick={()=>setFisModal(s)}>Fiş</Button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SATIŞ EKRANI */}
      {ekran==="pos"&&(
        <div className="vg-pos">
          {/* SOL — ürün girişi + sepet */}
          <div className="vg-pos__main">
            <div className="vg-pos__inputs">
              <div className="vg-grid-2" style={{ gap: 10 }}>
                <div className="vg-input-group">
                  <ScanBarcode className="vg-icon" />
                  <Input ref={barkodRef} size="lg" mono value={barkodInput} onChange={e=>setBarkodInput(e.target.value)} onKeyDown={barkodOku} placeholder="Barkod okutun, Enter" autoComplete="off" aria-label="Barkod" style={{ paddingLeft: 34, fontSize: 15, letterSpacing: 1 }} />
                </div>
                <div style={{ position: 'relative' }}>
                  <div className="vg-input-group">
                    <Search className="vg-icon" />
                    <Input size="lg" value={aramaQuery} onChange={e=>setAramaQuery(e.target.value)} placeholder="Ürün adı, marka veya kod" aria-label="Ürün ara" style={{ paddingLeft: 34 }} />
                  </div>
                  {aramaSonuc.length>0&&(
                    <div className="vg-menu" style={{ left: 0, right: 0, maxHeight: 360, overflowY: 'auto' }}>
                      {aramaSonuc.map((u, index) => {
                        const var_ = u.stok.some(s => s.magazaId === magazaIdMap[magaza] && s.adet > 0);
                        return (
                          <button key={`${u.id}-${index}`} type="button" className="vg-list__item vg-list__item--button" style={{ borderRadius: 6, padding: '8px 10px', opacity: var_ ? 1 : .55 }}
                            onClick={() => { setAramaQuery(""); setAramaSonuc([]); setVaryantModal(u); }}>
                            <div className="vg-list__main">
                              <div className="vg-list__primary">{u.ad}</div>
                              <div className="vg-list__secondary">{[u.marka, u.altKategori].filter(Boolean).join(' · ')}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className="vg-list__value">{para(u.satisF)}</div>
                              <Badge tone={var_?'success':'critical'} size="sm">{var_?'Stokta':'Stok yok'}</Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {magazaStokluUrunler.length > 0 && (
                <div className="vg-row" style={{ gap: 6, marginTop: 10 }}>
                  <span className="vg-help">Hızlı ekle</span>
                  {magazaStokluUrunler.map(u=>(
                    <button key={u.id} type="button" className="vg-chip" onClick={()=>setVaryantModal(u)} title={u.ad}>
                      <span className="vg-truncate" style={{ maxWidth: 140 }}>{u.ad}</span>
                      <span className="vg-num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{para(u.satisF)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {sepet.length===0
                ? <EmptyState icon={ShoppingBasket} title="Sepet boş" text="Barkod okutun ya da ürün arayın." />
                : <div className="vg-table-scroll">
                    <table className="vg-table" style={{ minWidth: 640 }}>
                      <thead><tr><th>Ürün</th><th>Renk / beden</th><th className="is-num">Fiyat</th><th className="is-num">İnd. %</th><th style={{ textAlign: 'center' }}>Adet</th><th className="is-num">Toplam</th><th></th></tr></thead>
                      <tbody>
                        {sepet.map(s=>(
                          <tr key={s.id}>
                            <td><div className="is-strong">{s.urunAd}</div>{s.barkod && <div className="vg-code vg-muted">{s.barkod}</div>}</td>
                            <td className="vg-muted">{[s.renk, s.beden].filter(Boolean).join(' / ') || '—'}</td>
                            <td className="is-num"><Input size="sm" type="number" className="vg-num" value={s.birimFiyat} onChange={e=>kalemGuncelle(s.id,"birimFiyat",e.target.value)} aria-label="Birim fiyat" style={{ width: 96, textAlign: 'right' }} /></td>
                            <td className="is-num"><Input size="sm" type="number" min={0} max={100} className="vg-num" value={s.indirim} onChange={e=>kalemGuncelle(s.id,"indirim",e.target.value)} aria-label="İndirim yüzdesi" style={{ width: 64, textAlign: 'right', ...(s.indirim>0 ? { background: 'var(--warning-soft)', borderColor: 'var(--warning)' } : {}) }} /></td>
                            <td>
                              <div className="vg-row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'center' }}>
                                <IconButton icon={Minus} label="Azalt" variant="secondary" size="sm" onClick={()=>kalemGuncelle(s.id,"adet",s.adet-1)} />
                                <span className="vg-num" style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{s.adet}</span>
                                <IconButton icon={Plus} label="Arttır" variant="secondary" size="sm" onClick={()=>kalemGuncelle(s.id,"adet",s.adet+1)} />
                              </div>
                            </td>
                            <td className="is-num is-strong">{para(kalemToplam(s))}</td>
                            <td><IconButton icon={Trash2} label="Kalemi sil" variant="critical-plain" size="sm" onClick={()=>kalemSil(s.id)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          </div>

          {/* SAĞ — Kasa */}
          <aside className="vg-pos__side">
            <div className="vg-pos__side-body">
              <Field label="Müşteri" action={musteriId && <Badge tone="success" size="sm">CRM müşterisi</Badge>}>
                <div style={{ position: 'relative' }}>
                  <div className="vg-input-group">
                    <UserRound className="vg-icon" />
                    <Input value={musteri} onChange={e=>musteriAra(e.target.value)} autoComplete="off"
                      onFocus={()=>musteri.length>=2&&musteriOneri.length>0&&setMusteriOneriAcik(true)}
                      onBlur={()=>setTimeout(()=>setMusteriOneriAcik(false),200)}
                      placeholder="Ad veya telefon" aria-label="Müşteri" style={{ paddingLeft: 32 }} />
                  </div>
                  {musteriOneriAcik&&musteriOneri.length>0&&(
                    <div className="vg-menu" style={{ left: 0, right: 0 }}>
                      {musteriOneri.map(m=>(
                        <button key={m.id} type="button" className="vg-list__item vg-list__item--button" style={{ borderRadius: 6, padding: '6px 10px' }}
                          onMouseDown={e=>e.preventDefault()}
                          onClick={()=>{ setMusteri(`${m.ad} ${m.soyad||''}`.trim()); setMusteriId(m.id); setMusteriOneriAcik(false); setMusteriOneri([]); }}>
                          <div className="vg-list__main"><div className="vg-list__primary">{m.ad} {m.soyad||''}</div><div className="vg-list__secondary">{m.telefon||''}</div></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              <div className="vg-input-group">
                <NotebookPen className="vg-icon" />
                <Input value={satisNot} onChange={e=>setSatisNot(e.target.value)} placeholder="Satış notu" aria-label="Satış notu" style={{ paddingLeft: 32 }} />
              </div>
              {musteriId && <Button icon={ReceiptText} onClick={veresiyeKaydet} disabled={sepet.length===0} block>Veresiye olarak kaydet</Button>}

              <div className="vg-divider" />

              <div>
                <div className="vg-kv"><span>Kalem</span><span>{sepet.reduce((t,s)=>t+s.adet,0)} adet</span></div>
                <div className="vg-kv"><span>Ara toplam</span><span>{para(araToplam)}</span></div>
                {genelIndirim>0&&<div className="vg-kv vg-text-warning"><span>İndirim (%{genelIndirim})</span><span>−{para(indirimTutar)}</span></div>}
                <div className="vg-kv" style={{ fontSize: 12 }}><span>KDV (dahil)</span><span>{para(kdvToplam)}</span></div>
              </div>

              <Field label="Sepet indirimi">
                <div className="vg-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <div className="vg-segmented" style={{ flex: 1 }}>
                    {[0,5,10,15,20].map(v=><button key={v} type="button" aria-pressed={genelIndirim===v} onClick={()=>setGenelIndirim(v)} style={{ flex: 1 }}>{v===0?"Yok":"%"+v}</button>)}
                  </div>
                  <div className="vg-input-group" style={{ width: 84 }}>
                    <Input size="sm" type="number" min={0} max={100} className="vg-num" value={genelIndirim} onChange={e=>setGenelIndirim(Math.min(100,Math.max(0,Number(e.target.value))))} aria-label="Özel indirim yüzdesi" style={{ paddingRight: 22 }} />
                    <span className="vg-input-suffix" style={{ right: 8 }}>%</span>
                  </div>
                </div>
              </Field>
            </div>

            <div className="vg-pos__total">
              <div className="vg-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="vg-muted" style={{ fontSize: 13 }}>Genel toplam</span>
                <span className="vg-num" style={{ fontSize: 30, lineHeight: '36px', fontWeight: 600, letterSpacing: '-0.02em' }}>{para(genelToplam)}</span>
              </div>
              <Button variant="primary" size="lg" block icon={Check} onClick={()=>sepet.length>0&&setOdemeModal(true)} disabled={sepet.length===0} style={{ height: 52, fontSize: 16 }}>
                {sepet.length>0?`Ödeme al`:"Sepet boş"}
              </Button>
              {sepet.length>0&&<Button variant="plain" block icon={X} onClick={async()=>{ if(await onayla('Sepetteki tüm ürünler kaldırılacak.', { title: 'Sepeti temizle', confirmLabel: 'Sepeti temizle' })) setSepet([]) }}>Sepeti temizle</Button>}
            </div>
          </aside>
        </div>
      )}

      {/* MODALLER */}
      {varyantModal&&<VaryantSecici urun={varyantModal} magaza={magaza} onSec={(r,b)=>sepeteEkle(varyantModal,r,b)} onIptal={()=>setVaryantModal(null)} magazaIdMap={magazaIdMap}/>}
      {odemeModal&&<OdemeModal toplam={genelToplam} magaza={magaza} terminaller={terminaller} onTamamla={satisiTamamla} onIptal={()=>setOdemeModal(false)}/>}
      {fisModal&&<FisModal satis={fisModal} onKapat={yeniSatis}/>}
    </div>
  );
}
