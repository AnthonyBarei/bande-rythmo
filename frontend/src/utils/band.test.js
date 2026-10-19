import { describe, it, expect } from 'vitest'
import { bandTimeOf, videoTimeOf, isActiveAt, activeIndexAt } from './band'

const sub = (start, end, extra = {}) => ({ start, end, text: '', ...extra })

describe('band time', () => {
    it('adds the offset to the video time and converts back', () => {
        expect(bandTimeOf(10, 0.5)).toBe(10.5)
        expect(bandTimeOf(10, -0.5)).toBe(9.5)
        expect(videoTimeOf(10.5, 0.5)).toBe(10)
    })

    it('never seeks the video before 0', () => {
        expect(videoTimeOf(0.2, 1)).toBe(0)
    })

    it('treats a missing video time / offset as 0', () => {
        expect(bandTimeOf(undefined, undefined)).toBe(0)
    })
})

describe('active réplique', () => {
    it('finds the réplique under the band time', () => {
        const subs = [sub(0, 1), sub(2, 3)]
        expect(activeIndexAt(subs, 2.5)).toBe(1)
        expect(activeIndexAt(subs, 1.5)).toBe(-1)
    })

    it('ignores hidden répliques', () => {
        const subs = [sub(0, 3, { hidden: true }), sub(2, 4)]
        expect(isActiveAt(subs[0], 1)).toBe(false)
        expect(activeIndexAt(subs, 1)).toBe(-1)
        expect(activeIndexAt(subs, 2.5)).toBe(1)
    })
})
