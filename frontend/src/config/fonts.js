// Band fonts — the single list of labels shown in Réglages, the Éditeur
// toolbar and the Exporter (FIXES_R7 #2). Ids are stable: they are stored in
// settings.brFont and mapped to font files by the backend (_BR_FONT_FILES).
// Uploaded fonts (ids 'u-…') are labelled by their file name.
export const BUNDLED_FONTS = [
  { id: 'cursive',   label: 'Manuscrite', family: 'Caveat' },
  { id: 'atkinson',  label: 'Lisible',    family: 'Atkinson Hyperlegible' },
  { id: 'lisible',   label: 'Feutre',     family: 'Shantell Sans' },
  { id: 'plex',      label: 'Neutre',     family: 'IBM Plex Sans' },
  { id: 'jetbrains', label: 'Mono',       family: 'JetBrains Mono' },
]

// No longer offered (FIXES_R8 #6: Neutre = IBM Plex Sans) but still rendered
// for projects/settings that already use them. Listed only while selected.
const LEGACY_FONTS = [
  { id: 'inter', label: 'Inter', family: 'Ancienne police' },
]

const isUploaded = id => typeof id === 'string' && id.startsWith('u-')

export function fontLabel(id, uploadedFonts = []) {
  const bundled = BUNDLED_FONTS.find(f => f.id === id) || LEGACY_FONTS.find(f => f.id === id)
  if (bundled) return bundled.label
  if (isUploaded(id)) return uploadedFonts.find(f => f.id === id)?.name || 'Police importée'
  return id
}

// Select options: { v, l, hint } — hint = font family. `current` keeps a
// legacy id visible in the Select while it is the selected value.
export function fontOptions(uploadedFonts = [], current = null) {
  const legacy = LEGACY_FONTS.filter(f => f.id === current)
  return [
    ...BUNDLED_FONTS.map(f => ({ v: f.id, l: f.label, hint: f.family })),
    ...uploadedFonts.map(f => ({ v: f.id, l: f.name, hint: 'Importée' })),
    ...legacy.map(f => ({ v: f.id, l: f.label, hint: f.family })),
  ]
}

export async function fetchUploadedFonts() {
  const r = await fetch('/api/fonts')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
