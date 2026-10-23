import { useState, useEffect } from 'react'
import { readDetection, readDetectionAuto, readWordByWord } from '../band/bandRender'

// Détection layer toggles + word-by-word rendering — independent persisted
// booleans so the user can hide noise without losing manual signs. `layer`
// is the whole-layer kill switch.
export default function useBandPrefs() {
  const [detection, setDetection] = useState(readDetection)
  const [detectionAuto, setDetectionAuto] = useState(readDetectionAuto)
  const [wordByWord, setWordByWord] = useState(readWordByWord)
  useEffect(() => { try { localStorage.setItem('br-detection', JSON.stringify(detection)) } catch { /* not persisted */ } }, [detection])
  useEffect(() => { try { localStorage.setItem('br-detection-auto', String(detectionAuto)) } catch { /* not persisted */ } }, [detectionAuto])
  useEffect(() => { try { localStorage.setItem('br-word-by-word', String(wordByWord)) } catch { /* not persisted */ } }, [wordByWord])
  return { detection, setDetection, detectionAuto, setDetectionAuto, wordByWord, setWordByWord }
}
