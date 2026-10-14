import { describe, it, expect } from 'vitest'
import { fmtClock, fmtClockPrecise, fmtClockHours, parseTC } from './timecode'

describe('timecode formatters', () => {
    it('carry the rounding into the minute instead of printing :60', () => {
        expect(fmtClock(59.97)).toBe('01:00.0')
        expect(fmtClockPrecise(59.996)).toBe('01:00.00')
        expect(fmtClockHours(3599.999)).toBe('1:00:00.00')
    })

    it('format ordinary values unchanged', () => {
        expect(fmtClock(0)).toBe('00:00.0')
        expect(fmtClock(75.25)).toBe('01:15.3')
        expect(fmtClockPrecise(5.5)).toBe('00:05.50')
        expect(fmtClockHours(3725.5)).toBe('1:02:05.50')
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
