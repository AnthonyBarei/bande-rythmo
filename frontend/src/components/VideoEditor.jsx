import React, { useState, useRef, useEffect, useCallback } from 'react'
import TimelineBar from './TimelineBar'
import VideoPlayer from './VideoPlayer'

let _pendingId = 0
const newId = () => ++_pendingId

const fmt = t => {
  if (t === null || t === undefined) return '--:--.--'
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = (t % 60).toFixed(2).padStart(5, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${String(m).padStart(2, '0')}:${s}`
}

const Kbd = ({ children }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '1px 5px', background: '#1a1a1a',
    border: '1px solid #333', borderBottom: '2px solid #333',
    borderRadius: 3, fontFamily: 'var(--font-mono)',
    fontSize: 10, color: 'var(--text3)', lineHeight: '16px',
  }}>{children}</span>
)

export default function VideoEditor({ video, onClipsCreated }) {
  const videoRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [nextName, setNextName] = useState('')
  const [pendingClips, setPendingClips] = useState([])
  const [savedClips, setSavedClips] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const pendingRef = useRef(pendingClips)
  useEffect(() => { pendingRef.current = pendingClips }, [pendingClips])

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    setPendingClips([])
    setSavedClips([])
    setNextName('')
  }, [video?.id])

  const saveAll = useCallback(async () => {
    const pending = pendingRef.current
    if (pending.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const results = await Promise.all(
        pending.map(c =>
          fetch('/api/clips/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_id: video.id, start: c.start, end: c.end, name: c.name }),
          }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        )
      )
      setSavedClips(prev => [...results, ...prev])
      setPendingClips([])
      onClipsCreated(results)
    } catch (e) {
      setError('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }, [video?.id, onClipsCreated])

  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      const v = videoRef.current
      if (!v) return
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveAll(); return }
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - (e.shiftKey ? 1 : 5)); break
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration || 0, v.currentTime + (e.shiftKey ? 1 : 5)); break
        case 'm': case 'M': e.preventDefault(); v.muted = !v.muted; break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveAll])

  function handleAdd(start, end) {
    const name = nextName.trim() || `Clip ${savedClips.length + pendingClips.length + 1}`
    setPendingClips(prev => [...prev, { _id: newId(), name, start, end }])
    setNextName('')
  }

  function handleUpdate(id, start, end) {
    setPendingClips(prev => prev.map(c => c._id === id ? { ...c, start, end } : c))
  }

  function handleRemove(id) {
    setPendingClips(prev => prev.filter(c => c._id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Video */}
      <VideoPlayer
        src={video.url}
        videoRef={videoRef}
        maxHeight={420}
        onTimeUpdate={t => setCurrentTime(t)}
        onLoadedMetadata={d => setDuration(d)}
      />

      {/* Drag-to-create timeline */}
      <TimelineBar
        duration={duration}
        currentTime={currentTime}
        pendingClips={pendingClips}
        savedClips={savedClips}
        onSeek={t => { if (videoRef.current) videoRef.current.currentTime = t }}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onRemove={handleRemove}
      />

      {/* Instruction row + timecode */}
      <div style={{
        padding: '6px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text2)',
      }}>
        <span style={{ color: '#f90' }}>◎</span>
        <span><strong style={{ color: 'var(--text)' }}>Glissez sur la timeline</strong> pour délimiter un clip — déplacez ou redimensionnez les blocs orange ensuite.</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)' }}>
          {fmt(currentTime)} / {fmt(duration)}
        </span>
      </div>

      {/* Shortcut hints */}
      <div style={{
        padding: '5px 16px', background: '#0e0e0e', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {[
          { keys: ['Espace'], label: 'Lecture/Pause' },
          { keys: ['←', '→'], label: '±5s' },
          { keys: ['⇧←', '⇧→'], label: '±1s' },
          { keys: ['M'], label: 'Mute' },
          { keys: ['Suppr'], label: 'Supprimer bloc' },
        ].map(({ keys, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
            {keys.map(k => <Kbd key={k}>{k}</Kbd>)}
            <span>{label}</span>
          </span>
        ))}
      </div>

      {/* Clip name input */}
      <div style={{
        padding: '10px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <input
          value={nextName}
          onChange={e => setNextName(e.target.value)}
          placeholder={`Nom du prochain clip (défaut : Clip ${savedClips.length + pendingClips.length + 1})`}
          style={{ flex: 1, maxWidth: 300 }}
        />
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>appliqué au prochain bloc créé</span>
      </div>

      {/* Pending clips queue */}
      {pendingClips.length > 0 && (
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, padding: '10px 0 6px' }}>
            À créer ({pendingClips.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {pendingClips.map(c => (
              <div key={c._id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid #f903', borderRadius: 4,
              }}>
                <span style={{ color: '#f90', fontSize: 11 }}>◎</span>
                <span style={{ flex: 1, fontSize: 13 }}>{c.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
                  {fmt(c.start)} → {fmt(c.end)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{(c.end - c.start).toFixed(1)}s</span>
                <button
                  onClick={() => handleRemove(c._id)}
                  style={{ color: '#f554', background: 'none', fontSize: 12, padding: '2px 5px', borderRadius: 2, border: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f55'}
                  onMouseLeave={e => e.currentTarget.style.color = '#f554'}
                >✕</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={saveAll}
              disabled={saving}
              style={{
                padding: '8px 16px',
                background: saving ? '#333' : '#f90',
                color: saving ? '#555' : '#000',
                fontWeight: 600, fontSize: 13, borderRadius: 4,
              }}
            >
              {saving ? '⏳ Création...' : `✂ Créer ${pendingClips.length} clip${pendingClips.length > 1 ? 's' : ''}`}
            </button>
            <Kbd>Ctrl</Kbd>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>+</span>
            <Kbd>S</Kbd>
          </div>
        </div>
      )}

      {/* Saved clips */}
      {savedClips.length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, padding: '12px 0 8px' }}>
            Clips créés ({savedClips.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {savedClips.map(clip => (
              <div key={clip.clip_id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 4,
              }}>
                <span style={{ color: 'var(--success)', fontSize: 12 }}>✓</span>
                <span style={{ flex: 1, fontSize: 13 }}>{clip.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
                  {fmt(clip.start)} → {fmt(clip.end)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{(clip.end - clip.start).toFixed(1)}s</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
            → Retrouvez vos clips dans <strong style={{ color: '#f90' }}>Mes Clips</strong>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          margin: '0 16px', padding: '10px 14px',
          background: 'rgba(229,69,69,0.1)', border: '1px solid rgba(229,69,69,0.3)',
          borderRadius: 4, color: 'var(--danger)', fontSize: 13,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
