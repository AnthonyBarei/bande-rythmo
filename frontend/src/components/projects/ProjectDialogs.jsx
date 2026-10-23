import React, { useEffect, useState } from 'react'
import { T, Btn, Input, Select, Spinner, Icon, ICONS } from '../../ui'
import { TRACK_HEXES } from '../../config/tracks'
import { WHISPER_LANGS } from '../../config/languages'
import { useSettings } from '../../SettingsContext'
import { fmtBytes, getProject, listProjects } from '../../utils/projectsApi'
import Dialog, { Field } from './Dialog'

export const PROJECT_COLORS = [...TRACK_HEXES, '#A78BFA', '#F2994A']

export function projectColor(project) {
  return project?.color || T.text4
}

function Swatches({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }} role="radiogroup" aria-label="Couleur">
      {PROJECT_COLORS.map(c => (
        <button key={c} type="button" data-rd role="radio" aria-checked={value === c} title={c} onClick={() => onChange(c)}
          style={{
            width: 26, height: 26, borderRadius: 8, background: c, cursor: 'pointer',
            border: `2px solid ${value === c ? T.text : 'transparent'}`, boxShadow: value === c ? `0 0 0 2px ${T.surface} inset` : 'none',
          }} />
      ))}
    </div>
  )
}

// New project + edit (name, language, colour). `project` = edit mode.
export function ProjectFormDialog({ project, onClose, onSave }) {
  const { settings } = useSettings()
  const [name, setName] = useState(project?.name || '')
  const [language, setLanguage] = useState(project?.language || settings.whisperLang || 'fr')
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    if (!name.trim()) { setError('Donne un nom au projet.'); return }
    setBusy(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), language, color })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Dialog title={project ? 'Modifier le projet' : 'Nouveau projet'}
      sub={project ? null : 'Un projet regroupe tes vidéos, les clips découpés, la bande rythmo et les prises. Tout est enregistré au fur et à mesure.'}
      onClose={onClose} onSubmit={submit}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" onClick={submit} disabled={busy}>{busy ? <Spinner color="#0b0b0d" /> : null}{project ? 'Enregistrer' : 'Créer le projet'}</Btn>
      </>}>
      <Field label="Nom">
        <Input size="form-sm" value={name} onChange={e => { setName(e.target.value); setError(null) }}
          placeholder="ex. Tears of Steel — VF" maxLength={120} error={error} aria-label="Nom du projet" />
      </Field>
      <Field label="Langue de transcription" hint="Langue par défaut de Whisper pour les clips du projet.">
        <Select width={220} value={language} onChange={setLanguage} options={WHISPER_LANGS} />
      </Field>
      <Field label="Couleur">
        <Swatches value={color} onChange={setColor} />
      </Field>
    </Dialog>
  )
}

// Q2 — typed-name confirmation, disk space shown, sources never touched.
export function DeleteProjectDialog({ project, onClose, onDelete }) {
  const [typed, setTyped] = useState('')
  const [bytes, setBytes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const match = typed.trim() === project.name

  useEffect(() => {
    let live = true
    getProject(project.id)
      .then(d => { if (live) setBytes(d.disk_bytes) })
      .catch(e => { console.error(e); if (live) setBytes(-1) })
    return () => { live = false }
  }, [project.id])

  async function submit() {
    if (!match || busy) return
    setBusy(true)
    try {
      await onDelete(typed.trim())
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const c = project.counts || {}
  return (
    <Dialog title={`Supprimer « ${project.name} » ?`} onClose={onClose} onSubmit={submit} width={460}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
        <Btn variant="solid" danger onClick={submit} disabled={!match || busy}
          title={match ? undefined : 'Tape le nom du projet pour confirmer'}>Supprimer définitivement</Btn>
      </>}>
      <div style={{ fontSize: T.fs.sm, color: T.text2, lineHeight: 1.6 }}>
        Supprime {c.clips || 0} clip{c.clips > 1 ? 's' : ''}, leurs répliques, prises, exports, proxys et pistes séparées
        {bytes == null ? <> — <Spinner /> calcul de l’espace…</> : bytes >= 0 ? <> — <b style={{ color: T.text }}>{fmtBytes(bytes)}</b> libérés.</> : '.'}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: T.fs.xs, color: T.text3, lineHeight: 1.5 }}>
        <Icon d={ICONS.check} size={14} stroke={T.success} style={{ flexShrink: 0, marginTop: 1 }} />
        Tes vidéos d’origine ne sont jamais touchées. Pour simplement ranger le projet, archive-le plutôt.
      </div>
      <Field label={<>Tape <span style={{ fontFamily: T.fontMono, color: T.text }}>{project.name}</span> pour confirmer</>}>
        <Input size="form-sm" value={typed} onChange={e => { setTyped(e.target.value); setError(null) }}
          error={error} aria-label="Nom du projet à supprimer" autoComplete="off" />
      </Field>
    </Dialog>
  )
}

// Clips › Déplacer vers… — another active project, or a new one.
export function MoveClipDialog({ clip, currentProjectId, onClose, onMove, onCreateAndMove }) {
  const [projects, setProjects] = useState(null)
  const [target, setTarget] = useState(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    listProjects()
      .then(list => {
        if (!live) return
        const others = list.filter(p => p.id !== currentProjectId)
        setProjects(others)
        setTarget(others[0]?.id || '__new')
      })
      .catch(e => { console.error(e); if (live) setError(e.message) })
    return () => { live = false }
  }, [currentProjectId])

  async function submit() {
    if (busy || !target) return
    if (target === '__new' && !newName.trim()) { setError('Donne un nom au nouveau projet.'); return }
    setBusy(true)
    try {
      if (target === '__new') await onCreateAndMove(newName.trim())
      else await onMove(target, projects.find(p => p.id === target)?.name || '')
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const options = [
    ...(projects || []).map(p => ({ v: p.id, l: p.name, dot: projectColor(p) })),
    { v: '__new', l: 'Nouveau projet…', icon: ICONS.plus },
  ]
  return (
    <Dialog title="Déplacer vers un autre projet" sub={`« ${clip.name} » emporte ses répliques, prises et exports.`}
      onClose={onClose} onSubmit={submit}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" onClick={submit} disabled={busy || projects == null}>Déplacer</Btn>
      </>}>
      {projects == null && !error ? <Spinner /> : (
        <Field label="Projet">
          <Select width={398} value={target} onChange={v => { setTarget(v); setError(null) }} options={options} menuWidth={360} />
        </Field>
      )}
      {target === '__new' && (
        <Field label="Nom du nouveau projet">
          <Input size="form-sm" value={newName} onChange={e => { setNewName(e.target.value); setError(null) }} maxLength={120} />
        </Field>
      )}
      {error && <div role="alert" style={{ fontSize: 12, color: T.danger }}>{error}</div>}
    </Dialog>
  )
}
