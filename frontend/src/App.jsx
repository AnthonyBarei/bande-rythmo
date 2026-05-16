import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ImportSection from './components/ImportSection'
import ClipsLibrary from './components/ClipsLibrary'
import DubbingWorkspace from './components/DubbingWorkspace'
import MemeGenerator from './components/MemeGenerator'
import Preferences from './components/Preferences'
import { Icon, ICONS } from './Icons'

export default function App() {
  const [section, setSection] = useState('import')
  const [video, setVideo] = useState(null)
  const [clips, setClips] = useState([])
  const [activeClip, setActiveClip] = useState(null)
  const [memeClip, setMemeClip] = useState(null)

  useEffect(() => { fetchClips() }, [])

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

  function handleMeme(clip) {
    setMemeClip(clip)
    setSection('memes')
  }

  function handleClipUpdated(updated) {
    setClips(prev => prev.map(c => c.clip_id === updated.clip_id ? updated : c))
    setActiveClip(updated)
  }

  async function handleDelete(clipId) {
    try {
      await fetch(`/api/clips/${clipId}`, { method: 'DELETE' })
      setClips(prev => prev.filter(c => c.clip_id !== clipId))
    } catch (e) {
      console.error(e)
    }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Top bar */}
      <div style={{ height: 44, flexShrink: 0, background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 10, color: '#000' }}>
          BR
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Bande Rythmo</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>v2.0</span>
        <div style={{ flex: 1 }} />
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 4, fontSize: 12 }}>
          <Icon d={ICONS.kbd} size={14} /> Raccourcis
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border2)' }} />
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
          <Icon d={ICONS.user} size={15} />
        </div>
      </div>

      {/* Body: nav rail + main */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <Sidebar section={section} onNavigate={s => { if (s === 'memes') setMemeClip(null); setSection(s) }} clipCount={clips.length} />
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
          />
        )}
        {section === 'dub' && activeClip && (
          <DubbingWorkspace
            clip={activeClip}
            onUpdate={handleClipUpdated}
            onBack={() => setSection('clips')}
          />
        )}
        {section === 'memes' && (
          <MemeGenerator clip={memeClip} onBack={memeClip ? () => setSection('clips') : null} />
        )}
        {section === 'settings' && <Preferences />}
        </main>
      </div>
    </div>
  )
}
