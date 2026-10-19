import { classifyChar, DEFAULT_SIGN_TOGGLES } from '../../detection'
import { TRACK_COLORS } from '../../config/tracks'
import { fmtClock, fmtSMPTE as fmtTC } from '../../utils/timecode'
import { flagLines } from '../../utils/lineRate'

// Bande rythmo renderer — shared by the Éditeur (interactive) and the Studio
// (read-only). Constant-speed scrolling: the cursor sits at CURSOR_X_RATIO × W,
// at t = sub.start the LEFT EDGE of the text is exactly at the cursor, and the
// text scrolls left at pxPerSec pixels/second.
export const CURSOR_X_RATIO = 0.32
export const H_TRACK = 76
export const FONT_BR = 'bold 22px "JetBrains Mono", "Courier New", monospace'

// Backing-store height before the first layout (canvas `height` attribute).
export const bandCanvasHeight = numTracks => Math.min(numTracks * H_TRACK, 240)

// hex (#rrggbb) + opacity (0..1) → 8-digit hex string accepted by canvas fillStyle
export const withAlpha = (hex, a) => hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')

// Font picker — manuscript options first, then maximum-legibility.
// Atkinson stays default (most readable); `lisible` (Shantell Sans) gives the
// handwritten feel without the hit to readability that pure cursive has.
export const BR_FONTS = [
  { id: 'atkinson',  label: 'Atkinson Hyperlegible', stack: "'Atkinson Hyperlegible', sans-serif" },
  { id: 'lisible',   label: 'Manuscrite lisible',    stack: "'Shantell Sans', 'Caveat', cursive" },
  { id: 'cursive',   label: 'Caveat (manuscrite)',   stack: "'Caveat', cursive" },
  { id: 'plex',      label: 'IBM Plex Sans',         stack: "'IBM Plex Sans', sans-serif" },
  { id: 'inter',     label: 'Inter',                 stack: "'Inter', sans-serif" }, // legacy — not offered
  { id: 'jetbrains', label: 'JetBrains Mono',        stack: "'JetBrains Mono', 'Courier New', monospace" },
]
// Uploaded fonts (id starts 'u-') resolve to the @font-face family injected
// by the fonts loader; bundled ids look up the static stack.
export const brFontStack = id => {
  if (id && id.startsWith('u-')) return `'bru-${id}', 'Atkinson Hyperlegible', sans-serif`
  return (BR_FONTS.find(f => f.id === id) || BR_FONTS[0]).stack
}
// Band text font — reference BandCanvas: weight 600, 26px for the Caveat
// manuscrite, 20px for other faces, 14px italic for (réactions); × Style scale.
export const brFontPx = (id, scale, isReact) =>
  Math.max(10, Math.round((isReact ? 14 : (id === 'cursive' ? 26 : 20)) * scale))
export const brCanvasFont = (id, scale, isReact) =>
  `${isReact ? 'italic ' : ''}600 ${brFontPx(id, scale, isReact)}px ${brFontStack(id)}`

// Band marks keep a fixed size whatever the track height (FIXES_R4 #5): only
// the gaps between lanes grow when the band is enlarged.
const WEDGE_H = 10        // début/fin triangle height, centred on the text line
const WEDGE_D = 6         // triangle depth into the block
const SIGN_PX = 12        // détection sign box
const SIGN_GAP = 3        // glyph ↔ sign gap
const WAVE_MAX_AMP = 18   // per-track waveform half-height cap
const BAND_BG = '#0b0b0d' // reference T.bg (classique band background)
// Canvas can't read CSS variables — --text4 / --danger tokens (not user-swappable).
const TEXT4 = '#565660'
const DANGER = '#E8595D'
export const DEFAULT_ACCENT = '#F5C518'

// Settings accent when it is a plain #rrggbb (canvas needs a literal colour).
export const bandAccent = accent => (/^#[0-9a-f]{6}$/i.test(accent || '') ? accent : DEFAULT_ACCENT)

// Détection sign palette colour (graphite, low-saturation so it never fights
// the dialogue text). Same on canvas and in MP4 burn (see br_renderer).
const SIGN_COLOR = '#c7ccd4'
const SIGN_COLOR_INACTIVE = 'rgba(199,204,212,0.45)'

// Focus (FIXES_R6 #8): with a focused character, the other tracks draw at
// FOCUS_DIM so the actor reads their own line. focusChar null → no focus.
export const FOCUS_DIM = 0.45
export const focusTrackOf = (charMap, focusChar) =>
  focusChar == null ? null : (charMap[focusChar] ?? null)
export const trackAlpha = (track, focusTrack) =>
  focusTrack == null || track === focusTrack ? 1 : FOCUS_DIM

// Block underline (FIXES_R6 #1): same rule as the réplique list — danger red
// for a too-short / overlapping line, accent for an edited text that no
// longer fits its timing, none otherwise.
export const underlineColor = (level, accent) =>
  level === 'danger' ? DANGER : level === 'warn' ? accent : null

// flagLines once per subtitles array (the RAF loop redraws every frame).
const flagCache = new WeakMap()
function cachedFlags(subtitles) {
  let flags = flagCache.get(subtitles)
  if (!flags) { flags = flagLines(subtitles); flagCache.set(subtitles, flags) }
  return flags
}

// Persisted band toggles (Éditeur writes them): détection layer + per-sign
// toggles, auto-classify hint, word-by-word rendering. No storage → defaults.
export function readDetection() {
  try {
    const raw = localStorage.getItem('br-detection')
    return raw ? { ...DEFAULT_SIGN_TOGGLES, ...JSON.parse(raw) } : { ...DEFAULT_SIGN_TOGGLES }
  } catch { return { ...DEFAULT_SIGN_TOGGLES } }
}
export function readDetectionAuto() {
  try { return localStorage.getItem('br-detection-auto') !== 'false' } catch { return true }
}
export function readWordByWord() {
  try { return localStorage.getItem('br-word-by-word') !== 'false' } catch { return true }
}

// Characters in first-appearance order → track index.
export function buildCharMap(subtitles) {
  const seen = []
  for (const s of subtitles) {
    const c = s.character || ''
    if (!seen.includes(c)) seen.push(c)
  }
  return Object.fromEntries(seen.map((c, i) => [c, i]))
}

// Auto-fit scroll rate: pick pxPerSec so the densest réplique sits near its
// natural width and lighter ones stretch out (clamped 100–220). null = no text.
export function autoFitPxPerSec(subtitles, brFont, fontScale) {
  const ctx = document.createElement('canvas').getContext('2d')
  let need = 0
  for (const s of subtitles) {
    if (!s.text) continue
    ctx.font = brCanvasFont(brFont, fontScale, s.text.startsWith('('))
    const dur = Math.max(0.1, s.end - s.start)
    need = Math.max(need, ctx.measureText(s.text).width / dur)
  }
  return need > 0 ? Math.round(Math.max(100, Math.min(220, need))) : null
}

// Resolve a word's signs: persisted wins; otherwise auto-classify from letters.
export function resolveSigns(word, autoEnabled) {
  if (Array.isArray(word.signs) && word.signs.length) return word.signs
  if (!autoEnabled) return []
  const text = word.w || ''
  const dur = Math.max(0.05, (word.end || 0) - (word.start || 0))
  const out = []
  for (let i = 0; i < text.length; i++) {
    const kind = classifyChar(text[i])
    if (!kind) continue
    // Even time split across letters — only used as a hint; persisted signs
    // carry their own t0/t1 (e.g. labiale = frame of closure, independent).
    const t0 = word.start + (i / Math.max(1, text.length)) * dur
    const t1 = word.start + ((i + 1) / Math.max(1, text.length)) * dur
    out.push({ i, type: kind, t0, t1 })
  }
  return out
}

// Return per-word timing for a réplique only if it is still consistent with
// the current text + timing (else the words are stale from an edit → caller
// falls back to even-stretch). Whitespace-insensitive text match.
export function validWords(sub) {
  const ws = sub.words
  if (!Array.isArray(ws) || !ws.length) return null
  const joined = ws.map(w => (w.w || '')).join('').replace(/\s/g, '')
  const txt = (sub.text || '').replace(/\s/g, '')
  if (!joined || joined !== txt) return null
  for (const w of ws) {
    if (w.start < sub.start - 0.05 || w.end > sub.end + 0.05) return null
  }
  return ws
}

// One frame of the band at band time `t`. `o` carries the data and the look:
// { subtitles, charMap, numTracks, pxPerSec, brStyle, accent, brFont, fontScale,
//   wordByWord, detection, detectionAuto, waveform, boucles, sceneCuts, clipFps,
//   loopRegion, charFilter, focusChar }. `hover` ({x, time}) draws the scrub line unless
// `dragging`.
export function drawBand(canvas, t, o, hover = null, dragging = false) {
  const {
    subtitles, charMap, numTracks, pxPerSec: pxSec, brStyle: style, accent, brFont, fontScale,
    wordByWord, detection, detectionAuto, waveform, boucles, sceneCuts, clipFps, loopRegion, charFilter, focusChar,
  } = o
  const focusTrack = focusTrackOf(charMap, focusChar)
  const onsets = waveform?.onsets || null

  // Backing store at device pixels (crisp text on HiDPI); all drawing and
  // hit-testing below works in CSS pixels.
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.offsetWidth
  const cssH = canvas.offsetHeight
  if (cssW > 0 && canvas.width !== Math.round(cssW * dpr)) canvas.width = Math.round(cssW * dpr)
  if (cssH > 0 && canvas.height !== Math.round(cssH * dpr)) canvas.height = Math.round(cssH * dpr)

  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const W = canvas.width / dpr
  const H = canvas.height / dpr || bandCanvasHeight(numTracks)
  const cursor_x = W * CURSOR_X_RATIO
  const isNeon = style === 'neon'
  const isMinimal = style === 'minimal'

  // Background
  ctx.shadowBlur = 0
  // Flat reference background — no scan lines: they lifted every 3rd row
  // inside the blocks above the trackHex + '12' fill (FIXES_R4 #6).
  ctx.fillStyle = isNeon ? '#06060a' : isMinimal ? '#0d0d10' : BAND_BG
  ctx.fillRect(0, 0, W, H)

  // Track separators
  for (let track = 1; track < numTracks; track++) {
    const trackH = H / numTracks
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.setLineDash([])
    ctx.beginPath(); ctx.moveTo(0, track * trackH); ctx.lineTo(W, track * trackH); ctx.stroke()
  }

  // SMPTE grid — one 1px line per second, HH:MM:SS:FF label (FIXES_R5 #9) at the band foot.
  {
    const gStart = t - cursor_x / pxSec
    const gEnd = t + (W - cursor_x) / pxSec
    ctx.setLineDash([])
    ctx.lineWidth = 1
    ctx.font = '9px "JetBrains Mono", monospace'
    ctx.textBaseline = 'bottom'
    // Labels are ~60px wide: thin them out when zoomed below 70 px/s.
    const labelEvery = Math.max(1, Math.ceil(70 / pxSec))
    for (let tick = Math.ceil(gStart); tick <= Math.floor(gEnd); tick++) {
      const gx = cursor_x + (tick - t) * pxSec
      ctx.strokeStyle = tick < 0 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.05)'
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
      if (tick >= 0 && tick % labelEvery === 0) {
        ctx.fillStyle = TEXT4
        ctx.fillText(fmtTC(tick, clipFps), gx + 3, H - 2)
      }
    }
  }

  // Waveform (skip in minimal)
  if (!isMinimal) {
    const waveData = waveform
    ctx.setLineDash([])
    // Bars stay in the gaps: inside a block the only paint is the
    // trackHex + '12' / '22' fill (FIXES_R4 #6).
    const blockSpans = Array.from({ length: numTracks }, () => [])
    if (!isNeon) {
      for (const sub of subtitles) {
        if (sub.hidden) continue
        const tr = charMap[sub.character || ''] ?? 0
        blockSpans[tr]?.push([cursor_x + (sub.start - t) * pxSec, cursor_x + (sub.end - t) * pxSec])
      }
    }
    const inBlock = (track, x) => blockSpans[track].some(([l, r]) => x + 1.5 >= l && x <= r)

    for (let track = 0; track < numTracks; track++) {
      const trackH = H / numTracks
      const yMid = track * trackH + trackH / 2
      const maxAmp = Math.min(trackH * 0.38, WAVE_MAX_AMP)
      const color = TRACK_COLORS[track % TRACK_COLORS.length]
      ctx.globalAlpha = trackAlpha(track, focusTrack)

      if (waveData && waveData.samples.length > 0) {
        const { samples, duration: wavDur } = waveData
        const timePerSample = wavDur / samples.length
        if (isNeon) {
          ctx.strokeStyle = color.label
          ctx.lineWidth = 1.2
          ctx.shadowColor = color.label
          ctx.shadowBlur = 8
          ctx.beginPath()
          let started = false
          for (let si = 0; si < samples.length; si++) {
            const sampleTime = si * timePerSample
            const sx = cursor_x + (sampleTime - t) * pxSec
            if (sx < 0 || sx > W) { started = false; continue }
            const v = samples[si] * 2 - 1
            const amp = Math.sign(v) * Math.pow(Math.abs(v), 0.6) * maxAmp
            if (!started) { ctx.moveTo(sx, yMid + amp); started = true } else { ctx.lineTo(sx, yMid + amp) }
          }
          ctx.stroke()
          ctx.shadowBlur = 0
        } else {
          ctx.fillStyle = color.bg.replace('0.10', '0.22')
          for (let si = 0; si < samples.length; si++) {
            const sampleTime = si * timePerSample
            const sx = Math.round(cursor_x + (sampleTime - t) * pxSec)
            if (sx < 0 || sx > W || inBlock(track, sx)) continue
            const amp = Math.max(1, Math.pow(samples[si], 0.5) * maxAmp)
            ctx.fillRect(sx, yMid - amp, 1.5, amp * 2)
          }
        }
      } else {
        // Synthetic animated sine wave fallback
        if (isNeon) {
          ctx.strokeStyle = color.label
          ctx.lineWidth = 1.2
          ctx.shadowColor = color.label
          ctx.shadowBlur = 8
          ctx.beginPath()
          let started = false
          for (let px = 0; px <= W; px += 2) {
            const sampleT = (px - cursor_x) / pxSec + t
            const amp = (
              Math.sin(sampleT * 7 + track * 1.3) * 0.6 +
              Math.sin(sampleT * 23 + track * 0.7) * 0.3 +
              Math.sin(sampleT * 3) * 0.1
            ) * maxAmp
            if (!started) { ctx.moveTo(px, yMid + amp); started = true } else { ctx.lineTo(px, yMid + amp) }
          }
          ctx.stroke()
          ctx.shadowBlur = 0
        } else {
          ctx.fillStyle = color.bg.replace('0.10', '0.22')
          for (let px = 0; px <= W; px += 2) {
            const sampleT = (px - cursor_x) / pxSec + t
            const v = Math.abs(
              Math.sin(sampleT * 7 + track * 1.3) * 0.6 +
              Math.sin(sampleT * 23 + track * 0.7) * 0.3 +
              Math.sin(sampleT * 3) * 0.1
            )
            const amp = Math.max(1, v * maxAmp)
            if (inBlock(track, px)) continue
            ctx.fillRect(px, yMid - amp, 1.5, amp * 2)
          }
        }
      }
    }
  }

  ctx.globalAlpha = 1

  // Onset markers (snap targets from waveform analysis)
  if (onsets && onsets.length) {
    const tStartView = t - cursor_x / pxSec
    const tEndView = t + (W - cursor_x) / pxSec
    ctx.fillStyle = 'rgba(100,230,200,0.35)'
    for (const o of onsets) {
      if (o < tStartView || o > tEndView) continue
      const ox = cursor_x + (o - t) * pxSec
      ctx.fillRect(ox, 0, 1, 5)
      ctx.fillRect(ox, H - 5, 1, 5)
    }
  }

  // Subtitle blocks + text — single pass, prototype-faithful insets
  // DOUBLAGE_IA_REVIEW §6.2: when header pills filter, dim non-matching subs.
  const _cFilter = charFilter
  const _filterActive = _cFilter && _cFilter.size > 0
  const flags = cachedFlags(subtitles)
  for (let si = 0; si < subtitles.length; si++) {
    const sub = subtitles[si]
    if (sub.hidden) continue
    const trackIdx = charMap[sub.character || ''] ?? 0
    const trackH = H / numTracks
    const yTop = trackIdx * trackH
    const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
    const leftX = cursor_x + (sub.start - t) * pxSec
    const rightX = cursor_x + (sub.end - t) * pxSec
    if (rightX < -10 || leftX > W + 10) continue
    const isActive = t >= sub.start && t <= sub.end
    const bx = Math.max(0, leftX)
    const bw = Math.min(W, rightX) - bx
    // Focus wins over the pill filter's dim (a soloed pill passes focusChar).
    const subAlpha = focusTrack != null
      ? trackAlpha(trackIdx, focusTrack)
      : (_filterActive && !_cFilter.has(sub.character || '') ? 0.15 : 1)
    const _dimmed = subAlpha < 1
    if (_dimmed) ctx.globalAlpha = subAlpha

    // Block fill — reference BandCanvas: tinted fill + 2.5px left bar, no outline.
    if (isMinimal) {
      ctx.fillStyle = color.hex + (isActive ? '88' : '44')
      ctx.fillRect(bx, yTop + trackH - 3, bw, 2)
    } else if (isNeon) {
      ctx.strokeStyle = color.hex + (isActive ? 'cc' : '66')
      ctx.lineWidth = 1
      ctx.setLineDash([])
      if (isActive) { ctx.shadowColor = color.hex; ctx.shadowBlur = 8 }
      ctx.strokeRect(leftX + 1, yTop + 4, rightX - leftX - 2, trackH - 8)
      ctx.shadowBlur = 0
    } else {
      ctx.fillStyle = color.hex + (isActive ? '22' : '12'); ctx.fillRect(leftX, yTop + 3, rightX - leftX, trackH - 6)
      ctx.fillStyle = color.hex; ctx.fillRect(leftX, yTop + 3, 2.5, trackH - 6)
    }

    // Text line — fixed font size; wedges + détection signs hang off it.
    const yMid = yTop + trackH / 2 + (brFont === 'cursive' ? 2 : 0)

    // Per-word text — each word fills its own time-block [start, end]:
    // squeezed to fit, stretch capped at 1.2 (held words sit left-aligned
    // with a trailing gap). No / stale word data → whole text as one word.
    if (sub.text) {
      const isReact = sub.text.startsWith('(')
      // Half glyph height: signs sit SIGN_GAP above / below it.
      const glyphHalf = brFontPx(brFont, fontScale, isReact) * 0.45
      ctx.font = brCanvasFont(brFont, fontScale, isReact)
      // Expose the resolved BR font on the canvas so hit-test helpers
      // (hitTestLetter for click-letter détection) measure glyphs in the
      // same font without redoing the resolution.
      if (canvas && !isReact) canvas._brFontResolved = ctx.font
      ctx.textBaseline = 'middle'

      const words = (wordByWord ? validWords(sub) : null)
        || [{ w: sub.text, start: sub.start, end: sub.end }]

      for (const wd of words) {
        if (!wd.w) continue
        const wtext = wd.w + ' '  // trailing space keeps words separated
        const wLeft = cursor_x + (wd.start - t) * pxSec
        const wRight = cursor_x + (wd.end - t) * pxSec
        if (wRight < -10 || wLeft > W + 10) continue
        const wActive = t >= wd.start && t <= wd.end

        const naturalW = ctx.measureText(wtext).width
        let scaleX = naturalW > 0 ? (wRight - wLeft) / naturalW : 1
        scaleX = Math.max(0.05, Math.min(scaleX, 1.2))

        // Word width ≤ block width by construction → never overflows.
        const wbx = Math.max(0, wLeft)
        const wbw = Math.min(W, wRight) - wbx
        if (wbw <= 0) continue

        if (isNeon) { ctx.shadowColor = color.hex; ctx.shadowBlur = wActive ? 6 : 2 }
        else ctx.shadowBlur = 0

        ctx.save()
        ctx.beginPath()
        ctx.rect(wbx, yTop, wbw, trackH)
        ctx.clip()
        ctx.translate(wLeft, yMid)
        ctx.scale(scaleX, 1)
        const baseFill = isReact
          ? color.hex + (wActive ? 'ff' : 'aa')
          : (wActive ? '#fff' : 'rgba(255,255,255,.42)')
        const segs = wtext.split(/(\*)/)
        let curX = 0
        for (const seg of segs) {
          if (seg === '*') {
            ctx.fillStyle = wActive ? '#7ec0ff' : 'rgba(126,192,255,0.72)'
            ctx.fillText('○', curX, 0)
          } else {
            ctx.fillStyle = baseFill
            ctx.fillText(seg, curX, 0)
          }
          curX += ctx.measureText(seg).width
        }
        ctx.restore()
        ctx.shadowBlur = 0

        // ── Détection signs — graphite, pinned to letter x-positions ──
        // Drawn AFTER the glyphs (so they sit visually on top), inside the
        // same per-word block so x scales with the letter compression.
        const det = detection
        if (det.layer) {
          const signs = resolveSigns(wd, detectionAuto)
          if (signs.length) {
            ctx.save()
            const detFill = wActive ? SIGN_COLOR : SIGN_COLOR_INACTIVE
            ctx.strokeStyle = detFill
            ctx.fillStyle = detFill
            for (const sign of signs) {
              if (!det[sign.type]) continue
              // Char x: measure unscaled substring then scale to match the
              // squeezed/stretched letter position.
              const prefix = wtext.slice(0, Math.max(0, sign.i))
              const charX0 = wLeft + ctx.measureText(prefix).width * scaleX
              const ch = wtext[sign.i] || ''
              const charW = ctx.measureText(ch).width * scaleX
              // labiale spans its own [t0,t1] — independent of letter
              // stretch (it's frame-anchored to lip closure). Other types
              // sit under the letter at its own width.
              if (sign.type === 'labiale') {
                const lx = cursor_x + (sign.t0 - t) * pxSec
                const rx = cursor_x + (sign.t1 - t) * pxSec
                if (rx > 0 && lx < W) {
                  ctx.lineWidth = 2.4
                  ctx.setLineDash([])
                  ctx.beginPath()
                  const sy = yMid + glyphHalf + SIGN_GAP + 1.2
                  ctx.moveTo(Math.max(0, lx), sy)
                  ctx.lineTo(Math.min(W, rx), sy)
                  ctx.stroke()
                }
              } else if (sign.type === 'semi') {
                ctx.lineWidth = 1.6
                ctx.setLineDash([3, 2])
                ctx.beginPath()
                const sy = yMid + glyphHalf + SIGN_GAP + 0.8
                ctx.moveTo(charX0, sy)
                ctx.lineTo(charX0 + charW, sy)
                ctx.stroke()
                ctx.setLineDash([])
              } else if (sign.type === 'fricative') {
                const cx0 = charX0 + charW / 2
                const r = SIGN_PX / 2
                const sy = yMid - glyphHalf - SIGN_GAP - r
                ctx.lineWidth = 1.4
                ctx.beginPath()
                ctx.moveTo(cx0 - r, sy + r)
                ctx.lineTo(cx0, sy)
                ctx.lineTo(cx0 + r, sy + r)
                ctx.stroke()
              } else if (sign.type === 'arrondie') {
                const cx0 = charX0 + charW / 2
                const r = SIGN_PX / 2 - 1
                const sy = yMid - glyphHalf - SIGN_GAP - r - 0.8
                ctx.lineWidth = 1.6
                ctx.beginPath()
                ctx.arc(cx0, sy, r, 0, Math.PI * 2)
                ctx.stroke()
              } else if (sign.type === 'ouverte') {
                const cx0 = charX0 + charW / 2
                const r = SIGN_PX / 2
                const sy = yMid - glyphHalf - SIGN_GAP + r * 0.45
                ctx.lineWidth = 1.4
                ctx.beginPath()
                ctx.arc(cx0, sy, r, Math.PI * 1.15, Math.PI * 1.85)
                ctx.stroke()
              }
            }
            ctx.restore()
          }
        }
      }
    }

    // ── Flag underline — reference BandCanvas: 2px bar INSIDE the block
    // (y0 + trackH − 4), one per flagged line (same rule as the list).
    const ulColor = isMinimal ? null : underlineColor(flags[si]?.level, accent)
    if (ulColor) {
      const mx0 = Math.max(0, leftX + 2)
      const mx1 = Math.min(W, rightX - 2)
      if (mx1 > mx0) {
        ctx.fillStyle = ulColor
        ctx.fillRect(mx0, yTop + trackH - 4, mx1 - mx0, 2)
      }
    }

    // ── Line flags: off / dos / ambiance / plan_cut + début/fin wedges ──
    const detTog = detection
    const onScreenL = Math.max(0, leftX)
    const onScreenR = Math.min(W, rightX)
    if (onScreenR > onScreenL) {
      if (sub.off || sub.dos) {
        const sy = yTop + trackH - 1.5
        ctx.strokeStyle = color.hex
        ctx.lineWidth = 1.4
        ctx.setLineDash(sub.dos ? [2, 3] : [])
        ctx.beginPath()
        ctx.moveTo(onScreenL, sy)
        ctx.lineTo(onScreenR, sy)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
    // Avatar dot — reference BandCanvas: 16px circle in the track colour
    // with the character's initial, top-left of the block.
    const hasAvatar = rightX - leftX > 26 && leftX > -20
    const ax = Math.max(leftX, 0) + 7
    const ay = yTop + 9
    if (hasAvatar) {
      ctx.beginPath(); ctx.arc(ax + 7, ay + 7, 8, 0, 7); ctx.fillStyle = isActive ? color.hex : color.hex + 'aa'; ctx.fill()
      ctx.fillStyle = '#0b0b0d'; ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText((sub.character || '?')[0].toUpperCase(), ax + 7, ay + 8); ctx.textAlign = 'left'
    }
    // Note marker — accent dot, badged on the avatar (else top-left of the block).
    if (sub.note && onScreenR > onScreenL) {
      const nx = hasAvatar ? ax + 14 : Math.min(onScreenL + 7, W - 4)
      const ny = hasAvatar ? ay : yTop + 7
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(nx, ny, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // début/fin wedges at the line's own boundaries — small in-track colour
    if (detTog.startEnd) {
      const half = WEDGE_H / 2
      ctx.fillStyle = withAlpha(color.hex, isActive ? 1 : 0.55)
      if (leftX > 0 && leftX < W) {
        ctx.beginPath()
        ctx.moveTo(leftX, yMid - half)
        ctx.lineTo(leftX + WEDGE_D, yMid)
        ctx.lineTo(leftX, yMid + half)
        ctx.closePath()
        ctx.fill()
      }
      if (rightX > 0 && rightX < W) {
        ctx.beginPath()
        ctx.moveTo(rightX, yMid - half)
        ctx.lineTo(rightX - WEDGE_D, yMid)
        ctx.lineTo(rightX, yMid + half)
        ctx.closePath()
        ctx.fill()
      }
    }
    // plan_cut — dashed vertical full-height + PLAN tag
    if (typeof sub.plan_cut === 'number') {
      const px = cursor_x + (sub.plan_cut - t) * pxSec
      if (px >= 0 && px <= W) {
        ctx.strokeStyle = '#7ec0ff'
        ctx.lineWidth = 1.2
        ctx.setLineDash([4, 3])
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#7ec0ff'
        ctx.font = 'bold 9px "JetBrains Mono", monospace'
        ctx.textBaseline = 'top'
        ctx.fillText('PLAN', px + 3, 16)
      }
    }
    // ambiance — start ▸ + end ◂ arrows in muted track colour
    if (sub.ambiance) {
      ctx.fillStyle = withAlpha(color.hex, 0.7)
      ctx.font = '12px sans-serif'
      ctx.textBaseline = 'middle'
      if (leftX > 0 && leftX < W) ctx.fillText('▸', leftX + 2, yMid)
      if (rightX > 0 && rightX < W) ctx.fillText('◂', rightX - 12, yMid)
    }
    if (_dimmed) ctx.globalAlpha = 1
  }

  // ── Calibration marks: START −3s · BIP 1000 Hz −2s · PI 0s ──
  // Anchored to clip time 0 (= PI / première image). Band already scrolls
  // into negative time when the user seeks past 0.
  const calibs = [
    { time: -3.0, label: 'START', kind: 'start' },
    { time: -2.0, label: 'BIP', kind: 'bip' },
    { time:  0.0, label: 'PI', kind: 'pi' },
  ]
  ctx.font = '700 8px "JetBrains Mono", monospace'
  ctx.textBaseline = 'top'
  for (const cal of calibs) {
    const cx = cursor_x + (cal.time - t) * pxSec
    if (cx < -50 || cx > W + 50) continue
    ctx.setLineDash(cal.kind === 'bip' ? [4, 3] : [])
    ctx.lineWidth = cal.kind === 'pi' ? 1.6 : 1.2
    ctx.strokeStyle = cal.kind === 'bip' ? '#7ec0ff'
      : cal.kind === 'pi' ? '#ffffff'
      : 'rgba(255,255,255,0.7)'
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke()
    if (cal.kind === 'start') {
      // ✕ across the line
      const sz = 6
      ctx.beginPath()
      ctx.moveTo(cx - sz, H / 2 - sz); ctx.lineTo(cx + sz, H / 2 + sz)
      ctx.moveTo(cx + sz, H / 2 - sz); ctx.lineTo(cx - sz, H / 2 + sz)
      ctx.stroke()
    }
    ctx.setLineDash([])
    // PI sits on the play cursor at t≈0: offset its label off the line and
    // skip it while the playhead triangle is within 30px.
    if (cal.kind === 'pi' && Math.abs(cx - cursor_x) < 30) continue
    ctx.fillStyle = cal.kind === 'bip' ? '#7ec0ff' : '#fff'
    ctx.fillText(cal.label, cx + (cal.kind === 'pi' ? 6 : 3), 3)
  }

  // ── Scene cuts — dashed blue verticals (changement de plan, mirror plan_cut) ──
  const scenesNow = sceneCuts
  if (scenesNow && scenesNow.length) {
    ctx.strokeStyle = '#7ec0ff'
    ctx.lineWidth = 1.2
    ctx.setLineDash([4, 3])
    for (const sc of scenesNow) {
      const sx = cursor_x + (sc - t) * pxSec
      if (sx < -2 || sx > W + 2) continue
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke()
    }
    ctx.setLineDash([])
  }

  // ── Boucles — dashed verticals with B{n} cap ──
  const bouclesNow = boucles
  if (bouclesNow && bouclesNow.length) {
    ctx.font = 'bold 9px "JetBrains Mono", monospace'
    ctx.textBaseline = 'top'
    for (const b of bouclesNow) {
      for (const [edge, time] of [['start', b.start], ['end', b.end]]) {
        const bx = cursor_x + (time - t) * pxSec
        if (bx < -20 || bx > W + 20) continue
        ctx.strokeStyle = withAlpha(accent, 0.55)
        ctx.lineWidth = 1.2
        ctx.setLineDash([6, 4])
        ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, H); ctx.stroke()
        ctx.setLineDash([])
        if (edge === 'start') {
          const cap = `B${b.number}`
          const cw = ctx.measureText(cap).width + 8
          ctx.fillStyle = withAlpha(accent, 0.18)
          ctx.fillRect(bx, 0, cw, 13)
          ctx.fillStyle = accent
          ctx.fillText(cap, bx + 4, 2)
        }
      }
    }
  }

  // Sticky track labels — black chip + 3px colored left edge
  for (let tr = 0; tr < numTracks; tr++) {
    const char = Object.entries(charMap).find(([, i]) => i === tr)?.[0] || ''
    const color = TRACK_COLORS[tr % TRACK_COLORS.length]
    const trackH = H / numTracks
    const label = char.toUpperCase() || '(DEF)'
    ctx.globalAlpha = trackAlpha(tr, focusTrack)
    ctx.font = 'bold 10px "IBM Plex Sans", sans-serif'
    const lw = ctx.measureText(label).width
    const ly = tr * trackH + 4
    ctx.fillStyle = 'rgba(8,8,10,0.85)'
    ctx.fillRect(0, ly, lw + 14, 16)
    ctx.fillStyle = color.hex
    ctx.fillRect(0, ly, 3, 16)
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 8, ly + 8)
  }
  ctx.globalAlpha = 1

  // Loop region overlay + enforcement
  const lr = loopRegion
  if (lr) {
    const lx = cursor_x + (lr.start - t) * pxSec
    const rx = cursor_x + (lr.end - t) * pxSec
    if (rx > 0 && lx < W) {
      ctx.fillStyle = withAlpha(accent, 0.10)
      ctx.fillRect(Math.max(0, lx), 0, Math.min(W, rx) - Math.max(0, lx), H)
      ctx.strokeStyle = withAlpha(accent, 0.6)
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      if (lx >= 0 && lx <= W) { ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke() }
      if (rx >= 0 && rx <= W) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, H); ctx.stroke() }
      ctx.setLineDash([])
    }
  }

  // Cursor line
  ctx.setLineDash([])
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(cursor_x, 0); ctx.lineTo(cursor_x, H); ctx.stroke()
  // Cursor triangle (top)
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.moveTo(cursor_x - 7, 0)
  ctx.lineTo(cursor_x + 7, 0)
  ctx.lineTo(cursor_x, 9)
  ctx.closePath()
  ctx.fill()

  // Hover scrub indicator
  const hov = hover
  if (hov && !dragging) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(hov.x, 0); ctx.lineTo(hov.x, H); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    const lbl = fmtClock(Math.max(0, hov.time))
    ctx.font = '10px monospace'
    const lblW = ctx.measureText(lbl).width + 8
    ctx.fillRect(Math.min(W - lblW, hov.x + 4), 2, lblW, 14)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'top'
    ctx.fillText(lbl, Math.min(W - lblW, hov.x + 4) + 4, 4)
  }}
