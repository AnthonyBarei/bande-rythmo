import React from 'react'
import { Icon, ICONS, Kbd } from '../../ui'
import { TRACK_COLORS } from '../../config/tracks'
import { fmtSMPTE as fmtTC } from '../../utils/timecode'
import InspectorRepliques from './InspectorRepliques'
import InspectorVoix from './InspectorVoix'
import InspectorDetection from './InspectorDetection'
import InspectorBoucles from './InspectorBoucles'
import InspectorLexique from './InspectorLexique'

const TABS = [['repliques', 'Répliques'], ['voix', 'Voix'], ['detection', 'Détection'], ['boucles', 'Boucles'], ['lexique', 'Lexique']]

// Active character card — always visible (selected-or-active réplique).
function TargetCard({ target, subIdx, charMap, clipFps, showRecorder, onToggleRecorder }) {
  const trackIdx = target ? (charMap[target.character || ''] ?? 0) : 0
  const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
  return (
    <div style={{ flexShrink: 0, padding: '13px 16px', background: target ? color.hex + '0c' : 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 11 }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, border: `2px solid ${target ? color.hex : 'var(--border2)'}`, background: target ? color.hex + '22' : 'var(--surface2)', boxShadow: target ? `0 0 0 2px ${color.hex}33` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: target ? color.hex : 'var(--text4)', fontFamily: 'var(--font-mono)' }}>
        {target ? (target.character || '?')[0].toUpperCase() : '—'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: target ? color.hex : 'var(--text4)' }}>{target ? (target.character || '(défaut)') : 'Aucune réplique'}</span>
          {target && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: 1 }}>· RÉPLIQUE {subIdx + 1}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          {target
            ? `${fmtTC(target.start, clipFps)} → ${fmtTC(target.end, clipFps)} · ${(target.end - target.start).toFixed(1)}s`
            : 'Sélectionnez ou lancez la lecture'}
        </div>
      </div>
      <button
        onClick={onToggleRecorder}
        disabled={!target}
        title={target ? 'Enregistrer (R)' : 'Aucune réplique'}
        style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: target ? 'var(--danger)' : 'var(--surface2)', boxShadow: target && showRecorder ? '0 0 0 3px var(--danger-soft)' : 'none', border: 'none', cursor: target ? 'pointer' : 'not-allowed', opacity: target ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon d={ICONS.rec} size={13} fill="#fff" />
      </button>
    </div>
  )
}

export default function Inspector({
  width, rightTab, setRightTab,
  target, subIdx, charMap, clipFps, showRecorder, onToggleRecorder,
  repliquesProps, voixProps, detectionProps, bouclesProps, project,
}) {
  return (
    <div style={{ width, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--border)', background: 'var(--bg)' }}>
      <TargetCard target={target} subIdx={subIdx} charMap={charMap} clipFps={clipFps} showRecorder={showRecorder} onToggleRecorder={onToggleRecorder} />

      {/* Tabs — Répliques · Voix · Détection · Boucles · Lexique */}
      <div style={{ flexShrink: 0, height: 40, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'stretch', padding: '0 6px' }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setRightTab(id)} style={{ flex: 1, background: 'none', border: 'none', borderBottom: rightTab === id ? '2px solid var(--accent)' : '2px solid transparent', color: rightTab === id ? 'var(--accent)' : 'var(--text2)', fontSize: 12, fontWeight: rightTab === id ? 600 : 500, cursor: 'pointer', padding: '0 4px', marginBottom: -1, transition: 'color 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {rightTab === 'repliques' && <InspectorRepliques {...repliquesProps} />}
        {rightTab === 'voix' && <InspectorVoix {...voixProps} />}
        {rightTab === 'detection' && <InspectorDetection {...detectionProps} />}
        {rightTab === 'boucles' && <InspectorBoucles {...bouclesProps} />}
        {rightTab === 'lexique' && <InspectorLexique project={project} />}
      </div>

      {/* Footer hints */}
      <div style={{ flexShrink: 0, padding: '6px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Kbd>⇧↵</Kbd> nouvelle réplique
        </span>
        <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Kbd>K</Kbd> pause · <Kbd>I/O</Kbd> in/out
        </span>
      </div>
    </div>
  )
}
