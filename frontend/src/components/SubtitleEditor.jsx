import React, { useState, useRef, useEffect } from 'react'

const TRACK_COLORS = [
  { bg: 'rgba(255,153,0,0.10)',  text: '#f90', label: '#f90' },
  { bg: 'rgba(80,180,255,0.10)', text: '#5bf', label: '#5bf' },
  { bg: 'rgba(255,100,160,0.10)',text: '#f6a', label: '#f6a' },
  { bg: 'rgba(100,230,160,0.10)',text: '#6eb', label: '#6eb' },
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
        style={{ width: 76, fontFamily: 'var(--font-mono)', fontSize: 11, background: '#0a0a0a', color, border: '1px solid #f90', borderRadius: 2, padding: '3px 5px', outline: 'none' }}
      />
    )
  }
  return (
    <button onClick={e => { e.stopPropagation(); setDraft(fmtTC(value)); setEditing(true) }} style={{
      width: 76, fontFamily: 'var(--font-mono)', fontSize: 11, color, background: 'transparent',
      border: '1px solid transparent', borderRadius: 2, padding: '3px 5px', textAlign: 'left', cursor: 'text',
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
      background: active ? 'rgba(255,153,0,0.08)' : 'transparent',
      border: 'none', fontSize: 12, textAlign: 'left', cursor: 'pointer', color: 'var(--text)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.label, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{name || '(défaut)'}</span>
      {active && <span style={{ color: '#f90', fontSize: 10 }}>✓</span>}
    </button>
  )
}

function CharSelect({ value, charMap, charList, onSelect, onCreate }) {
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
            color: '#f90', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
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
  eye:    <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a18.45 18.45 0 015.06-5.94M9.9 4.24A10.93 10.93 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>,
  note:   <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></>,
  mic:    <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></>,
  rec:    <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
  trash:  <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>,
}

function SubtitleRow({ sub, idx, active, selected, charMap, charList, onChange, onDelete, onSelect, onNewCharacter }) {
  const dur = sub.end - sub.start
  const visibleText = (sub.text || '').replace(/\*/g, '')
  const cps = dur > 0 ? visibleText.length / dur : 0
  const cpsHigh = cps > 20
  const c = TRACK_COLORS[(charMap[sub.character || ''] ?? 0) % TRACK_COLORS.length]

  const icBtn = (title, color, onClick, children) => (
    <button title={title} onClick={e => { e.stopPropagation(); onClick() }} style={{
      background: 'transparent', border: 'none', color, padding: '3px', borderRadius: 3,
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', opacity: 0.7,
      transition: 'opacity 0.12s, color 0.12s',
    }}
    onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
    onMouseLeave={e => { e.currentTarget.style.opacity = '0.7' }}
    >{children}</button>
  )

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: selected ? 'rgba(255,153,0,0.07)' : (active ? 'rgba(255,255,255,0.02)' : 'transparent'),
        borderBottom: '1px solid #141414',
        borderLeft: `3px solid ${selected ? c.label : (active ? c.label + '88' : 'transparent')}`,
        cursor: 'default', userSelect: 'none', minHeight: 42,
        transition: 'background 0.1s',
      }}
    >
      {/* Checkbox + index */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', flexShrink: 0 }}>
        <input type="checkbox" checked={!!selected} readOnly
          onClick={e => { e.stopPropagation(); onSelect() }}
          style={{ accentColor: '#f90', width: 13, height: 13, margin: 0, cursor: 'pointer' }} />
        <span style={{ fontSize: 9, color: '#444', minWidth: 16, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{idx + 1}</span>
      </div>

      {/* Timecodes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', flexShrink: 0, borderLeft: '1px solid #1a1a1a', borderRight: '1px solid #1a1a1a' }}>
        <TCInput value={sub.start} color="#f90"
          onCommit={t => onChange({ ...sub, start: Math.min(t, sub.end - 0.1) })} />
        <span style={{ color: '#333', fontSize: 10 }}>→</span>
        <TCInput value={sub.end} color="#f90"
          onCommit={t => onChange({ ...sub, end: Math.max(t, sub.start + 0.1) })} />
      </div>

      {/* Character */}
      <div style={{ padding: '0 8px', flexShrink: 0, borderRight: '1px solid #1a1a1a' }}>
        <CharSelect value={sub.character || ''} charMap={charMap} charList={charList}
          onSelect={v => onChange({ ...sub, character: v })}
          onCreate={onNewCharacter}
        />
      </div>

      {/* Text */}
      <div style={{ flex: 1, padding: '0 8px', borderRight: '1px solid #1a1a1a' }}>
        <input value={sub.text} onChange={e => onChange({ ...sub, text: e.target.value })}
          placeholder="Texte de la réplique…"
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', fontFamily: 'var(--font-mono)', fontSize: 13, padding: '5px 0',
            background: 'transparent', color: 'var(--text)',
            border: 'none', outline: 'none', userSelect: 'text',
          }}
        />
      </div>

      {/* Stats + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', flexShrink: 0 }}>
        <span style={{
          fontSize: 9, color: cpsHigh ? '#e54545' : '#444',
          fontFamily: 'var(--font-mono)', fontWeight: cpsHigh ? 700 : 400,
          marginRight: 4, minWidth: 32,
        }} title={`${cps.toFixed(1)} c/s`}>{dur.toFixed(2)}s</span>
        {icBtn(sub.hidden ? 'Masqué' : 'Visible', sub.hidden ? '#444' : '#6eb', () => onChange({ ...sub, hidden: !sub.hidden }), <Ic d={sub.hidden ? ICONS.eyeOff : ICONS.eye} />)}
        {icBtn(sub.note || 'Note', sub.note ? '#f90' : '#333', () => {}, <Ic d={ICONS.note} />)}
        {icBtn(sub.take ? 'Prise' : 'Mic', sub.take ? '#e54545' : '#333', () => {}, <Ic d={sub.take ? ICONS.rec : ICONS.mic} />)}
        {icBtn('Supprimer', '#7a3535', onDelete, <Ic d={ICONS.trash} />)}
      </div>
    </div>
  )
}

const toolBtn = {
  padding: '4px 10px', background: 'var(--surface3)', color: 'var(--text2)',
  border: '1px solid var(--border2)', borderRadius: 4, fontSize: 11, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4,
}

export default function SubtitleEditor({ subtitles, onChange, currentTime = 0, onSeek, selectedIdx, setSelectedIdx }) {
  const activeRef = useRef(null)
  const prevActiveIdx = useRef(-1)

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
    onChange(subtitles.filter((_, idx) => idx !== i))
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 10px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #1a1a1a', flexShrink: 0, background: '#0a0a0a' }}>
        <button onClick={addNew} style={{ ...toolBtn, color: '#f90', borderColor: 'rgba(255,153,0,0.35)', background: 'rgba(255,153,0,0.06)' }}>
          + Réplique
        </button>
        <button onClick={sortByTime} style={toolBtn}>⇅ Trier</button>
        <div style={{ width: 1, height: 16, background: '#222', margin: '0 2px' }} />
        <span style={{ fontSize: 10, color: '#888' }}>Décaler tout</span>
        <button onClick={() => shiftAll(-1)} style={toolBtn}>−1s</button>
        <button onClick={() => shiftAll(-0.1)} style={toolBtn}>−.1</button>
        <button onClick={() => shiftAll(0.1)} style={toolBtn}>+.1</button>
        <button onClick={() => shiftAll(1)} style={toolBtn}>+1s</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: '#888', fontFamily: 'var(--font-mono)' }}>
          {subtitles.length} réplique{subtitles.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {subtitles.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#444', fontSize: 12 }}>
            Aucune réplique — utilisez le bouton ci-dessus ou transcrivez avec Whisper.
          </div>
        ) : subtitles.map((sub, i) => {
          const active = currentTime >= sub.start && currentTime <= sub.end
          return (
            <div key={i} ref={active ? activeRef : null}>
              <SubtitleRow
                sub={sub} idx={i} active={active} selected={selectedIdx === i}
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
