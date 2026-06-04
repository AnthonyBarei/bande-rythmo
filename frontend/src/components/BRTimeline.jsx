import React, { useRef, useEffect, useCallback } from 'react'

// Full-clip navigation timeline, drawn below the scrolling BR canvas.
// Shows the WHOLE clip at once (the BR canvas only shows a moving window):
//   waveform · subtitle ticks per track · boucle bands · scene cuts ·
//   the visible-window bracket · the playhead.
// Click / drag anywhere to seek.

const TRACK_COLORS = ['#f5c518', '#7ec0ff', '#f08aaf', '#7ed4a8']

export default function BRTimeline({
  duration = 0,
  currentTime = 0,
  boucles = [],
  waveform = null,        // { samples: number[], duration, onsets: number[] } | null
  sceneCuts = [],         // number[] timecodes
  subtitles = [],         // [{ start, end, character }]
  charMap = {},           // character → track index
  viewStart = null,       // visible BR window start (s) — bracket
  viewEnd = null,         // visible BR window end (s)
  onSeek,
  height = 56,
}) {
  const canvasRef = useRef(null)
  const draggingRef = useRef(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cssW = canvas.offsetWidth
    const cssH = canvas.offsetHeight
    if (cssW > 0 && canvas.width !== cssW) canvas.width = cssW
    if (cssH > 0 && canvas.height !== cssH) canvas.height = cssH
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const dur = duration || waveform?.duration || 1
    const tToX = t => (t / dur) * W

    // Background
    ctx.fillStyle = '#0a0a0c'
    ctx.fillRect(0, 0, W, H)

    // ── Boucle bands (behind everything) ──
    boucles.forEach((b, i) => {
      const x0 = tToX(b.start)
      const x1 = tToX(b.end)
      ctx.fillStyle = i % 2 === 0 ? 'rgba(245,197,24,0.05)' : 'rgba(245,197,24,0.09)'
      ctx.fillRect(x0, 0, x1 - x0, H)
      // dashed left border + cap label
      ctx.strokeStyle = 'rgba(245,197,24,0.45)'
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x0 + 0.5, 0)
      ctx.lineTo(x0 + 0.5, H)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(245,197,24,0.85)'
      ctx.font = 'bold 9px "IBM Plex Sans", sans-serif'
      ctx.fillText(`B${b.number ?? i + 1}`, x0 + 3, 10)
    })

    // ── Waveform (mirrored around vertical center) ──
    if (waveform?.samples?.length) {
      const samples = waveform.samples
      const n = samples.length
      const midY = H / 2
      const amp = H * 0.42
      ctx.strokeStyle = 'rgba(126,192,255,0.30)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < W; x++) {
        const si = Math.min(n - 1, Math.floor((x / W) * n))
        const v = Math.abs(samples[si] || 0)
        ctx.moveTo(x + 0.5, midY - v * amp)
        ctx.lineTo(x + 0.5, midY + v * amp)
      }
      ctx.stroke()
    }

    // ── Subtitle ticks per track (thin colored marks at each réplique start) ──
    subtitles.forEach(s => {
      const tr = charMap[s.character || ''] ?? 0
      const color = TRACK_COLORS[tr % TRACK_COLORS.length]
      const x0 = tToX(s.start)
      const x1 = tToX(s.end)
      const bandH = 4
      const y = H - 8 - (tr % TRACK_COLORS.length) * (bandH + 1)
      ctx.fillStyle = color + '99'
      ctx.fillRect(x0, y, Math.max(1, x1 - x0), bandH)
    })

    // ── Scene cuts (vertical info lines) ──
    ctx.strokeStyle = 'rgba(120,160,255,0.55)'
    ctx.lineWidth = 1
    sceneCuts.forEach(t => {
      const x = tToX(t)
      ctx.beginPath()
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, H)
      ctx.stroke()
    })

    // ── Visible-window bracket (what the BR canvas currently shows) ──
    if (viewStart != null && viewEnd != null && viewEnd > viewStart) {
      const x0 = Math.max(0, tToX(viewStart))
      const x1 = Math.min(W, tToX(viewEnd))
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fillRect(x0, 0, x1 - x0, H)
      ctx.strokeStyle = 'rgba(255,255,255,0.30)'
      ctx.lineWidth = 1
      ctx.strokeRect(x0 + 0.5, 0.5, (x1 - x0) - 1, H - 1)
    }

    // ── Playhead ──
    const px = tToX(currentTime)
    ctx.strokeStyle = '#f5c518'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(px + 0.5, 0)
    ctx.lineTo(px + 0.5, H)
    ctx.stroke()
    // head handle
    ctx.fillStyle = '#f5c518'
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px - 4, 0)
    ctx.lineTo(px, 6)
    ctx.lineTo(px + 4, 0)
    ctx.closePath()
    ctx.fill()
  }, [duration, currentTime, boucles, waveform, sceneCuts, subtitles, charMap, viewStart, viewEnd])

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
    <div style={{ flexShrink: 0, height, borderTop: '1px solid var(--border)', background: '#0a0a0c' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'pointer' }}
        onMouseDown={e => { draggingRef.current = true; seekFromEvent(e) }}
        onMouseMove={e => { if (draggingRef.current) seekFromEvent(e) }}
        onMouseUp={() => { draggingRef.current = false }}
        onMouseLeave={() => { draggingRef.current = false }}
      />
    </div>
  )
}
