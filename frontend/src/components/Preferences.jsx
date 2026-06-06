import React, { useEffect, useState } from 'react'
import { useSettings } from '../SettingsContext'
import { Btn, Segmented, Select, Toggle, Chip, Dot, ScreenHeader, Icon, ICONS } from '../ui'

const ACCENTS = [
  { hex: '#f5c518', name: 'Jaune' },
  { hex: '#ff9900', name: 'Orange' },
  { hex: '#7ec0ff', name: 'Bleu' },
  { hex: '#7ed4a8', name: 'Vert' },
  { hex: '#f08aaf', name: 'Rose' },
  { hex: '#b98aff', name: 'Violet' },
]

const BR_STYLES = [
  { key: 'classique', label: 'Classique', desc: 'Blocs pleins, ondes, grille' },
  { key: 'neon',      label: 'Néon',      desc: 'Contours lumineux, fond sombre' },
  { key: 'minimal',   label: 'Minimal',  desc: 'Soulignement seul, épuré' },
]

const DENSITIES = [
  { key: 'compact',     label: 'Compact',     desc: 'Interface dense' },
  { key: 'normal',      label: 'Normal',      desc: 'Par défaut' },
  { key: 'comfortable', label: 'Confortable', desc: 'Plus d’espace' },
]

const WHISPER_LANGS = [
  { key: 'fr',   label: 'Français' },
  { key: 'en',   label: 'Anglais' },
  { key: 'es',   label: 'Espagnol' },
  { key: 'de',   label: 'Allemand' },
  { key: 'it',   label: 'Italien' },
  { key: 'auto', label: 'Détection auto' },
]

const BR_FONTS = [
  { id: 'atkinson',  label: 'Atkinson' },
  { id: 'lisible',   label: 'Manuscrite lisible' },
  { id: 'cursive',   label: 'Cursive (Caveat)' },
  { id: 'inter',     label: 'Inter' },
  { id: 'jetbrains', label: 'JetBrains Mono' },
]

function Section({ title, desc, children }) {
  return (
    <div style={{ marginBottom: 26, maxWidth: 760 }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: desc ? 3 : 12, color: 'var(--text)' }}>{title}</div>
      {desc && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{desc}</div>}
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderBottom: '1px solid var(--surface2)' }}>
      <div style={{ width: 200, flexShrink: 0, fontSize: 13, color: 'var(--text2)' }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

export default function Preferences() {
  const { settings, update, reset } = useSettings()
  const [aiStatus, setAiStatus] = useState({ translate: null, vocal: null })

  useEffect(() => {
    Promise.all([
      fetch('/api/translate/status').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/clips/vocal-separation/status').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([translate, vocal]) => setAiStatus({ translate, vocal }))
  }, [])

  const seg = (opts, value, key) => (
    <Segmented value={value} onChange={v => update({ [key]: v })} options={opts} />
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      <ScreenHeader kicker="PRÉFÉRENCES" title="Réglages" right={<Btn variant="outline" size="sm" onClick={reset}>Réinitialiser</Btn>} />
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 32px 40px' }}>

        <Section title="Apparence" desc="Identité visuelle de l'atelier.">
          <Field label="Couleur d'accent">
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              {ACCENTS.map(a => {
                const active = settings.accent.toLowerCase() === a.hex.toLowerCase()
                return (
                  <div key={a.hex} onClick={() => update({ accent: a.hex })} title={a.name}
                    style={{ width: 30, height: 30, borderRadius: 8, background: a.hex, cursor: 'pointer',
                      border: active ? '2px solid var(--text)' : '1px solid transparent',
                      boxShadow: active ? `0 0 0 2px ${a.hex}55` : 'none' }} />
                )
              })}
              <label style={{ width: 30, height: 30, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Personnalisé">
                <input type="color" value={settings.accent} onChange={e => update({ accent: e.target.value })} style={{ width: 40, height: 40, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
              </label>
            </div>
          </Field>
          <Field label="Style de bande rythmo">
            {seg(BR_STYLES.map(s => ({ v: s.key, l: s.label })), settings.brStyle, 'brStyle')}
          </Field>
          <Field label="Densité">
            {seg(DENSITIES.map(d => ({ v: d.key, l: d.label })), settings.density, 'density')}
          </Field>
          <Field label="Police personnalisée">
            <FontUpload />
          </Field>
        </Section>

        <Section title="Traitement IA" desc="Outils optionnels, locaux quand possible.">
          <Field label="Séparation vocale">
            <Chip soft color={aiStatus.vocal?.available ? 'var(--success)' : 'var(--text3)'}>
              <Dot color={aiStatus.vocal?.available ? 'var(--success)' : 'var(--text3)'} size={6} />
              {aiStatus.vocal?.available ? 'Demucs disponible' : 'Non installé (pip install demucs)'}
            </Chip>
          </Field>
          <Field label="Auto-traduction">
            <Chip soft color={aiStatus.translate?.available ? 'var(--success)' : 'var(--text3)'}>
              <Dot color={aiStatus.translate?.available ? 'var(--success)' : 'var(--text3)'} size={6} />
              {aiStatus.translate?.available ? `${aiStatus.translate.provider}` : 'Aucun fournisseur (DEEPL_API_KEY / LIBRETRANSLATE_URL)'}
            </Chip>
          </Field>
        </Section>

        <Section title="Transcription Whisper" desc="Modèle local, hors-ligne.">
          <Field label="Langue par défaut">
            <Select width={210} value={settings.whisperLang || 'fr'} onChange={v => update({ whisperLang: v })}
              options={WHISPER_LANGS.map(l => ({ v: l.key, l: l.label }))} />
          </Field>
          <Field label="Modèle backend">
            <Chip soft color="var(--text2)">{settings.whisperModel || 'large-v3'}</Chip>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 10 }}>réglable via <code style={{ fontFamily: 'var(--font-mono)' }}>WHISPER_MODEL</code></span>
          </Field>
        </Section>

        <Section title="Connexion Plex" desc="Bibliothèque locale comme source.">
          <PlexSection />
        </Section>

        <Section title="Export" desc="Valeurs par défaut.">
          <Field label="Police BR">
            <Select width={210} value={settings.exportBrFont || 'atkinson'} onChange={v => update({ exportBrFont: v })}
              options={BR_FONTS.map(f => ({ v: f.id, l: f.label }))} />
          </Field>
          <Field label="Style BR">
            {seg(BR_STYLES.map(s => ({ v: s.key, l: s.label })), settings.exportBrStyle || 'classique', 'exportBrStyle')}
          </Field>
          <Field label="Incruster la détection (MP4)">
            <Toggle on={!!settings.exportDetectionBurn} onClick={() => update({ exportDetectionBurn: !settings.exportDetectionBurn })} />
          </Field>
        </Section>

        <div style={{ fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)', paddingTop: 14, maxWidth: 760 }}>
          Les préférences sont enregistrées localement dans ce navigateur.
        </div>
      </div>
    </div>
  )
}

// Custom font upload (TTF/OTF) → /api/fonts
function FontUpload() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  async function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/fonts', { method: 'POST', body: fd })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json().catch(() => ({}))
      setMsg(`✓ ${d.name || file.name}`)
    } catch (err) {
      setMsg('Erreur : ' + err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <label>
        <input type="file" accept=".ttf,.otf" onChange={pick} style={{ display: 'none' }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 15px', borderRadius: 9, border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          <Icon d={ICONS.upload} size={15} /> {busy ? 'Envoi…' : 'Importer une police (TTF / OTF)'}
        </span>
      </label>
      {msg && <span style={{ fontSize: 12, color: msg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>{msg}</span>}
    </div>
  )
}

// Plex — prototype Field rows (Statut chip / Token / Reconfigurer), real connect.
function PlexSection() {
  const [status, setStatus] = useState(null)    // { connected, server, url }
  const [url, setUrl]       = useState('')
  const [token, setToken]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState(null)
  const [form, setForm]     = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/plex/status').then(r => r.json()).then(d => {
      if (!alive) return
      setStatus(d)
      if (d.url) setUrl(d.url)
    }).catch(() => {})
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
  return (
    <>
      <Field label="Statut">
        <Chip soft color={connected ? 'var(--success)' : 'var(--text3)'}>
          <Dot color={connected ? 'var(--success)' : 'var(--text3)'} size={6} />
          {connected ? `Connecté · ${status.server || status.url}` : 'Non connecté'}
        </Chip>
      </Field>
      {connected && !form && (
        <Field label="Token"><span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text2)' }}>••••••••••••••••</span></Field>
      )}
      {!form ? (
        <Field label="">
          <Btn variant="outline" icon={ICONS.link} onClick={() => setForm(true)}>{connected ? 'Reconfigurer' : 'Connecter'}</Btn>
        </Field>
      ) : (
        <>
          <Field label="URL serveur">
            <input placeholder="http://localhost:32400" value={url} onChange={e => setUrl(e.target.value)}
              style={{ width: '100%', maxWidth: 320, minHeight: 34, fontSize: 13, fontFamily: 'var(--font-mono)' }} />
          </Field>
          <Field label="Token">
            <input type="password" placeholder="Token Plex" value={token} onChange={e => setToken(e.target.value)}
              style={{ width: '100%', maxWidth: 320, minHeight: 34, fontSize: 13 }} />
          </Field>
          <Field label="">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn variant="primary" onClick={connect} disabled={busy || !url || !token}>{busy ? 'Connexion…' : 'Connecter'}</Btn>
              <Btn variant="outline" onClick={() => { setForm(false); setErr(null) }}>Annuler</Btn>
              {err && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>}
            </div>
          </Field>
        </>
      )}
    </>
  )
}
