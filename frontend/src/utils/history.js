// Pure snapshot history — undo/redo stack with cap. No React, fully testable.
// Used by useSubtitleManager; snapshots are deep copies so later mutations
// can't corrupt past states.

export const snap = v => JSON.parse(JSON.stringify(v))

export function createHistory(initial, cap = 50) {
  return { stack: [snap(initial)], idx: 0, cap }
}

// Append a snapshot, dropping any redo branch. Mutates and returns h.
export function pushHistory(h, value) {
  h.stack = h.stack.slice(0, h.idx + 1)
  h.stack.push(snap(value))
  if (h.stack.length > h.cap) h.stack.shift()
  h.idx = h.stack.length - 1
  return h
}

export const canUndo = h => !!h && h.idx > 0
export const canRedo = h => !!h && h.idx < h.stack.length - 1

// Step back/forward; returns the snapshot to apply, or null at the boundary.
export function undoHistory(h) {
  if (!canUndo(h)) return null
  h.idx -= 1
  return snap(h.stack[h.idx])
}

export function redoHistory(h) {
  if (!canRedo(h)) return null
  h.idx += 1
  return snap(h.stack[h.idx])
}
