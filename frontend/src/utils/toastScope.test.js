import { describe, it, expect } from 'vitest'
import { inExportQueue, toastsFor } from './toastScope'

const job = (key, extra = {}) => ({ key, status: 'running', ...extra })
const mp4 = job('mp4', { queue: 'export', clipId: 'c1' })
const otherClipExport = job('mp4-c2', { queue: 'export', clipId: 'c2' })
const whisper = job('whisper', { clipId: 'c1' })
const gif = job('gif', { clipId: 'c1' })
const proxy = job('proxy')

describe('inExportQueue', () => {
    it('matches only export-screen jobs of the given clip', () => {
        expect(inExportQueue(mp4, 'c1')).toBe(true)
        expect(inExportQueue(otherClipExport, 'c1')).toBe(false)
        expect(inExportQueue(whisper, 'c1')).toBe(false)
        expect(inExportQueue(mp4, null)).toBe(false)
    })
})

describe('toastsFor', () => {
    it('shows nothing on Activité', () => {
        expect(toastsFor([mp4, whisper], { route: 'activity' })).toEqual({ shown: [], hidden: 0 })
    })

    it('drops the jobs already listed in the Exporter queue', () => {
        const { shown, hidden } = toastsFor([mp4, whisper, otherClipExport], { route: 'export', queueClipId: 'c1' })
        expect(shown.map(j => j.key)).toEqual(['whisper', 'mp4-c2'])
        expect(hidden).toBe(0)
    })

    it('keeps the newest two and counts the rest', () => {
        const { shown, hidden } = toastsFor([whisper, gif, proxy, otherClipExport], { route: 'export', queueClipId: 'c1' })
        expect(shown.map(j => j.key)).toEqual(['proxy', 'mp4-c2'])
        expect(hidden).toBe(2)
    })

    it('keeps every job elsewhere, still stacked two high', () => {
        const { shown, hidden } = toastsFor([mp4, whisper, gif], { route: 'memes' })
        expect(shown.map(j => j.key)).toEqual(['whisper', 'gif'])
        expect(hidden).toBe(1)
    })

    it('handles an empty list', () => {
        expect(toastsFor([], { route: 'dub' })).toEqual({ shown: [], hidden: 0 })
    })
})
