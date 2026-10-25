import React, { useState, useEffect, useCallback, useRef } from 'react'
import { T, Btn, Icon, ICONS, Input, Toggle, pressable } from '../ui'

const NO_PROVIDER_TIP = 'Aucun fournisseur de traduction configuré — voir Réglages › Auto-traduction'

// Dubbing lexicon — per-project term glossary (translation + pronunciation).
// Shows the clip's project terms + global ones (no project, shown everywhere).
export default function LexiconPanel({ projectId = null, projectName = '', translateAvailable = false, translateTarget = 'fr' }) {
  const [entries, setEntries] = useState([])
  const [asGlobal, setAsGlobal] = useState(!projectId)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [busy, setBusy] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState(null)
  const termInputRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(projectId ? `/api/lexicon?project_id=${encodeURIComponent(projectId)}` : '/api/lexicon')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setEntries(await r.json())
    } catch (e) {
      setError('Chargement du lexique impossible : ' + e.message)
    }
  }, [projectId])
  useEffect(() => { refresh() }, [refresh])

  async function add() {
    const t = term.trim()
    if (!t) { termInputRef.current?.focus(); return }
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/lexicon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, global_entry: asGlobal || !projectId, term: t, translation: translation.trim() }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setTerm(''); setTranslation('')
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

  // PUT replaces translation/phonetic/note — send the whole entry; omitting
  // `project` keeps its scope.
  async function savePhonetic(entry, phonetic) {
    const next = phonetic.trim()
    if (next === (entry.phonetic || '')) return
    setError(null)
    try {
      const r = await fetch(`/api/lexicon/${entry.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: entry.term, translation: entry.translation, phonetic: next, note: entry.note }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError('Prononciation non enregistrée : ' + e.message)
    }
  }

  async function autoTranslate() {
    const t = term.trim()
    if (!t) { termInputRef.current?.focus(); return }
    if (translating) return
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Input ref={termInputRef} value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Terme" aria-label="Terme" style={{ flex: 1 }} />
        <Input value={translation} onChange={e => setTranslation(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Traduction" aria-label="Traduction" style={{ flex: 1 }} />
        <Btn size="sm" variant="primary" icon={ICONS.plus} onClick={add} disabled={busy} title="Ajouter" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span title={translateAvailable ? `Traduire le terme (→ ${translateTarget.toUpperCase()})` : NO_PROVIDER_TIP} style={{ display: 'inline-flex' }}>
          <Btn size="sm" variant="outline" icon={ICONS.globe} onClick={autoTranslate} disabled={!translateAvailable || translating}
            style={translateAvailable ? undefined : { pointerEvents: 'none' }}>
            {translating ? 'Traduction…' : 'Traduire auto'}
          </Btn>
        </span>
        <div style={{ flex: 1 }} />
        {projectId
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, color: T.text3 }}
              title={asGlobal ? 'Les nouveaux termes valent pour tous les projets' : `Les nouveaux termes valent pour « ${projectName || 'ce projet'} »`}>
              Global
              <Toggle on={asGlobal} onClick={() => setAsGlobal(g => !g)} label="Nouveaux termes globaux" />
            </span>
          : <span style={{ fontSize: 10, color: T.text4 }}>Termes globaux (aucun projet)</span>}
      </div>
      {error && <div style={{ fontSize: 11, color: T.danger, marginBottom: 8 }}>{error}</div>}
      {entries.length > 0 && (
        <Input icon={ICONS.search} value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un terme…" aria-label="Rechercher un terme" style={{ marginBottom: 8 }} />
      )}
      {filtered.length === 0 ? (
        <p style={{ color: T.text3, fontSize: T.fs.xs, padding: 16, textAlign: 'center' }}>
          {entries.length === 0 ? 'Aucun terme — ajoutez votre premier ci-dessus.' : 'Aucun résultat.'}
        </p>
      ) : filtered.map(e => (
        <LexiconRow key={e.id} entry={e} onRemove={() => remove(e.id)} onSavePhonetic={ph => savePhonetic(e, ph)} />
      ))}
    </div>
  )
}

// One entry — reference LexiconPanel row; prononciation /…/ under the term,
// edited inline on click.
function LexiconRow({ entry, onRemove, onSavePhonetic }) {
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelRef = useRef(false)

  function startEdit() { cancelRef.current = false; setDraft(entry.phonetic || ''); setEditing(true) }
  function commit() {
    setEditing(false)
    if (!cancelRef.current) onSavePhonetic(draft)
  }

  const phStyle = { fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, marginTop: 1 }
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', marginBottom: 5, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl }}>
      <Icon d={ICONS.book} size={15} stroke={T.text3} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: T.fs.sm, fontWeight: 600 }}>{entry.term}</span>
          {entry.translation && <span style={{ fontSize: T.fs.xs, color: T.accent }}>→ {entry.translation}</span>}
          {!entry.project_id && <span style={{ fontSize: 8.5, color: T.text4, border: `1px solid ${T.border2}`, borderRadius: 3, padding: '0 4px' }}>global</span>}
        </div>
        {editing ? (
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { cancelRef.current = true; e.currentTarget.blur() } }}
            placeholder="prononciation" aria-label="Prononciation"
            style={{ ...phStyle, width: '100%', boxSizing: 'border-box', padding: '1px 4px', background: T.bg2, border: `1px solid ${T.border2}`, borderRadius: 4, outline: 'none' }} />
        ) : entry.phonetic ? (
          <div onClick={startEdit} {...pressable(true)} title="Modifier la prononciation" style={{ ...phStyle, cursor: 'text' }}>/{entry.phonetic}/</div>
        ) : hover && (
          <div onClick={startEdit} {...pressable(true)} title="Ajouter la prononciation" style={{ ...phStyle, color: T.text4, cursor: 'text' }}>/…/</div>
        )}
      </div>
      <Btn size="sm" icon={ICONS.trash} title="Supprimer" onClick={onRemove} />
    </div>
  )
}
