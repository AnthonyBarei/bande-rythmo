import React from 'react'
import SubtitleEditor from '../SubtitleEditor'
import RecorderPanel from '../RecorderPanel'
import { Btn, ICONS } from '../../ui'

export default function InspectorRepliques({
  subtitles, transcribing, onTranscribe, onSubtitlesChange, onDelete,
  bandNow, onSeek, selectedIdx, setSelectedIdx, charFilter, clipId,
  showRecorder, recorderRef, activeSubtitle, videoRef,
}) {
  return (
    <>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {subtitles.length === 0 && !transcribing ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Aucune réplique. Transcrivez ou ajoutez manuellement.</div>
            <Btn size="sm" variant="primary" icon={ICONS.rec} onClick={onTranscribe}>Transcrire</Btn>
          </div>
        ) : (
          <SubtitleEditor subtitles={subtitles} onChange={onSubtitlesChange} onDelete={onDelete} currentTime={bandNow} onSeek={onSeek} selectedIdx={selectedIdx} setSelectedIdx={setSelectedIdx} compact={true} charFilter={charFilter} clipId={clipId} />
        )}
      </div>
      {showRecorder && (
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', maxHeight: 300, overflow: 'auto' }}>
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
