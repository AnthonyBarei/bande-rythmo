import { describe, it, expect } from 'vitest'
import { detectOs } from './os'

const ua = userAgent => ({ userAgent, platform: '' })

describe('detectOs', () => {
  it('reads the user agent', () => {
    expect(detectOs(ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'))).toBe('windows')
    expect(detectOs(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'))).toBe('macos')
    expect(detectOs(ua('Mozilla/5.0 (X11; Linux x86_64)'))).toBe('linux')
  })
  it('prefers client hints when present', () => {
    expect(detectOs({ userAgentData: { platform: 'Windows' }, userAgent: '' })).toBe('windows')
  })
  it('has no desktop card for Android or unknown agents', () => {
    expect(detectOs(ua('Mozilla/5.0 (Linux; Android 14; Pixel 8)'))).toBeNull()
    expect(detectOs(ua('Mystery/1.0'))).toBeNull()
  })
})
