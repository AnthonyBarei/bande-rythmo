import React, { useState, useRef, useEffect, useCallback } from 'react'

const FONTS = [
  { id: 'impact',   label: 'Impact',  css: 'Impact, "Arial Black", sans-serif' },
  { id: 'arialblk', label: 'Arial B.', css: '"Arial Black", Arial, sans-serif' },
  { id: 'mono',     label: 'Mono',    css: '"Courier New", Courier, monospace' },
]

const QUICK_COLORS_TEXT   = ['#ffffff', '#ffff00', '#ff4444', '#44ff88', '#44bbff']
const QUICK_COLORS_STROKE = ['#000000', '#ffffff', '#880000', '#004488', '#ff8800']

let _id = 1
const mkId = () => _id++

function defaultLayer(x = 50, y = 10) {
  return { id: mkId(), content: '', x, y, fontSize: 48, color: '#ffffff', strokeColor: '#000000', strokeWidth: 3, bold: true, fontId: 'impact', align: 'center' }
}

function wrapText(ctx, text, maxW) {
  if (!text) return []
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w
    if (ctx.measureText(test).width <= maxW) { cur = test }
    else { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [text]
}

export default function MemeGenerator({ initialImageUrl = null, initialImageName = null }) {
  const [imageUrl, setImageUrl] = useState(initialImageUrl || null)
  const [imageDims, setImageDims] = useState(null)
  const [texts, setTexts] = useState(() => [defaultLayer(50, 8), defaultLayer(50, 91)])
  const [selectedId, setSelectedId] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resultUrl, setResultUrl] = useState(null)

  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const fileInputRef = useRef(null)
  const dropRef = useRef(null)
  const textsRef = useRef(texts)
  const selectedIdRef = useRef(selectedId)
  const draggingRef = useRef(dragging)

  textsRef.current = texts
  selectedIdRef.current = selectedId
  draggingRef.current = dragging

  // Sync initialImageUrl prop
  useEffect(() => {
    setImageUrl(initialImageUrl || null)
    setResultUrl(null)
  }, [initialImageUrl])

  // Load image element when URL changes
  useEffect(() => {
    if (!imageUrl) { setImageDims(null); imgRef.current = null; return }
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImageDims({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.onerror = () => setError('Impossible de charger l\'image.')
    img.src = imageUrl
  }, [imageUrl])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const W = canvas.width
    const H = canvas.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0, W, H)

    for (const layer of textsRef.current) {
      if (!layer.content.trim()) continue
      const font = FONTS.find(f => f.id === layer.fontId) || FONTS[0]
      const fs = Math.max(8, Math.round(layer.fontSize * (W / 560)))
      ctx.font = `${layer.bold ? 'bold ' : ''}${fs}px ${font.css}`
      ctx.textAlign = layer.align || 'center'
      ctx.textBaseline = 'middle'
      const px = (layer.x / 100) * W
      const py = (layer.y / 100) * H
      const lines = wrapText(ctx, layer.content.toUpperCase(), W * 0.88)
      const lineH = fs * 1.2
      const totalH = lines.length * lineH

      for (let i = 0; i < lines.length; i++) {
        const ly = py + (i - (lines.length - 1) / 2) * lineH
        if (layer.strokeWidth > 0) {
          ctx.lineJoin = 'round'
          ctx.lineWidth = Math.max(1, layer.strokeWidth * (W / 280))
          ctx.strokeStyle = layer.strokeColor
          ctx.strokeText(lines[i], px, ly)
        }
        ctx.fillStyle = layer.color
        ctx.fillText(lines[i], px, ly)
      }

      // Selection box
      if (layer.id === selectedIdRef.current) {
        const maxLW = Math.max(...lines.map(l => ctx.measureText(l).width), 20)
        const bx = layer.align === 'center' ? px - maxLW / 2 - 6
                 : layer.align === 'right'  ? px - maxLW - 6
                 : px - 6
        const by = py - totalH / 2 - 4
        ctx.strokeStyle = 'rgba(255,153,0,0.75)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.strokeRect(bx, by, maxLW + 12, totalH + 8)
        ctx.setLineDash([])
      }
    }
  }, [])

  // Resize canvas + redraw when image loads
  useEffect(() => {
    if (!imageDims) return
    const canvas = canvasRef.current
    if (!canvas) return
    const maxW = Math.min(canvas.parentElement?.clientWidth || 800, 900)
    canvas.width = maxW
    canvas.height = Math.round(maxW * (imageDims.h / imageDims.w))
    draw()
  }, [imageDims, draw])

  // Redraw on text/selection changes
  useEffect(() => { draw() }, [texts, selectedId, draw])

  // Hit test
  function findLayerAt(cx, cy) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const W = canvas.width, H = canvas.height
    const ctx = canvas.getContext('2d')
    for (let i = textsRef.current.length - 1; i >= 0; i--) {
      const layer = textsRef.current[i]
      if (!layer.content.trim()) continue
      const font = FONTS.find(f => f.id === layer.fontId) || FONTS[0]
      const fs = Math.max(8, Math.round(layer.fontSize * (W / 560)))
      ctx.font = `${layer.bold ? 'bold ' : ''}${fs}px ${font.css}`
      const lines = wrapText(ctx, layer.content.toUpperCase(), W * 0.88)
      const lineH = fs * 1.2
      const totalH = lines.length * lineH
      const maxLW = Math.max(...lines.map(l => ctx.measureText(l).width), 10)
      const px = (layer.x / 100) * W
      const py = (layer.y / 100) * H
      const bx = layer.align === 'center' ? px - maxLW / 2 - 12
               : layer.align === 'right'  ? px - maxLW - 12
               : px - 12
      const by = py - totalH / 2 - 12
      if (cx >= bx && cx <= bx + maxLW + 24 && cy >= by && cy <= by + totalH + 24) return layer.id
    }
    return null
  }

  function getCanvasXY(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function onMouseDown(e) {
    const { x, y } = getCanvasXY(e)
    const id = findLayerAt(x, y)
    if (id != null) {
      setSelectedId(id)
      const layer = textsRef.current.find(t => t.id === id)
      setDragging({ id, startX: x, startY: y, origX: layer.x, origY: layer.y })
      e.preventDefault()
    }
  }

  function onMouseMove(e) {
    const d = draggingRef.current
    if (!d) return
    const { x, y } = getCanvasXY(e)
    const canvas = canvasRef.current
    if (!canvas) return
    const dx = ((x - d.startX) / canvas.width) * 100
    const dy = ((y - d.startY) / canvas.height) * 100
    updateLayer(d.id, {
      x: Math.max(2, Math.min(98, d.origX + dx)),
      y: Math.max(2, Math.min(98, d.origY + dy)),
    })
  }

  function onMouseUp() { setDragging(null) }

  function updateLayer(id, patch) {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  function addLayer() {
    const layer = defaultLayer(50, 50)
    setTexts(prev => [...prev, layer])
    setSelectedId(layer.id)
  }

  function removeLayer(id) {
    setTexts(prev => {
      const next = prev.filter(t => t.id !== id)
      if (selectedIdRef.current === id) setSelectedId(next.length ? next[0].id : null)
      return next
    })
  }

  function handleFile(f) {
    if (!f) return
    if (!/\.(png|jpe?g|webp|gif)$/i.test(f.name)) { setError('Format non supporté (PNG, JPG, WEBP, GIF).'); return }
    setError(null); setResultUrl(null)
    setImageUrl(URL.createObjectURL(f))
  }

  async function generate() {
    const active = texts.filter(t => t.content.trim())
    if (!imageUrl) { setError('Choisissez une image.'); return }
    if (!active.length) { setError('Saisissez au moins un texte.'); return }
    setLoading(true); setError(null); setResultUrl(null)
    try {
      const fd = new FormData()
      const r = await fetch(imageUrl)
      const blob = await r.blob()
      const name = initialImageName || 'image.jpg'
      fd.append('file', new File([blob], name, { type: blob.type }))
      fd.append('texts', JSON.stringify(active.map(l => ({
        content: l.content,
        x_pct: l.x, y_pct: l.y,
        font_size: l.fontSize,
        color: l.color, stroke_color: l.strokeColor, stroke_width: l.strokeWidth,
        bold: l.bold, align: l.align, font_style: l.fontId,
      }))))
      const res = await fetch('/api/meme/generate', { method: 'POST', body: fd })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`) }
      setResultUrl(URL.createObjectURL(await res.blob()))
    } catch (e) {
      setError('Erreur : ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function download() {
    if (!resultUrl) return
    const a = document.createElement('a'); a.href = resultUrl; a.download = 'meme.jpg'; a.click()
  }

  const sel = texts.find(t => t.id === selectedId)

  return (
    <div style={{ padding: '20px 28px', overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Mème</h1>
          {initialImageUrl && (
            <span style={{ fontSize: 10, color: '#888', background: 'var(--surface3)', padding: '2px 7px', borderRadius: 3, border: '1px solid var(--border2)' }}>depuis clip</span>
          )}
          <div style={{ flex: 1 }} />
          {imageUrl && (
            <button onClick={() => { setImageUrl(null); setResultUrl(null) }} style={BTN_GHOST}>
              Changer l'image
            </button>
          )}
        </div>

        {!imageUrl ? (
          <div
            ref={dropRef}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); dropRef.current.style.borderColor = '#f90' }}
            onDragLeave={() => { dropRef.current.style.borderColor = '' }}
            onDrop={e => { e.preventDefault(); dropRef.current.style.borderColor = ''; handleFile(e.dataTransfer.files?.[0]) }}
            style={{ border: '2px dashed var(--border2)', borderRadius: 8, padding: 60, textAlign: 'center', background: 'var(--surface)', cursor: 'pointer', transition: 'border-color 0.2s' }}
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>🖼️</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>Glissez une image ou un GIF</div>
            <div style={{ fontSize: 12, color: '#888' }}>PNG · JPG · WEBP · GIF animé</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 20, alignItems: 'start' }}>

            {/* Canvas */}
            <div style={{ background: '#000', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ padding: '6px 10px', borderBottom: '1px solid #1a1a1a', fontSize: 11, color: '#666' }}>
                Glissez le texte pour le repositionner
              </div>
              <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              />
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Text layers */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <span style={SL}>TEXTES</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={addLayer} style={{ fontSize: 11, color: '#f90', background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)', borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>+ Ajouter</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {texts.map((t, i) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 8px',
                        background: selectedId === t.id ? 'rgba(255,153,0,0.08)' : 'var(--surface3)',
                        border: `1px solid ${selectedId === t.id ? 'rgba(255,153,0,0.4)' : 'var(--border)'}`,
                        borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 10, color: '#555', width: 14, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <input
                        value={t.content}
                        onChange={e => updateLayer(t.id, { content: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        placeholder={i === 0 ? 'WHEN YOU…' : i === 1 ? '…IT\'S FRIDAY' : 'Texte…'}
                        style={{
                          flex: 1, background: 'transparent', border: 'none', outline: 'none',
                          fontSize: 12, color: 'var(--text)',
                          fontFamily: (FONTS.find(f => f.id === t.fontId) || FONTS[0]).css,
                          letterSpacing: 0.5,
                        }}
                      />
                      {texts.length > 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); removeLayer(t.id) }}
                          style={{ fontSize: 14, color: '#e54545', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                          title="Supprimer"
                        >×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-layer style */}
              {sel && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={SL}>STYLE — TEXTE {texts.findIndex(t => t.id === selectedId) + 1}</span>

                  {/* Font */}
                  <div>
                    <label style={LBL}>POLICE</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {FONTS.map(f => (
                        <button key={f.id} onClick={() => updateLayer(selectedId, { fontId: f.id })} style={{
                          flex: 1, padding: '5px 4px',
                          background: sel.fontId === f.id ? 'rgba(255,153,0,0.1)' : 'var(--surface3)',
                          color: sel.fontId === f.id ? '#f90' : '#888',
                          border: `1px solid ${sel.fontId === f.id ? 'rgba(255,153,0,0.4)' : 'var(--border2)'}`,
                          borderRadius: 3, fontSize: 10, cursor: 'pointer', fontFamily: f.css,
                        }}>{f.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Size + Bold */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={LBL}>TAILLE — {sel.fontSize}px</label>
                      <input type="range" min={16} max={120} value={sel.fontSize}
                        onChange={e => updateLayer(selectedId, { fontSize: +e.target.value })}
                        style={{ width: '100%', accentColor: '#f90' }}
                      />
                    </div>
                    <button
                      onClick={() => updateLayer(selectedId, { bold: !sel.bold })}
                      style={{
                        padding: '4px 12px', marginBottom: 1,
                        background: sel.bold ? 'rgba(255,153,0,0.1)' : 'var(--surface3)',
                        color: sel.bold ? '#f90' : '#888',
                        border: `1px solid ${sel.bold ? 'rgba(255,153,0,0.4)' : 'var(--border2)'}`,
                        borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      }}
                    >B</button>
                  </div>

                  {/* Text color */}
                  <div>
                    <label style={LBL}>COULEUR TEXTE</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="color" value={sel.color}
                        onChange={e => updateLayer(selectedId, { color: e.target.value })}
                        style={{ width: 30, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                      />
                      {QUICK_COLORS_TEXT.map(c => (
                        <div key={c} onClick={() => updateLayer(selectedId, { color: c })}
                          style={{ width: 18, height: 18, background: c, borderRadius: 2, cursor: 'pointer', flexShrink: 0,
                            border: sel.color.toLowerCase() === c ? '2px solid #f90' : '1px solid #444' }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Stroke color */}
                  <div>
                    <label style={LBL}>CONTOUR — épaisseur {sel.strokeWidth}</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                      <input type="color" value={sel.strokeColor}
                        onChange={e => updateLayer(selectedId, { strokeColor: e.target.value })}
                        style={{ width: 30, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                      />
                      {QUICK_COLORS_STROKE.map(c => (
                        <div key={c} onClick={() => updateLayer(selectedId, { strokeColor: c })}
                          style={{ width: 18, height: 18, background: c, borderRadius: 2, cursor: 'pointer', flexShrink: 0,
                            border: sel.strokeColor.toLowerCase() === c ? '2px solid #f90' : '1px solid #444' }}
                        />
                      ))}
                    </div>
                    <input type="range" min={0} max={8} value={sel.strokeWidth}
                      onChange={e => updateLayer(selectedId, { strokeWidth: +e.target.value })}
                      style={{ width: '100%', accentColor: '#f90' }}
                    />
                  </div>

                  {/* Alignment */}
                  <div>
                    <label style={LBL}>ALIGNEMENT</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[['left', '⟵ Gauche'], ['center', '⊣ Centre'], ['right', 'Droite ⟶']].map(([v, lbl]) => (
                        <button key={v} onClick={() => updateLayer(selectedId, { align: v })}
                          style={{
                            flex: 1, padding: '5px 4px',
                            background: sel.align === v ? 'rgba(255,153,0,0.1)' : 'var(--surface3)',
                            color: sel.align === v ? '#f90' : '#888',
                            border: `1px solid ${sel.align === v ? 'rgba(255,153,0,0.4)' : 'var(--border2)'}`,
                            borderRadius: 3, fontSize: 10, cursor: 'pointer',
                          }}
                        >{lbl}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ padding: '8px 10px', background: 'rgba(229,69,69,0.12)', color: '#e54545', borderRadius: 4, fontSize: 12, border: '1px solid rgba(229,69,69,0.3)' }}>
                  {error}
                </div>
              )}

              <button
                onClick={generate}
                disabled={loading || !texts.some(t => t.content.trim())}
                style={{
                  padding: '10px', fontWeight: 700, borderRadius: 4, fontSize: 13,
                  background: loading ? 'var(--surface3)' : '#fc3',
                  color: loading ? '#888' : '#000',
                  border: 'none', cursor: loading ? 'default' : 'pointer',
                }}
              >{loading ? '◉ Génération…' : '◉ Générer'}</button>

              {resultUrl && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <label style={LBL}>RÉSULTAT</label>
                  <div style={{ background: '#000', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                    <img src={resultUrl} alt="meme" style={{ width: '100%', display: 'block' }} />
                  </div>
                  <button
                    onClick={download}
                    style={{ width: '100%', padding: 10, background: '#44bb55', color: '#fff', fontWeight: 700, borderRadius: 4, fontSize: 13, border: 'none', cursor: 'pointer' }}
                  >↓ Télécharger</button>
                </div>
              )}
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.gif"
          onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
      </div>
    </div>
  )
}

const SL = { fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }
const LBL = { display: 'block', fontSize: 10, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }
const BTN_GHOST = { fontSize: 11, color: '#888', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }
