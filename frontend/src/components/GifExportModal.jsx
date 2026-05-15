import React, { useState, useRef, useEffect, useCallback } from 'react'

const fmt = t => {
  if (t == null) return '0:00.0'
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

export default function GifExportModal({ clip, onClose, onExported }) {
  const videoRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [inPoint, setInPoint] = useState(0)
  const [outPoint, setOutPoint] = useState(null)
  const [fps, setFps] = useState(12)
  const [scale, setScale] = useState(480)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const segmentUrl = clip.segment_path ? `/${clip.segment_path}` : null

  function seek(delta) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta))
  }

  const handleKey = useCallback((e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
    switch (e.key) {
      case 'Escape': onClose(); break
      case 'ArrowLeft':
        e.preventDefault()
        seek(e.shiftKey ? -1 : -0.1)
        break
      case 'ArrowRight':
        e.preventDefault()
        seek(e.shiftKey ? 1 : 0.1)
        break
      case ' ':
      case 'k': {
        e.preventDefault()
        const v = videoRef.current
        if (v) v.paused ? v.play() : v.pause()
        break
      }
      case 'i': case 'I':
        e.preventDefault()
        setInPoint(videoRef.current?.currentTime ?? 0)
        break
      case 'o': case 'O':
        e.preventDefault()
        setOutPoint(videoRef.current?.currentTime ?? duration)
        break
      default: break
    }
  }, [onClose, duration])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  function onLoadedMetadata() {
    const v = videoRef.current
    if (!v) return
    setDuration(v.duration)
    setOutPoint(v.duration)
  }

  function onTimeUpdate() {
    setCurrentTime(videoRef.current?.currentTime ?? 0)
  }

  const effectiveOut = outPoint ?? duration
  const trimDuration = effectiveOut - inPoint

  async function doExport() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/export/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles: [],
          segment_id: clip.clip_id,
          format: 'gif',
          gif_start: inPoint,
          gif_end: effectiveOut,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.name || 'clip'}.gif`
      a.click()
      URL.revokeObjectURL(url)
      onExported?.()
      onClose()
    } catch (e) {
      setError('Export échoué : ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0
  const inPct = duration > 0 ? (inPoint / duration) * 100 : 0
  const outPct = duration > 0 ? (effectiveOut / duration) * 100 : 100

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3000,
      }}
    >
      <div style={{
        background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: 10,
        width: 680, maxWidth: '95vw', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ff6644' }}>◎ Exporter GIF</span>
          <span style={{ fontSize: 11, color: '#555', fontFamily: 'var(--font-mono)' }}>{clip.name}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={BTN_GHOST}>✕</button>
        </div>

        {/* Video */}
        <div style={{ background: '#000', position: 'relative' }}>
          <video
            ref={videoRef}
            src={segmentUrl}
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate}
            style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain' }}
          />
        </div>

        {/* Timeline strip */}
        <div style={{ padding: '10px 16px 0' }}>
          <div
            style={{ position: 'relative', height: 28, background: '#1a1a1a', borderRadius: 4, cursor: 'pointer', overflow: 'hidden' }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = (e.clientX - rect.left) / rect.width
              if (videoRef.current) videoRef.current.currentTime = ratio * duration
            }}
          >
            {/* In-out range highlight */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${inPct}%`, width: `${outPct - inPct}%`,
              background: 'rgba(255,102,68,0.25)',
            }} />
            {/* In marker */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, width: 2,
              left: `${inPct}%`, background: '#ff6644',
            }} />
            {/* Out marker */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, width: 2,
              left: `${outPct}%`, background: '#ff6644',
            }} />
            {/* Playhead */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, width: 2,
              left: `${pct}%`, background: '#fff', pointerEvents: 'none',
            }} />
            {/* Time label */}
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#555', fontFamily: 'var(--font-mono)' }}>
              {fmt(currentTime)} / {fmt(duration)}
            </div>
          </div>
        </div>

        {/* Seek controls */}
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => seek(-1)} style={BTN_SEEK} title="−1s (Shift+←)">«</button>
          <button onClick={() => seek(-0.1)} style={BTN_SEEK} title="−0.1s (←)">‹</button>
          <button
            onClick={() => { const v = videoRef.current; if (v) v.paused ? v.play() : v.pause() }}
            style={{ ...BTN_SEEK, padding: '5px 14px', color: '#ccc' }}
            title="Play/Pause (Space)"
          >▶ / ⏸</button>
          <button onClick={() => seek(0.1)} style={BTN_SEEK} title="+0.1s (→)">›</button>
          <button onClick={() => seek(1)} style={BTN_SEEK} title="+1s (Shift+→)">»</button>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setInPoint(videoRef.current?.currentTime ?? 0)}
            style={{ ...BTN_SEEK, color: '#ff6644', borderColor: 'rgba(255,102,68,0.4)' }}
            title="Marquer IN (I)"
          >[ IN</button>
          <button
            onClick={() => setOutPoint(videoRef.current?.currentTime ?? duration)}
            style={{ ...BTN_SEEK, color: '#ff6644', borderColor: 'rgba(255,102,68,0.4)' }}
            title="Marquer OUT (O)"
          >OUT ]</button>
        </div>

        {/* IN/OUT display */}
        <div style={{ padding: '0 16px 10px', display: 'flex', gap: 12, fontSize: 11, color: '#666', fontFamily: 'var(--font-mono)' }}>
          <span>IN: <span style={{ color: '#ff6644' }}>{fmt(inPoint)}</span></span>
          <span>OUT: <span style={{ color: '#ff6644' }}>{fmt(effectiveOut)}</span></span>
          <span>DUR: <span style={{ color: '#aaa' }}>{fmt(trimDuration)}</span></span>
          <div style={{ flex: 1 }} />
          <span style={{ color: '#444' }}>← → 0.1s · Shift 1s · I/O marquer</span>
        </div>

        {/* GIF settings + export */}
        <div style={{ padding: '10px 16px 16px', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <label style={LBL}>FPS — {fps}</label>
            <input type="range" min={6} max={24} value={fps}
              onChange={e => setFps(+e.target.value)}
              style={{ width: 80, accentColor: '#ff6644' }} />
          </div>
          <div>
            <label style={LBL}>LARGEUR — {scale}px</label>
            <input type="range" min={160} max={800} step={80} value={scale}
              onChange={e => setScale(+e.target.value)}
              style={{ width: 80, accentColor: '#ff6644' }} />
          </div>
          <div style={{ flex: 1 }} />
          {error && (
            <span style={{ fontSize: 11, color: '#e54545' }}>{error}</span>
          )}
          <button
            onClick={doExport}
            disabled={loading || trimDuration <= 0}
            style={{
              padding: '9px 22px', fontWeight: 700, borderRadius: 5, fontSize: 13,
              background: loading ? '#1a1a1a' : '#ff6644',
              color: loading ? '#555' : '#fff',
              border: 'none', cursor: loading ? 'default' : 'pointer',
            }}
          >{loading ? '◉ Export…' : '↓ Exporter GIF'}</button>
        </div>
      </div>
    </div>
  )
}

const BTN_GHOST = {
  fontSize: 13, color: '#666', background: 'none',
  border: '1px solid #2a2a2a', borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
}
const BTN_SEEK = {
  fontSize: 13, color: '#888', background: '#1a1a1a',
  border: '1px solid #2a2a2a', borderRadius: 3, padding: '5px 9px', cursor: 'pointer',
}
const LBL = { display: 'block', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }
