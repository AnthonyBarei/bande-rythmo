// Whether the browser can play a source's audio track natively. Chrome plays
// AC3 / EAC3 / DTS / TrueHD video with no sound — those tracks must go through
// the backend remux (AAC) before the Importer player is audible.

const CODEC_MIME = {
  AAC: 'audio/mp4; codecs="mp4a.40.2"',
  MP3: 'audio/mpeg',
  OPUS: 'audio/webm; codecs="opus"',
  VORBIS: 'audio/webm; codecs="vorbis"',
  FLAC: 'audio/flac',
  AC3: 'audio/mp4; codecs="ac-3"',
  EAC3: 'audio/mp4; codecs="ec-3"',
  DTS: 'audio/mp4; codecs="dtsc"',
  TRUEHD: 'audio/mp4; codecs="mlpa"',
}

function defaultCanPlay(mime) {
  return document.createElement('audio').canPlayType(mime)
}

// Unknown codecs count as unplayable: a needless AAC remux beats a silent player.
export function canPlayAudioCodec(codec, canPlay = defaultCanPlay) {
  const mime = CODEC_MIME[String(codec || '').toUpperCase()]
  return !!mime && canPlay(mime) !== ''
}

// Track to remux when a source loads, or null to keep "Auto" (the default
// track, which the browser plays as is). Only the first track is checked —
// it is the one "Auto" plays.
export function autoAudioStream(audioStreams, canPlay = defaultCanPlay) {
  const first = audioStreams?.[0]
  if (!first?.codec) return null
  return canPlayAudioCodec(first.codec, canPlay) ? null : 0
}
