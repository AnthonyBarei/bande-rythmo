// Comédien display helper. Names live in the project cast (utils/cast, P5);
// the Studio's role and mode in clips.ui_state (utils/clipState).

// Signed in (ACCOUNT.md §4): a role with no comédien yet shows the account's
// comédien name. Display only — nothing is stored until the field is edited,
// and a field cleared on purpose ('' in the map) stays empty.
export function withComedienDefault(map, roles, fallback) {
  if (!fallback) return map
  const out = { ...map }
  for (const role of roles) if (!Object.hasOwn(out, role)) out[role] = fallback
  return out
}
