import React, { useState } from 'react'
import { Icon, ICONS } from '../Icons'
import { useProgress } from '../ProgressContext'

const FORMATS = [
  { id: 'srt',         label: 'SRT',        icon: ICONS.note,  desc: 'Sous-titres standard',                        color: '#4488ff', needsSubs: true },
  { id: 'ass',         label: 'ASS',        icon: ICONS.film,  desc: 'Défilement BR intégré',                       color: '#aa44ff', needsSubs: true },
  { id: 'ass-karaoke', label: 'ASS Karaoké',icon: ICONS.mic,   desc: 'Tags \\kf par mot — compatible ass2rythmo',   color: '#cc88ff', needsSubs: true },
  { id: 'detx',        label: 'DetX',       icon: ICONS.edit,  desc: 'Standard FR — Cappella / Phonations / Joker · détection incluse', color: '#ff9944', needsSubs: true },
  { id: 'croisille',   label: 'Croisillé',  icon: ICONS.note,  desc: 'Grille personnages × boucles (planning studio)', color: '#ddaa44', needsSubs: true },
  { id: 'mp4',         label: 'MP4 + BR',   icon: ICONS.film,  desc: 'Vidéo avec bande rythmo incrustée',           color: '#44bb55', needsSubs: true },
  { id: 'gif',         label: 'GIF',        icon: ICONS.gif,   desc: 'Clip animé',                                  color: '#ff6644', needsSubs: false },
  { id: 'mp3',         label: 'MP3',        icon: ICONS.audio, desc: 'Audio — StreamDeck, Discord…',                color: '#ff6688', needsSubs: false },
  { id: 'wav',         label: 'WAV',        icon: ICONS.audio, desc: 'Audio non compressé',                         color: '#aa88ff', needsSubs: false },
]

export default function ExportPanel({ segmentId, subtitles, boucles = [], pxPerSec = 180, brOffset = 0, canvasH = 64, getCanvasWidth, brFont = 'atkinson', brStyle = 'classique' }) {
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)
  const [lastExport, setLastExport] = useState(null)
  const [detectionBurn, setDetectionBurn] = useState(false)
  const progress = useProgress()

  async function handleExport(format) {
    if (!segmentId) { setError('Aucun clip sélectionné.'); return }

    const fmt = FORMATS.find(f => f.id === format)
    if (fmt.needsSubs && !subtitles.length) { setError('Aucune réplique — ajoutez des sous-titres d\'abord.'); return }
    setLoading(format)
    setError(null)
    try {
      const body = { subtitles: fmt.needsSubs ? subtitles : [], segment_id: segmentId, format }
      if (format === 'mp4') {
        body.px_per_sec = pxPerSec
        body.br_offset = brOffset
        body.canvas_w = getCanvasWidth?.() || 1200
        body.canvas_h = canvasH
        body.br_font = brFont
        body.br_style = brStyle
        body.detection_burn = detectionBurn
      }
      if (format === 'croisille') {
        body.boucles = boucles
      }

      // GIF → job mode (two-pass palette → slow).
      if (format === 'gif') {
        const fireJob = async () => {
          const res = await fetch('/api/export/gif-job', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `HTTP ${res.status}`)
          }
          const { job_id } = await res.json()
          return job_id
        }
        const jobId = await fireJob()
        progress.start({
          kind: 'export-gif',
          title: 'Export GIF',
          jobId,
          retry: fireJob,
          downloadOnDone: true,
          downloadFilename: 'clip.gif',
          onDone: () => { setLastExport(format); setLoading(null) },
          onError: (err) => { setError('Erreur export : ' + err.message); setLoading(null) },
          onCancel: () => { setError('Export annulé.'); setLoading(null) },
        })
        return
      }

      // MP4 → job-mode with live progress + cancel. Other formats stay sync.
      if (format === 'mp4') {
        const fireJob = async () => {
          const res = await fetch('/api/export/mp4-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `HTTP ${res.status}`)
          }
          const { job_id } = await res.json()
          return job_id
        }
        const jobId = await fireJob()
        progress.start({
          kind: 'export-mp4',
          title: 'Export MP4 + BR',
          jobId,
          retry: fireJob,
          downloadOnDone: true,
          downloadFilename: 'bande_rythmo.mp4',
          onDone: () => {
            setLastExport(format)
            setLoading(null)
          },
          onError: (err) => {
            setError('Erreur export : ' + err.message)
            setLoading(null)
          },
          onCancel: () => {
            setError('Export annulé.')
            setLoading(null)
          },
        })
        return
      }

      const res = await fetch('/api/export/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'ass-karaoke' ? 'ass' : format === 'croisille' ? 'html' : format
      a.download = format === 'croisille'
        ? 'croisille.html'
        : `bande_rythmo${format === 'ass-karaoke' ? '_karaoke' : ''}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      setLastExport(format)
    } catch (e) {
      setError('Erreur export : ' + e.message)
    } finally {
      if (format !== 'mp4' && format !== 'gif') setLoading(null)
    }
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 16 }}>
        Choisissez le format selon votre usage.
        {subtitles.length > 0 && ` ${subtitles.length} réplique${subtitles.length !== 1 ? 's' : ''} incluse${subtitles.length !== 1 ? 's' : ''}.`}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {FORMATS.map(({ id, label, icon, desc, color, needsSubs }) => {
          const isLoading = loading === id
          const unavailable = needsSubs && !subtitles.length
          return (
            <div
              key={id}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${lastExport === id ? color : 'var(--border)'}`,
                borderRadius: 8,
                overflow: 'hidden',
                opacity: unavailable ? 0.45 : 1,
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ marginBottom: 6, color }}><Icon d={icon} size={22} sw={1.6} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 4 }}>.{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{desc}</div>
                {needsSubs && !subtitles.length && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Nécessite des sous-titres</div>
                )}
              </div>
              <div style={{ padding: '10px 16px' }}>
                <button
                  onClick={() => handleExport(id)}
                  disabled={!!loading || unavailable}
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    background: isLoading ? 'var(--surface3)' : color,
                    color: isLoading ? 'var(--text3)' : '#fff',
                    fontWeight: 600,
                    fontSize: 13,
                    borderRadius: 6,
                    cursor: !!loading || unavailable ? 'default' : 'pointer',
                    opacity: isLoading ? 1 : undefined,
                  }}
                >
                  {isLoading ? 'Export...' : `Exporter ${label}`}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={detectionBurn} onChange={e => setDetectionBurn(e.target.checked)} />
          Incruster la détection (MP4)
        </label>
        <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>
          Par défaut désactivé — les studios préfèrent la bande propre et l'autorité dans le DetX.
        </span>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(229,69,69,0.1)', border: '1px solid rgba(229,69,69,0.3)', borderRadius: 4, color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {lastExport && !error && !loading && (
        <div style={{ padding: '10px 14px', background: 'rgba(68,187,85,0.1)', border: '1px solid rgba(68,187,85,0.3)', borderRadius: 4, color: 'var(--success)', fontSize: 13 }}>
          ✓ Export {lastExport.toUpperCase()} téléchargé
        </div>
      )}
    </div>
  )
}
