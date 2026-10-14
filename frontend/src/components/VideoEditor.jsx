import React, { useState, useRef, useEffect, useCallback } from 'react'
import TimelineBar from './TimelineBar'
import VideoPlayer from './VideoPlayer'
import { Icon, ICONS, Dot, T, alpha } from '../ui'
import { useProgress } from '../ProgressContext'
import { fmtClockHours as fmt } from '../utils/timecode'

let _pendingId = 0
const newId = () => ++_pendingId
const MIN_DUR = 0.2
// VideoPlayer's own transport bar (5 + 32 + 5 padding/button + 1 border).

// Importer left column — reference screen-import.jsx Preview · ZoomTimeline · PendingList.
// The header actions (Marquer un clip / Créer N clips) live in ImportSection and
// drive this component through `actionsRef`; state flows back via `onStateChange`.
export default function VideoEditor({ video, onClipsCreated, videoStream, audioStream, audioSrc, actionsRef, onStateChange }) {
  const videoRef = useRef(null)
  const progress = useProgress()
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [pendingClips, setPendingClips] = useState([])
  const [savedClips, setSavedClips] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [markIn, setMarkIn] = useState(null)
  const pendingRef = useRef(pendingClips)
  const savingRef = useRef(false)
  useEffect(() => { pendingRef.current = pendingClips }, [pendingClips])

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    setPendingClips([])
    setSavedClips([])
    setEditingId(null)
    setMarkIn(null)
  }, [video?.url])

  const saveAll = useCallback(async () => {
    const pending = pendingRef.current
    if (pending.length === 0 || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    // Clips added while the batch runs stay queued.
    const submitted = new Set(pending.map(c => c._id))
    const finish = () => { savingRef.current = false; setSaving(false) }
    const sourcePath = video?.sourcePath

    // Local/Plex source → job mode (per-segment progress + cancel).
    if (sourcePath) {
      const body = {
        path: sourcePath,
        source_filename: video.filename,
        clips: pending.map(c => ({
          name: c.name, start: c.start, end: c.end,
          ...(videoStream != null && { video_stream: videoStream }),
          ...(audioStream != null && { audio_stream: audioStream }),
        })),
      }
      const fireJob = async () => {
        const res = await fetch('/api/clips/batch-local-job', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e.detail || `HTTP ${res.status}`)
        }
        const { job_id } = await res.json()
        return job_id
      }
      try {
        const jobId = await fireJob()
        progress.start({
          kind: 'import-batch',
          title: `Découpe ${pending.length} clip${pending.length > 1 ? 's' : ''}`,
          jobId,
          retry: fireJob,
          onDone: (result) => {
            const results = (result && result.clips) || []
            setSavedClips(prev => [...results, ...prev])
            setPendingClips(prev => prev.filter(c => !submitted.has(c._id)))
            onClipsCreated(results)
            finish()
          },
          onError: (err) => { setError('Erreur : ' + err.message); finish() },
          onCancel: () => { setError('Découpe annulée.'); finish() },
        })
      } catch (e) {
        setError('Erreur : ' + e.message)
        finish()
      }
      return
    }

    // Uploaded file → sync (upload stream tied to request).
    try {
      const form = new FormData()
      form.append('file', video.file, video.filename)
      form.append('clips_json', JSON.stringify(
        pending.map(c => ({
          name: c.name, start: c.start, end: c.end,
          ...(videoStream != null && { video_stream: videoStream }),
          ...(audioStream != null && { audio_stream: audioStream }),
        }))
      ))
      const res = await fetch('/api/clips/batch', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const results = await res.json()
      setSavedClips(prev => [...results, ...prev])
      setPendingClips(prev => prev.filter(c => !submitted.has(c._id)))
      onClipsCreated(results)
    } catch (e) {
      setError('Erreur : ' + e.message)
    } finally {
      finish()
    }
  }, [video?.url, video?.file, video?.filename, video?.sourcePath, onClipsCreated, videoStream, audioStream, progress])

  // "Marquer un clip": 1st press = IN at the playhead, 2nd press = OUT → pending clip.
  const markClip = useCallback(() => {
    const t = videoRef.current?.currentTime ?? 0
    if (markIn == null) { setMarkIn(t); return }
    const start = Math.min(markIn, t), end = Math.max(markIn, t)
    if (end - start >= MIN_DUR) setPendingClips(prev => [...prev, { _id: newId(), name: '', start, end }])
    setMarkIn(null)
  }, [markIn])

  useEffect(() => {
    if (!actionsRef) return
    actionsRef.current = { save: saveAll, mark: markClip }
  }, [actionsRef, saveAll, markClip])

  useEffect(() => {
    onStateChange?.({ count: pendingClips.length, saving, duration, marking: markIn != null })
  }, [onStateChange, pendingClips.length, saving, duration, markIn])

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

  const handleRemove = useCallback(id => {
    setPendingClips(prev => prev.filter(c => c._id !== id))
  }, [])

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
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Preview video={video} audioSrc={audioSrc} videoRef={videoRef} currentTime={currentTime} duration={duration} markIn={markIn}
        onTimeUpdate={setCurrentTime} onLoadedMetadata={setDuration} />

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 1 auto', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>CLIPS EN ATTENTE</span>
          <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{pendingClips.length}</span>
          <div style={{ flex: 1 }} />
          {pendingClips.length > 0 && <span style={{ fontSize: 10.5, color: T.text4 }}>cliquer le nom pour éditer · ⏎ valider</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', minHeight: 0 }}>
          {pendingClips.map((c, i) => (
            <div key={c._id} style={{
              display: 'grid', gridTemplateColumns: '20px 1fr auto auto 30px', alignItems: 'center', gap: 12, flexShrink: 0,
              padding: '8px 12px', background: T.surface, border: `1px solid ${c.name ? alpha(T.accent, '33') : T.border2}`, borderRadius: T.r.ctl,
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: alpha(T.accent, '22'), color: T.accent, fontSize: 9.5, fontWeight: 800, fontFamily: T.fontMono, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
              {editingId === c._id ? (
                <input autoFocus value={editValue} placeholder={`Clip ${i + 1}`}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null) }}
                  style={{ background: T.bg2, border: `1px solid ${T.accent}`, borderRadius: 6, padding: '5px 8px', fontSize: T.fs.sm, color: T.text, fontFamily: T.fontUI, outline: 'none' }} />
              ) : (
                <div onClick={() => startEdit(c)} style={{ fontSize: T.fs.sm, fontWeight: 500, color: c.name ? T.text : T.text3, fontStyle: c.name ? 'normal' : 'italic', cursor: 'text', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {c.name || 'Sans nom — cliquer pour nommer'}
                  <Icon d={ICONS.edit} size={11} stroke={T.text4} style={{ opacity: 0.5 }} />
                </div>
              )}
              <span style={{ fontFamily: T.fontMono, fontSize: T.fs.xs, color: T.text2 }}>{fmt(c.start)} → {fmt(c.end)}</span>
              <span style={{ fontFamily: T.fontMono, fontSize: T.fs.xs, color: T.accent }}>{(c.end - c.start).toFixed(1)}s</span>
              <button onClick={() => handleRemove(c._id)} title="Retirer" style={{ background: 'transparent', border: 'none', color: T.text3, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}><Icon d={ICONS.trash} size={14} /></button>
            </div>
          ))}

          {savedClips.map(clip => (
            <div key={clip.clip_id} style={{
              display: 'grid', gridTemplateColumns: '20px 1fr auto auto 30px', alignItems: 'center', gap: 12, flexShrink: 0,
              padding: '8px 12px', background: T.surface, border: `1px solid ${alpha(T.success, '33')}`, borderRadius: T.r.ctl,
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: alpha(T.success, '22'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={ICONS.check} size={11} stroke={T.success} sw={2.4} /></div>
              <div style={{ fontSize: T.fs.sm, fontWeight: 500, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip.name} <span style={{ fontSize: 10.5, color: T.success }}>· créé, dans la Bibliothèque</span></div>
              <span style={{ fontFamily: T.fontMono, fontSize: T.fs.xs, color: T.text3 }}>{fmt(clip.start)} → {fmt(clip.end)}</span>
              <span style={{ fontFamily: T.fontMono, fontSize: T.fs.xs, color: T.success }}>{(clip.end - clip.start).toFixed(1)}s</span>
              <span />
            </div>
          ))}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(232,89,93,.05)', border: `1px solid ${alpha(T.danger, '44')}`, borderRadius: T.r.ctl, color: T.danger, fontSize: T.fs.xs, flexShrink: 0 }}>
            <Icon d={ICONS.warn} size={14} stroke={T.danger} />{error}
          </div>
        )}
      </div>
    </div>
  )
}

function Preview({ video, audioSrc, videoRef, currentTime, duration, markIn, onTimeUpdate, onLoadedMetadata }) {
  const boxRef = useRef(null)
  const [boxH, setBoxH] = useState(0)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBoxH(entry.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={boxRef} style={{
      flex: '1 1 0', minHeight: 180, background: '#000', borderRadius: T.r.card, border: `1px solid ${T.border}`,
      position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <VideoPlayer
        src={video.url}
        audioSrc={audioSrc}
        videoRef={videoRef}
        maxHeight={Math.max(120, boxH)}
        controls={false}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        style={{ width: '100%', height: '100%', justifyContent: 'space-between' }}
        overlay={
          <div style={{ position: 'absolute', top: 14, left: 16, padding: '4px 10px', background: 'rgba(0,0,0,.6)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 11, color: T.text2, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: 7, pointerEvents: 'none' }}>
            <Dot color={T.accent} size={6} /> {fmt(currentTime)} / {fmt(duration)}
            {markIn != null && <span style={{ color: T.accent }}>· IN {fmt(markIn)}</span>}
          </div>
        }
      />
    </div>
  )
}
