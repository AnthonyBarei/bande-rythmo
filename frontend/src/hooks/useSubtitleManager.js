import { useState, useRef, useCallback, useEffect } from 'react'
import { createHistory, pushHistory, undoHistory, redoHistory, canUndo as hCanUndo, canRedo as hCanRedo } from '../utils/history'

// Subtitle state machine for the editor — extracted from DubbingWorkspace
// (Phase 2). Owns: subtitles array, selection, undo/redo history (cap 50),
// debounced autosave with status. Canvas/drag/keyboard stay in the component.
//
// API (names match the old in-component functions one-for-one):
//   subtitles, selectedIdx, setSelectedIdx, saveStatus
//   changeSubtitles(subs)      sort + selection-remap + history + save (1.5s)
//   setSubtitlesTransient(subs) raw set — mid-drag working state
//   commitDrag(subs)           set + save (0.8s), no sort, no history
//   saveNow()                  flush the pending save immediately
//   undo() / redo() / canUndo / canRedo / undoRedoRef (stable for keydown)
export default function useSubtitleManager({ clipId, initialSubtitles, onSaved }) {
  const [subtitles, setSubtitles] = useState(initialSubtitles || [])
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [saveStatus, setSaveStatus] = useState('saved')   // saved|unsaved|saving|error
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const subtitlesRef = useRef(subtitles)
  const saveStatusRef = useRef(saveStatus)
  const debounceRef = useRef(null)
  const historyRef = useRef(null)
  const onSavedRef = useRef(onSaved)
  subtitlesRef.current = subtitles
  saveStatusRef.current = saveStatus
  onSavedRef.current = onSaved

  const doSave = useCallback(async (subs) => {
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/clips/${clipId}/subtitles`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtitles: subs }),
      })
      if (!res.ok) throw new Error()
      onSavedRef.current?.(await res.json())
      setSaveStatus('saved')
    } catch { setSaveStatus('error') }
  }, [clipId])

  const scheduleSave = useCallback((subs, delay = 1500) => {
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
    syncHistoryFlags()
  }, [clipId]) // eslint-disable-line react-hooks/exhaustive-deps

  const changeSubtitles = useCallback((subs) => {
    const sorted = [...subs].sort((a, b) => a.start - b.start)
    // Track selection through the sort (objects keep identity through spread-sort).
    setSelectedIdx(prev => {
      if (prev != null && prev < subs.length) {
        const newIdx = sorted.indexOf(subs[prev])
        if (newIdx >= 0) return newIdx
      }
      return prev
    })
    setSubtitles(sorted)
    pushHistory(historyRef.current, sorted)
    syncHistoryFlags()
    scheduleSave(sorted, 1500)
  }, [scheduleSave])

  function applyHistorySubs(subs) {
    const sorted = [...subs].sort((a, b) => a.start - b.start)
    setSubtitles(sorted)
    setSelectedIdx(null)
    scheduleSave(sorted, 1500)
  }

  const undo = useCallback(() => {
    const prev = undoHistory(historyRef.current)
    if (prev) { applyHistorySubs(prev); syncHistoryFlags() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const redo = useCallback(() => {
    const next = redoHistory(historyRef.current)
    if (next) { applyHistorySubs(next); syncHistoryFlags() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable identity for empty-dep keydown closures.
  const undoRedoRef = useRef({ undo, redo })
  undoRedoRef.current = { undo, redo }

  // Mid-drag working state: render only, no history/save.
  const setSubtitlesTransient = useCallback((subs) => { setSubtitles(subs) }, [])

  // Drag commit: positions changed live; shorter debounce, no sort (drag
  // preserves order). Save reads the ref at fire time so the just-set state
  // (current by the next render, well before 800ms) is what persists.
  const commitDrag = useCallback((subs) => {
    setSubtitles(subs)
    setSaveStatus('unsaved')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(subtitlesRef.current), 800)
  }, [doSave])

  const saveNow = useCallback(() => {
    clearTimeout(debounceRef.current)
    doSave(subtitlesRef.current)
  }, [doSave])

  // Flush pending edits on unmount.
  useEffect(() => () => {
    clearTimeout(debounceRef.current)
    if (saveStatusRef.current === 'unsaved') doSave(subtitlesRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    subtitles, selectedIdx, setSelectedIdx, saveStatus,
    changeSubtitles, setSubtitlesTransient, commitDrag, saveNow,
    undo, redo, canUndo, canRedo, undoRedoRef,
  }
}
