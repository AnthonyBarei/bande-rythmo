import React, { useState, useEffect, useCallback } from 'react'

// Dubbing lexicon — per-project term glossary (translation + pronunciation).
// Scoped to the clip's project; project='' entries are global (shown everywhere).
export default function LexiconPanel({ project = '' }) {
  const [entries, setEntries] = useState([])
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [phonetic, setPhonetic] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/lexicon?project=${encodeURIComponent(project)}`)
      if (r.ok) setEntries(await r.json())
    } catch {}
  }, [project])
  useEffect(() => { refresh() }, [refresh])

  async function add() {
    const t = term.trim()
    if (!t) return
    setBusy(true)
    try {
      const r = await fetch('/api/lexicon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, term: t, translation: translation.trim(), phonetic: phonetic.trim() }),
      })
      if (r.ok) { setTerm(''); setTranslation(''); setPhonetic(''); await refresh() }
    } catch {} finally { setBusy(false) }
  }

  async function remove(id) {
    try { await fetch(`/api/lexicon/${id}`, { method: 'DELETE' }); await refresh() } catch {}
  }

  const filtered = search.trim()
    ? entries.filter(e => (e.term + ' ' + e.translation).toLowerCase().includes(search.trim().toLowerCase()))
    : entries

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Quick-add */}
      <div style={{ padding: 10, borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={term} onChange={e => setTerm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder="Terme" style={inp} />
          <input value={translation} onChange={e => setTranslation(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder="Traduction" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={phonetic} onChange={e => setPhonetic(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder="Prononciation" style={inp} />
          <button onClick={add} disabled={busy || !term.trim()}
            style={{ padding: '6px 14px', background: term.trim() ? 'var(--accent)' : 'var(--surface3)', color: term.trim() ? '#000' : 'var(--text4)', fontWeight: 600, fontSize: 12, border: 'none', borderRadius: 6, cursor: term.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
            + Ajouter
          </button>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text4)' }}>
          {project ? `Projet « ${project} » + termes globaux` : 'Termes globaux (aucun projet)'}
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un terme…" style={{ ...inp, width: '100%' }} />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: 12, padding: 16, textAlign: 'center' }}>
            {entries.length === 0 ? 'Aucun terme — ajoutez votre premier ci-dessus.' : 'Aucun résultat.'}
          </p>
        ) : filtered.map(e => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, marginBottom: 3, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{e.term}</span>
                {e.translation && <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>→ {e.translation}</span>}
                {!e.project && <span style={{ fontSize: 9, color: 'var(--text4)', border: '1px solid var(--border2)', borderRadius: 3, padding: '0 4px' }}>global</span>}
              </div>
              {e.phonetic && <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>/{e.phonetic}/</div>}
            </div>
            <button onClick={() => remove(e.id)} title="Supprimer"
              style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const inp = {
  flex: 1, minWidth: 0, fontSize: 12, padding: '6px 8px',
  background: 'var(--surface3)', color: 'var(--text)',
  border: '1px solid var(--border2)', borderRadius: 6, outline: 'none',
}
