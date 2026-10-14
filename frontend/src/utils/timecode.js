// Canonical timecode formatting — single source of truth.
// Replaces 5 near-duplicate formatters (DubbingWorkspace, SubtitleEditor,
// ExportPanel, VideoEditor).

// "MM:SS.s" — transport clocks, hover labels.
// Values are rounded to the displayed precision BEFORE the minute split, so
// 59.97 reads 01:00.0 and never 00:60.0.
export const fmtClock = t => {
  if (!t && t !== 0) return '00:00.0'
  const r = Math.round(t * 10) / 10
  const m = Math.floor(r / 60)
  const s = (r - m * 60).toFixed(1).padStart(4, '0')
  return `${String(m).padStart(2, '0')}:${s}`
}

// "MM:SS.ss" — réplique TC fields (frame-ish precision without fps).
export const fmtClockPrecise = t => {
  if (t === null || t === undefined) return '--:--.--'
  const r = Math.round(t * 100) / 100
  const m = Math.floor(r / 60)
  const s = (r - m * 60).toFixed(2).padStart(5, '0')
  return `${String(m).padStart(2, '0')}:${s}`
}

// "H:MM:SS.ss" with hours only when needed — long source videos (import).
export const fmtClockHours = t => {
  if (t === null || t === undefined) return '--:--.--'
  const r = Math.round(t * 100) / 100
  const h = Math.floor(r / 3600)
  const m = Math.floor((r - h * 3600) / 60)
  const s = (r - h * 3600 - m * 60).toFixed(2).padStart(5, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${String(m).padStart(2, '0')}:${s}`
}

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
