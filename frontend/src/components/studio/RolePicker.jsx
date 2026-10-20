import React, { useEffect, useRef } from 'react'
import { T, Icon, ICONS, Avatar, Kbd, MenuLabel } from '../../ui'

// STUDIO_V2 §1 — the role to record: avatar · name · `d/n validées` ▾.
// The menu lists every character with its colour, progress and comédien;
// 1–9 pick a role, C opens the menu (keys handled by the Studio screen).
export default function RolePicker({ roles, role, open, onOpen, onPick, locked }) {
  const ref = useRef(null)
  const cur = roles.find(r => r.name === role) || roles[0]

  useEffect(() => {
    if (!open) return
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) onOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, onOpen])

  if (!cur) return null
  const complete = cur.total > 0 && cur.done === cur.total
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button data-rd onClick={() => !locked && onOpen(!open)} aria-haspopup="menu" aria-expanded={open}
        title={locked ? 'Terminer la prise pour changer de rôle' : 'Choisir le rôle (C)'}
        style={{
          height: 40, padding: '0 12px 0 6px', display: 'flex', alignItems: 'center', gap: 9,
          background: T.surface, border: `1px solid ${open ? cur.color : T.border2}`, borderRadius: T.r.ctl,
          cursor: locked ? 'default' : 'pointer', color: T.text, fontFamily: T.fontUI, opacity: locked ? 0.7 : 1,
        }}>
        <Avatar name={cur.label} color={cur.color} size={28} ring />
        <span style={{ fontSize: T.fs.sm, fontWeight: 700, color: cur.color, whiteSpace: 'nowrap' }}>{cur.label}</span>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: complete ? T.success : T.text3, whiteSpace: 'nowrap' }}>{cur.done}/{cur.total} validées</span>
        <Icon d={ICONS.chevron} size={13} stroke={T.text3} />
      </button>
      {open && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 'var(--z-dropdown)', width: 300,
          background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 6,
          animation: 'stIn .15s ease-out',
        }}>
          <MenuLabel>Rôle à enregistrer</MenuLabel>
          {roles.map((r, k) => {
            const on = r.name === cur.name
            return (
              <button data-rd key={r.name} role="menuitemradio" aria-checked={on} onClick={() => onPick(r.name)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: T.r.chip, border: 'none',
                background: on ? T.surface2 : 'transparent', cursor: 'pointer', textAlign: 'left', color: T.text, fontFamily: T.fontUI,
              }}>
                <Avatar name={r.label} color={r.color} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: T.fs.sm, fontWeight: 600, color: r.color }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.comedien || 'Comédien non renseigné'}</div>
                </div>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: r.total > 0 && r.done === r.total ? T.success : T.text2 }}>{r.done}/{r.total}</span>
                <span style={{ width: 13, display: 'flex' }}>{on && <Icon d={ICONS.check} size={13} stroke={T.accent} />}</span>
                {k < 9 ? <Kbd>{k + 1}</Kbd> : <span style={{ width: 18 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
