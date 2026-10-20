import { useCallback, useEffect, useRef, useState } from 'react'
import { holdPlayerVolume, releasePlayerVolume } from '../../utils/playerVolume'
import { micError, deviceName, stopTracks, seekMedia, takeAudio, postTake } from '../../utils/takeRecording'

// Studio take engine — STUDIO_V2 §3 phase model, one réplique per take:
//
//   prêt      image frozen at start − élan, silence
//   décompte  image still frozen; one bip per second, the last one higher
//   élan      playback from start − élan, the VO audible; the mic records
//             (this lead is trimmed off the take)
//   rec       the réplique; the VO is muted so it does not bleed into the mic
//   queue     plays to end + 0.6 s, then stops
//   revue     image frozen on the réplique's last frame, the take is added
//   auto      after Valider with Enchaînement « Auto »: 3 s before décompte
//
// Échap (cancel) during décompte / élan / rec / queue drops the take and goes
// back to prêt at the same frame. A take always starts at its réplique start,
// where the dubbed mix and the listening place it.

export const LIVE_PHASES = ['decompte', 'elan', 'rec', 'queue']
export const TAIL_SEC = 0.6
const AUTO_SEC = 3

export default function useStudioRecorder({ videoRef, clipId, sub, subIndex, fps, cfg, onTakeCreated }) {
  const [phase, setPhase] = useState('pret')
  const [countdown, setCountdown] = useState(0)     // décompte / auto, seconds left (float)
  const [mediaT, setMediaT] = useState(0)           // image time while live (élan bar, rec counter)
  const [error, setError] = useState(null)
  const [micLabel, setMicLabel] = useState('')
  const [micDenied, setMicDenied] = useState(false)
  const [analyser, setAnalyser] = useState(null)

  const streamRef = useRef(null)
  const acRef = useRef(null)
  const bipRef = useRef(null)
  const runRef = useRef(null)        // { token, sub, subIndex, character, raf, mr?, chunks, t0, goAt }
  const tokenRef = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const live = LIVE_PHASES.includes(phase)

  const t0Of = useCallback(s => Math.max(0, s.start - (cfg.lead || 0)), [cfg.lead])

  // Mic held open while the Studio is mounted: live meter, device name, and
  // no getUserMedia latency when a take starts.
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) { setError('Micro indisponible dans ce navigateur.'); return }
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        if (cancelled) { stopTracks(stream); return }
        streamRef.current = stream
        const track = stream.getAudioTracks()[0]
        setMicLabel(deviceName(track?.label))
        setMicDenied(false)
        if (track) track.onended = () => { setError('Micro déconnecté — rebranchez-le puis rouvrez le Studio.'); setAnalyser(null) }
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
        }
      })
      .catch(e => {
        if (cancelled) return
        setMicDenied(true)
        setError(micError(e))
      })
    return () => {
      cancelled = true
      stopTracks(streamRef.current)
      streamRef.current = null
      for (const ref of [acRef, bipRef]) {
        const ac = ref.current
        ref.current = null
        ac?.close().catch(e => console.warn('Fermeture AudioContext', e))
      }
    }
  }, [])

  function beep(high) {
    if (!cfg.beeps) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      const ac = bipRef.current || (bipRef.current = new AC())
      ac.resume().catch(e => console.warn('Bip : AudioContext resume', e))
      const t = ac.currentTime
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.frequency.value = high ? 1320 : 880
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      osc.connect(gain).connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.13)
    } catch (e) {
      console.warn('Bip indisponible', e)
    }
  }

  // Freeze the image (and the band) at `t`.
  const freezeAt = useCallback(t => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    if (v.readyState >= 1 && Math.abs(v.currentTime - t) > 0.005) v.currentTime = t
  }, [videoRef])

  // prêt: image at start − élan, silence.
  const park = useCallback(() => {
    if (sub && !LIVE_PHASES.includes(phaseRef.current)) freezeAt(t0Of(sub))
  }, [sub, t0Of, freezeAt])

  // Drop the run in progress (no take) and give the image its sound back.
  const abort = useCallback(() => {
    const run = runRef.current
    runRef.current = null
    tokenRef.current++
    if (!run) return
    cancelAnimationFrame(run.raf)
    clearInterval(run.iv)
    if (run.mr) {
      run.mr.ondataavailable = null
      run.mr.onstop = null
      if (run.mr.state !== 'inactive') run.mr.stop()
    }
    releasePlayerVolume(videoRef.current)
  }, [videoRef])

  // A new réplique (navigation, Valider) or a new élan: back to prêt.
  useEffect(() => {
    abort()
    setPhase('pret')
    setCountdown(0)
    if (sub) freezeAt(t0Of(sub))
  }, [subIndex, sub?.start, t0Of, abort, freezeAt])

  useEffect(() => () => abort(), [abort])

  async function finish(run) {
    const v = videoRef.current
    run.stoppedAt = performance.now()
    cancelAnimationFrame(run.raf)
    clearInterval(run.iv)
    const stopped = new Promise(resolve => { run.mr.onstop = resolve })
    if (run.mr.state !== 'inactive') run.mr.stop()
    else run.mr.onstop()
    if (v) {
      v.pause()
      releasePlayerVolume(v)
      // revue: frozen on the réplique's last frame.
      v.currentTime = Math.max(run.sub.start, run.sub.end - 1 / (fps || 25))
    }
    await stopped
    if (runRef.current !== run) return
    try {
      const audio = await takeAudio(run.chunks, run.mr.mimeType || 'audio/webm', (run.goAt - run.t0) / 1000, (run.stoppedAt - run.goAt) / 1000)
      const take = await postTake({ clipId, character: run.character, subIndex: run.subIndex, ...audio })
      if (runRef.current !== run) return
      runRef.current = null
      setPhase('revue')
      onTakeCreated?.(take)
    } catch (e) {
      if (runRef.current !== run) return
      runRef.current = null
      setError('Échec de l’enregistrement : ' + e.message)
      setPhase('pret')
      freezeAt(t0Of(run.sub))
    }
  }

  // Élan → rec → queue, on the image clock. rAF for the display; a timer
  // backstop keeps the transitions and the auto-stop going in a hidden tab.
  function roll(run) {
    const v = videoRef.current
    const { start, end } = run.sub
    const step = () => {
      if (runRef.current !== run || run.finishing) return false
      const now = performance.now()
      const ct = v.currentTime
      // ~20 Hz is enough for the élan bar and the rec counter.
      if (Math.abs(ct - run.shownT) >= 0.05) { run.shownT = ct; setMediaT(ct) }
      if (!run.goAt && ct >= start) {
        run.goAt = now - (ct - start) * 1000
        holdPlayerVolume(v)
        v.muted = true
        setPhase('rec')
      }
      if (run.goAt && ct >= end && phaseRef.current === 'rec') setPhase('queue')
      if (v.ended || ct >= end + TAIL_SEC) { run.finishing = true; finish(run); return false }
      return true
    }
    const frame = () => { if (step()) run.raf = requestAnimationFrame(frame) }
    run.raf = requestAnimationFrame(frame)
    run.iv = setInterval(step, 100)
  }

  async function beginRoll(run) {
    const v = videoRef.current
    let stream = streamRef.current
    try {
      if (!stream?.active) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
      }
      run.chunks = []
      run.mr = new MediaRecorder(stream)
      run.mr.ondataavailable = e => { if (e.data.size) run.chunks.push(e.data) }
      await new Promise((resolve, reject) => {
        run.mr.onstart = resolve
        run.mr.onerror = e => reject(e.error || new Error('MediaRecorder'))
        run.mr.start()
      })
      if (runRef.current !== run) { if (run.mr.state !== 'inactive') run.mr.stop(); return }
      run.t0 = performance.now()
      run.mr.onerror = e => {
        setError('Erreur d’enregistrement : ' + (e.error?.message || 'MediaRecorder'))
        if (runRef.current === run) cancel()
      }
      run.goAt = 0
      run.shownT = v.currentTime
      setMediaT(v.currentTime)
      setPhase(t0Of(run.sub) < run.sub.start ? 'elan' : 'rec')
      await v.play()
      roll(run)
    } catch (e) {
      if (runRef.current !== run) return
      abort()
      setError(micError(e))
      setPhase('pret')
      freezeAt(t0Of(run.sub))
    }
  }

  // Wall-clock countdown with the image frozen (décompte, auto).
  function countDown(run, seconds, onEnd, bips) {
    const t0 = performance.now()
    let shown = Math.ceil(seconds)
    setCountdown(seconds)
    if (bips) beep(false)
    const tick = () => {
      if (runRef.current !== run) return
      const left = seconds - (performance.now() - t0) / 1000
      if (left <= 0) { setCountdown(0); onEnd(); return }
      const n = Math.ceil(left)
      if (n !== shown) { shown = n; if (bips) beep(false) }
      setCountdown(left)
      run.raf = requestAnimationFrame(tick)
    }
    run.raf = requestAnimationFrame(tick)
  }

  async function start() {
    if (runRef.current?.auto) abort()
    if (!sub || !videoRef.current || runRef.current) return
    if (!['pret', 'auto', 'revue'].includes(phaseRef.current)) return
    setError(null)
    const run = { token: ++tokenRef.current, sub, subIndex, character: sub.character || '', raf: 0 }
    runRef.current = run
    const v = videoRef.current
    v.pause()
    await seekMedia(v, t0Of(sub))
    if (runRef.current !== run) return
    const go = () => { beep(true); beginRoll(run) }
    if (cfg.count > 0) {
      setPhase('decompte')
      countDown(run, cfg.count, go, true)
    } else go()
  }

  function cancel() {
    if (!runRef.current) return
    abort()
    setPhase('pret')
    setCountdown(0)
    if (sub) freezeAt(t0Of(sub))
  }

  // Enchaînement « Auto »: the next réplique starts by itself after 3 s.
  function startAuto() {
    if (!sub || runRef.current) return
    const run = { token: ++tokenRef.current, sub, subIndex, character: sub.character || '', raf: 0, auto: true }
    runRef.current = run
    setPhase('auto')
    countDown(run, AUTO_SEC, () => { runRef.current = null; setPhase('pret'); start() }, false)
  }

  // Espace during auto: stay in prêt.
  function hold() {
    if (phaseRef.current !== 'auto') return
    abort()
    setPhase('pret')
    setCountdown(0)
  }

  // revue → prêt (Refaire): nothing plays until R.
  function redo() {
    if (phaseRef.current !== 'revue') return
    setPhase('pret')
    if (sub) freezeAt(t0Of(sub))
  }

  return {
    phase, live, countdown, mediaT, error, setError, micLabel, micDenied, analyser,
    start, cancel, startAuto, hold, redo, park,
  }
}
