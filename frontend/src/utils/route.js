// Hash routes (PROJECTS_PLAN §4) — reload, back/forward and deep links.
//   #projects · #p/{projectId}/{stage}[/{clipId}] · #memes · #settings · #activity · #account
//   #login · #register · #reset=<token> · #verify=<token> (ACCOUNT.md)

export const STAGES = ['media', 'clips', 'dub', 'record', 'export']
export const CLIP_STAGES = new Set(['dub', 'record', 'export'])
const TOP_VIEWS = new Set(['projects', 'memes', 'settings', 'activity', 'account'])

export const PROJECTS = { view: 'projects' }

export function parseRoute(hash) {
  const h = (hash || '').replace(/^#/, '')
  if (h === 'login' || h === 'register') return { view: 'auth', mode: h }
  if (h.startsWith('reset=')) return { view: 'auth', mode: 'reset', token: h.slice(6) }
  if (h.startsWith('verify=')) return { view: 'verify', token: h.slice(7) }
  if (TOP_VIEWS.has(h)) return { view: h }
  const parts = h.split('/').map(decodeURIComponent)
  if (parts[0] === 'p' && parts[1]) {
    const stage = STAGES.includes(parts[2]) ? parts[2] : 'clips'
    return { view: 'project', projectId: parts[1], stage, clipId: CLIP_STAGES.has(stage) ? parts[3] || null : null }
  }
  return { view: 'none' }
}

export function formatRoute(route) {
  if (route.view === 'project') {
    const parts = ['p', route.projectId, route.stage]
    if (CLIP_STAGES.has(route.stage) && route.clipId) parts.push(route.clipId)
    return '#' + parts.map(encodeURIComponent).join('/')
  }
  if (route.view === 'auth') return route.mode === 'reset' ? `#reset=${route.token}` : `#${route.mode}`
  if (route.view === 'verify') return `#verify=${route.token}`
  return TOP_VIEWS.has(route.view) ? `#${route.view}` : ''
}

export function projectRoute(projectId, stage, clipId = null) {
  return { view: 'project', projectId, stage, clipId: CLIP_STAGES.has(stage) ? clipId : null }
}

// Where opening a project lands: its saved stage and clip when they still
// exist, else Clips (or Médias for a project with nothing cut yet).
export function resumeRoute(project, projectClips) {
  const { stage, clip_id: clipId } = project.ui_state || {}
  const clipExists = clipId && projectClips.some(c => c.clip_id === clipId)
  if (CLIP_STAGES.has(stage) && clipExists) return projectRoute(project.id, stage, clipId)
  if (stage === 'media' || (stage === 'clips' && projectClips.length)) return projectRoute(project.id, stage)
  return projectRoute(project.id, projectClips.length ? 'clips' : 'media')
}
