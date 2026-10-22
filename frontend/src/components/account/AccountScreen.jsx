import React, { useCallback, useEffect, useState } from 'react'
import { T, Icon, ICONS, Btn, Chip, Dot, Avatar, Input, ScreenHeader } from '../../ui'
import { useAuth } from '../../AuthContext'
import { useSettings } from '../../SettingsContext'
import { useToast } from '../../ToastContext'
import { downloadUrl } from '../../download'
import { relTime } from '../../utils/relTime'

// Mon compte — port of design/design_handoff_redesign_v2/reference/redesign/screen-account.jsx Account.

// Track colours + violet + orange: the reference repeated NOAH green (#5EC27C) twice.
const COLORS = ['#F5C518', '#5AA9F0', '#F06AA0', '#5EC27C', '#A98BF0', '#FF8C42']
const OK = T.success

function Section({ title, desc, children, danger }) {
  return (
    <div style={{ marginBottom: 30, maxWidth: 720 }}>
      <div style={{ fontSize: T.fs.md, fontWeight: 600, marginBottom: 3, color: danger ? T.danger : T.text }}>{title}</div>
      {desc && <div style={{ fontSize: T.fs.xs, color: T.text3, marginBottom: 12 }}>{desc}</div>}
      {children}
    </div>
  )
}

// top: the right column is taller than one control — the label sits at the top.
function Field({ label, sub, top, children }) {
  return (
    <div style={{ display: 'flex', alignItems: top ? 'flex-start' : 'center', gap: 16, padding: '13px 0', borderBottom: `1px solid ${T.surface2}` }}>
      <div style={{ width: 200, flexShrink: 0, paddingTop: top ? 6 : 0 }}>
        <div style={{ fontSize: T.fs.sm, color: T.text2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: T.text3, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export default function AccountScreen({ onLogin, onSignedOut }) {
  const auth = useAuth()
  const { user } = auth

  if (!user) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ScreenHeader kicker="COMPTE" title="Mon compte" />
        <div style={{ padding: '6px 32px', maxWidth: 560 }}>
          <div style={{ padding: 24, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: T.fs.md, fontWeight: 600 }}>Vous travaillez sans compte</div>
            <div style={{ fontSize: T.fs.sm, color: T.text3, lineHeight: 1.5 }}>Tout fonctionne en local. Un compte retient votre nom de comédien et vos préférences dans cet atelier.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="primary" onClick={() => onLogin('register')}>Créer un compte</Btn>
              <Btn variant="outline" onClick={() => onLogin('login')}>Se connecter</Btn>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return <SignedIn key={user.id} user={user} onSignedOut={onSignedOut} />
}

function SignedIn({ user, onSignedOut }) {
  const auth = useAuth()
  const toast = useToast()
  const { settings } = useSettings()
  const accent = settings.accent

  async function logout() {
    try {
      await auth.logout()
    } catch (e) {
      console.error(e)
      toast.error(e.message)
    }
    onSignedOut()
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ maxWidth: 784 }}>
        <ScreenHeader kicker="COMPTE" title="Mon compte" sub={user.email}
          right={<Btn variant="outline" icon={ICONS.logout} onClick={logout}>Se déconnecter</Btn>} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 32px 40px' }}>
        <ProfileSection user={user} accent={accent} />
        <Section title="Sécurité">
          <PasswordField user={user} />
          <SessionsField />
        </Section>
        <Section title="Données" desc="Les vidéos restent sur cette machine et ne sont jamais envoyées.">
          <Field label="Exporter mes données" sub="Projets, répliques, prises (JSON)">
            <Btn size="sm" variant="outline" icon={ICONS.download} onClick={async () => {
              try {
                await downloadUrl('/api/auth/me/export', 'bande-rythmo.json')
              } catch (e) {
                console.error(e)
                toast.error(`Archive non téléchargée : ${e.message}`)
              }
            }}>Télécharger l'archive</Btn>
          </Field>
        </Section>
        <DeleteSection user={user} onDeleted={onSignedOut} />
      </div>
    </div>
  )
}

function ProfileSection({ user, accent }) {
  const auth = useAuth()
  const fromUser = useCallback(() => ({ name: user.name, comedien: user.comedien || '', color: user.color || accent }), [user, accent])
  const [draft, setDraft] = useState(fromUser)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = k => e => { setDraft(d => ({ ...d, [k]: e.target.value })); setSaved(false); setError(null) }
  const base = fromUser()
  const dirty = ['name', 'comedien', 'color'].some(k => (draft[k] || '') !== (base[k] || ''))
  const nameErr = !draft.name.trim() ? 'Indiquez un nom affiché.' : null

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2200)
    return () => clearTimeout(t)
  }, [saved])

  async function save() {
    if (nameErr || busy) return
    setBusy(true)
    try {
      const u = await auth.updateProfile({ name: draft.name.trim(), comedien: draft.comedien.trim(), color: draft.color })
      setDraft({ name: u.name, comedien: u.comedien || '', color: u.color || accent })
      setSaved(true)
    } catch (e) {
      setError(e.fields ? Object.values(e.fields).find(Boolean) : e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Profil" desc="Visible sur vos prises et dans le Studio.">
      <Field label="Avatar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={draft.name || '?'} color={draft.color} size={52} ring />
          <div role="radiogroup" aria-label="Couleur de l'avatar" style={{ display: 'flex', gap: 8 }}>
            {COLORS.map(c => {
              const on = draft.color.toLowerCase() === c.toLowerCase()
              return (
                <button key={c} type="button" role="radio" aria-checked={on} aria-label={c} title={c}
                  onClick={() => { setDraft(d => ({ ...d, color: c })); setSaved(false) }}
                  style={{ width: 26, height: 26, borderRadius: 7, background: c, cursor: 'pointer', border: on ? `2px solid ${T.text}` : '1px solid transparent', boxShadow: on ? `0 0 0 2px ${c}55` : 'none' }} />
              )
            })}
          </div>
        </div>
      </Field>
      <Field label="Nom affiché">
        <Input size="form-sm" value={draft.name} onChange={set('name')} placeholder="Camille R." aria-label="Nom affiché"
          error={dirty ? nameErr : null} style={{ maxWidth: 320 }} />
      </Field>
      <Field label="Nom de comédien" sub="Prérempli dans le Studio">
        <Input size="form-sm" value={draft.comedien} onChange={set('comedien')} placeholder="Même que le nom affiché" aria-label="Nom de comédien"
          style={{ maxWidth: 320 }} />
      </Field>
      <EmailField user={user} />
      {/* Hidden until something changed; « Profil enregistré » stays as the confirmation. */}
      {(dirty || saved) && (
        <div className="slide-in" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14 }}>
          {dirty && <>
            <Btn variant="primary" onClick={save} disabled={!!nameErr || busy}>{busy ? 'Un instant…' : 'Enregistrer'}</Btn>
            <Btn variant="ghost" onClick={() => { setDraft(fromUser()); setError(null) }}>Annuler</Btn>
          </>}
          {saved && !dirty && <span role="status" style={{ fontSize: T.fs.xs, color: OK, display: 'flex', alignItems: 'center', gap: 6 }}><Icon d={ICONS.check} size={12} stroke={OK} />Profil enregistré</span>}
          {error && <span role="alert" style={{ fontSize: T.fs.xs, color: T.danger }}>{error}</span>}
        </div>
      )}
    </Section>
  )
}

function EmailField({ user }) {
  const auth = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ email: '', pw: '' })
  const [errs, setErrs] = useState({})
  const [busy, setBusy] = useState(false)
  const close = () => { setOpen(false); setF({ email: '', pw: '' }); setErrs({}) }

  async function submit() {
    setBusy(true)
    try {
      await auth.changeEmail(f.email, f.pw)
      close()
      toast.success(auth.emailEnabled ? 'Adresse modifiée. Un lien de confirmation vient d’être envoyé.' : 'Adresse modifiée.')
    } catch (e) {
      setErrs(e.fields || { form: e.message })
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    try {
      await auth.resendVerification()
      toast.success(`Lien de confirmation envoyé à ${user.email}.`)
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <Field label="E-mail" top={open}>
      {!open ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: T.fs.sm, color: T.text }}>{user.email}</span>
          {user.email_verified
            ? <Chip soft color={OK}><Icon d={ICONS.check} size={10} stroke={OK} /> vérifié</Chip>
            : auth.emailEnabled && <Chip soft color={T.text3}>non vérifié</Chip>}
          {!user.email_verified && auth.emailEnabled && <Btn size="sm" variant="ghost" onClick={resend}>Renvoyer le lien</Btn>}
          <Btn size="sm" variant="ghost" onClick={() => setOpen(true)}>Modifier</Btn>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
          <Input size="form-sm" type="email" value={f.email} onChange={e => setF(s => ({ ...s, email: e.target.value }))} placeholder="Nouvelle adresse"
            aria-label="Nouvelle adresse e-mail" autoComplete="email" error={errs.email || null} autoFocus />
          <Input size="form-sm" type="password" value={f.pw} onChange={e => setF(s => ({ ...s, pw: e.target.value }))} placeholder="Mot de passe actuel"
            aria-label="Mot de passe actuel" autoComplete="current-password" error={errs.pw || null} />
          {errs.form && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{errs.form}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="primary" onClick={submit} disabled={busy || !f.email || !f.pw}>Changer l'adresse</Btn>
            <Btn size="sm" variant="ghost" onClick={close}>Annuler</Btn>
          </div>
        </div>
      )}
    </Field>
  )
}

function PasswordField({ user }) {
  const auth = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState({ cur: '', next: '' })
  const [errs, setErrs] = useState({})
  const [busy, setBusy] = useState(false)
  const close = () => { setOpen(false); setPw({ cur: '', next: '' }); setErrs({}) }

  async function submit() {
    if (!pw.cur || pw.next.length < 8) return
    setBusy(true)
    try {
      await auth.changePassword(pw.cur, pw.next)
      close()
      toast.success('Mot de passe mis à jour. Les autres appareils sont déconnectés.')
    } catch (e) {
      setErrs(e.fields || { form: e.message })
    } finally {
      setBusy(false)
    }
  }

  const changed = user.password_changed_at ? `Modifié ${relTime(user.password_changed_at)}` : null
  return (
    <Field label="Mot de passe" sub={changed} top={open}>
      {!open ? <Btn size="sm" variant="outline" icon={ICONS.lock} onClick={() => setOpen(true)}>Changer le mot de passe</Btn> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
          <Input size="form-sm" type="password" value={pw.cur} onChange={e => setPw(p => ({ ...p, cur: e.target.value }))} placeholder="Mot de passe actuel"
            aria-label="Mot de passe actuel" autoComplete="current-password" error={errs.cur || null} autoFocus />
          <Input size="form-sm" type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} placeholder="Nouveau mot de passe"
            aria-label="Nouveau mot de passe" autoComplete="new-password"
            error={errs.next || null} hint={pw.next && pw.next.length < 8 ? '8 caractères minimum.' : null} />
          {errs.form && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{errs.form}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="primary" onClick={submit} disabled={busy || !pw.cur || pw.next.length < 8}>Mettre à jour</Btn>
            <Btn size="sm" variant="ghost" onClick={close}>Annuler</Btn>
          </div>
        </div>
      )}
    </Field>
  )
}

function SessionsField() {
  const auth = useAuth()
  const toast = useToast()
  const [sessions, setSessions] = useState(null)
  const { listSessions } = auth

  const load = useCallback(() => listSessions()
    .then(setSessions)
    .catch(e => {
      console.error(e)
      setSessions([])
      toast.error(`Appareils non chargés : ${e.message}`)
    }), [listSessions, toast])
  useEffect(() => {
    let live = true
    listSessions()
      .then(list => { if (live) setSessions(list) })
      .catch(e => {
        console.error(e)
        if (live) setSessions([])
      })
    return () => { live = false }
  }, [listSessions])

  async function run(action) {
    try {
      await action()
    } catch (e) {
      toast.error(e.message)
    }
    load()
  }

  const list = sessions || []
  return (
    <Field label="Appareils connectés" top={list.length > 1} sub={sessions ? `${list.length} session${list.length > 1 ? 's' : ''}` : 'Chargement…'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl }}>
            <Dot color={s.current ? OK : T.text4} size={7} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: T.fs.sm, color: T.text }}>{s.device}</div>
              <div style={{ fontSize: 11.5, color: T.text3 }}>{s.current ? 'Active maintenant' : `Active ${relTime(s.last_seen)}`}</div>
            </div>
            {s.current ? <Chip soft color={T.text2}>cet appareil</Chip>
              : <Btn size="sm" variant="ghost" onClick={() => run(() => auth.endSession(s.id))}>Déconnecter</Btn>}
          </div>
        ))}
        {list.length > 1 && <div><Btn size="sm" variant="outline" onClick={() => run(auth.endOtherSessions)}>Déconnecter les autres appareils</Btn></div>}
      </div>
    </Field>
  )
}

function DeleteSection({ user, onDeleted }) {
  const auth = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [txt, setTxt] = useState('')
  const [busy, setBusy] = useState(false)
  const match = txt.trim().toLowerCase() === user.email

  async function remove() {
    if (!match || busy) return
    setBusy(true)
    try {
      await auth.deleteAccount(txt.trim())
      toast.success('Compte supprimé. Les fichiers locaux restent sur cette machine.')
      onDeleted()
    } catch (e) {
      toast.error(e.message || Object.values(e.fields || {}).find(Boolean))
      setBusy(false)
    }
  }

  return (
    <Section title="Zone sensible" danger>
      <Field label="Supprimer le compte" top={open} sub="Le compte et le profil sont supprimés. Les fichiers locaux restent.">
        {!open ? <Btn size="sm" danger icon={ICONS.trash} onClick={() => setOpen(true)}>Supprimer le compte…</Btn> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, padding: 14, border: '1px solid color-mix(in srgb, var(--danger) 33%, transparent)', background: 'color-mix(in srgb, var(--danger) 6%, transparent)', borderRadius: T.r.ctl }}>
            <div style={{ fontSize: T.fs.xs, color: T.text2, lineHeight: 1.5 }}>Tapez <b style={{ color: T.text, fontFamily: T.fontMono }}>{user.email}</b> pour confirmer.</div>
            <Input size="form-sm" value={txt} onChange={e => setTxt(e.target.value)} placeholder={user.email} aria-label="Adresse e-mail du compte" autoFocus />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={!match || busy} onClick={remove} style={{ height: 30, padding: '0 12px', borderRadius: T.r.chip, border: 'none', background: T.danger, color: '#fff', fontWeight: 700, fontSize: T.fs.xs, fontFamily: T.fontUI, cursor: match ? 'pointer' : 'not-allowed', opacity: match ? 1 : 0.4 }}>Supprimer définitivement</button>
              <Btn size="sm" variant="ghost" onClick={() => { setOpen(false); setTxt('') }}>Annuler</Btn>
            </div>
          </div>
        )}
      </Field>
    </Section>
  )
}
