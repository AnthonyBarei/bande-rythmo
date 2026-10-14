import React from 'react'
import { T, alpha, Avatar, Btn, Icon, ICONS, Kbd } from '../../ui'
import { TRACK_COLORS } from '../../config/tracks'

const hexOf = (charMap, char) => TRACK_COLORS[(charMap[char || ''] ?? 0) % TRACK_COLORS.length].hex
const sectionLabel = { fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.2, fontWeight: 700, marginBottom: 9 }

// App-only: the focused character's comédien, stats and upcoming queue.
function FocusCharacter({
  chars, charMap, subtitles, activeSubtitle, selectedIdx, setSelectedIdx,
  takes, bandNow, comediens, onSetComedien, onRecord, onSeek,
}) {
  const focusChar = activeSubtitle?.character
    || (selectedIdx != null && subtitles[selectedIdx]?.character)
    || chars[0]
  const hex = hexOf(charMap, focusChar)
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
    <div style={{ marginTop: 18 }}>
      <div style={sectionLabel}>FOCUS</div>
      <div style={{ padding: 12, background: alpha(hex, '0e'), border: `1px solid ${alpha(hex, '33')}`, borderRadius: T.r.ctl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar name={focusChar} color={hex} size={34} ring />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: T.fs.sm, fontWeight: 600, color: hex }}>{focusChar}</div>
            <input
              value={comediens[focusChar] || ''}
              onChange={e => onSetComedien(focusChar, e.target.value)}
              placeholder="Comédien·ne — nommer…"
              style={{ background: 'none', border: 'none', borderBottom: `1px dashed ${T.border2}`, color: T.text2, fontSize: T.fs.micro, fontFamily: T.fontUI, padding: '2px 0', width: '100%', outline: 'none' }}
            />
          </div>
          <Btn size="sm" icon={ICONS.rec} danger onClick={onRecord} title="Enregistrer la prise (R)" style={{ background: T.danger, color: '#fff' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {stats.map(([k, v]) => (
            <div key={k} style={{ padding: '7px 9px', background: T.surface2, borderRadius: 7 }}>
              <div style={{ fontSize: 10, color: T.text3, letterSpacing: 1, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: T.fs.base, fontWeight: 700, color: T.text, fontFamily: T.fontMono }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...sectionLabel, marginTop: 14 }}>FILE D'ATTENTE</div>
      {queue.length === 0 ? (
        <div style={{ fontSize: T.fs.xs, color: T.text3 }}>Aucune réplique à venir.</div>
      ) : queue.map(({ s, i }, qi) => (
        <div key={i} onClick={() => { onSeek(s.start); setSelectedIdx(i) }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 4, background: T.surface2, border: `1px solid ${recorded.has(i) ? alpha(hex, '44') : T.border}`, borderRadius: T.r.ctl, cursor: 'pointer' }}>
          <span style={{ fontSize: 10, fontFamily: T.fontMono, color: T.text3, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
          {qi === 0 && <span style={{ fontSize: 9.5, fontWeight: 700, color: hex, letterSpacing: 1 }}>SUIVANT</span>}
          <span style={{ flex: 1, minWidth: 0, fontSize: T.fs.xs, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.text || '∅'}</span>
          {recorded.has(i) && <Icon d={ICONS.check} size={12} stroke={hex} />}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 10, color: T.text4 }}><Kbd>R</Kbd> enregistrer la réplique</div>
    </div>
  )
}

// Voix tab — reference Inspector › VoixPanel.
export default function InspectorVoix(props) {
  const { charList, charMap, subtitles, clipDuration, onAddCharacter } = props
  const chars = charList.filter(c => c)
  return (
    <div style={{ padding: 14 }}>
      {charList.length === 0 && <div style={{ fontSize: T.fs.xs, color: T.text3, marginBottom: 14 }}>Aucune réplique.</div>}
      {charList.map(char => {
        const hex = hexOf(charMap, char)
        const subs = subtitles.filter(s => (s.character || '') === char)
        const dur = subs.reduce((a, s) => a + (s.end - s.start), 0)
        const pct = Math.min(100, clipDuration > 0 ? (dur / clipDuration) * 100 : 0)
        return (
          <div key={char || '_default'} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <Avatar name={char || '?'} color={hex} size={26} />
              <span style={{ fontSize: T.fs.sm, fontWeight: 600 }}>{char || '(défaut)'}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono }}>{subs.length} répl · {dur.toFixed(1)}s</span>
            </div>
            <div style={{ height: 6, background: T.surface2, borderRadius: 3 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: hex, borderRadius: 3, opacity: 0.8 }} />
            </div>
          </div>
        )
      })}
      <Btn variant="outline" full icon={ICONS.plus} onClick={onAddCharacter} style={{ marginTop: 6 }}>Nouveau personnage</Btn>
      {chars.length > 0 && <FocusCharacter {...props} chars={chars} />}
    </div>
  )
}
