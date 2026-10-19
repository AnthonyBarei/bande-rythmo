import React, { useState } from 'react'
import { Icon, ICONS, T, alpha } from '../ui'
import { friendlyError } from '../utils/jobErrors'

// FIXES_R5 §11: one French sentence for a failed job / request, the raw
// error behind "Détails" (mono, text3), optional "Réessayer" link.
// error: string | Error | { detail } — compact: no box, for toasts and rows
// that already carry the danger frame.
export default function JobError({ error, onRetry, compact = false }) {
  const [open, setOpen] = useState(false)
  const { text, detail } = friendlyError(error)

  const links = (onRetry || detail) && (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      {onRetry && <LinkBtn color={T.accent} weight={600} onClick={onRetry}>Réessayer</LinkBtn>}
      {detail && (
        <LinkBtn color={T.text3} onClick={() => setOpen(v => !v)} expanded={open}>
          Détails
          <Icon d={ICONS.chevron} size={11} stroke={T.text3} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .14s' }} />
        </LinkBtn>
      )}
    </span>
  )

  const detailBlock = open && detail && (
    <pre style={{
      margin: '6px 0 0', padding: '6px 8px', maxHeight: 120, overflow: 'auto',
      fontFamily: T.fontMono, fontSize: 10.5, lineHeight: 1.45, color: T.text3,
      background: alpha(T.text3, '0f'), borderRadius: T.r.chip,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>{detail}</pre>
  )

  if (compact) {
    return (
      <div role="alert" style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: T.fs.xs, color: T.danger, lineHeight: 1.4, flex: '1 1 160px', minWidth: 0 }}>{text}</span>
          {links}
        </div>
        {detailBlock}
      </div>
    )
  }

  return (
    <div role="alert" style={{
      background: alpha(T.danger, '14'), border: `1px solid ${alpha(T.danger, '44')}`,
      borderRadius: T.r.ctl, padding: '8px 10px', color: T.danger, fontSize: T.fs.xs,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Icon d={ICONS.warn} size={14} stroke={T.danger} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>{text}</span>
        {links}
      </div>
      {detailBlock}
    </div>
  )
}

function LinkBtn({ children, onClick, color, weight = 500, expanded }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color, fontSize: T.fs.xs, fontWeight: weight, fontFamily: T.fontUI,
        display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
        textDecoration: 'underline', textUnderlineOffset: 2, textDecorationColor: alpha(color, '66'),
      }}>{children}</button>
  )
}
