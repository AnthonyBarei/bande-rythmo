// Réplique timing flags (FIXES_R6 #1) — one rule for the réplique list
// duration colour, its tooltip and the band's red underline.
//
// On a bande rythmo the timing comes from real speech (Whisper), so a high
// car/s is normal and is not flagged. Only these are:
//   danger  duration < 0,3 s (no room to place a syllable on the band), or
//           overlap with the next line of the SAME character
//   warn    (accent) the text was edited and its spoken length differs by
//           more than 30 % from the text that was timed — the `words` array
//           joined. No `words` → no timed reference → not flagged.
//   ok      everything else (text4)
//
// Counted text: what the actor says. Notations ("(rires)", "(HH)") and the
// "*" breath marks are dropped, whitespace is ignored (Whisper splits "l'"
// and "atmosphère" into two words).

export const MIN_DUR = 0.3
export const EDIT_RATIO = 0.3

const fr1 = n => n.toFixed(1).replace('.', ',')

export function spokenText(text) {
  return (text || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const compact = text => spokenText(text).replace(/\s/g, '')

// The text Whisper timed, or null when the réplique has no word timings.
export function timedText(sub) {
  const ws = sub?.words
  if (!Array.isArray(ws) || !ws.length) return null
  return ws.map(w => w?.w || '').join(' ')
}

// Signed relative length change of the edited text vs the timed text, or
// null when the text is unchanged / has no timed reference.
export function editDelta(sub) {
  const timed = timedText(sub)
  if (timed == null) return null
  const before = compact(timed)
  const after = compact(sub.text)
  if (before === after || !before.length) return null
  return (after.length - before.length) / before.length
}

function fmtPct(delta) {
  const pct = Math.round(Math.abs(delta) * 100)
  return `${delta < 0 ? '−' : '+'}${pct} %`
}

// → { level: 'ok' | 'warn' | 'danger', reason }
// `next` = the following réplique of the same character (by start time).
export function lineRate(sub, { next = null } = {}) {
  const dur = (sub.end ?? 0) - (sub.start ?? 0)
  if (dur < MIN_DUR) {
    return { level: 'danger', reason: `Trop court : < ${fr1(MIN_DUR)} s` }
  }
  if (next && next.start < sub.end) {
    const who = sub.character ? ` de ${sub.character}` : ''
    return { level: 'danger', reason: `Chevauche la réplique suivante${who}` }
  }
  const delta = editDelta(sub)
  if (delta != null && Math.abs(delta) > EDIT_RATIO) {
    return { level: 'warn', reason: `Texte modifié : ${fmtPct(delta)} par rapport au texte calé` }
  }
  return { level: 'ok', reason: null }
}

// Batch: one lineRate per réplique, index-aligned with `subs`. Each line's
// `next` is the following visible line of the same character in time order
// (hidden lines are not on the band, so they cannot overlap there).
export function flagLines(subs) {
  const nextOf = new Map()
  const lastByChar = new Map()
  const order = subs
    .map((s, i) => i)
    .filter(i => !subs[i].hidden)
    .sort((a, b) => subs[a].start - subs[b].start || a - b)
  for (const i of order) {
    const ch = subs[i].character || ''
    if (lastByChar.has(ch)) nextOf.set(lastByChar.get(ch), subs[i])
    lastByChar.set(ch, i)
  }
  return subs.map((s, i) => lineRate(s, { next: nextOf.get(i) || null }))
}
