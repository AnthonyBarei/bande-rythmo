import React, { useRef, useState, useEffect } from 'react'
import { Btn, Icon, ICONS, T, alpha } from '../ui'

const EDGE = 8
const MIN_DUR = 0.2
const MIN_ZOOM = 1
const MAX_ZOOM = 20
const LABEL_STEPS = [5, 10, 30, 60, 120, 300, 600, 1800, 3600]
const MAX_LABELS = 10

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
  const [miniDrag, setMiniDrag] = useState(null)
  const miniCleanupRef = useRef(null)

  const viewDur = duration / zoom
  const maxViewStart = Math.max(0, duration - viewDur)
  const vs = Math.min(Math.max(0, viewStart), maxViewStart)

  function trackW() { return trackRef.current?.getBoundingClientRect().width || 1 }
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

  // --- Minimap: drag the viewport window (pan), its edges (zoom), or click elsewhere to center it ---
  function onMiniDown(e) {
    if (e.button !== 0 || !duration) return
    e.preventDefault()
    const box = miniRef.current.getBoundingClientRect()
    const w = box.width || 1
    const xAt = ev => Math.max(0, Math.min(w, ev.clientX - box.left))
    const x = xAt(e)
    const winL = (vs / duration) * w
    const winR = ((vs + viewDur) / duration) * w
    const start0 = vs, end0 = vs + viewDur, maxStart = maxViewStart
    const clampStart = t => Math.max(0, Math.min(maxStart, t))
    let type, offset = 0
    if (Math.abs(x - winL) <= EDGE && winR - winL > 2 * EDGE) type = 'resize-left'
    else if (Math.abs(x - winR) <= EDGE && winR - winL > 2 * EDGE) type = 'resize-right'
    else if (x >= winL && x <= winR) { type = 'pan'; offset = x - winL }
    else {
      type = 'pan'; offset = (winR - winL) / 2
      setViewStart(clampStart((x - offset) / w * duration))
    }
    const move = ev => {
      const mx = xAt(ev)
      if (type === 'pan') {
        setViewStart(clampStart((mx - offset) / w * duration))
      } else if (type === 'resize-left') {
        const nd = Math.max(duration / MAX_ZOOM, Math.min(end0, end0 - (mx / w) * duration))
        setZoom(duration / nd)
        setViewStart(Math.max(0, end0 - nd))
      } else {
        const nd = Math.max(duration / MAX_ZOOM, Math.min(duration - start0, (mx / w) * duration - start0))
        setZoom(duration / nd)
        setViewStart(start0)
      }
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      miniCleanupRef.current = null
      setMiniDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    miniCleanupRef.current = stop
    setMiniDrag(type)
  }

  useEffect(() => () => miniCleanupRef.current?.(), [])

  // React's onWheel is passive → preventDefault is ignored and Alt+wheel also
  // scrolls the page. Attach a non-passive native listener instead.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

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

  // Ruler: labelled ticks every 10 s on short views (coarser when zoomed out), minor tick halfway.
  const labelStep = LABEL_STEPS.find(s => viewDur / s <= MAX_LABELS) || LABEL_STEPS[LABEL_STEPS.length - 1]
  const step = labelStep / 2
  const ticks = []
  for (let t = Math.ceil(vs / step) * step; t <= vs + viewDur; t += step) ticks.push(t)
  const empty = !pendingClips.length && !savedClips.length && !draft

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ height: 38, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: T.fs.micro, letterSpacing: 1.2, color: T.text3, fontWeight: 700 }}>TIMELINE</span>
        <span style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{fmtClock(vs)} – {fmtClock(vs + viewDur)} sur {fmtClock(duration)}</span>
        <span style={{ fontSize: 10.5, color: T.text4, marginLeft: 6, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>glisser pour créer · Alt + molette pour zoomer · Suppr retire le bloc</span>
        <div style={{ flex: 1 }} />
        <Btn size="sm" icon={ICONS.zoomOut} title="Dézoomer" onClick={() => zoomTo(zoom - 0.5)} />
        <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.5} value={zoom} onChange={e => zoomTo(Number(e.target.value))}
          style={{ width: 110, color: T.accent, '--pct': `${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%` }} />
        <Btn size="sm" icon={ICONS.zoomIn} title="Zoomer" onClick={() => zoomTo(zoom + 0.5)} />
        <span style={{ fontSize: T.fs.xs, color: T.accent, fontFamily: T.fontMono, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{zoom.toFixed(1)}×</span>
        <Btn size="sm" onClick={() => { setZoom(1); setViewStart(0) }}>Tout voir</Btn>
      </div>

      {/* track */}
      <div
        ref={trackRef}
        onMouseDown={onTrackDown}
        onMouseMove={onTrackMove}
        onMouseUp={onTrackUp}
        onMouseLeave={onTrackUp}
        style={{ height: 84, position: 'relative', background: 'repeating-linear-gradient(90deg,transparent 0 7px,rgba(255,255,255,.012) 7px 8px)', cursor: 'crosshair', userSelect: 'none', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18, background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
          {ticks.map(t => {
            const major = Math.abs(t / labelStep - Math.round(t / labelStep)) < 1e-6
            return (
              <div key={t} style={{ position: 'absolute', left: `${((t - vs) / viewDur) * 100}%`, top: 0, height: '100%', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', bottom: 0, width: 1, height: major ? 6 : 4, background: T.border3 }} />
                {major && <div style={{ position: 'absolute', top: 2, left: 3, fontSize: 9, color: T.text4, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{fmtClock(t)}</div>}
              </div>
            )
          })}
        </div>
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, bottom: 0 }}>
          {empty && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: T.fs.sm, color: T.text3, pointerEvents: 'none' }}>
              Glissez sur la timeline pour délimiter un clip
            </div>
          )}
          {savedClips.map(c => (
            <div key={c.clip_id} title={c.name} style={{
              position: 'absolute', left: `${((c.start - vs) / viewDur) * 100}%`, width: `${((c.end - c.start) / viewDur) * 100}%`,
              top: 12, bottom: 12, borderRadius: 5, background: 'rgba(94,194,124,.18)', border: `1.5px solid ${T.success}`, minWidth: 4, pointerEvents: 'none',
            }}>
              <div style={{ position: 'absolute', top: -15, left: 0 }}><Icon d={ICONS.check} size={10} stroke={T.success} sw={2.4} /></div>
            </div>
          ))}

          {pendingClips.map((c, idx) => (
            <div key={c._id} style={{
              position: 'absolute', left: `${((c.start - vs) / viewDur) * 100}%`, width: `${((c.end - c.start) / viewDur) * 100}%`,
              top: 12, bottom: 12, borderRadius: 5, background: alpha(T.accent, '26'),
              border: `1.5px solid ${T.accent}`, minWidth: 4, cursor: 'grab',
              boxShadow: focusedId === c._id ? `0 0 0 2px ${alpha(T.accent, '55')}` : 'none',
            }}>
              <div style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
              <div style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
              <div style={{ position: 'absolute', top: -15, left: 0, fontSize: 9, color: T.accent, fontWeight: 700, fontFamily: T.fontMono, whiteSpace: 'nowrap', pointerEvents: 'none' }}>#{idx + 1}</div>
            </div>
          ))}

          {draft && draft.end - draft.start > 0.01 && (
            <div style={{
              position: 'absolute', left: `${((draft.start - vs) / viewDur) * 100}%`, width: `${((draft.end - draft.start) / viewDur) * 100}%`,
              top: 12, bottom: 12, borderRadius: 5, background: 'transparent', border: `2px dashed ${T.accent}`, minWidth: 4, pointerEvents: 'none',
            }}>
              <div style={{ position: 'absolute', top: -15, left: 0, fontSize: 9, color: T.accent, fontWeight: 700, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{(draft.end - draft.start).toFixed(1)}s</div>
            </div>
          )}

          {currentTime >= vs && currentTime <= vs + viewDur && (
            <div style={{ position: 'absolute', left: `${((currentTime - vs) / viewDur) * 100}%`, top: 0, bottom: 0, width: 2, background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,.5)', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 0, left: -5, width: 12, height: 6, background: '#fff', clipPath: 'polygon(0 0,100% 0,50% 100%)' }} />
            </div>
          )}
        </div>
      </div>

      {/* minimap */}
      <div
        ref={miniRef}
        onPointerDown={onMiniDown}
        title="Glisser la fenêtre pour naviguer · clic pour centrer"
        style={{ height: 26, background: T.bg2, borderTop: `1px solid ${T.border}`, position: 'relative', cursor: miniDrag ? (miniDrag === 'pan' ? 'grabbing' : 'ew-resize') : 'pointer', userSelect: 'none', overflow: 'hidden', touchAction: 'none' }}
      >
        {savedClips.map(c => (
          <div key={c.clip_id} style={{ position: 'absolute', left: `${(c.start / duration) * 100}%`, width: `${Math.max(0.4, ((c.end - c.start) / duration) * 100)}%`, top: 6, bottom: 6, background: T.success, opacity: 0.7, borderRadius: 1 }} />
        ))}
        {pendingClips.map(c => (
          <div key={c._id} style={{ position: 'absolute', left: `${(c.start / duration) * 100}%`, width: `${Math.max(0.4, ((c.end - c.start) / duration) * 100)}%`, top: 6, bottom: 6, background: T.accent, opacity: 0.7, borderRadius: 1 }} />
        ))}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(currentTime / duration) * 100}%`, width: 1.5, background: T.text, opacity: 0.6, pointerEvents: 'none' }} />
        <div style={{
          position: 'absolute', left: `${(vs / duration) * 100}%`, width: `${(viewDur / duration) * 100}%`, top: 2, bottom: 2,
          background: alpha(T.accent, miniDrag ? '2e' : '1a'), border: `1px solid ${T.accent}`, borderRadius: 4,
          cursor: miniDrag === 'pan' ? 'grabbing' : 'grab',
        }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 2, pointerEvents: 'none' }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 1.5, height: 8, background: T.accent, borderRadius: 1 }} />)}
          </div>
          <div style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
          <div style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
        </div>
      </div>
    </div>
  )
}
