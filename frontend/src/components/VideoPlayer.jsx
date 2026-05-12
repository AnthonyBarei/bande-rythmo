import React, { useRef, useState } from 'react'

const fmt = t => {
  if (!t && t !== 0) return '00:00.00'
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(2).padStart(5, '0')
  return `${String(m).padStart(2, '0')}:${s}`
}

export default function VideoPlayer({
  src,
  videoRef: externalRef,
  maxHeight = 420,
  onTimeUpdate,
  onLoadedMetadata,
  overlay,
  style = {},
}) {
  const internalRef = useRef(null)
  const ref = externalRef || internalRef

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [ready, setReady] = useState(false)

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
      {/* Video area */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <video
          ref={ref}
          src={src}
          preload="auto"
          muted
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
              background: 'rgba(255,153,0,0.92)', color: '#000',
              fontWeight: 700, fontSize: 15,
              padding: '12px 24px', borderRadius: 6,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              🔊 Cliquez pour activer le son
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
            background: 'rgba(255,153,0,0.04)', color: '#f90',
            fontSize: 14, padding: '3px 7px',
            border: '1px solid #f904', borderRadius: 3, minWidth: 30, lineHeight: 1,
          }}
        >
          {playing ? '⏸' : '▶'}
        </button>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', minWidth: 108, flexShrink: 0 }}>
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        <input
          type="range" min={0} max={duration || 1} step={0.05} value={currentTime}
          onChange={e => seekTo(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: '#f90', cursor: 'pointer', height: 4 }}
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

        <button
          onClick={toggleMute}
          style={{
            background: 'none', color: muted ? '#333' : 'var(--text2)',
            fontSize: 12, padding: '2px 6px', border: '1px solid var(--border2)', borderRadius: 3,
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  )
}
