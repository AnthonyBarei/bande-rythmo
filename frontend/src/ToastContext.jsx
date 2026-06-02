import React, { createContext, useCallback, useContext, useRef, useState } from 'react'

/* Toast surface with an undoable variant.

   Usage:
     const toast = useToast()
     toast.show({ msg: 'Exporté ✓', kind: 'success' })
     toast.error('Échec : ' + e.message)
     toast.undo({
       msg: 'Réplique supprimée',
       onUndo: () => restoreFromSnapshot(),     // user clicked Annuler within window
       onCommit: () => fireBackendDelete(),     // window elapsed → commit destructive op
       duration: 5000,
     })
*/

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
    setToasts(prev => prev.filter(x => x.id !== id))
  }, [])

  const show = useCallback((opts) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    const entry = {
      id,
      msg: opts.msg || '',
      kind: opts.kind || 'info',     // info | success | error | undo
      action: opts.action || null,    // { label, run }
    }
    setToasts(prev => [...prev, entry])
    if (opts.duration !== Infinity) {
      const t = setTimeout(() => dismiss(id), opts.duration || 3000)
      timers.current.set(id, t)
    }
    return id
  }, [dismiss])

  const error = useCallback((msg) => show({ msg, kind: 'error', duration: 4500 }), [show])
  const success = useCallback((msg) => show({ msg, kind: 'success', duration: 2500 }), [show])

  const undo = useCallback((opts) => {
    const duration = opts.duration || 5000
    let cancelled = false
    let commitTimer = null
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`

    const finish = () => {
      cancelled = true
      if (commitTimer) { clearTimeout(commitTimer); commitTimer = null }
      dismiss(id)
    }

    const action = {
      label: 'Annuler',
      run: () => {
        if (cancelled) return
        cancelled = true
        if (commitTimer) { clearTimeout(commitTimer); commitTimer = null }
        try { opts.onUndo?.() } catch (e) { console.error(e) }
        dismiss(id)
      },
    }

    setToasts(prev => [...prev, {
      id,
      msg: opts.msg || '',
      kind: 'undo',
      action,
    }])

    commitTimer = setTimeout(() => {
      if (cancelled) return
      cancelled = true
      try { opts.onCommit?.() } catch (e) { console.error(e) }
      dismiss(id)
    }, duration)
    timers.current.set(id, commitTimer)

    return { id, cancel: action.run, commit: () => { if (!cancelled) { cancelled = true; clearTimeout(commitTimer); try { opts.onCommit?.() } catch {} ; dismiss(id) } } }
  }, [dismiss])

  return (
    <ToastCtx.Provider value={{ show, dismiss, error, success, undo }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastCtx.Provider>
  )
}

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', left: 14, bottom: 14, zIndex: 1000,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360,
    }}>
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onDismiss }) {
  const colors = {
    info:    { border: 'var(--border2)',   icon: '·', iconColor: 'var(--text3)' },
    success: { border: 'var(--success)',   icon: '✓', iconColor: 'var(--success)' },
    error:   { border: 'var(--danger)',    icon: '✕', iconColor: 'var(--danger)' },
    undo:    { border: 'var(--accent)',    icon: '↶', iconColor: 'var(--accent)' },
  }[toast.kind] || { border: 'var(--border2)', icon: '·', iconColor: 'var(--text3)' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: 'var(--surface2)',
      border: `1px solid ${colors.border}`,
      borderRadius: 6,
      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
      fontSize: 12.5, color: 'var(--text)',
      minWidth: 260,
    }}>
      <span style={{ color: colors.iconColor, fontSize: 14, lineHeight: 1 }}>{colors.icon}</span>
      <span style={{ flex: 1 }}>{toast.msg}</span>
      {toast.action && (
        <button
          onClick={toast.action.run}
          style={{
            background: 'transparent', border: '1px solid var(--border2)',
            color: 'var(--accent)', borderRadius: 4,
            padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>{toast.action.label}</button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        title="Fermer"
        style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>×</button>
    </div>
  )
}
