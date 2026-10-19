// Studio helpers — réplique navigation, per-character progress, VO level.

const charOf = sub => sub?.character || ''

// Index of the previous (dir −1) / next (dir +1) réplique in time order,
// optionally restricted to the character of the current one. With no current
// réplique, the first / last line (of any character) is returned.
export function adjacentLine(subtitles, index, dir, sameCharacter) {
    const order = subtitles
        .map((s, i) => ({ i, start: Number(s?.start) || 0 }))
        .sort((a, b) => a.start - b.start || a.i - b.i)
        .map(x => x.i)
    if (!order.length) return null
    const current = index != null ? subtitles[index] : null
    if (!current) return dir > 0 ? order[0] : order[order.length - 1]
    const pos = order.indexOf(index)
    const character = charOf(current)
    for (let p = pos + dir; p >= 0 && p < order.length; p += dir) {
        const i = order[p]
        if (!sameCharacter || charOf(subtitles[i]) === character) return i
    }
    return null
}

// Progress of one character: `total` = its répliques, `done` = those of its
// répliques that have a validated (best) take. Takes whose subtitle_index no
// longer points at one of its lines are ignored.
export function characterProgress(subtitles, takes, character) {
    const mine = new Set()
    subtitles.forEach((s, i) => { if (charOf(s) === character) mine.add(i) })
    const validated = new Set()
    for (const t of takes) {
        if (t.best && t.subtitle_index != null && mine.has(t.subtitle_index)) validated.add(t.subtitle_index)
    }
    return { done: validated.size, total: mine.size }
}

export const DEFAULT_LISTEN_VO_VOLUME = 0.15

// "VO pendant l'écoute" setting → media volume 0..1. SettingsContext stores a
// fraction (0 / .15 / .5); a percent (0 / 15 / 50) is accepted too.
export function listenVoVolume(level) {
    const n = Number(level)
    if (level == null || level === '' || !Number.isFinite(n)) return DEFAULT_LISTEN_VO_VOLUME
    return Math.min(1, Math.max(0, n > 1 ? n / 100 : n))
}
