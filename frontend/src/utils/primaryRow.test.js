import { describe, it, expect } from 'vitest'
import { primaryRowKey, toMillis, PRIMARY_WINDOW_MS } from './primaryRow'

const NOW = Date.parse('2026-10-14T18:00:00')
const minutesAgo = m => NOW - m * 60 * 1000

describe('primaryRowKey', () => {
    it('picks only the newest row when it finished less than 10 minutes ago', () => {
        const rows = [
            { key: 'old', at: minutesAgo(8) },
            { key: 'new', at: minutesAgo(2) },
            { key: 'mid', at: minutesAgo(5) },
        ]
        expect(primaryRowKey(rows, NOW)).toBe('new')
    })

    it('returns null when the newest row is 10 minutes old or more', () => {
        expect(primaryRowKey([{ key: 'a', at: minutesAgo(10) }], NOW)).toBeNull()
        expect(primaryRowKey([{ key: 'a', at: minutesAgo(45) }, { key: 'b', at: minutesAgo(11) }], NOW)).toBeNull()
    })

    it('does not fall back to an older row when the newest is stale', () => {
        const rows = [{ key: 'stale', at: minutesAgo(12) }, { key: 'older', at: minutesAgo(20) }]
        expect(primaryRowKey(rows, NOW)).toBeNull()
    })

    it('accepts backend ISO timestamps (local time, no offset)', () => {
        const rows = [
            { key: 'iso-old', at: '2026-10-14T17:30:00.123456' },
            { key: 'iso-new', at: '2026-10-14T17:55:30.5' },
        ]
        expect(primaryRowKey(rows, NOW)).toBe('iso-new')
    })

    it('mixes ms and ISO rows and skips rows without a usable time', () => {
        const rows = [
            { key: 'job', at: minutesAgo(1) },
            { key: 'export', at: '2026-10-14T17:57:00' },
            { key: 'none', at: null },
            { key: 'bad', at: 'pas une date' },
        ]
        expect(primaryRowKey(rows, NOW)).toBe('job')
    })

    it('returns null for an empty list', () => {
        expect(primaryRowKey([], NOW)).toBeNull()
    })

    it('honours a custom window', () => {
        expect(primaryRowKey([{ key: 'a', at: minutesAgo(2) }], NOW, 60 * 1000)).toBeNull()
        expect(PRIMARY_WINDOW_MS).toBe(600000)
    })
})

describe('toMillis', () => {
    it('passes numbers through and parses strings', () => {
        expect(toMillis(42)).toBe(42)
        expect(toMillis('2026-10-14T18:00:00')).toBe(NOW)
        expect(toMillis(undefined)).toBeNaN()
        expect(toMillis('')).toBeNaN()
    })
})
