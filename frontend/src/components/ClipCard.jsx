import React, { useState, useEffect } from 'react'
import { Icon, ICONS } from '../Icons'

const fmt = t => {
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(0).padStart(2, '0')
  return `${m}:${s}`
}

const STATUS = {
  todo:    { label: 'À faire',  bg: 'rgba(255,255,255,0.04)', fg: 'var(--text2)' },
  dubbing: { label: 'Doublage', bg: 'var(--accent-soft)',     fg: 'var(--accent)' },
  review:  { label: 'À revoir', bg: 'var(--info-soft)',       fg: 'var(--info)' },
  done:    { label: 'Validé',   bg: 'var(--success-soft)',    fg: 'var(--success)' },
}
const STATUS_CYCLE = ['todo', 'dubbing', 'review', 'done']

// Stable hash → hue, for thumbnail fallback color
function hashHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

const TRACK_HEX = ['#f5c518', '#7ec0ff', '#f08aaf', '#7ed4a8']

export default function ClipCard({ clip, onDub, onMeme, onDelete, onRename, onStatusChange, onAssignProject }) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(clip.name)
  const [hover, setHover] = useState(false)
  const [watching, setWatching] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const duration = clip.end - clip.start
  const status = STATUS[clip.status] || STATUS.todo

  useEffect(() => {
    if (!watching) return
    const onKey = e => { if (e.key === 'Escape') setWatching(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [watching])

  const hasSubtitles = clip.subtitles && clip.subtitles.length > 0
  const segmentUrl = clip.segment_path ? `/${clip.segment_path}` : null
  const thumbSrc = clip.thumbnail_path ? `/${clip.thumbnail_path}` : null

  // Unique characters → stacked avatars
  const chars = []
  for (const s of clip.subtitles || []) {
    const c = s.character || ''
    if (c && !chars.includes(c)) chars.push(c)
  }

  function submitRename() {
    const n = nameInput.trim()
    if (n && n !== clip.name) onRename(clip.clip_id, n)
    setEditingName(false)
  }

  function cycleStatus(e) {
    e.stopPropagation()
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(clip.status || 'todo') + 1) % STATUS_CYCLE.length]
    onStatusChange(clip.clip_id, next)
  }

  const curStatusKey = clip.status || 'todo'
  const nextStatusKey = STATUS_CYCLE[(STATUS_CYCLE.indexOf(curStatusKey) + 1) % STATUS_CYCLE.length]
  const nextLabel = STATUS[nextStatusKey].label

  const hue = hashHue(clip.name || clip.clip_id)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setConfirmDelete(false) }}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hover ? 'var(--border2)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.15s, transform 0.15s',
        transform: hover ? 'translateY(-2px)' : 'none',
        cursor: 'pointer',
      }}
      onClick={() => onDub(clip)}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: `hsl(${hue} 32% 16%)` }}>
        {thumbSrc ? (
          <img src={thumbSrc} alt={clip.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : null}
        {/* Scan-line overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,.18) 3px 4px)',
          pointerEvents: 'none',
        }} />
        {/* Status pill — click cycles todo → dubbing → review → done.
            Discoverability: explicit chevron + tooltip showing next state. */}
        <button
          onClick={cycleStatus}
          title={`Statut : ${status.label} — cliquer pour passer à « ${nextLabel} »`}
          style={{
            position: 'absolute', top: 8, left: 8,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: status.bg, color: status.fg,
            fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase', padding: '4px 8px',
            borderRadius: 4, border: '1px solid rgba(255,255,255,0.10)',
            cursor: 'pointer',
            minHeight: 22,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface3)' }}
          onMouseLeave={e => { e.currentTarget.style.background = status.bg }}
        >
          {status.label}
          <span style={{ fontSize: 8, opacity: 0.8 }}>▸</span>
        </button>
        {/* Duration pill */}
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          background: 'rgba(0,0,0,0.7)', color: '#fff',
          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
          fontFamily: 'var(--font-mono)',
        }}>
          {fmt(duration)}
        </div>
        {/* Blurred play button */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hover ? 1 : 0.85, transition: 'opacity 0.15s',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', paddingLeft: 3,
          }}>
            <Icon d={ICONS.play} size={18} fill="#fff" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '11px 14px', flex: 1 }}>
        {editingName ? (
          <input
            autoFocus
            value={nameInput}
            onClick={e => e.stopPropagation()}
            onChange={e => setNameInput(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') submitRename()
              if (e.key === 'Escape') setEditingName(false)
            }}
            style={{ width: '100%', fontSize: 13, fontWeight: 500 }}
          />
        ) : (
          <div
            onClick={e => { e.stopPropagation(); setEditingName(true); setNameInput(clip.name) }}
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textWrap: 'pretty', marginBottom: 5 }}
            title="Cliquez pour renommer"
          >
            {clip.name}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          <span>{hasSubtitles ? `${clip.subtitles.length} répl.` : 'aucune réplique'}</span>
          {onAssignProject && (
            <button
              onClick={e => { e.stopPropagation(); onAssignProject(clip.clip_id) }}
              title={clip.project ? `Projet : ${clip.project} — cliquez pour changer` : 'Assigner à un projet'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px',
                background: clip.project ? 'var(--accent-soft)' : 'transparent',
                color: clip.project ? 'var(--accent)' : 'var(--text4)',
                border: `1px solid ${clip.project ? 'rgba(245,197,24,0.35)' : 'var(--border)'}`,
                borderRadius: 99, fontSize: 9.5, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
              {clip.project ? `📁 ${clip.project}` : '+ projet'}
            </button>
          )}
          {chars.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {chars.slice(0, 4).map((c, i) => (
                <div key={c} title={c} style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: TRACK_HEX[i % TRACK_HEX.length],
                  border: '1.5px solid var(--surface)',
                  marginLeft: i === 0 ? 0 : -5,
                }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', borderTop: '1px solid var(--border)' }}>
        <ActionBtn onClick={e => { e.stopPropagation(); onDub(clip) }} accent flex title="Doublage">
          Doubler
        </ActionBtn>
        <ActionBtn onClick={e => { e.stopPropagation(); setWatching(true) }} title="Voir le clip">
          <Icon d={ICONS.play} size={13} />
        </ActionBtn>
        <ActionBtn onClick={e => { e.stopPropagation(); onMeme(clip, 'video') }} title="Créer un GIF depuis ce clip">
          GIF
        </ActionBtn>
        <ActionBtn onClick={e => { e.stopPropagation(); onMeme(clip) }} title="Créer un meme — image, GIF ou audio">
          Meme
        </ActionBtn>
        {confirmDelete ? (
          <ActionBtn onClick={e => { e.stopPropagation(); onDelete(clip.clip_id) }} danger title="Confirmer la suppression" last>
            <Icon d={ICONS.check} size={13} />
          </ActionBtn>
        ) : (
          <ActionBtn onClick={e => { e.stopPropagation(); setConfirmDelete(true) }} danger title="Supprimer" last>
            <Icon d={ICONS.trash} size={13} />
          </ActionBtn>
        )}
      </div>

      {/* View modal */}
      {watching && segmentUrl && (
        <div
          onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) setWatching(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          }}
        >
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxWidth: '90vw', width: 800 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{clip.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{fmt(duration)}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setWatching(false)} style={{ color: 'var(--text2)', background: 'none', fontSize: 16, padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border2)' }}>✕</button>
            </div>
            <video src={segmentUrl} controls autoPlay style={{ display: 'block', width: '100%', background: '#000' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ children, onClick, accent, danger, title, flex, disabled, mono, last }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '8px 11px',
        background: hover && !disabled
          ? (danger ? 'var(--danger-soft)' : accent ? 'var(--accent-soft)' : 'var(--hover)')
          : 'transparent',
        color: disabled ? 'var(--text3)' : danger ? 'var(--danger)' : accent ? 'var(--accent)' : 'var(--text2)',
        fontSize: mono ? 10 : 11.5,
        fontWeight: accent ? 600 : mono ? 700 : 400,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
        borderRight: last ? 'none' : '1px solid var(--border)',
        borderRadius: 0,
        transition: 'background 0.1s, color 0.1s',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}
