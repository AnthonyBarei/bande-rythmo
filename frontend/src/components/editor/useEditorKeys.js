import { useEffect } from 'react'
import { activeIndexAt } from '../../utils/band'
import { toggleMuted } from '../../utils/playerVolume'
import useLatestRef from '../../hooks/useLatestRef'

// Editor keyboard shortcuts. Bound once; `ctx` (refreshed every render) gives
// the handler the current video, répliques and actions.
export default function useEditorKeys(ctx) {
  const ctxRef = useLatestRef(ctx)

  useEffect(() => {
    function onKey(e) {
      const c = ctxRef.current
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return
      if (c.exportOpen) return
      // Undo / redo — Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z. Ctrl+S saves now. Intercept before transport.
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); c.undo(); return }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); c.redo(); return }
        if (k === 's') { e.preventDefault(); c.saveNow(); return }
      }
      // `\` toggles the inspector. On AZERTY it is AltGr+8 (reported as Ctrl+Alt),
      // so AltGraph is the one modifier allowed for it.
      const altGr = e.getModifierState?.('AltGraph')
      if (e.key === '\\' && (altGr || !(e.ctrlKey || e.metaKey || e.altKey))) {
        if (document.querySelector('[aria-modal="true"]')) return
        e.preventDefault()
        c.toggleInspector()
        return
      }
      // Single-key shortcuts must not fire on browser/app combos (Ctrl+S, Ctrl+K, Alt+…).
      if ((e.ctrlKey || e.metaKey || e.altKey) && !e.key.startsWith('Arrow')) return
      // An app-level dialog (raccourcis, palette…) owns the keyboard.
      if (document.querySelector('[aria-modal="true"]')) return
      const v = c.videoRef.current; if (!v) return
      const vt = v.currentTime
      const t = c.getBandTime()
      const subs = c.subtitlesRef.current
      const activeI = activeIndexAt(subs, t)
      const frame = 1 / (c.clipFps || 25)

      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.ctrlKey || e.metaKey) {
            const prev = [...subs].reverse().find(s => s.start < t - 0.05)
            if (prev) c.seekBand(prev.start)
          } else {
            // Shift+← = one frame back; ← = 1s back
            v.currentTime = Math.max(0, vt - (e.shiftKey ? frame : 1))
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.ctrlKey || e.metaKey) {
            const next = subs.find(s => s.start > t + 0.05)
            if (next) c.seekBand(next.start)
          } else {
            // Shift+→ = one frame forward; → = 1s forward
            const step = e.shiftKey ? frame : 1
            v.currentTime = Math.min(v.duration || vt + step, vt + step)
          }
          break
        case ',': e.preventDefault(); v.pause(); v.currentTime = Math.max(0, vt - 0.04); break
        case '.': e.preventDefault(); v.pause(); v.currentTime = Math.min(v.duration || vt, vt + 0.04); break
        case 'Delete': case 'Backspace':
          if (activeI >= 0) { e.preventDefault(); c.deleteReplica(activeI) }
          break
        case 'Enter':
          if (e.shiftKey) {
            e.preventDefault()
            c.addSubAt(t)
          } else if (activeI >= 0 && e.target.tagName !== 'BUTTON') {
            e.preventDefault()
            c.startEdit(activeI)
          }
          break
        case 'Escape': if (c.loopRegionRef.current) { c.setLoopRegion(null); e.preventDefault() } break
        case 'j': v.playbackRate = 0.5; c.setSpeed(0.5); break
        case 'l': v.playbackRate = 1.5; c.setSpeed(1.5); break
        case 'm': toggleMuted(); break
        case 'i': case 'I':
          if (activeI >= 0) c.changeSubtitles(subs.map((s, i) => i === activeI ? { ...s, start: t } : s))
          break
        case 'o': case 'O':
          if (activeI >= 0) c.changeSubtitles(subs.map((s, i) => i === activeI ? { ...s, end: t } : s))
          break
        case 's': case 'S':
          if (activeI >= 0) {
            const sub = subs[activeI]
            if (t > sub.start && t < sub.end) {
              const next = [...subs]
              next.splice(activeI, 1, { ...sub, end: t }, { ...sub, start: t, text: '' })
              c.changeSubtitles(next)
            }
          }
          break
        case 'r': case 'R':
          e.preventDefault()
          c.recordInStudio()
          break
        case 'e': case 'E':
          e.preventDefault()
          c.toggleExport?.()
          break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
