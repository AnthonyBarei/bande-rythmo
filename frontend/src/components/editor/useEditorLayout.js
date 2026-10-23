import { useState, useEffect, useRef, useCallback } from 'react'

// Resizable panes (reference screen-editor.jsx › Editor bandH / inspW / inspOpen).
const LAYOUT_KEY = 'br.editor.layout'
export const BAND_DEFAULT = 190
const BAND_MIN = 120
const BAND_MAX = 520
export const INSP_DEFAULT = 392
export const INSP_MIN = 300
export const INSP_MAX = 600
// Left column chrome under the video: transport (50) + nav (56) + toolbar (48).
const COLUMN_CHROME_H = 50 + 56 + 48
const VIDEO_MIN_H = 160

function readLayout() {
  try {
    const v = JSON.parse(localStorage.getItem(LAYOUT_KEY))
    return v && typeof v === 'object' ? v : {}
  } catch { return {} }
}
const clampNum = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback)

// Band height, inspector width / visibility — persisted, band clamped to the column.
export default function useEditorLayout() {
  const [savedLayout] = useState(readLayout)
  const [bandH, setBandH] = useState(() => clampNum(savedLayout.bandH, BAND_MIN, BAND_MAX, BAND_DEFAULT))
  const [inspW, setInspW] = useState(() => clampNum(savedLayout.inspW, INSP_MIN, INSP_MAX, INSP_DEFAULT))
  const [inspOpen, setInspOpen] = useState(savedLayout.inspOpen !== false)
  const colRef = useRef(null)
  // Band cap keeps the video ≥ 160px: column − transport − nav − toolbar − 160.
  const clampBand = useCallback(v => {
    const colH = colRef.current ? colRef.current.offsetHeight : 900
    const max = Math.max(BAND_MIN, colH - COLUMN_CHROME_H - VIDEO_MIN_H)
    return Math.max(BAND_MIN, Math.min(BAND_MAX, max, v))
  }, [])
  useEffect(() => {
    const fit = () => setBandH(h => clampBand(h))
    fit()
    const col = colRef.current
    if (!col || !window.ResizeObserver) {
      window.addEventListener('resize', fit)
      return () => window.removeEventListener('resize', fit)
    }
    const ro = new ResizeObserver(fit)
    ro.observe(col)
    return () => ro.disconnect()
  }, [clampBand])
  useEffect(() => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ bandH, inspW, inspOpen })) } catch { /* layout not persisted */ }
  }, [bandH, inspW, inspOpen])

  return { colRef, bandH, setBandH, clampBand, inspW, setInspW, inspOpen, setInspOpen }
}
