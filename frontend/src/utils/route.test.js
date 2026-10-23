import { describe, it, expect } from 'vitest'
import { parseRoute, formatRoute, projectRoute, resumeRoute } from './route'

describe('parseRoute / formatRoute', () => {
  it('round-trips project routes', () => {
    for (const r of [
      projectRoute('abc', 'media'),
      projectRoute('abc', 'clips'),
      projectRoute('abc', 'dub', 'clip-1'),
      projectRoute('abc', 'export', 'clip-1'),
      { view: 'projects' }, { view: 'memes' }, { view: 'settings' },
    ]) expect(parseRoute(formatRoute(r))).toEqual(r)
  })

  it('keeps auth hashes', () => {
    expect(parseRoute('#login')).toEqual({ view: 'auth', mode: 'login' })
    expect(parseRoute('#reset=tok')).toEqual({ view: 'auth', mode: 'reset', token: 'tok' })
    expect(parseRoute('#verify=v1')).toEqual({ view: 'verify', token: 'v1' })
    expect(formatRoute({ view: 'auth', mode: 'reset', token: 'tok' })).toBe('#reset=tok')
  })

  it('falls back on unknown stages and drops the clip outside clip stages', () => {
    expect(parseRoute('#p/abc/nope')).toEqual(projectRoute('abc', 'clips'))
    expect(parseRoute('#p/abc/clips/clip-1').clipId).toBeNull()
    expect(parseRoute('')).toEqual({ view: 'none' })
    expect(parseRoute('#whatever')).toEqual({ view: 'none' })
  })
})

describe('resumeRoute', () => {
  const clips = [{ clip_id: 'c1' }, { clip_id: 'c2' }]

  it('restores the saved stage and clip', () => {
    expect(resumeRoute({ id: 'p', ui_state: { stage: 'record', clip_id: 'c2' } }, clips))
      .toEqual(projectRoute('p', 'record', 'c2'))
  })

  it('falls back to Clips when the saved clip is gone, Médias when nothing is cut', () => {
    expect(resumeRoute({ id: 'p', ui_state: { stage: 'dub', clip_id: 'gone' } }, clips))
      .toEqual(projectRoute('p', 'clips'))
    expect(resumeRoute({ id: 'p', ui_state: {} }, [])).toEqual(projectRoute('p', 'media'))
    expect(resumeRoute({ id: 'p', ui_state: { stage: 'media' } }, clips)).toEqual(projectRoute('p', 'media'))
  })
})
