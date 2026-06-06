import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Icon, ICONS } from '../Icons'

export default function RecorderPanel({ clipId, subtitles = [], activeCharacter = '', activeIndex = null, videoRef = null }) {
  const [takes, setTakes] = useState([])
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState(null)
  const [abA, setAbA] = useState(null)
  const [abB, setAbB] = useState(null)
  const [playing, setPlaying] = useState(null)
  const [syncPlaying, setSyncPlaying] = useState(null)

  const mrRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const recStartRef = useRef(0)
  const audioRef = useRef(null)
  const syncCleanupRef = useRef(null)

  const BARS = 44
  const [lvl, setLvl] = useState(() => Array(BARS).fill(0.06))
  const analyserRef = useRef(null)
  const meterRafRef = useRef(null)

  function startMeter(stream) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      const ac = new AC()
      const src = ac.createMediaStreamSource(stream)
      const an = ac.createAnalyser()
      an.fftSize = 128
      src.connect(an)
      analyserRef.current = { ac }
      const data = new Uint8Array(an.frequencyBinCount)
      const step = Math.max(1, Math.floor(data.length / BARS))
      const loop = () => {
        an.getByteFrequencyData(data)
        setLvl(Array.from({ length: BARS }, (_, i) => Math.max(0.06, (data[i * step] || 0) / 255)))
        meterRafRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch (_) {}
  }
  function stopMeter() {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current)
    meterRafRef.current = null
    try { analyserRef.current?.ac.close() } catch (_) {}
    analyserRef.current = null
    setLvl(Array(BARS).fill(0.06))
  }

  const fetchTakes = useCallback(async () => {
    if (!clipId) return
    try {
      const res = await fetch(`/api/takes/${clipId}`)
      if (res.ok) setTakes(await res.json())
    } catch (_) {}
  }, [clipId])

  useEffect(() => { fetchTakes() }, [fetchTakes])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    syncCleanupRef.current?.()
    stopMeter()
  }, [])

  async function uploadTake() {
    const dur = (Date.now() - recStartRef.current) / 1000
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    if (!blob.size) return
    const form = new FormData()
    form.append('clip_id', clipId)
    form.append('character', activeCharacter || '')
    if (activeIndex != null) form.append('subtitle_index', String(activeIndex))
    form.append('duration', dur.toFixed(2))
    form.append('audio', blob, 'take.webm')
    try {
      const res = await fetch('/api/takes/', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      fetchTakes()
    } catch (e) {
      setError('Échec de l’enregistrement : ' + e.message)
    }
  }

  async function startRec() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        uploadTake()
      }
      recStartRef.current = Date.now()
      mr.start()
      mrRef.current = mr
      setRecording(true)
      startMeter(stream)
    } catch (e) {
      setError('Micro inaccessible : ' + e.message)
    }
  }

  function stopRec() {
    mrRef.current?.stop()
    setRecording(false)
    stopMeter()
  }

  function playTake(take) {
    stopSync()
    const a = audioRef.current
    if (!a) return
    a.src = take.audio_url
    a.play()
    setPlaying(take.id)
  }

  function stopSync() {
    if (syncCleanupRef.current) { syncCleanupRef.current(); syncCleanupRef.current = null }
  }

  function previewWithVideo(take) {
    const v = videoRef?.current
    const a = audioRef.current
    const sub = activeIndex != null ? subtitles[activeIndex] : null
    if (!v || !a) { playTake(take); return }

    stopSync()
    setPlaying(null)

    const wasMuted = v.muted
    v.muted = true

    const startAt = sub ? sub.start : 0
    v.currentTime = Math.max(0, startAt - 0.3)

    a.src = take.audio_url
    a.load()

    setSyncPlaying(take.id)

    let triggered = false

    function onTimeUpdate() {
      if (!triggered && v.currentTime >= startAt) {
        triggered = true
        a.currentTime = 0
        a.play().catch(() => {})
      }
    }

    function cleanup() {
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('pause', onVideoPause)
      v.muted = wasMuted
      setSyncPlaying(null)
    }

    function onVideoPause() {
      cleanup()
      a.pause()
    }

    syncCleanupRef.current = cleanup
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('pause', onVideoPause)
    v.play().catch(() => {})
  }

  function handleAudioEnded() {
    setPlaying(null)
    if (syncCleanupRef.current) {
      const v = videoRef?.current
      if (v && !v.paused) v.pause()
      syncCleanupRef.current()
      syncCleanupRef.current = null
    }
    setSyncPlaying(null)
  }

  async function removeTake(id) {
    try {
      await fetch(`/api/takes/${id}`, { method: 'DELETE' })
      if (abA === id) setAbA(null)
      if (abB === id) setAbB(null)
      fetchTakes()
    } catch (_) {}
  }

  function assignAB(id) {
    if (abA === id) { setAbA(null); return }
    if (abB === id) { setAbB(null); return }
    if (abA == null) setAbA(id)
    else if (abB == null) setAbB(id)
    else setAbB(id)
  }

  function takeLabel(t) {
    if (t.subtitle_index != null && subtitles[t.subtitle_index]) {
      const s = subtitles[t.subtitle_index]
      return `Réplique ${t.subtitle_index + 1}${s.character ? ' · ' + s.character : ''}`
    }
    return t.character || 'Prise libre'
  }

  const takeA = takes.find(t => t.id === abA)
  const takeB = takes.find(t => t.id === abB)
  const hasSub = activeIndex != null && subtitles[activeIndex]
  const hasVideo = !!videoRef?.current

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14 }}>
      <audio ref={audioRef} onEnded={handleAudioEnded} style={{ display: 'none' }} />

      {/* Mic stage — prototype Record */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 18, padding: '22px 16px', position: 'relative',
      }}>
        {/* live meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 64 }}>
          {lvl.map((v, i) => (
            <div key={i} style={{
              width: 4, height: `${Math.max(6, v * 100)}%`, borderRadius: 2,
              background: recording ? (v > 0.8 ? 'var(--danger)' : 'var(--accent)') : 'var(--border3)',
              transition: 'height .07s',
            }} />
          ))}
        </div>
        {/* record button */}
        <button onClick={recording ? stopRec : startRec} title={recording ? 'Arrêter (R)' : 'Enregistrer (R)'}
          style={{
            width: 68, height: 68, borderRadius: '50%', cursor: 'pointer',
            background: recording ? 'var(--danger)' : 'var(--accent)',
            border: `4px solid ${recording ? 'rgba(232,89,93,0.27)' : 'rgba(245,197,24,0.27)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: recording ? '0 0 28px rgba(232,89,93,0.4)' : '0 0 22px rgba(245,197,24,0.27)',
          }}>
          <Icon d={recording ? ICONS.pause : ICONS.mic} size={27} stroke="#0b0b0d" fill={recording ? '#0b0b0d' : 'none'} />
        </button>
        <div style={{ fontSize: 12.5, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
          {recording
            ? <span style={{ color: 'var(--danger)' }}>● ENREGISTREMENT</span>
            : 'Appuyer pour enregistrer · R'}
        </div>
        {(hasSub && hasVideo) && (
          <div style={{ position: 'absolute', top: 12, right: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 99, padding: '3px 8px' }}>
              <Icon d={ICONS.film} size={10} /> réplique {activeIndex + 1}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 11, color: 'var(--danger)', background: 'var(--danger-soft)', padding: '6px 8px', borderRadius: 6 }}>
          {error}
        </div>
      )}

      {/* Takes header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10.5, letterSpacing: 1.4, color: 'var(--text3)', fontWeight: 700 }}>PRISES</span>
        <span style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{takes.length}</span>
      </div>

      {/* A/B compare */}
      {(takeA || takeB) && (
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(90,169,240,0.27)', borderRadius: 9, padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 10, color: 'var(--info)', letterSpacing: 1, fontWeight: 700 }}>COMPARAISON A / B</div>
          {[{ t: takeA, k: 'A', c: 'var(--accent)' }, { t: takeB, k: 'B', c: 'var(--info)' }].map(({ t, k, c }) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: 'color-mix(in srgb, ' + c + ' 14%, transparent)', color: c, fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k}</div>
              <button onClick={() => t && playTake(t)} disabled={!t} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: t ? 'pointer' : 'default' }}>
                <Icon d={ICONS.play} size={12} style={{ color: c }} />
              </button>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{t ? takeLabel(t) : '—'}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{t ? `${t.duration.toFixed(1)}s` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Take cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {takes.length === 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--text3)', textAlign: 'center', padding: '10px 0' }}>
            Aucune prise enregistrée
          </div>
        )}
        {takes.map((t, i) => {
          const isPlaying = playing === t.id
          const isSyncing = syncPlaying === t.id
          const sel = t.id === abA || t.id === abB
          return (
            <div key={t.id} style={{
              background: isSyncing ? 'rgba(245,197,24,0.06)' : 'var(--surface)',
              border: `1px solid ${sel ? 'var(--accent)' : isSyncing ? 'rgba(245,197,24,0.4)' : 'var(--border)'}`,
              borderRadius: 9, padding: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                <button onClick={() => isPlaying ? (audioRef.current?.pause(), setPlaying(null)) : playTake(t)} title="Écouter"
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon d={isPlaying ? ICONS.pause : ICONS.play} size={13} style={{ color: isPlaying ? 'var(--accent)' : 'var(--text2)' }} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{takeLabel(t)}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{t.duration.toFixed(1)}s</span>
                {hasVideo && (
                  <button onClick={() => isSyncing ? (stopSync(), videoRef.current?.pause()) : previewWithVideo(t)} title="Écouter avec vidéo"
                    style={{ ...iconBtn, color: isSyncing ? 'var(--accent)' : 'var(--text3)' }}>
                    <Icon d={isSyncing ? ICONS.stop : ICONS.film} size={13} />
                  </button>
                )}
                <button onClick={() => assignAB(t.id)} title="Comparer A/B"
                  style={{ ...iconBtn, color: sel ? 'var(--accent)' : 'var(--text3)', fontWeight: 700, fontSize: 10 }}>
                  {t.id === abA ? 'A' : t.id === abB ? 'B' : 'A/B'}
                </button>
                <button onClick={() => removeTake(t.id)} title="Supprimer" style={{ ...iconBtn, color: 'var(--text3)' }}>
                  <Icon d={ICONS.trash} size={13} />
                </button>
              </div>
              {/* mini waveform (placeholder bars from duration seed) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 24 }}>
                {Array.from({ length: 48 }).map((_, j) => {
                  const v = (Math.sin(j * 0.4 + i) * 0.4 + Math.sin(j * 0.9) * 0.3 + 0.45)
                  return <div key={j} style={{ flex: 1, height: `${Math.abs(v) * 100}%`, background: sel ? 'var(--accent)' : 'var(--border3)', opacity: sel ? 0.7 : 1, borderRadius: 1 }} />
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const iconBtn = {
  background: 'none', border: 'none', fontSize: 12, padding: '5px 6px',
  borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center',
}
