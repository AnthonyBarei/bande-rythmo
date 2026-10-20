import { describe, expect, it } from 'vitest'
import { rangeLines, sliceBounds, sliceChannels } from './continuous'

const subs = [
  { start: 1, end: 2, character: 'LÉA' },
  { start: 3, end: 4, character: 'MAX' },
  { start: 5, end: 6, character: 'LÉA' },
  { start: 8, end: 9, character: 'LÉA', hidden: true },
  { start: 10, end: 11, character: 'LÉA' },
]

describe('rangeLines', () => {
  it('from the current réplique on, role only, hidden skipped', () => {
    expect(rangeLines(subs, 'LÉA', 'from', 2)).toEqual([2, 4])
  })
  it('whole clip', () => {
    expect(rangeLines(subs, 'LÉA', 'all', 2)).toEqual([0, 2, 4])
  })
  it('IN/OUT keeps the répliques fully inside', () => {
    expect(rangeLines(subs, 'LÉA', 'inout', 0, { in: 0.5, out: 6 })).toEqual([0, 2])
  })
})

describe('sliceBounds', () => {
  it('pads each réplique when there is room', () => {
    const [a] = sliceBounds([{ i: 0, start: 1, end: 2 }])
    expect(a.from).toBeCloseTo(0.75)
    expect(a.to).toBeCloseTo(2.35)
  })
  it('clamps at 0', () => {
    expect(sliceBounds([{ i: 0, start: 0.1, end: 1 }])[0].from).toBe(0)
  })
  it('neighbours overlap by 0.1 s at most', () => {
    const [a, b] = sliceBounds([{ i: 0, start: 1, end: 2 }, { i: 1, start: 2.2, end: 3 }])
    expect(a.to - b.from).toBeLessThanOrEqual(0.1 + 1e-9)
    expect(a.to).toBeGreaterThanOrEqual(2)
    expect(b.from).toBeLessThanOrEqual(2.2)
  })
  it('never cuts into a réplique', () => {
    const [a, b] = sliceBounds([{ i: 0, start: 1, end: 2.5 }, { i: 1, start: 2, end: 3 }])
    expect(a.to).toBeGreaterThanOrEqual(2.5)
    expect(b.from).toBeLessThanOrEqual(2)
  })
})

describe('sliceChannels', () => {
  it('cuts by seconds', () => {
    const ch = Float32Array.from({ length: 10 }, (_, i) => i)
    expect(Array.from(sliceChannels([ch], 10, 0.2, 0.5)[0])).toEqual([2, 3, 4])
  })
})
