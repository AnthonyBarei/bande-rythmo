// Canonical character-track palette — single source of truth.
// Replaces 3 duplicated TRACK_COLORS tables (DubbingWorkspace, SubtitleEditor,
// BRTimeline). Index = track slot assigned to a character (charMap).

export const TRACK_HEXES = ['#f5c518', '#7ec0ff', '#f08aaf', '#7ed4a8']

const soft = (r, g, b) => `rgba(${r},${g},${b},0.10)`

export const TRACK_COLORS = [
  { hex: '#f5c518', bg: soft(245, 197, 24),  soft: soft(245, 197, 24),  text: '#f5c518', label: '#f5c518' },
  { hex: '#7ec0ff', bg: soft(126, 192, 255), soft: soft(126, 192, 255), text: '#7ec0ff', label: '#7ec0ff' },
  { hex: '#f08aaf', bg: soft(240, 138, 175), soft: soft(240, 138, 175), text: '#f08aaf', label: '#f08aaf' },
  { hex: '#7ed4a8', bg: soft(126, 212, 168), soft: soft(126, 212, 168), text: '#7ed4a8', label: '#7ed4a8' },
]

export const trackColor = i => TRACK_COLORS[(i ?? 0) % TRACK_COLORS.length]
