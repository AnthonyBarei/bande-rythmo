// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useSubtitleManager from './useSubtitleManager'

const sub = (start, text, character = '') => ({ start, end: start + 1, text, character })

function mockFetchOk() {
    const fn = vi.fn(async (url, opts) => ({
        ok: true,
        json: async () => ({ clip_id: 'c1', subtitles: JSON.parse(opts.body).subtitles }),
    }))
    globalThis.fetch = fn
    return fn
}

describe('useSubtitleManager', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

    const setup = (initial = [sub(0, 'a'), sub(2, 'b')]) =>
        renderHook(() => useSubtitleManager({ clipId: 'c1', initialSubtitles: initial, onSaved: vi.fn() }))

    it('changeSubtitles sorts by start and marks unsaved', () => {
        mockFetchOk()
        const { result } = setup()
        act(() => { result.current.changeSubtitles([sub(5, 'late'), sub(1, 'early')]) })
        expect(result.current.subtitles.map(s => s.text)).toEqual(['early', 'late'])
        expect(result.current.saveStatus).toBe('unsaved')
    })

    it('tracks the selected réplique through the sort', () => {
        mockFetchOk()
        const { result } = setup()
        act(() => { result.current.setSelectedIdx(0) })
        // index 0 = the late one pre-sort → ends up at index 1 post-sort
        act(() => { result.current.changeSubtitles([sub(5, 'late'), sub(1, 'early')]) })
        expect(result.current.selectedIdx).toBe(1)
    })

    it('autosaves (debounced 1.5s) via PUT and lands on saved', async () => {
        const fetchFn = mockFetchOk()
        const { result } = setup()
        act(() => { result.current.changeSubtitles([sub(0, 'x')]) })
        expect(fetchFn).not.toHaveBeenCalled()
        await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
        expect(fetchFn).toHaveBeenCalledOnce()
        expect(fetchFn.mock.calls[0][0]).toBe('/api/clips/c1/subtitles')
        expect(fetchFn.mock.calls[0][1].method).toBe('PUT')
        expect(result.current.saveStatus).toBe('saved')
    })

    it('save failure lands on error', async () => {
        globalThis.fetch = vi.fn(async () => ({ ok: false }))
        const { result } = setup()
        act(() => { result.current.changeSubtitles([sub(0, 'x')]) })
        await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
        expect(result.current.saveStatus).toBe('error')
    })

    it('undo restores the previous state, redo replays it', () => {
        mockFetchOk()
        const { result } = setup([sub(0, 'a')])
        act(() => { result.current.changeSubtitles([sub(0, 'a'), sub(2, 'b')]) })
        expect(result.current.canUndo).toBe(true)
        act(() => { result.current.undo() })
        expect(result.current.subtitles).toHaveLength(1)
        expect(result.current.canRedo).toBe(true)
        act(() => { result.current.redo() })
        expect(result.current.subtitles).toHaveLength(2)
    })

    it('setSubtitlesTransient renders without touching history or save', () => {
        mockFetchOk()
        const { result } = setup([sub(0, 'a')])
        act(() => { result.current.setSubtitlesTransient([sub(0, 'a'), sub(1, 'tmp')]) })
        expect(result.current.subtitles).toHaveLength(2)
        expect(result.current.canUndo).toBe(false)
        expect(result.current.saveStatus).toBe('saved')
    })

    it('commitDrag saves the latest state after 0.8s without history', async () => {
        const fetchFn = mockFetchOk()
        const { result } = setup([sub(0, 'a')])
        act(() => { result.current.commitDrag([sub(0.5, 'a')]) })
        expect(result.current.saveStatus).toBe('unsaved')
        expect(result.current.canUndo).toBe(false)
        await act(async () => { await vi.advanceTimersByTimeAsync(900) })
        expect(fetchFn).toHaveBeenCalledOnce()
        const saved = JSON.parse(fetchFn.mock.calls[0][1].body).subtitles
        expect(saved[0].start).toBe(0.5)
    })

    it('saveNow flushes immediately', async () => {
        const fetchFn = mockFetchOk()
        const { result } = setup([sub(0, 'a')])
        act(() => { result.current.changeSubtitles([sub(0, 'edit')]) })
        await act(async () => { result.current.saveNow() })
        expect(fetchFn).toHaveBeenCalledOnce()
    })

    it('flushes unsaved edits on unmount', async () => {
        const fetchFn = mockFetchOk()
        const { result, unmount } = setup([sub(0, 'a')])
        act(() => { result.current.changeSubtitles([sub(0, 'edit')]) })
        await act(async () => { unmount() })
        expect(fetchFn).toHaveBeenCalledOnce()
    })
    it('keeps the selection on the same réplique when another row is deleted', () => {
        mockFetchOk()
        const { result } = setup([sub(0, 'a'), sub(2, 'b'), sub(4, 'c')])
        act(() => { result.current.setSelectedIdx(2) })
        act(() => { result.current.changeSubtitles(result.current.subtitles.filter((_, i) => i !== 0)) })
        expect(result.current.selectedIdx).toBe(1)
        expect(result.current.subtitles[1].text).toBe('c')
    })

    it('clears the selection when the selected réplique is deleted', () => {
        mockFetchOk()
        const { result } = setup([sub(0, 'a'), sub(2, 'b'), sub(4, 'c')])
        act(() => { result.current.setSelectedIdx(1) })
        act(() => { result.current.changeSubtitles(result.current.subtitles.filter((_, i) => i !== 1)) })
        expect(result.current.selectedIdx).toBe(null)
    })

    it('stays unsaved when edits land while a save is in flight, and flushes them on unmount', async () => {
        let resolveFirst
        const fetchFn = vi.fn((url, opts) => new Promise(resolve => {
            const reply = () => resolve({ ok: true, json: async () => ({ clip_id: 'c1', subtitles: JSON.parse(opts.body).subtitles }) })
            if (!resolveFirst) resolveFirst = reply
            else reply()
        }))
        globalThis.fetch = fetchFn
        const { result, unmount } = setup([sub(0, 'a')])
        act(() => { result.current.changeSubtitles([sub(0, 'first')]) })
        await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
        expect(fetchFn).toHaveBeenCalledOnce()
        act(() => { result.current.changeSubtitles([sub(0, 'second')]) })
        await act(async () => { resolveFirst() })
        expect(result.current.saveStatus).toBe('unsaved')
        await act(async () => { unmount() })
        expect(fetchFn).toHaveBeenCalledTimes(2)
        expect(JSON.parse(fetchFn.mock.calls[1][1].body).subtitles[0].text).toBe('second')
    })

    it('retries a failed save on unmount', async () => {
        globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500 }))
        const { result, unmount } = setup([sub(0, 'a')])
        act(() => { result.current.changeSubtitles([sub(0, 'x')]) })
        await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
        expect(result.current.saveStatus).toBe('error')
        await act(async () => { unmount() })
        expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('finishDrag records the whole drag as one sorted undo step', async () => {
        const fetchFn = mockFetchOk()
        const { result } = setup([sub(0, 'a'), sub(2, 'b')])
        act(() => { result.current.commitDrag([sub(3, 'a'), sub(2, 'b')]) })
        act(() => { result.current.commitDrag([sub(5, 'a'), sub(2, 'b')]) })
        await act(async () => { result.current.finishDrag() })
        expect(result.current.subtitles.map(s => s.text)).toEqual(['b', 'a'])
        expect(fetchFn).toHaveBeenCalledOnce()
        expect(result.current.canUndo).toBe(true)
        act(() => { result.current.undo() })
        expect(result.current.subtitles.map(s => s.start)).toEqual([0, 2])
    })
})
