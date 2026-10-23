import { useState, useEffect, useCallback } from 'react'

// Uploaded custom fonts — fetched + injected as @font-face for canvas/CSS.
export default function useUploadedFonts({ toast, brFont, setBrFont }) {
  const [uploadedFonts, setUploadedFonts] = useState([])

  const refreshFonts = useCallback(async () => {
    try {
      const r = await fetch('/api/fonts')
      if (!r.ok) return
      const list = await r.json()
      setUploadedFonts(list)
      const css = list.map(f =>
        `@font-face{font-family:'bru-${f.id}';src:url('/uploads-fonts/${f.file}');font-display:swap;}`
      ).join('\n')
      let el = document.getElementById('br-uploaded-fonts')
      if (!el) { el = document.createElement('style'); el.id = 'br-uploaded-fonts'; document.head.appendChild(el) }
      el.textContent = css
      // Nudge the FontFace set so the canvas (which reads resolved fonts) repaints.
      if (document.fonts && list.length) {
        list.forEach(f => { document.fonts.load(`16px 'bru-${f.id}'`).catch(e => console.warn('Police non chargée', f.id, e)) })
      }
    } catch (e) {
      console.warn('Chargement des polices importées échoué', e)
    }
  }, [])
  useEffect(() => { refreshFonts() }, [refreshFonts])

  async function uploadFont(file) {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', file.name.replace(/\.(ttf|otf)$/i, ''))
    try {
      const r = await fetch('/api/fonts/upload', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`)
      await refreshFonts()
      setBrFont(data.id)   // select the freshly uploaded font
    } catch (e) {
      toast.show({ msg: 'Police : ' + e.message, kind: 'error', duration: 4000 })
    }
  }
  async function deleteFont(id) {
    try {
      const r = await fetch(`/api/fonts/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      if (brFont === id) setBrFont('atkinson')
      await refreshFonts()
    } catch (e) {
      toast.show({ msg: 'Suppression de la police : ' + e.message, kind: 'error', duration: 4000 })
    }
  }

  return { uploadedFonts, uploadFont, deleteFont }
}
