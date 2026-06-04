import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import SubtitleEditor from './SubtitleEditor'
import ExportPanel from './ExportPanel'
import RecorderPanel from './RecorderPanel'
import BRTimeline from './BRTimeline'
import { useSettings } from '../SettingsContext'
import { classifyChar, SIGN_KINDS, DEFAULT_SIGN_TOGGLES } from '../detection'
import { useProgress } from '../ProgressContext'
import { useToast } from '../ToastContext'

// BR canvas — constant-speed scrolling
// Cursor is at CURSOR_X_RATIO * W from left
// At t=sub.start the LEFT EDGE of the text is exactly at the cursor
// Text scrolls left at pxPerSec pixels/second as time passes
const CURSOR_X_RATIO = 0.32
const H_TRACK = 76
const BR_CONTROLS_H = 50
const FONT_BR_BASE = 34
const FONT_BR = 'bold 22px "JetBrains Mono", "Courier New", monospace'
const FONT_LABEL = 'bold 10px "IBM Plex Sans", sans-serif'

// Character track colors — hex for label/text/border, soft for fills, bg for legacy callers
const TRACK_COLORS = [
  { bg: 'rgba(245,197,24,0.10)',  hex: '#f5c518', soft: 'rgba(245,197,24,0.10)', text: '#f5c518', label: '#f5c518' },
  { bg: 'rgba(126,192,255,0.10)', hex: '#7ec0ff', soft: 'rgba(126,192,255,0.10)', text: '#7ec0ff', label: '#7ec0ff' },
  { bg: 'rgba(240,138,175,0.10)', hex: '#f08aaf', soft: 'rgba(240,138,175,0.10)', text: '#f08aaf', label: '#f08aaf' },
  { bg: 'rgba(126,212,168,0.10)', hex: '#7ed4a8', soft: 'rgba(126,212,168,0.10)', text: '#7ed4a8', label: '#7ed4a8' },
]

// hex (#rrggbb) + opacity (0..1) → 8-digit hex string accepted by canvas fillStyle
const withAlpha = (hex, a) => hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')

// Keyboard-hint chip shown inside toolbar buttons
const Hint = ({ children }) => (
  <span style={{ fontSize: 9, color: 'var(--text4)', fontFamily: 'var(--font-mono)', padding: '0 4px', borderRadius: 2, background: 'var(--surface3)' }}>{children}</span>
)

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
  plus:     'M12 5v14M5 12h14',
  close:    'M18 6L6 18M6 6l12 12',
  caption:  <><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="7" y1="14" x2="11" y2="14"/><line x1="14" y1="14" x2="17" y2="14"/></>,
  download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  zoomIn:   <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  zoomOut:  <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  volume:   <><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></>,
  mute:     <><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>,
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

// Font picker — manuscript options first, then maximum-legibility.
// Atkinson stays default (most readable); `lisible` (Shantell Sans) gives the
// handwritten feel without the hit to readability that pure cursive has.
const BR_FONTS = [
  { id: 'atkinson',  label: 'Atkinson Hyperlegible', stack: "'Atkinson Hyperlegible', sans-serif" },
  { id: 'lisible',   label: 'Manuscrite lisible',    stack: "'Shantell Sans', 'Caveat', cursive" },
  { id: 'cursive',   label: 'Caveat (manuscrite)',   stack: "'Caveat', cursive" },
  { id: 'inter',     label: 'Inter',                 stack: "'Inter', sans-serif" },
  { id: 'jetbrains', label: 'JetBrains Mono',        stack: "'JetBrains Mono', 'Courier New', monospace" },
]
// Uploaded fonts (id starts 'u-') resolve to the @font-face family injected
// by the fonts loader; bundled ids look up the static stack.
const brFontStack = id => {
  if (id && id.startsWith('u-')) return `'bru-${id}', 'Atkinson Hyperlegible', sans-serif`
  return (BR_FONTS.find(f => f.id === id) || BR_FONTS[0]).stack
}

// SMPTE HH:MM:SS:FF — replaces decimal `fmt` everywhere a frame-accurate
// readout is wanted (cursor, grid majors, list timecodes). Negative time is
// preserved with a leading minus so calibration marks (START at −3s) read
// correctly. `fps` defaults to 25 (PAL) when the clip doesn't carry one yet.
const fmtTC = (sec, fps = 25) => {
  if (sec == null || Number.isNaN(sec)) return '--:--:--:--'
  const f = Math.max(1, Math.round(fps))
  const neg = sec < 0
  const abs = Math.abs(sec)
  const totalFrames = Math.round(abs * f)
  const ff = totalFrames % f
  const totalSec = Math.floor(totalFrames / f)
  const ss = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const mm = totalMin % 60
  const hh = Math.floor(totalMin / 60)
  const p2 = n => String(n).padStart(2, '0')
  return `${neg ? '-' : ''}${p2(hh)}:${p2(mm)}:${p2(ss)}:${p2(ff)}`
}

// Détection sign palette colour (graphite, low-saturation so it never fights
// the dialogue text). Same on canvas and in MP4 burn (see br_renderer).
const SIGN_COLOR = '#c7ccd4'
const SIGN_COLOR_INACTIVE = 'rgba(199,204,212,0.45)'

// Resolve a word's signs: persisted wins; otherwise auto-classify from letters.
function resolveSigns(word, autoEnabled) {
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
function validWords(sub) {
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

// First-run coachmark on BR canvas — shows hidden gestures once, then never again.
function CanvasCoachmark() {
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem('br-coachmark-seen') } catch { return false }
  })
  if (!open) return null
  function dismiss() {
    try { localStorage.setItem('br-coachmark-seen', '1') } catch {}
    setOpen(false)
  }
  return (
    <div style={{
      position: 'absolute', top: 10, left: 14, right: 14, zIndex: 5,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: 'rgba(245,197,24,0.10)',
      border: '1px solid rgba(245,197,24,0.45)',
      borderRadius: 6,
      fontSize: 11.5, color: 'var(--text)',
      pointerEvents: 'auto',
    }}>
      <span style={{ color: 'var(--accent)' }}>◎</span>
      <span>
        <strong>glisser</strong> pour créer · <strong>⇧ glisser</strong> pour boucler ·
        <strong> alt glisser</strong> pour dupliquer · <strong>clic lettre</strong> pour la détection ·
        <strong> ?</strong> pour tous les raccourcis
      </span>
      <div style={{ flex: 1 }} />
      <button onClick={dismiss}
        style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
        Compris
      </button>
    </div>
  )
}

export default function DubbingWorkspace({ clip, onUpdate, onBack, onSaveStatus, exportOpen, onToggleExport }) {
  const [subtitles, setSubtitles] = useState(clip.subtitles || [])
  const [boucles, setBoucles] = useState(clip.boucles || [])
  const clipFps = clip.fps || 25
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [transcribing, setTranscribing] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [toast, setToast] = useState(null)
  const showExport = !!exportOpen
  const [brExporting, setBrExporting] = useState(false)
  const [brOffset, setBrOffset] = useState(0)
  // DOUBLAGE_IA_REVIEW §7 — default 150 px/s (comfortable reading cadence at
  // normal speech). pxPerSec is also re-measured per clip in the auto-fit block.
  const [pxPerSec, setPxPerSec] = useState(150)
  const { settings } = useSettings()
  const progress = useProgress()
  const undoToast = useToast()
  const [rythmoStyle, setRythmoStyle] = useState(settings.brStyle || 'classique')
  const [lang, setLang] = useState('fr')

  const [selectedIdx, setSelectedIdx] = useState(null)
  const [brInPlayer, setBrInPlayer] = useState('play')
  const [brFont, setBrFont] = useState(() => {
    // Pro classique default = Caveat manuscrite (DOUBLAGE_IA_REVIEW §7).
    // localStorage override wins so user choice persists across sessions.
    try { return localStorage.getItem('br-font') || 'cursive' } catch { return 'cursive' }
  })
  // Détection layer toggles — independent persisted booleans so the user can
  // hide noise without losing manual signs. `layer` is the whole-layer kill switch.
  const [detection, setDetection] = useState(() => {
    try {
      const raw = localStorage.getItem('br-detection')
      return raw ? { ...DEFAULT_SIGN_TOGGLES, ...JSON.parse(raw) } : { ...DEFAULT_SIGN_TOGGLES }
    } catch { return { ...DEFAULT_SIGN_TOGGLES } }
  })
  const [detectionAuto, setDetectionAuto] = useState(() => {
    try { return localStorage.getItem('br-detection-auto') !== 'false' } catch { return true }
  })
  const [wordByWord, setWordByWord] = useState(() => {
    try { return localStorage.getItem('br-word-by-word') !== 'false' } catch { return true }
  })
  // Uploaded custom fonts — fetched + injected as @font-face for canvas/CSS.
  const [uploadedFonts, setUploadedFonts] = useState([])
  // Waveform + scene cuts for the full-clip nav timeline (BRTimeline).
  const [waveformData, setWaveformData] = useState(null)
  const [sceneCuts, setSceneCuts] = useState(clip.scene_cuts || [])
  useEffect(() => { setSceneCuts(clip.scene_cuts || []) }, [clip.clip_id])
  const [sidebarWidth, setSidebarWidth] = useState(400)
  const [brPanelHeight, setBrPanelHeight] = useState(280)
  const [fontScale, setFontScale] = useState(1.0)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editText, setEditText] = useState('')
  const [hoverHint, setHoverHint] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [loopRegion, setLoopRegion] = useState(null)
  // Loop-active-réplique — lives in the transport bar (navigation aid),
  // not the band toolbar (DOUBLAGE_IA §3). Target snapshotted on toggle.
  const [loopActive, setLoopActive] = useState(false)
  const loopSubRef = useRef(null)
  const [locked, setLocked] = useState(false)
  // DOUBLAGE_IA_REVIEW §6.2 — header character pills FILTER the band.
  // Empty set = no filter (show all). Multi-select toggle: click adds/removes.
  const [charFilter, setCharFilter] = useState(() => new Set())
  const charFilterRef = useRef(charFilter)
  useEffect(() => { charFilterRef.current = charFilter }, [charFilter])

  function toggleCharFilter(char) {
    setCharFilter(prev => {
      const next = new Set(prev)
      if (next.has(char)) next.delete(char); else next.add(char)
      return next
    })
  }
  function clearCharFilter() { setCharFilter(new Set()) }
  const [showRecorder, setShowRecorder] = useState(false)
  const [rightTab, setRightTab] = useState('repliques')
  const [takes, setTakes] = useState([])
  const [comediens, setComediens] = useState({})
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
  const pxPerSecRef = useRef(180)
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
  const brFontRef = useRef('atkinson')
  const wordByWordRef = useRef(true)
  const detectionRef = useRef(detection)
  const detectionAutoRef = useRef(detectionAuto)
  const bouclesRef = useRef(boucles)
  const clipFpsRef = useRef(clipFps)
  const sceneCutsRef = useRef([])
  const resumeTimeRef = useRef(null)
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
  brFontRef.current = brFont
  wordByWordRef.current = wordByWord
  detectionRef.current = detection
  detectionAutoRef.current = detectionAuto
  bouclesRef.current = boucles
  clipFpsRef.current = clipFps
  sceneCutsRef.current = sceneCuts

  const masterUrl = `/${clip.segment_path}`
  // Proxy playback (720p) for smooth scrubbing of heavy segments.
  const [hasProxy, setHasProxy] = useState(!!clip.has_proxy)
  const [useProxy, setUseProxy] = useState(!!clip.has_proxy)
  const [proxyJob, setProxyJob] = useState(false)
  const segmentUrl = (useProxy && hasProxy)
    ? `/segments/${clip.clip_id}_proxy.mp4`
    : masterUrl

  const charMap = useMemo(() => {
    const seen = []
    for (const s of subtitles) {
      const c = s.character || ''
      if (!seen.includes(c)) seen.push(c)
    }
    return Object.fromEntries(seen.map((c, i) => [c, i]))
  }, [subtitles])

  const numTracks = Math.max(1, Object.keys(charMap).length)
  const canvasH = Math.min(numTracks * H_TRACK, 240)
  const charList = useMemo(() => Object.keys(charMap), [charMap])
  charMapRef.current = charMap
  numTracksRef.current = numTracks
  canvasHRef.current = canvasH

  const activeSubtitle = useMemo(() => {
    const t = currentTime + brOffset
    return subtitles.find(s => t >= s.start && t <= s.end) || null
  }, [subtitles, currentTime, brOffset])

  function toggleLoopActive() {
    if (loopActive) { setLoopActive(false); return }
    const sub = (selectedIdx != null ? subtitles[selectedIdx] : null) || activeSubtitle
    if (!sub) return
    loopSubRef.current = sub
    const v = videoRef.current
    if (v && (v.currentTime < sub.start || v.currentTime > sub.end)) v.currentTime = sub.start
    setLoopActive(true)
  }
  useEffect(() => {
    if (!loopActive) return
    const v = videoRef.current; if (!v) return
    const check = () => {
      const s = loopSubRef.current
      if (s && v.currentTime > s.end + 0.05) v.currentTime = s.start
    }
    v.addEventListener('timeupdate', check)
    return () => v.removeEventListener('timeupdate', check)
  }, [loopActive])

  // Load comédien names (per-clip, local)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`br-comediens-${clip.clip_id}`)
      setComediens(raw ? JSON.parse(raw) : {})
    } catch { setComediens({}) }
  }, [clip.clip_id])

  function setComedien(char, name) {
    setComediens(prev => {
      const next = { ...prev, [char]: name }
      try { localStorage.setItem(`br-comediens-${clip.clip_id}`, JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Fetch takes (refreshed when right pane tab changes or recorder toggles)
  useEffect(() => {
    fetch(`/api/takes/${clip.clip_id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => Array.isArray(data) && setTakes(data))
      .catch(() => {})
  }, [clip.clip_id, rightTab, showRecorder])

  // Report save status up to the App top bar
  useEffect(() => { onSaveStatus?.(saveStatus) }, [saveStatus, onSaveStatus])

  // Persist BR font choice
  useEffect(() => { try { localStorage.setItem('br-font', brFont) } catch {} }, [brFont])

  // Persist détection toggles
  useEffect(() => { try { localStorage.setItem('br-detection', JSON.stringify(detection)) } catch {} }, [detection])
  useEffect(() => { try { localStorage.setItem('br-detection-auto', String(detectionAuto)) } catch {} }, [detectionAuto])
  useEffect(() => { try { localStorage.setItem('br-word-by-word', String(wordByWord)) } catch {} }, [wordByWord])

  // Sync boucles in from clip whenever clip swaps
  useEffect(() => { setBoucles(clip.boucles || []) }, [clip.clip_id])

  // Save boucles when they change (debounced like subtitles)
  const bouclesDebounceRef = useRef(null)
  function saveBoucles(next) {
    setBoucles(next)
    clearTimeout(bouclesDebounceRef.current)
    bouclesDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clips/${clip.clip_id}/boucles`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boucles: next }),
        })
        if (res.ok) onUpdate(await res.json())
      } catch {}
    }, 800)
  }

  // Add or split boucle at current cursor.
  function addBoucleAtCursor() {
    const v = videoRef.current
    if (!v) return
    const t = v.currentTime
    const cur = bouclesRef.current
    // Inside an existing boucle → split it at t.
    const containing = cur.find(b => t > b.start + 0.1 && t < b.end - 0.1)
    if (containing) {
      const others = cur.filter(b => b !== containing)
      saveBoucles([
        ...others,
        { ...containing, end: t },
        { start: t, end: containing.end },
      ].sort((a, b) => a.start - b.start).map((b, i) => ({ ...b, number: i + 1 })))
      return
    }
    // Otherwise create boucle from cursor to end-of-clip or next boucle start.
    const next = cur.find(b => b.start > t)
    const endT = next ? next.start : (v.duration || (clip.end - clip.start))
    if (endT - t < 0.5) return
    saveBoucles([...cur, { start: t, end: endT }]
      .sort((a, b) => a.start - b.start)
      .map((b, i) => ({ ...b, number: i + 1 })))
  }

  function removeBoucle(number) {
    const next = bouclesRef.current
      .filter(b => b.number !== number)
      .sort((a, b) => a.start - b.start)
      .map((b, i) => ({ ...b, number: i + 1 }))
    saveBoucles(next)
  }

  const [detectingScenes, setDetectingScenes] = useState(false)
  async function detectScenes() {
    setDetectingScenes(true)
    try {
      const res = await fetch(`/api/clips/${clip.clip_id}/detect-scenes?threshold=0.4`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSceneCuts(data.scene_cuts || [])
    } catch {
      // silent — non-critical aid
    } finally {
      setDetectingScenes(false)
    }
  }
  async function clearScenes() {
    setSceneCuts([])
    try { await fetch(`/api/clips/${clip.clip_id}/scenes`, { method: 'DELETE' }) } catch {}
  }

  async function generateProxy() {
    setProxyJob(true)
    const fireJob = async () => {
      const res = await fetch(`/api/clips/${clip.clip_id}/proxy?height=720`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()).job_id
    }
    try {
      const jobId = await fireJob()
      progress.start({
        kind: 'proxy', title: 'Proxy 720p', jobId, retry: fireJob,
        onDone: () => { setHasProxy(true); setUseProxy(true); setProxyJob(false) },
        onError: () => { setProxyJob(false) },
        onCancel: () => { setProxyJob(false) },
      })
    } catch { setProxyJob(false) }
  }

  // Auto-fit scroll rate, once per clip: pick pxPerSec so the densest réplique
  // sits near its natural width and lighter ones stretch out — the airy
  // VoxDub-style layout, without the user having to touch the zoom.
  const autoFitRef = useRef(null)
  useEffect(() => {
    if (!subtitles.length || autoFitRef.current === clip.clip_id) return
    autoFitRef.current = clip.clip_id
    const ctx = document.createElement('canvas').getContext('2d')
    const base = Math.max(13, Math.round(FONT_BR_BASE * fontScale))
    let need = 0
    for (const s of subtitles) {
      if (!s.text) continue
      const isReact = s.text.startsWith('(')
      ctx.font = isReact
        ? `italic 600 ${base}px 'IBM Plex Sans', sans-serif`
        : `700 ${base}px ${brFontStack(brFont)}`
      const dur = Math.max(0.1, s.end - s.start)
      need = Math.max(need, ctx.measureText(s.text).width / dur)
    }
    if (need > 0) setPxPerSec(Math.round(Math.max(100, Math.min(220, need))))
  }, [clip.clip_id, subtitles])

  // Escape closes the export modal
  useEffect(() => {
    if (!showExport) return
    const onKey = e => { if (e.key === 'Escape') onToggleExport?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showExport, onToggleExport])

  // Load uploaded fonts + inject their @font-face so canvas + CSS can render them.
  const refreshFonts = useCallback(async () => {
    try {
      const r = await fetch('/api/fonts')
      if (!r.ok) return
      const list = await r.json()
      setUploadedFonts(list)
      const css = list.map(f =>
        `@font-face{font-family:'bru-${f.id}';src:url('/uploads-fonts/${f.file}');font-display:swap;}`
      ).join('\n')
      let el = document.getElementById('br-uploaded-fonts')
      if (!el) { el = document.createElement('style'); el.id = 'br-uploaded-fonts'; document.head.appendChild(el) }
      el.textContent = css
      // Nudge the FontFace set so the canvas (which reads resolved fonts) repaints.
      if (document.fonts && list.length) {
        list.forEach(f => { try { document.fonts.load(`16px 'bru-${f.id}'`) } catch {} })
      }
    } catch {}
  }, [])
  useEffect(() => { refreshFonts() }, [refreshFonts])

  async function uploadFont(file) {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', file.name.replace(/\.(ttf|otf)$/i, ''))
    try {
      const r = await fetch('/api/fonts/upload', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`)
      await refreshFonts()
      setBrFont(data.id)   // select the freshly uploaded font
    } catch (e) {
      setToast({ msg: 'Police : ' + e.message, type: 'error' })
      setTimeout(() => setToast(null), 4000)
    }
  }
  async function deleteFont(id) {
    try {
      await fetch(`/api/fonts/${id}`, { method: 'DELETE' })
      if (brFont === id) setBrFont('atkinson')
      await refreshFonts()
    } catch {}
  }

  // Fetch waveform once on mount
  useEffect(() => {
    fetch(`/api/clips/${clip.clip_id}/waveform?samples=500`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.samples.length) {
          waveformRef.current = data
          onsetsRef.current = data.onsets || []
          setWaveformData(data)
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
      ctx.fillStyle = isNeon ? '#06060a' : isMinimal ? '#0d0d10' : '#0a0a0c'
      ctx.fillRect(0, 0, W, H)

      // Scan lines (classique only)
      if (!isNeon && !isMinimal) {
        ctx.fillStyle = 'rgba(255,255,255,0.012)'
        for (let sy = 0; sy < H; sy += 3) ctx.fillRect(0, sy, W, 1)
      }

      // Track separators
      for (let track = 1; track < numTracks; track++) {
        const trackH = H / numTracks
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'
        ctx.lineWidth = 1
        ctx.setLineDash([])
        ctx.beginPath(); ctx.moveTo(0, track * trackH); ctx.lineTo(W, track * trackH); ctx.stroke()
      }

      // Time grid — vertical 1s lines, major every 5s (skipped in minimal)
      if (!isMinimal) {
        const gStart = t - cursor_x / pxSec
        const gEnd = t + (W - cursor_x) / pxSec
        ctx.setLineDash([])
        ctx.lineWidth = 1
        for (let tick = Math.ceil(gStart); tick <= Math.floor(gEnd); tick++) {
          if (tick < 0) continue
          const gx = cursor_x + (tick - t) * pxSec
          const major = tick % 5 === 0
          ctx.strokeStyle = major ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)'
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
          if (major) {
            ctx.fillStyle = 'rgba(156,156,166,0.22)'
            ctx.font = '10px "JetBrains Mono", monospace'
            ctx.textBaseline = 'top'
            // SMPTE HH:MM:SS:FF — pro convention reads in frames, not decimal.
            ctx.fillText(fmtTC(tick, clipFpsRef.current), gx + 3, 3)
          }
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

      // Subtitle blocks + text — single pass, prototype-faithful insets
      // DOUBLAGE_IA_REVIEW §6.2: when header pills filter, dim non-matching subs.
      const _cFilter = charFilterRef.current
      const _filterActive = _cFilter && _cFilter.size > 0
      for (const sub of subtitlesRef.current) {
        const trackIdx = charMap[sub.character || ''] ?? 0
        const trackH = H / numTracks
        const yTop = trackIdx * trackH
        const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
        const leftX = cursor_x + (sub.start - t) * pxSec
        const rightX = cursor_x + (sub.end - t) * pxSec
        if (rightX < -10 || leftX > W + 10) continue
        const blockW = rightX - leftX
        const isActive = t >= sub.start && t <= sub.end
        const bx = Math.max(0, leftX)
        const bw = Math.min(W, rightX) - bx
        const _dimmed = _filterActive && !_cFilter.has(sub.character || '')
        if (_dimmed) ctx.globalAlpha = 0.15

        // Block fill
        if (isMinimal) {
          ctx.fillStyle = withAlpha(color.hex, isActive ? 1 : 0.4)
          ctx.fillRect(bx, yTop + trackH - 3, bw, 2)
        } else if (isNeon) {
          ctx.strokeStyle = withAlpha(color.hex, 0.53)
          ctx.lineWidth = 1.1
          ctx.setLineDash([])
          ctx.shadowColor = color.hex
          ctx.shadowBlur = isActive ? 14 : 4
          ctx.strokeRect(bx + 0.5, yTop + 4.5, bw - 1, trackH - 9)
          ctx.shadowBlur = 0
        } else {
          ctx.fillStyle = withAlpha(color.hex, isActive ? 0.28 : 0.14)
          ctx.fillRect(bx, yTop + 3, bw, trackH - 6)
          if (leftX > -1 && leftX < W) {
            ctx.fillStyle = withAlpha(color.hex, isActive ? 1 : 0.67)
            ctx.fillRect(leftX, yTop + 3, 2, trackH - 6)
          }
        }

        // Per-word text — each word fills its own time-block [start, end]:
        // squeezed to fit, stretch capped at 1.2 (held words sit left-aligned
        // with a trailing gap). No / stale word data → whole text as one word.
        if (sub.text) {
          const isReact = sub.text.startsWith('(')
          const BASE_FONT = Math.max(13, Math.round(FONT_BR_BASE * fontScaleRef.current))
          ctx.font = isReact
            ? `italic 600 ${BASE_FONT}px 'IBM Plex Sans', sans-serif`
            : `700 ${BASE_FONT}px ${brFontStack(brFontRef.current)}`
          // Expose the most recent resolved BR font on the canvas so hit-test
          // helpers (hitTestLetter for click-letter détection) can measure
          // glyphs in the same font without redoing the resolution.
          if (canvas) canvas._brFontResolved = ctx.font
          ctx.textBaseline = 'middle'

          const words = (wordByWordRef.current ? validWords(sub) : null)
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
            ctx.translate(wLeft, yTop + trackH / 2)
            ctx.scale(scaleX, 1)
            const baseFill = isReact
              ? (wActive ? color.hex : withAlpha(color.hex, 0.67))
              : (wActive ? '#fff' : 'rgba(255,255,255,0.42)')
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

            // ── Stretch marker — 2px bar at bottom of word block ──
            // Color-codes compression (amber/red) and sparse hold (blue).
            // Only drawn in word-by-word mode when scaleX deviates from natural.
            if (wordByWordRef.current && words.length > 1) {
              const mc = scaleX < 0.45
                ? 'rgba(229,69,69,0.80)'
                : scaleX < 0.75
                ? 'rgba(245,197,24,0.70)'
                : scaleX >= 1.05
                ? 'rgba(126,192,255,0.55)'
                : null
              if (mc) {
                ctx.fillStyle = mc
                ctx.fillRect(wbx, yTop + trackH - 2, wbw, 2)
              }
            }

            // ── Détection signs — graphite, pinned to letter x-positions ──
            // Drawn AFTER the glyphs (so they sit visually on top), inside the
            // same per-word block so x scales with the letter compression.
            const det = detectionRef.current
            if (det.layer) {
              const signs = resolveSigns(wd, detectionAutoRef.current)
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
                      const sy = yTop + trackH - Math.max(7, trackH * 0.10)
                      ctx.moveTo(Math.max(0, lx), sy)
                      ctx.lineTo(Math.min(W, rx), sy)
                      ctx.stroke()
                    }
                  } else if (sign.type === 'semi') {
                    ctx.lineWidth = 1.6
                    ctx.setLineDash([3, 2])
                    ctx.beginPath()
                    const sy = yTop + trackH - Math.max(6, trackH * 0.09)
                    ctx.moveTo(charX0, sy)
                    ctx.lineTo(charX0 + charW, sy)
                    ctx.stroke()
                    ctx.setLineDash([])
                  } else if (sign.type === 'fricative') {
                    const cx0 = charX0 + charW / 2
                    const sy = yTop + Math.max(4, trackH * 0.10)
                    const r = Math.max(3, trackH * 0.06)
                    ctx.lineWidth = 1.4
                    ctx.beginPath()
                    ctx.moveTo(cx0 - r, sy + r)
                    ctx.lineTo(cx0, sy)
                    ctx.lineTo(cx0 + r, sy + r)
                    ctx.stroke()
                  } else if (sign.type === 'arrondie') {
                    const cx0 = charX0 + charW / 2
                    const sy = yTop + Math.max(5, trackH * 0.12)
                    const r = Math.max(3, trackH * 0.07)
                    ctx.lineWidth = 1.6
                    ctx.beginPath()
                    ctx.arc(cx0, sy, r, 0, Math.PI * 2)
                    ctx.stroke()
                  } else if (sign.type === 'ouverte') {
                    const cx0 = charX0 + charW / 2
                    const sy = yTop + Math.max(5, trackH * 0.12)
                    const r = Math.max(3, trackH * 0.08)
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

        // ── Line flags: off / dos / ambiance / plan_cut + début/fin wedges ──
        const detTog = detectionRef.current
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
        // Note marker — small filled dot top-left of the block when sub has a note.
        if (sub.note && onScreenR > onScreenL) {
          const nx = Math.min(onScreenL + 7, W - 4)
          const ny = yTop + 7
          ctx.fillStyle = '#f5c518'
          ctx.beginPath()
          ctx.arc(nx, ny, 3, 0, Math.PI * 2)
          ctx.fill()
        }

        // début/fin wedges at the line's own boundaries — small in-track colour
        if (detTog.startEnd) {
          const wedge = Math.max(4, trackH * 0.10)
          ctx.fillStyle = withAlpha(color.hex, isActive ? 1 : 0.55)
          if (leftX > 0 && leftX < W) {
            ctx.beginPath()
            ctx.moveTo(leftX, yTop + trackH / 2 - wedge)
            ctx.lineTo(leftX + wedge, yTop + trackH / 2)
            ctx.lineTo(leftX, yTop + trackH / 2 + wedge)
            ctx.closePath()
            ctx.fill()
          }
          if (rightX > 0 && rightX < W) {
            ctx.beginPath()
            ctx.moveTo(rightX, yTop + trackH / 2 - wedge)
            ctx.lineTo(rightX - wedge, yTop + trackH / 2)
            ctx.lineTo(rightX, yTop + trackH / 2 + wedge)
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
          if (leftX > 0 && leftX < W) ctx.fillText('▸', leftX + 2, yTop + trackH / 2)
          if (rightX > 0 && rightX < W) ctx.fillText('◂', rightX - 12, yTop + trackH / 2)
        }
        if (_dimmed) ctx.globalAlpha = 1
      }

      // ── Calibration marks: START −3s · BIP 1000 Hz −2s · PI 0s ──
      // Anchored to clip time 0 (= PI / première image). Band already scrolls
      // into negative time when the user seeks past 0.
      const calibs = [
        { time: -3.0, label: 'START', kind: 'start' },
        { time: -2.0, label: 'BIP 1000 Hz', kind: 'bip' },
        { time:  0.0, label: 'PI', kind: 'pi' },
      ]
      ctx.font = 'bold 9.5px "JetBrains Mono", monospace'
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
        ctx.fillStyle = cal.kind === 'bip' ? '#7ec0ff' : '#fff'
        ctx.fillText(`${cal.label} ${fmtTC(cal.time, clipFpsRef.current)}`, cx + 4, H - 14)
      }

      // ── Scene cuts — dashed blue verticals (changement de plan, mirror plan_cut) ──
      const scenesNow = sceneCutsRef.current
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
      const bouclesNow = bouclesRef.current
      if (bouclesNow && bouclesNow.length) {
        ctx.font = 'bold 9px "JetBrains Mono", monospace'
        ctx.textBaseline = 'top'
        for (const b of bouclesNow) {
          for (const [edge, time] of [['start', b.start], ['end', b.end]]) {
            const bx = cursor_x + (time - t) * pxSec
            if (bx < -20 || bx > W + 20) continue
            ctx.strokeStyle = 'rgba(245,197,24,0.55)'
            ctx.lineWidth = 1.2
            ctx.setLineDash([6, 4])
            ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, H); ctx.stroke()
            ctx.setLineDash([])
            if (edge === 'start') {
              const cap = `B${b.number}`
              const cw = ctx.measureText(cap).width + 8
              ctx.fillStyle = 'rgba(245,197,24,0.18)'
              ctx.fillRect(bx, 0, cw, 13)
              ctx.fillStyle = '#f5c518'
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
      // SMPTE TC chip at the cursor foot — pro readout (HH:MM:SS:FF @ clip fps).
      {
        const tcLabel = fmtTC(t, clipFpsRef.current)
        ctx.font = 'bold 10px "JetBrains Mono", monospace'
        const tcW = ctx.measureText(tcLabel).width + 10
        const tcH = 16
        const tx = Math.max(2, Math.min(W - tcW - 2, cursor_x - tcW / 2))
        const ty = H - tcH - 2
        ctx.fillStyle = 'rgba(8,8,10,0.92)'
        ctx.fillRect(tx, ty, tcW, tcH)
        ctx.strokeStyle = '#f5c518'
        ctx.lineWidth = 1
        ctx.strokeRect(tx + 0.5, ty + 0.5, tcW - 1, tcH - 1)
        ctx.fillStyle = '#f5c518'
        ctx.textBaseline = 'middle'
        ctx.fillText(tcLabel, tx + 5, ty + tcH / 2)
      }

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
            const O_MIN_FONT = Math.max(7, Math.round(9 * fontScaleRef.current))
            const O_PAD = 4
            let oNextStart = Infinity
            for (const o of subtitlesRef.current) {
              if (o === sub) continue
              if ((charMapRef.current[o.character || ''] ?? 0) === trackIdx && o.start >= sub.end && o.start < oNextStart) oNextStart = o.start
            }
            const oRoomRightX = oNextStart === Infinity ? oW : Math.min(oW, oCursorX + (oNextStart - t) * pxSec - 3)
            const oAvailW = Math.max((rightX - leftX) - O_PAD, oRoomRightX - leftX - O_PAD)
            let oFontSize = O_BASE_FONT
            oc.font = `bold ${oFontSize}px "Courier New", monospace`
            const oNatW = oc.measureText(sub.text).width
            if (oNatW > oAvailW && oAvailW > 0) {
              oFontSize = Math.max(O_MIN_FONT, Math.floor(O_BASE_FONT * oAvailW / oNatW))
              oc.font = `bold ${oFontSize}px "Courier New", monospace`
            }
            oc.textBaseline = 'middle'
            const inactiveFill = oIsNeon ? 'rgba(220,240,255,0.55)' : 'rgba(255,255,255,0.35)'
            oc.save()
            oc.beginPath()
            const oClipX = Math.max(0, leftX)
            oc.rect(oClipX, trackIdx * oTrackH + 1, Math.max(bw, oRoomRightX - oClipX), oTrackH - 2)
            oc.clip()
            oc.translate(leftX + O_PAD, trackIdx * oTrackH + oTrackH / 2)
            let oDrawText = sub.text
            const oFinalW = oc.measureText(oDrawText).width
            if (oFinalW > oAvailW && oAvailW > 0) {
              const oEllipsisW = oc.measureText('…').width
              const oBudget = Math.max(0, oAvailW - oEllipsisW)
              let oLo = 0, oHi = oDrawText.length
              while (oLo < oHi) {
                const oMid = (oLo + oHi + 1) >> 1
                if (oc.measureText(oDrawText.slice(0, oMid)).width <= oBudget) oLo = oMid
                else oHi = oMid - 1
              }
              oDrawText = oDrawText.slice(0, oLo).trimEnd() + '…'
            }
            const segs = oDrawText.split(/(\*)/)
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
      // Undo / redo — Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z. Intercept before transport.
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoRedoRef.current.undo(); return }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); undoRedoRef.current.redo(); return }
      }
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
            // Shift+← = one frame back; ← = 1s back
            const step = e.shiftKey ? 1 / (clipFpsRef.current || 25) : 1
            v.currentTime = Math.max(0, t - step)
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.ctrlKey || e.metaKey) {
            const next = subs.find(s => s.start > t + 0.05)
            if (next) v.currentTime = next.start
          } else {
            // Shift+→ = one frame forward; → = 1s forward
            const step = e.shiftKey ? 1 / (clipFpsRef.current || 25) : 1
            v.currentTime = Math.min(v.duration || 0, t + step)
          }
          break
        case ',': e.preventDefault(); v.pause(); v.currentTime = Math.max(0, t - 0.04); break
        case '.': e.preventDefault(); v.pause(); v.currentTime = Math.min(v.duration || 0, t + 0.04); break
        case 'Delete': case 'Backspace':
          if (activeI >= 0) { e.preventDefault(); deleteReplicaWithUndo(activeI) }
          break
        case 'Enter':
          if (e.shiftKey) {
            e.preventDefault()
            handleSubtitlesChange([...subs, { start: t, end: t + 1.5, character: '', text: '', reactions: [] }].sort((a, b) => a.start - b.start))
          }
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

  function gotoPrevSub() {
    const v = videoRef.current; if (!v) return
    const t = v.currentTime
    const subs = subtitlesRef.current
    const i = subs.findIndex(s => s.start > t - 0.01)
    const ti = i <= 0 ? 0 : i - 1
    if (subs[ti]) { v.currentTime = subs[ti].start; setSelectedIdx(ti) }
  }
  function gotoNextSub() {
    const v = videoRef.current; if (!v) return
    const t = v.currentTime
    const subs = subtitlesRef.current
    const i = subs.findIndex(s => s.start > t + 0.01)
    if (i >= 0) { v.currentTime = subs[i].start; setSelectedIdx(i) }
  }

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

  // ── Undo / redo — subtitle snapshots, capped at 50 ──
  const historyRef = useRef(null)            // { stack: snapshot[], idx }
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const HISTORY_CAP = 50
  const snap = subs => JSON.parse(JSON.stringify(subs))
  function syncHistoryFlags() {
    const h = historyRef.current
    setCanUndo(!!h && h.idx > 0)
    setCanRedo(!!h && h.idx < h.stack.length - 1)
  }
  function pushHistory(subs) {
    let h = historyRef.current
    if (!h) { historyRef.current = { stack: [snap(subs)], idx: 0 }; syncHistoryFlags(); return }
    // Drop the redo branch, append, cap.
    h.stack = h.stack.slice(0, h.idx + 1)
    h.stack.push(snap(subs))
    if (h.stack.length > HISTORY_CAP) h.stack.shift()
    h.idx = h.stack.length - 1
    syncHistoryFlags()
  }
  function applyHistorySubs(subs) {
    const sorted = [...subs].sort((a, b) => a.start - b.start)
    setSubtitles(sorted)
    setSelectedIdx(null)
    setSaveStatus('unsaved')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(sorted), 1500)
  }
  function undo() {
    const h = historyRef.current
    if (!h || h.idx <= 0) return
    h.idx -= 1
    applyHistorySubs(snap(h.stack[h.idx]))
    syncHistoryFlags()
  }
  function redo() {
    const h = historyRef.current
    if (!h || h.idx >= h.stack.length - 1) return
    h.idx += 1
    applyHistorySubs(snap(h.stack[h.idx]))
    syncHistoryFlags()
  }
  // Keep keydown (empty-dep closure) calling the latest undo/redo.
  const undoRedoRef = useRef({ undo, redo })
  undoRedoRef.current = { undo, redo }
  // Seed history with the initial subtitles once per clip.
  const historySeedRef = useRef(null)
  useEffect(() => {
    if (historySeedRef.current === clip.clip_id) return
    historySeedRef.current = clip.clip_id
    historyRef.current = { stack: [snap(clip.subtitles || [])], idx: 0 }
    syncHistoryFlags()
  }, [clip.clip_id])

  function handleSubtitlesChange(subs) {
    const sorted = [...subs].sort((a, b) => a.start - b.start)
    // Track selectedIdx through sort (objects share references from spread-sort)
    if (selectedIdx != null && selectedIdx < subs.length) {
      const ref = subs[selectedIdx]
      const newIdx = sorted.indexOf(ref)
      if (newIdx !== selectedIdx && newIdx >= 0) setSelectedIdx(newIdx)
    }
    setSubtitles(sorted)
    pushHistory(sorted)
    setSaveStatus('unsaved')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(sorted), 1500)
  }

  // Réplique delete via undo toast — 5s window to recover before auto-save commits.
  function deleteReplicaWithUndo(idx) {
    const subs = subtitlesRef.current
    const removed = subs[idx]
    if (!removed) return
    const next = subs.filter((_, i) => i !== idx)
    handleSubtitlesChange(next)
    if (selectedIdx === idx) setSelectedIdx(null)
    undoToast.undo({
      msg: removed.text
        ? `Réplique « ${removed.text.slice(0, 32)}${removed.text.length > 32 ? '…' : ''} » supprimée`
        : 'Réplique supprimée',
      onUndo: () => {
        // Re-insert at original position (sort will place by start).
        const restored = [...subtitlesRef.current, removed]
        handleSubtitlesChange(restored)
      },
    })
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

  // DOUBLAGE_IA_REVIEW §6 — click a letter on the band to cycle its detection sign.
  // Returns { subIdx, wordIdx, charIdx } or null. Hit-tests using the current
  // render geometry (cursor_x, pxSec, word stretch). Mirrors the draw loop math.
  function hitTestLetter(e) {
    const c = canvasCoords(e); if (!c) return null
    const cH = canvasHRef.current
    const n = numTracksRef.current
    const trackH = cH / n
    const trackIdx = Math.min(n - 1, Math.max(0, Math.floor(c.y / trackH)))
    const cMap = charMapRef.current
    const subs = subtitlesRef.current
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.save()
    // Same font as draw loop — see drawing pass for the FONT_BR / brFont scaling.
    const baseFont = canvas._brFontResolved || FONT_BR
    ctx.font = baseFont
    let result = null
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i]
      const sTrack = cMap[sub.character || ''] ?? 0
      if (sTrack !== trackIdx) continue
      const left = c.cursor_x + (sub.start - c.t) * c.pxSec
      const right = c.cursor_x + (sub.end - c.t) * c.pxSec
      if (c.x < left || c.x > right) continue
      const words = (wordByWord ? validWords(sub) : null) || [{ w: sub.text || '', start: sub.start, end: sub.end }]
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

  // Cycle sign at (sub, word, char): none → labiale → semi → fricative → arrondie → ouverte → none.
  function cycleSignAt(subIdx, wordIdx, charIdx) {
    const subs = subtitlesRef.current
    const sub = subs[subIdx]
    if (!sub) return
    const words = sub.words || []
    const wd = words[wordIdx]
    if (!wd) return
    const signs = Array.isArray(wd.signs) ? [...wd.signs] : []
    const existing = signs.findIndex(s => s.i === charIdx)
    const order = [null, 'labiale', 'semi', 'fricative', 'arrondie', 'ouverte']
    const cur = existing >= 0 ? signs[existing].type : null
    const nextType = order[(order.indexOf(cur) + 1) % order.length]

    if (nextType == null) {
      if (existing >= 0) signs.splice(existing, 1)
    } else {
      // Time span: use the letter's slice of the word duration.
      const len = (wd.w || '').length || 1
      const dur = Math.max(0.05, (wd.end || 0) - (wd.start || 0))
      const t0 = (wd.start || 0) + (charIdx / len) * dur
      const t1 = (wd.start || 0) + ((charIdx + 1) / len) * dur
      const entry = { i: charIdx, type: nextType, t0, t1 }
      if (existing >= 0) signs[existing] = entry
      else signs.push(entry)
    }
    const nextWords = words.map((w, j) => j === wordIdx ? { ...w, signs: signs.length ? signs : null } : w)
    const nextSub = { ...sub, words: nextWords }
    const nextSubs = subs.map((s, j) => j === subIdx ? nextSub : s)
    handleSubtitlesChange(nextSubs)
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
      // Plain click on a block — try letter cycle first (no modifiers, mid zone).
      // Falls through to seek if no letter hit.
      if (!e.shiftKey && !e.altKey && !e.ctrlKey && drag.mode === 'shift') {
        const letterHit = hitTestLetter(e)
        if (letterHit) {
          cycleSignAt(letterHit.subIdx, letterHit.wordIdx, letterHit.charIdx)
          return
        }
      }
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
    setPxPerSec(p => Math.max(40, Math.min(600, p + (e.deltaY < 0 ? 20 : -20))))
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
      deleteReplicaWithUndo(i)
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
    const fireJob = async () => {
      const res = await fetch('/api/transcription/transcribe-job', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_id: clip.clip_id, language: lang === 'auto' ? null : lang }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { job_id } = await res.json()
      return job_id
    }
    try {
      const jobId = await fireJob()
      progress.start({
        kind: 'transcribe',
        title: 'Transcription Whisper',
        jobId,
        retry: fireJob,
        onDone: (result) => {
          if (result && result.subtitles) handleSubtitlesChange(result.subtitles)
          setToast({ msg: 'Transcription terminée', type: 'success' })
          setTranscribing(false)
          setTimeout(() => setToast(null), 3000)
        },
        onError: (err) => {
          setToast({ msg: 'Erreur : ' + err.message, type: 'error' })
          setTranscribing(false)
          setTimeout(() => setToast(null), 4000)
        },
        onCancel: () => {
          setToast({ msg: 'Transcription annulée', type: 'error' })
          setTranscribing(false)
          setTimeout(() => setToast(null), 3000)
        },
      })
    } catch (e) {
      setToast({ msg: 'Erreur : ' + e.message, type: 'error' })
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

  const Kbd = ({ children }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 5px', border: '1px solid var(--border2)', background: 'var(--surface2)', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--text3)' }}>{children}</span>
  )
  const tBtn = { background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 5, padding: '4px 7px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, border-color 0.15s' }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Clip header ── */}
      <div style={{ padding: '0 14px', height: 56, flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
        <button onClick={onBack} style={{ padding: '4px 10px', background: 'none', color: 'var(--text2)', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
          ← Mes clips
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border2)', flexShrink: 0 }} />
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.1 }}>{clip.name}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            {(clip.end - clip.start).toFixed(1)}s · {subtitles.length} réplique{subtitles.length !== 1 ? 's' : ''}{charList.filter(c => c).length > 0 ? ` · ${charList.filter(c => c).length} personnage${charList.filter(c => c).length !== 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Character chips — click to filter band + list (multi-select). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', minWidth: 0, maxWidth: 480 }}>
          {charList.filter(c => c).map(char => {
            const color = TRACK_COLORS[(charMap[char] ?? 0) % TRACK_COLORS.length]
            const active = charFilter.has(char)
            const dimOthers = charFilter.size > 0 && !active
            return (
              <button
                key={char}
                onClick={() => toggleCharFilter(char)}
                title={active ? `Cliquer pour retirer ${char} du filtre` : `Filtrer sur ${char}`}
                style={{
                  padding: '3px 9px 3px 5px', borderRadius: 99,
                  background: active ? color.hex + '44' : color.hex + '22',
                  border: `1px solid ${active ? color.hex : color.hex + '33'}`,
                  color: color.hex,
                  fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  opacity: dimOthers ? 0.55 : 1,
                  cursor: 'pointer', minHeight: 26,
                }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: color.hex + '22', border: `1px solid ${color.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                  {char[0].toUpperCase()}
                </span>
                {char}
              </button>
            )
          })}
          {charFilter.size > 0 && (
            <button
              onClick={clearCharFilter}
              title="Effacer le filtre"
              style={{
                padding: '3px 9px', borderRadius: 99,
                background: 'var(--surface2)', border: '1px solid var(--border2)',
                color: 'var(--text2)', fontSize: 11, cursor: 'pointer', minHeight: 26,
              }}>
              ✕ filtré ({charFilter.size})
            </button>
          )}
        </div>
        <button
          onClick={() => {
            const name = window.prompt('Nom du nouveau personnage :')
            if (name == null || !name.trim()) return
            const v = videoRef.current
            const t = v ? v.currentTime : 0
            handleSubtitlesChange([...subtitles, { start: t, end: t + 1.5, character: name.trim(), text: '', reactions: [] }].sort((a, b) => a.start - b.start))
          }}
          title="Ajouter un personnage"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'none', color: 'var(--text2)', border: '1px dashed var(--border2)', borderRadius: 6, fontSize: 11.5, fontWeight: 600, flexShrink: 0, cursor: 'pointer' }}>
          <Ic d={ICONS.plus} size={12} /> Ajouter
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border2)', flexShrink: 0 }} />
        <select value={lang} onChange={e => setLang(e.target.value)} disabled={transcribing}
          style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 7px', fontSize: 11, flexShrink: 0, cursor: 'pointer' }}>
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <button onClick={transcribe} disabled={transcribing}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'var(--surface2)', color: subtitles.length > 0 ? 'var(--text2)' : 'var(--accent)', border: `1px solid ${subtitles.length > 0 ? 'var(--border2)' : 'rgba(245,197,24,0.4)'}`, borderRadius: 6, fontSize: 11.5, fontWeight: 600, flexShrink: 0, cursor: 'pointer' }}>
          <Ic d={ICONS.mic} size={12} /> {transcribing ? '…' : 'Whisper'}
        </button>
      </div>

      {/* ── Body (video stage + right pane) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Video stage */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: '#000' }}>
          {/* Video */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
            <video
              ref={videoRef}
              src={segmentUrl}
              preload="metadata"
              crossOrigin="anonymous"
              style={{ width: '88%', maxHeight: '100%', display: 'block', objectFit: 'contain', cursor: 'pointer', aspectRatio: '16/9' }}
              onTimeUpdate={e => {
                const ct = e.target.currentTime
                setCurrentTime(ct)
                if (!e.target.paused) interpTimeRef.current = { videoTime: ct, wallMs: performance.now(), active: true }
              }}
              onLoadedMetadata={e => {
                setDuration(e.target.duration)
                // Restore playhead after a Master/Proxy source swap.
                if (resumeTimeRef.current != null) {
                  try { e.target.currentTime = resumeTimeRef.current } catch {}
                  resumeTimeRef.current = null
                }
              }}
              onPlay={() => { setPlaying(true); interpTimeRef.current = { videoTime: videoRef.current?.currentTime || 0, wallMs: performance.now(), active: true } }}
              onPause={() => { setPlaying(false); interpTimeRef.current = { ...interpTimeRef.current, active: false } }}
              onClick={togglePlay}
            />
            {/* Timecode overlay */}
            <div style={{ position: 'absolute', top: 8, left: '6%', padding: '3px 8px', background: 'rgba(0,0,0,0.55)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text2)', pointerEvents: 'none' }}>
              <span style={{ color: 'var(--accent)' }}>●</span> {fmt(currentTime)} / {fmt(duration)} · {speed}×
            </div>
            {/* Subtitle burn-in */}
            {brInPlayer !== 'never' && (brInPlayer === 'always' || playing) && (
              <div style={{
                position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.78)', color: '#fff', padding: '6px 16px',
                borderRadius: 3, fontSize: 14, maxWidth: '88%', minWidth: 120, textAlign: 'center',
                fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                borderTop: `2px solid ${activeSubtitle ? TRACK_COLORS[(charMap[activeSubtitle.character || ''] ?? 0) % TRACK_COLORS.length].label : 'var(--border2)'}`,
                pointerEvents: 'none', opacity: activeSubtitle ? 1 : 0.5,
              }}>
                {activeSubtitle?.character && (
                  <div style={{ color: TRACK_COLORS[(charMap[activeSubtitle.character || ''] ?? 0) % TRACK_COLORS.length].label, fontSize: 9, marginBottom: 2, letterSpacing: 2.5, fontWeight: 700 }}>
                    {activeSubtitle.character.toUpperCase()}
                  </div>
                )}
                {activeSubtitle ? activeSubtitle.text : ' '}
              </div>
            )}
            {subtitles.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 11, color: '#2a2a2a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Aperçu Clip</span>
              </div>
            )}
          </div>

          {/* Mini transport */}
          <div style={{ flexShrink: 0, height: 44, background: 'var(--bg2)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6 }}>
            <button onClick={() => seekTo(0)} style={tBtn}><Ic d={ICONS.start} size={14} /></button>
            <button onClick={gotoPrevSub} style={tBtn}><Ic d={ICONS.prev} size={14} /></button>
            <button onClick={togglePlay} style={{ ...tBtn, background: 'var(--accent)', color: '#000', border: 'none', width: 32, height: 28, borderRadius: 3 }}>
              <Ic d={playing ? ICONS.pause : ICONS.play} size={14} fill="#000" />
            </button>
            <button onClick={gotoNextSub} style={tBtn}><Ic d={ICONS.next} size={14} /></button>
            <button onClick={() => { const v = videoRef.current; if (v) v.currentTime = v.duration }} style={tBtn}><Ic d={ICONS.end} size={14} /></button>
            <button onClick={toggleLoopActive} title="Boucler sur la réplique active/sélectionnée"
              style={{ ...tBtn, color: loopActive ? 'var(--accent)' : 'var(--text2)', background: loopActive ? 'var(--accent-soft)' : undefined }}>
              <Ic d={ICONS.loop} size={14} />
            </button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text2)', flexShrink: 0, marginLeft: 4 }}>
              {fmt(currentTime)} / {fmt(duration)}
            </span>
            <input type="range" min={0} max={duration || 1} step={0.05} value={currentTime}
              onChange={e => seekTo(parseFloat(e.target.value))}
              style={{ flex: 1, color: '#f5c518', cursor: 'pointer', height: 3, '--pct': `${(currentTime / (duration || 1)) * 100}%` }} />
            <select value={speed} onChange={e => changeSpeed(e.target.value)}
              style={{ background: 'var(--surface3)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 3, padding: '2px 4px', fontSize: 10, flexShrink: 0 }}>
              {[0.5, 0.75, 1, 1.25, 1.5].map(s => <option key={s} value={s}>{s}×</option>)}
            </select>
            <button onClick={toggleMute} title={muted ? 'Activer le son' : 'Couper le son'} style={{ ...tBtn, color: muted ? 'var(--text4)' : 'var(--text2)' }}>
              <Ic d={muted ? ICONS.mute : ICONS.volume} size={14} />
            </button>
            {/* Proxy 720p — generate once, then toggle Master / Proxy for smooth scrubbing */}
            {hasProxy ? (
              <button onClick={() => { const v = videoRef.current; resumeTimeRef.current = v ? v.currentTime : 0; setUseProxy(p => !p) }}
                title="Basculer Master / Proxy 720p"
                style={{ ...tBtn, padding: '3px 8px', fontSize: 10, fontWeight: 700, color: useProxy ? 'var(--accent)' : 'var(--text3)', border: `1px solid ${useProxy ? 'rgba(245,197,24,0.4)' : 'var(--border2)'}`, borderRadius: 5 }}>
                {useProxy ? '720p' : 'MASTER'}
              </button>
            ) : (
              <button onClick={generateProxy} disabled={proxyJob}
                title="Générer un proxy 720p (scrubbing fluide des segments lourds)"
                style={{ ...tBtn, padding: '3px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 5, opacity: proxyJob ? 0.5 : 1 }}>
                {proxyJob ? '…' : 'Proxy'}
              </button>
            )}
            <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0, margin: '0 2px' }} />
            {/* Subtitle display mode — cycles play → always → never */}
            <button
              onClick={() => setBrInPlayer(m => m === 'play' ? 'always' : m === 'always' ? 'never' : 'play')}
              title="Sous-titres incrustés sur la vidéo — cliquer pour changer"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                fontSize: 10.5, fontWeight: 600, letterSpacing: 0.2,
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                background: brInPlayer === 'always' ? 'var(--accent)' : brInPlayer === 'play' ? 'var(--accent-soft)' : 'var(--surface2)',
                color: brInPlayer === 'always' ? '#000' : brInPlayer === 'play' ? 'var(--accent)' : 'var(--text4)',
                border: `1px solid ${brInPlayer === 'always' ? 'var(--accent)' : brInPlayer === 'play' ? 'rgba(245,197,24,0.45)' : 'var(--border2)'}`,
              }}>
              <Ic d={ICONS.caption} size={13} />
              {brInPlayer === 'play' ? 'Sous-titres : lecture' : brInPlayer === 'always' ? 'Sous-titres : toujours' : 'Sous-titres : masqués'}
            </button>
            {/* BR text size */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <button onClick={() => setFontScale(f => Math.max(0.3, +(f - 0.15).toFixed(2)))} title="Texte BR −" style={{ ...tBtn, padding: '3px 6px' }}>A−</button>
              <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: fontScale !== 1 ? 'var(--accent)' : 'var(--text3)', minWidth: 32, textAlign: 'center' }}>{Math.round(fontScale * 100)}%</span>
              <button onClick={() => setFontScale(f => Math.min(3, +(f + 0.15).toFixed(2)))} title="Texte BR +" style={{ ...tBtn, padding: '3px 6px' }}>A+</button>
            </div>
            {/* BR font */}
            <select value={brFont} onChange={e => setBrFont(e.target.value)} title="Police de la bande rythmo"
              style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 6px', fontSize: 10.5, flexShrink: 0, cursor: 'pointer' }}>
              {BR_FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              {uploadedFonts.length > 0 && <optgroup label="Mes polices">
                {uploadedFonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </optgroup>}
            </select>
          </div>
        </div>

        {/* Right pane resize handle */}
        <div
          onMouseDown={e => {
            e.preventDefault()
            const startX = e.clientX
            const startW = sidebarWidth
            const onMove = ev => setSidebarWidth(Math.max(300, Math.min(680, startW - (ev.clientX - startX))))
            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
          style={{ width: 5, flexShrink: 0, cursor: 'col-resize', background: 'transparent', transition: 'background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f5c51844' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        />

        {/* Right pane (resizable) */}
        <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--border)', background: 'var(--bg)' }}>

          {/* Active character card — shown only during playback; empty state in gaps */}
          {playing && (() => {
            const trackIdx = activeSubtitle ? (charMap[activeSubtitle.character || ''] ?? 0) : 0
            const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
            const subIdx = activeSubtitle ? subtitles.indexOf(activeSubtitle) : -1
            return (
              <div style={{ flexShrink: 0, padding: '10px 14px', background: activeSubtitle ? color.hex + '14' : 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, border: `2px solid ${activeSubtitle ? color.hex : 'var(--border2)'}`, background: activeSubtitle ? color.hex + '22' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: activeSubtitle ? color.hex : 'var(--text4)' }}>
                  {activeSubtitle ? (activeSubtitle.character || '?')[0].toUpperCase() : '—'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: activeSubtitle ? color.hex : 'var(--text4)' }}>{activeSubtitle ? (activeSubtitle.character || '(défaut)') : '—'}</span>
                    {activeSubtitle && <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text3)' }}>· ACTIF</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    {activeSubtitle
                      ? `réplique ${subIdx + 1} / ${subtitles.length} · ${(activeSubtitle.end - activeSubtitle.start).toFixed(1)}s`
                      : 'Hors réplique'}
                  </div>
                </div>
                <button
                  onClick={() => setShowRecorder(s => !s)}
                  disabled={!activeSubtitle}
                  title={activeSubtitle ? 'Enregistrer (R)' : 'Aucune réplique active'}
                  style={{ width: 34, height: 34, borderRadius: 4, flexShrink: 0, background: !activeSubtitle ? 'var(--surface2)' : showRecorder ? '#c0392b' : 'var(--danger)', border: 'none', cursor: activeSubtitle ? 'pointer' : 'not-allowed', opacity: activeSubtitle ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ic d={ICONS.rec} size={12} fill="#fff" />
                </button>
              </div>
            )
          })()}

          {/* Tabs */}
          <div style={{ flexShrink: 0, height: 36, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'stretch' }}>
            {[['repliques', `Répliques (${subtitles.length})`], ['personnage', 'Personnage'], ['distribution', 'Distribution']].map(([id, label]) => (
              <button key={id} onClick={() => setRightTab(id)} style={{ flex: 1, background: 'none', border: 'none', borderBottom: rightTab === id ? '2px solid var(--accent)' : '2px solid transparent', color: rightTab === id ? 'var(--text)' : 'var(--text3)', fontSize: 12, fontWeight: rightTab === id ? 600 : 400, cursor: 'pointer', padding: '0 4px', marginBottom: -1, transition: 'color 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {rightTab === 'repliques' && (
              <>
                <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                  {subtitles.length === 0 && !transcribing ? (
                    <div style={{ padding: 24, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Aucune réplique. Transcrivez ou ajoutez manuellement.</div>
                      <button onClick={transcribe} style={{ padding: '6px 16px', background: '#f5c518', color: '#000', fontWeight: 600, borderRadius: 4, fontSize: 12 }}>◉ Transcrire</button>
                    </div>
                  ) : (
                    <SubtitleEditor subtitles={subtitles} onChange={handleSubtitlesChange} onDelete={deleteReplicaWithUndo} currentTime={currentTime} onSeek={seekTo} selectedIdx={selectedIdx} setSelectedIdx={setSelectedIdx} compact={true} charFilter={charFilter} clipId={clip.clip_id} />
                  )}
                </div>
                {showRecorder && (
                  <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', maxHeight: 300, overflow: 'auto' }}>
                    <RecorderPanel
                      clipId={clip.clip_id}
                      subtitles={subtitles}
                      activeCharacter={activeSubtitle?.character || ''}
                      activeIndex={selectedIdx}
                      videoRef={videoRef}
                    />
                  </div>
                )}
              </>
            )}
            {rightTab === 'personnage' && (() => {
              const chars = charList.filter(c => c)
              if (chars.length === 0) {
                return <div style={{ padding: 16 }}><p style={{ color: 'var(--text3)', fontSize: 13 }}>Aucun personnage défini.</p></div>
              }
              const focusChar = activeSubtitle?.character
                || (selectedIdx != null && subtitles[selectedIdx]?.character)
                || chars[0]
              const trackIdx = charMap[focusChar] ?? 0
              const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
              const charIndices = subtitles.map((s, i) => ({ s, i })).filter(({ s }) => (s.character || '') === focusChar)
              const charSubs = charIndices.map(({ s }) => s)
              const totalDur = charSubs.reduce((sum, s) => sum + s.end - s.start, 0)
              const wordCount = charSubs.reduce((n, s) => (s.text && !s.text.startsWith('(')) ? n + s.text.trim().split(/\s+/).filter(Boolean).length : n, 0)
              const wpm = totalDur > 0 ? Math.round(wordCount / totalDur * 60) : 0
              const recorded = new Set(takes.filter(t => (t.character || '') === focusChar && t.subtitle_index != null).map(t => t.subtitle_index))
              const recordedCount = charIndices.filter(({ i }) => recorded.has(i)).length
              const queue = charIndices.filter(({ s }) => s.end >= currentTime).slice(0, 5)
              const stats = [
                ['Répliques', charSubs.length],
                ['Durée', totalDur.toFixed(1) + 's'],
                ['Mot/min', wpm],
                ['Prises', `${recordedCount} / ${charSubs.length}`],
              ]
              return (
                <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
                  <div style={{ padding: 14, background: color.hex + '14', border: `1px solid ${color.hex}40`, borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: color.hex + '22', border: `2px solid ${color.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: color.hex }}>
                        {focusChar[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: color.hex }}>{focusChar}</div>
                        <input
                          value={comediens[focusChar] || ''}
                          onChange={e => setComedien(focusChar, e.target.value)}
                          placeholder="Comédien·ne — nommer…"
                          style={{ background: 'none', border: 'none', borderBottom: '1px dashed var(--border2)', color: 'var(--text2)', fontSize: 11, padding: '2px 0', width: '100%', outline: 'none' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {stats.map(([k, v]) => (
                        <div key={k} style={{ padding: '7px 9px', background: 'var(--surface2)', borderRadius: 5 }}>
                          <div style={{ fontSize: 8.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>{k}</div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { setShowRecorder(true); setRightTab('repliques') }}
                      style={{ marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                      <Ic d={ICONS.rec} size={11} fill="#fff" /> Enregistrer la prise
                      <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.25)', padding: '1px 5px', borderRadius: 3 }}>R</span>
                    </button>
                  </div>

                  <div style={{ marginTop: 16, marginBottom: 8, fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>File d'attente</div>
                  {queue.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune réplique à venir.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {queue.map(({ s, i }, qi) => (
                        <button key={i} onClick={() => { seekTo(s.start); setSelectedIdx(i) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: 'var(--surface)', border: `1px solid ${recorded.has(i) ? color.hex + '40' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                          {qi === 0 && <span style={{ fontSize: 8, fontWeight: 700, color: color.hex, background: color.hex + '22', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>SUIVANT</span>}
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.text || '∅'}</span>
                          {recorded.has(i) && <Ic d={ICONS.check} size={12} style={{ color: color.hex }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
            {rightTab === 'distribution' && (
              <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
                {charList.length === 0 ? (
                  <p style={{ color: 'var(--text3)', fontSize: 13 }}>Aucune réplique.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {charList.map(char => {
                      const trackIdx = charMap[char] ?? 0
                      const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length]
                      const charSubs = subtitles.filter(s => (s.character || '') === char)
                      const totalDur = charSubs.reduce((sum, s) => sum + s.end - s.start, 0)
                      const clipDur = clip.end - clip.start
                      const pct = Math.min(100, clipDur > 0 ? (totalDur / clipDur) * 100 : 0)
                      return (
                        <div key={char || '_default'} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: color.hex + '22', border: `2px solid ${color.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: color.hex }}>
                            {(char || '?')[0].toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: color.hex, fontWeight: 600 }}>{char || '(défaut)'}</span>
                              <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{charSubs.length} répl. · {totalDur.toFixed(1)}s</span>
                            </div>
                            <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: color.hex, opacity: 0.85, borderRadius: 3, transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer hints */}
          <div style={{ flexShrink: 0, padding: '6px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Kbd>⇧↵</Kbd> nouvelle réplique
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Kbd>K</Kbd> pause · <Kbd>I/O</Kbd> in/out
            </span>
          </div>
        </div>
      </div>

      {/* ── Bande Rythmo — full width ── */}
      <div style={{ flexShrink: 0, borderTop: '2px solid var(--border2)', background: '#050505', height: brPanelHeight, display: 'flex', flexDirection: 'column', overflow: 'visible', position: 'relative' }}>
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
          onMouseEnter={e => { e.currentTarget.style.background = '#f5c51844' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        />
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
          detection={detection}
          setDetection={setDetection}
          detectionAuto={detectionAuto}
          setDetectionAuto={setDetectionAuto}
          boucles={boucles}
          onAddBoucle={addBoucleAtCursor}
          onRemoveBoucle={removeBoucle}
          sceneCuts={sceneCuts}
          onDetectScenes={detectScenes}
          onClearScenes={clearScenes}
          detectingScenes={detectingScenes}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          clipFps={clipFps}
          brFont={brFont}
          setBrFont={setBrFont}
          uploadedFonts={uploadedFonts}
          onUploadFont={uploadFont}
          onDeleteFont={deleteFont}
          wordByWord={wordByWord}
          setWordByWord={setWordByWord}
        />
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
          <CanvasCoachmark />

          {loopRegion && (
            <div style={{ position: 'absolute', top: 6, right: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(245,197,24,0.12)', border: '1px solid rgba(245,197,24,0.4)', borderRadius: 4, zIndex: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                ⟲ {fmt(loopRegion.start)}–{fmt(loopRegion.end)}
              </span>
              <button onClick={() => setLoopRegion(null)} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          )}
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
            <div style={{ position: 'absolute', bottom: 4, right: 8, fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 2, pointerEvents: 'none' }}>{hoverHint}</div>
          )}
          {ctxMenu && (() => {
            const sub = subtitles[ctxMenu.subIdx]
            if (!sub) return null
            const canSplit = ctxMenu.time > sub.start && ctxMenu.time < sub.end
            return (
              <>
                <div onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' }} />
                <div style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, background: '#0c0c0c', border: '1px solid #2a2a2a', borderRadius: 4, padding: 4, zIndex: 'var(--z-dropdown)', fontSize: 12, minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }}>
                  <div style={menuHeader}>{sub.character || '(défaut)'} · {sub.text.slice(0, 30) || '∅'}</div>
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
        {/* Full-clip nav timeline — whole clip at a glance, click/drag to seek */}
        {(() => {
          const span = ((canvasRef.current?.width || 800) / (pxPerSec || 1))
          const vStart = (currentTime + brOffset) - CURSOR_X_RATIO * span
          return (
            <BRTimeline
              duration={duration}
              currentTime={currentTime}
              boucles={boucles}
              waveform={waveformData}
              sceneCuts={sceneCuts}
              subtitles={subtitles}
              charMap={charMap}
              viewStart={vStart}
              viewEnd={vStart + span}
              onSeek={seekTo}
            />
          )
        })()}
      </div>

      {/* ── Export modal ── */}
      {showExport && (
        <div
          onClick={() => onToggleExport?.()}
          style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(0,0,0,0.66)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(960px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Ic d={ICONS.download} size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Exporter le clip</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{clip.name}</div>
              </div>
              <button onClick={() => onToggleExport?.()} title="Fermer (Échap)"
                style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer' }}>
                <Ic d={ICONS.close} size={15} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
              <ExportPanel
                segmentId={clip.clip_id}
                subtitles={subtitles}
                boucles={boucles}
                pxPerSec={pxPerSec}
                brOffset={brOffset}
                canvasH={canvasH}
                getCanvasWidth={() => canvasRef.current?.width || 1200}
                brFont={brFont}
                brStyle={rythmoStyle}
                duration={duration}
                getCurrentTime={() => videoRef.current?.currentTime || 0}
                loopRegion={loopRegion}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '10px 18px', background: toast.type === 'error' ? '#e54545' : '#44bb55', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500, zIndex: 'var(--z-toast)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
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
  detection, setDetection, detectionAuto, setDetectionAuto,
  boucles = [], onAddBoucle, onRemoveBoucle, clipFps = 25,
  sceneCuts = [], onDetectScenes = () => {}, onClearScenes = () => {}, detectingScenes = false,
  onUndo = () => {}, onRedo = () => {}, canUndo = false, canRedo = false,
  brFont = 'atkinson', setBrFont = () => {},
  uploadedFonts = [], onUploadFont = () => {}, onDeleteFont = () => {},
  wordByWord = true, setWordByWord = () => {},
}) {
  const [showDetection, setShowDetection] = React.useState(false)
  const [showBoucles, setShowBoucles] = React.useState(false)
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
  // DOUBLAGE_IA_REVIEW §3 — 6 labelled clusters:
  // Qui · Éditer · Insérer ▾ · Détection ▾ · Boucles ▾ · Affichage ▾ · 🔒
  const [showInserer, setShowInserer] = React.useState(false)
  const [showAffichage, setShowAffichage] = React.useState(false)
  const [dropdownAnchor, setDropdownAnchor] = React.useState({ bottom: 60, left: 200 })
  // Per-menu anchors so each in-toolbar dropdown can portal to body with
  // position:fixed, escaping the toolbar's overflow:auto clip + stacking ctx.
  const [charAnchor, setCharAnchor] = React.useState({ bottom: 60, left: 200 })
  const [detAnchor, setDetAnchor] = React.useState({ bottom: 60, left: 200 })
  const [boucleAnchor, setBoucleAnchor] = React.useState({ bottom: 60, left: 200 })
  const toolbarRef = React.useRef(null)
  const charPickerRef = React.useRef(null)

  // Anchor a portaled dropdown above its trigger button. Tags the trigger with
  // a data-popover attribute so the click-away effect can recognise it.
  function anchorFromEvent(e, setter, name) {
    try {
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      setter({ bottom: window.innerHeight - r.top + 4, left: r.left })
      if (name) el.setAttribute('data-popover-trigger', name)
    } catch {}
  }

  // Global click-away: portaled dropdowns + their triggers carry data-popover[-trigger].
  // A mousedown outside any matching element closes the active popover.
  React.useEffect(() => {
    const anyOpen = showCharPicker || showDetection || showBoucles ||
                    showResp || showReact || showNote || showInserer || showAffichage
    if (!anyOpen) return
    const onDown = (e) => {
      const t = e.target
      if (!t || typeof t.closest !== 'function') return
      const hit = t.closest('[data-popover], [data-popover-trigger]')
      if (hit) return
      // Click landed outside all popovers → close everything.
      setShowCharPicker(false)
      setShowDetection(false)
      setShowBoucles(false)
      setShowResp(false)
      setShowReact(false)
      setShowNote(false)
      setShowInserer(false)
      setShowAffichage(false)
    }
    // Defer one tick so the opening click doesn't immediately close.
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDown) }
  }, [showCharPicker, showDetection, showBoucles, showResp, showReact, showNote, showInserer, showAffichage])

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
      if (el && el.setAttribute) el.setAttribute('data-popover-trigger', type)
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
    color: !enabled ? 'var(--text4)' : (danger ? 'var(--danger)' : (on ? 'var(--accent)' : 'var(--text)')),
    background: on ? 'var(--accent-soft)' : 'transparent',
    cursor: enabled ? 'pointer' : 'not-allowed',
  })
  const grp = {
    display: 'inline-flex', alignItems: 'center', gap: 1,
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 2,
  }
  const sep = <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '2px 4px' }} />

  return (
    <div ref={toolbarRef} style={{
      position: 'relative', background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)', padding: '0 12px', height: 52, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', overflowX: 'auto',
    }}>
      {/* Undo / redo */}
      <div style={grp}>
        <button onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)"
          style={{ ...btn(canUndo), padding: '0 8px' }}>
          <Ic d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3" size={15} />
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl+Y)"
          style={{ ...btn(canRedo), padding: '0 8px' }}>
          <Ic d="M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3" size={15} />
        </button>
      </div>

      {/* Active character pill — click to reassign */}
      <div ref={charPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={e => { if (target) { anchorFromEvent(e, setCharAnchor, 'char'); setShowCharPicker(s => !s) } }}
          title={target ? 'Changer le personnage de cette réplique' : 'Sélectionnez une réplique'}
          style={{
            ...btnBase, height: 34, minWidth: 140, padding: '0 10px',
            background: 'var(--surface2)', border: `1px solid ${target ? cColor + '55' : 'var(--border2)'}`,
            color: target ? cColor : 'var(--text4)', fontSize: 12, fontWeight: 600, borderRadius: 8,
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
        {showCharPicker && target && createPortal(
          <div data-popover="char" style={{
            position: 'fixed', bottom: charAnchor.bottom, left: charAnchor.left, zIndex: 'var(--z-dropdown)',
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
                  {active && <span style={{ fontSize: 10, color: 'var(--accent)' }}>✓</span>}
                </button>
              )
            })}
            <div style={{ height: 1, background: '#1e1e1e', margin: '4px 0' }} />
            <button onClick={newCharacterPrompt}
              style={{ display: 'block', width: '100%', padding: '7px 12px', fontSize: 11, color: 'var(--accent)', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
              + Nouveau personnage…
            </button>
          </div>,
          document.body
        )}
      </div>

      {/* Mic — toggle "prise à enregistrer" */}
      <button
        onClick={() => { if (target) updateTarget({ take: !target.take }) }}
        title={target?.take ? 'Marquer comme enregistrée' : 'Marquer comme prise à enregistrer'}
        style={{
          ...btnBase, height: 34, width: 34, minWidth: 34, padding: 0,
          background: target?.take ? 'var(--danger)' : 'var(--surface2)',
          border: `1px solid ${target?.take ? '#ff7575' : 'var(--danger)55'}`,
          color: target?.take ? '#fff' : (target ? 'var(--danger)' : 'var(--text4)'), borderRadius: 8,
          cursor: target ? 'pointer' : 'default',
        }}>
        <Ic d={ICONS.mic} />
      </button>

      {/* IN / OUT / Couper */}
      <div style={grp}>
        <button onClick={setIN}  title="Définir IN au temps courant" style={{ ...btn(target != null), padding: '0 9px', gap: 5, fontSize: 11.5 }}>
          <Ic d={ICONS.in} size={14} />IN<Hint>I</Hint>
        </button>
        <button onClick={setOUT} title="Définir OUT au temps courant" style={{ ...btn(target != null), padding: '0 9px', gap: 5, fontSize: 11.5 }}>
          <Ic d={ICONS.out} size={14} />OUT<Hint>O</Hint>
        </button>
        <button onClick={splitAtCurrentTime} title="Couper la réplique au temps courant" style={{ ...btn(target != null), padding: '0 9px', gap: 5, fontSize: 11.5 }}>
          <Ic d={ICONS.scissors} size={14} />Couper<Hint>S</Hint>
        </button>
      </div>

      {/* Insérer ▾ — collapses Resp · Réact · Note (DOUBLAGE_IA_REVIEW §3). */}
      <div style={{ ...grp, position: 'relative' }}>
        <button
          onClick={e => {
            anchorFromEvent(e, setDropdownAnchor, 'inserer')
            setShowInserer(s => !s)
            setShowResp(false); setShowReact(false); setShowNote(false)
          }}
          title="Insérer respiration, réaction, ou note"
          style={{ ...btn(true, showInserer), padding: '0 9px', gap: 5, fontSize: 11.5 }}>
          <Ic d={ICONS.plus} size={14} />Insérer<Ic d={ICONS.chevron} size={12} />
        </button>
      </div>

      {/* Lock */}
      <div style={grp}>
        <button onClick={() => setLocked(l => !l)} title={locked ? 'Déverrouiller la BR' : 'Verrouiller la BR (empêche les éditions accidentelles)'}
          style={btn(true, locked)}><Ic d={locked ? ICONS.lock : ICONS.lockOpen} size={14} /></button>
      </div>

      {/* Pro BR — détection layer toggle + per-sign menu */}
      <div style={{ ...grp, position: 'relative' }}>
        <button
          onClick={() => setDetection(d => ({ ...d, layer: !d.layer }))}
          title="Calque détection (B/P/M, fricatives, etc.) — graphite sous le texte"
          style={{ ...btn(true, detection.layer), padding: '0 9px', gap: 5, fontSize: 11.5 }}>
          Détection
        </button>
        <button onClick={e => { anchorFromEvent(e, setDetAnchor, 'det'); setShowDetection(s => !s) }} title="Signes affichés"
          style={btn(true, showDetection)}><Ic d={ICONS.chevron} size={14} /></button>
        {showDetection && createPortal(
          <div data-popover="det" style={{
            position: 'fixed', bottom: detAnchor.bottom, left: detAnchor.left, zIndex: 'var(--z-dropdown)',
            background: '#0c0c0c', border: '1px solid #2a2a2a', borderRadius: 6,
            padding: 8, minWidth: 230, boxShadow: '0 6px 18px rgba(0,0,0,0.7)',
          }}>
            <div style={{ fontSize: 9, color: '#777', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Signes phonétiques
            </div>
            {[
              ['labiale', 'Labiale (B P M)'],
              ['semi', 'Semi (W)'],
              ['fricative', 'Fricative (F V)'],
              ['arrondie', 'Arrondie (O U Œ)'],
              ['ouverte', 'Ouverte (A E I…)'],
              ['startEnd', 'Début / Fin de phrase'],
            ].map(([k, lbl]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!detection[k]} onChange={e => setDetection(d => ({ ...d, [k]: e.target.checked }))} />
                {lbl}
              </label>
            ))}
            <div style={{ height: 1, background: '#1e1e1e', margin: '6px 0' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={detectionAuto} onChange={e => setDetectionAuto(e.target.checked)} />
              Aide auto (depuis les lettres)
            </label>
          </div>,
          document.body
        )}
      </div>

      {/* Boucles — split at cursor + list */}
      <div style={{ ...grp, position: 'relative' }}>
        <button onClick={onAddBoucle} title="Créer / scinder une boucle au temps courant"
          style={{ ...btn(true), padding: '0 9px', gap: 5, fontSize: 11.5 }}>
          Boucle +
        </button>
        <button onClick={e => { anchorFromEvent(e, setBoucleAnchor, 'boucle'); setShowBoucles(s => !s) }} title={`Boucles (${boucles.length})`}
          style={btn(true, showBoucles)}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{boucles.length}</span>
          <Ic d={ICONS.chevron} size={14} />
        </button>
        {showBoucles && createPortal(
          <div data-popover="boucle" style={{
            position: 'fixed', bottom: boucleAnchor.bottom, left: boucleAnchor.left, zIndex: 'var(--z-dropdown)',
            background: '#0c0c0c', border: '1px solid #2a2a2a', borderRadius: 6,
            padding: 8, minWidth: 260, maxHeight: 260, overflow: 'auto',
            boxShadow: '0 6px 18px rgba(0,0,0,0.7)',
          }}>
            <div style={{ fontSize: 9, color: '#777', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Boucles · fps {clipFps.toFixed(2)}
            </div>
            {boucles.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text3)', padding: 6 }}>Aucune boucle. Placez le curseur et cliquez « Boucle + ».</div>
            ) : boucles.map(b => (
              <div key={b.number} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <button onClick={() => { const v = videoRef.current; if (v) v.currentTime = b.start }}
                  style={{ background: 'none', border: 'none', color: '#f5c518', cursor: 'pointer', fontWeight: 700 }}>
                  B{b.number}
                </button>
                <span style={{ color: 'var(--text3)', flex: 1 }}>
                  {fmtTC(b.start, clipFps)} — {fmtTC(b.end, clipFps)} · {(b.end - b.start).toFixed(1)}s
                </span>
                <button onClick={() => onRemoveBoucle(b.number)} title="Supprimer cette boucle"
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>,
          document.body
        )}
      </div>

      {/* Plans — auto-detect scene cuts (changements de plan) */}
      <div style={grp}>
        <button onClick={onDetectScenes} disabled={detectingScenes}
          title="Détecter les changements de plan (ffmpeg)"
          style={{ ...btn(true, sceneCuts.length > 0), padding: '0 9px', gap: 5, fontSize: 11.5, opacity: detectingScenes ? 0.5 : 1 }}>
          <span style={{ color: '#7ea0ff' }}>▏</span>
          {detectingScenes ? '…' : 'Plans'}
          {sceneCuts.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#7ea0ff' }}>{sceneCuts.length}</span>}
        </button>
        {sceneCuts.length > 0 && (
          <button onClick={onClearScenes} title="Effacer les plans détectés" style={btn(true)}>
            <Ic d={ICONS.close} size={13} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 8 }} />

      {/* Affichage ▾ — collapses Style · Zoom · Décalage · Font · BR-in-player
          (DOUBLAGE_IA_REVIEW §3 — set-once knobs out of the way). */}
      <div style={{ ...grp, position: 'relative' }}>
        <button
          onClick={e => {
            try {
              const el = e.currentTarget
              const r = el.getBoundingClientRect()
              setDropdownAnchor({ bottom: window.innerHeight - r.top + 4, left: Math.max(8, r.right - 320) })
              if (el.setAttribute) el.setAttribute('data-popover-trigger', 'affichage')
            } catch {}
            setShowAffichage(s => !s)
          }}
          title="Affichage : style, zoom, décalage, police, sous-titre dans le player"
          style={{ ...btn(true, showAffichage), padding: '0 11px', gap: 6, fontSize: 11.5, fontWeight: 600 }}>
          Affichage<Ic d={ICONS.chevron} size={12} />
        </button>
      </div>

      {/* Respirations dropdown */}
      {showResp && createPortal(
        <div data-popover="resp" style={{
          position: 'fixed', bottom: dropdownAnchor.bottom, left: dropdownAnchor.left, zIndex: 'var(--z-dropdown)',
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
        </div>,
        document.body
      )}

      {/* Réactions dropdown */}
      {showReact && createPortal(
        <div data-popover="react" style={{
          position: 'fixed', bottom: dropdownAnchor.bottom, left: dropdownAnchor.left, zIndex: 'var(--z-dropdown)',
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
        </div>,
        document.body
      )}

      {/* Note popover */}
      {showNote && target && createPortal(
        <div data-popover="note" style={{
          position: 'fixed', bottom: dropdownAnchor.bottom, right: 160, zIndex: 'var(--z-dropdown)',
          background: '#0c0c0c', border: '1px dashed var(--accent)', borderRadius: 4,
          padding: 8, minWidth: 280, boxShadow: '0 6px 18px rgba(0,0,0,0.7)',
        }}>
          <div style={{ fontSize: 9, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Note — réplique #{targetIdx + 1}
          </div>
          <textarea value={target.note || ''} onChange={e => updateTarget({ note: e.target.value })} rows={2}
            placeholder="Intention, ton, timing…"
            style={{ width: '100%', fontFamily: 'var(--font-ui)', fontStyle: 'italic', fontSize: 11, padding: '5px 7px', background: '#0a0a0a', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 3, resize: 'vertical' }} />
        </div>,
        document.body
      )}

      {/* Insérer popover — Resp · Réact · Note all in one (DOUBLAGE_IA_REVIEW §3). */}
      {showInserer && createPortal(
        <div data-popover="inserer" style={{
          position: 'fixed', bottom: dropdownAnchor.bottom, left: dropdownAnchor.left, zIndex: 'var(--z-dropdown)',
          background: '#0c0c0c', border: '1px solid var(--border2)', borderRadius: 8,
          padding: 12, minWidth: 340, maxWidth: 400, boxShadow: '0 8px 22px rgba(0,0,0,0.75)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Insérer
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowInserer(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>

          {/* Respirations */}
          <div style={{ fontSize: 9, color: '#7ec0ff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Respirations
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {[
              { label: '(HH)', color: '#7ec0ff', dur: 0.5 },
              { label: '(H)',  color: '#7ec0ff', dur: 0.4 },
              { label: '(Hm)', color: '#7ec0ff', dur: 0.4 },
              { label: '*',    color: '#5599cc', dur: 0.3 },
              { label: '(…)',  color: '#888',    dur: 0.6 },
            ].map(r => (
              <button key={r.label}
                onClick={() => { insertTagSub(r.label, r.dur); setShowInserer(false) }}
                title={`${r.label} — ${r.dur}s`}
                style={{
                  fontSize: 12, padding: '5px 10px', fontFamily: 'var(--font-mono)',
                  background: 'rgba(126,192,255,0.06)', border: `1px solid ${r.color}44`,
                  color: r.color, borderRadius: 4, cursor: 'pointer', fontWeight: 700, minHeight: 28,
                }}>{r.label}</button>
            ))}
          </div>

          {/* Réactions */}
          <div style={{ fontSize: 9, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Réactions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {[
              { label: '(rires)',      color: 'var(--accent)', dur: 1.5 },
              { label: '(pleurs)',     color: '#ff8888', dur: 2.0 },
              { label: '(soupir)',     color: '#aaa',    dur: 1.0 },
              { label: '(cri)',        color: '#ff5a5a', dur: 0.7 },
              { label: '(chuchoté)',   color: '#88ddaa', dur: 1.2 },
              { label: '(essoufflé)',  color: '#7ec0ff', dur: 1.0 },
              { label: '(hésitation)', color: '#bb88ff', dur: 0.5 },
            ].map(r => (
              <button key={r.label}
                onClick={() => { insertTagSub(r.label, r.dur); setShowInserer(false) }}
                style={{
                  fontSize: 10.5, padding: '5px 9px', fontFamily: 'var(--font-mono)',
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${r.color}44`,
                  color: r.color, borderRadius: 4, cursor: 'pointer', minHeight: 28,
                }}>{r.label}<span style={{ fontSize: 8, opacity: 0.5, marginLeft: 4 }}>{r.dur}s</span></button>
            ))}
          </div>

          {/* Note */}
          {target ? (
            <>
              <div style={{ fontSize: 9, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Note — réplique #{targetIdx + 1}
              </div>
              <textarea
                value={target.note || ''}
                onChange={e => updateTarget({ note: e.target.value })}
                rows={2}
                placeholder="Intention, ton, timing…"
                style={{
                  width: '100%', fontFamily: 'var(--font-ui)', fontStyle: 'italic',
                  fontSize: 12, padding: '6px 8px',
                  background: 'var(--surface2)', color: 'var(--text)',
                  border: '1px solid var(--border2)', borderRadius: 5, resize: 'vertical',
                }} />
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              Sélectionnez une réplique pour ajouter une note.
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Affichage popover — Style · Zoom · Décalage · Police · BR-in-player (DOUBLAGE_IA_REVIEW §3). */}
      {showAffichage && createPortal(
        <div data-popover="affichage" style={{
          position: 'fixed', bottom: dropdownAnchor.bottom, left: dropdownAnchor.left, zIndex: 'var(--z-dropdown)',
          background: '#0c0c0c', border: '1px solid var(--border2)', borderRadius: 8,
          padding: 14, width: 340, boxShadow: '0 8px 22px rgba(0,0,0,0.75)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Affichage
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowAffichage(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>

          {/* Style */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, width: 80 }}>Style</span>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 2, flex: 1 }}>
              {['classique', 'neon', 'minimal'].map(s => (
                <button key={s} onClick={() => setRythmoStyle(s)} style={{
                  ...btnBase, height: 26, padding: '0 10px', fontSize: 10.5, borderRadius: 4, flex: 1,
                  background: rythmoStyle === s ? 'var(--accent)' : 'transparent',
                  color: rythmoStyle === s ? '#000' : 'var(--text2)',
                  fontWeight: 600, textTransform: 'capitalize',
                }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Police */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, width: 80 }}>Police</span>
            <select value={brFont} onChange={e => setBrFont(e.target.value)}
              style={{ flex: 1, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 5, padding: '5px 8px', fontSize: 12 }}>
              <option value="atkinson">Atkinson</option>
              <option value="lisible">Manuscrite lisible</option>
              <option value="cursive">Cursive (Caveat)</option>
              <option value="inter">Inter</option>
              <option value="jetbrains">JetBrains Mono</option>
              {uploadedFonts.length > 0 && <optgroup label="Mes polices">
                {uploadedFonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </optgroup>}
            </select>
          </div>

          {/* Police — import / suppression */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 80 }} />
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: 'var(--accent)', cursor: 'pointer', padding: '5px 8px', border: '1px dashed rgba(245,197,24,0.4)', borderRadius: 5 }}>
              <Ic d={ICONS.plus} size={12} /> Importer TTF/OTF
              <input type="file" accept=".ttf,.otf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUploadFont(f) }} />
            </label>
            {brFont.startsWith('u-') && (
              <button onClick={() => onDeleteFont(brFont)} title="Supprimer cette police"
                style={{ ...btnBase, height: 28, width: 28, minWidth: 28, padding: 0, color: 'var(--danger)' }}>
                <Ic d={ICONS.trash} size={13} />
              </button>
            )}
          </div>

          {/* Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, width: 80 }}>Zoom</span>
            <button onClick={() => setPxPerSec(p => Math.max(40, p - 20))} style={btn(true)}><Ic d={ICONS.zoomOut} /></button>
            <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)', flex: 1, textAlign: 'center' }}>{pxPerSec} px/s</span>
            <button onClick={() => setPxPerSec(p => Math.min(600, p + 20))} style={btn(true)}><Ic d={ICONS.zoomIn} /></button>
          </div>

          {/* Décalage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, width: 80 }}>Décalage</span>
            <input type="range" min={-2} max={2} step={0.05} value={brOffset}
              onChange={e => setBrOffset(parseFloat(e.target.value))}
              style={{ flex: 1, color: 'var(--accent)', '--pct': `${((brOffset + 2) / 4) * 100}%` }} />
            <span style={{ fontSize: 11, color: brOffset !== 0 ? 'var(--accent)' : 'var(--text2)', fontFamily: 'var(--font-mono)', minWidth: 50, textAlign: 'right' }}>
              {brOffset >= 0 ? '+' : ''}{brOffset.toFixed(2)}s
            </span>
            {brOffset !== 0 && (
              <button onClick={() => setBrOffset(0)} title="Reset" style={{ ...btnBase, height: 22, width: 22, minWidth: 22, padding: 0, fontSize: 11, color: 'var(--accent)' }}>✕</button>
            )}
          </div>

          {/* Taille texte */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, width: 80 }}>Taille</span>
            <button onClick={() => setFontScale(s => Math.max(0.6, s - 0.1))} style={btn(true)}>A−</button>
            <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)', flex: 1, textAlign: 'center' }}>{Math.round(fontScale * 100)} %</span>
            <button onClick={() => setFontScale(s => Math.min(2.0, s + 0.1))} style={btn(true)}>A+</button>
          </div>

          {/* Rendu mot-à-mot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, width: 80 }}>Rythmo</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text2)' }}>
              <input type="checkbox" checked={wordByWord} onChange={e => setWordByWord(e.target.checked)} />
              Rendu mot par mot
            </label>
            <span style={{ fontSize: 10.5, color: 'var(--text4)', flex: 1, textAlign: 'right' }}>
              {wordByWord
                ? <span style={{ color: 'var(--accent)' }}>▌ marqueurs d'étirement</span>
                : 'ligne entière'}
            </span>
          </div>

          {/* Incrustation vidéo (BR in player) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, width: 80 }}>Sous-titres</span>
            <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 2, flex: 1 }}>
              {[
                { v: 'never',  l: 'Masqué' },
                { v: 'play',   l: 'À la lecture' },
                { v: 'always', l: 'Toujours' },
              ].map(o => (
                <button key={o.v} onClick={() => setBrInPlayer(o.v)} style={{
                  ...btnBase, height: 24, padding: '0 8px', fontSize: 10, borderRadius: 4, flex: 1,
                  background: brInPlayer === o.v ? 'var(--accent)' : 'transparent',
                  color: brInPlayer === o.v ? '#000' : 'var(--text2)',
                  fontWeight: 600,
                }}>{o.l}</button>
              ))}
            </div>
          </div>
        </div>,
        document.body
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
