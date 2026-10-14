import React from 'react'
import { T, Btn, ICONS, MenuItem, MenuLabel, MenuSep } from '../../ui'
import { fmtSMPTE as fmtTC } from '../../utils/timecode'

const RESP_TAGS = [
  { tag: '(HH)', desc: 'Inspiration', dur: 0.5 },
  { tag: '(H)', desc: 'Souffle', dur: 0.4 },
  { tag: '(Hm)', desc: 'Demi-souffle', dur: 0.4 },
  { tag: '*', desc: 'Repère BR', dur: 0.3 },
  { tag: '(…)', desc: 'Pause', dur: 0.6 },
]

const REACTION_TAGS = [
  { tag: '(rires)', dur: 1.5 }, { tag: '(pleurs)', dur: 2.0 }, { tag: '(soupir)', dur: 1.0 },
  { tag: '(long soupir)', dur: 2.0 }, { tag: '(cri)', dur: 0.7 }, { tag: '(chuchoté)', dur: 1.2 },
  { tag: '(essoufflé)', dur: 1.0 }, { tag: '(hésitation)', dur: 0.5 }, { tag: '(raclement)', dur: 0.5 },
  { tag: '(grognement)', dur: 0.4 },
]

// Band toolbar menu bodies — reference screen-editor.jsx › BandToolbar popovers.
export function RespMenu({ close, onInsert }) {
  return (<>
    <MenuLabel>Respirations — insérer au curseur</MenuLabel>
    {RESP_TAGS.map(r => (
      <MenuItem key={r.tag} color={T.info} onClick={() => { onInsert(r.tag, r.dur); close() }}
        right={<span style={{ fontSize: 10, color: T.text4, fontFamily: T.fontMono }}>{r.dur}s</span>}>
        <span style={{ fontFamily: T.fontMono, fontWeight: 700, color: T.info, marginRight: 8 }}>{r.tag}</span>
        <span style={{ color: T.text3, fontSize: 12 }}>{r.desc}</span>
      </MenuItem>
    ))}
  </>)
}

export function ReactMenu({ close, onInsert }) {
  return (<>
    <MenuLabel>Réactions — insérer au curseur</MenuLabel>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: 6 }}>
      {REACTION_TAGS.map(r => (
        <button key={r.tag} onClick={() => { onInsert(r.tag, r.dur); close() }} title={`${r.dur}s`}
          style={{ fontSize: 11, padding: '5px 9px', fontFamily: T.fontMono, background: T.surface2, border: `1px solid ${T.border2}`, color: T.text2, borderRadius: 6, cursor: 'pointer' }}>
          {r.tag}
        </button>
      ))}
    </div>
  </>)
}

export function StateMenu({ close, target, onToggleFlag, onTogglePlan }) {
  if (!target) return <><MenuLabel>État de la réplique</MenuLabel><NoTarget /></>
  return (<>
    <MenuLabel>État de la réplique</MenuLabel>
    <MenuItem icon={ICONS.flag} active={!!target.off} onClick={() => { onToggleFlag('off'); close() }}>Hors-champ <span style={{ color: T.text4 }}>(off)</span></MenuItem>
    <MenuItem icon={ICONS.user} active={!!target.dos} onClick={() => { onToggleFlag('dos'); close() }}>De dos</MenuItem>
    <MenuItem icon={ICONS.wave} active={!!target.ambiance} onClick={() => { onToggleFlag('ambiance'); close() }}>Ambiance</MenuItem>
    <MenuSep />
    <MenuItem icon={ICONS.target} active={typeof target.plan_cut === 'number'} onClick={() => { onTogglePlan(); close() }}>Plan / raccord au curseur</MenuItem>
  </>)
}

export function PlansMenu({ close, sceneCuts, clipFps, detectingScenes, onDetectScenes, onClearScenes, onAddPlan, hasTarget }) {
  return (<>
    <MenuLabel>Plans — changements de scène</MenuLabel>
    <MenuItem icon={ICONS.sparkle} onClick={() => { if (detectingScenes) return; close(); onDetectScenes() }}>
      {detectingScenes ? 'Détection…' : 'Détecter automatiquement (ffmpeg)'}
    </MenuItem>
    {hasTarget && <MenuItem icon={ICONS.plus} onClick={() => { onAddPlan(); close() }}>Ajouter un plan au curseur</MenuItem>}
    {sceneCuts.length > 0 && <MenuItem icon={ICONS.trash} danger onClick={() => { close(); onClearScenes() }}>Effacer les plans détectés</MenuItem>}
    <MenuSep />
    <div style={{ padding: '4px 10px', fontSize: 11, color: T.text3 }}>
      {sceneCuts.length} plan{sceneCuts.length !== 1 ? 's' : ''}{sceneCuts.length > 0 && ' · '}{sceneCuts.slice(0, 4).map(t => fmtTC(t, clipFps)).join(' · ')}{sceneCuts.length > 4 && ' …'}
    </div>
  </>)
}

export function NoteMenu({ close, target, targetIdx, onNoteChange }) {
  return (
    <div style={{ padding: 4 }}>
      <MenuLabel>Note de direction{target ? ` — réplique ${targetIdx + 1}` : ''}</MenuLabel>
      {target ? (<>
        <textarea autoFocus rows={3} placeholder="Intention, ton, timing…" value={target.note || ''}
          onChange={e => onNoteChange(e.target.value)}
          style={{ width: '100%', background: T.bg2, border: `1px solid ${T.border2}`, borderRadius: 8, color: T.accent, fontFamily: T.fontUI, fontStyle: 'italic', fontSize: 12, padding: '7px 9px', outline: 'none', resize: 'vertical' }} />
        <Btn size="sm" variant="primary" full onClick={close} style={{ marginTop: 6 }}>Enregistrer la note</Btn>
      </>) : <NoTarget />}
    </div>
  )
}

function NoTarget() {
  return <div style={{ padding: '4px 10px 8px', fontSize: 11, color: T.text3 }}>Sélectionnez une réplique.</div>
}
