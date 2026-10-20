import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ICONS, Btn, ScreenHeader } from '../ui'
import { useSettings } from '../SettingsContext'
import { useToast } from '../ToastContext'
import { adjacentLine, characterProgress, nextOpenLine } from '../utils/studio'
import { usePlayerVolume, applyPlayerVolume, toggleMuted } from '../utils/playerVolume'
import BandCanvas from './band/BandCanvas'
import {
  autoFitPxPerSec, bandAccent, buildCharMap, readDetection, readDetectionAuto, readWordByWord,
} from './band/bandRender'
import useStudioRecorder from './studio/useStudioRecorder'
import useTakePlayer from './studio/useTakePlayer'
import StudioStage from './studio/StudioStage'
import TakesColumn from './studio/TakesColumn'
import TakeSettings from './studio/TakeSettings'

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

// Studio screen — reference screen-studio.jsx (STUDIO_V2): the dubbing stage
// (clip image + the Éditeur's bande rythmo, read-only, scrolling together)
// and the take queue of the current réplique.
// `onExportDubbed` (optional): opens the export screen on "MP4 doublé" — the
// action of the "toutes les répliques validées" toast.
export default function StudioScreen({ clip, onBack, onExportDubbed }) {
  const videoRef = useRef(null)
  const subtitles = useMemo(() => clip.subtitles || [], [clip.subtitles])
  const [index, setIndex] = useState(subtitles.length ? 0 : null)
  const activeIndex = index != null && subtitles[index] ? index : (subtitles.length ? 0 : null)
  const target = activeIndex != null ? subtitles[activeIndex] : null
  const clipFps = clip.fps || 25

  const { settings, update } = useSettings()
  const cfg = {
    count: settings.studioCount ?? 3,
    lead: settings.studioLead ?? 1,
    beeps: settings.studioBeeps !== false,
    chain: settings.studioChain || 'manuel',
  }
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

  // ── Takes of the clip
  const [takes, setTakes] = useState([])
  const [panelError, setPanelError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [freshId, setFreshId] = useState(null)
  const [flash, setFlash] = useState(null)
  const fetchTakes = useCallback(async () => {
    try {
      const res = await fetch(`/api/takes/${clip.clip_id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const list = await res.json()
      setTakes(list)
      return list
    } catch (e) {
      setPanelError('Chargement des prises impossible : ' + e.message)
      return null
    }
  }, [clip.clip_id])
  useEffect(() => { fetchTakes() }, [fetchTakes])

  const rec = useStudioRecorder({
    videoRef, clipId: clip.clip_id, sub: target, subIndex: activeIndex, fps: clipFps, cfg,
    onTakeCreated: take => { setSelectedId(take.id); setFreshId(take.id); fetchTakes() },
  })
  const audioRef = useRef(null)
  const audio2Ref = useRef(null)
  const player = useTakePlayer({
    videoRef, audioRef, audio2Ref, subtitles, listenVoLevel: settings.listenVoLevel,
    onContextEnd: rec.park, onError: setPanelError,
  })

  // ── Current réplique: its takes (newest first), selection, A/B
  const shown = useMemo(
    () => takes.filter(t => (t.subtitle_index ?? null) === (activeIndex ?? null)).reverse(),
    [takes, activeIndex])
  const labelOf = t => `Prise ${takes.filter(x => (x.subtitle_index ?? null) === (t.subtitle_index ?? null) && x.id <= t.id).length}`
  const selected = shown.find(t => t.id === selectedId) || shown[0] || null
  const [abOpen, setAbOpen] = useState(false)
  const [abA, setAbA] = useState(null)
  const [abB, setAbB] = useState(null)
  const takeA = takes.find(t => t.id === abA)
  const takeB = takes.find(t => t.id === abB)
  const canAB = shown.length >= 2
  const showAB = canAB && (abOpen || !!takeA || !!takeB)
  const locked = rec.live

  function resetAB() {
    setAbOpen(false)
    setAbA(null)
    setAbB(null)
    player.resetSlots()
  }

  // Another réplique: drop the playback, the A/B pair and the selection.
  const [shownIndex, setShownIndex] = useState(activeIndex)
  if (shownIndex !== activeIndex) {
    setShownIndex(activeIndex)
    setSelectedId(null)
    setAbOpen(false)
    setAbA(null)
    setAbB(null)
  }
  useEffect(() => () => player.stopPlayback(), [activeIndex])

  function assignAB(id) {
    setAbOpen(true)
    if (abA === id) { setAbA(null); return }
    if (abB === id) { setAbB(null); return }
    if (abA == null) setAbA(id)
    else setAbB(id)
  }

  function toggleAB() {
    if (showAB) { if (player.abSlot) player.stopAudio(); resetAB() } else setAbOpen(true)
  }

  async function removeTake(id) {
    try {
      const res = await fetch(`/api/takes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (abA === id) setAbA(null)
      if (abB === id) setAbB(null)
      if (player.ctxId === id) player.stopContext()
      if (player.playing === id) player.stopAudio()
      fetchTakes()
    } catch (e) {
      setPanelError('Suppression de la prise impossible : ' + e.message)
    }
  }

  const toast = useToast()
  const onCharacterComplete = useCallback(character => {
    const msg = `${character || 'Sans personnage'} : toutes les répliques validées`
    let id = null
    const action = onExportDubbed
      ? { label: 'Exporter le MP4 doublé', run: () => { toast.dismiss(id); onExportDubbed() } }
      : null
    id = toast.show({ msg, kind: 'success', action, duration: COMPLETE_TOAST_MS })
  }, [toast, onExportDubbed])

  // Valider: the next réplique of the role without a validated take opens in
  // prêt (Enchaînement « Auto »: its countdown starts after 3 s).
  const pendingAutoRef = useRef(false)
  async function validate(take) {
    if (!take || locked) return
    const character = target ? target.character || '' : ''
    const before = characterProgress(subtitles, takes, character)
    try {
      const res = await fetch(`/api/takes/${take.id}/best`, { method: 'PUT' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      setPanelError('Validation de la prise impossible : ' + e.message)
      return
    }
    setSelectedId(take.id)
    const list = await fetchTakes()
    if (!list) return
    const after = characterProgress(subtitles, list, character)
    if (after.total > 0 && after.done === after.total) {
      if (before.done < before.total) onCharacterComplete(character)
      setFlash(`${character || 'Sans personnage'} : toutes les répliques validées`)
      rec.redo()
      return
    }
    const next = nextOpenLine(subtitles, list, activeIndex, character)
    if (next == null || next === activeIndex) { rec.redo(); return }
    setFlash(null)
    if (cfg.chain === 'auto') pendingAutoRef.current = true
    setIndex(next)
  }
  useEffect(() => {
    if (!pendingAutoRef.current) return
    pendingAutoRef.current = false
    rec.startAuto()
  }, [activeIndex])

  function selectIndex(i) {
    if (i == null || locked) return
    setFlash(null)
    setIndex(i)
  }

  // R / mic button: prêt → décompte · revue → prêt (Refaire) · live → cancel.
  function primary() {
    if (!target) return
    if (rec.live) { rec.cancel(); return }
    if (rec.phase === 'revue') { rec.redo(); return }
    player.stopPlayback()
    setFlash(null)
    rec.start()
  }

  // Keys: R lancer / refaire · Espace attendre (auto) · Entrée valider (revue)
  // · Échap annuler / arrêter l'écoute · ← / → réplique du personnage (Alt :
  // tous) · Tab A ⇄ B · M son.
  const keysRef = useRef(null)
  useEffect(() => { keysRef.current = { primary, validate, selectIndex, selected, takeA, takeB, showAB, rec, player, activeIndex, subtitles } })
  useEffect(() => {
    function onKey(e) {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey) return
      if (document.querySelector('[aria-modal="true"]')) return
      const k = keysRef.current
      if (!k) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (e.shiftKey) return
        e.preventDefault()   // Alt+← is the browser's "back"
        if (k.rec.live) return
        k.selectIndex(adjacentLine(k.subtitles, k.activeIndex, e.key === 'ArrowRight' ? 1 : -1, !e.altKey))
        return
      }
      if (e.altKey) return
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        k.primary()
      } else if (e.key === ' ') {
        if (k.rec.phase === 'auto') { e.preventDefault(); k.rec.hold() }
      } else if (e.key === 'Enter') {
        if (k.rec.phase === 'revue' && k.selected) { e.preventDefault(); k.validate(k.selected) }
      } else if (e.key === 'Tab' && !e.shiftKey) {
        if (k.showAB && !k.rec.live && k.player.swapAB(k.takeA, k.takeB)) e.preventDefault()
      } else if (e.key === 'Escape') {
        if (k.rec.live) { e.preventDefault(); k.rec.cancel() }
        else if (k.rec.phase === 'auto') { e.preventDefault(); k.rec.hold() }
        else if (k.player.stopPlayback()) e.preventDefault()
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        toggleMuted()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const n = subtitles.length
  const sub = [clip.name, n ? `réplique ${(activeIndex ?? 0) + 1} / ${n}` : '0 réplique'].filter(Boolean).join(' · ')
  const videoUrl = clip.has_proxy ? `/segments/${clip.clip_id}_proxy.mp4` : `/${clip.segment_path}`
  const { volume, muted } = usePlayerVolume()
  useEffect(() => { applyPlayerVolume(videoRef.current) }, [volume, muted, videoUrl])

  const stageImage = (
    <video ref={videoRef} src={videoUrl} preload="auto" playsInline
      onLoadedMetadata={rec.park}
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
      <audio ref={audioRef} onEnded={e => player.onEnded(e.currentTarget)} style={{ display: 'none' }} />
      <audio ref={audio2Ref} preload="auto" onEnded={e => player.onEnded(e.currentTarget)} style={{ display: 'none' }} />
      <div style={{ flex: 1, minHeight: 0, padding: '4px 32px 24px', display: 'flex', gap: 20, overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* session bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
            <div style={{ flex: 1 }} />
            <TakeSettings cfg={cfg} onCfg={update} disabled={locked} />
          </div>
          <StudioStage
            subtitles={subtitles} takes={takes} index={activeIndex} fps={clipFps} onSelectIndex={selectIndex} charIndex={charMap}
            rec={rec} cfg={cfg} selectedLabel={selected ? labelOf(selected) : null} flash={flash}
            stageImage={stageImage} stageBand={stageBand} videoRef={videoRef} onPrimary={primary} />
        </div>
        <TakesColumn
          shown={shown} labelOf={labelOf} selected={selected} freshId={freshId} onSelect={setSelectedId}
          player={player} ab={{ takeA, takeB, showAB, canAB, abA, abB }} onAB={assignAB} onToggleAB={toggleAB}
          locked={locked} onDelete={removeTake} onValidate={validate} error={panelError} />
      </div>
    </div>
  )
}
