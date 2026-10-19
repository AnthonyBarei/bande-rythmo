import { describe, it, expect } from 'vitest'
import { FAMILY_COLORS, FORMAT_FAMILY, formatColor } from './formatColors'

const DANGER = '#E8595D'

describe('formatColor', () => {
    it('gives every format of a family the same color', () => {
        expect(formatColor('mp4')).toBe(formatColor('mp4-dubbed'))
        expect(formatColor('srt')).toBe(formatColor('ass-karaoke'))
        expect(formatColor('mp3')).toBe(formatColor('wav'))
        expect(formatColor('detx')).toBe(formatColor('croisille'))
    })

    it('paints GIF violet, never red', () => {
        expect(formatColor('gif')).toBe('#A98BF0')
    })

    it('never uses the danger color or a red hue for a format', () => {
        for (const id of Object.keys(FORMAT_FAMILY)) {
            const c = formatColor(id)
            expect(c.toUpperCase()).not.toBe(DANGER)
            const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16)
            expect(r > 200 && g < 110 && b < 110).toBe(false)
        }
        expect(Object.values(FAMILY_COLORS)).not.toContain(DANGER)
    })

    it('falls back to a neutral grey for unknown formats', () => {
        expect(formatColor('xyz')).toBe('#A6A6AE')
    })
})
