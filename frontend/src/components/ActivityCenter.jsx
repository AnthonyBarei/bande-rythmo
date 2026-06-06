import React, { useEffect, useState, useMemo } from 'react'
import { Icon, ICONS } from '../Icons'
import { Btn, Chip, Dot, ProgressBar, ScreenHeader } from '../ui'
import { useProgress } from '../ProgressContext'

// Activity center (redesign screen-misc Activity) — one place for all jobs:
// running (progress + cancel), failed (retry), done (dismiss). Plus the
// persisted export history (re-download anytime).

const KIND_ICON = {
  'export-mp4': ICONS.film, 'mp4': ICONS.film, 'export-gif': ICONS.gif, 'gif': ICONS.gif,
  'transcribe': ICONS.mic, 'import-batch': ICONS.upload, 'proxy': ICONS.film,
  'vocals': ICONS.audio, 'export': ICONS.download, 'plex-remux': ICONS.film,
}
const iconFor = kind => KIND_ICON[kind] || ICONS.activity

function fmtEta(s) {
  if (s == null || !isFinite(s)) return ''
  if (s < 60) return `${Math.round(s)}s`
  return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}`
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

function GroupLabel({ children, color }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
      {children}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function Tile({ color, icon, size = 38, r = 9 }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0, borderRadius: r, background: color + '14', border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon d={icon} size={Math.round(size * 0.47)} stroke={color} />
    </div>
  )
}

export default function ActivityCenter() {
  const { jobs, cancelByKey, dismiss, retry } = useProgress()
  const [exports, setExports] = useState([])

  useEffect(() => {
    let live = true
    const load = () => fetch('/api/export/list').then(r => r.ok ? r.json() : []).then(d => { if (live) setExports(d || []) }).catch(() => {})
    load()
    const t = setInterval(load, 5000)
    return () => { live = false; clearInterval(t) }
  }, [])

  const running = useMemo(() => jobs.filter(j => j.status === 'running'), [jobs])
  const failed = useMemo(() => jobs.filter(j => j.status === 'error'), [jobs])
  const finished = useMemo(() => jobs.filter(j => j.status === 'done' || j.status === 'cancelled'), [jobs])

  const doneCount = finished.length + exports.length
  const empty = !running.length && !failed.length && !doneCount

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      <ScreenHeader
        kicker="SYSTÈME"
        title="Activité"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip soft color="var(--accent)"><Dot color="var(--accent)" size={7} pulse={running.length > 0} /> {running.length} en cours</Chip>
            {failed.length > 0 && <Chip soft color="var(--danger)">{failed.length} échec{failed.length > 1 ? 's' : ''}</Chip>}
            <Chip soft color="var(--text3)">{doneCount} terminé{doneCount > 1 ? 's' : ''}</Chip>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 32px 32px' }}>
        {empty && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: 'var(--text3)' }}>
            <Icon d={ICONS.activity} size={40} stroke="var(--text4)" />
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>Aucune activité</div>
            <div style={{ fontSize: 12 }}>Les transcriptions, exports et traitements apparaîtront ici.</div>
          </div>
        )}

        {running.length > 0 && (
          <>
            <GroupLabel color="var(--accent)">EN COURS · {running.length}</GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {running.map(j => <RunRow key={j.key} j={j} onCancel={() => cancelByKey(j.key)} />)}
            </div>
          </>
        )}

        {failed.length > 0 && (
          <>
            <GroupLabel color="var(--danger)">ÉCHECS · {failed.length}</GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {failed.map(j => <FailRow key={j.key} j={j} onRetry={() => retry(j.key)} onDismiss={() => dismiss(j.key)} />)}
            </div>
          </>
        )}

        {finished.length > 0 && (
          <>
            <GroupLabel color="var(--success)">TERMINÉ · {finished.length}</GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {finished.map(j => <DoneJobRow key={j.key} j={j} onDismiss={() => dismiss(j.key)} />)}
            </div>
          </>
        )}

        {exports.length > 0 && (
          <>
            <GroupLabel color="var(--text3)">EXPORTS · {exports.length}</GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {exports.map(e => <ExportRow key={e.id} e={e} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const rowBase = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9,
  padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14,
}

function RunRow({ j, onCancel }) {
  const pct = Math.round((j.pct || 0) * 100)
  return (
    <div style={rowBase}>
      <Tile color="var(--accent)" icon={iconFor(j.kind)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{j.title}</span>
          {j.clip && <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.clip}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <ProgressBar pct={pct} />
          <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)', minWidth: 90, whiteSpace: 'nowrap' }}>{j.stage || '…'}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 56 }}>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{pct}%</div>
        {j.eta != null && <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>~{fmtEta(j.eta)}</div>}
      </div>
      <Btn size="sm" variant="outline" onClick={onCancel}>Annuler</Btn>
    </div>
  )
}

function FailRow({ j, onRetry, onDismiss }) {
  return (
    <div style={{ ...rowBase, background: 'rgba(232,89,93,0.05)', borderColor: 'rgba(232,89,93,0.27)' }}>
      <Tile color="var(--danger)" icon={iconFor(j.kind)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{j.title}</div>
        <div style={{ fontSize: 12, color: 'var(--danger)', fontFamily: 'var(--font-mono)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.error || 'Erreur'}</div>
      </div>
      {j.retry && <Btn size="sm" variant="primary" icon={ICONS.loop2} onClick={onRetry}>Réessayer</Btn>}
      <Btn size="sm" variant="outline" icon={ICONS.close} onClick={onDismiss} title="Fermer" />
    </div>
  )
}

function DoneJobRow({ j, onDismiss }) {
  const cancelled = j.status === 'cancelled'
  const color = cancelled ? 'var(--text3)' : 'var(--success)'
  return (
    <div style={{ ...rowBase, padding: '11px 16px' }}>
      <Tile color={color} icon={cancelled ? ICONS.close : ICONS.check} size={34} r={8} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{j.title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{cancelled ? 'Annulé' : (j.stage || 'Terminé')}</div>
      </div>
      <Btn size="sm" variant="outline" icon={ICONS.close} onClick={onDismiss} title="Retirer" />
    </div>
  )
}

function ExportRow({ e }) {
  function dl() {
    const a = document.createElement('a')
    a.href = `/api/export/download/${e.id}`
    a.download = e.filename || 'export'
    a.click()
  }
  return (
    <div style={{ ...rowBase, padding: '11px 16px' }}>
      <Tile color="var(--success)" icon={iconFor(e.format)} size={34} r={8} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{(e.format || '').toUpperCase()}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{e.filename}</span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          {[e.quality, fmtBytes(e.size_bytes), fmtWhen(e.created_at)].filter(Boolean).join(' · ')}
        </div>
      </div>
      <Btn size="sm" variant="primary" icon={ICONS.download} onClick={dl}>Télécharger</Btn>
    </div>
  )
}
