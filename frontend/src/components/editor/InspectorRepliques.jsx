import React from 'react'
import SubtitleEditor from '../SubtitleEditor'
import RecorderPanel from '../RecorderPanel'
import { T, Btn, ICONS } from '../../ui'

// Répliques tab — reference Inspector › ReplList (+ the docked recorder).
export default function InspectorRepliques({
  subtitles, transcribing, onTranscribe, onSubtitlesChange, onDelete,
  bandNow, onSeek, selectedIdx, setSelectedIdx, charFilter, charMap,
  showRecorder, recorderRef, activeSubtitle, videoRef, clipId,
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
            selectedIdx={selectedIdx} setSelectedIdx={setSelectedIdx} compact={true} charFilter={charFilter} charMap={charMap} />
        )}
      </div>
      {showRecorder && (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}`, maxHeight: 300, overflow: 'auto' }}>
          <RecorderPanel
            ref={recorderRef}
            clipId={clipId}
            subtitles={subtitles}
            activeCharacter={(selectedIdx != null ? subtitles[selectedIdx]?.character : activeSubtitle?.character) || ''}
            activeIndex={selectedIdx}
            videoRef={videoRef}
          />
        </div>
      )}
    </>
  )
}
