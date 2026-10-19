// Réplique reading rate (FIXES_R5 #16) — one rule for the réplique list colour
// and its tooltip.
//
// Thresholds, in characters per second of spoken text:
//   ≤ 20 car/s  comfortable for dubbed speech                     → ok
//   > 20 car/s  dense but sayable                                 → warn (accent)
//   > 25 car/s  hard limit                                        → danger
//   < 0,3 s     too short to place a syllable on the band         → danger
//
// Why 20: the band draws its red underline when a word is squeezed below
// scaleX 0.82 (DubbingWorkspace), with scaleX = pxPerSec / (cps × glyph px).
// Measured band glyphs average 9.4 px (Atkinson 20 px / 600) and 8.5 px
// (Caveat 26 px / 600); at the default 150 px/s scroll the underline starts at
// 150 / (0.82 × 9.4) ≈ 19.5 car/s (Atkinson) to ≈ 21.4 car/s (Caveat), i.e. at
// the ~20 car/s dubbing hard limit. The band rule moves with the zoom; this
// one does not — it is the zoom-independent version of the same limit.
// Raised from 15/20: Whisper trims line ends to the last phoneme, so natural
// speech already measures ~20 car/s and 15/20 flagged 45 of 51 real lines.
//
// Counted text: what the actor says. Notations ("(rires)", "(HH)") and the
// "*" breath marks are dropped; spaces count (a space takes band room too).

export const CPS_WARN = 20
export const CPS_MAX = 25
export const MIN_DUR = 0.3

const fr1 = n => n.toFixed(1).replace('.', ',')

export function spokenText(text) {
  return (text || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function charsPerSec(text, dur) {
  const n = spokenText(text).length
  if (!n) return 0
  return dur > 0 ? n / dur : Infinity
}

// → { level: 'ok' | 'warn' | 'danger', reason, cps }
export function lineRate({ text, start, end }) {
  const dur = (end ?? 0) - (start ?? 0)
  const cps = charsPerSec(text, dur)
  if (dur < MIN_DUR) {
    return { level: 'danger', reason: `Trop court : < ${fr1(MIN_DUR)} s`, cps }
  }
  const rounded = Math.round(cps)
  if (cps > CPS_MAX) {
    return { level: 'danger', reason: `Débit trop élevé : ${rounded} car/s (max ${CPS_MAX})`, cps }
  }
  if (cps > CPS_WARN) {
    return { level: 'warn', reason: `Débit élevé : ${rounded} car/s`, cps }
  }
  return { level: 'ok', reason: `Débit : ${rounded} car/s`, cps }
}
