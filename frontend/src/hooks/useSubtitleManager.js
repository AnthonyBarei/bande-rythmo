import { useState, useRef, useCallback, useEffect } from 'react'
import { createHistory, pushHistory, replaceHistory, undoHistory, redoHistory, canUndo as hCanUndo, canRedo as hCanRedo } from '../utils/history'

// Consecutive edits sharing a coalesce key within this window = one undo step.
export const COALESCE_MS = 1000

// Subtitle state machine for the editor — extracted from DubbingWorkspace
// (Phase 2). Owns: subtitles array, selection, undo/redo history (cap 50),
// debounced autosave with status. Canvas/drag/keyboard stay in the component.
//
// API (names match the old in-component functions one-for-one):
//   subtitles, selectedIdx, setSelectedIdx, saveStatus
//   changeSubtitles(subs, { coalesce }?)  sort + selection-remap + history + save (1.5s)
//                              same `coalesce` key (e.g. '3:text') within
//                              COALESCE_MS of the previous edit → merged into
//                              that undo step (typing bursts)
//   setSubtitlesTransient(subs) raw set — mid-drag working state
//   commitDrag(subs)           set + save (0.8s), no sort, no history
//   finishDrag()               end of a drag: sort + history + save now
//   saveNow()                  flush the pending save immediately
//   undo() / redo() / canUndo / canRedo / undoRedoRef (stable for keydown)
export default function useSubtitleManager({ clipId, initialSubtitles, initialSelectedIdx = null, onSaved }) {
  const [subtitles, setSubtitles] = useState(initialSubtitles || [])
  const [selectedIdx, setSelectedIdx] = useState(
    () => (initialSelectedIdx != null && (initialSubtitles || [])[initialSelectedIdx] ? initialSelectedIdx : null))
  const [saveStatus, setSaveStatus] = useState('saved')   // saved|unsaved|saving|error
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Kept in sync synchronously by every setter below, so saves and drag
  // commits always read the latest array (not the last rendered one).
  const subtitlesRef = useRef(subtitles)
  // True while there are edits not yet persisted (pending debounce, or a
  // failed save) — drives the unmount flush and the post-save status.
  const dirtyRef = useRef(false)
  const saveSeqRef = useRef(0)
  const debounceRef = useRef(null)
  const historyRef = useRef(null)
  const coalesceRef = useRef(null)   // { key, at } of the last coalescible edit
  const onSavedRef = useRef(onSaved)
  useEffect(() => { onSavedRef.current = onSaved }, [onSaved])

  const setSubs = useCallback((subs) => {
    subtitlesRef.current = subs
    setSubtitles(subs)
  }, [])

  const doSave = useCallback(async (subs) => {
    const seq = ++saveSeqRef.current
    dirtyRef.current = false
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/clips/${clipId}/subtitles`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtitles: subs }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // A newer save was issued meanwhile — its response is authoritative.
      if (seq !== saveSeqRef.current) return
      onSavedRef.current?.(data)
      setSaveStatus(dirtyRef.current ? 'unsaved' : 'saved')
    } catch (e) {
      console.warn('Sauvegarde des répliques échouée', e)
      if (seq !== saveSeqRef.current) return
      dirtyRef.current = true
      setSaveStatus('error')
    }
  }, [clipId])

  const scheduleSave = useCallback((subs, delay = 1500) => {
    dirtyRef.current = true
    setSaveStatus('unsaved')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(subs), delay)
  }, [doSave])

  function syncHistoryFlags() {
    const h = historyRef.current
    setCanUndo(hCanUndo(h))
    setCanRedo(hCanRedo(h))
  }

  // Seed history once per clip.
  const seedRef = useRef(null)
  useEffect(() => {
    if (seedRef.current === clipId) return
    seedRef.current = clipId
    historyRef.current = createHistory(initialSubtitles || [])
    coalesceRef.current = null
    syncHistoryFlags()
  }, [clipId])

  const changeSubtitles = useCallback((subs, { coalesce } = {}) => {
    const prevSubs = subtitlesRef.current
    const sorted = [...subs].sort((a, b) => a.start - b.start)
    // Track the selected réplique: by identity first (insert / delete of
    // another row shifts indexes), then by position for an in-place edit.
    setSelectedIdx(prev => {
      if (prev == null) return prev
      const kept = sorted.indexOf(prevSubs[prev])
      if (kept >= 0) return kept
      if (subs.length === prevSubs.length && prev < subs.length) {
        const edited = sorted.indexOf(subs[prev])
        if (edited >= 0) return edited
      }
      return null
    })
    setSubs(sorted)
    const now = Date.now()
    const last = coalesceRef.current
    if (coalesce != null && last && last.key === coalesce && now - last.at <= COALESCE_MS) {
      replaceHistory(historyRef.current, sorted)
    } else {
      pushHistory(historyRef.current, sorted)
    }
    coalesceRef.current = coalesce != null ? { key: coalesce, at: now } : null
    syncHistoryFlags()
    scheduleSave(sorted, 1500)
  }, [scheduleSave, setSubs])

  const applyHistorySubs = useCallback((subs) => {
    coalesceRef.current = null
    const sorted = [...subs].sort((a, b) => a.start - b.start)
    setSubs(sorted)
    setSelectedIdx(null)
    scheduleSave(sorted, 1500)
  }, [scheduleSave, setSubs])

  const undo = useCallback(() => {
    const prev = undoHistory(historyRef.current)
    if (prev) { applyHistorySubs(prev); syncHistoryFlags() }
  }, [applyHistorySubs])

  const redo = useCallback(() => {
    const next = redoHistory(historyRef.current)
    if (next) { applyHistorySubs(next); syncHistoryFlags() }
  }, [applyHistorySubs])

  // Stable identity for empty-dep keydown closures.
  const undoRedoRef = useRef({ undo, redo })
  useEffect(() => { undoRedoRef.current = { undo, redo } }, [undo, redo])

  // Mid-drag working state: render only, no history/save.
  const setSubtitlesTransient = useCallback((subs) => { setSubs(subs) }, [setSubs])

  // Drag commit: positions changed live; shorter debounce, no sort (drag
  // preserves order). Save reads the ref at fire time so the latest drag
  // position is what persists.
  const commitDrag = useCallback((subs) => {
    setSubs(subs)
    dirtyRef.current = true
    setSaveStatus('unsaved')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(subtitlesRef.current), 800)
  }, [doSave, setSubs])

  const saveNow = useCallback(() => {
    clearTimeout(debounceRef.current)
    doSave(subtitlesRef.current)
  }, [doSave])

  // Drag end: one undo step for the whole gesture, re-sorted, saved now.
  const finishDrag = useCallback(() => {
    changeSubtitles(subtitlesRef.current)
    saveNow()
  }, [changeSubtitles, saveNow])

  // Flush pending (or failed) edits on unmount.
  useEffect(() => () => {
    clearTimeout(debounceRef.current)
    if (dirtyRef.current) doSave(subtitlesRef.current)
  }, [doSave])

  return {
    subtitles, selectedIdx, setSelectedIdx, saveStatus,
    changeSubtitles, setSubtitlesTransient, commitDrag, finishDrag, saveNow,
    undo, redo, canUndo, canRedo, undoRedoRef,
  }
}
