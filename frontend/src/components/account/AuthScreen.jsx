import React, { useState } from 'react'
import { T, Icon, ICONS, Btn, Segmented, Toggle, Input } from '../../ui'
import { useAuth } from '../../AuthContext'
import { useSettings } from '../../SettingsContext'

// Sign in / create account / forgot / reset — full screen, no shell.
// Port of design/design_handoff_redesign_v2/reference/redesign/screen-account.jsx Auth.

const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
const strength = p => !p ? 0 : (p.length >= 8 ? 1 : 0) + (/[A-Z]/.test(p) && /[a-z]/.test(p) ? 1 : 0) + (/[\d\W]/.test(p) ? 1 : 0)
const OK = T.success
const BAND = 'Le doublage, à la cadence du studio.   Ça y est, ça roule ?   Tu veux pas te détendre un peu ?   '

const TITLE = {
  login: 'Bon retour en cabine',
  register: 'Créer votre compte',
  forgot: 'Mot de passe oublié',
  sent: 'Vérifiez votre boîte mail',
  reset: 'Nouveau mot de passe',
}
const SUB = {
  login: 'Connectez-vous pour retrouver votre nom de comédien et vos préférences.',
  register: 'Gratuit. Vos vidéos et vos prises restent sur cette machine.',
  forgot: 'Nous vous envoyons un lien pour choisir un nouveau mot de passe.',
  sent: '',
  reset: 'Choisissez le mot de passe de votre compte. Tous vos appareils seront déconnectés.',
}
const SUBMIT = { login: 'Se connecter', register: 'Créer mon compte', forgot: 'Envoyer le lien', reset: 'Enregistrer le mot de passe' }

function validate(mode, f) {
  const needsEmail = mode !== 'reset'
  const needsPw = mode !== 'forgot'
  return {
    name: mode === 'register' && !f.name.trim() ? 'Indiquez un nom affiché.' : null,
    email: !needsEmail ? null : !f.email ? 'Indiquez votre e-mail.' : !emailOk(f.email) ? 'Cette adresse e-mail n’est pas valide.' : null,
    pw: !needsPw ? null : !f.pw ? 'Indiquez un mot de passe.' : (mode === 'register' || mode === 'reset') && f.pw.length < 8 ? '8 caractères minimum.' : null,
    cgu: mode === 'register' && !f.cgu ? 'Acceptez les conditions pour continuer.' : null,
  }
}

export default function AuthScreen({ initialMode = 'login', resetToken, onDone, onLocal }) {
  const auth = useAuth()
  const { settings } = useSettings()
  const accent = settings.accent
  const [mode, setMode] = useState(initialMode)
  const [f, setF] = useState({ name: '', email: '', pw: '', remember: true, cgu: false })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [srvErr, setSrvErr] = useState(null)
  const [srvFields, setSrvFields] = useState({})
  const [notice, setNotice] = useState(null)
  const set = k => v => { setF(s => ({ ...s, [k]: v })); setSrvErr(null); setSrvFields(x => ({ ...x, [k]: null })) }
  const st = strength(f.pw)
  const err = validate(mode, f)
  const valid = !Object.values(err).some(Boolean)
  const E = k => (tried ? err[k] : null) || srvFields[k] || null

  function switchMode(m) {
    setMode(m); setTried(false); setSrvErr(null); setSrvFields({})
    if (m === 'login' || m === 'register') window.history.replaceState(null, '', `#${m}`)
  }

  async function submit(e) {
    e.preventDefault()
    setTried(true)
    setNotice(null)
    if (!valid || busy) return
    setBusy(true)
    try {
      if (mode === 'forgot') {
        await auth.forgot(f.email)
        setMode('sent')
      } else if (mode === 'reset') {
        await auth.reset(resetToken, f.pw)
        setF(s => ({ ...s, pw: '' }))
        switchMode('login')
        setNotice('Mot de passe modifié. Connectez-vous avec le nouveau.')
      } else if (mode === 'login') {
        onDone(await auth.login({ email: f.email, password: f.pw, remember: f.remember }))
      } else {
        onDone(await auth.register({ name: f.name.trim(), email: f.email, password: f.pw, accept: f.cgu, color: accent }))
      }
    } catch (ex) {
      setSrvFields(ex.fields || {})
      setSrvErr(ex.message && !ex.fields ? ex.message : null)
    } finally {
      setBusy(false)
    }
  }

  const link = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: accent, fontSize: T.fs.xs, fontWeight: 600, fontFamily: T.fontUI }
  const pwLabelRight = mode === 'login' && auth.emailEnabled
    ? <button type="button" style={link} onClick={() => switchMode('forgot')}>Mot de passe oublié ?</button> : null

  return (
    <div className="auth-screen" style={{ height: '100vh', background: T.bg, color: T.text, fontFamily: T.fontUI }}>
      {/* brand side */}
      <div className="auth-brand" style={{ position: 'relative', overflow: 'hidden', background: T.bg2, borderRight: `1px solid ${T.border}`, flexDirection: 'column', padding: '28px 40px' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, color: T.text, textDecoration: 'none', width: 'fit-content' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={ICONS.wave} size={20} stroke="#0b0b0d" /></div>
          <span style={{ fontSize: T.fs.sm, fontWeight: 700, letterSpacing: 0.5 }}>BANDE RYTHMO</span>
        </a>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1, maxWidth: 520, textWrap: 'balance' }}>Votre atelier de doublage vous attend.</div>
          <div aria-hidden="true" style={{ position: 'relative', height: 110, margin: '0 -40px', background: '#121217', borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, overflow: 'hidden' }}>
            {/* Three copies scrolled from −⅓ to −⅔: the text starts at the playhead and loops seamlessly. */}
            <div className="auth-band" style={{ position: 'absolute', top: 0, bottom: 0, left: '30%', display: 'flex', alignItems: 'center', whiteSpace: 'pre' }}>
              {[0, 1, 2].map(k => <span key={k} style={{ fontFamily: "'Caveat', cursive", fontSize: 54, color: T.text, paddingRight: 40 }}>{BAND}</span>)}
            </div>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '30%', background: 'rgba(18,18,23,.55)' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: '30%', width: 2, background: accent, boxShadow: `0 0 12px ${accent}` }} />
            <div style={{ position: 'absolute', top: 0, left: 'calc(30% - 6px)', width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `9px solid ${accent}` }} />
          </div>
          <div style={{ fontSize: T.fs.sm, color: T.text2, maxWidth: 460, lineHeight: 1.55, textWrap: 'pretty' }}>Le compte retient votre nom de comédien et vos préférences. Les clips, les répliques et les prises ne quittent pas votre machine.</div>
        </div>
        <div style={{ fontSize: 11, color: T.text4, fontFamily: T.fontMono }}>ATELIER LOCAL · WHISPER</div>
      </div>

      {/* form side */}
      <div className="auth-side" style={{ position: 'relative', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <a href="/" className="auth-back" style={{ position: 'absolute', display: 'flex', alignItems: 'center', gap: 6, fontSize: T.fs.xs, color: T.text3, textDecoration: 'none' }}><Icon d={ICONS.chevronL} size={13} stroke={T.text3} />Retour à l'accueil</a>
        <form onSubmit={submit} noValidate key={mode} className="auth-form" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, maxWidth: 400, width: '100%', margin: '0 auto' }}>
          {(mode === 'login' || mode === 'register') && (
            <div style={{ alignSelf: 'flex-start' }}><Segmented value={mode} onChange={switchMode} options={[{ v: 'login', l: 'Connexion' }, { v: 'register', l: 'Créer un compte' }]} /></div>
          )}
          {(mode === 'forgot' || mode === 'reset') && <button type="button" onClick={() => switchMode('login')} style={{ ...link, color: T.text3, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}><Icon d={ICONS.chevronL} size={13} stroke={T.text3} />Connexion</button>}
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>{TITLE[mode]}</h1>
            {SUB[mode] && <div style={{ fontSize: T.fs.sm, color: T.text3, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>{SUB[mode]}</div>}
          </div>

          {mode === 'sent' ? <>
            <div style={{ display: 'flex', gap: 12, padding: 16, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'color-mix(in srgb, var(--success) 13%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon d={ICONS.check} size={16} stroke={OK} /></div>
              <div style={{ fontSize: T.fs.sm, color: T.text2, lineHeight: 1.5 }}>Si un compte existe pour <b style={{ color: T.text }}>{f.email}</b>, un lien vient d'y être envoyé. Il est valable 30 minutes.</div>
            </div>
            <Btn variant="primary" full size="lg" onClick={() => switchMode('login')}>Retour à la connexion</Btn>
            <div style={{ fontSize: T.fs.xs, color: T.text3 }}>Rien reçu ? <button type="button" style={link} onClick={() => setMode('forgot')}>Renvoyer le lien</button></div>
          </> : <>
            {notice && <div role="status" style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--success) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 33%, transparent)', borderRadius: 10, fontSize: T.fs.xs, color: T.text }}>{notice}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mode === 'register' && (
                <Field id="auth-name" label="Nom affiché">
                  <Input id="auth-name" size="form" icon={ICONS.user} value={f.name} onChange={e => set('name')(e.target.value)} placeholder="Camille R." autoComplete="name"
                    error={E('name')} hint="Prérempli comme nom de comédien dans le Studio." autoFocus />
                </Field>
              )}
              {mode !== 'reset' && (
                <Field id="auth-email" label="E-mail">
                  <Input id="auth-email" size="form" icon={ICONS.globe} type="email" value={f.email} onChange={e => set('email')(e.target.value)} placeholder="vous@exemple.fr" autoComplete="email"
                    error={E('email')} autoFocus={mode !== 'register'} />
                </Field>
              )}
              {mode !== 'forgot' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Field id="auth-pw" label="Mot de passe" right={pwLabelRight}>
                    <Input id="auth-pw" size="form" icon={ICONS.lock} type="password" value={f.pw} onChange={e => set('pw')(e.target.value)}
                      placeholder={mode === 'login' ? '' : '8 caractères minimum'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      error={E('pw')} autoFocus={mode === 'reset'} />
                  </Field>
                  {(mode === 'register' || mode === 'reset') && f.pw && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, display: 'flex', gap: 4 }}>{[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: st >= i ? [T.danger, '#FF9944', OK][st - 1] : T.surface2 }} />)}</div>
                      <span style={{ fontSize: 11.5, color: T.text3, width: 64, textAlign: 'right' }}>{['Trop court', 'Faible', 'Correct', 'Solide'][st]}</span>
                    </div>
                  )}
                </div>
              )}
              {mode === 'login' && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: T.fs.xs, color: T.text2 }}><Toggle on={f.remember} onClick={() => set('remember')(!f.remember)} label="Rester connecté sur cet appareil" />Rester connecté sur cet appareil</div>}
              {mode === 'register' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: T.fs.xs, color: T.text2, lineHeight: 1.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={f.cgu} onChange={e => set('cgu')(e.target.checked)} style={{ marginTop: 2, accentColor: accent, width: 15, height: 15 }} />
                    <span>J'accepte les <a href="/conditions.html" target="_blank" rel="noreferrer" style={{ color: accent }}>conditions d'utilisation</a> et la <a href="/confidentialite.html" target="_blank" rel="noreferrer" style={{ color: accent }}>politique de confidentialité</a>.</span>
                  </label>
                  {E('cgu') && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{E('cgu')}</span>}
                </div>
              )}
            </div>
            {srvErr && <div role="alert" style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--danger) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 33%, transparent)', borderRadius: 10, fontSize: T.fs.xs, color: T.text }}>{srvErr}</div>}
            <button type="submit" disabled={busy} style={{ height: 46, borderRadius: 11, border: 'none', cursor: busy ? 'default' : 'pointer', background: accent, color: '#0b0b0d', fontSize: 15, fontWeight: 700, fontFamily: T.fontUI, opacity: busy ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {busy ? 'Un instant…' : SUBMIT[mode]}
            </button>
            {(mode === 'login' || mode === 'register') && <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: T.text4 }}><div style={{ flex: 1, height: 1, background: T.border }} />ou<div style={{ flex: 1, height: 1, background: T.border }} /></div>
              <Btn variant="outline" full size="lg" onClick={onLocal}>Continuer sans compte</Btn>
              <div style={{ fontSize: 11.5, color: T.text3, textAlign: 'center', marginTop: -8 }}>Tout fonctionne en local. Vous pourrez créer un compte plus tard depuis l'avatar.</div>
            </>}
          </>}
        </form>
      </div>
    </div>
  )
}

// Not a <label>: the row can hold a button (« Mot de passe oublié ? ») that a
// wrapping label would click instead of focusing the field.
function Field({ id, label, right, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ display: 'flex', alignItems: 'center', fontSize: T.fs.xs, fontWeight: 600, color: T.text2 }}>
        <label htmlFor={id}>{label}</label><span style={{ flex: 1 }} />{right}
      </span>
      {children}
    </div>
  )
}
