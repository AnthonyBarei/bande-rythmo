import React from 'react'
import { T, Btn, Chip, Dot, Icon, ICONS, MenuItem, MenuLabel, MenuSep } from '../../ui'
import { TRACK_COLORS } from '../../config/tracks'
import { fmtSMPTE } from '../../utils/timecode'
import { CURSOR_X_RATIO } from '../band/bandRender'

const menuHeader = {
  padding: '7px 10px 5px', fontSize: 11, color: 'var(--text3)',
  borderBottom: '1px solid var(--border)', marginBottom: 4,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}

// Over the band canvas: the loop-region chip, the inline réplique editor and
// the réplique context menu.
export default function BandOverlays({
  subtitles, charMap, charList, numTracks, canvasH, canvasRef, pxPerSec, getBandTime, clipFps,
  loopRegion, onClearLoop, editing, ctxMenu, onCloseCtx, onCtxAction,
}) {
  return <>
    {loopRegion && (
      <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 5 }}>
        <Chip color={T.accent} soft style={{ fontFamily: T.fontMono, fontSize: 11, padding: '0 0 0 9px', gap: 4 }}>
          <Icon d={ICONS.loop} size={12} stroke={T.accent} /> {fmtSMPTE(loopRegion.start, clipFps)}–{fmtSMPTE(loopRegion.end, clipFps)}
          <Btn size="sm" icon={ICONS.close} onClick={onClearLoop} title="Effacer la boucle (Échap)" style={{ height: 24, minWidth: 24 }} />
        </Chip>
      </div>
    )}
    {editing.idx != null && (() => {
      const sub = subtitles[editing.idx]
      const canvas = canvasRef.current
      if (!sub || !canvas) return null
      const rect = canvas.getBoundingClientRect()
      const cur_x = rect.width * CURSOR_X_RATIO
      const t = getBandTime()
      const left = cur_x + (sub.start - t) * pxPerSec
      const right = cur_x + (sub.end - t) * pxPerSec
      const trackIdx = charMap[sub.character || ''] ?? 0
      const trackH = (rect.height || canvasH) / numTracks
      const top = trackIdx * trackH + trackH / 2 - 16
      const width = Math.max(120, right - left)
      const clampLeft = Math.max(4, Math.min(rect.width - width - 4, left))
      return (
        <input
          autoFocus
          value={editing.text}
          onChange={e => editing.setText(e.target.value)}
          onBlur={editing.commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); editing.commit() }
            if (e.key === 'Escape') { e.preventDefault(); editing.cancel() }
          }}
          style={{
            position: 'absolute', left: clampLeft, top, width,
            background: 'rgba(0,0,0,0.95)', color: '#fff',
            border: '2px solid var(--accent)', borderRadius: 4,
            padding: '4px 8px', fontFamily: 'var(--font-mono)',
            fontSize: 14, zIndex: 10, outline: 'none',
          }}
        />
      )
    })()}
    {ctxMenu && (() => {
      const sub = subtitles[ctxMenu.subIdx]
      if (!sub) return null
      const canSplit = ctxMenu.time > sub.start && ctxMenu.time < sub.end
      return (
        <>
          <div onClick={onCloseCtx} onContextMenu={e => { e.preventDefault(); onCloseCtx() }} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' }} />
          <div style={{
            position: 'fixed', left: Math.max(4, Math.min(ctxMenu.x, window.innerWidth - 240)),
            ...(ctxMenu.y > window.innerHeight / 2 ? { bottom: window.innerHeight - ctxMenu.y } : { top: ctxMenu.y }),
            maxHeight: '80vh', overflowY: 'auto', zIndex: 'var(--z-dropdown)', minWidth: 210,
            background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 6 }}>
            <div style={menuHeader}>{sub.character || '(défaut)'} · {sub.text.slice(0, 30) || '∅'}</div>
            <MenuItem icon={ICONS.edit} onClick={() => onCtxAction('edit')}>Éditer le texte</MenuItem>
            {canSplit && <MenuItem icon={ICONS.scissors} onClick={() => onCtxAction('split')}>Couper ici ({fmtSMPTE(ctxMenu.time, clipFps)})</MenuItem>}
            <MenuItem icon={ICONS.plus} onClick={() => onCtxAction('duplicate')}>Dupliquer après</MenuItem>
            <MenuItem icon={ICONS.start} onClick={() => onCtxAction('seekStart')}>Aller au début ({fmtSMPTE(sub.start, clipFps)})</MenuItem>
            <MenuItem icon={ICONS.end} onClick={() => onCtxAction('seekEnd')}>Aller à la fin ({fmtSMPTE(sub.end, clipFps)})</MenuItem>
            <MenuSep />
            <MenuLabel>Personnage</MenuLabel>
            {charList.map(c => {
              const cc = TRACK_COLORS[(charMap[c] ?? 0) % TRACK_COLORS.length].hex
              return (
                <MenuItem key={c || '_default'} onClick={() => onCtxAction('character', c)} active={c === (sub.character || '')} color={cc}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={cc} size={8} />{c || '(défaut)'}</span>
                </MenuItem>
              )
            })}
            <MenuItem icon={ICONS.user} onClick={() => onCtxAction('newCharacter')}>Nouveau / renommer…</MenuItem>
            <MenuSep />
            <MenuItem icon={ICONS.trash} onClick={() => onCtxAction('delete')} danger>Supprimer</MenuItem>
          </div>
        </>
      )
    })()}
  </>
}
