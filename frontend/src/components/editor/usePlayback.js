import { useState, useRef, useCallback } from 'react'
import { bandTimeOf, videoTimeOf } from '../../utils/band'
import useLatestRef from '../../hooks/useLatestRef'

// Editor video + the band time base. Band time = video time + brOffset; it is
// the one time base for réplique edits and lookups, and seeks to a band
// position convert back to video time.
// initialTime / initialBrOffset: where the clip was left (clips.ui_state, br_offset).
export default function usePlayback({ clipFps, initialTime = 0, initialBrOffset = 0 }) {
  const videoRef = useRef(null)
  // Starts at the saved playhead so a save before the restoring seek keeps it.
  const [currentTime, setCurrentTime] = useState(initialTime)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [brOffset, setBrOffset] = useState(initialBrOffset)
  const brOffsetRef = useLatestRef(brOffset)
  const clipFpsRef = useLatestRef(clipFps)
  const scrubResumeRef = useRef(false)
  // Playhead to restore once metadata loads: the saved one, then after a
  // Master/Proxy source swap.
  const resumeTimeRef = useRef(initialTime || null)
  // Smooth time interpolation: video.currentTime only updates at video fps (e.g. 24fps).
  // Between updates, we interpolate using wall clock so the canvas scrolls at 60fps.
  const interpTimeRef = useRef({ videoTime: 0, wallMs: 0, active: false })

  function getBandTime() { return bandTimeOf(videoRef.current?.currentTime, brOffsetRef.current) }
  function seekBand(t) { const v = videoRef.current; if (v) v.currentTime = videoTimeOf(t, brOffsetRef.current) }
  const bandNow = bandTimeOf(currentTime, brOffset)

  // Band time source for the BandCanvas RAF loop. Interpolates between
  // timeupdates so each 60fps canvas frame has a distinct position — prevents
  // bunched-then-jump artifacts from video.currentTime's 24fps steps. Scaled by
  // playbackRate; raw currentTime while paused/seeking.
  const getRenderTime = useCallback(() => {
    const video = videoRef.current
    if (!video) return null
    const interp = interpTimeRef.current
    const rawTime = (interp.active && !video.paused && !video.seeking)
      ? interp.videoTime + (performance.now() - interp.wallMs) / 1000 * (video.playbackRate || 1)
      : video.currentTime
    return rawTime + brOffsetRef.current
  }, [])

  function togglePlay() { const v = videoRef.current; if (v) v.paused ? v.play() : v.pause() }
  function changeSpeed(s) { const v = videoRef.current; if (v) v.playbackRate = +s; setSpeed(+s) }
  function seekVideo(t) { const v = videoRef.current; if (v) v.currentTime = t }
  function seekToEnd() { const v = videoRef.current; if (v) v.currentTime = v.duration }
  // Nav-bar scrub: pause while dragging, resume after if it was playing.
  function pauseForScrub() {
    const v = videoRef.current
    scrubResumeRef.current = !!v && !v.paused
    v?.pause()
  }
  function resumeAfterScrub() {
    if (scrubResumeRef.current) videoRef.current?.play().catch(e => console.warn('lecture refusée', e))
    scrubResumeRef.current = false
  }
  // Same step as ⇧← / ⇧→.
  function stepFrame(dir) {
    const v = videoRef.current; if (!v) return
    const step = 1 / (clipFpsRef.current || 25)
    v.currentTime = dir < 0 ? Math.max(0, v.currentTime - step) : Math.min(v.duration || v.currentTime + step, v.currentTime + step)
  }

  const videoHandlers = {
    onVideoTimeUpdate(e) {
      const ct = e.target.currentTime
      setCurrentTime(ct)
      if (!e.target.paused) interpTimeRef.current = { videoTime: ct, wallMs: performance.now(), active: true }
    },
    onVideoLoadedMetadata(e) {
      setDuration(e.target.duration)
      if (resumeTimeRef.current != null) {
        try { e.target.currentTime = resumeTimeRef.current } catch (err) { console.warn('Reprise de la position impossible', err) }
        resumeTimeRef.current = null
      }
    },
    onVideoPlay() { setPlaying(true); interpTimeRef.current = { videoTime: videoRef.current?.currentTime || 0, wallMs: performance.now(), active: true } },
    onVideoPause() { setPlaying(false); interpTimeRef.current = { ...interpTimeRef.current, active: false } },
  }

  return {
    videoRef, currentTime, duration, playing, speed, setSpeed, brOffset, setBrOffset, brOffsetRef, clipFpsRef,
    resumeTimeRef, getBandTime, seekBand, bandNow, getRenderTime,
    togglePlay, changeSpeed, seekVideo, seekToEnd, pauseForScrub, resumeAfterScrub, stepFrame, videoHandlers,
  }
}
