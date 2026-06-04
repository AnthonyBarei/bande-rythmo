import React, { useState, useRef, useEffect } from 'react'
import { Icon, ICONS } from './Icons'

/* Design-system primitives — port of the redesign `foundation.jsx` (RD.*),
   built on the app's CSS variables. Reusable across screens. */

export { Icon, ICONS }

const V = n => `var(--${n})`

// ── Button — sm30 / md36 / lg42, variants ghost/primary/solid/outline ──
export function Btn({ children, variant = 'ghost', size = 'md', icon, iconR, active, danger, onClick, title, style, full, disabled }) {
  const [h, setH] = useState(false)
  const H = { sm: 30, md: 36, lg: 42 }[size]
  const pad = { sm: '0 12px', md: '0 15px', lg: '0 20px' }[size]
  const fz = { sm: 12, md: 13, lg: 14 }[size]
  let bg = 'transparent', col = V('text2'), bord = '1px solid transparent'
  if (variant === 'primary') { bg = h ? '#ffd83a' : V('accent'); col = '#0b0b0d' }
  else if (variant === 'solid') { bg = h ? V('surface3') : V('surface2'); col = V('text'); bord = `1px solid ${V('border2')}` }
  else if (variant === 'outline') { bg = h ? V('surface') : 'transparent'; col = V('text'); bord = `1px solid ${V('border2')}` }
  else { bg = h ? V('surface2') : 'transparent'; col = active ? V('accent') : V('text2') }
  if (active && variant === 'ghost') bg = V('accent-soft')
  if (danger) { col = V('danger'); if (h) bg = 'var(--danger-soft)' }
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: H, minWidth: H, padding: icon && !children ? 0 : pad, borderRadius: 9,
        background: bg, color: col, border: bord, cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: fz, fontWeight: variant === 'primary' ? 600 : 500, fontFamily: V('font-ui'),
        width: full ? '100%' : undefined, opacity: disabled ? 0.5 : 1,
        transition: 'background .14s, color .14s', flexShrink: 0, ...style,
      }}>
      {icon && <Icon d={icon} size={fz + 3} stroke={col} fill={icon === ICONS.rec ? col : undefined} />}
      {children}
      {iconR && <Icon d={iconR} size={fz + 2} stroke={col} />}
    </button>
  )
}

export function Chip({ children, color, soft, active, onClick, style }) {
  const c = color || V('accent')
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px',
      borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: onClick ? 'pointer' : 'default',
      background: active ? c : (soft ? c + '1c' : V('surface2')),
      color: active ? '#0b0b0d' : c, border: `1px solid ${active ? c : (typeof c === 'string' && c.startsWith('#') ? c + '33' : 'var(--border)')}`,
      ...style,
    }}>{children}</span>
  )
}

export function Dot({ color, size = 8, pulse }) {
  const c = color || V('accent')
  return (
    <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: c }} />
      {pulse && <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${c}`, opacity: .4 }} />}
    </span>
  )
}

export function Avatar({ name, color, size = 28, ring }) {
  const c = color || V('accent')
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: c + '24', border: `1.5px solid ${c}${ring ? '' : '99'}`,
      boxShadow: ring ? `0 0 0 2px ${c}33` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color: c, fontFamily: V('font-mono'),
    }}>{(name || '?')[0].toUpperCase()}</div>
  )
}

export function SectionLabel({ children, style }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: V('text3'), ...style }}>{children}</div>
}

export function Kbd({ children }) {
  return <span style={{
    padding: '1px 6px', borderRadius: 5, background: V('surface2'), border: `1px solid ${V('border2')}`,
    fontFamily: V('font-mono'), fontSize: 10.5, color: V('text2'), lineHeight: 1.6,
  }}>{children}</span>
}

export function Toggle({ on, onClick, color }) {
  const c = color || V('accent')
  return (
    <div onClick={onClick} style={{
      width: 38, height: 22, borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer',
      background: on ? c : V('surface3'), border: `1px solid ${on ? c : V('border2')}`, transition: 'background .15s',
    }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: on ? '#0b0b0d' : V('text3'), position: 'absolute', top: 1, left: on ? 17 : 1, transition: 'left .16s' }} />
    </div>
  )
}

export function Segmented({ options, value, onChange, size = 'md' }) {
  const H = size === 'sm' ? 28 : 34
  return (
    <div style={{ display: 'inline-flex', gap: 3, background: V('surface'), border: `1px solid ${V('border')}`, borderRadius: 9, padding: 3 }}>
      {options.map(o => {
        const active = o.v === value
        return (
          <button key={o.v} onClick={() => onChange?.(o.v)} title={o.desc}
            style={{
              height: H - 6, padding: '0 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: active ? V('accent') : 'transparent', color: active ? '#0b0b0d' : V('text2'),
              fontSize: 12, fontWeight: active ? 700 : 500, fontFamily: V('font-ui'),
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

export function ProgressBar({ pct, color, h = 5 }) {
  const c = color || V('accent')
  return (
    <div style={{ height: h, background: V('surface3'), borderRadius: h, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: h, transition: 'width .3s' }} />
    </div>
  )
}

// ── Popover + Select ──
export function Popover({ trigger, children, align = 'left', width = 240 }) {
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
          position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 'var(--z-dropdown)', width,
          background: V('surface'), border: `1px solid ${V('border2')}`, borderRadius: 12,
          boxShadow: '0 18px 60px rgba(0,0,0,.55)', padding: 6, overflow: 'hidden',
        }}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ icon, children, onClick, active, danger, color }) {
  const [h, setH] = useState(false)
  const c = danger ? V('danger') : (active ? V('accent') : (color || V('text')))
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 9,
        background: h ? (danger ? 'var(--danger-soft)' : V('surface2')) : 'transparent', border: 'none', cursor: 'pointer',
        color: c, textAlign: 'left', fontSize: 13, fontFamily: V('font-ui'), minHeight: 34,
      }}>
      {icon && <Icon d={icon} size={15} stroke={c} />}
      <span style={{ flex: 1 }}>{children}</span>
      {active && <Icon d={ICONS.check} size={14} stroke={V('accent')} />}
    </button>
  )
}

export function Select({ value, options, onChange, width = 'auto', size = 'md', placeholder }) {
  const H = { sm: 30, md: 36 }[size] || 36
  const cur = options.find(o => o.v === value)
  return (
    <Popover width={typeof width === 'number' ? width : 200}
      trigger={(open, toggle) => (
        <button onClick={toggle} style={{
          height: H, padding: '0 11px', borderRadius: 9, cursor: 'pointer',
          background: V('surface'), border: `1px solid ${open ? V('accent') : V('border2')}`, color: V('text'),
          display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 13, fontFamily: V('font-ui'),
          width: typeof width === 'number' ? width : 'auto', justifyContent: 'space-between',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: cur ? V('text') : V('text3'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cur?.dot && <Dot color={cur.dot} size={7} />}{cur ? cur.l : (placeholder || 'Choisir…')}
          </span>
          <Icon d={ICONS.chevron} size={13} stroke={V('text3')} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
        </button>
      )}>
      {close => options.map(o => (
        <MenuItem key={o.v} active={o.v === value} color={o.color} icon={o.dot ? undefined : o.icon}
          onClick={() => { onChange?.(o.v); close() }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{o.dot && <Dot color={o.dot} size={7} />}{o.l}</span>
        </MenuItem>
      ))}
    </Popover>
  )
}

// ── Shared screen header (kicker · title · sub · right) ──
export function ScreenHeader({ kicker, title, sub, right, pad = '24px 32px 0' }) {
  return (
    <div style={{ padding: pad, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div>
          {kicker && <div style={{ fontSize: 11, color: V('text3'), letterSpacing: 1.4, fontWeight: 600, marginBottom: 4, fontFamily: V('font-mono') }}>{kicker}</div>}
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5, color: V('text') }}>{title}</div>
        </div>
        {sub && <span style={{ fontSize: 13, color: V('text3'), fontFamily: V('font-mono'), paddingBottom: 7 }}>{sub}</span>}
        <div style={{ flex: 1 }} />
        {right}
      </div>
    </div>
  )
}
