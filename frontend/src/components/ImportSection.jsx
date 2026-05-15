import React, { useState, useRef } from 'react'
import VideoEditor from './VideoEditor'

export default function ImportSection({ video, onVideoSet, onClipsCreated }) {
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError(null)
    onVideoSet({
      file,
      url: URL.createObjectURL(file),
      filename: file.name,
    })
    e.target.value = ''
  }

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
              background: video ? 'var(--surface3)' : '#ff9900',
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
          <div style={{ padding: '8px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 12 }}>
            <span>📄 {video.filename}</span>
          </div>
          <VideoEditor video={video} onClipsCreated={onClipsCreated} />
        </div>
      )}
    </div>
  )
}
