import React, { useState } from 'react'
import { Btn, ICONS, T } from '../ui'
import { usePlayerVolume, setVolumeLevel, toggleMuted } from '../utils/playerVolume'

// Mute button + volume slider shared by every player. `inline={false}` (tight
// bars): the slider opens above the button on hover / keyboard focus.
export default function VolumeControl({ size = 'sm', width = 72, inline = true }) {
  const { volume, muted } = usePlayerVolume()
  const [open, setOpen] = useState(false)
  const silent = muted || volume === 0
  const pct = Math.round((silent ? 0 : volume) * 100)

  const slider = (
    <input type="range" min={0} max={100} step={1} value={pct} aria-label="Volume" title={`Volume ${pct} %`}
      onChange={e => setVolumeLevel(+e.target.value / 100)}
      style={{ width, color: silent ? T.text3 : T.accent, '--pct': `${pct}%`, cursor: 'pointer' }} />
  )
  const button = (
    <Btn size={size} icon={silent ? ICONS.mute : ICONS.volume} onClick={toggleMuted}
      title={silent ? 'Activer le son (M)' : 'Couper le son (M)'} />
  )

  if (inline) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {button}
        {slider}
      </div>
    )
  }
  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {button}
      {open && (
        // paddingBottom bridges the gap so the pointer can reach the panel.
        <div style={{ position: 'absolute', bottom: '100%', right: 0, paddingBottom: 6, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: T.r.ctl, boxShadow: '0 6px 18px rgba(0,0,0,.45)' }}>
            {slider}
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text2, width: 30, textAlign: 'right' }}>{pct}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
