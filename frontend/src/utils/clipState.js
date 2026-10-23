// Per-clip working state (PROJECTS_PLAN P4): clips.ui_state (shallow-merged
// server-side — the editor and the Studio own their keys) and clips.br_offset.

async function put(url, body) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

export const putUiState = (clipId, patch) => put(`/api/clips/${encodeURIComponent(clipId)}/ui-state`, { ui_state: patch })
export const putBrOffset = (clipId, brOffset) => put(`/api/clips/${encodeURIComponent(clipId)}/br-offset`, { br_offset: brOffset })

// Éditeur → Studio: the réplique to open on, handed over in memory (this tab).
// The Studio falls back to the persisted ui_state.selected.
const handoff = new Map()
export function handOffSelection(clipId, index) {
  if (index != null && index >= 0) handoff.set(clipId, index)
  else handoff.delete(clipId)
}
export function takeHandoff(clipId) {
  const index = handoff.get(clipId)
  handoff.delete(clipId)
  return index ?? null
}

// Pre-P4 Studio memory lived in localStorage, per clip. Read once as a
// fallback, then dropped when the clip's ui_state takes over.
const legacyKeys = clipId => [`br-studio-role-${clipId}`, `br-studio-mode-${clipId}`]

function readLegacy(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null   // storage unavailable or corrupt
  }
}

export function studioStateOf(clip) {
  const s = clip.ui_state?.studio
  if (s) return { role: s.role ?? null, mode: s.mode || 'line' }
  const [roleKey, modeKey] = legacyKeys(clip.clip_id)
  return { role: readLegacy(roleKey), mode: readLegacy(modeKey) || 'line' }
}

export function dropLegacyStudioKeys(clipId) {
  try {
    for (const key of legacyKeys(clipId)) localStorage.removeItem(key)
  } catch (e) {
    console.warn('Anciennes préférences Studio non effacées', e)
  }
}
