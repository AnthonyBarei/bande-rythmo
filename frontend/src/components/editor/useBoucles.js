import { useState, useEffect, useRef } from 'react'
import useLatestRef from '../../hooks/useLatestRef'

const renumber = list => [...list].sort((a, b) => a.start - b.start).map((b, i) => ({ ...b, number: i + 1 }))

// Recording loops (boucles): add/split at the cursor, remove, debounced save.
export default function useBoucles({ clip, onUpdate, toast, getBandTime, videoRef }) {
  const [boucles, setBoucles] = useState(clip.boucles || [])
  const bouclesRef = useLatestRef(boucles)
  const debounceRef = useRef(null)

  // Sync boucles in from clip whenever clip swaps
  useEffect(() => { setBoucles(clip.boucles || []) }, [clip.clip_id])

  function saveBoucles(next) {
    setBoucles(next)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clips/${clip.clip_id}/boucles`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boucles: next }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        onUpdate(await res.json())
      } catch (e) {
        console.warn('Sauvegarde des boucles échouée', e)
        toast.error('Sauvegarde des boucles échouée : ' + e.message)
      }
    }, 800)
  }

  // Add or split boucle at current cursor.
  function addBoucleAtCursor() {
    const v = videoRef.current
    if (!v) return
    const t = getBandTime()
    const cur = bouclesRef.current
    // Inside an existing boucle → split it at t.
    const containing = cur.find(b => t > b.start + 0.1 && t < b.end - 0.1)
    if (containing) {
      const others = cur.filter(b => b !== containing)
      saveBoucles(renumber([...others, { ...containing, end: t }, { start: t, end: containing.end }]))
      return
    }
    // Otherwise create boucle from cursor to end-of-clip or next boucle start.
    const next = cur.find(b => b.start > t)
    const endT = next ? next.start : (v.duration || (clip.end - clip.start))
    if (endT - t < 0.5) return
    saveBoucles(renumber([...cur, { start: t, end: endT }]))
  }

  function removeBoucle(number) {
    saveBoucles(renumber(bouclesRef.current.filter(b => b.number !== number)))
  }

  return { boucles, addBoucleAtCursor, removeBoucle }
}
