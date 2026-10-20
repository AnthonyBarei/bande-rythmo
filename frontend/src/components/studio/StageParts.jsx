import React, { useState, useEffect, useMemo } from 'react'
import { T, alpha, Icon, ICONS, Btn, Avatar, Kbd } from '../../ui'
import { TRACK_HEXES } from '../../config/tracks'
import { fmtSMPTE } from '../../utils/timecode'
import { adjacentLine, characterProgress } from '../../utils/studio'

// Image overlay timecode — follows the stage video (HH:MM:SS:FF).
export function StageClock({ videoRef, fps }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = videoRef?.current
      if (v) setT(Math.max(0, v.currentTime))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [videoRef])
  return <span>{fmtSMPTE(t, fps)}</span>
}

// Studio line strip (46px) — avatar, character in its track colour, the line
// in Caveat, TC in → out, per-character progress, previous / next réplique of
// the same character (any character when it has none that way). Changing
// réplique swaps the avatar and name at once and slides only the old text out
// (left = forward) over .2 s.
export function LineStrip({ subtitles, takes, index, fps, onSelectIndex }) {
  const charIndex = useMemo(() => {
    const seen = []
    for (const s of subtitles) {
      const c = s.character || ''
      if (!seen.includes(c)) seen.push(c)
    }
    return Object.fromEntries(seen.map((c, i) => [c, i]))
  }, [subtitles])
  const colorOf = sub => (sub ? TRACK_HEXES[(charIndex[sub.character || ''] || 0) % TRACK_HEXES.length] : T.border3)
  const [shownIndex, setShownIndex] = useState(index)
  const [leaving, setLeaving] = useState(null)        // { sub, dir: 'L' | 'R', key }
  if (index !== shownIndex) {
    setShownIndex(index)
    const prev = shownIndex != null ? subtitles[shownIndex] : null
    setLeaving(prev && index != null ? { sub: prev, dir: index > shownIndex ? 'L' : 'R', key: `${shownIndex}>${index}` } : null)
  }
  const target = index != null ? subtitles[index] : null
  const tc = colorOf(target)
  const n = subtitles.length
  const character = target ? target.character || '' : null
  const who = character || 'Sans personnage'
  const progress = useMemo(() => (character != null ? characterProgress(subtitles, takes, character) : null), [subtitles, takes, character])
  const step = dir => {
    const same = adjacentLine(subtitles, index, dir, true)
    return same != null ? { i: same, same: true } : { i: adjacentLine(subtitles, index, dir, false), same: false }
  }
  const prev = step(-1)
  const next = step(1)
  const navTitle = (s, label, key) => (!onSelectIndex ? 'Indisponible pendant l’enregistrement'
    : s.i == null ? `Aucune réplique ${label === 'précédente' ? 'avant' : 'après'}`
      : s.same && target ? `Réplique ${label} de ${who} (${key}) · Alt+${key} : tous les personnages`
        : `Réplique ${label} (Alt+${key})`)
  return (
    <div style={{ height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
      <Avatar name={target?.character || '?'} color={tc} size={30} ring />
      {target && <span style={{ fontSize: T.fs.sm, fontWeight: 700, color: tc, whiteSpace: 'nowrap', flexShrink: 0 }}>{who}</span>}
      <div style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        {target ? (
          <LineText key={index} sub={target} animation={leaving ? `stFrom${leaving.dir === 'L' ? 'R' : 'L'} .18s ease-out .12s both` : 'none'} />
        ) : (
          <span style={{ fontSize: T.fs.sm, color: T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            {n ? 'Choisissez une réplique — la prise y sera rattachée.' : 'Aucune réplique — la prise sera enregistrée comme prise libre.'}
          </span>
        )}
        {leaving && (
          <LineText key={leaving.key} sub={leaving.sub} leaving
            animation={`stOut${leaving.dir} .2s ease-in forwards`} onDone={() => setLeaving(null)} />
        )}
      </div>
      {target && <span style={{ fontSize: 11, color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{fmtSMPTE(target.start, fps)} → {fmtSMPTE(target.end, fps)}</span>}
      {progress && progress.total > 0 && (
        <span title={`Répliques de ${who} avec une prise validée / répliques de ${who}`}
          style={{ fontSize: 11, color: progress.done === progress.total ? T.success : T.text3, whiteSpace: 'nowrap' }}>
          {who} · <span style={{ fontFamily: T.fontMono }}>{progress.done}/{progress.total}</span> validées
        </span>
      )}
      {n > 0 && (
        <div style={{ display: 'flex', gap: 2 }}>
          <Btn size="sm" icon={ICONS.skipBack} title={navTitle(prev, 'précédente', '←')}
            disabled={!onSelectIndex || prev.i == null}
            onClick={() => prev.i != null && onSelectIndex?.(prev.i)} />
          <Btn size="sm" icon={ICONS.skipFwd} title={navTitle(next, 'suivante', '→')}
            disabled={!onSelectIndex || next.i == null}
            onClick={() => next.i != null && onSelectIndex?.(next.i)} />
        </div>
      )}
    </div>
  )
}

// The Caveat line alone — the avatar and name swap instantly, only this slides.
function LineText({ sub, animation, leaving = false, onDone }) {
  return (
    <div onAnimationEnd={leaving ? onDone : undefined} style={{
      display: 'flex', alignItems: 'center', minWidth: 0, maxWidth: '100%', animation,
      ...(leaving ? { position: 'absolute', inset: 0, pointerEvents: 'none' } : null),
    }}>
      <span title={sub.note ? `${sub.text} — ${sub.note}` : sub.text} style={{ fontSize: T.fs.md, color: T.text, fontFamily: "'Caveat', cursive", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{sub.text}</span>
    </div>
  )
}

// Studio A/B bar — [A ▶ 1.9s] [B ▶ 1.5s]  ⇄ basculer (Tab). The audible slot
// lights up. It carries the take durations the A/B cards may drop.
export function AbBar({ takeA, takeB, slot, onSlot, canSwap }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: 6, background: T.surface, border: `1px solid ${alpha(T.info, '44')}`, borderRadius: T.r.ctl }}>
      {[{ s: 'A', t: takeA, c: T.accent }, { s: 'B', t: takeB, c: T.info }].map(x => {
        const on = slot === x.s
        return (
          <button key={x.s} data-rd disabled={!x.t} onClick={() => onSlot(x.s)}
            title={x.t ? (on ? `Arrêter ${x.s}` : `Écouter ${x.s}`) : `Aucune prise ${x.s} — cliquez le + d’une carte`}
            style={{
              height: 30, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 9px 0 4px', borderRadius: T.r.chip,
              background: on ? alpha(x.c, '22') : T.surface2, border: `1px solid ${on ? x.c : T.border2}`,
              cursor: x.t ? 'pointer' : 'not-allowed', opacity: x.t ? 1 : 0.5,
            }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: alpha(x.c, '22'), color: x.c, fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{x.s}</span>
            <Icon d={on ? ICONS.pause : ICONS.play} size={12} stroke={on ? x.c : T.text} fill={on ? x.c : T.text} />
            {x.t && <span style={{ fontSize: 11, fontFamily: T.fontMono, color: on ? x.c : T.text3 }}>{(x.t.duration || 0).toFixed(1)}s</span>}
          </button>
        )
      })}
      <div style={{ flex: 1 }} />
      <span title={canSwap ? 'Basculer A ⇄ B à la même position' : 'Choisissez une prise A et une prise B'}
        style={{ fontSize: T.fs.xs, color: canSwap ? T.text2 : T.text3, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', paddingRight: 4 }}>
        <Icon d={ICONS.loop} size={13} stroke="currentColor" /> basculer <Kbd>Tab</Kbd>
      </span>
    </div>
  )
}
