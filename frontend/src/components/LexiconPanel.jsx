import React, { useState, useEffect, useCallback } from 'react'
import { T, Btn, Icon, ICONS } from '../ui'

// Dubbing lexicon — per-project term glossary (translation + pronunciation).
// Scoped to the clip's project; project='' entries are global (shown everywhere).
export default function LexiconPanel({ project = '', translateAvailable = false, translateTarget = 'fr' }) {
  const [entries, setEntries] = useState([])
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [phonetic, setPhonetic] = useState('')
  const [busy, setBusy] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/lexicon?project=${encodeURIComponent(project)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setEntries(await r.json())
    } catch (e) {
      setError('Chargement du lexique impossible : ' + e.message)
    }
  }, [project])
  useEffect(() => { refresh() }, [refresh])

  async function add() {
    const t = term.trim()
    if (!t || busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/lexicon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, term: t, translation: translation.trim(), phonetic: phonetic.trim() }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setTerm(''); setTranslation(''); setPhonetic('')
      await refresh()
    } catch (e) {
      setError('Ajout impossible : ' + e.message)
    } finally { setBusy(false) }
  }

  async function remove(id) {
    setError(null)
    try {
      const r = await fetch(`/api/lexicon/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError('Suppression impossible : ' + e.message)
    }
  }

  async function autoTranslate() {
    const t = term.trim()
    if (!t || translating) return
    setTranslating(true)
    setError(null)
    try {
      const r = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [t], target: translateTarget, source: 'auto' }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`)
      setTranslation(data.translations?.[0] || '')
    } catch (e) {
      setError('Traduction impossible : ' + e.message)
    } finally { setTranslating(false) }
  }

  const filtered = search.trim()
    ? entries.filter(e => (e.term + ' ' + e.translation).toLowerCase().includes(search.trim().toLowerCase()))
    : entries

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Terme" style={inp} />
        <input value={translation} onChange={e => setTranslation(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Traduction" style={inp} />
        <Btn size="sm" variant="primary" icon={ICONS.plus} onClick={add} disabled={busy || !term.trim()} title="Ajouter" />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input value={phonetic} onChange={e => setPhonetic(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Prononciation" style={inp} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {translateAvailable && (
          <Btn size="sm" variant="outline" icon={ICONS.globe} onClick={autoTranslate} disabled={!term.trim() || translating}>
            {translating ? 'Traduction…' : 'Traduire auto'}
          </Btn>
        )}
        <span style={{ fontSize: 10, color: T.text4 }}>{project ? `Projet « ${project} » + termes globaux` : 'Termes globaux (aucun projet)'}</span>
      </div>
      {error && <div style={{ fontSize: 11, color: T.danger, marginBottom: 8 }}>{error}</div>}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un terme…" style={{ ...inp, width: '100%', marginBottom: 8 }} />
      {filtered.length === 0 ? (
        <p style={{ color: T.text3, fontSize: T.fs.xs, padding: 16, textAlign: 'center' }}>
          {entries.length === 0 ? 'Aucun terme — ajoutez votre premier ci-dessus.' : 'Aucun résultat.'}
        </p>
      ) : filtered.map(e => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', marginBottom: 5, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl }}>
          <Icon d={ICONS.book} size={15} stroke={T.text3} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontSize: T.fs.sm, fontWeight: 600 }}>{e.term}</span>
              {e.translation && <span style={{ fontSize: T.fs.xs, color: T.accent }}>→ {e.translation}</span>}
              {!e.project && <span style={{ fontSize: 8.5, color: T.text4, border: `1px solid ${T.border2}`, borderRadius: 3, padding: '0 4px' }}>global</span>}
            </div>
            {e.phonetic && <div style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, marginTop: 1 }}>/{e.phonetic}/</div>}
          </div>
          <Btn size="sm" icon={ICONS.trash} title="Supprimer" onClick={() => remove(e.id)} />
        </div>
      ))}
    </div>
  )
}

const inp = { flex: 1, minWidth: 0, fontSize: 12, padding: '7px 9px', background: T.bg2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 7, outline: 'none', fontFamily: T.fontUI }
