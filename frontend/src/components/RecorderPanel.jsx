import React, { useState, useEffect, useRef, useCallback } from 'react'

export default function RecorderPanel({ clipId, subtitles = [], activeCharacter = '', activeIndex = null }) {
  const [takes, setTakes] = useState([])
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState(null)
  const [abA, setAbA] = useState(null)
  const [abB, setAbB] = useState(null)
  const [playing, setPlaying] = useState(null)

  const mrRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const recStartRef = useRef(0)
  const audioRef = useRef(null)

  const fetchTakes = useCallback(async () => {
    if (!clipId) return
    try {
      const res = await fetch(`/api/takes/${clipId}`)
      if (res.ok) setTakes(await res.json())
    } catch (_) {}
  }, [clipId])

  useEffect(() => { fetchTakes() }, [fetchTakes])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  async function uploadTake() {
    const dur = (Date.now() - recStartRef.current) / 1000
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    if (!blob.size) return
    const form = new FormData()
    form.append('clip_id', clipId)
    form.append('character', activeCharacter || '')
    if (activeIndex != null) form.append('subtitle_index', String(activeIndex))
    form.append('duration', dur.toFixed(2))
    form.append('audio', blob, 'take.webm')
    try {
      const res = await fetch('/api/takes/', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      fetchTakes()
    } catch (e) {
      setError('Échec de l’enregistrement : ' + e.message)
    }
  }

  async function startRec() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        uploadTake()
      }
      recStartRef.current = Date.now()
      mr.start()
      mrRef.current = mr
      setRecording(true)
    } catch (e) {
      setError('Micro inaccessible : ' + e.message)
    }
  }

  function stopRec() {
    mrRef.current?.stop()
    setRecording(false)
  }

  function playTake(take) {
    if (!audioRef.current) return
    audioRef.current.src = take.audio_url
    audioRef.current.play()
    setPlaying(take.id)
  }

  async function removeTake(id) {
    try {
      await fetch(`/api/takes/${id}`, { method: 'DELETE' })
      if (abA === id) setAbA(null)
      if (abB === id) setAbB(null)
      fetchTakes()
    } catch (_) {}
  }

  function assignAB(id) {
    if (abA === id) { setAbA(null); return }
    if (abB === id) { setAbB(null); return }
    if (abA == null) setAbA(id)
    else if (abB == null) setAbB(id)
    else setAbB(id)
  }

  function takeLabel(t) {
    if (t.subtitle_index != null && subtitles[t.subtitle_index]) {
      const s = subtitles[t.subtitle_index]
      return `Réplique ${t.subtitle_index + 1}${s.character ? ' · ' + s.character : ''}`
    }
    return t.character || 'Prise libre'
  }

  const takeA = takes.find(t => t.id === abA)
  const takeB = takes.find(t => t.id === abB)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      <audio ref={audioRef} onEnded={() => setPlaying(null)} style={{ display: 'none' }} />

      {/* Record button */}
      <button
        onClick={recording ? stopRec : startRec}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 'var(--radius)',
          background: recording ? 'var(--danger)' : 'var(--danger-soft)',
          color: recording ? '#fff' : 'var(--danger)',
          border: `1px solid var(--danger)`, fontWeight: 600, fontSize: 13,
        }}
      >
        <span style={{
          width: 10, height: 10, borderRadius: recording ? 2 : '50%', background: 'currentColor',
        }} />
        {recording ? 'Arrêter l’enregistrement' : 'Enregistrer une prise'}
      </button>

      {error && (
        <div style={{ fontSize: 11, color: 'var(--danger)', background: 'var(--danger-soft)', padding: '6px 8px', borderRadius: 4 }}>
          {error}
        </div>
      )}

      {/* A/B compare */}
      {(takeA || takeB) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ t: takeA, k: 'A' }, { t: takeB, k: 'B' }].map(({ t, k }) => (
            <button
              key={k}
              disabled={!t}
              onClick={() => t && playTake(t)}
              style={{
                flex: 1, padding: '8px', borderRadius: 'var(--radius)',
                background: 'var(--surface2)', border: '1px solid var(--border2)',
                color: t ? 'var(--text)' : 'var(--text4)', fontSize: 12,
              }}
            >
              ▶ Prise {k}{t ? ` · ${t.duration.toFixed(1)}s` : ' —'}
            </button>
          ))}
        </div>
      )}

      {/* Take list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {takes.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>
            Aucune prise enregistrée
          </div>
        )}
        {takes.map((t, i) => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', background: 'var(--surface)',
            border: `1px solid ${t.id === abA || t.id === abB ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', width: 22 }}>
              #{i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {takeLabel(t)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                {t.duration.toFixed(1)}s
              </div>
            </div>
            <button onClick={() => playTake(t)} title="Écouter"
              style={{ ...iconBtn, color: playing === t.id ? 'var(--accent)' : 'var(--text2)' }}>▶</button>
            <button onClick={() => assignAB(t.id)} title="Comparer A/B"
              style={{ ...iconBtn, color: t.id === abA ? 'var(--accent)' : t.id === abB ? 'var(--accent)' : 'var(--text3)', fontWeight: 700, fontSize: 10 }}>
              {t.id === abA ? 'A' : t.id === abB ? 'B' : 'A/B'}
            </button>
            <button onClick={() => removeTake(t.id)} title="Supprimer / refaire"
              style={{ ...iconBtn, color: 'var(--text3)' }}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const iconBtn = {
  background: 'none', border: 'none', fontSize: 12, padding: '3px 6px',
  borderRadius: 3, cursor: 'pointer',
}
