import React, { useState, useRef, useEffect } from 'react'

const TRACK_COLORS = [
  { bg: 'rgba(245,197,24,0.10)',  text: '#f5c518', label: '#f5c518' },
  { bg: 'rgba(126,192,255,0.10)', text: '#7ec0ff', label: '#7ec0ff' },
  { bg: 'rgba(240,138,175,0.10)', text: '#f08aaf', label: '#f08aaf' },
  { bg: 'rgba(126,212,168,0.10)', text: '#7ed4a8', label: '#7ed4a8' },
]

const NOTATION_TAGS = [
  { label: '(HH)', title: 'Inspiration',  color: '#7ec0ff' },
  { label: '(H)',  title: 'Souffle',      color: '#7ec0ff' },
  { label: '(rires)',    title: 'Rires',   color: '#f5c518' },
  { label: '(pleurs)',   title: 'Pleurs',  color: '#ff8888' },
  { label: '(soupir)',   title: 'Soupir',  color: '#aaa' },
  { label: '(cri)',      title: 'Cri',     color: '#ff5a5a' },
  { label: '(chuchoté)', title: 'Chuchoté',color: '#88ddaa' },
  { label: '*',          title: 'Repère BR (respiration)',color: '#7ec0ff' },
]

function parseTC(s) {
  if (typeof s !== 'string') return null
  s = s.trim().replace(',', '.')
  if (!s) return null
  const parts = s.split(':')
  let sec = 0
  try {
    if (parts.length === 1) sec = parseFloat(parts[0])
    else if (parts.length === 2) sec = parseInt(parts[0], 10) * 60 + parseFloat(parts[1])
    else sec = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2])
    if (isNaN(sec)) return null
    return Math.max(0, sec)
  } catch { return null }
}

const fmtTC = t => {
  if (t === null || t === undefined) return '--:--.--'
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(2).padStart(5, '0')
  return `${String(m).padStart(2, '0')}:${s}`
}

function TCInput({ value, onCommit, color = 'var(--text2)' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function commit() {
    const t = parseTC(draft)
    if (t != null) onCommit(t)
    setEditing(false)
  }

  if (editing) {
    return (
      <input ref={inputRef} value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
        }}
        style={{ width: 72, fontFamily: 'var(--font-mono)', fontSize: 11, background: '#0a0a0a', color, border: '1px solid #f5c518', borderRadius: 2, padding: '2px 4px', outline: 'none' }}
      />
    )
  }
  return (
    <button onClick={e => { e.stopPropagation(); setDraft(fmtTC(value)); setEditing(true) }} style={{
      width: 72, fontFamily: 'var(--font-mono)', fontSize: 11, color, background: 'transparent',
      border: '1px solid transparent', borderRadius: 2, padding: '2px 4px', textAlign: 'left', cursor: 'text',
      transition: 'border-color 0.12s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = '#333' }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent' }}
    >{fmtTC(value)}</button>
  )
}

function CharOption({ name, idx, active, onClick }) {
  const c = TRACK_COLORS[idx % TRACK_COLORS.length]
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 10px',
      background: active ? 'rgba(245, 197, 24,0.08)' : 'transparent',
      border: 'none', fontSize: 12, textAlign: 'left', cursor: 'pointer', color: 'var(--text)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.label, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{name || '(défaut)'}</span>
      {active && <span style={{ color: '#f5c518', fontSize: 10 }}>✓</span>}
    </button>
  )
}

function CharSelect({ value, charMap, charList, onSelect, onCreate, compact = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    setTimeout(() => window.addEventListener('mousedown', close), 0)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const idx = charMap[value || ''] ?? 0
  const c = TRACK_COLORS[idx % TRACK_COLORS.length]

  if (compact) {
    return (
      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }} title={value || '(défaut)'} style={{
          display: 'flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99,
          background: c.label + '1e', border: `1px solid ${c.label}44`,
          cursor: 'pointer', fontSize: 9, fontWeight: 700, color: c.label,
          letterSpacing: 0.4, textTransform: 'uppercase', maxWidth: 78,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value || 'déf'}
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 3px)', left: 0, minWidth: 160, zIndex: 30,
            background: '#111', border: '1px solid #2a2a2a', borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)', padding: '4px 0',
          }}>
            {charList.map(ch => (
              <CharOption key={ch || '_def'} name={ch} idx={charMap[ch] ?? 0} active={ch === (value || '')}
                onClick={() => { onSelect(ch); setOpen(false) }} />
            ))}
            <div style={{ borderTop: '1px solid #1e1e1e', margin: '4px 0' }} />
            <button onClick={() => { onCreate(); setOpen(false) }} style={{
              display: 'block', width: '100%', padding: '6px 10px', fontSize: 11,
              color: '#f5c518', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
            }}>+ Nouveau personnage…</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', minWidth: 110,
        background: 'var(--surface3)', border: `1px solid ${c.label}44`, borderRadius: 4,
        color: c.label, fontSize: 11, fontWeight: 600, cursor: 'pointer',
        transition: 'border-color 0.12s',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.label, flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 72 }}>{value || '(défaut)'}</span>
        <span style={{ fontSize: 8, color: 'var(--text3)', flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, minWidth: 160, zIndex: 30,
          background: '#111', border: '1px solid #2a2a2a', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.7)', padding: '4px 0',
        }}>
          {charList.map(ch => (
            <CharOption key={ch || '_def'} name={ch} idx={charMap[ch] ?? 0} active={ch === (value || '')}
              onClick={() => { onSelect(ch); setOpen(false) }} />
          ))}
          <div style={{ borderTop: '1px solid #1e1e1e', margin: '4px 0' }} />
          <button onClick={() => { onCreate(); setOpen(false) }} style={{
            display: 'block', width: '100%', padding: '6px 10px', fontSize: 11,
            color: '#f5c518', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
          }}>+ Nouveau personnage…</button>
        </div>
      )}
    </div>
  )
}

const Ic = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
)

const ICONS = {
  eye:    <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a16.8 16.8 0 0 1-3.06 3.88M6.6 6.6A16.9 16.9 0 0 0 2 12s3.6 7 10 7a9.1 9.1 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><line x1="3" y1="3" x2="21" y2="21"/></>,
  note:   <><path d="M21 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="12.5" x2="13" y2="12.5"/></>,
  trash:  <><polyline points="3 6 21 6"/><path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="16"/><line x1="14" y1="11" x2="14" y2="16"/></>,
  goto:   <><polygon points="7 4 20 12 7 20 7 4"/></>,
}

function SubtitleRow({ sub, idx, active, selected, compact, charMap, charList, onChange, onDelete, onSelect, onSeek, onNewCharacter }) {
  const textInputRef = useRef(null)
  const [showNotations, setShowNotations] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const notationRef = useRef(null)
  const mouseDownPos = useRef(null)

  function handleMouseDown(e) {
    mouseDownPos.current = { x: e.clientX, y: e.clientY }
  }

  function handleRowClick(e) {
    mouseDownPos.current = null
    onSelect()
  }

  useEffect(() => {
    if (!showNotations) return
    const close = e => { if (!notationRef.current?.contains(e.target)) setShowNotations(false) }
    setTimeout(() => window.addEventListener('mousedown', close), 0)
    return () => window.removeEventListener('mousedown', close)
  }, [showNotations])

  function insertNotation(notation) {
    const input = textInputRef.current
    const text = sub.text || ''
    let newText, newPos
    if (input && document.activeElement === input) {
      const start = input.selectionStart ?? text.length
      const end = input.selectionEnd ?? text.length
      newText = text.slice(0, start) + notation + text.slice(end)
      newPos = start + notation.length
    } else {
      newText = text + notation
      newPos = newText.length
    }
    onChange({ ...sub, text: newText })
    setShowNotations(false)
    setTimeout(() => {
      if (input) { input.focus(); input.setSelectionRange(newPos, newPos) }
    }, 0)
  }

  const dur = sub.end - sub.start
  const visibleText = (sub.text || '').replace(/\*/g, '')
  const cps = dur > 0 ? visibleText.length / dur : 0
  const cpsHigh = cps > 20
  const c = TRACK_COLORS[(charMap[sub.character || ''] ?? 0) % TRACK_COLORS.length]

  const icBtn = (title, color, onClick, children) => (
    <button title={title} onClick={e => { e.stopPropagation(); onClick() }} style={{
      background: 'transparent', border: '1px solid transparent', color,
      width: 28, height: 28, borderRadius: 6,
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      opacity: 0.55, transition: 'opacity 0.12s, background 0.12s, border-color 0.12s',
    }}
    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
    onMouseLeave={e => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
    >{children}</button>
  )

  if (compact) {
    // Compact layout: number badge | (meta line + text line) | hover actions
    return (
      <div
        onMouseDown={handleMouseDown}
        onClick={handleRowClick}
        className="sub-row"
        style={{
          display: 'flex', gap: 8, padding: '9px 10px', marginBottom: 2,
          borderRadius: 6, position: 'relative',
          background: (selected || active) ? c.label + '22' : 'transparent',
          border: `1px solid ${(selected || active) ? c.label + '44' : 'transparent'}`,
          cursor: 'pointer', userSelect: 'none',
          transition: 'background 0.1s',
        }}
      >
        {(selected || active) && (
          <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2.5, background: c.label, borderRadius: 2 }} />
        )}
        {/* Number badge */}
        <div style={{
          width: 22, height: 22, flexShrink: 0, borderRadius: 4, marginTop: 1,
          background: c.label + '22', color: c.label,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        }}>{idx + 1}</div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Meta line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CharSelect value={sub.character || ''} charMap={charMap} charList={charList}
              onSelect={v => onChange({ ...sub, character: v })}
              onCreate={onNewCharacter}
              compact
            />
            <TCInput value={sub.start} color="var(--text3)"
              onCommit={t => onChange({ ...sub, start: Math.min(t, sub.end - 0.1) })} />
            <span style={{ color: 'var(--text4)', fontSize: 10 }}>→</span>
            <TCInput value={sub.end} color="var(--text3)"
              onCommit={t => onChange({ ...sub, end: Math.max(t, sub.start + 0.1) })} />
            <div style={{ flex: 1 }} />
            <span title={`${cps.toFixed(1)} c/s`} style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              color: cpsHigh ? 'var(--danger)' : 'var(--text4)',
              fontWeight: cpsHigh ? 700 : 400,
            }}>{dur.toFixed(1)}s</span>
          </div>

          {/* Text line */}
          <div ref={notationRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              ref={textInputRef}
              value={sub.text}
              onChange={e => onChange({ ...sub, text: e.target.value })}
              placeholder="Texte de la réplique…"
              onClick={e => e.stopPropagation()}
              style={{
                flex: 1, fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 1.4, padding: '1px 0',
                background: 'transparent', color: active || selected ? 'var(--text)' : 'var(--text2)',
                border: 'none', outline: 'none', userSelect: 'text', minWidth: 0,
              }}
            />
            <button onClick={e => { e.stopPropagation(); setShowNotations(n => !n) }}
              title="Notations de doublage"
              style={{
                width: 22, height: 22, flexShrink: 0, borderRadius: 6, cursor: 'pointer', fontSize: 12,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: showNotations ? 'var(--accent-soft)' : 'transparent',
                color: showNotations ? 'var(--accent)' : 'var(--text4)',
                border: `1px solid ${showNotations ? 'rgba(245,197,24,0.4)' : 'transparent'}`,
                transition: 'background 0.12s, color 0.12s, border-color 0.12s',
              }}
              onMouseEnter={e => { if (!showNotations) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border2)' } }}
              onMouseLeave={e => { if (!showNotations) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}>
              ≈
            </button>
            {showNotations && <NotationPopover tags={NOTATION_TAGS} onInsert={insertNotation} />}
          </div>

          {/* Note line — free-text annotation, shown when toggled or present */}
          {(showNote || sub.note) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ic d={ICONS.note} size={11} />
              <input
                value={sub.note || ''}
                autoFocus={showNote && !sub.note}
                onChange={e => onChange({ ...sub, note: e.target.value })}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); setShowNote(false); e.target.blur() } }}
                placeholder="Note — intention, intonation, didascalie…"
                style={{
                  flex: 1, fontFamily: 'var(--font-ui)', fontSize: 11.5, fontStyle: 'italic',
                  padding: '2px 6px', background: 'rgba(245,197,24,0.06)',
                  border: '1px solid rgba(245,197,24,0.25)', borderRadius: 4,
                  color: 'var(--accent)', outline: 'none', minWidth: 0,
                }}
              />
              {sub.note && (
                <button onClick={e => { e.stopPropagation(); onChange({ ...sub, note: '' }); setShowNote(false) }}
                  title="Effacer la note"
                  style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>
              )}
            </div>
          )}
        </div>

        {/* Actions — reveal on row hover (prototype: clean rows) */}
        <div className="row-actions" style={{ position: 'absolute', top: 6, right: 8, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, background: (selected || active) ? c.label + '22' : 'var(--surface)', borderRadius: 7, padding: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
          {icBtn('Aller au timecode', 'var(--info)', () => onSeek?.(sub.start), <Ic d={ICONS.goto} size={13} />)}
          {icBtn(sub.note ? `Note : ${sub.note}` : 'Ajouter une note', sub.note ? 'var(--accent)' : 'var(--text4)', () => setShowNote(v => !v), <Ic d={ICONS.note} size={13} />)}
          {icBtn(sub.hidden ? 'Masqué' : 'Visible', sub.hidden ? 'var(--text4)' : 'var(--success)', () => onChange({ ...sub, hidden: !sub.hidden }), <Ic d={sub.hidden ? ICONS.eyeOff : ICONS.eye} size={13} />)}
          {icBtn('Supprimer', 'var(--danger)', onDelete, <Ic d={ICONS.trash} size={13} />)}
        </div>
      </div>
    )
  }

  // Normal layout
  return (
    <div
      onMouseDown={handleMouseDown}
      onClick={handleRowClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: selected ? 'rgba(245, 197, 24,0.07)' : (active ? 'rgba(255,255,255,0.02)' : 'transparent'),
        borderBottom: '1px solid #141414',
        borderLeft: `3px solid ${selected ? c.label : (active ? c.label + '88' : 'transparent')}`,
        cursor: 'pointer', userSelect: 'none', minHeight: 42,
        transition: 'background 0.1s',
      }}
    >
      {/* Checkbox + index */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', flexShrink: 0 }}>
        <input type="checkbox" checked={!!selected} readOnly
          onClick={e => { e.stopPropagation(); onSelect() }}
          style={{ accentColor: '#f5c518', width: 13, height: 13, margin: 0, cursor: 'pointer' }} />
        <span style={{ fontSize: 9, color: '#444', minWidth: 16, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{idx + 1}</span>
      </div>

      {/* Timecodes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', flexShrink: 0, borderLeft: '1px solid #1a1a1a', borderRight: '1px solid #1a1a1a' }}>
        <TCInput value={sub.start} color="#f5c518"
          onCommit={t => onChange({ ...sub, start: Math.min(t, sub.end - 0.1) })} />
        <span style={{ color: '#333', fontSize: 10 }}>→</span>
        <TCInput value={sub.end} color="#f5c518"
          onCommit={t => onChange({ ...sub, end: Math.max(t, sub.start + 0.1) })} />
      </div>

      {/* Character */}
      <div style={{ padding: '0 8px', flexShrink: 0, borderRight: '1px solid #1a1a1a' }}>
        <CharSelect value={sub.character || ''} charMap={charMap} charList={charList}
          onSelect={v => onChange({ ...sub, character: v })}
          onCreate={onNewCharacter}
        />
      </div>

      {/* Text + notation */}
      <div ref={notationRef} style={{ flex: 1, padding: '0 4px 0 8px', borderRight: '1px solid #1a1a1a', position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
        <input
          ref={textInputRef}
          value={sub.text}
          onChange={e => onChange({ ...sub, text: e.target.value })}
          placeholder="Texte de la réplique…"
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, padding: '5px 0',
            background: 'transparent', color: 'var(--text)',
            border: 'none', outline: 'none', userSelect: 'text', minWidth: 0,
          }}
        />
        <button onClick={e => { e.stopPropagation(); setShowNotations(n => !n) }}
          title="Notations de doublage (HH, rires, …)"
          style={{ background: 'none', border: 'none', color: showNotations ? '#f5c518' : '#333', padding: '2px 4px', cursor: 'pointer', fontSize: 13, flexShrink: 0, borderRadius: 2, transition: 'color 0.1s' }}>
          ≈
        </button>
        {showNotations && <NotationPopover tags={NOTATION_TAGS} onInsert={insertNotation} />}
      </div>

      {/* Stats + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', flexShrink: 0 }}>
        <span style={{
          fontSize: 9, color: cpsHigh ? '#e54545' : '#444',
          fontFamily: 'var(--font-mono)', fontWeight: cpsHigh ? 700 : 400,
          marginRight: 4, minWidth: 32,
        }} title={`${cps.toFixed(1)} c/s`}>{dur.toFixed(2)}s</span>
        {icBtn('Aller au timecode', '#7ec0ff', () => onSeek?.(sub.start), <Ic d={ICONS.goto} />)}
        {icBtn(sub.hidden ? 'Masqué' : 'Visible', sub.hidden ? '#444' : '#6eb', () => onChange({ ...sub, hidden: !sub.hidden }), <Ic d={sub.hidden ? ICONS.eyeOff : ICONS.eye} />)}
        {icBtn(sub.note ? `Note : ${sub.note}` : 'Ajouter une note', sub.note ? '#f5c518' : '#333', () => setShowNote(v => !v), <Ic d={ICONS.note} />)}
        {icBtn('Supprimer', '#7a3535', onDelete, <Ic d={ICONS.trash} />)}
      </div>
    </div>
  )
}

function NotationPopover({ tags, onInsert }) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 2px)', left: 0, zIndex: 30,
      background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6,
      padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 280,
      boxShadow: '0 6px 20px rgba(0,0,0,0.8)',
    }}>
      <div style={{ width: '100%', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
        Notations — insère au curseur
      </div>
      {tags.map(n => (
        <button key={n.label}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onInsert(n.label) }}
          title={n.title}
          style={{
            fontSize: 10, padding: '4px 8px',
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${n.color}44`,
            color: n.color, borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)',
            transition: 'background 0.1s, border-color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${n.color}18`; e.currentTarget.style.borderColor = n.color }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = `${n.color}44` }}
        >
          {n.label}
        </button>
      ))}
    </div>
  )
}

const toolBtn = {
  padding: '4px 10px', background: 'var(--surface3)', color: 'var(--text2)',
  border: '1px solid var(--border2)', borderRadius: 4, fontSize: 11, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4,
}

export default function SubtitleEditor({ subtitles, onChange, currentTime = 0, onSeek, selectedIdx, setSelectedIdx, compact = false, onDelete, charFilter, clipId }) {
  // charFilter (optional Set of character names): when non-empty, hide rows whose
  // character isn't in the set. Indices stay aligned with the unfiltered array
  // so update/delete callbacks still work.
  const activeRef = useRef(null)
  const prevActiveIdx = useRef(-1)
  const importInputRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)

  const charList = Array.from(new Set(subtitles.map(s => s.character || '')))
  const charMap = Object.fromEntries(charList.map((c, i) => [c, i]))
  const curActive = subtitles.findIndex(s => currentTime >= s.start && currentTime <= s.end)

  useEffect(() => {
    if (curActive !== -1 && curActive !== prevActiveIdx.current) {
      prevActiveIdx.current = curActive
      activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [curActive])

  function update(i, next) {
    onChange(subtitles.map((s, idx) => idx === i ? next : s))
  }

  function del(i) {
    if (onDelete) {
      onDelete(i)
    } else {
      onChange(subtitles.filter((_, idx) => idx !== i))
    }
    if (selectedIdx === i) setSelectedIdx?.(null)
  }

  function addNew() {
    const last = subtitles[subtitles.length - 1]
    const start = last ? last.end + 0.1 : (currentTime || 0)
    onChange([...subtitles, {
      start, end: start + 1.5,
      character: last?.character || '',
      text: '', note: '', reactions: [],
    }])
  }

  function newCharacter(i) {
    const name = window.prompt('Nom du personnage :', subtitles[i].character || '')
    if (name != null) update(i, { ...subtitles[i], character: name.trim() })
  }

  function shiftAll(delta) {
    onChange(subtitles.map(s => ({
      ...s, start: Math.max(0, s.start + delta), end: Math.max(0.1, s.end + delta),
    })))
  }

  function sortByTime() {
    onChange([...subtitles].sort((a, b) => a.start - b.start))
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file || !clipId) return
    e.target.value = ''
    setImporting(true)
    setImportError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mode', subtitles.length > 0 ? 'replace' : 'replace')
      const res = await fetch(`/api/clips/${clipId}/import-subtitles`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      // data.clip.subtitles is the full updated list
      onChange(data.clip?.subtitles || [])
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar — full editor shows all controls; compact only shows import */}
      {(!compact || clipId) && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 10px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)' }}>
          {!compact && <>
            <button onClick={addNew} style={{ ...toolBtn, color: 'var(--accent)', borderColor: 'rgba(245,197,24,0.35)', background: 'rgba(245,197,24,0.06)' }}>
              + Réplique
            </button>
            <button onClick={sortByTime} style={toolBtn}>⇅ Trier</button>
            <div style={{ width: 1, height: 16, background: 'var(--border2)', margin: '0 2px' }} />
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Décaler</span>
            <button onClick={() => shiftAll(-1)} style={toolBtn}>−1s</button>
            <button onClick={() => shiftAll(0.1)} style={toolBtn}>+.1</button>
            <button onClick={() => shiftAll(-0.1)} style={toolBtn}>−.1</button>
            <button onClick={() => shiftAll(1)} style={toolBtn}>+1s</button>
          </>}
          <div style={{ flex: 1 }} />
          {clipId && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".srt,.ass,.ssa,.vtt,.detx"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                title="Importer sous-titres (SRT / ASS / VTT) — remplace les répliques existantes"
                style={{ ...toolBtn, color: 'var(--text2)', opacity: importing ? 0.5 : 1 }}>
                {importing ? '…' : '⇑ Import'}
              </button>
            </>
          )}
          {importError && (
            <span style={{ fontSize: 10, color: 'var(--danger)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={importError}>
              ✕ {importError}
            </span>
          )}
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            {subtitles.length} répl.
          </span>
        </div>
      )}

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto', padding: compact ? 8 : 0 }}>
        {subtitles.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
            Aucune réplique — transcrivez avec Whisper ou ajoutez avec ⇧↵.
          </div>
        ) : subtitles.map((sub, i) => {
          const active = currentTime >= sub.start && currentTime <= sub.end
          if (charFilter && charFilter.size > 0 && !charFilter.has(sub.character || '')) return null
          return (
            <div key={i} ref={active ? activeRef : null}>
              <SubtitleRow
                sub={sub} idx={i} active={active} selected={selectedIdx === i}
                compact={compact}
                charMap={charMap} charList={charList}
                onChange={next => update(i, next)}
                onDelete={() => del(i)}
                onSeek={onSeek}
                onSelect={() => setSelectedIdx?.(selectedIdx === i ? null : i)}
                onNewCharacter={() => newCharacter(i)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
