import React from 'react'
import { useSettings } from '../SettingsContext'

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

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Card({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 130, textAlign: 'left',
        padding: '12px 14px',
        background: active ? 'var(--accent-soft)' : 'var(--surface)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

export default function Preferences() {
  const { settings, update, reset } = useSettings()

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
              RÉGLAGES
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.4, marginTop: 2 }}>Préférences</h1>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={reset}
            style={{ padding: '6px 12px', background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', fontSize: 12 }}
          >
            Réinitialiser
          </button>
        </div>

        <Section title="COULEUR D'ACCENT">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {ACCENTS.map(a => {
              const active = settings.accent.toLowerCase() === a.hex.toLowerCase()
              return (
                <button
                  key={a.hex}
                  onClick={() => update({ accent: a.hex })}
                  title={a.name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px',
                    background: active ? 'var(--surface2)' : 'var(--surface)',
                    border: `1px solid ${active ? a.hex : 'var(--border)'}`,
                    borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text2)',
                  }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: a.hex, display: 'block' }} />
                  {a.name}
                </button>
              )
            })}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text2)', cursor: 'pointer',
            }}>
              <input
                type="color"
                value={settings.accent}
                onChange={e => update({ accent: e.target.value })}
                style={{ width: 22, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
              />
              Personnalisé
            </label>
          </div>
        </Section>

        <Section title="STYLE DE BANDE RYTHMO PAR DÉFAUT">
          <div style={{ display: 'flex', gap: 10 }}>
            {BR_STYLES.map(s => (
              <Card key={s.key} active={settings.brStyle === s.key} onClick={() => update({ brStyle: s.key })}>
                <div style={{ fontSize: 13, fontWeight: 600, color: settings.brStyle === s.key ? 'var(--accent)' : 'var(--text)' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{s.desc}</div>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="DENSITÉ DE L'INTERFACE">
          <div style={{ display: 'flex', gap: 10 }}>
            {DENSITIES.map(d => (
              <Card key={d.key} active={settings.density === d.key} onClick={() => update({ density: d.key })}>
                <div style={{ fontSize: 13, fontWeight: 600, color: settings.density === d.key ? 'var(--accent)' : 'var(--text)' }}>
                  {d.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{d.desc}</div>
              </Card>
            ))}
          </div>
        </Section>

        <div style={{ fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          Les préférences sont enregistrées localement dans ce navigateur.
        </div>
      </div>
    </div>
  )
}
