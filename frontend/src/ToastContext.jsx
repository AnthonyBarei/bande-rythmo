import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Icon, ICONS } from './Icons'

/* Toast surface with an undoable variant.

   Usage:
     const toast = useToast()
     toast.show({ msg: 'Exporté', kind: 'success' })
     toast.error('Échec : ' + e.message)
     toast.undo({
       msg: 'Réplique supprimée',
       onUndo: () => restoreFromSnapshot(),     // user clicked Annuler within window
       onCommit: () => fireBackendDelete(),     // window elapsed → commit destructive op
       duration: 5000,
     })

   The provider renders nothing itself: <ToastCards /> is placed by the shared
   bottom-right dock (ProgressContext ToastDock), under the progress cards, so
   every toast lives in one stack (FIXES_R8 #2).
*/

const ToastCtx = createContext(null)
const ToastListCtx = createContext({ toasts: [], dismiss: () => {} })
export const useToast = () => useContext(ToastCtx)
export const useToastList = () => useContext(ToastListCtx)

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

    const commit = () => {
      if (cancelled) return
      cancelled = true
      if (commitTimer) { clearTimeout(commitTimer); commitTimer = null }
      try { opts.onCommit?.() } catch (e) { console.error(e) }
      dismiss(id)
    }

    setToasts(prev => [...prev, {
      id,
      msg: opts.msg || '',
      kind: 'undo',
      action,
      // Closing with × must still commit — otherwise the destructive op is lost.
      onClose: commit,
    }])

    commitTimer = setTimeout(commit, duration)
    timers.current.set(id, commitTimer)

    return { id, cancel: action.run, commit }
  }, [dismiss])

  const api = useMemo(() => ({ show, dismiss, error, success, undo }), [show, dismiss, error, success, undo])
  const list = useMemo(() => ({ toasts, dismiss }), [toasts, dismiss])

  return (
    <ToastCtx.Provider value={api}>
      <ToastListCtx.Provider value={list}>
        {children}
      </ToastListCtx.Provider>
    </ToastCtx.Provider>
  )
}

// Cards only — positioned by the dock that hosts them.
export function ToastCards() {
  const { toasts, dismiss } = useToastList()
  return toasts.map(t => <ToastCard key={t.id} toast={t} onDismiss={dismiss} />)
}

// A long action label ("Exporter le MP4 doublé") goes under the message so the
// 280px dock never squeezes the text; a short one ("Annuler") stays inline.
const INLINE_ACTION_MAX = 12

function ToastCard({ toast, onDismiss }) {
  const colors = {
    info:    { border: 'var(--border2)',   icon: ICONS.dot,   iconColor: 'var(--text3)' },
    success: { border: 'var(--success)',   icon: ICONS.check, iconColor: 'var(--success)' },
    error:   { border: 'var(--danger)',    icon: ICONS.warn,  iconColor: 'var(--danger)' },
    undo:    { border: 'var(--accent)',    icon: ICONS.undo,  iconColor: 'var(--accent)' },
  }[toast.kind] || { border: 'var(--border2)', icon: ICONS.dot, iconColor: 'var(--text3)' }

  const inlineAction = toast.action && toast.action.label.length <= INLINE_ACTION_MAX
  const actionBtn = toast.action && (
    <button
      onClick={toast.action.run}
      style={{
        background: 'transparent', border: '1px solid var(--border2)',
        color: 'var(--accent)', borderRadius: 4, flexShrink: 0,
        padding: '0 10px', minHeight: 32, fontSize: 11, fontWeight: 600, cursor: 'pointer',
      }}>{toast.action.label}</button>
  )

  return (
    <div role={toast.kind === 'error' ? 'alert' : 'status'} style={{
      padding: '10px 12px',
      background: 'var(--surface2)',
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
      fontSize: 12.5, color: 'var(--text)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon d={colors.icon} size={15} stroke={colors.iconColor} style={{ color: colors.iconColor, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>{toast.msg}</span>
        {inlineAction && actionBtn}
        <button
          onClick={() => toast.onClose ? toast.onClose() : onDismiss(toast.id)}
          title="Fermer" aria-label="Fermer"
          style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          <Icon d={ICONS.close} size={14} />
        </button>
      </div>
      {toast.action && !inlineAction && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>{actionBtn}</div>
      )}
    </div>
  )
}
