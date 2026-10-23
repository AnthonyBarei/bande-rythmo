import { describe, it, expect } from 'vitest'
import { buildDraft, draftRangeCount, videoFromSource } from './sources'

describe('videoFromSource', () => {
  it('streams local and library sources through the backend', () => {
    expect(videoFromSource({ id: 's1', kind: 'local', path: 'C:/v/a.mov', filename: 'a.mov' }))
      .toEqual({ sourceId: 's1', filename: 'a.mov', sourcePath: 'C:/v/a.mov', url: '/api/files/stream/s1' })
    expect(videoFromSource({ id: 's2', kind: 'library', path: null, filename: 'Ep.mkv' }))
      .toEqual({ sourceId: 's2', filename: 'Ep.mkv', sourcePath: null, url: '/api/files/stream/s2' })
  })

  it('plays URL sources directly', () => {
    expect(videoFromSource({ id: 's3', kind: 'url', path: 'https://h/v.mp4', filename: 'v.mp4' }).url).toBe('https://h/v.mp4')
  })
})

describe('buildDraft / draftRangeCount', () => {
  const none = { markIn: null, markOut: null }

  it('keeps ranges, mark and playhead', () => {
    const d = buildDraft([{ _id: 4, name: 'A', start: 1, end: 2 }], { markIn: 5, markOut: 7 }, 'B', 12.345)
    expect(d).toEqual({ pending: [{ name: 'A', start: 1, end: 2 }], mark: { in: 5, out: 7 }, markName: 'B', playhead: 12.3 })
    expect(draftRangeCount(d)).toBe(2)
  })

  it('is null when there is nothing to keep', () => {
    expect(buildDraft([], none, '', 0)).toBeNull()
    expect(draftRangeCount(null)).toBe(0)
  })

  it('does not count a half-open IN', () => {
    expect(draftRangeCount(buildDraft([], { markIn: 3, markOut: null }, '', 0))).toBe(0)
  })
})
