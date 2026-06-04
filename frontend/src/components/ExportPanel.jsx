import React, { useState, useEffect, useCallback } from 'react'
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
  const [quality, setQuality] = useState('standard')   // draft | standard | youtube
  const [history, setHistory] = useState([])
  const [autoDownload, setAutoDownload] = useState(() => {
    try { return localStorage.getItem('export-auto-dl') !== '0' } catch { return true }
  })
  const progress = useProgress()

  // Persist history toggle.
  useEffect(() => {
    try { localStorage.setItem('export-auto-dl', autoDownload ? '1' : '0') } catch {}
  }, [autoDownload])

  // Load past exports for the current clip.
  const refreshHistory = useCallback(async () => {
    if (!segmentId) { setHistory([]); return }
    try {
      const r = await fetch(`/api/export/list?clip_id=${encodeURIComponent(segmentId)}`)
      if (!r.ok) return
      setHistory(await r.json())
    } catch {}
  }, [segmentId])
  useEffect(() => { refreshHistory() }, [refreshHistory])

  function redownload(id, filename) {
    const a = document.createElement('a')
    a.href = `/api/export/download/${id}`
    a.download = filename || 'export'
    a.click()
  }
  async function removeExport(id) {
    if (!confirm('Supprimer cet export ?')) return
    try {
      await fetch(`/api/export/${id}`, { method: 'DELETE' })
      refreshHistory()
    } catch {}
  }

  function fmtBytes(n) {
    if (!n) return '—'
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
  }
  function fmtTime(iso) {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      const now = new Date()
      const sameDay = d.toDateString() === now.toDateString()
      return sameDay
        ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

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
        body.quality = quality
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
          downloadOnDone: autoDownload,
          downloadFilename: 'clip.gif',
          onDone: () => { setLastExport(format); setLoading(null); refreshHistory() },
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
          downloadOnDone: autoDownload,
          downloadFilename: 'bande_rythmo.mp4',
          onDone: () => {
            setLastExport(format)
            setLoading(null)
            refreshHistory()
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
      if (autoDownload) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const ext = format === 'ass-karaoke' ? 'ass' : format === 'croisille' ? 'html' : format
        a.download = format === 'croisille'
          ? 'croisille.html'
          : `bande_rythmo${format === 'ass-karaoke' ? '_karaoke' : ''}.${ext}`
        a.click()
        URL.revokeObjectURL(url)
      }
      setLastExport(format)
      refreshHistory()
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

      {/* MP4 quality preset — trade render time for fidelity. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6 }}>
        <span style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>Qualité MP4</span>
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
          {[
            { v: 'draft',    l: 'Draft',    desc: '~3× plus rapide · aperçu' },
            { v: 'standard', l: 'Standard', desc: 'équilibré · défaut' },
            { v: 'youtube',  l: 'YouTube',  desc: 'final · supersample 4 · preset slow' },
          ].map(o => (
            <button key={o.v} onClick={() => setQuality(o.v)} title={o.desc}
              style={{
                padding: '5px 12px', fontSize: 11.5, borderRadius: 4,
                background: quality === o.v ? 'var(--accent)' : 'transparent',
                color: quality === o.v ? '#000' : 'var(--text2)',
                fontWeight: quality === o.v ? 700 : 500, border: 'none',
                cursor: 'pointer', minHeight: 28,
              }}>{o.l}</button>
          ))}
        </div>
        <span style={{ fontSize: 10.5, color: 'var(--text3)', flex: 1, textAlign: 'right' }}>
          {quality === 'draft' && 'preset fast · crf 23 · supersample 2'}
          {quality === 'standard' && 'preset medium · crf 21 · supersample 3'}
          {quality === 'youtube' && 'preset slow · crf 19 · supersample 4'}
        </span>
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

      {/* Decouple make/download — toggle off if you want to batch exports first then DL later. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', marginBottom: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoDownload} onChange={e => setAutoDownload(e.target.checked)} />
          Télécharger automatiquement
        </label>
        <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>
          Désactivez pour empiler des exports puis télécharger plus tard depuis l'historique.
        </span>
      </div>

      {/* Exports précédents — re-download anytime, no re-render. */}
      {history.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            Exports précédents
            <span style={{ color: 'var(--text4)' }}>· {history.length}</span>
            <div style={{ flex: 1 }} />
            <button onClick={refreshHistory}
              style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text3)', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>
              Rafraîchir
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {history.map(h => {
              const fmt = FORMATS.find(f => f.id === h.format) || { color: 'var(--text2)', label: h.format.toUpperCase() }
              return (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 1,
                    color: fmt.color, padding: '2px 7px',
                    background: 'var(--surface2)',
                    border: `1px solid ${fmt.color}33`,
                    borderRadius: 4, minWidth: 64, textAlign: 'center',
                  }}>{fmt.label}</span>
                  <span style={{ flex: 1, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.filename}
                    {h.quality && <span style={{ color: 'var(--text3)', marginLeft: 6 }}>· {h.quality}</span>}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{fmtBytes(h.size_bytes)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', minWidth: 80, textAlign: 'right' }}>{fmtTime(h.created_at)}</span>
                  <button
                    onClick={() => redownload(h.id, h.filename)}
                    title="Télécharger"
                    style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', minHeight: 26 }}>
                    ↓
                  </button>
                  <button
                    onClick={() => removeExport(h.id)}
                    title="Supprimer"
                    style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--danger)', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', minHeight: 26 }}>
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
