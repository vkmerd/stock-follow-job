import { useState, useEffect } from 'react'
import { useVega } from './VegaContext'
import {
  masrafKategorileriniGetir, masrafKategoriEkle, masrafKategoriGuncelle, masrafKategoriSil,
  masraflariGetir, masrafOzetGetir, masrafEkle, masrafGuncelle, masrafSil,
  bankaHesaplariGetir
} from './api'
import { Page, PageHeader, Card, Button, IconButton, Field, Input, Select, Segmented, Tabs, Badge, Banner, Modal, StatCard, EmptyState, LoadingRows, KategoriIkon, KATEGORI_IKONLARI, alpha, onayla, toast } from './ui'
import { Plus, Pencil, Trash2, Wallet, Banknote, CreditCard, Landmark } from 'lucide-react'

const para = v => `₺${Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const tarihTR = iso => new Date(iso).toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'})

const IKONLAR = Object.keys(KATEGORI_IKONLARI)
const RENKLER = ['#2e6db4','#16713f','#6d4fc2','#b4531a','#9a5b00','#c4312b','#0f766e','#a21caf','#5b6270','#1d4ed8']
const KAYNAKLAR = { nakit: 'Nakit', kart: 'Kart', banka: 'Banka' }

// ─── KATEGORİ MODAL ───────────────────────────────────────────
function KategoriModal({ kategori, onKaydet, onKapat }) {
  const bos = { ad:'', ikon:'para', renk:RENKLER[0] }
  const [form, setForm] = useState(kategori || bos)
  const [hata, setHata] = useState('')
  const [kayit, setKayit] = useState(false)
  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  const kaydet = async () => {
    if (!form.ad.trim()) return setHata('Kategori adı zorunlu.')
    setHata(''); setKayit(true)
    try {
      if (kategori) await masrafKategoriGuncelle(kategori.id, form)
      else          await masrafKategoriEkle(form)
      toast.success(kategori ? 'Kategori güncellendi.' : 'Kategori eklendi.')
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <Modal title={kategori?'Kategoriyi düzenle':'Yeni kategori'} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit?'Kaydediliyor…':kategori?'Değişiklikleri kaydet':'Kategori ekle'}</Button>
      </>}>
      <Field label="Kategori adı" htmlFor="kat-ad">
        <Input id="kat-ad" value={form.ad} onChange={e=>g('ad',e.target.value)} placeholder="örn. Kira, Elektrik" />
      </Field>
      <Field label="İkon">
        <div className="vg-row" style={{ gap: 6 }}>
          {IKONLAR.map(ikon=>(
            <Button key={ikon} variant={form.ikon===ikon?'primary':'secondary'} icon={KATEGORI_IKONLARI[ikon]} aria-label={ikon} aria-pressed={form.ikon===ikon} onClick={()=>g('ikon',ikon)} />
          ))}
        </div>
      </Field>
      <Field label="Renk">
        <div className="vg-row" style={{ gap: 8 }}>
          {RENKLER.map(renk=>(
            <button key={renk} type="button" aria-label={`Renk ${renk}`} aria-pressed={form.renk===renk} onClick={()=>g('renk',renk)} style={{
              width:24,height:24,borderRadius:'50%',background:renk,border:0,cursor:'pointer',
              boxShadow:form.renk===renk?`0 0 0 2px var(--surface), 0 0 0 4px ${renk}`:'none'}}/>
          ))}
        </div>
      </Field>
      {hata && <Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

// ─── MASRAF FORMU MODAL ───────────────────────────────────────
function MasrafModal({ masraf, kategoriler, magazalar, bankaHesaplar=[], onKaydet, onKapat }) {
  const bugun = new Date().toISOString().slice(0,10)
  const bos = { kategoriId:'', magazaId:'', tutar:'', aciklama:'', faturaNo:'', tarih:bugun, odemeKaynagi:'nakit' }
  const [form, setForm] = useState(masraf ? {
    ...masraf, tutar: Number(masraf.tutar),
    kategoriId: masraf.kategoriId||'', magazaId: masraf.magazaId||'',
    tarih: masraf.tarih?.slice(0,10)||bugun, odemeKaynagi: masraf.odemeKaynagi||'nakit'
  } : bos)
  const [hata, setHata] = useState('')
  const [kayit, setKayit] = useState(false)
  const g = (k,v) => setForm(p=>({...p,[k]:v}))

  const kaydet = async () => {
    if (!form.tutar || Number(form.tutar) <= 0) return setHata('Tutar zorunlu ve sıfırdan büyük olmalı.')
    setHata(''); setKayit(true)
    try {
      if (masraf) await masrafGuncelle(masraf.id, form)
      else        await masrafEkle(form)
      toast.success(masraf ? 'Masraf güncellendi.' : 'Masraf kaydedildi.')
      onKaydet()
    } catch(e) { setHata(e.message) }
    finally { setKayit(false) }
  }

  return (
    <Modal title={masraf?'Masrafı düzenle':'Yeni masraf'} onClose={onKapat}
      footer={<>
        <Button variant="plain" onClick={onKapat}>Vazgeç</Button>
        <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit?'Kaydediliyor…':masraf?'Değişiklikleri kaydet':'Masrafı kaydet'}</Button>
      </>}>
      <Field label="Kategori">
        <div className="vg-row" style={{ gap: 6 }}>
          {kategoriler.map(k=>(
            <button key={k.id} type="button" className="vg-chip" aria-pressed={form.kategoriId===k.id} onClick={()=>g('kategoriId',k.id)}>
              <KategoriIkon ikon={k.ikon} className="vg-icon" style={{ width: 14, height: 14, color: form.kategoriId===k.id ? undefined : k.renk }} />
              {k.ad}
            </button>
          ))}
          {kategoriler.length === 0 && <span className="vg-help">Henüz kategori yok. Kategoriler sekmesinden ekleyin.</span>}
        </div>
      </Field>

      <Field label="Mağaza" htmlFor="ms-magaza">
        <Select id="ms-magaza" value={form.magazaId} onChange={e=>g('magazaId',e.target.value)}>
          <option value="">Genel (mağazaya bağlı değil)</option>
          {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
        </Select>
      </Field>

      <Field label="Ödeme kaynağı">
        <Segmented label="Ödeme kaynağı" value={form.odemeKaynagi} onChange={v=>g('odemeKaynagi',v)} className="vg-segmented--block"
          options={Object.entries(KAYNAKLAR).map(([value,label])=>({ value, label }))} />
        {form.odemeKaynagi==='banka'&&(
          <Select value={form.bankaHesapId||''} onChange={e=>g('bankaHesapId',e.target.value)} aria-label="Banka hesabı" style={{ marginTop: 8 }}>
            <option value="">Hesap seçin</option>
            {bankaHesaplar.map(h=><option key={h.id} value={h.id}>{h.ad} · {h.banka}</option>)}
          </Select>
        )}
      </Field>

      <div className="vg-grid-2">
        <Field label="Tutar" htmlFor="ms-tutar">
          <div className="vg-input-group">
            <Input id="ms-tutar" type="number" className="vg-num" value={form.tutar} onChange={e=>g('tutar',e.target.value)} placeholder="0,00" style={{ paddingRight: 28 }} />
            <span className="vg-input-suffix">₺</span>
          </div>
        </Field>
        <Field label="Tarih" htmlFor="ms-tarih">
          <Input id="ms-tarih" type="date" value={form.tarih} onChange={e=>g('tarih',e.target.value)} />
        </Field>
      </div>

      <Field label="Açıklama" htmlFor="ms-aciklama">
        <Input id="ms-aciklama" value={form.aciklama} onChange={e=>g('aciklama',e.target.value)} placeholder="Masraf detayı" />
      </Field>
      <Field label="Fatura no" help="İsteğe bağlı" htmlFor="ms-fatura">
        <Input id="ms-fatura" mono value={form.faturaNo} onChange={e=>g('faturaNo',e.target.value)} />
      </Field>

      {hata && <Banner tone="critical">{hata}</Banner>}
    </Modal>
  )
}

const KAYNAK_IKON = { nakit: Banknote, kart: CreditCard, banka: Landmark }

// ─── ANA COMPONENT ────────────────────────────────────────────
export default function MasrafYonetimi() {
  const { magazalar: ctxMagazalar } = useVega()
  const magazalar = (ctxMagazalar||[]).filter(m=>m.tip!=='online')

  const simdi = new Date()
  const [sekme, setSekme]           = useState('liste')    // liste | kategoriler
  const [masraflar, setMasraflar]   = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [ozet, setOzet]             = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [modal, setModal]           = useState(null)       // null | 'masraf' | 'kategori' | obj
  const [bankaHesaplar, setBankaHesaplar] = useState([])
  const [katModal, setKatModal]     = useState(null)
  const [yil, setYil]               = useState(simdi.getFullYear())
  const [ay, setAy]                 = useState(simdi.getMonth()+1)
  const [magazaFiltre, setMagazaFiltre] = useState('')

  const yukle = async () => {
    setYukleniyor(true)
    try {
      const [mData, kData, bData, oData] = await Promise.all([
        masraflariGetir({ limit:200, ...(magazaFiltre&&{magazaId:magazaFiltre}) }),
        masrafKategorileriniGetir(),
        bankaHesaplariGetir().catch(()=>[]),
        masrafOzetGetir({ yil, ay, ...(magazaFiltre&&{magazaId:magazaFiltre}) }),
      ])
      setMasraflar(mData)
      setKategoriler(kData)
      setBankaHesaplar(Array.isArray(bData)?bData:[])
      setOzet(oData)
    } catch(e) { console.error(e) }
    finally { setYukleniyor(false) }
  }

  useEffect(() => { yukle() }, [yil, ay, magazaFiltre])

  const sil = async (m) => {
    if (!await onayla(`${para(m.tutar)} tutarındaki masraf kaydı silinecek.`, { title: 'Masrafı sil', confirmLabel: 'Masrafı sil' })) return
    try {
      await masrafSil(m.id)
      setMasraflar(p=>p.filter(x=>x.id!==m.id))
      toast.success('Masraf silindi.')
    } catch (e) { toast.error(e.message) }
  }

  const katSil = async (k) => {
    if (!await onayla(`"${k.ad}" kategorisi silinecek.`, { title: 'Kategoriyi sil', confirmLabel: 'Kategoriyi sil' })) return
    try {
      await masrafKategoriSil(k.id)
      setKategoriler(p=>p.filter(x=>x.id!==k.id))
      toast.success('Kategori silindi.')
    } catch (e) { toast.error(e.message) }
  }

  const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

  return (
    <Page>
      <PageHeader title="Masraflar" subtitle={`${AYLAR[ay-1]} ${yil} · toplam ${para(ozet?.toplamTutar||0)}`}
        actions={<Button variant="primary" icon={Plus} onClick={()=>setModal('masraf')}>Masraf ekle</Button>}>
        <div className="vg-row">
          <Select size="sm" value={ay} onChange={e=>setAy(Number(e.target.value))} aria-label="Ay" style={{ width: 'auto' }}>
            {AYLAR.map((a,i)=><option key={i} value={i+1}>{a}</option>)}
          </Select>
          <Select size="sm" value={yil} onChange={e=>setYil(Number(e.target.value))} aria-label="Yıl" style={{ width: 'auto' }}>
            {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
          </Select>
          <Select size="sm" value={magazaFiltre} onChange={e=>setMagazaFiltre(e.target.value)} aria-label="Mağaza" style={{ width: 'auto' }}>
            <option value="">Tüm mağazalar</option>
            {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
          </Select>
        </div>
        <Tabs value={sekme} onChange={setSekme} items={[{ id: 'liste', label: 'Masraf listesi' }, { id: 'kategoriler', label: 'Kategoriler', count: 0 }]} />
      </PageHeader>

      {yukleniyor ? <LoadingRows /> : (
        <>
          {/* ─── LİSTE SEKMESİ ─── */}
          {sekme==='liste' && (
            <div className="vg-master-detail" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
              {masraflar.length === 0 ? (
                <div className="vg-card"><EmptyState icon={Wallet} title="Bu dönemde masraf kaydı yok" actions={<Button variant="primary" icon={Plus} onClick={()=>setModal('masraf')}>Masraf ekle</Button>} /></div>
              ) : (
                <div className="vg-table-wrap">
                  <div className="vg-table-scroll">
                    <table className="vg-table" style={{ minWidth: 820 }}>
                      <thead><tr>
                        <th>Tarih</th><th>Kategori</th><th>Mağaza</th><th>Kaynak</th><th>Açıklama</th><th>Fatura no</th><th className="is-num">Tutar</th><th></th>
                      </tr></thead>
                      <tbody>
                        {masraflar.map(m=>{
                          const KIc = KAYNAK_IKON[m.odemeKaynagi]
                          return (
                            <tr key={m.id}>
                              <td className="vg-nowrap vg-muted">{tarihTR(m.tarih)}</td>
                              <td>{m.kategori ? <Badge color={m.kategori.renk}>{m.kategori.ad}</Badge> : <span className="vg-muted">—</span>}</td>
                              <td>{m.magaza?.ad||<span className="vg-muted">Genel</span>}</td>
                              <td className="vg-nowrap">{KIc ? <span className="vg-row" style={{ gap: 6 }}><KIc className="vg-icon" style={{ width: 14, height: 14, color: 'var(--ink-muted)' }} />{KAYNAKLAR[m.odemeKaynagi]}</span> : '—'}</td>
                              <td style={{ maxWidth: 220 }}><div className="vg-truncate">{m.aciklama||'—'}</div></td>
                              <td className="vg-code vg-muted">{m.faturaNo||'—'}</td>
                              <td className="is-num is-strong">{para(m.tutar)}</td>
                              <td>
                                <div className="vg-row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                                  <IconButton icon={Pencil} label="Düzenle" size="sm" onClick={()=>setModal(m)} />
                                  <IconButton icon={Trash2} label="Sil" size="sm" variant="critical-plain" onClick={()=>sil(m)} />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Özet paneli */}
              <div className="vg-stack">
                <StatCard label="Aylık toplam masraf" value={para(ozet?.toplamTutar||0)} meta={`${ozet?.masrafSayisi||0} kayıt`} />

                {(ozet?.kategoriler||[]).length > 0 && (
                  <Card title="Kategori dağılımı">
                    <div className="vg-stack" style={{ gap: 12 }}>
                      {ozet.kategoriler.map(k=>{
                        const oran = ozet.toplamTutar > 0 ? (k.toplam/ozet.toplamTutar*100).toFixed(1) : 0
                        return (
                          <div key={k.ad}>
                            <div className="vg-row" style={{ justifyContent: 'space-between', marginBottom: 4, flexWrap: 'nowrap', fontSize: 13 }}>
                              <span className="vg-row" style={{ gap: 6, flexWrap: 'nowrap' }}><KategoriIkon ikon={k.ikon} style={{ width: 14, height: 14, color: k.renk }} />{k.ad}</span>
                              <span className="vg-num" style={{ fontWeight: 600 }}>{para(k.toplam)}</span>
                            </div>
                            <div className="vg-progress__track"><div className="vg-progress__bar" style={{ width:`${oran}%`, background:k.renk }}/></div>
                            <div className="vg-help" style={{ marginTop: 2 }}>%{String(oran).replace('.', ',')} · {k.sayi} kayıt</div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ─── KATEGORİLER SEKMESİ ─── */}
          {sekme==='kategoriler' && (
            <>
              <div className="vg-row" style={{ justifyContent: 'space-between' }}>
                <span className="vg-muted" style={{ fontSize: 13 }}>{kategoriler.length} kategori</span>
                <Button icon={Plus} onClick={()=>setKatModal('yeni')}>Kategori ekle</Button>
              </div>
              <div className="vg-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {kategoriler.map(k=>(
                  <div key={k.id} className="vg-card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width:40,height:40,borderRadius:10,background:alpha(k.renk || 'var(--accent)', 14),color:k.renk,display:'grid',placeItems:'center',flexShrink:0 }}>
                      <KategoriIkon ikon={k.ikon} className="vg-icon vg-icon--lg" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }} className="vg-truncate">{k.ad}</div>
                      <div className="vg-list__secondary">{k._count?.masraflar||0} kayıt</div>
                    </div>
                    <IconButton icon={Pencil} label="Düzenle" size="sm" onClick={()=>setKatModal(k)} />
                    <IconButton icon={Trash2} label="Sil" size="sm" variant="critical-plain" onClick={()=>katSil(k)} />
                  </div>
                ))}
                <button type="button" onClick={()=>setKatModal('yeni')} className="vg-card vg-card--interactive" style={{
                  border:'1px dashed var(--line-input)',boxShadow:'none',background:'transparent',minHeight:68,
                  display:'flex',alignItems:'center',justifyContent:'center',gap:8,color:'var(--ink-muted)',font:'inherit',cursor:'pointer'}}>
                  <Plus className="vg-icon" /> Yeni kategori
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Masraf Modal */}
      {modal && (
        <MasrafModal
          masraf={modal==='masraf'?null:modal}
          kategoriler={kategoriler}
          magazalar={magazalar}
          bankaHesaplar={bankaHesaplar}
          onKaydet={()=>{ setModal(null); yukle() }}
          onKapat={()=>setModal(null)}
        />
      )}

      {/* Kategori Modal */}
      {katModal && (
        <KategoriModal
          kategori={katModal==='yeni'?null:katModal}
          onKaydet={()=>{ setKatModal(null); yukle() }}
          onKapat={()=>setKatModal(null)}
        />
      )}
    </Page>
  )
}
