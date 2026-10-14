import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ImportSection from './components/ImportSection'
import ClipsLibrary from './components/ClipsLibrary'
import DubbingWorkspace from './components/DubbingWorkspace'
import MemeGenerator from './components/MemeGenerator'
import Preferences from './components/Preferences'
import { T, Icon, ICONS, Btn, Kbd, Avatar } from './ui'
import { useSettings } from './SettingsContext'
import { ProgressProvider } from './ProgressContext'
import { ToastProvider, useToast } from './ToastContext'
import ShortcutsOverlay from './components/ShortcutsOverlay'
import CommandPalette from './components/CommandPalette'
import ActivityCenter from './components/ActivityCenter'
import StudioScreen from './components/StudioScreen'
import { ExportScreenContext } from './components/exportScreen'

export default function App() {
  return (
    <ProgressProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ProgressProvider>
  )
}

const NAV_KEY = 'br-nav'
const RESTORABLE = new Set(['import', 'clips', 'dub', 'record', 'memes', 'settings', 'activity'])
const CLIP_SCREENS = new Set(['dub', 'record'])

function loadNav() {
  try {
    const nav = JSON.parse(sessionStorage.getItem(NAV_KEY) || '{}')
    return RESTORABLE.has(nav.section) ? nav : {}
  } catch {
    return {} // storage blocked / corrupt — start fresh
  }
}

function saveNav(nav) {
  try {
    sessionStorage.setItem(NAV_KEY, JSON.stringify(nav))
  } catch {
    // storage blocked — reload simply starts on Importer
  }
}

// Top bar — port of redesign shell.jsx TopBar.
function TopBar({ accent, onCmd, onHelp, onActivity }) {
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
      <Avatar name="Studio" color={accent} size={30} />
    </div>
  )
}

function AppInner() {
  const toast = useToast()
  const { settings } = useSettings()
  const [initialNav] = useState(loadNav)
  const [section, setSection] = useState(initialNav.section || 'import')
  const [video, setVideo] = useState(null)
  const [clips, setClips] = useState([])
  const [activeClip, setActiveClip] = useState(null)
  const [memeClip, setMemeClip] = useState(null)
  const [memeInitialTab, setMemeInitialTab] = useState(null)
  const [dubExportOpen, setDubExportOpen] = useState(false)
  const [exportSlot, setExportSlot] = useState(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    let live = true
    async function fetchClips() {
      try {
        const res = await fetch('/api/clips/')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!live) return
        setClips(data)
        if (CLIP_SCREENS.has(initialNav.section)) {
          const clip = data.find(c => c.clip_id === initialNav.clipId)
          if (clip) setActiveClip(clip)
          else setSection('clips')
        }
      } catch (e) {
        console.error('Failed to fetch clips:', e)
        if (!live) return
        toast.error('Impossible de charger les clips — le serveur est-il lancé ?')
        setSection(s => CLIP_SCREENS.has(s) ? 'clips' : s)
      }
    }
    fetchClips()
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (CLIP_SCREENS.has(section) && !activeClip) return // still restoring
    saveNav({ section, clipId: activeClip?.clip_id || null })
  }, [section, activeClip])

  // Global keys: "?" → shortcuts · ⌘K/Ctrl+K or "/" → command palette.
  useEffect(() => {
    function onKey(e) {
      const typing = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setCmdOpen(v => !v); return
      }
      if (typing) return
      if (e.key === '/' && !e.shiftKey) { e.preventDefault(); setCmdOpen(true); return }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault(); setShortcutsOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleClipsCreated(newClips) {
    setClips(prev => {
      const ids = new Set(prev.map(c => c.clip_id))
      return [...newClips.filter(c => !ids.has(c.clip_id)), ...prev]
    })
    // A batch job may finish after the user moved on — don't yank them away.
    setSection(s => s === 'import' ? 'clips' : s)
  }

  function handleDub(clip) {
    setActiveClip(clip)
    setSection('dub')
  }

  function handleRecord(clip) {
    setDubExportOpen(false)
    setActiveClip(clip)
    setSection('record')
  }

  function handleMeme(clip, initialTab = null) {
    setMemeClip(clip)
    setMemeInitialTab(initialTab)
    setSection('memes')
  }

  // Never switch the open clip: a late auto-save of a previous clip must not
  // yank the editor back to it.
  function handleClipUpdated(updated) {
    setClips(prev => prev.map(c => c.clip_id === updated.clip_id ? updated : c))
    setActiveClip(prev => prev?.clip_id === updated.clip_id ? updated : prev)
    setMemeClip(prev => prev?.clip_id === updated.clip_id ? updated : prev)
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
          setActiveClip(prev => prev?.clip_id === clipId ? null : prev)
          setMemeClip(prev => prev?.clip_id === clipId ? null : prev)
        } catch (e) {
          console.error(e)
          toast.error('Suppression échouée — clip restauré')
          setClips(prev => prev.some(c => c.clip_id === clipId) ? prev : [snapshot, ...prev])
        }
      },
    })
  }

  async function handleRename(clipId, name) {
    try {
      const res = await fetch(`/api/clips/${clipId}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      handleClipUpdated(await res.json())
      return true
    } catch (e) {
      console.error(e)
      toast.error(`Renommage échoué : ${e.message}`)
      return false
    }
  }

  async function handleStatusChange(clipId, status) {
    try {
      const res = await fetch(`/api/clips/${clipId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      handleClipUpdated(await res.json())
      return true
    } catch (e) {
      console.error(e)
      toast.error(`Changement de statut échoué : ${e.message}`)
      return false
    }
  }

  async function handleSetProject(clipId, project) {
    try {
      const res = await fetch(`/api/clips/${clipId}/project`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      handleClipUpdated(await res.json())
      return true
    } catch (e) {
      console.error(e)
      toast.error(`Changement de projet échoué : ${e.message}`)
      return false
    }
  }

  function navigate(s) {
    setDubExportOpen(false)
    if (s === 'memes') { setMemeClip(null); setMemeInitialTab(null); setSection('memes'); return }
    if (CLIP_SCREENS.has(s)) { const tgt = activeClip || clips[0]; if (tgt) { setActiveClip(tgt); setSection(s) } else setSection('clips'); return }
    setSection(s)
  }

  // Export screen: opened from the editor (E / Exporter). The editor stays
  // mounted (hidden) so closing returns to it intact; its ExportPanel portals
  // into the slot below.
  const exportScreen = section === 'dub' && !!activeClip && dubExportOpen
  const closeExport = () => setDubExportOpen(false)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Full-height rail (redesign shell — rail spans the whole window) */}
      <Sidebar section={exportScreen ? 'export' : section} onNavigate={navigate} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>

        {/* Top bar — only over content; hidden on the full-bleed editor. */}
        {(section !== 'dub' || exportScreen) && (
          <TopBar accent={settings.accent} onCmd={() => setCmdOpen(true)} onHelp={() => setShortcutsOpen(true)} onActivity={() => navigate('activity')} />
        )}

        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {section === 'import' && (
          <ImportSection
            video={video}
            onVideoSet={setVideo}
            onClipsCreated={handleClipsCreated}
          />
        )}
        {section === 'clips' && (
          <ClipsLibrary
            clips={clips}
            onDub={handleDub}
            onRecord={handleRecord}
            onMeme={handleMeme}
            onDelete={handleDelete}
            onRename={handleRename}
            onStatusChange={handleStatusChange}
            onNewClip={() => setSection('import')}
            onSetProject={handleSetProject}
          />
        )}
        {section === 'activity' && <ActivityCenter />}
        {section === 'dub' && activeClip && (
          <ExportScreenContext.Provider value={exportScreen ? { slot: exportSlot, onClose: closeExport, clip: activeClip } : null}>
            <div style={exportScreen
              ? { position: 'absolute', inset: 0, visibility: 'hidden', display: 'flex', flexDirection: 'column' }
              : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <DubbingWorkspace
                key={activeClip.clip_id}
                clip={activeClip}
                onUpdate={handleClipUpdated}
                onBack={() => { setDubExportOpen(false); setSection('clips') }}
                exportOpen={dubExportOpen}
                onToggleExport={() => setDubExportOpen(v => !v)}
                onHelp={() => setShortcutsOpen(true)}
              />
            </div>
          </ExportScreenContext.Provider>
        )}
        {exportScreen && <div ref={setExportSlot} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} />}
        {section === 'record' && activeClip && (
          <StudioScreen key={activeClip.clip_id} clip={activeClip} onBack={() => navigate('dub')} />
        )}
        {section === 'memes' && (
          <MemeGenerator clip={memeClip} initialTab={memeInitialTab} onBack={memeClip ? () => setSection('clips') : null} />
        )}
        {section === 'settings' && <Preferences />}
        </main>
      </div>
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={navigate}
        onNewClip={() => navigate('import')}
        onShortcuts={() => setShortcutsOpen(true)}
        clips={clips}
        onOpenClip={handleDub}
      />
    </div>
  )
}
