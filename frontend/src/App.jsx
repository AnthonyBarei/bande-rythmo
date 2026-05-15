import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ImportSection from './components/ImportSection'
import ClipsLibrary from './components/ClipsLibrary'
import DubbingWorkspace from './components/DubbingWorkspace'
import MemeGenerator from './components/MemeGenerator'

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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar section={section} onNavigate={setSection} clipCount={clips.length} />
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
            onRefresh={fetchClips}
            onDelete={handleDelete}
            onRename={handleRename}
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
          <MemeGenerator clip={memeClip || null} />
        )}
      </main>
    </div>
  )
}
