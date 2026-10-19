import { useLayoutEffect, useRef, useState } from 'react'

// Width of a stretched layout element (transport, band toolbar): the editor
// column narrows with the window *and* with the inspector width, so these bars
// adapt to their own width rather than to a viewport media query.
export default function useElementWidth(initial = Infinity) {
  const ref = useRef(null)
  const [width, setWidth] = useState(initial)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width))
    measure()
    if (!window.ResizeObserver) {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}
