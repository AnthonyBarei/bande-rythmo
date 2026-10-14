import React, { useState } from 'react'
import { Icon, ICONS } from '../Icons'
import { useSettings } from '../SettingsContext'

// Left icon rail — port of redesign shell.jsx Rail.
// 80px, waveform logo, 5 primary + 2 secondary labeled items.
const NAV = [
  { id: 'clips',    icon: ICONS.grid,   label: 'Bibliothèque' },
  { id: 'import',   icon: ICONS.upload, label: 'Importer' },
  { id: 'dub',      icon: ICONS.edit2,  label: 'Éditeur' },
  { id: 'record',   icon: ICONS.mic,    label: 'Studio' },
  { id: 'memes',    icon: ICONS.meme2,  label: 'Atelier' },
]
const NAV2 = [
  { id: 'activity', icon: ICONS.activity, label: 'Activité' },
  { id: 'settings', icon: ICONS.settings, label: 'Réglages' },
]

function RailItem({ it, active, onNavigate }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={() => onNavigate(it.id)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      title={it.label}
      style={{
        position: 'relative', width: 68, height: 54, borderRadius: 13, cursor: 'pointer',
        border: `1px solid ${active ? 'var(--accent-ring)' : 'transparent'}`,
        background: active ? 'var(--accent-soft)' : (h ? 'var(--surface2)' : 'transparent'),
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        transition: 'background 0.14s',
      }}
    >
      {active && <span style={{ position: 'absolute', left: -6, top: 14, bottom: 14, width: 3, background: 'var(--accent)', borderRadius: 2 }} />}
      <Icon d={it.icon} size={19} sw={active ? 2 : 1.85} style={{ color: active ? 'var(--accent)' : (h ? 'var(--text)' : 'var(--text3)') }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text3)', whiteSpace: 'nowrap' }}>{it.label}</span>
    </button>
  )
}

export default function Sidebar({ section, dubMode, onNavigate }) {
  const { settings } = useSettings()
  // Éditeur and Studio share the dub section; dubMode says which one is lit.
  const activeId = section === 'dub' ? (dubMode === 'record' ? 'record' : 'dub') : section
  return (
    <aside style={{
      width: 80, flexShrink: 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 6,
    }}>
      {/* logo — waveform glow */}
      <div style={{
        width: 40, height: 40, borderRadius: 11, background: 'var(--accent)', marginBottom: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 20px var(--accent-glow)',
      }}>
        <Icon d={ICONS.wave} size={22} stroke="#0b0b0d" sw={2} />
      </div>

      {NAV.map(it => <RailItem key={it.id} it={it} active={activeId === it.id} onNavigate={onNavigate} />)}
      <div style={{ flex: 1 }} />
      {NAV2.map(it => <RailItem key={it.id} it={it} active={activeId === it.id} onNavigate={onNavigate} />)}

      <div style={{
        writingMode: 'vertical-rl', fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--text4)', letterSpacing: 1, marginTop: 8, paddingBottom: 2,
      }}>
        WHISPER · {(settings.whisperModel || 'base').toUpperCase()}
      </div>
    </aside>
  )
}
