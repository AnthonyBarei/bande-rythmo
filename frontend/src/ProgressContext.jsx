import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

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
     })
     handle.cancel()              // user-initiated cancel
*/

const ProgressCtx = createContext(null)
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
  const jobsRef = useRef([])
  useEffect(() => { jobsRef.current = jobs }, [jobs])
  const handlers = useRef(new Map())
  const sockets = useRef(new Map())  // key → WebSocket
  const timers = useRef(new Map())   // key → poll timeout id

  const stopAll = useCallback((key) => {
    const ws = sockets.current.get(key)
    if (ws) { try { ws.close() } catch {} ; sockets.current.delete(key) }
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

  const finalize = useCallback(async (key, status, error) => {
    const job = jobsRef.current.find(j => j.key === key)
    if (!job) return
    const h = handlers.current.get(key) || {}
    stopAll(key)

    if (status === 'done') {
      try {
        const rr = await fetch(`/api/jobs/${job.jobId}/result`)
        if (h.downloadOnDone) {
          const blob = await rr.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = h.downloadFilename || 'export'
          a.click()
          URL.revokeObjectURL(url)
          h.onDone?.(null)
        } else {
          const ct = rr.headers.get('content-type') || ''
          const result = ct.includes('json') ? await rr.json() : await rr.blob()
          h.onDone?.(result)
        }
      } catch (e) {
        h.onError?.(e)
      }
      setTimeout(() => dismiss(key), 2500)
    } else if (status === 'cancelled') {
      h.onCancel?.()
      setTimeout(() => dismiss(key), 1200)
    } else if (status === 'error') {
      h.onError?.(new Error(error || 'Job failed'))
      // Keep visible so user can hit "Réessayer".
    }
  }, [dismiss, stopAll])

  /* Polling fallback. Recursive setTimeout instead of setInterval so a slow
     network turn doesn't stack overlapping requests. */
  const poll = useCallback(async (key) => {
    const job = jobsRef.current.find(j => j.key === key)
    if (!job) return
    try {
      const res = await fetch(`/api/jobs/${job.jobId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      applyState(key, data)
      if (data.status === 'done' || data.status === 'error' || data.status === 'cancelled') {
        await finalize(key, data.status, data.error)
        return
      }
      const id = setTimeout(() => poll(key), POLL_MS)
      timers.current.set(key, id)
    } catch (e) {
      const id = setTimeout(() => poll(key), POLL_MS * 2)
      timers.current.set(key, id)
    }
  }, [applyState, finalize])

  /* Open WebSocket; on close-before-final or error, switch to polling. */
  const openSocket = useCallback((key, jobId) => {
    let finalized = false
    let ws
    try {
      ws = new WebSocket(wsUrl(jobId))
    } catch (e) {
      // Browser refused — straight to polling.
      poll(key)
      return
    }
    sockets.current.set(key, ws)

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.heartbeat) return
        applyState(key, data)
        if (data.final || data.status === 'done' || data.status === 'error' || data.status === 'cancelled') {
          finalized = true
          finalize(key, data.status, data.error)
        }
      } catch {}
    }
    ws.onerror = () => {
      // Fall through to onclose handling.
    }
    ws.onclose = () => {
      sockets.current.delete(key)
      if (!finalized) {
        // Socket dropped mid-job — start polling so we still observe completion.
        poll(key)
      }
    }
  }, [applyState, finalize, poll])

  const start = useCallback((opts) => {
    const key = `${opts.kind || 'job'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const entry = {
      key, jobId: opts.jobId,
      kind: opts.kind || 'job',
      title: opts.title || 'Tâche',
      stage: opts.stage || 'Démarrage…',
      pct: 0, eta: null,
      status: 'running', error: null,
      retry: opts.retry || null,
    }
    handlers.current.set(key, {
      onDone: opts.onDone, onError: opts.onError, onCancel: opts.onCancel,
      downloadOnDone: !!opts.downloadOnDone,
      downloadFilename: opts.downloadFilename,
      retry: opts.retry || null,
      kind: opts.kind,
      title: opts.title,
    })
    setJobs(prev => [...prev, entry])
    // Open WS after the entry is in state so applyState can find it.
    setTimeout(() => openSocket(key, opts.jobId), 0)
    return {
      key,
      async cancel() {
        try { await fetch(`/api/jobs/${opts.jobId}/cancel`, { method: 'POST' }) } catch {}
      },
    }
  }, [openSocket])

  const retry = useCallback(async (key) => {
    const h = handlers.current.get(key)
    if (!h || !h.retry) return
    try {
      const newJobId = await h.retry()
      if (!newJobId) return
      setJobs(prev => prev.map(j => j.key === key ? {
        ...j, jobId: newJobId,
        stage: 'Démarrage…', pct: 0, eta: null,
        status: 'running', error: null,
      } : j))
      stopAll(key)
      setTimeout(() => openSocket(key, newJobId), 0)
    } catch (e) {
      setJobs(prev => prev.map(j => j.key === key ? { ...j, error: e.message || 'Retry failed' } : j))
    }
  }, [openSocket, stopAll])

  const cancelByKey = useCallback(async (key) => {
    const j = jobsRef.current.find(x => x.key === key)
    if (!j) return
    try { await fetch(`/api/jobs/${j.jobId}/cancel`, { method: 'POST' }) } catch {}
  }, [])

  useEffect(() => () => {
    for (const ws of sockets.current.values()) { try { ws.close() } catch {} }
    for (const id of timers.current.values()) clearTimeout(id)
    sockets.current.clear()
    timers.current.clear()
  }, [])

  const value = { start, jobs, cancelByKey, dismiss, retry }

  return (
    <ProgressCtx.Provider value={value}>
      {children}
      <ProgressToasts jobs={jobs} onCancel={cancelByKey} onDismiss={dismiss} onRetry={retry} />
    </ProgressCtx.Provider>
  )
}

function ProgressToasts({ jobs, onCancel, onDismiss, onRetry }) {
  if (!jobs.length) return null
  return (
    <div style={{
      position: 'fixed', right: 14, bottom: 14, zIndex: 1000,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 340,
    }}>
      {jobs.map(j => (
        <ProgressCard key={j.key} job={j} onCancel={onCancel} onDismiss={onDismiss} onRetry={onRetry} />
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

  return (
    <div style={{
      background: 'var(--surface2)',
      border: `1px solid ${borderColor}`,
      borderRadius: 8,
      padding: '10px 12px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
      opacity: job.dismissed ? 0 : 1,
      transition: 'opacity 0.2s',
      minWidth: 280,
      fontSize: 12.5,
      color: 'var(--text)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, flex: 1 }}>{job.title}</span>
        {isRun && (
          <button
            onClick={() => onCancel(job.key)}
            style={{
              background: 'transparent', border: '1px solid var(--border2)',
              color: 'var(--text2)', borderRadius: 4,
              padding: '2px 8px', fontSize: 11, cursor: 'pointer',
            }}>Annuler</button>
        )}
        {isErr && job.retry && (
          <button
            onClick={() => onRetry?.(job.key)}
            style={{
              background: 'transparent', border: '1px solid var(--accent)',
              color: 'var(--accent)', borderRadius: 4,
              padding: '2px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>Réessayer</button>
        )}
        {(isErr || isDone || isCanc) && (
          <button onClick={() => onDismiss(job.key)} title="Fermer"
            style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>×</button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', flex: 1 }}>
          {isErr ? (job.error || 'Erreur') : isCanc ? 'Annulé' : job.stage || '…'}
        </span>
        {isRun && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
            {pct}%{eta ? ` · ${eta}` : ''}
          </span>
        )}
        {isDone && (
          <span style={{ fontSize: 11, color: 'var(--success)' }}>✓ Terminé</span>
        )}
      </div>
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
