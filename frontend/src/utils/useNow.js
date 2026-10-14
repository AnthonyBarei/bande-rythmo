import { useEffect, useState } from 'react'

// Wall clock that re-renders every `intervalMs` — for time-relative UI
// (e.g. the 10-minute primary-row window) without reading Date.now() in render.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
