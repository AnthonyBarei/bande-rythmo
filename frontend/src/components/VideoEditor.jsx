import React, { useState, useRef, useEffect, useCallback } from 'react'
import TimelineBar from './TimelineBar'
import VideoPlayer from './VideoPlayer'
import { Icon, ICONS } from '../Icons'

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

export default function VideoEditor({ video, onClipsCreated, videoStream, audioStream, audioSrc }) {
  const videoRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [pendingClips, setPendingClips] = useState([])
  const [savedClips, setSavedClips] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const pendingRef = useRef(pendingClips)
  useEffect(() => { pendingRef.current = pendingClips }, [pendingClips])

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    setPendingClips([])
    setSavedClips([])
    setEditingId(null)
  }, [video?.url])

  const saveAll = useCallback(async () => {
    const pending = pendingRef.current
    if (pending.length === 0) return
    setSaving(true)
    setError(null)
    try {
      let res
      const sourcePath = video?.sourcePath
      if (sourcePath) {
        res = await fetch('/api/clips/batch-local', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: sourcePath,
            source_filename: video.filename,
            clips: pending.map(c => ({
              name: c.name,
              start: c.start,
              end: c.end,
              ...(videoStream != null && { video_stream: videoStream }),
              ...(audioStream != null && { audio_stream: audioStream }),
            })),
          }),
        })
      } else {
        const form = new FormData()
        form.append('file', video.file, video.filename)
        form.append('clips_json', JSON.stringify(
          pending.map(c => ({
            name: c.name,
            start: c.start,
            end: c.end,
            ...(videoStream != null && { video_stream: videoStream }),
            ...(audioStream != null && { audio_stream: audioStream }),
          }))
        ))
        res = await fetch('/api/clips/batch', { method: 'POST', body: form })
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const results = await res.json()
      setSavedClips(prev => [...results, ...prev])
      setPendingClips([])
      onClipsCreated(results)
    } catch (e) {
      setError('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }, [video?.url, video?.file, video?.filename, video?.sourcePath, onClipsCreated, videoStream, audioStream])

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
    setPendingClips(prev => [...prev, { _id: newId(), name: '', start, end }])
  }

  function handleUpdate(id, start, end) {
    setPendingClips(prev => prev.map(c => c._id === id ? { ...c, start, end } : c))
  }

  function handleRemove(id) {
    setPendingClips(prev => prev.filter(c => c._id !== id))
  }

  function startEdit(c) {
    setEditingId(c._id)
    setEditValue(c.name)
  }

  function commitEdit() {
    if (editingId != null) {
      setPendingClips(prev => prev.map(c => c._id === editingId ? { ...c, name: editValue.trim() } : c))
    }
    setEditingId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Video */}
      <VideoPlayer
        src={video.url}
        audioSrc={audioSrc}
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
        <span style={{ color: '#f5c518' }}>◎</span>
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

      {/* Pending clips queue — inline rename */}
      {pendingClips.length > 0 && (
        <div style={{ padding: '12px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
              Clips en attente
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{pendingClips.length}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10.5, color: 'var(--text4)' }}>Cliquer le nom pour éditer · ⏎ valider</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {pendingClips.map((c, idx) => (
              <div key={c._id} style={{
                display: 'grid', gridTemplateColumns: '28px 1fr auto auto 28px',
                alignItems: 'center', gap: 10,
                padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              }}>
                <span style={{
                  width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                  fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 800, borderRadius: 4,
                }}>{idx + 1}</span>
                {editingId === c._id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    style={{ fontSize: 13 }}
                  />
                ) : (
                  <span
                    onClick={() => startEdit(c)}
                    style={{ fontSize: 13, cursor: 'text', color: c.name ? 'var(--text)' : 'var(--text3)', fontStyle: c.name ? 'normal' : 'italic' }}
                  >
                    {c.name || 'Sans nom — cliquer pour nommer ✎'}
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
                  {fmt(c.start)} → {fmt(c.end)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>
                  {(c.end - c.start).toFixed(1)}s
                </span>
                <button
                  onClick={() => handleRemove(c._id)}
                  title="Retirer"
                  style={{ color: 'var(--text3)', background: 'none', padding: '3px 5px', borderRadius: 3, border: 'none', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
                ><Icon d={ICONS.trash} size={13} /></button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={saveAll}
              disabled={saving}
              style={{
                padding: '8px 16px',
                background: saving ? 'var(--surface3)' : 'var(--accent)',
                color: saving ? 'var(--text3)' : '#000',
                fontWeight: 600, fontSize: 13, borderRadius: 'var(--radius)',
              }}
            >
              {saving ? '⏳ Création…' : `Créer ${pendingClips.length} clip${pendingClips.length > 1 ? 's' : ''}`}
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
            → Retrouvez vos clips dans <strong style={{ color: '#f5c518' }}>Mes Clips</strong>
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
