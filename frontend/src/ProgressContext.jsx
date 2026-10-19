import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon, ICONS } from './Icons'
import { filenameFromDisposition, saveBlob } from './download'
import { toastsFor } from './utils/toastScope'
import { groupJobs, siblingsOf, toastGroupKey } from './utils/jobGroups'
import JobError from './components/JobError'

/* Progress surface — one place for long ops (Whisper, MP4 burn, Plex remux,
   GIF export, batch clip cut).

   Primary transport: WebSocket /api/jobs/{id}/ws. Polling fallback if WS
   fails (proxy, dev tunnel, etc.).

   Producer:
     const { start } = useProgress()
     const handle = start({
       kind: 'transcribe',
       title: 'Transcription Whisper',
       jobId: 'uuid-returned-by-backend',
       onDone: result => { ... }, // result is the JSON body of /api/jobs/{id}/result
       onError: err => { ... },
       onCancel: () => { ... },
       downloadOnDone: false,     // true → trigger file download from /result
       downloadFilename: '…',
       retry: async () => 'new-job-id',
       clipId: '…',               // optional — Activité shows the clip name
       queue: 'export',           // optional — the screen that lists this job (no toast there)
       toast: false,              // optional — tracked + listed in Activité, never toasted
                                  // (the screen shows its own inline <JobError>)
       options: '…',              // optional — settings signature: running jobs with the
                                  // same kind + clip + options share one ×N toast
     })
     handle.cancel()              // user-initiated cancel
*/

const ProgressCtx = createContext(null)
const HISTORY_CAP = 50

export const useProgress = () => useContext(ProgressCtx)

const POLL_MS = 800

function wsUrl(jobId) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/api/jobs/${jobId}/ws`
}

function fmtEta(s) {
  if (s == null || !isFinite(s) || s < 0) return null
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return `${m}min ${r}s`
}

export function ProgressProvider({ children }) {
  const [jobs, setJobs] = useState([])
  // Session log of finished jobs — Activité lists them after the toast is gone.
  const [history, setHistory] = useState([])
  const handlers = useRef(new Map()) // key → { jobId, settled, callbacks… } (sync source of truth)
  const sockets = useRef(new Map())  // key → WebSocket
  const timers = useRef(new Map())   // key → poll timeout id

  const stopAll = useCallback((key) => {
    const ws = sockets.current.get(key)
    if (ws) {
      sockets.current.delete(key)
      try { ws.close() } catch (e) { console.warn('ws close failed', e) }
    }
    const t = timers.current.get(key)
    if (t) { clearTimeout(t); timers.current.delete(key) }
  }, [])

  const remove = useCallback((key) => {
    stopAll(key)
    handlers.current.delete(key)
    setJobs(prev => prev.filter(j => j.key !== key))
  }, [stopAll])

  const dismiss = useCallback((key) => {
    setJobs(prev => prev.map(j => j.key === key ? { ...j, dismissed: true } : j))
    setTimeout(() => remove(key), 200)
  }, [remove])

  const applyState = useCallback((key, data) => {
    setJobs(prev => prev.map(j => j.key === key ? {
      ...j,
      stage: data.stage ?? j.stage,
      pct: data.pct ?? j.pct,
      eta: data.eta,
      status: data.status ?? j.status,
      error: data.error,
      elapsed: data.elapsed,
    } : j))
  }, [])

  // Guards against stale transports: a socket/poll of a retried or removed job.
  const isCurrent = useCallback((key, jobId) => {
    const h = handlers.current.get(key)
    return !!h && h.jobId === jobId && !h.settled
  }, [])

  const record = useCallback((key, h, status) => {
    setHistory(prev => [{ key, kind: h.kind, title: h.title, clipId: h.clipId, status, finishedAt: Date.now() }, ...prev].slice(0, HISTORY_CAP))
  }, [])

  const forget = useCallback((key) => {
    setHistory(prev => prev.filter(j => j.key !== key))
  }, [])

  const finalize = useCallback(async (key, jobId, status, error) => {
    if (!isCurrent(key, jobId)) return
    const h = handlers.current.get(key)
    h.settled = true
    stopAll(key)

    if (status === 'done') {
      try {
        const rr = await fetch(`/api/jobs/${jobId}/result`)
        if (!rr.ok) {
          const err = await rr.json().catch(() => ({}))
          throw new Error(err.detail || `HTTP ${rr.status}`)
        }
        const ct = rr.headers.get('content-type') || ''
        if (ct.includes('json')) {
          h.onDone?.(await rr.json())
        } else if (h.downloadOnDone) {
          const blob = await rr.blob()
          saveBlob(blob, filenameFromDisposition(rr.headers.get('content-disposition')) || h.downloadFilename)
          h.onDone?.(null)
        } else {
          h.onDone?.(await rr.blob())
        }
        record(key, h, 'done')
        setTimeout(() => dismiss(key), 2500)
      } catch (e) {
        setJobs(prev => prev.map(j => j.key === key ? { ...j, status: 'error', error: e.message || 'Résultat indisponible' } : j))
        h.onError?.(e)
      }
    } else if (status === 'cancelled') {
      h.onCancel?.()
      record(key, h, 'cancelled')
      setTimeout(() => dismiss(key), 1200)
    } else if (status === 'error') {
      h.onError?.(new Error(error || 'Job failed'))
      // Keep visible so user can hit "Réessayer".
    }
  }, [dismiss, stopAll, isCurrent, record])

  /* Polling fallback. Recursive setTimeout instead of setInterval so a slow
     network turn doesn't stack overlapping requests. */
  const poll = useCallback(async (key, jobId) => {
    if (!isCurrent(key, jobId)) return
    const schedule = (ms) => {
      if (!isCurrent(key, jobId)) return
      timers.current.set(key, setTimeout(() => poll(key, jobId), ms))
    }
    try {
      const res = await fetch(`/api/jobs/${jobId}`)
      if (!isCurrent(key, jobId)) return
      if (res.status === 404) {
        const msg = 'Tâche introuvable (serveur redémarré ?)'
        applyState(key, { status: 'error', error: msg })
        await finalize(key, jobId, 'error', msg)
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!isCurrent(key, jobId)) return
      applyState(key, data)
      if (data.status === 'done' || data.status === 'error' || data.status === 'cancelled') {
        await finalize(key, jobId, data.status, data.error)
        return
      }
      schedule(POLL_MS)
    } catch (e) {
      console.warn('job poll failed', e)
      schedule(POLL_MS * 2)
    }
  }, [applyState, finalize, isCurrent])

  /* Open WebSocket; on close-before-final or error, switch to polling. */
  const openSocket = useCallback((key, jobId) => {
    if (!isCurrent(key, jobId)) return
    let ws
    try {
      ws = new WebSocket(wsUrl(jobId))
    } catch (e) {
      console.warn('WebSocket refused — polling', e)
      poll(key, jobId)
      return
    }
    sockets.current.set(key, ws)

    ws.onmessage = (ev) => {
      let data
      try { data = JSON.parse(ev.data) } catch (e) { console.warn('bad job frame', e); return }
      if (data.heartbeat || !isCurrent(key, jobId)) return
      applyState(key, data)
      if (data.final || data.status === 'done' || data.status === 'error' || data.status === 'cancelled') {
        finalize(key, jobId, data.status, data.error)
      }
    }
    ws.onerror = () => {
      // Fall through to onclose handling.
    }
    ws.onclose = () => {
      // Closed on purpose (stopAll / unmount / retry) → no longer in the map.
      if (sockets.current.get(key) !== ws) return
      sockets.current.delete(key)
      // Socket dropped mid-job — start polling so we still observe completion.
      poll(key, jobId)
    }
  }, [applyState, finalize, poll, isCurrent])

  const start = useCallback((opts) => {
    const key = `${opts.kind || 'job'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const entry = {
      key, jobId: opts.jobId,
      kind: opts.kind || 'job',
      title: opts.title || 'Tâche',
      clipId: opts.clipId || null,
      options: opts.options ?? null,
      queue: opts.queue || null,
      toast: opts.toast !== false,
      stage: opts.stage || 'Démarrage…',
      pct: 0, eta: null,
      status: 'running', error: null,
      retry: opts.retry || null,
    }
    handlers.current.set(key, {
      jobId: opts.jobId,
      settled: false,
      retrying: false,
      onDone: opts.onDone, onError: opts.onError, onCancel: opts.onCancel,
      downloadOnDone: !!opts.downloadOnDone,
      downloadFilename: opts.downloadFilename,
      retry: opts.retry || null,
      kind: opts.kind,
      title: opts.title,
      clipId: opts.clipId || null,
    })
    setJobs(prev => [...prev, entry])
    openSocket(key, opts.jobId)
    return {
      key,
      async cancel() {
        try {
          await fetch(`/api/jobs/${opts.jobId}/cancel`, { method: 'POST' })
        } catch (e) { console.warn('job cancel failed', e) }
      },
    }
  }, [openSocket])

  const retry = useCallback(async (key) => {
    const h = handlers.current.get(key)
    if (!h || !h.retry || h.retrying) return
    h.retrying = true
    try {
      const newJobId = await h.retry()
      if (!newJobId || handlers.current.get(key) !== h) return
      stopAll(key)
      h.jobId = newJobId
      h.settled = false
      setJobs(prev => prev.map(j => j.key === key ? {
        ...j, jobId: newJobId,
        stage: 'Démarrage…', pct: 0, eta: null,
        status: 'running', error: null,
      } : j))
      openSocket(key, newJobId)
    } catch (e) {
      setJobs(prev => prev.map(j => j.key === key ? { ...j, error: e.message || 'Retry failed' } : j))
    } finally {
      h.retrying = false
    }
  }, [openSocket, stopAll])

  const cancelByKey = useCallback(async (key) => {
    const h = handlers.current.get(key)
    if (!h) return
    const jobId = h.jobId
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' })
      // Backend forgot the job (restart) → nothing will ever finalize it.
      if (res.status === 404 && isCurrent(key, jobId)) {
        applyState(key, { status: 'cancelled' })
        finalize(key, jobId, 'cancelled')
      }
    } catch (e) { console.warn('job cancel failed', e) }
  }, [applyState, finalize, isCurrent])

  useEffect(() => {
    const socketMap = sockets.current
    const timerMap = timers.current
    return () => {
      const open = [...socketMap.values()]
      socketMap.clear()
      for (const ws of open) { try { ws.close() } catch (e) { console.warn('ws close failed', e) } }
      for (const id of timerMap.values()) clearTimeout(id)
      timerMap.clear()
    }
  }, [])

  const value = { start, jobs, history, forget, cancelByKey, dismiss, retry }

  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>
}

const TOAST_EDGE = 20
const TOAST_W = 280
const TOAST_CLEARANCE = 12
// Height the stack takes from the bottom edge (0px when hidden) — scroll
// containers add it to their bottom padding so their last row stays reachable.
const SAFE_VAR = '--toast-safe-bottom'

/* Rendered by App, which knows the open screen: hidden on Activité, filtered
   to jobs outside the queue on Exporter, newest two + "+N" everywhere. */
export function ProgressToasts({ route, queueClipId = null, onOpenActivity }) {
  const { jobs, cancelByKey, dismiss, retry } = useProgress()
  // FIXES_R5 §1: toast:false jobs never toast; identical failures (same kind +
  // same error) collapse into one card with a ×N count. FIXES_R7 #6: so do
  // identical running jobs (same kind + clip + options); Annuler cancels them all.
  const grouped = groupJobs(jobs.filter(j => j.toast), toastGroupKey)
  const { shown, hidden } = toastsFor(grouped, { route, queueClipId })
  const dismissGroup = (g) => g.groupKeys.forEach(dismiss)
  const cancelGroup = (g) => g.groupKeys.forEach(cancelByKey)
  const retryGroup = (g) => { siblingsOf(g).forEach(dismiss); retry(g.key) }
  const stackRef = useRef(null)
  const visible = shown.length > 0

  useLayoutEffect(() => {
    const root = document.documentElement
    const el = stackRef.current
    if (!visible || !el) {
      root.style.setProperty(SAFE_VAR, '0px')
      return
    }
    const sync = () => root.style.setProperty(SAFE_VAR, `${Math.ceil(el.offsetHeight) + TOAST_EDGE + TOAST_CLEARANCE}px`)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty(SAFE_VAR, '0px')
    }
  }, [visible])

  if (!visible) return null
  return (
    <div ref={stackRef} style={{
      // In the editor, sit above the inspector's 40px hint bar so it stays usable.
      position: 'fixed', right: TOAST_EDGE, bottom: route === 'dub' ? TOAST_EDGE + 40 : TOAST_EDGE, width: TOAST_W, zIndex: 'var(--z-toast)',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8,
    }}>
      {hidden > 0 && (
        <button onClick={onOpenActivity} title={`${hidden} autre${hidden > 1 ? 's' : ''} tâche${hidden > 1 ? 's' : ''} — voir dans Activité`}
          style={{
            alignSelf: 'flex-end', background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)',
            borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          }}>+{hidden}</button>
      )}
      {shown.map(j => (
        <ProgressCard key={j.key} job={j} onCancel={() => cancelGroup(j)} onDismiss={() => dismissGroup(j)} onRetry={() => retryGroup(j)} />
      ))}
    </div>
  )
}

function ProgressCard({ job, onCancel, onDismiss, onRetry }) {
  const pct = Math.round((job.pct || 0) * 100)
  const isRun = job.status === 'running'
  const isErr = job.status === 'error'
  const isDone = job.status === 'done'
  const isCanc = job.status === 'cancelled'
  const eta = fmtEta(job.eta)

  const borderColor = isErr ? 'var(--danger)'
    : isDone ? 'var(--success)'
    : isCanc ? 'var(--text3)'
    : 'var(--accent)'
  const countColor = isRun ? 'var(--accent)' : 'var(--danger)'

  return (
    <div style={{
      background: 'var(--surface2)',
      border: `1px solid ${borderColor}`,
      borderRadius: 8,
      padding: '10px 12px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
      opacity: job.dismissed ? 0 : 1,
      transition: 'opacity 0.2s',
      fontSize: 12.5,
      color: 'var(--text)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.title}</span>
        {job.count > 1 && (
          <span title={isRun ? `${job.count} tâches identiques en cours` : `${job.count} échecs identiques`} style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: countColor,
            border: `1px solid color-mix(in srgb, ${countColor} 27%, transparent)`,
            background: `color-mix(in srgb, ${countColor} 11%, transparent)`,
            borderRadius: 99, padding: '1px 7px', flexShrink: 0,
          }}>×{job.count}</span>
        )}
        {isRun && (
          <button
            onClick={onCancel}
            title={job.count > 1 ? `Annuler les ${job.count} tâches` : undefined}
            style={{
              background: 'transparent', border: '1px solid var(--border2)',
              color: 'var(--text2)', borderRadius: 4,
              padding: '0 8px', minHeight: 32, fontSize: 11, cursor: 'pointer',
            }}>Annuler</button>
        )}
        {isErr && job.retry && (
          <button
            onClick={onRetry}
            style={{
              background: 'transparent', border: '1px solid var(--accent)',
              color: 'var(--accent)', borderRadius: 4,
              padding: '0 10px', minHeight: 32, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>Réessayer</button>
        )}
        {(isErr || isDone || isCanc) && (
          <button onClick={onDismiss} title="Fermer"
            aria-label="Fermer"
            style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <Icon d={ICONS.close} size={14} />
          </button>
        )}
      </div>
      {isErr ? <JobError compact error={job.error} /> : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isCanc ? 'Annulé' : job.stage || '…'}
        </span>
        {isRun && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
            {pct}%{eta ? ` · ${eta}` : ''}
          </span>
        )}
        {isDone && (
          <span style={{ fontSize: 11, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon d={ICONS.check} size={12} />Terminé</span>
        )}
      </div>
      )}
      {(isRun || isDone) && (
        <div style={{
          height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: isDone ? 'var(--success)' : 'var(--accent)',
            transition: 'width 0.25s',
          }} />
        </div>
      )}
    </div>
  )
}
