// A project's media bin (/api/sources) — client + pure helpers.

async function call(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(typeof body.detail === 'string' ? body.detail : `HTTP ${res.status}`)
    err.status = res.status
    err.detail = body.detail
    throw err
  }
  return body
}

const enc = encodeURIComponent

export function patchSource(id, fields) {
  return call(`/api/sources/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(fields) })
}

export function putDraft(id, draft) {
  return call(`/api/sources/${enc(id)}/draft`, { method: 'PUT', body: JSON.stringify({ draft }) })
}

// Opens the backend file dialog. 409 { reason: 'duration_mismatch', path,
// expected, found } → confirm, then call again with that `path` (no dialog).
export function relinkSource(id, path = null) {
  const q = path ? `?force=true&path=${enc(path)}` : ''
  return call(`/api/sources/${enc(id)}/relink${q}`, { method: 'POST' })
}

// Removes the video from the project; its clips stay (cut already).
export function deleteSource(id) {
  return call(`/api/sources/${enc(id)}`, { method: 'DELETE' })
}

// Reads the tracks of a source that has none stored (registered before P3).
export function probeSource(id) {
  return call(`/api/sources/${enc(id)}/probe`, { method: 'POST' })
}

// { tracks: [{ index, label, codec, language, direct, ready }], job_id }
export function getAudioTracks(id) {
  return call(`/api/sources/${enc(id)}/audio`)
}

// Extracts every track the browser can't play as is, once: { status, job_id }.
export function prepareAudio(id) {
  return call(`/api/sources/${enc(id)}/prepare-audio`, { method: 'POST' })
}

export function hasTracks(src) {
  const s = src?.streams || {}
  return (s.video_streams?.length || 0) + (s.audio_streams?.length || 0) > 0
}

// The separate audio to play next to the video: none when the video's own
// default track plays (Auto on a browser-safe default, or that track picked).
export function audioSrcFor(sourceId, tracks, chosen) {
  const t = (tracks || []).find(x => x.index === (chosen ?? 0))
  if (!t || t.direct || !t.ready) return null
  return `/api/files/stream/${encodeURIComponent(sourceId)}?audio=${t.index}`
}

export function addUrlSource(projectId, path, filename) {
  return call(`/api/projects/${enc(projectId)}/sources`, { method: 'POST', body: JSON.stringify({ path, filename }) })
}

// Source row → the `video` object the import screen plays. Local and library
// sources stream through the backend (it rebuilds tokenised library URLs).
export function videoFromSource(src) {
  const direct = src.kind === 'url'
  return {
    sourceId: src.id,
    filename: src.filename,
    sourcePath: direct || src.kind === 'local' ? src.path : null,
    url: direct ? src.path : `/api/files/stream/${src.id}`,
  }
}

// Ranges waiting in the draft: banked ranges + a complete IN → OUT.
export function draftRangeCount(draft) {
  if (!draft) return 0
  const markComplete = draft.mark?.in != null && draft.mark?.out != null && draft.mark.out > draft.mark.in
  return (draft.pending?.length || 0) + (markComplete ? 1 : 0)
}

// VideoEditor state → stored draft (null when there is nothing to keep).
export function buildDraft(pending, mark, markName, playhead) {
  const ranges = pending.map(({ name, start, end }) => ({ name: name || '', start, end }))
  const hasMark = mark.markIn != null || mark.markOut != null
  const at = Math.round((playhead || 0) * 10) / 10
  if (!ranges.length && !hasMark && !at) return null
  return { pending: ranges, mark: hasMark ? { in: mark.markIn, out: mark.markOut } : null, markName: markName || '', playhead: at }
}
