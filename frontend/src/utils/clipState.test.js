// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { dropLegacyStudioKeys, handOffSelection, studioStateOf, takeHandoff } from './clipState'

describe('studioStateOf', () => {
  beforeEach(() => localStorage.clear())

  it('reads ui_state.studio', () => {
    expect(studioStateOf({ clip_id: 'c', ui_state: { studio: { role: 'LÉA', mode: 'continuous' } } }))
      .toEqual({ role: 'LÉA', mode: 'continuous' })
  })

  it('falls back to the pre-P4 localStorage keys, then drops them', () => {
    localStorage.setItem('br-studio-role-c', JSON.stringify('MARC'))
    localStorage.setItem('br-studio-mode-c', JSON.stringify('continuous'))
    expect(studioStateOf({ clip_id: 'c', ui_state: {} })).toEqual({ role: 'MARC', mode: 'continuous' })
    dropLegacyStudioKeys('c')
    expect(studioStateOf({ clip_id: 'c' })).toEqual({ role: null, mode: 'line' })
  })
})

describe('Éditeur → Studio handoff', () => {
  it('is taken once', () => {
    handOffSelection('c', 4)
    expect(takeHandoff('c')).toBe(4)
    expect(takeHandoff('c')).toBeNull()
  })

  it('ignores a missing selection', () => {
    handOffSelection('c', -1)
    expect(takeHandoff('c')).toBeNull()
  })
})
