import { describe, it, expect } from 'vitest'
import { levelOf, trimChannels, encodeWav, peaksOf, METER_FLOOR } from './takeAudio'

describe('levelOf', () => {
  it('maps silence to the floor and full scale to 1', () => {
    expect(levelOf(new Float32Array(64))).toBe(METER_FLOOR)
    expect(levelOf(Float32Array.from([0, -1, 0.2]))).toBe(1)
  })
  it('puts −12 dBFS at 0.8', () => {
    expect(levelOf(Float32Array.from([10 ** (-12 / 20)]))).toBeCloseTo(0.8, 5)
  })
})

describe('trimChannels', () => {
  it('drops the pre-roll samples on every channel', () => {
    const l = Float32Array.from({ length: 10 }, (_, i) => i)
    const r = Float32Array.from({ length: 10 }, (_, i) => -i)
    const [tl, tr] = trimChannels([l, r], 4, 0.75)
    expect(Array.from(tl)).toEqual([3, 4, 5, 6, 7, 8, 9])
    expect(Array.from(tr)).toEqual([-3, -4, -5, -6, -7, -8, -9])
  })
  it('clamps to the buffer bounds', () => {
    const ch = new Float32Array(4)
    expect(trimChannels([ch], 10, 5)[0].length).toBe(0)
    expect(trimChannels([ch], 10, -1)[0].length).toBe(4)
  })
})

describe('encodeWav', () => {
  it('writes a 16-bit PCM header and interleaved samples', () => {
    const buf = encodeWav([Float32Array.from([1, -1]), Float32Array.from([0, 0.5])], 48000)
    const v = new DataView(buf)
    const tag = off => String.fromCharCode(...new Uint8Array(buf, off, 4))
    expect(tag(0)).toBe('RIFF')
    expect(tag(8)).toBe('WAVE')
    expect(tag(36)).toBe('data')
    expect(v.getUint16(22, true)).toBe(2)
    expect(v.getUint32(24, true)).toBe(48000)
    expect(v.getUint32(40, true)).toBe(8)
    expect(buf.byteLength).toBe(52)
    expect([0, 1, 2, 3].map(i => v.getInt16(44 + i * 2, true))).toEqual([32767, 0, -32768, 16383])
  })
})

describe('peaksOf', () => {
  it('normalizes bucket peaks to the loudest one', () => {
    const p = peaksOf(Float32Array.from([0.1, -0.5, 0.25, 0]), 2)
    expect(p).toEqual([1, 0.5])
  })
  it('returns floor bars for empty audio', () => {
    expect(peaksOf(new Float32Array(0), 3)).toEqual([METER_FLOOR, METER_FLOOR, METER_FLOOR])
  })
})
