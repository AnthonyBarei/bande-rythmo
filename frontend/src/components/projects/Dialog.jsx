import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { T, Btn, ICONS } from '../../ui'

// Modal card — same overlay as the command palette. Esc / backdrop close;
// Enter in a text field submits (not a <form>: Btn / Select have no type).
export default function Dialog({ title, sub, onClose, onSubmit, children, footer, width = 440 }) {
  const cardRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); closeRef.current() } }
    window.addEventListener('keydown', onKey)
    cardRef.current?.querySelector('input')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}>
      <div ref={cardRef} role="dialog" aria-modal="true" aria-label={title}
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); onSubmit?.() } }}
        style={{ width, maxWidth: 'calc(100vw - 32px)', background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: T.fs.md, fontWeight: 600 }}>{title}</div>
            {sub && <div style={{ fontSize: T.fs.xs, color: T.text3, marginTop: 4, lineHeight: 1.5 }}>{sub}</div>}
          </div>
          <Btn size="sm" icon={ICONS.close} title="Fermer (Échap)" onClick={onClose} />
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: `1px solid ${T.border}`, background: T.bg2 }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2 }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11.5, color: T.text3 }}>{hint}</span>}
    </div>
  )
}
