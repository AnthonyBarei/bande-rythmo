import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ExportPanel from './ExportPanel'
import { useExportScreen } from './exportScreen'
import EditorHeader from './editor/EditorHeader'
import VideoStage from './editor/VideoStage'
import Inspector from './editor/Inspector'
import BandToolbar from './editor/BandToolbar'
import Transport from './editor/Transport'
import TimelineNav from './editor/TimelineNav'
import { T, Btn, Chip, Dot, Icon, ICONS, MenuItem, MenuLabel, MenuSep, Splitter } from '../ui'
import { useSettings } from '../SettingsContext'
import { classifyChar, SIGN_KINDS, DEFAULT_SIGN_TOGGLES } from '../detection'
import { useProgress } from '../ProgressContext'
import { useToast } from '../ToastContext'
import useSubtitleManager from '../hooks/useSubtitleManager'
import { bandTimeOf, videoTimeOf, isActiveAt, activeIndexAt } from '../utils/band'
import { mergeTranslations } from '../utils/mergeTranslations'

// BR canvas — constant-speed scrolling
// Cursor is at CURSOR_X_RATIO * W from left
// At t=sub.start the LEFT EDGE of the text is exactly at the cursor
// Text scrolls left at pxPerSec pixels/second as time passes
const CURSOR_X_RATIO = 0.32
const H_TRACK = 76
const BR_CONTROLS_H = 50
const FONT_BR = 'bold 22px "JetBrains Mono", "Courier New", monospace'
const FONT_LABEL = 'bold 10px "IBM Plex Sans", sans-serif'

// Character track colors — hex for label/text/border, soft for fills, bg for legacy callers
import { TRACK_COLORS } from '../config/tracks'
import { fmtClock, fmtSMPTE } from '../utils/timecode'

// hex (#rrggbb) + opacity (0..1) → 8-digit hex string accepted by canvas fillStyle
const withAlpha = (hex, a) => hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')

const REACTION_TAGS = ['rire', 'souffle', 'cri', 'chuchoté', 'pleure', 'soupir', 'grogne', 'gémit', 'ahane', 'bégaie']
const RESP_TAGS = ['inspire', 'expire', 'soupire', 'halète', 'souffle', 'retient son souffle', 'respire fort']

const fmt = fmtClock

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
// Band text font — reference BandCanvas: weight 600, 26px for the Caveat
// manuscrite, 20px for other faces, 14px italic for (réactions); × Style scale.
const brCanvasFont = (id, scale, isReact) => {
  const px = isReact ? 14 : (id === 'cursive' ? 26 : 20)
  return `${isReact ? 'italic ' : ''}600 ${Math.max(10, Math.round(px * scale))}px ${brFontStack(id)}`
}
// Canvas can't read CSS variables — --text4 / --danger tokens (not user-swappable).
const TEXT4 = '#565660'
const DANGER = '#E8595D'
const DEFAULT_ACCENT = '#F5C518'

// Resizable panes (reference screen-editor.jsx › Editor bandH / inspW / inspOpen).
const LAYOUT_KEY = 'br.editor.layout'
const BAND_DEFAULT = 190
const BAND_MIN = 120
const BAND_MAX = 520
const INSP_DEFAULT = 392
const INSP_MIN = 300
const INSP_MAX = 600
// Left column chrome under the video: transport (50) + nav (56) + toolbar (48).
const COLUMN_CHROME_H = 50 + 56 + 48
const VIDEO_MIN_H = 160
const CANVAS_HINT = 'glisser pour créer · ⇧ glisser : boucle · double-clic : éditer · clic droit : menu'

function readLayout() {
  try {
    const v = JSON.parse(localStorage.getItem(LAYOUT_KEY))
    return v && typeof v === 'object' ? v : {}
  } catch { return {} }
}
const clampNum = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback)

// SMPTE HH:MM:SS:FF — replaces decimal `fmt` everywhere a frame-accurate
// readout is wanted (cursor, grid majors, list timecodes). Negative time is
// preserved with a leading minus so calibration marks (START at −3s) read
// correctly. `fps` defaults to 25 (PAL) when the clip doesn't carry one yet.
const fmtTC = fmtSMPTE

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
    try { localStorage.setItem('br-coachmark-seen', '1') } catch { /* storage unavailable — coachmark just reappears */ }
    setOpen(false)
  }
  return (
    <div style={{
      position: 'absolute', top: 10, left: 14, right: 14, zIndex: 5,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: 'var(--accent-soft)',
      border: '1px solid var(--accent-ring)',
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
      <Btn size="sm" variant="outline" onClick={dismiss}>Compris</Btn>
    </div>
  )
}

export default function DubbingWorkspace({ clip, onUpdate, onBack, onSaveStatus, exportOpen, onToggleExport, initialPanel, onHelp }) {
  // Subtitle state machine (array, selection, undo/redo, debounced autosave)
  // lives in useSubtitleManager — Phase 2 extraction. Aliases keep the
  // historical call-site names.
  const {
    subtitles, selectedIdx, setSelectedIdx, saveStatus,
    changeSubtitles: handleSubtitlesChange,
    setSubtitlesTransient, commitDrag: dragCommit, finishDrag, saveNow,
    undo, redo, canUndo, canRedo, undoRedoRef,
  } = useSubtitleManager({ clipId: clip.clip_id, initialSubtitles: clip.subtitles || [], onSaved: onUpdate })
  const [boucles, setBoucles] = useState(clip.boucles || [])
  const clipFps = clip.fps || 25
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [transcribing, setTranscribing] = useState(false)
  const showExport = !!exportOpen
  // App's Export screen hosts the panel (portaled slot) — no modal chrome then.
  const exportHost = useExportScreen()
  const exportOpenRef = useRef(showExport)
  useEffect(() => { exportOpenRef.current = showExport }, [showExport])
  const [brOffset, setBrOffset] = useState(0)
  // DOUBLAGE_IA_REVIEW §7 — default 150 px/s (comfortable reading cadence at
  // normal speech). pxPerSec is also re-measured per clip in the auto-fit block.
  const [pxPerSec, setPxPerSec] = useState(150)
  const { settings, update: updateSettings } = useSettings()
  const progress = useProgress()
  const undoToast = useToast()
  // Band style + font live in Préférences (one source of truth): the editor
  // picker writes the same settings, and the export receives what is shown.
  const rythmoStyle = settings.brStyle || 'classique'
  const setRythmoStyle = style => updateSettings({ brStyle: style })
  const brFont = settings.brFont || 'cursive'
  const setBrFont = font => updateSettings({ brFont: font })
  const [lang, setLang] = useState(settings.whisperLang || 'fr')

  const [brInPlayer, setBrInPlayer] = useState('play')
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
  // Auto-translation — gated on a configured provider (LibreTranslate/DeepL).
  const [translateProvider, setTranslateProvider] = useState(null)
  const [translateTarget, setTranslateTarget] = useState('en')
  const [translating, setTranslating] = useState(false)
  // AI vocal separation — gated on Demucs availability.
  const [vocalAvailable, setVocalAvailable] = useState(false)
  const [separatingVocals, setSeparatingVocals] = useState(false)
  // Waveform + scene cuts for the full-clip nav timeline (BRTimeline).
  const [waveformData, setWaveformData] = useState(null)
  const [sceneCuts, setSceneCuts] = useState(clip.scene_cuts || [])
  useEffect(() => { setSceneCuts(clip.scene_cuts || []) }, [clip.clip_id])
  const [savedLayout] = useState(readLayout)
  const [bandH, setBandH] = useState(() => clampNum(savedLayout.bandH, BAND_MIN, BAND_MAX, BAND_DEFAULT))
  const [inspW, setInspW] = useState(() => clampNum(savedLayout.inspW, INSP_MIN, INSP_MAX, INSP_DEFAULT))
  const [inspOpen, setInspOpen] = useState(savedLayout.inspOpen !== false)
  const colRef = useRef(null)
  // Band cap keeps the video ≥ 160px: column − transport − nav − toolbar − 160.
  const clampBand = useCallback(v => {
    const colH = colRef.current ? colRef.current.offsetHeight : 900
    const max = Math.max(BAND_MIN, colH - COLUMN_CHROME_H - VIDEO_MIN_H)
    return Math.max(BAND_MIN, Math.min(BAND_MAX, max, v))
  }, [])
  useEffect(() => {
    const fit = () => setBandH(h => clampBand(h))
    fit()
    const col = colRef.current
    if (!col || !window.ResizeObserver) {
      window.addEventListener('resize', fit)
      return () => window.removeEventListener('resize', fit)
    }
    const ro = new ResizeObserver(fit)
    ro.observe(col)
    return () => ro.disconnect()
  }, [clampBand])
  useEffect(() => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ bandH, inspW, inspOpen })) } catch { /* layout not persisted */ }
  }, [bandH, inspW, inspOpen])
  const [importing, setImporting] = useState(false)
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
  const [showRecorder, setShowRecorder] = useState(initialPanel === 'record')
  const [rightTab, setRightTab] = useState('repliques')
  useEffect(() => {
    if (initialPanel !== 'record') return
    setShowRecorder(true)
    setRightTab('repliques')
  }, [initialPanel])
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
  const brInPlayerRef = useRef('play')
  const playingRef = useRef(false)
  const fontScaleRef = useRef(1.0)
  const brFontRef = useRef('atkinson')
  const accentRef = useRef(DEFAULT_ACCENT)
  const wordByWordRef = useRef(true)
  const detectionRef = useRef(detection)
  const detectionAutoRef = useRef(detectionAuto)
  const bouclesRef = useRef(boucles)
  const clipFpsRef = useRef(clipFps)
  const sceneCutsRef = useRef([])
  const resumeTimeRef = useRef(null)
  // Smooth time interpolation: video.currentTime only updates at video fps (e.g. 24fps).
  // Between updates, we interpolate using wall clock so the canvas scrolls at 60fps.
  const interpTimeRef = useRef({ videoTime: 0, wallMs: 0, active: false })
  const selectedIdxRef = useRef(selectedIdx)
  const lastSelectedIdxRef = useRef(selectedIdx)
  const onToggleExportRef = useRef(onToggleExport)
  const recorderRef = useRef(null)
  const [recordRequest, setRecordRequest] = useState(0)
  subtitlesRef.current = subtitles
  selectedIdxRef.current = selectedIdx
  if (selectedIdx != null) lastSelectedIdxRef.current = selectedIdx
  onToggleExportRef.current = onToggleExport
  brOffsetRef.current = brOffset
  pxPerSecRef.current = pxPerSec
  rythmoStyleRef.current = rythmoStyle
  brInPlayerRef.current = brInPlayer
  playingRef.current = playing
  fontScaleRef.current = fontScale
  brFontRef.current = brFont
  accentRef.current = /^#[0-9a-f]{6}$/i.test(settings.accent || '') ? settings.accent : DEFAULT_ACCENT
  wordByWordRef.current = wordByWord
  detectionRef.current = detection
  detectionAutoRef.current = detectionAuto
  bouclesRef.current = boucles
  clipFpsRef.current = clipFps
  sceneCutsRef.current = sceneCuts

  // Band time (video + brOffset) is the one time base for réplique edits and
  // lookups; seeks to a band position convert back to video time.
  function getBandTime() { return bandTimeOf(videoRef.current?.currentTime, brOffsetRef.current) }
  function seekBand(t) { const v = videoRef.current; if (v) v.currentTime = videoTimeOf(t, brOffsetRef.current) }
  const bandNow = bandTimeOf(currentTime, brOffset)

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

  const activeSubtitle = useMemo(
    () => subtitles.find(s => isActiveAt(s, bandNow)) || null,
    [subtitles, bandNow])

  function toggleLoopActive() {
    if (loopActive) { setLoopActive(false); return }
    const sub = (selectedIdx != null ? subtitles[selectedIdx] : null) || activeSubtitle
    if (!sub) return
    loopSubRef.current = sub
    const t = getBandTime()
    if (t < sub.start || t > sub.end) seekBand(sub.start)
    setLoopActive(true)
  }
  useEffect(() => {
    if (!loopActive) return
    const v = videoRef.current; if (!v) return
    const check = () => {
      const s = loopSubRef.current
      if (s && getBandTime() > s.end + 0.05) seekBand(s.start)
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
      try { localStorage.setItem(`br-comediens-${clip.clip_id}`, JSON.stringify(next)) } catch { /* storage unavailable — name kept for this session */ }
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

  // Persist détection toggles
  useEffect(() => { try { localStorage.setItem('br-detection', JSON.stringify(detection)) } catch { /* not persisted */ } }, [detection])
  useEffect(() => { try { localStorage.setItem('br-detection-auto', String(detectionAuto)) } catch { /* not persisted */ } }, [detectionAuto])
  useEffect(() => { try { localStorage.setItem('br-word-by-word', String(wordByWord)) } catch { /* not persisted */ } }, [wordByWord])

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
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        onUpdate(await res.json())
      } catch (e) {
        console.warn('Sauvegarde des boucles échouée', e)
        undoToast.error('Sauvegarde des boucles échouée : ' + e.message)
      }
    }, 800)
  }

  // Add or split boucle at current cursor.
  function addBoucleAtCursor() {
    const v = videoRef.current
    if (!v) return
    const t = getBandTime()
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
      if (!(data.scene_cuts || []).length) undoToast.show({ msg: 'Aucun changement de plan détecté', kind: 'info' })
    } catch (e) {
      undoToast.error('Détection des plans échouée : ' + e.message)
    } finally {
      setDetectingScenes(false)
    }
  }
  async function clearScenes() {
    setSceneCuts([])
    try { await fetch(`/api/clips/${clip.clip_id}/scenes`, { method: 'DELETE' }) }
    catch (e) { undoToast.error('Effacement des plans échoué : ' + e.message) }
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
        kind: 'proxy', title: 'Proxy 720p', clipId: clip.clip_id, jobId, retry: fireJob,
        onDone: () => { setHasProxy(true); setUseProxy(true); setProxyJob(false) },
        onError: () => { setProxyJob(false) },
        onCancel: () => { setProxyJob(false) },
      })
    } catch (e) {
      setProxyJob(false)
      undoToast.error('Lancement du proxy échoué : ' + e.message)
    }
  }

  // Auto-fit scroll rate, once per clip: pick pxPerSec so the densest réplique
  // sits near its natural width and lighter ones stretch out — the airy
  // VoxDub-style layout, without the user having to touch the zoom.
  const autoFitRef = useRef(null)
  useEffect(() => {
    if (!subtitles.length || autoFitRef.current === clip.clip_id) return
    autoFitRef.current = clip.clip_id
    const ctx = document.createElement('canvas').getContext('2d')
    let need = 0
    for (const s of subtitles) {
      if (!s.text) continue
      ctx.font = brCanvasFont(brFont, fontScale, s.text.startsWith('('))
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
        list.forEach(f => { document.fonts.load(`16px 'bru-${f.id}'`).catch(e => console.warn('Police non chargée', f.id, e)) })
      }
    } catch (e) {
      console.warn('Chargement des polices importées échoué', e)
    }
  }, [])
  useEffect(() => { refreshFonts() }, [refreshFonts])

  // Probe translation provider once.
  useEffect(() => {
    fetch('/api/translate/status').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTranslateProvider(d) }).catch(() => {})
    fetch('/api/clips/vocal-separation/status').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setVocalAvailable(!!d.available) }).catch(() => {})
  }, [])

  async function separateVocals() {
    setSeparatingVocals(true)
    const fireJob = async () => {
      const res = await fetch(`/api/clips/${clip.clip_id}/separate-vocals`, { method: 'POST' })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`) }
      return (await res.json()).job_id
    }
    try {
      const jobId = await fireJob()
      progress.start({
        kind: 'vocals', title: 'Séparation vocale (Demucs)', clipId: clip.clip_id, jobId, retry: fireJob,
        onDone: () => { setSeparatingVocals(false); undoToast.show({ msg: 'Voix isolée — pistes prêtes dans segments/stems', kind: 'success', duration: 4000 }) },
        onError: (err) => { setSeparatingVocals(false); undoToast.show({ msg: 'Séparation : ' + err.message, kind: 'error', duration: 5000 }) },
        onCancel: () => setSeparatingVocals(false),
      })
    } catch (e) {
      setSeparatingVocals(false)
      undoToast.show({ msg: 'Séparation : ' + e.message, kind: 'error', duration: 5000 })
    }
  }

  async function translateAll() {
    const subs = subtitlesRef.current
    const texts = subs.map(s => s.text || '')
    if (!texts.some(t => t.trim())) return
    setTranslating(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, target: translateTarget, source: 'auto' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      const { merged, skipped } = mergeTranslations(subs, data.translations || [], subtitlesRef.current)
      // Apply via handleSubtitlesChange → undoable + autosaved.
      handleSubtitlesChange(merged)
      undoToast.show({
        msg: `Traduit en ${translateTarget.toUpperCase()} · annulable (Ctrl+Z)`
          + (skipped ? ` · ${skipped} réplique${skipped > 1 ? 's' : ''} modifiée${skipped > 1 ? 's' : ''} entre-temps, non traduite${skipped > 1 ? 's' : ''}` : ''),
        kind: 'success',
        duration: 4000,
      })
    } catch (e) {
      undoToast.show({ msg: 'Traduction : ' + e.message, kind: 'error', duration: 4000 })
    } finally {
      setTranslating(false)
    }
  }

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
      undoToast.show({ msg: 'Police : ' + e.message, kind: 'error', duration: 4000 })
    }
  }
  async function deleteFont(id) {
    try {
      const r = await fetch(`/api/fonts/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      if (brFont === id) setBrFont('atkinson')
      await refreshFonts()
    } catch (e) {
      undoToast.show({ msg: 'Suppression de la police : ' + e.message, kind: 'error', duration: 4000 })
    }
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
      .catch(e => console.error('waveform fetch failed', e)) // non-bloquant : la bande s'affiche sans onde
  }, [clip.clip_id])

  // BR canvas RAF loop
  useEffect(() => {
    function draw() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!canvas || !video) { rafRef.current = requestAnimationFrame(draw); return }

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
      const H = canvas.height / dpr || canvasH
      // Interpolate between timeupdates so each 60fps canvas frame has a distinct
      // position — prevents bunched-then-jump artifacts from video.currentTime's 24fps steps.
      // Scaled by playbackRate; raw currentTime while paused/seeking.
      const interp = interpTimeRef.current
      const rawTime = (interp.active && !video.paused && !video.seeking)
        ? interp.videoTime + (performance.now() - interp.wallMs) / 1000 * (video.playbackRate || 1)
        : video.currentTime
      const t = rawTime + brOffsetRef.current
      const pxSec = pxPerSecRef.current
      const cursor_x = W * CURSOR_X_RATIO
      const style = rythmoStyleRef.current
      const isNeon = style === 'neon'
      const isMinimal = style === 'minimal'
      const accent = accentRef.current

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

      // SMPTE grid — one 1px line per second, MM:SS:FF label at the band foot.
      {
        const gStart = t - cursor_x / pxSec
        const gEnd = t + (W - cursor_x) / pxSec
        ctx.setLineDash([])
        ctx.lineWidth = 1
        ctx.font = '9px "JetBrains Mono", monospace'
        ctx.textBaseline = 'bottom'
        for (let tick = Math.ceil(gStart); tick <= Math.floor(gEnd); tick++) {
          const gx = cursor_x + (tick - t) * pxSec
          ctx.strokeStyle = tick < 0 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.05)'
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
          if (tick >= 0) {
            ctx.fillStyle = TEXT4
            ctx.fillText(fmtTC(tick, clipFpsRef.current).slice(3), gx + 3, H - 2)
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
        const _dimmed = _filterActive && !_cFilter.has(sub.character || '')
        if (_dimmed) ctx.globalAlpha = 0.15

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

        // Per-word text — each word fills its own time-block [start, end]:
        // squeezed to fit, stretch capped at 1.2 (held words sit left-aligned
        // with a trailing gap). No / stale word data → whole text as one word.
        if (sub.text) {
          const isReact = sub.text.startsWith('(')
          ctx.font = brCanvasFont(brFontRef.current, fontScaleRef.current, isReact)
          // Expose the resolved BR font on the canvas so hit-test helpers
          // (hitTestLetter for click-letter détection) measure glyphs in the
          // same font without redoing the resolution.
          if (canvas && !isReact) canvas._brFontResolved = ctx.font
          ctx.textBaseline = 'middle'
          const yMid = yTop + trackH / 2 + (brFontRef.current === 'cursive' ? 2 : 0)

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

            // ── Stretch marker — reference BandCanvas: 2px danger bar INSIDE
            // the block (y0 + trackH − 4), only when the text is squeezed
            // (< 0.82). Held words (capped stretch) get no bar: a sparse
            // réplique is normal, and per-word bars read as a block outline.
            if (!isMinimal && scaleX < 0.82) {
              const mx0 = Math.max(wbx, leftX + 2)
              const mx1 = Math.min(wbx + wbw, rightX - 2)
              if (mx1 > mx0) {
                ctx.fillStyle = DANGER
                ctx.fillRect(mx0, yTop + trackH - 4, mx1 - mx0, 2)
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
          ctx.fillStyle = withAlpha(accent, 0.10)
          ctx.fillRect(Math.max(0, lx), 0, Math.min(W, rx) - Math.max(0, lx), H)
          ctx.strokeStyle = withAlpha(accent, 0.6)
          ctx.lineWidth = 1
          ctx.setLineDash([4, 3])
          if (lx >= 0 && lx <= W) { ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke() }
          if (rx >= 0 && rx <= W) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, H); ctx.stroke() }
          ctx.setLineDash([])
        }
        const vt = bandTimeOf(video.currentTime, brOffsetRef.current)
        if (!video.paused && (vt >= lr.end || vt < lr.start - 0.05)) {
          video.currentTime = videoTimeOf(lr.start, brOffsetRef.current)
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
          if (sub.hidden) continue
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
              if (o === sub || o.hidden) continue
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
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return
      if (exportOpenRef.current) return
      // Undo / redo — Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z. Ctrl+S saves now. Intercept before transport.
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoRedoRef.current.undo(); return }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); undoRedoRef.current.redo(); return }
        if (k === 's') { e.preventDefault(); saveNow(); return }
      }
      // `\` toggles the inspector. On AZERTY it is AltGr+8 (reported as Ctrl+Alt),
      // so AltGraph is the one modifier allowed for it.
      const altGr = e.getModifierState?.('AltGraph')
      if (e.key === '\\' && (altGr || !(e.ctrlKey || e.metaKey || e.altKey))) {
        if (document.querySelector('[aria-modal="true"]')) return
        e.preventDefault()
        setInspOpen(o => !o)
        return
      }
      // Single-key shortcuts must not fire on browser/app combos (Ctrl+S, Ctrl+K, Alt+…).
      if ((e.ctrlKey || e.metaKey || e.altKey) && !e.key.startsWith('Arrow')) return
      // An app-level dialog (raccourcis, palette…) owns the keyboard.
      if (document.querySelector('[aria-modal="true"]')) return
      const v = videoRef.current; if (!v) return
      const vt = v.currentTime
      const t = getBandTime()
      const subs = subtitlesRef.current
      const activeI = activeIndexAt(subs, t)

      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.ctrlKey || e.metaKey) {
            const prev = [...subs].reverse().find(s => s.start < t - 0.05)
            if (prev) seekBand(prev.start)
          } else {
            // Shift+← = one frame back; ← = 1s back
            const step = e.shiftKey ? 1 / (clipFpsRef.current || 25) : 1
            v.currentTime = Math.max(0, vt - step)
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.ctrlKey || e.metaKey) {
            const next = subs.find(s => s.start > t + 0.05)
            if (next) seekBand(next.start)
          } else {
            // Shift+→ = one frame forward; → = 1s forward
            const step = e.shiftKey ? 1 / (clipFpsRef.current || 25) : 1
            v.currentTime = Math.min(v.duration || vt + step, vt + step)
          }
          break
        case ',': e.preventDefault(); v.pause(); v.currentTime = Math.max(0, vt - 0.04); break
        case '.': e.preventDefault(); v.pause(); v.currentTime = Math.min(v.duration || vt, vt + 0.04); break
        case 'Delete': case 'Backspace':
          if (activeI >= 0) { e.preventDefault(); deleteReplicaWithUndo(activeI) }
          break
        case 'Enter':
          if (e.shiftKey) {
            e.preventDefault()
            handleSubtitlesChange([...subs, { start: t, end: t + 1.5, character: '', text: '', reactions: [] }].sort((a, b) => a.start - b.start))
          } else if (activeI >= 0 && e.target.tagName !== 'BUTTON') {
            e.preventDefault()
            v.pause()
            setEditingIdx(activeI)
            setEditText(subs[activeI].text || '')
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
        case 'r': case 'R':
          e.preventDefault()
          requestRecordToggle()
          break
        case 'e': case 'E':
          e.preventDefault()
          onToggleExportRef.current?.()
          break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // R — start/stop a take for the selected (else active) réplique, through
  // the RecorderPanel (same path as its record button: mic permission, errors).
  // Opens the panel first when closed; the toggle fires once it is mounted
  // with the réplique selected.
  function requestRecordToggle() {
    if (recorderRef.current?.isRecording()) { recorderRef.current.toggle(); return }
    const subs = subtitlesRef.current
    const sel = selectedIdxRef.current
    const idx = sel != null && subs[sel] ? sel : activeIndexAt(subs, getBandTime())
    if (idx < 0) return
    setSelectedIdx(idx)
    setInspOpen(true)
    setRightTab('repliques')
    setShowRecorder(true)
    setRecordRequest(n => n + 1)
  }
  useEffect(() => {
    if (recordRequest) recorderRef.current?.toggle()
  }, [recordRequest])

  function togglePlay() { const v = videoRef.current; if (v) v.paused ? v.play() : v.pause() }
  function toggleMute() { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted) }
  function changeSpeed(s) { const v = videoRef.current; if (v) v.playbackRate = +s; setSpeed(+s) }
  function seekVideo(t) { const v = videoRef.current; if (v) v.currentTime = t }

  function gotoPrevSub() {
    if (!videoRef.current) return
    const t = getBandTime()
    const subs = subtitlesRef.current
    const i = subs.findIndex(s => s.start > t - 0.01)
    const ti = i < 0 ? subs.length - 1 : Math.max(0, i - 1)
    if (subs[ti]) { seekBand(subs[ti].start); setSelectedIdx(ti) }
  }
  function gotoNextSub() {
    if (!videoRef.current) return
    const t = getBandTime()
    const subs = subtitlesRef.current
    const i = subs.findIndex(s => s.start > t + 0.01)
    if (i >= 0) { seekBand(subs[i].start); setSelectedIdx(i) }
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

  useEffect(() => {
    if (!ctxMenu) return
    const onKey = e => { if (e.key === 'Escape') setCtxMenu(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctxMenu])

  function canvasCoords(e) {
    const canvas = canvasRef.current
    if (!canvas) return null
    // CSS pixels — same space as the draw loop (backing store is DPR-scaled).
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const W = rect.width
    const H = rect.height
    const t = getBandTime()
    const pxSec = pxPerSecRef.current
    const cursor_x = W * CURSOR_X_RATIO
    return { x, y, W, H, t, pxSec, cursor_x, time: t + (x - cursor_x) / pxSec }
  }

  function hitTest(e) {
    const c = canvasCoords(e); if (!c) return null
    const n = numTracksRef.current
    const trackH = c.H / n
    const trackIdx = Math.min(n - 1, Math.max(0, Math.floor(c.y / trackH)))
    const cMap = charMapRef.current
    const subs = subtitlesRef.current
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

  // DOUBLAGE_IA_REVIEW §6 — click a letter on the band to cycle its detection sign.
  // Returns { subIdx, wordIdx, charIdx } or null. Hit-tests using the current
  // render geometry (cursor_x, pxSec, word stretch). Mirrors the draw loop math.
  function hitTestLetter(e) {
    const c = canvasCoords(e); if (!c) return null
    const n = numTracksRef.current
    const trackH = c.H / n
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
      if (v) { seekBand(sub.start); if (v.paused) v.play() }
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
      const baseSubs = subtitlesRef.current
      let workingSubs = baseSubs
      if (e.altKey && mode === 'shift') {
        const dur = sub.end - sub.start
        const dupe = { ...sub, start: sub.end, end: sub.end + dur }
        workingSubs = [...workingSubs.slice(0, hit.subIdx + 1), dupe, ...workingSubs.slice(hit.subIdx + 1)]
        subIdx = hit.subIdx + 1
        setSubtitlesTransient(workingSubs)
      }
      dragRef.current = {
        mode,
        subIdx,
        startX: hit.x, startY: hit.y, startTime: hit.time,
        origSub: { ...workingSubs[subIdx] },
        origTrack: charMapRef.current[(workingSubs[subIdx].character || '')] ?? 0,
        duplicated: workingSubs !== baseSubs,
        baseSubs,
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
    // Keep blocks inside the clip (duration unknown until metadata → no clamp).
    const clipEnd = videoRef.current?.duration || Infinity

    if (drag.mode === 'shift') {
      const dur = drag.origSub.end - drag.origSub.start
      const newStart = Math.min(snapTime(drag.origSub.start + dt, e), Math.max(0, clipEnd - dur))
      const verticalDelta = hit.y - drag.startY
      const trackH = hit.H / numTracksRef.current
      let newChar = drag.origSub.character
      if (Math.abs(verticalDelta) > trackH * 0.5 && hit.trackIdx !== drag.origTrack && charList[hit.trackIdx] != null) {
        newChar = charList[hit.trackIdx]
      }
      dragCommit(subtitlesRef.current.map((s, i) => i !== drag.subIdx ? s : { ...s, start: newStart, end: newStart + dur, character: newChar }))
    } else if (drag.mode === 'resize-start') {
      const newStart = Math.min(snapTime(drag.origSub.start + dt, e, true), drag.origSub.end - 0.1)
      dragCommit(subtitlesRef.current.map((s, i) => i !== drag.subIdx ? s : { ...s, start: newStart }))
    } else if (drag.mode === 'resize-end') {
      const newEnd = Math.max(Math.min(snapTime(drag.origSub.end + dt, e, true), clipEnd), drag.origSub.start + 0.1)
      dragCommit(subtitlesRef.current.map((s, i) => i !== drag.subIdx ? s : { ...s, end: newEnd }))
    } else if (drag.mode === 'loop') {
      const t1 = hit.time
      const a = Math.max(0, Math.min(drag.startTime, t1))
      const b = Math.max(0, Math.max(drag.startTime, t1))
      if (b - a > 0.1) setLoopRegion({ start: a, end: b })
    } else if (drag.mode === 'create') {
      const t1 = Math.min(snapTime(hit.time, e, true), clipEnd)
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

  // End of an edit gesture: one undo step + immediate save. A create-drag that
  // never created anything changes nothing; an alt-click that never moved
  // drops its transient duplicate.
  function endEditDrag(drag) {
    if (drag.mode === 'create') return
    if (!drag.didMove) {
      if (drag.duplicated) setSubtitlesTransient(drag.baseSubs)
      return
    }
    finishDrag()
  }

  function onCanvasMouseLeave() {
    const drag = dragRef.current
    dragRef.current = null
    hoverRef.current = null
    setHoverHint(null)
    if (drag && drag.mode !== 'loop') endEditDrag(drag)
  }

  function onCanvasMouseUp(e) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.mode === 'loop') {
      const lr = loopRegionRef.current
      if (lr) {
        const v = videoRef.current
        if (v) { seekBand(lr.start); if (v.paused) v.play() }
      }
      return
    }
    if (!drag.didMove && drag.mode !== 'create') {
      endEditDrag(drag)
      // Plain click on a block — try letter cycle first (no modifiers, mid zone,
      // détection layer visible so the user sees what changes).
      // Falls through to seek if no letter hit.
      if (!e.shiftKey && !e.altKey && !e.ctrlKey && drag.mode === 'shift' && detectionRef.current.layer) {
        const letterHit = hitTestLetter(e)
        if (letterHit) {
          cycleSignAt(letterHit.subIdx, letterHit.wordIdx, letterHit.charIdx)
          return
        }
      }
      const hit = hitTest(e)
      if (hit) seekBand(Math.max(0, hit.time))
    } else {
      endEditDrag(drag)
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

  // Native non-passive listener: React's onWheel is passive, so its
  // preventDefault can't stop Ctrl+wheel from zooming the whole page.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = e => {
      if (!e.ctrlKey && !e.shiftKey) return
      e.preventDefault()
      setPxPerSec(p => Math.max(40, Math.min(600, p + (e.deltaY < 0 ? 20 : -20))))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  function onCanvasContextMenu(e) {
    e.preventDefault()
    dragRef.current = null
    const hit = hitTest(e); if (!hit) return
    if (hit.subIdx >= 0) {
      // Viewport coordinates — the menu is position:fixed.
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
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
      seekBand(sub.start)
    } else if (action === 'seekEnd') {
      seekBand(sub.end)
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
    const existing = subtitlesRef.current.length
    if (existing && !window.confirm(`Remplacer les ${existing} réplique${existing > 1 ? 's' : ''} existante${existing > 1 ? 's' : ''} par la transcription Whisper ? (annulable avec Ctrl+Z)`)) return
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
        clipId: clip.clip_id,
        title: 'Transcription Whisper',
        jobId,
        retry: fireJob,
        onDone: (result) => {
          if (result && result.subtitles) handleSubtitlesChange(result.subtitles)
          undoToast.show({ msg: 'Transcription terminée', kind: 'success', duration: 3000 })
          setTranscribing(false)
        },
        onError: (err) => {
          undoToast.show({ msg: 'Erreur : ' + err.message, kind: 'error', duration: 4000 })
          setTranscribing(false)
        },
        onCancel: () => {
          undoToast.show({ msg: 'Transcription annulée', kind: 'error', duration: 3000 })
          setTranscribing(false)
        },
      })
    } catch (e) {
      undoToast.show({ msg: 'Erreur : ' + e.message, kind: 'error', duration: 3000 })
      setTranscribing(false)
    }
  }

  function addCharacter() {
    const name = window.prompt('Nom du nouveau personnage :')
    if (name == null || !name.trim()) return
    const t = getBandTime()
    handleSubtitlesChange([...subtitles, { start: t, end: t + 1.5, character: name.trim(), text: '', reactions: [] }].sort((a, b) => a.start - b.start))
  }

  // Header "Sous-titres ▾" › Importer — replaces the réplique list (undoable).
  async function importSubtitlesFile(file) {
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mode', 'replace')
      const res = await fetch(`/api/clips/${clip.clip_id}/import-subtitles`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      handleSubtitlesChange(data.clip?.subtitles || [])
      undoToast.show({ msg: 'Sous-titres importés · annulable (Ctrl+Z)', kind: 'success', duration: 3000 })
    } catch (e) {
      undoToast.error('Import des sous-titres échoué : ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  // Same réplique as ⇧↵ (band toolbar "add").
  function addSubAtCursor() {
    const t = getBandTime()
    handleSubtitlesChange([...subtitlesRef.current, { start: t, end: t + 1.5, character: '', text: '', reactions: [] }].sort((a, b) => a.start - b.start))
  }

  // Band toolbar "loop" — same loop as ⇧clic on the selected/active réplique.
  function toggleLoopSelection() {
    if (loopRegionRef.current) { setLoopRegion(null); return }
    const subs = subtitlesRef.current
    const sel = selectedIdxRef.current
    const idx = sel != null && subs[sel] ? sel : activeIndexAt(subs, getBandTime())
    const sub = subs[idx]
    if (!sub) return
    setLoopRegion({ start: sub.start, end: sub.end })
    const v = videoRef.current
    if (v) { seekBand(sub.start); if (v.paused) v.play() }
  }

  // Transport IN / OUT — bound of the selected (else active) réplique at the band time.
  function setTargetBound(edge) {
    const subs = subtitlesRef.current
    const sel = selectedIdxRef.current
    const idx = sel != null && subs[sel] ? sel : activeIndexAt(subs, getBandTime())
    const sub = subs[idx]
    if (!sub) return
    const t = getBandTime()
    const patch = edge === 'in' ? { start: Math.min(t, sub.end - 0.1) } : { end: Math.max(t, sub.start + 0.1) }
    handleSubtitlesChange(subs.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  // Same step as ⇧← / ⇧→.
  function stepFrame(dir) {
    const v = videoRef.current; if (!v) return
    const step = 1 / (clipFpsRef.current || 25)
    v.currentTime = dir < 0 ? Math.max(0, v.currentTime - step) : Math.min(v.duration || v.currentTime + step, v.currentTime + step)
  }

  // Shortcuts overlay lives in App: use its handler when given, else its "?" key.
  function openHelp() {
    if (onHelp) { onHelp(); return }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))
  }

  function onVideoTimeUpdate(e) {
    const ct = e.target.currentTime
    setCurrentTime(ct)
    if (!e.target.paused) interpTimeRef.current = { videoTime: ct, wallMs: performance.now(), active: true }
  }
  function onVideoLoadedMetadata(e) {
    setDuration(e.target.duration)
    // Restore playhead after a Master/Proxy source swap.
    if (resumeTimeRef.current != null) {
      try { e.target.currentTime = resumeTimeRef.current } catch (err) { console.warn('Reprise de la position impossible', err) }
      resumeTimeRef.current = null
    }
  }
  function onVideoPlay() { setPlaying(true); interpTimeRef.current = { videoTime: videoRef.current?.currentTime || 0, wallMs: performance.now(), active: true } }
  function onVideoPause() { setPlaying(false); interpTimeRef.current = { ...interpTimeRef.current, active: false } }
  function seekToEnd() { const v = videoRef.current; if (v) v.currentTime = v.duration }
  function toggleProxy() { const v = videoRef.current; resumeTimeRef.current = v ? v.currentTime : 0; setUseProxy(p => !p) }

  // Inspector header réplique: under the playhead → last selected → first.
  const inspectorTarget = activeSubtitle
    || (lastSelectedIdxRef.current != null ? subtitles[lastSelectedIdxRef.current] : null)
    || subtitles[0] || null
  const inspectorIdx = inspectorTarget ? subtitles.indexOf(inspectorTarget) : -1
  function setTargetCharacter(char) {
    if (inspectorIdx < 0) return
    handleSubtitlesChange(subtitles.map((s, i) => i === inspectorIdx ? { ...s, character: char } : s))
  }
  function newTargetCharacter() {
    if (inspectorIdx < 0) return
    const name = window.prompt('Nom du nouveau personnage :')
    if (name && name.trim()) setTargetCharacter(name.trim())
  }
  const viewSpan = ((canvasRef.current?.offsetWidth || 800) / (pxPerSec || 1))
  const viewStart = bandNow - CURSOR_X_RATIO * viewSpan

  const exportPanel = (
    <ExportPanel
      segmentId={clip.clip_id}
      subtitles={subtitles}
      boucles={boucles}
      pxPerSec={pxPerSec}
      brOffset={brOffset}
      canvasH={canvasH}
      getCanvasWidth={() => canvasRef.current?.offsetWidth || 1200}
      brFont={brFont}
      brStyle={rythmoStyle}
      duration={duration}
      getCurrentTime={() => videoRef.current?.currentTime || 0}
      loopRegion={loopRegion}
    />
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>

      <EditorHeader
        clip={clip}
        subtitleCount={subtitles.length}
        clipFps={clipFps}
        charList={charList}
        charMap={charMap}
        charFilter={charFilter}
        onToggleCharFilter={toggleCharFilter}
        onClearCharFilter={clearCharFilter}
        lang={lang}
        setLang={setLang}
        transcribing={transcribing}
        onTranscribe={transcribe}
        importing={importing}
        onImportFile={importSubtitlesFile}
        translateProvider={translateProvider}
        translateTarget={translateTarget}
        setTranslateTarget={setTranslateTarget}
        translating={translating}
        onTranslate={translateAll}
        vocalAvailable={vocalAvailable}
        separatingVocals={separatingVocals}
        onSeparateVocals={separateVocals}
        saveStatus={saveStatus}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onBack={onBack}
        onToggleExport={onToggleExport}
        onHelp={openHelp}
        inspOpen={inspOpen}
        onToggleInspector={() => setInspOpen(o => !o)}
      />

      {/* ── Main: left column (video · transport · nav · toolbar · band) + inspector ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div ref={colRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          <VideoStage
            videoRef={videoRef}
            segmentUrl={segmentUrl}
            onVideoTimeUpdate={onVideoTimeUpdate}
            onVideoLoadedMetadata={onVideoLoadedMetadata}
            onVideoPlay={onVideoPlay}
            onVideoPause={onVideoPause}
            currentTime={currentTime}
            duration={duration}
            clipFps={clipFps}
            playing={playing}
            brInPlayer={brInPlayer}
            activeSubtitle={activeSubtitle}
            charMap={charMap}
            onTogglePlay={togglePlay}
            hasProxy={hasProxy}
            useProxy={useProxy}
            onToggleProxy={toggleProxy}
            onGenerateProxy={generateProxy}
            proxyJob={proxyJob}
          />

          <Transport
            currentTime={currentTime}
            duration={duration}
            playing={playing}
            speed={speed}
            muted={muted}
            onTogglePlay={togglePlay}
            onSeek={seekVideo}
            onSeekEnd={seekToEnd}
            onStepFrame={stepFrame}
            onPrevSub={gotoPrevSub}
            onNextSub={gotoNextSub}
            loopActive={loopActive}
            onToggleLoopActive={toggleLoopActive}
            onChangeSpeed={changeSpeed}
            onToggleMute={toggleMute}
            hasTarget={selectedIdx != null || !!activeSubtitle}
            onSetIn={() => setTargetBound('in')}
            onSetOut={() => setTargetBound('out')}
          />

          <TimelineNav
            bandNow={bandNow}
            clipFps={clipFps}
            boucles={boucles}
            onBouclesChange={saveBoucles}
            loopRegion={loopRegion}
            onLoopRegionChange={setLoopRegion}
            duration={duration}
            waveform={waveformData}
            sceneCuts={sceneCuts}
            subtitles={subtitles}
            charMap={charMap}
            viewStart={viewStart}
            viewEnd={viewStart + viewSpan}
            onSeek={seekBand}
          />

          <BandToolbar
            subtitles={subtitles}
            onSubtitlesChange={handleSubtitlesChange}
            selectedIdx={selectedIdx}
            setSelectedIdx={setSelectedIdx}
            getBandTime={getBandTime}
            onAddSub={addSubAtCursor}
            loopRegion={loopRegion}
            onToggleLoopSelection={toggleLoopSelection}
            pxPerSec={pxPerSec}
            setPxPerSec={setPxPerSec}
            charMap={charMap}
            locked={locked}
            setLocked={setLocked}
            detection={detection}
            setDetection={setDetection}
            sceneCuts={sceneCuts}
            onDetectScenes={detectScenes}
            onClearScenes={clearScenes}
            detectingScenes={detectingScenes}
            clipFps={clipFps}
            brFont={brFont}
            setBrFont={setBrFont}
            uploadedFonts={uploadedFonts}
            styleProps={{
              rythmoStyle, setRythmoStyle, onUploadFont: uploadFont, onDeleteFont: deleteFont,
              brOffset, setBrOffset, fontScale, setFontScale,
              wordByWord, setWordByWord, brInPlayer, setBrInPlayer,
            }}
          />

          {/* ── Band: top edge is a resize handle (Splitter) ── */}
          <Splitter dir="row" title="Glisser pour redimensionner la bande · double-clic : réinitialiser"
            start={bandH} onDrag={(dy, start) => setBandH(clampBand(start - dy))} onReset={() => setBandH(clampBand(BAND_DEFAULT))} />
          <div style={{ height: bandH, flexShrink: 0, position: 'relative', overflow: 'hidden', background: '#0a0a0c' }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={canvasH}
              title={CANVAS_HINT}
              style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair', userSelect: 'none' }}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
              onMouseLeave={onCanvasMouseLeave}
              onDoubleClick={onCanvasDoubleClick}
              onContextMenu={onCanvasContextMenu}
            />
            <CanvasCoachmark />

            {loopRegion && (
              <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 5 }}>
                <Chip color={T.accent} soft style={{ fontFamily: T.fontMono, fontSize: 11, padding: '0 0 0 9px', gap: 4 }}>
                  <Icon d={ICONS.loop} size={12} stroke={T.accent} /> {fmt(loopRegion.start)}–{fmt(loopRegion.end)}
                  <Btn size="sm" icon={ICONS.close} onClick={() => setLoopRegion(null)} title="Effacer la boucle (Échap)" style={{ height: 24, minWidth: 24 }} />
                </Chip>
              </div>
            )}
            {editingIdx != null && (() => {
              const sub = subtitles[editingIdx]
              const canvas = canvasRef.current
              if (!sub || !canvas) return null
              const rect = canvas.getBoundingClientRect()
              const cur_x = rect.width * CURSOR_X_RATIO
              const t = getBandTime()
              const left = cur_x + (sub.start - t) * pxPerSec
              const right = cur_x + (sub.end - t) * pxPerSec
              const trackIdx = charMap[sub.character || ''] ?? 0
              const trackH = (rect.height || canvasH) / numTracks
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
                    border: '2px solid var(--accent)', borderRadius: 4,
                    padding: '4px 8px', fontFamily: 'var(--font-mono)',
                    fontSize: 14, zIndex: 10, outline: 'none',
                  }}
                />
              )
            })()}
            {ctxMenu && (() => {
              const sub = subtitles[ctxMenu.subIdx]
              if (!sub) return null
              const canSplit = ctxMenu.time > sub.start && ctxMenu.time < sub.end
              return (
                <>
                  <div onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' }} />
                  <div style={{
                    position: 'fixed', left: Math.max(4, Math.min(ctxMenu.x, window.innerWidth - 240)),
                    ...(ctxMenu.y > window.innerHeight / 2 ? { bottom: window.innerHeight - ctxMenu.y } : { top: ctxMenu.y }),
                    maxHeight: '80vh', overflowY: 'auto', zIndex: 'var(--z-dropdown)', minWidth: 210,
                    background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 6 }}>
                    <div style={menuHeader}>{sub.character || '(défaut)'} · {sub.text.slice(0, 30) || '∅'}</div>
                    <MenuItem icon={ICONS.edit} onClick={() => ctxAction('edit')}>Éditer le texte</MenuItem>
                    {canSplit && <MenuItem icon={ICONS.scissors} onClick={() => ctxAction('split')}>Couper ici ({fmt(ctxMenu.time)})</MenuItem>}
                    <MenuItem icon={ICONS.plus} onClick={() => ctxAction('duplicate')}>Dupliquer après</MenuItem>
                    <MenuItem icon={ICONS.start} onClick={() => ctxAction('seekStart')}>Aller au début ({fmt(sub.start)})</MenuItem>
                    <MenuItem icon={ICONS.end} onClick={() => ctxAction('seekEnd')}>Aller à la fin ({fmt(sub.end)})</MenuItem>
                    <MenuSep />
                    <MenuLabel>Personnage</MenuLabel>
                    {charList.map(c => {
                      const cc = TRACK_COLORS[(charMap[c] ?? 0) % TRACK_COLORS.length].hex
                      return (
                        <MenuItem key={c || '_default'} onClick={() => ctxAction('character', c)} active={c === (sub.character || '')} color={cc}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={cc} size={8} />{c || '(défaut)'}</span>
                        </MenuItem>
                      )
                    })}
                    <MenuItem icon={ICONS.user} onClick={() => ctxAction('newCharacter')}>Nouveau / renommer…</MenuItem>
                    <MenuSep />
                    <MenuItem icon={ICONS.trash} onClick={() => ctxAction('delete')} danger>Supprimer</MenuItem>
                  </div>
                </>
              )
            })()}
          </div>
        </div>

        {/* Inspector — resizable + hideable. Stays mounted while hidden so the
            embedded recorder (and an in-flight take) survives the toggle. */}
        {inspOpen && (
          <Splitter dir="col" title="Glisser pour redimensionner le panneau · double-clic : réinitialiser"
            start={inspW} onDrag={(dx, start) => setInspW(Math.max(INSP_MIN, Math.min(INSP_MAX, start - dx)))} onReset={() => setInspW(INSP_DEFAULT)} />
        )}
        {!inspOpen && (
          <button onClick={() => setInspOpen(true)} title="Afficher le panneau (\)" style={{
            width: 32, flexShrink: 0, background: T.surface, border: 'none', borderLeft: `1px solid ${T.border}`, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 14, color: T.text3, fontFamily: T.fontUI }}>
            <Icon d={ICONS.sidebar} size={16} stroke={T.text2} />
            <span style={{ writingMode: 'vertical-rl', fontSize: 11, fontWeight: 600, letterSpacing: 0.6, color: T.text3, whiteSpace: 'nowrap' }}>Répliques · Voix · Détection</span>
          </button>
        )}
        <Inspector
          open={inspOpen}
          width={inspW}
          hint={hoverHint}
          rightTab={rightTab}
          setRightTab={setRightTab}
          target={inspectorTarget}
          subIdx={inspectorIdx}
          charMap={charMap}
          charList={charList}
          clipFps={clipFps}
          showRecorder={showRecorder}
          onToggleRecorder={() => setShowRecorder(s => !s)}
          onSetTargetCharacter={setTargetCharacter}
          onNewTargetCharacter={newTargetCharacter}
          repliquesProps={{
            subtitles, transcribing, onTranscribe: transcribe,
            onSubtitlesChange: handleSubtitlesChange, onDelete: deleteReplicaWithUndo,
            bandNow, onSeek: seekBand, selectedIdx, setSelectedIdx, charFilter, charMap, clipId: clip.clip_id,
            showRecorder, recorderRef, activeSubtitle, videoRef,
          }}
          voixProps={{
            charList, charMap, subtitles, activeSubtitle, selectedIdx, setSelectedIdx,
            takes, bandNow, comediens, onSetComedien: setComedien,
            onRecord: () => { setInspOpen(true); setShowRecorder(true); setRightTab('repliques') },
            onSeek: seekBand, clipDuration: clip.end - clip.start, onAddCharacter: addCharacter,
          }}
          detectionProps={{ detection, setDetection, detectionAuto, setDetectionAuto, wordByWord, setWordByWord, brFont, setBrFont }}
          bouclesProps={{ boucles, subtitles, onAdd: addBoucleAtCursor, onRemove: removeBoucle, onSeek: seekBand, clipFps }}
          lexiqueProps={{ project: clip.project, translateAvailable: !!translateProvider?.available, translateTarget }}
        />
      </div>

      {/* ── Export modal (inline fallback when App provides no Export screen) ── */}
      {showExport && exportHost && exportPanel}
      {showExport && !exportHost && (
        <div
          onClick={() => onToggleExport?.()}
          style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(0,0,0,0.66)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(960px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Icon d={ICONS.download} size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Exporter le clip</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{clip.name}</div>
              </div>
              <Btn size="sm" variant="solid" icon={ICONS.close} onClick={() => onToggleExport?.()} title="Fermer (Échap)" />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
              {exportPanel}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const menuHeader = {
  padding: '7px 10px 5px', fontSize: 11, color: 'var(--text3)',
  borderBottom: '1px solid var(--border)', marginBottom: 4,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
