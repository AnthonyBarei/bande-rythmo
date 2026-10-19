import React, { useRef } from 'react'
import { T, Icon, ICONS, Btn, Select } from '../../ui'
import { fmtSMPTE } from '../../utils/timecode'
import useElementWidth from './useElementWidth'

const SPEEDS = [{ v: 0.5, l: '0.5×' }, { v: 1, l: '1×' }, { v: 1.5, l: '1.5×' }, { v: 2, l: '2×' }]

// The only transport on screen — reference screen-editor.jsx › Transport.
// FIXES_R6 #4: current TC only (the total is in the video overlay) and a
// compact speed Select.
// FINAL_REVIEW #5: one 50px row down to the 1100px window with the inspector
// open. As the editor column narrows (window or inspector width), shortcut-
// backed buttons drop out first so the scrub keeps ≥ 160px:
//   ≥ FULL_W     everything (reference)
//   ≥ NO_FRAME_W ±1 image hidden (⇧← / ⇧→)
//   ≥ COMPACT_W  réplique −/+ hidden too (Ctrl+← / Ctrl+→), tighter TC/scrub margins
//   otherwise    scrub + speed + volume move to a second surface row (top
//                border, 6px padding) — never a floating bar; row 1 gets the
//                hidden buttons back while they fit (≥ ROW1_FULL_W).
const SCRUB_MIN = 160
const FULL_W = 800
const NO_FRAME_W = 724
const COMPACT_W = 632
const ROW1_FULL_W = 510

export default function Transport({
  currentTime, duration, playing, speed, muted,
  onTogglePlay, onSeek, onSeekEnd, onStepFrame, onPrevSub, onNextSub,
  loopActive, onToggleLoopActive, onChangeSpeed, onToggleMute,
  hasTarget, onSetIn, onSetOut, clipFps = 25,
}) {
  const trackRef = useRef(null)
  const [barRef, barW] = useElementWidth()
  const pct = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0
  const twoRows = barW < COMPACT_W
  const compact = !twoRows && barW < NO_FRAME_W
  const row1Roomy = twoRows && barW >= ROW1_FULL_W
  const showFrame = barW >= FULL_W || row1Roomy
  const showSubNav = barW >= NO_FRAME_W || row1Roomy

  function seekFromX(clientX) {
    const r = trackRef.current?.getBoundingClientRect()
    if (!r || !duration) return
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration)
  }
  function onPointerDown(e) {
    e.preventDefault()
    seekFromX(e.clientX)
    const move = ev => seekFromX(ev.clientX)
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const scrubGroup = (<>
    <div ref={trackRef} onPointerDown={onPointerDown}
      data-transport-scrub style={{ flex: `1 1 ${SCRUB_MIN}px`, minWidth: SCRUB_MIN, height: 6, background: T.surface3, borderRadius: 3, margin: compact ? '0 4px' : '0 8px', position: 'relative', cursor: 'pointer', touchAction: 'none' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: T.accent, borderRadius: 3 }} />
      <div style={{ position: 'absolute', left: `${pct}%`, top: -3, width: 12, height: 12, borderRadius: '50%', background: T.accent, transform: 'translateX(-50%)', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
    </div>
    <span title="Vitesse de lecture" style={{ display: 'inline-flex', flexShrink: 0 }}>
      <Select size="sm" width={64} menuWidth={96} placement="top" value={speed} onChange={onChangeSpeed} options={SPEEDS} />
    </span>
    <Btn size="sm" icon={muted ? ICONS.mute : ICONS.volume} onClick={onToggleMute} title={muted ? 'Activer le son (M)' : 'Couper le son (M)'} />
  </>)
  const row = { minHeight: 50, padding: '0 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, rowGap: 6, borderTop: `1px solid ${T.border}` }

  return (
    <div ref={barRef} data-transport style={{ flexShrink: 0, background: T.surface }}>
      <div style={row}>
        <Btn size="sm" icon={ICONS.skipBack} title="Début (Home)" onClick={() => onSeek(0)} />
        {showFrame && <Btn size="sm" icon={ICONS.prevFrame} title="Image −1 (⇧←)" onClick={() => onStepFrame(-1)} />}
        <button onClick={onTogglePlay} title="Lecture / pause (Espace)" style={{ width: 40, height: 36, borderRadius: T.r.ctl, background: T.accent, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon d={playing ? ICONS.pause : ICONS.play} size={15} stroke="#0b0b0d" fill="#0b0b0d" />
        </button>
        {showFrame && <Btn size="sm" icon={ICONS.nextFrame} title="Image +1 (⇧→)" onClick={() => onStepFrame(1)} />}
        <Btn size="sm" icon={ICONS.skipFwd} title="Fin (End)" onClick={onSeekEnd} />
        {showSubNav && <Btn size="sm" icon={ICONS.prev} title="Réplique précédente (Ctrl+←)" onClick={onPrevSub} />}
        {showSubNav && <Btn size="sm" icon={ICONS.next} title="Réplique suivante (Ctrl+→)" onClick={onNextSub} />}
        <Btn size="sm" icon={ICONS.loop} active={loopActive} onClick={onToggleLoopActive} title="Boucler sur la réplique active/sélectionnée" />
        <Btn size="sm" icon={ICONS.in} onClick={onSetIn} disabled={!hasTarget} title="IN de la réplique au temps courant (I)" />
        <Btn size="sm" icon={ICONS.out} onClick={onSetOut} disabled={!hasTarget} title="OUT de la réplique au temps courant (O)" />
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text2, marginLeft: compact ? 0 : 6, whiteSpace: 'nowrap' }}>{fmtSMPTE(currentTime, clipFps)}</span>
        {!twoRows && scrubGroup}
      </div>
      {twoRows && (
        <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${T.border}` }}>
          {scrubGroup}
        </div>
      )}
    </div>
  )
}
