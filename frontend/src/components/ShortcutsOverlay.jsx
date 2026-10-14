import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Btn, Kbd, SectionLabel, ICONS } from '../ui'

// PRO_BR_HANDOFF §7 + DubbingWorkspace keymap, condensed.
const GROUPS = [
  {
    title: 'Transport',
    rows: [
      { keys: ['Espace', 'K'],           label: 'Lecture / pause' },
      { keys: ['J'],                     label: 'Vitesse 0,5×' },
      { keys: ['L'],                     label: 'Vitesse 1,5×' },
      { keys: ['M'],                     label: 'Mute' },
      { keys: ['←', '→'],                label: '±1 s' },
      { keys: ['⇧←', '⇧→'],              label: '±1 image (fps clip)' },
      { keys: [',', '.'],                label: '±40 ms (~1 image 25 fps)' },
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
      { keys: ['R'],                     label: 'Enregistrer / arrêter la prise' },
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
      { keys: ['Ctrl', 'Z'],             label: 'Annuler' },
      { keys: ['Ctrl', 'Y'],             label: 'Rétablir' },
      { keys: ['⌘', 'K'],                label: 'Palette de commandes' },
      { keys: ['/'],                     label: 'Palette de commandes' },
      { keys: ['Ctrl', 'S'],             label: 'Sauvegarder (auto-save 1,5 s)' },
      { keys: ['E'],                     label: 'Exporter' },
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
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 'var(--z-modal)',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: 14,
          padding: 24,
          width: 'min(860px, 92vw)',
          maxHeight: '88vh', overflow: 'auto',
          boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
        }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1.4, fontWeight: 600, marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
              AIDE · ÉCHAP POUR FERMER
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Raccourcis clavier</h2>
          </div>
          <div style={{ flex: 1 }} />
          <Btn size="sm" icon={ICONS.close} onClick={onClose} title="Fermer" />
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px 28px',
        }}>
          {GROUPS.map(g => (
            <div key={g.title}>
              <SectionLabel style={{ textTransform: 'uppercase', marginBottom: 6 }}>{g.title}</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {g.rows.map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
                    borderTop: i ? '1px solid var(--border)' : 'none',
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
