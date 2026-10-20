// Take recording plumbing shared by the editor recorder and the Studio:
// mic errors, media waits, take upload.
import { trimToWav } from './takeAudio'

export const DENIED_MSG = 'Accès au micro refusé — autorisez-le dans le navigateur puis réessayez.'

export const micError = e => (e?.name === 'NotAllowedError' ? DENIED_MSG : 'Micro inaccessible : ' + (e?.message || e))
export const deviceName = label => (label || '').replace(/^(Par défaut|Default) - /, '')
export const stopTracks = stream => stream?.getTracks().forEach(t => t.stop())
export const absUrl = url => new URL(url, window.location.href).href

export function whenPlayable(media) {
  return new Promise((resolve, reject) => {
    if (media.readyState >= 1) { resolve(); return }
    const done = () => { media.removeEventListener('loadedmetadata', done); media.removeEventListener('error', fail); resolve() }
    const fail = () => { media.removeEventListener('loadedmetadata', done); media.removeEventListener('error', fail); reject(new Error('fichier audio illisible')) }
    media.addEventListener('loadedmetadata', done)
    media.addEventListener('error', fail)
  })
}

export function takeExt(mime) {
  if (/ogg/.test(mime)) return 'ogg'
  if (/mp4|aac/.test(mime)) return 'm4a'
  return 'webm'
}

export function seekMedia(media, t) {
  return new Promise(resolve => {
    if (Math.abs(media.currentTime - t) < 0.01) { resolve(); return }
    const done = () => { clearTimeout(timer); media.removeEventListener('seeked', done); resolve() }
    const timer = setTimeout(() => { console.warn('seek timeout, starting anyway'); done() }, 2000)
    media.addEventListener('seeked', done)
    media.currentTime = t
  })
}

// Recorded chunks → upload-ready audio, without its first `trimSec` seconds
// (pre-roll / élan). Throws when nothing was captured or the trim fails.
export async function takeAudio(chunks, mime, trimSec, fallbackDuration) {
  const raw = new Blob(chunks, { type: mime })
  if (!raw.size) throw new Error('Prise vide — aucun son capté.')
  if (trimSec <= 0.001) return { blob: raw, filename: `take.${takeExt(mime)}`, duration: fallbackDuration }
  const out = await trimToWav(raw, trimSec)
  return { blob: out.blob, filename: 'take.wav', duration: out.duration }
}

export async function postTake({ clipId, character, subIndex, duration, blob, filename, label = '' }) {
  const form = new FormData()
  form.append('clip_id', clipId)
  form.append('character', character || '')
  if (subIndex != null) form.append('subtitle_index', String(subIndex))
  form.append('duration', Math.max(0, duration).toFixed(2))
  if (label) form.append('label', label)
  form.append('audio', blob, filename)
  const res = await fetch('/api/takes/', { method: 'POST', body: form })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
