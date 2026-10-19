// Canonical timecode formatting — single source of truth.

// "HH:MM:SS:FF" — SMPTE at the clip's frame rate (BR pro display, DetX).
export const fmtSMPTE = (sec, fps = 25) => {
  if (sec == null || Number.isNaN(sec)) return '--:--:--:--'
  const f = Math.max(1, Math.round(fps))
  const neg = sec < 0
  const abs = Math.abs(sec)
  const totalFrames = Math.round(abs * f)
  const ff = totalFrames % f
  const totalSec = Math.floor(totalFrames / f)
  const ss = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const mm = totalMin % 60
  const hh = Math.floor(totalMin / 60)
  const p2 = n => String(n).padStart(2, '0')
  return `${neg ? '-' : ''}${p2(hh)}:${p2(mm)}:${p2(ss)}:${p2(ff)}`
}

// Parse "SS", "MM:SS.s" or "HH:MM:SS.s" (commas tolerated) → seconds | null.
export function parseTC(s) {
  if (typeof s !== 'string') return null
  s = s.trim().replace(',', '.')
  if (!s) return null
  const parts = s.split(':')
  let sec = 0
  try {
    if (parts.length === 1) sec = parseFloat(parts[0])
    else if (parts.length === 2) sec = parseInt(parts[0], 10) * 60 + parseFloat(parts[1])
    else if (parts.length === 3) sec = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2])
    else return null
    if (isNaN(sec)) return null
    return Math.max(0, sec)
  } catch { return null }
}
