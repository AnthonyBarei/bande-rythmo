import { useCallback, useEffect, useMemo, useRef } from 'react'
import { castMap, putCast } from '../utils/cast'

// The open project's cast as { role: comédien } + a setter. Edits show at
// once (the project copy is patched) and are saved debounced — the comédien
// field writes on every keystroke. `setProject(fn)` updates the app's copy.
export default function useProjectCast(project, setProject) {
  const projectId = project?.id || null
  const comediens = useMemo(() => castMap(project?.cast), [project?.cast])
  const pendingRef = useRef({ projectId: null, patch: {} })
  const timerRef = useRef(null)

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    const { projectId: pid, patch } = pendingRef.current
    pendingRef.current = { projectId: null, patch: {} }
    if (!pid || !Object.keys(patch).length) return
    putCast(pid, patch).catch(e => console.error('Distribution non enregistrée', e))
  }, [])

  // A pending edit of the previous project is saved before switching.
  useEffect(() => flush, [projectId, flush])

  const setComedien = useCallback((role, name) => {
    if (!projectId) return
    setProject(p => {
      if (!p || p.id !== projectId) return p
      const cast = p.cast.some(r => r.role === role)
        ? p.cast.map(r => (r.role === role ? { ...r, comedien: name } : r))
        : [...p.cast, { role, comedien: name, color: null, order: p.cast.length }]
      return { ...p, cast }
    })
    if (pendingRef.current.projectId !== projectId) flush()
    pendingRef.current = { projectId, patch: { ...pendingRef.current.patch, [role]: name } }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 600)
  }, [projectId, setProject, flush])

  return { comediens, setComedien }
}
