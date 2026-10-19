import { describe, it, expect } from 'vitest'
import { streamLabel } from './streamLabel'

describe('streamLabel', () => {
    it('drops the undetermined language from a backend label', () => {
        expect(streamLabel({ label: 'AAC · und' })).toBe('AAC')
        expect(streamLabel({ label: 'H264 · 1920x1080 · UND' })).toBe('H264 · 1920x1080')
    })

    it('keeps a known language and spaces the channel count', () => {
        expect(streamLabel({ label: 'AC3 · 6ch · fre · VF' })).toBe('AC3 · 6 ch · fre · VF')
    })

    it('prefers structured fields when the backend sends them', () => {
        expect(streamLabel({ label: 'AAC · und', codec: 'aac', channels: 2, sample_rate: '48000', language: 'und' }))
            .toBe('AAC · 2 ch · 48 kHz')
        expect(streamLabel({ codec: 'eac3', channels: 6, sample_rate: 44100, language: 'eng' }))
            .toBe('EAC3 · 6 ch · 44.1 kHz · eng')
    })

    it('never returns an empty label for a stream that has one', () => {
        expect(streamLabel({ label: 'und' })).toBe('und')
        expect(streamLabel(null)).toBe('')
    })
})
