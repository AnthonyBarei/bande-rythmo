import React, { useState, useEffect, useRef } from 'react'
import { Btn, Dot, Icon, ICONS, Input, SectionLabel, Segmented, Spinner, T, alpha } from '../ui'
import { LIBRARY_PROVIDERS, providerById, readLibraryProvider, writeLibraryProvider } from '../config/libraryProviders'

// Reference screen-import.jsx PlexBrowse — libraries card (200px) + search pill
// + poster grid minmax(150px,1fr). The connect card has no reference screen.
// Provider-agnostic: Plex and Jellyfin routes share one API shape.

const TYPE_LABEL = { movie: 'Film', show: 'Série', season: 'Saison', episode: 'Épisode' }

function fmtDur(ms) {
  if (!ms) return ''
  const min = Math.round(ms / 60000)
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`
}

const BANNER = { fontSize: T.fs.xs, padding: '8px 12px', borderRadius: T.r.ctl, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }

// status: null while the saved server is being checked (form shown disabled),
// then { connected: false, configured, url } — configured = saved but unreachable.
function ConnectCard({ provider, status, onConnected, switcher }) {
  const [urlInput, setUrlInput] = useState(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [detected, setDetected] = useState(null)  // null=probing, false=none, string=found url

  useEffect(() => {
    let cancelled = false
    fetch(`${provider.api}/probe`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setDetected(data.found ? data.url : false) })
      .catch(e => {
        console.warn(`Détection ${provider.label} impossible`, e)
        if (!cancelled) setDetected(false)
      })
    return () => { cancelled = true }
  }, [provider])

  const checking = !status
  const unreachable = status?.configured && !status.connected
  const busy = checking || loading
  const url = urlInput ?? (detected || status?.url || provider.defaultUrl)
  const savedHost = (status?.url || '').replace(/^https?:\/\//, '')

  async function handleConnect() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`${provider.api}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      await onConnected(data.server)  // busy until the parent swaps to the library
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
          <span style={{ fontSize: T.fs.md, fontWeight: 600 }}>Connecter {provider.label}</span>
          <span style={{ fontSize: T.fs.xs, color: T.text3, flex: 1 }}>serveur local</span>
          {switcher}
        </div>

        {checking ? (
          <div style={{ ...BANNER, color: T.text3, background: T.bg2, border: `1px solid ${T.border}` }}>
            <Spinner size={10} color={T.text3} />
            <span>Vérification de la connexion {provider.label}…</span>
          </div>
        ) : unreachable ? (
          <div style={{ ...BANNER, color: T.danger, background: 'rgba(232,89,93,.05)', border: `1px solid ${alpha(T.danger, '44')}` }}>
            <Icon d={ICONS.warn} size={13} stroke={T.danger} />
            <span>Serveur enregistré injoignable — <span style={{ fontFamily: T.fontMono }}>{savedHost}</span>. Démarrez-le ou reconnectez-vous.</span>
          </div>
        ) : detected ? (
          <div style={{ ...BANNER, color: T.success, background: 'rgba(94,194,124,.08)', border: `1px solid ${alpha(T.success, '44')}` }}>
            <Dot color={T.success} size={6} />
            <span>Serveur {provider.label} détecté — <span style={{ fontFamily: T.fontMono }}>{detected}</span></span>
          </div>
        ) : detected === false && (
          <div style={{ ...BANNER, color: T.text3, background: T.bg2, border: `1px solid ${T.border}` }}>
            Aucun serveur local détecté — saisissez l&apos;URL manuellement.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <SectionLabel>URL SERVEUR</SectionLabel>
            <Input value={url} onChange={e => setUrlInput(e.target.value)} placeholder={provider.defaultUrl} disabled={busy}
              aria-label="URL serveur" style={{ height: 36, marginTop: 6, opacity: busy ? 0.55 : 1 }} inputStyle={{ fontFamily: T.fontMono }} />
          </div>
          <div>
            <SectionLabel>{provider.tokenLabel}</SectionLabel>
            <Input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder={provider.tokenPlaceholder} disabled={busy}
              aria-label={provider.tokenPlaceholder} style={{ height: 36, marginTop: 6, opacity: busy ? 0.55 : 1 }}
              onKeyDown={e => { if (e.key === 'Enter' && token && !busy) handleConnect() }} />
            <span style={{ display: 'block', marginTop: 6, fontSize: T.fs.micro, color: T.text3 }}>
              {provider.tokenHint}
              {provider.tokenHintCode && <> <span style={{ color: T.accent, fontFamily: T.fontMono }}>{provider.tokenHintCode}</span></>}
            </span>
          </div>

          {err && (
            <div style={{ fontSize: T.fs.xs, color: T.danger, padding: '8px 12px', background: 'rgba(232,89,93,.05)', border: `1px solid ${alpha(T.danger, '44')}`, borderRadius: T.r.ctl }}>
              {err}
            </div>
          )}

          <Btn variant="primary" full icon={busy ? undefined : ICONS.plug} onClick={handleConnect} disabled={busy || !token} style={{ marginTop: 4 }}
            title={checking ? 'Vérification en cours…' : loading ? 'Connexion en cours…' : !token ? `Renseignez : ${provider.tokenPlaceholder}` : undefined}>
            {busy
              ? <><Spinner size={12} color={T.text3} /> {loading ? 'Connexion…' : 'Vérification…'}</>
              : 'Connecter'}
          </Btn>

          <div style={{ fontSize: T.fs.micro, color: T.text3, textAlign: 'center' }}>
            La connexion reste locale — clé stockée uniquement sur votre machine.
          </div>
        </div>
      </div>
    </div>
  )
}

const FOLDER_TYPES = new Set(['show', 'season'])

// Servers name seasons in their metadata language — show them in French.
function displayTitle(item) {
  const season = /^Season (\d+)$/.exec(item.title || '')
  if (season) return `Saison ${season[1]}`
  if (item.title === 'Specials') return 'Spéciaux'
  return item.title
}

async function fetchItems(url) {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
  return data.items || []
}

// Show libraries browse as folders: série → saisons → épisodes (breadcrumb).
// A série with a single saison opens straight on its épisodes.
function LibraryGrid({ api, sectionId, sectionTitle, onSelect, selectedKey, toolbar }) {
  const [items, setItems] = useState([])
  const [path, setPath] = useState([])   // [{ key, title }] — open folders
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState(null)
  const debounceRef = useRef(null)
  const reqRef = useRef(0)

  // Latest request wins — a slow earlier load must not overwrite newer results.
  async function load(trail, q = '', autoOpen = false) {
    const req = ++reqRef.current
    setLoading(true)
    setLoadErr(null)
    try {
      let next = trail
      let found
      if (trail.length === 0) {
        found = await fetchItems(`${api}/library/${sectionId}?limit=60${q ? `&search=${encodeURIComponent(q)}` : ''}`)
      } else {
        found = await fetchItems(`${api}/children/${encodeURIComponent(trail[trail.length - 1].key)}`)
        if (autoOpen && found.length === 1 && found[0].type === 'season') {
          next = [...trail, { key: found[0].rating_key, title: displayTitle(found[0]), auto: true }]
          found = await fetchItems(`${api}/children/${encodeURIComponent(found[0].rating_key)}`)
        }
      }
      if (req === reqRef.current) { setItems(found); setPath(next) }
    } catch (e) {
      if (req === reqRef.current) { setItems([]); setLoadErr('Bibliothèque inaccessible : ' + e.message) }
    } finally {
      if (req === reqRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    load([])
    return () => clearTimeout(debounceRef.current)
  }, [api, sectionId])

  function handleSearch(e) {
    const q = e.target.value
    setSearch(q)
    clearTimeout(debounceRef.current)
    if (path.length === 0) debounceRef.current = setTimeout(() => load([], q), 400)
  }

  function openItem(item) {
    if (!FOLDER_TYPES.has(item.type)) { onSelect(item.rating_key); return }
    setSearch('')
    load([...path, { key: item.rating_key, title: displayTitle(item) }], '', true)
  }

  function goTo(depth) {
    setSearch('')
    load(path.slice(0, depth))
  }

  // Inside a folder the search filters what is already loaded.
  const inFolder = path.length > 0
  const shown = inFolder && search
    ? items.filter(i => displayTitle(i).toLowerCase().includes(search.toLowerCase()))
    : items
  const wide = shown.length > 0 && shown.every(i => i.type === 'episode')
  const here = inFolder ? path[path.length - 1].title : sectionTitle

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="field-ring" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99 }}>
          <Icon d={ICONS.search} size={14} stroke={T.text3} />
          <input value={search} onChange={handleSearch} placeholder={`${inFolder ? 'Filtrer' : 'Rechercher dans'} ${here || 'la bibliothèque'}…`}
            style={{ flex: 1, minWidth: 0, padding: 0, background: 'transparent', border: 'none', fontSize: T.fs.sm, color: T.text, boxShadow: 'none' }} />
          {loading && <span style={{ fontSize: T.fs.micro, color: T.text3 }}>Chargement…</span>}
        </div>
        {toolbar}
      </div>

      {inFolder && (
        <nav aria-label="Dossiers" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: T.fs.sm }}>
          <Btn variant="outline" size="sm" icon={ICONS.back} onClick={() => goTo(path.length - (path[path.length - 1].auto ? 2 : 1))} title="Dossier parent">Retour</Btn>
          {[{ title: sectionTitle || 'Bibliothèque' }, ...path].map((crumb, depth) => {
            const last = depth === path.length
            return (
              <React.Fragment key={depth}>
                {depth > 0 && <Icon d={ICONS.chevronR} size={12} stroke={T.text4} />}
                {last
                  ? <span style={{ color: T.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crumb.title}</span>
                  : <button data-rd onClick={() => goTo(depth)} style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', color: T.text2, fontSize: T.fs.sm, fontFamily: T.fontUI, whiteSpace: 'nowrap' }}>{crumb.title}</button>}
              </React.Fragment>
            )
          })}
        </nav>
      )}

      <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${wide ? 220 : 150}px,1fr))`, gridAutoRows: 'max-content', gap: 12, alignContent: 'flex-start' }}>
        {shown.map(item => {
          const title = displayTitle(item)
          const folder = FOLDER_TYPES.has(item.type)
          const mine = selectedKey === item.rating_key
          const seed = (title || '??').charCodeAt(0) + ((title || '??').charCodeAt(1) || 0)
          const sub = [item.year, fmtDur(item.duration)].filter(Boolean).join(' · ')
          return (
            <button key={item.rating_key} data-rd onClick={() => openItem(item)} title={folder ? `Ouvrir ${title}` : title} style={{
              background: T.surface, border: `1px solid ${mine ? T.accent : T.border}`, borderRadius: T.r.ctl, overflow: 'hidden', cursor: 'pointer',
              boxShadow: mine ? `0 0 0 2px ${alpha(T.accent, '33')}` : 'none', padding: 0, textAlign: 'left', color: T.text, display: 'block', width: '100%',
            }}>
              <div style={{ aspectRatio: item.type === 'episode' ? '16/9' : '2/3', position: 'relative', background: `linear-gradient(135deg,hsl(${seed * 7 % 360},18%,22%),hsl(${seed * 13 % 360},16%,13%))` }}>
                {item.thumb && <img src={item.thumb} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                {mine && <div style={{ position: 'absolute', top: 6, left: 6, padding: '2px 6px', background: T.accent, color: '#0b0b0d', fontSize: 8.5, fontWeight: 800, borderRadius: 3 }}>SÉLECTIONNÉ</div>}
                {sub && <div style={{ position: 'absolute', left: 8, bottom: 8, fontFamily: T.fontMono, fontSize: 9, color: 'rgba(255,255,255,.5)', textShadow: '0 1px 2px rgba(0,0,0,.8)' }}>{sub}</div>}
              </div>
              <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: T.fs.xs, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                  <div style={{ fontSize: 10.5, color: T.text3 }}>{TYPE_LABEL[item.type] || item.type || ''}</div>
                </div>
                {folder && <Icon d={ICONS.chevronR} size={14} stroke={T.text3} />}
              </div>
            </button>
          )
        })}
        {!loading && shown.length === 0 && (
          <div style={{ gridColumn: '1/-1', color: loadErr ? T.danger : T.text3, fontSize: T.fs.sm, padding: 24, textAlign: 'center' }}>
            {loadErr || 'Aucun résultat'}
          </div>
        )}
      </div>
    </div>
  )
}

function ProviderBrowser({ provider, initialStatus, onSourceSelected, onStatus, switcher }) {
  // Seeded from the Importer's own status fetch — no blank wait on tab open.
  const [status, setStatus] = useState(initialStatus ?? null)   // null=loading, {connected, configured, server?, url}
  const [libraries, setLibraries] = useState([])
  const [activeSectionId, setActiveSectionId] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false)
  const [selectedKey, setSelectedKey] = useState(null)
  const [err, setErr] = useState(null)

  async function checkStatus() {
    setErr(null)
    try {
      const res = await fetch(`${provider.api}/status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStatus(data)
      onStatus?.(data)
      if (data.connected) loadLibraries()
    } catch (e) {
      setErr(`Statut ${provider.label} indisponible : ` + e.message)
    }
  }

  async function loadLibraries() {
    try {
      const res = await fetch(`${provider.api}/libraries`)
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
      const res = await fetch(`${provider.api}/item/${encodeURIComponent(ratingKey)}`)
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
        libraryName: provider.label,
        libraryTitle: item.title,
        libraryYear: item.year,
      })
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoadingItem(false)
    }
  }

  if (!status && err) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: T.fs.sm }}>
        {switcher}
        <span style={{ color: T.danger }}>{err}</span>
        <Btn variant="outline" size="sm" icon={ICONS.loop2} onClick={checkStatus}>Réessayer</Btn>
      </div>
    )
  }

  if (!status?.connected) {
    return <ConnectCard provider={provider} status={status} onConnected={checkStatus} switcher={switcher} />
  }

  const activeLib = libraries.find(l => l.id === activeSectionId)

  return (
    <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
      <div style={{ width: 200, flexShrink: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, padding: 8, overflow: 'auto' }}>
        <div style={{ padding: '4px 2px 4px' }}>{switcher}</div>
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
          key={activeSectionId}
          api={provider.api}
          sectionId={activeSectionId}
          sectionTitle={activeLib?.title}
          onSelect={handleSelect}
          selectedKey={selectedKey}
          toolbar={<ServerToolbar status={status} loadingItem={loadingItem} err={err} onReload={checkStatus} />}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
          <ServerToolbar status={status} loadingItem={loadingItem} err={err} onReload={checkStatus} />
        </div>
      )}
    </div>
  )
}

function ServerToolbar({ status, loadingItem, err, onReload }) {
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

const PROVIDER_OPTIONS = LIBRARY_PROVIDERS.map(p => ({ v: p.id, l: p.label }))

export default function LibraryBrowser({ statuses, onSourceSelected, onStatus }) {
  const [providerId, setProviderId] = useState(readLibraryProvider)
  const provider = providerById(providerId)

  function choose(id) {
    setProviderId(id)
    writeLibraryProvider(id)
  }

  const switcher = <Segmented size="sm" options={PROVIDER_OPTIONS} value={providerId} onChange={choose} />
  return (
    <ProviderBrowser
      key={provider.id}
      provider={provider}
      initialStatus={statuses?.[provider.id]}
      onSourceSelected={onSourceSelected}
      onStatus={data => onStatus?.(provider.id, data)}
      switcher={switcher}
    />
  )
}
