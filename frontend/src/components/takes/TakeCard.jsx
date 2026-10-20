import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { T, alpha, Icon, ICONS, Btn, Chip, pressable } from '../../ui'
import { METER_FLOOR, takePeaks } from '../../utils/takeAudio'

// Studio take card + mini waveform.

// Mini waveform decoded from the take file (cached per url). With `progress`
// (0..1, playing; `clock` = frame time in ms): the played part fills `playedColor`, bars within ±6 % of the
// playhead bounce, and a 2px glowing playhead runs across.
function TakeWave({ url, bars = 56, height = 30, gap = 1.5, barWidth, color, progress = null, clock = 0, playedColor }) {
  const [peaks, setPeaks] = useState(null)
  useEffect(() => {
    if (!url) return
    let live = true
    takePeaks(url, bars)
      .then(p => { if (live) setPeaks(p) })
      .catch(e => console.warn('Forme d’onde indisponible', url, e))
    return () => { live = false; setPeaks(null) }
  }, [url, bars])
  const pl = progress != null
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap, height, flex: barWidth ? undefined : 1 }}>
      {Array.from({ length: bars }, (_, i) => {
        const base = peaks?.[i] ?? METER_FLOOR
        const f = i / bars
        const played = pl && f <= progress
        const near = pl && Math.abs(f - progress) < 0.06
        const h = near ? Math.min(1, base * (1.25 + 0.35 * Math.sin(clock / 70 + i))) : base
        return (
          <div key={i} style={{
            ...(barWidth ? { width: barWidth } : { flex: 1 }),
            height: `${Math.max(METER_FLOOR, h) * 100}%`, background: played ? playedColor : color, borderRadius: 1,
            transition: near ? 'none' : 'background .1s',
          }} />
        )
      })}
      {pl && <div style={{ position: 'absolute', left: `${progress * 100}%`, top: -3, bottom: -3, width: 2, background: '#fff', borderRadius: 1, boxShadow: '0 0 6px rgba(255,255,255,.6)', pointerEvents: 'none' }} />}
    </div>
  )
}

const CARD_ROW_GAP = 6

// Whether the take duration fits in the card row. It is the first thing to go
// when the row is short (Studio A/B: chip + A/B pill) — the "validée" chip stays.
// Hidden, the duration is still laid out off-flow, so its width stays measurable.
function useDurationFits(rowRef, spacerRef, durRef) {
  const [fits, setFits] = useState(true)
  const check = useCallback(() => {
    const row = rowRef.current
    const spacer = spacerRef.current
    const dur = durRef.current
    if (!row || !spacer || !dur) return
    setFits(was => (was
      ? row.scrollWidth <= row.clientWidth
      : spacer.offsetWidth >= dur.offsetWidth + CARD_ROW_GAP))
  }, [rowRef, spacerRef, durRef])
  useLayoutEffect(check)
  useEffect(() => {
    const row = rowRef.current
    if (!row || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(check)
    ro.observe(row)
    return () => ro.disconnect()
  }, [rowRef, check])
  return fits
}

// `onImage` (Studio only): null = no "écouter sur l'image" button, else whether
// this take is playing over the image.
export function TakeCard({ take, label, selected, fresh, isPlaying, progress, clock, onImage = null, onImageDisabled, ab, showAB, onSelect, onPlay, onPlayOnImage, onAB, onDelete }) {
  const best = !!take.best
  const dur = take.duration || 0
  const audioOnly = isPlaying && !onImage
  const abColor = ab === 'A' ? T.accent : ab === 'B' ? T.info : null
  const rowRef = useRef(null)
  const spacerRef = useRef(null)
  const durRef = useRef(null)
  const durFits = useDurationFits(rowRef, spacerRef, durRef)
  return (
    <div onClick={onSelect} {...pressable(onSelect)} className="focus-inset" style={{
      background: T.surface,
      border: `1px solid ${selected ? T.accent : best ? alpha(T.accent, '55') : ab ? T.border3 : T.border}`,
      borderRadius: T.r.ctl, padding: 12, flexShrink: 0, cursor: 'pointer',
      animation: fresh ? 'stIn .35s ease-out' : 'none',
    }}>
      <div ref={rowRef} style={{ display: 'flex', alignItems: 'center', gap: onImage != null ? CARD_ROW_GAP : 9, marginBottom: 9, position: 'relative' }}>
        <button data-rd onClick={e => { e.stopPropagation(); onPlay() }} title={audioOnly ? 'Pause' : 'Écouter'} style={{
          width: 30, height: 30, borderRadius: T.r.chip, border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
          background: audioOnly ? T.accent : T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon d={audioOnly ? ICONS.pause : ICONS.play} size={13} stroke={audioOnly ? '#0b0b0d' : T.text} fill={audioOnly ? '#0b0b0d' : T.text} />
        </button>
        {onImage != null && (
          <Btn size="sm" active={onImage} disabled={onImageDisabled && !onImage} icon={onImage ? ICONS.stop : ICONS.film}
            title={onImageDisabled && !onImage ? 'Indisponible pendant l’enregistrement' : onImage ? 'Arrêter l’écoute sur l’image (Échap)' : 'Écouter sur l’image'}
            onClick={e => { e?.stopPropagation?.(); onPlayOnImage() }} />
        )}
        <span style={{ fontSize: T.fs.sm, fontWeight: 600, color: T.text, minWidth: 0, flexShrink: label.length <= 12 ? 0 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {best && <Chip color={T.accent} soft style={{ flexShrink: 0 }}><Icon d={ICONS.check} size={10} stroke={T.accent} /> validée</Chip>}
        {take.label && <Chip soft color={T.text3} style={{ flexShrink: 0 }}>{take.label}</Chip>}
        <div ref={spacerRef} style={{ flex: 1 }} />
        <span ref={durRef} aria-hidden={!durFits} style={{
          fontSize: 11, color: isPlaying ? T.accent : T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap', flexShrink: 0,
          ...(durFits ? null : { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }),
        }}>
          {isPlaying ? `${((progress || 0) * dur).toFixed(1)} / ` : ''}{dur.toFixed(1)}s
        </span>
        {showAB && (ab
          ? (
            <Btn size="sm" active onClick={e => { e?.stopPropagation?.(); onAB() }}
              title={`Prise ${ab} — cliquer pour retirer`}
              style={{ padding: '0 7px', fontWeight: 700, color: abColor, background: alpha(abColor, '22') }}>
              {ab}
            </Btn>
          ) : (
            <Btn size="sm" variant="outline" icon={ICONS.plus} title="Assigner A / B"
              onClick={e => { e?.stopPropagation?.(); onAB() }} />
          ))}
        <Btn size="sm" icon={ICONS.trash} title="Supprimer" onClick={e => { e?.stopPropagation?.(); onDelete() }} />
      </div>
      <TakeWave url={take.audio_url} color={selected || best ? alpha(T.accent, '55') : T.border3} playedColor={T.accent} progress={isPlaying ? (progress || 0) : null} clock={clock} />
    </div>
  )
}
