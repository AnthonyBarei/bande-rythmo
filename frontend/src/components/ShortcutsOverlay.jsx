import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

const Kbd = ({ children }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 22, padding: '1px 6px',
    background: 'var(--surface3)', border: '1px solid var(--border2)',
    borderBottom: '2px solid var(--border2)', borderRadius: 4,
    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
    color: 'var(--text)', lineHeight: '18px',
  }}>{children}</span>
)

// PRO_BR_HANDOFF §7 + DubbingWorkspace keymap, condensed.
const GROUPS = [
  {
    title: 'Transport',
    rows: [
      { keys: ['Espace', 'K'],           label: 'Lecture / pause' },
      { keys: ['J'],                     label: 'Vitesse 0,5×' },
      { keys: ['L'],                     label: 'Vitesse 1,5×' },
      { keys: ['M'],                     label: 'Mute' },
      { keys: ['←', '→'],                label: '±5 s' },
      { keys: ['⇧←', '⇧→'],              label: '±1 s' },
      { keys: [',', '.'],                label: '±1 frame (24 fps)' },
    ],
  },
  {
    title: 'Bande rythmo',
    rows: [
      { keys: ['I'],                     label: 'Marquer IN' },
      { keys: ['O'],                     label: 'Marquer OUT' },
      { keys: ['S'],                     label: 'Couper à la tête' },
      { keys: ['Entrée'],                label: 'Éditer la réplique active' },
      { keys: ['⇧Entrée'],               label: 'Nouvelle réplique' },
      { keys: ['Suppr', '⌫'],            label: 'Supprimer la réplique active' },
      { keys: ['Échap'],                 label: 'Quitter loop / édition' },
    ],
  },
  {
    title: 'Canvas (gestes cachés)',
    rows: [
      { keys: ['glisser'],               label: 'Créer une réplique' },
      { keys: ['⇧ glisser'],             label: 'Définir une région de boucle' },
      { keys: ['alt glisser'],           label: 'Dupliquer une réplique' },
      { keys: ['ctrl molette'],          label: 'Zoom pixels/seconde' },
      { keys: ['clic lettre'],           label: 'Cycle signe de détection' },
      { keys: ['double-clic'],           label: 'Éditer le texte' },
      { keys: ['clic droit'],            label: 'Menu contextuel' },
    ],
  },
  {
    title: 'Général',
    rows: [
      { keys: ['Ctrl', 'S'],             label: 'Sauvegarder (auto-save 1,5 s)' },
      { keys: ['?'],                     label: 'Cette aide' },
    ],
  },
]

export default function ShortcutsOverlay({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Raccourcis clavier"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border2)',
          borderRadius: 8,
          padding: '20px 24px',
          width: 'min(820px, 92vw)',
          maxHeight: '88vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, color: 'var(--text)' }}>Raccourcis clavier</h2>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Échap pour fermer</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid var(--border2)',
              color: 'var(--text2)', borderRadius: 4, padding: '4px 10px',
              fontSize: 12, cursor: 'pointer',
            }}>Fermer</button>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 18,
        }}>
          {GROUPS.map(g => (
            <div key={g.title}>
              <div style={{
                fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase',
                letterSpacing: 1, fontFamily: 'var(--font-mono)', marginBottom: 8,
              }}>{g.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.rows.map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 8px', background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 6,
                  }}>
                    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {row.keys.map((k, j) => <Kbd key={j}>{k}</Kbd>)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1, textAlign: 'right' }}>
                      {row.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
