import React, { useState } from 'react'
import { T, Icon, ICONS, Popover, MenuItem, MenuLabel, Input } from '../../ui'
import { fmtSMPTE } from '../../utils/timecode'
import { parseTimecodeInput } from '../../utils/tcInput'

const LABELS = { from: 'Depuis la réplique courante', all: 'Tout le clip', inout: 'Plage IN/OUT…' }
const SHORT = { from: 'Depuis ici', all: 'Tout le clip', inout: 'IN/OUT' }

// En continu — the recorded range: `Depuis ici · 7 répl.` ▾. IN/OUT are typed
// as timecodes (HH:MM:SS:FF or shorter), Entrée to apply.
export default function RangePicker({ kind, onKind, inout, onInout, count, fps, disabled }) {
  return (
    <Popover align="right" width={280} trigger={(open, toggle) => (
      <button data-rd onClick={() => !disabled && toggle()} title={disabled ? 'Terminer la session pour changer la plage' : 'Plage enregistrée'}
        style={{
          height: 32, padding: '0 10px', borderRadius: T.r.ctl, background: T.surface, border: `1px solid ${open ? T.accent : T.border2}`,
          color: T.text2, fontSize: T.fs.xs, fontFamily: T.fontUI, display: 'inline-flex', alignItems: 'center', gap: 7,
          cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: disabled ? 0.6 : 1,
        }}>
        <Icon d={ICONS.film} size={13} stroke={T.text2} />{SHORT[kind]} · {count} répl.<Icon d={ICONS.chevron} size={12} stroke={T.text3} />
      </button>
    )}>
      {close => (
        <>
          <MenuLabel>Plage enregistrée</MenuLabel>
          {Object.keys(LABELS).map(k => (
            <MenuItem key={k} active={kind === k} onClick={() => { onKind(k); if (k !== 'inout') close() }}>{LABELS[k]}</MenuItem>
          ))}
          {kind === 'inout' && (
            <div style={{ display: 'flex', gap: 8, padding: '6px 10px 8px' }}>
              <TcField label="IN" value={inout.in} fps={fps} onChange={v => onInout({ ...inout, in: v })} />
              <TcField label="OUT" value={inout.out} fps={fps} onChange={v => onInout({ ...inout, out: v })} />
            </div>
          )}
        </>
      )}
    </Popover>
  )
}

function TcField({ label, value, fps, onChange }) {
  const [text, setText] = useState(null)
  const [invalid, setInvalid] = useState(false)
  function commit() {
    if (text == null) return
    const v = parseTimecodeInput(text, fps)
    if (v == null) { setInvalid(true); return }
    onChange(v)
    setText(null)
    setInvalid(false)
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: T.fs.micro, color: T.text3, fontWeight: 700, letterSpacing: 1 }}>
      {label}
      <Input size="sm" value={text ?? fmtSMPTE(value, fps)} aria-label={`Point ${label}`} aria-invalid={invalid}
        onChange={e => { setText(e.target.value); setInvalid(false) }}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { e.stopPropagation(); setText(null); setInvalid(false) } }}
        onBlur={commit}
        style={{ width: 118, borderColor: invalid ? T.danger : undefined }} inputStyle={{ fontFamily: T.fontMono, fontSize: 12 }} />
    </label>
  )
}
