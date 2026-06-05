import React, { useRef, useState, useEffect } from 'react'

const EDGE = 8
const MIN_DUR = 0.2
const MIN_ZOOM = 1
const MAX_ZOOM = 20

function fmtClock(t) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TimelineBar({
  duration, currentTime,
  pendingClips, savedClips,
  onSeek, onAdd, onUpdate, onRemove,
}) {
  const trackRef = useRef(null)
  const miniRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [viewStart, setViewStart] = useState(0)
  const [draft, setDraft] = useState(null)
  const [focusedId, setFocusedId] = useState(null)
  const dragRef = useRef(null)
  const miniDragRef = useRef(null)

  const viewDur = duration / zoom
  const maxViewStart = Math.max(0, duration - viewDur)
  const vs = Math.min(Math.max(0, viewStart), maxViewStart)

  function trackW() { return trackRef.current?.getBoundingClientRect().width || 1 }
  function miniW() { return miniRef.current?.getBoundingClientRect().width || 1 }
  function tToX(t, w) { return ((t - vs) / viewDur) * w }
  function xToT(x, w) { return Math.max(0, Math.min(duration, vs + (x / w) * viewDur)) }

  function localX(e, ref) {
    const r = ref.current.getBoundingClientRect()
    return Math.max(0, Math.min(r.width, e.clientX - r.left))
  }

  function hitTest(x, w) {
    for (const c of pendingClips) {
      const cx0 = tToX(c.start, w)
      const cx1 = tToX(c.end, w)
      if (x >= cx0 - EDGE && x <= cx1 + EDGE) {
        if (x <= cx0 + EDGE) return { type: 'resize-left', id: c._id, clip: c }
        if (x >= cx1 - EDGE) return { type: 'resize-right', id: c._id, clip: c }
        return { type: 'move', id: c._id, clip: c }
      }
    }
    return null
  }

  // --- Main track interactions ---
  function onTrackDown(e) {
    if (e.button !== 0) return
    const w = trackW(); const x = localX(e, trackRef); const t = xToT(x, w)
    const hit = hitTest(x, w)
    if (hit) {
      setFocusedId(hit.id)
      dragRef.current = {
        type: hit.type, id: hit.id, t0: t,
        origStart: hit.clip.start, origEnd: hit.clip.end, startedAt: Date.now(),
      }
    } else {
      setFocusedId(null)
      dragRef.current = { type: 'create', t0: t, startedAt: Date.now() }
      setDraft({ start: t, end: t })
    }
    e.preventDefault()
  }

  function onTrackMove(e) {
    const dr = dragRef.current
    if (!dr) return
    const w = trackW(); const t = xToT(localX(e, trackRef), w)
    if (dr.type === 'create') {
      setDraft({ start: Math.min(dr.t0, t), end: Math.max(dr.t0, t) })
    } else if (dr.type === 'move') {
      const len = dr.origEnd - dr.origStart
      const ns = Math.max(0, Math.min(duration - len, dr.origStart + (t - dr.t0)))
      onUpdate(dr.id, ns, ns + len)
    } else if (dr.type === 'resize-left') {
      onUpdate(dr.id, Math.min(dr.origEnd - MIN_DUR, Math.max(0, t)), dr.origEnd)
    } else if (dr.type === 'resize-right') {
      onUpdate(dr.id, dr.origStart, Math.max(dr.origStart + MIN_DUR, Math.min(duration, t)))
    }
  }

  function onTrackUp(e) {
    const dr = dragRef.current
    if (!dr) return
    dragRef.current = null
    if (dr.type === 'create') {
      const elapsed = Date.now() - dr.startedAt
      const d = draft
      setDraft(null)
      if (elapsed < 200 || !d || d.end - d.start < MIN_DUR) {
        onSeek(xToT(localX(e, trackRef), trackW()))
      } else {
        onAdd(d.start, d.end)
      }
    }
  }

  // --- Wheel zoom (Alt + wheel zooms around cursor) ---
  function onWheel(e) {
    if (!e.altKey) return
    e.preventDefault()
    const w = trackW()
    const mt = xToT(localX(e, trackRef), w)
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (e.deltaY < 0 ? 1.25 : 0.8)))
    const ndur = duration / nz
    const mx = localX(e, trackRef) / w
    setZoom(nz)
    setViewStart(Math.max(0, Math.min(duration - ndur, mt - mx * ndur)))
  }

  function zoomTo(nz) {
    nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nz))
    const center = vs + viewDur / 2
    const ndur = duration / nz
    setZoom(nz)
    setViewStart(Math.max(0, Math.min(duration - ndur, center - ndur / 2)))
  }

  // --- Minimap interactions ---
  function onMiniDown(e) {
    const w = miniW(); const x = localX(e, miniRef)
    const winL = (vs / duration) * w
    const winR = ((vs + viewDur) / duration) * w
    if (x >= winL - EDGE && x <= winL + EDGE) {
      miniDragRef.current = { type: 'resize-left' }
    } else if (x >= winR - EDGE && x <= winR + EDGE) {
      miniDragRef.current = { type: 'resize-right' }
    } else if (x > winL && x < winR) {
      miniDragRef.current = { type: 'pan', offset: x - winL }
    } else {
      // recenter
      const ct = (x / w) * duration
      setViewStart(Math.max(0, Math.min(maxViewStart, ct - viewDur / 2)))
      miniDragRef.current = { type: 'pan', offset: viewDur / duration * w / 2 }
    }
    e.preventDefault()
  }

  function onMiniMove(e) {
    const md = miniDragRef.current
    if (!md) return
    const w = miniW(); const x = localX(e, miniRef)
    if (md.type === 'pan') {
      const newL = (x - md.offset) / w * duration
      setViewStart(Math.max(0, Math.min(maxViewStart, newL)))
    } else if (md.type === 'resize-left') {
      const newStart = (x / w) * duration
      const end = vs + viewDur
      const nd = Math.max(duration / MAX_ZOOM, Math.min(duration, end - newStart))
      setZoom(duration / nd)
      setViewStart(Math.max(0, end - nd))
    } else if (md.type === 'resize-right') {
      const newEnd = (x / w) * duration
      const nd = Math.max(duration / MAX_ZOOM, Math.min(duration - vs, newEnd - vs))
      setZoom(duration / nd)
    }
  }
  function onMiniUp() { miniDragRef.current = null }

  // --- Delete focused pending clip ---
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

  // Adaptive ruler ticks
  const step = viewDur > 1800 ? 300 : viewDur > 600 ? 120 : viewDur > 300 ? 60 : viewDur > 60 ? 30 : viewDur > 20 ? 10 : 5
  const ticks = []
  for (let t = Math.ceil(vs / step) * step; t <= vs + viewDur; t += step) ticks.push(t)

  return (
    <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      {/* (a) Zoom control bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>TIMELINE</span>
        <span style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          {fmtClock(vs)} – {fmtClock(vs + viewDur)} sur {fmtClock(duration)}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => zoomTo(zoom - 0.5)} style={zBtn}>−</button>
        <input
          type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.5} value={zoom}
          onChange={e => zoomTo(Number(e.target.value))}
          style={{ width: 120, color: 'var(--accent)' }}
        />
        <button onClick={() => zoomTo(zoom + 0.5)} style={zBtn}>+</button>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', minWidth: 34 }}>{zoom.toFixed(1)}×</span>
        <button onClick={() => { setZoom(1); setViewStart(0) }} style={{ ...zBtn, width: 'auto', padding: '0 8px' }}>Tout voir</button>
      </div>

      {/* (b) Main zoomed timeline */}
      <div
        ref={trackRef}
        onMouseDown={onTrackDown}
        onMouseMove={onTrackMove}
        onMouseUp={onTrackUp}
        onMouseLeave={onTrackUp}
        onWheel={onWheel}
        style={{ position: 'relative', height: 88, background: 'var(--bg)', cursor: 'crosshair', userSelect: 'none', overflow: 'hidden' }}
      >
        {/* Ruler */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          {ticks.map((t, i) => {
            const x = ((t - vs) / viewDur) * 100
            const major = i % 2 === 0
            return (
              <div key={t} style={{ position: 'absolute', left: `${x}%`, top: 0, height: '100%', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: 6, width: 1, height: major ? 8 : 5, background: 'var(--border3)' }} />
                {major && (
                  <div style={{ position: 'absolute', top: 2, left: 3, fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                    {fmtClock(t)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Pinstripe */}
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, bottom: 0, backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(255,255,255,0.02) 24px, rgba(255,255,255,0.02) 25px)' }} />

        {/* Saved clips */}
        {savedClips.map(c => {
          const l = ((c.start - vs) / viewDur) * 100
          const w = ((c.end - c.start) / viewDur) * 100
          return (
            <div key={c.clip_id} title={c.name} style={{
              position: 'absolute', top: 24, bottom: 6, left: `${l}%`, width: `${w}%`,
              background: 'rgba(94,194,124,0.16)', border: '1px solid var(--success)',
              borderRadius: 4, pointerEvents: 'none', display: 'flex', alignItems: 'center', paddingLeft: 5,
            }}>
              <span style={{ fontSize: 9, color: 'var(--success)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                ✓ {c.name}
              </span>
            </div>
          )
        })}

        {/* Pending clips */}
        {pendingClips.map((c, idx) => {
          const focused = focusedId === c._id
          const l = ((c.start - vs) / viewDur) * 100
          const w = ((c.end - c.start) / viewDur) * 100
          return (
            <div key={c._id}>
              <div style={{
                position: 'absolute', top: 24, bottom: 6, left: `${l}%`, width: `${w}%`,
                background: 'rgba(245,197,24,0.13)',
                border: `1.5px solid ${focused ? 'var(--accent)' : 'rgba(245,197,24,0.6)'}`,
                borderRadius: 4, cursor: 'grab',
              }}>
                <div style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', background: 'rgba(245,197,24,0.5)' }} />
                <div style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', background: 'rgba(245,197,24,0.5)' }} />
              </div>
              <div style={{
                position: 'absolute', top: 10, left: `${l}%`,
                fontSize: 9, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)',
                pointerEvents: 'none', whiteSpace: 'nowrap',
              }}>
                #{idx + 1}
              </div>
            </div>
          )
        })}

        {/* Draft */}
        {draft && draft.end - draft.start > 0.01 && (() => {
          const l = ((draft.start - vs) / viewDur) * 100
          const w = ((draft.end - draft.start) / viewDur) * 100
          return (
            <div style={{
              position: 'absolute', top: 24, bottom: 6, left: `${l}%`, width: `${w}%`,
              border: '2px dashed var(--accent)', borderRadius: 4, pointerEvents: 'none',
            }}>
              <div style={{ position: 'absolute', top: -14, left: 0, fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                {(draft.end - draft.start).toFixed(1)}s
              </div>
            </div>
          )
        })()}

        {/* Playhead */}
        {currentTime >= vs && currentTime <= vs + viewDur && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${((currentTime - vs) / viewDur) * 100}%`, width: 2,
            background: 'var(--text)', transform: 'translateX(-1px)', pointerEvents: 'none', zIndex: 10,
            boxShadow: '0 0 6px rgba(255,255,255,.4)',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0,
              borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid var(--text)',
            }} />
          </div>
        )}
      </div>

      {/* (c) Overview minimap */}
      <div
        ref={miniRef}
        onMouseDown={onMiniDown}
        onMouseMove={onMiniMove}
        onMouseUp={onMiniUp}
        onMouseLeave={onMiniUp}
        style={{ position: 'relative', height: 28, background: 'var(--bg2)', borderTop: '1px solid var(--border)', cursor: 'pointer', userSelect: 'none', overflow: 'hidden' }}
      >
        {savedClips.map(c => (
          <div key={c.clip_id} style={{
            position: 'absolute', top: 9, height: 10,
            left: `${(c.start / duration) * 100}%`, width: `${((c.end - c.start) / duration) * 100}%`,
            background: 'var(--success)', opacity: 0.7, borderRadius: 2,
          }} />
        ))}
        {pendingClips.map(c => (
          <div key={c._id} style={{
            position: 'absolute', top: 9, height: 10,
            left: `${(c.start / duration) * 100}%`, width: `${((c.end - c.start) / duration) * 100}%`,
            background: 'var(--accent)', opacity: 0.7, borderRadius: 2,
          }} />
        ))}
        {/* Playhead */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(currentTime / duration) * 100}%`, width: 1.5, background: 'var(--text)', opacity: 0.6 }} />
        {/* View window */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${(vs / duration) * 100}%`, width: `${(viewDur / duration) * 100}%`,
          background: 'rgba(245,197,24,0.10)', border: '1px solid var(--accent)', boxSizing: 'border-box',
        }}>
          <div style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
          <div style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
        </div>
      </div>

      {/* (d) Helper tip */}
      <div style={{ padding: '6px 12px', background: 'var(--bg)', fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span>Cliquer-glisser pour créer un clip</span>
        <span>⌥ + molette pour zoomer</span>
        <span>Suppr retirer le bloc</span>
      </div>
    </div>
  )
}

const zBtn = {
  minWidth: 30, height: 30, background: 'var(--surface2)', color: 'var(--text2)',
  border: '1px solid var(--border2)', borderRadius: 9, fontSize: 14, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
