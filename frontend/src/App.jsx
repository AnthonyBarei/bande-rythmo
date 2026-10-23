import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ImportSection from './components/ImportSection'
import ClipsLibrary from './components/ClipsLibrary'
import DubbingWorkspace from './components/DubbingWorkspace'
import MemeGenerator, { MEME_PROJECT } from './components/MemeGenerator'
import Preferences from './components/Preferences'
import { T, Icon, ICONS, Btn, Kbd, Avatar, Popover, MenuItem, MenuSep } from './ui'
import { useSettings } from './SettingsContext'
import { useAuth } from './AuthContext'
import AuthScreen from './components/account/AuthScreen'
import AccountScreen from './components/account/AccountScreen'
import { ProgressProvider, ToastDock } from './ProgressContext'
import { ToastProvider, useToast } from './ToastContext'
import ShortcutsOverlay from './components/ShortcutsOverlay'
import CommandPalette from './components/CommandPalette'
import ActivityCenter from './components/ActivityCenter'
import StudioScreen from './components/StudioScreen'
import { ExportScreenContext } from './components/exportScreen'
import ProjectsHome from './components/projects/ProjectsHome'
import ProjectBar from './components/projects/ProjectBar'
import { MoveClipDialog } from './components/projects/ProjectDialogs'
import { CLIP_STAGES, PROJECTS, formatRoute, parseRoute, projectRoute, resumeRoute } from './utils/route'
import { createProject, getProject, listProjects, moveClip, patchProject } from './utils/projectsApi'

export default function App() {
  return (
    <ProgressProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ProgressProvider>
  )
}

// Project stage → the screen it shows (export = the editor with its export screen open).
const STAGE_SECTION = { media: 'import', clips: 'clips', dub: 'dub', record: 'record', export: 'dub' }
// Legacy screen ids (palette, account menu) → project stage.
const SECTION_STAGE = { import: 'media', clips: 'clips', dub: 'dub', record: 'record' }

// Éditeur and Studio own their single-key shortcuts; N stays out of their way.
const N_KEY_EXCLUDED = new Set(['dub', 'record', 'import'])

function isNewClipKey(e, { section, overlayOpen }) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.defaultPrevented) return false
  if (overlayOpen || document.querySelector('[aria-modal="true"]')) return false
  return !N_KEY_EXCLUDED.has(section)
}

// FIXES_R7 #3 — "/" focuses the screen's own search field when it has one
// (marked data-local-search, e.g. the Bibliothèque), else opens the palette.
function focusLocalSearch() {
  const field = document.querySelector('input[data-local-search]')
  if (!field || !field.offsetParent) return false
  field.focus()
  field.select()
  return true
}

// Signed in: avatar → account menu. Signed out: « Se connecter ».
function AccountButton({ user, accent, onNavigate, onLogin, onLogout }) {
  if (!user) return <Btn size="sm" variant="outline" icon={ICONS.user} onClick={() => onLogin('login')}>Se connecter</Btn>
  const color = user.color || accent
  return (
    <Popover align="right" width={240} trigger={(open, toggle) => (
      <button data-rd onClick={toggle} title="Mon compte" aria-haspopup="menu" aria-expanded={open}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%', boxShadow: open ? `0 0 0 2px ${accent}` : 'none' }}>
        <Avatar name={user.name} color={color} size={30} />
      </button>
    )}>
      {close => <>
        <div style={{ padding: '8px 10px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={user.name} color={color} size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: T.fs.sm, fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11.5, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
          </div>
        </div>
        <MenuSep />
        <MenuItem icon={ICONS.user} onClick={() => { close(); onNavigate('account') }}>Mon compte</MenuItem>
        <MenuItem icon={ICONS.settings} onClick={() => { close(); onNavigate('settings') }}>Réglages</MenuItem>
        <MenuSep />
        <MenuItem icon={ICONS.logout} onClick={() => { close(); onLogout() }}>Se déconnecter</MenuItem>
      </>}
    </Popover>
  )
}

// Top bar — port of redesign shell.jsx TopBar. Inside a project, ProjectBar replaces it.
function TopBar({ onCmd, onHelp, onActivity, account }) {
  return (
    <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderBottom: `1px solid ${T.border}`, background: T.bg }}>
      <span style={{ fontSize: T.fs.sm, fontWeight: 700, letterSpacing: 0.5 }}>BANDE RYTHMO <span style={{ color: T.text4, fontWeight: 400 }}>· studio</span></span>
      <div style={{ flex: 1 }} />
      <button data-rd onClick={onCmd} title="Palette de commandes (⌘K)" style={{
        display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 12px', minWidth: 280,
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99, cursor: 'pointer', color: T.text3,
      }}>
        <Icon d={ICONS.search} size={15} stroke={T.text3} />
        <span style={{ fontSize: T.fs.sm }}>Rechercher ou commande…</span>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'flex', gap: 3 }}><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
      </button>
      <Btn size="sm" icon={ICONS.keyboard} title="Raccourcis (?)" onClick={onHelp} />
      <Btn size="sm" icon={ICONS.activity} title="Activité" onClick={onActivity} />
      <div style={{ width: 1, height: 22, background: T.border }} />
      {account}
    </div>
  )
}

function AppInner() {
  const toast = useToast()
  const { settings } = useSettings()
  const auth = useAuth()
  const authRef = useRef(auth)
  useEffect(() => { authRef.current = auth })

  // ── Routing: the hash is the source of truth (utils/route). ──
  const [route, setRouteState] = useState(() => parseRoute(window.location.hash))
  const routeRef = useRef(route)
  const lastAppRouteRef = useRef(null)   // where to land after the auth screen

  const go = useCallback((next, { replace = false } = {}) => {
    const hash = formatRoute(next)
    if (hash !== window.location.hash) {
      const url = window.location.pathname + window.location.search + hash
      if (replace) window.history.replaceState(null, '', url)
      else window.history.pushState(null, '', url)
    }
    routeRef.current = next
    setRouteState(next)
  }, [])

  useEffect(() => {
    const sync = () => {
      const next = parseRoute(window.location.hash)
      routeRef.current = next
      setRouteState(next)
    }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])

  useEffect(() => {
    if (!['auth', 'verify', 'none'].includes(route.view)) lastAppRouteRef.current = route
  }, [route])

  const projectId = route.view === 'project' ? route.projectId : null
  const stage = projectId ? route.stage : null
  const section = stage ? STAGE_SECTION[stage] : route.view
  const dubExportOpen = stage === 'export'

  // ── Data ──
  const [clips, setClips] = useState([])
  const [clipsLoaded, setClipsLoaded] = useState(false)
  const [loadedProject, setProject] = useState(null)
  const [atelierVideo, setAtelierVideo] = useState(null)   // the Atelier's inline import source
  const [memeClip, setMemeClip] = useState(null)
  const [memeInitialTab, setMemeInitialTab] = useState(null)
  const [atelierImport, setAtelierImport] = useState(false)
  const [exportInitialFormat, setExportInitialFormat] = useState(null)
  const [exportSlot, setExportSlot] = useState(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [createPending, setCreatePending] = useState(false)   // N / palette → open « Nouveau projet »
  const [moving, setMoving] = useState(null)   // clip being moved to another project
  const lastClipRef = useRef({})               // projectId → last clip opened
  const [sourceSel, setSourceSel] = useState({})   // projectId → Médias source id (null = « Ajouter »)
  // Drafts written this session win over a project refresh that raced their PUT.
  const localDraftsRef = useRef({})

  useEffect(() => {
    let live = true
    async function fetchClips() {
      try {
        const res = await fetch('/api/clips/')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (live) setClips(data)
      } catch (e) {
        console.error('Failed to fetch clips:', e)
        if (live) toast.error('Impossible de charger les clips — le serveur est-il lancé ?')
      } finally {
        if (live) setClipsLoaded(true)
      }
    }
    fetchClips()
    return () => { live = false }
  }, [])

  const refreshProject = useCallback(async id => {
    try {
      const detail = await getProject(id)
      const drafts = localDraftsRef.current
      const sources = detail.sources.map(s => (s.id in drafts ? { ...s, draft: drafts[s.id] } : s))
      if (routeRef.current.projectId === id) setProject({ ...detail, sources })
    } catch (e) {
      console.error(e)
      if (routeRef.current.projectId !== id) return
      toast.error(e.message === 'Project not found' ? 'Ce projet n’existe plus.' : `Projet : ${e.message}`)
      if (e.message === 'Project not found') go(PROJECTS, { replace: true })
    }
  }, [go])

  useEffect(() => {
    if (projectId) refreshProject(projectId)
  }, [projectId, refreshProject])
  // The previous project's detail never shows under another project's id.
  const project = loadedProject?.id === projectId ? loadedProject : null

  // Médias: the source picked this session, else the one saved on the
  // project, else the first one (none → the « Ajouter » tabs).
  const selectedSourceId = useMemo(() => {
    if (!project) return null
    if (projectId in sourceSel) return sourceSel[projectId]
    const saved = project.ui_state?.source_id
    return project.sources.some(s => s.id === saved) ? saved : project.sources[0]?.id ?? null
  }, [project, projectId, sourceSel])

  // Partial source update (track pick, draft) or a new source of this project.
  const updateSource = useCallback(patch => {
    if ('draft' in patch) localDraftsRef.current[patch.id] = patch.draft
    setProject(p => {
      if (!p || (patch.project_id && patch.project_id !== p.id)) return p
      const exists = p.sources.some(s => s.id === patch.id)
      const sources = exists ? p.sources.map(s => (s.id === patch.id ? { ...s, ...patch } : s)) : [...p.sources, patch]
      return { ...p, sources }
    })
  }, [])

  const projectClips = useMemo(
    () => (projectId ? clips.filter(c => c.project_id === projectId) : [])
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [clips, projectId])

  const activeClip = route.view === 'project' && route.clipId
    ? clips.find(c => c.clip_id === route.clipId) || null
    : null

  // No hash: reopen the last project where it was left, else the Projects home.
  useEffect(() => {
    if (route.view !== 'none' || !clipsLoaded) return
    let live = true
    listProjects()
      .then(list => {
        if (!live) return
        const last = list.find(p => p.opened_at)
        go(last ? resumeRoute(last, clips.filter(c => c.project_id === last.id)) : PROJECTS, { replace: true })
      })
      .catch(e => { console.error(e); if (live) go(PROJECTS, { replace: true }) })
    return () => { live = false }
  }, [route.view, clipsLoaded])

  // Clip stages need a clip of this project.
  useEffect(() => {
    if (route.view !== 'project' || !CLIP_STAGES.has(route.stage) || !clipsLoaded) return
    if (activeClip) {
      if (activeClip.project_id && activeClip.project_id !== route.projectId) {
        go(projectRoute(activeClip.project_id, route.stage, activeClip.clip_id), { replace: true })
      }
      return
    }
    if (route.clipId) toast.error('Ce clip n’existe plus.')
    const fallback = !route.clipId && pickClip(route.projectId)
    go(fallback ? projectRoute(route.projectId, route.stage, fallback) : projectRoute(route.projectId, 'clips'), { replace: true })
  }, [route, activeClip, clipsLoaded])

  function pickClip(pid, list = clips) {
    const own = list.filter(c => c.project_id === pid)
    const remembered = lastClipRef.current[pid] || (project?.id === pid ? project.ui_state?.clip_id : null)
    if (remembered && own.some(c => c.clip_id === remembered)) return remembered
    return own.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]?.clip_id || null
  }

  // Where the project was left: saved on the project (PATCH ui_state), debounced.
  const savedStateRef = useRef({})
  useEffect(() => {
    if (route.view !== 'project') return
    if (route.clipId) lastClipRef.current[route.projectId] = route.clipId
    const uiState = {
      stage: route.stage === 'export' ? 'dub' : route.stage,
      clip_id: route.clipId || lastClipRef.current[route.projectId] || null,
      source_id: selectedSourceId,
    }
    const key = JSON.stringify(uiState)
    if (savedStateRef.current[route.projectId] === key) return
    const pid = route.projectId
    const t = setTimeout(() => {
      patchProject(pid, { ui_state: uiState })
        .then(() => { savedStateRef.current[pid] = key })
        .catch(e => console.error('Projet : état non enregistré', e))
    }, 400)
    return () => clearTimeout(t)
  }, [route, selectedSourceId])

  // ── Auth / verify ──
  useEffect(() => {
    if (route.view !== 'verify') return
    const token = route.token
    go(lastAppRouteRef.current || PROJECTS, { replace: true })
    ;(async () => {
      try {
        await authRef.current.verify(token)
        await authRef.current.refresh()
        toast.success('Adresse e-mail confirmée.')
      } catch (e) {
        console.error(e)
        toast.error(e.message)
      }
    })()
  }, [route])

  // Already signed in: #login / #register have nothing to show.
  useEffect(() => {
    if (auth.ready && auth.user && route.view === 'auth' && (route.mode === 'login' || route.mode === 'register')) leaveAuth()
  }, [auth.ready, auth.user, route])

  function openAuth(mode) {
    go({ view: 'auth', mode }, { replace: true })
  }

  function leaveAuth() {
    go(lastAppRouteRef.current || PROJECTS, { replace: true })
  }

  async function handleLogout() {
    try {
      await auth.logout()
    } catch (e) {
      console.error(e)
      toast.error(`Déconnexion : ${e.message}`)
    }
    openAuth('login')
  }

  // Read by the global key handler (bound once) for the N guard.
  const keyCtxRef = useRef({})
  useEffect(() => {
    keyCtxRef.current = { section, overlayOpen: cmdOpen || shortcutsOpen, projectId }
  }, [section, cmdOpen, shortcutsOpen, projectId])

  // Global keys: "?" → shortcuts · ⌘K/Ctrl+K → command palette · "/" → local
  // search, else palette · N → Médias of the open project, else a new project.
  useEffect(() => {
    function onKey(e) {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setCmdOpen(v => !v); return
      }
      if (typing) return
      if (e.key === '/' && !e.shiftKey) {
        e.preventDefault()
        if (!focusLocalSearch()) setCmdOpen(true)
        return
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault(); setShortcutsOpen(v => !v); return
      }
      if (e.key.toLowerCase() === 'n' && isNewClipKey(e, keyCtxRef.current)) {
        e.preventDefault()
        const pid = keyCtxRef.current.projectId
        if (pid) go(projectRoute(pid, 'media'))
        else newProject()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function newProject() {
    go(PROJECTS)
    setCreatePending(true)
  }

  // ── Clips ──
  function addClips(newClips) {
    setClips(prev => {
      const ids = new Set(prev.map(c => c.clip_id))
      return [...newClips.filter(c => !ids.has(c.clip_id)), ...prev]
    })
  }

  function handleClipsCreated(newClips) {
    addClips(newClips)
    const r = routeRef.current
    if (r.view !== 'project') return
    refreshProject(r.projectId)
    // A batch job may finish after the user moved on — don't yank them away.
    if (r.stage === 'media') go(projectRoute(r.projectId, 'clips'))
  }

  // Atelier « importer une longue vidéo »: cut, file the clips under the
  // memes project, then back to the Atelier on the first one.
  async function handleAtelierClipsCreated(newClips) {
    const filed = await Promise.all(newClips.map(async clip => {
      try {
        const res = await fetch(`/api/clips/${clip.clip_id}/project`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: MEME_PROJECT }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json()
      } catch (e) {
        console.error(e)
        toast.error(`Clip « ${clip.name} » non rangé dans ${MEME_PROJECT} : ${e.message}`)
        return clip
      }
    }))
    addClips(filed)
    setAtelierImport(false)
    setAtelierVideo(null)
    if (filed.length) { setMemeClip(filed[0]); setMemeInitialTab(null) }
  }

  function openInImporter(file) {
    setAtelierVideo({ file, url: URL.createObjectURL(file), filename: file.name, sourcePath: null, sourceId: null })
    setAtelierImport(true)
    go({ view: 'memes' })
  }

  function openClip(clip, clipStage) {
    const pid = clip.project_id || projectId
    if (pid) go(projectRoute(pid, clipStage, clip.clip_id))
  }

  const handleDub = clip => openClip(clip, 'dub')
  const handleRecord = clip => openClip(clip, 'record')

  function handleMeme(clip, initialTab = null) {
    setMemeClip(clip)
    setMemeInitialTab(initialTab)
    setAtelierImport(false)
    go({ view: 'memes' })
  }

  // Server copies of a clip keep our ui_state / br_offset: those are written
  // here first (handleClipLocal) and a save response may predate them.
  function handleClipUpdated(updated) {
    const keepLocal = c => ({ ...updated, ui_state: c.ui_state, br_offset: c.br_offset })
    setClips(prev => prev.map(c => c.clip_id === updated.clip_id ? keepLocal(c) : c))
    setMemeClip(prev => prev?.clip_id === updated.clip_id ? keepLocal(prev) : prev)
  }

  // Editor / Studio working state (P4): { ui_state patch } or { br_offset }.
  function handleClipLocal(clipId, { ui_state: uiPatch, ...fields }) {
    setClips(prev => prev.map(c => c.clip_id !== clipId ? c : {
      ...c, ...fields, ...(uiPatch && { ui_state: { ...c.ui_state, ...uiPatch } }),
    }))
  }

  async function handleDelete(clipId) {
    // Optimistic remove from UI immediately, but hold the backend DELETE for 5s
    // behind an Undo toast. If user clicks Annuler, restore. Otherwise commit.
    const snapshot = clips.find(c => c.clip_id === clipId)
    if (!snapshot) return
    setClips(prev => prev.filter(c => c.clip_id !== clipId))
    toast.undo({
      msg: `Clip « ${snapshot.name || clipId} » supprimé`,
      onUndo: () => {
        setClips(prev => prev.some(c => c.clip_id === clipId) ? prev : [snapshot, ...prev])
      },
      onCommit: async () => {
        try {
          const res = await fetch(`/api/clips/${clipId}`, { method: 'DELETE' })
          if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`)
          setMemeClip(prev => prev?.clip_id === clipId ? null : prev)
          if (snapshot.project_id) refreshProject(snapshot.project_id)
        } catch (e) {
          console.error(e)
          toast.error('Suppression échouée — clip restauré')
          setClips(prev => prev.some(c => c.clip_id === clipId) ? prev : [snapshot, ...prev])
        }
      },
    })
  }

  async function putClip(clipId, path, body, failMsg) {
    try {
      const res = await fetch(`/api/clips/${clipId}/${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      handleClipUpdated(await res.json())
      return true
    } catch (e) {
      console.error(e)
      toast.error(`${failMsg} : ${e.message}`)
      return false
    }
  }

  const handleRename = (clipId, name) => putClip(clipId, 'name', { name }, 'Renommage échoué')
  const handleStatusChange = (clipId, status) => putClip(clipId, 'status', { status }, 'Changement de statut échoué')

  async function moveTo(clip, targetId, targetName) {
    const updated = await moveClip(clip.clip_id, targetId)
    handleClipUpdated(updated)
    setMoving(null)
    toast.success(`« ${clip.name} » déplacé vers « ${targetName} »`)
    if (projectId) refreshProject(projectId)
  }

  // A deleted project takes its clips with it.
  function handleProjectsChanged(deletedId) {
    if (deletedId) setClips(prev => prev.filter(c => c.project_id !== deletedId))
  }

  // ── Navigation (rail, palette, account menu) ──
  function navigate(s) {
    if (s in SECTION_STAGE) {
      const pid = projectId || lastAppRouteRef.current?.projectId
      if (!pid) { go(PROJECTS); return }
      const st = SECTION_STAGE[s]
      go(projectRoute(pid, st, CLIP_STAGES.has(st) ? pickClip(pid) : null))
      return
    }
    if (s === 'memes') { setMemeClip(null); setMemeInitialTab(null); setAtelierImport(false) }
    go({ view: s })
  }

  function goStage(st) {
    if (!projectId) return
    const clipId = CLIP_STAGES.has(st) ? (route.clipId || pickClip(projectId)) : null
    if (CLIP_STAGES.has(st) && !clipId) return
    go(projectRoute(projectId, st, clipId))
  }

  function openProject(p) {
    go(resumeRoute(p, clips.filter(c => c.project_id === p.id)))
  }

  // Export screen: opened from the editor (E / Exporter). The editor stays
  // mounted (hidden) so closing returns to it intact; its ExportPanel portals
  // into the slot below.
  const exportScreen = section === 'dub' && !!activeClip && dubExportOpen
  const closeExport = () => { setExportInitialFormat(null); goStage('dub') }

  if (route.view === 'auth') {
    return <AuthScreen key={`${route.mode}-${route.token || ''}`} initialMode={route.mode} resetToken={route.token}
      onDone={() => leaveAuth()} onLocal={() => leaveAuth()} />
  }

  const account = <AccountButton user={auth.user} accent={settings.accent} onNavigate={navigate} onLogin={openAuth} onLogout={handleLogout} />

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Full-height rail (redesign shell — rail spans the whole window) */}
      <Sidebar section={projectId ? 'projects' : section} onNavigate={navigate} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>

        {projectId ? (
          <ProjectBar project={project} stage={stage} clips={projectClips} clipId={route.clipId}
            onStage={goStage} onClip={id => go(projectRoute(projectId, stage, id))}
            onProjects={() => go(PROJECTS)}
            onCmd={() => setCmdOpen(true)} onHelp={() => setShortcutsOpen(true)} onActivity={() => navigate('activity')}
            account={account} />
        ) : (
          <TopBar onCmd={() => setCmdOpen(true)} onHelp={() => setShortcutsOpen(true)} onActivity={() => navigate('activity')} account={account} />
        )}

        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {section === 'projects' && (
          <ProjectsHome onOpen={openProject} createPending={createPending} onCreateHandled={() => setCreatePending(false)}
            onProjectsChanged={handleProjectsChanged} />
        )}
        {section === 'import' && project && (
          <ImportSection
            key={projectId}
            projectId={projectId}
            sources={project.sources}
            selectedSourceId={selectedSourceId}
            onSelectSource={id => setSourceSel(prev => ({ ...prev, [projectId]: id }))}
            onSourceUpdated={updateSource}
            onClipsCreated={handleClipsCreated}
          />
        )}
        {section === 'clips' && (
          <ClipsLibrary
            clips={projectClips}
            sources={project?.sources || []}
            projectName={project?.name}
            onDub={handleDub}
            onRecord={handleRecord}
            onMeme={handleMeme}
            onDelete={handleDelete}
            onRename={handleRename}
            onStatusChange={handleStatusChange}
            onNewClip={() => goStage('media')}
            onMove={setMoving}
          />
        )}
        {section === 'activity' && <ActivityCenter onOpenClip={handleDub} />}
        {section === 'dub' && activeClip && (
          <ExportScreenContext.Provider value={exportScreen ? { slot: exportSlot, onClose: closeExport, clip: activeClip, onActivity: () => navigate('activity'), initialFormat: exportInitialFormat } : null}>
            <div style={exportScreen
              ? { position: 'absolute', inset: 0, visibility: 'hidden', display: 'flex', flexDirection: 'column' }
              : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <DubbingWorkspace
                key={activeClip.clip_id}
                clip={activeClip}
                onUpdate={handleClipUpdated}
                onLocalState={handleClipLocal}
                onBack={() => goStage('clips')}
                exportOpen={dubExportOpen}
                onToggleExport={() => goStage(dubExportOpen ? 'dub' : 'export')}
                onRecord={() => goStage('record')}
                onHelp={() => setShortcutsOpen(true)}
              />
            </div>
          </ExportScreenContext.Provider>
        )}
        {exportScreen && <div ref={setExportSlot} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} />}
        {section === 'record' && activeClip && (
          <StudioScreen key={activeClip.clip_id} clip={activeClip} onLocalState={handleClipLocal} onBack={() => goStage('dub')}
            onExportDubbed={() => { setExportInitialFormat('mp4-dubbed'); goStage('export') }} />
        )}
        {section === 'memes' && (atelierImport ? (
          <ImportSection
            video={atelierVideo}
            onVideoSet={v => { setAtelierVideo(v); if (!v) setAtelierImport(false) }}
            onClipsCreated={handleAtelierClipsCreated}
          />
        ) : (
          <MemeGenerator clip={memeClip} initialTab={memeInitialTab}
            clips={clips} onSelectClip={setMemeClip} onClipsCreated={addClips} onOpenInImporter={openInImporter} />
        ))}
        {section === 'settings' && <Preferences />}
        {section === 'account' && <AccountScreen onLogin={openAuth} onSignedOut={() => openAuth('login')} />}
        </main>
      </div>
      <ToastDock route={exportScreen ? 'export' : section} queueClipId={exportScreen ? activeClip.clip_id : null}
        onOpenActivity={() => navigate('activity')} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={navigate}
        onNewClip={() => navigate('import')}
        onNewProject={newProject}
        onShortcuts={() => setShortcutsOpen(true)}
        clips={clips}
        onOpenClip={handleDub}
        inProject={!!projectId}
      />
      {moving && (
        <MoveClipDialog clip={moving} currentProjectId={moving.project_id} onClose={() => setMoving(null)}
          onMove={(targetId, targetName) => moveTo(moving, targetId, targetName)}
          onCreateAndMove={async name => {
            const created = await createProject({ name })
            await moveTo(moving, created.id, created.name)
          }} />
      )}
    </div>
  )
}
