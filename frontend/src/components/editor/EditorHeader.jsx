import React, { useRef } from 'react'
import { T, alpha, Btn, Chip, Dot, Avatar, ICONS, Popover, MenuItem, MenuLabel, MenuSep } from '../../ui'
import { TRACK_COLORS } from '../../config/tracks'

const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ru', 'ar']

const SAVE_CHIP = {
  saved:   { color: T.success, label: 'Sauvegardé' },
  saving:  { color: T.text2,   label: 'Sauvegarde…', pulse: true },
  unsaved: { color: T.accent,  label: 'Non sauvegardé' },
  error:   { color: T.danger,  label: 'Erreur' },
}

function LangChips({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '2px 10px 6px' }}>
      {options.map(code => (
        <Chip key={code} active={code === value} onClick={() => onChange(code)}
          style={{ fontFamily: T.fontMono, fontSize: 11, padding: '2px 7px' }}>
          {code.toUpperCase()}
        </Chip>
      ))}
    </div>
  )
}

// Editor top bar — reference screen-editor.jsx Editor › "Top bar".
export default function EditorHeader({
  clip, subtitleCount, clipFps, charList, charMap,
  charFilter, onToggleCharFilter, onClearCharFilter,
  lang, setLang, transcribing, onTranscribe,
  importing, onImportFile,
  translateProvider, translateTarget, setTranslateTarget, translating, onTranslate,
  vocalAvailable, separatingVocals, onSeparateVocals,
  saveStatus, onUndo, onRedo, canUndo, canRedo,
  onBack, onToggleExport, onHelp,
  inspOpen, onToggleInspector,
}) {
  const importRef = useRef(null)
  const namedChars = charList.filter(c => c)
  const hasSubs = subtitleCount > 0
  const save = SAVE_CHIP[saveStatus] || SAVE_CHIP.saved
  return (
    <div style={{ height: 52, flexShrink: 0, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${T.border}`, background: T.surface }}>
      <Btn size="sm" variant="outline" icon={ICONS.chevron} onClick={onBack} title="Retour à mes clips" style={{ transform: 'rotate(90deg)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: T.fs.base, fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clip.name}</span>
        <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>
          {(clip.end - clip.start).toFixed(1)}s · {subtitleCount} réplique{subtitleCount !== 1 ? 's' : ''} · {Math.round(clipFps * 100) / 100} fps
        </span>
      </div>
      <Chip color={save.color} soft style={{ flexShrink: 0, whiteSpace: 'nowrap' }}><Dot color={save.color} size={6} pulse={save.pulse} /> {save.label}</Chip>
      <div style={{ display: 'inline-flex', gap: 2, marginLeft: 2 }}>
        <Btn size="sm" icon={ICONS.undo} title="Annuler (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
        <Btn size="sm" icon={ICONS.redo} title="Rétablir (Ctrl+Y)" onClick={onRedo} disabled={!canRedo} />
      </div>
      <div style={{ flex: 1 }} />
      {namedChars.length > 0 && (
        <span style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1, fontWeight: 600 }}>VOIX</span>
      )}
      {namedChars.map(ch => {
        const hex = TRACK_COLORS[(charMap[ch] ?? 0) % TRACK_COLORS.length].hex
        const on = charFilter.size === 0 || charFilter.has(ch)
        return (
          <button key={ch} onClick={() => onToggleCharFilter(ch)}
            title={charFilter.has(ch) ? `Retirer ${ch} du filtre` : `Filtrer sur ${ch}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 5px', borderRadius: 99, cursor: 'pointer',
              background: on ? alpha(hex, '1c') : T.surface2, border: `1px solid ${on ? alpha(hex, '66') : T.border}`, opacity: on ? 1 : 0.5,
              flexShrink: 0,
            }}>
            <Avatar name={ch} color={hex} size={18} />
            <span style={{ fontSize: T.fs.xs, fontWeight: 600, color: on ? hex : T.text3 }}>{ch}</span>
          </button>
        )
      })}
      {charFilter.size > 0 && (
        <Btn size="sm" icon={ICONS.close} onClick={onClearCharFilter} title={`Effacer le filtre (${charFilter.size})`} />
      )}
      <div style={{ width: 1, height: 22, background: T.border, margin: '0 4px' }} />
      <input ref={importRef} type="file" accept=".srt,.ass,.ssa,.vtt,.detx" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImportFile(f) }} />
      <Popover align="right" width={236} trigger={(o, tog) => <Btn size="sm" variant="solid" active={o} onClick={tog} icon={ICONS.sub} iconR={ICONS.chevron}>Sous-titres</Btn>}>
        {(close) => (<>
          <MenuLabel>Transcription & import</MenuLabel>
          <MenuItem icon={ICONS.sparkle} onClick={() => { if (transcribing) return; close(); onTranscribe() }}>
            {transcribing ? 'Transcription…' : 'Transcrire (Whisper)'}
          </MenuItem>
          <LangChips value={lang} options={[...LANGS, 'auto']} onChange={v => { if (!transcribing) setLang(v) }} />
          <MenuItem icon={ICONS.upload} onClick={() => { if (importing) return; close(); importRef.current?.click() }}>
            {importing ? 'Import…' : 'Importer SRT / ASS / VTT…'}
          </MenuItem>
          {translateProvider?.available && hasSubs && (<>
            <MenuSep />
            <MenuLabel>Traduction · {translateProvider.provider}</MenuLabel>
            <MenuItem icon={ICONS.globe} onClick={() => { if (translating) return; close(); onTranslate() }}>
              {translating ? 'Traduction…' : `Traduire en ${translateTarget.toUpperCase()}`}
            </MenuItem>
            <LangChips value={translateTarget} options={LANGS} onChange={v => { if (!translating) setTranslateTarget(v) }} />
          </>)}
          {vocalAvailable && (<>
            <MenuSep />
            <MenuLabel>Audio</MenuLabel>
            <MenuItem icon={ICONS.sliders} onClick={() => { if (separatingVocals) return; close(); onSeparateVocals() }}>
              {separatingVocals ? 'Séparation…' : 'Séparer la voix (Demucs)'}
            </MenuItem>
          </>)}
          <MenuSep />
          <MenuItem icon={ICONS.download} onClick={() => { close(); onToggleExport?.() }}>Exporter les sous-titres</MenuItem>
        </>)}
      </Popover>
      <Btn size="sm" icon={ICONS.keyboard} title="Raccourcis (?)" onClick={onHelp} />
      <Btn size="sm" icon={ICONS.sidebar} active={inspOpen} onClick={onToggleInspector} title={(inspOpen ? 'Masquer' : 'Afficher') + ' le panneau (\\)'} />
      <Btn size="sm" variant="primary" icon={ICONS.download} onClick={() => onToggleExport?.()} title="Exporter (E)">Exporter</Btn>
    </div>
  )
}
