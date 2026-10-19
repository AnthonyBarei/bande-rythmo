import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '../SettingsContext'
import { Btn, Segmented, Select, Toggle, Chip, Dot, ScreenHeader, Icon, ICONS, T } from '../ui'
import { fetchUploadedFonts, fontOptions } from '../config/fonts'

// Réglages — reference screen-misc.jsx Settings (Section max 720 + Field rows).

const ACCENTS = [
  { hex: '#F5C518', name: 'Jaune' },
  { hex: '#5AA9F0', name: 'Bleu' },
  { hex: '#F06AA0', name: 'Rose' },
  { hex: '#5EC27C', name: 'Vert' },
  { hex: '#A98BF0', name: 'Violet' },
  { hex: '#FF8C42', name: 'Orange' },
]

const BR_STYLES = [
  { v: 'classique', l: 'Classique', desc: 'Blocs pleins, ondes, grille' },
  { v: 'neon',      l: 'Néon',      desc: 'Contours lumineux, fond sombre' },
  { v: 'minimal',   l: 'Minimal',   desc: 'Soulignement seul, épuré' },
]

const DENSITIES = [
  { v: 'compact',     l: 'Compact', desc: 'Interface dense' },
  { v: 'normal',      l: 'Normal',  desc: 'Par défaut' },
  { v: 'comfortable', l: 'Confort', desc: 'Plus d’espace' },
]

const WHISPER_LANGS = [
  { v: 'fr', l: 'FR — Français' }, { v: 'en', l: 'EN — English' }, { v: 'es', l: 'ES — Español' },
  { v: 'de', l: 'DE — Deutsch' }, { v: 'it', l: 'IT — Italiano' }, { v: 'pt', l: 'PT — Português' },
  { v: 'ja', l: 'JA — 日本語' }, { v: 'auto', l: 'Auto-détection' },
]

// VO level under a take played over the picture (Studio « Écouter sur l'image »).
const LISTEN_VO_LEVELS = [
  { v: 0,    l: '0 %',  desc: 'VO coupée' },
  { v: 0.15, l: '15 %', desc: 'Par défaut' },
  { v: 0.5,  l: '50 %', desc: 'VO bien audible' },
]

function Section({ title, desc, children }) {
  return (
    <div style={{ marginBottom: 26, maxWidth: 720 }}>
      <div style={{ fontSize: T.fs.md, fontWeight: 600, marginBottom: 3 }}>{title}</div>
      {desc && <div style={{ fontSize: T.fs.xs, color: T.text3, marginBottom: 14 }}>{desc}</div>}
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderBottom: `1px solid ${T.surface2}` }}>
      <div style={{ width: 200, flexShrink: 0, fontSize: T.fs.sm, color: T.text2 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function StatusChip({ ok, children }) {
  const c = ok ? T.success : T.text3
  return <Chip soft color={c}><Dot color={c} size={6} />{children}</Chip>
}

export default function Preferences() {
  const { settings, update, reset } = useSettings()
  const [aiStatus, setAiStatus] = useState({ translate: null, vocal: null })
  const [uploadedFonts, setUploadedFonts] = useState([])

  const loadFonts = useCallback(() => fetchUploadedFonts()
    .then(setUploadedFonts)
    .catch(e => console.warn('Chargement des polices importées échoué', e)), [])
  useEffect(() => { loadFonts() }, [loadFonts])

  useEffect(() => {
    const status = url => fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .catch(e => { console.warn(`Statut indisponible (${url})`, e); return null })
    Promise.all([status('/api/translate/status'), status('/api/clips/vocal-separation/status')])
      .then(([translate, vocal]) => setAiStatus({ translate, vocal }))
  }, [])

  const accent = (settings.accent || '').toLowerCase()
  const isCustom = !!accent && !ACCENTS.some(a => a.hex.toLowerCase() === accent)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ScreenHeader kicker="PRÉFÉRENCES" title="Réglages" right={<Btn variant="outline" size="sm" icon={ICONS.undo} onClick={reset}>Réinitialiser</Btn>} />
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 32px 40px' }}>
        <Section title="Apparence" desc="Identité visuelle de l'atelier.">
          <Field label="Couleur d'accent">
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              {ACCENTS.map(a => {
                const on = accent === a.hex.toLowerCase()
                return <div key={a.hex} role="button" tabIndex={0} title={a.name} aria-pressed={on}
                  onClick={() => update({ accent: a.hex })}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); update({ accent: a.hex }) } }}
                  style={{ width: 30, height: 30, borderRadius: 8, background: a.hex, cursor: 'pointer', border: on ? `2px solid ${T.text}` : '1px solid transparent', boxShadow: on ? `0 0 0 2px ${a.hex}55` : 'none' }} />
              })}
              <CustomAccent value={settings.accent} custom={isCustom} onChange={hex => update({ accent: hex })} />
            </div>
          </Field>
          <Field label="Style de bande rythmo">
            <Segmented value={settings.brStyle} onChange={v => update({ brStyle: v })} options={BR_STYLES} />
          </Field>
          <Field label="Police de bande rythmo">
            <Select width={200} menuWidth={280} value={settings.brFont} onChange={v => update({ brFont: v })}
              options={fontOptions(uploadedFonts, settings.brFont)} />
          </Field>
          <Field label="Densité">
            <Segmented value={settings.density} onChange={v => update({ density: v })} options={DENSITIES} />
          </Field>
          <Field label="Police personnalisée"><FontUpload onUploaded={loadFonts} /></Field>
        </Section>

        <Section title="Traitement IA" desc="Outils optionnels, locaux quand possible.">
          <Field label="Séparation vocale">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <StatusChip ok={aiStatus.vocal?.available}>{aiStatus.vocal?.available ? 'Demucs disponible' : 'Non installé (pip install demucs)'}</StatusChip>
              <span style={{ fontSize: T.fs.xs, color: T.text3 }}>isoler la voix (demucs) pour comparer la prise</span>
            </div>
          </Field>
          <Field label="Auto-traduction">
            <StatusChip ok={aiStatus.translate?.available}>
              {aiStatus.translate?.available ? aiStatus.translate.provider : 'Aucun fournisseur (DEEPL_API_KEY / LIBRETRANSLATE_URL)'}
            </StatusChip>
          </Field>
        </Section>

        <Section title="Transcription Whisper" desc="Modèle local, hors-ligne.">
          <Field label="Modèle">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Chip soft color={T.text2}>{settings.whisperModel || 'large-v3'}</Chip>
              <span style={{ fontSize: T.fs.micro, color: T.text3 }}>réglable via <span style={{ fontFamily: T.fontMono }}>WHISPER_MODEL</span></span>
            </div>
          </Field>
          <Field label="Langue par défaut">
            <Select width={200} value={settings.whisperLang || 'fr'} onChange={v => update({ whisperLang: v })} options={WHISPER_LANGS} />
          </Field>
        </Section>

        <Section title="Connexion Plex" desc="Bibliothèque locale comme source.">
          <PlexSection />
        </Section>

        <Section title="Export" desc="Valeurs par défaut.">
          <Field label="Incruster la détection (MP4)">
            <Toggle on={!!settings.exportDetectionBurn} onClick={() => update({ exportDetectionBurn: !settings.exportDetectionBurn })} />
          </Field>
        </Section>

        <Section title="Studio" desc="Enregistrement et écoute des prises.">
          <Field label="VO pendant l'écoute">
            <Segmented value={settings.listenVoLevel} onChange={v => update({ listenVoLevel: v })} options={LISTEN_VO_LEVELS} />
          </Field>
        </Section>

        <div style={{ fontSize: T.fs.micro, color: T.text3, maxWidth: 720 }}>
          Les préférences sont enregistrées localement dans ce navigateur.
        </div>
      </div>
    </div>
  )
}

// 7th swatch: native colour picker. Dashed "+" until a custom colour is chosen, then filled with it.
function CustomAccent({ value, custom, onChange }) {
  return (
    <label title="Couleur personnalisée" style={{
      position: 'relative', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: custom ? value : 'transparent',
      border: custom ? `2px solid ${T.text}` : `1px dashed ${T.border2}`,
      boxShadow: custom ? `0 0 0 2px ${value}55` : 'none',
    }}>
      {!custom && <Icon d={ICONS.plus} size={14} stroke={T.text3} />}
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#f5c518'} aria-label="Couleur personnalisée"
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, padding: 0, border: 'none', cursor: 'pointer' }} />
    </label>
  )
}

// Custom font upload (TTF/OTF) → /api/fonts
function FontUpload({ onUploaded }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  async function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/fonts/upload', { method: 'POST', body: fd })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json().catch(() => ({}))
      setMsg({ ok: true, text: d.name || file.name })
      onUploaded?.()
    } catch (err) {
      setMsg({ ok: false, text: 'Erreur : ' + err.message })
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input ref={inputRef} type="file" accept=".ttf,.otf" onChange={pick} style={{ display: 'none' }} />
      <Btn variant="outline" icon={ICONS.upload} disabled={busy} title={busy ? 'Envoi en cours…' : undefined} onClick={() => inputRef.current?.click()}>
        {busy ? 'Envoi…' : 'Importer une police (TTF / OTF)'}
      </Btn>
      {msg && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T.fs.xs, color: msg.ok ? T.success : T.danger }}>
          <Icon d={msg.ok ? ICONS.check : ICONS.warn} size={13} />{msg.text}
        </span>
      )}
    </div>
  )
}

// Plex — reference Field rows (Statut chip / Token / Reconfigurer), real connect.
function PlexSection() {
  const [status, setStatus] = useState(null)    // { connected, server, url }
  const [url, setUrl]       = useState('')
  const [token, setToken]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState(null)
  const [form, setForm]     = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/plex/status')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => {
        if (!alive) return
        setStatus(d)
        if (d.url) setUrl(d.url)
      })
      .catch(e => console.warn('Statut Plex indisponible', e))
    return () => { alive = false }
  }, [])

  async function connect() {
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/plex/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), token: token.trim() }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.detail || `HTTP ${r.status}`)
      }
      const d = await r.json()
      setStatus({ connected: true, server: d.server, url: url.trim() })
      setToken(''); setForm(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const connected = status?.connected
  const host = (status?.url || '').replace(/^https?:\/\//, '')
  return (
    <>
      <Field label="Statut">
        <StatusChip ok={connected}>{connected ? `Connecté · ${host || status.server}` : 'Non connecté'}</StatusChip>
      </Field>
      {connected && !form && (
        <Field label="Token"><span style={{ fontFamily: T.fontMono, fontSize: T.fs.sm, color: T.text2 }}>••••••••••••••••</span></Field>
      )}
      {!form ? (
        <Field label="">
          <Btn variant="outline" icon={ICONS.plug} onClick={() => setForm(true)}>{connected ? 'Reconfigurer' : 'Connecter'}</Btn>
        </Field>
      ) : (
        <>
          <Field label="URL serveur">
            <input placeholder="http://localhost:32400" value={url} onChange={e => setUrl(e.target.value)}
              style={{ width: '100%', maxWidth: 320, height: 36, padding: '0 12px', fontSize: T.fs.sm, fontFamily: T.fontMono, background: T.surface, color: T.text, border: `1px solid ${T.border2}`, borderRadius: T.r.ctl }} />
          </Field>
          <Field label="Token">
            <input type="password" placeholder="Token Plex" value={token} onChange={e => setToken(e.target.value)}
              style={{ width: '100%', maxWidth: 320, height: 36, padding: '0 12px', fontSize: T.fs.sm, background: T.surface, color: T.text, border: `1px solid ${T.border2}`, borderRadius: T.r.ctl }} />
          </Field>
          <Field label="">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn variant="primary" onClick={connect} disabled={busy || !url || !token}
                title={busy ? 'Connexion en cours…' : (!url || !token) ? "Renseignez l'URL et le token Plex" : undefined}>{busy ? 'Connexion…' : 'Connecter'}</Btn>
              <Btn variant="outline" onClick={() => { setForm(false); setErr(null) }}>Annuler</Btn>
              {err && <span style={{ fontSize: T.fs.xs, color: T.danger }}>{err}</span>}
            </div>
          </Field>
        </>
      )}
    </>
  )
}
