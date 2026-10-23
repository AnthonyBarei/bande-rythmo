// Comédien names per clip, local to this browser (shared with the Éditeur's
// Voix tab) — until the project cast (PROJECTS_PLAN P5). The Studio's role and
// mode now live in clips.ui_state (utils/clipState).

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
