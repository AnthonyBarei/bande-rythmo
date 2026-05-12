import React, { useState, useEffect } from 'react'

const fmt = t => {
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(0).padStart(2, '0')
  return `${m}:${s}`
}

export default function ClipCard({ clip, onDub, onMeme, onExportGif, onExportMp3, onDelete, onRename, exporting }) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(clip.name)
  const [hover, setHover] = useState(false)
  const [watching, setWatching] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const duration = clip.end - clip.start

  useEffect(() => {
    if (!watching) return
    const onKey = e => { if (e.key === 'Escape') setWatching(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [watching])
  const hasSubtitles = clip.subtitles && clip.subtitles.length > 0
  const segmentUrl = clip.segment_path ? `/${clip.segment_path}` : null

  function submitRename() {
    const n = nameInput.trim()
    if (n && n !== clip.name) onRename(clip.clip_id, n)
    setEditingName(false)
  }

  const thumbSrc = clip.thumbnail_path ? `/${clip.thumbnail_path}` : null

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setConfirmDelete(false) }}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hover ? '#3a3a3a' : 'var(--border)'}`,
        borderRadius: 6,
        overflow: 'hidden',
        transition: 'border-color 0.15s, transform 0.15s',
        transform: hover ? 'translateY(-1px)' : 'none',
        cursor: 'default',
      }}
    >
      {/* Thumbnail */}
      <div
        style={{ position: 'relative', aspectRatio: '16/9', background: '#080808', cursor: 'pointer' }}
        onClick={() => onDub(clip)}
      >
        {thumbSrc ? (
          <img src={thumbSrc} alt={clip.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 28 }}>
            ▶
          </div>
        )}
        {/* Duration badge */}
        <div style={{
          position: 'absolute', bottom: 6, right: 6,
          background: 'rgba(0,0,0,0.75)', color: '#fff',
          fontSize: 11, padding: '2px 6px', borderRadius: 3,
          fontFamily: 'var(--font-mono)',
        }}>
          {fmt(duration)}
        </div>
        {/* Subtitle badge */}
        {hasSubtitles && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            background: '#ff9900', color: '#000',
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
          }}>
            BR
          </div>
        )}
        {/* Play overlay on hover */}
        {hover && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,153,0,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,153,0,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#000', fontSize: 16,
            }}>
              ◉
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px' }}>
        {editingName ? (
          <input
            autoFocus
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setEditingName(false) }}
            style={{ width: '100%', fontSize: 13, fontWeight: 600, background: 'var(--surface3)', marginBottom: 6 }}
          />
        ) : (
          <div
            onClick={() => { setEditingName(true); setNameInput(clip.name) }}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title="Cliquez pour renommer"
          >
            {clip.name}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          {fmt(clip.start)} → {fmt(clip.end)}
          {hasSubtitles && <span style={{ marginLeft: 6, color: 'var(--text2)' }}>{clip.subtitles.length} répliques</span>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <ActionBtn onClick={() => onDub(clip)} accent title="Doublage" flex>
          ◉ Doubler
        </ActionBtn>
        <ActionBtn onClick={() => setWatching(true)} title="Voir le clip">
          ▶
        </ActionBtn>
        <ActionBtn onClick={() => onMeme?.(clip)} title="Créer un mème depuis ce clip">
          Mème
        </ActionBtn>
        <ActionBtn
          onClick={() => onExportMp3(clip)}
          title="Exporter MP3 — audio uniquement"
          disabled={exporting === clip.clip_id + '_mp3'}
        >
          {exporting === clip.clip_id + '_mp3' ? '…' : 'MP3'}
        </ActionBtn>
        <ActionBtn
          onClick={() => onExportGif(clip)}
          title="Exporter en GIF"
          disabled={exporting === clip.clip_id + '_gif'}
        >
          {exporting === clip.clip_id + '_gif' ? '…' : 'GIF'}
        </ActionBtn>
        {confirmDelete ? (
          <>
            <ActionBtn onClick={() => onDelete(clip.clip_id)} danger title="Confirmer la suppression">
              Suppr ?
            </ActionBtn>
            <ActionBtn onClick={() => setConfirmDelete(false)} title="Annuler">
              ✕
            </ActionBtn>
          </>
        ) : (
          <ActionBtn onClick={() => setConfirmDelete(true)} danger title="Supprimer">
            ✕
          </ActionBtn>
        )}
      </div>

      {/* View modal */}
      {watching && segmentUrl && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setWatching(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <div style={{ background: '#0e0e0e', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxWidth: '90vw', width: 800 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{clip.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{fmt(duration)}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setWatching(false)} style={{ color: 'var(--text2)', background: 'none', fontSize: 16, padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border2)' }}>✕</button>
            </div>
            <video
              src={segmentUrl}
              controls
              autoPlay
              style={{ display: 'block', width: '100%', background: '#000' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ children, onClick, accent, danger, title, flex, disabled }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: flex ? 1 : undefined,
        padding: '8px 10px',
        background: hover && !disabled
          ? (danger ? 'rgba(229,69,69,0.15)' : accent ? 'rgba(255,153,0,0.12)' : 'var(--surface3)')
          : 'transparent',
        color: disabled ? 'var(--text3)' : danger ? 'var(--danger)' : accent ? '#ff9900' : 'var(--text2)',
        fontSize: 11,
        fontWeight: accent ? 600 : 400,
        borderRight: '1px solid var(--border)',
        borderRadius: 0,
        transition: 'background 0.1s, color 0.1s',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}
