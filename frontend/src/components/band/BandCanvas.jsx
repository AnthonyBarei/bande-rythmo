import React, { forwardRef, useCallback, useEffect, useRef } from 'react'
import { bandCanvasHeight, drawBand } from './bandRender'

const NO_HANDLERS = {}

// Bande rythmo canvas — one RAF loop drawing drawBand() at the band time
// returned by `getTime()` (null = nothing to draw this frame). Props are read
// through a ref each frame, so data/look changes never restart the loop.
//
// Interactive (Éditeur): the parent owns the gestures and passes the mouse
// handlers; `hoverRef` / `dragRef` feed the hover scrub line. The forwarded
// ref is the <canvas> element (hit-testing, wheel zoom, overlays).
// `readOnly` (Studio): no handlers, no hint, default cursor, no context menu.
// `onFrame(t)` runs after each drawn frame (Éditeur loop-region enforcement).
const BandCanvas = forwardRef(function BandCanvas({
  getTime, onFrame, readOnly = false, hoverRef = null, dragRef = null, title,
  onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onDoubleClick, onContextMenu,
  ...drawProps
}, ref) {
  const canvasRef = useRef(null)
  const propsRef = useRef(null)
  propsRef.current = { ...drawProps, getTime, onFrame, hoverRef, dragRef }

  const setCanvas = useCallback(el => {
    canvasRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }, [ref])

  useEffect(() => {
    let raf = 0
    const frame = () => {
      const p = propsRef.current
      const canvas = canvasRef.current
      const t = canvas ? p.getTime() : null
      if (canvas && t != null) {
        drawBand(canvas, t, p, p.hoverRef?.current || null, !!p.dragRef?.current)
        p.onFrame?.(t)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const handlers = readOnly
    ? NO_HANDLERS
    : { onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onDoubleClick, onContextMenu }

  return (
    <canvas
      ref={setCanvas}
      width={800}
      height={bandCanvasHeight(drawProps.numTracks)}
      title={readOnly ? undefined : title}
      style={{ display: 'block', width: '100%', height: '100%', cursor: readOnly ? 'default' : 'crosshair', userSelect: 'none' }}
      onContextMenu={readOnly ? e => e.preventDefault() : undefined}
      {...handlers}
    />
  )
})

export default BandCanvas
