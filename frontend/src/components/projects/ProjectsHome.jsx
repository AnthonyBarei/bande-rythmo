import React, { useEffect, useMemo, useState } from 'react'
import { T, Icon, ICONS, Btn, Popover, MenuItem, MenuSep, Spinner, alpha, pressable } from '../../ui'
import { useToast } from '../../ToastContext'
import { relTime } from '../../utils/relTime'
import { createProject, deleteProject, listProjects, patchProject, fmtBytes } from '../../utils/projectsApi'
import { DeleteProjectDialog, ProjectFormDialog, projectColor } from './ProjectDialogs'

const TABS = [{ id: 'active', label: 'Actifs' }, { id: 'archived', label: 'Archivés' }]

const STATUS_BAR = [
  { k: 'done', color: T.success, label: 'validé' },
  { k: 'review', color: T.info, label: 'à revoir' },
  { k: 'dubbing', color: T.accent, label: 'en doublage' },
  { k: 'todo', color: T.surface3, label: 'à faire' },
]

const FLOW = ['Médias', 'Clips', 'Bande rythmo', 'Studio', 'Export']

// French: 0 and 1 take the singular.
function plural(n, one, many = one + 's') {
  return `${n} ${n > 1 ? many : one}`
}

function Progress({ counts }) {
  const total = counts.clips || 0
  if (!total) return <div style={{ height: 5, borderRadius: 99, background: T.surface2 }} />
  const tip = STATUS_BAR.filter(s => counts.by_status?.[s.k]).map(s => `${counts.by_status[s.k]} ${s.label}`).join(' · ')
  return (
    <div title={tip} style={{ display: 'flex', height: 5, borderRadius: 99, overflow: 'hidden', background: T.surface2, gap: 1 }}>
      {STATUS_BAR.map(s => {
        const n = counts.by_status?.[s.k] || 0
        return n ? <div key={s.k} style={{ flex: n, background: s.color }} /> : null
      })}
    </div>
  )
}

function ProjectCard({ project, onOpen, onEdit, onArchive, onDelete }) {
  const [h, setH] = useState(false)
  const color = projectColor(project)
  const c = project.counts || {}
  const done = c.by_status?.done || 0
  return (
    <div {...pressable(() => onOpen(project))} onClick={() => onOpen(project)}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      title={`Ouvrir « ${project.name} »`}
      style={{
        background: T.surface, border: `1px solid ${h ? T.border2 : T.border}`, borderRadius: T.r.card,
        cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'border-color .15s, transform .15s',
        transform: h ? 'translateY(-2px)' : 'none',
      }}>
      {/* Only the cover clips: the actions menu must overflow the card. */}
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: `linear-gradient(135deg, ${alpha(color, '33')}, ${T.bg2})`, overflow: 'hidden', borderRadius: `${T.r.card - 1}px ${T.r.card - 1}px 0 0` }}>
        {project.cover
          ? <img src={`/${project.cover}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: h ? 'brightness(.8)' : 'none', transition: 'filter .15s' }} />
          : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon d={ICONS.folder} size={38} stroke={alpha(color, 'aa')} />
            </div>}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
        {project.status === 'archived' && (
          <span style={{ position: 'absolute', top: 10, left: 14, padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', background: 'rgba(0,0,0,.6)', color: '#fff' }}>Archivé</span>
        )}
      </div>
      <div style={{ padding: '12px 12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: T.fs.base, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
          <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <Popover align="right" width={200} trigger={(open, toggle) => (
              <Btn size="sm" variant={open ? 'solid' : 'ghost'} onClick={toggle} title="Actions du projet"
                style={{ width: 30, padding: 0, fontSize: 16, letterSpacing: 1 }}>⋯</Btn>
            )}>
              {close => <>
                <MenuItem icon={ICONS.edit} onClick={() => { close(); onEdit(project) }}>Modifier…</MenuItem>
                <MenuItem icon={ICONS.folder} onClick={() => { close(); onArchive(project) }}>
                  {project.status === 'archived' ? 'Restaurer' : 'Archiver'}
                </MenuItem>
                <MenuSep />
                <MenuItem icon={ICONS.trash} danger onClick={() => { close(); onDelete(project) }}>Supprimer…</MenuItem>
              </>}
            </Popover>
          </div>
        </div>
        <div style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>{plural(c.sources || 0, 'vidéo')}</span>
          <span>{plural(c.clips || 0, 'clip')}</span>
          <span>{plural(c.lines || 0, 'réplique')}</span>
        </div>
        <Progress counts={c} />
        <div style={{ display: 'flex', fontSize: 11.5, color: T.text3 }}>
          <span>{c.clips ? `${done}/${c.clips} validé${done > 1 ? 's' : ''}` : 'Rien de découpé'}</span>
          <div style={{ flex: 1 }} />
          <span>{project.opened_at ? `Ouvert ${relTime(project.opened_at)}` : `Créé ${relTime(project.created_at)}`}</span>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onNew }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: T.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon d={ICONS.folder} size={30} stroke={T.accent} />
      </div>
      <div style={{ fontSize: T.fs.lg, fontWeight: 600 }}>Crée ton premier projet</div>
      <div style={{ fontSize: T.fs.sm, color: T.text2, maxWidth: 460, lineHeight: 1.6 }}>
        Un projet regroupe une ou plusieurs vidéos et tout le travail qui en sort. Rien ne se perd quand tu quittes un écran : tu reprends là où tu t’étais arrêté.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center', margin: '4px 0' }}>
        {FLOW.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <Icon d={ICONS.next} size={10} stroke="none" fill={T.text4} />}
            <span style={{ fontSize: T.fs.xs, padding: '4px 10px', borderRadius: 99, background: T.surface2, color: T.text2 }}>{s}</span>
          </React.Fragment>
        ))}
      </div>
      <Btn variant="primary" size="lg" icon={ICONS.plus} onClick={onNew}>Nouveau projet</Btn>
    </div>
  )
}

// createPending: N / palette asked for « Nouveau projet » — opened here, then acknowledged.
export default function ProjectsHome({ onOpen, createPending, onCreateHandled, onProjectsChanged }) {
  const toast = useToast()
  const [tab, setTab] = useState('active')
  const [projects, setProjects] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(null)   // { kind: 'new' | 'edit' | 'delete', project? }

  async function refresh(which = tab) {
    try {
      setError(null)
      setProjects(await listProjects(which))
    } catch (e) {
      console.error(e)
      setError(e.message)
      setProjects([])
    }
  }

  useEffect(() => { refresh(tab) }, [tab])

  if (createPending && dialog?.kind !== 'new') setDialog({ kind: 'new' })
  useEffect(() => { if (createPending) onCreateHandled?.() }, [createPending])

  function switchTab(id) {
    if (id === tab) return
    setProjects(null)
    setTab(id)
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (projects || []).filter(p => !q || p.name.toLowerCase().includes(q))
  }, [projects, search])

  async function create(fields) {
    const project = await createProject(fields)
    setDialog(null)
    onProjectsChanged?.()
    onOpen(project)
  }

  async function edit(project, fields) {
    await patchProject(project.id, fields)
    setDialog(null)
    toast.success('Projet modifié')
    onProjectsChanged?.()
    refresh()
  }

  async function toggleArchive(project) {
    const archived = project.status === 'archived'
    try {
      await patchProject(project.id, { status: archived ? 'active' : 'archived' })
      toast.success(archived ? `« ${project.name} » restauré` : `« ${project.name} » archivé`)
      onProjectsChanged?.()
      refresh()
    } catch (e) {
      console.error(e)
      toast.error(`Échec : ${e.message}`)
    }
  }

  async function remove(project, typed) {
    const { freed_bytes: freed } = await deleteProject(project.id, typed)
    setDialog(null)
    toast.success(`« ${project.name} » supprimé — ${fmtBytes(freed)} libérés`)
    onProjectsChanged?.(project.id)
    refresh()
  }

  const total = projects?.length || 0
  const showEmpty = projects && !projects.length && tab === 'active' && !error

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '26px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 600, marginBottom: 4 }}>ATELIER</div>
            <div style={{ fontSize: T.fs.xxl, fontWeight: 600, letterSpacing: -0.6 }}>Projets</div>
          </div>
          {projects && <span style={{ fontSize: T.fs.sm, color: T.text3, fontFamily: T.fontMono, paddingBottom: 7 }}>{plural(total, 'projet')}</span>}
          <div style={{ flex: 1 }} />
          <div className="field-ring" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', height: 42, minWidth: 240, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99 }}>
            <Icon d={ICONS.search} size={15} stroke={T.text3} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un projet…"
              aria-label="Rechercher un projet" data-local-search
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', padding: 0, color: T.text, fontSize: T.fs.sm, fontFamily: T.fontUI }} />
            <span style={{ fontSize: 10, color: T.text4, fontFamily: T.fontMono, border: `1px solid ${T.border2}`, borderRadius: 4, padding: '1px 5px' }}>/</span>
          </div>
          <Btn variant="primary" size="lg" icon={ICONS.plus} onClick={() => setDialog({ kind: 'new' })} title="Créer un projet (N)">Nouveau projet</Btn>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: `1px solid ${T.border}`, height: 42 }}>
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button data-rd key={t.id} className="focus-inset" onClick={() => switchTab(t.id)} style={{
                height: 42, padding: '0 14px', background: 'transparent', border: 'none', borderRadius: 0, cursor: 'pointer',
                color: active ? T.text : T.text2, fontSize: T.fs.sm, fontWeight: active ? 600 : 500,
                borderBottom: `2px solid ${active ? T.accent : 'transparent'}`, marginBottom: -1, fontFamily: T.fontUI,
              }}>{t.label}</button>
            )
          })}
        </div>
      </div>

      {projects == null ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={18} /></div>
      ) : showEmpty ? (
        <EmptyState onNew={() => setDialog({ kind: 'new' })} />
      ) : visible.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: T.text3, fontSize: T.fs.sm }}>
          <Icon d={ICONS.folder} size={36} stroke={T.text4} />
          {error ? `Impossible de charger les projets : ${error}` : search ? 'Aucun projet ne correspond' : 'Aucun projet archivé'}
          {error && <Btn variant="outline" size="sm" onClick={() => refresh()}>Réessayer</Btn>}
        </div>
      ) : (
        <div style={{
          flex: 1, overflow: 'auto', padding: 28, paddingBottom: 'calc(28px + var(--toast-safe-bottom, 0px))',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gridAutoRows: 'max-content', gap: 18, alignContent: 'flex-start',
        }}>
          {visible.map(p => (
            <ProjectCard key={p.id} project={p} onOpen={onOpen}
              onEdit={project => setDialog({ kind: 'edit', project })}
              onArchive={toggleArchive}
              onDelete={project => setDialog({ kind: 'delete', project })} />
          ))}
        </div>
      )}

      {dialog?.kind === 'new' && <ProjectFormDialog onClose={() => setDialog(null)} onSave={create} />}
      {dialog?.kind === 'edit' && <ProjectFormDialog project={dialog.project} onClose={() => setDialog(null)} onSave={f => edit(dialog.project, f)} />}
      {dialog?.kind === 'delete' && <DeleteProjectDialog project={dialog.project} onClose={() => setDialog(null)} onDelete={typed => remove(dialog.project, typed)} />}
    </div>
  )
}
