import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { T, Icon, ICONS, Input, Kbd } from '../ui'

// Command palette (⌘K / Ctrl+K / "/") — port of redesign shell.jsx CommandPalette.
// Search over navigation, quick actions, and clips. Keyboard: ↑/↓ move, ↵ run, Esc close.
export default function CommandPalette({ open, onClose, onNavigate, onNewClip, onShortcuts, clips = [], onOpenClip }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  const items = useMemo(() => {
    const base = [
      { id: 'nav-clips',    ic: ICONS.library,  label: 'Aller à la Bibliothèque',    run: () => onNavigate('clips') },
      { id: 'nav-import',   ic: ICONS.import,   label: 'Importer une vidéo',         run: () => onNavigate('import') },
      { id: 'nav-dub',      ic: ICONS.edit,     label: 'Ouvrir l’éditeur BR',     run: () => onNavigate('dub') },
      { id: 'nav-record',   ic: ICONS.mic,      label: 'Studio d’enregistrement', run: () => onNavigate('record') },
      { id: 'nav-memes',    ic: ICONS.meme,     label: 'Atelier Meme · GIF · Audio', run: () => onNavigate('memes') },
      { id: 'nav-activity', ic: ICONS.activity, label: 'Voir l’activité',        run: () => onNavigate('activity') },
      { id: 'nav-settings', ic: ICONS.settings, label: 'Réglages',                   run: () => onNavigate('settings') },
      { id: 'act-new',      ic: ICONS.plus,     label: 'Nouveau clip — importer une vidéo', run: () => onNewClip?.() },
      { id: 'act-help',     ic: ICONS.keyboard, label: 'Raccourcis clavier',         run: () => onShortcuts?.() },
    ]
    const clipItems = clips.map(c => ({
      id: 'clip-' + c.clip_id, ic: ICONS.film,
      label: `Ouvrir — ${c.name || c.clip_id}`,
      meta: c.project || (c.subtitles?.length ? `${c.subtitles.length} répl.` : ''),
      run: () => onOpenClip?.(c),
    }))
    const query = q.trim().toLowerCase()
    const match = i => !query || i.label.toLowerCase().includes(query) || (i.meta || '').toLowerCase().includes(query)
    return [...base.filter(match), ...clipItems.filter(match).slice(0, 50)]
  }, [q, clips, onNavigate, onNewClip, onShortcuts, onOpenClip])

  useEffect(() => { if (sel >= items.length) setSel(Math.max(0, items.length - 1)) }, [items.length, sel])

  if (!open) return null

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[sel]; if (it) { it.run(); onClose() } }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
      <div onClick={e => e.stopPropagation()} onKeyDown={onKey} style={{ width: 560, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
          <Input ref={inputRef} size="lg" icon={ICONS.search} right={<Kbd>Esc</Kbd>}
            value={q} onChange={e => { setQ(e.target.value); setSel(0) }}
            placeholder="Rechercher une commande, un clip…" aria-label="Rechercher une commande ou un clip" />
        </div>
        <div style={{ maxHeight: 360, overflow: 'auto', padding: 8 }}>
          {items.map((c, i) => (
            <button data-rd key={c.id} onClick={() => { c.run(); onClose() }} onMouseEnter={() => setSel(i)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 12px', borderRadius: T.r.ctl,
              background: i === sel ? T.surface2 : 'transparent', border: 'none', cursor: 'pointer', color: T.text, textAlign: 'left',
              fontSize: T.fs.sm, fontFamily: T.fontUI,
            }}>
              <Icon d={c.ic} size={16} stroke={T.text2} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
              {(c.meta || i === sel) && <div style={{ flex: 1 }} />}
              {c.meta && <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{c.meta}</span>}
              {i === sel && <Kbd>↵</Kbd>}
            </button>
          ))}
          {items.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: T.text3, fontSize: T.fs.sm }}>Aucun résultat</div>}
        </div>
      </div>
    </div>,
    document.body
  )
}
