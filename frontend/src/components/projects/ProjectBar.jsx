import React from 'react'
import { T, Icon, ICONS, Btn, Select, Kbd, Dot, Popover, MenuItem, MenuSep } from '../../ui'
import { CLIP_STAGES } from '../../utils/route'
import { projectColor } from './ProjectDialogs'

export const STAGE_TABS = [
  { id: 'media',  label: 'Médias',       ic: ICONS.import },
  { id: 'clips',  label: 'Clips',        ic: ICONS.library },
  { id: 'dub',    label: 'Bande rythmo', ic: ICONS.edit },
  { id: 'record', label: 'Studio',       ic: ICONS.mic },
  { id: 'export', label: 'Export',       ic: ICONS.download },
]

// Project shell bar (PROJECTS_PLAN §4): Projets › name · stage tabs · clip
// switcher on clip stages · the top bar's tools. Replaces the top bar inside
// a project so every stage keeps one 52 px header.
// onEdit / onArchive / onDelete: the project menu (⋯), same actions as the Projects home cards.
export default function ProjectBar({ project, stage, clips, clipId, onStage, onClip, onProjects, onEdit, onArchive, onDelete, onCmd, onHelp, onActivity, account }) {
  const clipStage = CLIP_STAGES.has(stage)
  const index = clips.findIndex(c => c.clip_id === clipId)
  const options = clips.map(c => ({ v: c.clip_id, l: c.name || `Clip ${c.clip_id.slice(0, 6)}` }))
  const step = d => {
    const next = clips[index + d]
    if (next) onClip(next.clip_id)
  }

  return (
    <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 0 10px', borderBottom: `1px solid ${T.border}`, background: T.bg }}>
      <button data-rd onClick={onProjects} title="Tous les projets" style={{
        display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 8px', borderRadius: T.r.ctl,
        background: 'transparent', border: 'none', cursor: 'pointer', color: T.text3, fontSize: T.fs.sm, fontFamily: T.fontUI, flexShrink: 0,
      }}>
        <Icon d={ICONS.back} size={14} stroke={T.text3} />
        Projets
      </button>
      <span style={{ color: T.text4, flexShrink: 0 }}>/</span>
      <div title={project?.name} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: 240, flexShrink: 1 }}>
        <Dot color={projectColor(project)} size={8} />
        <span style={{ fontSize: T.fs.sm, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project?.name || '…'}</span>
        {project?.status === 'archived' && (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.text3, border: `1px solid ${T.border2}`, borderRadius: 5, padding: '1px 6px', flexShrink: 0 }}>Archivé</span>
        )}
      </div>
      {project && (
        <Popover width={210} trigger={(open, toggle) => (
          <Btn size="sm" variant={open ? 'solid' : 'ghost'} onClick={toggle} title="Actions du projet"
            style={{ width: 30, padding: 0, fontSize: 16, letterSpacing: 1 }}>⋯</Btn>
        )}>
          {close => <>
            <MenuItem icon={ICONS.edit} onClick={() => { close(); onEdit() }}>Modifier…</MenuItem>
            <MenuItem icon={ICONS.folder} onClick={() => { close(); onArchive() }}>
              {project.status === 'archived' ? 'Restaurer' : 'Archiver'}
            </MenuItem>
            <MenuSep />
            <MenuItem icon={ICONS.trash} danger onClick={() => { close(); onDelete() }}>Supprimer…</MenuItem>
          </>}
        </Popover>
      )}

      <nav aria-label="Étapes du projet" style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 10, height: 52, flexShrink: 0 }}>
        {STAGE_TABS.map(t => {
          const active = stage === t.id
          const disabled = CLIP_STAGES.has(t.id) && !clips.length
          return (
            <button data-rd key={t.id} className="focus-inset" disabled={disabled} onClick={() => onStage(t.id)}
              aria-current={active ? 'page' : undefined}
              title={disabled ? 'Découpe d’abord un clip dans Médias' : t.label}
              style={{
                height: 52, padding: '0 12px', background: 'transparent', border: 'none', borderRadius: 0,
                cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                color: active ? T.text : disabled ? T.text4 : T.text2, fontSize: T.fs.sm, fontWeight: active ? 600 : 500, fontFamily: T.fontUI,
                borderBottom: `2px solid ${active ? T.accent : 'transparent'}`, marginBottom: -1, whiteSpace: 'nowrap',
              }}>
              <Icon d={t.ic} size={15} stroke={active ? T.accent : disabled ? T.text4 : T.text3} />
              {t.label}
            </button>
          )
        })}
      </nav>

      {clipStage && clips.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, minWidth: 0 }}>
          <Btn size="sm" icon={ICONS.prev} title="Clip précédent" disabled={index <= 0} onClick={() => step(-1)} />
          <Select size="sm" width={200} value={clipId} onChange={onClip} options={options} menuWidth={280} />
          <Btn size="sm" icon={ICONS.next} title="Clip suivant" disabled={index < 0 || index >= clips.length - 1} onClick={() => step(1)} />
        </div>
      )}

      <div style={{ flex: 1 }} />
      <Btn size="sm" icon={ICONS.search} title="Palette de commandes (⌘K)" onClick={onCmd}>
        <span style={{ display: 'flex', gap: 3 }}><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
      </Btn>
      <Btn size="sm" icon={ICONS.keyboard} title="Raccourcis (?)" onClick={onHelp} />
      <Btn size="sm" icon={ICONS.activity} title="Activité" onClick={onActivity} />
      <div style={{ width: 1, height: 22, background: T.border, flexShrink: 0 }} />
      {account}
    </div>
  )
}
