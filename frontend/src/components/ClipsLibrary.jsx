import React, { useState, useMemo } from 'react'
import ClipCard from './ClipCard'
import { Icon, ICONS } from '../Icons'
import { Btn, Select, ScreenHeader } from '../ui'

const FILTERS = [
  { key: 'all',     label: 'Tous' },
  { key: 'todo',    label: 'À faire' },
  { key: 'dubbing', label: 'Doublage' },
  { key: 'review',  label: 'À revoir' },
  { key: 'done',    label: 'Validé' },
]

const SORTS = [
  { key: 'recent',   label: 'Récents' },
  { key: 'name',     label: 'Nom' },
  { key: 'duration', label: 'Durée' },
]

export default function ClipsLibrary({ clips, onDub, onMeme, onDelete, onRename, onStatusChange, onNewClip, onSetProject }) {
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [search, setSearch] = useState('')
  const [sortOpen, setSortOpen] = useState(false)
  const [projectFilter, setProjectFilter] = useState('__all')   // __all | __none | <name>

  const projects = useMemo(() => {
    const set = new Set()
    for (const c of clips) if (c.project) set.add(c.project)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [clips])

  async function assignProject(clipId) {
    const name = window.prompt('Nom du projet (vide = retirer du projet) :')
    if (name == null) return
    await onSetProject?.(clipId, name.trim())
    showToast(name.trim() ? `Déplacé vers « ${name.trim()} »` : 'Retiré du projet')
  }

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const counts = useMemo(() => {
    const c = { all: clips.length, todo: 0, dubbing: 0, review: 0, done: 0 }
    for (const cl of clips) c[cl.status || 'todo'] = (c[cl.status || 'todo'] || 0) + 1
    return c
  }, [clips])

  const visible = useMemo(() => {
    let list = clips
    if (projectFilter === '__none') list = list.filter(c => !c.project)
    else if (projectFilter !== '__all') list = list.filter(c => c.project === projectFilter)
    if (filter !== 'all') list = list.filter(c => (c.status || 'todo') === filter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q))
    }
    list = [...list]
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'duration') list.sort((a, b) => (b.end - b.start) - (a.end - a.start))
    else list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    return list
  }, [clips, filter, search, sort, projectFilter])

  const totalDur = useMemo(() => clips.reduce((s, c) => s + (c.end - c.start), 0), [clips])

  async function handleDelete(clipId) {
    await onDelete(clipId)
    showToast('Clip supprimé')
  }

  const sortLabel = SORTS.find(s => s.key === sort)?.label || 'Récents'

  const projectOptions = useMemo(() => [
    { v: '__all', l: 'Tous les projets', icon: ICONS.grid },
    ...projects.map((p, i) => ({ v: p, l: p, dot: ['#f5c518', '#7ec0ff', '#f08aaf', '#7ed4a8'][i % 4] })),
    { v: '__none', l: 'Sans projet' },
  ], [projects])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader
        kicker="BIBLIOTHÈQUE"
        title="Mes clips"
        sub={`${clips.length} clip${clips.length !== 1 ? 's' : ''} · ${Math.round(totalDur)}s`}
        right={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', height: 40, minWidth: 240, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 99 }}>
              <Icon d={ICONS.search} size={15} stroke="var(--text3)" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un clip…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-ui)', padding: 0, minWidth: 0 }} />
            </div>
            <Btn variant="primary" size="lg" icon={ICONS.plus} onClick={onNewClip}>Nouveau clip</Btn>
          </div>
        )}
      />

      {/* Filter row — project select · status tabs · sort */}
      <div style={{ padding: '14px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid var(--border)', height: 44 }}>
          {projects.length > 0 && (
            <>
              <Select size="sm" width={170} value={projectFilter} onChange={setProjectFilter} options={projectOptions} />
              <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 6px' }} />
            </>
          )}
          {FILTERS.map(f => {
            const active = filter === f.key
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                height: 44, padding: '0 14px', background: 'transparent', border: 'none', cursor: 'pointer',
                color: active ? 'var(--text)' : 'var(--text2)', fontSize: 13, fontWeight: active ? 600 : 500,
                borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, marginBottom: -1,
                display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-ui)',
              }}>
                {f.label}
                <span style={{
                  fontSize: 10.5, padding: '1px 6px', borderRadius: 99, fontFamily: 'var(--font-mono)',
                  background: active ? 'rgba(245,197,24,0.13)' : 'var(--surface2)', color: active ? 'var(--accent)' : 'var(--text3)',
                }}>{counts[f.key] || 0}</span>
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Trier</span>
          <Select size="sm" width={140} value={sort} onChange={setSort}
            options={SORTS.map(s => ({ v: s.key, l: s.label }))} />
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {visible.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 14, color: 'var(--text3)' }}>
            <div style={{ fontSize: 40, opacity: 0.25 }}>▤</div>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>
              {clips.length === 0 ? 'Aucun clip encore' : 'Aucun clip dans ce filtre'}
            </div>
            {clips.length === 0 && (
              <>
                <div style={{ fontSize: 12 }}>Importez une vidéo et découpez des segments</div>
                <button onClick={onNewClip}
                  style={{
                    marginTop: 4, padding: '10px 20px',
                    background: 'var(--accent)', color: '#000',
                    fontWeight: 600, fontSize: 13,
                    borderRadius: 'var(--radius)', cursor: 'pointer',
                  }}>
                  + Importer une vidéo
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gridAutoRows: 'max-content', gap: 18, alignContent: 'flex-start' }}>
            {visible.map(clip => (
              <ClipCard
                key={clip.clip_id}
                clip={clip}
                onDub={onDub}
                onMeme={onMeme}
                onDelete={handleDelete}
                onRename={onRename}
                onStatusChange={onStatusChange}
                onAssignProject={assignProject}
              />
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '10px 18px',
          background: toast.type === 'error' ? 'var(--danger)' : toast.type === 'success' ? 'var(--success)' : 'var(--surface3)',
          color: '#fff', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
          zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
