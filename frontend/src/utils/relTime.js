// « il y a 3 mois » — coarse relative time for Mon compte (sessions, password).
const STEPS = [
  [60, 'seconde'],
  [60, 'minute'],
  [24, 'heure'],
  [30, 'jour'],
  [12, 'mois'],
  [Infinity, 'an'],
]

export function relTime(iso, now = Date.now()) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  let n = Math.max(0, (now - t) / 1000)
  if (n < 60) return 'à l’instant'
  for (const [size, unit] of STEPS) {
    if (n < size) {
      const k = Math.floor(n)
      const plural = k > 1 && unit !== 'mois' ? 's' : ''
      return `il y a ${k} ${unit}${plural}`
    }
    n /= size
  }
  return ''
}
