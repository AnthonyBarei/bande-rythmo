import React, { useState } from 'react'
import { Btn } from '../../ui'

// First-run coachmark on BR canvas — shows hidden gestures once, then never again.
export default function CanvasCoachmark() {
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem('br-coachmark-seen') } catch { return false }
  })
  if (!open) return null
  function dismiss() {
    try { localStorage.setItem('br-coachmark-seen', '1') } catch { /* storage unavailable — coachmark just reappears */ }
    setOpen(false)
  }
  return (
    <div style={{
      position: 'absolute', top: 10, left: 14, right: 14, zIndex: 5,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: 'var(--accent-soft)',
      border: '1px solid var(--accent-ring)',
      borderRadius: 6,
      fontSize: 11.5, color: 'var(--text)',
      pointerEvents: 'auto',
    }}>
      <span style={{ color: 'var(--accent)' }}>◎</span>
      <span>
        <strong>glisser</strong> pour créer · <strong>⇧ glisser</strong> pour boucler ·
        <strong> alt glisser</strong> pour dupliquer · <strong>clic lettre</strong> pour la détection ·
        <strong> ?</strong> pour tous les raccourcis
      </span>
      <div style={{ flex: 1 }} />
      <Btn size="sm" variant="outline" onClick={dismiss}>Compris</Btn>
    </div>
  )
}
