import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { T, Icon, ICONS, Btn, Chip, Segmented, Select, ScreenHeader, alpha, pressable } from '../ui'
import { useProgress } from '../ProgressContext'
import { TRACK_HEXES } from '../config/tracks'
import { fmtSMPTE } from '../utils/timecode'
import { defaultRange } from '../utils/gifRange'
import SeekBar from './import/SeekBar'
import JobError from './JobError'
import { saveBlob } from '../download'
import { usePlayerVolume, applyPlayerVolume, toggleMuted } from '../utils/playerVolume'
import VolumeControl from './VolumeControl'

// F12 — short videos are imported inline as clips of this project.
export const MEME_PROJECT = 'Memes & extraits'
const SHORT_VIDEO_MAX_S = 60
const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i
const VIDEO_RE = /\.(mp4|m4v|mov|webm|mkv|avi)$/i
const isVideoFile = f => (f.type || '').startsWith('video/') || VIDEO_RE.test(f.name)

function probeVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    const release = () => { v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url) }
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => {
      const d = v.duration
      release()
      if (Number.isFinite(d) && d > 0) resolve(d)
      else reject(new Error('durée de la vidéo inconnue'))
    }
    v.onerror = () => { release(); reject(new Error('vidéo illisible par le navigateur')) }
    v.src = url
  })
}

const fmtDur = s => `${s.toFixed(1)}s`

const FONTS = [
  { id: 'impact',   label: 'Impact',  css: 'Impact, "Arial Black", sans-serif' },
  { id: 'arialblk', label: 'Arial B.', css: '"Arial Black", Arial, sans-serif' },
  { id: 'mono',     label: 'Mono',    css: '"Courier New", Courier, monospace' },
]

// Alignment anchors the text edge at x: snap x to the matching margin (wrap width = 88%).
const ALIGN_X = { left: 6, center: 50, right: 94 }

const QUICK_COLORS_TEXT   = ['#ffffff', '#ffff00', '#ff4444', '#44ff88', '#44bbff']
const QUICK_COLORS_STROKE = ['#000000', '#ffffff', '#880000', '#004488', '#ff8800']

let _id = 1
const mkId = () => _id++

function defaultLayer(x = 50, y = 10) {
  return { id: mkId(), content: '', x, y, fontSize: 48, color: '#ffffff', strokeColor: '#000000', strokeWidth: 3, bold: true, fontId: 'impact', align: 'center' }
}

function wrapText(ctx, text, maxW) {
  if (!text) return []
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w
    if (ctx.measureText(test).width <= maxW) { cur = test }
    else { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [text]
}

const DEFAULT_FPS = 25
const MODE_ICON = { image: ICONS.film, video: ICONS.layers, audio: ICONS.volume }

export default function MemeGenerator({
  clip: clipProp = null, initialTab = null,
  clips: clipsProp, onSelectClip, onClipsCreated, onOpenInImporter,
}) {
  const progress = useProgress()

  // Source clip: the one handed in by App, unless the user picked another in the header Select.
  const [fetchedClips, setFetchedClips] = useState([])
  const [createdClips, setCreatedClips] = useState([])
  const [pickedId, setPickedId] = useState(null)
  const [importing, setImporting] = useState(false)

  const clipList = useMemo(() => {
    const base = clipsProp || fetchedClips
    const ids = new Set(base.map(c => c.clip_id))
    const all = [...createdClips.filter(c => !ids.has(c.clip_id)), ...base]
    if (clipProp && !all.some(c => c.clip_id === clipProp.clip_id)) all.unshift(clipProp)
    return [...all].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  }, [clipsProp, fetchedClips, createdClips, clipProp])

  const clip = pickedId ? (clipList.find(c => c.clip_id === pickedId) || null) : clipProp
  const segmentUrl = clip?.segment_path ? `/${clip.segment_path}` : null

  // One dot colour per project, so clips of the same project read as a group.
  const clipOptions = useMemo(() => {
    const projects = [...new Set(clipList.map(c => c.project_id).filter(Boolean))]
    const color = p => p ? TRACK_HEXES[projects.indexOf(p) % TRACK_HEXES.length] : T.text4
    return clipList.map(c => ({ v: c.clip_id, l: c.name || `Clip ${c.clip_id.slice(0, 6)}`, dot: color(c.project_id) }))
  }, [clipList])

  // MEME_PLEX_HANDOFF §2 entry intent:
  //   ClipCard "GIF" → initialTab='video' (GIF tab)
  //   Sidebar "Memes" → initialTab=null → 'image'
  //   Drop zone (no clip) → 'image'
  // Persist last-used tab per session (sessionStorage), but explicit prop wins.
  const [sourceTab, setSourceTab] = useState(() => {
    if (!clip) return 'image'   // Sidebar entry (no clip) → Image mode
    if (initialTab) return initialTab
    try {
      const last = sessionStorage.getItem('meme-last-tab')
      if (last) return last
    } catch { /* storage unavailable → default tab */ }
    return 'image'
  })
  // Persist tab selection across session.
  useEffect(() => {
    try { sessionStorage.setItem('meme-last-tab', sourceTab) } catch { /* storage unavailable */ }
  }, [sourceTab])
  const [imageUrl, setImageUrl] = useState(null)
  const [imageName, setImageName] = useState(null)
  const [imageDims, setImageDims] = useState(null)
  const [initData] = useState(() => {
    const layers = [defaultLayer(50, 8), defaultLayer(50, 91)]
    return { layers, firstId: layers[0].id }
  })
  const [texts, setTexts] = useState(initData.layers)
  const [selectedId, setSelectedId] = useState(initData.firstId)
  const [dragging, setDragging] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resultUrl, setResultUrl] = useState(null)
  // FIXES_R5 #1 — a failed Atelier job / export is shown inline only: { err, retry }.
  const [jobError, setJobError] = useState(null)
  const gifJobKeyRef = useRef(null)

  useEffect(() => {
    if (clipsProp) return
    let live = true
    fetch('/api/clips/')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (live) setFetchedClips(d || []) })
      .catch(e => { console.error('Atelier: liste des clips', e); if (live) setError('Liste des clips indisponible : ' + e.message) })
    return () => { live = false }
  }, [clipsProp])

  // Shared video state
  const [videoTime, setVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoReady, setVideoReady] = useState(false)
  const [videoAr, setVideoAr] = useState(16 / 9)

  // GIF / Audio range selection state
  const [inPoint, setInPoint] = useState(0)
  const [outPoint, setOutPoint] = useState(0)
  const [gifLoading, setGifLoading] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // Until the user sets IN / OUT, the range follows the playhead (±3 s).
  const rangeTouchedRef = useRef(false)
  const fps = clip?.fps > 0 ? clip.fps : DEFAULT_FPS
  const { volume, muted } = usePlayerVolume()

  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const fileInputRef = useRef(null)
  const mediaInputRef = useRef(null)
  const stageRef = useRef(null)
  const canvasWrapRef = useRef(null)
  const videoRef = useRef(null)
  const timelineRef = useRef(null)
  const textsRef = useRef(texts)
  const selectedIdRef = useRef(selectedId)
  const draggingRef = useRef(dragging)
  const isGifRef = useRef(false)

  textsRef.current = texts
  selectedIdRef.current = selectedId
  draggingRef.current = dragging

  // Reset only when the clip actually changes — running on mount would
  // override initialTab (ClipCard "GIF" must land on the GIF tab).
  const prevPropIdRef = useRef(clipProp?.clip_id)
  useEffect(() => {
    if (prevPropIdRef.current === clipProp?.clip_id) return
    prevPropIdRef.current = clipProp?.clip_id
    setPickedId(null)
    setSourceTab(clipProp && initialTab ? initialTab : 'image')
  }, [clipProp?.clip_id, initialTab])

  // Any source swap (App prop or header Select) drops the previous clip's frame / range.
  const prevClipIdRef = useRef(clip?.clip_id)
  useEffect(() => {
    if (prevClipIdRef.current === clip?.clip_id) return
    prevClipIdRef.current = clip?.clip_id
    setImageUrl(null)
    setResultUrl(null)
    setVideoTime(0)
    setVideoDuration(0)
    setVideoReady(false)
    setVideoAr(16 / 9)
    setInPoint(0)
    setOutPoint(0)
    setPlaying(false)
    setJobError(null)
    rangeTouchedRef.current = false
  }, [clip?.clip_id])

  // Release replaced blob URLs (frames, GIFs, results can weigh several MB).
  useEffect(() => () => { if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl) }, [imageUrl])
  useEffect(() => () => { if (resultUrl?.startsWith('blob:')) URL.revokeObjectURL(resultUrl) }, [resultUrl])

  useEffect(() => {
    if (!imageUrl) { setImageDims(null); imgRef.current = null; isGifRef.current = false; return }
    isGifRef.current = (imageName || '').toLowerCase().endsWith('.gif')
    const img = new Image()
    img.onload = () => { imgRef.current = img; setImageDims({ w: img.naturalWidth, h: img.naturalHeight }) }
    img.onerror = () => setError('Impossible de charger l\'image.')
    img.src = imageUrl
  }, [imageUrl, imageName])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const W = canvas.width, H = canvas.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    if (!isGifRef.current) ctx.drawImage(img, 0, 0, W, H)

    for (const layer of textsRef.current) {
      if (!layer.content.trim()) continue
      const font = FONTS.find(f => f.id === layer.fontId) || FONTS[0]
      const fs = Math.max(8, Math.round(layer.fontSize * (W / 560)))
      ctx.font = `${layer.bold ? 'bold ' : ''}${fs}px ${font.css}`
      ctx.textAlign = layer.align || 'center'
      ctx.textBaseline = 'middle'
      const px = (layer.x / 100) * W
      const py = (layer.y / 100) * H
      const lines = wrapText(ctx, layer.content.toUpperCase(), W * 0.88)
      const lineH = fs * 1.2
      const totalH = lines.length * lineH

      for (let i = 0; i < lines.length; i++) {
        const ly = py + (i - (lines.length - 1) / 2) * lineH
        if (layer.strokeWidth > 0) {
          ctx.lineJoin = 'round'
          ctx.lineWidth = Math.max(1, layer.strokeWidth * (W / 280))
          ctx.strokeStyle = layer.strokeColor
          ctx.strokeText(lines[i], px, ly)
        }
        ctx.fillStyle = layer.color
        ctx.fillText(lines[i], px, ly)
      }

      if (layer.id === selectedIdRef.current) {
        const maxLW = Math.max(...lines.map(l => ctx.measureText(l).width), 20)
        const bx = layer.align === 'center' ? px - maxLW / 2 - 6
                 : layer.align === 'right'  ? px - maxLW - 6
                 : px - 6
        const by = py - totalH / 2 - 4
        ctx.strokeStyle = 'rgba(245, 197, 24,0.75)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.strokeRect(bx, by, maxLW + 12, totalH + 8)
        ctx.setLineDash([])
      }
    }
  }, [])

  // Fit the canvas inside the editor stage (contain), redraw on resize.
  useEffect(() => {
    if (!imageDims) return
    const stage = stageRef.current
    if (!stage) return
    const fit = () => {
      const canvas = canvasRef.current
      const wrap = canvasWrapRef.current
      if (!canvas || !wrap) return
      const ar = imageDims.w / imageDims.h
      const w = Math.max(1, Math.floor(Math.min(stage.clientWidth, stage.clientHeight * ar)))
      const h = Math.max(1, Math.round(w / ar))
      canvas.width = w
      canvas.height = h
      wrap.style.width = `${w}px`
      wrap.style.height = `${h}px`
      draw()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [imageDims, draw, resultUrl])

  useEffect(() => { draw() }, [texts, selectedId, draw])

  function findLayerAt(cx, cy) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const W = canvas.width, H = canvas.height
    const ctx = canvas.getContext('2d')
    for (let i = textsRef.current.length - 1; i >= 0; i--) {
      const layer = textsRef.current[i]
      if (!layer.content.trim()) continue
      const font = FONTS.find(f => f.id === layer.fontId) || FONTS[0]
      const fs = Math.max(8, Math.round(layer.fontSize * (W / 560)))
      ctx.font = `${layer.bold ? 'bold ' : ''}${fs}px ${font.css}`
      const lines = wrapText(ctx, layer.content.toUpperCase(), W * 0.88)
      const lineH = fs * 1.2
      const totalH = lines.length * lineH
      const maxLW = Math.max(...lines.map(l => ctx.measureText(l).width), 10)
      const px = (layer.x / 100) * W
      const py = (layer.y / 100) * H
      const bx = layer.align === 'center' ? px - maxLW / 2 - 12
               : layer.align === 'right'  ? px - maxLW - 12
               : px - 12
      const by = py - totalH / 2 - 12
      if (cx >= bx && cx <= bx + maxLW + 24 && cy >= by && cy <= by + totalH + 24) return layer.id
    }
    return null
  }

  function getCanvasXY(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function onMouseDown(e) {
    const { x, y } = getCanvasXY(e)
    const id = findLayerAt(x, y)
    if (id != null) {
      setSelectedId(id)
      const layer = textsRef.current.find(t => t.id === id)
      setDragging({ id, startX: x, startY: y, origX: layer.x, origY: layer.y })
      e.preventDefault()
    }
  }

  function onMouseMove(e) {
    const d = draggingRef.current
    if (!d) return
    const { x, y } = getCanvasXY(e)
    const canvas = canvasRef.current
    if (!canvas) return
    const dx = ((x - d.startX) / canvas.width) * 100
    const dy = ((y - d.startY) / canvas.height) * 100
    updateLayer(d.id, {
      x: Math.max(2, Math.min(98, d.origX + dx)),
      y: Math.max(2, Math.min(98, d.origY + dy)),
    })
  }

  function onMouseUp() { setDragging(null) }

  function updateLayer(id, patch) {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    if (resultUrl) setResultUrl(null)   // editing returns to the canvas
  }

  function addLayer() {
    const layer = defaultLayer(50, 50)
    setTexts(prev => [...prev, layer])
    setSelectedId(layer.id)
  }

  function removeLayer(id) {
    setTexts(prev => {
      const next = prev.filter(t => t.id !== id)
      if (selectedIdRef.current === id) setSelectedId(next.length ? next[0].id : null)
      return next
    })
  }

  // MEME_PLEX_HANDOFF §2.4 — layer affordances: duplicate, reorder, arrow nudge.
  function duplicateLayer(id) {
    setTexts(prev => {
      const idx = prev.findIndex(t => t.id === id)
      if (idx < 0) return prev
      const src = prev[idx]
      const dupe = { ...src, id: mkId(), x: Math.min(95, src.x + 4), y: Math.min(95, src.y + 4) }
      const next = [...prev]
      next.splice(idx + 1, 0, dupe)
      setSelectedId(dupe.id)
      return next
    })
  }
  function reorderLayer(id, dir) {
    setTexts(prev => {
      const i = prev.findIndex(t => t.id === id)
      if (i < 0) return prev
      const j = dir < 0 ? i - 1 : i + 1
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function nudgeLayer(id, dx, dy) {
    setTexts(prev => prev.map(t => t.id === id
      ? { ...t, x: Math.max(0, Math.min(100, t.x + dx)), y: Math.max(0, Math.min(100, t.y + dy)) }
      : t))
  }
  // Arrow-key nudge for selected layer — only while the editor canvas is shown,
  // otherwise arrows also seek the player and move a hidden layer.
  useEffect(() => {
    if (!imageUrl || resultUrl) return
    function onKey(e) {
      if (!selectedIdRef.current) return
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      const step = e.shiftKey ? 5 : 1
      let dx = 0, dy = 0
      if (e.key === 'ArrowLeft')  dx = -step
      else if (e.key === 'ArrowRight') dx = step
      else if (e.key === 'ArrowUp')    dy = -step
      else if (e.key === 'ArrowDown')  dy = step
      else return
      e.preventDefault()
      nudgeLayer(selectedIdRef.current, dx, dy)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [imageUrl, resultUrl])

  function handleFile(f) {
    if (!f) return
    if (isVideoFile(f)) { handleVideoFile(f); return }
    if (!IMAGE_RE.test(f.name)) { setError('Format non supporté (PNG, JPG, WEBP, GIF, MP4).'); return }
    setError(null); setResultUrl(null)
    setImageName(f.name)
    setImageUrl(URL.createObjectURL(f))
  }

  // Clip changes made here keep the current mode: mark them as already seen
  // so the App-prop reset effect (entry intent) does not fire.
  function selectClip(id) {
    if (!id || id === clip?.clip_id) return
    setError(null)
    setPickedId(id)
    const picked = clipList.find(c => c.clip_id === id)
    if (!picked) return
    prevPropIdRef.current = picked.clip_id
    onSelectClip?.(picked)
  }

  function closeSource() {
    setError(null)
    setPickedId(null)
    prevPropIdRef.current = undefined
    onSelectClip?.(null)
  }

  // F12: ≤ 60 s → imported inline as a clip of MEME_PROJECT (no transcription) and
  // selected; longer → handed to Importer to be cut.
  async function handleVideoFile(f) {
    if (importing) return
    setError(null)
    let duration
    try {
      duration = await probeVideoDuration(f)
    } catch (e) {
      setError(`Impossible de lire « ${f.name} » : ${e.message}.`)
      return
    }
    if (duration > SHORT_VIDEO_MAX_S) {
      if (onOpenInImporter) onOpenInImporter(f)
      else setError(`Vidéo de ${fmtDur(duration)} (> ${SHORT_VIDEO_MAX_S} s) — ouvrez-la dans Importer pour la découper.`)
      return
    }
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', f, f.name)
      const name = f.name.replace(/\.[^.]+$/, '').trim().slice(0, 120)
      form.append('clips_json', JSON.stringify([{ name, start: 0, end: duration }]))
      const res = await fetch('/api/clips/batch', { method: 'POST', body: form })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`) }
      let created = (await res.json())[0]
      if (!created) throw new Error('aucun clip créé')
      try {
        const pr = await fetch(`/api/clips/${created.clip_id}/project`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: MEME_PROJECT }),
        })
        if (!pr.ok) throw new Error(`HTTP ${pr.status}`)
        created = await pr.json()
      } catch (e) {
        console.error('Atelier: projet du clip importé', e)
        setError(`Clip importé, mais pas rangé dans « ${MEME_PROJECT} » : ${e.message}`)
      }
      setCreatedClips(prev => [created, ...prev.filter(c => c.clip_id !== created.clip_id)])
      onClipsCreated?.([created])
      setPickedId(created.clip_id)
      prevPropIdRef.current = created.clip_id
      onSelectClip?.(created)
    } catch (e) {
      setError('Import de la vidéo échoué : ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  // The <video> remounts with each source / return from the editor: apply on load too.
  useEffect(() => { applyPlayerVolume(videoRef.current) }, [volume, muted])

  function onVideoLoaded(e) {
    applyPlayerVolume(e.target)
    const dur = e.target.duration
    const { videoWidth: vw, videoHeight: vh } = e.target
    if (vw > 0 && vh > 0) setVideoAr(vw / vh)
    setVideoDuration(dur)
    if (!rangeTouchedRef.current) {
      const r = defaultRange(e.target.currentTime, dur)
      setInPoint(r.in)
      setOutPoint(r.out)
    }
    setVideoReady(true)
  }

  // Entering GIF / Audio with an untouched range recentres it on the playhead.
  useEffect(() => {
    if (sourceTab === 'image' || rangeTouchedRef.current) return
    const v = videoRef.current
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return
    const r = defaultRange(v.currentTime, v.duration)
    setInPoint(r.in)
    setOutPoint(r.out)
  }, [sourceTab])

  function seekVideo(t) {
    setVideoTime(t)
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = t; setPlaying(false) }
  }

  function seekRelative(delta) {
    const v = videoRef.current
    if (!v) return
    const t = Math.max(0, Math.min(videoDuration, v.currentTime + delta))
    seekVideo(t)
  }

  useEffect(() => {
    if (!segmentUrl || imageUrl) return
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); seekRelative(e.shiftKey ? -1 : -0.1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekRelative(e.shiftKey ? 1 : 0.1) }
      else if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay() }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMuted() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [segmentUrl, imageUrl, videoDuration, inPoint, outPoint, sourceTab])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      // GIF / Audio preview plays the selection; Image mode plays freely.
      if (sourceTab !== 'image' && (v.currentTime >= outPoint || v.currentTime < inPoint)) v.currentTime = inPoint
      v.play()
    } else {
      v.pause()
    }
  }

  function onGifTimeUpdate(e) {
    const t = e.target.currentTime
    setVideoTime(t)
    // Only playback wraps at OUT — seeking past it must stay free to pick a new range.
    if (!e.target.paused && t >= outPoint) {
      e.target.pause()
      e.target.currentTime = inPoint
      setPlaying(false)
    }
  }

  function captureFrame() {
    const video = videoRef.current
    if (!video) return
    const c = document.createElement('canvas')
    c.width = video.videoWidth
    c.height = video.videoHeight
    c.getContext('2d').drawImage(video, 0, 0)
    c.toBlob(blob => {
      setImageName(`${clip?.name || 'frame'}_${videoTime.toFixed(1)}s.jpg`)
      setImageUrl(URL.createObjectURL(blob))
      setResultUrl(null)
    }, 'image/jpeg', 0.95)
  }

  async function createGif() {
    if (!clip) return
    const duration = outPoint - inPoint
    if (duration <= 0) { setError('OUT doit être après IN'); return }
    setGifLoading(true)
    setError(null)
    setJobError(null)
    const body = {
      segment_id: clip.clip_id, subtitles: [],
      format: 'gif', in_point: inPoint, out_point: outPoint,
    }
    const fireJob = async () => {
      const res = await fetch('/api/export/gif-job', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`) }
      const { job_id } = await res.json()
      return job_id
    }
    const failed = err => { setJobError({ err, retry: retryGif }); setGifLoading(false) }
    // Activité's Réessayer also goes through here: a refused restart shows inline.
    const retryJob = async () => {
      try {
        return await fireJob()
      } catch (e) {
        failed(e)
        throw e
      }
    }
    try {
      const jobId = await fireJob()
      const handle = progress.start({
        kind: 'export-gif',
        clipId: clip.clip_id,
        title: 'GIF — génération',
        jobId,
        retry: retryJob,
        toast: false,
        onDone: (blob) => {
          if (blob && blob instanceof Blob) {
            setImageName(`${clip.name}_${inPoint.toFixed(1)}s-${outPoint.toFixed(1)}s.gif`)
            setImageUrl(URL.createObjectURL(blob))
            setResultUrl(null)
          }
          setGifLoading(false)
        },
        onError: failed,
        onCancel: () => { setError('GIF annulé.'); setGifLoading(false) },
      })
      gifJobKeyRef.current = handle.key
    } catch (e) {
      gifJobKeyRef.current = null
      failed(e)
    }
  }

  // Inline Réessayer: restart the failed job in place (one Activité row), or
  // start a new one when it is gone (dismissed, or never started).
  function retryGif() {
    const key = gifJobKeyRef.current
    if (key && progress.jobs.some(j => j.key === key && j.status === 'error')) {
      setJobError(null)
      setGifLoading(true)
      progress.retry(key)
      return
    }
    createGif()
  }

  async function createAudio(format) {
    if (!clip) return
    setAudioLoading(true)
    setError(null)
    setJobError(null)
    try {
      if (outPoint <= inPoint) throw new Error('OUT doit être après IN')
      const res = await fetch('/api/export/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment_id: clip.clip_id,
          subtitles: [],
          format,
          in_point: inPoint,
          out_point: outPoint,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.name}_${inPoint.toFixed(1)}s-${outPoint.toFixed(1)}s.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setJobError({ err: e, retry: () => createAudio(format) })
    } finally {
      setAudioLoading(false)
    }
  }

  async function generate() {
    const active = texts.filter(t => t.content.trim())
    if (!imageUrl) { setError('Choisissez une image.'); return }
    setLoading(true); setError(null); setResultUrl(null)
    try {
      const fd = new FormData()
      const r = await fetch(imageUrl)
      const blob = await r.blob()
      fd.append('file', new File([blob], imageName || 'image.jpg', { type: blob.type }))
      fd.append('texts', JSON.stringify(active.map(l => ({
        content: l.content,
        x_pct: l.x, y_pct: l.y,
        font_size: l.fontSize,
        color: l.color, stroke_color: l.strokeColor, stroke_width: l.strokeWidth,
        bold: l.bold, align: l.align, font_style: l.fontId,
      }))))
      const res = await fetch('/api/meme/generate', { method: 'POST', body: fd })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`) }
      setResultUrl(URL.createObjectURL(await res.blob()))
    } catch (e) {
      setError('Erreur : ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function download() {
    if (!resultUrl) return
    try {
      const blob = await (await fetch(resultUrl)).blob()
      const ext = { 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[blob.type] || 'png'
      const base = (imageName || 'meme').replace(/\.[^.]+$/, '')
      saveBlob(blob, `${base}_meme.${ext}`)
    } catch (e) {
      setError('Téléchargement échoué : ' + e.message)
    }
  }

  function resetMeme() {
    setImageUrl(null)
    setResultUrl(null)
    setError(null)
  }

  // Drag along the range track: seek, or move the IN / OUT handles.
  function trackDrag(e, apply) {
    e.preventDefault()
    e.stopPropagation()
    const el = timelineRef.current
    if (!el) return
    const getT = ev => {
      const rect = el.getBoundingClientRect()
      return Math.max(0, Math.min(videoDuration, (ev.clientX - rect.left) / rect.width * videoDuration))
    }
    apply(getT(e))
    const onMove = ev => apply(getT(ev))
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const dragIn = t => { rangeTouchedRef.current = true; const v = Math.max(0, Math.min(t, outPoint - 0.1)); setInPoint(v); seekVideo(v) }
  const dragOut = t => { rangeTouchedRef.current = true; const v = Math.min(videoDuration, Math.max(t, inPoint + 0.1)); setOutPoint(v); seekVideo(v) }
  const markDrag = (which, t) => (which === 'in' ? dragIn : dragOut)(t)
  const pauseVideo = () => videoRef.current?.pause()
  const scrubTo = t => { setVideoTime(t); if (videoRef.current) videoRef.current.currentTime = t }

  const sel = texts.find(t => t.id === selectedId)
  const selIndex = texts.findIndex(t => t.id === selectedId)
  const gifDuration = Math.max(0, outPoint - inPoint).toFixed(1)
  const editing = !!imageUrl
  const isGif = (imageName || '').toLowerCase().endsWith('.gif')
  const pct = t => `${(t / (videoDuration || 1)) * 100}%`
  const blue = T.info

  const errorBox = (error || jobError) && (<>
    {error && (
      <div style={{ padding: '8px 10px', background: alpha(T.danger, '14'), color: T.danger, borderRadius: T.r.ctl, fontSize: T.fs.xs, border: `1px solid ${alpha(T.danger, '44')}` }}>
        {error}
      </div>
    )}
    {jobError && <JobError error={jobError.err} onRetry={jobError.retry} />}
  </>)

  const noClip = !segmentUrl

  const transport = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Btn size="sm" icon={ICONS.skipBack} onClick={() => seekRelative(-1)} title="−1 s (Maj+←)" />
      <Btn size="sm" icon={ICONS.prevFrame} onClick={() => seekRelative(-0.1)} title="−0,1 s (←)" />
      <Btn size="sm" variant="solid" icon={playing ? ICONS.pause : ICONS.play} onClick={togglePlay} title="Lecture / pause (Espace)" />
      <Btn size="sm" icon={ICONS.nextFrame} onClick={() => seekRelative(0.1)} title="+0,1 s (→)" />
      <Btn size="sm" icon={ICONS.skipFwd} onClick={() => seekRelative(1)} title="+1 s (Maj+→)" />
    </div>
  )

  const clipSelect = (
    <Select width={250} value={clip?.clip_id ?? null} onChange={selectClip} options={clipOptions} placeholder="Choisir un clip…" />
  )
  const uploadBtn = (
    <Btn variant="outline" icon={ICONS.upload} onClick={() => mediaInputRef.current?.click()} disabled={importing}
      title={importing ? 'Import de la vidéo en cours…' : `Image (PNG, JPG, WEBP, GIF) ou vidéo de ${SHORT_VIDEO_MAX_S} s max. (clip « ${MEME_PROJECT} »)`}>
      {importing ? 'Import…' : 'Image ou vidéo…'}
    </Btn>
  )
  const dropProps = {
    onDragOver: e => { e.preventDefault(); setDragOver(true) },
    onDragLeave: () => setDragOver(false),
    onDrop: e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) },
  }

  // FIXES_R4 #3 — no source: one compact 16:9 card, no mode actions.
  const sourceWhat = { image: 'capturer un frame', video: 'extraire un GIF', audio: 'exporter l’audio' }[sourceTab]
  const emptySource = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div {...dropProps} style={{
        width: 'min(100%, 720px, calc((100vh - 330px) * 16 / 9))', aspectRatio: '16/9', borderRadius: T.r.card,
        border: `2px dashed ${dragOver ? T.accent : T.border2}`, background: dragOver ? alpha(T.accent, '0d') : T.bg2, transition: 'border-color .15s, background .15s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, border: `1px solid ${T.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon d={MODE_ICON[sourceTab] || ICONS.film} size={22} stroke={T.text2} />
        </div>
        <div>
          <div style={{ fontSize: T.fs.md, fontWeight: 600, color: T.text }}>Choisissez une source</div>
          <div style={{ fontSize: T.fs.xs, color: T.text3, marginTop: 4 }}>pour {sourceWhat}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {clipSelect}
          {uploadBtn}
        </div>
        <div style={{ fontSize: T.fs.micro, color: T.text3 }}>
          ou glissez une image / vidéo ici · MP4 ≤ {SHORT_VIDEO_MAX_S} s, plus longue → <span style={{ color: T.accent }}>Importer</span>
        </div>
      </div>
      {error && <div style={{ width: 'min(100%, 720px, calc((100vh - 330px) * 16 / 9))' }}>{errorBox}</div>}
    </div>
  )

  // FIXES_R4 #4 — player sized to the video (16:9 until metadata), capped so its
  // controls stay on screen: no black bars, no scrolling.
  const videoStub = footer => (
    <div style={{
      background: '#000', borderRadius: T.r.card, border: `1px solid ${T.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      width: `min(100%, calc((100vh - 400px) * ${videoAr}))`, justifySelf: 'center',
    }}>
      <div onClick={togglePlay} style={{ aspectRatio: String(videoAr), position: 'relative', cursor: 'pointer', background: '#000' }}>
        <video
          key={segmentUrl}
          ref={videoRef}
          src={segmentUrl}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          onLoadedMetadata={onVideoLoaded}
          onTimeUpdate={e => sourceTab === 'image' ? setVideoTime(e.target.currentTime) : onGifTimeUpdate(e)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      </div>
      {footer}
    </div>
  )

  const imageFooter = (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div onMouseDown={e => trackDrag(e, seekVideo)} style={{ padding: '3px 0', cursor: 'pointer' }}>
        <div ref={timelineRef} style={{ height: 4, background: T.surface3, borderRadius: 2, position: 'relative' }}>
          <div style={{ width: pct(videoTime), height: '100%', background: T.accent, borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: pct(videoTime), top: -3, width: 10, height: 10, borderRadius: '50%', background: T.accent, transform: 'translateX(-50%)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
        <span>{fmtSMPTE(videoTime, fps)} / {fmtSMPTE(videoDuration, fps)}</span>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{transport}</div>
        <VolumeControl width={64} />
      </div>
    </div>
  )

  // FIXES_R5 #4 — the Importer's seek bar: IN→OUT in info 33 with an accent
  // OUT edge; dragging an edge moves IN / OUT, anywhere else seeks.
  const rangeFooter = (<>
    <SeekBar t={videoTime} duration={videoDuration} fps={fps} markIn={inPoint} markOut={outPoint}
      onScrubStart={pauseVideo} onScrub={scrubTo} onScrubEnd={() => {}} onMarkDrag={markDrag} />
    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.fontMono, fontSize: 11, background: T.surface }}>
      <Chip soft color={blue} onClick={() => dragIn(videoTime)}>[ IN {fmtSMPTE(inPoint, fps)}</Chip>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: T.text3 }}>
        {transport}
        <span>{fmtSMPTE(videoTime, fps)} · {gifDuration}s</span>
        <VolumeControl width={64} />
      </div>
      <Chip soft color={T.accent} onClick={() => dragOut(videoTime)}>OUT {fmtSMPTE(outPoint, fps)} ]</Chip>
    </div>
  </>)

  const hint = text => <p style={{ fontSize: T.fs.xs, color: T.text3, lineHeight: 1.6, margin: 0 }}>{text}</p>

  const dropZone = (
    <div
      role="button" tabIndex={0}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
      {...dropProps}
      style={{ padding: 22, border: `2px dashed ${dragOver ? T.accent : T.border2}`, borderRadius: T.r.card, textAlign: 'center', color: T.text3, cursor: 'pointer', transition: 'border-color .2s' }}>
      <Icon d={ICONS.upload} size={26} stroke={T.text3} style={{ margin: '0 auto' }} />
      <div style={{ fontSize: T.fs.xs, fontWeight: 600, marginTop: 8, color: T.text2 }}>{importing ? 'Import de la vidéo…' : 'Ou utiliser votre image'}</div>
      <div style={{ fontSize: 11, marginTop: 2 }}>PNG · JPG · WEBP · GIF</div>
    </div>
  )

  let sourcePanel
  // Why a source action is unavailable — shown as the disabled button's tooltip.
  const rangeBlocker = busyMsg => busyMsg ? busyMsg
    : !videoReady ? 'Chargement de la vidéo…'
      : outPoint <= inPoint ? 'Le point OUT doit être après IN' : undefined
  if (sourceTab === 'video') {
    const gifTitle = rangeBlocker(gifLoading && 'GIF en cours de génération…')
    sourcePanel = (<>
      <Btn variant="primary" size="lg" full icon={ICONS.layers} onClick={createGif} disabled={!!gifTitle} title={gifTitle}>
        {gifLoading ? 'Génération GIF…' : 'Créer le GIF'}
      </Btn>
      {errorBox}
      {hint("Réglez IN / OUT puis créez le GIF. Il s'ouvre dans l'éditeur de texte.")}
    </>)
  } else if (sourceTab === 'audio') {
    const audioTitle = rangeBlocker(audioLoading && 'Export audio en cours…')
    const audioDisabled = !!audioTitle
    sourcePanel = (<>
      <Btn variant="primary" size="lg" full icon={ICONS.download} onClick={() => createAudio('mp3')} disabled={audioDisabled} title={audioTitle}>
        {audioLoading ? 'Export…' : 'Télécharger MP3'}
      </Btn>
      <Btn variant="solid" full icon={ICONS.download} onClick={() => createAudio('wav')} disabled={audioDisabled} title={audioTitle}>Télécharger WAV</Btn>
      {errorBox}
      {hint("Exporte l'audio de la sélection. MP3 compact, WAV lossless.")}
    </>)
  } else {
    sourcePanel = (<>
      <Btn variant="primary" size="lg" full icon={ICONS.film} onClick={captureFrame} disabled={!videoReady}
        title={!videoReady ? 'Chargement de la vidéo…' : 'Capturer l’image affichée pour en faire un meme'}>Capturer ce frame</Btn>
      {errorBox}
      {hint('Naviguez puis capturez le frame souhaité — ou glissez votre propre image.')}
      {dropZone}
    </>)
  }

  const swatches = (colors, value, key) => colors.map(c => (
    <button data-rd key={c} title={c} onClick={() => updateLayer(selectedId, { [key]: c })} style={{
      width: 22, height: 22, borderRadius: 5, background: c, padding: 0, cursor: 'pointer', flexShrink: 0,
      border: value.toLowerCase() === c ? `2px solid ${T.accent}` : '1px solid #444',
    }} />
  ))

  const colorInput = (value, key, title) => (
    <input type="color" value={value} title={title}
      onChange={e => updateLayer(selectedId, { [key]: e.target.value })}
      style={{ width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
  )


  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ScreenHeader
        kicker="ATELIER"
        title="Meme · GIF · Audio"
        sub={clip ? `source · ${clip.name || `Clip ${clip.clip_id.slice(0, 6)}`} · ${fmtDur(Math.max(0, (clip.end ?? 0) - (clip.start ?? 0)))}`
          : editing && imageName ? `image · ${imageName}` : 'aucune source'}
        right={editing
          ? <Btn variant="outline" onClick={resetMeme} icon={ICONS.chevron} style={{ transform: 'none' }}>Sources</Btn>
          : noClip ? null : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {clipSelect}
              {uploadBtn}
              <Btn icon={ICONS.close} title="Fermer la source" onClick={closeSource} />
            </div>
          )}
      />
      {!editing && (
        <div style={{ padding: '0 32px 14px', flexShrink: 0 }}>
          <Segmented value={sourceTab} onChange={setSourceTab} options={[
            { v: 'image', l: 'Image', icon: ICONS.film }, { v: 'video', l: 'GIF', icon: ICONS.layers }, { v: 'audio', l: 'Audio', icon: ICONS.volume },
          ]} />
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, padding: '0 32px 28px', overflow: 'auto' }}>
        {!editing && noClip ? emptySource : !editing ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 22, height: '100%', alignItems: 'start' }}>
            {videoStub(sourceTab === 'image' ? imageFooter : rangeFooter)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sourcePanel}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, height: '100%' }}>
            {/* Result REPLACES the editor canvas once generated — never source + result stacked. */}
            {resultUrl ? (
              <div style={{ background: '#000', borderRadius: T.r.card, border: `1px solid ${T.accent}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${T.border}`, fontSize: T.fs.xs, color: T.accent, fontWeight: 600 }}>Résultat</div>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-linear-gradient(0deg,#16161c 0 2px,#1b1b22 2px 6px)' }}>
                  <img src={resultUrl} alt="meme" style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: `1px solid ${T.border}` }}>
                  <Btn variant="solid" icon={ICONS.undo} onClick={() => setResultUrl(null)} style={{ flex: 1 }}>Refaire</Btn>
                  <Btn variant="primary" icon={ICONS.download} onClick={download} style={{ flex: 1 }}>Télécharger</Btn>
                </div>
              </div>
            ) : (
              <div style={{ background: '#000', borderRadius: T.r.card, border: `1px solid ${T.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${T.border}`, fontSize: T.fs.xs, color: T.text3 }}>Glissez le texte pour le repositionner</div>
                <div ref={stageRef} style={{ flex: 1, minHeight: 0, position: 'relative', background: 'repeating-linear-gradient(0deg,#16161c 0 2px,#1b1b22 2px 6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <div ref={canvasWrapRef} style={{ position: 'relative', flexShrink: 0 }}>
                    {isGif && <img src={imageUrl} alt="" style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none', userSelect: 'none' }} />}
                    <canvas
                      ref={canvasRef}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
                      onMouseDown={onMouseDown}
                      onMouseMove={onMouseMove}
                      onMouseUp={onMouseUp}
                      onMouseLeave={onMouseUp}
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto', minHeight: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
                  <span style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.2, color: T.text3 }}>TEXTES</span>
                  <div style={{ flex: 1 }} />
                  <Btn size="xs" active icon={ICONS.plus} onClick={addLayer} style={{ background: 'transparent' }}>Ajouter</Btn>
                </div>
                {texts.map((t, i) => {
                  const on = t.id === selectedId
                  return (
                    <div key={t.id} onClick={() => setSelectedId(t.id)} {...pressable(true)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', marginBottom: 6, borderRadius: T.r.ctl, cursor: 'pointer',
                      background: on ? alpha(T.accent, '14') : T.surface2, border: `1px solid ${on ? alpha(T.accent, '55') : T.border}`,
                    }}>
                      <span style={{ fontSize: 10, color: T.text4, width: 12, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <input
                        value={t.content}
                        onChange={e => updateLayer(t.id, { content: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        onFocus={() => setSelectedId(t.id)}
                        placeholder={i === 0 ? 'WHEN YOU…' : i === 1 ? '…IT\'S FRIDAY' : 'Texte…'}
                        style={{
                          flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', padding: 0,
                          fontSize: T.fs.xs, color: T.text, letterSpacing: 0.3,
                          fontFamily: (FONTS.find(f => f.id === t.fontId) || FONTS[0]).css,
                        }}
                      />
                      <Btn size="xs" icon={ICONS.chevron} title={i === 0 ? 'Déjà en première position' : 'Monter'} disabled={i === 0}
                        onClick={e => { e.stopPropagation(); reorderLayer(t.id, -1) }} style={{ transform: 'rotate(180deg)' }} />
                      <Btn size="xs" icon={ICONS.chevron} title={i === texts.length - 1 ? 'Déjà en dernière position' : 'Descendre'} disabled={i === texts.length - 1}
                        onClick={e => { e.stopPropagation(); reorderLayer(t.id, 1) }} />
                      <Btn size="xs" icon={ICONS.layers} title="Dupliquer"
                        onClick={e => { e.stopPropagation(); duplicateLayer(t.id) }} />
                      {texts.length > 1 && (
                        <Btn size="xs" danger icon={ICONS.trash} title="Supprimer"
                          onClick={e => { e.stopPropagation(); removeLayer(t.id) }} />
                      )}
                    </div>
                  )
                })}
                <div style={{ fontSize: 9.5, color: T.text4, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  ↑↓ réordonner · <Icon d={ICONS.layers} size={11} stroke="currentColor" /> dupliquer · flèches pour ajuster la position
                </div>
              </div>

              {sel && (
                <div>
                  <div style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.2, color: T.text3, marginBottom: 9 }}>STYLE — TEXTE {selIndex + 1}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Field label="POLICE">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Segmented value={sel.fontId} onChange={v => updateLayer(selectedId, { fontId: v })}
                          options={FONTS.map(f => ({ v: f.id, l: f.label }))} />
                        <Btn size="sm" active={sel.bold} title="Gras" onClick={() => updateLayer(selectedId, { bold: !sel.bold })}
                          style={{ fontWeight: 700 }}>B</Btn>
                      </div>
                    </Field>
                    <Field label={`TAILLE — ${sel.fontSize}px`}>
                      <input type="range" min={16} max={120} value={sel.fontSize} aria-label="Taille"
                        onChange={e => updateLayer(selectedId, { fontSize: +e.target.value })}
                        style={{ width: '100%', color: T.accent, '--pct': `${((sel.fontSize - 16) / (120 - 16)) * 100}%` }} />
                    </Field>
                    <Field label="COULEUR">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {swatches(QUICK_COLORS_TEXT, sel.color, 'color')}
                        {colorInput(sel.color, 'color', 'Couleur personnalisée')}
                      </div>
                    </Field>
                    <Field label={`CONTOUR — ÉPAISSEUR ${sel.strokeWidth}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        {swatches(QUICK_COLORS_STROKE, sel.strokeColor, 'strokeColor')}
                        {colorInput(sel.strokeColor, 'strokeColor', 'Contour personnalisé')}
                      </div>
                      <input type="range" min={0} max={8} value={sel.strokeWidth} aria-label="Épaisseur du contour"
                        onChange={e => updateLayer(selectedId, { strokeWidth: +e.target.value })}
                        style={{ width: '100%', color: T.accent, '--pct': `${(sel.strokeWidth / 8) * 100}%` }} />
                    </Field>
                    <Field label="ALIGNEMENT">
                      <Segmented value={sel.align} onChange={v => updateLayer(selectedId, { align: v, x: ALIGN_X[v] })} options={[
                        { v: 'left', l: 'Gauche' }, { v: 'center', l: 'Centre' }, { v: 'right', l: 'Droite' },
                      ]} />
                    </Field>
                  </div>
                </div>
              )}

              {errorBox}

              <Btn variant="primary" size="lg" full icon={ICONS.sparkle} onClick={generate} disabled={loading || !imageUrl}
                title={loading ? 'Génération en cours…' : !imageUrl ? "Choisissez une image d'abord" : undefined}>
                {loading ? 'Génération…' : resultUrl ? 'Régénérer' : 'Générer'}
              </Btn>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.gif"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleFile(f) }} style={{ display: 'none' }} />
        <input ref={mediaInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.gif,video/*"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleFile(f) }} style={{ display: 'none' }} />
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.text3, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

