import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import SubtitleEditor from './SubtitleEditor'
import ExportPanel from './ExportPanel'

// BR canvas — constant-speed scrolling
// Cursor is at CURSOR_X_RATIO * W from left
// At t=sub.start the LEFT EDGE of the text is exactly at the cursor
// Text scrolls left at pxPerSec pixels/second as time passes
const CURSOR_X_RATIO = 0.30
const H_TRACK = 64
const BR_CONTROLS_H = 32
const FONT_BR = 'bold 20px "Courier New", monospace'
const FONT_LABEL = 'bold 9px sans-serif'

// Character track colors (background tint + text color)
const TRACK_COLORS = [
  { bg: 'rgba(245, 197, 24,0.10)',  text: '#f5c518',  label: '#f5c518' },
  { bg: 'rgba(80,180,255,0.10)', text: '#5bf',  label: '#5bf' },
  { bg: 'rgba(255,100,160,0.10)',text: '#f6a',  label: '#f6a' },
  { bg: 'rgba(100,230,160,0.10)',text: '#6eb',  label: '#6eb' },
]

const REACTION_TAGS = ['rire', 'souffle', 'cri', 'chuchoté', 'pleure', 'soupir', 'grogne', 'gémit', 'ahane', 'bégaie']
const RESP_TAGS = ['inspire', 'expire', 'soupire', 'halète', 'souffle', 'retient son souffle', 'respire fort']

const Ic = ({ d, fill, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
)

const ICONS = {
  play:     'M7 5l12 7-12 7V5z',
  pause:    <><rect x="7" y="5" width="3.5" height="14" rx="0.5" /><rect x="13.5" y="5" width="3.5" height="14" rx="0.5" /></>,
  start:    <><path d="M19 5l-9 7 9 7V5z"/><line x1="6" y1="5" x2="6" y2="19"/></>,
  end:      <><path d="M5 5l9 7-9 7V5z"/><line x1="18" y1="5" x2="18" y2="19"/></>,
  prev:     <polygon points="17 6 7 12 17 18 17 6" fill="currentColor" stroke="none" />,
  next:     <polygon points="7 6 17 12 7 18 7 6" fill="currentColor" stroke="none" />,
  rec:      <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />,
  mic:      <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></>,
  scissors: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></>,
  breath:   <><path d="M4 14c0-3 2-5 5-5s3 3 6 3 5-2 5-5"/><circle cx="9" cy="14" r="2"/><circle cx="15" cy="12" r="2"/></>,
  in:       <><line x1="4" y1="12" x2="14" y2="12"/><polyline points="11 8 15 12 11 16"/><line x1="19" y1="5" x2="19" y2="19"/></>,
  out:      <><line x1="20" y1="12" x2="10" y2="12"/><polyline points="13 8 9 12 13 16"/><line x1="5" y1="5" x2="5" y2="19"/></>,
  trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>,
  lockOpen: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018-0"/></>,
  lock:     <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></>,
  note:     <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></>,
  loop:     <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></>,
  reactions:<><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></>,
  chevron:  'M6 9l6 6 6-6',
  zoomIn:   <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  zoomOut:  <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>,
}

const fmt = t => {
  if (!t && t !== 0) return '00:00.0'
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(1).padStart(4, '0')
  return `${String(m).padStart(2, '0')}:${s}`
}

const LANGS = [
  { code: 'fr', label: 'FR — Français' },
  { code: 'en', label: 'EN — English' },
  { code: 'es', label: 'ES — Español' },
  { code: 'de', label: 'DE — Deutsch' },
  { code: 'it', label: 'IT — Italiano' },
  { code: 'pt', label: 'PT — Português' },
  { code: 'ja', label: 'JA — 日本語' },
  { code: 'zh', label: 'ZH — 中文' },
  { code: 'ko', label: 'KO — 한국어' },
  { code: 'ru', label: 'RU — Русский' },
  { code: 'ar', label: 'AR — العربية' },
  { code: 'auto', label: '🔍 Auto-détect' },
]

const STATUS = {
  saved:   { text: '✓ Sauvegardé', color: 'var(--success)' },
  saving:  { text: '… Sauvegarde', color: 'var(--text2)' },
  unsaved: { text: '● Non sauvegardé', color: '#f5c518' },
  error:   { text: '✕ Erreur', color: 'var(--danger)' },
}

export default function DubbingWorkspace({ clip, onUpdate, onBack }) {
  const [subtitles, setSubtitles] = useState(clip.subtitles || [])
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [transcribing, setTranscribing] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [toast, setToast] = useState(null)
  const [showExport, setShowExport] = useState(false)
  const [brExporting, setBrExporting] = useState(false)
  const [brOffset, setBrOffset] = useState(0)
  const [pxPerSec, setPxPerSec] = useState(180)
  const [rythmoStyle, setRythmoStyle] = useState('classique')
  const [lang, setLang] = useState('fr')

  const [selectedIdx, setSelectedIdx] = useState(null)
  const [brInPlayer, setBrInPlayer] = useState('play')
  const [sidebarWidth, setSidebarWidth] = useState(370)
  const sidebarDragRef = useRef(null)
  const [brPanelHeight, setBrPanelHeight] = useState(280)
  const [fontScale, setFontScale] = useState(1.0)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editText, setEditText] = useState('')
  const [hoverHint, setHoverHint] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [loopRegion, setLoopRegion] = useState(null)
  const [locked, setLocked] = useState(false)
  const loopRegionRef = useRef(null)
  const lockedRef = useRef(false)
  loopRegionRef.current = loopRegion
  lockedRef.current = locked

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const canvasOverlayRef = useRef(null)
  const rafRef = useRef(null)
  const debounceRef = useRef(null)
  const subtitlesRef = useRef(subtitles)
  const brOffsetRef = useRef(0)
  const pxPerSecRef = useRef(120)
  const rythmoStyleRef = useRef('classique')
  const waveformRef = useRef(null)
  const onsetsRef = useRef(null)
  const dragRef = useRef(null)
  const hoverRef = useRef(null)
  const charMapRef = useRef({})
  const numTracksRef = useRef(1)
  const canvasHRef = useRef(64)
  const saveStatusRef = useRef(saveStatus)
  const brInPlayerRef = useRef('play')
  const playingRef = useRef(false)
  const fontScaleRef = useRef(1.0)
  const exportingRef = useRef(false)
  // Smooth time interpolation: video.currentTime only updates at video fps (e.g. 24fps).
  // Between updates, we interpolate using wall clock so the canvas scrolls at 60fps.
  const interpTimeRef = useRef({ videoTime: 0, wallMs: 0, active: false })
  subtitlesRef.current = subtitles
  brOffsetRef.current = brOffset
  pxPerSecRef.current = pxPerSec
  rythmoStyleRef.current = rythmoStyle
  saveStatusRef.current = saveStatus
  brInPlayerRef.current = brInPlayer
  playingRef.current = playing
  fontScaleRef.current = fontScale

  const segmentUrl = `/${clip.segment_path}`

  const charMap = useMemo(() => {
    const seen = []
    for (const s of subtitles) {
      const c = s.character || ''
      if (!seen.includes(c)) seen.push(c)
    }
    return Object.fromEntries(seen.map((c, i) => [c, i]))
  }, [subtitles])

  const numTracks = Math.max(1, Object.keys(charMap).length)
  const canvasH = Math.min(numTracks * H_TRACK, 200)
  const charList = useMemo(() => Object.keys(charMap), [charMap])
  charMapRef.current = charMap
  numTracksRef.current = numTracks
  canvasHRef.current = canvasH

  const activeSubtitle = useMemo(() => {
    const t = currentTime + brOffset
    return subtitles.find(s => t >= s.start && t <= s.end) || null
  }, [subtitles, currentTime, brOffset])

  // Fetch waveform once on mount
  useEffect(() => {
    fetch(`/api/clips/${clip.clip_id}/waveform?samples=500`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.samples.length) {
          waveformRef.current = data
          onsetsRef.current = data.onsets || []
        }
      })
      .catch(() => {})
  }, [clip.clip_id])

  // BR canvas RAF loop
  useEffect(() => {
    function draw() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!canvas || !video) { rafRef.current = requestAnimationFrame(draw); return }

      const cssW = canvas.offsetWidth
      const cssH = canvas.offsetHeight
      if (!exportingRef.current) {
        if (cssW > 0 && canvas.width !== cssW) canvas.width = cssW
        if (cssH > 0 && canvas.height !== cssH) canvas.height = cssH
      }

      const ctx = canvas.getContext('2d')
      const W = canvas.width
      const H = canvas.height || canvasH
      // Use interpolated time during export so each 60fps canvas frame has a distinct
      // position — prevents bunched-then-jump artifacts from video.currentTime's 24fps steps
      const interp = interpTimeRef.current
      const rawTime = interp.active
        ? interp.videoTime + (performance.now() - interp.wallMs) / 1000
        : video.currentTime
      const t = rawTime + brOffsetRef.current
      const pxSec = pxPerSecRef.current
      const cursor_x = W * CURSOR_X_RATIO
      const style = rythmoStyleRef.current
      const isNeon = style === 'neon'
      const isMinimal = style === 'minimal'

      // Background
      ctx.shadowBlur = 0
      ctx.fillStyle = isNeon ? '#020203' : '#050505'
      ctx.fillRect(0, 0, W, H)

      // Track separators + background tint
      for (let track = 0; track < numTracks; track++) {
        const trackH = H / numTracks
        if (track > 0) {
          ctx.strokeStyle = isMinimal ? '#141414' : '#1a1a1a'
          ctx.lineWidth = 1
          ctx.setLineDash([])
          ctx.beginPath(); ctx.moveTo(0, track * trackH); ctx.lineTo(W, track * trackH); ctx.stroke()
        }
      }

      // Waveform (skip in minimal)
      if (!isMinimal) {
        const waveData = waveformRef.current
        ctx.setLineDash([])

        for (let track = 0; track < numTracks; track++) {
          const trackH = H / numTracks
          const yMid = track * trackH + trackH / 2
          const maxAmp = trackH * 0.38
          const color = TRACK_COLORS[track % TRACK_COLORS.length]

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
                if (sx < 0 || sx > W) continue
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
                ctx.fillRect(px, yMid - amp, 1.5, amp * 2)
              }
            }
          }
        }
      }

      // Onset markers (snap targets from waveform analysis)
      const onsets = onsetsRef.current
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

      // Subtitle background blocks (duration rectangles)
      for (const sub of subtitlesRef.current) {
        const trackIdx = charMap[sub.character || ''] ?? 0
        const trackH = H / numTracks
        const yTop = trackIdx * trackH
        const blockLeft = cursor_x + (sub.start - t) * pxSec
        const blockRight = cursor_x + (sub.end - t) * pxSec
        if (blockRight < 0 || blockLeft > W) continue
        const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
        const bx = Math.max(0, blockLeft)
        const bw = Math.min(W, blockRight) - bx

        if (isMinimal) {
          // 2px underline only
          ctx.fillStyle = color.label.replace(')', ',0.55)').replace('rgb', 'rgba')
          ctx.fillRect(bx, yTop + trackH - 2, bw, 2)
        } else if (isNeon) {
          // Stroke rect outline
          ctx.strokeStyle = color.label.replace(')', ',0.5)').replace('rgb', 'rgba')
          ctx.lineWidth = 1
          ctx.setLineDash([])
          ctx.shadowColor = color.label
          ctx.shadowBlur = 4
          ctx.strokeRect(bx + 0.5, yTop + 1.5, bw - 1, trackH - 3)
          ctx.shadowBlur = 0
        } else {
          // Classique: fill block
          ctx.fillStyle = color.bg
          ctx.fillRect(bx, yTop + 1, bw, trackH - 2)
        }
      }

      // Subtitle text + character chips per block
      for (const sub of subtitlesRef.current) {
        const trackIdx = charMap[sub.character || ''] ?? 0
        const trackH = H / numTracks
        const yTop = trackIdx * trackH
        const yCenter = yTop + trackH / 2
        const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
        const isActive = t >= sub.start && t <= sub.end

        const leftX = cursor_x + (sub.start - t) * pxSec
        const rightX = cursor_x + (sub.end - t) * pxSec
        const blockW = rightX - leftX

        if (rightX < 0 || leftX > W) continue

        // Character avatar circle at left edge of block (only when block left is visible)
        if (sub.character && blockW > 20) {
          const avatarX = Math.max(leftX, 0) + 6
          const avatarY = yTop + 10
          const r = 8
          ctx.beginPath()
          ctx.arc(avatarX + r, avatarY + r, r, 0, Math.PI * 2)
          ctx.fillStyle = isActive ? color.label : color.label.replace(')', ',0.6)').replace('rgb', 'rgba')
          ctx.fill()
          ctx.font = 'bold 9px sans-serif'
          ctx.fillStyle = '#000'
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'center'
          ctx.fillText(sub.character[0].toUpperCase(), avatarX + r, avatarY + r)
          ctx.textAlign = 'left'

          // Character name chip next to avatar
          const chipX = avatarX + r * 2 + 4
          const chipLabel = sub.character.length > 10 ? sub.character.slice(0, 10) + '…' : sub.character
          ctx.font = 'bold 8px sans-serif'
          ctx.textBaseline = 'middle'
          const chipW = ctx.measureText(chipLabel).width + 8
          ctx.fillStyle = isActive ? color.bg.replace('0.10', '0.45') : color.bg.replace('0.10', '0.25')
          ctx.beginPath()
          const chipH2 = 10
          ctx.roundRect(chipX, avatarY + r - chipH2 / 2, chipW, chipH2, 3)
          ctx.fill()
          ctx.fillStyle = isActive ? color.label : color.label.replace(')', ',0.7)').replace('rgb', 'rgba')
          ctx.fillText(chipLabel, chipX + 4, avatarY + r)
        }

        // Text at natural width, clipped to block
        if (sub.text) {
          const trackH2 = H / numTracks
          const textY = yCenter + (sub.character ? 6 : 0)
          const BASE_FONT = Math.max(16, Math.round(28 * fontScaleRef.current))
          ctx.font = `bold ${BASE_FONT}px "Courier New", monospace`
          ctx.textBaseline = 'middle'
          const scaleX = 1
          const scaleY = 1

          const baseFill = isActive ? '#fff' : 'rgba(255,255,255,0.35)'
          if (isNeon) {
            ctx.shadowColor = color.label
            ctx.shadowBlur = isActive ? 8 : 3
          } else {
            ctx.shadowBlur = 0
          }

          ctx.save()
          ctx.beginPath()
          ctx.rect(Math.max(0, leftX), yTop + 1, Math.min(W, rightX) - Math.max(0, leftX), trackH2 - 2)
          ctx.clip()
          ctx.translate(leftX, textY)
          ctx.scale(scaleX, scaleY)
          const segs = sub.text.split(/(\*)/)
          let curX = 0
          for (const seg of segs) {
            if (seg === '*') {
              ctx.fillStyle = isActive ? '#7ec0ff' : 'rgba(126,192,255,0.72)'
              ctx.fillText('○', curX, 0)
            } else {
              ctx.fillStyle = baseFill
              ctx.fillText(seg, curX, 0)
            }
            curX += ctx.measureText(seg).width
          }
          ctx.restore()
          ctx.shadowBlur = 0
        }
      }

      // Fixed track labels (left edge, always on top)
      for (let tr = 0; tr < numTracks; tr++) {
        const char = Object.entries(charMap).find(([, i]) => i === tr)?.[0] || ''
        const color = TRACK_COLORS[tr % TRACK_COLORS.length]
        const trackH = H / numTracks
        ctx.font = 'bold 10px sans-serif'
        ctx.fillStyle = color.label
        ctx.textBaseline = 'top'
        ctx.fillText(char.toUpperCase() || '(DEF)', 6, tr * trackH + 5)
      }

      // Timeline tick marks (every 1s)
      ctx.setLineDash([])
      ctx.lineWidth = 1
      const tStart = t - cursor_x / pxSec
      const tEnd = t + (W - cursor_x) / pxSec
      for (let tick = Math.ceil(tStart); tick <= Math.floor(tEnd); tick++) {
        const tx = cursor_x + (tick - t) * pxSec
        ctx.strokeStyle = tick < 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)'
        ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx, H); ctx.stroke()
        if (tick >= 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)'
          ctx.font = '9px monospace'
          ctx.textBaseline = 'bottom'
          ctx.fillText(fmt(tick), tx + 2, H)
        }
      }

      // Loop region overlay + enforcement
      const lr = loopRegionRef.current
      if (lr) {
        const lx = cursor_x + (lr.start - t) * pxSec
        const rx = cursor_x + (lr.end - t) * pxSec
        if (rx > 0 && lx < W) {
          ctx.fillStyle = 'rgba(245, 197, 24,0.10)'
          ctx.fillRect(Math.max(0, lx), 0, Math.min(W, rx) - Math.max(0, lx), H)
          ctx.strokeStyle = 'rgba(245, 197, 24,0.6)'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 3])
          if (lx >= 0 && lx <= W) { ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke() }
          if (rx >= 0 && rx <= W) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, H); ctx.stroke() }
          ctx.setLineDash([])
        }
        if (!video.paused && (video.currentTime >= lr.end || video.currentTime < lr.start - 0.05)) {
          video.currentTime = lr.start
        }
      }

      // Cursor line
      ctx.setLineDash([])
      ctx.strokeStyle = '#f5c518'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(cursor_x, 0); ctx.lineTo(cursor_x, H); ctx.stroke()
      // Cursor triangle (top)
      ctx.fillStyle = '#f5c518'
      ctx.beginPath()
      ctx.moveTo(cursor_x - 7, 0)
      ctx.lineTo(cursor_x + 7, 0)
      ctx.lineTo(cursor_x, 10)
      ctx.closePath()
      ctx.fill()

      // Hover scrub indicator
      const hov = hoverRef.current
      if (hov && !dragRef.current) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath(); ctx.moveTo(hov.x, 0); ctx.lineTo(hov.x, H); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        const lbl = fmt(Math.max(0, hov.time))
        ctx.font = '10px monospace'
        const lblW = ctx.measureText(lbl).width + 8
        ctx.fillRect(Math.min(W - lblW, hov.x + 4), 2, lblW, 14)
        ctx.fillStyle = '#fff'
        ctx.textBaseline = 'top'
        ctx.fillText(lbl, Math.min(W - lblW, hov.x + 4) + 4, 4)
      }

      // Mini BR strip (below video)
      const overlayCanvas = canvasOverlayRef.current
      if (overlayCanvas) {
        const oW = overlayCanvas.offsetWidth
        if (oW > 0 && overlayCanvas.width !== oW) overlayCanvas.width = oW
        const nTracks = numTracksRef.current
        const oH = nTracks * 55
        if (overlayCanvas.height !== oH) overlayCanvas.height = oH
        const oc = overlayCanvas.getContext('2d')
        const oTrackH = 55
        const oStyle = rythmoStyleRef.current
        const oIsNeon = oStyle === 'neon'
        const oIsMinimal = oStyle === 'minimal'
        oc.shadowBlur = 0
        oc.fillStyle = oIsNeon ? '#020203' : '#030303'
        oc.fillRect(0, 0, oW, oH)
        const oCursorX = oW * CURSOR_X_RATIO
        // Track separators
        for (let tr = 1; tr < nTracks; tr++) {
          oc.strokeStyle = oIsMinimal ? '#141414' : '#1a1a1a'; oc.lineWidth = 1; oc.setLineDash([])
          oc.beginPath(); oc.moveTo(0, tr * oTrackH); oc.lineTo(oW, tr * oTrackH); oc.stroke()
        }
        // Waveform per track (skip in minimal)
        if (!oIsMinimal) {
          for (let tr = 0; tr < nTracks; tr++) {
            const color = TRACK_COLORS[tr % TRACK_COLORS.length]
            const yMid = tr * oTrackH + oTrackH / 2
            const maxAmp = oTrackH * 0.38
            const waveData = waveformRef.current
            if (oIsNeon) {
              oc.strokeStyle = color.label
              oc.lineWidth = 1.2
              oc.shadowColor = color.label
              oc.shadowBlur = 8
              oc.beginPath(); let oStarted = false
              for (let px = 0; px <= oW; px += 2) {
                const sampleT = (px - oCursorX) / pxSec + t
                let amp
                if (waveData && waveData.samples.length > 0) {
                  const si = Math.round((sampleT / waveData.duration) * waveData.samples.length)
                  const v = (si >= 0 && si < waveData.samples.length) ? waveData.samples[si] * 2 - 1 : 0
                  amp = Math.sign(v) * Math.pow(Math.abs(v), 0.6) * maxAmp
                } else {
                  amp = (Math.sin(sampleT * 7 + tr * 1.3) * 0.6 + Math.sin(sampleT * 23 + tr * 0.7) * 0.3 + Math.sin(sampleT * 3) * 0.1) * maxAmp
                }
                if (!oStarted) { oc.moveTo(px, yMid + amp); oStarted = true } else { oc.lineTo(px, yMid + amp) }
              }
              oc.stroke()
              oc.shadowBlur = 0
            } else {
              oc.fillStyle = color.bg.replace('0.10', '0.22')
              for (let px = 0; px <= oW; px += 2) {
                const sampleT = (px - oCursorX) / pxSec + t
                let amp
                if (waveData && waveData.samples.length > 0) {
                  const si = Math.round((sampleT / waveData.duration) * waveData.samples.length)
                  amp = (si >= 0 && si < waveData.samples.length) ? Math.pow(waveData.samples[si], 0.5) * maxAmp : 0
                } else {
                  amp = Math.abs(Math.sin(sampleT * 7 + tr * 1.3) * 0.6 + Math.sin(sampleT * 23 + tr * 0.7) * 0.3 + Math.sin(sampleT * 3) * 0.1) * maxAmp
                }
                oc.fillRect(px, yMid - amp, 1.5, Math.max(1, amp * 2))
              }
            }
          }
        }
        // Subtitle blocks + text
        for (const sub of subtitlesRef.current) {
          const trackIdx = charMapRef.current[sub.character || ''] ?? 0
          const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
          const leftX = oCursorX + (sub.start - t) * pxSec
          const rightX = oCursorX + (sub.end - t) * pxSec
          if (rightX < 0 || leftX > oW) continue
          const bx = Math.max(0, leftX)
          const bw = Math.min(oW, rightX) - bx
          const isActive = t >= sub.start && t <= sub.end
          if (oIsMinimal) {
            oc.fillStyle = isActive ? color.label : 'rgba(255,255,255,0.18)'
            oc.fillRect(bx, trackIdx * oTrackH + oTrackH - 3, bw, 2)
          } else if (oIsNeon) {
            oc.strokeStyle = color.label.replace(')', ',0.5)').replace('rgb', 'rgba')
            oc.lineWidth = 1; oc.setLineDash([])
            oc.shadowColor = color.label; oc.shadowBlur = 4
            oc.strokeRect(bx + 0.5, trackIdx * oTrackH + 1.5, bw - 1, oTrackH - 3)
            oc.shadowBlur = 0
          } else {
            oc.fillStyle = color.bg.replace('0.10', isActive ? '0.28' : '0.12')
            oc.fillRect(bx, trackIdx * oTrackH + 1, bw, oTrackH - 2)
          }
          if (sub.text) {
            const O_BASE_FONT = Math.max(10, Math.round(20 * fontScaleRef.current))
            oc.font = `bold ${O_BASE_FONT}px "Courier New", monospace`
            oc.textBaseline = 'middle'
            const sx = 1
            const inactiveFill = oIsNeon ? 'rgba(220,240,255,0.55)' : 'rgba(255,255,255,0.35)'
            oc.save()
            oc.beginPath()
            oc.rect(bx, trackIdx * oTrackH + 1, bw, oTrackH - 2)
            oc.clip()
            oc.translate(leftX, trackIdx * oTrackH + oTrackH / 2)
            oc.scale(sx, 1)
            const segs = sub.text.split(/(\*)/)
            let cx2 = 0
            for (const seg of segs) {
              oc.fillStyle = seg === '*' ? (isActive ? '#7ec0ff' : 'rgba(126,192,255,0.55)') : (isActive ? '#fff' : inactiveFill)
              oc.fillText(seg === '*' ? '○' : seg, cx2, 0)
              cx2 += oc.measureText(seg).width
            }
            oc.restore()
          }
        }
        // Fixed track labels (left edge, always visible)
        for (let tr = 0; tr < nTracks; tr++) {
          const char = Object.entries(charMapRef.current).find(([, i]) => i === tr)?.[0] || ''
          const color = TRACK_COLORS[tr % TRACK_COLORS.length]
          oc.font = 'bold 9px sans-serif'
          oc.fillStyle = color.label
          oc.textBaseline = 'top'
          oc.fillText(char.toUpperCase() || '(DEF)', 5, tr * oTrackH + 4)
        }
        // Cursor
        oc.strokeStyle = '#f5c518'; oc.lineWidth = 2; oc.setLineDash([])
        oc.beginPath(); oc.moveTo(oCursorX, 0); oc.lineTo(oCursorX, oH); oc.stroke()
        oc.fillStyle = '#f5c518'; oc.beginPath()
        oc.moveTo(oCursorX - 5, 0); oc.lineTo(oCursorX + 5, 0); oc.lineTo(oCursorX, 7); oc.closePath(); oc.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [charMap, numTracks])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      const v = videoRef.current; if (!v) return
      const t = v.currentTime
      const subs = subtitlesRef.current
      const activeI = subs.findIndex(s => t >= s.start && t <= s.end)

      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.ctrlKey || e.metaKey) {
            const prev = [...subs].reverse().find(s => s.start < t - 0.05)
            if (prev) v.currentTime = prev.start
          } else {
            v.currentTime = Math.max(0, t - (e.shiftKey ? 0.1 : 1))
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.ctrlKey || e.metaKey) {
            const next = subs.find(s => s.start > t + 0.05)
            if (next) v.currentTime = next.start
          } else {
            v.currentTime = Math.min(v.duration || 0, t + (e.shiftKey ? 0.1 : 1))
          }
          break
        case ',': e.preventDefault(); v.pause(); v.currentTime = Math.max(0, t - 0.04); break
        case '.': e.preventDefault(); v.pause(); v.currentTime = Math.min(v.duration || 0, t + 0.04); break
        case 'Delete': case 'Backspace':
          if (activeI >= 0) { e.preventDefault(); handleSubtitlesChange(subs.filter((_, i) => i !== activeI)) }
          break
        case 'Escape': if (loopRegionRef.current) { setLoopRegion(null); e.preventDefault() } break
        case 'j': v.playbackRate = 0.5; setSpeed(0.5); break
        case 'l': v.playbackRate = 1.5; setSpeed(1.5); break
        case 'm': v.muted = !v.muted; setMuted(v.muted); break
        case 'i': case 'I':
          if (activeI >= 0) handleSubtitlesChange(subs.map((s, i) => i === activeI ? { ...s, start: t } : s))
          break
        case 'o': case 'O':
          if (activeI >= 0) handleSubtitlesChange(subs.map((s, i) => i === activeI ? { ...s, end: t } : s))
          break
        case 's': case 'S':
          if (activeI >= 0) {
            const sub = subs[activeI]
            if (t > sub.start && t < sub.end) {
              const next = [...subs]
              next.splice(activeI, 1, { ...sub, end: t }, { ...sub, start: t, text: '' })
              handleSubtitlesChange(next)
            }
          }
          break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function togglePlay() { const v = videoRef.current; if (v) v.paused ? v.play() : v.pause() }
  function toggleMute() { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted) }
  function changeSpeed(s) { const v = videoRef.current; if (v) v.playbackRate = +s; setSpeed(+s) }
  function seekTo(t) { const v = videoRef.current; if (v) v.currentTime = t }

  const doSave = useCallback(async (subs) => {
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/clips/${clip.clip_id}/subtitles`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtitles: subs }),
      })
      if (!res.ok) throw new Error()
      onUpdate(await res.json())
      setSaveStatus('saved')
    } catch { setSaveStatus('error') }
  }, [clip.clip_id, onUpdate])

  function handleSubtitlesChange(subs) {
    const sorted = [...subs].sort((a, b) => a.start - b.start)
    // Track selectedIdx through sort (objects share references from spread-sort)
    if (selectedIdx != null && selectedIdx < subs.length) {
      const ref = subs[selectedIdx]
      const newIdx = sorted.indexOf(ref)
      if (newIdx !== selectedIdx && newIdx >= 0) setSelectedIdx(newIdx)
    }
    setSubtitles(sorted)
    setSaveStatus('unsaved')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(sorted), 1500)
  }

  useEffect(() => () => {
    clearTimeout(debounceRef.current)
    if (saveStatusRef.current === 'unsaved') doSave(subtitlesRef.current)
  }, [])

  useEffect(() => {
    if (!ctxMenu) return
    const onKey = e => { if (e.key === 'Escape') setCtxMenu(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctxMenu])

  function canvasCoords(e) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    const W = canvas.width
    const t = (videoRef.current?.currentTime || 0) + brOffsetRef.current
    const pxSec = pxPerSecRef.current
    const cursor_x = W * CURSOR_X_RATIO
    return { x, y, W, t, pxSec, cursor_x, time: t + (x - cursor_x) / pxSec }
  }

  function hitTest(e) {
    const c = canvasCoords(e); if (!c) return null
    const cH = canvasHRef.current
    const n = numTracksRef.current
    const trackH = cH / n
    const trackIdx = Math.min(n - 1, Math.max(0, Math.floor(c.y / trackH)))
    const cMap = charMapRef.current
    const subs = subtitlesRef.current
    const EDGE = 6
    let bestIdx = -1, bestZone = null
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i]
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

  function snapTime(t, e, preferOnset = false) {
    if (e?.altKey) return Math.max(0, t)
    if (preferOnset) {
      const onsets = onsetsRef.current
      if (onsets && onsets.length) {
        const win = 0.08
        let best = null, bestD = win
        for (const o of onsets) {
          const d = Math.abs(o - t)
          if (d < bestD) { bestD = d; best = o }
        }
        if (best != null) return Math.max(0, best)
      }
    }
    return Math.max(0, Math.round(t * 100) / 100)
  }

  function dragCommit(subs) {
    setSubtitles(subs)
    setSaveStatus('unsaved')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(subtitlesRef.current), 800)
  }

  function onCanvasMouseDown(e) {
    if (editingIdx != null) return
    if (e.button !== 0) return
    if (lockedRef.current) return
    const hit = hitTest(e); if (!hit) return

    // Shift+click on block → loop that subtitle
    if (e.shiftKey && hit.subIdx >= 0) {
      const sub = subtitlesRef.current[hit.subIdx]
      setLoopRegion({ start: sub.start, end: sub.end })
      const v = videoRef.current
      if (v) { v.currentTime = sub.start; if (v.paused) v.play() }
      return
    }
    // Shift+drag in empty → loop region custom
    if (e.shiftKey && hit.subIdx < 0) {
      dragRef.current = {
        mode: 'loop',
        startX: hit.x, startY: hit.y,
        startTime: hit.time,
        didMove: false,
      }
      return
    }

    if (hit.subIdx >= 0) {
      const sub = subtitlesRef.current[hit.subIdx]
      const mode = hit.zone === 'left' ? 'resize-start' : hit.zone === 'right' ? 'resize-end' : 'shift'
      // Alt+drag in mid → duplicate before shifting
      let subIdx = hit.subIdx
      let workingSubs = subtitlesRef.current
      if (e.altKey && mode === 'shift') {
        const dur = sub.end - sub.start
        const dupe = { ...sub, start: sub.end, end: sub.end + dur }
        workingSubs = [...workingSubs.slice(0, hit.subIdx + 1), dupe, ...workingSubs.slice(hit.subIdx + 1)]
        subIdx = hit.subIdx + 1
        setSubtitles(workingSubs)
      }
      dragRef.current = {
        mode,
        subIdx,
        startX: hit.x, startY: hit.y, startTime: hit.time,
        origSub: { ...workingSubs[subIdx] },
        origTrack: charMapRef.current[(workingSubs[subIdx].character || '')] ?? 0,
        didMove: false,
      }
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = mode === 'shift' ? 'grabbing' : 'ew-resize'
    } else {
      dragRef.current = {
        mode: 'create',
        subIdx: -1,
        startX: hit.x, startY: hit.y,
        startTime: snapTime(hit.time, e, true),
        trackChar: charList[hit.trackIdx] ?? '',
        created: false,
        didMove: false,
      }
    }
  }

  function onCanvasMouseMove(e) {
    const hit = hitTest(e); if (!hit) return
    const drag = dragRef.current

    if (!drag) {
      hoverRef.current = { x: hit.x, time: hit.time }
      const canvas = canvasRef.current
      if (canvas) {
        canvas.style.cursor = hit.subIdx >= 0
          ? (hit.zone === 'left' || hit.zone === 'right' ? 'ew-resize' : 'grab')
          : 'crosshair'
      }
      if (hit.subIdx >= 0) {
        const s = subtitlesRef.current[hit.subIdx]
        setHoverHint(`${hit.zone === 'mid' ? 'glisser' : 'redimensionner'} · ${s.character || '(défaut)'} · ${s.text.slice(0, 40)}`)
      } else {
        setHoverHint('cliquer-glisser pour créer · double-clic pour éditer')
      }
      return
    }

    drag.didMove = drag.didMove || Math.abs(hit.x - drag.startX) > 2 || Math.abs(hit.y - drag.startY) > 2
    const dt = hit.time - drag.startTime

    if (drag.mode === 'shift') {
      const newStart = snapTime(drag.origSub.start + dt, e)
      const dur = drag.origSub.end - drag.origSub.start
      const verticalDelta = hit.y - drag.startY
      const trackH = canvasHRef.current / numTracksRef.current
      let newChar = drag.origSub.character
      if (Math.abs(verticalDelta) > trackH * 0.5 && hit.trackIdx !== drag.origTrack && charList[hit.trackIdx] != null) {
        newChar = charList[hit.trackIdx]
      }
      dragCommit(subtitlesRef.current.map((s, i) => i !== drag.subIdx ? s : { ...s, start: newStart, end: newStart + dur, character: newChar }))
    } else if (drag.mode === 'resize-start') {
      const newStart = Math.min(snapTime(drag.origSub.start + dt, e, true), drag.origSub.end - 0.1)
      dragCommit(subtitlesRef.current.map((s, i) => i !== drag.subIdx ? s : { ...s, start: newStart }))
    } else if (drag.mode === 'resize-end') {
      const newEnd = Math.max(snapTime(drag.origSub.end + dt, e, true), drag.origSub.start + 0.1)
      dragCommit(subtitlesRef.current.map((s, i) => i !== drag.subIdx ? s : { ...s, end: newEnd }))
    } else if (drag.mode === 'loop') {
      const t1 = hit.time
      const a = Math.max(0, Math.min(drag.startTime, t1))
      const b = Math.max(0, Math.max(drag.startTime, t1))
      if (b - a > 0.1) setLoopRegion({ start: a, end: b })
    } else if (drag.mode === 'create') {
      const t1 = snapTime(hit.time, e, true)
      if (!drag.created && Math.abs(t1 - drag.startTime) > 0.1) {
        drag.created = true
        const start = Math.min(drag.startTime, t1)
        const end = Math.max(drag.startTime, t1)
        const newSub = { start, end, character: drag.trackChar, text: '' }
        const next = [...subtitlesRef.current, newSub]
        drag.subIdx = next.length - 1
        drag.origSub = newSub
        drag.mode = 'resize-end'
        dragCommit(next)
      }
    }
    hoverRef.current = { x: hit.x, time: hit.time }
  }

  function onCanvasMouseUp(e) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.mode === 'loop') {
      const lr = loopRegionRef.current
      if (lr) {
        const v = videoRef.current
        if (v) { v.currentTime = lr.start; if (v.paused) v.play() }
      }
      return
    }
    if (!drag.didMove && drag.mode !== 'create') {
      const hit = hitTest(e)
      if (hit) seekTo(Math.max(0, hit.time))
    } else {
      clearTimeout(debounceRef.current)
      doSave(subtitlesRef.current)
    }
  }

  function onCanvasDoubleClick(e) {
    const hit = hitTest(e); if (!hit) return
    if (hit.subIdx >= 0) {
      const v = videoRef.current; if (v && !v.paused) v.pause()
      setEditingIdx(hit.subIdx)
      setEditText(subtitlesRef.current[hit.subIdx].text)
    }
  }

  function onCanvasWheel(e) {
    if (!e.ctrlKey && !e.shiftKey) return
    e.preventDefault()
    setPxPerSec(p => Math.max(40, Math.min(400, p + (e.deltaY < 0 ? 20 : -20))))
  }

  function onCanvasContextMenu(e) {
    e.preventDefault()
    dragRef.current = null
    const hit = hitTest(e); if (!hit) return
    if (hit.subIdx >= 0) {
      const rect = canvasRef.current.getBoundingClientRect()
      setCtxMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        subIdx: hit.subIdx,
        time: hit.time,
      })
    } else {
      setCtxMenu(null)
    }
  }

  function ctxAction(action, payload) {
    if (!ctxMenu) return
    const i = ctxMenu.subIdx
    const subs = subtitlesRef.current
    const sub = subs[i]; if (!sub) { setCtxMenu(null); return }

    if (action === 'edit') {
      const v = videoRef.current; if (v && !v.paused) v.pause()
      setEditingIdx(i); setEditText(sub.text)
    } else if (action === 'split') {
      const t = ctxMenu.time
      if (t > sub.start && t < sub.end) {
        const next = [...subs]
        next.splice(i, 1, { ...sub, end: t }, { ...sub, start: t, text: '' })
        handleSubtitlesChange(next)
      }
    } else if (action === 'duplicate') {
      const dur = sub.end - sub.start
      const next = [...subs]
      next.splice(i + 1, 0, { ...sub, start: sub.end, end: sub.end + dur, text: sub.text })
      handleSubtitlesChange(next)
    } else if (action === 'delete') {
      handleSubtitlesChange(subs.filter((_, idx) => idx !== i))
    } else if (action === 'character') {
      handleSubtitlesChange(subs.map((s, idx) => idx === i ? { ...s, character: payload } : s))
    } else if (action === 'newCharacter') {
      const name = prompt('Nom du personnage :', sub.character || '')
      if (name != null) handleSubtitlesChange(subs.map((s, idx) => idx === i ? { ...s, character: name.trim() } : s))
    } else if (action === 'seekStart') {
      seekTo(sub.start)
    } else if (action === 'seekEnd') {
      seekTo(sub.end)
    }
    setCtxMenu(null)
  }

  function commitEdit() {
    if (editingIdx == null) return
    const subs = subtitlesRef.current
    if (editingIdx < subs.length) {
      handleSubtitlesChange(subs.map((s, i) => i === editingIdx ? { ...s, text: editText } : s))
    }
    setEditingIdx(null)
  }

  async function transcribe() {
    setTranscribing(true)
    try {
      const res = await fetch('/api/transcription/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_id: clip.clip_id, language: lang === 'auto' ? null : lang }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      handleSubtitlesChange((await res.json()).subtitles)
      setToast({ msg: 'Transcription terminée', type: 'success' })
    } catch (e) {
      setToast({ msg: 'Erreur : ' + e.message, type: 'error' })
    } finally {
      setTranscribing(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  async function exportBRCanvas() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    setBrExporting(true)
    setToast({ msg: '⏺ Enregistrement BR en cours…', type: 'success' })

    const vw = video.videoWidth || canvas.width
    const origW = canvas.width
    const origH = canvas.height
    const origPxSec = pxPerSecRef.current
    const origFontScale = fontScaleRef.current
    const scale = vw > origW ? vw / origW : 1

    try {
      // Seek to start and wait
      video.currentTime = 0
      await new Promise(r => { video.onseeked = () => { video.onseeked = null; r() } })

      // Scale canvas to video native width so overlay needs no upscaling
      if (scale > 1) {
        exportingRef.current = true
        canvas.width = vw
        canvas.height = Math.round(origH * scale)
        pxPerSecRef.current = origPxSec * scale
        fontScaleRef.current = origFontScale * scale
        // Wait 2 RAF frames for drawing at new resolution
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm'

      const stream = canvas.captureStream(60)
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 15_000_000 })
      const chunks = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

      // Activate smooth time interpolation: resync anchor on each video timeupdate,
      // interpolate with wall clock between updates so the canvas scrolls at true 60fps
      // instead of stepping at video fps (24fps) which causes visible jumping in the export.
      const onTimeUpdate = () => {
        interpTimeRef.current = { videoTime: video.currentTime, wallMs: performance.now(), active: true }
      }
      video.addEventListener('timeupdate', onTimeUpdate)

      await new Promise((resolve, reject) => {
        recorder.onstop = resolve
        recorder.onerror = e => reject(e.error || new Error('MediaRecorder error'))
        recorder.start(16)
        interpTimeRef.current = { videoTime: 0, wallMs: performance.now(), active: true }
        video.play()
        video.onended = () => { video.onended = null; recorder.stop() }
      })

      video.removeEventListener('timeupdate', onTimeUpdate)
      interpTimeRef.current.active = false

      const blob = new Blob(chunks, { type: 'video/webm' })
      setToast({ msg: '📤 Export MP4+BR…', type: 'success' })

      const fd = new FormData()
      fd.append('segment_id', clip.clip_id)
      fd.append('overlay', blob, 'br_overlay.webm')

      const res = await fetch('/api/export/mp4-canvas', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const dlBlob = await res.blob()
      const url = URL.createObjectURL(dlBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.name}_bande_rythmo.mp4`
      a.click()
      URL.revokeObjectURL(url)
      setToast({ msg: '✓ Export terminé', type: 'success' })
      setTimeout(() => setToast(null), 3000)
    } catch (e) {
      setToast({ msg: 'Erreur export : ' + e.message, type: 'error' })
      setTimeout(() => setToast(null), 5000)
    } finally {
      interpTimeRef.current.active = false
      if (scale > 1) {
        exportingRef.current = false
        pxPerSecRef.current = origPxSec
        fontScaleRef.current = origFontScale
        // RAF will restore canvas.width to CSS size on next frame
      }
      setBrExporting(false)
    }
  }

  const st = STATUS[saveStatus]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '7px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ padding: '4px 10px', background: 'var(--surface3)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 4, fontSize: 11 }}>
          ← Mes Clips
        </button>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{clip.name}</span>
        <span style={{ fontSize: 11, color: '#888', fontFamily: 'var(--font-mono)' }}>
          {(clip.end - clip.start).toFixed(1)}s · {subtitles.length} réplique{subtitles.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 11, color: st.color }}>{st.text}</span>
        <div style={{ flex: 1 }} />
        <select value={lang} onChange={e => setLang(e.target.value)} disabled={transcribing}
          style={{ background: 'var(--surface3)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 4, padding: '3px 5px', fontSize: 11 }}>
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <button onClick={transcribe} disabled={transcribing} style={{
          padding: '4px 12px', background: 'var(--surface3)',
          color: subtitles.length > 0 ? 'var(--text2)' : '#f5c518',
          border: `1px solid ${subtitles.length > 0 ? 'var(--border2)' : 'rgba(245, 197, 24,0.4)'}`,
          borderRadius: 4, fontSize: 11,
        }}>
          {transcribing ? '◉ ...' : '◉ Whisper'}
        </button>
        <button onClick={() => setShowExport(v => !v)} style={{
          padding: '4px 12px',
          background: showExport ? '#f5c518' : 'var(--surface3)',
          color: showExport ? '#000' : 'var(--text2)',
          border: `1px solid ${showExport ? '#f5c518' : 'var(--border2)'}`,
          borderRadius: 4, fontSize: 11, fontWeight: showExport ? 700 : 400,
        }}>
          ↗ Exporter
        </button>
      </div>

      {/* ── Main panels ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left: subtitle list */}
        <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #1a1a1a' }}>
          {subtitles.length === 0 && !transcribing ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Aucune réplique. Transcrivez ou ajoutez manuellement.</div>
              <button onClick={transcribe} style={{ padding: '6px 16px', background: '#f5c518', color: '#000', fontWeight: 600, borderRadius: 4, fontSize: 12 }}>◉ Transcrire</button>
            </div>
          ) : (
            <SubtitleEditor subtitles={subtitles} onChange={handleSubtitlesChange} currentTime={currentTime} onSeek={seekTo} selectedIdx={selectedIdx} setSelectedIdx={setSelectedIdx} compact={sidebarWidth < 460} />
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={e => {
            e.preventDefault()
            const startX = e.clientX
            const startW = sidebarWidth
            const onMove = ev => setSidebarWidth(Math.max(240, Math.min(700, startW + ev.clientX - startX)))
            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
          style={{ width: 5, flexShrink: 0, cursor: 'col-resize', background: 'transparent', transition: 'background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f5c5184' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        />

        {/* Right: video + mini BR strip + transport */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Video */}
          <div style={{ background: '#000', position: 'relative', flex: 1, minHeight: 0 }}>
            <video
              ref={videoRef}
              src={segmentUrl}
              preload="metadata"
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', cursor: 'pointer' }}
              onTimeUpdate={e => setCurrentTime(e.target.currentTime)}
              onLoadedMetadata={e => setDuration(e.target.duration)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={togglePlay}
            />
            {subtitles.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 11, color: '#2a2a2a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Aperçu Clip</span>
              </div>
            )}
            {activeSubtitle && brInPlayer !== 'never' && (brInPlayer === 'always' || playing) && (
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.82)', color: '#fff', padding: '5px 18px',
                borderRadius: 3, fontSize: 15, maxWidth: '90%', textAlign: 'center',
                fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                borderTop: `2px solid ${TRACK_COLORS[(charMap[activeSubtitle.character || ''] ?? 0) % TRACK_COLORS.length].label}`,
                pointerEvents: 'none',
              }}>
                {activeSubtitle.character && (
                  <div style={{ color: TRACK_COLORS[(charMap[activeSubtitle.character || ''] ?? 0) % TRACK_COLORS.length].label, fontSize: 9, marginBottom: 2, letterSpacing: 1, fontWeight: 700 }}>
                    {activeSubtitle.character.toUpperCase()}
                  </div>
                )}
                {activeSubtitle.text}
              </div>
            )}
          </div>

          {/* Mini BR strip — same scrolling content as main BR, below video */}
          <canvas
            ref={canvasOverlayRef}
            width={800}
            height={numTracks * 55}
            style={{ display: 'block', width: '100%', height: numTracks * 55, flexShrink: 0, background: '#030303' }}
          />

        </div>
      </div>

      {/* ── Bande Rythmo — full width ── */}
      <div style={{ flexShrink: 0, borderTop: '2px solid #1a1a1a', background: '#050505', height: brPanelHeight, display: 'flex', flexDirection: 'column', overflow: 'visible', position: 'relative' }}>
        {/* Vertical resize handle */}
        <div
          onMouseDown={e => {
            e.preventDefault()
            const startY = e.clientY
            const startH = brPanelHeight
            const onMove = ev => setBrPanelHeight(Math.max(100, Math.min(500, startH - (ev.clientY - startY))))
            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
          style={{ height: 5, flexShrink: 0, cursor: 'row-resize', background: 'transparent', transition: 'background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f5c5184' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        />
        {/* Full-width seekbar + transport */}
        <div style={{ flexShrink: 0, background: '#080808', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8, height: 32 }}>
          <button onClick={togglePlay} style={{ background: 'none', color: '#f5c518', padding: '2px 6px', border: '1px solid #f5c51844', borderRadius: 3, minWidth: 26, lineHeight: 1, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
            {playing ? '⏸' : '▶'}
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', flexShrink: 0 }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>
          <input type="range" min={0} max={duration || 1} step={0.05} value={currentTime}
            onChange={e => seekTo(parseFloat(e.target.value))}
            style={{ flex: 1, color: '#f5c518', cursor: 'pointer', height: 3, '--pct': `${(currentTime / (duration || 1)) * 100}%` }} />
          <select value={speed} onChange={e => changeSpeed(e.target.value)}
            style={{ background: 'var(--surface3)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 3, padding: '2px 4px', fontSize: 10, flexShrink: 0 }}>
            {[0.5, 0.75, 1, 1.25, 1.5].map(s => <option key={s} value={s}>{s}×</option>)}
          </select>
          <button onClick={toggleMute}
            style={{ background: 'none', color: muted ? '#333' : 'var(--text2)', fontSize: 11, padding: '2px 6px', border: '1px solid var(--border2)', borderRadius: 3, cursor: 'pointer', flexShrink: 0 }}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* VoxDub-style BR toolbar */}
        <BandeRythmoToolbar
          subtitles={subtitles}
          onSubtitlesChange={handleSubtitlesChange}
          selectedIdx={selectedIdx}
          setSelectedIdx={setSelectedIdx}
          videoRef={videoRef}
          playing={playing}
          speed={speed}
          onSpeedChange={changeSpeed}
          brOffset={brOffset}
          setBrOffset={setBrOffset}
          pxPerSec={pxPerSec}
          setPxPerSec={setPxPerSec}
          charMap={charMap}
          brInPlayer={brInPlayer}
          setBrInPlayer={setBrInPlayer}
          rythmoStyle={rythmoStyle}
          setRythmoStyle={setRythmoStyle}
          fontScale={fontScale}
          setFontScale={setFontScale}
          locked={locked}
          setLocked={setLocked}
        />
        {/* BR track legend bar */}
        <div style={{ height: BR_CONTROLS_H, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', borderBottom: '1px solid #111' }}>
          <span style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0, fontWeight: 700 }}>
            Bande Rythmo
          </span>
          {Object.entries(charMap).map(([char, idx]) => (
            <span key={char} style={{ fontSize: 11, color: TRACK_COLORS[idx % TRACK_COLORS.length].label, fontWeight: 600 }}>
              ▪ {char || '(défaut)'}
            </span>
          ))}
          <div style={{ flex: 1 }} />
          {loopRegion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(245, 197, 24,0.08)', border: '1px solid rgba(245, 197, 24,0.3)', borderRadius: 3 }}>
              <span style={{ fontSize: 11, color: '#f5c518', fontFamily: 'var(--font-mono)' }}>
                ⟲ {fmt(loopRegion.start)}–{fmt(loopRegion.end)}
              </span>
              <button onClick={() => setLoopRegion(null)} style={{ fontSize: 11, color: '#f5c518', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          )}
        </div>
        {/* Canvas */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            width={800}
            height={canvasH}
            style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair', userSelect: 'none' }}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={() => { dragRef.current = null; hoverRef.current = null; setHoverHint(null) }}
            onDoubleClick={onCanvasDoubleClick}
            onWheel={onCanvasWheel}
            onContextMenu={onCanvasContextMenu}
          />
          {editingIdx != null && (() => {
            const sub = subtitles[editingIdx]
            const canvas = canvasRef.current
            if (!sub || !canvas) return null
            const rect = canvas.getBoundingClientRect()
            const scaleX = rect.width / canvas.width
            const cur_x = canvas.width * CURSOR_X_RATIO
            const t = (videoRef.current?.currentTime || 0) + brOffset
            const left = (cur_x + (sub.start - t) * pxPerSec) * scaleX
            const right = (cur_x + (sub.end - t) * pxPerSec) * scaleX
            const trackIdx = charMap[sub.character || ''] ?? 0
            const trackH = (canvasRef.current?.height || canvasH) / numTracks
            const top = trackIdx * trackH + trackH / 2 - 16
            const width = Math.max(120, right - left)
            const clampLeft = Math.max(4, Math.min(rect.width - width - 4, left))
            return (
              <input
                autoFocus
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                  if (e.key === 'Escape') { e.preventDefault(); setEditingIdx(null) }
                }}
                style={{
                  position: 'absolute', left: clampLeft, top, width,
                  background: 'rgba(0,0,0,0.95)', color: '#fff',
                  border: '2px solid #f5c518', borderRadius: 4,
                  padding: '4px 8px', fontFamily: 'var(--font-mono)',
                  fontSize: 14, zIndex: 10, outline: 'none',
                }}
              />
            )
          })()}
          {hoverHint && !editingIdx && (
            <div style={{
              position: 'absolute', bottom: 4, right: 8,
              fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-mono)',
              background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 2,
              pointerEvents: 'none',
            }}>{hoverHint}</div>
          )}
          {ctxMenu && (() => {
            const sub = subtitles[ctxMenu.subIdx]
            if (!sub) return null
            const canSplit = ctxMenu.time > sub.start && ctxMenu.time < sub.end
            return (
              <>
                <div
                  onClick={() => setCtxMenu(null)}
                  onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }}
                  style={{ position: 'fixed', inset: 0, zIndex: 20 }}
                />
                <div style={{
                  position: 'absolute', left: ctxMenu.x, top: ctxMenu.y,
                  background: '#0c0c0c', border: '1px solid #2a2a2a',
                  borderRadius: 4, padding: 4, zIndex: 21,
                  fontSize: 12, minWidth: 180,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                }}>
                  <div style={menuHeader}>
                    {sub.character || '(défaut)'} · {sub.text.slice(0, 30) || '∅'}
                  </div>
                  <MenuBtn onClick={() => ctxAction('edit')}>✎ Éditer texte</MenuBtn>
                  {canSplit && <MenuBtn onClick={() => ctxAction('split')}>✂ Couper ici ({fmt(ctxMenu.time)})</MenuBtn>}
                  <MenuBtn onClick={() => ctxAction('duplicate')}>⎘ Dupliquer après</MenuBtn>
                  <MenuBtn onClick={() => ctxAction('seekStart')}>⏮ Aller au début ({fmt(sub.start)})</MenuBtn>
                  <MenuBtn onClick={() => ctxAction('seekEnd')}>⏭ Aller à la fin ({fmt(sub.end)})</MenuBtn>
                  <div style={menuSep} />
                  <div style={menuSubHeader}>Personnage</div>
                  {charList.map(c => (
                    <MenuBtn key={c || '_default'} onClick={() => ctxAction('character', c)} active={c === (sub.character || '')}>
                      <span style={{ color: TRACK_COLORS[(charMap[c] ?? 0) % TRACK_COLORS.length].label }}>▪</span> {c || '(défaut)'}
                    </MenuBtn>
                  ))}
                  <MenuBtn onClick={() => ctxAction('newCharacter')}>+ Nouveau / renommer…</MenuBtn>
                  <div style={menuSep} />
                  <MenuBtn onClick={() => ctxAction('delete')} danger>✕ Supprimer</MenuBtn>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* ── Export panel ── */}
      {showExport && (
        <div style={{ borderTop: '2px solid #f5c518', background: 'var(--surface)', padding: 14, flexShrink: 0, maxHeight: 260, overflow: 'auto' }}>
          <ExportPanel
            segmentId={clip.clip_id}
            subtitles={subtitles}
            pxPerSec={pxPerSec}
            brOffset={brOffset}
            canvasH={canvasH}
            getCanvasWidth={() => canvasRef.current?.width || 1200}
          />
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '10px 18px',
          background: toast.type === 'error' ? '#e54545' : '#44bb55',
          color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500,
          zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function BandeRythmoToolbar({
  subtitles, onSubtitlesChange, selectedIdx, setSelectedIdx,
  videoRef, playing, speed, onSpeedChange,
  brOffset, setBrOffset, pxPerSec, setPxPerSec,
  charMap, brInPlayer, setBrInPlayer, rythmoStyle, setRythmoStyle,
  fontScale, setFontScale,
  locked, setLocked,
}) {
  const liveIdx = subtitles.findIndex(s => {
    const v = videoRef.current
    const t = v ? v.currentTime : 0
    return t >= s.start && t <= s.end
  })
  const targetIdx = selectedIdx != null ? selectedIdx : (liveIdx >= 0 ? liveIdx : null)
  const target = targetIdx != null ? subtitles[targetIdx] : null

  const [showReact, setShowReact] = React.useState(false)
  const [showResp, setShowResp] = React.useState(false)
  const [showNote, setShowNote] = React.useState(false)
  const [showCharPicker, setShowCharPicker] = React.useState(false)
  const [dropdownAnchor, setDropdownAnchor] = React.useState({ bottom: 60, left: 200 })
  const toolbarRef = React.useRef(null)
  const [loop, setLoop] = React.useState(false)
  const charPickerRef = React.useRef(null)

  React.useEffect(() => {
    if (!showCharPicker) return
    const close = e => { if (!charPickerRef.current?.contains(e.target)) setShowCharPicker(false) }
    setTimeout(() => window.addEventListener('mousedown', close), 0)
    return () => window.removeEventListener('mousedown', close)
  }, [showCharPicker])

  // Loop the active sub when loop is on
  React.useEffect(() => {
    if (!loop || !target || !videoRef.current) return
    const v = videoRef.current
    const check = () => { if (v.currentTime > target.end + 0.05) v.currentTime = target.start }
    v.addEventListener('timeupdate', check)
    return () => v.removeEventListener('timeupdate', check)
  }, [loop, target, videoRef])

  function updateTarget(patch) {
    if (targetIdx == null) return
    onSubtitlesChange(subtitles.map((s, i) => i === targetIdx ? { ...s, ...patch } : s))
  }


  function insertTagSub(text, dur = 0.5) {
    const v = videoRef.current
    const t = v ? v.currentTime : 0
    const newSub = { start: t, end: t + dur, text, character: '', reactions: [] }
    const next = [...subtitles, newSub].sort((a, b) => a.start - b.start)
    onSubtitlesChange(next)
    setShowResp(false)
    setShowReact(false)
  }

  function setIN() {
    const v = videoRef.current; if (!target || !v) return
    updateTarget({ start: Math.min(v.currentTime, target.end - 0.1) })
  }
  function setOUT() {
    const v = videoRef.current; if (!target || !v) return
    updateTarget({ end: Math.max(v.currentTime, target.start + 0.1) })
  }

  function gotoPrev() {
    const v = videoRef.current; if (!v) return
    const t = v.currentTime
    const i = subtitles.findIndex(s => s.start > t - 0.01)
    const ti = i <= 0 ? 0 : i - 1
    if (subtitles[ti]) { v.currentTime = subtitles[ti].start; setSelectedIdx(ti) }
  }
  function gotoNext() {
    const v = videoRef.current; if (!v) return
    const t = v.currentTime
    const i = subtitles.findIndex(s => s.start > t + 0.01)
    if (i >= 0) { v.currentTime = subtitles[i].start; setSelectedIdx(i) }
  }
  function gotoStart() { const v = videoRef.current; if (v) v.currentTime = 0 }
  function gotoEnd() {
    const v = videoRef.current; if (!v) return
    v.currentTime = subtitles.length ? Math.max(...subtitles.map(s => s.end)) : 0
  }
  function togglePlay() {
    const v = videoRef.current; if (!v) return
    v.paused ? v.play() : v.pause()
  }
  function deleteTarget() {
    if (targetIdx == null) return
    onSubtitlesChange(subtitles.filter((_, i) => i !== targetIdx))
    setSelectedIdx(null)
  }

  function splitAtCurrentTime() {
    if (!target || targetIdx == null) return
    const v = videoRef.current; if (!v) return
    const t = v.currentTime
    if (t <= target.start || t >= target.end) return
    const next = [...subtitles]
    next.splice(targetIdx, 1, { ...target, end: t }, { ...target, start: t, text: '' })
    onSubtitlesChange(next)
    setSelectedIdx(targetIdx + 1)
  }

  function insertTagSub(text, dur = 0.5) {
    const v = videoRef.current
    const t = v ? v.currentTime : 0
    const newSub = { start: t, end: t + dur, text, character: '', reactions: [] }
    const next = [...subtitles, newSub].sort((a, b) => a.start - b.start)
    onSubtitlesChange(next)
    setShowResp(false)
    setShowReact(false)
  }

  function openDropdown(type, e) {
    try {
      const el = e.currentTarget || e.nativeEvent?.currentTarget || e.target
      const r = el.getBoundingClientRect()
      setDropdownAnchor({ bottom: window.innerHeight - r.top + 4, left: r.left })
    } catch {}
    if (type === 'resp') { setShowResp(s => !s); setShowReact(false) }
    else { setShowReact(s => !s); setShowResp(false) }
    setShowNote(false)
  }

  function newCharacterPrompt() {
    const name = window.prompt('Nom du nouveau personnage :')
    if (name && name.trim()) {
      updateTarget({ character: name.trim() })
      setShowCharPicker(false)
    }
  }

  const charList = Object.keys(charMap)
  const activeChar = target?.character || charList[0] || ''
  const cColor = TRACK_COLORS[(charMap[activeChar] ?? 0) % TRACK_COLORS.length].label

  const btnBase = {
    height: 32, minWidth: 32, padding: '0 8px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    background: 'transparent', border: 'none', borderRadius: 6,
    color: 'var(--text)', cursor: 'pointer', fontSize: 12, lineHeight: 1,
    transition: 'background 0.12s, color 0.12s',
  }
  const btn = (enabled = true, on = false, danger = false) => ({
    ...btnBase,
    color: !enabled ? '#3a3a3a' : (danger ? '#ff5a5a' : (on ? '#f5c518' : 'var(--text)')),
    background: on ? 'rgba(245, 197, 24,0.13)' : 'transparent',
    cursor: enabled ? 'pointer' : 'not-allowed',
  })
  const grp = {
    display: 'inline-flex', alignItems: 'center', gap: 1,
    background: '#161616', border: '1px solid #232323', borderRadius: 8, padding: 2,
  }
  const sep = <div style={{ width: 1, alignSelf: 'stretch', background: '#1f1f1f', margin: '2px 4px' }} />

  return (
    <div ref={toolbarRef} style={{
      position: 'relative', background: 'linear-gradient(to bottom, #0e0e0e, #0a0a0a)',
      borderBottom: '1px solid #1c1c1c', padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    }}>
      {/* Active character pill — click to reassign */}
      <div ref={charPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => { if (target) setShowCharPicker(s => !s) }}
          title={target ? 'Changer le personnage de cette réplique' : 'Sélectionnez une réplique'}
          style={{
            ...btnBase, height: 34, minWidth: 140, padding: '0 10px',
            background: '#1a1a1a', border: `1px solid ${target ? cColor + '55' : '#2a2a2a'}`,
            color: target ? cColor : '#3a3a3a', fontSize: 12, fontWeight: 600, borderRadius: 8,
            cursor: target ? 'pointer' : 'default',
          }}>
          <span style={{
            width: 18, height: 18, borderRadius: '50%', background: (target ? cColor : '#333') + '33',
            border: `1px solid ${target ? cColor : '#333'}`, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 10, fontWeight: 700,
          }}>
            {(activeChar[0] || '?').toUpperCase()}
          </span>
          <span style={{ flex: 1, textAlign: 'left', textTransform: 'capitalize' }}>{activeChar || 'personnage'}</span>
          <Ic d={ICONS.chevron} size={14} />
        </button>
        {showCharPicker && target && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, zIndex: 20,
            background: '#0c0c0c', border: '1px solid #2a2a2a', borderRadius: 6,
            padding: '4px 0', minWidth: 180, boxShadow: '0 6px 18px rgba(0,0,0,0.7)',
          }}>
            <div style={{ padding: '4px 10px 6px', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
              Personnage — réplique #{targetIdx + 1}
            </div>
            {charList.map(c => {
              const cc = TRACK_COLORS[(charMap[c] ?? 0) % TRACK_COLORS.length].label
              const active = c === (target.character || '')
              return (
                <button key={c || '_def'} onClick={() => { updateTarget({ character: c }); setShowCharPicker(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px',
                    background: active ? 'rgba(245,197,24,0.08)' : 'transparent',
                    border: 'none', fontSize: 12, textAlign: 'left', cursor: 'pointer', color: 'var(--text)',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#1a1a1a' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: cc, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: cc }}>{c || '(défaut)'}</span>
                  {active && <span style={{ fontSize: 10, color: '#f5c518' }}>✓</span>}
                </button>
              )
            })}
            <div style={{ height: 1, background: '#1e1e1e', margin: '4px 0' }} />
            <button onClick={newCharacterPrompt}
              style={{ display: 'block', width: '100%', padding: '7px 12px', fontSize: 11, color: '#f5c518', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
              + Nouveau personnage…
            </button>
          </div>
        )}
      </div>

      {/* Mic — toggle "prise à enregistrer" */}
      <button
        onClick={() => { if (target) updateTarget({ take: !target.take }) }}
        title={target?.take ? 'Marquer comme enregistrée' : 'Marquer comme prise à enregistrer'}
        style={{
          ...btnBase, height: 34, width: 34, minWidth: 34, padding: 0,
          background: target?.take ? '#e54545' : '#1a1a1a',
          border: `1px solid ${target?.take ? '#ff7575' : '#e5454555'}`,
          color: target?.take ? '#fff' : (target ? '#e54545' : '#3a3a3a'), borderRadius: 8,
          cursor: target ? 'pointer' : 'default',
        }}>
        <Ic d={ICONS.mic} />
      </button>

      {/* Transport */}
      <div style={grp}>
        <select value={speed} onChange={e => onSpeedChange(parseFloat(e.target.value))}
          style={{ ...btnBase, padding: '0 8px', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 11, border: 'none', cursor: 'pointer' }}>
          {[0.5, 0.75, 1, 1.25, 1.5].map(s => <option key={s} value={s} style={{ background: '#1a1a1a' }}>{s}×</option>)}
        </select>
        {sep}
        <button onClick={gotoStart}  title="Début"               style={btn(true)}><Ic d={ICONS.start} /></button>
        <button onClick={gotoPrev}   title="Réplique précédente" style={btn(true)}><Ic d={ICONS.prev} /></button>
        <button onClick={togglePlay} title={playing ? 'Pause' : 'Lecture'}
          style={{ ...btn(true), background: '#f5c518', color: '#000', minWidth: 40, height: 30, margin: '0 2px' }}>
          <Ic d={playing ? ICONS.pause : ICONS.play} size={14} />
        </button>
        <button onClick={gotoNext}   title="Réplique suivante"   style={btn(true)}><Ic d={ICONS.next} /></button>
        <button onClick={gotoEnd}    title="Fin"                  style={btn(true)}><Ic d={ICONS.end} /></button>
      </div>

      {/* IN / OUT / cut */}
      <div style={grp}>
        <button onClick={setIN}  title="Définir IN au temps courant"  style={btn(target != null)}><Ic d={ICONS.in} /></button>
        <button onClick={setOUT} title="Définir OUT au temps courant" style={btn(target != null)}><Ic d={ICONS.out} /></button>
        <button onClick={splitAtCurrentTime} title="Couper la réplique au temps courant" style={btn(target != null)}><Ic d={ICONS.scissors} /></button>
      </div>

      {/* Respiration + reactions */}
      <div style={grp}>
        <button onClick={e => openDropdown('resp', e)} title="Respirations…"
          style={{ ...btn(true, showResp), padding: '0 10px', fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>
          <Ic d={ICONS.breath} size={14} />
          Respirations
        </button>
        {sep}
        <button onClick={e => openDropdown('react', e)} title="Réactions…"
          style={{ ...btn(true, showReact), padding: '0 10px', fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>
          <Ic d={ICONS.reactions} size={14} />
          Réactions
        </button>
      </div>

      {/* Note / loop / lock / delete */}
      <div style={grp}>
        <button onClick={() => setShowNote(s => !s)} title="Note de direction"
          style={btn(target != null, showNote || !!target?.note)}><Ic d={ICONS.note} /></button>
        <button onClick={() => setLoop(l => !l)} title="Boucler sur la réplique active"
          style={btn(target != null, loop)}><Ic d={ICONS.loop} /></button>
        <button onClick={() => setLocked(l => !l)} title={locked ? 'Déverrouiller la BR (édition bloquée)' : 'Verrouiller la BR (empêche les éditions accidentelles)'}
          style={btn(true, locked)}><Ic d={locked ? ICONS.lock : ICONS.lockOpen} /></button>
        <button onClick={deleteTarget} title="Supprimer la réplique"
          style={btn(target != null, false, true)}><Ic d={ICONS.trash} /></button>
      </div>

      <div style={{ flex: 1, minWidth: 8 }} />

      {/* BR-in-player mode */}
      <div style={{ ...grp, padding: '4px 6px', gap: 2 }}>
        <span style={{ fontSize: 10, color: '#888', marginRight: 4 }}>BR</span>
        {[{ id: 'play', label: 'lecture' }, { id: 'always', label: 'toujours' }, { id: 'never', label: 'jamais' }].map(o => (
          <button key={o.id} onClick={() => setBrInPlayer(o.id)} style={{
            ...btnBase, height: 24, padding: '0 8px', fontSize: 11,
            background: brInPlayer === o.id ? 'rgba(245, 197, 24,0.16)' : 'transparent',
            color: brInPlayer === o.id ? '#f5c518' : '#888', borderRadius: 4,
          }}>{o.label}</button>
        ))}
      </div>

      {/* Rythmo style */}
      <div style={{ ...grp, padding: '4px 6px', gap: 2 }}>
        {['classique', 'neon', 'minimal'].map(s => (
          <button key={s} onClick={() => setRythmoStyle(s)} style={{
            ...btnBase, height: 24, padding: '0 8px', fontSize: 11, borderRadius: 4,
            background: rythmoStyle === s ? 'rgba(245, 197, 24,0.16)' : 'transparent',
            color: rythmoStyle === s ? '#f5c518' : '#888',
          }}>{s}</button>
        ))}
      </div>

      {/* Decalage */}
      <div style={{ ...grp, padding: '4px 8px', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#888' }}>Décalage</span>
        <input type="range" min={-2} max={2} step={0.05} value={brOffset}
          onChange={e => setBrOffset(parseFloat(e.target.value))}
          style={{ width: 80, color: '#f5c518', '--pct': `${((brOffset + 2) / 4) * 100}%` }} />
        <span style={{ fontSize: 11, color: brOffset !== 0 ? '#f5c518' : '#888', fontFamily: 'var(--font-mono)', minWidth: 38, textAlign: 'right' }}>
          {brOffset >= 0 ? '+' : ''}{brOffset.toFixed(2)}s
        </span>
        {brOffset !== 0 && (
          <button onClick={() => setBrOffset(0)} style={{ ...btnBase, height: 20, width: 20, minWidth: 20, padding: 0, fontSize: 11, color: '#f5c518' }}>✕</button>
        )}
      </div>

      {/* Zoom */}
      <div style={grp}>
        <button onClick={() => setPxPerSec(p => Math.max(40, p - 20))} title="Zoom −" style={btn(true)}>
          <Ic d={ICONS.zoomOut} />
        </button>
        <span style={{ fontSize: 11, color: '#888', fontFamily: 'var(--font-mono)', minWidth: 44, textAlign: 'center' }}>{pxPerSec}px/s</span>
        <button onClick={() => setPxPerSec(p => Math.min(400, p + 20))} title="Zoom +" style={btn(true)}>
          <Ic d={ICONS.zoomIn} />
        </button>
      </div>

      {/* Font size */}
      <div style={grp}>
        <button onClick={() => setFontScale(f => Math.max(0.3, +(f - 0.15).toFixed(2)))} title="Texte −" style={btn(true)}>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>A−</span>
        </button>
        <span style={{ fontSize: 11, color: fontScale !== 1 ? '#f5c518' : '#888', fontFamily: 'var(--font-mono)', minWidth: 38, textAlign: 'center' }}>{Math.round(fontScale * 100)}%</span>
        <button onClick={() => setFontScale(f => Math.min(3, +(f + 0.15).toFixed(2)))} title="Texte +" style={btn(true)}>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>A+</span>
        </button>
        {fontScale !== 1 && (
          <button onClick={() => setFontScale(1)} title="Réinitialiser taille" style={{ ...btn(true), minWidth: 20, width: 20, padding: 0, fontSize: 11, color: '#f5c518' }}>✕</button>
        )}
      </div>

      {/* Respirations dropdown */}
      {showResp && (
        <div style={{
          position: 'fixed', bottom: dropdownAnchor.bottom, left: dropdownAnchor.left, zIndex: 9999,
          background: '#0c0c0c', border: '1px solid #7ec0ff33', borderRadius: 6,
          padding: 10, minWidth: 260, boxShadow: '0 6px 18px rgba(0,0,0,0.7)',
        }}>
          <div style={{ fontSize: 9, color: '#7ec0ff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Respirations — crée une réplique au temps courant
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {[
              { label: '(HH)', color: '#7ec0ff', dur: 0.5, desc: 'Inspiration' },
              { label: '(H)',  color: '#7ec0ff', dur: 0.4, desc: 'Souffle' },
              { label: '(Hm)', color: '#7ec0ff', dur: 0.4, desc: 'Demi-souffle' },
              { label: '*',    color: '#5599cc', dur: 0.3, desc: 'Repère BR' },
              { label: '(…)',  color: '#888',    dur: 0.6, desc: 'Pause' },
            ].map(r => (
              <button key={r.label}
                onClick={() => insertTagSub(r.label, r.dur)}
                title={`${r.desc} — ${r.dur}s`}
                style={{
                  fontSize: 13, padding: '6px 12px', fontFamily: 'var(--font-mono)',
                  background: 'rgba(126,192,255,0.06)', border: `1px solid ${r.color}44`,
                  color: r.color, borderRadius: 4, cursor: 'pointer', transition: 'background 0.1s', fontWeight: 700,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${r.color}1a`; e.currentTarget.style.borderColor = r.color }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(126,192,255,0.06)'; e.currentTarget.style.borderColor = `${r.color}44` }}
              >{r.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: '#555' }}>
            Personnage actif : <span style={{ color: cColor }}>{activeChar || '(défaut)'}</span>
          </div>
        </div>
      )}

      {/* Réactions dropdown */}
      {showReact && (
        <div style={{
          position: 'fixed', bottom: dropdownAnchor.bottom, left: dropdownAnchor.left, zIndex: 9999,
          background: '#0c0c0c', border: '1px solid #f5c51844', borderRadius: 6,
          padding: 10, minWidth: 300, maxWidth: 380, boxShadow: '0 6px 18px rgba(0,0,0,0.7)',
        }}>
          <div style={{ fontSize: 9, color: '#f5c518', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Réactions — crée une réplique au temps courant
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {[
              { label: '(rires)',      color: '#f5c518', dur: 1.5 },
              { label: '(pleurs)',     color: '#ff8888', dur: 2.0 },
              { label: '(soupir)',     color: '#aaa',    dur: 1.0 },
              { label: '(long soupir)',color: '#aaa',    dur: 2.0 },
              { label: '(cri)',        color: '#ff5a5a', dur: 0.7 },
              { label: '(chuchoté)',   color: '#88ddaa', dur: 1.2 },
              { label: '(essoufflé)', color: '#7ec0ff', dur: 1.0 },
              { label: '(hésitation)', color: '#bb88ff', dur: 0.5 },
              { label: '(raclement)', color: '#cc9966', dur: 0.5 },
              { label: '(grognement)', color: '#cc7744', dur: 0.4 },
            ].map(r => (
              <button key={r.label}
                onClick={() => insertTagSub(r.label, r.dur)}
                title={`Créer réplique "${r.label}" — ${r.dur}s`}
                style={{
                  fontSize: 10, padding: '5px 9px', fontFamily: 'var(--font-mono)',
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${r.color}44`,
                  color: r.color, borderRadius: 4, cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${r.color}18`; e.currentTarget.style.borderColor = r.color }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = `${r.color}44` }}
              >{r.label} <span style={{ fontSize: 8, opacity: 0.5 }}>{r.dur}s</span></button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: '#555' }}>
            Crée un bloc BR indépendant · personnage actif : <span style={{ color: cColor }}>{activeChar || '(défaut)'}</span>
          </div>
        </div>
      )}

      {/* Note popover */}
      {showNote && target && (
        <div style={{
          position: 'fixed', bottom: dropdownAnchor.bottom, right: 160, zIndex: 9999,
          background: '#0c0c0c', border: '1px dashed #f5c518', borderRadius: 4,
          padding: 8, minWidth: 280, boxShadow: '0 6px 18px rgba(0,0,0,0.7)',
        }}>
          <div style={{ fontSize: 9, color: '#f5c518', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Note — réplique #{targetIdx + 1}
          </div>
          <textarea value={target.note || ''} onChange={e => updateTarget({ note: e.target.value })} rows={2}
            placeholder="Intention, ton, timing…"
            style={{ width: '100%', fontFamily: 'var(--font-ui)', fontStyle: 'italic', fontSize: 11, padding: '5px 7px', background: '#0a0a0a', color: '#f5c518c', border: '1px solid #f5c5184', borderRadius: 3, resize: 'vertical' }} />
        </div>
      )}
    </div>
  )
}

const menuHeader = {
  padding: '6px 10px 4px', fontSize: 10, color: 'var(--text3)',
  borderBottom: '1px solid #1a1a1a', marginBottom: 3,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const menuSubHeader = {
  padding: '4px 10px 2px', fontSize: 9, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: 1,
}
const menuSep = { height: 1, background: '#1a1a1a', margin: '3px 0' }

function MenuBtn({ children, onClick, danger, active }) {
  const [h, setH] = React.useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '5px 10px', fontSize: 11,
        background: h ? (danger ? 'rgba(229,69,69,0.2)' : 'rgba(245, 197, 24,0.12)') : 'transparent',
        color: danger ? 'var(--danger)' : active ? '#f5c518' : 'var(--text)',
        border: 'none', borderRadius: 2, cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >{children}</button>
  )
}
