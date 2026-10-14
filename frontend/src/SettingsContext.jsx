import React, { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'br_settings'

const DEFAULTS = {
  accent: '#f5c518',
  // Bande rythmo look — single source of truth for the editor band AND the
  // export (WYSIWYG). Changed from Préférences or the editor's Affichage menu.
  brStyle: 'classique',
  brFont: 'cursive',
  density: 'normal',
  // Whisper transcription defaults — applied when a clip is opened without override.
  whisperLang: 'fr',                // fr | en | auto | …
  whisperModel: 'large-v3',         // mirrors backend WHISPER_MODEL env var, info-only here
  // Export defaults — pre-filled in ExportPanel form.
  exportDetectionBurn: false,
}

const DENSITY_FONT = { compact: 13, normal: 14, comfortable: 15 }

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex)
  const mix = c => Math.round(c + (255 - c) * amount)
  const hx = c => mix(c).toString(16).padStart(2, '0')
  return `#${hx(r)}${hx(g)}${hx(b)}`
}

function applySettings(s) {
  const root = document.documentElement
  const { r, g, b } = hexToRgb(s.accent)
  root.style.setProperty('--accent', s.accent)
  root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.13)`)
  root.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.06)`)
  root.style.setProperty('--accent-text', lighten(s.accent, 0.25))
  root.style.fontSize = `${DENSITY_FONT[s.density] || 14}px`
}

// Pre-unification keys: the editor kept its font in 'br-font'; Préférences had
// unused exportBrFont / exportBrStyle duplicates. Read once, then dropped.
const LEGACY_FONT_KEY = 'br-font'

function migrate(stored) {
  const { exportBrFont: _font, exportBrStyle: _style, ...rest } = stored
  if (rest.brFont) return rest
  try {
    const legacy = localStorage.getItem(LEGACY_FONT_KEY)
    if (legacy) rest.brFont = legacy
  } catch (e) {
    console.warn('Migration de la police BR impossible', e)
  }
  return rest
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return { ...DEFAULTS, ...migrate(raw ? JSON.parse(raw) : {}) }
  } catch (e) {
    console.warn('Préférences illisibles — valeurs par défaut', e)
    return { ...DEFAULTS }
  }
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    applySettings(settings)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      localStorage.removeItem(LEGACY_FONT_KEY)
    } catch { /* storage unavailable — settings stay in memory */ }
  }, [settings])

  function update(patch) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  function reset() {
    setSettings({ ...DEFAULTS })
  }

  return (
    <SettingsContext.Provider value={{ settings, update, reset }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
