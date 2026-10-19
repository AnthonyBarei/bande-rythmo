import { describe, it, expect } from 'vitest'
import { fmtDuration, fmtHMS } from './duration'

describe('fmtDuration', () => {
    it('uses M:SS under an hour, no decimals', () => {
        expect(fmtDuration(301.06)).toBe('5:01')
        expect(fmtDuration(3313.15)).toBe('55:13')
        expect(fmtDuration(12.36)).toBe('0:12')
        expect(fmtDuration(4.81)).toBe('0:05')
        expect(fmtDuration(0)).toBe('0:00')
    })

    it('switches to H:MM:SS from one hour, carrying the rounding', () => {
        expect(fmtDuration(3599.6)).toBe('1:00:00')
        expect(fmtDuration(3725.2)).toBe('1:02:05')
    })

    it('treats invalid or negative input as zero', () => {
        expect(fmtDuration(undefined)).toBe('0:00')
        expect(fmtDuration(-3)).toBe('0:00')
    })
})

describe('fmtHMS', () => {
    it('drops frames and pads every field', () => {
        expect(fmtHMS(0)).toBe('00:00:00')
        expect(fmtHMS(10)).toBe('00:00:10')
        expect(fmtHMS(66.44)).toBe('00:01:06')
        expect(fmtHMS(3725.9)).toBe('01:02:05')
    })

    it('absorbs float drift on tick values', () => {
        expect(fmtHMS(9.9999999)).toBe('00:00:10')
        expect(fmtHMS(0.1 * 3 * 10)).toBe('00:00:03')
    })
})
