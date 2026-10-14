import React, { useEffect, useState } from 'react'
import { T, alpha, Btn, ICONS, Popover, Select } from '../../ui'
import { activeIndexAt } from '../../utils/band'
import { RespMenu, ReactMenu, StateMenu, PlansMenu, NoteMenu } from './BandMenus'
import StylePanel from './StylePanel'

const BUNDLED_FONTS = [
  { v: 'atkinson', l: 'Atkinson' },
  { v: 'lisible', l: 'Manuscrite lisible' },
  { v: 'cursive', l: 'Manuscrite' },
  { v: 'inter', l: 'Inter' },
  { v: 'jetbrains', l: 'Mono' },
]

function Cluster({ children }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, padding: 3 }}>{children}</div>
  )
}

// Band toolbar — reference screen-editor.jsx › BandToolbar (clusters).
export default function BandToolbar({
  subtitles, onSubtitlesChange, selectedIdx, setSelectedIdx, getBandTime,
  onAddSub, loopRegion, onToggleLoopSelection,
  pxPerSec, setPxPerSec, charMap, locked, setLocked,
  detection, setDetection,
  sceneCuts = [], onDetectScenes, onClearScenes, detectingScenes = false, clipFps = 25,
  brFont, setBrFont, uploadedFonts = [],
  styleProps,
}) {
  const [showStyle, setShowStyle] = useState(false)
  const [styleAnchor, setStyleAnchor] = useState({ bottom: 60, left: 200 })
  const liveIdx = activeIndexAt(subtitles, getBandTime())
  const targetIdx = selectedIdx != null ? selectedIdx : (liveIdx >= 0 ? liveIdx : null)
  const target = targetIdx != null ? subtitles[targetIdx] : null
  const charList = Object.keys(charMap)
  const activeChar = target?.character || charList[0] || ''

  // Affichage panel is portaled (fixed, opens upward) — close on outside click.
  useEffect(() => {
    if (!showStyle) return
    const onDown = e => {
      if (e.target?.closest?.('[data-popover="affichage"], [data-popover-trigger="affichage"]')) return
      setShowStyle(false)
    }
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDown) }
  }, [showStyle])

  // `field` marks a typing edit (coalesced into one undo step per burst).
  function updateTarget(patch, field) {
    if (targetIdx == null) return
    onSubtitlesChange(
      subtitles.map((s, i) => i === targetIdx ? { ...s, ...patch } : s),
      field ? { coalesce: `${targetIdx}:${field}` } : undefined)
  }
  function splitAtCurrentTime() {
    if (!target) return
    const t = getBandTime()
    if (t <= target.start || t >= target.end) return
    const next = [...subtitles]
    next.splice(targetIdx, 1, { ...target, end: t }, { ...target, start: t, text: '' })
    onSubtitlesChange(next)
    setSelectedIdx(targetIdx + 1)
  }
  function insertTagSub(text, dur = 0.5) {
    const t = getBandTime()
    onSubtitlesChange([...subtitles, { start: t, end: t + dur, text, character: activeChar, reactions: [] }].sort((a, b) => a.start - b.start))
  }
  function togglePlan() {
    if (!target) return
    updateTarget({ plan_cut: typeof target.plan_cut === 'number' ? null : getBandTime() })
  }
  function openStyle(e) {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    setStyleAnchor({ bottom: window.innerHeight - r.top + 6, left: Math.max(8, r.right - 360) })
    el.setAttribute('data-popover-trigger', 'affichage')
    setShowStyle(s => !s)
  }

  const fontOptions = [...BUNDLED_FONTS, ...uploadedFonts.map(f => ({ v: f.id, l: f.name }))]

  return (
    <div style={{ height: 48, flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8, background: T.surface, borderTop: `1px solid ${T.border}`, flexWrap: 'wrap', overflow: 'visible' }}>
      {/* edit cluster */}
      <Cluster>
        <Btn size="sm" icon={ICONS.plus} title="Ajouter une réplique (⇧↵)" onClick={onAddSub} />
        <Btn size="sm" icon={ICONS.scissors} title="Couper (S)" onClick={splitAtCurrentTime} disabled={!target} />
        <Btn size="sm" icon={ICONS.loop} active={!!loopRegion} title="Boucler la sélection (⇧clic)" onClick={onToggleLoopSelection} disabled={!target && !loopRegion} />
      </Cluster>
      {/* insert cluster */}
      <Cluster>
        <Popover width={250} trigger={(o, tog) => <Btn size="sm" active={o} onClick={tog} icon={ICONS.breath} iconR={ICONS.chevron}>Resp.</Btn>}>
          {close => <RespMenu close={close} onInsert={insertTagSub} />}
        </Popover>
        <Popover width={230} trigger={(o, tog) => <Btn size="sm" active={o} onClick={tog} icon={ICONS.sparkle} iconR={ICONS.chevron}>Réact.</Btn>}>
          {close => <ReactMenu close={close} onInsert={insertTagSub} />}
        </Popover>
      </Cluster>
      {/* flags */}
      <Cluster>
        <Popover width={230} trigger={(o, tog) => <Btn size="sm" active={o} onClick={tog} icon={ICONS.flag} title="État de la réplique" />}>
          {close => <StateMenu close={close} target={target}
            onToggleFlag={k => updateTarget({ [k]: !target[k] })} onTogglePlan={togglePlan} />}
        </Popover>
        <Popover width={250} trigger={(o, tog) => <Btn size="sm" active={o} onClick={tog} icon={ICONS.film} title="Plans / raccords (détection auto)" />}>
          {close => <PlansMenu close={close} sceneCuts={sceneCuts} clipFps={clipFps} detectingScenes={detectingScenes}
            onDetectScenes={onDetectScenes} onClearScenes={onClearScenes} hasTarget={!!target}
            onAddPlan={() => updateTarget({ plan_cut: getBandTime() })} />}
        </Popover>
        <Popover width={280} align="left" trigger={(o, tog) => <Btn size="sm" active={o} onClick={tog} icon={ICONS.note} title="Note de direction" />}>
          {close => <NoteMenu close={close} target={target} targetIdx={targetIdx} onNoteChange={v => updateTarget({ note: v }, 'note')} />}
        </Popover>
        <Btn size="sm" icon={ICONS.mic} danger={!!target?.take} disabled={!target}
          onClick={() => updateTarget({ take: !target.take })}
          title={target?.take ? 'Marquer comme enregistrée' : 'Marquer comme prise à enregistrer'}
          style={target?.take ? { background: alpha(T.danger, '22') } : undefined} />
      </Cluster>
      {/* détection */}
      <Cluster>
        <Btn size="sm" active={detection.layer} onClick={() => setDetection(d => ({ ...d, layer: !d.layer }))} icon={ICONS.eye} title="Calque détection">Détection</Btn>
      </Cluster>

      <div style={{ flex: 1 }} />

      {/* font select */}
      <Select size="sm" width={132} value={brFont} onChange={setBrFont} options={fontOptions} />
      {/* view cluster */}
      <Cluster>
        <Btn size="sm" icon={locked ? ICONS.lock : ICONS.unlock} active={locked} onClick={() => setLocked(l => !l)}
          title={locked ? 'Déverrouiller la BR' : 'Verrouiller la BR (empêche les éditions accidentelles)'} />
        <Btn size="sm" icon={ICONS.zoomOut} onClick={() => setPxPerSec(p => Math.max(40, p - 20))} title="Zoom arrière" />
        <span style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, minWidth: 44, textAlign: 'center' }}>{pxPerSec}px/s</span>
        <Btn size="sm" icon={ICONS.zoomIn} onClick={() => setPxPerSec(p => Math.min(600, p + 20))} title="Zoom avant" />
        <Btn size="sm" icon={ICONS.sliders} active={showStyle} onClick={openStyle}
          title="Affichage : style, décalage, taille, police importée, sous-titre dans le player" />
      </Cluster>

      {showStyle && (
        <StylePanel anchor={styleAnchor} onClose={() => setShowStyle(false)} brFont={brFont} {...styleProps} />
      )}
    </div>
  )
}
