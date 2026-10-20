import { useEffect, useRef, useState } from 'react'
import { usePlayerVolume, getPlayerVolume, applyPlayerVolume, holdPlayerVolume, releasePlayerVolume } from '../../utils/playerVolume'
import { absUrl, whenPlayable, seekMedia } from '../../utils/takeRecording'
import { listenVoVolume } from '../../utils/studio'

// Studio take playback: card ▶ and the A/B bar on two <audio> elements (an
// A ⇄ B switch lands on the same position), and « Écouter sur l'image » — the
// take over the image + band from réplique start, the VO at the "VO pendant
// l'écoute" level. `onContextEnd` hands the image back (Studio re-parks it).
export default function useTakePlayer({ videoRef, audioRef, audio2Ref, subtitles, listenVoLevel, onContextEnd, onError }) {
  const playElRef = useRef(null)       // the <audio> currently audible
  const tokenRef = useRef(0)
  const ctxRef = useRef(null)          // { take, sub, v, a }
  const lastSlotRef = useRef(null)
  const [playing, setPlaying] = useState(null)
  const [progress, setProgress] = useState({ p: 0, now: 0 })
  const [abSlot, setAbSlot] = useState(null)
  const [ctxId, setCtxId] = useState(null)

  // Takes follow the player volume but not its mute: M silences the VO only.
  const { volume } = usePlayerVolume()
  useEffect(() => {
    for (const el of [audioRef.current, audio2Ref.current]) applyPlayerVolume(el, { mute: false })
  }, [volume, audioRef, audio2Ref])

  useEffect(() => {
    if (playing == null) return
    let raf = 0
    const tick = () => {
      const a = playElRef.current
      const dur = Number.isFinite(a?.duration) ? a.duration : 0
      if (a && dur > 0) setProgress({ p: Math.min(1, a.currentTime / dur), now: performance.now() })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); setProgress({ p: 0, now: 0 }) }
  }, [playing])

  function stopAudio() {
    tokenRef.current++
    for (const el of [audioRef.current, audio2Ref.current]) el?.pause()
    playElRef.current = null
    setPlaying(null)
    setAbSlot(null)
  }

  function stopContext() {
    const ctx = ctxRef.current
    if (!ctx) return false
    ctxRef.current = null
    ctx.a.pause()
    ctx.v.pause()
    releasePlayerVolume(ctx.v)
    if (playElRef.current === ctx.a) playElRef.current = null
    setPlaying(null)
    setCtxId(null)
    onContextEnd?.()
    return true
  }

  function stopPlayback() {
    const ctx = stopContext()
    const audible = !!playElRef.current
    if (audible) stopAudio()
    return ctx || audible
  }

  // `preload`: the other A/B take, loaded on the idle player so Tab is instant.
  async function playFrom(take, at = 0, slot = null, preload = null) {
    stopContext()
    const token = ++tokenRef.current
    const cur = playElRef.current
    const el = cur === audioRef.current ? audio2Ref.current : audioRef.current
    if (!el) return
    try {
      if (el.src !== absUrl(take.audio_url)) el.src = take.audio_url
      else if (el.error) el.load()
      await whenPlayable(el)
      if (token !== tokenRef.current) return
      el.currentTime = Math.min(at, Number.isFinite(el.duration) ? el.duration : at)
      await el.play()
    } catch (e) {
      if (token !== tokenRef.current) { console.warn('Lecture de prise interrompue', e); return }
      setPlaying(null)
      setAbSlot(null)
      onError?.('Lecture impossible : ' + e.message)
      return
    }
    if (token !== tokenRef.current) { el.pause(); return }
    if (cur && cur !== el) cur.pause()
    playElRef.current = el
    setPlaying(take.id)
    setAbSlot(slot)
    if (slot) lastSlotRef.current = slot
    const idle = el === audioRef.current ? audio2Ref.current : audioRef.current
    if (preload && idle && idle.src !== absUrl(preload.audio_url)) { idle.src = preload.audio_url; idle.load() }
  }

  function togglePlay(take, slot = null, preload = null) {
    if (playing === take.id && !ctxRef.current) stopAudio()
    else playFrom(take, 0, slot, preload)
  }

  async function playOnImage(take) {
    const v = videoRef.current
    const a = audioRef.current
    if (!v || !a) return
    stopContext()
    stopAudio()
    const sub = take.subtitle_index != null ? subtitles[take.subtitle_index] || null : null
    const ctx = { take, sub, v, a }
    ctxRef.current = ctx
    playElRef.current = a
    setCtxId(take.id)
    setPlaying(take.id)
    try {
      v.pause()
      if (a.src !== absUrl(take.audio_url)) a.src = take.audio_url
      else if (a.error) a.load()
      await Promise.all([seekMedia(v, sub ? sub.start : 0), whenPlayable(a)])
      if (ctxRef.current !== ctx) return
      a.currentTime = 0
      const level = listenVoVolume(listenVoLevel)
      const player = getPlayerVolume()
      holdPlayerVolume(v)
      v.volume = level * player.volume
      v.muted = level === 0 || player.muted
      await v.play()
      if (ctxRef.current !== ctx) return
      await a.play()
    } catch (e) {
      if (ctxRef.current !== ctx) { console.warn('Écoute sur l’image interrompue', e); return }
      stopContext()
      onError?.('Écoute sur l’image impossible : ' + e.message)
    }
  }

  function toggleOnImage(take) {
    if (ctxId === take.id) stopContext()
    else playOnImage(take)
  }

  // Tab: switch A ⇄ B at the same position; idle, start the other slot.
  function swapAB(takeA, takeB) {
    if (!takeA || !takeB) return false
    const el = playElRef.current
    const audible = el && !el.paused && !ctxRef.current && (playing === takeA.id || playing === takeB.id)
    if (audible) {
      const toB = playing === takeA.id
      playFrom(toB ? takeB : takeA, el.currentTime, toB ? 'B' : 'A', toB ? takeA : takeB)
    } else {
      const slot = lastSlotRef.current === 'A' ? 'B' : 'A'
      playFrom(slot === 'A' ? takeA : takeB, 0, slot, slot === 'A' ? takeB : takeA)
    }
    return true
  }

  function onEnded(el) {
    if (el !== playElRef.current) return
    if (ctxRef.current) { stopContext(); return }
    playElRef.current = null
    setPlaying(null)
    setAbSlot(null)
  }

  useEffect(() => () => {
    const ctx = ctxRef.current
    ctxRef.current = null
    if (ctx) { ctx.a.pause(); ctx.v.pause(); releasePlayerVolume(ctx.v) }
  }, [])

  return {
    onEnded, playing, progress, abSlot, ctxId,
    togglePlay, toggleOnImage, swapAB, stopAudio, stopContext, stopPlayback,
    resetSlots: () => { lastSlotRef.current = null },
  }
}
