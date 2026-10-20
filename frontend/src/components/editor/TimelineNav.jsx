import React, { useEffect, useRef, useState } from 'react'
import { T, alpha, Icon, ICONS } from '../../ui'
import { fmtSMPTE } from '../../utils/timecode'
import { CURSOR_X_RATIO } from '../band/bandRender'
import BRTimeline from '../BRTimeline'
import useElementWidth from './useElementWidth'

const NAV_H = 56
const LABEL_ROW_H = 16
const ZOOM_MIN = 40
const ZOOM_MAX = 600
const MIN_BLOCK_PX = 18
const EDGE_PX = 8
const SETTLE_MS = 600

// Full-clip nav bar — reference screen-editor.jsx › TimelineNav, drawn from
// the real clip data by BRTimeline. The yellow block is the window the bande
// rythmo shows, with the white playhead at the band's cursor (CURSOR_X_RATIO):
//   body drag   → scrub (the block and the playhead move together)
//   edge drag   → zoom (pxPerSec), anchored on the playhead
//   click/drag outside the block → jump there, then scrub
// While dragging, the block follows the pointer locally; the video seek and
// the zoom are applied once per animation frame (smooth on long clips).
// Boucles and the ⇧-drag loop region are shown, not edited, here.
// The top LABEL_ROW_H strip holds only the labels.
export default function TimelineNav({
  bandNow, clipFps, boucles, loopRegion, duration, viewStart, viewEnd, pxPerSec,
  onSeek, onZoom, onScrubStart, onScrubEnd, ...timelineProps
}) {
  const [boxRef, boxW] = useElementWidth(0)
  // { mode: 'move' | 'l' | 'r' | 'settle', now, span } — 'settle' holds the
  // released position until the last seek lands (no snap-back).
  const [drag, setDrag] = useState(null)
  const frameRef = useRef({ raf: 0, seek: null, zoom: null })
  const dur = duration || timelineProps.waveform?.duration || 0
  const tc = t => fmtSMPTE(t, clipFps).slice(3)

  useEffect(() => () => cancelAnimationFrame(frameRef.current.raf), [])

  useEffect(() => {
    if (drag?.mode !== 'settle') return
    const id = setTimeout(() => setDrag(null), SETTLE_MS)
    return () => clearTimeout(id)
  }, [drag])

  // Coalesce pointer moves into one seek / zoom per frame.
  function schedule(patch) {
    const f = frameRef.current
    Object.assign(f, patch)
    if (f.raf) return
    f.raf = requestAnimationFrame(() => {
      f.raf = 0
      if (f.seek != null) { onSeek?.(f.seek); f.seek = null }
      if (f.zoom != null) { onZoom?.(f.zoom); f.zoom = null }
    })
  }
  function flush() {
    const f = frameRef.current
    cancelAnimationFrame(f.raf)
    f.raf = 0
    if (f.seek != null) { onSeek?.(f.seek); f.seek = null }
    if (f.zoom != null) { onZoom?.(f.zoom); f.zoom = null }
  }

  const span0 = viewEnd > viewStart ? viewEnd - viewStart : 0
  // A settling drag is done once the seek has landed.
  const held = drag && !(drag.mode === 'settle' && Math.abs(bandNow - drag.now) < 0.02)
  const now = held ? drag.now : bandNow
  const span = held ? drag.span : span0

  function startDrag(e, mode) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const box = boxRef.current?.getBoundingClientRect()
    if (!box || !box.width || !dur || !span0 || !pxPerSec) return
    const timeAt = ev => ((ev.clientX - box.left) / box.width) * dur
    const clampT = t => Math.max(0, Math.min(dur, t))
    const bandW = span0 * pxPerSec   // band canvas width: span × pxPerSec is constant
    const minSpan = bandW / ZOOM_MAX, maxSpan = bandW / ZOOM_MIN
    let cur = { mode, now, span: span0 }
    // Outside the block: jump the playhead under the pointer, then scrub.
    if (mode === 'jump') {
      cur = { mode: 'move', now: clampT(timeAt(e)), span: span0 }
      schedule({ seek: cur.now })
    }
    const grab = timeAt(e) - cur.now
    const move = ev => {
      const t = timeAt(ev)
      if (cur.mode === 'move') {
        cur = { ...cur, now: clampT(t - grab) }
        schedule({ seek: cur.now })
      } else {
        const s = cur.mode === 'l' ? (cur.now - t) / CURSOR_X_RATIO : (t - cur.now) / (1 - CURSOR_X_RATIO)
        const next = Math.max(minSpan, Math.min(maxSpan, s))
        cur = { ...cur, span: next }
        schedule({ zoom: Math.round(bandW / next) })
      }
      setDrag(cur)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      flush()
      setDrag(cur.mode === 'move' ? { ...cur, mode: 'settle' } : null)
      if (cur.mode === 'move') onScrubEnd?.()
    }
    if (cur.mode === 'move') onScrubStart?.()
    setDrag(cur)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // Block geometry (% of the bar), clipped to the clip; a tiny window keeps a
  // grabbable width around the playhead.
  let block = null
  if (dur > 0 && span > 0 && boxW > 0) {
    const minSpanVis = (MIN_BLOCK_PX / boxW) * dur
    const visSpan = Math.max(span, minSpanVis)
    const s = now - CURSOR_X_RATIO * visSpan
    const e = s + visSpan
    const cs = Math.max(0, s), ce = Math.min(dur, e)
    block = {
      left: (cs / dur) * 100, width: (Math.max(0, ce - cs) / dur) * 100,
      head: ((now - cs) / Math.max(1e-9, ce - cs)) * 100,
      showL: s >= 0, showR: e <= dur,
    }
  }

  // Label: the loop region, else the boucle under the playhead, else the next one, else the first.
  const sorted = [...boucles].sort((p, q) => p.start - q.start)
  const b = sorted.find(x => now >= x.start && now <= x.end)
    || sorted.find(x => x.start > now)
    || sorted[0]
  const labelRegion = loopRegion ? { kind: 'loop', s: loopRegion.start, e: loopRegion.end }
    : b ? { kind: 'boucle', number: b.number, s: b.start, e: b.end } : null
  const loopLabel = labelRegion
    ? `${labelRegion.kind === 'boucle' ? `B${labelRegion.number} ` : ''}${tc(labelRegion.s)}–${tc(labelRegion.e)}`
    : null

  const scrubbing = drag?.mode === 'move'
  const zooming = drag?.mode === 'l' || drag?.mode === 'r'

  return (
    <div ref={boxRef} style={{ height: NAV_H, flexShrink: 0, position: 'relative', background: T.bg2, borderTop: `1px solid ${T.border}`, userSelect: 'none' }}>
      <BRTimeline duration={duration} boucles={boucles} {...timelineProps} height={NAV_H} labelRowH={LABEL_ROW_H} playhead={false} />
      {dur > 0 && loopRegion && (
        <div style={{
          position: 'absolute', top: LABEL_ROW_H, bottom: 0, pointerEvents: 'none',
          left: `${(loopRegion.start / dur) * 100}%`, width: `${((loopRegion.end - loopRegion.start) / dur) * 100}%`,
          background: alpha(T.accent, '10'), outline: `1px dashed ${alpha(T.accent, '88')}`, outlineOffset: -1,
        }} />
      )}
      {/* Hit area: outside the block = jump + scrub. */}
      <div onPointerDown={e => startDrag(e, 'jump')} title="Cliquer / glisser pour se déplacer"
        style={{ position: 'absolute', top: LABEL_ROW_H, bottom: 0, left: 0, right: 0, cursor: scrubbing ? 'grabbing' : zooming ? 'ew-resize' : 'pointer', touchAction: 'none' }} />
      {block && (
        <div onPointerDown={e => startDrag(e, 'move')}
          title="Glisser pour se déplacer · bords pour zoomer"
          style={{
            position: 'absolute', top: LABEL_ROW_H, bottom: 0, touchAction: 'none',
            left: `${block.left}%`, width: `${block.width}%`,
            background: alpha(T.accent, scrubbing || zooming ? '2a' : '1c'),
            borderLeft: block.showL ? `2px solid ${T.accent}` : 'none', borderRight: block.showR ? `2px solid ${T.accent}` : 'none',
            cursor: scrubbing ? 'grabbing' : zooming ? 'ew-resize' : 'grab',
          }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${block.head}%`, width: 2, marginLeft: -1, background: '#fff', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: 0, left: -4, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #fff' }} />
          </div>
          {[['l', block.showL], ['r', block.showR]].filter(([, show]) => show).map(([side]) => (
            <div key={side} onPointerDown={e => startDrag(e, side)}
              title="Glisser pour zoomer"
              style={{ position: 'absolute', top: 0, bottom: 0, [side === 'l' ? 'left' : 'right']: -(EDGE_PX / 2 + 1), width: EDGE_PX, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}>
              <div style={{ width: 4, height: 18, borderRadius: 2, background: T.accent }} />
            </div>
          ))}
        </div>
      )}
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
