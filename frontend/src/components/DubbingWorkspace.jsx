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
import { useProgress } from '../ProgressContext'
import { useToast } from '../ToastContext'
import useSubtitleManager from '../hooks/useSubtitleManager'
import { bandTimeOf, videoTimeOf, isActiveAt, activeIndexAt } from '../utils/band'
import { mergeTranslations } from '../utils/mergeTranslations'

// Character track colors — hex for label/text/border, soft for fills, bg for legacy callers
import { TRACK_COLORS } from '../config/tracks'
import { fmtSMPTE } from '../utils/timecode'
import { usePlayerVolume, applyPlayerVolume, toggleMuted } from '../utils/playerVolume'
import BandCanvas from './band/BandCanvas'
import {
  CURSOR_X_RATIO, bandAccent, bandCanvasHeight, buildCharMap, autoFitPxPerSec,
  readDetection, readDetectionAuto, readWordByWord,
} from './band/bandRender'
import { bandCoords, hitTestBand, hitTestBandLetter } from './band/bandHit'


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
  const { volume, muted } = usePlayerVolume()
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
  const [detection, setDetection] = useState(readDetection)
  const [detectionAuto, setDetectionAuto] = useState(readDetectionAuto)
  const [wordByWord, setWordByWord] = useState(readWordByWord)
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
  const subtitlesRef = useRef(subtitles)
  const brOffsetRef = useRef(0)
  const pxPerSecRef = useRef(180)
  const scrubResumeRef = useRef(false)
  const onsetsRef = useRef(null)
  const dragRef = useRef(null)
  const hoverRef = useRef(null)
  const charMapRef = useRef({})
  const numTracksRef = useRef(1)
  const detectionRef = useRef(detection)
  const bouclesRef = useRef(boucles)
  const clipFpsRef = useRef(clipFps)
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
  detectionRef.current = detection
  bouclesRef.current = boucles
  clipFpsRef.current = clipFps

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
  useEffect(() => { applyPlayerVolume(videoRef.current) }, [volume, muted, segmentUrl])

  const charMap = useMemo(() => buildCharMap(subtitles), [subtitles])

  const numTracks = Math.max(1, Object.keys(charMap).length)
  const canvasH = bandCanvasHeight(numTracks)
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
    const fit = autoFitPxPerSec(subtitles, brFont, fontScale)
    if (fit != null) setPxPerSec(fit)
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
          onsetsRef.current = data.onsets || []
          setWaveformData(data)
        }
      })
      .catch(e => console.error('waveform fetch failed', e)) // non-bloquant : la bande s'affiche sans onde
  }, [clip.clip_id])

  // Band time source for the BandCanvas RAF loop. Interpolates between
  // timeupdates so each 60fps canvas frame has a distinct position — prevents
  // bunched-then-jump artifacts from video.currentTime's 24fps steps. Scaled by
  // playbackRate; raw currentTime while paused/seeking.
  const getRenderTime = useCallback(() => {
    const video = videoRef.current
    if (!video) return null
    const interp = interpTimeRef.current
    const rawTime = (interp.active && !video.paused && !video.seeking)
      ? interp.videoTime + (performance.now() - interp.wallMs) / 1000 * (video.playbackRate || 1)
      : video.currentTime
    return rawTime + brOffsetRef.current
  }, [])

  // Loop region enforcement, once per band frame.
  const enforceLoopRegion = useCallback(() => {
    const lr = loopRegionRef.current
    const video = videoRef.current
    if (!lr || !video) return
    const vt = bandTimeOf(video.currentTime, brOffsetRef.current)
    if (!video.paused && (vt >= lr.end || vt < lr.start - 0.05)) {
      video.currentTime = videoTimeOf(lr.start, brOffsetRef.current)
    }
  }, [])


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
        case 'm': toggleMuted(); break
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
  function changeSpeed(s) { const v = videoRef.current; if (v) v.playbackRate = +s; setSpeed(+s) }
  function seekVideo(t) { const v = videoRef.current; if (v) v.currentTime = t }
  // Nav-bar scrub: pause while dragging, resume after if it was playing.
  function pauseForScrub() {
    const v = videoRef.current
    scrubResumeRef.current = !!v && !v.paused
    v?.pause()
  }
  function resumeAfterScrub() {
    if (scrubResumeRef.current) videoRef.current?.play().catch(e => console.warn('lecture refusée', e))
    scrubResumeRef.current = false
  }

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
    return bandCoords(canvasRef.current, e, getBandTime(), pxPerSecRef.current)
  }

  function hitTest(e) {
    return hitTestBand(canvasCoords(e), subtitlesRef.current, charMapRef.current, numTracksRef.current)
  }

  // DOUBLAGE_IA_REVIEW §6 — click a letter on the band to cycle its detection sign.
  function hitTestLetter(e) {
    return hitTestBandLetter(canvasRef.current, canvasCoords(e), subtitlesRef.current, charMapRef.current, numTracksRef.current, wordByWord)
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
      clipFps={clipFps}
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
            onTogglePlay={togglePlay}
            onSeek={seekVideo}
            onSeekEnd={seekToEnd}
            onStepFrame={stepFrame}
            onPrevSub={gotoPrevSub}
            onNextSub={gotoNextSub}
            loopActive={loopActive}
            onToggleLoopActive={toggleLoopActive}
            onChangeSpeed={changeSpeed}
            hasTarget={selectedIdx != null || !!activeSubtitle}
            clipFps={clipFps}
            onSetIn={() => setTargetBound('in')}
            onSetOut={() => setTargetBound('out')}
          />

          <TimelineNav
            bandNow={bandNow}
            clipFps={clipFps}
            boucles={boucles}
            loopRegion={loopRegion}
            duration={duration}
            waveform={waveformData}
            sceneCuts={sceneCuts}
            subtitles={subtitles}
            charMap={charMap}
            viewStart={viewStart}
            viewEnd={viewStart + viewSpan}
            pxPerSec={pxPerSec}
            onSeek={seekBand}
            onZoom={setPxPerSec}
            onScrubStart={pauseForScrub}
            onScrubEnd={resumeAfterScrub}
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
            <BandCanvas
              ref={canvasRef}
              getTime={getRenderTime}
              onFrame={enforceLoopRegion}
              hoverRef={hoverRef}
              dragRef={dragRef}
              title={CANVAS_HINT}
              subtitles={subtitles}
              charMap={charMap}
              numTracks={numTracks}
              pxPerSec={pxPerSec}
              brStyle={rythmoStyle}
              accent={bandAccent(settings.accent)}
              brFont={brFont}
              fontScale={fontScale}
              wordByWord={wordByWord}
              detection={detection}
              detectionAuto={detectionAuto}
              waveform={waveformData}
              boucles={boucles}
              sceneCuts={sceneCuts}
              clipFps={clipFps}
              loopRegion={loopRegion}
              charFilter={charFilter}
              focusChar={charFilter.size === 1 ? [...charFilter][0] : null}
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
                  <Icon d={ICONS.loop} size={12} stroke={T.accent} /> {fmtSMPTE(loopRegion.start, clipFps)}–{fmtSMPTE(loopRegion.end, clipFps)}
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
                    {canSplit && <MenuItem icon={ICONS.scissors} onClick={() => ctxAction('split')}>Couper ici ({fmtSMPTE(ctxMenu.time, clipFps)})</MenuItem>}
                    <MenuItem icon={ICONS.plus} onClick={() => ctxAction('duplicate')}>Dupliquer après</MenuItem>
                    <MenuItem icon={ICONS.start} onClick={() => ctxAction('seekStart')}>Aller au début ({fmtSMPTE(sub.start, clipFps)})</MenuItem>
                    <MenuItem icon={ICONS.end} onClick={() => ctxAction('seekEnd')}>Aller à la fin ({fmtSMPTE(sub.end, clipFps)})</MenuItem>
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
          detectionProps={{ detection, setDetection, detectionAuto, setDetectionAuto, wordByWord, setWordByWord }}
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
