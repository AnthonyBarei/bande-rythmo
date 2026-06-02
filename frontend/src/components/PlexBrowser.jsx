import React, { useState, useEffect, useRef } from 'react'
import { Icon, ICONS } from '../Icons'

/* PlexBrowser — restyled per MEME_PLEX_HANDOFF §1.
   Connect: centered 460px card, ▶ PLEX amber wordmark, green probe banner,
            bordered URL/Token, primary Connecter.
   Browser: left sidebar libraries with counts, search pill, ONLINE chip,
            poster grid minmax(180px,1fr), selected accent ring + badge.
*/

const PLEX_AMBER = '#e5a00d'

const inp = {
  background: 'var(--surface2)',
  color: 'var(--text)',
  border: '1px solid var(--border2)',
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  minHeight: 36,
}

function PlexConnect({ onConnected }) {
  const [url, setUrl] = useState('http://localhost:32400')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [detected, setDetected] = useState(null)  // null=probing, false=none, string=found url

  useEffect(() => {
    let cancelled = false
    fetch('/api/plex/probe')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.found) { setDetected(data.url); setUrl(data.url) }
        else setDetected(false)
      })
      .catch(() => { if (!cancelled) setDetected(false) })
    return () => { cancelled = true }
  }, [])

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
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: 24, background: 'var(--bg)',
    }}>
      <div style={{
        width: 460, maxWidth: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '28px 28px 24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 18, fontWeight: 800, color: PLEX_AMBER,
            letterSpacing: 1.5, fontFamily: 'var(--font-mono)',
          }}>
            ▶ PLEX
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Connecter votre serveur</span>
        </div>

        {detected && (
          <div style={{
            fontSize: 12, color: 'var(--success)',
            padding: '8px 12px',
            background: 'rgba(94,194,124,0.10)',
            border: '1px solid rgba(94,194,124,0.35)',
            borderRadius: 6,
            marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>●</span>
            <span>Serveur Plex détecté — <code style={{ fontFamily: 'var(--font-mono)' }}>{detected}</code></span>
          </div>
        )}
        {detected === false && (
          <div style={{
            fontSize: 12, color: 'var(--text3)',
            padding: '8px 12px', background: 'var(--surface2)',
            border: '1px solid var(--border)', borderRadius: 6,
            marginBottom: 14,
          }}>
            Aucun serveur local détecté — saisissez l'URL manuellement.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
            URL serveur
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{ ...inp, marginTop: 4 }}
              placeholder="http://localhost:32400"
            />
          </label>
          <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
            Token Plex
            <input
              value={token}
              onChange={e => setToken(e.target.value)}
              style={{ ...inp, marginTop: 4 }}
              type="password"
              placeholder="••••••••••••••••••••"
            />
            <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--text3)', textTransform: 'none', letterSpacing: 0 }}>
              Plex Web → ⚙ → XML → attribut <code style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>X-Plex-Token</code>
            </span>
          </label>

          {err && (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 12px', background: 'rgba(232,93,93,0.10)', border: '1px solid rgba(232,93,93,0.35)', borderRadius: 6 }}>
              {err}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading || !token}
            style={{
              padding: '10px 18px',
              background: (loading || !token) ? 'var(--surface3)' : 'var(--accent)',
              color: (loading || !token) ? 'var(--text3)' : '#000',
              fontWeight: 600, fontSize: 13,
              borderRadius: 6, marginTop: 4, minHeight: 36,
              cursor: (loading || !token) ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Connexion…' : 'Connecter'}
          </button>

          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 4 }}>
            La connexion reste locale — token stocké uniquement sur votre machine.
          </div>
        </div>
      </div>
    </div>
  )
}

function LibraryGrid({ sectionId, onSelect, selectedKey }) {
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
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text3)', display: 'flex', alignItems: 'center',
          }}>
            <Icon d={ICONS.search} size={14} />
          </span>
          <input
            value={search}
            onChange={handleSearch}
            placeholder="Rechercher dans la bibliothèque…"
            style={{
              ...inp,
              borderRadius: 99,
              paddingLeft: 34,
              background: 'var(--surface)',
            }}
          />
        </div>
        {loading && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Chargement…</span>}
      </div>

      <div style={{
        flex: 1, overflow: 'auto', padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 14,
      }}>
        {items.map(item => {
          const selected = selectedKey === item.rating_key
          return (
            <button
              key={item.rating_key}
              onClick={() => onSelect(item.rating_key)}
              style={{
                position: 'relative',
                cursor: 'pointer',
                borderRadius: 8, overflow: 'hidden',
                background: 'var(--surface)',
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                outline: selected ? '2px solid var(--accent)' : 'none',
                outlineOffset: -2,
                transition: 'border-color 0.15s, transform 0.15s',
                padding: 0,
                textAlign: 'left',
              }}
              onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border2)' }}
              onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              {item.thumb
                ? <img src={item.thumb} alt={item.title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', aspectRatio: '2/3', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
                    <Icon d={ICONS.film} size={28} />
                  </div>
              }
              {selected && (
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  background: 'var(--accent)', color: '#000',
                  fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
                  padding: '2px 7px', borderRadius: 3,
                }}>
                  SÉLECTIONNÉ
                </div>
              )}
              <div style={{ padding: '8px 10px' }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text)',
                  lineHeight: 1.3, overflow: 'hidden',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {item.title}
                </div>
                {item.year && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{item.year}</div>}
              </div>
            </button>
          )
        })}
        {!loading && items.length === 0 && (
          <div style={{ gridColumn: '1/-1', color: 'var(--text3)', fontSize: 13, padding: 24, textAlign: 'center' }}>
            Aucun résultat
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlexBrowser({ onSourceSelected }) {
  const [status, setStatus] = useState(null)   // null=loading, {connected, server?, url}
  const [libraries, setLibraries] = useState([])
  const [activeSectionId, setActiveSectionId] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false)
  const [selectedKey, setSelectedKey] = useState(null)
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
    setSelectedKey(ratingKey)
    try {
      const res = await fetch(`/api/plex/item/${ratingKey}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const item = await res.json()

      if (!item.parts || item.parts.length === 0) throw new Error('Aucun fichier trouvé')

      const part = item.parts[0]
      const sourceId = crypto.randomUUID()
      await fetch(`/api/files/register?source_id=${sourceId}&stream_url=${encodeURIComponent(part.stream_url)}&filename=${encodeURIComponent(part.filename)}`, { method: 'POST' })

      onSourceSelected({
        sourceId,
        filename: part.filename || item.title,
        sourcePath: part.stream_url,
        url: part.stream_url,
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

  if (!status) return <div style={{ padding: 24, color: 'var(--text3)' }}>Vérification Plex…</div>

  if (!status.connected) {
    return <PlexConnect onConnected={() => checkStatus()} />
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      {/* Left sidebar — libraries with item counts */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            fontSize: 14, fontWeight: 800, color: PLEX_AMBER,
            letterSpacing: 1.2, fontFamily: 'var(--font-mono)',
          }}>
            ▶ PLEX
          </span>
        </div>
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {libraries.map(lib => {
            const active = activeSectionId === lib.id
            return (
              <button
                key={lib.id}
                onClick={() => setActiveSectionId(lib.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 5,
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text2)',
                  fontSize: 12.5, fontWeight: active ? 600 : 500,
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  minHeight: 32,
                }}>
                <span style={{ flex: 1 }}>{lib.title}</span>
                {typeof lib.count === 'number' && (
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)',
                    color: 'var(--text3)',
                  }}>{lib.count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar — ONLINE chip + server name */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10.5, fontWeight: 700, letterSpacing: 1,
            color: 'var(--success)',
            padding: '3px 8px', borderRadius: 99,
            background: 'rgba(94,194,124,0.10)',
            border: '1px solid rgba(94,194,124,0.35)',
            fontFamily: 'var(--font-mono)',
          }}>
            ● ONLINE
          </span>
          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{status.server}</span>
          <div style={{ flex: 1 }} />
          {loadingItem && <span style={{ fontSize: 11, color: 'var(--accent)' }}>Chargement…</span>}
          {err && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{err}</span>}
          <button
            onClick={() => { setStatus(null); checkStatus() }}
            title="Recharger"
            style={{
              fontSize: 11, color: 'var(--text3)',
              background: 'transparent', border: '1px solid var(--border2)',
              borderRadius: 5, padding: '4px 10px', minHeight: 28, cursor: 'pointer',
            }}>
            Recharger
          </button>
        </div>

        {activeSectionId && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <LibraryGrid sectionId={activeSectionId} onSelect={handleSelect} selectedKey={selectedKey} />
          </div>
        )}
      </div>
    </div>
  )
}
