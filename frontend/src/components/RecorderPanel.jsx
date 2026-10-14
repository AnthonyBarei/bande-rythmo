import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { T, alpha, Icon, ICONS, Btn, Chip, Dot, Avatar } from '../ui'
import { TRACK_HEXES } from '../config/tracks'
import { fmtClock, fmtSMPTE } from '../utils/timecode'

// Recorder — port of redesign screen-record-export.jsx → Record.
// variant 'studio'   : full Studio screen body (booth left · PRISES + A/B 340px right).
// variant 'embedded' : compact stack for the editor inspector.
const RecorderPanel = forwardRef(function RecorderPanel({
  clipId, subtitles = [], activeCharacter = '', activeIndex = null, videoRef = null,
  variant = 'embedded', fps = 25, onSelectIndex,
}, ref) {
  const studio = variant === 'studio'
  const BARS = studio ? 48 : 44
  const [takes, setTakes] = useState([])
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  const [abOpen, setAbOpen] = useState(false)
  const [abA, setAbA] = useState(null)
  const [abB, setAbB] = useState(null)
  const [playing, setPlaying] = useState(null)
  const [syncPlaying, setSyncPlaying] = useState(null)
  const [micLabel, setMicLabel] = useState('')

  const mrRef = useRef(null)
  const startingRef = useRef(false)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const recStartRef = useRef(0)
  const audioRef = useRef(null)
  const syncCleanupRef = useRef(null)

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
    } catch (e) {
      console.warn('Vumètre indisponible', e)
    }
  }
  function stopMeter() {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current)
    meterRafRef.current = null
    analyserRef.current?.ac.close().catch(e => console.warn('Fermeture AudioContext', e))
    analyserRef.current = null
    setLvl(Array(BARS).fill(0.06))
  }

  const fetchTakes = useCallback(async () => {
    if (!clipId) return
    try {
      const res = await fetch(`/api/takes/${clipId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setTakes(await res.json())
    } catch (e) {
      setError('Chargement des prises impossible : ' + e.message)
    }
  }, [clipId])

  useEffect(() => { fetchTakes() }, [fetchTakes])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    syncCleanupRef.current?.()
    stopMeter()
  }, [])

  // Mic name for the booth chip — labels are only exposed once mic access was granted.
  useEffect(() => {
    if (!studio || !navigator.mediaDevices?.enumerateDevices) return
    let live = true
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const inputs = devices.filter(d => d.kind === 'audioinput')
        const mic = inputs.find(d => d.deviceId === 'default') || inputs[0]
        if (live && mic?.label) setMicLabel(mic.label.replace(/^(Par défaut|Default) - /, ''))
      })
      .catch(e => console.warn('enumerateDevices failed', e))
    return () => { live = false }
  }, [studio])

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setElapsed((Date.now() - recStartRef.current) / 1000), 100)
    return () => clearInterval(id)
  }, [recording])

  async function uploadTake() {
    const dur = (Date.now() - recStartRef.current) / 1000
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    if (!blob.size) { setError('Prise vide — aucun son capté.'); return }
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
    if (startingRef.current || mrRef.current?.state === 'recording') return
    startingRef.current = true
    setError(null)
    let stream = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const label = stream.getAudioTracks()[0]?.label
      if (label) setMicLabel(label.replace(/^(Par défaut|Default) - /, ''))
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
      setElapsed(0)
      setRecording(true)
      startMeter(stream)
    } catch (e) {
      stream?.getTracks().forEach(t => t.stop())
      setError(e.name === 'NotAllowedError'
        ? 'Accès au micro refusé — autorisez-le dans le navigateur puis réessayez.'
        : 'Micro inaccessible : ' + e.message)
    } finally {
      startingRef.current = false
    }
  }

  function stopRec() {
    mrRef.current?.stop()
    setRecording(false)
    stopMeter()
  }

  const isRecording = () => startingRef.current || mrRef.current?.state === 'recording'

  // Keyboard R (editor / Studio screen) drives the same start/stop as the button.
  useImperativeHandle(ref, () => ({
    isRecording,
    toggle: () => {
      if (startingRef.current) return
      if (mrRef.current?.state === 'recording') stopRec()
      else startRec()
    },
  }))

  function playTake(take) {
    stopSync()
    const a = audioRef.current
    if (!a) return
    a.src = take.audio_url
    a.play().catch(e => { setPlaying(null); setError('Lecture impossible : ' + e.message) })
    setPlaying(take.id)
  }

  function togglePlay(take) {
    if (playing === take.id) { audioRef.current?.pause(); setPlaying(null) }
    else playTake(take)
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
    let done = false

    function onTimeUpdate() {
      if (!triggered && v.currentTime >= startAt) {
        triggered = true
        a.currentTime = 0
        a.play().catch(e => console.warn('take playback failed', e))
      }
    }

    function cleanup() {
      if (done) return
      done = true
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('pause', onVideoPause)
      v.muted = wasMuted
      setSyncPlaying(null)
      if (syncCleanupRef.current === cleanup) syncCleanupRef.current = null
    }

    function onVideoPause() {
      cleanup()
      a.pause()
    }

    syncCleanupRef.current = cleanup
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('pause', onVideoPause)
    v.play().catch(e => console.warn('video playback failed', e))
  }

  function handleAudioEnded() {
    setPlaying(null)
    if (syncCleanupRef.current) {
      const v = videoRef?.current
      if (v && !v.paused) v.pause()
      syncCleanupRef.current?.()
    }
    setSyncPlaying(null)
  }

  async function removeTake(id) {
    try {
      const res = await fetch(`/api/takes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (abA === id) setAbA(null)
      if (abB === id) setAbB(null)
      fetchTakes()
    } catch (e) {
      setError('Suppression de la prise impossible : ' + e.message)
    }
  }

  function assignAB(id) {
    setAbOpen(true)
    if (abA === id) { setAbA(null); return }
    if (abB === id) { setAbB(null); return }
    if (abA == null) setAbA(id)
    else setAbB(id)
  }

  function toggleAB() {
    if (showAB) { setAbOpen(false); setAbA(null); setAbB(null) }
    else setAbOpen(true)
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
  const showAB = abOpen || !!takeA || !!takeB
  const hasSub = activeIndex != null && subtitles[activeIndex]
  const hasVideo = !!videoRef?.current

  const errorBox = error && (
    <div style={{ fontSize: T.fs.micro, color: T.danger, background: alpha(T.danger, '22'), padding: '6px 8px', borderRadius: T.r.chip }}>
      {error}
    </div>
  )

  const micStage = (
    <MicStage studio={studio} lvl={lvl} recording={recording} elapsed={elapsed}
      onToggle={recording ? stopRec : startRec}
      chips={studio
        ? (micLabel && <Chip soft color={T.text2} style={{ maxWidth: 280 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Micro · {micLabel}</span></Chip>)
        : (hasSub && hasVideo && <Chip soft color={T.text3}><Icon d={ICONS.film} size={11} stroke={T.text3} /> réplique {activeIndex + 1}</Chip>)} />
  )

  const takesColumn = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>PRISES</span>
        <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{takes.length}</span>
        <div style={{ flex: 1 }} />
        <button data-rd onClick={toggleAB} style={{ background: 'transparent', padding: 0 }}>
          <Chip soft={!showAB} active={showAB} color={T.info}>A/B comparer</Chip>
        </button>
      </div>
      {showAB && (
        <div style={{ background: T.surface, border: `1px solid ${alpha(T.info, '44')}`, borderRadius: T.r.ctl, padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: T.fs.micro, color: T.info, letterSpacing: 1, fontWeight: 700 }}>COMPARAISON A / B</div>
          {[{ s: 'A', t: takeA, c: T.accent }, { s: 'B', t: takeB, c: T.info }].map(x => (
            <div key={x.s} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: alpha(x.c, '22'), color: x.c, fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{x.s}</div>
              <Btn size="sm" icon={x.t && playing === x.t.id ? ICONS.pause : ICONS.play} disabled={!x.t} title="Écouter"
                onClick={() => x.t && togglePlay(x.t)} style={{ width: 28, height: 28, background: T.surface2 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: T.fs.xs, color: x.t ? T.text : T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {x.t ? takeLabel(x.t) : 'Choisir une prise (A/B)'}
              </span>
              <div style={{ display: 'flex', gap: 1, alignItems: 'center', height: 16 }}>
                {Array.from({ length: 28 }).map((_, i) => <div key={i} style={{ width: 2, height: `${(Math.sin(i * 0.6 + x.s.charCodeAt(0)) * 0.4 + 0.5) * 100}%`, background: alpha(x.c, '88'), borderRadius: 1 }} />)}
              </div>
            </div>
          ))}
        </div>
      )}
      {errorBox}
      {takes.length === 0 && (
        <div style={{ fontSize: T.fs.micro, color: T.text3, textAlign: 'center', padding: '10px 0' }}>
          Aucune prise enregistrée
        </div>
      )}
      {takes.map((t, i) => (
        <TakeCard key={t.id} take={t} seed={i} label={takeLabel(t)}
          isPlaying={playing === t.id} isSyncing={syncPlaying === t.id}
          ab={t.id === abA ? 'A' : t.id === abB ? 'B' : null}
          hasVideo={hasVideo}
          onPlay={() => togglePlay(t)}
          onSync={() => syncPlaying === t.id ? (stopSync(), videoRef.current?.pause()) : previewWithVideo(t)}
          onAB={() => assignAB(t.id)}
          onDelete={() => removeTake(t.id)} />
      ))}
    </>
  )

  const audio = <audio ref={audioRef} onEnded={handleAudioEnded} style={{ display: 'none' }} />

  if (!studio) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14 }}>
        {audio}
        {micStage}
        {takesColumn}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, padding: '8px 32px 28px', display: 'flex', gap: 20, overflow: 'hidden' }}>
      {audio}
      {/* Left: recording stage */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <LineCard subtitles={subtitles} index={activeIndex} fps={fps} onSelectIndex={onSelectIndex} />
        {micStage}
      </div>
      {/* Right: take queue + A/B */}
      <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        {takesColumn}
      </div>
    </div>
  )
})

function MicStage({ studio, lvl, recording, elapsed, onToggle, chips }) {
  const btn = studio ? 76 : 68
  return (
    <div style={{
      ...(studio ? { flex: 1, minHeight: 0, gap: 24 } : { gap: 18, padding: '22px 16px' }),
      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.card,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      {/* live meter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: studio ? 80 : 64 }}>
        {lvl.map((v, i) => (
          <div key={i} style={{ width: 4, height: `${v * 100}%`, background: recording ? (v > 0.8 ? T.danger : T.accent) : T.border3, borderRadius: 2, transition: 'height .08s' }} />
        ))}
      </div>
      <button data-rd onClick={onToggle} title={recording ? 'Arrêter (R)' : 'Enregistrer (R)'} style={{
        width: btn, height: btn, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
        background: recording ? T.danger : T.accent, border: `4px solid ${recording ? alpha(T.danger, '44') : alpha(T.accent, '44')}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: recording ? `0 0 30px ${alpha(T.danger, '66')}` : `0 0 24px ${alpha(T.accent, '44')}`,
      }}>
        <Icon d={recording ? ICONS.pause : ICONS.mic} size={studio ? 30 : 27} stroke="#0b0b0d" fill={recording ? '#0b0b0d' : 'none'} />
      </button>
      <div style={{ fontSize: T.fs.sm, color: T.text2, fontFamily: T.fontMono }}>
        {recording
          ? <span style={{ color: T.danger, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Dot color={T.danger} pulse />ENREGISTREMENT · {fmtClock(elapsed)}</span>
          : 'Appuyer pour enregistrer · R'}
      </div>
      {chips && (
        <div style={{ position: 'absolute', top: studio ? 14 : 12, right: studio ? 16 : 12, display: 'flex', gap: 8 }}>
          {chips}
        </div>
      )}
    </div>
  )
}

function LineCard({ subtitles, index, fps, onSelectIndex }) {
  const charIndex = useMemo(() => {
    const seen = []
    for (const s of subtitles) {
      const c = s.character || ''
      if (!seen.includes(c)) seen.push(c)
    }
    return Object.fromEntries(seen.map((c, i) => [c, i]))
  }, [subtitles])
  const target = index != null ? subtitles[index] : null
  const tc = target ? TRACK_HEXES[(charIndex[target.character || ''] || 0) % TRACK_HEXES.length] : T.border3
  const n = subtitles.length
  return (
    <div style={{ background: T.surface, border: `1px solid ${alpha(tc, '33')}`, borderRadius: T.r.card, padding: 22, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
      <Avatar name={target?.character || '?'} color={tc} size={46} ring />
      <div style={{ flex: 1, minWidth: 0 }}>
        {target ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
              <span style={{ fontSize: T.fs.md, fontWeight: 700, color: tc }}>{target.character || 'Sans personnage'}</span>
              <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono }}>réplique {index + 1} · {fmtSMPTE(target.start, fps)} → {fmtSMPTE(target.end, fps)}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: T.text, fontFamily: "'Caveat', cursive", letterSpacing: 0.3 }}>{target.text}</div>
            {target.note && <div style={{ fontSize: T.fs.xs, color: T.accent, fontStyle: 'italic', marginTop: 4 }}>{target.note}</div>}
          </>
        ) : (
          <div style={{ fontSize: T.fs.sm, color: T.text3 }}>
            {n ? 'Choisissez une réplique — la prise y sera rattachée.' : 'Aucune réplique — la prise sera enregistrée comme prise libre.'}
          </div>
        )}
      </div>
      {n > 0 && onSelectIndex && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Btn size="sm" icon={ICONS.prev} title="Réplique précédente" disabled={index == null || index <= 0}
            onClick={() => onSelectIndex(Math.max(0, (index ?? 0) - 1))} />
          <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, minWidth: 44, textAlign: 'center' }}>{index != null ? index + 1 : '–'} / {n}</span>
          <Btn size="sm" icon={ICONS.next} title="Réplique suivante" disabled={index != null && index >= n - 1}
            onClick={() => onSelectIndex(index == null ? 0 : Math.min(n - 1, index + 1))} />
        </div>
      )}
    </div>
  )
}

function TakeCard({ take, seed, label, isPlaying, isSyncing, ab, hasVideo, onPlay, onSync, onAB, onDelete }) {
  const marked = !!ab
  return (
    <div style={{
      background: isSyncing ? T.accentDim : T.surface,
      border: `1px solid ${marked ? alpha(T.accent, '55') : isSyncing ? alpha(T.accent, '44') : T.border}`,
      borderRadius: T.r.ctl, padding: 13, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <Btn size="sm" icon={isPlaying ? ICONS.pause : ICONS.play} active={isPlaying} title="Écouter" onClick={onPlay}
          style={{ background: T.surface2, width: 30, height: 30 }} />
        <span style={{ fontSize: T.fs.sm, fontWeight: 600, color: T.text, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono }}>{(take.duration || 0).toFixed(1)}s</span>
        {hasVideo && (
          <Btn size="sm" active={isSyncing} icon={isSyncing ? ICONS.stop : ICONS.film} title="Écouter avec vidéo" onClick={onSync} />
        )}
        <Btn size="sm" active={marked} onClick={onAB} title="Comparer A/B" style={{ padding: '0 8px', fontWeight: 700 }}>
          {ab || 'A/B'}
        </Btn>
        <Btn size="sm" icon={ICONS.trash} title="Supprimer" onClick={onDelete} />
      </div>
      {/* mini waveform (placeholder bars seeded by position) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 28 }}>
        {Array.from({ length: 56 }).map((_, j) => {
          const v = (Math.sin(j * 0.4 + seed) * 0.4 + Math.sin(j * 0.9) * 0.3 + 0.45)
          return <div key={j} style={{ flex: 1, height: `${Math.abs(v) * 100}%`, background: marked ? alpha(T.accent, 'aa') : T.border3, borderRadius: 1 }} />
        })}
      </div>
    </div>
  )
}

export default RecorderPanel
