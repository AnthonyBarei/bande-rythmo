import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseStored, getPlayerVolume, setPlayerVolume, setVolumeLevel, toggleMuted,
  applyPlayerVolume, holdPlayerVolume, releasePlayerVolume,
} from './playerVolume'

describe('parseStored', () => {
  it('defaults on missing or broken data', () => {
    expect(parseStored(null)).toEqual({ volume: 1, muted: false })
    expect(parseStored('{nope')).toEqual({ volume: 1, muted: false })
  })
  it('clamps the volume', () => {
    expect(parseStored('{"volume":3,"muted":true}')).toEqual({ volume: 1, muted: true })
    expect(parseStored('{"volume":-1}')).toEqual({ volume: 0, muted: false })
  })
})

describe('player volume store', () => {
  beforeEach(() => setPlayerVolume({ volume: 1, muted: false }))

  it('slider above 0 unmutes, slider at 0 keeps the mute flag', () => {
    setPlayerVolume({ muted: true })
    setVolumeLevel(0.4)
    expect(getPlayerVolume()).toEqual({ volume: 0.4, muted: false })
    setVolumeLevel(0)
    expect(getPlayerVolume()).toEqual({ volume: 0, muted: false })
  })

  it('unmuting a 0 volume restores full volume', () => {
    setVolumeLevel(0)
    toggleMuted()
    expect(getPlayerVolume()).toEqual({ volume: 1, muted: false })
    toggleMuted()
    expect(getPlayerVolume().muted).toBe(true)
  })

  it('held elements ignore changes until released', () => {
    const el = { volume: 1, muted: false }
    holdPlayerVolume(el)
    el.muted = true
    setPlayerVolume({ volume: 0.5 })
    applyPlayerVolume(el)
    expect(el).toEqual({ volume: 1, muted: true })
    releasePlayerVolume(el)
    expect(el).toEqual({ volume: 0.5, muted: false })
  })

  it('mute override', () => {
    const el = { volume: 1, muted: true }
    setPlayerVolume({ muted: true, volume: 0.3 })
    applyPlayerVolume(el, { mute: false })
    expect(el).toEqual({ volume: 0.3, muted: false })
  })
})
