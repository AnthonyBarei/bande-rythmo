import React from 'react'
import SubtitleEditor from '../SubtitleEditor'
import { T, Btn, ICONS } from '../../ui'

// Répliques tab — reference Inspector › ReplList (recording happens in the Studio).
export default function InspectorRepliques({
  subtitles, transcribing, onTranscribe, onSubtitlesChange, onDelete,
  bandNow, onSeek, selectedIdx, setSelectedIdx, charFilter, charMap, clipFps,
}) {
  return (
    <>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {subtitles.length === 0 && !transcribing ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: T.fs.xs, color: T.text3, marginBottom: 10 }}>Aucune réplique. Transcrivez ou ajoutez manuellement (⇧↵).</div>
            <Btn size="sm" variant="primary" icon={ICONS.sparkle} onClick={onTranscribe}>Transcrire (Whisper)</Btn>
          </div>
        ) : (
          <SubtitleEditor subtitles={subtitles} onChange={onSubtitlesChange} onDelete={onDelete} currentTime={bandNow} onSeek={onSeek}
            selectedIdx={selectedIdx} setSelectedIdx={setSelectedIdx} compact={true} charFilter={charFilter} charMap={charMap} fps={clipFps} />
        )}
      </div>
    </>
  )
}
