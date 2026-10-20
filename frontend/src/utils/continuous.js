// Studio « En continu » (STUDIO_V2 §2): the role recorded in one pass, then
// split into one take per réplique.

export const SLICE_PRE = 0.25      // s kept before a réplique start
export const SLICE_POST = 0.35     // s kept after its end
export const MAX_OVERLAP = 0.1     // two neighbouring slices share at most this

const charOf = s => s?.character || ''

// Répliques of `role` in time order, limited to the chosen range:
//   'from'  from the current réplique on
//   'all'   the whole clip
//   'inout' those inside [inout.in, inout.out]
export function rangeLines(subtitles, role, kind, index, inout) {
  const lines = subtitles
    .map((s, i) => ({ i, s }))
    .filter(x => charOf(x.s) === role && !x.s.hidden)
    .sort((a, b) => a.s.start - b.s.start || a.i - b.i)
  if (kind === 'all') return lines.map(x => x.i)
  if (kind === 'inout' && inout) {
    const inside = lines.filter(x => x.s.start >= inout.in && x.s.end <= inout.out)
    return inside.map(x => x.i)
  }
  const from = index != null && subtitles[index] ? subtitles[index].start : -Infinity
  return lines.filter(x => x.s.start >= from).map(x => x.i)
}

// Media-time slice of each réplique ([{ i, start, end }], time order):
// [start − 0.25 s, end + 0.35 s], clamped at 0, and pulled in around the gap
// between two neighbours so they overlap by MAX_OVERLAP at most — never
// inside a réplique itself.
export function sliceBounds(lines) {
  const out = lines.map(l => ({ i: l.i, start: l.start, end: l.end, from: Math.max(0, l.start - SLICE_PRE), to: l.end + SLICE_POST }))
  for (let k = 1; k < out.length; k++) {
    const a = out[k - 1]
    const b = out[k]
    if (a.to - b.from <= MAX_OVERLAP) continue
    const mid = (a.end + b.start) / 2
    a.to = Math.max(a.end, Math.min(a.to, mid + MAX_OVERLAP / 2))
    b.from = Math.min(b.start, Math.max(b.from, mid - MAX_OVERLAP / 2))
  }
  return out
}

// Channels → [fromSec, toSec) of them.
export function sliceChannels(channels, sampleRate, fromSec, toSec) {
  const len = channels[0]?.length || 0
  const a = Math.min(len, Math.max(0, Math.round(fromSec * sampleRate)))
  const b = Math.min(len, Math.max(a, Math.round(toSec * sampleRate)))
  return channels.map(ch => ch.subarray(a, b))
}
