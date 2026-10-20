import React, { useState } from 'react'
import { Btn, Icon, ICONS, Input, Segmented, T, alpha } from '../../ui'
import { fmtSMPTE } from '../../utils/timecode'
import { parseTimecodeInput } from '../../utils/tcInput'
import VolumeControl from '../VolumeControl'

const SPEEDS = [{ v: 0.5, l: '0.5×' }, { v: 1, l: '1×' }, { v: 2, l: '2×' }]

// Reference screen-import.jsx Preview — control row under the seek bar.
export default function PlayerControls({
  t, duration, fps, playing, speed, looping, markIn, markOut,
  onToggle, onSkip, onFrame, onSeek, onEditStart, onIn, onOut, onLoop, onSpeed, onVolumeUse,
}) {
  return (
    <div style={{ minHeight: 48, flexShrink: 0, padding: '7px 10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, rowGap: 6, background: T.surface }}>
      <Btn size="sm" icon={ICONS.skipBack} title="−10 s (J)" onClick={() => onSkip(-10)} />
      <Btn size="sm" icon={ICONS.prevFrame} title="Image −1 (,)" onClick={() => onFrame(-1)} />
      <button data-rd onClick={onToggle} title="Lecture / pause (Espace)" aria-label={playing ? 'Pause' : 'Lecture'} style={{
        width: 40, height: 34, borderRadius: T.r.ctl, background: T.accent, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon d={playing ? ICONS.pause : ICONS.play} size={15} stroke="#0b0b0d" fill="#0b0b0d" />
      </button>
      <Btn size="sm" icon={ICONS.nextFrame} title="Image +1 (.)" onClick={() => onFrame(1)} />
      <Btn size="sm" icon={ICONS.skipFwd} title="+10 s (L)" onClick={() => onSkip(10)} />
      <TimecodeField t={t} duration={duration} fps={fps} onSeek={onSeek} onEditStart={onEditStart} />
      <div style={{ width: 1, height: 22, background: T.border, margin: '0 4px' }} />
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, padding: 3 }}>
        <button data-rd onClick={onIn} title="Marquer IN (I) · clic droit : aller à IN"
          onContextMenu={e => { e.preventDefault(); if (markIn != null) onSeek(markIn) }}
          style={{
            height: 26, padding: '0 9px', borderRadius: T.r.chip, border: 'none', cursor: 'pointer',
            background: markIn != null ? alpha(T.info, '22') : 'transparent', color: markIn != null ? T.info : T.text2,
            fontFamily: T.fontMono, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          }}>[ IN {markIn != null ? fmtSMPTE(markIn, fps) : '—'}</button>
        <button data-rd onClick={onOut} title="Marquer OUT (O) · clic droit : aller à OUT"
          onContextMenu={e => { e.preventDefault(); if (markOut != null) onSeek(markOut) }}
          style={{
            height: 26, padding: '0 9px', borderRadius: T.r.chip, border: 'none', cursor: 'pointer',
            background: markOut != null ? alpha(T.accent, '22') : 'transparent', color: markOut != null ? T.accent : T.text2,
            fontFamily: T.fontMono, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          }}>OUT {markOut != null ? fmtSMPTE(markOut, fps) : '—'} ]</button>
        <Btn size="sm" icon={ICONS.loop} active={looping} onClick={onLoop}
          title={markIn == null ? 'Marquez un IN d’abord (I)' : looping ? 'Arrêter la boucle' : 'Lire IN → OUT en boucle'}
          style={{ height: 26, minWidth: 26 }} />
      </div>
      <div style={{ flex: 1 }} />
      <Segmented size="sm" value={speed} onChange={onSpeed} options={SPEEDS} />
      <span onPointerDown={onVolumeUse} style={{ display: 'inline-flex' }}><VolumeControl /></span>
    </div>
  )
}

// `HH:MM:SS:FF / total` — click to type a timecode, Entrée seeks, Échap cancels.
function TimecodeField({ t, duration, fps, onSeek, onEditStart }) {
  const [editing, setEditing] = useState(false)
  const [invalid, setInvalid] = useState(false)

  function close() {
    setEditing(false)
    setInvalid(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      const v = parseTimecodeInput(e.currentTarget.value, fps)
      if (v == null) { setInvalid(true); return }
      onSeek(v)
      close()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    }
  }

  if (editing) {
    return (
      <Input autoFocus defaultValue={fmtSMPTE(t, fps)} aria-label="Aller au timecode" aria-invalid={invalid}
        title={invalid ? 'Timecode invalide — HH:MM:SS:FF ou 12:34' : 'HH:MM:SS:FF ou plus court (12:34) · Entrée pour aller · Échap pour annuler'}
        onFocus={e => e.currentTarget.select()} onBlur={close} onKeyDown={onKeyDown} onChange={() => invalid && setInvalid(false)}
        style={{ width: 112, height: 30, padding: '0 8px', marginLeft: 4, flexShrink: 0, borderRadius: T.r.chip, borderColor: invalid ? T.danger : T.accent }}
        inputStyle={{ fontFamily: T.fontMono, fontSize: 12 }} />
    )
  }
  return (
    <button data-rd onClick={() => { onEditStart(); setEditing(true) }} title="Aller au timecode (cliquer pour saisir)" style={{
      height: 30, padding: '0 8px', marginLeft: 4, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: T.r.chip,
      cursor: 'text', fontFamily: T.fontMono, fontSize: 12, color: T.text2, whiteSpace: 'nowrap',
    }}>
      <span style={{ color: T.text }}>{fmtSMPTE(t, fps)}</span> / {fmtSMPTE(duration, fps)}
    </button>
  )
}
