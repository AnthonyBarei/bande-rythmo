import { describe, it, expect } from 'vitest'
import { createHistory, pushHistory, undoHistory, redoHistory, canUndo, canRedo } from './history'

const sub = (start, text) => ({ start, end: start + 1, text, character: '' })

describe('history', () => {
    it('seeds with the initial state, nothing to undo/redo', () => {
        const h = createHistory([sub(0, 'a')])
        expect(canUndo(h)).toBe(false)
        expect(canRedo(h)).toBe(false)
    })

    it('push → undo returns the previous snapshot', () => {
        const h = createHistory([sub(0, 'a')])
        pushHistory(h, [sub(0, 'a'), sub(2, 'b')])
        expect(canUndo(h)).toBe(true)
        const prev = undoHistory(h)
        expect(prev).toHaveLength(1)
        expect(prev[0].text).toBe('a')
        expect(canRedo(h)).toBe(true)
    })

    it('redo replays the undone snapshot', () => {
        const h = createHistory([sub(0, 'a')])
        pushHistory(h, [sub(0, 'a'), sub(2, 'b')])
        undoHistory(h)
        const next = redoHistory(h)
        expect(next).toHaveLength(2)
        expect(next[1].text).toBe('b')
        expect(canRedo(h)).toBe(false)
    })

    it('push after undo drops the redo branch', () => {
        const h = createHistory([sub(0, 'a')])
        pushHistory(h, [sub(0, 'b')])
        undoHistory(h)
        pushHistory(h, [sub(0, 'c')])
        expect(canRedo(h)).toBe(false)
        expect(undoHistory(h)[0].text).toBe('a')
    })

    it('caps the stack and keeps the most recent states', () => {
        const h = createHistory([sub(0, 'v0')], 5)
        for (let i = 1; i <= 10; i++) pushHistory(h, [sub(0, `v${i}`)])
        expect(h.stack.length).toBe(5)
        // walk all the way back — oldest reachable is v6
        let last = null, cur
        while ((cur = undoHistory(h)) !== null) last = cur
        expect(last[0].text).toBe('v6')
    })

    it('undo at the boundary returns null and does not move', () => {
        const h = createHistory([sub(0, 'a')])
        expect(undoHistory(h)).toBeNull()
        expect(h.idx).toBe(0)
        expect(redoHistory(h)).toBeNull()
    })

    it('snapshots are deep copies — later mutations cannot corrupt history', () => {
        const live = [sub(0, 'a')]
        const h = createHistory(live)
        live[0].text = 'MUTATED'
        pushHistory(h, live)
        const prev = undoHistory(h)
        expect(prev[0].text).toBe('a')
    })
})
