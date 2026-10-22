import { describe, expect, it } from 'vitest'
import { autoAudioStream, canPlayAudioCodec } from './audioCodec'

// Chrome-like: AAC / MP3 / Opus yes, Dolby / DTS no.
const chrome = mime => (/mp4a|mpeg|opus/.test(mime) ? 'probably' : '')
const edge = mime => (/mp4a|mpeg|opus|ec-3|ac-3/.test(mime) ? 'probably' : '')

describe('canPlayAudioCodec', () => {
    it('accepts codecs the browser reports as playable', () => {
        expect(canPlayAudioCodec('AAC', chrome)).toBe(true)
        expect(canPlayAudioCodec('aac', chrome)).toBe(true)
    })

    it('rejects Dolby / DTS in Chrome', () => {
        expect(canPlayAudioCodec('EAC3', chrome)).toBe(false)
        expect(canPlayAudioCodec('AC3', chrome)).toBe(false)
        expect(canPlayAudioCodec('DTS', chrome)).toBe(false)
    })

    it('treats unknown codecs as unplayable', () => {
        expect(canPlayAudioCodec('PCM_S16LE', chrome)).toBe(false)
        expect(canPlayAudioCodec(undefined, chrome)).toBe(false)
    })
})

describe('autoAudioStream', () => {
    it('keeps Auto when the first track plays natively', () => {
        expect(autoAudioStream([{ codec: 'AAC' }, { codec: 'EAC3' }], chrome)).toBe(null)
    })

    it('picks the first track for remux when it would play silent', () => {
        expect(autoAudioStream([{ codec: 'EAC3' }, { codec: 'AAC' }], chrome)).toBe(0)
    })

    it('keeps Auto when the browser decodes the codec itself', () => {
        expect(autoAudioStream([{ codec: 'EAC3' }], edge)).toBe(null)
    })

    it('keeps Auto without stream info', () => {
        expect(autoAudioStream([], chrome)).toBe(null)
        expect(autoAudioStream(undefined, chrome)).toBe(null)
        expect(autoAudioStream([{ label: 'x' }], chrome)).toBe(null)
    })
})
