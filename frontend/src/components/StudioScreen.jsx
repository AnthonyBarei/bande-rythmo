import React, { useEffect, useRef, useState } from 'react'
import { ICONS, Btn, ScreenHeader } from '../ui'
import RecorderPanel from './RecorderPanel'

// Studio screen — port of redesign screen-record-export.jsx → Record
// (ScreenHeader + RecorderPanel 'studio' body) for the active clip.
export default function StudioScreen({ clip, onBack }) {
  const recorderRef = useRef(null)
  const subtitles = clip.subtitles || []
  const [index, setIndex] = useState(subtitles.length ? 0 : null)
  const activeIndex = index != null && subtitles[index] ? index : (subtitles.length ? 0 : null)

  // R — start/stop a take (same path as the record button).
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('[aria-modal="true"]')) return
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        recorderRef.current?.toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const n = subtitles.length
  const sub = [clip.name, `${n} réplique${n !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ScreenHeader kicker="STUDIO" title="Enregistrement" sub={sub}
        right={<Btn variant="outline" icon={ICONS.chevron} onClick={onBack} style={{ transform: 'none' }}>Retour à l'éditeur</Btn>} />
      <RecorderPanel
        ref={recorderRef}
        variant="studio"
        clipId={clip.clip_id}
        subtitles={subtitles}
        activeIndex={activeIndex}
        activeCharacter={activeIndex != null ? subtitles[activeIndex]?.character || '' : ''}
        fps={clip.fps || 25}
        onSelectIndex={setIndex}
      />
    </div>
  )
}
