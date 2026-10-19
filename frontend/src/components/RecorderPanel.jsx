import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { T, alpha, Icon, ICONS, Btn, Chip, Dot, Avatar } from '../ui'
import { TRACK_HEXES } from '../config/tracks'
import { fmtClock, fmtSMPTE } from '../utils/timecode'
import { METER_FLOOR, levelOf, trimToWav, takePeaks } from '../utils/takeAudio'

// Recorder — port of redesign screen-record-export.jsx → Record.
// variant 'studio'   : the dubbing stage (one black card: line strip · image ·
//                      bande rythmo · control strip) + PRISES / A/B 340px right.
//                      The Studio screen hands in the image (`stageImage`) and
//                      the read-only band (`stageBand`); `videoRef` drives both.
// variant 'embedded' : compact stack for the editor inspector.
//
// Pre-roll: the mic records from the count-in, the cue media (editor video /
// Studio video) plays from réplique start − 3 s, and the captured lead-in
// is trimmed off before upload — a take always starts at its réplique start,
// which is where the dubbed mix (mix_service adelay = réplique start) and the
// "écouter avec vidéo" preview place it.
// Studio only: one 1 kHz bip per count, the video keeps rolling (muted) under
// the take so the band scrolls, auto-stop at réplique end + 0.6 s, then the
// video rewinds to start − 3 s for the next take.

const PREROLL_SEC = 3
const AUTO_STOP_TAIL = 0.6
const PREROLL_KEY = 'br-recorder-preroll'
const NOTICE_MS = 3000
const CANCEL_NOTICE = 'Prise annulée pendant le pré-roll.'
const DENIED_MSG = 'Accès au micro refusé — autorisez-le dans le navigateur puis réessayez.'
const STAGE_KEYFRAMES = '@keyframes stCount{0%{transform:scale(1.5);opacity:0}25%{opacity:1}100%{transform:scale(.9);opacity:.15}}'
  + '@keyframes stBlink{50%{opacity:0}}'
  + '@keyframes stIn{from{transform:translateY(-6px);opacity:0}to{transform:none;opacity:1}}'

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
  variant = 'embedded', fps = 25, onSelectIndex, stageImage = null, stageBand = null,
}, ref) {
  const studio = variant === 'studio'
  const [takes, setTakes] = useState([])
  const [phase, setPhase] = useState('idle')          // idle | preroll | recording
  const [countdown, setCountdown] = useState(0)
  const [leadTotal, setLeadTotal] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)          // { text } — transient, non-error status (3 s)
  const [abOpen, setAbOpen] = useState(false)
  const [abA, setAbA] = useState(null)
  const [abB, setAbB] = useState(null)
  const [playing, setPlaying] = useState(null)
  const [playProgress, setPlayProgress] = useState({ p: 0, now: 0 })   // playing take: 0..1 + frame clock
  const [syncPlaying, setSyncPlaying] = useState(null)
  const [micLabel, setMicLabel] = useState('')
  const [micDenied, setMicDenied] = useState(false)
  const [analyser, setAnalyser] = useState(null)
  const [preroll, setPreroll] = useState(readPreroll)
  const [selectedId, setSelectedId] = useState(null)
  const [freshId, setFreshId] = useState(null)

  const startingRef = useRef(false)
  const recRef = useRef(null)          // active take: { mr, chunks, stream, ownsStream, media, ... }
  const liveStreamRef = useRef(null)   // Studio: mic held open while the screen is mounted
  const acRef = useRef(null)
  const bipCtxRef = useRef(null)
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

  // Pre-roll bip — short 1 kHz tone (Studio). The lead-in it lands in is trimmed.
  function bip() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      const ac = bipCtxRef.current || (bipCtxRef.current = new AC())
      ac.resume().catch(e => console.warn('Bip : AudioContext resume', e))
      const t0 = ac.currentTime
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.frequency.value = 1000
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12)
      osc.connect(gain).connect(ac.destination)
      osc.start(t0)
      osc.stop(t0 + 0.13)
    } catch (e) {
      console.warn('Bip du pré-roll indisponible', e)
    }
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
    if (!notice) return
    const id = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(id)
  }, [notice])

  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setElapsed((performance.now() - goAtRef.current) / 1000), 100)
    return () => clearInterval(id)
  }, [phase])

  // Take playback progress (0..1) for the waveform fill / playhead.
  useEffect(() => {
    if (playing == null) return
    const take = takes.find(t => t.id === playing)
    let raf = 0
    const tick = () => {
      const a = audioRef.current
      const dur = take?.duration || (Number.isFinite(a?.duration) ? a.duration : 0)
      if (a && dur > 0) setPlayProgress({ p: Math.min(1, a.currentTime / dur), now: performance.now() })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); setPlayProgress({ p: 0, now: 0 }) }
  }, [playing, takes])

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
      setFreshId(take.id)
      fetchTakes()
    } catch (e) {
      setError('Échec de l’enregistrement : ' + e.message)
    }
  }

  // Hand the cue media back: pause it if the take drove it, restore its rate
  // (Studio: its sound too, and park it at réplique start − 3 s for the next take).
  function releaseMedia(rec) {
    rec.cleanupMedia?.()
    if (!rec.media) return
    rec.media.pause()
    rec.media.playbackRate = rec.rate
    if (rec.studio) {
      rec.media.muted = rec.wasMuted
      if (rec.sub) rec.media.currentTime = Math.max(0, rec.sub.start - PREROLL_SEC)
    }
  }

  // Studio: stop the take once the video passes réplique end + 0.6 s.
  function watchAutoStop(rec) {
    const tick = () => {
      if (recRef.current !== rec) return
      const m = rec.media
      if (m.ended || m.currentTime >= rec.sub.end + AUTO_STOP_TAIL) { stopRec(); return }
      rec.raf = requestAnimationFrame(tick)
    }
    rec.raf = requestAnimationFrame(tick)
  }

  function goLive(rec, goAt) {
    rec.goAt = goAt
    rec.live = true
    goAtRef.current = goAt
    rec.cleanupMedia?.()
    rec.cleanupMedia = null
    if (rec.studio && rec.media) {
      // Studio: image + band keep rolling under the take; the VO is muted so
      // it does not bleed into the mic.
      rec.media.muted = true
      if (rec.media.paused) rec.media.play().catch(e => console.warn('lecture vidéo impossible', e))
      if (rec.sub) watchAutoStop(rec)
    } else if (rec.media && rec.media === cueRef?.current) {
      // Audio-only cue: stop the VO so it does not bleed into the take.
      rec.media.pause()
    } else if (rec.media?.paused) {
      // The editor video keeps running: the actor syncs on the picture.
      rec.media.play().catch(e => console.warn('lecture vidéo impossible', e))
    }
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
    let shown = Math.ceil(rec.lead)
    const tick = () => {
      if (recRef.current !== rec || rec.live) return
      const now = performance.now()
      // Media clock = what the actor sees/hears; timer until playback starts.
      const remaining = rec.clock === 'media'
        ? rec.sub.start - rec.media.currentTime
        : rec.lead - (now - rec.t0) / 1000
      if (remaining <= 0) { goLive(rec, now + remaining * 1000); return }
      const n = Math.ceil(remaining)
      if (n !== shown) {
        shown = n
        if (rec.studio) bip()
      }
      setCountdown(n)
      rec.raf = requestAnimationFrame(tick)
    }
    setCountdown(shown)
    setLeadTotal(shown)
    setPhase('preroll')
    if (rec.studio) bip()
    rec.raf = requestAnimationFrame(tick)
  }

  async function startRec() {
    if (startingRef.current || recRef.current) return
    startingRef.current = true
    setError(null)
    setNotice(null)
    stopSync()
    if (playing != null) { audioRef.current?.pause(); setPlaying(null) }
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
      // Studio always rolls the image under the réplique (the band scrolls with it).
      const drive = (preroll || studio) && sub && media ? media : null
      const lead = !preroll ? 0 : drive ? Math.min(PREROLL_SEC, Math.max(0, sub.start)) : PREROLL_SEC
      rec = {
        mr: new MediaRecorder(stream), chunks: [], stream, ownsStream, sub, lead,
        media: drive, rate: drive?.playbackRate ?? 1, wasMuted: !!drive?.muted, studio,
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
      if (rec?.media) { rec.media.playbackRate = rec.rate; rec.media.muted = rec.wasMuted }
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
    if (!keep) setNotice({ text: CANCEL_NOTICE })
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
      if (rec.media) { rec.media.pause(); rec.media.playbackRate = rec.rate; rec.media.muted = rec.wasMuted }
    }
    syncCleanupRef.current?.()
    for (const ref of [acRef, bipCtxRef]) {
      const ac = ref.current
      ref.current = null
      ac?.close().catch(e => console.warn('Fermeture AudioContext', e))
    }
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
      if (playing === id) { audioRef.current?.pause(); setPlaying(null) }
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

  // Selection ≠ validated: Studio defaults to the newest take, "validée" only moves on Valider.
  const selected = shown.find(t => t.id === selectedId)
    || (studio ? shown[0] : null)
    || null
  const takeA = takes.find(t => t.id === abA)
  const takeB = takes.find(t => t.id === abB)
  // Studio: comparing needs two takes of the réplique (#6).
  const canAB = !studio || shown.length >= 2
  const showAB = canAB && (abOpen || !!takeA || !!takeB)
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

  const takesHeader = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minHeight: 24 }}>
        <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>PRISES</span>
        <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{shown.length}</span>
        <div style={{ flex: 1 }} />
        {canAB && (
          <button data-rd onClick={toggleAB} style={{ background: 'transparent', padding: 0 }}>
            <Chip soft={!showAB} active={showAB} color={T.info}>A/B comparer</Chip>
          </button>
        )}
      </div>
      {showAB && (
        <div style={{ background: T.surface, border: `1px solid ${alpha(T.info, '44')}`, borderRadius: T.r.ctl, padding: 12, display: 'flex', flexDirection: 'column', gap: 9, flexShrink: 0 }}>
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
              title={!takeA ? "Choisissez d'abord une prise A" : takeA.best ? 'La prise A est déjà validée' : 'Valider la prise A'}>Garder A</Btn>
            <Btn size="sm" variant="outline" full style={{ flex: 1, minWidth: 0 }} disabled={!takeB || takeB.best} onClick={() => markBest(takeB)}
              title={!takeB ? "Choisissez d'abord une prise B" : takeB.best ? 'La prise B est déjà validée' : 'Valider la prise B'}>Garder B</Btn>
          </div>
        </div>
      )}
      {errorBox}
    </>
  )

  const takesList = (
    <>
      {shown.length === 0 && (
        <div style={{ border: `2px dashed ${T.border2}`, borderRadius: T.r.ctl, padding: 18, fontSize: T.fs.xs, color: T.text3, textAlign: 'center', lineHeight: 1.5, flexShrink: 0 }}>
          Aucune prise. Appuyez sur R pour enregistrer
        </div>
      )}
      {shown.map(t => (
        <TakeCard key={t.id} take={t} label={takeLabel(t)}
          selected={selected?.id === t.id}
          fresh={freshId === t.id}
          isPlaying={playing === t.id} progress={playing === t.id ? playProgress.p : null} clock={playProgress.now}
          isSyncing={syncPlaying === t.id}
          ab={t.id === abA ? 'A' : t.id === abB ? 'B' : null}
          hasVideo={hasVideo && !studio}
          showAB={!studio || showAB}
          onSelect={() => setSelectedId(t.id)}
          onPlay={() => togglePlay(t)}
          onSync={() => syncPlaying === t.id ? (stopSync(), videoRef.current?.pause()) : previewWithVideo(t)}
          onAB={() => assignAB(t.id)}
          onDelete={() => removeTake(t.id)} />
      ))}
    </>
  )

  // #3 — primary while the selection is not the validated take, outline otherwise.
  const validerBtn = (
    <Btn variant={selected && !selected.best ? 'primary' : 'outline'} full icon={ICONS.check} disabled={!selected}
      title={!selected
        ? (shown.length ? "Sélectionnez d'abord une prise" : "Enregistrez d'abord une prise (R)")
        : selected.best ? 'Cette prise est déjà validée' : 'Valider la prise sélectionnée pour cette réplique'}
      onClick={() => markBest(selected)}>
      Valider la prise sélectionnée
    </Btn>
  )

  const audio = (
    <>
      <style>{STAGE_KEYFRAMES}</style>
      <audio ref={audioRef} onEnded={handleAudioEnded} style={{ display: 'none' }} />
    </>
  )

  if (!studio) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14 }}>
        {audio}
        <MicStage analyser={analyser} phase={phase} countdown={countdown} elapsed={elapsed} notice={notice?.text}
          onToggle={recording ? stopRec : startRec}
          chips={<>{prerollChip}{hasSub && hasVideo && <Chip soft color={T.text3}><Icon d={ICONS.film} size={11} stroke={T.text3} /> réplique {activeIndex + 1}</Chip>}</>} />
        {takesHeader}
        {takesList}
        {validerBtn}
      </div>
    )
  }

  const target = hasSub ? subtitles[activeIndex] : null
  const recDur = target ? target.end - target.start : 0
  const recLive = phase === 'recording'

  return (
    <div style={{ flex: 1, minHeight: 0, padding: '4px 32px 24px', display: 'flex', gap: 20, overflow: 'hidden' }}>
      {audio}
      {/* Left: dubbing stage — line strip · image · band · control strip */}
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#000',
        border: `1px solid ${recLive ? alpha(T.danger, '88') : T.border}`, borderRadius: T.r.card, overflow: 'hidden', transition: 'border-color .2s',
      }}>
        <LineStrip subtitles={subtitles} index={activeIndex} fps={fps} onSelectIndex={recording ? null : onSelectIndex} />
        <div style={{ flex: 1, minHeight: 80, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ height: '94%', aspectRatio: '16/9', maxWidth: '96%', background: '#000', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
            {stageImage}
            {phase === 'preroll' && (
              <div key={countdown} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.35)', animation: 'stCount .9s ease-out', pointerEvents: 'none' }}>
                <span style={{ fontSize: 96, fontWeight: 800, color: T.accent, fontFamily: T.fontMono, textShadow: `0 0 40px ${alpha(T.accent, '66')}` }}>{countdown}</span>
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', top: 12, left: 14, padding: '4px 10px', background: 'rgba(0,0,0,.65)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 12, color: T.text, display: 'flex', alignItems: 'center', gap: 7 }}>
            {recLive
              ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: T.danger, animation: 'stBlink 1s steps(2) infinite' }} /><span style={{ color: T.danger, fontWeight: 700 }}>REC</span></>
              : <Dot color={phase === 'preroll' ? T.accent : T.text4} size={6} />}
            <StageClock videoRef={videoRef} fps={fps} />
          </div>
          <div style={{ position: 'absolute', top: 12, right: 14, display: 'flex', gap: 6 }}>
            {prerollChip}{micChip}
          </div>
        </div>
        {stageBand}
        <div style={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', background: T.surface, borderTop: `1px solid ${T.border}` }}>
          <StageMeter analyser={analyser} recording={recLive} />
          <button data-rd onClick={recording ? stopRec : startRec}
            title={recLive ? 'Arrêter (R)' : phase === 'preroll' ? 'Annuler le pré-roll (R)' : 'Enregistrer / arrêter (R)'} style={{
              width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', flexShrink: 0, padding: 0,
              background: recording ? T.danger : T.accent, border: `3px solid ${alpha(recording ? T.danger : T.accent, '44')}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recLive ? `0 0 0 6px ${alpha(T.danger, '22')}, 0 0 24px ${alpha(T.danger, '66')}` : 'none', transition: 'box-shadow .2s',
            }}>
            {recording
              ? <span style={{ width: 14, height: 14, borderRadius: 3, background: '#0b0b0d' }} />
              : <Icon d={ICONS.mic} size={20} stroke="#0b0b0d" />}
          </button>
          <div style={{ flex: 1, minWidth: 0, fontSize: T.fs.xs, fontFamily: T.fontMono, color: T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {phase === 'idle' && (notice
              ? <span role="status" style={{ color: T.text2 }}>{notice.text}</span>
              : <>Appuyer pour enregistrer · <span style={{ color: T.accent }}>R</span></>)}
            {phase === 'preroll' && <span style={{ color: T.accent }}>Pré-roll · bip {Math.max(1, leadTotal - countdown + 1)}/{leadTotal}</span>}
            {recLive && <span style={{ color: T.danger }}>● Prise en cours · {elapsed.toFixed(1)}s{target ? ` / ${recDur.toFixed(1)}s` : ''}</span>}
          </div>
        </div>
      </div>
      {/* Right: take queue + A/B — Valider sits 12px under the last card (#5), hidden with no take (#6) */}
      <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, paddingBottom: 'var(--toast-safe-bottom, 0px)' }}>
        {takesHeader}
        <div style={{ flex: '0 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {takesList}
          </div>
          {shown.length > 0 && <div style={{ flexShrink: 0 }}>{validerBtn}</div>}
        </div>
      </div>
    </div>
  )
})

// Rolling input-level history (newest right) from the live analyser.
function useMeterLevels(analyser, bars) {
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
  return lvl
}

function MeterBars({ analyser, bars, height, live }) {
  const lvl = useMeterLevels(analyser, bars)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height }}>
      {lvl.map((v, i) => (
        <div key={i} style={{ width: 4, height: `${v * 100}%`, background: live ? (v > 0.8 ? T.danger : T.accent) : T.border3, borderRadius: 2, transition: 'height .08s' }} />
      ))}
    </div>
  )
}

// Studio control-strip meter — reference: 32 flex bars, accent with red peaks
// while recording, border3 otherwise.
function StageMeter({ analyser, recording }) {
  const lvl = useMeterLevels(analyser, 32)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, flex: 1, minWidth: 0 }}>
      {lvl.map((v, i) => (
        <div key={i} style={{ flex: 1, maxWidth: 5, height: `${v * 100}%`, background: recording ? (v > 0.86 ? T.danger : T.accent) : T.border3, borderRadius: 2, transition: 'height .08s' }} />
      ))}
    </div>
  )
}

// Image overlay timecode — follows the stage video (HH:MM:SS:FF).
function StageClock({ videoRef, fps }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = videoRef?.current
      if (v) setT(Math.max(0, v.currentTime))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [videoRef])
  return <span>{fmtSMPTE(t, fps)}</span>
}

function MicStage({ analyser, phase, countdown, elapsed, notice, onToggle, chips }) {
  const btn = 68
  const recording = phase === 'recording'
  const prerolling = phase === 'preroll'
  return (
    <div style={{
      gap: 18, padding: '44px 16px 22px',
      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.card,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      <MeterBars analyser={analyser} bars={44} height={64} live={phase !== 'idle'} />
      <button data-rd onClick={onToggle}
        title={recording ? 'Arrêter (R)' : prerolling ? 'Annuler le pré-roll (R)' : 'Enregistrer (R)'} style={{
          width: btn, height: btn, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
          background: recording ? T.danger : T.accent, border: `4px solid ${recording ? alpha(T.danger, '44') : alpha(T.accent, '44')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: recording ? `0 0 30px ${alpha(T.danger, '66')}` : `0 0 24px ${alpha(T.accent, '44')}`,
        }}>
        {prerolling
          ? <span style={{ fontSize: 30, fontWeight: 700, fontFamily: T.fontMono, color: '#0b0b0d', lineHeight: 1 }}>{countdown}</span>
          : <Icon d={recording ? ICONS.pause : ICONS.mic} size={27} stroke="#0b0b0d" fill={recording ? '#0b0b0d' : undefined} />}
      </button>
      <div style={{ fontSize: T.fs.sm, color: T.text2, fontFamily: T.fontMono }}>
        {recording
          ? <span style={{ color: T.danger, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Dot color={T.danger} pulse />ENREGISTREMENT · {fmtClock(elapsed)}</span>
          : prerolling
            ? <span style={{ color: T.accent }}>PRÉ-ROLL · réplique dans {countdown}…</span>
            : notice ? <span role="status">{notice}</span> : 'Appuyer pour enregistrer · R'}
      </div>
      {chips && (
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
          {chips}
        </div>
      )}
    </div>
  )
}

// Studio line strip (46px) — avatar, character in its track colour, the line
// in Caveat, TC in → out, previous / next réplique.
function LineStrip({ subtitles, index, fps, onSelectIndex }) {
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
    <div style={{ height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
      <Avatar name={target?.character || '?'} color={tc} size={30} ring />
      {target ? (
        <>
          <span style={{ fontSize: T.fs.sm, fontWeight: 700, color: tc, whiteSpace: 'nowrap' }}>{target.character || 'Sans personnage'}</span>
          <span title={target.note ? `${target.text} — ${target.note}` : target.text} style={{ fontSize: T.fs.md, color: T.text, fontFamily: "'Caveat', cursive", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{target.text}</span>
        </>
      ) : (
        <span style={{ fontSize: T.fs.sm, color: T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {n ? 'Choisissez une réplique — la prise y sera rattachée.' : 'Aucune réplique — la prise sera enregistrée comme prise libre.'}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {target && <span style={{ fontSize: 11, color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{fmtSMPTE(target.start, fps)} → {fmtSMPTE(target.end, fps)}</span>}
      {n > 0 && (
        <div style={{ display: 'flex', gap: 2 }}>
          <Btn size="sm" icon={ICONS.skipBack} title={!onSelectIndex ? 'Indisponible pendant l’enregistrement' : index != null && index <= 0 ? 'Déjà sur la première réplique' : 'Réplique précédente'}
            disabled={!onSelectIndex || index == null || index <= 0}
            onClick={() => onSelectIndex?.(Math.max(0, (index ?? 0) - 1))} />
          <Btn size="sm" icon={ICONS.skipFwd} title={!onSelectIndex ? 'Indisponible pendant l’enregistrement' : index != null && index >= n - 1 ? 'Déjà sur la dernière réplique' : 'Réplique suivante'}
            disabled={!onSelectIndex || (index != null && index >= n - 1)}
            onClick={() => onSelectIndex?.(index == null ? 0 : Math.min(n - 1, index + 1))} />
        </div>
      )}
    </div>
  )
}

// Mini waveform decoded from the take file (cached per url). With `progress`
// (0..1, playing; `clock` = frame time in ms): the played part fills `playedColor`, bars within ±6 % of the
// playhead bounce, and a 2px glowing playhead runs across.
function TakeWave({ url, bars = 56, height = 30, gap = 1.5, barWidth, color, progress = null, clock = 0, playedColor }) {
  const [peaks, setPeaks] = useState(null)
  useEffect(() => {
    if (!url) return
    let live = true
    takePeaks(url, bars)
      .then(p => { if (live) setPeaks(p) })
      .catch(e => console.warn('Forme d’onde indisponible', url, e))
    return () => { live = false; setPeaks(null) }
  }, [url, bars])
  const pl = progress != null
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap, height, flex: barWidth ? undefined : 1 }}>
      {Array.from({ length: bars }, (_, i) => {
        const base = peaks?.[i] ?? METER_FLOOR
        const f = i / bars
        const played = pl && f <= progress
        const near = pl && Math.abs(f - progress) < 0.06
        const h = near ? Math.min(1, base * (1.25 + 0.35 * Math.sin(clock / 70 + i))) : base
        return (
          <div key={i} style={{
            ...(barWidth ? { width: barWidth } : { flex: 1 }),
            height: `${Math.max(METER_FLOOR, h) * 100}%`, background: played ? playedColor : color, borderRadius: 1,
            transition: near ? 'none' : 'background .1s',
          }} />
        )
      })}
      {pl && <div style={{ position: 'absolute', left: `${progress * 100}%`, top: -3, bottom: -3, width: 2, background: '#fff', borderRadius: 1, boxShadow: '0 0 6px rgba(255,255,255,.6)', pointerEvents: 'none' }} />}
    </div>
  )
}

function TakeCard({ take, label, selected, fresh, isPlaying, progress, clock, isSyncing, ab, hasVideo, showAB, onSelect, onPlay, onSync, onAB, onDelete }) {
  const best = !!take.best
  const dur = take.duration || 0
  return (
    <div onClick={onSelect} style={{
      background: isSyncing ? T.accentDim : T.surface,
      border: `1px solid ${selected ? T.accent : best ? alpha(T.accent, '55') : ab ? T.border3 : isSyncing ? alpha(T.accent, '44') : T.border}`,
      borderRadius: T.r.ctl, padding: 12, flexShrink: 0, cursor: 'pointer',
      animation: fresh ? 'stIn .35s ease-out' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <button data-rd onClick={e => { e.stopPropagation(); onPlay() }} title={isPlaying ? 'Pause' : 'Écouter'} style={{
          width: 30, height: 30, borderRadius: T.r.chip, border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
          background: isPlaying ? T.accent : T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon d={isPlaying ? ICONS.pause : ICONS.play} size={13} stroke={isPlaying ? '#0b0b0d' : T.text} fill={isPlaying ? '#0b0b0d' : T.text} />
        </button>
        <span style={{ fontSize: T.fs.sm, fontWeight: 600, color: T.text, minWidth: 0, flexShrink: label.length <= 12 ? 0 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {best && <Chip color={T.accent} soft style={{ flexShrink: 0 }}><Icon d={ICONS.check} size={10} stroke={T.accent} /> validée</Chip>}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: isPlaying ? T.accent : T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>
          {isPlaying ? `${((progress || 0) * dur).toFixed(1)} / ` : ''}{dur.toFixed(1)}s
        </span>
        {hasVideo && (
          <Btn size="sm" active={isSyncing} icon={isSyncing ? ICONS.stop : ICONS.film} title="Écouter avec la vidéo" onClick={e => { e?.stopPropagation?.(); onSync() }} />
        )}
        {showAB && (
          <Btn size="sm" active={!!ab} onClick={e => { e?.stopPropagation?.(); onAB() }} title="Comparer A/B" style={{ padding: '0 8px', fontWeight: 700 }}>
            {ab || 'A/B'}
          </Btn>
        )}
        <Btn size="sm" icon={ICONS.trash} title="Supprimer" onClick={e => { e?.stopPropagation?.(); onDelete() }} />
      </div>
      <TakeWave url={take.audio_url} color={selected || best ? alpha(T.accent, '55') : T.border3} playedColor={T.accent} progress={isPlaying ? (progress || 0) : null} clock={clock} />
    </div>
  )
}

export default RecorderPanel
