import { describe, it, expect } from 'vitest'
import { fmtSMPTE, parseTC } from './timecode'

describe('fmtSMPTE', () => {
    it('formats HH:MM:SS:FF at the clip frame rate', () => {
        expect(fmtSMPTE(0)).toBe('00:00:00:00')
        expect(fmtSMPTE(3725.5, 24)).toBe('01:02:05:12')
        expect(fmtSMPTE(-1, 25)).toBe('-00:00:01:00')
        expect(fmtSMPTE(null)).toBe('--:--:--:--')
    })
})

describe('parseTC', () => {
    it('parses SS, MM:SS.s and HH:MM:SS.s (comma tolerated)', () => {
        expect(parseTC('12.5')).toBe(12.5)
        expect(parseTC('01:15,25')).toBe(75.25)
        expect(parseTC('1:00:01.5')).toBe(3601.5)
    })

    it('rejects input it would otherwise misread', () => {
        expect(parseTC('00:00:05:12')).toBe(null)
        expect(parseTC('abc')).toBe(null)
        expect(parseTC('')).toBe(null)
    })
})
