import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ImportSection from './components/ImportSection'
import ClipsLibrary from './components/ClipsLibrary'
import DubbingWorkspace from './components/DubbingWorkspace'
import MemeGenerator from './components/MemeGenerator'
import Preferences from './components/Preferences'
import { Icon, ICONS } from './Icons'
import { ProgressProvider } from './ProgressContext'
import { ToastProvider, useToast } from './ToastContext'
import ShortcutsOverlay from './components/ShortcutsOverlay'
import CommandPalette from './components/CommandPalette'
import ActivityCenter from './components/ActivityCenter'

const SAVE_STATUS = {
  saved:   { text: '✓ Sauvegardé', color: 'var(--success)' },
  saving:  { text: '… Sauvegarde', color: 'var(--text2)' },
  unsaved: { text: '● Non sauvegardé', color: '#f5c518' },
  error:   { text: '✕ Erreur', color: 'var(--danger)' },
}

export default function App() {
  return (
    <ProgressProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ProgressProvider>
  )
}

function AppInner() {
  const toast = useToast()
  const [section, setSection] = useState('import')
  const [video, setVideo] = useState(null)
  const [clips, setClips] = useState([])
  const [activeClip, setActiveClip] = useState(null)
  const [memeClip, setMemeClip] = useState(null)
  const [memeInitialTab, setMemeInitialTab] = useState(null)
  const [dubSaveStatus, setDubSaveStatus] = useState('saved')
  const [dubExportOpen, setDubExportOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => { fetchClips() }, [])

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

  async function fetchClips() {
    try {
      const res = await fetch('/api/clips/')
      if (!res.ok) return
      const data = await res.json()
      setClips(data)
    } catch (e) {
      console.error('Failed to fetch clips:', e)
    }
  }

  function handleClipsCreated(newClips) {
    setClips(prev => {
      const ids = new Set(prev.map(c => c.clip_id))
      return [...newClips.filter(c => !ids.has(c.clip_id)), ...prev]
    })
    setSection('clips')
  }

  function handleDub(clip) {
    setActiveClip(clip)
    setSection('dub')
  }

  function handleMeme(clip, initialTab = null) {
    setMemeClip(clip)
    setMemeInitialTab(initialTab)
    setSection('memes')
  }

  function handleClipUpdated(updated) {
    setClips(prev => prev.map(c => c.clip_id === updated.clip_id ? updated : c))
    setActiveClip(updated)
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
          await fetch(`/api/clips/${clipId}`, { method: 'DELETE' })
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
      if (!res.ok) return
      const updated = await res.json()
      setClips(prev => prev.map(c => c.clip_id === clipId ? updated : c))
    } catch (e) {
      console.error(e)
    }
  }

  async function handleStatusChange(clipId, status) {
    try {
      const res = await fetch(`/api/clips/${clipId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) return
      const updated = await res.json()
      setClips(prev => prev.map(c => c.clip_id === clipId ? updated : c))
    } catch (e) {
      console.error(e)
    }
  }

  async function handleSetProject(clipId, project) {
    try {
      const res = await fetch(`/api/clips/${clipId}/project`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project }),
      })
      if (!res.ok) return
      const updated = await res.json()
      setClips(prev => prev.map(c => c.clip_id === clipId ? updated : c))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Top bar — redesign shell.jsx TopBar */}
      <div style={{ height: 52, flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 14 }}>
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
            <kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--surface2)', border: '1px solid var(--border2)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)' }}>⌘</kbd>
            <kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--surface2)', border: '1px solid var(--border2)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)' }}>K</kbd>
          </span>
        </button>
        <div style={{ flex: 1 }} />
        {section === 'dub' && activeClip && (() => {
          const ss = SAVE_STATUS[dubSaveStatus] || SAVE_STATUS.saved
          return (
            <>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 500, color: ss.color, padding: '4px 10px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 99 }}>
                {ss.text}
              </span>
              <button onClick={() => setDubExportOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', background: 'var(--accent)', color: '#000', fontWeight: 700, border: 'none', borderRadius: 6, fontSize: 12.5, cursor: 'pointer' }}>
                <Icon d={ICONS.download} size={14} /> Exporter
              </button>
              <div style={{ width: 1, height: 20, background: 'var(--border2)' }} />
            </>
          )
        })()}
        <button onClick={() => setShortcutsOpen(true)} title="Raccourcis clavier (?)"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          <Icon d={ICONS.kbd} size={14} /> Raccourcis
        </button>
        <button onClick={() => setSection('activity')} title="Activité — jobs & exports"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 30, background: section === 'activity' ? 'var(--accent-soft)' : 'var(--surface2)', border: '1px solid var(--border2)', color: section === 'activity' ? 'var(--accent)' : 'var(--text2)', borderRadius: 6, cursor: 'pointer' }}>
          <Icon d={ICONS.activity} size={15} />
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border2)' }} />
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
          <Icon d={ICONS.user} size={15} />
        </div>
      </div>

      {/* Body: nav rail + main */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <Sidebar section={section} onNavigate={s => {
          setDubExportOpen(false)
          if (s === 'memes') { setMemeClip(null); setSection('memes'); return }
          // Éditeur / Studio need a clip — use active, else most recent, else library.
          if (s === 'dub' || s === 'record') {
            const target = activeClip || clips[0]
            if (target) { setActiveClip(target); setSection('dub') }
            else setSection('clips')
            return
          }
          setSection(s)
        }} />
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
            clip={activeClip}
            onUpdate={handleClipUpdated}
            onBack={() => { setDubExportOpen(false); setSection('clips') }}
            onSaveStatus={setDubSaveStatus}
            exportOpen={dubExportOpen}
            onToggleExport={() => setDubExportOpen(v => !v)}
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
        onNavigate={setSection}
        onNewClip={() => setSection('import')}
        onShortcuts={() => setShortcutsOpen(true)}
        clips={clips}
        onOpenClip={handleDub}
      />
    </div>
  )
}
