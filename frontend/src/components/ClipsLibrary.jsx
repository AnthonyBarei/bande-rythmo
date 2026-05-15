import React, { useState } from 'react'
import ClipCard from './ClipCard'
import GifExportModal from './GifExportModal'

export default function ClipsLibrary({ clips, onDub, onMeme, onRefresh, onDelete, onRename }) {
  const [exporting, setExporting] = useState(null)
  const [toast, setToast] = useState(null)
  const [gifModalClip, setGifModalClip] = useState(null)

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleExportFormat(clip, format) {
    setExporting(clip.clip_id + '_' + format)
    try {
      const res = await fetch('/api/export/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_id: clip.clip_id, subtitles: [], format }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.name}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`${format.toUpperCase()} exporté`, 'success')
    } catch (e) {
      showToast(`Erreur export ${format.toUpperCase()} : ` + e.message, 'error')
    } finally {
      setExporting(null)
    }
  }

  const handleExportGif = clip => setGifModalClip(clip)
  const handleExportMp3 = clip => handleExportFormat(clip, 'mp3')

  async function handleDelete(clipId) {
    await onDelete(clipId)
    showToast('Clip supprimé')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600 }}>Mes Clips</h1>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            {clips.length} clip{clips.length !== 1 ? 's' : ''} — cliquez pour doubler, GIF ou exporter
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{ marginLeft: 'auto', padding: '7px 14px', background: 'var(--surface3)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 4, fontSize: 12 }}
        >
          ↺ Actualiser
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {clips.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: 'var(--text3)' }}>
            <div style={{ fontSize: 40, opacity: 0.25 }}>▤</div>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>Aucun clip encore</div>
            <div style={{ fontSize: 12 }}>Importez une vidéo et découpez des segments</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {clips.map(clip => (
              <ClipCard
                key={clip.clip_id}
                clip={clip}
                onDub={onDub}
                onMeme={onMeme}
                onExportGif={handleExportGif}
                onExportMp3={handleExportMp3}
                onDelete={handleDelete}
                onRename={onRename}
                exporting={exporting}
              />
            ))}
          </div>
        )}
      </div>

      {/* GIF export modal */}
      {gifModalClip && (
        <GifExportModal
          clip={gifModalClip}
          onClose={() => setGifModalClip(null)}
          onExported={() => showToast('GIF exporté', 'success')}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          padding: '10px 18px',
          background: toast.type === 'error' ? '#e54545' : toast.type === 'success' ? '#44bb55' : '#333',
          color: '#fff',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          zIndex: 1000,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
