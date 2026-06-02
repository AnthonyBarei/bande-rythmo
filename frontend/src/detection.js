// Phonetic sign classifier — live aid before manual détection.
// Mirror of backend/services/detection.py. Persisted word.signs always win;
// this is called only when a word has no signs yet.
//
// Families (French détection-doublage convention):
//   labiale   B/P/M   — lip closure (drawn under the letter as a solid bar)
//   semi      W       — semi-vowel (dashed bar)
//   fricative F/V     — labio-dental friction (caret above)
//   arrondie  O/U/Œ   — rounded "cul-de-poule" (circle above)
//   ouverte   A/E/I…  — open vowels (off by default — rest state)
//
// Sign palette is graphite (#c7ccd4) when drawn — see DubbingWorkspace.

export function classifyChar(ch) {
  if (!ch) return null
  const c = ch.toLowerCase()
  if ('bpm'.includes(c)) return 'labiale'
  if ('w'.includes(c)) return 'semi'
  if ('fv'.includes(c)) return 'fricative'
  if ('ouœ'.includes(c)) return 'arrondie'
  if ('aàâeéèêiîy'.includes(c)) return 'ouverte'
  return null
}

export const SIGN_KINDS = ['labiale', 'semi', 'fricative', 'arrondie', 'ouverte']

export const SIGN_LABELS = {
  labiale: 'Labiale',
  semi: 'Semi',
  fricative: 'Fricative',
  arrondie: 'Arrondie',
  ouverte: 'Ouverte',
}

// Default per-kind visibility — ouverte off (it's the rest state, too noisy).
// DOUBLAGE_IA_REVIEW §7: layer masked by default — the graphite calque turns
// on when needed, not on every clip open.
export const DEFAULT_SIGN_TOGGLES = {
  layer: false,
  startEnd: true,
  labiale: true,
  semi: true,
  fricative: true,
  arrondie: true,
  ouverte: false,
}
