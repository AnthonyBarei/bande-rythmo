import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ImportSection from './components/ImportSection'
import ClipsLibrary from './components/ClipsLibrary'
import DubbingWorkspace from './components/DubbingWorkspace'
import MemeGenerator from './components/MemeGenerator'
import Preferences from './components/Preferences'
import { Icon, ICONS, Kbd } from './ui'
import { ProgressProvider } from './ProgressContext'
import { ToastProvider, useToast } from './ToastContext'
import ShortcutsOverlay from './components/ShortcutsOverlay'
import CommandPalette from './components/CommandPalette'
import ActivityCenter from './components/ActivityCenter'

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
const RESTORABLE = new Set(['import', 'clips', 'dub', 'memes', 'settings', 'activity'])

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

function AppInner() {
  const toast = useToast()
  const [initialNav] = useState(loadNav)
  const [section, setSection] = useState(initialNav.section || 'import')
  const [video, setVideo] = useState(null)
  const [clips, setClips] = useState([])
  const [activeClip, setActiveClip] = useState(null)
  const [memeClip, setMemeClip] = useState(null)
  const [memeInitialTab, setMemeInitialTab] = useState(null)
  const [dubExportOpen, setDubExportOpen] = useState(false)
  const [dubMode, setDubMode] = useState('dub')
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
        if (initialNav.section === 'dub') {
          const clip = data.find(c => c.clip_id === initialNav.clipId)
          if (clip) setActiveClip(clip)
          else setSection('clips')
        }
      } catch (e) {
        console.error('Failed to fetch clips:', e)
        if (!live) return
        toast.error('Impossible de charger les clips — le serveur est-il lancé ?')
        setSection(s => s === 'dub' ? 'clips' : s)
      }
    }
    fetchClips()
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (section === 'dub' && !activeClip) return // still restoring
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
    setDubMode('dub')
    setSection('dub')
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
    if (s === 'record' || s === 'dub') { const tgt = activeClip || clips[0]; if (tgt) { setActiveClip(tgt); setDubMode(s); setSection('dub') } else setSection('clips'); return }
    setSection(s)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Full-height rail (redesign shell — rail spans the whole window) */}
      <Sidebar section={section} dubMode={dubMode} onNavigate={navigate} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Top bar — only over content; hidden on the full-bleed editor. Search right-aligned. */}
        {section !== 'dub' && (
        <div style={{ height: 52, flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text)' }}>
            BANDE RYTHMO <span style={{ color: 'var(--text4)', fontWeight: 400 }}>· studio</span>
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setCmdOpen(true)} title="Palette de commandes (⌘K)"
            style={{ display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 12px', minWidth: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 99, cursor: 'pointer', color: 'var(--text3)' }}>
            <Icon d={ICONS.search} size={15} />
            <span style={{ fontSize: 13 }}>Rechercher ou commande…</span>
            <div style={{ flex: 1 }} />
            <span style={{ display: 'flex', gap: 3 }}>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <button onClick={() => setShortcutsOpen(true)} title="Raccourcis clavier (?)"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'transparent', border: '1px solid transparent', color: 'var(--text2)', borderRadius: 9, cursor: 'pointer' }}>
            <Icon d={ICONS.kbd} size={16} />
          </button>
          <button onClick={() => setSection('activity')} title="Activité — jobs & exports"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: section === 'activity' ? 'var(--accent-soft)' : 'transparent', border: '1px solid transparent', color: section === 'activity' ? 'var(--accent)' : 'var(--text2)', borderRadius: 9, cursor: 'pointer' }}>
            <Icon d={ICONS.activity} size={16} />
          </button>
          <div style={{ width: 1, height: 22, background: 'var(--border)' }} />
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0b0d', fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-mono)' }}>S</div>
        </div>
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
          <DubbingWorkspace
            key={activeClip.clip_id}
            clip={activeClip}
            onUpdate={handleClipUpdated}
            onBack={() => { setDubExportOpen(false); setSection('clips') }}
            exportOpen={dubExportOpen}
            onToggleExport={() => setDubExportOpen(v => !v)}
            initialPanel={dubMode}
          />
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
