import { useSyncExternalStore } from 'react'

// One volume for every player (Importer, Éditeur, Studio, Atelier), persisted.
// Players apply it to their media with applyPlayerVolume(); code that must
// silence or duck a player for a while (recording, listen-on-image) holds the
// element so a volume change cannot override it, then releases it.

const STORAGE_KEY = 'br-player-volume'
const DEFAULT = { volume: 1, muted: false }

const clamp01 = v => Math.max(0, Math.min(1, v))

export function parseStored(raw) {
  if (!raw) return DEFAULT
  try {
    const s = JSON.parse(raw)
    const volume = Number(s?.volume)
    return {
      volume: Number.isFinite(volume) ? clamp01(volume) : DEFAULT.volume,
      muted: !!s?.muted,
    }
  } catch {
    return DEFAULT
  }
}

function load() {
  try { return parseStored(localStorage.getItem(STORAGE_KEY)) } catch { return DEFAULT }
}

let state = load()
const listeners = new Set()
const held = new WeakSet()

export function getPlayerVolume() { return state }

export function setPlayerVolume(patch) {
  const next = { ...state, ...patch }
  next.volume = clamp01(Number(next.volume) || 0)
  next.muted = !!next.muted
  if (next.volume === state.volume && next.muted === state.muted) return
  state = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch (e) { console.warn('volume non mémorisé', e) }
  for (const fn of listeners) fn()
}

// Dragging the slider up from 0 unmutes; dragging it to 0 does not mute
// (the button shows the muted icon for a 0 volume anyway).
export function setVolumeLevel(volume) {
  setPlayerVolume(volume > 0 ? { volume, muted: false } : { volume })
}

export function toggleMuted() {
  if (state.muted || state.volume === 0) setPlayerVolume({ muted: false, volume: state.volume || 1 })
  else setPlayerVolume({ muted: true })
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function usePlayerVolume() {
  return useSyncExternalStore(subscribe, getPlayerVolume)
}

// `mute` overrides the shared muted flag (an Importer video whose sound
// comes from a separate track, take players that ignore the VO mute).
export function applyPlayerVolume(el, { mute = state.muted } = {}) {
  if (!el || held.has(el)) return
  el.volume = state.volume
  el.muted = mute
}

export function holdPlayerVolume(el) { if (el) held.add(el) }

export function releasePlayerVolume(el, opts) {
  if (!el) return
  held.delete(el)
  applyPlayerVolume(el, opts)
}
