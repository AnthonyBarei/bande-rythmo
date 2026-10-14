import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { T, alpha, Icon, ICONS, Btn, Chip, Dot, Avatar } from '../ui'
import { TRACK_HEXES } from '../config/tracks'
import { fmtClock, fmtSMPTE } from '../utils/timecode'
import { METER_FLOOR, levelOf, trimToWav, takePeaks } from '../utils/takeAudio'

// Recorder — port of redesign screen-record-export.jsx → Record.
// variant 'studio'   : full Studio screen body (booth left · PRISES + A/B 340px right).
// variant 'embedded' : compact stack for the editor inspector.
//
// Pre-roll: the mic records from the count-in, the cue media (editor video /
// Studio VO track) plays from réplique start − 3 s, and the captured lead-in
// is trimmed off before upload — a take always starts at its réplique start,
// which is where the dubbed mix (mix_service adelay = réplique start) and the
// "écouter avec vidéo" preview place it.

const PREROLL_SEC = 3
const PREROLL_KEY = 'br-recorder-preroll'
const DENIED_MSG = 'Accès au micro refusé — autorisez-le dans le navigateur puis réessayez.'

const micError = e => (e?.name === 'NotAllowedError' ? DENIED_MSG : 'Micro inaccessible : ' + (e?.message || e))
const deviceName = label => (label || '').replace(/^(Par défaut|Default) - /, '')
const stopTracks = stream => stream?.getTracks().forEach(t => t.stop())

function readPreroll() {
  try { return localStorage.getItem(PREROLL_KEY) !== '0' } catch { return true } // storage unavailable — default on
}

function takeExt(mime) {
  if (/ogg/.test(mime)) return 'ogg'
  if (/mp4|aac/.test(mime)) return 'm4a'
  return 'webm'
}

function seekMedia(media, t) {
  return new Promise(resolve => {
    if (Math.abs(media.currentTime - t) < 0.01) { resolve(); return }
    const done = () => { clearTimeout(timer); media.removeEventListener('seeked', done); resolve() }
    const timer = setTimeout(() => { console.warn('pre-roll: seek timeout, starting anyway'); done() }, 2000)
    media.addEventListener('seeked', done)
    media.currentTime = t
  })
}

const RecorderPanel = forwardRef(function RecorderPanel({
  clipId, subtitles = [], activeCharacter = '', activeIndex = null, videoRef = null, cueRef = null,
  variant = 'embedded', fps = 25, onSelectIndex,
}, ref) {
  const studio = variant === 'studio'
  const [takes, setTakes] = useState([])
  const [phase, setPhase] = useState('idle')          // idle | preroll | recording
  const [countdown, setCountdown] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  const [abOpen, setAbOpen] = useState(false)
  const [abA, setAbA] = useState(null)
  const [abB, setAbB] = useState(null)
  const [playing, setPlaying] = useState(null)
  const [syncPlaying, setSyncPlaying] = useState(null)
  const [micLabel, setMicLabel] = useState('')
  const [micDenied, setMicDenied] = useState(false)
  const [analyser, setAnalyser] = useState(null)
  const [preroll, setPreroll] = useState(readPreroll)
  const [selectedId, setSelectedId] = useState(null)

  const startingRef = useRef(false)
  const recRef = useRef(null)          // active take: { mr, chunks, stream, ownsStream, media, ... }
  const liveStreamRef = useRef(null)   // Studio: mic held open while the screen is mounted
  const acRef = useRef(null)
  const goAtRef = useRef(0)
  const audioRef = useRef(null)
  const syncCleanupRef = useRef(null)

  useEffect(() => {
    try { localStorage.setItem(PREROLL_KEY, preroll ? '1' : '0') } catch { /* storage unavailable — keep in-memory value */ }
  }, [preroll])

  const attachMeter = useCallback(stream => {
    const prev = acRef.current
    acRef.current = null
    prev?.close().catch(e => console.warn('Fermeture AudioContext', e))
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      const ac = new AC()
      const an = ac.createAnalyser()
      an.fftSize = 1024
      ac.createMediaStreamSource(stream).connect(an)
      ac.resume().catch(e => console.warn('AudioContext resume', e))
      acRef.current = ac
      setAnalyser(an)
    } catch (e) {
      console.warn('Vumètre indisponible', e)
      setAnalyser(null)
    }
  }, [])

  const detachMeter = useCallback(() => {
    setAnalyser(null)
    const ac = acRef.current
    acRef.current = null
    ac?.close().catch(e => console.warn('Fermeture AudioContext', e))
  }, [])

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

  // Studio: open the mic for the live meter + device name; released on unmount.
  useEffect(() => {
    if (!studio) return
    if (!navigator.mediaDevices?.getUserMedia) { setError('Micro indisponible dans ce navigateur.'); return }
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        if (cancelled) { stopTracks(stream); return }
        liveStreamRef.current = stream
        const track = stream.getAudioTracks()[0]
        setMicLabel(deviceName(track?.label))
        setMicDenied(false)
        if (track) track.onended = () => { setError('Micro déconnecté — rebranchez-le puis rouvrez le Studio.'); detachMeter() }
        attachMeter(stream)
      })
      .catch(e => {
        if (cancelled) return
        setMicDenied(true)
        setError(micError(e))
      })
    return () => {
      cancelled = true
      stopTracks(liveStreamRef.current)
      liveStreamRef.current = null
      detachMeter()
    }
  }, [studio, attachMeter, detachMeter])

  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setElapsed((performance.now() - goAtRef.current) / 1000), 100)
    return () => clearInterval(id)
  }, [phase])

  async function uploadTake(rec, stoppedAt) {
    const trim = (rec.goAt - rec.t0) / 1000
    const mime = rec.mr.mimeType || 'audio/webm'
    const raw = new Blob(rec.chunks, { type: mime })
    if (!raw.size) { setError('Prise vide — aucun son capté.'); return }
    let audio = raw
    let filename = `take.${takeExt(mime)}`
    let duration = (stoppedAt - rec.goAt) / 1000
    if (trim > 0.001) {
      try {
        const out = await trimToWav(raw, trim)
        audio = out.blob
        filename = 'take.wav'
        duration = out.duration
      } catch (e) {
        setError('Découpe du pré-roll impossible (' + e.message + ') — prise non enregistrée.')
        return
      }
    }
    const form = new FormData()
    form.append('clip_id', clipId)
    form.append('character', rec.character || '')
    if (rec.subIndex != null) form.append('subtitle_index', String(rec.subIndex))
    form.append('duration', Math.max(0, duration).toFixed(2))
    form.append('audio', audio, filename)
    try {
      const res = await fetch('/api/takes/', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const take = await res.json()
      setSelectedId(take.id)
      fetchTakes()
    } catch (e) {
      setError('Échec de l’enregistrement : ' + e.message)
    }
  }

  // Hand the cue media back: pause it if the take drove it, restore its rate.
  function releaseMedia(rec) {
    rec.cleanupMedia?.()
    if (!rec.media) return
    rec.media.pause()
    rec.media.playbackRate = rec.rate
  }

  function goLive(rec, goAt) {
    rec.goAt = goAt
    rec.live = true
    goAtRef.current = goAt
    rec.cleanupMedia?.()
    rec.cleanupMedia = null
    // Studio cue is audio-only: stop the VO so it does not bleed into the take.
    // The editor video keeps running: the actor syncs on the picture.
    if (rec.media && rec.media === cueRef?.current) rec.media.pause()
    else if (rec.media?.paused) rec.media.play().catch(e => console.warn('lecture vidéo impossible', e))
    setCountdown(0)
    setElapsed(0)
    setPhase('recording')
  }

  function runPreroll(rec) {
    rec.clock = 'timer'
    if (rec.media) {
      const onPause = () => { if (!rec.live && recRef.current === rec) stopRec() }
      rec.media.addEventListener('pause', onPause)
      rec.cleanupMedia = () => rec.media.removeEventListener('pause', onPause)
      rec.media.play()
        .then(() => { if (!rec.live) rec.clock = 'media' })
        .catch(e => console.warn('pre-roll: lecture impossible, décompte seul', e))
    }
    const tick = () => {
      if (recRef.current !== rec || rec.live) return
      const now = performance.now()
      // Media clock = what the actor sees/hears; timer until playback starts.
      const remaining = rec.clock === 'media'
        ? rec.sub.start - rec.media.currentTime
        : rec.lead - (now - rec.t0) / 1000
      if (remaining <= 0) { goLive(rec, now + remaining * 1000); return }
      setCountdown(Math.ceil(remaining))
      rec.raf = requestAnimationFrame(tick)
    }
    setCountdown(Math.ceil(rec.lead))
    setPhase('preroll')
    rec.raf = requestAnimationFrame(tick)
  }

  async function startRec() {
    if (startingRef.current || recRef.current) return
    startingRef.current = true
    setError(null)
    const sub = activeIndex != null ? subtitles[activeIndex] : null
    const media = [videoRef?.current, cueRef?.current].find(m => m && !m.error && m.readyState >= 1) || null
    let stream = liveStreamRef.current
    let ownsStream = false
    let rec = null
    try {
      if (!stream?.active) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        ownsStream = true
        setMicLabel(deviceName(stream.getAudioTracks()[0]?.label))
        setMicDenied(false)
      }
      const drive = preroll && sub && media ? media : null
      const lead = !preroll ? 0 : drive ? Math.min(PREROLL_SEC, Math.max(0, sub.start)) : PREROLL_SEC
      rec = {
        mr: new MediaRecorder(stream), chunks: [], stream, ownsStream, sub, lead,
        media: drive, rate: drive?.playbackRate ?? 1,
        subIndex: activeIndex, character: activeCharacter, t0: 0, goAt: 0, live: false, raf: 0,
      }
      if (drive) {
        drive.pause()
        drive.playbackRate = 1
        await seekMedia(drive, sub.start - lead)
      }
      rec.mr.ondataavailable = e => { if (e.data.size) rec.chunks.push(e.data) }
      await new Promise((resolve, reject) => {
        rec.mr.onstart = resolve
        rec.mr.onerror = e => reject(e.error || new Error('MediaRecorder'))
        rec.mr.start()
      })
      rec.t0 = performance.now()
      rec.mr.onerror = e => {
        setError('Erreur d’enregistrement : ' + (e.error?.message || 'MediaRecorder'))
        if (recRef.current === rec) stopRec()
      }
      recRef.current = rec
      if (ownsStream) attachMeter(stream)
      if (lead > 0) runPreroll(rec)
      else goLive(rec, rec.t0)
    } catch (e) {
      if (ownsStream) stopTracks(stream)
      if (rec?.media) rec.media.playbackRate = rec.rate
      if (e?.name === 'NotAllowedError') setMicDenied(true)
      setError(micError(e))
    } finally {
      startingRef.current = false
    }
  }

  // Stop the take — during the pre-roll it is discarded (nothing to keep).
  function stopRec() {
    const rec = recRef.current
    if (!rec) return
    recRef.current = null
    cancelAnimationFrame(rec.raf)
    const stoppedAt = performance.now()
    const keep = rec.live
    rec.mr.onstop = () => {
      if (rec.ownsStream) { stopTracks(rec.stream); detachMeter() }
      if (keep) uploadTake(rec, stoppedAt)
    }
    if (rec.mr.state !== 'inactive') rec.mr.stop()
    else rec.mr.onstop()
    releaseMedia(rec)
    setPhase('idle')
    setCountdown(0)
    if (!keep) setError('Prise annulée pendant le pré-roll.')
  }

  // Unmount: drop an in-flight take, release everything.
  useEffect(() => () => {
    const rec = recRef.current
    recRef.current = null
    if (rec) {
      cancelAnimationFrame(rec.raf)
      rec.mr.onstop = null
      if (rec.mr.state !== 'inactive') rec.mr.stop()
      if (rec.ownsStream) stopTracks(rec.stream)
      rec.cleanupMedia?.()
      if (rec.media) { rec.media.pause(); rec.media.playbackRate = rec.rate }
    }
    syncCleanupRef.current?.()
    const ac = acRef.current
    acRef.current = null
    ac?.close().catch(e => console.warn('Fermeture AudioContext', e))
  }, [])

  const isRecording = () => startingRef.current || !!recRef.current

  // Keyboard R (editor / Studio screen) drives the same start/stop as the button.
  useImperativeHandle(ref, () => ({
    isRecording,
    toggle: () => {
      if (startingRef.current) return
      if (recRef.current) stopRec()
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
    const sub = take.subtitle_index != null ? subtitles[take.subtitle_index] : null
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

  // Re-validating the current best is a harmless no-op on the server.
  async function markBest(take) {
    if (!take) return
    try {
      const res = await fetch(`/api/takes/${take.id}/best`, { method: 'PUT' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSelectedId(take.id)
      fetchTakes()
    } catch (e) {
      setError('Validation de la prise impossible : ' + e.message)
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

  // Studio lists the takes of the réplique being recorded ("Prise n", newest
  // first); the editor dock lists every take of the clip.
  const shown = useMemo(() => {
    if (!studio) return takes
    return takes.filter(t => (t.subtitle_index ?? null) === (activeIndex ?? null)).reverse()
  }, [takes, studio, activeIndex])

  function takeLabel(t) {
    if (studio) return `Prise ${takes.filter(x => (x.subtitle_index ?? null) === (t.subtitle_index ?? null) && x.id <= t.id).length}`
    if (t.subtitle_index != null && subtitles[t.subtitle_index]) {
      const s = subtitles[t.subtitle_index]
      return `Réplique ${t.subtitle_index + 1}${s.character ? ' · ' + s.character : ''}`
    }
    return t.character || 'Prise libre'
  }

  // Selection ≠ best: Studio defaults to the newest take, "meilleure" only moves on Valider.
  const selected = shown.find(t => t.id === selectedId)
    || (studio ? shown[0] : null)
    || null
  const takeA = takes.find(t => t.id === abA)
  const takeB = takes.find(t => t.id === abB)
  const showAB = abOpen || !!takeA || !!takeB
  const hasSub = activeIndex != null && subtitles[activeIndex]
  const hasVideo = !!videoRef?.current
  const recording = phase !== 'idle'

  const errorBox = error && (
    <div style={{ fontSize: T.fs.micro, color: T.danger, background: alpha(T.danger, '22'), padding: '6px 8px', borderRadius: T.r.chip }}>
      {error}
    </div>
  )

  const prerollChip = (
    <button data-rd onClick={() => setPreroll(v => !v)} disabled={recording}
      title={recording ? 'Indisponible pendant l’enregistrement' : preroll
        ? `Pré-roll ${PREROLL_SEC} s : la vidéo repart ${PREROLL_SEC} s avant la réplique, décompte 3-2-1 (cliquer pour désactiver)`
        : 'Pré-roll désactivé — l’enregistrement démarre immédiatement (cliquer pour activer)'}
      style={{ background: 'transparent', padding: 0, cursor: recording ? 'default' : 'pointer' }}>
      <Chip soft color={preroll ? T.accent : T.text3}>
        <Icon d={ICONS.loop} size={11} stroke={preroll ? T.accent : T.text3} /> {preroll ? `Pré-roll ${PREROLL_SEC}s` : 'Pré-roll off'}
      </Chip>
    </button>
  )

  const micChip = micDenied
    ? <Chip soft color={T.danger}>Micro · refusé</Chip>
    : micLabel && (
      <Chip soft color={T.text2} style={{ maxWidth: 280 }}>
        <span title={micLabel} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Micro · {micLabel}</span>
      </Chip>
    )

  const micStage = (
    <MicStage studio={studio} analyser={analyser} phase={phase} countdown={countdown} elapsed={elapsed}
      onToggle={recording ? stopRec : startRec}
      chips={studio
        ? <>{prerollChip}{micChip}</>
        : <>{prerollChip}{hasSub && hasVideo && <Chip soft color={T.text3}><Icon d={ICONS.film} size={11} stroke={T.text3} /> réplique {activeIndex + 1}</Chip>}</>} />
  )

  const takesColumn = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>PRISES</span>
        <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{shown.length}</span>
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
              <Btn size="sm" icon={x.t && playing === x.t.id ? ICONS.pause : ICONS.play} disabled={!x.t} title={x.t ? 'Écouter' : `Aucune prise ${x.s} choisie`}
                onClick={() => x.t && togglePlay(x.t)} style={{ width: 28, height: 28, background: T.surface2 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: T.fs.xs, color: x.t ? T.text : T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {x.t ? takeLabel(x.t) : 'Choisir une prise (A/B)'}
              </span>
              <TakeWave url={x.t?.audio_url} bars={28} height={16} gap={1} barWidth={2} color={alpha(x.c, '88')} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn size="sm" variant="outline" full style={{ flex: 1, minWidth: 0 }} disabled={!takeA || takeA.best} onClick={() => markBest(takeA)}
              title={!takeA ? "Choisissez d'abord une prise A" : takeA.best ? 'La prise A est déjà la meilleure' : 'Garder la prise A comme meilleure'}>Garder A</Btn>
            <Btn size="sm" variant="outline" full style={{ flex: 1, minWidth: 0 }} disabled={!takeB || takeB.best} onClick={() => markBest(takeB)}
              title={!takeB ? "Choisissez d'abord une prise B" : takeB.best ? 'La prise B est déjà la meilleure' : 'Garder la prise B comme meilleure'}>Garder B</Btn>
          </div>
        </div>
      )}
      {errorBox}
      {shown.length === 0 && (
        <div style={{ border: `2px dashed ${T.border2}`, borderRadius: T.r.ctl, padding: 18, fontSize: T.fs.xs, color: T.text3, textAlign: 'center', lineHeight: 1.5 }}>
          Aucune prise. Appuyez sur R pour enregistrer
        </div>
      )}
      {shown.map(t => (
        <TakeCard key={t.id} take={t} label={takeLabel(t)}
          selected={selected?.id === t.id}
          isPlaying={playing === t.id} isSyncing={syncPlaying === t.id}
          ab={t.id === abA ? 'A' : t.id === abB ? 'B' : null}
          hasVideo={hasVideo}
          onSelect={() => setSelectedId(t.id)}
          onPlay={() => togglePlay(t)}
          onSync={() => syncPlaying === t.id ? (stopSync(), videoRef.current?.pause()) : previewWithVideo(t)}
          onAB={() => assignAB(t.id)}
          onDelete={() => removeTake(t.id)} />
      ))}
      <Btn variant="solid" full icon={ICONS.check} disabled={!selected}
        title={!selected
          ? (shown.length ? "Sélectionnez d'abord une prise" : "Enregistrez d'abord une prise (R)")
          : selected.best ? 'Cette prise est déjà la meilleure — la valider à nouveau' : 'Marquer la prise sélectionnée comme meilleure prise de la réplique'}
        onClick={() => markBest(selected)}>
        Valider la prise sélectionnée
      </Btn>
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
        <LineCard subtitles={subtitles} index={activeIndex} fps={fps} onSelectIndex={recording ? null : onSelectIndex} />
        {micStage}
      </div>
      {/* Right: take queue + A/B */}
      <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingBottom: 'var(--toast-safe-bottom, 0px)' }}>
        {takesColumn}
      </div>
    </div>
  )
})

// Rolling input-level history (newest right) from the live analyser.
function MeterBars({ analyser, bars, height, live }) {
  const [lvl, setLvl] = useState(() => Array(bars).fill(METER_FLOOR))
  useEffect(() => {
    if (!analyser) return
    const buf = new Float32Array(analyser.fftSize)
    const id = setInterval(() => {
      analyser.getFloatTimeDomainData(buf)
      const v = levelOf(buf)
      setLvl(p => [...p.slice(1), v])
    }, 60)
    return () => { clearInterval(id); setLvl(Array(bars).fill(METER_FLOOR)) }
  }, [analyser, bars])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height }}>
      {lvl.map((v, i) => (
        <div key={i} style={{ width: 4, height: `${v * 100}%`, background: live ? (v > 0.8 ? T.danger : T.accent) : T.border3, borderRadius: 2, transition: 'height .08s' }} />
      ))}
    </div>
  )
}

function MicStage({ studio, analyser, phase, countdown, elapsed, onToggle, chips }) {
  const btn = studio ? 76 : 68
  const recording = phase === 'recording'
  const prerolling = phase === 'preroll'
  return (
    <div style={{
      ...(studio ? { flex: 1, minHeight: 0, gap: 24 } : { gap: 18, padding: '44px 16px 22px' }),
      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.card,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      <MeterBars analyser={analyser} bars={studio ? 48 : 44} height={studio ? 80 : 64} live={phase !== 'idle'} />
      <button data-rd onClick={onToggle}
        title={recording ? 'Arrêter (R)' : prerolling ? 'Annuler le pré-roll (R)' : 'Enregistrer (R)'} style={{
          width: btn, height: btn, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
          background: recording ? T.danger : T.accent, border: `4px solid ${recording ? alpha(T.danger, '44') : alpha(T.accent, '44')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: recording ? `0 0 30px ${alpha(T.danger, '66')}` : `0 0 24px ${alpha(T.accent, '44')}`,
        }}>
        {prerolling
          ? <span style={{ fontSize: studio ? 34 : 30, fontWeight: 700, fontFamily: T.fontMono, color: '#0b0b0d', lineHeight: 1 }}>{countdown}</span>
          : <Icon d={recording ? ICONS.pause : ICONS.mic} size={studio ? 30 : 27} stroke="#0b0b0d" fill={recording ? '#0b0b0d' : 'none'} />}
      </button>
      <div style={{ fontSize: T.fs.sm, color: T.text2, fontFamily: T.fontMono }}>
        {recording
          ? <span style={{ color: T.danger, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Dot color={T.danger} pulse />ENREGISTREMENT · {fmtClock(elapsed)}</span>
          : prerolling
            ? <span style={{ color: T.accent }}>PRÉ-ROLL · réplique dans {countdown}…</span>
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
            {target.note && <div style={{ fontSize: T.fs.xs, color: T.accent, fontStyle: 'italic', marginTop: 4 }}>↳ {target.note}</div>}
          </>
        ) : (
          <div style={{ fontSize: T.fs.sm, color: T.text3 }}>
            {n ? 'Choisissez une réplique — la prise y sera rattachée.' : 'Aucune réplique — la prise sera enregistrée comme prise libre.'}
          </div>
        )}
      </div>
      {n > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Btn size="sm" icon={ICONS.prev} title={index != null && index <= 0 ? 'Déjà sur la première réplique' : 'Réplique précédente'} disabled={!onSelectIndex || index == null || index <= 0}
            onClick={() => onSelectIndex?.(Math.max(0, (index ?? 0) - 1))} />
          <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, minWidth: 44, textAlign: 'center' }}>{index != null ? index + 1 : '–'} / {n}</span>
          <Btn size="sm" icon={ICONS.next} title={index != null && index >= n - 1 ? 'Déjà sur la dernière réplique' : 'Réplique suivante'} disabled={!onSelectIndex || (index != null && index >= n - 1)}
            onClick={() => onSelectIndex?.(index == null ? 0 : Math.min(n - 1, index + 1))} />
        </div>
      )}
    </div>
  )
}

// Mini waveform decoded from the take file (cached per url).
function TakeWave({ url, bars = 56, height = 28, gap = 1.5, barWidth, color }) {
  const [peaks, setPeaks] = useState(null)
  useEffect(() => {
    if (!url) return
    let live = true
    takePeaks(url, bars)
      .then(p => { if (live) setPeaks(p) })
      .catch(e => console.warn('Forme d’onde indisponible', url, e))
    return () => { live = false; setPeaks(null) }
  }, [url, bars])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, height, flex: barWidth ? undefined : 1 }}>
      {Array.from({ length: bars }, (_, i) => (
        <div key={i} style={{
          ...(barWidth ? { width: barWidth } : { flex: 1 }),
          height: `${(peaks?.[i] ?? METER_FLOOR) * 100}%`, background: color, borderRadius: 1,
        }} />
      ))}
    </div>
  )
}

function TakeCard({ take, label, selected, isPlaying, isSyncing, ab, hasVideo, onSelect, onPlay, onSync, onAB, onDelete }) {
  const best = !!take.best
  return (
    <div onClick={onSelect} style={{
      background: isSyncing ? T.accentDim : T.surface,
      border: `1px solid ${selected ? T.accent : best ? alpha(T.accent, '55') : ab ? T.border3 : isSyncing ? alpha(T.accent, '44') : T.border}`,
      borderRadius: T.r.ctl, padding: 13, flexShrink: 0, cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <Btn size="sm" icon={isPlaying ? ICONS.pause : ICONS.play} active={isPlaying} title="Écouter" onClick={onPlay}
          style={{ background: T.surface2, width: 30, height: 30 }} />
        <span style={{ fontSize: T.fs.sm, fontWeight: 600, color: T.text, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {best && <Chip color={T.accent} soft><Icon d={ICONS.check} size={10} stroke={T.accent} /> meilleure</Chip>}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono }}>{(take.duration || 0).toFixed(1)}s</span>
        {hasVideo && (
          <Btn size="sm" active={isSyncing} icon={isSyncing ? ICONS.stop : ICONS.film} title="Écouter avec vidéo" onClick={onSync} />
        )}
        <Btn size="sm" active={!!ab} onClick={onAB} title="Comparer A/B" style={{ padding: '0 8px', fontWeight: 700 }}>
          {ab || 'A/B'}
        </Btn>
        <Btn size="sm" icon={ICONS.trash} title="Supprimer" onClick={onDelete} />
      </div>
      <TakeWave url={take.audio_url} color={best ? alpha(T.accent, 'aa') : T.border3} />
    </div>
  )
}

export default RecorderPanel
