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
const PAGE_SIZE = 24

// Servers name seasons in their metadata language — show them in French.
function displayTitle(item) {
  const season = /^Season (\d+)$/.exec(item.title || '')
  if (season) return `Saison ${season[1]}`
  if (item.title === 'Specials') return 'Spéciaux'
  return item.title
}

async function fetchJson(url) {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
  return data
}

function isTyping(el) {
  return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

function LibraryCard({ item, index, selected, onOpen }) {
  const title = displayTitle(item)
  const folder = FOLDER_TYPES.has(item.type)
  const episode = item.type === 'episode'
  const seed = (title || '??').charCodeAt(0) + ((title || '??').charCodeAt(1) || 0)
  const meta = [item.year, fmtDur(item.duration)].filter(Boolean).join(' · ')
  return (
    <button className="lib-card lib-in" data-on={selected ? '1' : '0'} onClick={() => onOpen(item)}
      title={`${folder ? 'Ouvrir' : 'Importer'} ${title}`} style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}>
      <div className="lib-box">
        <div className="lib-art" style={{ aspectRatio: episode ? '16/9' : '2/3', background: `linear-gradient(135deg,hsl(${seed * 7 % 360},18%,22%),hsl(${seed * 13 % 360},16%,13%))` }}>
          {item.thumb && <img className="lib-img" src={item.thumb} alt="" loading="lazy" />}
          {meta && <span className="lib-meta">{meta}</span>}
          {selected && <span className="lib-badge">SÉLECTIONNÉ</span>}
          <div className="lib-ov">
            {!episode && item.overview && <div className="lib-desc">{item.overview}</div>}
            <span className={`lib-cta${folder ? ' ghost' : ''}`}>
              <Icon d={folder ? ICONS.chevronR : ICONS.import} size={13} stroke={folder ? '#fff' : '#0b0b0d'} />
              {folder ? 'Ouvrir' : 'Importer'}
            </span>
          </div>
        </div>
        <div className="lib-foot">
          <div className="lib-title">{title}</div>
          {folder && <span className="lib-chev"><Icon d={ICONS.chevronR} size={14} stroke="currentColor" /></span>}
        </div>
        <div className="lib-sub">{TYPE_LABEL[item.type] || item.type || ''}</div>
      </div>
    </button>
  )
}

// 1 … 4 5 6 … 12 — first, last, and the current page's neighbours.
function pageNumbers(page, pages) {
  const nums = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }
  return nums
}

function Pager({ page, total, onPage, onPrefetchNext }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pages <= 1) {
    return <div style={{ textAlign: 'center', fontSize: 12, color: T.text4, fontFamily: T.fontMono, marginTop: 22 }}>{total} élément{total > 1 ? 's' : ''}</div>
  }
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(total, page * PAGE_SIZE)
  return (
    <nav aria-label="Pages" style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: T.text3, fontFamily: T.fontMono, marginRight: 12 }}>{from}–{to} sur {total}</span>
      <button className="lib-pg" disabled={page === 1} onClick={() => onPage(page - 1)} title="Page précédente (PgPréc)" aria-label="Page précédente">
        <Icon d={ICONS.chevronL} size={14} stroke="currentColor" />
      </button>
      {pageNumbers(page, pages).map((p, k) => p === '…'
        ? <span key={`e${k}`} style={{ width: 24, textAlign: 'center', color: T.text4 }}>…</span>
        : <button key={p} className="lib-pg" data-on={p === page ? '1' : '0'} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>{p}</button>)}
      <button className="lib-pg" disabled={page === pages} onClick={() => onPage(page + 1)} onMouseEnter={onPrefetchNext}
        title="Page suivante (PgSuiv)" aria-label="Page suivante">
        <Icon d={ICONS.chevronR} size={14} stroke="currentColor" />
      </button>
    </nav>
  )
}

// Show libraries browse as folders: série → saisons → épisodes (breadcrumb).
// A série with a single saison opens straight on its épisodes. 24 items per
// page: library pages and searches come from the server, a folder's children
// are fetched once and paged here. Each view remembers its page (pages, a Map
// owned by the parent so it survives switching library).
function LibraryGrid({ api, sectionId, sectionTitle, onSelect, selectedKey, toolbar, onReload, pages }) {
  const [view, setView] = useState({ path: [], query: '', page: 1, items: [], total: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [skelWide, setSkelWide] = useState(false)
  const [loadErr, setLoadErr] = useState(null)
  const debounceRef = useRef(null)
  const reqRef = useRef(0)
  const cacheRef = useRef(new Map())   // url → Promise<json>
  const scrollRef = useRef(null)

  const viewKey = (path, query) => `${sectionId}|${path.map(c => c.key).join('/')}|${query}`

  function cached(url) {
    if (!cacheRef.current.has(url)) {
      const p = fetchJson(url)
      p.catch(() => cacheRef.current.delete(url))   // a failed page is fetched again next time
      cacheRef.current.set(url, p)
    }
    return cacheRef.current.get(url)
  }

  const libraryUrl = (query, page) =>
    `${api}/library/${sectionId}?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}${query ? `&search=${encodeURIComponent(query)}` : ''}`
  const childrenUrl = key => `${api}/children/${encodeURIComponent(key)}`

  async function fetchPage(path, query, page) {
    if (path.length === 0) {
      const data = await cached(libraryUrl(query, page))
      return { items: data.items || [], total: data.total ?? (data.items || []).length }
    }
    const all = (await cached(childrenUrl(path[path.length - 1].key))).items || []
    const q = query.toLowerCase()
    const matching = q ? all.filter(i => displayTitle(i).toLowerCase().includes(q)) : all
    return { items: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: matching.length }
  }

  // Latest request wins — a slow earlier load must not overwrite newer results.
  async function load(path, { query = '', page, autoOpen = false, wide = skelWide } = {}) {
    const req = ++reqRef.current
    setLoading(true)
    setSkelWide(wide)
    setLoadErr(null)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    try {
      let trail = path
      if (autoOpen) {
        const kids = (await cached(childrenUrl(path[path.length - 1].key))).items || []
        if (kids.length === 1 && kids[0].type === 'season') {
          trail = [...path, { key: kids[0].rating_key, title: displayTitle(kids[0]), auto: true }]
        }
      }
      const key = viewKey(trail, query)
      const target = page ?? pages.get(key) ?? 1
      const { items, total } = await fetchPage(trail, query, target)
      if (req !== reqRef.current) return
      pages.set(key, target)
      setView({ path: trail, query, page: target, items, total })
    } catch (e) {
      if (req === reqRef.current) {
        setView(v => ({ ...v, items: [], total: 0 }))
        setLoadErr('Bibliothèque inaccessible : ' + e.message)
      }
    } finally {
      if (req === reqRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    load([])
    return () => clearTimeout(debounceRef.current)
  }, [api, sectionId])

  const { path, query, page, items, total } = view
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function reload() {
    onReload()
    cacheRef.current.clear()
    load(path, { query, page })
  }

  function goPage(p) {
    const next = Math.min(lastPage, Math.max(1, p))
    if (next !== page) load(path, { query, page: next })
  }

  function prefetchNext() {
    if (path.length === 0 && page < lastPage) cached(libraryUrl(query, page + 1)).catch(() => {})
  }

  function handleSearch(e) {
    const q = e.target.value
    setSearch(q)
    clearTimeout(debounceRef.current)
    // A new query starts on page 1 (cleared: back to the view's own page);
    // inside a folder it filters what is already loaded.
    const query = q.trim()
    debounceRef.current = setTimeout(() => load(path, { query, page: query ? 1 : undefined }), path.length ? 0 : 400)
  }

  function openItem(item) {
    if (!FOLDER_TYPES.has(item.type)) { onSelect(item.rating_key); return }
    setSearch('')
    load([...path, { key: item.rating_key, title: displayTitle(item) }], { autoOpen: true, wide: item.type === 'season' })
  }

  function goTo(depth) {
    setSearch('')
    load(path.slice(0, depth), { wide: false })
  }

  const goUp = () => goTo(path.length - (path[path.length - 1].auto ? 2 : 1))

  useEffect(() => {
    function onKey(e) {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'PageDown') { e.preventDefault(); goPage(page + 1) }
      else if (e.key === 'PageUp') { e.preventDefault(); goPage(page - 1) }
      else if (e.key === 'Backspace' && path.length) { e.preventDefault(); goUp() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function handleScroll(e) {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) prefetchNext()
  }

  const inFolder = path.length > 0
  const wide = loading ? skelWide : items.length > 0 && items.every(i => i.type === 'episode')
  const here = inFolder ? path[path.length - 1].title : sectionTitle
  const grid = {
    display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${wide ? 230 : 150}px,1fr))`,
    gridAutoRows: 'max-content', gap: 14, alignContent: 'start',
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="field-ring" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99 }}>
          <Icon d={ICONS.search} size={14} stroke={T.text3} />
          <input value={search} onChange={handleSearch} placeholder={`${inFolder ? 'Filtrer' : 'Rechercher dans'} ${here || 'la bibliothèque'}…`}
            style={{ flex: 1, minWidth: 0, padding: 0, background: 'transparent', border: 'none', fontSize: T.fs.sm, color: T.text, boxShadow: 'none' }} />
        </div>
        {toolbar}
        <Btn variant="outline" size="sm" icon={ICONS.loop2} onClick={reload} title="Recharger">Recharger</Btn>
      </div>

      {inFolder && (
        <nav aria-label="Dossiers" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: T.fs.sm }}>
          <Btn variant="outline" size="sm" icon={ICONS.back} onClick={goUp} title="Dossier parent (Retour arrière)">Retour</Btn>
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

      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '6px 4px 20px' }}>
        {loading ? (
          <div style={grid} aria-busy="true" aria-label="Chargement">
            {Array.from({ length: wide ? 8 : 12 }, (_, i) => (
              <div key={i} className="lib-skel" style={{ aspectRatio: wide ? '16/13' : '2/3.55', animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: loadErr ? T.danger : T.text3, fontSize: 13 }}>
            {loadErr || (query ? `Aucun résultat pour « ${query} » dans ${here || 'la bibliothèque'}.` : 'Aucun élément')}
          </div>
        ) : (
          <>
            <div key={`${viewKey(path, query)}#${page}`} style={grid}>
              {items.map((item, i) => (
                <LibraryCard key={item.rating_key} item={item} index={i} selected={selectedKey === item.rating_key} onOpen={openItem} />
              ))}
            </div>
            <Pager page={page} total={total} onPage={goPage} onPrefetchNext={prefetchNext} />
          </>
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
  const [pages] = useState(() => new Map())   // view → page, kept across library switches

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {libraries.map(lib => (
            <button key={lib.id} className="lib-item" data-on={activeSectionId === lib.id ? '1' : '0'} onClick={() => setActiveSectionId(lib.id)}>
              <Icon d={ICONS.folder} size={15} stroke="currentColor" />
              <span style={{ flex: 1, textAlign: 'left' }}>{lib.title}</span>
              {typeof lib.count === 'number' && <span style={{ fontFamily: T.fontMono, fontSize: 11, opacity: 0.6 }}>{lib.count}</span>}
            </button>
          ))}
        </div>
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
          pages={pages}
          toolbar={<ServerToolbar status={status} loadingItem={loadingItem} err={err} />}
          onReload={checkStatus}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 10 }}>
          <ServerToolbar status={status} loadingItem={loadingItem} err={err} />
          <Btn variant="outline" size="sm" icon={ICONS.loop2} onClick={checkStatus} title="Recharger">Recharger</Btn>
        </div>
      )}
    </div>
  )
}

function ServerToolbar({ status, loadingItem, err }) {
  return (
    <>
      {loadingItem && <span style={{ fontSize: T.fs.micro, color: T.accent, whiteSpace: 'nowrap' }}>Chargement…</span>}
      {err && <span style={{ fontSize: T.fs.micro, color: T.danger, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={err}>{err}</span>}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T.fs.xs, color: T.text2, whiteSpace: 'nowrap' }}>
        <Dot color={T.success} size={6} />{status.server}
      </span>
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
