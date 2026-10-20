import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { T, Icon, ICONS, Btn, Kbd } from '../ui'

// Port of redesign shell.jsx ShortcutsOverlay — reference rows + the app's
// extra keys (⌫, R, /, E) and the Studio group (FIXES_R7 Phase 2).
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
  { title: 'Studio', rows: [
    { k: ['1–9'], l: 'Rôle' },
    { k: ['C'], l: 'Choisir le rôle' },
    { k: ['R'], l: 'Lancer / refaire' },
    { k: ['Espace'], l: 'Pause (continu) / attendre (auto)' },
    { k: ['Entrée'], l: 'Valider la prise' },
    { k: ['Échap'], l: 'Annuler / arrêter' },
    { k: ['←', '→'], l: 'Réplique du rôle (Alt : toutes)' },
    { k: ['Tab'], l: 'Basculer A/B' },
  ]},
  { title: 'Canvas — gestes', rows: [
    { k: ['maintenir'], l: 'Déplacer le curseur' }, { k: ['glisser'], l: 'Créer une réplique' }, { k: ['⇧ glisser'], l: 'Région de boucle' },
    { k: ['alt glisser'], l: 'Dupliquer' }, { k: ['ctrl molette'], l: 'Zoom px/s' }, { k: ['clic lettre'], l: 'Signe de détection' },
    { k: ['double-clic'], l: 'Éditer le texte' }, { k: ['clic droit'], l: 'Menu contextuel' },
  ]},
  { title: 'Général', rows: [
    { k: ['Ctrl', 'Z'], l: 'Annuler' }, { k: ['Ctrl', 'Y'], l: 'Rétablir' }, { k: ['⌘', 'K'], l: 'Palette de commandes' },
    { k: ['/'], l: 'Rechercher (ou palette)' }, { k: ['Ctrl', 'S'], l: 'Sauvegarder' }, { k: ['E'], l: 'Exporter' },
    { k: ['\\'], l: 'Afficher / masquer le panneau' }, { k: ['N'], l: 'Nouveau clip (importer une vidéo)' },
    { k: ['?'], l: 'Cette aide' },
  ]},
]

// FIXES_R8 #1: three columns from 1280px — the whole list fits at 1440×900.
// Below, the auto-fit grid scrolls inside the panel with a bottom fade.
const WIDE_QUERY = '(min-width: 1280px)'
const WIDE_COLUMNS = [['Transport', 'Studio'], ['Bande rythmo', 'Canvas — gestes'], ['Général']]
const FADE_H = 24

function useMediaQuery(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}

// True while the scroller has rows below its visible bottom edge. `layout`
// re-arms the observers when the column layout swaps.
function useMoreBelow(open, layout) {
  const ref = useRef(null)
  const [more, setMore] = useState(false)
  const update = useCallback(() => {
    const el = ref.current
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!open || !el) return
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [open, layout, update])
  return { ref, more, onScroll: update }
}

function Group({ g }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: T.text3, letterSpacing: 1.2, fontWeight: 700, marginBottom: 9, textTransform: 'uppercase' }}>{g.title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {g.rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl }}>
            <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>{r.k.map((k, j) => <Kbd key={j}>{k}</Kbd>)}</span>
            <span style={{ fontSize: T.fs.sm, color: T.text2, flex: 1, textAlign: 'right' }}>{r.l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const byTitle = title => GROUPS.find(g => g.title === title)

export default function ShortcutsOverlay({ open, onClose }) {
  const wide = useMediaQuery(WIDE_QUERY)
  const { ref: scrollRef, more: moreBelow, onScroll: onListScroll } = useMoreBelow(open, wide)

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
      <div onClick={e => e.stopPropagation()} style={{ width: wide ? 'min(1120px,92vw)' : 'min(860px,92vw)', maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL }}>
        {/* Header stays put; only the rows scroll (FIXES_R4 §13). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 24px 18px', flexShrink: 0 }}>
          <Icon d={ICONS.keyboard} size={20} stroke={T.accent} />
          <span style={{ fontSize: T.fs.lg, fontWeight: 600 }}>Raccourcis clavier</span>
          <span style={{ fontSize: T.fs.xs, color: T.text3 }}>Échap pour fermer</span>
          <div style={{ flex: 1 }} />
          <Btn size="sm" variant="outline" onClick={onClose}>Fermer</Btn>
        </div>
        <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div ref={scrollRef} onScroll={onListScroll} data-shortcuts-scroll style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 24px' }}>
            {wide ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18, alignItems: 'start' }}>
                {WIDE_COLUMNS.map(col => (
                  <div key={col.join()} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {col.map(t => <Group key={t} g={byTitle(t)} />)}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, alignContent: 'start' }}>
                {GROUPS.map(g => <Group key={g.title} g={g} />)}
              </div>
            )}
          </div>
          {/* Bottom fade = "more below" cue while the list overflows. */}
          <div aria-hidden style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE_H, pointerEvents: 'none',
            background: `linear-gradient(to bottom, transparent, ${T.surface})`,
            opacity: moreBelow ? 1 : 0, transition: 'opacity .15s',
          }} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
