import React, { useState, useMemo } from 'react'
import ClipCard from './ClipCard'

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

export default function ClipsLibrary({ clips, onDub, onMeme, onDelete, onRename, onStatusChange, onNewClip }) {
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [search, setSearch] = useState('')
  const [sortOpen, setSortOpen] = useState(false)

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
  }, [clips, filter, search, sort])

  const totalDur = useMemo(() => clips.reduce((s, c) => s + (c.end - c.start), 0), [clips])

  async function handleDelete(clipId) {
    await onDelete(clipId)
    showToast('Clip supprimé')
  }

  const sortLabel = SORTS.find(s => s.key === sort)?.label || 'Récents'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
              BIBLIOTHÈQUE
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.4, marginTop: 2 }}>Mes clips</h1>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)', paddingBottom: 4 }}>
            {clips.length} clip{clips.length !== 1 ? 's' : ''} · {Math.round(totalDur)}s total
          </div>
          <div style={{ flex: 1 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un clip…"
            style={{ minWidth: 240, fontFamily: 'var(--font-mono)', fontSize: 12, borderRadius: 99, background: 'var(--surface)' }}
          />
          <button
            onClick={onNewClip}
            style={{ padding: '8px 14px', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12.5, borderRadius: 'var(--radius)' }}
          >
            + Nouveau clip
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 14, borderBottom: '1px solid var(--border)' }}>
          {FILTERS.map(f => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 12px', background: 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text2)',
                  fontWeight: active ? 600 : 400, fontSize: 12.5,
                  borderRadius: 0,
                  borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  marginBottom: -1,
                }}
              >
                {f.label}
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)',
                  background: 'var(--surface2)', color: 'var(--text3)',
                  padding: '1px 5px', borderRadius: 4,
                }}>
                  {counts[f.key] || 0}
                </span>
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative', paddingBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginRight: 6 }}>Trier par</span>
            <button
              onClick={() => setSortOpen(o => !o)}
              onBlur={() => setTimeout(() => setSortOpen(false), 120)}
              style={{ padding: '5px 10px', background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
            >
              {sortLabel} ▾
            </button>
            {sortOpen && (
              <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', zIndex: 50, minWidth: 120, marginTop: 2 }}>
                {SORTS.map(s => (
                  <div
                    key={s.key}
                    onMouseDown={() => { setSort(s.key); setSortOpen(false) }}
                    style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: sort === s.key ? 'var(--accent)' : 'var(--text2)' }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {visible.map(clip => (
              <ClipCard
                key={clip.clip_id}
                clip={clip}
                onDub={onDub}
                onMeme={onMeme}
                onDelete={handleDelete}
                onRename={onRename}
                onStatusChange={onStatusChange}
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
