import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ICONS, Btn, ScreenHeader } from '../ui'
import { useSettings } from '../SettingsContext'
import { useToast } from '../ToastContext'
import { adjacentLine } from '../utils/studio'
import RecorderPanel from './RecorderPanel'
import BandCanvas from './band/BandCanvas'
import {
  autoFitPxPerSec, bandAccent, buildCharMap, readDetection, readDetectionAuto, readWordByWord,
} from './band/bandRender'

const PREROLL_SEC = 3
const DEFAULT_PX_PER_SEC = 150
const COMPLETE_TOAST_MS = 8000

const isTyping = el => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable

// Band height by viewport height — reference Record: 110 / 140 / 170.
const bandHeightFor = h => (h < 760 ? 110 : h < 900 ? 140 : 170)

function useBandHeight() {
  const [h, setH] = useState(() => bandHeightFor(window.innerHeight))
  useEffect(() => {
    const fit = () => setH(bandHeightFor(window.innerHeight))
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return h
}

// Video time interpolated between currentTime steps (24/25 fps) so the band
// scrolls at the display rate; raw currentTime while paused / seeking.
function useVideoClock(videoRef) {
  const stateRef = useRef({ ct: 0, wall: 0 })
  return useCallback(() => {
    const v = videoRef.current
    if (!v) return null
    const now = performance.now()
    const ct = v.currentTime
    const st = stateRef.current
    if (v.paused || v.seeking || ct !== st.ct) stateRef.current = { ct, wall: now }
    if (v.paused || v.seeking) return ct
    return stateRef.current.ct + (now - stateRef.current.wall) / 1000 * (v.playbackRate || 1)
  }, [videoRef])
}

// Studio screen — port of redesign screen-record-export.jsx → Record: the
// dubbing stage (clip image + the Éditeur's bande rythmo, read-only, scrolling
// together) and the take queue, for the active clip.
// `onExportDubbed` (optional): opens the export screen on "MP4 doublé" — the
// action of the "toutes les répliques validées" toast.
export default function StudioScreen({ clip, onBack, onExportDubbed }) {
  const recorderRef = useRef(null)
  const videoRef = useRef(null)
  const subtitles = useMemo(() => clip.subtitles || [], [clip.subtitles])
  const [index, setIndex] = useState(subtitles.length ? 0 : null)
  const activeIndex = index != null && subtitles[index] ? index : (subtitles.length ? 0 : null)
  const target = activeIndex != null ? subtitles[activeIndex] : null
  const clipFps = clip.fps || 25

  const { settings } = useSettings()
  const brFont = settings.brFont || 'cursive'
  const charMap = useMemo(() => buildCharMap(subtitles), [subtitles])
  const numTracks = Math.max(1, Object.keys(charMap).length)
  const pxPerSec = useMemo(() => autoFitPxPerSec(subtitles, brFont, 1) ?? DEFAULT_PX_PER_SEC, [subtitles, brFont])
  const [bandLook] = useState(() => ({ detection: readDetection(), detectionAuto: readDetectionAuto(), wordByWord: readWordByWord() }))
  const bandH = useBandHeight()
  const getTime = useVideoClock(videoRef)

  const [waveform, setWaveform] = useState(null)
  useEffect(() => {
    let live = true
    fetch(`/api/clips/${clip.clip_id}/waveform?samples=500`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (live && data && data.samples.length) setWaveform(data) })
      .catch(e => console.error('waveform fetch failed', e)) // non-bloquant : la bande s'affiche sans onde
    return () => { live = false }
  }, [clip.clip_id])

  // Park the image (and band) 3 s before the réplique: ready for the pré-roll.
  const parkAt = target ? Math.max(0, target.start - PREROLL_SEC) : 0
  const park = useCallback(() => {
    const v = videoRef.current
    if (!v || v.readyState < 1 || recorderRef.current?.isRecording()) return
    v.pause()
    v.currentTime = parkAt
  }, [parkAt])
  useEffect(() => { park() }, [park])

  // R — start/stop a take (same path as the record button).
  // ← / → — previous / next réplique of the active character; Alt+← / Alt+→
  // any character. Ignored while a take is recording or in its pré-roll.
  // Tab — A ⇄ B (A/B mode). Échap — stop the playback.
  useEffect(() => {
    function onKey(e) {
      if (isTyping(e.target)) return
      if (e.ctrlKey || e.metaKey) return
      if (document.querySelector('[aria-modal="true"]')) return
      const rec = recorderRef.current
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (e.shiftKey) return
        e.preventDefault()   // Alt+← is the browser's "back"
        if (rec?.isRecording()) return
        const next = adjacentLine(subtitles, activeIndex, e.key === 'ArrowRight' ? 1 : -1, !e.altKey)
        if (next != null) setIndex(next)
        return
      }
      if (e.altKey) return
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        rec?.toggle()
      } else if (e.key === 'Tab' && !e.shiftKey) {
        if (rec?.swapAB()) e.preventDefault()
      } else if (e.key === 'Escape') {
        if (rec?.stopPlayback()) e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [subtitles, activeIndex])

  const toast = useToast()
  const onCharacterComplete = useCallback(character => {
    const msg = `${character || 'Sans personnage'} : toutes les répliques validées`
    let id = null
    const action = onExportDubbed
      ? { label: 'Exporter le MP4 doublé', run: () => { toast.dismiss(id); onExportDubbed() } }
      : null
    id = toast.show({ msg, kind: 'success', action, duration: COMPLETE_TOAST_MS })
  }, [toast, onExportDubbed])

  const n = subtitles.length
  const sub = [clip.name, n ? `réplique ${(activeIndex ?? 0) + 1} / ${n}` : '0 réplique'].filter(Boolean).join(' · ')
  const videoUrl = clip.has_proxy ? `/segments/${clip.clip_id}_proxy.mp4` : `/${clip.segment_path}`

  const stageImage = (
    <video ref={videoRef} src={videoUrl} preload="auto" playsInline
      onLoadedMetadata={park}
      onError={() => console.warn('Studio: vidéo du clip indisponible', videoUrl)}
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
  )

  const stageBand = (
    <div style={{ height: bandH, flexShrink: 0, position: 'relative', overflow: 'hidden', background: '#0a0a0c', borderTop: '1px solid var(--border)' }}>
      <BandCanvas
        readOnly
        getTime={getTime}
        subtitles={subtitles}
        charMap={charMap}
        numTracks={numTracks}
        pxPerSec={pxPerSec}
        brStyle={settings.brStyle || 'classique'}
        accent={bandAccent(settings.accent)}
        brFont={brFont}
        fontScale={1}
        wordByWord={bandLook.wordByWord}
        detection={bandLook.detection}
        detectionAuto={bandLook.detectionAuto}
        waveform={waveform}
        boucles={clip.boucles || []}
        sceneCuts={clip.scene_cuts || []}
        clipFps={clipFps}
        loopRegion={null}
        charFilter={null}
        focusChar={target ? (target.character || '') : null}
      />
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ScreenHeader kicker="STUDIO" title="Enregistrement" sub={sub}
        right={<Btn variant="outline" icon={ICONS.chevronL} onClick={onBack}>Retour à l'éditeur</Btn>} />
      <RecorderPanel
        ref={recorderRef}
        videoRef={videoRef}
        variant="studio"
        clipId={clip.clip_id}
        subtitles={subtitles}
        activeIndex={activeIndex}
        activeCharacter={target?.character || ''}
        fps={clipFps}
        onSelectIndex={setIndex}
        listenVoLevel={settings.listenVoLevel}
        onCharacterComplete={onCharacterComplete}
        stageImage={stageImage}
        stageBand={stageBand}
      />
    </div>
  )
}
