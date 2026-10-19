import React from 'react'
import { T, Icon, ICONS, Toggle, SectionLabel } from '../../ui'

// `mark`: a 24-grid sample of the sign as the band draws it (bandRender.js).
const SIGNS = [
  { k: 'labiale', label: 'Labiale', desc: 'b p m · lèvres fermées', col: '#c7ccd4', mark: <rect x="5" y="10.5" width="14" height="3" rx="1" fill="currentColor" stroke="none" /> },
  { k: 'semi', label: 'Semi-fermée', desc: 'w · consonnes douces', col: '#9aa0aa', mark: <line x1="5" y1="12" x2="19" y2="12" strokeDasharray="2 3" /> },
  { k: 'fricative', label: 'Fricative', desc: 'f v · chevron', col: '#aab0ba', mark: <polyline points="7 15 12 9 17 15" /> },
  { k: 'arrondie', label: 'Arrondie', desc: 'o u œ · cercle', col: '#c7ccd4', mark: <circle cx="12" cy="12" r="4.5" /> },
  { k: 'ouverte', label: 'Ouverte', desc: 'a e i · arc', col: '#888', mark: <path d="M6 10a6 6 0 0012 0" /> },
  { k: 'startEnd', label: 'Début / Fin', desc: 'coins aux bornes de la réplique', col: '#c7ccd4', mark: <path d="M9 6H6v12h3M15 6h3v12h-3" /> },
]

function ToggleRow({ label, desc, on, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderBottom: `1px solid ${T.surface2}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text }}>{label}</div>
        {desc && <div style={{ fontSize: 10, color: T.text3 }}>{desc}</div>}
      </div>
      <Toggle on={on} onClick={onClick} color={T.accent} label={label} />
    </div>
  )
}

// Détection tab — reference Inspector › DetPanel.
export default function InspectorDetection({ detection, setDetection, detectionAuto, setDetectionAuto, wordByWord, setWordByWord }) {
  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, marginBottom: 14 }}>
        <Icon d={ICONS.eye} size={17} stroke={detection.layer ? T.accent : T.text3} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: T.fs.sm, fontWeight: 600 }}>Calque détection</div>
          <div style={{ fontSize: 10.5, color: T.text3 }}>signes phonétiques sur les lettres</div>
        </div>
        <Toggle on={detection.layer} onClick={() => setDetection(d => ({ ...d, layer: !d.layer }))} label="Calque détection" />
      </div>
      <SectionLabel style={{ letterSpacing: 1.2, marginBottom: 9 }}>AFFICHAGE</SectionLabel>
      <ToggleRow label="Rendu mot par mot" desc="texte élastique selon les timestamps Whisper · marqueurs d'étirement" on={wordByWord} onClick={() => setWordByWord(v => !v)} />
      <ToggleRow label="Aide auto" desc="signes déduits des lettres quand aucun n'est posé" on={detectionAuto} onClick={() => setDetectionAuto(v => !v)} />
      <SectionLabel style={{ letterSpacing: 1.2, marginBottom: 9, marginTop: 16 }}>TYPES DE SIGNES</SectionLabel>
      {SIGNS.map(s => (
        <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 4px', borderBottom: `1px solid ${T.surface2}` }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: T.surface2, border: `1px solid ${T.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.col }}>
            <Icon d={s.mark} size={16} sw={2} stroke={s.col} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text }}>{s.label}</div>
            <div style={{ fontSize: 10, color: T.text3 }}>{s.desc}</div>
          </div>
          <Toggle on={!!detection[s.k]} onClick={() => setDetection(d => ({ ...d, [s.k]: !d[s.k] }))} color={T.accent} label={s.label} />
        </div>
      ))}
      <div style={{ marginTop: 14, padding: 11, background: T.bg2, border: `1px dashed ${T.border2}`, borderRadius: T.r.ctl, fontSize: 11, color: T.text3, lineHeight: 1.5 }}>
        Clic sur une lettre dans la bande pour cycler son signe manuellement.
      </div>
    </div>
  )
}
