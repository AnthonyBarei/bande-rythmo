import { describe, expect, it } from 'vitest'
import { bandAccent, bandCanvasHeight, buildCharMap, resolveSigns, validWords, DEFAULT_ACCENT, focusTrackOf, trackAlpha, underlineColor, FOCUS_DIM } from './bandRender'

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

  it('dims the tracks of other characters when a character is focused', () => {
    const map = { Red: 0, '': 1, Dale: 2 }
    expect(focusTrackOf(map, null)).toBeNull()
    expect(focusTrackOf(map, '')).toBe(1)
    expect(focusTrackOf(map, 'Nobody')).toBeNull()
    const ft = focusTrackOf(map, 'Dale')
    expect(trackAlpha(2, ft)).toBe(1)
    expect(trackAlpha(0, ft)).toBe(FOCUS_DIM)
    expect(trackAlpha(0, null)).toBe(1)
    expect(FOCUS_DIM).toBe(0.45)
  })

  it('underlines only flagged lines: danger red, edited in accent', () => {
    expect(underlineColor('danger', '#F5C518')).toBe('#E8595D')
    expect(underlineColor('warn', '#F5C518')).toBe('#F5C518')
    expect(underlineColor('ok', '#F5C518')).toBeNull()
    expect(underlineColor(undefined, '#F5C518')).toBeNull()
  })
})
