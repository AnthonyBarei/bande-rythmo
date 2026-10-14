import { describe, it, expect } from 'vitest'
import { sourceTitle, urlFilename, UNTITLED } from './sourceTitle'

describe('sourceTitle', () => {
    it('uses the original filename first', () => {
        expect(sourceTitle({ filename: 'Une_episode_brut.mp4', plexTitle: 'Une épisode', url: 'http://h/x/y.mp4' }))
            .toBe('Une_episode_brut.mp4')
    })

    it('falls back to the Plex title when there is no filename', () => {
        expect(sourceTitle({ filename: '  ', plexTitle: 'Le Film', url: '/api/files/stream/abc' })).toBe('Le Film')
    })

    it('falls back to the last URL path segment, decoded', () => {
        expect(sourceTitle({ url: 'https://cdn.example.com/films/Mon%20Film%20(2024).mp4?token=1#t=3' }))
            .toBe('Mon Film (2024).mp4')
        expect(sourceTitle({ sourcePath: 'https://h.example/a/b/' })).toBe('b')
    })

    it('shows the URL segment as-is, even when it is a UUID file name', () => {
        expect(sourceTitle({ url: '/segments/3f2b8c1e-9d4a-4e5f-8a7b-1c2d3e4f5a6b.mp4' }))
            .toBe('3f2b8c1e-9d4a-4e5f-8a7b-1c2d3e4f5a6b.mp4')
    })

    it('falls back to "Vidéo sans titre"', () => {
        expect(sourceTitle(null)).toBe(UNTITLED)
        expect(sourceTitle({})).toBe(UNTITLED)
        expect(sourceTitle({ filename: '', plexTitle: '', url: 'https://example.com/' })).toBe(UNTITLED)
        expect(UNTITLED).toBe('Vidéo sans titre')
    })
})

describe('urlFilename', () => {
    it('keeps a badly encoded segment raw', () => {
        expect(urlFilename('https://example.com/a/bad%E0name.mp4')).toBe('bad%E0name.mp4')
    })

    it('returns empty for an empty URL', () => {
        expect(urlFilename('')).toBe('')
    })
})
