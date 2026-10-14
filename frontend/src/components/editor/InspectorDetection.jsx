import React from 'react'
import { T, Icon, ICONS, Segmented, Toggle } from '../../ui'

const SIGNS = [
  { k: 'labiale', label: 'Labiale', desc: 'b p m · lèvres fermées', col: '#c7ccd4', glyph: '▬' },
  { k: 'semi', label: 'Semi-fermée', desc: 'w · consonnes douces', col: '#9aa0aa', glyph: '⋯' },
  { k: 'fricative', label: 'Fricative', desc: 'f v · chevron', col: '#aab0ba', glyph: '^' },
  { k: 'arrondie', label: 'Arrondie', desc: 'o u œ · cercle', col: '#c7ccd4', glyph: '○' },
  { k: 'ouverte', label: 'Ouverte', desc: 'a e i · arc', col: '#888', glyph: '◡' },
  { k: 'startEnd', label: 'Début / Fin', desc: 'coins aux bornes de la réplique', col: '#c7ccd4', glyph: '▸' },
]

const FONTS = [
  { v: 'atkinson', l: 'Atkinson' }, { v: 'lisible', l: 'Lisible' }, { v: 'cursive', l: 'Manuscrite' },
  { v: 'inter', l: 'Inter' }, { v: 'jetbrains', l: 'Mono' },
]

const sectionLabel = { fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.2, fontWeight: 700, marginBottom: 9 }

function ToggleRow({ label, desc, on, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderBottom: `1px solid ${T.surface2}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text }}>{label}</div>
        {desc && <div style={{ fontSize: 10, color: T.text3 }}>{desc}</div>}
      </div>
      <Toggle on={on} onClick={onClick} color={T.accent} />
    </div>
  )
}

// Détection tab — reference Inspector › DetPanel.
export default function InspectorDetection({ detection, setDetection, detectionAuto, setDetectionAuto, wordByWord, setWordByWord, brFont, setBrFont }) {
  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, marginBottom: 14 }}>
        <Icon d={ICONS.eye} size={17} stroke={detection.layer ? T.accent : T.text3} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: T.fs.sm, fontWeight: 600 }}>Calque détection</div>
          <div style={{ fontSize: 10.5, color: T.text3 }}>signes phonétiques sur les lettres</div>
        </div>
        <Toggle on={detection.layer} onClick={() => setDetection(d => ({ ...d, layer: !d.layer }))} />
      </div>
      <div style={sectionLabel}>AFFICHAGE</div>
      <ToggleRow label="Rendu mot par mot" desc="texte élastique selon les timestamps Whisper · marqueurs d'étirement" on={wordByWord} onClick={() => setWordByWord(v => !v)} />
      <ToggleRow label="Aide auto" desc="signes déduits des lettres quand aucun n'est posé" on={detectionAuto} onClick={() => setDetectionAuto(v => !v)} />
      <div style={{ ...sectionLabel, marginTop: 16 }}>TYPES DE SIGNES</div>
      {SIGNS.map(s => (
        <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 4px', borderBottom: `1px solid ${T.surface2}` }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: T.surface2, border: `1px solid ${T.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.col, fontFamily: T.fontMono, fontSize: 13, fontWeight: 700 }}>
            {s.glyph}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text }}>{s.label}</div>
            <div style={{ fontSize: 10, color: T.text3 }}>{s.desc}</div>
          </div>
          <Toggle on={!!detection[s.k]} onClick={() => setDetection(d => ({ ...d, [s.k]: !d[s.k] }))} color={T.accent} />
        </div>
      ))}
      <div style={{ ...sectionLabel, marginTop: 16, marginBottom: 8 }}>POLICE DE LA BANDE</div>
      <Segmented value={brFont} onChange={setBrFont} options={FONTS} />
      <div style={{ marginTop: 10, padding: 11, background: T.bg2, border: `1px dashed ${T.border2}`, borderRadius: T.r.ctl, fontSize: 11, color: T.text3, lineHeight: 1.5 }}>
        Clic sur une lettre dans la bande pour cycler son signe manuellement.
      </div>
    </div>
  )
}
