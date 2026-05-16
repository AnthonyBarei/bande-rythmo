import React from 'react'
import { Icon, ICONS } from '../Icons'

const NAV = [
  { id: 'import',   icon: ICONS.upload,   label: 'Importer' },
  { id: 'clips',    icon: ICONS.grid,     label: 'Mes Clips' },
  { id: 'memes',    icon: ICONS.smile,    label: 'Memes' },
  { id: 'settings', icon: ICONS.settings, label: 'Réglages' },
]

export default function Sidebar({ section, onNavigate, clipCount }) {
  return (
    <aside style={{
      width: 56,
      flexShrink: 0,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 12,
    }}>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {NAV.map(({ id, icon, label }) => {
          const active = section === id
          const badge = id === 'clips' && clipCount > 0
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={label}
              style={{
                position: 'relative',
                width: 38,
                height: 38,
                borderRadius: 8,
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {active && (
                <span style={{
                  position: 'absolute', left: -9, top: 9,
                  width: 2, height: 20, background: 'var(--accent)', borderRadius: 1,
                }} />
              )}
              <Icon d={icon} size={19} sw={active ? 2 : 1.7} />
              {badge && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--accent)', border: '1.5px solid var(--bg2)',
                }} />
              )}
            </button>
          )
        })}
      </nav>

      <div style={{
        padding: '14px 0',
        writingMode: 'vertical-rl',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--text4)',
        letterSpacing: 1,
      }}>
        WHISPER · BASE
      </div>
    </aside>
  )
}
