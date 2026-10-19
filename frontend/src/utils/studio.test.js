import { describe, expect, it } from 'vitest'
import { adjacentLine, characterProgress, listenVoVolume } from './studio'

const SUBS = [
    { character: 'Red', start: 0.2 },
    { character: 'Red', start: 1.8 },
    { character: 'Dale', start: 4.0 },
    { character: 'Red', start: 6.5 },
    { character: '', start: 8.0 },
]

describe('adjacentLine', () => {
    it('steps through the same character', () => {
        expect(adjacentLine(SUBS, 1, 1, true)).toBe(3)
        expect(adjacentLine(SUBS, 3, -1, true)).toBe(1)
        expect(adjacentLine(SUBS, 3, 1, true)).toBeNull()
        expect(adjacentLine(SUBS, 2, 1, true)).toBeNull()
    })

    it('steps through any character', () => {
        expect(adjacentLine(SUBS, 1, 1, false)).toBe(2)
        expect(adjacentLine(SUBS, 0, -1, false)).toBeNull()
        expect(adjacentLine(SUBS, 4, -1, false)).toBe(3)
    })

    it('follows time order, not array order', () => {
        const subs = [{ character: 'A', start: 5 }, { character: 'A', start: 1 }, { character: 'B', start: 3 }]
        expect(adjacentLine(subs, 1, 1, false)).toBe(2)
        expect(adjacentLine(subs, 1, 1, true)).toBe(0)
    })

    it('starts at an end with no current réplique', () => {
        expect(adjacentLine(SUBS, null, 1, true)).toBe(0)
        expect(adjacentLine(SUBS, null, -1, true)).toBe(4)
        expect(adjacentLine([], null, 1, true)).toBeNull()
    })
})

describe('characterProgress', () => {
    const takes = [
        { subtitle_index: 0, best: true },
        { subtitle_index: 0, best: false },
        { subtitle_index: 1, best: false },
        { subtitle_index: 2, best: true },
        { subtitle_index: 9, best: true },
        { subtitle_index: null, best: true },
    ]

    it('counts validated répliques of the character', () => {
        expect(characterProgress(SUBS, takes, 'Red')).toEqual({ done: 1, total: 3 })
        expect(characterProgress(SUBS, takes, 'Dale')).toEqual({ done: 1, total: 1 })
        expect(characterProgress(SUBS, takes, '')).toEqual({ done: 0, total: 1 })
    })

    it('counts a réplique once even with several best flags', () => {
        const dup = [{ subtitle_index: 3, best: true }, { subtitle_index: 3, best: true }]
        expect(characterProgress(SUBS, dup, 'Red')).toEqual({ done: 1, total: 3 })
    })
})

describe('listenVoVolume', () => {
    it('reads the setting as a fraction, default .15', () => {
        expect(listenVoVolume(undefined)).toBe(0.15)
        expect(listenVoVolume('')).toBe(0.15)
        expect(listenVoVolume('abc')).toBe(0.15)
        expect(listenVoVolume(0)).toBe(0)
        expect(listenVoVolume(0.15)).toBe(0.15)
        expect(listenVoVolume(0.5)).toBe(0.5)
    })

    it('accepts a percent too', () => {
        expect(listenVoVolume(15)).toBe(0.15)
        expect(listenVoVolume('50')).toBe(0.5)
        expect(listenVoVolume(300)).toBe(1)
    })
})
