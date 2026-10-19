// FIXES_R6 #12: a duration is not a timecode — whole seconds, M:SS under an
// hour, H:MM:SS above (5:01, 55:13, 0:12, 1:02:05).
export function fmtDuration(sec) {
    const total = Math.max(0, Math.round(Number(sec) || 0))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = String(total % 60).padStart(2, '0')
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

// FIXES_R6 #13: timecode with the frames dropped (HH:MM:SS) — for rulers
// whose ticks are ≥ 1 s apart and the matching range labels. Truncates like
// SMPTE (the epsilon absorbs float drift such as 9.9999999 → 00:00:10).
export function fmtHMS(sec) {
    const total = Math.max(0, Math.floor((Number(sec) || 0) + 1e-6))
    const pad = n => String(n).padStart(2, '0')
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}
