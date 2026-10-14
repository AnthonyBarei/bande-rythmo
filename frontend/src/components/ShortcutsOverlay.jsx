import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { T, Icon, ICONS, Btn, Kbd } from '../ui'

// Port of redesign shell.jsx ShortcutsOverlay — reference rows + the app's
// extra keys (⌫, R, /, E).
const GROUPS = [
  { title: 'Transport', rows: [
    { k: ['Espace', 'K'], l: 'Lecture / pause' }, { k: ['J'], l: 'Vitesse 0,5×' }, { k: ['L'], l: 'Vitesse 1,5×' },
    { k: ['M'], l: 'Mute' }, { k: ['←', '→'], l: '±1 s' }, { k: ['⇧←', '⇧→'], l: '±1 image' }, { k: [',', '.'], l: '±40 ms' },
  ]},
  { title: 'Bande rythmo', rows: [
    { k: ['I'], l: 'Marquer IN' }, { k: ['O'], l: 'Marquer OUT' }, { k: ['S'], l: 'Couper à la tête' },
    { k: ['Entrée'], l: 'Éditer la réplique' }, { k: ['⇧Entrée'], l: 'Nouvelle réplique' },
    { k: ['Suppr', '⌫'], l: 'Supprimer la réplique' }, { k: ['R'], l: 'Enregistrer / arrêter la prise' },
    { k: ['Échap'], l: 'Quitter loop / édition' },
  ]},
  { title: 'Canvas — gestes', rows: [
    { k: ['maintenir'], l: 'Déplacer le curseur' }, { k: ['glisser'], l: 'Créer une réplique' }, { k: ['⇧ glisser'], l: 'Région de boucle' },
    { k: ['alt glisser'], l: 'Dupliquer' }, { k: ['ctrl molette'], l: 'Zoom px/s' }, { k: ['clic lettre'], l: 'Signe de détection' },
    { k: ['double-clic'], l: 'Éditer le texte' }, { k: ['clic droit'], l: 'Menu contextuel' },
  ]},
  { title: 'Général', rows: [
    { k: ['Ctrl', 'Z'], l: 'Annuler' }, { k: ['Ctrl', 'Y'], l: 'Rétablir' }, { k: ['⌘', 'K'], l: 'Palette de commandes' },
    { k: ['/'], l: 'Palette de commandes' }, { k: ['Ctrl', 'S'], l: 'Sauvegarder' }, { k: ['E'], l: 'Exporter' },
    { k: ['?'], l: 'Cette aide' },
  ]},
]

export default function ShortcutsOverlay({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Raccourcis clavier" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(860px,92vw)', maxHeight: '88vh', overflow: 'auto', background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <Icon d={ICONS.keyboard} size={20} stroke={T.accent} />
          <span style={{ fontSize: T.fs.lg, fontWeight: 600 }}>Raccourcis clavier</span>
          <span style={{ fontSize: T.fs.xs, color: T.text3 }}>Échap pour fermer</span>
          <div style={{ flex: 1 }} />
          <Btn size="sm" variant="outline" onClick={onClose}>Fermer</Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 }}>
          {GROUPS.map(g => (
            <div key={g.title}>
              <div style={{ fontSize: 10.5, color: T.text3, letterSpacing: 1.2, fontWeight: 700, marginBottom: 9, textTransform: 'uppercase' }}>{g.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {g.rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl }}>
                    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{r.k.map((k, j) => <Kbd key={j}>{k}</Kbd>)}</span>
                    <span style={{ fontSize: T.fs.sm, color: T.text2, flex: 1, textAlign: 'right' }}>{r.l}</span>
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
