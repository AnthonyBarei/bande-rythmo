import React, { useState, useEffect, useRef } from 'react'
import { Btn, Dot, Icon, ICONS, SectionLabel, T, alpha } from '../ui'

// Reference screen-import.jsx PlexBrowse — libraries card (200px) + search pill
// + poster grid minmax(150px,1fr). The connect card has no reference screen.

const TYPE_LABEL = { movie: 'Film', show: 'Série', episode: 'Épisode' }

function fmtDur(ms) {
  if (!ms) return ''
  const min = Math.round(ms / 60000)
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`
}

function PlexConnect({ initialUrl, onConnected }) {
  const [url, setUrl] = useState(initialUrl || 'http://localhost:32400')
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      onConnected(data.server)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'auto' }}>
      <div style={{ width: 460, maxWidth: '100%', background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, padding: '24px 24px 20px', boxShadow: T.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Icon d={ICONS.film} size={18} stroke={T.accent} />
          <span style={{ fontSize: T.fs.md, fontWeight: 600 }}>Connecter Plex</span>
          <span style={{ fontSize: T.fs.xs, color: T.text3 }}>serveur local</span>
        </div>

        {detected && (
          <div style={{ fontSize: T.fs.xs, color: T.success, padding: '8px 12px', background: 'rgba(94,194,124,.08)', border: `1px solid ${alpha(T.success, '44')}`, borderRadius: T.r.ctl, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dot color={T.success} size={6} />
            <span>Serveur Plex détecté — <span style={{ fontFamily: T.fontMono }}>{detected}</span></span>
          </div>
        )}
        {detected === false && (
          <div style={{ fontSize: T.fs.xs, color: T.text3, padding: '8px 12px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, marginBottom: 14 }}>
            Aucun serveur local détecté — saisissez l&apos;URL manuellement.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <SectionLabel>URL SERVEUR</SectionLabel>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://localhost:32400"
              style={{ width: '100%', height: 36, marginTop: 6, padding: '0 12px', fontSize: T.fs.sm, background: T.bg2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: T.r.ctl, fontFamily: T.fontMono }} />
          </label>
          <label>
            <SectionLabel>TOKEN PLEX</SectionLabel>
            <input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="X-Plex-Token"
              style={{ width: '100%', height: 36, marginTop: 6, padding: '0 12px', fontSize: T.fs.sm, background: T.bg2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: T.r.ctl }} />
            <span style={{ display: 'block', marginTop: 6, fontSize: T.fs.micro, color: T.text3 }}>
              Plex Web → Paramètres → XML → attribut <span style={{ color: T.accent, fontFamily: T.fontMono }}>X-Plex-Token</span>
            </span>
          </label>

          {err && (
            <div style={{ fontSize: T.fs.xs, color: T.danger, padding: '8px 12px', background: 'rgba(232,89,93,.05)', border: `1px solid ${alpha(T.danger, '44')}`, borderRadius: T.r.ctl }}>
              {err}
            </div>
          )}

          <Btn variant="primary" full icon={ICONS.plug} onClick={handleConnect} disabled={loading || !token} style={{ marginTop: 4 }}>
            {loading ? 'Connexion…' : 'Connecter'}
          </Btn>

          <div style={{ fontSize: T.fs.micro, color: T.text3, textAlign: 'center' }}>
            La connexion reste locale — token stocké uniquement sur votre machine.
          </div>
        </div>
      </div>
    </div>
  )
}

function LibraryGrid({ sectionId, sectionTitle, onSelect, selectedKey, toolbar }) {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState(null)
  const debounceRef = useRef(null)
  const reqRef = useRef(0)

  // Latest request wins — a slow earlier search must not overwrite newer results.
  async function load(q = '') {
    const req = ++reqRef.current
    setLoading(true)
    setLoadErr(null)
    try {
      const url = `/api/plex/library/${sectionId}?limit=60${q ? `&search=${encodeURIComponent(q)}` : ''}`
      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      if (req === reqRef.current) setItems(data.items || [])
    } catch (e) {
      if (req === reqRef.current) { setItems([]); setLoadErr('Bibliothèque inaccessible : ' + e.message) }
    } finally {
      if (req === reqRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    clearTimeout(debounceRef.current)
    load(search)
    return () => clearTimeout(debounceRef.current)
  }, [sectionId])

  function handleSearch(e) {
    const q = e.target.value
    setSearch(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(q), 400)
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99 }}>
          <Icon d={ICONS.search} size={14} stroke={T.text3} />
          <input value={search} onChange={handleSearch} placeholder={`Rechercher dans ${sectionTitle || 'la bibliothèque'}…`}
            style={{ flex: 1, minWidth: 0, padding: 0, background: 'transparent', border: 'none', fontSize: T.fs.sm, color: T.text, boxShadow: 'none' }} />
          {loading && <span style={{ fontSize: T.fs.micro, color: T.text3 }}>Chargement…</span>}
        </div>
        {toolbar}
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, alignContent: 'flex-start' }}>
        {items.map(item => {
          const mine = selectedKey === item.rating_key
          const seed = (item.title || '??').charCodeAt(0) + ((item.title || '??').charCodeAt(1) || 0)
          const sub = [item.year, fmtDur(item.duration)].filter(Boolean).join(' · ')
          return (
            <button key={item.rating_key} data-rd onClick={() => onSelect(item.rating_key)} title={item.title} style={{
              background: T.surface, border: `1px solid ${mine ? T.accent : T.border}`, borderRadius: T.r.ctl, overflow: 'hidden', cursor: 'pointer',
              boxShadow: mine ? `0 0 0 2px ${alpha(T.accent, '33')}` : 'none', padding: 0, textAlign: 'left', color: T.text, display: 'block', width: '100%',
            }}>
              <div style={{ aspectRatio: '2/3', position: 'relative', background: `linear-gradient(135deg,hsl(${seed * 7 % 360},18%,22%),hsl(${seed * 13 % 360},16%,13%))` }}>
                {item.thumb && <img src={item.thumb} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                {mine && <div style={{ position: 'absolute', top: 6, left: 6, padding: '2px 6px', background: T.accent, color: '#0b0b0d', fontSize: 8.5, fontWeight: 800, borderRadius: 3 }}>SÉLECTIONNÉ</div>}
                {sub && <div style={{ position: 'absolute', left: 8, bottom: 8, fontFamily: T.fontMono, fontSize: 9, color: 'rgba(255,255,255,.5)', textShadow: '0 1px 2px rgba(0,0,0,.8)' }}>{sub}</div>}
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: T.fs.xs, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                <div style={{ fontSize: 10.5, color: T.text3 }}>{TYPE_LABEL[item.type] || item.type || ''}</div>
              </div>
            </button>
          )
        })}
        {!loading && items.length === 0 && (
          <div style={{ gridColumn: '1/-1', color: loadErr ? T.danger : T.text3, fontSize: T.fs.sm, padding: 24, textAlign: 'center' }}>
            {loadErr || 'Aucun résultat'}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlexBrowser({ onSourceSelected, onStatus }) {
  const [status, setStatus] = useState(null)   // null=loading, {connected, server?, url}
  const [libraries, setLibraries] = useState([])
  const [activeSectionId, setActiveSectionId] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false)
  const [selectedKey, setSelectedKey] = useState(null)
  const [err, setErr] = useState(null)

  async function checkStatus() {
    setErr(null)
    try {
      const res = await fetch('/api/plex/status')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStatus(data)
      onStatus?.(data)
      if (data.connected) loadLibraries()
    } catch (e) {
      setErr('Statut Plex indisponible : ' + e.message)
    }
  }

  async function loadLibraries() {
    try {
      const res = await fetch('/api/plex/libraries')
      const data = await res.json().catch(() => null)
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.detail || `HTTP ${res.status}`)
      setLibraries(data)
      if (data.length > 0) setActiveSectionId(prev => data.some(l => l.id === prev) ? prev : data[0].id)
    } catch (e) {
      setErr('Bibliothèques inaccessibles : ' + e.message)
    }
  }

  useEffect(() => { checkStatus() }, [])

  async function handleSelect(ratingKey) {
    if (loadingItem) return
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
      const reg = await fetch(`/api/files/register?source_id=${sourceId}&stream_url=${encodeURIComponent(part.stream_url)}&filename=${encodeURIComponent(part.filename)}`, { method: 'POST' })
      if (!reg.ok) throw new Error(`Enregistrement source : HTTP ${reg.status}`)

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

  if (!status) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: T.fs.sm }}>
        {err
          ? <><span style={{ color: T.danger }}>{err}</span><Btn variant="outline" size="sm" icon={ICONS.loop2} onClick={checkStatus}>Réessayer</Btn></>
          : <span style={{ color: T.text3 }}>Vérification Plex…</span>}
      </div>
    )
  }

  if (!status.connected) {
    return <PlexConnect initialUrl={status.url} onConnected={() => checkStatus()} />
  }

  const activeLib = libraries.find(l => l.id === activeSectionId)

  return (
    <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
      <div style={{ width: 200, flexShrink: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, padding: 8, overflow: 'auto' }}>
        <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 700, padding: '8px 10px' }}>BIBLIOTHÈQUES</div>
        {libraries.map(lib => {
          const on = activeSectionId === lib.id
          return (
            <div key={lib.id} role="button" tabIndex={0} onClick={() => setActiveSectionId(lib.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSectionId(lib.id) } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: T.r.ctl, cursor: 'pointer',
                background: on ? alpha(T.accent, '11') : 'transparent', color: on ? T.accent : T.text2, border: on ? `1px solid ${alpha(T.accent, '33')}` : '1px solid transparent', fontSize: T.fs.sm, fontWeight: on ? 600 : 500,
              }}>
              <Icon d={ICONS.folder} size={14} /><span style={{ flex: 1 }}>{lib.title}</span>
              {typeof lib.count === 'number' && <span style={{ fontSize: 10, color: T.text3, fontFamily: T.fontMono }}>{lib.count}</span>}
            </div>
          )
        })}
        {libraries.length === 0 && !err && <div style={{ padding: '8px 10px', fontSize: T.fs.xs, color: T.text3 }}>Aucune bibliothèque</div>}
      </div>

      {activeSectionId ? (
        <LibraryGrid
          sectionId={activeSectionId}
          sectionTitle={activeLib?.title}
          onSelect={handleSelect}
          selectedKey={selectedKey}
          toolbar={<PlexToolbar status={status} loadingItem={loadingItem} err={err} onReload={() => { setStatus(null); checkStatus() }} />}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
          <PlexToolbar status={status} loadingItem={loadingItem} err={err} onReload={() => { setStatus(null); checkStatus() }} />
        </div>
      )}
    </div>
  )
}

function PlexToolbar({ status, loadingItem, err, onReload }) {
  return (
    <>
      {loadingItem && <span style={{ fontSize: T.fs.micro, color: T.accent, whiteSpace: 'nowrap' }}>Chargement…</span>}
      {err && <span style={{ fontSize: T.fs.micro, color: T.danger, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={err}>{err}</span>}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T.fs.xs, color: T.text2, whiteSpace: 'nowrap' }}>
        <Dot color={T.success} size={6} />{status.server}
      </span>
      <Btn variant="outline" size="sm" icon={ICONS.loop2} onClick={onReload} title="Recharger">Recharger</Btn>
    </>
  )
}
