// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { castMap, dropLegacyCast, hasLegacyCast, legacyCastPatch } from './cast'

const set = (id, map) => localStorage.setItem(`br-comediens-${id}`, JSON.stringify(map))

describe('castMap', () => {
  it('maps roles to comédiens, keeping a cleared one', () => {
    expect(castMap([{ role: 'LÉA', comedien: 'Anne' }, { role: 'MARC', comedien: '' }])).toEqual({ LÉA: 'Anne', MARC: '' })
  })
})

describe('legacyCastPatch', () => {
  beforeEach(() => localStorage.clear())

  it('takes the name used on most clips and reports conflicts', () => {
    set('a', { LÉA: 'Anne', MARC: 'Paul' })
    set('b', { LÉA: 'Anne' })
    set('c', { LÉA: 'Annie', MARC: '' })
    const { patch, conflicts } = legacyCastPatch(['a', 'b', 'c'])
    expect(patch).toEqual({ LÉA: 'Anne', MARC: 'Paul' })
    expect(conflicts.map(c => c.role).sort()).toEqual(['LÉA', 'MARC'])
  })

  it('never overrides a role the project already cast', () => {
    set('a', { LÉA: 'Anne' })
    expect(legacyCastPatch(['a'], { LÉA: 'Zoé' }).patch).toEqual({})
  })

  it('drops the keys once migrated', () => {
    set('a', { LÉA: 'Anne' })
    expect(hasLegacyCast(['a', 'b'])).toBe(true)
    dropLegacyCast(['a'])
    expect(hasLegacyCast(['a'])).toBe(false)
  })
})
