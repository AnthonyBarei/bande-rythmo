import { useLayoutEffect, useRef } from 'react'

// A ref that always holds the latest committed value — for event handlers,
// RAF loops and once-bound listeners that must not capture a stale render.
export default function useLatestRef(value) {
  const ref = useRef(value)
  useLayoutEffect(() => { ref.current = value })
  return ref
}
