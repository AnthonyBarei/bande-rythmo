import React, { useState, useRef, useEffect, createContext, useContext } from 'react'
import { Icon, ICONS } from './Icons'

/* Design-system primitives — line-for-line port of
   design/design_handoff_redesign_v2/reference/redesign/foundation.jsx (RD.*).
   T.x reads the CSS variables of index.css so the accent stays swappable. */

export { Icon, ICONS }

export const T = {
  bg:        'var(--bg)',
  bg2:       'var(--bg2)',
  surface:   'var(--surface)',
  surface2:  'var(--surface2)',
  surface3:  'var(--surface3)',
  border:    'var(--border)',
  border2:   'var(--border2)',
  border3:   'var(--border3)',
  text:      'var(--text)',
  text2:     'var(--text2)',
  text3:     'var(--text3)',
  text4:     'var(--text4)',
  accent:    'var(--accent)',
  accentDim: 'var(--accent-dim)',
  danger:    'var(--danger)',
  success:   'var(--success)',
  info:      'var(--info)',
  violet:    'var(--violet)',
  tracks: [
    { name: 'LÉA',   hex: 'var(--track-1)' },
    { name: 'MARC',  hex: 'var(--track-2)' },
    { name: 'SARAH', hex: 'var(--track-3)' },
    { name: 'NOAH',  hex: 'var(--track-4)' },
  ],
  fontUI:   'var(--font-ui)',
  fontMono: 'var(--font-mono)',
  fs: { micro: 11, xs: 12, sm: 13, base: 14, md: 16, lg: 20, xl: 26, xxl: 34 },
  r: { chip: 6, ctl: 9, card: 14, lg: 18 },
  shadow:  'var(--shadow)',
  shadowL: 'var(--shadow-l)',
  glow: c => `0 0 0 1px ${alpha(c, '55')}, 0 0 24px ${alpha(c, '33')}`,
}

// `color + 'aa'` from the reference — exact for #rrggbb, color-mix for CSS vars.
export function alpha(color, aa) {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color + aa
  const pct = Math.round(parseInt(aa, 16) / 255 * 1000) / 10
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}

// ── Primitives ────────────────────────────────────────────
// Kbd chips inside a disabled Btn grey out with it.
const BtnDisabledCtx = createContext(false)

// Disabled (FIXES_R3 #15): readable, not faded — surface2 + border2 + text3,
// whatever the variant. Pass `title` to say why it is disabled.
export function Btn({ children, variant = 'ghost', size = 'md', icon, iconR, active, danger, onClick, title, style, full, disabled }) {
  const [hov, setH] = useState(false)
  const h = hov && !disabled
  const H = { sm: 30, md: 36, lg: 42 }[size]
  const pad = { sm: '0 12px', md: '0 15px', lg: '0 20px' }[size]
  const fz = { sm: T.fs.xs, md: T.fs.sm, lg: T.fs.base }[size]
  let bg = 'transparent', col = T.text2, bord = '1px solid transparent'
  let shadow = 'none'
  if (variant === 'primary') {
    bg = h ? 'var(--accent-hover)' : T.accent; col = '#0b0b0d'
    shadow = `inset 0 1px 0 rgba(255,255,255,.35), inset 0 -1px 0 rgba(0,0,0,.12), 0 ${h ? 8 : 4}px ${h ? 22 : 14}px -6px ${alpha(T.accent, h ? 'aa' : '77')}`
  }
  else if (variant === 'solid') { bg = h ? T.surface3 : T.surface2; col = T.text; bord = `1px solid ${T.border2}` }
  else if (variant === 'outline') { bg = h ? T.surface : 'transparent'; col = T.text; bord = `1px solid ${T.border2}` }
  else { bg = h ? T.surface2 : 'transparent'; col = active ? T.accent : T.text2 }
  if (active && variant === 'ghost') bg = T.accentDim
  if (danger) { col = T.danger; if (h) bg = 'rgba(232,89,93,.13)' }
  if (disabled) { bg = T.surface2; col = T.text3; bord = `1px solid ${T.border2}`; shadow = 'none' }
  // Disabled buttons swallow pointer events in Chromium, so their own title
  // never shows: carry the "why disabled" tooltip on a wrapper instead.
  const tipOnWrapper = disabled && title
  const button = (
    <button data-rd onClick={onClick} title={tipOnWrapper ? undefined : title} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: H, minWidth: H, padding: icon && !children ? 0 : pad, borderRadius: T.r.ctl,
        background: bg, color: col, border: bord, cursor: disabled ? 'not-allowed' : 'pointer', opacity: 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: fz, fontWeight: variant === 'primary' ? 600 : 500, fontFamily: T.fontUI,
        width: full ? '100%' : undefined, transition: 'background .14s, color .14s, box-shadow .14s, transform .14s', flexShrink: 0,
        boxShadow: shadow, transform: variant === 'primary' && h ? 'translateY(-1px)' : 'none', whiteSpace: 'nowrap',
        pointerEvents: tipOnWrapper ? 'none' : undefined,
        ...style,
      }}>
      <BtnDisabledCtx.Provider value={!!disabled}>
        {icon && <Icon d={icon} size={fz + 3} stroke={col} fill={icon === ICONS.rec ? col : undefined} />}
        {children}
        {iconR && <Icon d={iconR} size={fz + 2} stroke={col} />}
      </BtnDisabledCtx.Provider>
    </button>
  )
  if (!tipOnWrapper) return button
  return (
    <span title={title} style={{ display: full ? 'flex' : 'inline-flex', width: full ? '100%' : undefined, flexShrink: 0, cursor: 'not-allowed' }}>
      {button}
    </span>
  )
}

export function Chip({ children, color, soft, active, onClick, style }) {
  const c = color || T.accent
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px',
      borderRadius: 99, fontSize: T.fs.xs, fontWeight: 600, cursor: onClick ? 'pointer' : 'default',
      background: active ? c : (soft ? alpha(c, '1c') : T.surface2),
      color: active ? '#0b0b0d' : c,
      border: `1px solid ${active ? c : alpha(c, '33')}`, ...style,
    }}>{children}</span>
  )
}

export function Dot({ color = T.accent, size = 8, pulse }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
      {pulse && <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${color}`, opacity: .4 }} />}
    </span>
  )
}

export function Card({ children, pad = 16, style, hover, onClick }) {
  const [h, setH] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={() => hover && setH(true)} onMouseLeave={() => hover && setH(false)}
      style={{
        background: T.surface, border: `1px solid ${h ? T.border2 : T.border}`,
        borderRadius: T.r.card, padding: pad, transition: 'border-color .15s, transform .15s',
        transform: h ? 'translateY(-2px)' : 'none', cursor: onClick ? 'pointer' : 'default', ...style,
      }}>{children}</div>
  )
}

export function Avatar({ name, color = T.accent, size = 28, ring }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: alpha(color, '24'), border: `1.5px solid ${ring ? color : alpha(color, '99')}`,
      boxShadow: ring ? `0 0 0 2px ${alpha(color, '33')}` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color, fontFamily: T.fontMono,
    }}>{(name || '?')[0].toUpperCase()}</div>
  )
}

export function SectionLabel({ children, style }) {
  return <div style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.4, color: T.text3, ...style }}>{children}</div>
}

export function Kbd({ children }) {
  const off = useContext(BtnDisabledCtx)
  return <span style={{
    padding: '1px 6px', borderRadius: 5, background: off ? 'transparent' : T.surface2, border: `1px solid ${T.border2}`,
    fontFamily: T.fontMono, fontSize: 10.5, color: off ? T.text3 : T.text2, lineHeight: 1.6,
  }}>{children}</span>
}

export function Toggle({ on, onClick, color, title }) {
  const c = color || T.accent
  return (
    <div onClick={onClick} title={title} role="switch" aria-checked={!!on} style={{
      width: 38, height: 22, borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer',
      background: on ? c : T.surface3, border: `1px solid ${on ? c : T.border2}`, transition: 'background .15s',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: on ? '#0b0b0d' : T.text3,
        position: 'absolute', top: 1, left: on ? 17 : 1, transition: 'left .16s',
      }} />
    </div>
  )
}

export function Segmented({ options, value, onChange, size = 'md' }) {
  const H = size === 'sm' ? 28 : 34
  return (
    <div style={{ display: 'inline-flex', gap: 3, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, padding: 3 }}>
      {options.map(o => {
        const active = o.v === value
        return (
          <button data-rd key={o.v} onClick={() => onChange?.(o.v)} title={o.desc}
            style={{
              height: H - 6, padding: '0 12px', borderRadius: T.r.chip, border: 'none', cursor: 'pointer',
              background: active ? T.accent : 'transparent', color: active ? '#0b0b0d' : T.text2,
              fontSize: T.fs.xs, fontWeight: active ? 700 : 500, fontFamily: T.fontUI,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {o.icon && <Icon d={o.icon} size={13} stroke={active ? '#0b0b0d' : 'currentColor'} />}
            {o.l}
          </button>
        )
      })}
    </div>
  )
}

// ── Popover / Dropdown / Menu ─────────────────────────────
export function Popover({ trigger, children, align = 'left', width = 240, placement = 'bottom' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    document.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger(open, () => setOpen(o => !o))}
      {open && (
        <div style={{
          position: 'absolute', [placement === 'top' ? 'bottom' : 'top']: 'calc(100% + 6px)', [align]: 0, zIndex: 'var(--z-dropdown)', width,
          background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card,
          boxShadow: T.shadowL, padding: 6, maxHeight: '60vh', overflowY: 'auto',
        }}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ icon, children, onClick, active, danger, color, right, sub }) {
  const [h, setH] = useState(false)
  const c = danger ? T.danger : (active ? T.accent : (color || T.text))
  return (
    <button data-rd onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: T.r.ctl,
        background: h ? (danger ? 'rgba(232,89,93,.12)' : T.surface2) : 'transparent', border: 'none', cursor: 'pointer',
        color: c, textAlign: 'left', fontSize: T.fs.sm, fontFamily: T.fontUI,
      }}>
      {icon && (typeof icon === 'string' && icon.length <= 2 ? <span style={{ width: 16, textAlign: 'center', fontFamily: T.fontMono, fontWeight: 700 }}>{icon}</span> : <Icon d={icon} size={15} stroke={c} />)}
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}{sub && <span style={{ display: 'block', fontSize: 10, color: T.text3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}</span>
      {active && <Icon d={ICONS.check} size={14} stroke={T.accent} />}
      {right}
    </button>
  )
}

export function MenuLabel({ children }) {
  return <div style={{ padding: '6px 10px 4px', fontSize: 9.5, letterSpacing: 1.2, fontWeight: 700, color: T.text3, textTransform: 'uppercase' }}>{children}</div>
}

export function MenuSep() { return <div style={{ height: 1, background: T.border, margin: '5px 4px' }} /> }

// Native-feeling Select (opens a Popover menu)
export function Select({ value, options, onChange, width = 'auto', size = 'md', placeholder, placement, menuWidth }) {
  const H = { sm: 30, md: 36 }[size] || 36
  const cur = options.find(o => o.v === value)
  return (
    <Popover width={menuWidth ?? Math.max(220, typeof width === 'number' ? width : 200)} placement={placement}
      trigger={(open, toggle) => (
        <button data-rd onClick={toggle} title={cur ? cur.l : undefined} style={{
          height: H, padding: '0 10px 0 12px', borderRadius: T.r.ctl, cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 0, flexShrink: 0,
          background: T.surface, border: `1px solid ${open ? T.accent : T.border2}`, color: T.text,
          display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: T.fs.sm, fontFamily: T.fontUI,
          width: typeof width === 'number' ? width : 'auto', justifyContent: 'space-between',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: cur ? T.text : T.text3, overflow: 'hidden', minWidth: 0 }}>
            {cur?.dot && <Dot color={cur.dot} size={7} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{cur ? cur.l : (placeholder || 'Choisir…')}</span>
          </span>
          <Icon d={ICONS.chevron} size={13} stroke={T.text3} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
      )}>
      {close => options.map(o => (
        <MenuItem key={o.v} active={o.v === value} color={o.color} icon={o.dot ? undefined : o.icon}
          onClick={() => { onChange?.(o.v); close() }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>{o.dot && <Dot color={o.dot} size={7} />}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{o.l}</span></span>
        </MenuItem>
      ))}
    </Popover>
  )
}

// ── Splitter — draggable pane divider (row = horizontal line / vertical drag) ──
export function Splitter({ dir, onDrag, start, onReset, accent, title }) {
  const [h, setH] = useState(false)
  const [d, setD] = useState(false)
  const row = dir === 'row'
  const c = accent || T.accent
  const down = (e) => {
    e.preventDefault()
    const p0 = row ? e.clientY : e.clientX
    const s0 = start
    setD(true)
    document.body.style.cursor = row ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
    const mv = (ev) => onDrag((row ? ev.clientY : ev.clientX) - p0, s0)
    const up = () => {
      setD(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
  }
  const on = h || d
  return (
    <div onPointerDown={down} onDoubleClick={onReset} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} title={title}
      style={{ flexShrink: 0, position: 'relative', zIndex: 5, cursor: row ? 'row-resize' : 'col-resize', touchAction: 'none',
        ...(row ? { height: 7, margin: '-3px 0', width: '100%' } : { width: 7, margin: '0 -3px', alignSelf: 'stretch' }) }}>
      <div style={{ position: 'absolute', background: on ? c : T.border2, transition: 'background .12s',
        ...(row ? { left: 0, right: 0, top: 3, height: on ? 2 : 1 } : { top: 0, bottom: 0, left: 3, width: on ? 2 : 1 }) }} />
      <div style={{ position: 'absolute', borderRadius: 3, background: on ? c : T.border3, opacity: on ? 1 : 0.8, transition: 'background .12s',
        ...(row ? { left: '50%', top: 1, width: 36, height: 5, transform: 'translateX(-50%)' } : { top: '50%', left: 1, width: 5, height: 36, transform: 'translateY(-50%)' }) }} />
    </div>
  )
}

export function ProgressBar({ pct, color, h = 5 }) {
  const c = color || T.accent
  return (
    <div style={{ height: h, background: T.surface3, borderRadius: h, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: h, transition: 'width .3s' }} />
    </div>
  )
}

export const fmtTC = (sec, fps = 24) => {
  const f = Math.floor((sec % 1) * fps)
  const s = Math.floor(sec) % 60, m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600)
  const p = n => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`
}

export const fmt = sec => {
  const s = Math.floor(sec) % 60, m = Math.floor(sec / 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Shared screen header — reference screen-record-export.jsx ScreenHeader ──
export function ScreenHeader({ kicker, title, sub, right, pad = '26px 32px 16px' }) {
  return (
    <div style={{ padding: pad, flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 16 }}>
      <div>
        <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 600, marginBottom: 4 }}>{kicker}</div>
        <div style={{ fontSize: T.fs.xxl, fontWeight: 600, letterSpacing: -0.6 }}>{title}</div>
        {sub && <div style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, marginTop: 5 }}>{sub}</div>}
      </div>
      <div style={{ flex: 1 }} />
      {right}
    </div>
  )
}

// ── Save status — Dot + label, shared by editor header ──
const SAVE_STATUS = {
  saved:   { color: T.success, label: 'Sauvegardé' },
  saving:  { color: T.text2,   label: 'Sauvegarde…', pulse: true },
  unsaved: { color: T.accent,  label: 'Non sauvegardé' },
  error:   { color: T.danger,  label: 'Erreur' },
}

export function SaveStatus({ status, style }) {
  const st = SAVE_STATUS[status]
  if (!st) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: T.fs.micro, color: st.color, whiteSpace: 'nowrap', flexShrink: 0, ...style }}>
      <Dot color={st.color} size={7} pulse={st.pulse} />{st.label}
    </span>
  )
}
