import React, { useRef, useState, useEffect, useCallback } from 'react'

const EDGE = 8
const MIN_DUR = 0.2

export default function ClipTimeline({
  duration, currentTime,
  pendingClips, savedClips,
  onSeek, onAdd, onUpdate, onRemove,
}) {
  const containerRef = useRef(null)
  const [draft, setDraft] = useState(null)
  const dragRef = useRef(null)
  const [focusedId, setFocusedId] = useState(null)

  function getW() { return containerRef.current?.getBoundingClientRect().width || 1 }
  function getX(e) {
    const rect = containerRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  }
  function toT(x, w) { return Math.max(0, Math.min(duration, (x / w) * duration)) }
  function pct(t) { return `${(t / duration) * 100}%` }

  function hitTest(x, w) {
    for (const c of pendingClips) {
      const cx0 = (c.start / duration) * w
      const cx1 = (c.end / duration) * w
      if (x >= cx0 - EDGE && x <= cx1 + EDGE) {
        if (x <= cx0 + EDGE) return { type: 'resize-left', id: c._id, clip: c }
        if (x >= cx1 - EDGE) return { type: 'resize-right', id: c._id, clip: c }
        return { type: 'move', id: c._id, clip: c }
      }
    }
    return null
  }

  function onMouseDown(e) {
    if (e.button !== 0) return
    const w = getW(); const x = getX(e); const t = toT(x, w)
    const hit = hitTest(x, w)

    if (hit) {
      setFocusedId(hit.id)
      dragRef.current = {
        type: hit.type, id: hit.id,
        x0: x, t0: t,
        origStart: hit.clip.start, origEnd: hit.clip.end,
        startedAt: Date.now(),
      }
    } else {
      setFocusedId(null)
      dragRef.current = { type: 'create', x0: x, t0: t, startedAt: Date.now() }
      setDraft({ start: t, end: t })
    }
    e.preventDefault()
  }

  function onMouseMove(e) {
    const dr = dragRef.current
    if (!dr) return
    const w = getW(); const x = getX(e); const t = toT(x, w)

    if (dr.type === 'create') {
      setDraft({ start: Math.min(dr.t0, t), end: Math.max(dr.t0, t) })
    } else if (dr.type === 'move') {
      const dt = t - dr.t0
      const dur = dr.origEnd - dr.origStart
      const newStart = Math.max(0, Math.min(duration - dur, dr.origStart + dt))
      onUpdate(dr.id, newStart, newStart + dur)
    } else if (dr.type === 'resize-left') {
      const newStart = Math.min(dr.origEnd - MIN_DUR, Math.max(0, t))
      onUpdate(dr.id, newStart, dr.origEnd)
    } else if (dr.type === 'resize-right') {
      const newEnd = Math.max(dr.origStart + MIN_DUR, Math.min(duration, t))
      onUpdate(dr.id, dr.origStart, newEnd)
    }
  }

  function onMouseUp(e) {
    const dr = dragRef.current
    if (!dr) return
    const w = getW(); const x = getX(e)
    dragRef.current = null

    if (dr.type === 'create') {
      const elapsed = Date.now() - dr.startedAt
      const dur = draft ? draft.end - draft.start : 0
      const currentDraft = draft
      setDraft(null)
      if (elapsed < 200 || dur < MIN_DUR) {
        onSeek(toT(x, w))
      } else {
        onAdd(currentDraft.start, currentDraft.end)
      }
    }
  }

  useEffect(() => {
    if (!focusedId) return
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        onRemove(focusedId)
        setFocusedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusedId, onRemove])

  if (!duration) return null

  const tickInterval = duration > 600 ? 60 : duration > 300 ? 30 : duration > 60 ? 10 : 5
  const ticks = []
  for (let t = 0; t <= duration; t += tickInterval) ticks.push(t)

  function fmtTick(t) {
    if (t === 0) return ''
    if (t >= 60) return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
    return `${t}s`
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        position: 'relative', height: 80,
        background: '#0a0a0a',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        cursor: 'crosshair', userSelect: 'none', overflow: 'hidden',
      }}
    >
      {/* Ruler */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 16,
        background: '#111', borderBottom: '1px solid #1e1e1e',
      }}>
        {ticks.map(t => (
          <div key={t} style={{ position: 'absolute', left: pct(t), top: 0, height: '100%', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: 5, width: 1, height: 6, background: '#383838' }} />
            {fmtTick(t) && (
              <div style={{
                position: 'absolute', top: 2, left: 3,
                fontSize: 9, color: '#444', whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)',
              }}>{fmtTick(t)}</div>
            )}
          </div>
        ))}
      </div>

      {/* Pinstripe track */}
      <div style={{
        position: 'absolute', top: 16, left: 0, right: 0, bottom: 0,
        backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 19px, #141414 19px, #141414 20px)',
      }} />

      {/* Saved clips — green, read-only */}
      {savedClips.map(c => (
        <div key={c.clip_id} title={c.name} style={{
          position: 'absolute', top: 20, bottom: 4,
          left: pct(c.start), width: `calc(${pct(c.end)} - ${pct(c.start)})`,
          background: 'rgba(68,187,85,0.10)', border: '1px solid rgba(68,187,85,0.4)',
          borderRadius: 2, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', paddingLeft: 5,
        }}>
          <span style={{ fontSize: 9, color: 'var(--success)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ✓ {c.name}
          </span>
        </div>
      ))}

      {/* Pending clips — orange, draggable */}
      {pendingClips.map(c => {
        const focused = focusedId === c._id
        return (
          <div key={c._id} title={c.name} style={{
            position: 'absolute', top: 20, bottom: 4,
            left: pct(c.start), width: `calc(${pct(c.end)} - ${pct(c.start)})`,
            background: focused ? 'rgba(255,153,0,0.22)' : 'rgba(255,153,0,0.18)',
            border: `1px solid ${focused ? '#f90' : 'rgba(255,153,0,0.7)'}`,
            borderRadius: 2, cursor: 'grab',
            display: 'flex', alignItems: 'center', paddingLeft: 7,
          }}>
            <span style={{ fontSize: 10, color: '#f90', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              ◎ {c.name} · {(c.end - c.start).toFixed(1)}s
            </span>
            {/* Left edge handle */}
            <div style={{
              position: 'absolute', left: -3, top: 0, bottom: 0, width: 8,
              cursor: 'ew-resize',
              background: 'linear-gradient(to right, #f90, transparent)',
            }} />
            {/* Right edge handle */}
            <div style={{
              position: 'absolute', right: -3, top: 0, bottom: 0, width: 8,
              cursor: 'ew-resize',
              background: 'linear-gradient(to left, #f90, transparent)',
            }} />
          </div>
        )
      })}

      {/* Draft selection */}
      {draft && draft.end - draft.start > 0.01 && (
        <div style={{
          position: 'absolute', top: 20, bottom: 4,
          left: pct(draft.start), width: `calc(${pct(draft.end)} - ${pct(draft.start)})`,
          background: 'rgba(255,153,0,0.07)', border: '1px dashed #f90',
          borderRadius: 2, pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 9, color: '#f90', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)',
          }}>{(draft.end - draft.start).toFixed(1)}s</div>
        </div>
      )}

      {/* Playhead */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: pct(currentTime), width: 1,
        background: '#fff', transform: 'translateX(-50%)',
        pointerEvents: 'none', zIndex: 10,
      }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
          borderTop: '6px solid #fff',
        }} />
      </div>

      {/* Bottom hint */}
      <div style={{
        position: 'absolute', bottom: 3, right: 8,
        fontSize: 9, color: '#333', fontFamily: 'var(--font-mono)',
        pointerEvents: 'none',
      }}>
        glisser pour créer · poignées pour redimensionner · clic court = seek
      </div>
    </div>
  )
}
