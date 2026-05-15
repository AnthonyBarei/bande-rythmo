import React, { useState, useRef } from 'react'
import VideoEditor from './VideoEditor'

const selectStyle = {
  background: 'var(--surface2)',
  color: 'var(--text)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  padding: '3px 8px',
  fontSize: 12,
}

export default function ImportSection({ video, onVideoSet, onClipsCreated }) {
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [streams, setStreams] = useState(null)
  const [videoStream, setVideoStream] = useState(null)
  const [audioStream, setAudioStream] = useState(null)
  const fileRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError(null)
    setStreams(null)
    setVideoStream(null)
    setAudioStream(null)

    // Show video immediately from local blob URL while upload happens
    onVideoSet({ file, url: URL.createObjectURL(file), filename: file.name })
    e.target.value = ''

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/clips/upload-source', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // Update video object with server-side path (enables batch-local, skips re-upload)
      onVideoSet({
        file,
        url: URL.createObjectURL(file),
        filename: data.filename || file.name,
        sourcePath: data.path,
      })

      const hasStreams = data.video_streams.length > 0 || data.audio_streams.length > 0
      setStreams(hasStreams ? data : null)
    } catch (err) {
      setError('Upload échoué : ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const videoOptions = streams?.video_streams ?? []
  const audioOptions = streams?.audio_streams ?? []

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface)' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Importer une vidéo</h1>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Chargez votre source, marquez des segments IN/OUT, découpez en clips
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} style={{ display: 'none' }} />
          <button
            onClick={() => fileRef.current.click()}
            style={{
              padding: '8px 20px',
              background: video ? 'var(--surface3)' : '#f5c518',
              color: video ? 'var(--text)' : '#000',
              border: video ? '1px solid var(--border2)' : 'none',
              fontWeight: video ? 400 : 600,
              fontSize: 13,
              borderRadius: 4,
            }}
          >
            {video ? '↺ Changer vidéo' : '⬆ Importer vidéo'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ margin: 16, padding: '10px 14px', background: 'rgba(229,69,69,0.1)', border: '1px solid rgba(229,69,69,0.3)', borderRadius: 4, color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!video ? (
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text3)', cursor: 'pointer' }}
          onClick={() => fileRef.current.click()}
        >
          <div style={{ fontSize: 48, opacity: 0.3 }}>▤</div>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>Cliquez pour importer une vidéo</div>
          <div style={{ fontSize: 12 }}>MP4, MOV, MKV, AVI — lecture locale, aucun upload cloud</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ padding: '8px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>📄 {video.filename}</span>
            {uploading && <span style={{ color: '#f5c518' }}>⏳ Import en cours…</span>}
            {!uploading && video.sourcePath && <span style={{ color: 'var(--success)' }}>✓ Prêt</span>}
          </div>

          {/* Track selector — shown once upload+probe complete */}
          {!uploading && streams && (
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
                    disabled={videoOptions.length <= 1}
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
            </div>
          )}

          <VideoEditor
            video={video}
            onClipsCreated={onClipsCreated}
            videoStream={videoStream}
            audioStream={audioStream}
          />
        </div>
      )}
    </div>
  )
}
