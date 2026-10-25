// Project cast (PROJECTS_PLAN P5): role → comédien, once per project.

export function castMap(cast = []) {
  return Object.fromEntries(cast.map(r => [r.role, r.comedien ?? '']))
}

export function putCast(projectId, patch) {
  return fetch(`/api/projects/${encodeURIComponent(projectId)}/cast`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cast: patch }),
  }).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
}

// Pre-P5 names lived in localStorage per clip (br-comediens-{clipId}). For the
// roles the project has not cast yet, the name used on most clips wins (first
// seen on a tie). Returns { patch, conflicts: [{ role, names }] }.
const legacyKey = clipId => `br-comediens-${clipId}`

function readLegacy(clipId) {
  try {
    const map = JSON.parse(localStorage.getItem(legacyKey(clipId)) || 'null')
    return map && typeof map === 'object' ? map : null
  } catch {
    return null   // storage unavailable or corrupt
  }
}

export function legacyCastPatch(clipIds, existing = {}) {
  const tally = {}
  for (const id of clipIds) {
    const map = readLegacy(id)
    if (!map) continue
    for (const [role, name] of Object.entries(map)) {
      if (role in existing || typeof name !== 'string') continue
      const counts = tally[role] || (tally[role] = new Map())
      counts.set(name, (counts.get(name) || 0) + 1)
    }
  }
  const patch = {}
  const conflicts = []
  for (const [role, counts] of Object.entries(tally)) {
    let best = null
    for (const [name, n] of counts) if (best == null || n > counts.get(best)) best = name
    patch[role] = best
    if (counts.size > 1) conflicts.push({ role, names: [...counts.keys()] })
  }
  return { patch, conflicts }
}

export function hasLegacyCast(clipIds) {
  return clipIds.some(id => readLegacy(id) != null)
}

export function dropLegacyCast(clipIds) {
  try {
    for (const id of clipIds) localStorage.removeItem(legacyKey(id))
  } catch (e) {
    console.warn('Anciens noms de comédiens non effacés', e)
  }
}
