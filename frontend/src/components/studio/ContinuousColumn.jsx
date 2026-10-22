import React, { useCallback, useEffect, useRef } from 'react'
import { T, alpha, Icon, ICONS, Dot } from '../../ui'
import { fmtSMPTE } from '../../utils/timecode'
import { spokenText } from '../../utils/lineRate'
import { RoleProgress } from './TakesColumn'

export const RANGE_LABELS = { from: 'Depuis la réplique courante', all: 'Tout le clip', inout: 'Plage IN/OUT' }

// A hand scroll of the list holds the auto-follow this long.
const FOLLOW_HOLD_MS = 4000

// The réplique text; a slot with no text says so, one with only marks
// (breath, pause) shows the marks (FIXES_STUDIO_R2 #4).
function LineLabel({ text, todo }) {
  const raw = (text || '').trim()
  const base = { flex: 1, minWidth: 0, fontSize: T.fs.xs, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  if (!raw) return <span style={{ ...base, color: T.text3, fontStyle: 'italic' }}>(sans texte)</span>
  if (!spokenText(raw)) return <span title="Marques seules" style={{ ...base, color: T.text3, fontFamily: T.fontMono }}>{raw}</span>
  return <span style={{ ...base, color: todo ? T.text2 : T.text }}>{raw}</span>
}

// While recording, the live row sits second from the top (smooth scrollTop,
// never scrollIntoView — it would scroll the page too). A hand scroll holds
// the follow for 4 s, then the list catches up.
function useFollowLive(listRef, curI, recording) {
  const heldUntil = useRef(0)
  const timer = useRef(0)
  const follow = useCallback(() => {
    const list = listRef.current
    if (!list || curI == null || performance.now() < heldUntil.current) return
    const row = list.querySelector(`[data-line="${curI}"]`)
    if (!row) return
    const above = row.previousElementSibling
    list.scrollTo({ top: above ? above.offsetTop : 0, behavior: 'smooth' })
  }, [listRef, curI])
  useEffect(() => { if (recording) follow() }, [recording, follow])
  useEffect(() => () => clearTimeout(timer.current), [])
  const followRef = useRef(follow)
  useEffect(() => { followRef.current = recording ? follow : () => {} })
  return useCallback(() => {
    heldUntil.current = performance.now() + FOLLOW_HOLD_MS
    clearTimeout(timer.current)
    timer.current = setTimeout(() => followRef.current(), FOLLOW_HOLD_MS + 50)
  }, [])
}

// En continu: the range's répliques instead of the takes — ● while it is
// being recorded, ✓ once passed; « validée » when a validated take is kept.
export default function ContinuousColumn({ subtitles, lines, captured, curI, recording, validated, rangeKind, fps, role, error }) {
  const listRef = useRef(null)
  const holdFollow = useFollowLive(listRef, curI, recording)
  const first = lines.length ? subtitles[lines[0]] : null
  const last = lines.length ? subtitles[lines[lines.length - 1]] : null
  return (
    <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, paddingBottom: 'var(--toast-safe-bottom, 0px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minHeight: 24 }}>
        <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>SESSION CONTINUE</span>
        <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{captured.length}/{lines.length}</span>
      </div>
      {first && (
        <div style={{ marginTop: -6, display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: T.fs.xs, color: T.text2 }}>{RANGE_LABELS[rangeKind]}</span>
          <span style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>
            {fmtSMPTE(first.start, fps)} → {fmtSMPTE(last.end, fps)}
          </span>
        </div>
      )}
      {error && (
        <div style={{ fontSize: T.fs.micro, color: T.danger, background: alpha(T.danger, '22'), padding: '6px 8px', borderRadius: T.r.chip }}>{error}</div>
      )}
      <div ref={listRef} onWheel={holdFollow} onTouchStart={holdFollow} onPointerDown={holdFollow}
        style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
        {!lines.length && (
          <div style={{ border: `2px dashed ${T.border2}`, borderRadius: T.r.ctl, padding: 18, fontSize: T.fs.xs, color: T.text3, textAlign: 'center' }}>
            Aucune réplique de ce rôle dans la plage.
          </div>
        )}
        {lines.map(i => {
          const s = subtitles[i]
          const st = captured.includes(i) ? 'done' : recording && curI === i ? 'live' : 'todo'
          return (
            <div key={i} data-line={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: T.surface, border: `1px solid ${st === 'live' ? alpha(T.danger, '88') : T.border}`, borderRadius: T.r.ctl, flexShrink: 0 }}>
              <span style={{ width: 14, display: 'flex', justifyContent: 'center' }}>
                {st === 'done' ? <Icon d={ICONS.check} size={13} stroke={T.success} /> : <Dot color={st === 'live' ? T.danger : T.border3} size={7} pulse={st === 'live'} />}
              </span>
              <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>#{String(i + 1).padStart(2, '0')}</span>
              <LineLabel text={s.text} todo={st === 'todo'} />
              {validated.has(i) && <span title="Une prise est déjà validée, elle sera conservée" style={{ fontSize: 10.5, color: T.text3 }}>validée</span>}
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.5, textWrap: 'pretty', flexShrink: 0 }}>
        Un seul passage, découpé en une prise « continu » par réplique. Espace met en pause ; la reprise repart du début de la réplique interrompue.
      </div>
      <RoleProgress role={role} />
    </div>
  )
}
