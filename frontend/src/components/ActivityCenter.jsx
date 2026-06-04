import React, { useEffect, useState, useMemo } from 'react'
import { Icon, ICONS } from '../Icons'
import { useProgress } from '../ProgressContext'

// Activity center (redesign screen-misc Activity) — one place for all jobs:
// running (progress + cancel), failed (retry), done (dismiss). Plus the
// persisted export history (re-download anytime).

const KIND_ICON = {
  'export-mp4': ICONS.film, 'mp4': ICONS.film, 'export-gif': ICONS.gif, 'gif': ICONS.gif,
  'transcribe': ICONS.mic, 'import-batch': ICONS.upload, 'proxy': ICONS.film,
  'vocals': ICONS.audio, 'export': ICONS.download,
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
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 9, textTransform: 'uppercase' }}>
      {children}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function Tile({ color, icon, children }) {
  return (
    <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 9, background: color + '14', border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon d={icon} size={18} stroke={color} />
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

  const empty = !running.length && !failed.length && !finished.length && !exports.length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '20px 32px 14px', display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>SYSTÈME</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.4, color: 'var(--text)', marginTop: 2 }}>Activité</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <StatChip color="var(--accent)" pulse={running.length > 0}>{running.length} en cours</StatChip>
          {failed.length > 0 && <StatChip color="var(--danger)">{failed.length} échec{failed.length > 1 ? 's' : ''}</StatChip>}
          <StatChip color="var(--text3)">{finished.length + exports.length} terminés</StatChip>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 32px 32px' }}>
        {empty && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: 'var(--text3)' }}>
            <Icon d={ICONS.activity} size={40} stroke="var(--text4)" />
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>Aucune activité</div>
            <div style={{ fontSize: 12 }}>Les transcriptions, exports et traitements apparaîtront ici.</div>
          </div>
        )}

        {running.length > 0 && (
          <>
            <GroupLabel color="var(--accent)">En cours · {running.length}</GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {running.map(j => <RunRow key={j.key} j={j} onCancel={() => cancelByKey(j.key)} />)}
            </div>
          </>
        )}

        {failed.length > 0 && (
          <>
            <GroupLabel color="var(--danger)">Échecs · {failed.length}</GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {failed.map(j => <FailRow key={j.key} j={j} onRetry={() => retry(j.key)} onDismiss={() => dismiss(j.key)} />)}
            </div>
          </>
        )}

        {finished.length > 0 && (
          <>
            <GroupLabel color="var(--success)">Terminé · {finished.length}</GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {finished.map(j => <DoneJobRow key={j.key} j={j} onDismiss={() => dismiss(j.key)} />)}
            </div>
          </>
        )}

        {exports.length > 0 && (
          <>
            <GroupLabel color="var(--text3)">Exports · {exports.length}</GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {exports.map(e => <ExportRow key={e.id} e={e} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatChip({ children, color, pulse }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: color === 'var(--text3)' ? 'var(--surface2)' : color.replace(')', '-soft)').replace('var(--', 'var(--'), fontSize: 11.5, fontWeight: 600, color, border: `1px solid ${color === 'var(--text3)' ? 'var(--border)' : 'transparent'}` }}>
      <span style={{ position: 'relative', width: 7, height: 7 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
        {pulse && <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${color}`, opacity: 0.4 }} />}
      </span>
      {children}
    </span>
  )
}

const rowBase = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9,
  padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14,
}
const actBtn = (variant) => ({
  height: 30, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
  background: variant === 'primary' ? 'var(--accent)' : 'transparent',
  color: variant === 'primary' ? '#000' : 'var(--text2)',
  border: variant === 'primary' ? 'none' : '1px solid var(--border2)',
})

function RunRow({ j, onCancel }) {
  const pct = Math.round((j.pct || 0) * 100)
  return (
    <div style={rowBase}>
      <Tile color="var(--accent)" icon={iconFor(j.kind)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, height: 5, background: 'var(--surface3)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 5, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)', minWidth: 90, whiteSpace: 'nowrap' }}>{j.stage || '…'}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 56 }}>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{pct}%</div>
        {j.eta != null && <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>~{fmtEta(j.eta)}</div>}
      </div>
      <button onClick={onCancel} style={actBtn('outline')}>Annuler</button>
    </div>
  )
}

function FailRow({ j, onRetry, onDismiss }) {
  return (
    <div style={{ ...rowBase, background: 'rgba(232,93,93,0.05)', borderColor: 'rgba(232,93,93,0.27)' }}>
      <Tile color="var(--danger)" icon={iconFor(j.kind)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{j.title}</div>
        <div style={{ fontSize: 12, color: 'var(--danger)', fontFamily: 'var(--font-mono)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.error || 'Erreur'}</div>
      </div>
      {j.retry && <button onClick={onRetry} style={actBtn('primary')}><Icon d={ICONS.loop2} size={13} stroke="#000" /> Réessayer</button>}
      <button onClick={onDismiss} title="Fermer" style={{ ...actBtn('outline'), width: 30, padding: 0 }}>✕</button>
    </div>
  )
}

function DoneJobRow({ j, onDismiss }) {
  const cancelled = j.status === 'cancelled'
  const color = cancelled ? 'var(--text3)' : 'var(--success)'
  return (
    <div style={{ ...rowBase, padding: '11px 16px' }}>
      <Tile color={color} icon={cancelled ? ICONS.close : ICONS.check} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{j.title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{cancelled ? 'Annulé' : (j.stage || 'Terminé')}</div>
      </div>
      <button onClick={onDismiss} title="Retirer" style={{ ...actBtn('outline'), width: 30, padding: 0 }}>✕</button>
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
      <Tile color="var(--success)" icon={iconFor(e.format)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{(e.format || '').toUpperCase()}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{e.filename}</span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          {[e.quality, fmtBytes(e.size_bytes), fmtWhen(e.created_at)].filter(Boolean).join(' · ')}
        </div>
      </div>
      <button onClick={dl} style={actBtn('primary')}><Icon d={ICONS.download} size={13} stroke="#000" /> Télécharger</button>
    </div>
  )
}
