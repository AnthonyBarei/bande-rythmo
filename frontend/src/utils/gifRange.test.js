import { describe, it, expect } from 'vitest'
import { defaultRange } from './gifRange'

describe('defaultRange', () => {
    it('centres a 6 s window on the playhead', () => {
        expect(defaultRange(20, 66.5)).toEqual({ in: 17, out: 23 })
    })

    it('slides the window inside the clip near its edges', () => {
        expect(defaultRange(0, 66.5)).toEqual({ in: 0, out: 6 })
        expect(defaultRange(66, 66.5)).toEqual({ in: 60.5, out: 66.5 })
    })

    it('selects a clip shorter than the window whole', () => {
        expect(defaultRange(2, 4.2)).toEqual({ in: 0, out: 4.2 })
        expect(defaultRange(0, 0)).toEqual({ in: 0, out: 0 })
    })
})
