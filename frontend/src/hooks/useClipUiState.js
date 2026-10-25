import { useCallback, useEffect, useRef } from 'react'
import { putUiState } from '../utils/clipState'

// Debounced writer for clips.ui_state. Patches accumulate, then one PUT
// (800 ms after the last change, at once with `immediate`, and on unmount).
// `onSaved(clipId, patch)` mirrors the patch into the app's clip copy — at
// flush time, not per change, so playback does not re-render the app.
export default function useClipUiState(clipId, onSaved) {
  const pendingRef = useRef(null)
  const timerRef = useRef(null)
  const onSavedRef = useRef(onSaved)
  useEffect(() => { onSavedRef.current = onSaved })

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    const patch = pendingRef.current
    if (!patch) return
    pendingRef.current = null
    onSavedRef.current?.(clipId, patch)
    putUiState(clipId, patch).catch(e => console.error('Clip : état non enregistré', e))
  }, [clipId])

  const save = useCallback((patch, { immediate = false } = {}) => {
    pendingRef.current = { ...pendingRef.current, ...patch }
    clearTimeout(timerRef.current)
    if (immediate) flush()
    else timerRef.current = setTimeout(flush, 800)
  }, [flush])

  useEffect(() => flush, [flush])

  return save
}
