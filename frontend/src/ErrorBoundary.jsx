import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('UI crash:', error, info?.componentStack)
  }

  resetToLibrary = () => {
    try {
      sessionStorage.setItem('br-nav', JSON.stringify({ section: 'clips' }))
    } catch {
      // storage blocked — reload still recovers
    }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #0b0b0d)', color: 'var(--text, #eee)', fontFamily: 'var(--font-ui, system-ui)', padding: 16 }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Une erreur a interrompu l'interface</div>
          <div style={{ fontSize: 13, color: 'var(--text3, #999)', marginBottom: 20 }}>
            Vos répliques déjà enregistrées sont conservées. Détail : {String(this.state.error?.message || this.state.error)}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => window.location.reload()} style={btn('var(--accent, #f5c518)', '#000')}>Recharger</button>
            <button onClick={this.resetToLibrary} style={btn('transparent', 'inherit')}>Retour à la bibliothèque</button>
          </div>
        </div>
      </div>
    )
  }
}

function btn(background, color) {
  return { background, color, border: '1px solid var(--border2, #333)', borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }
}
