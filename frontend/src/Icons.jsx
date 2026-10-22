import React from 'react'

// Single line-icon set, 24-grid, currentColor — port of redesign foundation.jsx
// (ICONS + Icon). Stroke 1.7 at ≤16px, 1.85 above.
export const Icon = ({ d, size = 18, sw, stroke, fill, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={fill || 'none'} stroke={fill ? 'none' : (stroke || 'currentColor')}
    strokeWidth={sw || (size <= 16 ? 1.7 : 1.85)} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0, ...style }}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
)

const REFERENCE = {
  library:  <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  import:   <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 9 12 4 17 9"/><line x1="12" y1="4" x2="12" y2="16"/></>,
  edit:     <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  mic:      <><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18.5V22M8.5 22h7"/></>,
  meme:     <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.4"/><path d="M7 16c1.2-1.6 3-2.4 5-2.4s3.8.8 5 2.4"/></>,
  activity: <><path d="M3 12h4l2.5-7 5 18 2.5-11H21"/></>,
  settings: <><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.7 1.7 0 00.4 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.4 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.4-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1A1.7 1.7 0 004.6 8.6a1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.4H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></>,
  play:     'M8 5l12 7-12 7V5z',
  pause:    <><rect x="7" y="5" width="3.2" height="14" rx="1"/><rect x="13.8" y="5" width="3.2" height="14" rx="1"/></>,
  prevFrame:<><polygon points="18 6 9 12 18 18 18 6"/><line x1="6" y1="5" x2="6" y2="19"/></>,
  nextFrame:<><polygon points="6 6 15 12 6 18 6 6"/><line x1="18" y1="5" x2="18" y2="19"/></>,
  skipBack: <><polygon points="19 5 9 12 19 19 19 5"/><line x1="6" y1="5" x2="6" y2="19"/></>,
  skipFwd:  <><polygon points="5 5 15 12 5 19 5 5"/><line x1="18" y1="5" x2="18" y2="19"/></>,
  rec:      <circle cx="12" cy="12" r="6.5" fill="currentColor" stroke="none"/>,
  search:   <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  sidebar:  <><rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="15" y1="4" x2="15" y2="20"/></>,
  plus:     'M12 5v14M5 12h14',
  close:    'M18 6L6 18M6 6l12 12',
  check:    'M20 6L9 17l-5-5',
  chevron:  'M6 9l6 6 6-6',
  chevronR: 'M9 6l6 6-6 6',
  chevronL: 'M15 6l-6 6 6 6',
  download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  upload:   <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>,
  scissors: <><circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></>,
  loop:     <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></>,
  lock:     <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></>,
  unlock:   <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 017-1.5"/></>,
  volume:   <><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19 5.5a10 10 0 010 13M15.5 8.5a5 5 0 010 7"/></>,
  mute:     <><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></>,
  zoomIn:   <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  zoomOut:  <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  wave:     <><line x1="3" y1="12" x2="3" y2="12"/><path d="M5 8v8M8 5v14M11 9v6M14 4v16M17 8v8M20 10v4"/></>,
  film:     <><rect x="2.5" y="3" width="19" height="18" rx="2.5"/><line x1="7.5" y1="3" x2="7.5" y2="21"/><line x1="16.5" y1="3" x2="16.5" y2="21"/><line x1="2.5" y1="12" x2="21.5" y2="12"/></>,
  user:     <><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0116 0v1"/></>,
  logout:   <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  users:    <><circle cx="9" cy="8" r="3.5"/><path d="M2 21v-1a7 7 0 0114 0v1"/><path d="M16 5.5a3.5 3.5 0 010 6.5M22 21v-1a7 7 0 00-5-6.7"/></>,
  note:     <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></>,
  command:  <><path d="M9 6a3 3 0 10-3 3h12a3 3 0 10-3-3v12a3 3 0 103-3H6a3 3 0 10 3 3z"/></>,
  sparkle:  'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z',
  flag:     <><path d="M4 21V4M4 4h13l-2 4 2 4H4"/></>,
  grid:     <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  eye:      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
  plug:     <><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 01-10 0V8zM12 16v6"/></>,
  breath:   <><path d="M3 14c0-3 2-5 5-5s3 3 6 3 5-2 5-5"/><circle cx="8" cy="14" r="1.6"/><circle cx="14" cy="12" r="1.6"/></>,
  sub:      <><rect x="3" y="5" width="18" height="14" rx="2.5"/><line x1="7" y1="11" x2="13" y2="11"/><line x1="7" y1="15" x2="17" y2="15"/></>,
  folder:   <><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></>,
  clock:    <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  target:   <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></>,
  layers:   <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  type:     <><path d="M4 7V5h16v2M9 5v14M7 19h4"/><path d="M14 11v-1h6v1M17 10v9M15.5 19h3"/></>,
  move:     <><path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/></>,
  undo:     <><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/></>,
  redo:     <><path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/></>,
  keyboard: <><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></>,
  book:     <><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/></>,
  globe:    <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18 14 14 0 010-18z"/></>,
  proxy:    <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9l4 3-4 3M14 15h3"/></>,
}

// App keys the reference lacks. Aliases point at the reference glyph of the
// same meaning; the rest keep their own paths.
const APP_ONLY = {
  start:    REFERENCE.skipBack,
  end:      REFERENCE.skipFwd,
  edit2:    REFERENCE.edit,
  meme2:    REFERENCE.meme,
  loop2:    REFERENCE.loop,
  lockOpen: REFERENCE.unlock,
  kbd:      REFERENCE.keyboard,
  x:        REFERENCE.close,
  prev:     'M16 6L8 12l8 6V6z',
  next:     'M8 6l8 6-8 6V6z',
  stop:     <rect x="6" y="6" width="12" height="12" rx="1" />,
  in:       <><line x1="4" y1="12" x2="14" y2="12" /><polyline points="11 8 15 12 11 16" /><line x1="19" y1="5" x2="19" y2="19" /></>,
  out:      <><line x1="20" y1="12" x2="10" y2="12" /><polyline points="13 8 9 12 13 16" /><line x1="5" y1="5" x2="5" y2="19" /></>,
  reactions:<><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></>,
  smile:    <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9.5" x2="9.01" y2="9.5" /><line x1="15" y1="9.5" x2="15.01" y2="9.5" /></>,
  link:     <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></>,
  warn:     <><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  dot:      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
  back:     <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
  audio:    <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  gif:      <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M9 10a2 2 0 10-2 2h1v-1M13 9v6M17 9v6M17 9h-3v3h2" /></>,
  sliders:  <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
}

export const ICONS = { ...APP_ONLY, ...REFERENCE }
