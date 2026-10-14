// FIXES_R4 §11: progress toasts never repeat what the open screen already lists.

export const EXPORT_QUEUE = 'export'
export const TOAST_MAX = 2

// Jobs started from the Exporter carry { queue: 'export', clipId } — that
// screen's queue lists exactly those for its clip.
export function inExportQueue(job, clipId) {
  return !!clipId && job.queue === EXPORT_QUEUE && job.clipId === clipId
}

// route: current screen ('activity', 'export', …); queueClipId: clip whose
// export queue is on screen. Returns the newest `max` jobs to show and the
// number collapsed into the "+N" chip.
export function toastsFor(jobs, { route, queueClipId = null, max = TOAST_MAX } = {}) {
  if (route === 'activity') return { shown: [], hidden: 0 }
  const pool = route === 'export' ? jobs.filter(j => !inExportQueue(j, queueClipId)) : jobs
  const shown = pool.slice(-max)
  return { shown, hidden: pool.length - shown.length }
}
