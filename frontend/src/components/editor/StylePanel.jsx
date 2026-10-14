import React from 'react'
import { createPortal } from 'react-dom'
import { Btn, Icon, ICONS, SectionLabel, Segmented } from '../../ui'

const STYLE_OPTIONS = [{ v: 'classique', l: 'Classique' }, { v: 'neon', l: 'Neon' }, { v: 'minimal', l: 'Minimal' }]
const PLAYER_OPTIONS = [{ v: 'never', l: 'Masqué' }, { v: 'play', l: 'À la lecture' }, { v: 'always', l: 'Toujours' }]

const row = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }
const valueText = { fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)', flex: 1, textAlign: 'center' }

function RowLabel({ children }) {
  return <SectionLabel style={{ textTransform: 'uppercase', width: 80, flexShrink: 0 }}>{children}</SectionLabel>
}

// Affichage popover — Style · Police · Zoom · Décalage · Taille · Rythmo · Sous-titres.
export default function StylePanel({
  anchor, onClose,
  rythmoStyle, setRythmoStyle, brFont, setBrFont, uploadedFonts, onUploadFont, onDeleteFont,
  pxPerSec, setPxPerSec, brOffset, setBrOffset, fontScale, setFontScale,
  wordByWord, setWordByWord, brInPlayer, setBrInPlayer,
}) {
  return createPortal(
    <div data-popover="affichage" style={{
      position: 'fixed', bottom: anchor.bottom, left: anchor.left, zIndex: 'var(--z-dropdown)',
      background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12, boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
      padding: 14, width: 360,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <SectionLabel style={{ textTransform: 'uppercase', color: 'var(--text)' }}>Affichage</SectionLabel>
        <div style={{ flex: 1 }} />
        <Btn size="sm" icon={ICONS.close} onClick={onClose} title="Fermer" />
      </div>

      <div style={row}>
        <RowLabel>Style</RowLabel>
        <Segmented size="sm" value={rythmoStyle} onChange={setRythmoStyle} options={STYLE_OPTIONS} />
      </div>

      <div style={row}>
        <RowLabel>Police</RowLabel>
        <select value={brFont} onChange={e => setBrFont(e.target.value)}
          style={{ flex: 1, height: 32, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 5, padding: '0 8px', fontSize: 12 }}>
          <option value="atkinson">Atkinson</option>
          <option value="lisible">Manuscrite lisible</option>
          <option value="cursive">Cursive (Caveat)</option>
          <option value="inter">Inter</option>
          <option value="jetbrains">JetBrains Mono</option>
          {uploadedFonts.length > 0 && <optgroup label="Mes polices">
            {uploadedFonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </optgroup>}
        </select>
      </div>

      <div style={row}>
        <span style={{ width: 80, flexShrink: 0 }} />
        <label style={{ flex: 1, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: 'var(--accent)', cursor: 'pointer', padding: '0 8px', border: '1px dashed var(--accent-ring)', borderRadius: 5 }}>
          <Icon d={ICONS.plus} size={12} /> Importer TTF/OTF
          <input type="file" accept=".ttf,.otf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUploadFont(f) }} />
        </label>
        {brFont.startsWith('u-') && (
          <Btn size="sm" danger icon={ICONS.trash} onClick={() => onDeleteFont(brFont)} title="Supprimer cette police" />
        )}
      </div>

      <div style={row}>
        <RowLabel>Zoom</RowLabel>
        <Btn size="sm" icon={ICONS.zoomOut} onClick={() => setPxPerSec(p => Math.max(40, p - 20))} title="Zoom arrière" />
        <span style={valueText}>{pxPerSec} px/s</span>
        <Btn size="sm" icon={ICONS.zoomIn} onClick={() => setPxPerSec(p => Math.min(600, p + 20))} title="Zoom avant" />
      </div>

      <div style={row}>
        <RowLabel>Décalage</RowLabel>
        <input type="range" min={-2} max={2} step={0.05} value={brOffset}
          onChange={e => setBrOffset(parseFloat(e.target.value))}
          style={{ flex: 1, color: 'var(--accent)', '--pct': `${((brOffset + 2) / 4) * 100}%` }} />
        <span style={{ fontSize: 11, color: brOffset !== 0 ? 'var(--accent)' : 'var(--text2)', fontFamily: 'var(--font-mono)', minWidth: 50, textAlign: 'right' }}>
          {brOffset >= 0 ? '+' : ''}{brOffset.toFixed(2)}s
        </span>
        {brOffset !== 0 && (
          <Btn size="sm" icon={ICONS.close} onClick={() => setBrOffset(0)} title="Reset" />
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text2)', minHeight: 32 }}>
          <input type="checkbox" checked={wordByWord} onChange={e => setWordByWord(e.target.checked)} />
          Rendu mot par mot
        </label>
        <span style={{ fontSize: 11, color: 'var(--text4)', flex: 1, textAlign: 'right' }}>
          {wordByWord
            ? <span style={{ color: 'var(--accent)' }}>▌ marqueurs d'étirement</span>
            : 'ligne entière'}
        </span>
      </div>

      <div style={{ ...row, marginBottom: 0 }}>
        <RowLabel>Sous-titres</RowLabel>
        <Segmented size="sm" value={brInPlayer} onChange={setBrInPlayer} options={PLAYER_OPTIONS} />
      </div>
    </div>,
    document.body
  )
}
