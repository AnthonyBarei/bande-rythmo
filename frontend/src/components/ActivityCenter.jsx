import React, { useEffect, useState, useMemo } from 'react'
import { Btn, Chip, Dot, Icon, ICONS, ProgressBar, ScreenHeader, T, alpha } from '../ui'
import { useProgress } from '../ProgressContext'
import { useToast } from '../ToastContext'
import { downloadUrl } from '../download'
import { primaryRowKey } from '../utils/primaryRow'
import { useNow } from '../utils/useNow'

// Activity center — reference screen-misc.jsx Activity · RunRow · DoneRow.
// Running jobs (progress + cancel), failures (retry), finished jobs of the
// session followed by the persisted export history (re-download anytime).

const KIND_ICON = {
  'export-mp4': ICONS.film, 'mp4': ICONS.film, 'mp4-dubbed': ICONS.film, 'export-gif': ICONS.gif, 'gif': ICONS.gif,
  'export-dubpack': ICONS.mic, 'dubpack': ICONS.mic,
  'transcribe': ICONS.mic, 'import-batch': ICONS.upload, 'proxy': ICONS.film,
  'vocals': ICONS.audio, 'export': ICONS.download, 'plex-remux': ICONS.film,
}
const iconFor = kind => KIND_ICON[kind] || ICONS.activity

const FORMAT_LABEL = {
  'mp4': 'MP4 + BR', 'mp4-dubbed': 'MP4 doublé', 'gif': 'GIF', 'dubpack': 'Dubpack', 'srt': 'SRT', 'ass': 'ASS',
  'detx': 'DetX', 'croisille': 'Croisillé', 'mp3': 'MP3', 'wav': 'WAV',
}
const formatLabel = f => `Export ${FORMAT_LABEL[f] || (f || '').toUpperCase()}`

function fmtEta(s) {
  if (s == null || !isFinite(s)) return ''
  if (s < 60) return `${Math.round(s)}s`
  return `${Math.floor(s / 60)}min ${String(Math.round(s % 60)).padStart(2, '0')}s`
}
function fmtBytes(n) {
  if (!n) return ''
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}
function fmtWhen(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso), now = new Date()
    const same = d.toDateString() === now.toDateString()
    return same
      ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

const DONE_CAP = 10

const exportTime = e => Date.parse(e.created_at) || 0

// A session export job is already listed by its file row — that row competes
// for the primary button, not the job. Cancelled jobs never do.
const competesForPrimary = r => r.type === 'export' || (r.j.status === 'done' && !String(r.j.kind || '').startsWith('export'))

export default function ActivityCenter({ onOpenClip }) {
  const { jobs, history, forget, cancelByKey, dismiss, retry } = useProgress()
  const [exports, setExports] = useState([])
  const [clips, setClips] = useState({})
  const [showAll, setShowAll] = useState(false)
  const now = useNow()

  useEffect(() => {
    let live = true
    const load = () => fetch('/api/export/list')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (live) setExports(d || []) })
      .catch(e => console.warn('Historique des exports indisponible', e))
    load()
    const t = setInterval(load, 5000)
    return () => { live = false; clearInterval(t) }
  }, [])

  useEffect(() => {
    let live = true
    fetch('/api/clips/')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (live) setClips(Object.fromEntries((d || []).map(c => [c.clip_id, c]))) })
      .catch(e => console.warn('Noms des clips indisponibles', e))
    return () => { live = false }
  }, [])

  const running = useMemo(() => jobs.filter(j => j.status === 'running'), [jobs])
  const failed = useMemo(() => jobs.filter(j => j.status === 'error'), [jobs])
  const finished = history

  // Newest first: this session's finished jobs, then the persisted export history.
  const doneRows = useMemo(() => {
    const sorted = [...exports].sort((a, b) => exportTime(b) - exportTime(a) || (b.id ?? 0) - (a.id ?? 0))
    return [
      ...finished.map(j => ({ type: 'job', key: j.key, j, at: j.finishedAt })),
      ...sorted.map(e => ({ type: 'export', key: `export-${e.id}`, e, at: e.created_at })),
    ]
  }, [finished, exports])

  // FIXES_R4 §12: one primary row at most — the newest, if it finished < 10 min ago.
  const primaryKey = primaryRowKey(doneRows.filter(competesForPrimary), now)

  const doneCount = doneRows.length
  const hiddenCount = Math.max(0, doneCount - DONE_CAP)
  const visibleDone = showAll ? doneRows : doneRows.slice(0, DONE_CAP)
  const empty = !running.length && !failed.length && !doneCount

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ScreenHeader kicker="SYSTÈME" title="Activité"
        right={<div style={{ display: 'flex', gap: 8 }}>
          <Chip soft color={T.accent}><Dot color={T.accent} size={7} pulse={running.length > 0} /> {running.length} en cours</Chip>
          {failed.length > 0 && <Chip soft color={T.danger}>{failed.length} échec{failed.length > 1 ? 's' : ''}</Chip>}
          <Chip soft color={T.text3}>{doneCount} terminé{doneCount > 1 ? 's' : ''}</Chip>
        </div>} />
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 32px 28px' }}>
        {empty && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: T.text3 }}>
            <Icon d={ICONS.activity} size={40} stroke={T.text4} />
            <div style={{ fontSize: T.fs.base, color: T.text2 }}>Aucune activité</div>
            <div style={{ fontSize: T.fs.xs }}>Les transcriptions, exports et traitements apparaîtront ici.</div>
          </div>
        )}

        {running.length > 0 && <>
          <GroupLabel color={T.accent}>EN COURS · {running.length}</GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {running.map(j => <RunRow key={j.key} j={j} clip={j.clip || clips[j.clipId]?.name} onCancel={() => cancelByKey(j.key)} />)}
          </div>
        </>}

        {failed.length > 0 && <>
          <GroupLabel color={T.danger}>ÉCHECS · {failed.length}</GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {failed.map(j => <FailRow key={j.key} j={j} clip={j.clip || clips[j.clipId]?.name} onRetry={() => retry(j.key)} onDismiss={() => dismiss(j.key)} />)}
          </div>
        </>}

        {doneCount > 0 && <>
          <GroupLabel color={T.success}>TERMINÉ · {doneCount}</GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleDone.map(r => r.type === 'job'
              ? <JobDoneRow key={r.key} j={r.j} clip={clips[r.j.clipId]} primary={r.key === primaryKey} onOpenClip={onOpenClip} onDismiss={() => forget(r.j.key)} />
              : <ExportRow key={r.key} e={r.e} clip={clips[r.e.clip_id]?.name} primary={r.key === primaryKey} />)}
          </div>
          {hiddenCount > 0 && (
            <div style={{ marginTop: 10 }}>
              <Btn size="sm" variant="ghost" onClick={() => setShowAll(v => !v)}>
                {showAll ? 'Afficher moins' : `Voir les ${hiddenCount} plus anciens`}
              </Btn>
            </div>
          )}
        </>}
      </div>
    </div>
  )
}

function GroupLabel({ children, color }) {
  return <div style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.2, color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 9 }}>{children}<div style={{ flex: 1, height: 1, background: T.border }} /></div>
}

function RunRow({ j, clip, onCancel }) {
  const pct = Math.round((j.pct || 0) * 100)
  const eta = fmtEta(j.eta)
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 9, background: alpha(T.accent, '14'), border: `1px solid ${alpha(T.accent, '33')}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={iconFor(j.kind)} size={18} stroke={T.accent} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span style={{ fontSize: T.fs.base, fontWeight: 600, whiteSpace: 'nowrap' }}>{j.title}</span>{clip && <span style={{ fontSize: T.fs.xs, color: T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clip}</span>}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}><ProgressBar pct={pct} /><span style={{ fontSize: 11, color: T.text2, fontFamily: T.fontMono, minWidth: 100, whiteSpace: 'nowrap' }}>{j.stage || '…'}</span></div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 60 }}><div style={{ fontSize: T.fs.md, fontWeight: 700, fontFamily: T.fontMono, color: T.accent }}>{pct}%</div>{eta && <div style={{ fontSize: 10, color: T.text3, fontFamily: T.fontMono }}>~{eta}</div>}</div>
      <Btn size="sm" variant="outline" onClick={onCancel}>Annuler</Btn>
    </div>
  )
}

function FailRow({ j, clip, onRetry, onDismiss }) {
  return (
    <div style={{ background: 'rgba(232,89,93,.05)', border: `1px solid ${alpha(T.danger, '44')}`, borderRadius: T.r.ctl, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 9, background: alpha(T.danger, '14'), border: `1px solid ${alpha(T.danger, '44')}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={iconFor(j.kind)} size={17} stroke={T.danger} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span style={{ fontSize: T.fs.sm, fontWeight: 600, whiteSpace: 'nowrap' }}>{j.title}</span>{clip && <span style={{ fontSize: T.fs.xs, color: T.text3 }}>{clip}</span>}</div>
        <div style={{ fontSize: T.fs.xs, color: T.danger, fontFamily: T.fontMono, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.error || 'Erreur'}</div>
      </div>
      {j.retry && <Btn size="sm" variant="primary" icon={ICONS.loop} onClick={onRetry}>Réessayer</Btn>}
      <Btn size="sm" variant="outline" icon={ICONS.close} onClick={onDismiss} title="Retirer" />
    </div>
  )
}

function DoneRow({ title, clip, file, when, cancelled, action }) {
  const c = cancelled ? T.text3 : T.success
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: alpha(c, '14'), border: `1px solid ${alpha(c, '33')}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={cancelled ? ICONS.close : ICONS.check} size={17} stroke={c} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span style={{ fontSize: T.fs.sm, fontWeight: 600, whiteSpace: 'nowrap' }}>{title}</span>{clip && <span style={{ fontSize: T.fs.xs, color: T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clip}</span>}</div>
        <div style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file}</div>
      </div>
      {when && <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono }}>{when}</span>}
      {action}
    </div>
  )
}

// Session job without a file: open its clip when known (DoneRow action 'open'), else dismiss.
function JobDoneRow({ j, clip, primary, onOpenClip, onDismiss }) {
  const cancelled = j.status === 'cancelled'
  const canOpen = !cancelled && clip && onOpenClip
  return (
    <DoneRow title={j.title} clip={clip?.name} cancelled={cancelled}
      file={cancelled ? 'Annulé' : (j.stage || 'Terminé')}
      action={canOpen
        ? <Btn size="sm" variant={primary ? 'primary' : 'outline'} icon={ICONS.edit} onClick={() => onOpenClip(clip)}>Ouvrir le clip</Btn>
        : <Btn size="sm" variant="outline" icon={ICONS.close} onClick={onDismiss}>Retirer</Btn>} />
  )
}

function ExportRow({ e, clip, primary }) {
  const toast = useToast()
  async function dl() {
    try {
      await downloadUrl(`/api/export/download/${e.id}`, e.filename)
    } catch (err) {
      toast.error('Téléchargement impossible : ' + err.message)
    }
  }
  const size = fmtBytes(e.size_bytes)
  return (
    <DoneRow title={formatLabel(e.format)} clip={clip}
      file={[e.filename, size, e.quality].filter(Boolean).join(' · ')}
      when={fmtWhen(e.created_at)}
      action={<Btn size="sm" variant={primary ? 'primary' : 'outline'} icon={ICONS.download} onClick={dl}>Télécharger</Btn>} />
  )
}
