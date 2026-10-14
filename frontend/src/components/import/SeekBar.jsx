import React, { useRef, useState, useEffect } from 'react'
import { T, alpha } from '../../ui'
import { fmtSMPTE } from '../../utils/timecode'

const TIP_HALF = 42

// Reference screen-import.jsx Preview — seek bar: click / drag anywhere,
// played part accent 88, IN→OUT range info 33, hover timecode.
export default function SeekBar({ t, duration, fps, markIn, markOut, onScrubStart, onScrub, onScrubEnd }) {
  const trackRef = useRef(null)
  const cleanupRef = useRef(null)
  const [hover, setHover] = useState(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  const timeAt = e => {
    const box = trackRef.current.getBoundingClientRect()
    const f = Math.max(0, Math.min(1, (e.clientX - box.left) / (box.width || 1)))
    return f * duration
  }
  const pct = v => (duration > 0 ? Math.max(0, Math.min(100, (v / duration) * 100)) : 0)

  function onPointerDown(e) {
    if (e.button !== 0 || !duration) return
    e.preventDefault()
    onScrubStart()
    onScrub(timeAt(e))
    const move = ev => onScrub(timeAt(ev))
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      cleanupRef.current = null
      onScrubEnd()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    cleanupRef.current = stop
  }

  function onPointerMove(e) {
    if (!duration) return
    const bar = e.currentTarget.getBoundingClientRect()
    const x = Math.max(TIP_HALF, Math.min(bar.width - TIP_HALF, e.clientX - bar.left))
    setHover({ x, t: timeAt(e) })
  }

  const rangeEnd = markOut ?? t
  return (
    <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}
      role="slider" aria-label="Position de lecture" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(t)}
      aria-valuetext={fmtSMPTE(t, fps)} title={duration ? undefined : 'Chargement de la vidéo…'}
      style={{ height: 22, flexShrink: 0, position: 'relative', background: T.surface, borderTop: `1px solid ${T.border}`, cursor: 'pointer', touchAction: 'none' }}>
      <div ref={trackRef} style={{ position: 'absolute', left: 10, right: 10, top: 9, height: 4, borderRadius: 2, background: T.surface3 }}>
        <div style={{ position: 'absolute', left: 0, width: `${pct(t)}%`, top: 0, bottom: 0, background: alpha(T.accent, '88'), borderRadius: 2 }} />
        {markIn != null && (
          <div style={{
            position: 'absolute', left: `${pct(markIn)}%`, width: `${Math.max(0, pct(rangeEnd) - pct(markIn))}%`, top: -3, bottom: -3,
            background: alpha(T.info, '33'), borderLeft: `2px solid ${T.info}`, borderRight: markOut != null ? `2px solid ${T.accent}` : 'none',
          }} />
        )}
        {markIn == null && markOut != null && (
          <div style={{ position: 'absolute', left: `${pct(markOut)}%`, width: 2, top: -3, bottom: -3, background: T.accent, transform: 'translateX(-2px)' }} />
        )}
        <div style={{ position: 'absolute', left: `${pct(t)}%`, top: -4, width: 12, height: 12, borderRadius: '50%', background: T.accent, transform: 'translateX(-50%)', boxShadow: '0 1px 4px rgba(0,0,0,.5)' }} />
      </div>
      {hover && (
        <div style={{
          position: 'absolute', left: hover.x, bottom: 'calc(100% + 4px)', transform: 'translateX(-50%)', padding: '2px 6px', borderRadius: 4,
          background: T.surface2, border: `1px solid ${T.border2}`, fontFamily: T.fontMono, fontSize: 11, color: T.text, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>{fmtSMPTE(hover.t, fps)}</div>
      )}
    </div>
  )
}
