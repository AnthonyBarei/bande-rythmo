import { CURSOR_X_RATIO, FONT_BR, validWords } from './bandRender'

// Band hit-testing — same geometry as drawBand (CSS pixels, cursor at
// CURSOR_X_RATIO × W, pxPerSec scroll).

// Pointer → band coordinates at band time `t`.
export function bandCoords(canvas, e, t, pxSec) {
  if (!canvas) return null
  // CSS pixels — same space as the draw loop (backing store is DPR-scaled).
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const W = rect.width
  const H = rect.height
  const cursor_x = W * CURSOR_X_RATIO
  return { x, y, W, H, t, pxSec, cursor_x, time: t + (x - cursor_x) / pxSec }
}

const trackAt = (c, n) => Math.min(n - 1, Math.max(0, Math.floor(c.y / (c.H / n))))

// Réplique block under the pointer: { ...coords, trackIdx, subIdx, zone }
// with zone 'left' / 'right' (6px edges) or 'mid'; subIdx -1 = empty band.
export function hitTestBand(c, subs, cMap, n) {
  if (!c) return null
  const trackIdx = trackAt(c, n)
  const EDGE = 6
  let bestIdx = -1, bestZone = null
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i]
    if (sub.hidden) continue
    const sTrack = cMap[sub.character || ''] ?? 0
    if (sTrack !== trackIdx) continue
    const left = c.cursor_x + (sub.start - c.t) * c.pxSec
    const right = c.cursor_x + (sub.end - c.t) * c.pxSec
    if (c.x < left - EDGE || c.x > right + EDGE) continue
    bestIdx = i
    if (c.x < left + EDGE) bestZone = 'left'
    else if (c.x > right - EDGE) bestZone = 'right'
    else bestZone = 'mid'
    break
  }
  return { ...c, trackIdx, subIdx: bestIdx, zone: bestZone }
}

// DOUBLAGE_IA_REVIEW §6 — the letter under the pointer, to cycle its detection
// sign. Returns { subIdx, wordIdx, charIdx } or null. Mirrors the draw loop
// math (word stretch, font resolved by drawBand on the canvas).
export function hitTestBandLetter(canvas, c, subs, cMap, n, wordByWord) {
  if (!c || !canvas) return null
  const trackIdx = trackAt(c, n)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.save()
  // Same font as draw loop — see drawing pass for the FONT_BR / brFont scaling.
  const baseFont = canvas._brFontResolved || FONT_BR
  ctx.font = baseFont
  let result = null
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i]
    if (sub.hidden) continue
    const sTrack = cMap[sub.character || ''] ?? 0
    if (sTrack !== trackIdx) continue
    const left = c.cursor_x + (sub.start - c.t) * c.pxSec
    const right = c.cursor_x + (sub.end - c.t) * c.pxSec
    if (c.x < left || c.x > right) continue
    const words = wordByWord ? validWords(sub) : null
    if (!words) continue
    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const wd = words[wIdx]
      if (!wd.w) continue
      const wtext = wd.w + ' '
      const wLeft = c.cursor_x + (wd.start - c.t) * c.pxSec
      const wRight = c.cursor_x + (wd.end - c.t) * c.pxSec
      if (c.x < wLeft || c.x > wRight) continue
      const naturalW = ctx.measureText(wtext).width
      let scaleX = naturalW > 0 ? (wRight - wLeft) / naturalW : 1
      scaleX = Math.max(0.05, Math.min(scaleX, 1.2))
      const localX = (c.x - wLeft) / Math.max(0.0001, scaleX)
      let acc = 0
      for (let chIdx = 0; chIdx < wd.w.length; chIdx++) {
        const ch = wd.w[chIdx]
        const cw = ctx.measureText(ch).width
        if (localX >= acc && localX <= acc + cw) {
          result = { subIdx: i, wordIdx: wIdx, charIdx: chIdx }
          break
        }
        acc += cw
      }
      if (result) break
    }
    if (result) break
  }
  ctx.restore()
  return result
}
