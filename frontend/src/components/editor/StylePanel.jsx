import React from 'react'
import { createPortal } from 'react-dom'
import { T, Btn, ICONS, MenuLabel, Segmented, Toggle } from '../../ui'

const STYLE_OPTIONS = [{ v: 'classique', l: 'Classique' }, { v: 'neon', l: 'Neon' }, { v: 'minimal', l: 'Minimal' }]
const PLAYER_OPTIONS = [{ v: 'never', l: 'Masqué' }, { v: 'play', l: 'À la lecture' }, { v: 'always', l: 'Toujours' }]

const row = { display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', marginBottom: 10 }
const valueText = { fontSize: 11, color: T.text2, fontFamily: T.fontMono, flex: 1, textAlign: 'center' }

function RowLabel({ children }) {
  return <span style={{ width: 74, flexShrink: 0, fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.2, color: T.text3, textTransform: 'uppercase' }}>{children}</span>
}

// Affichage panel (view cluster) — set-once band knobs the reference toolbar
// has no slot for: style · décalage · taille · rythmo · sous-titres · police importée.
// Portaled with position:fixed so it opens upward above the band toolbar.
export default function StylePanel({
  anchor, onClose,
  rythmoStyle, setRythmoStyle, brFont, onUploadFont, onDeleteFont,
  brOffset, setBrOffset, fontScale, setFontScale,
  wordByWord, setWordByWord, brInPlayer, setBrInPlayer,
}) {
  return createPortal(
    <div data-popover="affichage" style={{
      position: 'fixed', bottom: anchor.bottom, left: anchor.left, zIndex: 'var(--z-dropdown)', width: 360,
      background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <MenuLabel>Affichage de la bande</MenuLabel>
        <div style={{ flex: 1 }} />
        <Btn size="sm" icon={ICONS.close} onClick={onClose} title="Fermer" />
      </div>

      <div style={row}>
        <RowLabel>Style</RowLabel>
        <Segmented size="sm" value={rythmoStyle} onChange={setRythmoStyle} options={STYLE_OPTIONS} />
      </div>

      <div style={row}>
        <RowLabel>Police</RowLabel>
        <label style={{ flex: 1, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: T.fs.xs, color: T.accent, cursor: 'pointer', padding: '0 8px', border: `1px dashed ${T.border2}`, borderRadius: T.r.ctl }}>
          Importer TTF / OTF…
          <input type="file" accept=".ttf,.otf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUploadFont(f) }} />
        </label>
        {brFont.startsWith('u-') && (
          <Btn size="sm" danger icon={ICONS.trash} onClick={() => onDeleteFont(brFont)} title="Supprimer cette police" />
        )}
      </div>

      <div style={row}>
        <RowLabel>Décalage</RowLabel>
        <input type="range" min={-2} max={2} step={0.05} value={brOffset}
          onChange={e => setBrOffset(parseFloat(e.target.value))}
          style={{ flex: 1, color: 'var(--accent)', '--pct': `${((brOffset + 2) / 4) * 100}%` }} />
        <span style={{ fontSize: 11, color: brOffset !== 0 ? T.accent : T.text2, fontFamily: T.fontMono, minWidth: 50, textAlign: 'right' }}>
          {brOffset >= 0 ? '+' : ''}{brOffset.toFixed(2)}s
        </span>
        {brOffset !== 0 && (
          <Btn size="sm" icon={ICONS.close} onClick={() => setBrOffset(0)} title="Remettre à zéro" />
        )}
      </div>

      <div style={row}>
        <RowLabel>Taille</RowLabel>
        <Btn size="sm" onClick={() => setFontScale(s => Math.max(0.6, s - 0.1))}>A−</Btn>
        <span style={valueText}>{Math.round(fontScale * 100)} %</span>
        <Btn size="sm" onClick={() => setFontScale(s => Math.min(2.0, s + 0.1))}>A+</Btn>
      </div>

      <div style={row}>
        <RowLabel>Rythmo</RowLabel>
        <span style={{ flex: 1, fontSize: T.fs.xs, color: T.text2 }}>Rendu mot par mot</span>
        <Toggle on={wordByWord} onClick={() => setWordByWord(v => !v)} />
      </div>

      <div style={{ ...row, marginBottom: 6 }}>
        <RowLabel>Sous-titres</RowLabel>
        <Segmented size="sm" value={brInPlayer} onChange={setBrInPlayer} options={PLAYER_OPTIONS} />
      </div>
    </div>,
    document.body
  )
}
