import { describe, it, expect } from 'vitest'
import { lineRate, flagLines, spokenText, timedText, editDelta } from './lineRate'

const L = (text, start, end, extra = {}) => ({ text, start, end, character: 'Red', ...extra })
const words = (...ws) => ws.map(w => ({ w, start: 0, end: 0 }))

describe('spokenText', () => {
  it('drops notations and breath marks, keeps spaces', () => {
    expect(spokenText('(rires) Bon* ben (HH) oui')).toBe('Bon ben oui')
    expect(spokenText('  a   b ')).toBe('a b')
    expect(spokenText(null)).toBe('')
  })
})

describe('timedText / editDelta', () => {
  it('joins the Whisper words, null without words', () => {
    expect(timedText(L('Oui oui', 0, 1, { words: words('Oui', 'oui') }))).toBe('Oui oui')
    expect(timedText(L('Oui', 0, 1))).toBeNull()
    expect(timedText(L('Oui', 0, 1, { words: [] }))).toBeNull()
  })
  it('ignores whitespace and notations when comparing', () => {
    const sub = L("comme l'atmosphère (rires)", 0, 2, { words: words('comme', 'l', "'atmosphère") })
    expect(editDelta(sub)).toBeNull()
  })
  it('measures the signed length change', () => {
    expect(editDelta(L('abcde', 0, 1, { words: words('abcd') }))).toBeCloseTo(0.25)
    expect(editDelta(L('ab', 0, 1, { words: words('abcd') }))).toBeCloseTo(-0.5)
  })
})

describe('lineRate', () => {
  it('does not flag fast natural speech', () => {
    const r = lineRate(L('a'.repeat(40), 0, 1))
    expect(r.level).toBe('ok')
    expect(r.reason).toBeNull()
  })

  it('is danger when the line is shorter than 0.3 s', () => {
    const r = lineRate(L('Oui', 1, 1.2))
    expect(r.level).toBe('danger')
    expect(r.reason).toBe('Trop court : < 0,3 s')
    expect(lineRate(L('', 2, 2)).level).toBe('danger')
  })

  it('is danger when it overlaps the next line of the same character', () => {
    const r = lineRate(L('Salut', 0, 2), { next: L('Toi', 1.5, 3) })
    expect(r.level).toBe('danger')
    expect(r.reason).toBe('Chevauche la réplique suivante de Red')
    expect(lineRate(L('Salut', 0, 2), { next: L('Toi', 2, 3) }).level).toBe('ok')
  })

  it('warns when the edited text changed by more than 30 %', () => {
    const sub = L('Tu veux pas le rejoindre et te détendre ?', 0, 3, { words: words('Tu', 'veux', 'pas', 'le', 'rejoindre') })
    const r = lineRate(sub)
    expect(r.level).toBe('warn')
    expect(r.reason).toMatch(/^Texte modifié : \+\d+ % par rapport au texte calé$/)
    const shorter = lineRate(L('abc', 0, 1, { words: words('abcdefghij') }))
    expect(shorter.reason).toBe('Texte modifié : −70 % par rapport au texte calé')
  })

  it('does not warn on small edits or without a timed reference', () => {
    expect(lineRate(L('abcde', 0, 1, { words: words('abcd') })).level).toBe('ok')
    expect(lineRate(L('a totally new line of text', 0, 1)).level).toBe('ok')
  })

  it('ranks danger above an edit warning', () => {
    expect(lineRate(L('abcdefgh', 0, 0.2, { words: words('ab') })).level).toBe('danger')
  })
})

describe('flagLines', () => {
  it('finds the next line of the same character in time order', () => {
    const subs = [
      L('A1', 0, 2),
      L('B1', 1, 3, { character: 'Dale' }),
      L('A2', 1.5, 4),
      L('B2', 3, 5, { character: 'Dale' }),
    ]
    const r = flagLines(subs)
    expect(r.map(x => x.level)).toEqual(['danger', 'ok', 'ok', 'ok'])
    expect(r[0].reason).toBe('Chevauche la réplique suivante de Red')
  })

  it('ignores hidden lines as neighbours', () => {
    const subs = [L('A1', 0, 2), L('A2', 1, 3, { hidden: true })]
    expect(flagLines(subs)[0].level).toBe('ok')
  })
})
