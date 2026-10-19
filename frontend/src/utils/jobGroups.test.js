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

  it('never groups running jobs in Activité', () => {
    const groups = groupJobs([run('a'), run('b')], failureGroupKey)
    expect(groups.map(g => [g.key, g.count])).toEqual([['a', 1], ['b', 1]])
  })

  it('collapses identical running toasts (kind + clip + options) led by the newest', () => {
    const opts = { options: '{"quality":"youtube"}' }
    const groups = groupJobs([run('a', opts), run('b', opts)], toastGroupKey)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ key: 'b', count: 2, groupKeys: ['a', 'b'] })
  })

  it('keeps running toasts with a different clip, kind or options apart', () => {
    const jobs = [
      run('a', { options: 'q1' }), run('b', { options: 'q2' }),
      run('c', { options: 'q1', clipId: 'c2' }), run('d', { options: 'q1', kind: 'export-gif' }),
    ]
    expect(groupJobs(jobs, toastGroupKey)).toHaveLength(4)
  })

  it('groups running toasts without options by kind + clip', () => {
    expect(groupJobs([run('a'), run('b')], toastGroupKey)).toHaveLength(1)
  })

  it('never mixes a running job with a failed one of the same kind', () => {
    const jobs = [run('a'), fail('b', { kind: 'export-mp4' })]
    expect(groupJobs(jobs, toastGroupKey)).toHaveLength(2)
  })

  it('leaves done and cancelled toasts single', () => {
    const jobs = [run('a', { status: 'done' }), run('b', { status: 'done' }), run('c', { status: 'cancelled' }), run('d', { status: 'cancelled' })]
    expect(groupJobs(jobs, toastGroupKey).map(g => g.count)).toEqual([1, 1, 1, 1])
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
