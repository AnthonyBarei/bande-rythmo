import React from 'react'
import { T, alpha, Btn, ICONS } from '../../ui'
import { fmtSMPTE as fmtTC } from '../../utils/timecode'

// Boucles tab — reference Inspector › LoopPanel. During a nav-bar drag `boucles`
// is the live preview and `liveNumber` the boucle being trimmed/moved.
export default function InspectorBoucles({ boucles, subtitles, onAdd, onRemove, onSeek, clipFps, liveNumber = null }) {
  return (
    <div style={{ padding: 14 }}>
      <Btn variant="primary" full icon={ICONS.plus} onClick={onAdd} style={{ marginBottom: 14 }}>Boucle au curseur</Btn>
      <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.2, fontWeight: 700, marginBottom: 9 }}>BOUCLES · {boucles.length}</div>
      {boucles.length === 0 && (
        <div style={{ fontSize: T.fs.xs, color: T.text3 }}>Aucune boucle. Placez le curseur et ajoutez — au milieu d'une boucle, elle est scindée.</div>
      )}
      {boucles.map(l => (
        <div key={l.number} onClick={() => onSeek(l.start)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', marginBottom: 6, background: alpha(T.accent, '0e'), border: `1px solid ${l.number === liveNumber ? T.accent : alpha(T.accent, '33')}`, borderRadius: T.r.ctl, cursor: 'pointer' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: alpha(T.accent, '22'), color: T.accent, fontWeight: 800, fontFamily: T.fontMono, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>B{l.number}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: T.fs.sm, color: T.text, fontFamily: T.fontMono }}>{fmtTC(l.start, clipFps)} → {fmtTC(l.end, clipFps)}</div>
            <div style={{ fontSize: 10.5, color: T.text3 }}>{(l.end - l.start).toFixed(1)}s · {subtitles.filter(x => x.start >= l.start && x.end <= l.end).length} répliques</div>
          </div>
          <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
            <Btn size="sm" icon={ICONS.trash} onClick={() => onRemove(l.number)} title="Supprimer la boucle" />
          </span>
        </div>
      ))}
    </div>
  )
}
