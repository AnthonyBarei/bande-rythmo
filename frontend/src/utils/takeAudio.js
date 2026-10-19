// Take audio helpers — mic level, pre-roll trim (→ WAV), mini waveform peaks.

export const METER_FLOOR = 0.06

// Peak of a time-domain frame → 0..1 on a −60…0 dBFS scale (0.8 ≈ −12 dBFS).
export function levelOf(samples) {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    if (a > peak) peak = a
  }
  if (peak <= 0) return METER_FLOOR
  const db = 20 * Math.log10(peak)
  return Math.min(1, Math.max(METER_FLOOR, (db + 60) / 60))
}

// Drop the first `startSec` seconds of every channel.
export function trimChannels(channels, sampleRate, startSec) {
  const from = Math.min(Math.max(0, Math.round(startSec * sampleRate)), channels[0]?.length || 0)
  return channels.map(ch => ch.subarray(from))
}

// 16-bit PCM WAV, interleaved.
export function encodeWav(channels, sampleRate) {
  const nCh = channels.length
  const frames = channels[0]?.length || 0
  const dataBytes = frames * nCh * 2
  const buf = new ArrayBuffer(44 + dataBytes)
  const v = new DataView(buf)
  const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * nCh * 2, true)
  v.setUint16(32, nCh * 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, dataBytes, true)
  let off = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]))
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      off += 2
    }
  }
  return buf
}

// `bars` buckets of peak amplitude, normalized to the loudest bucket.
export function peaksOf(samples, bars) {
  const out = new Array(bars).fill(0)
  if (!samples?.length) return out.fill(METER_FLOOR)
  const size = samples.length / bars
  let max = 0
  for (let b = 0; b < bars; b++) {
    const end = Math.min(samples.length, Math.floor((b + 1) * size))
    let p = 0
    for (let i = Math.floor(b * size); i < end; i++) {
      const a = Math.abs(samples[i])
      if (a > p) p = a
    }
    out[b] = p
    if (p > max) max = p
  }
  return out.map(p => (max > 0 ? Math.max(METER_FLOOR, p / max) : METER_FLOOR))
}

async function decode(arrayBuffer) {
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Ctx) throw new Error('Web Audio indisponible')
  return new Ctx(1, 1, 48000).decodeAudioData(arrayBuffer)
}

function channelsOf(audioBuffer) {
  return Array.from({ length: Math.min(2, audioBuffer.numberOfChannels) }, (_, c) => audioBuffer.getChannelData(c))
}

// Recorded take blob → WAV without its first `startSec` seconds (pre-roll).
export async function trimToWav(blob, startSec) {
  const audio = await decode(await blob.arrayBuffer())
  const channels = trimChannels(channelsOf(audio), audio.sampleRate, startSec)
  const frames = channels[0]?.length || 0
  if (!frames) throw new Error('aucun son après le pré-roll')
  return {
    blob: new Blob([encodeWav(channels, audio.sampleRate)], { type: 'audio/wav' }),
    duration: frames / audio.sampleRate,
  }
}

const PEAKS = new Map()

// Cached mini-waveform of a take file.
export function takePeaks(url, bars) {
  const key = `${url}|${bars}`
  if (!PEAKS.has(key)) {
    const job = fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer() })
      .then(decode)
      .then(audio => peaksOf(audio.getChannelData(0), bars))
    job.catch(() => PEAKS.delete(key))
    PEAKS.set(key, job)
  }
  return PEAKS.get(key)
}
