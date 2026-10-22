import { describe, it, expect } from 'vitest'
import { withComedienDefault } from './studioPrefs'

describe('withComedienDefault', () => {
  it('fills roles that have no comédien yet', () => {
    expect(withComedienDefault({ LÉA: 'Anne' }, ['LÉA', 'MARC'], 'Camille'))
      .toEqual({ LÉA: 'Anne', MARC: 'Camille' })
  })
  it('keeps a comédien cleared on purpose', () => {
    expect(withComedienDefault({ MARC: '' }, ['MARC'], 'Camille')).toEqual({ MARC: '' })
  })
  it('returns the map untouched when signed out', () => {
    const map = { LÉA: 'Anne' }
    expect(withComedienDefault(map, ['LÉA', 'MARC'], '')).toBe(map)
  })
})
