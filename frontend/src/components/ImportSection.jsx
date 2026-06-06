import React, { useState, useEffect, useRef, useCallback } from 'react'
import VideoEditor from './VideoEditor'
import PlexBrowser from './PlexBrowser'
import { Icon, ICONS } from '../Icons'
import { ScreenHeader } from '../ui'
import { useProgress } from '../ProgressContext'

const selectStyle = {
  background: 'var(--surface2)',
  color: 'var(--text)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  padding: '3px 8px',
  fontSize: 12,
}

const TAB = { LOCAL: 'local', PLEX: 'plex', URL: 'url' }

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
  const sourceIdRef = useRef(null)
  const pollRef = useRef(null)
  const progress = useProgress()
  const progressKeyRef = useRef(null)

  const timeoutRef = useRef(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
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

    async function fireRemuxJob() {
      const r = await fetch(`/api/files/remux/${sid}?video=${v}&audio=${a}`, { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      return j.job_id || null
    }

    async function startRemux() {
      try {
        const jobId = await fireRemuxJob()
        if (jobId && !progressStarted) {
          progressStarted = true
          progress.start({
            kind: 'plex-remux',
            title: 'Préparation audio',
            jobId,
            retry: fireRemuxJob,
            onCancel: () => {
              stopPoll()
              setRemuxing(false)
              setError('Extraction annulée.')
            },
            onError: (err) => {
              stopPoll()
              setRemuxing(false)
              setError('Erreur remux : ' + err.message)
            },
          })
        }
      } catch (_) {}

      timeoutRef.current = setTimeout(() => {
        stopPoll()
        setRemuxing(false)
        setError('Extraction audio trop longue — vérifiez la connexion Plex ou le fichier source')
      }, 3 * 60 * 1000)

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/files/remux-status/${sid}?video=${v}&audio=${a}`)
          const data = await res.json()
          // If we missed the job_id on POST (race), pick it up on first poll.
          if (data.job_id && !progressStarted) {
            progressStarted = true
            progress.start({
              kind: 'plex-remux',
              title: 'Préparation audio',
              jobId: data.job_id,
              onCancel: () => {
                stopPoll()
                setRemuxing(false)
                setError('Extraction annulée.')
              },
              onError: (err) => {
                stopPoll()
                setRemuxing(false)
                setError('Erreur remux : ' + err.message)
              },
            })
          }
          if (data.status === 'ready') {
            stopPoll()
            setRemuxing(false)
            setAudioSrc(`/api/files/stream/${sid}?video=${v}&audio=${a}`)
          } else if (data.status === 'error') {
            stopPoll()
            setRemuxing(false)
            setError('Erreur remux — piste introuvable')
          }
        } catch (_) {}
      }, 2000)
    }

    startRemux()
    return stopPoll
  }, [videoStream, audioStream])

  async function handleLocalPick() {
    setError(null)
    setPicking(true)
    stopPoll()
    try {
      const res = await fetch('/api/files/pick', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.cancelled) return

      setStreams(null)
      setVideoStream(null)
      setAudioStream(null)
      setRemuxing(false)
      setAudioSrc(null)
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
    setStreams(null)
    setVideoStream(null)
    setAudioStream(null)
    setRemuxing(false)
    setAudioSrc(null)
    stopPoll()
    sourceIdRef.current = null
    const filename = u.split('/').pop()?.split('?')[0] || 'video'
    onVideoSet({ filename, sourcePath: u, sourceId: null, url: u })
  }

  function handlePlexSelected(source) {
    setError(null)
    setStreams(null)
    setVideoStream(null)
    setAudioStream(null)
    setRemuxing(false)
    setAudioSrc(null)
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader
        kicker={`IMPORTER${tab === TAB.PLEX ? ' · SOURCE PLEX' : ''}`}
        title={video ? video.filename : tab === TAB.PLEX ? 'Choisir un fichier dans Plex' : 'Importer une vidéo'}
        sub={video ? video.sourcePath : 'Fichier local, bibliothèque Plex ou URL directe'}
        right={(picking || remuxing) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--accent)' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'brspin 0.7s linear infinite', display: 'inline-block' }} />
            {picking ? 'Ouverture…' : 'Changement piste…'}
          </span>
        )}
      />

      {/* Source switcher — redesign screen-import */}
      <div style={{ padding: '4px 28px 14px', flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', gap: 6, padding: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }}>
          {[
            { id: TAB.LOCAL, icon: ICONS.upload, label: 'Fichier local', hint: 'glisser un .mp4' },
            { id: TAB.PLEX,  icon: ICONS.film,   label: 'Plex',          hint: 'bibliothèque locale', online: true },
            { id: TAB.URL,   icon: ICONS.link,   label: 'URL / Stream',  hint: 'http://…' },
          ].map(s => {
            const active = tab === s.id
            return (
              <button
                key={s.id}
                onClick={() => setTab(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 15px', borderRadius: 6,
                  background: active ? 'var(--bg2)' : 'transparent', border: 'none', cursor: 'pointer',
                  color: active ? 'var(--text)' : 'var(--text2)', fontSize: 13, fontWeight: active ? 600 : 500,
                  boxShadow: active ? 'inset 0 -2px 0 var(--accent)' : 'none',
                }}
              >
                <Icon d={s.icon} size={15} style={{ color: active ? 'var(--accent)' : 'inherit' }} />
                {s.label}
                {s.online && <span style={{ fontSize: 8.5, padding: '1px 5px', background: 'rgba(94,194,124,.16)', color: 'var(--success)', borderRadius: 3, fontWeight: 700 }}>● ONLINE</span>}
                <span style={{ fontSize: 10.5, color: 'var(--text4)', marginLeft: 2 }}>{s.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div style={{ margin: 16, padding: '10px 14px', background: 'rgba(229,69,69,0.1)', border: '1px solid rgba(229,69,69,0.3)', borderRadius: 4, color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Plex browser shown when no video selected yet or tab = plex */}
      {tab === TAB.PLEX && !video && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PlexBrowser onSourceSelected={handlePlexSelected} />
        </div>
      )}

      {/* Local empty state */}
      {tab === TAB.LOCAL && !video && (
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text3)', cursor: 'pointer' }}
          onClick={handleLocalPick}
        >
          <Icon d={ICONS.upload} size={44} sw={1.4} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>Cliquez pour choisir un fichier local</div>
          <div style={{ fontSize: 12 }}>MP4, MOV, MKV, AVI — lu directement, aucun upload</div>
        </div>
      )}

      {/* URL source panel */}
      {tab === TAB.URL && !video && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
          <Icon d={ICONS.link} size={40} sw={1.4} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>Coller l’URL d’une vidéo</div>
          <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 540 }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleUrlLoad() }}
              placeholder="https://exemple.com/video.mp4"
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
            <button
              onClick={handleUrlLoad}
              style={{ padding: '8px 18px', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13, borderRadius: 'var(--radius)' }}
            >
              Charger
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Le flux est lu directement — aucun téléchargement.</div>
        </div>
      )}

      {/* Video loaded → editor */}
      {video && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ padding: '8px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {video.plexTitle
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon d={ICONS.film} size={14} style={{ color: 'var(--success)' }} /><strong style={{ color: 'var(--text)' }}>{video.plexTitle}</strong>{video.plexYear ? ` (${video.plexYear})` : ''}</span>
              : <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon d={ICONS.film} size={14} style={{ color: 'var(--text3)' }} />{video.filename}</span>
            }
            <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
              {video.sourcePath}
            </span>
            {tab === TAB.PLEX && (
              <button
                onClick={() => onVideoSet(null)}
                style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)', background: 'none', border: '1px solid var(--border2)', borderRadius: 3, padding: '2px 8px' }}
              >
                ← Bibliothèque
              </button>
            )}
          </div>

          {/* Track selector */}
          {streams && (
            <div style={{
              padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
              display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Pistes</span>

              {videoOptions.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--text2)' }}>Vidéo</span>
                  <select
                    value={videoStream ?? ''}
                    onChange={e => setVideoStream(e.target.value === '' ? null : Number(e.target.value))}
                    disabled={videoOptions.length <= 1 || remuxing}
                    style={{ ...selectStyle, color: videoOptions.length > 1 ? 'var(--text)' : 'var(--text3)' }}
                  >
                    <option value=''>Auto</option>
                    {videoOptions.map(s => (
                      <option key={s.relative_index} value={s.relative_index}>
                        V{s.relative_index} — {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {audioOptions.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--text2)' }}>Audio</span>
                  <select
                    value={audioStream ?? ''}
                    onChange={e => setAudioStream(e.target.value === '' ? null : Number(e.target.value))}
                    disabled={remuxing}
                    style={selectStyle}
                  >
                    <option value=''>Auto</option>
                    {audioOptions.map(s => (
                      <option key={s.relative_index} value={s.relative_index}>
                        A{s.relative_index} — {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {remuxing && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent)' }}><span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'brspin 0.7s linear infinite' }} /> Remux en cours…</span>}
            </div>
          )}

          <VideoEditor
            video={video}
            onClipsCreated={onClipsCreated}
            videoStream={videoStream}
            audioStream={audioStream}
            audioSrc={audioSrc}
          />
        </div>
      )}

      {/* Plex browser shown below editor if tab=plex but video selected — allow re-picking */}
      {tab === TAB.PLEX && video && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* collapsed — user clicked "← Bibliothèque" to go back via onVideoSet(null) */}
        </div>
      )}
    </div>
  )
}
