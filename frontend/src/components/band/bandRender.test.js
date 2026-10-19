import { describe, expect, it } from 'vitest'
import { bandAccent, bandCanvasHeight, buildCharMap, resolveSigns, validWords, DEFAULT_ACCENT } from './bandRender'

describe('bandRender helpers', () => {
  it('maps characters to tracks in first-appearance order', () => {
    const map = buildCharMap([{ character: 'Red' }, { character: '' }, { character: 'Dale' }, { character: 'Red' }])
    expect(map).toEqual({ Red: 0, '': 1, Dale: 2 })
  })

  it('caps the initial canvas height at 240', () => {
    expect(bandCanvasHeight(1)).toBe(76)
    expect(bandCanvasHeight(5)).toBe(240)
  })

  it('falls back to the default accent unless #rrggbb', () => {
    expect(bandAccent('#5AA9F0')).toBe('#5AA9F0')
    expect(bandAccent('var(--accent)')).toBe(DEFAULT_ACCENT)
    expect(bandAccent(undefined)).toBe(DEFAULT_ACCENT)
  })

  it('keeps word timing only while it matches the text and bounds', () => {
    const sub = { text: 'ça roule', start: 1, end: 2, words: [{ w: 'ça ', start: 1, end: 1.4 }, { w: 'roule', start: 1.4, end: 2 }] }
    expect(validWords(sub)).toBe(sub.words)
    expect(validWords({ ...sub, text: 'ça roule ?' })).toBeNull()
    expect(validWords({ ...sub, end: 1.5 })).toBeNull()
  })

  it('prefers persisted signs and auto-classifies only when enabled', () => {
    const persisted = [{ i: 0, type: 'labiale', t0: 1, t1: 1.1 }]
    expect(resolveSigns({ w: 'ma', start: 1, end: 2, signs: persisted }, true)).toBe(persisted)
    expect(resolveSigns({ w: 'ma', start: 1, end: 2 }, false)).toEqual([])
    const auto = resolveSigns({ w: 'ma', start: 1, end: 2 }, true)
    expect(auto[0]).toMatchObject({ i: 0, type: 'labiale', t0: 1, t1: 1.5 })
  })
})
