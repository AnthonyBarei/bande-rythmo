import React, { useState } from 'react'
import { Icon, ICONS } from '../Icons'

const NAV = [
  { id: 'import',   icon: ICONS.upload,   label: 'Importer' },
  { id: 'clips',    icon: ICONS.grid,     label: 'Mes Clips' },
  { id: 'memes',    icon: ICONS.smile,    label: 'Memes' },
]
const NAV2 = [
  { id: 'activity', icon: ICONS.activity, label: 'Activité' },
  { id: 'settings', icon: ICONS.settings, label: 'Réglages' },
]

function RailItem({ it, active, badge, onNavigate }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={() => onNavigate(it.id)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      title={it.label}
      style={{
        position: 'relative', width: 52, height: 50, borderRadius: 12, border: `1px solid ${active ? 'rgba(245,197,24,0.28)' : 'transparent'}`,
        background: active ? 'var(--accent-soft)' : (h ? 'var(--surface2)' : 'transparent'),
        color: active ? 'var(--accent)' : (h ? 'var(--text)' : 'var(--text3)'),
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        cursor: 'pointer', transition: 'background 0.14s, color 0.14s',
      }}
    >
      {active && (
        <span style={{ position: 'absolute', left: -9, top: 13, width: 3, height: 24, background: 'var(--accent)', borderRadius: 2 }} />
      )}
      <Icon d={it.icon} size={19} sw={active ? 2 : 1.75} />
      <span style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: 0.2, color: active ? 'var(--accent)' : 'var(--text4)' }}>{it.label}</span>
      {badge && (
        <span style={{ position: 'absolute', top: 5, right: 7, width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', border: '1.5px solid var(--bg2)' }} />
      )}
    </button>
  )
}

export default function Sidebar({ section, onNavigate, clipCount }) {
  return (
    <aside style={{
      width: 64, flexShrink: 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 6,
    }}>
      {/* logo */}
      <div style={{
        width: 38, height: 38, borderRadius: 11, background: 'var(--accent)', marginBottom: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 18px rgba(245,197,24,0.4)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 12, color: '#000' }}>BR</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {NAV.map(it => (
          <RailItem key={it.id} it={it} active={section === it.id} badge={it.id === 'clips' && clipCount > 0} onNavigate={onNavigate} />
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {NAV2.map(it => (
          <RailItem key={it.id} it={it} active={section === it.id} onNavigate={onNavigate} />
        ))}
      </nav>

      <div style={{
        marginTop: 6, writingMode: 'vertical-rl', fontFamily: 'var(--font-mono)',
        fontSize: 8, color: 'var(--text4)', letterSpacing: 1, paddingBottom: 2,
      }}>
        WHISPER · BASE
      </div>
    </aside>
  )
}
