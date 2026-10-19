import React, { useState, useMemo } from 'react'
import ClipCard from './ClipCard'
import { T, Icon, ICONS, Btn, Select, alpha } from '../ui'
import { TRACK_HEXES } from '../config/tracks'
import { useToast } from '../ToastContext'

const FILTERS = [
  { id: 'all',     label: 'Tous' },
  { id: 'todo',    label: 'À faire' },
  { id: 'dubbing', label: 'Doublage' },
  { id: 'review',  label: 'À revoir' },
  { id: 'done',    label: 'Validé' },
]

const SORT_OPTIONS = [
  { v: 'recent', l: 'Récents' }, { v: 'name', l: 'Nom A→Z' }, { v: 'dur', l: 'Durée' }, { v: 'status', l: 'Statut' },
]

const STATUS_ORDER = ['todo', 'dubbing', 'review', 'done']

function fmtTotal(sec) {
  const m = Math.round(sec / 60)
  if (m < 1) return `${Math.round(sec)} s`
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

export default function ClipsLibrary({ clips, onDub, onRecord, onMeme, onDelete, onRename, onStatusChange, onNewClip, onSetProject }) {
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('__all')   // __all | __none | <name>

  const projects = useMemo(() => {
    const set = new Set()
    for (const c of clips) if (c.project) set.add(c.project)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [clips])
  // A project that lost its last clip falls back to "all".
  const activeProject = projectFilter === '__all' || projectFilter === '__none' || projects.includes(projectFilter)
    ? projectFilter : '__all'

  async function assignProject(clipId) {
    const name = window.prompt('Nom du projet (vide = retirer du projet) :')
    if (name == null) return
    const ok = await onSetProject?.(clipId, name.trim())
    if (ok) toast.success(name.trim() ? `Déplacé vers « ${name.trim()} »` : 'Retiré du projet')
  }

  const counts = useMemo(() => {
    const c = { all: clips.length, todo: 0, dubbing: 0, review: 0, done: 0 }
    for (const cl of clips) c[cl.status || 'todo'] = (c[cl.status || 'todo'] || 0) + 1
    return c
  }, [clips])

  const visible = useMemo(() => {
    let list = clips
    if (activeProject === '__none') list = list.filter(c => !c.project)
    else if (activeProject !== '__all') list = list.filter(c => c.project === activeProject)
    if (filter !== 'all') list = list.filter(c => (c.status || 'todo') === filter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c => (c.name || '').toLowerCase().includes(q))
    }
    list = [...list]
    if (sort === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    else if (sort === 'dur') list.sort((a, b) => (b.end - b.start) - (a.end - a.start))
    else if (sort === 'status') list.sort((a, b) => STATUS_ORDER.indexOf(a.status || 'todo') - STATUS_ORDER.indexOf(b.status || 'todo'))
    else list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    return list
  }, [clips, filter, search, sort, activeProject])

  const totalDur = useMemo(() => clips.reduce((s, c) => s + (c.end - c.start), 0), [clips])

  const projectOptions = useMemo(() => [
    { v: '__all', l: 'Tous les projets' },
    ...projects.map((p, i) => ({ v: p, l: p, dot: TRACK_HEXES[i % TRACK_HEXES.length] })),
    { v: '__none', l: 'Sans projet' },
  ], [projects])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '26px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 600, marginBottom: 4 }}>BIBLIOTHÈQUE</div>
            <div style={{ fontSize: T.fs.xxl, fontWeight: 600, letterSpacing: -0.6 }}>Mes clips</div>
          </div>
          <span style={{ fontSize: T.fs.sm, color: T.text3, fontFamily: T.fontMono, paddingBottom: 7 }}>
            {clips.length} clip{clips.length !== 1 ? 's' : ''} · {fmtTotal(totalDur)}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', height: 42, minWidth: 260,
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99,
          }}>
            <Icon d={ICONS.search} size={15} stroke={T.text3} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un clip…"
              aria-label="Rechercher un clip" data-local-search
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', padding: 0, color: T.text, fontSize: T.fs.sm, fontFamily: T.fontUI }} />
            <span style={{ fontSize: 10, color: T.text4, fontFamily: T.fontMono, border: `1px solid ${T.border2}`, borderRadius: 4, padding: '1px 5px' }}>/</span>
          </div>
          <Btn variant="primary" size="lg" onClick={onNewClip} title="Importer une vidéo et créer un clip (N)" style={{ padding: '0 8px 0 8px', gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(11,11,13,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon d={ICONS.plus} size={16} sw={2.4} stroke="#0b0b0d" />
            </span>
            Nouveau clip
            <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: 'rgba(11,11,13,.14)', color: 'rgba(11,11,13,.7)', marginLeft: 2 }}>N</span>
          </Btn>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: `1px solid ${T.border}`, height: 42 }}>
          <Select size="sm" width={176} value={activeProject} onChange={setProjectFilter} options={projectOptions} />
          <div style={{ width: 1, height: 20, background: T.border, margin: '0 6px', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', height: 42 }}>
            {FILTERS.map(t => {
              const active = filter === t.id
              return (
                <button data-rd key={t.id} className="focus-inset" onClick={() => setFilter(t.id)} style={{
                  height: 42, padding: '0 14px', background: 'transparent', border: 'none', cursor: 'pointer',
                  color: active ? T.text : T.text2, fontSize: T.fs.sm, fontWeight: active ? 600 : 500,
                  borderBottom: `2px solid ${active ? T.accent : 'transparent'}`, marginBottom: -1,
                  display: 'flex', alignItems: 'center', gap: 7, fontFamily: T.fontUI, whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {t.label}
                  <span style={{
                    fontSize: 10.5, padding: '1px 6px', borderRadius: 99, fontFamily: T.fontMono,
                    background: active ? alpha(T.accent, '22') : T.surface2, color: active ? T.accent : T.text3,
                  }}>{counts[t.id] || 0}</span>
                </button>
              )
            })}
          </div>
          <span style={{ fontSize: T.fs.xs, color: T.text3, flexShrink: 0, marginLeft: 8 }}>Trier</span>
          <Select size="sm" width={150} value={sort} onChange={setSort} options={SORT_OPTIONS} />
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: T.text3 }}>
          <Icon d={ICONS.grid} size={40} stroke={T.text4} />
          <div style={{ fontSize: T.fs.base, color: T.text2 }}>
            {clips.length === 0 ? 'Aucun clip encore' : 'Aucun clip dans ce filtre'}
          </div>
          {clips.length === 0 && (
            <>
              <div style={{ fontSize: T.fs.xs }}>Importez une vidéo et découpez des segments</div>
              <Btn variant="primary" size="lg" icon={ICONS.plus} onClick={onNewClip} style={{ marginTop: 4 }}>
                Importer une vidéo
              </Btn>
            </>
          )}
        </div>
      ) : (
        <div style={{
          flex: 1, overflow: 'auto', padding: 28, paddingBottom: 'calc(28px + var(--toast-safe-bottom, 0px))',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gridAutoRows: 'max-content', gap: 18,
          alignContent: 'flex-start',
        }}>
          {visible.map(clip => (
            <ClipCard
              key={clip.clip_id}
              clip={clip}
              onDub={onDub}
              onRecord={onRecord}
              onMeme={onMeme}
              onDelete={onDelete}
              onRename={onRename}
              onStatusChange={onStatusChange}
              onAssignProject={assignProject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
