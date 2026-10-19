import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { T, alpha, Icon, ICONS, Btn, Chip, Segmented, Toggle, ProgressBar, ScreenHeader } from '../ui'
import { useProgress } from '../ProgressContext'
import { useSettings } from '../SettingsContext'
import { fmtClock } from '../utils/timecode'
import { downloadUrl, saveBlob } from '../download'
import { useExportScreen } from './exportScreen'
import { primaryRowKey } from '../utils/primaryRow'
import { EXPORT_QUEUE, inExportQueue } from '../utils/toastScope'
import { useNow } from '../utils/useNow'
import { formatColor, NEUTRAL_FORMAT_COLOR } from '../utils/formatColors'
import { PRIMARY_FONT_IDS, fetchUploadedFonts, fontLabel } from '../config/fonts'

// Export screen — port of redesign screen-record-export.jsx → Export,
// QueueRow, RangeField, ExportOptions.

const GROUPS = [
  { label: 'Vidéo bande rythmo', hint: 'regarder / partager', fmts: [
    { id: 'mp4',        ext: 'MP4 + BR',   ic: ICONS.film,   desc: 'Vidéo avec BR incrustée', c: formatColor('mp4'), heavy: true, needsSubs: true },
    { id: 'gif',        ext: 'GIF',        ic: ICONS.layers, desc: 'Clip animé', c: formatColor('gif'), heavy: true },
    { id: 'mp4-dubbed', ext: 'MP4 doublé', ic: ICONS.users,  desc: 'Prises mixées sur la VO', c: formatColor('mp4-dubbed'), heavy: true },
    { id: 'dubpack',    ext: 'Dubpack',    ic: ICONS.folder, desc: 'Pack Choicer Voicer · OGV + répliques', c: formatColor('dubpack'), heavy: true, needsSubs: true },
  ]},
  { label: 'Sous-titres', hint: 'montage / compat', fmts: [
    { id: 'srt',         ext: 'SRT',         ic: ICONS.sub,  desc: 'Standard', c: formatColor('srt'), needsSubs: true },
    { id: 'ass',         ext: 'ASS',         ic: ICONS.film, desc: 'Défilement BR', c: formatColor('ass'), needsSubs: true },
    { id: 'ass-karaoke', ext: 'ASS Karaoké', ic: ICONS.mic,  desc: 'Tags \\kf par mot', c: formatColor('ass-karaoke'), needsSubs: true },
  ]},
  { label: 'Documents studio', hint: 'plateau', fmts: [
    { id: 'detx',      ext: 'DetX',      ic: ICONS.target, desc: 'Standard FR · détection', c: formatColor('detx'), needsSubs: true },
    { id: 'croisille', ext: 'Croisillé', ic: ICONS.grid,   desc: 'Grille perso × boucles', c: formatColor('croisille'), needsSubs: true },
  ]},
  { label: 'Audio', hint: 'soundboard', fmts: [
    { id: 'mp3', ext: 'MP3', ic: ICONS.volume, desc: 'Compressé', c: formatColor('mp3') },
    { id: 'wav', ext: 'WAV', ic: ICONS.volume, desc: 'Sans perte', c: formatColor('wav') },
  ]},
]
const FORMATS = GROUPS.flatMap(g => g.fmts)
const fmtOf = id => FORMATS.find(f => f.id === id) || { id, ext: (id || '').toUpperCase(), c: NEUTRAL_FORMAT_COLOR }

// Async (job) formats → endpoint + download name.
const JOB_FORMATS = {
  mp4:     { url: '/api/export/mp4-job',     title: 'Export MP4 + BR', file: 'bande_rythmo.mp4' },
  gif:     { url: '/api/export/gif-job',     title: 'Export GIF',      file: 'clip.gif' },
  dubpack: { url: '/api/export/dubpack-job', title: 'Export Dubpack',  file: 'dubpack.zip' },
}

const QUALITY_HINT = {
  draft:    'preset fast · crf 23 · ss2',
  standard: 'preset medium · crf 21 · ss3',
  youtube:  'preset slow · crf 19 · ss4',
}

// Progress jobs started from this screen, by job key → { fmt, file } (the job
// itself carries clipId + queue). Module-level so the queue survives closing/reopening the screen.
const JOB_META = new Map()

// Finished files listed in the queue before "Voir tout (n)".
const QUEUE_CAP = 8

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
    const sameDay = d.toDateString() === new Date().toDateString()
    return sameDay
      ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res
}

export default function ExportPanel(props) {
  const host = useExportScreen()
  if (host && !host.slot) return null // slot mounts on the next commit
  const screen = <ExportScreen {...props} onBack={host?.onClose} onActivity={host?.onActivity} clipName={host?.clip?.name} fill={!!host?.slot} initialFormat={host?.initialFormat} />
  return host?.slot ? createPortal(screen, host.slot) : screen
}

function ExportScreen({ segmentId, subtitles, boucles = [], pxPerSec = 180, brOffset = 0, canvasH = 64, getCanvasWidth, brFont = 'atkinson', brStyle = 'classique', duration = 0, getCurrentTime, loopRegion = null, onBack, onActivity, clipName, fill, initialFormat }) {
  const [sel, setSel] = useState(initialFormat || 'mp4')
  // Sync (non-job) exports in flight, one queue row each. The launch button
  // never blocks (FIXES_R5 #12); `launching` is its 600 ms click feedback.
  const [syncRuns, setSyncRuns] = useState([])
  const [launching, setLaunching] = useState(false)
  const launchTimerRef = useRef(null)
  const runSeqRef = useRef(0)
  const [error, setError] = useState(null)
  const [lastExport, setLastExport] = useState(null)
  const { settings } = useSettings()
  const [detectionBurn, setDetectionBurn] = useState(() => !!settings.exportDetectionBurn)
  const [quality, setQuality] = useState('standard')
  // Police BR follows the editor's band font unless overridden for this export.
  const [fontOverride, setFontOverride] = useState(null)
  const exportFont = fontOverride ?? brFont
  // Custom export range — off = whole clip. Applies to every format.
  const [rangeOn, setRangeOn] = useState(false)
  const [rangeIn, setRangeIn] = useState(0)
  const [rangeOut, setRangeOut] = useState(0)
  const [gpu, setGpu] = useState('off')                 // off | auto | nvenc | qsv | amf
  const [hwEncoders, setHwEncoders] = useState(null)    // { nvenc, qsv, amf, any } | null
  const [history, setHistory] = useState([])
  const [showAll, setShowAll] = useState(false)
  const [autoDownload, setAutoDownload] = useState(() => {
    try { return localStorage.getItem('export-auto-dl') !== '0' } catch { return true }
  })
  const progress = useProgress()
  const mix = useMix(segmentId)
  const now = useNow()

  useEffect(() => () => clearTimeout(launchTimerRef.current), [])

  useEffect(() => {
    try { localStorage.setItem('export-auto-dl', autoDownload ? '1' : '0') } catch { /* storage unavailable — keep in-memory value */ }
  }, [autoDownload])

  const refreshHistory = useCallback(async () => {
    if (!segmentId) { setHistory([]); return }
    try {
      const r = await fetch(`/api/export/list?clip_id=${encodeURIComponent(segmentId)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setHistory(await r.json())
    } catch (e) { console.error('export history fetch failed', e) } // la liste reste vide, l'export fonctionne
  }, [segmentId])
  useEffect(() => { refreshHistory() }, [refreshHistory])

  // Default the range end to the clip duration when it arrives.
  useEffect(() => {
    if (duration > 0) setRangeOut(o => o === 0 ? duration : o)
  }, [duration])

  // Probe HW encoders once (cached server-side).
  useEffect(() => {
    let live = true
    fetch('/api/export/hw-encoders')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (live && d) setHwEncoders(d) })
      .catch(e => console.warn('hw-encoders probe failed', e))
    return () => { live = false }
  }, [])

  async function redownload(id, filename) {
    try {
      await downloadUrl(`/api/export/download/${id}`, filename)
    } catch (e) {
      setError('Téléchargement impossible : ' + e.message)
    }
  }

  async function downloadAll() {
    for (const h of history) await redownload(h.id, h.filename)
  }

  async function removeExport(id) {
    if (!confirm('Supprimer cet export ?')) return
    try {
      const res = await fetch(`/api/export/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      setError('Suppression de l\'export échouée : ' + e.message)
    }
    refreshHistory()
  }

  async function clearHistory() {
    const n = history.length
    if (!n || !confirm(`Supprimer les ${n} export${n > 1 ? 's' : ''} de ce clip ? Les fichiers seront effacés.`)) return
    const failed = []
    for (const h of history) {
      try {
        const res = await fetch(`/api/export/${h.id}`, { method: 'DELETE' })
        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`)
      } catch (e) {
        console.error('export delete failed', h.id, e)
        failed.push(h.filename)
      }
    }
    if (failed.length) setError(`Suppression échouée pour ${failed.length} export${failed.length > 1 ? 's' : ''} : ${failed.join(', ')}`)
    setShowAll(false)
    refreshHistory()
  }

  function seeAll() {
    if (onActivity) onActivity()
    else setShowAll(true)
  }

  function buildBody(format, f) {
    const body = { subtitles: f.needsSubs ? subtitles : [], segment_id: segmentId, format }
    if (format === 'mp4') {
      body.px_per_sec = pxPerSec
      body.br_offset = brOffset
      body.canvas_w = getCanvasWidth?.() || 1200
      body.canvas_h = canvasH
      body.br_font = exportFont
      body.br_style = brStyle
      body.detection_burn = detectionBurn
      body.quality = quality
      body.gpu = gpu
    }
    if (format === 'croisille') body.boucles = boucles
    // Custom range → applies to every format (subs trimmed/shifted, media cut).
    if (rangeOn && rangeOut > rangeIn) {
      body.in_point = rangeIn
      body.out_point = rangeOut
    }
    return body
  }

  async function startJob(format, body) {
    const job = JOB_FORMATS[format]
    const fireJob = async () => {
      const res = await postJson(job.url, body)
      const { job_id } = await res.json()
      return job_id
    }
    const jobId = await fireJob()
    const { subtitles: _subs, boucles: _boucles, ...settingsOnly } = body
    const handle = progress.start({
      kind: `export-${format}`,
      title: job.title,
      jobId,
      clipId: segmentId,
      options: JSON.stringify(settingsOnly),
      queue: EXPORT_QUEUE,
      retry: fireJob,
      downloadOnDone: autoDownload,
      downloadFilename: job.file,
      onDone: () => { setLastExport(format); refreshHistory() },
      onError: (err) => setError('Erreur export : ' + err.message),
      onCancel: () => setError('Export annulé.'),
    })
    JOB_META.set(handle.key, { fmt: format, file: job.file })
  }

  async function handleExport(format) {
    if (!segmentId) { setError('Aucun clip sélectionné.'); return }
    if (format === 'mp4-dubbed') { setError(null); mix.exportDub(refreshHistory); return }
    const f = fmtOf(format)
    if (f.needsSubs && !subtitles.length) { setError('Aucune réplique — ajoutez des sous-titres d\'abord.'); return }
    flashLaunching()
    setError(null)
    mix.clearMsg()
    const body = buildBody(format, f)
    if (JOB_FORMATS[format]) {
      try {
        await startJob(format, body)
      } catch (e) {
        setError('Erreur export : ' + e.message)
      }
      return
    }
    runSeqRef.current += 1
    const run = { id: `${format}-${runSeqRef.current}`, format }
    setSyncRuns(prev => [...prev, run])
    try {
      const res = await postJson('/api/export/export', body)
      const blob = await res.blob()
      if (autoDownload) {
        const ext = format === 'ass-karaoke' ? 'ass' : format === 'croisille' ? 'html' : format
        saveBlob(blob, format === 'croisille'
          ? 'croisille.html'
          : `bande_rythmo${format === 'ass-karaoke' ? '_karaoke' : ''}.${ext}`)
      }
      setLastExport(format)
      refreshHistory()
    } catch (e) {
      setError('Erreur export : ' + e.message)
    } finally {
      setSyncRuns(prev => prev.filter(r => r.id !== run.id))
    }
  }

  function flashLaunching() {
    clearTimeout(launchTimerRef.current)
    setLaunching(true)
    launchTimerRef.current = setTimeout(() => setLaunching(false), 600)
  }

  const selFmt = fmtOf(sel)
  const unavailable = sel === 'mp4-dubbed'
    ? (mix.busy || !mix.selected.length)
    : (!!selFmt.needsSubs && !subtitles.length)
  const unavailableReason = !unavailable ? undefined
    : sel !== 'mp4-dubbed' ? 'Ce format nécessite des répliques'
    : mix.busy ? 'Mixage en cours…' : 'Sélectionnez au moins une prise'

  const jobs = (progress.jobs || []).filter(j => inExportQueue(j, segmentId))
  const runningCount = jobs.filter(j => j.status === 'running').length
    + syncRuns.length + (mix.busy ? 1 : 0)

  const status = error
    ? { c: T.danger, text: error }
    : mix.msg
      ? { c: mix.msg.kind === 'ok' ? T.success : T.danger, text: mix.msg.text }
      : (lastExport && !syncRuns.length)
        ? { c: T.success, text: `Export ${fmtOf(lastExport).ext} ${autoDownload ? 'téléchargé' : 'terminé — disponible dans la liste'}` }
        : null

  // FIXES_R4 §12: only the newest file, if < 10 min old, keeps a primary Télécharger.
  const primaryId = primaryRowKey(history.map(h => ({ key: h.id, at: h.created_at })), now)

  const nSubs = subtitles.length
  const sub = [clipName, `${nSubs} réplique${nSubs !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')

  return (
    <div style={{ height: fill ? '100%' : 'min(82vh, 780px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ScreenHeader kicker="EXPORTER" title="Sortie & téléchargements" sub={sub}
        right={onBack && <Btn variant="outline" icon={ICONS.chevronL} onClick={onBack} title="Retour à l'éditeur (Échap)">Retour</Btn>} />
      <div style={{ flex: 1, minHeight: 0, padding: '8px 32px 28px', display: 'flex', gap: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, overflow: 'hidden', minHeight: 0 }}>
          {/* format picker */}
          <ScrollFade style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${T.border}` }} innerStyle={{ padding: 16 }}>
            {GROUPS.map(g => (
              <div key={g.label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 8 }}>
                  <span style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 0.8, color: T.text2 }}>{g.label.toUpperCase()}</span>
                  <span style={{ fontSize: 10.5, color: T.text4 }}>{g.hint}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {g.fmts.map(f => {
                    const on = sel === f.id
                    const noSubs = f.needsSubs && !nSubs
                    return (
                      <button data-rd key={f.id} onClick={() => setSel(f.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: T.r.ctl, cursor: 'pointer', width: '100%', textAlign: 'left',
                        background: on ? f.c + '14' : T.bg2, border: `1px solid ${on ? f.c + '88' : T.border}`,
                        opacity: noSubs ? 0.45 : 1,
                      }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: f.c + '1a', border: `1px solid ${f.c}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon d={f.ic} size={15} stroke={f.c} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: T.fs.sm, fontWeight: 600, color: on ? f.c : T.text }}>{f.ext}</div>
                          <div style={{ fontSize: 10.5, color: T.text3 }}>{noSubs ? 'Nécessite des sous-titres' : f.desc}</div>
                        </div>
                        {f.heavy && <span style={{ fontSize: 8.5, padding: '2px 5px', borderRadius: 3, background: T.surface2, color: T.text3, border: `1px solid ${T.border2}` }}>RENDU</span>}
                        {on && <Icon d={ICONS.check} size={14} stroke={f.c} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </ScrollFade>

          {/* options */}
          <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${T.border}`, padding: 18, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.2, color: T.text3, marginBottom: 14 }}>OPTIONS</div>
            {sel === 'mp4-dubbed' ? <MixOptions mix={mix} subtitles={subtitles} /> : (
              <>
                <RangeField
                  on={rangeOn} setOn={setRangeOn}
                  rangeIn={rangeIn} setRangeIn={setRangeIn} rangeOut={rangeOut} setRangeOut={setRangeOut}
                  duration={duration} getCurrentTime={getCurrentTime} loopRegion={loopRegion}
                />
                <ExportOptions
                  sel={sel}
                  quality={quality} setQuality={setQuality}
                  detectionBurn={detectionBurn} setDetectionBurn={setDetectionBurn}
                  exportFont={exportFont} setExportFont={v => setFontOverride(v === brFont ? null : v)} brFont={brFont}
                  gpu={gpu} setGpu={setGpu} hwEncoders={hwEncoders}
                />
                <Tg label="Télécharger automatiquement" on={autoDownload} onToggle={() => setAutoDownload(v => !v)}
                  desc="Désactivez pour empiler des exports puis les télécharger depuis la liste." />
              </>
            )}
            <div style={{ flex: 1 }} />
            {status && <div style={{ fontSize: T.fs.micro, color: status.c, lineHeight: 1.5, marginTop: 10 }}>{status.text}</div>}
            <Btn variant="primary" size="lg" full icon={launching ? undefined : ICONS.download} style={{ marginTop: 14 }}
              disabled={unavailable} onClick={() => handleExport(sel)}
              title={unavailableReason || (runningCount > 0 ? 'Ajoute un export à la file — les exports en cours continuent' : undefined)}>
              {launching && <Spinner />}
              {sel === 'mp4-dubbed' && mix.busy ? 'Mixage en cours…' : 'Lancer l\'export'}
            </Btn>
            <div style={{ fontSize: 10, color: T.text4, textAlign: 'center', marginTop: 8 }}>apparaît dans la liste → téléchargez quand prêt</div>
          </div>

          {/* queue */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: T.bg }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: T.fs.base, fontWeight: 600 }}>File d'attente & téléchargements</span>
              {runningCount > 0 && <Chip soft color={T.accent}>{runningCount} en cours</Chip>}
              <div style={{ flex: 1 }} />
              <Btn size="sm" icon={ICONS.loop} title="Rafraîchir la liste" onClick={refreshHistory} />
              <Btn size="sm" variant="outline" icon={ICONS.download} disabled={!history.length} title={history.length ? undefined : 'Aucun export à télécharger'} onClick={downloadAll}>Tout télécharger</Btn>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 14, paddingBottom: 'calc(14px + var(--toast-safe-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobs.map(j => (
                <JobRow key={j.key} job={j} meta={JOB_META.get(j.key)}
                  onCancel={() => progress.cancelByKey(j.key)}
                  onRetry={() => progress.retry(j.key)}
                  onDismiss={() => progress.dismiss(j.key)} />
              ))}
              {syncRuns.map(r => {
                const f = fmtOf(r.format)
                return <QueueRow key={r.id} q={{ ext: f.ext, c: f.c, file: `${f.ext} · ${clipName || segmentId}`, status: 'render', stage: 'Génération…' }} />
              })}
              {mix.busy && (
                <QueueRow q={{ ext: 'MP4 doublé', c: fmtOf('mp4-dubbed').c, file: 'clip_double.mp4', status: 'render', stage: 'Mixage…' }} />
              )}
              {(showAll ? history : history.slice(0, QUEUE_CAP)).map(h => {
                const f = fmtOf(h.format)
                return (
                  <QueueRow key={h.id} primary={h.id === primaryId}
                    q={{ ext: f.ext, c: f.c, file: h.filename, status: 'ready', size: fmtBytes(h.size_bytes), when: fmtTime(h.created_at), quality: h.quality }}
                    onDownload={() => redownload(h.id, h.filename)}
                    onDelete={() => removeExport(h.id)} />
                )
              })}
              {history.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  {history.length > QUEUE_CAP && !showAll && (
                    <Btn size="sm" onClick={seeAll} title={onActivity ? 'Tous les exports dans Activité' : 'Afficher tous les exports'}>
                      Voir tout ({history.length})
                    </Btn>
                  )}
                  <div style={{ flex: 1 }} />
                  <Btn size="sm" danger icon={ICONS.trash} onClick={clearHistory} title="Supprimer tous les exports de ce clip">Vider</Btn>
                </div>
              )}
              {!jobs.length && !history.length && !syncRuns.length && !mix.busy && (
                <div style={{ fontSize: T.fs.xs, color: T.text3, textAlign: 'center', padding: '28px 0' }}>
                  Aucun export pour ce clip — choisissez un format puis lancez l'export.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// FIXES_R6 #14: a 24px surface → transparent fade at the bottom while more
// content is below; hidden once scrolled to the end.
function ScrollFade({ children, style, innerStyle }) {
  const ref = useRef(null)
  const [more, setMore] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    for (const child of el.children) ro.observe(child)
    return () => ro.disconnect()
  }, [update])

  return (
    <div style={{ position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column', ...style }}>
      <div ref={ref} onScroll={update} style={{ flex: 1, minHeight: 0, overflow: 'auto', ...innerStyle }}>
        {children}
      </div>
      <div aria-hidden="true" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, pointerEvents: 'none',
        background: `linear-gradient(to top, ${T.surface}, transparent)`,
        opacity: more ? 1 : 0, transition: 'opacity .15s',
      }} />
    </div>
  )
}

function Spinner() {
  return <span aria-hidden style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'brspin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
}

function QueueRow({ q, onCancel, onDownload, onDelete, actions, primary = false }) {
  const rend = q.status === 'render'
  const failed = q.status === 'error'
  const hasPct = q.pct != null
  return (
    <div style={{ background: T.surface, border: `1px solid ${failed ? alpha(T.danger, '44') : rend ? alpha(T.accent, '44') : T.border}`, borderRadius: T.r.ctl, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: q.c, padding: '3px 8px', minWidth: 76, textAlign: 'center', background: q.c + '14', border: `1px solid ${q.c}33`, borderRadius: 5 }}>{q.ext}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.fs.sm, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.file}</div>
        {rend ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 6 }}>
            <ProgressBar pct={hasPct ? q.pct : 100} h={4} color={hasPct ? undefined : T.border3} />
            <span style={{ fontSize: 10, color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{q.stage}</span>
          </div>
        ) : failed ? (
          <div style={{ fontSize: 10.5, color: T.danger, fontFamily: T.fontMono, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.stage}</div>
        ) : (
          <div style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, marginTop: 2 }}>
            {q.size} · {q.when}{q.quality ? ` · ${q.quality}` : ''}
          </div>
        )}
      </div>
      {actions || (rend ? (
        <>
          <span style={{ fontSize: T.fs.sm, fontWeight: 700, fontFamily: T.fontMono, color: T.accent, minWidth: 34, textAlign: 'right' }}>{hasPct ? `${q.pct}%` : ''}</span>
          {onCancel && <Btn size="sm" icon={ICONS.close} title="Annuler" onClick={onCancel} />}
        </>
      ) : (
        <>
          <Btn size="sm" variant={primary ? 'primary' : 'outline'} icon={ICONS.download} onClick={onDownload}>Télécharger</Btn>
          <Btn size="sm" icon={ICONS.trash} title="Supprimer" onClick={onDelete} />
        </>
      ))}
    </div>
  )
}

function JobRow({ job, meta, onCancel, onRetry, onDismiss }) {
  const f = fmtOf(meta?.fmt)
  const base = { ext: f.ext, c: f.c, file: meta?.file || job.title }
  if (job.status === 'running') {
    return <QueueRow q={{ ...base, status: 'render', pct: Math.round((job.pct || 0) * 100), stage: job.stage || '…' }} onCancel={onCancel} />
  }
  if (job.status === 'error') {
    return (
      <QueueRow q={{ ...base, status: 'error', stage: job.error || 'Erreur' }} actions={(
        <>
          {job.retry && <Btn size="sm" variant="outline" onClick={onRetry}>Réessayer</Btn>}
          <Btn size="sm" icon={ICONS.close} title="Fermer" onClick={onDismiss} />
        </>
      )} />
    )
  }
  const label = job.status === 'done' ? 'Terminé' : 'Annulé'
  return (
    <QueueRow q={{ ...base, status: 'render', pct: job.status === 'done' ? 100 : 0, stage: label }} actions={(
      <span style={{ fontSize: T.fs.xs, fontWeight: 600, color: job.status === 'done' ? T.success : T.text3 }}>{label}</span>
    )} />
  )
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2, marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  )
}

function Tg({ label, on, desc, onToggle }) {
  return (
    <label onClick={onToggle} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
      <Toggle on={on} />
      <div>
        <div style={{ fontSize: T.fs.xs, color: T.text }}>{label}</div>
        {desc && <div style={{ fontSize: 10, color: T.text3, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
    </label>
  )
}

function Slider({ value, min, max, step, onChange, color, title }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <input type="range" min={min} max={max} step={step} value={value} title={title}
      onChange={e => onChange(+e.target.value)}
      style={{ flex: 1, minWidth: 0, color, '--pct': `${pct}%` }} />
  )
}

function RangeField({ on, setOn, rangeIn, setRangeIn, rangeOut, setRangeOut, duration, getCurrentTime, loopRegion }) {
  const max = duration || 1
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2, marginBottom: 7 }}>Plage</div>
      <Segmented value={on ? 'custom' : 'full'} onChange={v => setOn(v === 'custom')}
        options={[{ v: 'full', l: 'Clip entier' }, { v: 'custom', l: 'Personnalisée' }]} />
      {on && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontFamily: T.fontMono, fontSize: 11 }}>
            <Chip soft color={T.info}>[ IN {fmtClock(rangeIn)}</Chip>
            <div style={{ flex: 1, textAlign: 'center', color: T.text3 }}>{Math.max(0, rangeOut - rangeIn).toFixed(1)}s</div>
            <Chip soft color={T.accent}>OUT {fmtClock(rangeOut)} ]</Chip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Slider value={rangeIn} min={0} max={max} step={0.05} color={T.info} title="Point IN"
              onChange={v => setRangeIn(Math.min(v, rangeOut - 0.1))} />
            <Btn size="sm" icon={ICONS.in} title="IN au curseur"
              onClick={() => setRangeIn(Math.min(getCurrentTime?.() || 0, rangeOut - 0.1))}>au curseur</Btn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Slider value={rangeOut} min={0} max={max} step={0.05} color={T.accent} title="Point OUT"
              onChange={v => setRangeOut(Math.max(v, rangeIn + 0.1))} />
            <Btn size="sm" icon={ICONS.out} title="OUT au curseur"
              onClick={() => setRangeOut(Math.max(getCurrentTime?.() || 0, rangeIn + 0.1))}>au curseur</Btn>
          </div>
        </>
      )}
      {loopRegion && (
        <Btn size="sm" variant="outline" icon={ICONS.loop} style={{ marginTop: 8 }}
          onClick={() => { setRangeIn(loopRegion.start); setRangeOut(loopRegion.end); setOn(true) }}>
          Utiliser la boucle
        </Btn>
      )}
    </div>
  )
}

// Uploaded font names — only needed when the project band uses one.
function useUploadedFontsFor(fontId) {
  const [fonts, setFonts] = useState([])
  const uploaded = !!fontId && fontId.startsWith('u-')
  useEffect(() => {
    if (!uploaded) return
    let alive = true
    fetchUploadedFonts()
      .then(list => { if (alive) setFonts(list) })
      .catch(e => console.warn('Chargement des polices importées échoué', e))
    return () => { alive = false }
  }, [uploaded])
  return fonts
}

function ExportOptions({ sel, quality, setQuality, detectionBurn, setDetectionBurn, exportFont, setExportFont, brFont, gpu, setGpu, hwEncoders }) {
  const uploadedFonts = useUploadedFontsFor(brFont)
  if (sel === 'mp4') {
    const fontIds = PRIMARY_FONT_IDS.includes(brFont) ? PRIMARY_FONT_IDS : [...PRIMARY_FONT_IDS, brFont]
    const fontOptions = fontIds.map(id => ({ v: id, l: fontLabel(id, uploadedFonts) }))
    const encoders = hwEncoders ? ['nvenc', 'qsv', 'amf'].filter(k => hwEncoders[k]) : []
    return (<>
      <Row label="Qualité">
        <Segmented value={quality} onChange={setQuality} options={[
          { v: 'draft',    l: 'Draft',    desc: '~3× plus rapide · aperçu' },
          { v: 'standard', l: 'Standard', desc: 'équilibré · défaut' },
          { v: 'youtube',  l: 'YouTube',  desc: 'final · supersample 4 · preset slow' },
        ]} />
        <div style={{ fontSize: 10, color: T.text3, marginTop: 6, fontFamily: T.fontMono }}>{QUALITY_HINT[quality]}</div>
      </Row>
      <Tg label="Incruster la détection" on={detectionBurn} onToggle={() => setDetectionBurn(v => !v)}
        desc="Off par défaut — bande propre, détails dans le DetX." />
      <Row label="Police BR">
        <Segmented value={exportFont} onChange={setExportFont} options={fontOptions} />
        <div style={{ fontSize: 10, color: T.text3, marginTop: 6 }}>
          {exportFont === brFont ? 'Police de la bande du projet' : (<>
            Remplace la police du projet ({fontLabel(brFont, uploadedFonts)}) ·{' '}
            <button data-rd onClick={() => setExportFont(brFont)}
              style={{ background: 'none', border: 'none', padding: 0, color: T.accent, fontSize: 10, cursor: 'pointer', fontFamily: T.fontUI }}>rétablir</button>
          </>)}
        </div>
      </Row>
      {hwEncoders?.any && (
        <>
          <Tg label={`Accélération GPU (${encoders.map(k => k.toUpperCase()).join(' / ') || 'auto'})`}
            on={gpu !== 'off'} onToggle={() => setGpu(g => g === 'off' ? 'auto' : 'off')} />
          {gpu !== 'off' && encoders.length > 0 && (
            <div style={{ marginTop: -4, marginBottom: 14 }}>
              <Segmented size="sm" value={gpu} onChange={setGpu} options={[
                { v: 'auto', l: 'Auto' },
                ...encoders.map(k => ({ v: k, l: k.toUpperCase() })),
              ]} />
            </div>
          )}
        </>
      )}
    </>)
  }
  if (sel === 'detx' || sel === 'croisille' || sel === 'dubpack') {
    const text = {
      detx: 'Standard d’échange FR — Cappella, phonations, et la couche détection.',
      croisille: 'Grille personnages × boucles — le planning remis au studio.',
      dubpack: 'Pack Choicer Voicer — vidéo OGV + un ogg / png / txt par réplique, en ZIP.',
    }[sel]
    return (
      <div style={{ padding: 12, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, fontSize: T.fs.xs, color: T.text2, lineHeight: 1.5, marginBottom: 14 }}>
        {text}
      </div>
    )
  }
  if (sel === 'mp3' || sel === 'wav') {
    return <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.5, marginBottom: 14 }}>Audio de la sélection — StreamDeck, Discord, soundboards.</div>
  }
  return null
}

// ── Mixage — dubbed MP4 (takes mixed over the ducked source audio) ─────────
function useMix(segmentId) {
  const [takes, setTakes] = useState([])
  const [sel, setSel] = useState({})          // take_id → { on, gain }
  const [duck, setDuck] = useState(-12)
  const [muteBed, setMuteBed] = useState(false)
  const [hasBed, setHasBed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [bedBusy, setBedBusy] = useState(false)
  const [msg, setMsg] = useState(null)        // { kind: 'ok'|'err', text }

  const refresh = useCallback(async () => {
    if (!segmentId) return
    try {
      const [tr, cr] = await Promise.all([
        fetch(`/api/takes/${segmentId}`),
        fetch(`/api/clips/${segmentId}`),
      ])
      if (tr.ok) {
        const list = await tr.json()
        setTakes(list)
        // Validated (best) takes start selected; explicit choices are kept.
        setSel(s => {
          const next = { ...s }
          for (const t of list) if (t.best && !(t.id in next)) next[t.id] = { on: true, gain: 0 }
          return next
        })
      } else console.error('mix takes fetch failed', tr.status)
      if (cr.ok) setHasBed(!!(await cr.json()).has_bed)
    } catch (e) { console.error('mix data fetch failed', e) }
  }, [segmentId])
  useEffect(() => { refresh() }, [refresh])

  const selected = takes.filter(t => sel[t.id]?.on)

  async function exportDub(onExported) {
    if (!selected.length) { setMsg({ kind: 'err', text: 'Sélectionnez au moins une prise.' }); return }
    setBusy(true); setMsg(null)
    try {
      const res = await postJson('/api/export/mp4-dubbed', {
        segment_id: segmentId,
        entries: selected.map(t => ({ take_id: t.id, gain_db: sel[t.id]?.gain || 0 })),
        duck_db: duck, mute_bed: muteBed, loudnorm: true,
      })
      saveBlob(await res.blob(), 'clip_double.mp4')
      const n = selected.length
      setMsg({ kind: 'ok', text: `MP4 doublé exporté — ${n} prise${n > 1 ? 's' : ''} mixée${n > 1 ? 's' : ''}.` })
      onExported?.()
    } catch (e) {
      setMsg({ kind: 'err', text: 'Mixage échoué : ' + e.message })
    } finally { setBusy(false) }
  }

  async function bedRequest(run, okText) {
    setBedBusy(true); setMsg(null)
    try {
      const res = await run()
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      setMsg({ kind: 'ok', text: okText })
      return true
    } catch (e) {
      setMsg({ kind: 'err', text: e.message })
      return false
    } finally { setBedBusy(false) }
  }

  async function uploadBed(file) {
    const fd = new FormData()
    fd.append('audio', file)
    const ok = await bedRequest(() => fetch(`/api/clips/${segmentId}/replace-audio`, { method: 'POST', body: fd }),
      `Piste audio remplacée par « ${file.name} ».`)
    if (ok) setHasBed(true)
  }

  async function applyStem(stem) {
    const ok = await bedRequest(() => fetch(`/api/clips/${segmentId}/use-stem`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stem }),
    }), stem === 'no_vocals' ? 'Instrumental (Demucs) utilisé comme piste de base.' : 'Voix (Demucs) utilisée comme piste de base.')
    if (ok) setHasBed(true)
  }

  async function resetBed() {
    const ok = await bedRequest(() => fetch(`/api/clips/${segmentId}/audio-bed`, { method: 'DELETE' }), 'Audio original restauré.')
    if (ok) setHasBed(false)
  }

  return {
    takes, sel, setSel, selected, duck, setDuck, muteBed, setMuteBed, hasBed,
    busy, bedBusy, msg, clearMsg: () => setMsg(null), exportDub, uploadBed, applyStem, resetBed,
  }
}

function MixOptions({ mix, subtitles }) {
  const fileRef = useRef(null)
  const { takes, sel, setSel } = mix

  function takeLabel(t) {
    if (t.subtitle_index != null && subtitles[t.subtitle_index]) {
      const s = subtitles[t.subtitle_index]
      return `Réplique ${t.subtitle_index + 1}${s.character ? ' · ' + s.character : ''}`
    }
    return t.character || t.label || 'Prise libre'
  }

  function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) mix.uploadBed(file)
  }

  return (<>
    <Row label="Piste de base">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg" onChange={onFile} style={{ display: 'none' }} />
        <Btn size="sm" variant="outline" icon={ICONS.upload} disabled={mix.bedBusy}
          title="Remplacer l'audio du clip par un fichier (wav/mp3/m4a)" onClick={() => fileRef.current?.click()}>
          {mix.bedBusy ? 'Patientez…' : 'Remplacer l\'audio'}
        </Btn>
        <Btn size="sm" variant="outline" icon={ICONS.audio} disabled={mix.bedBusy}
          title="Utiliser l'instrumental Demucs (séparation vocale requise)" onClick={() => mix.applyStem('no_vocals')}>
          Instrumental
        </Btn>
        {mix.hasBed && (
          <Btn size="sm" active iconR={ICONS.close} disabled={mix.bedBusy}
            title="Revenir à l'audio original" onClick={mix.resetBed}>
            Piste remplacée
          </Btn>
        )}
      </div>
    </Row>

    <Row label={`Prises · ${takes.length}`}>
      {takes.length === 0 ? (
        <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.5 }}>
          Aucune prise enregistrée — enregistrez des répliques dans le Studio, elles apparaîtront ici pour le mixage.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {takes.map(t => {
            const on = !!sel[t.id]?.on
            const gain = sel[t.id]?.gain || 0
            return (
              <div key={t.id} style={{ padding: '8px 10px', background: T.bg2, border: `1px solid ${on ? alpha(T.accent, '55') : T.border}`, borderRadius: T.r.ctl }}>
                <label onClick={() => setSel(s => ({ ...s, [t.id]: { on: !on, gain } }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <Toggle on={on} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: T.fs.xs, color: on ? T.text : T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{takeLabel(t)}</span>
                  <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono }}>{(t.duration || 0).toFixed(1)}s</span>
                </label>
                {on && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Slider value={gain} min={-12} max={12} step={1} color={T.accent} title="Gain de la prise (dB)"
                      onChange={v => setSel(s => ({ ...s, [t.id]: { on: true, gain: v } }))} />
                    <span style={{ fontSize: 10.5, color: gain !== 0 ? T.accent : T.text4, fontFamily: T.fontMono, minWidth: 40, textAlign: 'right' }}>
                      {gain > 0 ? '+' : ''}{gain} dB
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Row>

    {takes.length > 0 && (
      <Row label="Voix originale">
        <Tg label="Muette" on={mix.muteBed} onToggle={() => mix.setMuteBed(v => !v)} />
        {!mix.muteBed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -4 }}>
            <Slider value={mix.duck} min={-24} max={0} step={1} color={T.accent} title="Atténuation de la piste originale (dB)"
              onChange={mix.setDuck} />
            <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, minWidth: 44, textAlign: 'right' }}>{mix.duck} dB</span>
          </div>
        )}
      </Row>
    )}
  </>)
}
