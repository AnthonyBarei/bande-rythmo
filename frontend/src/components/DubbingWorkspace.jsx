import React, { useState, useEffect, useRef, useMemo } from 'react'
import ExportPanel from './ExportPanel'
import { useExportScreen } from './exportScreen'
import EditorHeader from './editor/EditorHeader'
import VideoStage from './editor/VideoStage'
import Inspector from './editor/Inspector'
import BandToolbar from './editor/BandToolbar'
import Transport from './editor/Transport'
import TimelineNav from './editor/TimelineNav'
import BandOverlays from './editor/BandOverlays'
import CanvasCoachmark from './editor/CanvasCoachmark'
import ExportModal from './editor/ExportModal'
import useEditorLayout, { BAND_DEFAULT, INSP_DEFAULT, INSP_MIN, INSP_MAX } from './editor/useEditorLayout'
import usePlayback from './editor/usePlayback'
import useLoops from './editor/useLoops'
import useBoucles from './editor/useBoucles'
import useBandPrefs from './editor/useBandPrefs'
import useBandInteraction from './editor/useBandInteraction'
import useClipTools from './editor/useClipTools'
import useEditorKeys from './editor/useEditorKeys'
import useUploadedFonts from './editor/useUploadedFonts'
import { useSceneCuts, useProxy, useWaveform } from './editor/useClipMedia'
import { T, Icon, ICONS, Splitter } from '../ui'
import { useSettings } from '../SettingsContext'
import { useProgress } from '../ProgressContext'
import { useToast } from '../ToastContext'
import { useAuth } from '../AuthContext'
import useSubtitleManager from '../hooks/useSubtitleManager'
import { isActiveAt, activeIndexAt } from '../utils/band'
import { usePlayerVolume, applyPlayerVolume } from '../utils/playerVolume'
import { readComediens, writeComediens, withComedienDefault } from '../utils/studioPrefs'
import { handOffSelection, putBrOffset } from '../utils/clipState'
import useClipUiState from '../hooks/useClipUiState'
import { nextOpenLine } from '../utils/studio'
import BandCanvas from './band/BandCanvas'
import { CURSOR_X_RATIO, bandAccent, bandCanvasHeight, buildCharMap, autoFitPxPerSec } from './band/bandRender'
import useLatestRef from '../hooks/useLatestRef'

const CANVAS_HINT = 'glisser pour créer · ⇧ glisser : boucle · double-clic : éditer · clic droit : menu'

// BR editor — orchestrates the editor hooks (editor/use*) and lays out header,
// video, transport, nav bar, band toolbar, band and inspector.
export default function DubbingWorkspace({ clip, onUpdate, onLocalState, onBack, onSaveStatus, exportOpen, onToggleExport, onRecord, onHelp }) {
  // Where this clip was left (clips.ui_state, P4): playhead, zoom, tab, selection.
  const [saved] = useState(() => clip.ui_state || {})
  // Subtitle state machine (array, selection, undo/redo, debounced autosave).
  const {
    subtitles, selectedIdx, setSelectedIdx, saveStatus,
    changeSubtitles, setSubtitlesTransient, commitDrag, finishDrag, saveNow,
    undo, redo, canUndo, canRedo,
  } = useSubtitleManager({ clipId: clip.clip_id, initialSubtitles: clip.subtitles || [], initialSelectedIdx: saved.selected, onSaved: onUpdate })
  const subtitlesRef = useLatestRef(subtitles)
  const selectedIdxRef = useLatestRef(selectedIdx)
  // Last non-null selection (the inspector falls back to it).
  const [lastSelectedIdx, setLastSelectedIdx] = useState(selectedIdx)
  if (selectedIdx != null && selectedIdx !== lastSelectedIdx) setLastSelectedIdx(selectedIdx)

  const clipFps = clip.fps || 25
  const showExport = !!exportOpen
  // App's Export screen hosts the panel (portaled slot) — no modal chrome then.
  const exportHost = useExportScreen()
  const { settings, update: updateSettings } = useSettings()
  const progress = useProgress()
  const toast = useToast()
  // Band style + font live in Préférences (one source of truth): the editor
  // picker writes the same settings, and the export receives what is shown.
  const rythmoStyle = settings.brStyle || 'classique'
  const setRythmoStyle = style => updateSettings({ brStyle: style })
  const brFont = settings.brFont || 'cursive'
  const setBrFont = font => updateSettings({ brFont: font })
  const [lang, setLang] = useState(settings.whisperLang || 'fr')
  const [brInPlayer, setBrInPlayer] = useState('play')
  const [fontScale, setFontScale] = useState(1.0)
  const [locked, setLocked] = useState(false)
  const lockedRef = useLatestRef(locked)
  // DOUBLAGE_IA_REVIEW §7 — default 150 px/s (comfortable reading cadence at
  // normal speech). pxPerSec is also re-measured per clip in the auto-fit block.
  const [pxPerSec, setPxPerSec] = useState(saved.pxPerSec ?? 150)
  // A zoom the user chose is kept per clip; the auto-fit one is not.
  const zoomChosenRef = useRef(saved.pxPerSec != null)
  const setZoom = v => { zoomChosenRef.current = true; setPxPerSec(v) }
  const pxPerSecRef = useLatestRef(pxPerSec)
  const [rightTab, setRightTab] = useState(saved.rightTab || 'repliques')
  const [takes, setTakes] = useState([])
  const [comediens, setComediens] = useState({})
  // DOUBLAGE_IA_REVIEW §6.2 — header character pills FILTER the band.
  // Empty set = no filter (show all). Multi-select toggle: click adds/removes.
  const [charFilter, setCharFilter] = useState(() => new Set())
  const canvasRef = useRef(null)
  const onsetsRef = useRef(null)

  const { colRef, bandH, setBandH, clampBand, inspW, setInspW, inspOpen, setInspOpen } = useEditorLayout()
  const play = usePlayback({ clipFps, initialTime: saved.playhead || 0, initialBrOffset: clip.br_offset || 0 })
  const { videoRef, getBandTime, seekBand, bandNow } = play
  const prefs = useBandPrefs()
  const detectionRef = useLatestRef(prefs.detection)
  const boucles = useBoucles({ clip, onUpdate, toast, getBandTime, videoRef })
  const scenes = useSceneCuts({ clip, toast })
  const proxy = useProxy({ clip, progress, toast, videoRef, resumeTimeRef: play.resumeTimeRef })
  const waveformData = useWaveform(clip.clip_id, onsetsRef)
  const fonts = useUploadedFonts({ toast, brFont, setBrFont })
  const tools = useClipTools({ clip, lang, subtitlesRef, changeSubtitles, progress, toast })
  const { volume, muted } = usePlayerVolume()
  useEffect(() => { applyPlayerVolume(videoRef.current) }, [volume, muted, proxy.segmentUrl])

  const charMap = useMemo(() => buildCharMap(subtitles), [subtitles])
  const numTracks = Math.max(1, Object.keys(charMap).length)
  const canvasH = bandCanvasHeight(numTracks)
  const charList = useMemo(() => Object.keys(charMap), [charMap])
  const charMapRef = useLatestRef(charMap)
  const numTracksRef = useLatestRef(numTracks)
  const { user: account } = useAuth()
  const shownComediens = useMemo(() => withComedienDefault(comediens, charList, account ? (account.comedien || account.name) : ''),
    [comediens, charList, account])

  const activeSubtitle = useMemo(
    () => subtitles.find(s => isActiveAt(s, bandNow)) || null,
    [subtitles, bandNow])

  const loops = useLoops({
    videoRef, brOffsetRef: play.brOffsetRef, getBandTime, seekBand,
    subtitles, subtitlesRef, selectedIdx, selectedIdxRef, activeSubtitle,
  })

  const band = useBandInteraction({
    canvasRef, videoRef, subtitlesRef, charMapRef, numTracksRef, pxPerSecRef, setPxPerSec: setZoom,
    detectionRef, wordByWord: prefs.wordByWord, onsetsRef, lockedRef, charList,
    getBandTime, seekBand, setLoopRegion: loops.setLoopRegion, loopRegionRef: loops.loopRegionRef, loopSub: loops.loopSub,
    changeSubtitles, setSubtitlesTransient, dragCommit: commitDrag, finishDrag, deleteReplica: deleteReplicaWithUndo,
  })

  // Load comédien names (per-clip, local — shared with the Studio)
  useEffect(() => { setComediens(readComediens(clip.clip_id)) }, [clip.clip_id])
  function setComedien(char, name) {
    setComediens(prev => {
      const next = { ...prev, [char]: name }
      writeComediens(clip.clip_id, next)
      return next
    })
  }

  // Working state saved per clip: playhead, chosen zoom, inspector tab, selection.
  const saveUi = useClipUiState(clip.clip_id, (id, patch) => onLocalState?.(id, { ui_state: patch }))
  const playheadKey = Math.round(play.currentTime * 10)
  const lastUiRef = useRef(null)
  useEffect(() => {
    const next = {
      playhead: playheadKey / 10, rightTab, selected: selectedIdx,
      pxPerSec: zoomChosenRef.current ? pxPerSec : null,
    }
    const key = JSON.stringify(next)
    if (lastUiRef.current == null) { lastUiRef.current = key; return }   // as restored
    if (key === lastUiRef.current) return
    lastUiRef.current = key
    saveUi(next)
  }, [playheadKey, pxPerSec, rightTab, selectedIdx, saveUi])

  // BR sync correction — clip data (Q4), saved like the répliques.
  const brOffsetTimer = useRef(null)
  const brOffsetSaved = useRef(play.brOffset)
  useEffect(() => {
    if (play.brOffset === brOffsetSaved.current) return
    clearTimeout(brOffsetTimer.current)
    const value = play.brOffset
    brOffsetTimer.current = setTimeout(() => {
      brOffsetSaved.current = value
      onLocalState?.(clip.clip_id, { br_offset: value })
      putBrOffset(clip.clip_id, value).catch(e => toast.error('Décalage BR non enregistré : ' + e.message))
    }, 800)
    return () => clearTimeout(brOffsetTimer.current)
  }, [play.brOffset, clip.clip_id])

  // Fetch takes (refreshed when the right pane tab changes)
  useEffect(() => {
    fetch(`/api/takes/${clip.clip_id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => Array.isArray(data) && setTakes(data))
      .catch(() => {})
  }, [clip.clip_id, rightTab])

  // Report save status up to the App top bar
  useEffect(() => { onSaveStatus?.(saveStatus) }, [saveStatus, onSaveStatus])

  // Auto-fit scroll rate, once per clip: pick pxPerSec so the densest réplique
  // sits near its natural width and lighter ones stretch out — the airy
  // VoxDub-style layout, without the user having to touch the zoom.
  const autoFitRef = useRef(saved.pxPerSec != null ? clip.clip_id : null)
  useEffect(() => {
    if (!subtitles.length || autoFitRef.current === clip.clip_id) return
    autoFitRef.current = clip.clip_id
    const fit = autoFitPxPerSec(subtitles, brFont, fontScale)
    if (fit != null) setPxPerSec(fit)
  }, [clip.clip_id, subtitles])

  // Escape closes the export modal
  useEffect(() => {
    if (!showExport) return
    const onKey = e => { if (e.key === 'Escape') onToggleExport?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showExport, onToggleExport])

  // ── Réplique actions ──
  const sortedWith = (subs, sub) => [...subs, sub].sort((a, b) => a.start - b.start)
  function addSubAt(t, character = '') {
    changeSubtitles(sortedWith(subtitlesRef.current, { start: t, end: t + 1.5, character, text: '', reactions: [] }))
  }

  // Réplique delete via undo toast — 5s window to recover before auto-save commits.
  function deleteReplicaWithUndo(idx) {
    const subs = subtitlesRef.current
    const removed = subs[idx]
    if (!removed) return
    changeSubtitles(subs.filter((_, i) => i !== idx))
    if (selectedIdx === idx) setSelectedIdx(null)
    toast.undo({
      msg: removed.text
        ? `Réplique « ${removed.text.slice(0, 32)}${removed.text.length > 32 ? '…' : ''} » supprimée`
        : 'Réplique supprimée',
      // Re-insert at original position (sort will place by start).
      onUndo: () => changeSubtitles([...subtitlesRef.current, removed]),
    })
  }

  function addCharacter() {
    const name = window.prompt('Nom du nouveau personnage :')
    if (name == null || !name.trim()) return
    addSubAt(getBandTime(), name.trim())
  }

  // The selected réplique, else the one under the playhead.
  function targetIdx() {
    const subs = subtitlesRef.current
    const sel = selectedIdxRef.current
    return sel != null && subs[sel] ? sel : activeIndexAt(subs, getBandTime())
  }

  // Transport IN / OUT — bound of the selected (else active) réplique at the band time.
  function setTargetBound(edge) {
    const subs = subtitlesRef.current
    const idx = targetIdx()
    const sub = subs[idx]
    if (!sub) return
    const t = getBandTime()
    const patch = edge === 'in' ? { start: Math.min(t, sub.end - 0.1) } : { end: Math.max(t, sub.start + 0.1) }
    changeSubtitles(subs.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function gotoPrevSub() {
    if (!videoRef.current) return
    const t = getBandTime()
    const subs = subtitlesRef.current
    const i = subs.findIndex(s => s.start > t - 0.01)
    const ti = i < 0 ? subs.length - 1 : Math.max(0, i - 1)
    if (subs[ti]) { seekBand(subs[ti].start); setSelectedIdx(ti) }
  }
  function gotoNextSub() {
    if (!videoRef.current) return
    const t = getBandTime()
    const subs = subtitlesRef.current
    const i = subs.findIndex(s => s.start > t + 0.01)
    if (i >= 0) { seekBand(subs[i].start); setSelectedIdx(i) }
  }

  // Recording happens in the Studio: save pending edits, hand it the réplique
  // to open on (its role follows), then switch screens.
  function openStudio(idx) {
    saveNow()
    handOffSelection(clip.clip_id, idx)
    onRecord?.()
  }
  // R / inspector ● — the selected réplique, else the one under the playhead.
  function recordInStudio() { openStudio(targetIdx()) }
  // Voix ● — the role's first réplique without a validated take.
  function recordRoleInStudio(character) {
    const subs = subtitlesRef.current
    let first = null
    subs.forEach((s, i) => { if ((s.character || '') === character && (first == null || s.start < subs[first].start)) first = i })
    openStudio(nextOpenLine(subs, takes, null, character) ?? first)
  }

  // Shortcuts overlay lives in App: use its handler when given, else its "?" key.
  function openHelp() {
    if (onHelp) { onHelp(); return }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))
  }

  useEditorKeys({
    exportOpen: showExport, videoRef, subtitlesRef, getBandTime, seekBand, clipFps,
    undo, redo, saveNow, toggleInspector: () => setInspOpen(o => !o),
    deleteReplica: deleteReplicaWithUndo, addSubAt, startEdit: band.startEdit,
    loopRegionRef: loops.loopRegionRef, setLoopRegion: loops.setLoopRegion, setSpeed: play.setSpeed,
    changeSubtitles, recordInStudio, toggleExport: onToggleExport,
  })

  // Inspector header réplique: under the playhead → last selected → first.
  const inspectorTarget = activeSubtitle
    || (lastSelectedIdx != null ? subtitles[lastSelectedIdx] : null)
    || subtitles[0] || null
  const inspectorIdx = inspectorTarget ? subtitles.indexOf(inspectorTarget) : -1
  function setTargetCharacter(char) {
    if (inspectorIdx < 0) return
    changeSubtitles(subtitles.map((s, i) => i === inspectorIdx ? { ...s, character: char } : s))
  }
  function newTargetCharacter() {
    if (inspectorIdx < 0) return
    const name = window.prompt('Nom du nouveau personnage :')
    if (name && name.trim()) setTargetCharacter(name.trim())
  }
  const viewSpan = ((canvasRef.current?.offsetWidth || 800) / (pxPerSec || 1))
  const viewStart = bandNow - CURSOR_X_RATIO * viewSpan

  const exportPanel = (
    <ExportPanel
      segmentId={clip.clip_id}
      subtitles={subtitles}
      boucles={boucles.boucles}
      pxPerSec={pxPerSec}
      brOffset={play.brOffset}
      canvasH={canvasH}
      getCanvasWidth={() => canvasRef.current?.offsetWidth || 1200}
      brFont={brFont}
      brStyle={rythmoStyle}
      duration={play.duration}
      getCurrentTime={() => videoRef.current?.currentTime || 0}
      loopRegion={loops.loopRegion}
      clipFps={clipFps}
    />
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>

      <EditorHeader
        clip={clip}
        subtitleCount={subtitles.length}
        clipFps={clipFps}
        charList={charList}
        charMap={charMap}
        charFilter={charFilter}
        onToggleCharFilter={char => setCharFilter(prev => {
          const next = new Set(prev)
          if (next.has(char)) next.delete(char); else next.add(char)
          return next
        })}
        onClearCharFilter={() => setCharFilter(new Set())}
        lang={lang}
        setLang={setLang}
        transcribing={tools.transcribing}
        onTranscribe={tools.transcribe}
        importing={tools.importing}
        onImportFile={tools.importSubtitlesFile}
        translateProvider={tools.translateProvider}
        translateTarget={tools.translateTarget}
        setTranslateTarget={tools.setTranslateTarget}
        translating={tools.translating}
        onTranslate={tools.translateAll}
        vocalAvailable={tools.vocalAvailable}
        separatingVocals={tools.separatingVocals}
        onSeparateVocals={tools.separateVocals}
        saveStatus={saveStatus}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onBack={onBack}
        onToggleExport={onToggleExport}
        onHelp={openHelp}
        inspOpen={inspOpen}
        onToggleInspector={() => setInspOpen(o => !o)}
      />

      {/* ── Main: left column (video · transport · nav · toolbar · band) + inspector ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div ref={colRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          <VideoStage
            videoRef={videoRef}
            segmentUrl={proxy.segmentUrl}
            {...play.videoHandlers}
            currentTime={play.currentTime}
            duration={play.duration}
            clipFps={clipFps}
            playing={play.playing}
            brInPlayer={brInPlayer}
            activeSubtitle={activeSubtitle}
            charMap={charMap}
            onTogglePlay={play.togglePlay}
            hasProxy={proxy.hasProxy}
            useProxy={proxy.useProxy}
            onToggleProxy={proxy.toggleProxy}
            onGenerateProxy={proxy.generateProxy}
            proxyJob={proxy.proxyJob}
          />

          <Transport
            currentTime={play.currentTime}
            duration={play.duration}
            playing={play.playing}
            speed={play.speed}
            onTogglePlay={play.togglePlay}
            onSeek={play.seekVideo}
            onSeekEnd={play.seekToEnd}
            onStepFrame={play.stepFrame}
            onPrevSub={gotoPrevSub}
            onNextSub={gotoNextSub}
            loopActive={loops.loopActive}
            onToggleLoopActive={loops.toggleLoopActive}
            onChangeSpeed={play.changeSpeed}
            hasTarget={selectedIdx != null || !!activeSubtitle}
            clipFps={clipFps}
            onSetIn={() => setTargetBound('in')}
            onSetOut={() => setTargetBound('out')}
          />

          <TimelineNav
            bandNow={bandNow}
            clipFps={clipFps}
            boucles={boucles.boucles}
            loopRegion={loops.loopRegion}
            duration={play.duration}
            waveform={waveformData}
            sceneCuts={scenes.sceneCuts}
            subtitles={subtitles}
            charMap={charMap}
            viewStart={viewStart}
            viewEnd={viewStart + viewSpan}
            pxPerSec={pxPerSec}
            onSeek={seekBand}
            onZoom={setZoom}
            onScrubStart={play.pauseForScrub}
            onScrubEnd={play.resumeAfterScrub}
          />

          <BandToolbar
            subtitles={subtitles}
            onSubtitlesChange={changeSubtitles}
            selectedIdx={selectedIdx}
            setSelectedIdx={setSelectedIdx}
            getBandTime={getBandTime}
            onAddSub={() => addSubAt(getBandTime())}
            loopRegion={loops.loopRegion}
            onToggleLoopSelection={loops.toggleLoopSelection}
            pxPerSec={pxPerSec}
            setPxPerSec={setZoom}
            charMap={charMap}
            locked={locked}
            setLocked={setLocked}
            detection={prefs.detection}
            setDetection={prefs.setDetection}
            sceneCuts={scenes.sceneCuts}
            onDetectScenes={scenes.detectScenes}
            onClearScenes={scenes.clearScenes}
            detectingScenes={scenes.detectingScenes}
            clipFps={clipFps}
            brFont={brFont}
            setBrFont={setBrFont}
            uploadedFonts={fonts.uploadedFonts}
            styleProps={{
              rythmoStyle, setRythmoStyle, onUploadFont: fonts.uploadFont, onDeleteFont: fonts.deleteFont,
              brOffset: play.brOffset, setBrOffset: play.setBrOffset, fontScale, setFontScale,
              wordByWord: prefs.wordByWord, setWordByWord: prefs.setWordByWord, brInPlayer, setBrInPlayer,
            }}
          />

          {/* ── Band: top edge is a resize handle (Splitter) ── */}
          <Splitter dir="row" title="Glisser pour redimensionner la bande · double-clic : réinitialiser"
            start={bandH} onDrag={(dy, start) => setBandH(clampBand(start - dy))}
            onReset={() => setBandH(clampBand(BAND_DEFAULT))} />
          <div style={{ height: bandH, flexShrink: 0, position: 'relative', overflow: 'hidden', background: '#0a0a0c' }}>
            <BandCanvas
              ref={canvasRef}
              getTime={play.getRenderTime}
              onFrame={loops.enforceLoopRegion}
              hoverRef={band.hoverRef}
              dragRef={band.dragRef}
              title={CANVAS_HINT}
              subtitles={subtitles}
              charMap={charMap}
              numTracks={numTracks}
              pxPerSec={pxPerSec}
              brStyle={rythmoStyle}
              accent={bandAccent(settings.accent)}
              brFont={brFont}
              fontScale={fontScale}
              wordByWord={prefs.wordByWord}
              detection={prefs.detection}
              detectionAuto={prefs.detectionAuto}
              waveform={waveformData}
              boucles={boucles.boucles}
              sceneCuts={scenes.sceneCuts}
              clipFps={clipFps}
              loopRegion={loops.loopRegion}
              charFilter={charFilter}
              focusChar={charFilter.size === 1 ? [...charFilter][0] : null}
              {...band.canvasHandlers}
            />
            <CanvasCoachmark />
            <BandOverlays
              subtitles={subtitles}
              charMap={charMap}
              charList={charList}
              numTracks={numTracks}
              canvasH={canvasH}
              canvasRef={canvasRef}
              pxPerSec={pxPerSec}
              getBandTime={getBandTime}
              clipFps={clipFps}
              loopRegion={loops.loopRegion}
              onClearLoop={() => loops.setLoopRegion(null)}
              editing={{
                idx: band.editingIdx, text: band.editText, setText: band.setEditText,
                commit: band.commitEdit, cancel: () => band.setEditingIdx(null),
              }}
              ctxMenu={band.ctxMenu}
              onCloseCtx={() => band.setCtxMenu(null)}
              onCtxAction={band.ctxAction}
            />
          </div>
        </div>

        {/* Inspector — resizable + hideable. Stays mounted while hidden so the
            embedded recorder (and an in-flight take) survives the toggle. */}
        {inspOpen && (
          <Splitter dir="col" title="Glisser pour redimensionner le panneau · double-clic : réinitialiser"
            start={inspW} onDrag={(dx, start) => setInspW(Math.max(INSP_MIN, Math.min(INSP_MAX, start - dx)))}
            onReset={() => setInspW(INSP_DEFAULT)} />
        )}
        {!inspOpen && (
          <button onClick={() => setInspOpen(true)} title="Afficher le panneau (\)" style={{
            width: 32, flexShrink: 0, background: T.surface, border: 'none', borderLeft: `1px solid ${T.border}`, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 14, color: T.text3, fontFamily: T.fontUI }}>
            <Icon d={ICONS.sidebar} size={16} stroke={T.text2} />
            <span style={{ writingMode: 'vertical-rl', fontSize: 11, fontWeight: 600, letterSpacing: 0.6, color: T.text3, whiteSpace: 'nowrap' }}>Répliques · Voix · Détection</span>
          </button>
        )}
        <Inspector
          open={inspOpen}
          width={inspW}
          hint={band.hoverHint}
          rightTab={rightTab}
          setRightTab={setRightTab}
          target={inspectorTarget}
          subIdx={inspectorIdx}
          charMap={charMap}
          charList={charList}
          clipFps={clipFps}
          onRecord={recordInStudio}
          onSetTargetCharacter={setTargetCharacter}
          onNewTargetCharacter={newTargetCharacter}
          repliquesProps={{
            subtitles, transcribing: tools.transcribing, onTranscribe: tools.transcribe,
            onSubtitlesChange: changeSubtitles, onDelete: deleteReplicaWithUndo,
            bandNow, onSeek: seekBand, selectedIdx, setSelectedIdx, charFilter, charMap,
          }}
          voixProps={{
            charList, charMap, subtitles, activeSubtitle, selectedIdx, setSelectedIdx,
            takes, bandNow, comediens: shownComediens, onSetComedien: setComedien,
            onRecord: recordRoleInStudio,
            onSeek: seekBand, clipDuration: clip.end - clip.start, onAddCharacter: addCharacter,
          }}
          detectionProps={{
            detection: prefs.detection, setDetection: prefs.setDetection, detectionAuto: prefs.detectionAuto,
            setDetectionAuto: prefs.setDetectionAuto, wordByWord: prefs.wordByWord, setWordByWord: prefs.setWordByWord,
          }}
          bouclesProps={{ boucles: boucles.boucles, subtitles, onAdd: boucles.addBoucleAtCursor, onRemove: boucles.removeBoucle, onSeek: seekBand, clipFps }}
          lexiqueProps={{ project: clip.project, translateAvailable: !!tools.translateProvider?.available, translateTarget: tools.translateTarget }}
        />
      </div>

      {/* ── Export: App's Export screen, else the inline modal ── */}
      {showExport && exportHost && exportPanel}
      {showExport && !exportHost && (
        <ExportModal clipName={clip.name} onClose={() => onToggleExport?.()}>{exportPanel}</ExportModal>
      )}
    </div>
  )
}
