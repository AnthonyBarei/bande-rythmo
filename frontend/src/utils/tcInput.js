// Importer "go to timecode" field (FIXES_R3 · Importer player controls).
// Accepts, from longest to shortest:
//   HH:MM:SS:FF   frames at `fps` (";" tolerated, drop-frame notation)
//   HH:MM:SS(.s)  MM:SS(.s)  SS(.s)   (decimal comma tolerated)
// The leading field may exceed its usual range ("90" = 90 s, "75:00" = 75 min);
// every following field must stay in range. Returns seconds, or null.

const INT = /^\d+$/
const DEC = /^\d+(\.\d+)?$/

export function parseTimecodeInput(str, fps = 25) {
  if (typeof str !== 'string') return null
  const s = str.trim().replace(/;/g, ':').replace(',', '.')
  if (!s) return null
  const parts = s.split(':')
  if (parts.length > 4) return null

  const rate = Math.max(1, Math.round(fps))
  const hasFrames = parts.length === 4
  let frames = 0
  if (hasFrames) {
    const ff = parts.pop()
    if (!INT.test(ff) || Number(ff) >= rate) return null
    frames = Number(ff)
  }

  const last = parts.length - 1
  let sec = 0
  for (let i = 0; i <= last; i++) {
    const p = parts[i]
    const decimalAllowed = i === last && !hasFrames
    if (!(decimalAllowed ? DEC : INT).test(p)) return null
    const n = Number(p)
    if (i > 0 && n >= 60) return null
    sec = sec * 60 + n
  }
  return sec + frames / rate
}
