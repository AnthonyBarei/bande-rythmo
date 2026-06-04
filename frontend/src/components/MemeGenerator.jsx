import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Icon, ICONS } from '../Icons'
import { useProgress } from '../ProgressContext'

const FONTS = [
  { id: 'impact',   label: 'Impact',  css: 'Impact, "Arial Black", sans-serif' },
  { id: 'arialblk', label: 'Arial B.', css: '"Arial Black", Arial, sans-serif' },
  { id: 'mono',     label: 'Mono',    css: '"Courier New", Courier, monospace' },
]

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

const fmtTime = t => {
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

export default function MemeGenerator({ clip = null, onBack = null, initialTab = null }) {
  const segmentUrl = clip?.segment_path ? `/${clip.segment_path}` : null
  const progress = useProgress()

  // MEME_PLEX_HANDOFF §2 entry intent:
  //   ClipCard "GIF" → initialTab='video' (GIF tab)
  //   Sidebar "Memes" → initialTab=null → 'image'
  //   Drop zone (no clip) → 'image'
  // Persist last-used tab per session (sessionStorage), but explicit prop wins.
  const [sourceTab, setSourceTab] = useState(() => {
    if (initialTab) return initialTab
    try {
      const last = sessionStorage.getItem('meme-last-tab')
      if (last) return last
    } catch {}
    return 'image'
  })
  // Persist tab selection across session.
  useEffect(() => {
    try { sessionStorage.setItem('meme-last-tab', sourceTab) } catch {}
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

  // Shared video state
  const [videoTime, setVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoReady, setVideoReady] = useState(false)

  // GIF / Audio range selection state
  const [inPoint, setInPoint] = useState(0)
  const [outPoint, setOutPoint] = useState(0)
  const [gifLoading, setGifLoading] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const [playing, setPlaying] = useState(false)

  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const fileInputRef = useRef(null)
  const dropRef = useRef(null)
  const videoRef = useRef(null)
  const timelineRef = useRef(null)
  const textsRef = useRef(texts)
  const selectedIdRef = useRef(selectedId)
  const draggingRef = useRef(dragging)
  const isGifRef = useRef(false)

  textsRef.current = texts
  selectedIdRef.current = selectedId
  draggingRef.current = dragging

  useEffect(() => {
    setImageUrl(null)
    setResultUrl(null)
    setVideoTime(0)
    setVideoDuration(0)
    setVideoReady(false)
    setInPoint(0)
    setOutPoint(0)
    setSourceTab('image')
  }, [clip?.clip_id])

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

  useEffect(() => {
    if (!imageDims) return
    const canvas = canvasRef.current
    if (!canvas) return
    const maxW = Math.min(canvas.parentElement?.clientWidth || 800, 900)
    canvas.width = maxW
    canvas.height = Math.round(maxW * (imageDims.h / imageDims.w))
    draw()
  }, [imageDims, draw])

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
  // Arrow-key nudge for selected layer when not editing text.
  useEffect(() => {
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
  }, [])

  function handleFile(f) {
    if (!f) return
    if (!/\.(png|jpe?g|webp|gif)$/i.test(f.name)) { setError('Format non supporté (PNG, JPG, WEBP, GIF).'); return }
    setError(null); setResultUrl(null)
    setImageName(f.name)
    setImageUrl(URL.createObjectURL(f))
  }

  function onVideoLoaded(e) {
    const dur = e.target.duration
    setVideoDuration(dur)
    setOutPoint(prev => prev === 0 ? dur : prev)
    setVideoReady(true)
  }

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
    if (sourceTab !== 'video' && sourceTab !== 'audio') return
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); seekRelative(e.shiftKey ? -1 : -0.1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekRelative(e.shiftKey ? 1 : 0.1) }
      else if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sourceTab, videoDuration])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (v.currentTime >= outPoint) v.currentTime = inPoint
      v.play()
    } else {
      v.pause()
    }
  }

  function onGifTimeUpdate(e) {
    const t = e.target.currentTime
    setVideoTime(t)
    if (t >= outPoint) {
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
    try {
      const jobId = await fireJob()
      progress.start({
        kind: 'export-gif',
        title: 'GIF — génération',
        jobId,
        retry: fireJob,
        onDone: (blob) => {
          if (blob && blob instanceof Blob) {
            setImageName(`${clip.name}_${inPoint.toFixed(1)}s-${outPoint.toFixed(1)}s.gif`)
            setImageUrl(URL.createObjectURL(blob))
            setResultUrl(null)
          }
          setGifLoading(false)
        },
        onError: (err) => { setError('Erreur GIF : ' + err.message); setGifLoading(false) },
        onCancel: () => { setError('GIF annulé.'); setGifLoading(false) },
      })
    } catch (e) {
      setError('Erreur GIF : ' + e.message)
      setGifLoading(false)
    }
  }

  async function createAudio(format) {
    if (!clip) return
    setAudioLoading(true)
    setError(null)
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
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError('Erreur audio : ' + e.message)
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

  function download() {
    if (!resultUrl) return
    const ext = (imageName || '').toLowerCase().endsWith('.gif') ? 'gif' : 'png'
    const a = document.createElement('a'); a.href = resultUrl; a.download = `meme.${ext}`; a.click()
  }

  function resetMeme() {
    setImageUrl(null)
    setResultUrl(null)
    setError(null)
  }

  const sel = texts.find(t => t.id === selectedId)
  const gifDuration = Math.max(0, outPoint - inPoint).toFixed(1)

  return (
    <div style={{ padding: '20px 28px', overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <button onClick={onBack} style={BTN_GHOST}>← Mes clips</button>
          )}
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Meme</h1>
          {clip && <span style={{ fontSize: 10, color: '#888', background: 'var(--surface3)', padding: '2px 7px', borderRadius: 3, border: '1px solid var(--border2)' }}>{clip.name}</span>}
          <div style={{ flex: 1 }} />
          {imageUrl && (
            <button onClick={resetMeme} style={BTN_GHOST}>
              + Nouveau
            </button>
          )}
        </div>

        {!imageUrl ? (
          <div>
            {/* Tab switcher — only when clip provided.
                MEME_PLEX_HANDOFF §2.2: rename by intent + one-line flow hint. */}
            {clip && (
              <>
                <div style={{ display: 'flex', gap: 0, marginBottom: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 99, padding: 3, width: 'fit-content' }}>
                  {[['image', ICONS.film, 'Image'], ['video', ICONS.gif, 'GIF'], ['audio', ICONS.audio, 'Extrait audio']].map(([tab, icon, label]) => (
                    <button key={tab} onClick={() => setSourceTab(tab)} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 16px', fontSize: 12, fontWeight: 600,
                      background: sourceTab === tab ? 'var(--bg2)' : 'transparent',
                      color: sourceTab === tab ? 'var(--accent)' : 'var(--text2)',
                      border: 'none',
                      borderRadius: 99,
                      borderBottom: sourceTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                      cursor: 'pointer', minHeight: 32,
                    }}><Icon d={icon} size={14} />{label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>
                  {sourceTab === 'audio'
                    ? "L'audio s'exporte directement — pas d'éditeur."
                    : 'Image & GIF passent par l\'éditeur de texte.'}
                </div>
              </>
            )}

            {/* IMAGE TAB — no clip, show drop zone */}
            {sourceTab === 'image' && !segmentUrl && (
              <div
                ref={dropRef}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); dropRef.current.style.borderColor = 'var(--accent)' }}
                onDragLeave={() => { dropRef.current.style.borderColor = '' }}
                onDrop={e => { e.preventDefault(); dropRef.current.style.borderColor = ''; handleFile(e.dataTransfer.files?.[0]) }}
                style={{ border: '2px dashed var(--border2)', borderRadius: 8, padding: 60, textAlign: 'center', background: 'var(--surface)', cursor: 'pointer', transition: 'border-color 0.2s' }}
              >
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}><Icon d={ICONS.upload} size={38} sw={1.4} /></div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>Glissez une image ou un GIF</div>
                <div style={{ fontSize: 12, color: '#888' }}>PNG · JPG · WEBP · GIF animé</div>
              </div>
            )}

            {/* UNIFIED PLAYER — one transport for Image / GIF / Audio.
                Image mode hides the IN/OUT range (capture is at the playhead);
                GIF/Audio show the range. MEME_PLEX_HANDOFF §2.1. */}
            {segmentUrl && (() => {
              const imageMode = sourceTab === 'image'
              const rangePlayer = (
                <div style={{ background: '#000', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden', borderRadius: '6px 6px 0 0' }} onClick={togglePlay}>
                    <video
                      ref={videoRef}
                      src={segmentUrl}
                      style={{ display: 'block', width: '100%' }}
                      onLoadedMetadata={onVideoLoaded}
                      onTimeUpdate={e => imageMode ? setVideoTime(e.target.currentTime) : onGifTimeUpdate(e)}
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                    />
                    <div style={{
                      position: 'absolute', top: 8, left: 8,
                      background: 'rgba(0,0,0,0.55)', borderRadius: 4,
                      padding: '5px', color: '#fff', pointerEvents: 'none',
                    }}>
                      <Icon d={playing ? ICONS.pause : ICONS.play} size={12} />
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', borderTop: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Timeline click/drag to seek */}
                    <div
                      ref={timelineRef}
                      style={{ position: 'relative', height: 10, background: 'var(--surface3)', borderRadius: 3, cursor: 'pointer' }}
                      onMouseDown={e => {
                        e.preventDefault()
                        const el = timelineRef.current
                        if (!el) return
                        const dur = videoDuration
                        const getT = ev => {
                          const rect = el.getBoundingClientRect()
                          return Math.max(0, Math.min(dur, (ev.clientX - rect.left) / rect.width * dur))
                        }
                        seekVideo(getT(e))
                        const onMove = ev => seekVideo(getT(ev))
                        const onUp = () => {
                          document.removeEventListener('mousemove', onMove)
                          document.removeEventListener('mouseup', onUp)
                        }
                        document.addEventListener('mousemove', onMove)
                        document.addEventListener('mouseup', onUp)
                      }}
                    >
                      {!imageMode && <>
                        <div style={{ position: 'absolute', top: 0, height: '100%', background: 'rgba(245, 197, 24,0.35)', borderRadius: 3, left: `${(inPoint / (videoDuration || 1)) * 100}%`, width: `${((outPoint - inPoint) / (videoDuration || 1)) * 100}%` }} />
                        <div style={{ position: 'absolute', top: 0, width: 3, height: '100%', background: '#4af', borderRadius: 1, left: `${(inPoint / (videoDuration || 1)) * 100}%` }} />
                        <div style={{ position: 'absolute', top: 0, width: 3, height: '100%', background: 'var(--accent)', borderRadius: 1, left: `calc(${(outPoint / (videoDuration || 1)) * 100}% - 3px)` }} />
                      </>}
                      <div style={{ position: 'absolute', top: -3, width: 2, height: 'calc(100% + 6px)', background: '#fff', borderRadius: 1, left: `${(videoTime / (videoDuration || 1)) * 100}%`, boxShadow: '0 0 4px rgba(255,255,255,0.6)', pointerEvents: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                      <button onClick={() => seekRelative(-1)} style={SEEK_BTN} title="−1s (Shift+←)">«</button>
                      <button onClick={() => seekRelative(-0.1)} style={SEEK_BTN} title="−0.1s (←)">‹</button>
                      <button onClick={togglePlay} style={{ ...SEEK_BTN, padding: '5px 14px', display: 'inline-flex', alignItems: 'center' }} title="Play/Pause (Space)"><Icon d={playing ? ICONS.pause : ICONS.play} size={12} /></button>
                      <button onClick={() => seekRelative(0.1)} style={SEEK_BTN} title="+0.1s (→)">›</button>
                      <button onClick={() => seekRelative(1)} style={SEEK_BTN} title="+1s (Shift+→)">»</button>
                    </div>
                    {imageMode ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                        <span>{fmtTime(videoTime)}</span>
                        <span>{fmtTime(videoDuration)}</span>
                      </div>
                    ) : (<>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        <button onClick={() => setInPoint(Math.min(videoTime, outPoint - 0.1))} style={{ padding: '3px 7px', background: 'rgba(68,170,255,0.12)', color: '#4af', border: '1px solid rgba(68,170,255,0.3)', borderRadius: 3, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>[ IN</button>
                        <span style={{ color: '#4af' }}>{fmtTime(inPoint)}</span>
                        <div style={{ flex: 1, textAlign: 'center', color: 'var(--text3)' }}>{fmtTime(videoTime)} · {gifDuration}s</div>
                        <span style={{ color: 'var(--accent)' }}>{fmtTime(outPoint)}</span>
                        <button onClick={() => setOutPoint(Math.max(videoTime, inPoint + 0.1))} style={{ padding: '3px 7px', background: 'rgba(245, 197, 24,0.12)', color: 'var(--accent)', border: '1px solid rgba(245, 197, 24,0.3)', borderRadius: 3, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>OUT ]</button>
                      </div>
                      <input type="range" min={0} max={videoDuration || 1} step={0.05} value={inPoint} onChange={e => { const v = Math.min(+e.target.value, outPoint - 0.1); setInPoint(v); seekVideo(v) }} style={{ width: '100%', margin: 0, color: '#4af', '--pct': `${(inPoint / (videoDuration || 1)) * 100}%` }} />
                      <input type="range" min={0} max={videoDuration || 1} step={0.05} value={outPoint} onChange={e => { const v = Math.max(+e.target.value, inPoint + 0.1); setOutPoint(v); seekVideo(v) }} style={{ width: '100%', margin: 0, color: 'var(--accent)', '--pct': `${(outPoint / (videoDuration || 1)) * 100}%` }} />
                    </>)}
                  </div>
                </div>
              )

              if (imageMode) return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, alignItems: 'start' }}>
                  {rangePlayer}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {error && <div style={{ padding: '8px 10px', background: 'rgba(229,69,69,0.12)', color: '#e54545', borderRadius: 4, fontSize: 12, border: '1px solid rgba(229,69,69,0.3)' }}>{error}</div>}
                    <button onClick={captureFrame} disabled={!videoReady} style={{ padding: '11px', fontWeight: 700, borderRadius: 4, fontSize: 13, background: videoReady ? 'var(--accent)' : 'var(--surface3)', color: videoReady ? '#000' : '#888', border: 'none', cursor: videoReady ? 'pointer' : 'default' }}>◉ Capturer ce frame</button>
                    <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, margin: 0 }}>Naviguez puis capturez le frame souhaité — il s'ouvrira dans l'éditeur.</p>
                  </div>
                </div>
              )

              if (sourceTab === 'video') return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, alignItems: 'start' }}>
                  {rangePlayer}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {error && <div style={{ padding: '8px 10px', background: 'rgba(229,69,69,0.12)', color: '#e54545', borderRadius: 4, fontSize: 12, border: '1px solid rgba(229,69,69,0.3)' }}>{error}</div>}
                    <button onClick={createGif} disabled={gifLoading || !videoReady || outPoint <= inPoint} style={{ padding: '11px', fontWeight: 700, borderRadius: 4, fontSize: 13, background: gifLoading || !videoReady || outPoint <= inPoint ? 'var(--surface3)' : 'var(--accent)', color: gifLoading || !videoReady || outPoint <= inPoint ? '#888' : '#000', border: 'none', cursor: gifLoading || !videoReady ? 'default' : 'pointer' }}>{gifLoading ? '◉ Génération GIF…' : '◉ Créer GIF'}</button>
                    <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, margin: 0 }}>Réglez IN/OUT puis créez le GIF. Il s'ouvrira dans l'éditeur.</p>
                  </div>
                </div>
              )

              if (sourceTab === 'audio') return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, alignItems: 'start' }}>
                  {rangePlayer}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {error && <div style={{ padding: '8px 10px', background: 'rgba(229,69,69,0.12)', color: '#e54545', borderRadius: 4, fontSize: 12, border: '1px solid rgba(229,69,69,0.3)' }}>{error}</div>}
                    <button
                      onClick={() => createAudio('mp3')}
                      disabled={audioLoading || !videoReady || outPoint <= inPoint}
                      style={{ padding: '11px', fontWeight: 700, borderRadius: 4, fontSize: 13, background: audioLoading || !videoReady || outPoint <= inPoint ? 'var(--surface3)' : 'var(--accent)', color: audioLoading || !videoReady || outPoint <= inPoint ? '#888' : '#000', border: 'none', cursor: audioLoading || !videoReady ? 'default' : 'pointer' }}
                    >{audioLoading ? '◉ Export…' : 'Télécharger MP3'}</button>
                    <button
                      onClick={() => createAudio('wav')}
                      disabled={audioLoading || !videoReady || outPoint <= inPoint}
                      style={{ padding: '11px', fontWeight: 700, borderRadius: 4, fontSize: 13, background: 'var(--surface2)', color: audioLoading || !videoReady || outPoint <= inPoint ? '#888' : 'var(--text)', border: '1px solid var(--border2)', cursor: audioLoading || !videoReady ? 'default' : 'pointer' }}
                    >Télécharger WAV</button>
                    <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, margin: 0 }}>Réglez IN/OUT puis exportez l'audio de la sélection. MP3 = compact, WAV = lossless.</p>
                  </div>
                </div>
              )
            })()}
          </div>
        ) : (
          /* Canvas editor */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 20, alignItems: 'start' }}>

            {/* Left column: result REPLACES the editor canvas once generated
                (MEME_PLEX_HANDOFF §2.3 — never show source + result stacked). */}
            {resultUrl ? (
              <div style={{ background: '#000', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--accent)' }}>
                <div style={{ padding: '6px 10px', borderBottom: '1px solid #1a1a1a', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                  Résultat
                </div>
                <img src={resultUrl} alt="meme" style={{ display: 'block', width: '100%' }} />
                <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #1a1a1a' }}>
                  <button onClick={() => setResultUrl(null)}
                    style={{ flex: 1, padding: 9, background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, borderRadius: 4, fontSize: 12, border: '1px solid var(--border2)', cursor: 'pointer' }}>↩ Refaire</button>
                  <button onClick={download}
                    style={{ flex: 1, padding: 9, background: '#44bb55', color: '#fff', fontWeight: 700, borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer' }}>↓ Télécharger</button>
                </div>
              </div>
            ) : (
            <div style={{ background: '#000', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ padding: '6px 10px', borderBottom: '1px solid #1a1a1a', fontSize: 11, color: '#666' }}>
                Glissez le texte pour le repositionner
              </div>
              <div style={{ position: 'relative' }}>
                {imageName?.toLowerCase().endsWith('.gif') && imageUrl && (
                  <img
                    src={imageUrl}
                    alt=""
                    style={{ display: 'block', width: '100%', pointerEvents: 'none', userSelect: 'none' }}
                  />
                )}
                <canvas
                  ref={canvasRef}
                  style={{
                    display: 'block', width: '100%',
                    cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none',
                    ...(imageName?.toLowerCase().endsWith('.gif') && imageUrl
                      ? { position: 'absolute', inset: 0, height: '100%' }
                      : {}),
                  }}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                />
              </div>
            </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <span style={SL}>TEXTES</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={addLayer} style={{ fontSize: 11, color: 'var(--accent)', background: 'rgba(245, 197, 24,0.1)', border: '1px solid rgba(245, 197, 24,0.3)', borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>+ Ajouter</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {texts.map((t, i) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 8px',
                        background: selectedId === t.id ? 'rgba(245, 197, 24,0.08)' : 'var(--surface3)',
                        border: `1px solid ${selectedId === t.id ? 'rgba(245, 197, 24,0.4)' : 'var(--border)'}`,
                        borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 10, color: '#555', width: 14, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <input
                        value={t.content}
                        onChange={e => updateLayer(t.id, { content: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        placeholder={i === 0 ? 'WHEN YOU…' : i === 1 ? '…IT\'S FRIDAY' : 'Texte…'}
                        style={{
                          flex: 1, background: 'transparent', border: 'none', outline: 'none',
                          fontSize: 12, color: 'var(--text)',
                          fontFamily: (FONTS.find(f => f.id === t.fontId) || FONTS[0]).css,
                          letterSpacing: 0.5,
                        }}
                      />
                      {/* Layer affordances: duplicate, ↑↓ reorder, delete. */}
                      <button
                        onClick={e => { e.stopPropagation(); duplicateLayer(t.id) }}
                        title="Dupliquer"
                        style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                      >⎘</button>
                      <button
                        onClick={e => { e.stopPropagation(); reorderLayer(t.id, -1) }}
                        disabled={i === 0}
                        title="Monter"
                        style={{ fontSize: 11, color: i === 0 ? 'var(--text4)' : 'var(--text3)', background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', padding: '0 2px' }}
                      >↑</button>
                      <button
                        onClick={e => { e.stopPropagation(); reorderLayer(t.id, 1) }}
                        disabled={i === texts.length - 1}
                        title="Descendre"
                        style={{ fontSize: 11, color: i === texts.length - 1 ? 'var(--text4)' : 'var(--text3)', background: 'none', border: 'none', cursor: i === texts.length - 1 ? 'default' : 'pointer', padding: '0 2px' }}
                      >↓</button>
                      {texts.length > 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); removeLayer(t.id) }}
                          style={{ fontSize: 14, color: '#e54545', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                          title="Supprimer"
                        >×</button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                  ↑↓ ← → flèches : déplacer le texte sélectionné · ⇧ pour 5×
                </div>
              </div>

              {sel && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={SL}>STYLE — TEXTE {texts.findIndex(t => t.id === selectedId) + 1}</span>

                  <div>
                    <label style={LBL}>POLICE</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {FONTS.map(f => (
                        <button key={f.id} onClick={() => updateLayer(selectedId, { fontId: f.id })} style={{
                          flex: 1, padding: '5px 4px',
                          background: sel.fontId === f.id ? 'rgba(245, 197, 24,0.1)' : 'var(--surface3)',
                          color: sel.fontId === f.id ? 'var(--accent)' : '#888',
                          border: `1px solid ${sel.fontId === f.id ? 'rgba(245, 197, 24,0.4)' : 'var(--border2)'}`,
                          borderRadius: 3, fontSize: 10, cursor: 'pointer', fontFamily: f.css,
                        }}>{f.label}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={LBL}>TAILLE — {sel.fontSize}px</label>
                      <input type="range" min={16} max={120} value={sel.fontSize}
                        onChange={e => updateLayer(selectedId, { fontSize: +e.target.value })}
                        style={{ width: '100%', color: 'var(--accent)' }}
                      />
                    </div>
                    <button
                      onClick={() => updateLayer(selectedId, { bold: !sel.bold })}
                      style={{
                        padding: '4px 12px', marginBottom: 1,
                        background: sel.bold ? 'rgba(245, 197, 24,0.1)' : 'var(--surface3)',
                        color: sel.bold ? 'var(--accent)' : '#888',
                        border: `1px solid ${sel.bold ? 'rgba(245, 197, 24,0.4)' : 'var(--border2)'}`,
                        borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      }}
                    >B</button>
                  </div>

                  <div>
                    <label style={LBL}>COULEUR TEXTE</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="color" value={sel.color}
                        onChange={e => updateLayer(selectedId, { color: e.target.value })}
                        style={{ width: 30, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                      />
                      {QUICK_COLORS_TEXT.map(c => (
                        <div key={c} onClick={() => updateLayer(selectedId, { color: c })}
                          style={{ width: 18, height: 18, background: c, borderRadius: 2, cursor: 'pointer', flexShrink: 0,
                            border: sel.color.toLowerCase() === c ? '2px solid var(--accent)' : '1px solid #444' }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={LBL}>CONTOUR — épaisseur {sel.strokeWidth}</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                      <input type="color" value={sel.strokeColor}
                        onChange={e => updateLayer(selectedId, { strokeColor: e.target.value })}
                        style={{ width: 30, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                      />
                      {QUICK_COLORS_STROKE.map(c => (
                        <div key={c} onClick={() => updateLayer(selectedId, { strokeColor: c })}
                          style={{ width: 18, height: 18, background: c, borderRadius: 2, cursor: 'pointer', flexShrink: 0,
                            border: sel.strokeColor.toLowerCase() === c ? '2px solid var(--accent)' : '1px solid #444' }}
                        />
                      ))}
                    </div>
                    <input type="range" min={0} max={8} value={sel.strokeWidth}
                      onChange={e => updateLayer(selectedId, { strokeWidth: +e.target.value })}
                      style={{ width: '100%', color: 'var(--accent)' }}
                    />
                  </div>

                  <div>
                    <label style={LBL}>ALIGNEMENT</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[['left', '⟵ Gauche'], ['center', '⊣ Centre'], ['right', 'Droite ⟶']].map(([v, lbl]) => (
                        <button key={v} onClick={() => updateLayer(selectedId, { align: v })}
                          style={{
                            flex: 1, padding: '5px 4px',
                            background: sel.align === v ? 'rgba(245, 197, 24,0.1)' : 'var(--surface3)',
                            color: sel.align === v ? 'var(--accent)' : '#888',
                            border: `1px solid ${sel.align === v ? 'rgba(245, 197, 24,0.4)' : 'var(--border2)'}`,
                            borderRadius: 3, fontSize: 10, cursor: 'pointer',
                          }}
                        >{lbl}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ padding: '8px 10px', background: 'rgba(229,69,69,0.12)', color: '#e54545', borderRadius: 4, fontSize: 12, border: '1px solid rgba(229,69,69,0.3)' }}>
                  {error}
                </div>
              )}

              <button
                onClick={generate}
                disabled={loading || !imageUrl}
                style={{
                  padding: '10px', fontWeight: 700, borderRadius: 4, fontSize: 13,
                  background: loading ? 'var(--surface3)' : 'var(--accent)',
                  color: loading ? '#888' : '#000',
                  border: 'none', cursor: loading ? 'default' : 'pointer',
                }}
              >{loading ? '◉ Génération…' : resultUrl ? '◉ Régénérer' : '◉ Générer'}</button>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.gif"
          onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
      </div>
    </div>
  )
}

const SL = { fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }
const LBL = { display: 'block', fontSize: 10, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }
const BTN_GHOST = { fontSize: 11, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', minHeight: 28 }
const SEEK_BTN = { fontSize: 13, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 5, padding: '5px 9px', cursor: 'pointer', minHeight: 28 }
