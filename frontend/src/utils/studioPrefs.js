// Per-clip Studio memory, local to this browser: comédien names (shared with
// the Éditeur's Voix tab), the last role recorded, the recording mode, and the
// réplique selected in the Éditeur (session only) so the Studio opens on it.

const read = (store, key, fallback) => {
  try {
    const raw = store.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback   // storage unavailable or corrupt — default
  }
}
const write = (store, key, value) => {
  try {
    if (value == null) store.removeItem(key)
    else store.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('Studio : préférence non mémorisée', key, e)
  }
}

export const readComediens = clipId => read(localStorage, `br-comediens-${clipId}`, {}) || {}
export const writeComediens = (clipId, map) => write(localStorage, `br-comediens-${clipId}`, map)

// Signed in (ACCOUNT.md §4): a role with no comédien yet shows the account's
// comédien name. Display only — nothing is stored until the field is edited,
// and a field cleared on purpose ('' in the map) stays empty.
export function withComedienDefault(map, roles, fallback) {
  if (!fallback) return map
  const out = { ...map }
  for (const role of roles) if (!Object.hasOwn(out, role)) out[role] = fallback
  return out
}

export const readStudioRole =clipId => read(localStorage, `br-studio-role-${clipId}`, null)
export const writeStudioRole = (clipId, role) => write(localStorage, `br-studio-role-${clipId}`, role)

export const readStudioMode = clipId => read(localStorage, `br-studio-mode-${clipId}`, 'line')
export const writeStudioMode = (clipId, mode) => write(localStorage, `br-studio-mode-${clipId}`, mode)

export const readEditorSelection = clipId => read(sessionStorage, `br-editor-sel-${clipId}`, null)
export const writeEditorSelection = (clipId, index) => write(sessionStorage, `br-editor-sel-${clipId}`, index)
