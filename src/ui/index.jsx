// ─── Vega Panel UI kiti ───────────────────────────────────────
// Tasarım sistemi bileşenlerinin React karşılıkları. Stiller: src/styles/*.css
import { forwardRef, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, CircleCheck, CircleX, TriangleAlert, Info, Loader2, Store as StoreIc, ShoppingBag as ShoppingBagIc, Globe as GlobeIc, Smartphone as SmartphoneIc, Building2 as Building2Ic, Building as BuildingIc, Warehouse as WarehouseIc, Target as TargetIc, Coins, House, Zap, Droplet, Users as UsersIc, Truck, Megaphone, Wrench, Package as PackageIc, Monitor, ClipboardList, Factory, Briefcase, Tag as TagIc } from 'lucide-react'

const cx = (...a) => a.filter(Boolean).join(' ')

// Dinamik renklere saydamlık verir (hex ya da var(--x) fark etmez)
export const alpha = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

// ─── Yerleşim ─────────────────────────────────────────────────
export function Page({ children, full, flush, className, style }) {
  return <div className={cx('vg-page', full && 'vg-page--full', flush && 'vg-page--flush', className)} style={style}>{children}</div>
}

export function PageHeader({ title, subtitle, breadcrumb, actions, children }) {
  return (
    <>
      <div className="vg-page-header">
        <div className="vg-page-header__text">
          {breadcrumb && <div className="vg-breadcrumb">{breadcrumb}</div>}
          <h1 className="vg-page-title">{title}</h1>
          {subtitle && <p className="vg-page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="vg-page-header__actions">{actions}</div>}
      </div>
      {children}
    </>
  )
}

export function Card({ title, subtitle, action, children, className, bodyClassName, padded = true, onClick, style, as: As = 'section' }) {
  return (
    <As className={cx('vg-card', onClick && 'vg-card--interactive', className)} onClick={onClick} style={style}>
      {(title || action) && (
        <div className="vg-card__header">
          <div style={{ minWidth: 0 }}>
            {title && <h3 className="vg-card__title">{title}</h3>}
            {subtitle && <div className="vg-list__secondary">{subtitle}</div>}
          </div>
          {action && <div className="vg-card__action">{action}</div>}
        </div>
      )}
      {padded ? <div className={cx('vg-card__body', bodyClassName)}>{children}</div> : children}
    </As>
  )
}

// ─── Eylemler ─────────────────────────────────────────────────
export const Button = forwardRef(function Button(
  { variant = 'secondary', size, icon: Icon, iconRight: IconRight, loading, block, active, className, children, type = 'button', disabled, ...rest }, ref
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading}
      className={cx('vg-btn', variant !== 'secondary' && `vg-btn--${variant}`, size && `vg-btn--${size}`, block && 'vg-btn--block', active && 'is-active', !children && 'vg-btn--icon', className)}
      {...rest}>
      {loading ? <Loader2 className="vg-icon vg-spin" /> : Icon && <Icon className="vg-icon" />}
      {children}
      {IconRight && <IconRight className="vg-icon" />}
    </button>
  )
})

export function IconButton({ icon, label, variant = 'plain', ...rest }) {
  return <Button variant={variant} icon={icon} aria-label={label} title={label} {...rest} />
}

export function Tabs({ items, value, onChange, className }) {
  return (
    <div className={cx('vg-tabs', className)} role="tablist">
      {items.filter(Boolean).map(it => (
        <button key={it.id} type="button" role="tab" className="vg-tab" aria-selected={value === it.id} onClick={() => onChange(it.id)}>
          {it.icon && <it.icon className="vg-icon" />}
          {it.label}
          {it.count > 0 && <span className="vg-count">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Segmented({ options, value, onChange, label, className }) {
  return (
    <div className={cx('vg-segmented', className)} role="group" aria-label={label}>
      {options.map(o => {
        const v = typeof o === 'object' ? o.value : o
        const l = typeof o === 'object' ? o.label : o
        return <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      })}
    </div>
  )
}

export function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [poz, setPoz] = useState(null)
  const ref = useRef(null)
  const menuRef = useRef(null)
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const hesapla = () => {
      const r = ref.current.getBoundingClientRect()
      const mh = menuRef.current?.offsetHeight || 0
      const asagiSigar = r.bottom + 6 + mh < window.innerHeight - 8
      setPoz({
        top: asagiSigar ? r.bottom + 6 : Math.max(8, r.top - 6 - mh),
        ...(align === 'left' ? { left: r.left } : { right: window.innerWidth - r.right }),
      })
    }
    hesapla()
    window.addEventListener('resize', hesapla)
    window.addEventListener('scroll', hesapla, true)
    return () => { window.removeEventListener('resize', hesapla); window.removeEventListener('scroll', hesapla, true) }
  }, [open, align])
  useEffect(() => {
    if (!open) return
    const kapat = e => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', kapat)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', kapat); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="vg-menu-wrap" ref={ref}>
      {trigger({ open, toggle: () => setOpen(o => !o) })}
      {open && createPortal(
        <div ref={menuRef} className="vg-menu" role="menu" style={{ position: 'fixed', top: poz?.top ?? -9999, left: poz?.left ?? 'auto', right: poz?.right ?? 'auto', zIndex: 2500 }}>
          {items.filter(Boolean).map((it, i) => it === '-' ? <div key={i} className="vg-menu__sep" /> :
            it.label && !it.onClick ? <div key={i} className="vg-menu__label">{it.label}</div> :
            <button key={i} type="button" role="menuitem" disabled={it.disabled} className={cx('vg-menu__item', it.tone === 'critical' && 'vg-menu__item--critical')}
              onClick={() => { setOpen(false); it.onClick() }}>
              {it.icon && <it.icon className="vg-icon" />}{it.text}
            </button>
          )}
        </div>, document.body)}
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────
export function Field({ label, help, error, htmlFor, children, className, style, action }) {
  return (
    <div className={cx('vg-field', className)} style={style}>
      {(label || action) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {label && <label className="vg-label" htmlFor={htmlFor}>{label}</label>}
          {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
        </div>
      )}
      {children}
      {error ? <span className="vg-error"><TriangleAlert className="vg-icon" style={{ width: 14, height: 14 }} />{error}</span>
        : help ? <span className="vg-help">{help}</span> : null}
    </div>
  )
}

export const Input = forwardRef(function Input({ className, size, mono, invalid, ...rest }, ref) {
  return <input ref={ref} className={cx('vg-input', size && `vg-input--${size}`, mono && 'vg-code', className)} aria-invalid={invalid || undefined} {...rest} />
})

export const Select = forwardRef(function Select({ className, size, children, ...rest }, ref) {
  return <select ref={ref} className={cx('vg-select', size && `vg-select--${size}`, className)} {...rest}>{children}</select>
})

export const Textarea = forwardRef(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx('vg-textarea', className)} {...rest} />
})

export const SearchInput = forwardRef(function SearchInput({ className, style, size, ...rest }, ref) {
  return (
    <div className={cx('vg-input-group', className)} style={style}>
      <Search className="vg-icon" />
      <input ref={ref} type="search" className={cx('vg-input', size && `vg-input--${size}`)} {...rest} />
    </div>
  )
})

export function Checkbox({ label, className, style, ...rest }) {
  return <label className={cx('vg-check', className)} style={style}><input type="checkbox" {...rest} />{label}</label>
}

export function Switch({ label, className, ...rest }) {
  return <label className={cx('vg-switch', className)}><input type="checkbox" role="switch" {...rest} />{label}</label>
}

// ─── Geri bildirim ────────────────────────────────────────────
export function Badge({ tone, children, dot = true, color, size, className, style, title }) {
  return (
    <span title={title} style={style} className={cx('vg-badge', tone && tone !== 'neutral' && `vg-badge--${tone}`, (!dot || color) && 'vg-badge--plain', size && `vg-badge--${size}`, className)}>
      {color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: 'none' }} />}
      {children}
    </span>
  )
}

const TON_IKON = { success: CircleCheck, critical: CircleX, warning: TriangleAlert, info: Info }

export function Banner({ tone = 'info', title, children, action, onClose, icon, className, style }) {
  const Ic = icon || TON_IKON[tone] || Info
  return (
    <div className={cx('vg-banner', tone !== 'info' && `vg-banner--${tone}`, className)} role={tone === 'critical' ? 'alert' : 'status'} style={style}>
      <Ic className="vg-icon" />
      <div className="vg-banner__body">{title && <strong>{title} </strong>}{children}</div>
      {(action || onClose) && (
        <div className="vg-banner__actions">
          {action}
          {onClose && <IconButton icon={X} label="Kapat" size="sm" onClick={onClose} />}
        </div>
      )}
    </div>
  )
}

export function EmptyState({ icon: Ic = Search, title, text, actions, tone, compact }) {
  return (
    <div className="vg-empty" style={compact ? { padding: '24px 16px' } : undefined}>
      <div className="vg-empty__icon" style={tone === 'success' ? { color: 'var(--success)', background: 'var(--success-soft)' } : undefined}><Ic className="vg-icon vg-icon--lg" /></div>
      {title && <div className="vg-empty__title">{title}</div>}
      {text && <div className="vg-empty__text">{text}</div>}
      {actions && <div className="vg-row" style={{ marginTop: 8, justifyContent: 'center' }}>{actions}</div>}
    </div>
  )
}

export function Skeleton({ h = 14, w = '100%', r, style }) {
  return <div className="vg-skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />
}

export function LoadingRows({ rows = 5, card = true }) {
  const inner = (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Skeleton h={32} w={32} r={6} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton h={12} w={`${60 - (i % 3) * 12}%`} />
            <Skeleton h={10} w={`${35 - (i % 2) * 10}%`} />
          </div>
          <Skeleton h={12} w={72} />
        </div>
      ))}
    </div>
  )
  return card ? <div className="vg-card">{inner}</div> : inner
}

export function Modal({ title, subtitle, onClose, children, footer, size, bodyStyle, headerExtra, closeOnOverlay = false }) {
  const ref = useRef(null)
  const overlayRef = useRef(null)
  useEffect(() => {
    // Esc yalnızca en üstteki pencereyi kapatır (iç içe modallar için)
    const esc = e => {
      if (e.key !== 'Escape' || !onClose) return
      const hepsi = document.querySelectorAll('.vg-overlay')
      if (hepsi[hepsi.length - 1] === overlayRef.current) onClose()
    }
    document.addEventListener('keydown', esc)
    const ilk = ref.current?.querySelector('input:not([type=hidden]):not([disabled]), select, textarea')
    if (ilk && !ref.current.contains(document.activeElement)) ilk.focus({ preventScroll: true })
    return () => document.removeEventListener('keydown', esc)
  }, [])
  return (
    <div ref={overlayRef} className="vg-overlay" onMouseDown={e => { if (closeOnOverlay && e.target === e.currentTarget && onClose) onClose() }}>
      <div ref={ref} className={cx('vg-modal', size && `vg-modal--${size}`)} role="dialog" aria-modal="true">
        {title !== undefined && (
          <div className="vg-modal__header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="vg-modal__title">{title}</h2>
              {subtitle && <div className="vg-modal__subtitle">{subtitle}</div>}
            </div>
            {headerExtra}
            {onClose && <IconButton icon={X} label="Kapat" size="sm" onClick={onClose} />}
          </div>
        )}
        <div className="vg-modal__body" style={bodyStyle}>{children}</div>
        {footer && <div className="vg-modal__footer">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Veri ─────────────────────────────────────────────────────
export function StatCard({ label, value, meta, onClick, icon: Ic, children }) {
  return (
    <div className={cx('vg-card vg-stat', onClick && 'vg-card--interactive')} onClick={onClick}
      role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter') onClick() } : undefined}>
      <div className="vg-stat__label">{Ic && <Ic className="vg-icon" />}{label}</div>
      <div className="vg-stat__value">{value}</div>
      {meta && <div className="vg-stat__meta">{meta}</div>}
      {children}
    </div>
  )
}

export function Progress({ name, figures, pct, state }) {
  const p = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className={cx('vg-progress', state && `vg-progress--${state}`)}>
      <div className="vg-progress__head">
        <span className="vg-progress__name vg-truncate">{name}</span>
        {figures && <span className="vg-progress__figures">{figures}</span>}
        <span className="vg-progress__pct">%{Math.round(pct || 0)}</span>
      </div>
      <div className="vg-progress__track"><div className="vg-progress__bar" style={{ width: `${p}%` }} /></div>
    </div>
  )
}

export function Tile({ label, value, tone, style, children }) {
  return (
    <div className="vg-tile" style={style}>
      <div className="vg-tile__label">{label}</div>
      <div className={cx('vg-tile__value', tone && `vg-text-${tone}`)}>{value}</div>
      {children}
    </div>
  )
}

export function Spark({ values, className = 'vg-stat__spark' }) {
  if (!values?.length) return null
  const max = Math.max(...values, 1)
  const n = values.length - 1 || 1
  const pts = values.map((v, i) => [(i / n) * 120, 26 - (v / max) * 22])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const son = pts[pts.length - 1]
  return (
    <svg className={className} viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
      <path className="area" d={`${d} L120 28 L0 28Z`} />
      <path className="line" d={d} vectorEffect="non-scaling-stroke" />
      <circle className="end" cx={Math.min(son[0], 118)} cy={son[1]} r="2.5" />
    </svg>
  )
}

// ─── Toast ve onay (alert / confirm / prompt yerine) ──────────
let durum = { toasts: [], dialog: null }
const dinleyiciler = new Set()
const yay = () => dinleyiciler.forEach(f => f())
const guncelle = fn => { durum = fn(durum); yay() }
let sayac = 0

export function toast(mesaj, tone = 'info', sure) {
  const id = ++sayac
  const metin = typeof mesaj === 'string' ? mesaj : mesaj?.message || String(mesaj)
  guncelle(d => ({ ...d, toasts: [...d.toasts, { id, metin, tone }] }))
  setTimeout(() => guncelle(d => ({ ...d, toasts: d.toasts.filter(t => t.id !== id) })), sure || (tone === 'critical' ? 7000 : 4000))
  return id
}
toast.success = (m, s) => toast(m, 'success', s)
toast.error = (m, s) => toast(m, 'critical', s)
toast.warning = (m, s) => toast(m, 'warning', s)
toast.info = (m, s) => toast(m, 'info', s)

// alert() yerine: metne göre tonu tahmin eder
export function bildir(mesaj) {
  const m = String(mesaj ?? '')
  if (/✓|✅|başarı|kaydedildi|gönderildi|güncellendi|eklendi|silindi|tamamlandı|oluşturuldu|yazdırıldı|aktarıldı/i.test(m) && !/hata|başarısız|❌/i.test(m)) return toast(m.replace(/^[✓✅]\s*/, ''), 'success')
  if (/hata|başarısız|❌|olamaz|geçersiz|bulunamadı|yetersiz|error|failed/i.test(m)) return toast(m.replace(/^❌\s*/, ''), 'critical')
  if (/⚠|uyarı|dikkat|zorunlu|lütfen|seçin|girin/i.test(m)) return toast(m.replace(/^⚠️?\s*/, ''), 'warning')
  return toast(m, 'info')
}

// confirm() yerine: await onayla('...') → true/false
export function onayla(mesaj, secenek = {}) {
  return new Promise(resolve => {
    const kapat = sonuc => { guncelle(d => ({ ...d, dialog: null })); resolve(sonuc) }
    const yikici = secenek.tone ? secenek.tone === 'critical' : /sil|iptal|kaldır|sıfırla|geri alınamaz/i.test(mesaj + (secenek.title || ''))
    guncelle(d => ({ ...d, dialog: { tip: 'onay', mesaj, yikici, ...secenek, kapat } }))
  })
}

// prompt() yerine: await sor('...', 'varsayılan') → string | null
export function sor(mesaj, varsayilan = '', secenek = {}) {
  return new Promise(resolve => {
    const kapat = sonuc => { guncelle(d => ({ ...d, dialog: null })); resolve(sonuc) }
    guncelle(d => ({ ...d, dialog: { tip: 'sor', mesaj, varsayilan: varsayilan ?? '', ...secenek, kapat } }))
  })
}

function SorDialog({ d }) {
  const [deger, setDeger] = useState(String(d.varsayilan))
  return (
    <Modal title={d.title || 'Bilgi girin'} onClose={() => d.kapat(null)}
      footer={<><Button variant="plain" onClick={() => d.kapat(null)}>Vazgeç</Button><Button variant="primary" onClick={() => d.kapat(deger)}>{d.confirmLabel || 'Tamam'}</Button></>}>
      <Field label={d.mesaj}>
        <Input value={deger} onChange={e => setDeger(e.target.value)} type={d.type || 'text'} onKeyDown={e => { if (e.key === 'Enter') d.kapat(deger) }} />
      </Field>
    </Modal>
  )
}

export function UIHost() {
  const s = useSyncExternalStore(f => { dinleyiciler.add(f); return () => dinleyiciler.delete(f) }, () => durum)
  const d = s.dialog
  return (
    <>
      <div className="vg-toasts" aria-live="polite">
        {s.toasts.map(t => {
          const Ic = TON_IKON[t.tone] || Info
          return (
            <div key={t.id} className={`vg-toast vg-toast--${t.tone}`}>
              <Ic className="vg-icon" />
              <div className="vg-toast__body">{t.metin}</div>
              <button className="vg-toast__close" aria-label="Kapat" onClick={() => guncelle(x => ({ ...x, toasts: x.toasts.filter(y => y.id !== t.id) }))}><X className="vg-icon" /></button>
            </div>
          )
        })}
      </div>
      {d?.tip === 'onay' && (
        <Modal title={d.title || (d.yikici ? 'Emin misiniz?' : 'Onaylayın')} onClose={() => d.kapat(false)}
          footer={<>
            <Button variant="plain" onClick={() => d.kapat(false)} autoFocus={d.yikici}>{d.cancelLabel || 'Vazgeç'}</Button>
            <Button variant={d.yikici ? 'critical' : 'primary'} onClick={() => d.kapat(true)} autoFocus={!d.yikici}>{d.confirmLabel || (d.yikici ? 'Evet, devam et' : 'Onayla')}</Button>
          </>}>
          <p style={{ whiteSpace: 'pre-line', fontSize: 14, lineHeight: '20px' }}>{d.mesaj}</p>
        </Modal>
      )}
      {d?.tip === 'sor' && <SorDialog key={d.mesaj} d={d} />}
    </>
  )
}

// ─── Mağaza / kanal ikonu ─────────────────────────────────────
// Veritabanında eski kayıtlar emoji, yeniler anahtar olarak tutulur; ikisi de eşlenir.
export const MAGAZA_IKONLARI = {
  magaza: StoreIc, canta: ShoppingBagIc, web: GlobeIc, telefon: SmartphoneIc,
  avm: Building2Ic, ofis: BuildingIc, depo: WarehouseIc, hedef: TargetIc, instagram: SmartphoneIc,
}
const EMOJI_ESLEME = { '🏪': 'magaza', '🛍': 'canta', '🛍️': 'canta', '🌐': 'web', '📱': 'telefon', '🏬': 'avm', '🏢': 'ofis', '🏭': 'depo', '🎯': 'hedef' }
export function MagazaIkon({ ikon, className = 'vg-icon', style }) {
  const Ic = MAGAZA_IKONLARI[ikon] || MAGAZA_IKONLARI[EMOJI_ESLEME[ikon]] || StoreIc
  return <Ic className={className} style={style} />
}

// ─── Masraf / cari kategori ikonu ─────────────────────────────
export const KATEGORI_IKONLARI = {
  para: Coins, kira: House, elektrik: Zap, su: Droplet, personel: UsersIc, kargo: Truck, reklam: Megaphone,
  bakim: Wrench, malzeme: PackageIc, teknoloji: Monitor, idari: ClipboardList, uretim: Factory,
  hedef: TargetIc, is: Briefcase, web: GlobeIc, telefon: SmartphoneIc,
}
const KATEGORI_EMOJI = { '💰': 'para', '🏠': 'kira', '⚡': 'elektrik', '💧': 'su', '👥': 'personel', '🚚': 'kargo', '📢': 'reklam', '🔧': 'bakim', '📦': 'malzeme', '🖥': 'teknoloji', '🖥️': 'teknoloji', '📋': 'idari', '🏭': 'uretim', '🎯': 'hedef', '💼': 'is', '🌐': 'web', '📱': 'telefon' }
export function KategoriIkon({ ikon, className = 'vg-icon', style }) {
  const Ic = KATEGORI_IKONLARI[ikon] || KATEGORI_IKONLARI[KATEGORI_EMOJI[ikon]] || TagIc
  return <Ic className={className} style={style} />
}

// ─── Çubuk grafik (ölçekli, ızgaralı) ─────────────────────────
// veri: [{ key, label, value, current, title }]
export function BarChart({ veri, height = 180, format = v => v.toLocaleString('tr-TR'), minBarWidth }) {
  const max = Math.max(...veri.map(g => g.value), 1)
  const us = Math.pow(10, Math.floor(Math.log10(max)))
  const tavan = [1, 2, 2.5, 5, 10].map(k => k * us).find(v => v >= max) || max
  const cizgiler = [1, 0.5, 0]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height, paddingBottom: 18 }}>
        {cizgiler.map(o => <span key={o} className="vg-bars__label" style={{ textAlign: 'right', transform: 'translateY(-6px)' }}>{format(tavan * o)}</span>)}
      </div>
      <div style={{ overflowX: minBarWidth ? 'auto' : 'visible' }}>
        <div style={{ position: 'relative', height, minWidth: minBarWidth ? veri.length * minBarWidth : undefined }}>
          {cizgiler.map(o => (
            <div key={o} style={{ position: 'absolute', left: 0, right: 0, top: `calc(${(1 - o) * 100}% - ${(1 - o) * 18}px)`, borderTop: `1px ${o === 0 ? 'solid' : 'dashed'} var(--line)` }} />
          ))}
          <div className="vg-bars" style={{ position: 'absolute', inset: 0 }}>
            {veri.map(g => (
              <div key={g.key} className="vg-bars__col" title={g.title}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div className={`vg-bars__bar${g.current ? ' is-current' : ''}`} style={{ height: `${(g.value / tavan) * 100}%` }} />
                </div>
                <span className={`vg-bars__label${g.current ? ' is-current' : ''}`}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
