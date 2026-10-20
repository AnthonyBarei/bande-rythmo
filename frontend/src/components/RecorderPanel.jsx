import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { T, alpha, Icon, ICONS, Btn, Chip, Dot } from '../ui'
import { usePlayerVolume, applyPlayerVolume, holdPlayerVolume, releasePlayerVolume } from '../utils/playerVolume'
import {
  micError, stopTracks, absUrl, whenPlayable, seekMedia, takeAudio, postTake,
} from '../utils/takeRecording'
import { TakeCard, TakeWave } from './takes/TakeCard'
import { MeterBars } from './takes/Meter'

// Recorder — the editor inspector's compact stack (the Studio screen has its
// own recorder, components/studio/).
//
// Pre-roll: the mic records from the count-in, the cue media (editor video /
// audio cue) plays from réplique start − 3 s, and the captured lead-in is
// trimmed off before upload — a take always starts at its réplique start,
// which is where the dubbed mix (mix_service adelay = réplique start) and the
// "écouter avec vidéo" preview place it.

const PREROLL_SEC = 3
const PREROLL_KEY = 'br-recorder-preroll'
const NOTICE_MS = 3000
const CANCEL_NOTICE = 'Prise annulée pendant le pré-roll.'

function readPreroll() {
  try { return localStorage.getItem(PREROLL_KEY) !== '0' } catch { return true } // storage unavailable — default on
}

const RecorderPanel = forwardRef(function RecorderPanel({
  clipId, subtitles = [], activeCharacter = '', activeIndex = null, videoRef = null, cueRef = null,
}, ref) {
  const [takes, setTakes] = useState([])
  const [phase, setPhase] = useState('idle')          // idle | preroll | recording
  const [countdown, setCountdown] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)          // { text } — transient, non-error status (3 s)
  const [abOpen, setAbOpen] = useState(false)
  const [abA, setAbA] = useState(null)
  const [abB, setAbB] = useState(null)
  const [playing, setPlaying] = useState(null)
  const [playProgress, setPlayProgress] = useState({ p: 0, now: 0 })   // playing take: 0..1 + frame clock
  const [syncPlaying, setSyncPlaying] = useState(null)
  const [analyser, setAnalyser] = useState(null)
  const [preroll, setPreroll] = useState(readPreroll)
  const [selectedId, setSelectedId] = useState(null)
  const [freshId, setFreshId] = useState(null)

  const startingRef = useRef(false)
  const recRef = useRef(null)          // active take: { mr, chunks, stream, media, ... }
  const acRef = useRef(null)
  const goAtRef = useRef(0)
  const audioRef = useRef(null)
  const audio2Ref = useRef(null)       // second take player — swaps avoid a reload
  const playElRef = useRef(null)       // the <audio> currently audible
  const playTokenRef = useRef(0)
  const syncCleanupRef = useRef(null)

  // Takes follow the player volume but not its mute: M silences the VO only.
  const { volume } = usePlayerVolume()
  useEffect(() => {
    for (const el of [audioRef.current, audio2Ref.current]) applyPlayerVolume(el, { mute: false })
  }, [volume])

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
      const list = await res.json()
      setTakes(list)
      return list
    } catch (e) {
      setError('Chargement des prises impossible : ' + e.message)
      return null
    }
  }, [clipId])

  useEffect(() => { fetchTakes() }, [fetchTakes])

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
      const a = playElRef.current
      const dur = take?.duration || (Number.isFinite(a?.duration) ? a.duration : 0)
      if (a && dur > 0) setPlayProgress({ p: Math.min(1, a.currentTime / dur), now: performance.now() })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); setPlayProgress({ p: 0, now: 0 }) }
  }, [playing, takes])

  async function uploadTake(rec, stoppedAt) {
    try {
      const audio = await takeAudio(rec.chunks, rec.mr.mimeType || 'audio/webm', (rec.goAt - rec.t0) / 1000, (stoppedAt - rec.goAt) / 1000)
      const take = await postTake({ clipId, character: rec.character, subIndex: rec.subIndex, ...audio })
      setSelectedId(take.id)
      setFreshId(take.id)
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
    if (rec.media && rec.media === cueRef?.current) {
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
    setNotice(null)
    stopSync()
    stopAudio()
    const sub = activeIndex != null ? subtitles[activeIndex] : null
    const media = [videoRef?.current, cueRef?.current].find(m => m && !m.error && m.readyState >= 1) || null
    let stream = null
    let rec = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const drive = preroll && sub && media ? media : null
      const lead = !preroll ? 0 : drive ? Math.min(PREROLL_SEC, Math.max(0, sub.start)) : PREROLL_SEC
      rec = {
        mr: new MediaRecorder(stream), chunks: [], stream, sub, lead,
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
      attachMeter(stream)
      if (lead > 0) runPreroll(rec)
      else goLive(rec, rec.t0)
    } catch (e) {
      stopTracks(stream)
      if (rec?.media) rec.media.playbackRate = rec.rate
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
      stopTracks(rec.stream)
      detachMeter()
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
      stopTracks(rec.stream)
      rec.cleanupMedia?.()
      if (rec.media) { rec.media.pause(); rec.media.playbackRate = rec.rate }
    }
    syncCleanupRef.current?.()
    const ac = acRef.current
    acRef.current = null
    ac?.close().catch(e => console.warn('Fermeture AudioContext', e))
  }, [])

  const isRecording = () => startingRef.current || !!recRef.current

  // Keyboard (editor): R drives the same start/stop as the button.
  useImperativeHandle(ref, () => ({
    isRecording,
    toggle: () => {
      if (startingRef.current) return
      if (recRef.current) stopRec()
      else startRec()
    },
  }))

  // Pause every take player (card ▶, A/B).
  function stopAudio() {
    playTokenRef.current++
    for (const el of [audioRef.current, audio2Ref.current]) el?.pause()
    playElRef.current = null
    setPlaying(null)
  }

  // Play `take` on the <audio> that is not audible, then pause the other one.
  async function playTake(take) {
    stopSync()
    const token = ++playTokenRef.current
    const cur = playElRef.current
    const el = cur === audioRef.current ? audio2Ref.current : audioRef.current
    if (!el) return
    try {
      if (el.src !== absUrl(take.audio_url)) el.src = take.audio_url
      else if (el.error) el.load()
      await whenPlayable(el)
      if (token !== playTokenRef.current) return
      el.currentTime = 0
      await el.play()
    } catch (e) {
      if (token !== playTokenRef.current) { console.warn('Lecture de prise interrompue', e); return }
      setPlaying(null)
      setError('Lecture impossible : ' + e.message)
      return
    }
    if (token !== playTokenRef.current) { el.pause(); return }
    if (cur && cur !== el) cur.pause()
    playElRef.current = el
    setPlaying(take.id)
  }

  function togglePlay(take) {
    if (playing === take.id) stopAudio()
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
    stopAudio()

    holdPlayerVolume(v)
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
      releasePlayerVolume(v)
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

  function handleAudioEnded(el) {
    if (syncCleanupRef.current) {
      setPlaying(null)
      const v = videoRef?.current
      if (v && !v.paused) v.pause()
      syncCleanupRef.current?.()
      setSyncPlaying(null)
      return
    }
    if (el !== playElRef.current) return
    playElRef.current = null
    setPlaying(null)
  }

  async function removeTake(id) {
    try {
      const res = await fetch(`/api/takes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (abA === id) setAbA(null)
      if (abB === id) setAbB(null)
      if (playing === id) stopAudio()
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
    if (showAB) {
      setAbOpen(false)
      setAbA(null)
      setAbB(null)
    } else setAbOpen(true)
  }

  function takeLabel(t) {
    if (t.subtitle_index != null && subtitles[t.subtitle_index]) {
      const s = subtitles[t.subtitle_index]
      return `Réplique ${t.subtitle_index + 1}${s.character ? ' · ' + s.character : ''}`
    }
    return t.character || 'Prise libre'
  }

  const selected = useMemo(() => takes.find(t => t.id === selectedId) || null, [takes, selectedId])
  const takeA = takes.find(t => t.id === abA)
  const takeB = takes.find(t => t.id === abB)
  const showAB = abOpen || !!takeA || !!takeB
  const hasSub = activeIndex != null && subtitles[activeIndex]
  const hasVideo = !!videoRef?.current
  const recording = phase !== 'idle'

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14 }}>
      <audio ref={audioRef} onEnded={e => handleAudioEnded(e.currentTarget)} style={{ display: 'none' }} />
      <audio ref={audio2Ref} preload="auto" onEnded={e => handleAudioEnded(e.currentTarget)} style={{ display: 'none' }} />
      <MicStage analyser={analyser} phase={phase} countdown={countdown} elapsed={elapsed} notice={notice?.text}
        onToggle={recording ? stopRec : startRec}
        chips={<>{prerollChip}{hasSub && hasVideo && <Chip soft color={T.text3}><Icon d={ICONS.film} size={11} stroke={T.text3} /> réplique {activeIndex + 1}</Chip>}</>} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minHeight: 24 }}>
        <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>PRISES</span>
        <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{takes.length}</span>
        <div style={{ flex: 1 }} />
        <button data-rd onClick={toggleAB} style={{ background: 'transparent', padding: 0 }}>
          <Chip soft={!showAB} active={showAB} color={T.info}>A/B comparer</Chip>
        </button>
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
      {error && (
        <div style={{ fontSize: T.fs.micro, color: T.danger, background: alpha(T.danger, '22'), padding: '6px 8px', borderRadius: T.r.chip }}>
          {error}
        </div>
      )}
      {takes.length === 0 && (
        <div style={{ border: `2px dashed ${T.border2}`, borderRadius: T.r.ctl, padding: 18, fontSize: T.fs.xs, color: T.text3, textAlign: 'center', lineHeight: 1.5, flexShrink: 0 }}>
          Aucune prise. Appuyez sur R pour enregistrer
        </div>
      )}
      {takes.map(t => (
        <TakeCard key={t.id} take={t} label={takeLabel(t)}
          selected={selected?.id === t.id}
          fresh={freshId === t.id}
          isPlaying={playing === t.id} progress={playing === t.id ? playProgress.p : null} clock={playProgress.now}
          isSyncing={syncPlaying === t.id}
          ab={t.id === abA ? 'A' : t.id === abB ? 'B' : null}
          hasVideo={hasVideo}
          showAB
          onSelect={() => setSelectedId(t.id)}
          onPlay={() => togglePlay(t)}
          onSync={() => syncPlaying === t.id ? (stopSync(), videoRef.current?.pause()) : previewWithVideo(t)}
          onAB={() => assignAB(t.id)}
          onDelete={() => removeTake(t.id)} />
      ))}
      <Btn variant={selected && !selected.best ? 'primary' : 'outline'} full icon={ICONS.check} disabled={!selected}
        title={!selected
          ? (takes.length ? "Sélectionnez d'abord une prise" : "Enregistrez d'abord une prise (R)")
          : selected.best ? 'Cette prise est déjà validée' : 'Valider la prise sélectionnée pour cette réplique'}
        onClick={() => markBest(selected)}>
        Valider la prise sélectionnée
      </Btn>
    </div>
  )
})

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
          ? <span style={{ color: T.danger, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Dot color={T.danger} pulse />ENREGISTREMENT · {elapsed.toFixed(1)}s</span>
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

export default RecorderPanel
