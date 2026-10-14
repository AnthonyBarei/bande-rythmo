import React from 'react'
import { createPortal } from 'react-dom'
import { Btn, ICONS, SectionLabel } from '../../ui'

const RESP_TAGS = [
  { label: '(HH)', color: 'var(--info)', dur: 0.5, desc: 'Inspiration' },
  { label: '(H)',  color: 'var(--info)', dur: 0.4, desc: 'Souffle' },
  { label: '(Hm)', color: 'var(--info)', dur: 0.4, desc: 'Demi-souffle' },
  { label: '*',    color: '#5599cc',     dur: 0.3, desc: 'Repère BR' },
  { label: '(…)',  color: 'var(--text3)', dur: 0.6, desc: 'Pause' },
]

const REACTION_TAGS = [
  { label: '(rires)',       color: 'var(--accent)', dur: 1.5 },
  { label: '(pleurs)',      color: '#ff8888', dur: 2.0 },
  { label: '(soupir)',      color: '#aaa',    dur: 1.0 },
  { label: '(long soupir)', color: '#aaa',    dur: 2.0 },
  { label: '(cri)',         color: '#ff5a5a', dur: 0.7 },
  { label: '(chuchoté)',    color: '#88ddaa', dur: 1.2 },
  { label: '(essoufflé)',   color: 'var(--info)', dur: 1.0 },
  { label: '(hésitation)',  color: '#bb88ff', dur: 0.5 },
  { label: '(raclement)',   color: '#cc9966', dur: 0.5 },
  { label: '(grognement)',  color: '#cc7744', dur: 0.4 },
]
const INSERER_REACTIONS = ['(rires)', '(pleurs)', '(soupir)', '(cri)', '(chuchoté)', '(essoufflé)', '(hésitation)']
  .map(l => REACTION_TAGS.find(r => r.label === l))

// Works for hex and var(--…) colours alike.
const tint = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

const popover = {
  position: 'fixed', zIndex: 'var(--z-dropdown)',
  background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12,
  boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
}
const label = { textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }
const tagRow = { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }

function TagButton({ tag, onClick, title, bold, showDur }) {
  const [h, setH] = React.useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        fontSize: bold ? 12 : 11, padding: '0 10px', minHeight: 32, fontFamily: 'var(--font-mono)',
        background: h ? tint(tag.color, 10) : tint(tag.color, 4),
        border: `1px solid ${h ? tag.color : tint(tag.color, 27)}`,
        color: tag.color, borderRadius: 6, cursor: 'pointer', fontWeight: bold ? 700 : 500,
        transition: 'background 0.1s',
      }}>
      {tag.label}
      {showDur && <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 4 }}>{tag.dur}s</span>}
    </button>
  )
}

function ActiveCharFooter({ prefix, activeChar, cColor }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
      {prefix}<span style={{ color: cColor }}>{activeChar || '(défaut)'}</span>
    </div>
  )
}

function NoteField({ target, targetIdx, updateTarget }) {
  return (
    <>
      <SectionLabel style={{ ...label, color: 'var(--accent)' }}>Note — réplique #{targetIdx + 1}</SectionLabel>
      <textarea
        value={target.note || ''}
        onChange={e => updateTarget({ note: e.target.value }, 'note')}
        rows={2}
        placeholder="Intention, ton, timing…"
        style={{
          width: '100%', fontFamily: 'var(--font-ui)', fontStyle: 'italic',
          fontSize: 12, padding: '6px 8px',
          background: 'var(--surface2)', color: 'var(--text)',
          border: '1px solid var(--border2)', borderRadius: 5, resize: 'vertical',
        }} />
    </>
  )
}

// Band toolbar insertion menus — Respirations · Réactions · Note · Insérer.
// All portaled to body (position:fixed) to escape the toolbar's overflow clip.
export default function BandMenus({
  anchor, showResp, showReact, showNote, showInserer, onCloseInserer,
  insertTagSub, activeChar, cColor, target, targetIdx, updateTarget,
}) {
  return (
    <>
      {showResp && createPortal(
        <div data-popover="resp" style={{ ...popover, bottom: anchor.bottom, left: anchor.left, padding: 12, minWidth: 260 }}>
          <SectionLabel style={{ ...label, color: 'var(--info)', marginBottom: 8 }}>Respirations — crée une réplique au temps courant</SectionLabel>
          <div style={tagRow}>
            {RESP_TAGS.map(r => (
              <TagButton key={r.label} tag={r} bold onClick={() => insertTagSub(r.label, r.dur)} title={`${r.desc} — ${r.dur}s`} />
            ))}
          </div>
          <ActiveCharFooter prefix="Personnage actif : " activeChar={activeChar} cColor={cColor} />
        </div>,
        document.body
      )}

      {showReact && createPortal(
        <div data-popover="react" style={{ ...popover, bottom: anchor.bottom, left: anchor.left, padding: 12, minWidth: 300, maxWidth: 380 }}>
          <SectionLabel style={{ ...label, color: 'var(--accent)', marginBottom: 8 }}>Réactions — crée une réplique au temps courant</SectionLabel>
          <div style={tagRow}>
            {REACTION_TAGS.map(r => (
              <TagButton key={r.label} tag={r} showDur onClick={() => insertTagSub(r.label, r.dur)} title={`Créer réplique "${r.label}" — ${r.dur}s`} />
            ))}
          </div>
          <ActiveCharFooter prefix="Crée un bloc BR indépendant · personnage actif : " activeChar={activeChar} cColor={cColor} />
        </div>,
        document.body
      )}

      {showNote && target && createPortal(
        <div data-popover="note" style={{ ...popover, bottom: anchor.bottom, right: 160, padding: 10, minWidth: 280, border: '1px dashed var(--accent)' }}>
          <NoteField target={target} targetIdx={targetIdx} updateTarget={updateTarget} />
        </div>,
        document.body
      )}

      {showInserer && createPortal(
        <div data-popover="inserer" style={{ ...popover, bottom: anchor.bottom, left: anchor.left, padding: 12, minWidth: 340, maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <SectionLabel style={{ textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text)' }}>Insérer</SectionLabel>
            <div style={{ flex: 1 }} />
            <Btn size="sm" icon={ICONS.close} onClick={onCloseInserer} title="Fermer" />
          </div>

          <SectionLabel style={{ ...label, color: 'var(--info)' }}>Respirations</SectionLabel>
          <div style={tagRow}>
            {RESP_TAGS.map(r => (
              <TagButton key={r.label} tag={r} bold onClick={() => { insertTagSub(r.label, r.dur); onCloseInserer() }} title={`${r.label} — ${r.dur}s`} />
            ))}
          </div>

          <SectionLabel style={{ ...label, color: 'var(--accent)' }}>Réactions</SectionLabel>
          <div style={tagRow}>
            {INSERER_REACTIONS.map(r => (
              <TagButton key={r.label} tag={r} showDur onClick={() => { insertTagSub(r.label, r.dur); onCloseInserer() }} />
            ))}
          </div>

          {target ? (
            <NoteField target={target} targetIdx={targetIdx} updateTarget={updateTarget} />
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              Sélectionnez une réplique pour ajouter une note.
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
