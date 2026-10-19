// Importer IN / OUT model — one marked range shared by the I / O keys, the
// player's IN / OUT cluster and the header "Marquer un clip" button.
// State: { markIn: number|null, markOut: number|null }.
// Each transition returns { markIn, markOut, banked }, where `banked` is a
// completed range ({ start, end }) to move into the pending clips, or null.

export const MIN_CLIP_DUR = 0.2

// Id of the complete IN→OUT range when it is shown as a pending clip.
export const MARK_ID = 'mark'

export const isComplete = ({ markIn, markOut }) => markIn != null && markOut != null

// IN can't be after OUT: an IN at or past OUT clears OUT. A complete range is
// banked first, so starting the next clip never loses the previous one.
export function setIn(state, t) {
  const { markIn, markOut } = state
  if (markOut != null && t >= markOut) {
    const banked = isComplete(state) && markOut - markIn >= MIN_CLIP_DUR ? { start: markIn, end: markOut } : null
    return { markIn: t, markOut: null, banked }
  }
  return { markIn: t, markOut, banked: null }
}

// OUT must be after IN; otherwise the press is ignored (state unchanged).
export function setOut(state, t) {
  if (state.markIn != null && t <= state.markIn) return { ...state, banked: null }
  return { markIn: state.markIn, markOut: t, banked: null }
}

// Header "Marquer un clip": 1st press = IN, 2nd = OUT (a press before IN swaps
// them, as the two-click flow always did), 3rd = add the range to the pending
// clips and start over.
export function markStep(state, t) {
  const { markIn, markOut } = state
  if (isComplete(state)) {
    const banked = markOut - markIn >= MIN_CLIP_DUR ? { start: markIn, end: markOut } : null
    return { markIn: null, markOut: null, banked }
  }
  if (markIn == null) return setIn(state, t)
  const start = Math.min(markIn, t), end = Math.max(markIn, t)
  if (end - start < MIN_CLIP_DUR) return { ...state, banked: null }
  return { markIn: start, markOut: end, banked: null }
}

export function markPhase(state) {
  if (isComplete(state)) return 'range'
  if (state.markIn != null) return 'in'
  return 'none'
}
