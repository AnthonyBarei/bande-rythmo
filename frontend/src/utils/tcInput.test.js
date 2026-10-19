import { describe, it, expect } from 'vitest'
import { parseTimecodeInput } from './tcInput'

describe('parseTimecodeInput', () => {
    it('parses full SMPTE HH:MM:SS:FF at the given fps', () => {
        expect(parseTimecodeInput('00:01:02:12', 24)).toBe(62.5)
        expect(parseTimecodeInput('01:00:00:00', 25)).toBe(3600)
        expect(parseTimecodeInput('00:00:10;15', 30)).toBe(10.5)
    })

    it('defaults to 25 fps', () => {
        expect(parseTimecodeInput('00:00:01:05')).toBeCloseTo(1.2, 10)
    })

    it('accepts shorter forms: HH:MM:SS, MM:SS and SS, decimals on the last field', () => {
        expect(parseTimecodeInput('1:02:03')).toBe(3723)
        expect(parseTimecodeInput('12:34')).toBe(754)
        expect(parseTimecodeInput('12:34.5')).toBe(754.5)
        expect(parseTimecodeInput('12:34,5')).toBe(754.5)
        expect(parseTimecodeInput('42')).toBe(42)
        expect(parseTimecodeInput(' 7.25 ')).toBe(7.25)
    })

    it('lets the leading field overflow', () => {
        expect(parseTimecodeInput('90')).toBe(90)
        expect(parseTimecodeInput('75:00')).toBe(4500)
    })

    it('rejects out-of-range fields and frames at or above fps', () => {
        expect(parseTimecodeInput('00:61:00')).toBe(null)
        expect(parseTimecodeInput('12:60')).toBe(null)
        expect(parseTimecodeInput('00:00:01:25', 25)).toBe(null)
        expect(parseTimecodeInput('00:00:01:24', 25)).toBe(1.96)
    })

    it('rejects malformed input', () => {
        expect(parseTimecodeInput('')).toBe(null)
        expect(parseTimecodeInput('   ')).toBe(null)
        expect(parseTimecodeInput('abc')).toBe(null)
        expect(parseTimecodeInput('12:')).toBe(null)
        expect(parseTimecodeInput(':12')).toBe(null)
        expect(parseTimecodeInput('1:2:3:4:5')).toBe(null)
        expect(parseTimecodeInput('00:00:01.5:10')).toBe(null)
        expect(parseTimecodeInput('-5')).toBe(null)
        expect(parseTimecodeInput(null)).toBe(null)
    })
})
