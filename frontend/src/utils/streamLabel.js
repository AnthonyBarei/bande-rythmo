// Importer "Flux détectés" labels (FIXES_R5 #19).
// `und` (ffprobe/Plex "undetermined" language) is never shown. Structured
// fields (codec, channels, sample_rate, language) win when the backend sends
// them; otherwise the backend's " · "-joined label is cleaned up.

const UNKNOWN_LANG = new Set(['und', 'unknown', 'undetermined', 'zxx', 'mis'])

const isKnownLang = lang => !!lang && !UNKNOWN_LANG.has(String(lang).trim().toLowerCase())

function fmtRate(hz) {
  const khz = Number(hz) / 1000
  if (!Number.isFinite(khz) || khz <= 0) return null
  return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`
}

function fromFields(s) {
  const parts = []
  if (s.codec) parts.push(String(s.codec).toUpperCase())
  if (s.channels) parts.push(`${s.channels} ch`)
  const rate = s.sample_rate ? fmtRate(s.sample_rate) : null
  if (rate) parts.push(rate)
  if (isKnownLang(s.language)) parts.push(s.language)
  if (s.title) parts.push(s.title)
  return parts.join(' · ')
}

function fromLabel(label) {
  return String(label || '')
    .split('·')
    .map(p => p.trim())
    .filter(p => p && isKnownLang(p))
    .map(p => p.replace(/^(\d+)\s*ch$/i, '$1 ch'))
    .join(' · ')
}

export function streamLabel(stream) {
  if (!stream) return ''
  const structured = stream.codec || stream.channels || stream.sample_rate
  return (structured ? fromFields(stream) : fromLabel(stream.label)) || stream.label || ''
}
