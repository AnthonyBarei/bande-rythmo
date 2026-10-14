import React from 'react'
import { Icon, ICONS, SectionLabel } from '../../ui'
import { TRACK_COLORS } from '../../config/tracks'

function FocusCharacter({
  chars, charMap, subtitles, activeSubtitle, selectedIdx, setSelectedIdx,
  takes, bandNow, comediens, onSetComedien, onRecord, onSeek,
}) {
  const focusChar = activeSubtitle?.character
    || (selectedIdx != null && subtitles[selectedIdx]?.character)
    || chars[0]
  const trackIdx = charMap[focusChar] ?? 0
  const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
  const charIndices = subtitles.map((s, i) => ({ s, i })).filter(({ s }) => (s.character || '') === focusChar)
  const charSubs = charIndices.map(({ s }) => s)
  const totalDur = charSubs.reduce((sum, s) => sum + s.end - s.start, 0)
  const wordCount = charSubs.reduce((n, s) => (s.text && !s.text.startsWith('(')) ? n + s.text.trim().split(/\s+/).filter(Boolean).length : n, 0)
  const wpm = totalDur > 0 ? Math.round(wordCount / totalDur * 60) : 0
  const recorded = new Set(takes.filter(t => (t.character || '') === focusChar && t.subtitle_index != null).map(t => t.subtitle_index))
  const recordedCount = charIndices.filter(({ i }) => recorded.has(i)).length
  const queue = charIndices.filter(({ s }) => s.end >= bandNow).slice(0, 5)
  const stats = [
    ['Répliques', charSubs.length],
    ['Durée', totalDur.toFixed(1) + 's'],
    ['Mot/min', wpm],
    ['Prises', `${recordedCount} / ${charSubs.length}`],
  ]
  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <div style={{ padding: 14, background: color.hex + '14', border: `1px solid ${color.hex}40`, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: color.hex + '22', border: `2px solid ${color.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: color.hex }}>
            {focusChar[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: color.hex }}>{focusChar}</div>
            <input
              value={comediens[focusChar] || ''}
              onChange={e => onSetComedien(focusChar, e.target.value)}
              placeholder="Comédien·ne — nommer…"
              style={{ background: 'none', border: 'none', borderBottom: '1px dashed var(--border2)', color: 'var(--text2)', fontSize: 11, padding: '2px 0', width: '100%', outline: 'none' }}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {stats.map(([k, v]) => (
            <div key={k} style={{ padding: '7px 9px', background: 'var(--surface2)', borderRadius: 5 }}>
              <SectionLabel style={{ textTransform: 'uppercase', marginBottom: 3 }}>{k}</SectionLabel>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{v}</div>
            </div>
          ))}
        </div>
        <button
          onClick={onRecord}
          style={{ marginTop: 10, width: '100%', minHeight: 36, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          <Icon d={ICONS.rec} size={12} fill="#fff" /> Enregistrer la prise
          <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.25)', padding: '1px 5px', borderRadius: 3 }}>R</span>
        </button>
      </div>

      <SectionLabel style={{ textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>File d'attente</SectionLabel>
      {queue.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune réplique à venir.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {queue.map(({ s, i }, qi) => (
            <button key={i} onClick={() => { onSeek(s.start); setSelectedIdx(i) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', minHeight: 32, background: 'var(--surface)', border: `1px solid ${recorded.has(i) ? color.hex + '40' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
              {qi === 0 && <span style={{ fontSize: 11, fontWeight: 700, color: color.hex, background: color.hex + '22', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>SUIVANT</span>}
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.text || '∅'}</span>
              {recorded.has(i) && <Icon d={ICONS.check} size={12} stroke={color.hex} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Distribution({ charList, charMap, subtitles, clipDuration }) {
  return (
    <div style={{ padding: '0 16px 16px', overflow: 'auto' }}>
      <SectionLabel style={{ textTransform: 'uppercase', margin: '4px 0 10px' }}>Distribution</SectionLabel>
      {charList.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Aucune réplique.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {charList.map(char => {
            const trackIdx = charMap[char] ?? 0
            const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
            const charSubs = subtitles.filter(s => (s.character || '') === char)
            const totalDur = charSubs.reduce((sum, s) => sum + s.end - s.start, 0)
            const pct = Math.min(100, clipDuration > 0 ? (totalDur / clipDuration) * 100 : 0)
            return (
              <div key={char || '_default'} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: color.hex + '22', border: `2px solid ${color.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: color.hex }}>
                  {(char || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: color.hex, fontWeight: 600 }}>{char || '(défaut)'}</span>
                    <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{charSubs.length} répl. · {totalDur.toFixed(1)}s</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color.hex, opacity: 0.85, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function InspectorVoix(props) {
  const chars = props.charList.filter(c => c)
  return (
    <>
      {chars.length === 0
        ? <div style={{ padding: 16 }}><p style={{ color: 'var(--text3)', fontSize: 13 }}>Aucun personnage défini.</p></div>
        : <FocusCharacter {...props} chars={chars} />}
      <Distribution charList={props.charList} charMap={props.charMap} subtitles={props.subtitles} clipDuration={props.clipDuration} />
    </>
  )
}
