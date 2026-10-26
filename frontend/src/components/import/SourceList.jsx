import React, { useState } from 'react'
import { T, Icon, ICONS, Btn, alpha, pressable } from '../../ui'
import { fmtDuration } from '../../utils/duration'
import { draftRangeCount } from '../../utils/sources'

const KIND_ICON = { local: ICONS.film, library: ICONS.layers, url: ICONS.plug }

// Médias stage — the project's videos (PROJECTS_PLAN §4). A row restores its
// cut in progress; « Ajouter » shows the import tabs.
export default function SourceList({ sources, selectedId, onSelect, onAdd, onRelink, onRemove }) {
  const adding = selectedId == null
  return (
    <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px' }}>
        <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>VIDÉOS DU PROJET</span>
        <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{sources.length}</span>
        <div style={{ flex: 1 }} />
        <Btn size="sm" variant={adding ? 'solid' : 'ghost'} icon={ICONS.plus} onClick={onAdd} title="Ajouter une vidéo au projet">Ajouter</Btn>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
        {sources.length === 0 && (
          <div style={{ padding: '14px 12px', fontSize: T.fs.xs, color: T.text3, lineHeight: 1.5, border: `1px dashed ${T.border2}`, borderRadius: T.r.ctl }}>
            Aucune vidéo pour l’instant. Ajoute un fichier, un élément de la médiathèque ou une URL.
          </div>
        )}
        {sources.map(s => <SourceRow key={s.id} source={s} on={s.id === selectedId} onSelect={onSelect} onRelink={onRelink} onRemove={onRemove} />)}
      </div>
    </div>
  )
}

function SourceRow({ source, on, onSelect, onRelink, onRemove }) {
  const [h, setH] = useState(false)
  const ranges = draftRangeCount(source.draft)
  const offline = !source.online
  const meta = [
    source.duration ? fmtDuration(source.duration) : null,
    `${source.clip_count || 0} clip${source.clip_count > 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ')
  return (
    <div {...pressable(() => onSelect(source.id))} onClick={() => onSelect(source.id)}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onFocus={() => setH(true)} onBlur={() => setH(false)}
      aria-current={on ? 'true' : undefined} title={source.path || source.filename}
      style={{
        display: 'flex', gap: 10, padding: '10px 11px', borderRadius: T.r.ctl, cursor: 'pointer',
        background: on ? alpha(T.accent, '12') : T.surface,
        border: `1px solid ${on ? alpha(T.accent, '66') : offline ? alpha(T.danger, '44') : T.border}`,
      }}>
      <Icon d={KIND_ICON[source.kind] || ICONS.film} size={16} stroke={on ? T.accent : T.text3} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: T.fs.sm, fontWeight: 500, color: on ? T.text : T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {source.filename || 'Sans nom'}
          </div>
          {onRemove && (
            <button data-rd onClick={e => { e.stopPropagation(); onRemove(source) }} title="Retirer la vidéo du projet"
              aria-label={`Retirer ${source.filename || 'la vidéo'} du projet`}
              style={{ background: 'transparent', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', opacity: h || on ? 1 : 0, transition: 'opacity .15s', flexShrink: 0 }}>
              <Icon d={ICONS.trash} size={13} stroke={T.text3} />
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: T.text3, fontFamily: T.fontMono }}>{meta}</div>
        {(ranges > 0 || offline) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {ranges > 0 && (
              <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 99, background: alpha(T.info, '22'), color: T.info }}>
                brouillon · {ranges} plage{ranges > 1 ? 's' : ''}
              </span>
            )}
            {offline && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '1px 7px', borderRadius: 99, background: alpha(T.danger, '22'), color: T.danger }}>
                <Icon d={ICONS.warn} size={10} stroke={T.danger} />
                {source.kind === 'library' ? 'Médiathèque non configurée' : 'Hors ligne'}
              </span>
            )}
            {offline && source.kind === 'local' && (
              <button data-rd onClick={e => { e.stopPropagation(); onRelink(source) }} title="Choisir le fichier déplacé"
                style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 99, border: `1px solid ${T.border2}`, background: 'transparent', color: T.text2, cursor: 'pointer', fontFamily: T.fontUI }}>
                Relier…
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
