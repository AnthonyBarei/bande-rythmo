import React, { useState, useEffect, useRef, useCallback } from 'react'
import VideoEditor from './VideoEditor'
import PlexBrowser from './PlexBrowser'
import { Btn, Dot, Kbd, Icon, ICONS, T, alpha } from '../ui'
import { useProgress } from '../ProgressContext'
import { fmtClockHours } from '../utils/timecode'

const TAB = { LOCAL: 'local', PLEX: 'plex', URL: 'url' }

function Spinner({ size = 11, color = T.accent }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${color}`, borderTopColor: 'transparent', animation: 'brspin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
}

export default function ImportSection({ video, onVideoSet, onClipsCreated }) {
  const [tab, setTab] = useState(TAB.LOCAL)
  const [error, setError] = useState(null)
  const [urlInput, setUrlInput] = useState('')
  const [picking, setPicking] = useState(false)
  const [remuxing, setRemuxing] = useState(false)
  const [streams, setStreams] = useState(null)
  const [videoStream, setVideoStream] = useState(null)
  const [audioStream, setAudioStream] = useState(null)
  const [audioSrc, setAudioSrc] = useState(null)  // extracted audio track URL
  const [plexStatus, setPlexStatus] = useState(null)
  const [editorState, setEditorState] = useState({ count: 0, saving: false, duration: 0, marking: false })
  const editorActions = useRef(null)
  const sourceIdRef = useRef(null)
  const pollRef = useRef(null)
  const progress = useProgress()

  const timeoutRef = useRef(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }, [])

  useEffect(() => {
    let alive = true
    fetch('/api/plex/status')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (alive) setPlexStatus(d) })
      .catch(e => console.warn('Statut Plex indisponible', e))
    return () => { alive = false }
  }, [])

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
        setError('Extraction audio trop longue — vérifiez la connexion Plex ou le fichier source')
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
      const res = await fetch('/api/files/pick', { method: 'POST' })
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
    const filename = u.split('/').pop()?.split('?')[0] || 'video'
    onVideoSet({ filename, sourcePath: u, sourceId: null, url: u })
  }

  function clearSource() {
    stopPoll()
    setError(null)
    resetStreams()
    sourceIdRef.current = null
    onVideoSet(null)
  }

  function handlePlexSelected(source) {
    setError(null)
    resetStreams()
    stopPoll()

    sourceIdRef.current = source.sourceId

    onVideoSet({
      filename: source.filename,
      sourcePath: source.sourcePath,
      sourceId: source.sourceId,
      url: source.url,
      plexTitle: source.plexTitle,
      plexYear: source.plexYear,
    })

    const hasStreams = (source.video_streams?.length > 0) || (source.audio_streams?.length > 0)
    setStreams(hasStreams ? { video_streams: source.video_streams, audio_streams: source.audio_streams } : null)
  }

  const videoOptions = streams?.video_streams ?? []
  const audioOptions = streams?.audio_streams ?? []
  const plexHost = plexStatus?.url ? plexStatus.url.replace(/^https?:\/\//, '') : 'bibliothèque locale'
  const { count, saving, duration, marking } = editorState

  const meta = video ? [
    duration ? fmtClockHours(duration) : null,
    videoOptions[0]?.label,
  ].filter(Boolean).join(' · ') : 'Fichier local, bibliothèque Plex ou URL directe'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '26px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 600, marginBottom: 4 }}>IMPORTER</div>
            <div style={{ fontSize: T.fs.xxl, fontWeight: 600, letterSpacing: -0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {video ? video.filename : tab === TAB.PLEX ? 'Choisir un fichier dans Plex' : 'Importer une vidéo'}
            </div>
            <div style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}>
              {meta}
              {video?.plexTitle && <><Dot color={T.success} size={6} /> <span style={{ color: T.success, overflow: 'hidden', textOverflow: 'ellipsis' }}>depuis Plex · {video.plexTitle}{video.plexYear ? ` (${video.plexYear})` : ''}</span></>}
              {video && !video.plexTitle && <span style={{ color: T.text4, overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.sourceId ? video.sourcePath : 'URL directe'}</span>}
              {(picking || remuxing) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: T.accent }}><Spinner />{picking ? 'Ouverture…' : 'Changement piste…'}</span>}
            </div>
          </div>
          {video && (
            <>
              <Btn variant="outline" icon={ICONS.back} onClick={clearSource}>{tab === TAB.PLEX ? 'Bibliothèque' : 'Changer de source'}</Btn>
              <Btn variant="solid" icon={ICONS.scissors} onClick={() => editorActions.current?.mark()} active={marking}
                title="1er clic : IN à la tête de lecture · 2e clic : OUT">
                {marking ? 'Marquer la fin' : 'Marquer un clip'}
              </Btn>
              <Btn variant="primary" size="lg" onClick={() => editorActions.current?.save()} disabled={saving || count === 0}>
                {saving
                  ? <><Spinner size={12} color="#0b0b0d" /> Création…</>
                  : <>Créer {count} clip{count > 1 ? 's' : ''} <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4 }}><Kbd>Ctrl</Kbd><Kbd>S</Kbd></span></>}
              </Btn>
            </>
          )}
        </div>

        {/* Source switcher */}
        <div style={{ display: 'flex', gap: 6, padding: 5, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, width: 'fit-content' }}>
          {[
            { id: TAB.LOCAL, label: 'Fichier local', ic: ICONS.upload, hint: 'glisser un .mp4' },
            { id: TAB.PLEX, label: 'Plex', ic: ICONS.film, hint: plexHost, online: !!plexStatus?.connected },
            { id: TAB.URL, label: 'URL / Stream', ic: ICONS.plug, hint: 'http://…' },
          ].map(s => {
            const active = s.id === tab
            return (
              <button key={s.id} data-rd onClick={() => setTab(s.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 15px', borderRadius: T.r.chip,
                border: 'none', cursor: 'pointer', background: active ? T.bg2 : 'transparent',
                color: active ? T.text : T.text2, fontSize: T.fs.sm, fontWeight: active ? 600 : 500,
                boxShadow: active ? `inset 0 -2px 0 ${T.accent}` : 'none', fontFamily: T.fontUI,
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
              video={video}
              onClipsCreated={onClipsCreated}
              videoStream={videoStream}
              audioStream={audioStream}
              audioSrc={audioSrc}
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
        ) : tab === TAB.PLEX ? (
          <PlexBrowser onSourceSelected={handlePlexSelected} onStatus={setPlexStatus} />
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
    <div onClick={onClick} style={{
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
function StreamPicker({ videoOptions, audioOptions, videoStream, audioStream, onVideo, onAudio, remuxing, hasStreams }) {
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
          {videoOptions.length > 1 && (
            <StreamRow on={videoStream == null} onClick={() => onVideo(null)} disabled={remuxing} icon={ICONS.film} label="Auto" meta="piste par défaut" />
          )}
          {videoOptions.map(s => (
            <StreamRow key={s.relative_index} icon={ICONS.film} label={s.label} meta={`V${s.relative_index}`}
              on={videoOptions.length === 1 || videoStream === s.relative_index}
              disabled={remuxing || videoOptions.length === 1}
              onClick={() => onVideo(s.relative_index)} />
          ))}
        </div>
      )}
      {audioOptions.length > 0 && (
        <div>
          <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2, marginBottom: 8 }}>Audio · {audioOptions.length} piste{audioOptions.length > 1 ? 's' : ''}</div>
          <StreamRow on={audioStream == null} onClick={() => onAudio(null)} disabled={remuxing} icon={ICONS.volume} label="Auto" meta="piste par défaut" />
          {audioOptions.map(s => (
            <StreamRow key={s.relative_index} icon={ICONS.volume} label={s.label} meta={`A${s.relative_index}`}
              on={audioStream === s.relative_index} disabled={remuxing}
              onClick={() => onAudio(s.relative_index)} />
          ))}
        </div>
      )}
      {hasStreams && (
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
