// Band time = video time + brOffset — the time base the bande rythmo, its
// cursor and every réplique edit use. Video seeks convert back.

export const bandTimeOf = (videoTime, offset = 0) => (videoTime || 0) + (offset || 0)

export const videoTimeOf = (bandTime, offset = 0) => Math.max(0, bandTime - (offset || 0))

// Hidden répliques are not drawn on the band, so they are never "active".
export const isActiveAt = (sub, t) => !sub.hidden && t >= sub.start && t <= sub.end

export const activeIndexAt = (subs, t) => subs.findIndex(s => isActiveAt(s, t))
