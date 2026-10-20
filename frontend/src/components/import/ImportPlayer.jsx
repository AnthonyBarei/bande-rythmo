import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Dot, Icon, ICONS, T } from '../../ui'
import { fmtSMPTE } from '../../utils/timecode'
import SeekBar from './SeekBar'
import PlayerControls from './PlayerControls'
import { usePlayerVolume, applyPlayerVolume, toggleMuted } from '../../utils/playerVolume'

const isTyping = el => !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)

// Importer preview — reference screen-import.jsx Preview: video (click = play),
// seek bar, control row. Owns the <video> (+ the remuxed <audio> track) so the
// mute / speed / loop controls drive both; VideoPlayer is left untouched.
// Mount with key={src}: a new source starts from a fresh player state.
export default function ImportPlayer({ src, audioSrc, videoRef, fps, markIn, markOut, onSetIn, onSetOut, onTimeUpdate, onDuration }) {
  const audioRef = useRef(null)
  const [t, setT] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const { volume, muted } = usePlayerVolume()
  const [speed, setSpeed] = useState(1)
  const [unlocked, setUnlocked] = useState(false)
  const [looping, setLooping] = useState(false)
  const loopRef = useRef({ in: null, out: null, on: false })
  const scrubRef = useRef(false)

  const loopOn = looping && markIn != null
  useEffect(() => { loopRef.current = { in: markIn, out: markOut, on: loopOn } }, [markIn, markOut, loopOn])

  const publish = useCallback(v => {
    setT(v)
    onTimeUpdate?.(v)
  }, [onTimeUpdate])

  // Smooth clock while playing (timeupdate is ~4 Hz) + IN→OUT wrap in loop mode.
  useEffect(() => {
    if (!playing) return
    let raf
    const tick = () => {
      const v = videoRef.current
      if (v) {
        const lp = loopRef.current
        if (lp.on && lp.in != null && lp.out != null && v.currentTime >= lp.out) v.currentTime = lp.in
        publish(v.currentTime)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, publish, videoRef])

  // An external audio track keeps the video muted — otherwise both tracks play.
  useEffect(() => {
    applyPlayerVolume(videoRef.current, { mute: !!audioSrc || muted })
    applyPlayerVolume(audioRef.current)
  }, [volume, muted, audioSrc, videoRef])

  useEffect(() => {
    const v = videoRef.current
    if (v) { v.playbackRate = speed; v.defaultPlaybackRate = speed }
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed, videoRef])

  // Keep the remuxed audio track on the video's clock.
  useEffect(() => {
    const v = videoRef.current
    const a = audioRef.current
    if (!v || !a || !audioSrc) return
    const onPlay = () => { a.currentTime = v.currentTime; a.play().catch(e => console.warn('audio track play failed', e)) }
    const onPause = () => a.pause()
    const onSeeked = () => { a.currentTime = v.currentTime }
    const onRate = () => { a.playbackRate = v.playbackRate }
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('seeked', onSeeked)
    v.addEventListener('ratechange', onRate)
    a.playbackRate = v.playbackRate
    applyPlayerVolume(a)
    if (!v.paused) onPlay()
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('seeked', onSeeked)
      v.removeEventListener('ratechange', onRate)
    }
  }, [audioSrc, videoRef])

  const seek = useCallback(time => {
    const v = videoRef.current
    if (!v) return
    const d = Number.isFinite(v.duration) ? v.duration : 0
    const x = Math.max(0, Math.min(d, time))
    v.currentTime = x
    publish(x)
  }, [videoRef, publish])

  const play = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setUnlocked(true)
    v.play().catch(e => console.warn('lecture refusée', e))
  }, [videoRef])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) play()
    else v.pause()
  }, [videoRef, play])

  const toggleMute = useCallback(() => {
    setUnlocked(true)
    toggleMuted()
  }, [])

  const skip = useCallback(dt => seek((videoRef.current?.currentTime ?? 0) + dt), [seek, videoRef])
  const frame = useCallback(dir => {
    const cur = videoRef.current?.currentTime ?? 0
    seek((Math.round(cur * fps) + dir) / fps)
  }, [seek, videoRef, fps])

  const markInHere = useCallback(() => onSetIn(videoRef.current?.currentTime ?? 0), [onSetIn, videoRef])
  const markOutHere = useCallback(() => onSetOut(videoRef.current?.currentTime ?? 0), [onSetOut, videoRef])

  function toggleLoop() {
    if (markIn == null) return
    if (loopOn) { setLooping(false); return }
    setLooping(true)
    seek(markIn)
    play()
  }

  function pause() {
    videoRef.current?.pause()
  }

  // Scrub: pause while dragging, resume after if it was playing.
  function scrubStart() {
    const v = videoRef.current
    scrubRef.current = !!v && !v.paused
    v?.pause()
  }
  function scrubEnd() {
    if (scrubRef.current) play()
    scrubRef.current = false
  }

  // Keyboard — this component only exists while the Importer screen shows a source.
  const keysRef = useRef(null)
  useEffect(() => { keysRef.current = { togglePlay, skip, frame, markInHere, markOutHere, toggleMute } })
  useEffect(() => {
    function onKey(e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTyping(e.target) || document.querySelector('[aria-modal="true"]')) return
      const k = keysRef.current
      if (!k) return
      const act = {
        ' ': k.togglePlay, k: k.togglePlay, K: k.togglePlay,
        j: () => k.skip(-10), J: () => k.skip(-10),
        l: () => k.skip(10), L: () => k.skip(10),
        ',': () => k.frame(-1), '.': () => k.frame(1),
        ArrowLeft: () => k.skip(e.shiftKey ? -1 : -5), ArrowRight: () => k.skip(e.shiftKey ? 1 : 5),
        i: k.markInHere, I: k.markInHere, o: k.markOutHere, O: k.markOutHere,
        m: k.toggleMute, M: k.toggleMute,
      }[e.key]
      if (!act) return
      e.preventDefault()
      // A focused control would also react to Space on keyup.
      if (e.target instanceof HTMLButtonElement) e.target.blur()
      act()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onMeta(e) {
    const d = Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0
    e.currentTarget.playbackRate = speed
    setDuration(d)
    onDuration?.(d)
  }

  function onClock(e) {
    if (!playing) publish(e.currentTarget.currentTime)
  }

  return (
    <div style={{ flex: '1 0 auto', background: '#000', borderRadius: T.r.card, border: `1px solid ${T.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {audioSrc && <audio ref={audioRef} src={audioSrc} preload="auto" style={{ display: 'none' }} />}
      <div onClick={togglePlay} style={{ flex: 1, minHeight: 260, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
        <video ref={videoRef} src={src} preload="auto" playsInline
          onLoadedMetadata={onMeta} onDurationChange={onMeta} onTimeUpdate={onClock} onSeeked={onClock}
          onPlay={() => { setPlaying(true); setUnlocked(true) }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        {!unlocked && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.accent, color: '#0b0b0d', fontWeight: 700, fontSize: 15, padding: '12px 24px', borderRadius: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              <Icon d={ICONS.volume} size={16} stroke="#0b0b0d" /> Cliquez pour activer le son
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', top: 14, left: 16, padding: '4px 10px', background: 'rgba(0,0,0,.6)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 11, color: T.text2, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
          <Dot color={playing ? T.danger : T.accent} size={6} /> {fmtSMPTE(t, fps)} <span style={{ color: T.text4 }}>/ {fmtSMPTE(duration, fps)}</span>
        </div>
      </div>
      <SeekBar t={t} duration={duration} fps={fps} markIn={markIn} markOut={markOut}
        onScrubStart={scrubStart} onScrub={seek} onScrubEnd={scrubEnd} />
      <PlayerControls t={t} duration={duration} fps={fps} playing={playing} speed={speed} looping={loopOn}
        markIn={markIn} markOut={markOut}
        onToggle={togglePlay} onSkip={skip} onFrame={frame} onSeek={seek} onEditStart={pause}
        onIn={markInHere} onOut={markOutHere} onLoop={toggleLoop} onSpeed={setSpeed} onVolumeUse={() => setUnlocked(true)} />
    </div>
  )
}
