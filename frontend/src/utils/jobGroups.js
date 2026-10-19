// FIXES_R5 §1/§2: identical failures collapse into one toast / one Activité
// row with a ×N count. FIXES_R7 #6: identical running jobs collapse into one
// toast too. Done / cancelled jobs stay single.
import { errorKey } from './jobErrors'

// Running toasts: same job kind + same clip + same options (producer-supplied
// signature; jobs without one compare by kind + clip only).
const runningKey = j => `run|${j.kind}|${j.clipId ?? ''}|${j.options ?? ''}`

// Toasts: failures by job kind + error; running jobs by kind + clip + options.
export const toastGroupKey = j => {
  if (j.status === 'error') return `${j.kind}|${errorKey(j.error)}`
  if (j.status === 'running') return runningKey(j)
  return null
}

// Activité: same job kind + same clip + same error (running rows stay single).
export const failureGroupKey = j => (j.status === 'error' ? `${j.kind}|${j.clipId ?? ''}|${errorKey(j.error)}` : null)

// jobs (oldest first) → groups in the same order, each placed where its newest
// member sits. A group: { ...newestJob, count, groupKeys } — `key` stays the
// newest job's key (retry targets it), `groupKeys` lists every member.
export function groupJobs(jobs, keyOf) {
  const byKey = new Map()
  const order = []
  for (const j of jobs) {
    const k = keyOf(j)
    if (k == null) { order.push({ single: j }); continue }
    let g = byKey.get(k)
    if (!g) { g = { members: [] }; byKey.set(k, g) } else { order[order.indexOf(g)] = null }
    g.members.push(j)
    order.push(g)
  }
  return order.filter(Boolean).map(entry => {
    if (entry.single) return { ...entry.single, count: 1, groupKeys: [entry.single.key] }
    const lead = entry.members[entry.members.length - 1]
    return { ...lead, count: entry.members.length, groupKeys: entry.members.map(m => m.key) }
  })
}

// Keys to drop when the group's newest job is retried: one retry, not N.
export const siblingsOf = group => group.groupKeys.filter(k => k !== group.key)
