import { describe, it, expect } from 'vitest'
import { setIn, setOut, markStep, markPhase, isComplete } from './inOut'

const S = (markIn, markOut) => ({ markIn, markOut })

describe('setIn', () => {
    it('sets IN and keeps a later OUT', () => {
        expect(setIn(S(null, 20), 10)).toEqual({ markIn: 10, markOut: 20, banked: null })
        expect(setIn(S(5, 20), 8)).toEqual({ markIn: 8, markOut: 20, banked: null })
    })

    it('clears OUT when IN lands at or past it, banking the previous range', () => {
        expect(setIn(S(10, 20), 30)).toEqual({ markIn: 30, markOut: null, banked: { start: 10, end: 20 } })
        expect(setIn(S(10, 20), 20)).toEqual({ markIn: 20, markOut: null, banked: { start: 10, end: 20 } })
    })

    it('does not bank a lone OUT', () => {
        expect(setIn(S(null, 20), 25)).toEqual({ markIn: 25, markOut: null, banked: null })
    })
})

describe('setOut', () => {
    it('sets OUT after IN, or alone', () => {
        expect(setOut(S(10, null), 15)).toEqual({ markIn: 10, markOut: 15, banked: null })
        expect(setOut(S(null, null), 15)).toEqual({ markIn: null, markOut: 15, banked: null })
    })

    it('ignores an OUT at or before IN', () => {
        expect(setOut(S(10, 20), 10)).toEqual({ markIn: 10, markOut: 20, banked: null })
        expect(setOut(S(10, null), 4)).toEqual({ markIn: 10, markOut: null, banked: null })
    })
})

describe('markStep (header button)', () => {
    it('IN, then OUT, then banks the range and starts over', () => {
        const a = markStep(S(null, null), 4)
        expect(a).toEqual({ markIn: 4, markOut: null, banked: null })
        const b = markStep(a, 9)
        expect(b).toEqual({ markIn: 4, markOut: 9, banked: null })
        expect(markStep(b, 12)).toEqual({ markIn: null, markOut: null, banked: { start: 4, end: 9 } })
    })

    it('swaps a second press before IN, ignores one too close', () => {
        expect(markStep(S(9, null), 4)).toEqual({ markIn: 4, markOut: 9, banked: null })
        expect(markStep(S(9, null), 9.1)).toEqual({ markIn: 9, markOut: null, banked: null })
    })
})

describe('markPhase', () => {
    it('reports none / in / range', () => {
        expect(markPhase(S(null, null))).toBe('none')
        expect(markPhase(S(null, 3))).toBe('none')
        expect(markPhase(S(2, null))).toBe('in')
        expect(markPhase(S(2, 3))).toBe('range')
        expect(isComplete(S(2, 3))).toBe(true)
    })
})
