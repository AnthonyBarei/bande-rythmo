import React, { useRef, useState } from 'react'
import { T, alpha, Icon, ICONS } from '../../ui'
import { fmtSMPTE } from '../../utils/timecode'
import BRTimeline from '../BRTimeline'

const NAV_H = 56
const LABEL_ROW_H = 16
const MIN_LOOP = 0.3

// Full-clip nav bar — reference screen-editor.jsx › TimelineNav, drawn from
// the real clip data by BRTimeline. Boucles (and the view-only ⇧-drag loop
// region) are draggable divs over the canvas: body = move, 8px edges = trim.
// Boucles persist on pointer-up through `onBouclesChange` (the DubbingWorkspace
// boucles save path); the loop region updates live through `onLoopRegionChange`.
// The top LABEL_ROW_H strip holds only the labels: canvas marks and the
// boucle regions all start below it (FIXES_R4 #7/#8).
export default function TimelineNav({
  bandNow, clipFps, boucles, loopRegion, onBouclesChange, onLoopRegionChange, duration, ...timelineProps
}) {
  const boxRef = useRef(null)
  const [drag, setDrag] = useState(null)   // { key, s, e }
  const dur = duration || timelineProps.waveform?.duration || 0
  const tc = t => fmtSMPTE(t, clipFps).slice(3)

  const sorted = [...boucles].sort((p, q) => p.start - q.start)
  const regions = sorted.map((b, i) => ({
    key: `b${b.number}`, kind: 'boucle', number: b.number, s: b.start, e: b.end,
    lo: i > 0 ? sorted[i - 1].end : 0,
    hi: i < sorted.length - 1 ? sorted[i + 1].start : dur,
  }))
  if (loopRegion) regions.push({ key: 'loop', kind: 'loop', s: loopRegion.start, e: loopRegion.end, lo: 0, hi: dur })
  const live = r => (drag && drag.key === r.key ? { ...r, s: drag.s, e: drag.e } : r)

  function startDrag(e, region, mode) {
    e.stopPropagation()
    e.preventDefault()
    const box = boxRef.current?.getBoundingClientRect()
    if (!box || !box.width || !dur) return
    const x0 = e.clientX
    const s0 = region.s, e0 = region.e, len = e0 - s0
    // Tolerate pre-existing overlaps: the region may already sit past a neighbour.
    const lo = Math.min(region.lo, s0), hi = Math.max(region.hi, e0)
    let cur = { s: s0, e: e0 }
    const move = ev => {
      const dt = ((ev.clientX - x0) / box.width) * dur
      if (mode === 'move') {
        const s = Math.max(lo, Math.min(hi - len, s0 + dt))
        cur = { s, e: s + len }
      } else if (mode === 'l') {
        cur = { s: Math.max(lo, Math.min(e0 - MIN_LOOP, s0 + dt)), e: e0 }
      } else {
        cur = { s: s0, e: Math.min(hi, Math.max(s0 + MIN_LOOP, e0 + dt)) }
      }
      setDrag({ key: region.key, ...cur })
      if (region.kind === 'loop') onLoopRegionChange?.({ start: cur.s, end: cur.e })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      const changed = Math.abs(cur.s - s0) > 1e-4 || Math.abs(cur.e - e0) > 1e-4
      if (changed && region.kind === 'boucle') {
        onBouclesChange?.(boucles.map(b => (b.number === region.number ? { ...b, start: cur.s, end: cur.e } : b)))
      }
    }
    setDrag({ key: region.key, s: s0, e: e0 })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Label: the dragged region, else the loop region, else the boucle under
  // the playhead, else the next one, else the first.
  const dragged = drag && regions.find(r => r.key === drag.key)
  const b = sorted.find(x => bandNow >= x.start && bandNow <= x.end)
    || sorted.find(x => x.start > bandNow)
    || sorted[0]
  const labelRegion = dragged ? live(dragged)
    : loopRegion ? { kind: 'loop', s: loopRegion.start, e: loopRegion.end }
    : b ? { kind: 'boucle', number: b.number, s: b.start, e: b.end } : null
  const loopLabel = labelRegion
    ? `${labelRegion.kind === 'boucle' ? `B${labelRegion.number} ` : ''}${tc(labelRegion.s)}–${tc(labelRegion.e)}`
    : null

  return (
    <div ref={boxRef} style={{ height: NAV_H, flexShrink: 0, position: 'relative', background: T.bg2, borderTop: `1px solid ${T.border}` }}>
      <BRTimeline currentTime={bandNow} duration={duration} {...timelineProps} height={NAV_H} labelRowH={LABEL_ROW_H} />
      {dur > 0 && regions.map(r0 => {
        const r = live(r0)
        const active = drag?.key === r.key
        return (
          <div key={r.key} onPointerDown={e => startDrag(e, r0, 'move')} onClick={e => e.stopPropagation()}
            title={r.kind === 'boucle' ? `B${r.number} · glisser pour déplacer la boucle · bords pour ajuster` : 'Glisser pour déplacer la boucle · bords pour ajuster'}
            style={{
              position: 'absolute', top: LABEL_ROW_H, bottom: 0, touchAction: 'none',
              left: `${(r.s / dur) * 100}%`, width: `${((r.e - r.s) / dur) * 100}%`,
              background: alpha(T.accent, active ? '26' : '18'),
              borderLeft: `2px solid ${T.accent}`, borderRight: `2px solid ${T.accent}`,
              cursor: active ? 'grabbing' : 'grab',
            }}>
            {['l', 'r'].map(side => (
              <div key={side} onPointerDown={e => startDrag(e, r0, side)} onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', top: 0, bottom: 0, [side === 'l' ? 'left' : 'right']: -5, width: 8, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 4, height: 18, borderRadius: 2, background: T.accent }} />
              </div>
            ))}
          </div>
        )
      })}
      <div style={{ position: 'absolute', top: 0, left: 10, height: LABEL_ROW_H, lineHeight: `${LABEL_ROW_H}px`, fontSize: 9, color: T.text4, letterSpacing: 1, fontWeight: 700, fontFamily: T.fontMono, pointerEvents: 'none', whiteSpace: 'nowrap' }}>TIMELINE · CLIP ENTIER</div>
      {loopLabel && (
        <div style={{
          position: 'absolute', top: 1, right: 10, height: LABEL_ROW_H - 2, boxSizing: 'border-box',
          padding: '1px 6px', borderRadius: 4, background: T.bg2, lineHeight: '12px',
          fontSize: 9, color: T.accent, fontFamily: T.fontMono, pointerEvents: 'none', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Icon d={ICONS.loop} size={10} stroke={T.accent} />{loopLabel}
        </div>
      )}
    </div>
  )
}
