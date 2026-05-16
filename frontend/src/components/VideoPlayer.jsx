import React, { useRef, useState, useEffect } from 'react'
import { Icon, ICONS } from '../Icons'

const fmt = t => {
  if (!t && t !== 0) return '00:00.00'
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(2).padStart(5, '0')
  return `${String(m).padStart(2, '0')}:${s}`
}

export default function VideoPlayer({
  src,
  audioSrc,         // separate audio track (m4a) synced with video
  videoRef: externalRef,
  maxHeight = 420,
  onTimeUpdate,
  onLoadedMetadata,
  overlay,
  style = {},
}) {
  const internalRef = useRef(null)
  const ref = externalRef || internalRef
  const audioRef = useRef(null)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [ready, setReady] = useState(false)

  // Reload video when src changes
  useEffect(() => {
    const v = ref.current
    if (!v || !src) return
    v.load()
  }, [src])

  // Reload audio when audioSrc changes
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.load()
  }, [audioSrc])

  // Sync audio element to video play/pause/seek/rate
  useEffect(() => {
    const v = ref.current
    const a = audioRef.current
    if (!v || !a || !audioSrc) return

    const onPlay = () => { a.currentTime = v.currentTime; a.play().catch(() => {}) }
    const onPause = () => a.pause()
    const onSeeked = () => { a.currentTime = v.currentTime }
    const onRateChange = () => { a.playbackRate = v.playbackRate }

    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('seeked', onSeeked)
    v.addEventListener('ratechange', onRateChange)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('seeked', onSeeked)
      v.removeEventListener('ratechange', onRateChange)
    }
  }, [audioSrc])

  function togglePlay() {
    const v = ref.current
    if (!v) return
    if (!ready) { v.muted = false; v.volume = 1; setMuted(false); setReady(true) }
    v.paused ? v.play() : v.pause()
  }

  function toggleMute() {
    const v = ref.current
    if (!v) return
    v.muted = !v.muted
  }

  function changeSpeed(s) {
    const v = ref.current
    if (v) v.playbackRate = +s
  }

  function seekTo(t) {
    const v = ref.current
    if (v) v.currentTime = t
  }

  function handleTimeUpdate(e) {
    const t = e.target.currentTime
    setCurrentTime(t)
    onTimeUpdate?.(t)
  }

  function handleMetadata(e) {
    const d = e.target.duration
    setDuration(d)
    onLoadedMetadata?.(d)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#000', ...style }}>
      {/* Hidden audio element for alternate track */}
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} preload="auto" style={{ display: 'none' }} />
      )}

      {/* Video area */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <video
          ref={ref}
          src={src}
          preload="auto"
          muted={!!audioSrc || muted}  // mute video when external audio track active
          style={{ width: '100%', maxHeight, display: 'block', objectFit: 'contain', cursor: 'pointer' }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onVolumeChange={e => setMuted(e.target.muted)}
          onRateChange={e => setSpeed(e.target.playbackRate)}
          onClick={togglePlay}
        />
        {!ready && (
          <div
            onClick={togglePlay}
            style={{
              position: 'absolute', inset: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(245, 197, 24,0.92)', color: '#000',
              fontWeight: 700, fontSize: 15,
              padding: '12px 24px', borderRadius: 6,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <Icon d={ICONS.volume} size={16} stroke="#000" /> Cliquez pour activer le son
            </div>
          </div>
        )}
        {overlay}
      </div>

      {/* Transport bar */}
      <div style={{
        background: '#0a0a0a', borderTop: '1px solid #111',
        padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <button
          onClick={togglePlay}
          style={{
            background: 'rgba(245, 197, 24,0.04)', color: '#f5c518',
            padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(245,197,24,0.27)', borderRadius: 3, minWidth: 30,
          }}
        >
          <Icon d={playing ? ICONS.pause : ICONS.play} size={14} />
        </button>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', minWidth: 108, flexShrink: 0 }}>
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        <input
          type="range" min={0} max={duration || 1} step={0.05} value={currentTime}
          onChange={e => seekTo(parseFloat(e.target.value))}
          style={{ flex: 1, color: '#f5c518', cursor: 'pointer', height: 4, '--pct': `${(currentTime / (duration || 1)) * 100}%` }}
        />

        <select
          value={speed}
          onChange={e => changeSpeed(e.target.value)}
          style={{
            background: 'var(--surface3)', color: 'var(--text2)',
            border: '1px solid var(--border2)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
          }}
        >
          {[0.5, 0.75, 1, 1.25, 1.5].map(s => <option key={s} value={s}>{s}×</option>)}
        </select>

        {!audioSrc && (
          <button
            onClick={toggleMute}
            style={{
              background: 'none', color: muted ? 'var(--text4)' : 'var(--text2)',
              padding: '4px 6px', display: 'flex', alignItems: 'center',
              border: '1px solid var(--border2)', borderRadius: 3,
            }}
          >
            <Icon d={muted ? ICONS.mute : ICONS.volume} size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
