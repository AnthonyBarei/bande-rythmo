import React from 'react'
import { SectionLabel, Toggle } from '../../ui'

const SIGN_ROWS = [['labiale', 'Labiale (B P M)'], ['semi', 'Semi (W)'], ['fricative', 'Fricative (F V)'], ['arrondie', 'Arrondie (O U Œ)'], ['ouverte', 'Ouverte (A E I…)'], ['startEnd', 'Début / Fin de phrase']]

function DetRow({ label, on, onClick, accent }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--surface2)' }}>
      <span style={{ flex: 1, fontSize: 12.5, color: on ? 'var(--text)' : 'var(--text2)', fontWeight: accent && on ? 600 : 400 }}>{label}</span>
      <Toggle on={on} />
    </div>
  )
}

export default function InspectorDetection({ detection, setDetection, detectionAuto, setDetectionAuto, wordByWord, setWordByWord }) {
  return (
    <div style={{ padding: 16, overflow: 'auto' }}>
      <DetRow label="Calque détection" on={detection.layer} onClick={() => setDetection(d => ({ ...d, layer: !d.layer }))} accent />
      <SectionLabel style={{ textTransform: 'uppercase', margin: '14px 0 6px' }}>Signes phonétiques</SectionLabel>
      {SIGN_ROWS.map(([k, lbl]) => (
        <DetRow key={k} label={lbl} on={!!detection[k]} onClick={() => setDetection(d => ({ ...d, [k]: !d[k] }))} />
      ))}
      <DetRow label="Aide auto (depuis les lettres)" on={detectionAuto} onClick={() => setDetectionAuto(v => !v)} />
      <SectionLabel style={{ textTransform: 'uppercase', margin: '14px 0 6px' }}>Affichage</SectionLabel>
      <DetRow label="Rendu mot par mot" on={wordByWord} onClick={() => setWordByWord(v => !v)} />
    </div>
  )
}
