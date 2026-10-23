import { useState, useEffect } from 'react'

// Scene cuts (ffmpeg scene filter) — the band and nav-bar « Plans » markers.
export function useSceneCuts({ clip, toast }) {
  const [sceneCuts, setSceneCuts] = useState(clip.scene_cuts || [])
  const [detectingScenes, setDetectingScenes] = useState(false)
  useEffect(() => { setSceneCuts(clip.scene_cuts || []) }, [clip.clip_id])

  async function detectScenes() {
    setDetectingScenes(true)
    try {
      const res = await fetch(`/api/clips/${clip.clip_id}/detect-scenes?threshold=0.4`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSceneCuts(data.scene_cuts || [])
      if (!(data.scene_cuts || []).length) toast.show({ msg: 'Aucun changement de plan détecté', kind: 'info' })
    } catch (e) {
      toast.error('Détection des plans échouée : ' + e.message)
    } finally {
      setDetectingScenes(false)
    }
  }
  async function clearScenes() {
    setSceneCuts([])
    try { await fetch(`/api/clips/${clip.clip_id}/scenes`, { method: 'DELETE' }) }
    catch (e) { toast.error('Effacement des plans échoué : ' + e.message) }
  }

  return { sceneCuts, detectingScenes, detectScenes, clearScenes }
}

// Proxy playback (720p) for smooth scrubbing of heavy segments.
export function useProxy({ clip, progress, toast, videoRef, resumeTimeRef }) {
  const [hasProxy, setHasProxy] = useState(!!clip.has_proxy)
  const [useProxy, setUseProxy] = useState(!!clip.has_proxy)
  const [proxyJob, setProxyJob] = useState(false)
  const segmentUrl = (useProxy && hasProxy)
    ? `/segments/${clip.clip_id}_proxy.mp4`
    : `/${clip.segment_path}`

  async function generateProxy() {
    setProxyJob(true)
    const fireJob = async () => {
      const res = await fetch(`/api/clips/${clip.clip_id}/proxy?height=720`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()).job_id
    }
    try {
      const jobId = await fireJob()
      progress.start({
        kind: 'proxy', title: 'Proxy 720p', clipId: clip.clip_id, jobId, retry: fireJob,
        onDone: () => { setHasProxy(true); setUseProxy(true); setProxyJob(false) },
        onError: () => { setProxyJob(false) },
        onCancel: () => { setProxyJob(false) },
      })
    } catch (e) {
      setProxyJob(false)
      toast.error('Lancement du proxy échoué : ' + e.message)
    }
  }

  function toggleProxy() { const v = videoRef.current; resumeTimeRef.current = v ? v.currentTime : 0; setUseProxy(p => !p) }

  return { hasProxy, useProxy, proxyJob, segmentUrl, generateProxy, toggleProxy }
}

// Waveform + onsets for the band, the nav bar and onset snapping.
export function useWaveform(clipId, onsetsRef) {
  const [waveformData, setWaveformData] = useState(null)
  useEffect(() => {
    fetch(`/api/clips/${clipId}/waveform?samples=500`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.samples.length) {
          onsetsRef.current = data.onsets || []
          setWaveformData(data)
        }
      })
      .catch(e => console.error('waveform fetch failed', e)) // non-bloquant : la bande s'affiche sans onde
  }, [clipId])
  return waveformData
}
