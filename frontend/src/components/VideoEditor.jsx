import React, { useState, useRef, useEffect, useCallback } from 'react'
import TimelineBar from './TimelineBar'
import ImportPlayer from './import/ImportPlayer'
import { Icon, ICONS, T, alpha } from '../ui'
import { useProgress } from '../ProgressContext'
import { fmtSMPTE } from '../utils/timecode'
import { MARK_ID, setIn, setOut, markStep, markPhase, isComplete } from '../utils/inOut'

let _pendingId = 0
const newId = () => ++_pendingId
const NO_MARK = { markIn: null, markOut: null }
const DEFAULT_FPS = 25
const isTyping = el => !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)
const UNTITLED = 'Sans nom — cliquer pour nommer'

// Pending-row name field: reads as plain text at rest, placeholder in text3.
const NAME_CSS = `
.br-pending-name { width: 100%; min-width: 0; margin-left: -8px; padding: 4px 7px; border-radius: 6px;
  background: transparent; border: 1px solid transparent; outline: none;
  font: 500 ${T.fs.sm}px var(--font-ui); color: var(--text); font-style: normal; cursor: text; }
.br-pending-name::placeholder { color: var(--text3); opacity: 1; font-style: normal; }
.br-pending-name:hover:not(:focus) { border-color: var(--border2); }
.br-pending-name:focus { border-color: var(--accent); background: var(--bg2); }
`

// Importer left column — reference screen-import.jsx Preview · ZoomTimeline · PendingList.
// The header actions (Marquer un clip / Créer N clips) live in ImportSection and
// drive this component through `actionsRef`; state flows back via `onStateChange`.
// One IN/OUT model (utils/inOut): the I / O keys, the player's IN/OUT cluster and
// the header button all edit `mark`. A complete IN→OUT range is a pending clip
// (timeline block + list row, counted in "Créer N clips") until it is banked
// into `pendingClips` or created with the batch.
export default function VideoEditor({ video, onClipsCreated, videoStream, audioStream, audioSrc, fps, actionsRef, onStateChange }) {
  const videoRef = useRef(null)
  const progress = useProgress()
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [pendingClips, setPendingClips] = useState([])
  const [savedClips, setSavedClips] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // Row whose name field takes focus once rendered (after « Ajouter le clip »).
  const [focusId, setFocusId] = useState(null)
  const [mark, setMark] = useState(NO_MARK)
  const [markName, setMarkName] = useState('')
  const markRef = useRef(NO_MARK)
  const markNameRef = useRef('')
  const savingRef = useRef(false)
  const rate = fps > 0 ? fps : DEFAULT_FPS

  const markClip = isComplete(mark) ? { _id: MARK_ID, name: markName, start: mark.markIn, end: mark.markOut, mark: true } : null
  const allPending = markClip ? [...pendingClips, markClip] : pendingClips
  const pendingRef = useRef(allPending)
  useEffect(() => { pendingRef.current = allPending })
  useEffect(() => { markNameRef.current = markName }, [markName])

  const updateMark = useCallback(next => {
    markRef.current = next
    setMark(next)
    if (!isComplete(next)) setMarkName('')
  }, [])

  const applyMark = useCallback((transition, t, focusBanked = false) => {
    const { banked, ...next } = transition(markRef.current, t)
    if (banked) {
      const name = markNameRef.current
      const id = newId()
      setPendingClips(prev => [...prev, { _id: id, name, ...banked }])
      if (focusBanked) setFocusId(id)
    }
    updateMark(next)
  }, [updateMark])

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    setPendingClips([])
    setSavedClips([])
    setFocusId(null)
    updateMark(NO_MARK)
  }, [video?.url, updateMark])

  // `names` ({ [rowId]: name }) carries a name still being typed (Ctrl+S from its field).
  const saveAll = useCallback(async (names = null) => {
    const pending = names
      ? pendingRef.current.map(c => (String(c._id) in names ? { ...c, name: names[String(c._id)] } : c))
      : pendingRef.current
    if (pending.length === 0 || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    // Clips added while the batch runs stay queued.
    const submitted = new Set(pending.map(c => c._id))
    const submittedMark = pending.find(c => c._id === MARK_ID)
    const finish = () => { savingRef.current = false; setSaving(false) }
    const dropSubmitted = () => {
      setPendingClips(prev => prev.filter(c => !submitted.has(c._id)))
      const m = markRef.current
      if (submittedMark && m.markIn === submittedMark.start && m.markOut === submittedMark.end) updateMark(NO_MARK)
    }
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
            dropSubmitted()
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
      dropSubmitted()
      onClipsCreated(results)
    } catch (e) {
      setError('Erreur : ' + e.message)
    } finally {
      finish()
    }
  }, [video?.url, video?.file, video?.filename, video?.sourcePath, onClipsCreated, videoStream, audioStream, progress, updateMark])

  // Header "Marquer un clip": IN, then OUT, then add the range to the pending clips.
  const markAtPlayhead = useCallback(() => applyMark(markStep, videoRef.current?.currentTime ?? 0, true), [applyMark])
  const handleSetIn = useCallback(t => applyMark(setIn, t), [applyMark])
  const handleSetOut = useCallback(t => applyMark(setOut, t), [applyMark])

  useEffect(() => {
    if (!actionsRef) return
    actionsRef.current = { save: saveAll, mark: markAtPlayhead }
  }, [actionsRef, saveAll, markAtPlayhead])

  const phase = markPhase(mark)
  useEffect(() => {
    onStateChange?.({ count: allPending.length, saving, duration, phase })
  }, [onStateChange, allPending.length, saving, duration, phase])

  // Ctrl/⌘+S creates the pending clips (incl. a complete IN→OUT range).
  // Player keys (Space, J/L, , . I O M) live in ImportPlayer.
  // From a pending name field (auto-focused after « Ajouter le clip »), Ctrl+S
  // saves with the name being typed, then the blur commits it to the row.
  useEffect(() => {
    function onKey(e) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return
      e.preventDefault()
      if (document.querySelector('[aria-modal="true"]')) return
      if (e.target instanceof HTMLInputElement && e.target.dataset.pendingName) {
        saveAll({ [e.target.dataset.pendingName]: e.target.value.trim() })
        e.target.blur()
        return
      }
      if (isTyping(e.target)) return
      saveAll()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveAll])

  function handleAdd(start, end) {
    setPendingClips(prev => [...prev, { _id: newId(), name: '', start, end }])
  }

  function handleUpdate(id, start, end) {
    if (id === MARK_ID) { updateMark({ markIn: start, markOut: end }); return }
    setPendingClips(prev => prev.map(c => c._id === id ? { ...c, start, end } : c))
  }

  const handleRemove = useCallback(id => {
    if (id === MARK_ID) { updateMark(NO_MARK); return }
    setPendingClips(prev => prev.filter(c => c._id !== id))
  }, [updateMark])

  function renamePending(id, name) {
    setFocusId(f => (f === id ? null : f))
    if (id === MARK_ID) setMarkName(name)
    else setPendingClips(prev => prev.map(c => c._id === id && c.name !== name ? { ...c, name } : c))
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2 }}>
      <style>{NAME_CSS}</style>
      <ImportPlayer key={video.url} src={video.url} audioSrc={audioSrc} videoRef={videoRef} fps={rate}
        markIn={mark.markIn} markOut={mark.markOut} onSetIn={handleSetIn} onSetOut={handleSetOut}
        onTimeUpdate={setCurrentTime} onDuration={setDuration} />

      <TimelineBar
        duration={duration}
        currentTime={currentTime}
        pendingClips={pendingClips}
        markRange={markClip}
        markIn={mark.markIn}
        savedClips={savedClips}
        onSeek={t => { if (videoRef.current) videoRef.current.currentTime = t }}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onRemove={handleRemove}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>CLIPS EN ATTENTE</span>
          <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{allPending.length}</span>
          <div style={{ flex: 1 }} />
          {allPending.length > 0 && <span style={{ fontSize: 10.5, color: T.text4 }}>cliquer le nom pour éditer · ⏎ valider</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allPending.map((c, i) => (
            <div key={c._id} title={c.mark ? 'Plage IN → OUT · « Marquer un clip » l’ajoute au lot, Ctrl+S crée les clips' : undefined} style={{
              display: 'grid', gridTemplateColumns: '20px 1fr auto auto 30px', alignItems: 'center', gap: 12, flexShrink: 0,
              padding: '8px 12px', background: T.surface, border: `1px solid ${c.mark ? alpha(T.info, '55') : c.name ? alpha(T.accent, '33') : T.border2}`, borderRadius: T.r.ctl,
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: alpha(c.mark ? T.info : T.accent, '22'), color: c.mark ? T.info : T.accent, fontSize: 9.5, fontWeight: 800, fontFamily: T.fontMono, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
              <PendingName rowId={String(c._id)} name={c.name} label={`Nom du clip ${i + 1}`} autoFocus={focusId === c._id}
                onCommit={name => renamePending(c._id, name)} />
              <span style={{ fontFamily: T.fontMono, fontSize: T.fs.xs, color: T.text2 }}>{fmtSMPTE(c.start, rate)} → {fmtSMPTE(c.end, rate)}</span>
              <span style={{ fontFamily: T.fontMono, fontSize: T.fs.xs, color: T.accent }}>{(c.end - c.start).toFixed(1)}s</span>
              <button onClick={() => handleRemove(c._id)} title={c.mark ? 'Effacer IN / OUT' : 'Retirer'} style={{ background: 'transparent', border: 'none', color: T.text3, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}><Icon d={ICONS.trash} size={14} /></button>
            </div>
          ))}

          {savedClips.map(clip => (
            <div key={clip.clip_id} style={{
              display: 'grid', gridTemplateColumns: '20px 1fr auto auto 30px', alignItems: 'center', gap: 12, flexShrink: 0,
              padding: '8px 12px', background: T.surface, border: `1px solid ${alpha(T.success, '33')}`, borderRadius: T.r.ctl,
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: alpha(T.success, '22'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={ICONS.check} size={11} stroke={T.success} sw={2.4} /></div>
              <div style={{ fontSize: T.fs.sm, fontWeight: 500, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip.name} <span style={{ fontSize: 10.5, color: T.success }}>· créé, dans la Bibliothèque</span></div>
              <span style={{ fontFamily: T.fontMono, fontSize: T.fs.xs, color: T.text3 }}>{fmtSMPTE(clip.start, rate)} → {fmtSMPTE(clip.end, rate)}</span>
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

// FIXES_R5 #7 — inline, placeholder-style name field. Enter / blur commit,
// Escape restores the saved name.
function PendingName({ rowId, name, label, autoFocus, onCommit }) {
  const ref = useRef(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  // Follow outside renames (e.g. the IN→OUT name carried into its banked row).
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.value = name
  }, [name])

  return (
    <input ref={ref} className="br-pending-name" data-pending-name={rowId} defaultValue={name}
      placeholder={UNTITLED} aria-label={label} spellCheck={false}
      onBlur={e => onCommit(e.currentTarget.value.trim())}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') { e.stopPropagation(); e.currentTarget.value = name; e.currentTarget.blur() }
      }} />
  )
}
