import React from 'react'
import { Btn, Icon, ICONS, SaveStatus } from '../../ui'
import { TRACK_COLORS } from '../../config/tracks'

const LANGS = [
  { code: 'fr', label: 'FR — Français' },
  { code: 'en', label: 'EN — English' },
  { code: 'es', label: 'ES — Español' },
  { code: 'de', label: 'DE — Deutsch' },
  { code: 'it', label: 'IT — Italiano' },
  { code: 'pt', label: 'PT — Português' },
  { code: 'ja', label: 'JA — 日本語' },
  { code: 'zh', label: 'ZH — 中文' },
  { code: 'ko', label: 'KO — 한국어' },
  { code: 'ru', label: 'RU — Русский' },
  { code: 'ar', label: 'AR — العربية' },
  { code: 'auto', label: '🔍 Auto-détect' },
]

const divider = <div style={{ width: 1, height: 20, background: 'var(--border2)', flexShrink: 0 }} />
const selectStyle = { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 6, height: 32, fontSize: 11, flexShrink: 0, cursor: 'pointer' }

export default function EditorHeader({
  clip, subtitleCount, charList, charMap,
  charFilter, onToggleCharFilter, onClearCharFilter, onAddCharacter,
  lang, setLang, transcribing, onTranscribe,
  translateProvider, translateTarget, setTranslateTarget, translating, onTranslate,
  vocalAvailable, separatingVocals, onSeparateVocals,
  saveStatus, onBack, onToggleExport,
}) {
  const namedChars = charList.filter(c => c)
  const hasSubs = subtitleCount > 0
  return (
    <div style={{ padding: '0 14px', height: 56, flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
      <Btn size="sm" icon={ICONS.back} onClick={onBack} style={{ fontSize: 13 }}>Mes clips</Btn>
      {divider}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.1 }}>{clip.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          {(clip.end - clip.start).toFixed(1)}s · {subtitleCount} réplique{subtitleCount !== 1 ? 's' : ''}{namedChars.length > 0 ? ` · ${namedChars.length} personnage${namedChars.length !== 1 ? 's' : ''}` : ''}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      {/* Character chips — click to filter band + list (multi-select). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', minWidth: 0, maxWidth: 480 }}>
        {namedChars.map(char => {
          const color = TRACK_COLORS[(charMap[char] ?? 0) % TRACK_COLORS.length]
          const active = charFilter.has(char)
          const dimOthers = charFilter.size > 0 && !active
          return (
            <button
              key={char}
              onClick={() => onToggleCharFilter(char)}
              title={active ? `Cliquer pour retirer ${char} du filtre` : `Filtrer sur ${char}`}
              style={{
                padding: '3px 9px 3px 5px', borderRadius: 99,
                background: active ? color.hex + '44' : color.hex + '22',
                border: `1px solid ${active ? color.hex : color.hex + '33'}`,
                color: color.hex,
                fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                opacity: dimOthers ? 0.55 : 1,
                cursor: 'pointer', minHeight: 32,
              }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: color.hex + '22', border: `1px solid ${color.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                {char[0].toUpperCase()}
              </span>
              {char}
            </button>
          )
        })}
        {charFilter.size > 0 && (
          <button
            onClick={onClearCharFilter}
            title="Effacer le filtre"
            style={{
              padding: '3px 9px', borderRadius: 99,
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              color: 'var(--text2)', fontSize: 11, cursor: 'pointer', minHeight: 32,
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            }}>
            <Icon d={ICONS.close} size={12} /> filtré ({charFilter.size})
          </button>
        )}
      </div>
      <Btn size="sm" variant="outline" icon={ICONS.plus} onClick={onAddCharacter} title="Ajouter un personnage"
        style={{ borderStyle: 'dashed', fontWeight: 600 }}>
        Ajouter
      </Btn>
      {divider}
      <select value={lang} onChange={e => setLang(e.target.value)} disabled={transcribing}
        style={{ ...selectStyle, padding: '0 7px' }}>
        {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
      <Btn size="sm" variant={hasSubs ? 'solid' : 'ghost'} active={!hasSubs} icon={ICONS.mic}
        onClick={onTranscribe} disabled={transcribing}
        style={{ fontWeight: 600, ...(hasSubs ? {} : { border: '1px solid var(--accent-ring)' }) }}>
        {transcribing ? '…' : 'Whisper'}
      </Btn>
      {translateProvider?.available && hasSubs && (
        <>
          {divider}
          <select value={translateTarget} onChange={e => setTranslateTarget(e.target.value)} disabled={translating}
            title="Langue cible de traduction"
            style={{ ...selectStyle, padding: '0 6px' }}>
            {LANGS.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
          </select>
          <Btn size="sm" variant="solid" icon={ICONS.globe} onClick={onTranslate} disabled={translating}
            title={`Traduire toutes les répliques en ${translateTarget.toUpperCase()} (${translateProvider.provider}) — annulable`}
            style={{ fontWeight: 600 }}>
            {translating ? '…' : 'Traduire'}
          </Btn>
        </>
      )}
      {vocalAvailable && (
        <>
          {divider}
          <Btn size="sm" variant="solid" icon={ICONS.sliders} onClick={onSeparateVocals} disabled={separatingVocals}
            title="Isoler la voix (VO) de la musique/FX — Demucs"
            style={{ fontWeight: 600 }}>
            {separatingVocals ? '…' : 'Séparer voix'}
          </Btn>
        </>
      )}
      {divider}
      <SaveStatus status={saveStatus} />
      <Btn variant="primary" icon={ICONS.download} onClick={() => onToggleExport?.()} title="Exporter (E)">
        Exporter
      </Btn>
    </div>
  )
}
