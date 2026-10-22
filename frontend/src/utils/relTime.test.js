import { describe, it, expect } from 'vitest'
import { relTime } from './relTime'

const NOW = Date.parse('2026-10-22T12:00:00')
const ago = s => new Date(NOW - s * 1000).toISOString()

describe('relTime', () => {
  it('says « à l’instant » under a minute', () => {
    expect(relTime(ago(10), NOW)).toBe('à l’instant')
  })
  it('picks the largest unit, singular and plural', () => {
    expect(relTime(ago(60), NOW)).toBe('il y a 1 minute')
    expect(relTime(ago(5 * 3600), NOW)).toBe('il y a 5 heures')
    expect(relTime(ago(2 * 86400), NOW)).toBe('il y a 2 jours')
    expect(relTime(ago(95 * 86400), NOW)).toBe('il y a 3 mois')
    expect(relTime(ago(800 * 86400), NOW)).toBe('il y a 2 ans')
  })
  it('never goes negative and ignores bad input', () => {
    expect(relTime(ago(-30), NOW)).toBe('à l’instant')
    expect(relTime('pas une date', NOW)).toBe('')
  })
})
