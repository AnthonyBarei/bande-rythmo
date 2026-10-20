import React, { useState, useEffect, useMemo } from 'react'
import { T, alpha, Icon, ICONS, Btn, Chip, Kbd } from '../../ui'
import { fmtSMPTE } from '../../utils/timecode'
import { adjacentLine } from '../../utils/studio'

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

// Studio line strip (46px) — #NN · the line in Caveat · validée · TC in → out ·
// previous / next réplique of the role (STUDIO_V2 reference). Changing
// réplique slides only the old text out (left = forward) over .2 s;
// `animate` false (En continu) swaps it at once.
export function LineStrip({ subtitles, takes, index, fps, onSelectIndex, roleLabel, animate = true }) {
  const [shownIndex, setShownIndex] = useState(index)
  const [leaving, setLeaving] = useState(null)        // { sub, dir: 'L' | 'R', key }
  if (index !== shownIndex) {
    setShownIndex(index)
    const prev = shownIndex != null ? subtitles[shownIndex] : null
    setLeaving(animate && prev && index != null ? { sub: prev, dir: index > shownIndex ? 'L' : 'R', key: `${shownIndex}>${index}` } : null)
  }
  const target = index != null ? subtitles[index] : null
  const validated = useMemo(() => index != null && takes.some(t => t.best && t.subtitle_index === index), [takes, index])
  const prev = adjacentLine(subtitles, index, -1, true)
  const next = adjacentLine(subtitles, index, 1, true)
  const navTitle = (i, label, key) => (!onSelectIndex ? 'Indisponible pendant la prise'
    : i == null ? `Aucune réplique de ${roleLabel} ${label === 'précédente' ? 'avant' : 'après'}`
      : `Réplique ${label} de ${roleLabel} (${key}) · Alt+${key} : tous les personnages`)
  return (
    <div style={{ height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
      {target && <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>#{String(index + 1).padStart(2, '0')}</span>}
      <div style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        {target ? (
          <LineText key={index} sub={target} animation={leaving ? `stFrom${leaving.dir === 'L' ? 'R' : 'L'} .18s ease-out .12s both` : 'none'} />
        ) : (
          <span style={{ fontSize: T.fs.sm, color: T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Aucune réplique à enregistrer.</span>
        )}
        {leaving && (
          <LineText key={leaving.key} sub={leaving.sub} leaving
            animation={`stOut${leaving.dir} .2s ease-in forwards`} onDone={() => setLeaving(null)} />
        )}
      </div>
      {validated && <Chip soft color={T.success}><Icon d={ICONS.check} size={10} stroke={T.success} /> validée</Chip>}
      {target && <span style={{ fontSize: 11, color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{fmtSMPTE(target.start, fps)} → {fmtSMPTE(target.end, fps)}</span>}
      {target && (
        <div style={{ display: 'flex', gap: 2 }}>
          <Btn size="sm" icon={ICONS.skipBack} title={navTitle(prev, 'précédente', '←')}
            disabled={!onSelectIndex || prev == null} onClick={() => prev != null && onSelectIndex?.(prev)} />
          <Btn size="sm" icon={ICONS.skipFwd} title={navTitle(next, 'suivante', '→')}
            disabled={!onSelectIndex || next == null} onClick={() => next != null && onSelectIndex?.(next)} />
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
