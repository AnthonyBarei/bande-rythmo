// Apply translations (computed for `sent`, the répliques as they were when the
// request left) onto `current`, the répliques as they are now. A réplique is
// matched by identity first, then by unchanged content (start/end/character/
// text — survives undo/redo copies). Edited or deleted répliques keep the
// user's version; their count is returned as `skipped`.

const sameContent = (a, b) =>
  a.start === b.start && a.end === b.end
  && (a.character || '') === (b.character || '')
  && (a.text || '') === (b.text || '')

export function mergeTranslations(sent, translations, current) {
  const byRef = new Map(sent.map((s, i) => [s, i]))
  const used = new Set()

  function matchIndex(sub, pos) {
    const j = byRef.get(sub)
    if (j != null && !used.has(j)) return j
    if (sent[pos] && !used.has(pos) && sameContent(sent[pos], sub)) return pos
    return sent.findIndex((s, k) => !used.has(k) && sameContent(s, sub))
  }

  const merged = current.map((sub, pos) => {
    const j = matchIndex(sub, pos)
    if (j < 0) return sub
    used.add(j)
    const tr = translations[j]
    return tr == null ? sub : { ...sub, text: tr, words: null }
  })

  const skipped = sent.filter((s, j) => !used.has(j) && (s.text || '').trim() && translations[j] != null).length
  return { merged, skipped }
}
