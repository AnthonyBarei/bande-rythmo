import { useState, useEffect } from 'react'
import { mergeTranslations } from '../../utils/mergeTranslations'

// Header tools that fill or rewrite the répliques (all undoable through
// changeSubtitles): Whisper transcription, subtitle file import, auto
// translation (gated on a provider) and Demucs vocal separation (gated).
export default function useClipTools({ clip, lang, subtitlesRef, changeSubtitles, progress, toast }) {
  const [transcribing, setTranscribing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [translateProvider, setTranslateProvider] = useState(null)
  const [translateTarget, setTranslateTarget] = useState('en')
  const [translating, setTranslating] = useState(false)
  const [vocalAvailable, setVocalAvailable] = useState(false)
  const [separatingVocals, setSeparatingVocals] = useState(false)

  // Probe translation provider + vocal separation once.
  useEffect(() => {
    fetch('/api/translate/status').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTranslateProvider(d) }).catch(() => {})
    fetch('/api/clips/vocal-separation/status').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setVocalAvailable(!!d.available) }).catch(() => {})
  }, [])

  async function transcribe() {
    const existing = subtitlesRef.current.length
    if (existing && !window.confirm(`Remplacer les ${existing} réplique${existing > 1 ? 's' : ''} existante${existing > 1 ? 's' : ''} par la transcription Whisper ? (annulable avec Ctrl+Z)`)) return
    setTranscribing(true)
    const fireJob = async () => {
      const res = await fetch('/api/transcription/transcribe-job', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_id: clip.clip_id, language: lang === 'auto' ? null : lang }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { job_id } = await res.json()
      return job_id
    }
    try {
      const jobId = await fireJob()
      progress.start({
        kind: 'transcribe',
        clipId: clip.clip_id,
        title: 'Transcription Whisper',
        jobId,
        retry: fireJob,
        onDone: (result) => {
          if (result && result.subtitles) changeSubtitles(result.subtitles)
          toast.show({ msg: 'Transcription terminée', kind: 'success', duration: 3000 })
          setTranscribing(false)
        },
        onError: (err) => {
          toast.show({ msg: 'Erreur : ' + err.message, kind: 'error', duration: 4000 })
          setTranscribing(false)
        },
        onCancel: () => {
          toast.show({ msg: 'Transcription annulée', kind: 'error', duration: 3000 })
          setTranscribing(false)
        },
      })
    } catch (e) {
      toast.show({ msg: 'Erreur : ' + e.message, kind: 'error', duration: 3000 })
      setTranscribing(false)
    }
  }

  // Header "Sous-titres ▾" › Importer — replaces the réplique list (undoable).
  async function importSubtitlesFile(file) {
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mode', 'replace')
      const res = await fetch(`/api/clips/${clip.clip_id}/import-subtitles`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      changeSubtitles(data.clip?.subtitles || [])
      toast.show({ msg: 'Sous-titres importés · annulable (Ctrl+Z)', kind: 'success', duration: 3000 })
    } catch (e) {
      toast.error('Import des sous-titres échoué : ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  async function translateAll() {
    const subs = subtitlesRef.current
    const texts = subs.map(s => s.text || '')
    if (!texts.some(t => t.trim())) return
    setTranslating(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, target: translateTarget, source: 'auto' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      const { merged, skipped } = mergeTranslations(subs, data.translations || [], subtitlesRef.current)
      changeSubtitles(merged)
      toast.show({
        msg: `Traduit en ${translateTarget.toUpperCase()} · annulable (Ctrl+Z)`
          + (skipped ? ` · ${skipped} réplique${skipped > 1 ? 's' : ''} modifiée${skipped > 1 ? 's' : ''} entre-temps, non traduite${skipped > 1 ? 's' : ''}` : ''),
        kind: 'success',
        duration: 4000,
      })
    } catch (e) {
      toast.show({ msg: 'Traduction : ' + e.message, kind: 'error', duration: 4000 })
    } finally {
      setTranslating(false)
    }
  }

  async function separateVocals() {
    setSeparatingVocals(true)
    const fireJob = async () => {
      const res = await fetch(`/api/clips/${clip.clip_id}/separate-vocals`, { method: 'POST' })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`) }
      return (await res.json()).job_id
    }
    try {
      const jobId = await fireJob()
      progress.start({
        kind: 'vocals', title: 'Séparation vocale (Demucs)', clipId: clip.clip_id, jobId, retry: fireJob,
        onDone: () => { setSeparatingVocals(false); toast.show({ msg: 'Voix isolée — pistes prêtes dans segments/stems', kind: 'success', duration: 4000 }) },
        onError: (err) => { setSeparatingVocals(false); toast.show({ msg: 'Séparation : ' + err.message, kind: 'error', duration: 5000 }) },
        onCancel: () => setSeparatingVocals(false),
      })
    } catch (e) {
      setSeparatingVocals(false)
      toast.show({ msg: 'Séparation : ' + e.message, kind: 'error', duration: 5000 })
    }
  }

  return {
    transcribing, transcribe, importing, importSubtitlesFile,
    translateProvider, translateTarget, setTranslateTarget, translating, translateAll,
    vocalAvailable, separatingVocals, separateVocals,
  }
}
