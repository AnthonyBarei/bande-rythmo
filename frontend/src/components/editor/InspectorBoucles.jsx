import React from 'react'
import { Btn, ICONS } from '../../ui'
import { fmtSMPTE as fmtTC } from '../../utils/timecode'

export default function InspectorBoucles({ boucles, onAdd, onRemove, onSeek, clipFps }) {
  return (
    <div style={{ padding: 16, overflow: 'auto' }}>
      <Btn variant="primary" full icon={ICONS.plus} onClick={onAdd} style={{ marginBottom: 12 }}>
        Boucle au curseur
      </Btn>
      {boucles.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune boucle. Placez le curseur et ajoutez.</p>
      ) : boucles.map(b => (
        <div key={b.number} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 2px 10px', marginBottom: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <button onClick={() => onSeek(b.start)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12, minHeight: 32, padding: 0 }}>B{b.number}</button>
          <span style={{ flex: 1, fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{fmtTC(b.start, clipFps)} — {fmtTC(b.end, clipFps)} · {(b.end - b.start).toFixed(1)}s</span>
          <Btn size="sm" danger icon={ICONS.close} onClick={() => onRemove(b.number)} title="Supprimer" />
        </div>
      ))}
    </div>
  )
}
