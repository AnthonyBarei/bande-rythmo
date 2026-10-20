import { useCallback, useEffect, useRef, useState } from 'react'
import { getPlayerVolume, holdPlayerVolume, releasePlayerVolume } from '../../utils/playerVolume'
import { micError, deviceName, stopTracks, seekMedia, takeAudio, postTake } from '../../utils/takeRecording'
import { decodeChannels, encodeWav } from '../../utils/takeAudio'
import { SLICE_POST, sliceBounds, sliceChannels } from '../../utils/continuous'
import { listenVoVolume } from '../../utils/studio'

// Studio take engine — STUDIO_V2 §3 phase model:
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
//
// « En continu » (§2): one pass through the role's range, REC throughout,
// split client-side into one take per réplique ([start − 0.25, end + 0.35],
// label « continu », `lead` = the 0.25 s margin). Espace pauses (the partial
// réplique is dropped; resuming counts down again from its start − élan),
// Échap stops; a summary follows. During the pass the other roles' VO plays
// at the « VO pendant l'écoute » level and the role's own lines are muted.

export const LIVE_PHASES = ['decompte', 'elan', 'rec', 'queue']
export const TAIL_SEC = 0.6
const AUTO_SEC = 3

export default function useStudioRecorder({
  videoRef, clipId, subtitles, sub, subIndex, fps, cfg, role, listenVoLevel, onTakeCreated,
}) {
  const [phase, setPhase] = useState('pret')
  const [countdown, setCountdown] = useState(0)     // décompte / auto, seconds left (float)
  const [mediaT, setMediaT] = useState(0)           // image time while live (élan bar, rec counter)
  const [error, setError] = useState(null)
  const [micLabel, setMicLabel] = useState('')
  const [micDenied, setMicDenied] = useState(false)
  const [analyser, setAnalyser] = useState(null)
  // En continu: { lines, captured: [i], created: [{ i, take }], saving, curI } | null
  const [session, setSession] = useState(null)

  const streamRef = useRef(null)
  const acRef = useRef(null)
  const bipRef = useRef(null)
  const runRef = useRef(null)        // the take / segment in progress
  const sessionRef = useRef(null)
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
    if (sub && !LIVE_PHASES.includes(phaseRef.current) && !sessionRef.current) freezeAt(t0Of(sub))
  }, [sub, t0Of, freezeAt])

  function publishSession(next) {
    sessionRef.current = next
    setSession(next ? { ...next } : null)
  }

  // Drop the take / segment in progress (nothing kept), sound back on.
  const abort = useCallback(() => {
    const run = runRef.current
    runRef.current = null
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

  // A new réplique (navigation, Valider) or a new élan: back to prêt. A
  // continuous session owns the image until it ends.
  useEffect(() => {
    if (sessionRef.current) return
    abort()
    setPhase('pret')
    setCountdown(0)
    if (sub) freezeAt(t0Of(sub))
  }, [subIndex, sub?.start, t0Of, abort, freezeAt])

  useEffect(() => () => abort(), [abort])

  // ── Shared: countdown on a frozen image, then the mic + playback.

  // Wall-clock countdown with the image frozen (décompte, auto).
  function countDown(run, seconds, onEnd, bips) {
    const t0 = performance.now()
    let shown = Math.ceil(seconds)
    setCountdown(seconds)
    if (bips) beep(false)
    loop(run, () => {
      if (runRef.current !== run) return false
      const left = seconds - (performance.now() - t0) / 1000
      if (left <= 0) { setCountdown(0); onEnd(); return false }
      const n = Math.ceil(left)
      if (n !== shown) { shown = n; if (bips) beep(false) }
      setCountdown(left)
      return true
    })
  }

  // Start the recorder, then the image from where it is frozen.
  async function beginRoll(run) {
    const v = videoRef.current
    let stream = streamRef.current
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
    if (runRef.current !== run) { if (run.mr.state !== 'inactive') run.mr.stop(); return false }
    run.t0 = performance.now()
    run.mr.onerror = e => {
      setError('Erreur d’enregistrement : ' + (e.error?.message || 'MediaRecorder'))
      if (runRef.current === run) (run.cont ? stopSession() : cancel())
    }
    run.shownT = v.currentTime
    setMediaT(v.currentTime)
    holdPlayerVolume(v)
    await v.play()
    return true
  }

  // rAF for the display; a timer backstop keeps the countdown, the
  // transitions and the auto-stop going in a hidden tab. `step` returns
  // false once done.
  function loop(run, step) {
    cancelAnimationFrame(run.raf)
    clearInterval(run.iv)
    let done = false
    let raf = 0
    const once = () => {
      if (done) return false
      if (step()) return true
      done = true
      cancelAnimationFrame(raf)
      clearInterval(iv)
      return false
    }
    const frame = () => { if (once()) { raf = requestAnimationFrame(frame); run.raf = raf } }
    const iv = setInterval(once, 100)
    raf = requestAnimationFrame(frame)
    run.raf = raf
    run.iv = iv
  }

  function stopRecorder(run) {
    cancelAnimationFrame(run.raf)
    clearInterval(run.iv)
    const stopped = new Promise(resolve => { run.mr.onstop = resolve })
    if (run.mr.state !== 'inactive') run.mr.stop()
    else run.mr.onstop()
    return stopped
  }

  // ── Par réplique

  async function finishTake(run) {
    const v = videoRef.current
    run.stoppedAt = performance.now()
    const stopped = stopRecorder(run)
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

  // Élan → rec → queue, on the image clock.
  function rollTake(run) {
    const v = videoRef.current
    const { start, end } = run.sub
    loop(run, () => {
      if (runRef.current !== run || run.finishing) return false
      const now = performance.now()
      const ct = v.currentTime
      // ~20 Hz is enough for the élan bar and the rec counter.
      if (Math.abs(ct - run.shownT) >= 0.05) { run.shownT = ct; setMediaT(ct) }
      if (!run.goAt && ct >= start) {
        run.goAt = now - (ct - start) * 1000
        v.muted = true
        setPhase('rec')
      }
      if (run.goAt && ct >= end && phaseRef.current === 'rec') setPhase('queue')
      if (v.ended || ct >= end + TAIL_SEC) { run.finishing = true; finishTake(run); return false }
      return true
    })
  }

  async function start() {
    if (runRef.current?.auto) abort()
    if (!sub || !videoRef.current || runRef.current || sessionRef.current) return
    if (!['pret', 'auto', 'revue'].includes(phaseRef.current)) return
    setError(null)
    const run = { sub, subIndex, character: sub.character || '', raf: 0 }
    runRef.current = run
    const v = videoRef.current
    v.pause()
    await seekMedia(v, t0Of(sub))
    if (runRef.current !== run) return
    const go = async () => {
      beep(true)
      try {
        run.goAt = 0
        setMediaT(t0Of(sub))
        setPhase(t0Of(sub) < sub.start ? 'elan' : 'rec')
        if (await beginRoll(run)) rollTake(run)
      } catch (e) {
        if (runRef.current !== run) return
        abort()
        setError(micError(e))
        setPhase('pret')
        freezeAt(t0Of(sub))
      }
    }
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
    if (!sub || runRef.current || sessionRef.current) return
    const run = { sub, subIndex, character: sub.character || '', raf: 0, auto: true }
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

  // ── En continu

  const remainingOf = s => s.lines.filter(i => !s.captured.includes(i))

  // Slice one segment's recording into takes (in the background — the
  // session goes on). Each captured line maps media time → recording time
  // with the clock reading taken when it was captured.
  function saveSegment(run, captured) {
    if (!captured.length) return
    const s = sessionRef.current
    const mime = run.mr.mimeType || 'audio/webm'
    const job = (async () => {
      const blob = new Blob(run.chunks, { type: mime })
      const { channels, sampleRate } = await decodeChannels(blob)
      const bounds = sliceBounds(captured.map(c => ({ i: c.i, start: subtitles[c.i].start, end: subtitles[c.i].end })))
      for (const b of bounds) {
        const anchor = captured.find(c => c.i === b.i).anchor
        const recAt = m => Math.max(0, (anchor.perf - (anchor.ct - m) * 1000 - run.t0) / 1000)
        const part = sliceChannels(channels, sampleRate, recAt(b.from), recAt(b.to))
        const frames = part[0]?.length || 0
        if (!frames) continue
        const take = await postTake({
          clipId, character: role, subIndex: b.i, label: 'continu', lead: b.start - b.from,
          duration: frames / sampleRate, blob: new Blob([encodeWav(part, sampleRate)], { type: 'audio/wav' }), filename: 'take.wav',
        })
        const cur = sessionRef.current
        if (cur === s) { cur.created.push({ i: b.i, take }); publishSession(cur) }
      }
    })().catch(e => setError('Découpe de la session impossible : ' + e.message))
    s.pending = (s.pending || Promise.resolve()).then(() => job)
    s.saving = (s.saving || 0) + 1
    publishSession(s)
    job.finally(() => {
      if (sessionRef.current !== s) return
      s.saving -= 1
      publishSession(s)
      onTakeCreated?.(null)
    })
  }

  // Stop the segment: keep the répliques fully passed, drop the partial one.
  async function endSegment(run) {
    const v = videoRef.current
    const stopped = stopRecorder(run)
    if (v) { v.pause(); releasePlayerVolume(v) }
    await stopped
    if (runRef.current === run) runRef.current = null
    saveSegment(run, run.captured)
  }

  function rollSegment(run) {
    const v = videoRef.current
    const s = sessionRef.current
    const level = listenVoVolume(listenVoLevel)
    const roleSpans = subtitles.filter(x => (x.character || '') === role && !x.hidden).map(x => [x.start, x.end])
    const lastEnd = subtitles[run.lines[run.lines.length - 1]].end
    loop(run, () => {
      if (runRef.current !== run || run.finishing) return false
      const now = performance.now()
      const ct = v.currentTime
      if (Math.abs(ct - run.shownT) >= 0.05) { run.shownT = ct; setMediaT(ct) }
      // The role's own lines muted, the other roles at the listening level.
      const player = getPlayerVolume()
      v.muted = player.muted || level === 0 || roleSpans.some(([a, b]) => ct >= a && ct <= b)
      v.volume = level * player.volume
      if (phaseRef.current === 'elan' && ct >= subtitles[run.lines[0]].start) setPhase('rec')
      let changed = false
      while (run.next < run.lines.length && ct >= subtitles[run.lines[run.next]].end + SLICE_POST) {
        const i = run.lines[run.next]
        run.captured.push({ i, anchor: { perf: now, ct } })
        s.captured.push(i)
        run.next++
        changed = true
      }
      const curI = run.lines[Math.min(run.next, run.lines.length - 1)]
      if (changed || s.curI !== curI) { s.curI = curI; publishSession(s) }
      if (v.ended || (run.next >= run.lines.length && ct >= lastEnd + TAIL_SEC)) {
        run.finishing = true
        endSegment(run).then(() => toSummary())
        return false
      }
      return true
    })
  }

  // Record from the first réplique not captured yet (countdown, élan, REC).
  async function segment() {
    const s = sessionRef.current
    const lines = remainingOf(s)
    if (!lines.length) { toSummary(); return }
    const first = subtitles[lines[0]]
    const run = { cont: true, lines, next: 0, captured: [], raf: 0 }
    runRef.current = run
    s.curI = lines[0]
    publishSession(s)
    const v = videoRef.current
    v.pause()
    await seekMedia(v, t0Of(first))
    if (runRef.current !== run) return
    const go = async () => {
      beep(true)
      try {
        setMediaT(t0Of(first))
        setPhase(t0Of(first) < first.start ? 'elan' : 'rec')
        if (await beginRoll(run)) rollSegment(run)
      } catch (e) {
        if (runRef.current !== run) return
        abort()
        setError(micError(e))
        toPauseOrEnd()
      }
    }
    if (cfg.count > 0) {
      setPhase('decompte')
      countDown(run, cfg.count, go, true)
    } else go()
  }

  function startSession(lines) {
    if (!lines.length || runRef.current || sessionRef.current || !videoRef.current) return
    setError(null)
    publishSession({ lines, captured: [], created: [], saving: 0, curI: lines[0] })
    segment()
  }

  // Espace during REC: stop, keep what was fully passed.
  async function pause() {
    const run = runRef.current
    if (!run?.cont || phaseRef.current !== 'rec') return
    run.finishing = true
    await endSegment(run)
    toPauseOrEnd()
  }

  function resume() {
    if (phaseRef.current !== 'pause' || runRef.current) return
    segment()
  }

  function toPauseOrEnd() {
    const s = sessionRef.current
    if (!s) return
    const rest = remainingOf(s)
    if (!rest.length) { toSummary(); return }
    s.curI = rest[0]
    publishSession(s)
    setPhase('pause')
    setCountdown(0)
    freezeAt(t0Of(subtitles[rest[0]]))
  }

  function toSummary() {
    if (!sessionRef.current) return
    setPhase('summary')
    setCountdown(0)
  }

  // Échap: during the countdown / élan drop the segment (pause if something
  // was kept), during REC or in pause end the session.
  async function stopSession() {
    const run = runRef.current
    const ph = phaseRef.current
    if (!sessionRef.current) return
    if (run?.cont && (ph === 'decompte' || ph === 'elan')) {
      abort()
      if (sessionRef.current.captured.length) toPauseOrEnd()
      else endSession()
      return
    }
    if (run?.cont && ph === 'rec') {
      run.finishing = true
      await endSegment(run)
    }
    toSummary()
  }

  // Leave the summary (or a session with nothing kept): back to prêt.
  function endSession() {
    abort()
    publishSession(null)
    setPhase('pret')
    setCountdown(0)
    if (sub) freezeAt(t0Of(sub))
  }

  return {
    phase, live, countdown, mediaT, error, setError, micLabel, micDenied, analyser, session,
    start, cancel, startAuto, hold, redo, park,
    startSession, pause, resume, stopSession, endSession,
  }
}
