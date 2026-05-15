import React from 'react'

const NAV = [
  { id: 'import',   icon: '⬆', label: 'Importer' },
  { id: 'clips',    icon: '▤',  label: 'Mes Clips' },
  { id: 'memes',    icon: '😂', label: 'Memes' },
  { id: 'settings', icon: '⚙', label: 'Réglages' },
]

export default function Sidebar({ section, onNavigate, clipCount }) {
  return (
    <aside style={{
      width: 200,
      minWidth: 200,
      background: '#0e0e0e',
      borderRight: '1px solid #1e1e1e',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: 3, color: '#f5c518', fontWeight: 'bold' }}>
          BANDE RYTHMO
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, letterSpacing: 1 }}>
          POST-PRODUCTION
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {NAV.map(({ id, icon, label }) => {
          const active = section === id
          const badge = id === 'clips' && clipCount > 0
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 20px',
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? '#f5c518' : 'var(--text2)',
                borderLeft: `2px solid ${active ? '#f5c518' : 'transparent'}`,
                borderRadius: 0,
                textAlign: 'left',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge && (
                <span style={{
                  background: '#f5c518',
                  color: '#000',
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 10,
                  padding: '1px 6px',
                  minWidth: 18,
                  textAlign: 'center',
                }}>
                  {clipCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #1e1e1e', fontSize: 11, color: 'var(--text3)' }}>
        whisper · ffmpeg · local
      </div>
    </aside>
  )
}
