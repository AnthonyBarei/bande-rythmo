import { useState, useEffect, useRef, useCallback } from 'react'
import { activeIndexAt, bandTimeOf, videoTimeOf } from '../../utils/band'
import useLatestRef from '../../hooks/useLatestRef'

// Two loops: the band loop region (⇧clic / ⇧glisser / toolbar, enforced once
// per band frame) and the transport « boucler la réplique » toggle (target
// snapshotted on toggle — DOUBLAGE_IA §3).
export default function useLoops({ videoRef, brOffsetRef, getBandTime, seekBand, subtitles, subtitlesRef, selectedIdx, selectedIdxRef, activeSubtitle }) {
  const [loopRegion, setLoopRegion] = useState(null)
  const loopRegionRef = useLatestRef(loopRegion)
  const [loopActive, setLoopActive] = useState(false)
  const loopSubRef = useRef(null)

  function toggleLoopActive() {
    if (loopActive) { setLoopActive(false); return }
    const sub = (selectedIdx != null ? subtitles[selectedIdx] : null) || activeSubtitle
    if (!sub) return
    loopSubRef.current = sub
    const t = getBandTime()
    if (t < sub.start || t > sub.end) seekBand(sub.start)
    setLoopActive(true)
  }
  useEffect(() => {
    if (!loopActive) return
    const v = videoRef.current; if (!v) return
    const check = () => {
      const s = loopSubRef.current
      if (s && getBandTime() > s.end + 0.05) seekBand(s.start)
    }
    v.addEventListener('timeupdate', check)
    return () => v.removeEventListener('timeupdate', check)
  }, [loopActive])

  // Loop region enforcement, once per band frame.
  const enforceLoopRegion = useCallback(() => {
    const lr = loopRegionRef.current
    const video = videoRef.current
    if (!lr || !video) return
    const vt = bandTimeOf(video.currentTime, brOffsetRef.current)
    if (!video.paused && (vt >= lr.end || vt < lr.start - 0.05)) {
      video.currentTime = videoTimeOf(lr.start, brOffsetRef.current)
    }
  }, [])

  // Loop a réplique and play it (⇧clic on a block, toolbar loop).
  function loopSub(sub) {
    setLoopRegion({ start: sub.start, end: sub.end })
    const v = videoRef.current
    if (v) { seekBand(sub.start); if (v.paused) v.play() }
  }

  // Band toolbar "loop" — same loop as ⇧clic on the selected/active réplique.
  function toggleLoopSelection() {
    if (loopRegionRef.current) { setLoopRegion(null); return }
    const subs = subtitlesRef.current
    const sel = selectedIdxRef.current
    const idx = sel != null && subs[sel] ? sel : activeIndexAt(subs, getBandTime())
    const sub = subs[idx]
    if (sub) loopSub(sub)
  }

  return { loopRegion, setLoopRegion, loopRegionRef, loopActive, toggleLoopActive, enforceLoopRegion, loopSub, toggleLoopSelection }
}
