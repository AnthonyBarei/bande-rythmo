import React, { useRef, useEffect, useCallback } from 'react'
import { TRACK_HEXES as TRACK_COLORS } from '../config/tracks'

// Full-clip navigation timeline (reference screen-editor.jsx › TimelineNav look).
// Shows the WHOLE clip at once (the BR canvas only shows a moving window):
//   waveform · réplique blocks per track colour · dashed boucle bands ·
//   scene cuts · the visible-window bracket · the white playhead.
// Click / drag anywhere to seek.

// Canvas can't read CSS variables — resolve them (accent is user-swappable).
function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch { return fallback }
}
// `hex + 'aa'` from the reference; non-hex colours fall back to the plain colour.
const withAA = (hex, aa) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + aa : hex)

export default function BRTimeline({
  duration = 0,
  currentTime = 0,
  boucles = [],
  waveform = null,        // { samples: number[], duration, onsets: number[] } | null
  sceneCuts = [],         // number[] timecodes
  subtitles = [],         // [{ start, end, character, hidden? }] — hidden ones not drawn
  charMap = {},           // character → track index
  viewStart = null,       // visible BR window start (s) — bracket
  viewEnd = null,         // visible BR window end (s)
  onSeek,
  height = 56,
  labelRowH = 0,          // px reserved at the top for overlay labels (bracket starts below)
}) {
  const canvasRef = useRef(null)
  const draggingRef = useRef(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.offsetWidth
    const cssH = canvas.offsetHeight
    if (cssW > 0 && canvas.width !== Math.round(cssW * dpr)) canvas.width = Math.round(cssW * dpr)
    if (cssH > 0 && canvas.height !== Math.round(cssH * dpr)) canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const dur = duration || waveform?.duration || 1
    const tToX = t => (t / dur) * w
    const accent = cssVar('--accent', '#F5C518')
    ctx.clearRect(0, 0, w, h)

    // waveform
    if (waveform?.samples?.length) {
      const samples = waveform.samples
      const n = samples.length
      const wavDur = waveform.duration || dur
      // Normalise to the loudest sample so peaks reach the reference ±15px.
      const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v || 0)), 0) || 1
      ctx.fillStyle = cssVar('--border3', '#3f3f4a')
      for (let x = 0; x < w; x += 2) {
        const si = Math.min(n - 1, Math.floor(((x / w) * dur / wavDur) * n))
        const a = (Math.abs(samples[si] || 0) / peak) * 14 + 1
        ctx.fillRect(x, h / 2 - a, 1.2, a * 2)
      }
    }

    // subtitle blocks
    subtitles.forEach(s => {
      if (s.hidden) return
      const tr = charMap[s.character || ''] ?? 0
      const hex = TRACK_COLORS[tr % TRACK_COLORS.length]
      ctx.fillStyle = hex + '33'
      ctx.fillRect(tToX(s.start), h - 10, Math.max(1, tToX(s.end) - tToX(s.start)), 6)
    })

    // boucle bands
    boucles.forEach(b => {
      const x0 = tToX(b.start)
      const bw = tToX(b.end) - x0
      ctx.fillStyle = withAA(accent, '18'); ctx.fillRect(x0, 0, bw, h)
      ctx.strokeStyle = withAA(accent, '88'); ctx.lineWidth = 1; ctx.setLineDash([3, 3])
      ctx.strokeRect(x0, 1, bw, h - 2); ctx.setLineDash([])
    })

    // scene cuts (changements de plan)
    ctx.strokeStyle = 'rgba(126,192,255,0.65)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 2])
    sceneCuts.forEach(t => {
      const x = tToX(t)
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke()
    })
    ctx.setLineDash([])

    // visible-window bracket (what the BR canvas currently shows) — outline
    // only, starting below the label row so it never boxes the overlay labels.
    if (viewStart != null && viewEnd != null && viewEnd > viewStart) {
      const x0 = Math.max(0, tToX(viewStart))
      const x1 = Math.min(w, tToX(viewEnd))
      const top = Math.min(labelRowH, h - 2)
      ctx.strokeStyle = cssVar('--border3', '#3f3f4a')
      ctx.lineWidth = 1
      ctx.strokeRect(x0 + 0.5, top + 0.5, (x1 - x0) - 1, h - top - 1)
    }

    // playhead
    const px = tToX(currentTime)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(px - 5, 0); ctx.lineTo(px + 5, 0); ctx.lineTo(px, 6); ctx.fill()
  }, [duration, currentTime, boucles, waveform, sceneCuts, subtitles, charMap, viewStart, viewEnd, labelRowH])

  useEffect(() => { draw() }, [draw])

  // Redraw on container resize.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !window.ResizeObserver) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  const seekFromEvent = useCallback(e => {
    const canvas = canvasRef.current
    if (!canvas || !onSeek) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const dur = duration || waveform?.duration || 1
    onSeek((x / rect.width) * dur)
  }, [duration, waveform, onSeek])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height, display: 'block', cursor: 'pointer' }}
      onMouseDown={e => { draggingRef.current = true; seekFromEvent(e) }}
      onMouseMove={e => { if (draggingRef.current) seekFromEvent(e) }}
      onMouseUp={() => { draggingRef.current = false }}
      onMouseLeave={() => { draggingRef.current = false }}
    />
  )
}
