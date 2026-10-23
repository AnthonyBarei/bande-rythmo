import React, { useState, useEffect, useRef, useCallback } from 'react'
import VideoEditor from './VideoEditor'
import LibraryBrowser from './LibraryBrowser'
import { Btn, Dot, Kbd, Icon, ICONS, Spinner, T, alpha, pressable } from '../ui'
import { useProgress } from '../ProgressContext'
import { fmtSMPTE } from '../utils/timecode'
import { sourceTitle, urlFilename } from '../utils/sourceTitle'
import { streamLabel } from '../utils/streamLabel'
import { autoAudioStream } from '../utils/audioCodec'
import { LIBRARY_PROVIDERS, writeLibraryConfigured } from '../config/libraryProviders'

const TAB = { LOCAL: 'local', LIBRARY: 'library', URL: 'url' }

// Header "Marquer un clip" walks the player's IN / OUT model (utils/inOut markStep).
const MARK_BTN = {
  none: { label: 'Marquer un clip', title: 'Marque IN à la tête de lecture (I) · 2e clic : OUT (O)' },
  in: { label: 'Marquer la fin', title: 'Marque OUT à la tête de lecture (O)' },
  range: { label: 'Ajouter le clip', title: 'Ajoute la plage IN → OUT aux clips en attente, puis marquez le suivant' },
}

// projectId: clips, picked files and library items join that project (null =
// the default « Clips importés » bucket, e.g. the Atelier's inline import).
export default function ImportSection({ projectId = null, video, onVideoSet, onClipsCreated }) {
  const [tab, setTab] = useState(TAB.LOCAL)
  const [error, setError] = useState(null)
  const [urlInput, setUrlInput] = useState('')
  const [picking, setPicking] = useState(false)
  const [remuxing, setRemuxing] = useState(false)
  const [streams, setStreams] = useState(null)
  const [videoStream, setVideoStream] = useState(null)
  const [audioStream, setAudioStream] = useState(null)
  const [audioSrc, setAudioSrc] = useState(null)  // extracted audio track URL
  const [libraryStatus, setLibraryStatus] = useState({})  // { [providerId]: { connected, server?, url } }
  const [editorState, setEditorState] = useState({ count: 0, saving: false, duration: 0, phase: 'none' })
  const editorActions = useRef(null)
  const sourceIdRef = useRef(null)
  const pollRef = useRef(null)
  const progress = useProgress()

  const timeoutRef = useRef(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }, [])

  const setProviderStatus = useCallback((id, data) => {
    setLibraryStatus(prev => ({ ...prev, [id]: data }))
  }, [])

  useEffect(() => {
    let alive = true
    for (const p of LIBRARY_PROVIDERS) {
      fetch(`${p.api}/status`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(d => { writeLibraryConfigured(p.id, d.configured); if (alive) setProviderStatus(p.id, d) })
        .catch(e => console.warn(`Statut ${p.label} indisponible`, e))
    }
    return () => { alive = false }
  }, [setProviderStatus])

  useEffect(() => {
    const sid = sourceIdRef.current
    if (!sid) return
    if (audioStream === null && videoStream === null) {
      setAudioSrc(null)  // back to Auto = use video's default audio
      return
    }

    const v = videoStream ?? 0
    const a = audioStream ?? 0

    stopPoll()
    setRemuxing(true)

    let progressStarted = false
    let stale = false
    const statusUrl = `/api/files/remux-status/${sid}?video=${v}&audio=${a}`
    const streamUrl = `/api/files/stream/${sid}?video=${v}&audio=${a}`

    // The backend creates the job inside a task spawned after the POST returns,
    // so the POST usually carries no job_id — read it back from the status.
    async function fireRemuxJob() {
      const r = await fetch(`/api/files/remux/${sid}?video=${v}&audio=${a}`, { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.detail || `HTTP ${r.status}`)
      if (j.job_id) return j.job_id
      const st = await fetch(statusUrl).then(res => res.json()).catch(() => ({}))
      return st.job_id || null
    }

    function startProgress(jobId) {
      if (progressStarted || stale) return
      progressStarted = true
      progress.start({
        kind: 'plex-remux',
        title: 'Préparation audio',
        jobId,
        retry: fireRemuxJob,
        onDone: () => {
          if (stale) return
          stopPoll()
          setRemuxing(false)
          setError(null)
          setAudioSrc(streamUrl)
        },
        onCancel: () => {
          if (stale) return
          stopPoll()
          setRemuxing(false)
          setError('Extraction annulée.')
        },
        onError: (err) => {
          if (stale) return
          stopPoll()
          setRemuxing(false)
          setError('Erreur remux : ' + err.message)
        },
      })
    }

    async function startRemux() {
      try {
        const jobId = await fireRemuxJob()
        if (jobId) startProgress(jobId)
      } catch (e) {
        console.warn('remux start failed', e)
      }
      if (stale) return

      timeoutRef.current = setTimeout(() => {
        stopPoll()
        setRemuxing(false)
        setError('Extraction audio trop longue — vérifiez la connexion au serveur ou le fichier source')
      }, 3 * 60 * 1000)

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(statusUrl)
          const data = await res.json()
          if (stale) return
          // If we missed the job_id on POST (race), pick it up on first poll.
          if (data.job_id) startProgress(data.job_id)
          if (data.status === 'ready') {
            stopPoll()
            setRemuxing(false)
            setAudioSrc(streamUrl)
          } else if (data.status === 'error') {
            stopPoll()
            setRemuxing(false)
            setError('Erreur remux — piste introuvable')
          }
        } catch (e) {
          console.warn('remux status poll failed', e)
        }
      }, 2000)
    }

    startRemux()
    return () => { stale = true; stopPoll() }
  }, [videoStream, audioStream])

  function resetStreams() {
    setStreams(null)
    setVideoStream(null)
    setAudioStream(null)
    setRemuxing(false)
    setAudioSrc(null)
  }

  async function handleLocalPick() {
    if (picking) return
    setError(null)
    setPicking(true)
    stopPoll()
    try {
      const res = await fetch(`/api/files/pick${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''}`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.cancelled) return

      resetStreams()
      sourceIdRef.current = data.source_id

      onVideoSet({
        filename: data.filename,
        sourcePath: data.path,
        sourceId: data.source_id,
        url: `/api/files/stream/${data.source_id}`,
      })

      const hasStreams = data.video_streams.length > 0 || data.audio_streams.length > 0
      setStreams(hasStreams ? data : null)
      setAudioStream(autoAudioStream(data.audio_streams))
    } catch (err) {
      setError('Erreur : ' + err.message)
    } finally {
      setPicking(false)
    }
  }

  function handleUrlLoad() {
    const u = urlInput.trim()
    if (!u) return
    if (!/^https?:\/\//i.test(u)) { setError('URL invalide — doit commencer par http:// ou https://'); return }
    setError(null)
    resetStreams()
    stopPoll()
    sourceIdRef.current = null
    onVideoSet({ filename: urlFilename(u), sourcePath: u, sourceId: null, url: u })
  }

  function clearSource() {
    stopPoll()
    setError(null)
    resetStreams()
    sourceIdRef.current = null
    onVideoSet(null)
  }

  function handleLibrarySelected(source) {
    setError(null)
    resetStreams()
    stopPoll()

    sourceIdRef.current = source.sourceId

    onVideoSet({
      filename: source.filename,
      sourcePath: source.sourcePath,
      sourceId: source.sourceId,
      url: source.url,
      libraryName: source.libraryName,
      libraryTitle: source.libraryTitle,
      libraryYear: source.libraryYear,
    })

    const hasStreams = (source.video_streams?.length > 0) || (source.audio_streams?.length > 0)
    setStreams(hasStreams ? { video_streams: source.video_streams, audio_streams: source.audio_streams } : null)
    // Dolby / DTS default track would play silent — start its AAC remux right away.
    setAudioStream(autoAudioStream(source.audio_streams))
  }

  const videoOptions = streams?.video_streams ?? []
  const audioOptions = streams?.audio_streams ?? []
  const connectedLibraries = LIBRARY_PROVIDERS.filter(p => libraryStatus[p.id]?.connected).map(p => p.label)
  const libraryHint = (connectedLibraries.length ? connectedLibraries : LIBRARY_PROVIDERS.map(p => p.label)).join(' · ')
  const { count, saving, duration, phase } = editorState
  const markBtn = MARK_BTN[phase] || MARK_BTN.none
  const sourceFps = videoOptions[videoStream ?? 0]?.fps

  const meta = video ? [
    duration ? fmtSMPTE(duration, sourceFps) : null,
    streamLabel(videoOptions[0]),
  ].filter(Boolean).join(' · ') : 'Fichier local, médiathèque (Plex, Jellyfin) ou URL directe'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '26px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 600, marginBottom: 4 }}>IMPORTER</div>
            <div title={video ? sourceTitle(video) : undefined} style={{ fontSize: T.fs.xxl, fontWeight: 600, letterSpacing: -0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {video ? sourceTitle(video) : tab === TAB.LIBRARY ? 'Choisir un fichier dans la médiathèque' : 'Importer une vidéo'}
            </div>
            <div style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}>
              {meta}
              {video?.libraryTitle && <><Dot color={T.success} size={6} /> <span style={{ color: T.success, overflow: 'hidden', textOverflow: 'ellipsis' }}>depuis {video.libraryName} · {video.libraryTitle}{video.libraryYear ? ` (${video.libraryYear})` : ''}</span></>}
              {video && !video.libraryTitle && <span style={{ color: T.text4, overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.sourceId ? video.sourcePath : 'URL directe'}</span>}
              {(picking || remuxing) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: T.accent }}><Spinner />{picking ? 'Ouverture…' : 'Changement piste…'}</span>}
            </div>
          </div>
          {video && (
            <>
              <Btn variant="outline" icon={ICONS.back} onClick={clearSource}>{tab === TAB.LIBRARY ? 'Médiathèque' : 'Changer de source'}</Btn>
              <Btn variant="solid" icon={ICONS.scissors} onClick={() => editorActions.current?.mark()} active={phase !== 'none'}
                title={markBtn.title}>
                {markBtn.label}
              </Btn>
              <Btn variant="primary" size="lg" onClick={() => editorActions.current?.save()} disabled={saving || count === 0}
                title={saving ? 'Création des clips en cours…' : count === 0 ? 'Tracez un clip sur la timeline ou marquez IN / OUT (I, O)' : 'Créer les clips en attente (Ctrl+S)'}>
                {saving
                  ? <><Spinner size={12} color={T.text3} /> Création…</>
                  : <>{count === 0 ? 'Créer le clip' : `Créer ${count} clip${count > 1 ? 's' : ''}`} <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4 }}><Kbd>Ctrl</Kbd><Kbd>S</Kbd></span></>}
              </Btn>
            </>
          )}
        </div>

        {/* Source switcher */}
        <div style={{ display: 'flex', gap: 6, padding: 5, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, width: 'fit-content' }}>
          {[
            { id: TAB.LOCAL, label: 'Fichier local', ic: ICONS.upload, hint: 'glisser un .mp4' },
            { id: TAB.LIBRARY, label: 'Médiathèque', ic: ICONS.film, hint: libraryHint, online: connectedLibraries.length > 0 },
            { id: TAB.URL, label: 'URL / Stream', ic: ICONS.plug, hint: 'http://…' },
          ].map(s => {
            const active = s.id === tab
            return (
              <button key={s.id} data-rd onClick={() => setTab(s.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 15px', borderRadius: T.r.chip,
                border: `1px solid ${active ? T.border2 : 'transparent'}`, cursor: 'pointer', background: active ? T.surface3 : 'transparent',
                color: active ? T.text : T.text2, fontSize: T.fs.sm, fontWeight: active ? 600 : 500,
                fontFamily: T.fontUI,
              }}>
                <Icon d={s.ic} size={15} stroke={active ? T.accent : 'currentColor'} />
                {s.label}
                {s.online && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 8.5, padding: '1px 5px', background: 'rgba(94,194,124,.16)', color: T.success, borderRadius: 3, fontWeight: 700 }}><Dot color={T.success} size={4} />ONLINE</span>}
                <span style={{ fontSize: 10.5, color: T.text4, marginLeft: 2 }}>{s.hint}</span>
              </button>
            )
          })}
        </div>

        {error && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(232,89,93,.05)', border: `1px solid ${alpha(T.danger, '44')}`, borderRadius: T.r.ctl, color: T.danger, fontSize: T.fs.xs }}>
            <Icon d={ICONS.warn} size={14} stroke={T.danger} />{error}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, padding: '16px 32px 20px', display: 'flex', gap: 18, overflow: 'hidden' }}>
        {video ? (
          <>
            <VideoEditor
              projectId={projectId}
              video={video}
              onClipsCreated={onClipsCreated}
              videoStream={videoStream}
              audioStream={audioStream}
              audioSrc={audioSrc}
              fps={sourceFps}
              actionsRef={editorActions}
              onStateChange={setEditorState}
            />
            <StreamPicker
              videoOptions={videoOptions}
              audioOptions={audioOptions}
              videoStream={videoStream}
              audioStream={audioStream}
              onVideo={setVideoStream}
              onAudio={setAudioStream}
              remuxing={remuxing}
              hasStreams={!!streams}
            />
          </>
        ) : tab === TAB.LIBRARY ? (
          <LibraryBrowser projectId={projectId} statuses={libraryStatus} onSourceSelected={handleLibrarySelected} onStatus={setProviderStatus} />
        ) : tab === TAB.LOCAL ? (
          <EmptySource icon={ICONS.upload} onClick={handleLocalPick}
            title={picking ? 'Ouverture du sélecteur…' : 'Cliquez pour choisir un fichier local'}
            hint="MP4, MOV, MKV, AVI — lu directement, aucun upload" />
        ) : (
          <EmptySource icon={ICONS.plug} title="Coller l’URL d’une vidéo" hint="Le flux est lu directement — aucun téléchargement.">
            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 540 }}>
              <input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleUrlLoad() }}
                placeholder="https://exemple.com/video.mp4"
                style={{ flex: 1, height: 36, padding: '0 12px', background: T.bg2, border: `1px solid ${T.border2}`, borderRadius: T.r.ctl, fontFamily: T.fontMono, fontSize: T.fs.xs, color: T.text }}
              />
              <Btn variant="primary" onClick={handleUrlLoad}>Charger</Btn>
            </div>
          </EmptySource>
        )}
      </div>
    </div>
  )
}

function EmptySource({ icon, title, hint, onClick, children }) {
  return (
    <div onClick={onClick} {...pressable(onClick)} style={{
      flex: 1, minHeight: 0, background: T.surface, border: `1px dashed ${T.border2}`, borderRadius: T.r.card,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <Icon d={icon} size={40} sw={1.4} stroke={T.text4} />
      <div style={{ fontSize: T.fs.base, color: T.text2 }}>{title}</div>
      {children}
      <div style={{ fontSize: T.fs.xs, color: T.text3 }}>{hint}</div>
    </div>
  )
}

// Reference screen-import.jsx StreamPicker. "Auto" rows keep the app's
// default-track behaviour (no remux) — the reference has no such row.
// FIXES_R5 #19: a single track is a read-only row; the picker starts at 2.
function StreamPicker({ videoOptions, audioOptions, videoStream, audioStream, onVideo, onAudio, remuxing, hasStreams }) {
  const canPick = videoOptions.length > 1 || audioOptions.length > 1
  return (
    <div style={{ width: 264, flexShrink: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
      <div>
        <div style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700, marginBottom: 4 }}>FLUX DÉTECTÉS</div>
        <div style={{ fontSize: 10.5, color: T.text4 }}>ffprobe · choisir avant la découpe</div>
      </div>
      {!hasStreams && (
        <div style={{ fontSize: T.fs.xs, color: T.text3, lineHeight: 1.5 }}>Aucun flux analysé pour cette source — pistes par défaut.</div>
      )}
      {videoOptions.length > 0 && (
        <div>
          <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2, marginBottom: 8 }}>Vidéo{videoOptions.length > 1 ? ` · ${videoOptions.length} pistes` : ''}</div>
          {videoOptions.length === 1 ? <StreamInfo icon={ICONS.film} label={streamLabel(videoOptions[0])} /> : (<>
            <StreamRow on={videoStream == null} onClick={() => onVideo(null)} disabled={remuxing} icon={ICONS.film} label="Auto" meta="piste par défaut" />
            {videoOptions.map(s => (
              <StreamRow key={s.relative_index} icon={ICONS.film} label={streamLabel(s)} meta={`V${s.relative_index}`}
                on={videoStream === s.relative_index} disabled={remuxing}
                onClick={() => onVideo(s.relative_index)} />
            ))}
          </>)}
        </div>
      )}
      {audioOptions.length > 0 && (
        <div>
          <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2, marginBottom: 8 }}>Audio{audioOptions.length > 1 ? ` · ${audioOptions.length} pistes` : ''}</div>
          {audioOptions.length === 1 ? <StreamInfo icon={ICONS.volume} label={streamLabel(audioOptions[0])} /> : (<>
            <StreamRow on={audioStream == null} onClick={() => onAudio(null)} disabled={remuxing} icon={ICONS.volume} label="Auto" meta="piste par défaut" />
            {audioOptions.map(s => (
              <StreamRow key={s.relative_index} icon={ICONS.volume} label={streamLabel(s)} meta={`A${s.relative_index}`}
                on={audioStream === s.relative_index} disabled={remuxing}
                onClick={() => onAudio(s.relative_index)} />
            ))}
          </>)}
        </div>
      )}
      {hasStreams && (canPick || remuxing) && (
        <div style={{ padding: 11, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, fontSize: 11, color: T.text3, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {remuxing
            ? <><Spinner size={10} /><span>Remux en cours — <span style={{ color: T.text2 }}>extraction de la piste</span> choisie.</span></>
            : <span>Une piste autre qu’Auto est <span style={{ color: T.text2 }}>extraite (remux)</span> avant la découpe.</span>}
        </div>
      )}
      <div style={{ flex: 1 }} />
    </div>
  )
}

// The only track of its kind: shown, not chosen.
function StreamInfo({ icon, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', marginBottom: 5,
      borderRadius: T.r.ctl, background: T.bg2, border: `1px solid ${T.border}`,
    }}>
      <Icon d={icon} size={15} stroke={T.text3} />
      <div style={{ flex: 1, minWidth: 0, fontSize: T.fs.xs, color: T.text2, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>{label}</div>
    </div>
  )
}

function StreamRow({ on, onClick, disabled, icon, label, meta }) {
  return (
    <button data-rd onClick={disabled ? undefined : onClick} disabled={disabled && !on} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', marginBottom: 5,
      borderRadius: T.r.ctl, cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
      background: on ? alpha(T.accent, '12') : T.bg2, border: `1px solid ${on ? alpha(T.accent, '66') : T.border}`,
    }}>
      <Icon d={icon} size={15} stroke={on ? T.accent : T.text3} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.fs.xs, color: on ? T.text : T.text2, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: 10, color: T.text4, fontFamily: T.fontMono }}>{meta}</div>
      </div>
      {on && <Icon d={ICONS.check} size={14} stroke={T.accent} />}
    </button>
  )
}
