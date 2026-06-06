import React from 'react'

// Shared inline-SVG icon — thin-stroke pro-tool look.
// d is either an SVG path string or a fragment of SVG primitives.
export const Icon = ({ d, size = 16, fill, stroke = 'currentColor', sw = 1.7, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill || 'none'}
    stroke={fill ? 'none' : stroke}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0, ...style }}
  >
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
)

export const ICONS = {
  // Transport
  play:   'M8 5l11 7-11 7V5z',
  pause:  <><rect x="7" y="5" width="3" height="14" rx="0.5" /><rect x="14" y="5" width="3" height="14" rx="0.5" /></>,
  start:  <><path d="M19 5l-10 7 10 7V5z" /><line x1="6" y1="5" x2="6" y2="19" /></>,
  end:    <><path d="M5 5l10 7-10 7V5z" /><line x1="18" y1="5" x2="18" y2="19" /></>,
  prev:   'M16 6L8 12l8 6V6z',
  next:   'M8 6l8 6-8 6V6z',
  stop:   <rect x="6" y="6" width="12" height="12" rx="1" />,
  // Editing
  mic:      <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6" /></>,
  rec:      <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />,
  scissors: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" /></>,
  in:       <><line x1="4" y1="12" x2="14" y2="12" /><polyline points="11 8 15 12 11 16" /><line x1="19" y1="5" x2="19" y2="19" /></>,
  out:      <><line x1="20" y1="12" x2="10" y2="12" /><polyline points="13 8 9 12 13 16" /><line x1="5" y1="5" x2="5" y2="19" /></>,
  breath:   <><path d="M3 14c0-3 2-5 5-5s3 3 6 3 5-2 5-5" /><circle cx="8" cy="14" r="1.6" /><circle cx="14" cy="12" r="1.6" /></>,
  reactions:<><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></>,
  note:     <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><polyline points="14 3 14 9 20 9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></>,
  loop:     <><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></>,
  lock:     <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></>,
  lockOpen: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0" /></>,
  edit:     <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  trash:    <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>,
  // Nav / chrome
  upload:   <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  film:     <><rect x="2" y="2" width="20" height="20" rx="2" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /></>,
  grid:     <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  smile:    <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9.5" x2="9.01" y2="9.5" /><line x1="15" y1="9.5" x2="15.01" y2="9.5" /></>,
  settings: <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /><circle cx="9" cy="7" r="2" fill="currentColor" /><circle cx="15" cy="12" r="2" fill="currentColor" /><circle cx="8" cy="17" r="2" fill="currentColor" /></>,
  link:     <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></>,
  kbd:      <><rect x="2" y="6" width="20" height="12" rx="2" /><line x1="6" y1="10" x2="6" y2="10" /><line x1="10" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="14" y2="10" /><line x1="18" y1="10" x2="18" y2="10" /><line x1="7" y1="14" x2="17" y2="14" /></>,
  user:     <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0116 0v1" /></>,
  search:   <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  // Misc
  plus:    'M12 5v14M5 12h14',
  close:   'M18 6L6 18M6 6l12 12',
  check:   'M5 12l5 5 9-11',
  chevron: 'M6 9l6 6 6-6',
  back:    <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
  zoomIn:  <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></>,
  zoomOut: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></>,
  volume:  <><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" /></>,
  mute:    <><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>,
  audio:   <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  gif:     <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M9 10a2 2 0 10-2 2h1v-1M13 9v6M17 9v6M17 9h-3v3h2" /></>,
  // Misc (redesign foundation parity — replaces emoji)
  wave:     <><path d="M5 8v8M8 5v14M11 9v6M14 4v16M17 8v8M20 10v4" /></>,
  edit2:    <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  meme2:    <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="9" r="1.4" /><path d="M7 16c1.2-1.6 3-2.4 5-2.4s3.8.8 5 2.4" /></>,
  activity: <path d="M3 12h4l2.5-7 5 18 2.5-11H21" />,
  loop2:   <><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></>,
  globe:   <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18 14 14 0 010-18z" /></>,
  folder:  <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  sliders: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
}
