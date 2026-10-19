import { describe, expect, it } from 'vitest'
import { failureGroupKey, groupJobs, siblingsOf, toastGroupKey } from './jobGroups'

const fail = (key, extra = {}) => ({ key, kind: 'export-gif', clipId: 'c1', status: 'error', error: 'ffmpeg : flux audio introuvable (-map 0:a)', ...extra })
const run = (key, extra = {}) => ({ key, kind: 'export-mp4', clipId: 'c1', status: 'running', error: null, ...extra })

describe('groupJobs', () => {
  it('collapses identical failures into one entry led by the newest', () => {
    const groups = groupJobs([fail('a'), fail('b')], failureGroupKey)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ key: 'b', count: 2, groupKeys: ['a', 'b'] })
  })

  it('never groups running jobs', () => {
    const groups = groupJobs([run('a'), run('b')], toastGroupKey)
    expect(groups.map(g => [g.key, g.count])).toEqual([['a', 1], ['b', 1]])
  })

  it('keeps different errors, kinds and clips apart', () => {
    const jobs = [fail('a'), fail('b', { error: 'HTTP 500' }), fail('c', { kind: 'export-mp4' }), fail('d', { clipId: 'c2' })]
    expect(groupJobs(jobs, failureGroupKey)).toHaveLength(4)
  })

  it('toasts ignore the clip, Activité does not', () => {
    const jobs = [fail('a'), fail('b', { clipId: 'c2' })]
    expect(groupJobs(jobs, toastGroupKey)).toHaveLength(1)
    expect(groupJobs(jobs, failureGroupKey)).toHaveLength(2)
  })

  it('places a group where its newest member sits', () => {
    const groups = groupJobs([fail('a'), run('r'), fail('b')], toastGroupKey)
    expect(groups.map(g => g.key)).toEqual(['r', 'b'])
  })

  it('treats Error-like and string errors with the same text as identical', () => {
    const groups = groupJobs([fail('a', { error: ' HTTP 500 ' }), fail('b', { error: 'HTTP 500' })], toastGroupKey)
    expect(groups).toHaveLength(1)
  })
})

describe('siblingsOf', () => {
  it('lists every member but the retried lead', () => {
    const [g] = groupJobs([fail('a'), fail('b'), fail('c')], failureGroupKey)
    expect(siblingsOf(g)).toEqual(['a', 'b'])
  })
})
