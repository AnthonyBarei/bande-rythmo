import React from 'react'
import { T, Icon, ICONS } from '../../ui'
import { fmtSMPTE } from '../../utils/timecode'
import BRTimeline from '../BRTimeline'

// Full-clip nav bar — reference screen-editor.jsx › TimelineNav, drawn from
// the real clip data by BRTimeline.
export default function TimelineNav({ bandNow, clipFps, boucles, loopRegion, ...timelineProps }) {
  const tc = t => fmtSMPTE(t, clipFps).slice(3)
  // Boucle under the playhead, else the next one, else the first.
  const b = boucles.find(x => bandNow >= x.start && bandNow <= x.end)
    || boucles.filter(x => x.start > bandNow).sort((p, q) => p.start - q.start)[0]
    || boucles[0]
  const loopLabel = loopRegion
    ? `${tc(loopRegion.start)}–${tc(loopRegion.end)}`
    : b ? `B${b.number} ${tc(b.start)}–${tc(b.end)}` : null
  return (
    <div style={{ height: 56, flexShrink: 0, position: 'relative', background: T.bg2, borderTop: `1px solid ${T.border}` }}>
      <BRTimeline currentTime={bandNow} boucles={boucles} {...timelineProps} height={56} />
      <div style={{ position: 'absolute', top: 5, left: 10, fontSize: 9, color: T.text4, letterSpacing: 1, fontWeight: 700, fontFamily: T.fontMono, pointerEvents: 'none' }}>TIMELINE · CLIP ENTIER</div>
      {loopLabel && (
        <div style={{ position: 'absolute', top: 5, right: 10, fontSize: 9, color: T.accent, fontFamily: T.fontMono, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon d={ICONS.loop} size={10} stroke={T.accent} />{loopLabel}
        </div>
      )}
    </div>
  )
}
