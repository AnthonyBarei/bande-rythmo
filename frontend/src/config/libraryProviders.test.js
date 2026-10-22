// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readLibraryConfigured, writeLibraryConfigured } from './libraryProviders'

describe('library configured memory', () => {
  beforeEach(() => localStorage.clear())

  it('is unknown (false) until a status says otherwise', () => {
    expect(readLibraryConfigured('jellyfin')).toBe(false)
  })
  it('remembers each provider separately', () => {
    writeLibraryConfigured('plex', true)
    writeLibraryConfigured('jellyfin', false)
    expect(readLibraryConfigured('plex')).toBe(true)
    expect(readLibraryConfigured('jellyfin')).toBe(false)
  })
  it('survives corrupt storage', () => {
    localStorage.setItem('br-library-configured', '{oops')
    expect(readLibraryConfigured('plex')).toBe(false)
    writeLibraryConfigured('plex', true)
    expect(readLibraryConfigured('plex')).toBe(true)
  })
})
