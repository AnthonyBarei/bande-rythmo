// /api/projects client (PROJECTS_PLAN §5). Throws Error(detail) on failure.

async function call(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = typeof body.detail === 'string' ? body.detail : `HTTP ${res.status}`
    throw new Error(detail)
  }
  return res.json()
}

export function listProjects(status = 'active') {
  return call(`/api/projects?status=${status}`)
}

export function getProject(id) {
  return call(`/api/projects/${encodeURIComponent(id)}`)
}

export function createProject(fields) {
  return call('/api/projects', { method: 'POST', body: JSON.stringify(fields) })
}

export function patchProject(id, fields) {
  return call(`/api/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(fields) })
}

export function deleteProject(id, confirmName) {
  return call(`/api/projects/${encodeURIComponent(id)}?confirm=${encodeURIComponent(confirmName)}`, { method: 'DELETE' })
}

export function moveClip(clipId, projectId) {
  return call(`/api/clips/${encodeURIComponent(clipId)}/project`, {
    method: 'PUT', body: JSON.stringify({ project_id: projectId }),
  })
}

export function fmtBytes(n) {
  if (!n) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  const v = n / 1024 ** i
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1).replace('.', ',')} ${units[i]}`
}
