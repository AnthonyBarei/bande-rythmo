import React from 'react'
import { T, alpha, Avatar, Btn, Dot, Icon, ICONS, Kbd, MenuItem, MenuLabel, MenuSep, Popover } from '../../ui'
import { TRACK_COLORS } from '../../config/tracks'
import { fmtSMPTE as fmtTC } from '../../utils/timecode'
import InspectorRepliques from './InspectorRepliques'
import InspectorVoix from './InspectorVoix'
import InspectorDetection from './InspectorDetection'
import InspectorBoucles from './InspectorBoucles'
import InspectorLexique from './InspectorLexique'

const TABS = [
  { id: 'repliques', label: 'Répliques' },
  { id: 'voix', label: 'Voix' },
  { id: 'detection', label: 'Détection' },
  { id: 'boucles', label: 'Boucles' },
  { id: 'lexique', label: 'Lexique' },
]

const hexOf = (charMap, char) => TRACK_COLORS[(charMap[char || ''] ?? 0) % TRACK_COLORS.length].hex

// Active réplique header — reference Inspector › "active réplique header".
// `target` is null only when the clip has zero répliques (empty state).
function TargetHeader({ target, subIdx, charMap, charList, clipFps, onRecord, onSetCharacter, onNewCharacter }) {
  const hex = target ? hexOf(charMap, target.character) : T.text4
  return (
    <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.border}`, background: target ? alpha(hex, '0c') : 'transparent', display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
      <Popover width={200} trigger={(o, tog) => (
        <button onClick={() => { if (target) tog() }} title={target ? 'Réassigner le personnage' : 'Aucune réplique'}
          style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'transparent', border: 'none', cursor: target ? 'pointer' : 'default', padding: 0, flex: 1, minWidth: 0 }}>
          <Avatar name={target ? (target.character || '?') : '—'} color={hex} size={38} ring={!!target} />
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontSize: T.fs.md, fontWeight: 700, color: hex }}>{target ? (target.character || '(défaut)') : 'Aucune réplique'}</span>
              {target && <Icon d={ICONS.chevron} size={12} stroke={T.text3} />}
              {target && <span style={{ fontSize: 9.5, color: T.text3, letterSpacing: 1, fontWeight: 600 }}>· RÉPLIQUE {subIdx + 1}</span>}
            </div>
            <div style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono }}>
              {target
                ? `${fmtTC(target.start, clipFps)} → ${fmtTC(target.end, clipFps)} · ${(target.end - target.start).toFixed(1)}s`
                : 'Transcrivez ou importez des sous-titres'}
            </div>
          </div>
        </button>
      )}>
        {(close) => (<>
          <MenuLabel>Personnage de la réplique</MenuLabel>
          {charList.map(c => {
            const ch = hexOf(charMap, c)
            return (
              <MenuItem key={c || '_def'} active={c === (target?.character || '')} color={ch} onClick={() => { onSetCharacter(c); close() }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={ch} size={8} />{c || '(défaut)'}</span>
              </MenuItem>
            )
          })}
          <MenuSep />
          <MenuItem icon={ICONS.plus} onClick={() => { close(); onNewCharacter() }}>Nouveau personnage…</MenuItem>
        </>)}
      </Popover>
      <Btn size="sm" icon={ICONS.rec} danger disabled={!target} title="Enregistrer dans le Studio (R)" onClick={onRecord}
        style={{ background: T.danger, color: '#fff' }} />
    </div>
  )
}

// Inspector — reference screen-editor.jsx › Inspector (resizable 300–600px).
// `hint` = live band hover hint, moved out of the canvas (F1.2).
export default function Inspector({
  open = true, width = 392, hint,
  rightTab, setRightTab,
  target, subIdx, charMap, charList, clipFps, onRecord,
  onSetTargetCharacter, onNewTargetCharacter,
  repliquesProps, voixProps, detectionProps, bouclesProps, lexiqueProps,
}) {
  return (
    <div style={{ width, flexShrink: 0, display: open ? 'flex' : 'none', flexDirection: 'column', background: T.surface, overflow: 'hidden' }}>
      <TargetHeader target={target} subIdx={subIdx} charMap={charMap} charList={charList} clipFps={clipFps}
        onRecord={onRecord}
        onSetCharacter={onSetTargetCharacter} onNewCharacter={onNewTargetCharacter} />

      <div style={{ display: 'flex', padding: '0 8px', borderBottom: `1px solid ${T.border}`, height: 40, gap: 2, flexShrink: 0 }}>
        {TABS.map(tb => {
          const on = rightTab === tb.id
          return (
            <button key={tb.id} onClick={() => setRightTab(tb.id)} style={{
              flex: 1, padding: '0 4px', background: 'transparent', border: 'none', borderRadius: 0, cursor: 'pointer',
              color: on ? T.accent : T.text2, fontSize: T.fs.xs, fontWeight: on ? 600 : 500, fontFamily: T.fontUI,
              borderBottom: `2px solid ${on ? T.accent : 'transparent'}`, marginBottom: -1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {tb.label}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 'var(--toast-safe-bottom, 0px)' }}>
        {rightTab === 'repliques' && <InspectorRepliques clipFps={clipFps} {...repliquesProps} />}
        {rightTab === 'voix' && <InspectorVoix {...voixProps} />}
        {rightTab === 'detection' && <InspectorDetection {...detectionProps} />}
        {rightTab === 'boucles' && <InspectorBoucles {...bouclesProps} />}
        {rightTab === 'lexique' && <InspectorLexique {...lexiqueProps} />}
      </div>

      <div style={{ padding: '9px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: T.text3, flexShrink: 0 }}>
        {hint
          ? <span title={hint} style={{ color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{hint}</span>
          : <>
            <Kbd>⇧</Kbd><Kbd>↵</Kbd><span style={{ color: T.text4, whiteSpace: 'nowrap' }}>nouvelle réplique</span>
            {rightTab === 'voix' && <><Kbd>R</Kbd><span style={{ color: T.text4, whiteSpace: 'nowrap' }}>enregistrer la réplique</span></>}
          </>}
        <div style={{ flex: 1 }} /><Kbd>?</Kbd><span style={{ color: T.text4 }}>aide</span>
      </div>
    </div>
  )
}
