// Atelier GIF / Audio default selection (FIXES_R5 #4): the playhead ± `half`
// seconds. Near an edge the window slides to stay inside the clip, so a GIF
// started at 0 is still `2 × half` long; a shorter clip is selected whole.
export function defaultRange(t, duration, half = 3) {
  const d = Math.max(0, Number(duration) || 0)
  if (d <= 2 * half) return { in: 0, out: d }
  const center = Math.max(half, Math.min(d - half, Number(t) || 0))
  return { in: center - half, out: center + half }
}
