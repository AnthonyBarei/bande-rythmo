import React, { useState } from 'react'
import { T, Icon, ICONS } from '../ui'
import { useSettings } from '../SettingsContext'

// Left icon rail — port of redesign shell.jsx Rail.
const NAV = [
  { id: 'clips',  label: 'Bibliothèque', ic: ICONS.library },
  { id: 'import', label: 'Importer',     ic: ICONS.import },
  { id: 'dub',    label: 'Éditeur',      ic: ICONS.edit },
  { id: 'record', label: 'Studio',       ic: ICONS.mic },
  { id: 'memes',  label: 'Atelier',      ic: ICONS.meme },
]
const NAV2 = [
  { id: 'activity', label: 'Activité', ic: ICONS.activity },
  { id: 'settings', label: 'Réglages', ic: ICONS.settings },
]

function Item({ it, on, go, accent }) {
  const [h, setH] = useState(false)
  return (
    <button data-rd onClick={() => go(it.id)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} title={it.label}
      style={{
        width: 62, height: 52, borderRadius: 13, cursor: 'pointer', position: 'relative',
        background: on ? accent + '18' : (h ? T.surface2 : 'transparent'),
        border: `1px solid ${on ? accent + '44' : 'transparent'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        transition: 'background .14s',
      }}>
      <Icon d={it.ic} size={19} stroke={on ? accent : (h ? T.text : T.text3)} />
      <span style={{ fontSize: 8.5, fontWeight: 600, color: on ? accent : T.text4, letterSpacing: 0, whiteSpace: 'nowrap', maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
    </button>
  )
}

export default function Sidebar({ section, dubMode, onNavigate }) {
  const { settings } = useSettings()
  const accent = settings.accent
  // Éditeur and Studio share the dub section; dubMode says which one is lit.
  const screen = section === 'dub' ? (dubMode === 'record' ? 'record' : 'dub') : section
  return (
    <div style={{ width: 74, flexShrink: 0, background: T.bg2, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 6 }}>
      {/* logo */}
      <div style={{ width: 40, height: 40, borderRadius: 11, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, boxShadow: `0 0 20px ${accent}55` }}>
        <Icon d={ICONS.wave} size={22} stroke="#0b0b0d" />
      </div>
      {NAV.map(it => <Item key={it.id} it={it} on={screen === it.id} go={onNavigate} accent={accent} />)}
      <div style={{ flex: 1 }} />
      {NAV2.map(it => <Item key={it.id} it={it} on={screen === it.id} go={onNavigate} accent={accent} />)}
      <div style={{ writingMode: 'vertical-rl', fontFamily: T.fontMono, fontSize: 8, color: T.text4, letterSpacing: 1, marginTop: 8, paddingBottom: 4 }}>
        WHISPER · {(settings.whisperModel || 'base').toUpperCase()}
      </div>
    </div>
  )
}
