import { describe, it, expect } from 'vitest'
import { mergeTranslations } from './mergeTranslations'

const sub = (start, text, extra = {}) => ({ start, end: start + 1, text, character: '', ...extra })

describe('mergeTranslations', () => {
    it('translates every réplique when nothing changed meanwhile', () => {
        const sent = [sub(0, 'bonjour'), sub(2, 'merci')]
        const { merged, skipped } = mergeTranslations(sent, ['hello', 'thanks'], sent)
        expect(merged.map(s => s.text)).toEqual(['hello', 'thanks'])
        expect(merged[0].words).toBeNull()
        expect(skipped).toBe(0)
    })

    it('keeps a réplique edited during the request', () => {
        const sent = [sub(0, 'bonjour'), sub(2, 'merci')]
        const current = [sent[0], { ...sent[1], text: 'merci beaucoup' }]
        const { merged, skipped } = mergeTranslations(sent, ['hello', 'thanks'], current)
        expect(merged.map(s => s.text)).toEqual(['hello', 'merci beaucoup'])
        expect(skipped).toBe(1)
    })

    it('follows répliques by identity when one is inserted before them', () => {
        const sent = [sub(0, 'bonjour'), sub(2, 'merci')]
        const inserted = sub(1, 'nouvelle')
        const current = [sent[0], inserted, sent[1]]
        const { merged } = mergeTranslations(sent, ['hello', 'thanks'], current)
        expect(merged.map(s => s.text)).toEqual(['hello', 'nouvelle', 'thanks'])
        expect(merged[1]).toBe(inserted)
    })

    it('does not resurrect a réplique deleted during the request', () => {
        const sent = [sub(0, 'bonjour'), sub(2, 'merci')]
        const { merged, skipped } = mergeTranslations(sent, ['hello', 'thanks'], [sent[1]])
        expect(merged.map(s => s.text)).toEqual(['thanks'])
        expect(skipped).toBe(1)
    })

    it('matches unchanged content when identity was lost (undo copies)', () => {
        const sent = [sub(0, 'bonjour'), sub(2, 'merci')]
        const current = sent.map(s => ({ ...s }))
        const { merged, skipped } = mergeTranslations(sent, ['hello', 'thanks'], current)
        expect(merged.map(s => s.text)).toEqual(['hello', 'thanks'])
        expect(skipped).toBe(0)
    })

    it('keeps flags and other fields of the current réplique', () => {
        const sent = [sub(0, 'bonjour')]
        const current = [{ ...sent[0], hidden: true, take: true, note: 'n' }]
        const { merged } = mergeTranslations(sent, ['hello'], current)
        expect(merged[0]).toMatchObject({ text: 'hello', hidden: true, take: true, note: 'n' })
    })
})
