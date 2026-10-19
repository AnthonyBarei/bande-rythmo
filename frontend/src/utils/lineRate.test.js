import { describe, it, expect } from 'vitest'
import { lineRate, charsPerSec, spokenText, CPS_WARN, CPS_MAX } from './lineRate'

const L = (text, start, end) => ({ text, start, end })
const chars = n => 'a'.repeat(n)

describe('spokenText', () => {
  it('drops notations and breath marks, keeps spaces', () => {
    expect(spokenText('(rires) Bon* ben (HH) oui')).toBe('Bon ben oui')
    expect(spokenText('  a   b ')).toBe('a b')
    expect(spokenText(null)).toBe('')
  })
})

describe('charsPerSec', () => {
  it('counts spoken characters per second', () => {
    expect(charsPerSec('abcdefghij', 1)).toBe(10)
    expect(charsPerSec('(rires)', 0.5)).toBe(0)
  })
  it('is infinite for text on a zero-length line', () => {
    expect(charsPerSec('abc', 0)).toBe(Infinity)
  })
})

describe('lineRate', () => {
  it('is ok at or under the comfortable rate', () => {
    const r = lineRate(L(chars(CPS_WARN * 2), 0, 2))
    expect(r.level).toBe('ok')
    expect(r.reason).toBe('Débit : 20 car/s')
  })

  it('warns above the comfortable rate', () => {
    const r = lineRate(L(chars(23), 0, 1))
    expect(r.level).toBe('warn')
    expect(r.reason).toBe('Débit élevé : 23 car/s')
  })

  it('is danger only above the hard limit', () => {
    expect(lineRate(L(chars(CPS_MAX), 0, 1)).level).toBe('warn')
    const r = lineRate(L(chars(28), 0, 1))
    expect(r.level).toBe('danger')
    expect(r.reason).toBe('Débit trop élevé : 28 car/s (max 25)')
  })

  it('is danger when the line is shorter than 0.3 s', () => {
    const r = lineRate(L('Oui', 1, 1.2))
    expect(r.level).toBe('danger')
    expect(r.reason).toBe('Trop court : < 0,3 s')
    expect(lineRate(L('', 2, 2)).level).toBe('danger')
  })

  it('does not count a short réaction as fast speech', () => {
    expect(lineRate(L('(rires)', 0, 0.4)).level).toBe('ok')
  })
})
