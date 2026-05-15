import React, { useState, useEffect, useRef } from 'react'

const inp = {
  background: 'var(--surface2)',
  color: 'var(--text)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  padding: '6px 10px',
  fontSize: 13,
  width: '100%',
}

function PlexConnect({ onConnected }) {
  const [url, setUrl] = useState('http://localhost:32400')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  async function handleConnect() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/plex/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erreur')
      onConnected(data.server)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Connecter Plex</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
        Trouvez votre token dans Plex Web → ⚙ → XML → attribut <code style={{ color: '#f5c518' }}>X-Plex-Token</code>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>
          URL serveur
          <input value={url} onChange={e => setUrl(e.target.value)} style={{ ...inp, marginTop: 4 }} placeholder="http://localhost:32400" />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>
          Token Plex
          <input value={token} onChange={e => setToken(e.target.value)} style={{ ...inp, marginTop: 4 }} type="password" placeholder="xxxxxxxxxxxxxxxxxxxx" />
        </label>

        {err && <div style={{ fontSize: 12, color: 'var(--danger)', padding: '6px 10px', background: 'rgba(229,69,69,0.1)', borderRadius: 4 }}>{err}</div>}

        <button
          onClick={handleConnect}
          disabled={loading || !token}
          style={{ padding: '8px 16px', background: loading ? '#333' : '#f5c518', color: loading ? '#555' : '#000', fontWeight: 600, fontSize: 13, borderRadius: 4, marginTop: 4 }}
        >
          {loading ? '⏳ Connexion…' : '🔌 Connecter'}
        </button>
      </div>
    </div>
  )
}

function LibraryGrid({ sectionId, onSelect }) {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  async function load(q = '') {
    setLoading(true)
    try {
      const url = `/api/plex/library/${sectionId}?limit=60${q ? `&search=${encodeURIComponent(q)}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      setItems(data.items || [])
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [sectionId])

  function handleSearch(e) {
    const q = e.target.value
    setSearch(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(q), 400)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={search}
          onChange={handleSearch}
          placeholder="Rechercher…"
          style={{ ...inp, width: 'auto', flex: 1 }}
        />
      </div>

      {loading ? (
        <div style={{ padding: 24, color: 'var(--text3)', fontSize: 13 }}>⏳ Chargement…</div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
          {items.map(item => (
            <div
              key={item.rating_key}
              onClick={() => onSelect(item.rating_key)}
              style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)', border: '1px solid var(--border)', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#f5c518'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              {item.thumb
                ? <img src={item.thumb} alt={item.title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', aspectRatio: '2/3', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎬</div>
              }
              <div style={{ padding: '6px 8px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {item.title}
                </div>
                {item.year && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{item.year}</div>}
              </div>
            </div>
          ))}
          {items.length === 0 && <div style={{ gridColumn: '1/-1', color: 'var(--text3)', fontSize: 13 }}>Aucun résultat</div>}
        </div>
      )}
    </div>
  )
}

export default function PlexBrowser({ onSourceSelected }) {
  const [status, setStatus] = useState(null)   // null=loading, {connected, server?, url}
  const [libraries, setLibraries] = useState([])
  const [activeSectionId, setActiveSectionId] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false)
  const [err, setErr] = useState(null)

  async function checkStatus() {
    const res = await fetch('/api/plex/status')
    const data = await res.json()
    setStatus(data)
    if (data.connected) loadLibraries()
  }

  async function loadLibraries() {
    try {
      const res = await fetch('/api/plex/libraries')
      const data = await res.json()
      setLibraries(data)
      if (data.length > 0) setActiveSectionId(data[0].id)
    } catch (_) {}
  }

  useEffect(() => { checkStatus() }, [])

  async function handleSelect(ratingKey) {
    setLoadingItem(true)
    setErr(null)
    try {
      const res = await fetch(`/api/plex/item/${ratingKey}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const item = await res.json()

      if (!item.parts || item.parts.length === 0) throw new Error('Aucun fichier trouvé')

      const part = item.parts[0]
      // Register URL source in files registry
      const sourceId = crypto.randomUUID()
      await fetch(`/api/files/register?source_id=${sourceId}&stream_url=${encodeURIComponent(part.stream_url)}&filename=${encodeURIComponent(part.filename)}`, { method: 'POST' })

      onSourceSelected({
        sourceId,
        filename: part.filename || item.title,
        sourcePath: part.stream_url,  // HTTP URL — ffmpeg reads directly
        url: part.stream_url,          // browser plays directly
        video_streams: part.video_streams,
        audio_streams: part.audio_streams,
        plexTitle: item.title,
        plexYear: item.year,
      })
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoadingItem(false)
    }
  }

  if (!status) return <div style={{ padding: 24, color: 'var(--text3)' }}>⏳ Vérification Plex…</div>

  if (!status.connected) {
    return <PlexConnect onConnected={() => checkStatus()} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Plex header */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)' }}>
        <span style={{ fontSize: 12, color: '#e5a00d', fontWeight: 700 }}>▶ PLEX</span>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{status.server}</span>
        <div style={{ flex: 1 }} />
        {loadingItem && <span style={{ fontSize: 11, color: '#f5c518' }}>⏳ Chargement…</span>}
        {err && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{err}</span>}
        <button onClick={() => { setStatus(null); checkStatus() }} style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: '1px solid var(--border2)', borderRadius: 3, padding: '2px 8px' }}>
          ⚙
        </button>
      </div>

      {/* Library tabs */}
      {libraries.length > 1 && (
        <div style={{ display: 'flex', gap: 2, padding: '6px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
          {libraries.map(lib => (
            <button
              key={lib.id}
              onClick={() => setActiveSectionId(lib.id)}
              style={{
                padding: '4px 12px', fontSize: 12, borderRadius: 4,
                background: activeSectionId === lib.id ? '#f5c518' : 'transparent',
                color: activeSectionId === lib.id ? '#000' : 'var(--text2)',
                border: 'none', cursor: 'pointer', fontWeight: activeSectionId === lib.id ? 600 : 400,
              }}
            >
              {lib.title}
            </button>
          ))}
        </div>
      )}

      {activeSectionId && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <LibraryGrid sectionId={activeSectionId} onSelect={handleSelect} />
        </div>
      )}
    </div>
  )
}
