// FIXES_R4 §12: in a list of finished rows (Activité, Exporter queue) only the
// single newest row gets the primary button, and only while it is fresh.

export const PRIMARY_WINDOW_MS = 10 * 60 * 1000

// Epoch ms from a number (ms) or an ISO string (backend local time); NaN otherwise.
export function toMillis(at) {
  if (typeof at === 'number') return at
  if (typeof at === 'string' && at) return Date.parse(at)
  return NaN
}

// rows: [{ key, at }] — returns the key of the newest row when it finished
// less than `windowMs` ago, else null.
export function primaryRowKey(rows, now, windowMs = PRIMARY_WINDOW_MS) {
  let best = null
  for (const row of rows) {
    const t = toMillis(row.at)
    if (!Number.isFinite(t)) continue
    if (!best || t > best.t) best = { key: row.key, t }
  }
  if (!best) return null
  return now - best.t < windowMs ? best.key : null
}
