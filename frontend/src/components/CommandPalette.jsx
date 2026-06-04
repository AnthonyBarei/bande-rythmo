import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Icon, ICONS } from '../Icons'

// Command palette (⌘K / Ctrl+K / "/") — fuzzy-ish search over navigation,
// quick actions, and clips. Keyboard: ↑/↓ move, ↵ run, Esc close.
export default function CommandPalette({ open, onClose, onNavigate, onNewClip, onShortcuts, clips = [], onOpenClip }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  const items = useMemo(() => {
    const base = [
      { id: 'nav-import',   icon: ICONS.upload,   label: 'Aller à — Importer',  run: () => onNavigate('import') },
      { id: 'nav-clips',    icon: ICONS.grid,     label: 'Aller à — Mes Clips',  run: () => onNavigate('clips') },
      { id: 'nav-memes',    icon: ICONS.smile,    label: 'Aller à — Memes',      run: () => onNavigate('memes') },
      { id: 'nav-activity', icon: ICONS.activity, label: 'Aller à — Activité',    run: () => onNavigate('activity') },
      { id: 'nav-settings', icon: ICONS.settings, label: 'Aller à — Réglages',   run: () => onNavigate('settings') },
      { id: 'act-new',      icon: ICONS.plus,     label: 'Nouveau clip — importer une vidéo', run: () => onNewClip?.() },
      { id: 'act-help',     icon: ICONS.kbd,      label: 'Raccourcis clavier',   run: () => onShortcuts?.() },
    ]
    const clipItems = clips.slice(0, 50).map(c => ({
      id: 'clip-' + c.clip_id, icon: ICONS.film,
      label: `Ouvrir — ${c.name}`,
      meta: c.project || (c.subtitles?.length ? `${c.subtitles.length} répl.` : ''),
      run: () => onOpenClip?.(c),
    }))
    const all = [...base, ...clipItems]
    const query = q.trim().toLowerCase()
    if (!query) return all
    return all.filter(i => i.label.toLowerCase().includes(query) || (i.meta || '').toLowerCase().includes(query))
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
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
      zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
    }}>
      <div onClick={e => e.stopPropagation()} onKeyDown={onKey} style={{
        width: 'min(560px, 94vw)', background: 'var(--surface)', border: '1px solid var(--border2)',
        borderRadius: 12, boxShadow: '0 18px 60px rgba(0,0,0,0.55)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <Icon d={ICONS.search} size={18} sw={1.8} />
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0) }}
            placeholder="Rechercher une commande, un clip…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 16, fontFamily: 'var(--font-ui)' }} />
          <Kbd>Esc</Kbd>
        </div>
        <div style={{ maxHeight: 360, overflow: 'auto', padding: 8 }}>
          {items.map((it, i) => (
            <button key={it.id}
              onMouseEnter={() => setSel(i)}
              onClick={() => { it.run(); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 8,
                background: i === sel ? 'var(--surface2)' : 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text)', textAlign: 'left', fontSize: 13, fontFamily: 'var(--font-ui)', minHeight: 40,
              }}>
              <Icon d={it.icon} size={16} sw={1.7} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
              {it.meta && <span style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{it.meta}</span>}
              {i === sel && <Kbd>↵</Kbd>}
            </button>
          ))}
          {items.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Aucun résultat</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function Kbd({ children }) {
  return <span style={{
    padding: '1px 6px', borderRadius: 5, background: 'var(--surface2)', border: '1px solid var(--border2)',
    fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text2)', lineHeight: 1.6,
  }}>{children}</span>
}
