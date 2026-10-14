// Canonical character-track palette — single source of truth.
// Replaces 3 duplicated TRACK_COLORS tables (DubbingWorkspace, SubtitleEditor,
// BRTimeline). Index = track slot assigned to a character (charMap).
// Values = redesign foundation.jsx T.tracks (LÉA · MARC · SARAH · NOAH).

export const TRACK_HEXES = ['#F5C518', '#5AA9F0', '#F06AA0', '#5EC27C']

const soft = (r, g, b) => `rgba(${r},${g},${b},0.10)`

export const TRACK_COLORS = [
  { hex: '#F5C518', bg: soft(245, 197, 24),  soft: soft(245, 197, 24),  text: '#F5C518', label: '#F5C518' },
  { hex: '#5AA9F0', bg: soft(90, 169, 240),  soft: soft(90, 169, 240),  text: '#5AA9F0', label: '#5AA9F0' },
  { hex: '#F06AA0', bg: soft(240, 106, 160), soft: soft(240, 106, 160), text: '#F06AA0', label: '#F06AA0' },
  { hex: '#5EC27C', bg: soft(94, 194, 124),  soft: soft(94, 194, 124),  text: '#5EC27C', label: '#5EC27C' },
]

export const trackColor = i => TRACK_COLORS[(i ?? 0) % TRACK_COLORS.length]
