import { useState } from 'react'
import { posTerminalleriniGetir, posTerminaliKaydet, posTerminaliGuncelle, posTerminaliSil } from '../api'
import { BANKALAR, TAKSIT_SECENEKLERI } from './utils'
import { Page, PageHeader, Card, Button, IconButton, Field, Input, Select, Switch, Badge, Banner, Modal, EmptyState, Menu, onayla, toast } from '../ui'
import { Plus, Pencil, Trash2, Pause, Play, MoreHorizontal, CreditCard } from 'lucide-react'

export default function PosYonetim({ terminaller, setTerminaller, magazalar }) {
  const bos = {
    ad:'', banka:BANKALAR[0], terminalNo:'', magazaId:'',
    komisyonPesin:1.49, komisyon2:1.79, komisyon3:1.99,
    komisyon6:2.49, komisyon9:2.99, komisyon12:3.49, aktif:true
  }
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState(bos)
  const [kayit, setKayit] = useState(false)
  const [hata, setHata]   = useState('')

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const getKomisyon = (f, n) => {
    const map = {1:'komisyonPesin',2:'komisyon2',3:'komisyon3',6:'komisyon6',9:'komisyon9',12:'komisyon12'}
    return f[map[n]] ?? 0
  }
  const setKomisyon = (n,v) => {
    const map = {1:'komisyonPesin',2:'komisyon2',3:'komisyon3',6:'komisyon6',9:'komisyon9',12:'komisyon12'}
    set(map[n], Number(v))
  }

  const kaydet = async () => {
    if(!(form.ad||'').trim()||(!(form.terminalNo||form.terminalno||'').trim())) return setHata('Terminal adı ve terminal no zorunlu.')
    setHata(''); setKayit(true)
    try {
      // Sadece schema alanlarını gönder
      // eslint-disable-next-line no-unused-vars
      const { magaza, _count, ...temizForm } = form
      const gonderilecek = { ...temizForm, terminalNo: temizForm.terminalNo||temizForm.terminalno||'' }
      delete gonderilecek.terminalno
      if (form.id) await posTerminaliGuncelle(form.id, gonderilecek)
      else         await posTerminaliKaydet(gonderilecek)
      const guncel = await posTerminalleriniGetir({ hepsi: true })
      setTerminaller(guncel)
      toast.success(form.id ? 'Terminal güncellendi.' : 'Terminal eklendi.')
      setModal(null)
    } catch(err) { setHata('Kaydedilemedi: ' + err.message) }
    finally { setKayit(false) }
  }

  const sil = async (terminal) => {
    if(!await onayla(`${terminal.ad} terminali silinecek.`, { title: 'Terminali sil', confirmLabel: 'Terminali sil' })) return
    try {
      await posTerminaliSil(terminal.id)
      setTerminaller(p=>p.filter(x=>x.id!==terminal.id))
      toast.success('Terminal silindi.')
    } catch (e) { toast.error(e.message) }
  }

  const durumDegistir = async (terminal) => {
    try {
      await posTerminaliGuncelle(terminal.id,{...terminal,aktif:!terminal.aktif})
      const g=await posTerminalleriniGetir({ hepsi: true })
      setTerminaller(g)
      toast.success(terminal.aktif ? 'Terminal pasif yapıldı.' : 'Terminal aktif yapıldı.')
    } catch (e) { toast.error(e.message) }
  }

  const ac = (t) => { setHata(''); setForm(t ? {...t, terminalNo: t.terminalNo||''} : bos); setModal(t ? 'duzenle' : 'yeni') }

  return (
    <Page>
      <PageHeader title="POS terminalleri" subtitle={`${terminaller.filter(x=>x.aktif).length} aktif terminal`}
        actions={<Button variant="primary" icon={Plus} onClick={()=>ac(null)}>Terminal ekle</Button>} />

      {terminaller.length === 0 ? (
        <div className="vg-card"><EmptyState icon={CreditCard} title="Henüz POS terminali yok" text="Kartla ödemede komisyon hesabı için terminal ekleyin." actions={<Button variant="primary" icon={Plus} onClick={()=>ac(null)}>Terminal ekle</Button>} /></div>
      ) : (
        <div className="vg-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {terminaller.map(terminal=>(
            <Card key={terminal.id} style={{ opacity: terminal.aktif ? 1 : .6 }} bodyClassName="vg-stack">
              <div className="vg-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><CreditCard className="vg-icon" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }} className="vg-truncate">{terminal.ad}</div>
                  <div className="vg-list__secondary">{terminal.banka}{terminal.magaza?.ad ? ` · ${terminal.magaza.ad}` : ''}</div>
                  <div className="vg-code vg-muted" style={{ marginTop: 2 }}>{terminal.terminalNo||terminal.terminalno}</div>
                </div>
                <Badge tone={terminal.aktif ? 'success' : 'neutral'}>{terminal.aktif ? 'Aktif' : 'Pasif'}</Badge>
                <Menu trigger={({ toggle }) => <IconButton icon={MoreHorizontal} label="İşlemler" size="sm" onClick={toggle} />}
                  items={[
                    { text: 'Düzenle', icon: Pencil, onClick: () => ac(terminal) },
                    { text: terminal.aktif ? 'Pasif yap' : 'Aktif yap', icon: terminal.aktif ? Pause : Play, onClick: () => durumDegistir(terminal) },
                    '-',
                    { text: 'Sil', icon: Trash2, tone: 'critical', onClick: () => sil(terminal) },
                  ]} />
              </div>
              <div>
                <div className="vg-section-label" style={{ marginBottom: 6 }}>Komisyon oranları</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
                  {TAKSIT_SECENEKLERI.map(n=>(
                    <div key={n} className="vg-tile" style={{ padding: '6px 4px', textAlign: 'center' }}>
                      <div className="vg-tile__label" style={{ fontSize: 11 }}>{n===1?'Peşin':`${n} T`}</div>
                      <div className="vg-num" style={{ fontWeight: 600, fontSize: 13 }}>%{getKomisyon(terminal,n)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal&&(
        <Modal title={modal==='yeni'?'Yeni terminal':'Terminali düzenle'} onClose={()=>setModal(null)}
          footer={<>
            <Button variant="plain" onClick={()=>setModal(null)}>Vazgeç</Button>
            <Button variant="primary" onClick={kaydet} loading={kayit}>{kayit?'Kaydediliyor…':modal==='yeni'?'Terminal ekle':'Değişiklikleri kaydet'}</Button>
          </>}>
          <div className="vg-grid-2">
            <Field label="Terminal adı" htmlFor="pt-ad"><Input id="pt-ad" value={form.ad} onChange={e=>set('ad',e.target.value)} placeholder="İş Bankası Merkez" /></Field>
            <Field label="Terminal no" htmlFor="pt-no"><Input id="pt-no" mono value={form.terminalNo||''} onChange={e=>set('terminalNo',e.target.value)} placeholder="T-1234567" /></Field>
          </div>
          <div className="vg-grid-2">
            <Field label="Banka" htmlFor="pt-banka">
              <Select id="pt-banka" value={form.banka} onChange={e=>set('banka',e.target.value)}>
                {BANKALAR.map(b=><option key={b}>{b}</option>)}
              </Select>
            </Field>
            <Field label="Mağaza" htmlFor="pt-magaza">
              <Select id="pt-magaza" value={form.magazaId||''} onChange={e=>set('magazaId',e.target.value)}>
                <option value="">Seçin</option>
                {magazalar.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Komisyon oranları">
            <div className="vg-grid-3" style={{ gap: 8 }}>
              {TAKSIT_SECENEKLERI.map(n=>(
                <div key={n} className="vg-field">
                  <span className="vg-help">{n===1?'Peşin':`${n} taksit`}</span>
                  <div className="vg-input-group">
                    <Input type="number" step="0.01" min={0} max={10} className="vg-num" value={getKomisyon(form,n)} onChange={e=>setKomisyon(n,e.target.value)} aria-label={`${n===1?'Peşin':`${n} taksit`} komisyon oranı`} style={{ paddingRight: 26 }} />
                    <span className="vg-input-suffix">%</span>
                  </div>
                </div>
              ))}
            </div>
          </Field>
          <Switch checked={!!form.aktif} onChange={()=>set('aktif',!form.aktif)} label={form.aktif ? 'Terminal aktif' : 'Terminal pasif'} />
          {hata && <Banner tone="critical">{hata}</Banner>}
        </Modal>
      )}
    </Page>
  )
}
