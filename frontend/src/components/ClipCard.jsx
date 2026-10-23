import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { T, Icon, ICONS, Avatar, Btn, Dot, alpha, pressable } from '../ui'
import { TRACK_HEXES } from '../config/tracks'
import { useToast } from '../ToastContext'
import { fmtDuration } from '../utils/duration'

// Reference data.jsx → STATUS (alpha '24' = .14, keeps the accent swappable).
const STATUS = {
  todo:    { label: 'À faire',  color: T.text3,   bg: T.surface2 },
  dubbing: { label: 'Doublage', color: T.accent,  bg: alpha(T.accent, '24') },
  review:  { label: 'À revoir', color: T.info,    bg: alpha(T.info, '24') },
  done:    { label: 'Validé',   color: T.success, bg: alpha(T.success, '24') },
}
const STATUS_CYCLE = ['todo', 'dubbing', 'review', 'done']

function hashHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

export default function ClipCard({ clip, onDub, onRecord, onMeme, onDelete, onRename, onStatusChange, onMove }) {
  const toast = useToast()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(clip.name)
  const [h, setH] = useState(false)
  const [watching, setWatching] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mp3Busy, setMp3Busy] = useState(false)
  const renameDoneRef = useRef(false)
  const duration = clip.end - clip.start
  const curStatusKey = clip.status || 'todo'
  const st = STATUS[curStatusKey] || STATUS.todo
  const nextStatusKey = STATUS_CYCLE[(STATUS_CYCLE.indexOf(curStatusKey) + 1) % STATUS_CYCLE.length]

  useEffect(() => {
    if (!watching) return
    const onKey = e => { if (e.key === 'Escape') setWatching(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [watching])

  const replCount = clip.subtitles?.length || 0
  const segmentUrl = clip.segment_path ? `/${clip.segment_path}` : null
  const thumbSrc = clip.thumbnail_path ? `/${clip.thumbnail_path}` : null
  const hue = hashHue(clip.name || clip.clip_id)

  const chars = []
  for (const s of clip.subtitles || []) {
    const c = s.character || ''
    if (c && !chars.includes(c)) chars.push(c)
  }
  // FIXES_R8 #7: the hover action row covers the meta row — the thumbnail
  // tooltip carries the same information.
  const metaTip = [
    clip.name,
    `${replCount} répl.`,
    chars.length ? chars.join(', ') : null,
  ].filter(Boolean).join(' · ')

  // Enter/Escape unmount the input, which also fires blur — commit only once.
  function submitRename() {
    if (renameDoneRef.current) return
    renameDoneRef.current = true
    const n = nameInput.trim()
    if (n && n !== clip.name) onRename(clip.clip_id, n)
    setEditingName(false)
  }

  function startRename(e) {
    e.stopPropagation()
    renameDoneRef.current = false
    setNameInput(clip.name)
    setEditingName(true)
  }

  function cycleStatus(e) {
    e.stopPropagation()
    onStatusChange(clip.clip_id, nextStatusKey)
  }

  async function exportMp3() {
    if (mp3Busy) return
    setMp3Busy(true)
    try {
      const res = await fetch('/api/export/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_id: clip.clip_id, subtitles: [], format: 'mp3' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.name || clip.clip_id}.mp3`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error(err)
      toast.error(`Export MP3 échoué : ${err.message}`)
    } finally {
      setMp3Busy(false)
    }
  }

  const cells = [
    { ic: ICONS.mic, title: 'Enregistrer — Studio', fn: () => (onRecord || onDub)(clip) },
    { label: 'MP3', title: 'Exporter MP3 — audio uniquement', fn: exportMp3, busy: mp3Busy },
    { label: 'GIF', title: 'Créer un GIF depuis ce clip (Atelier)', fn: () => onMeme(clip, 'video') },
    confirmDelete
      ? { ic: ICONS.check, danger: true, title: 'Confirmer la suppression', fn: () => onDelete(clip.clip_id) }
      : { ic: ICONS.trash, danger: true, title: 'Supprimer', fn: () => setConfirmDelete(true) },
  ]

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => { setH(false); setConfirmDelete(false) }}
      onClick={() => onDub(clip)}
      className="clip-card"
      style={{
        background: T.surface, border: `1px solid ${h ? T.border2 : T.border}`, borderRadius: T.r.card,
        overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s, transform .15s, box-shadow .15s',
        transform: h ? 'translateY(-3px)' : 'none', boxShadow: h ? T.shadow : 'none',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}>
      {/* Thumb */}
      <div title={metaTip} style={{
        height: 168, flexShrink: 0, position: 'relative',
        background: `linear-gradient(135deg, hsl(${hue},22%,20%), hsl(${hue + 40},20%,12%))`,
      }}>
        {thumbSrc && <img src={thumbSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,.16) 3px 4px)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            data-rd
            onClick={e => { e.stopPropagation(); if (segmentUrl) setWatching(true) }}
            title="Voir le clip"
            style={{
              width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,.45)',
              border: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(8px)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              opacity: h ? 1 : 0.85, transform: h ? 'scale(1.08)' : 'scale(1)', transition: 'all .15s',
            }}>
            <Icon d={ICONS.play} size={18} fill="#fff" stroke="#fff" />
          </button>
        </div>
        <button
          data-rd
          onClick={cycleStatus}
          title={`Statut : ${st.label} — cliquer pour passer à « ${STATUS[nextStatusKey].label} »`}
          style={{
            position: 'absolute', top: 10, left: 10, padding: '3px 9px', borderRadius: 6, border: 'none',
            fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
            background: st.bg, color: st.color, backdropFilter: 'blur(6px)', cursor: 'pointer', fontFamily: T.fontUI,
          }}>{st.label}</button>
        {onMove && (
          /* Top-right of the thumbnail so the hover action row never covers it;
             only on hover / focus (FIXES_R5 #8, CSS .clip-card-project). */
          <button
            data-rd
            className="clip-card-project"
            onClick={e => { e.stopPropagation(); onMove(clip) }}
            title="Déplacer vers un autre projet"
            style={{
              position: 'absolute', top: 10, right: 10, padding: '3px 9px', borderRadius: 6, border: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, fontFamily: T.fontUI, cursor: 'pointer',
              background: 'rgba(0,0,0,.6)', color: '#fff', backdropFilter: 'blur(6px)',
              transition: 'opacity .15s',
            }}>
            <Icon d={ICONS.folder} size={12} stroke="currentColor" style={{ flexShrink: 0 }} />
            Déplacer
          </button>
        )}
        <div style={{
          position: 'absolute', bottom: 10, right: 10, padding: '2px 8px', borderRadius: 5,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,.7)', color: '#fff',
        }}>{fmtDuration(duration)}</div>
      </div>

      {/* Body */}
      <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              if (e.key === 'Escape') { renameDoneRef.current = true; setEditingName(false) }
            }}
            style={{
              width: '100%', fontSize: T.fs.base, fontWeight: 600, lineHeight: 1.35, fontFamily: T.fontUI,
              color: T.text, background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: T.r.chip,
              padding: '0 6px', outline: 'none',
            }}
          />
        ) : (
          <div onClick={startRename} {...pressable(true)} title="Cliquez pour renommer"
            style={{ fontSize: T.fs.base, fontWeight: 600, lineHeight: 1.35, textWrap: 'pretty' }}>{clip.name}</div>
        )}
        {/* minHeight = avatar size: every body is as tall, so the 44px hover row
            only ever covers the meta row, never the title (final pass). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 22 }}>
          <span style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono }}>{replCount} répl.</span>
          {chars.length > 0 && <Dot color={T.border3} size={3} />}
          {chars.length > 0 && (
            <div style={{ display: 'flex' }}>
              {chars.slice(0, 4).map((ch, i) => (
                <div key={ch} title={ch} style={{ marginLeft: i ? -6 : 0 }}>
                  <Avatar name={ch} color={TRACK_HEXES[i % TRACK_HEXES.length]} size={22} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions — revealed on hover / keyboard focus by CSS (.clip-card-actions
          in index.css, FIXES_R8 #7 + FINAL_REVIEW #2): overlaid on the bottom of
          the body, sliding up 8px with a fade, so the card height never changes.
          :focus-within applies before the next Tab, so fast Tab presses reach
          the row. Touch screens (hover: none) keep it in flow, always visible. */}
      <div className="clip-card-actions" style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', borderTop: `1px solid ${T.border}`, height: 44, flexShrink: 0,
        background: T.surface, overflow: 'hidden',
      }}>
        <button data-rd className="focus-inset" onClick={e => { e.stopPropagation(); onDub(clip) }} title="Doublage" style={{
          height: 44, padding: '0 14px', background: 'transparent', border: 'none', borderRight: `1px solid ${T.border}`,
          color: T.accent, fontWeight: 600, fontSize: T.fs.sm, cursor: 'pointer', fontFamily: T.fontUI,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <Icon d={ICONS.edit} size={15} stroke={T.accent} /> Doubler
        </button>
        {cells.map((a, i) => (
          <button data-rd key={i} className="focus-inset" title={a.title} disabled={a.busy}
            onClick={e => { e.stopPropagation(); a.fn() }} style={{
              width: 44, height: 44, background: 'transparent', border: 'none',
              borderRight: i < 3 ? `1px solid ${T.border}` : 'none',
              color: a.danger ? alpha(T.danger, 'cc') : T.text3, cursor: a.busy ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.fontMono, fontSize: 10, fontWeight: 700, opacity: a.busy ? 0.5 : 1,
            }}>
            {a.ic ? <Icon d={a.ic} size={15} stroke="currentColor" /> : a.label}
          </button>
        ))}
      </div>

      {watching && segmentUrl && createPortal(
        <div role="dialog" aria-modal="true" aria-label={clip.name}
          onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) setWatching(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-modal)',
          }}
        >
          <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.card, overflow: 'hidden', maxWidth: '90vw', width: 800 }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: T.fs.sm, fontWeight: 600 }}>{clip.name}</span>
              <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{fmtDuration(duration)}</span>
              <div style={{ flex: 1 }} />
              <Btn size="sm" icon={ICONS.close} onClick={() => setWatching(false)} title="Fermer" />
            </div>
            <video src={segmentUrl} controls autoPlay style={{ display: 'block', width: '100%', background: '#000' }} />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
