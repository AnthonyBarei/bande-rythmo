import React, { useState, useEffect, useRef, useCallback } from 'react'
import VideoEditor from './VideoEditor'
import PlexBrowser from './PlexBrowser'

const selectStyle = {
  background: 'var(--surface2)',
  color: 'var(--text)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  padding: '3px 8px',
  fontSize: 12,
}

const TAB = { LOCAL: 'local', PLEX: 'plex' }

export default function ImportSection({ video, onVideoSet, onClipsCreated }) {
  const [tab, setTab] = useState(TAB.LOCAL)
  const [error, setError] = useState(null)
  const [picking, setPicking] = useState(false)
  const [remuxing, setRemuxing] = useState(false)
  const [streams, setStreams] = useState(null)
  const [videoStream, setVideoStream] = useState(null)
  const [audioStream, setAudioStream] = useState(null)
  const [audioSrc, setAudioSrc] = useState(null)  // extracted audio track URL
  const sourceIdRef = useRef(null)
  const pollRef = useRef(null)

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

    async function startRemux() {
      try {
        await fetch(`/api/files/remux/${sid}?video=${v}&audio=${a}`, { method: 'POST' })
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
          if (data.status === 'ready') {
            stopPoll()
            setRemuxing(false)
            // Video URL unchanged — just swap audio track via separate element
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
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface)' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Importer une vidéo</h1>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Fichier local ou bibliothèque Plex
          </p>
        </div>

        {/* Source tabs */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
          {[{ id: TAB.LOCAL, label: '💻 Local' }, { id: TAB.PLEX, label: '▶ Plex' }].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '5px 14px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                background: tab === t.id ? '#f5c518' : 'var(--surface2)',
                color: tab === t.id ? '#000' : 'var(--text2)',
                border: tab === t.id ? 'none' : '1px solid var(--border2)',
                fontWeight: tab === t.id ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Local pick button */}
        {tab === TAB.LOCAL && (
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={handleLocalPick}
              disabled={picking || remuxing}
              style={{
                padding: '8px 20px',
                background: (picking || remuxing) ? '#333' : video ? 'var(--surface3)' : '#f5c518',
                color: (picking || remuxing) ? '#555' : video ? 'var(--text)' : '#000',
                border: video && !picking && !remuxing ? '1px solid var(--border2)' : 'none',
                fontWeight: video ? 400 : 600,
                fontSize: 13, borderRadius: 4,
                cursor: (picking || remuxing) ? 'wait' : 'pointer',
              }}
            >
              {picking ? '⏳ Ouverture…' : remuxing ? '⏳ Changement piste…' : video ? '↺ Changer vidéo' : '⬆ Parcourir…'}
            </button>
          </div>
        )}
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
          <div style={{ fontSize: 48, opacity: 0.3 }}>💻</div>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>Cliquez pour choisir un fichier local</div>
          <div style={{ fontSize: 12 }}>MP4, MOV, MKV, AVI — lu directement, aucun upload</div>
        </div>
      )}

      {/* Video loaded → editor */}
      {video && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ padding: '8px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {video.plexTitle
              ? <span>▶ <strong style={{ color: 'var(--text)' }}>{video.plexTitle}</strong>{video.plexYear ? ` (${video.plexYear})` : ''}</span>
              : <span>📄 {video.filename}</span>
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

              {remuxing && <span style={{ fontSize: 11, color: '#f5c518' }}>⏳ Remux en cours…</span>}
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
