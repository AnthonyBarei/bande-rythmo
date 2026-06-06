/* ============================================================
   Bande Rythmo — Studio redesign · FOUNDATION
   Fresh design language, same dark + yellow identity.
   Exposes window.RD = { T (tokens), Icon, ICONS, primitives... }
   ============================================================ */
(function () {
  // ── Tokens ────────────────────────────────────────────────
  const T = {
    // base palette (kept identity: near-black + yellow)
    bg:       '#0b0b0d',
    bg2:      '#101013',
    surface:  '#16161a',
    surface2: '#1c1c21',
    surface3: '#24242b',
    border:   '#26262d',
    border2:  '#32323b',
    border3:  '#3f3f4a',
    text:     '#ECECEF',
    text2:    '#A6A6AE',
    text3:    '#7A7A85',
    text4:    '#565660',
    accent:   '#F5C518',
    accentDim:'rgba(245,197,24,0.13)',
    danger:   '#E8595D',
    success:  '#5EC27C',
    info:     '#5AA9F0',
    violet:   '#A98BF0',
    // character track colors
    tracks: [
      { name: 'LÉA',   hex: '#F5C518' },
      { name: 'MARC',  hex: '#5AA9F0' },
      { name: 'SARAH', hex: '#F06AA0' },
      { name: 'NOAH',  hex: '#5EC27C' },
    ],
    fontUI:   "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
    fontMono: "'JetBrains Mono', 'SF Mono', monospace",
    // type scale
    fs: { micro: 11, xs: 12, sm: 13, base: 14, md: 16, lg: 20, xl: 26, xxl: 34 },
    // radii
    r: { chip: 6, ctl: 9, card: 14, lg: 18 },
    // shadow
    shadow:  '0 8px 30px rgba(0,0,0,.40)',
    shadowL: '0 18px 60px rgba(0,0,0,.55)',
    glow: (c) => `0 0 0 1px ${c}55, 0 0 24px ${c}33`,
  };

  // ── Icons (single line-icon set, 24-grid, currentColor) ───
  const ICONS = {
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
    plus:     'M12 5v14M5 12h14',
    close:    'M18 6L6 18M6 6l12 12',
    check:    'M20 6L9 17l-5-5',
    chevron:  'M6 9l6 6 6-6',
    chevronR: 'M9 6l6 6-6 6',
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
  };

  const Icon = ({ d, size = 18, sw, stroke, fill, style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={fill || 'none'} stroke={fill ? 'none' : (stroke || 'currentColor')}
      strokeWidth={sw || (size <= 16 ? 1.7 : 1.85)} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}>
      {typeof d === 'string' ? <path d={d} /> : d}
    </svg>
  );

  // ── Primitives ────────────────────────────────────────────
  function Btn({ children, variant = 'ghost', size = 'md', icon, iconR, active, danger, onClick, title, style, full }) {
    const [h, setH] = React.useState(false);
    const H = { sm: 30, md: 36, lg: 42 }[size];
    const pad = { sm: '0 12px', md: '0 15px', lg: '0 20px' }[size];
    const fz = { sm: T.fs.xs, md: T.fs.sm, lg: T.fs.base }[size];
    let bg = 'transparent', col = T.text2, bord = '1px solid transparent';
    if (variant === 'primary') { bg = h ? '#ffd83a' : T.accent; col = '#0b0b0d'; }
    else if (variant === 'solid') { bg = h ? T.surface3 : T.surface2; col = T.text; bord = `1px solid ${T.border2}`; }
    else if (variant === 'outline') { bg = h ? T.surface : 'transparent'; col = T.text; bord = `1px solid ${T.border2}`; }
    else { bg = h ? T.surface2 : 'transparent'; col = active ? T.accent : T.text2; }
    if (active && variant === 'ghost') bg = T.accentDim;
    if (danger) { col = T.danger; if (h) bg = 'rgba(232,89,93,.13)'; }
    return (
      <button onClick={onClick} title={title}
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{
          height: H, minWidth: H, padding: icon && !children ? 0 : pad, borderRadius: T.r.ctl,
          background: bg, color: col, border: bord, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: fz, fontWeight: variant === 'primary' ? 600 : 500, fontFamily: T.fontUI,
          width: full ? '100%' : undefined, transition: 'background .14s, color .14s', flexShrink: 0,
          ...style,
        }}>
        {icon && <Icon d={icon} size={fz + 3} stroke={col} fill={icon === ICONS.rec ? col : undefined} />}
        {children}
        {iconR && <Icon d={iconR} size={fz + 2} stroke={col} />}
      </button>
    );
  }

  function Chip({ children, color, soft, active, onClick, style }) {
    const c = color || T.accent;
    return (
      <span onClick={onClick} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px',
        borderRadius: 99, fontSize: T.fs.xs, fontWeight: 600, cursor: onClick ? 'pointer' : 'default',
        background: active ? c : (soft ? c + '1c' : T.surface2),
        color: active ? '#0b0b0d' : c,
        border: `1px solid ${active ? c : c + '33'}`, ...style,
      }}>{children}</span>
    );
  }

  function Dot({ color = T.accent, size = 8, pulse }) {
    return (
      <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
        {pulse && <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${color}`, opacity: .4 }} />}
      </span>
    );
  }

  function Card({ children, pad = 16, style, hover, onClick }) {
    const [h, setH] = React.useState(false);
    return (
      <div onClick={onClick}
        onMouseEnter={() => hover && setH(true)} onMouseLeave={() => hover && setH(false)}
        style={{
          background: T.surface, border: `1px solid ${h ? T.border2 : T.border}`,
          borderRadius: T.r.card, padding: pad, transition: 'border-color .15s, transform .15s',
          transform: h ? 'translateY(-2px)' : 'none', cursor: onClick ? 'pointer' : 'default', ...style,
        }}>{children}</div>
    );
  }

  function Avatar({ name, color, size = 28, ring }) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: color + '24', border: `1.5px solid ${color}${ring ? '' : '99'}`,
        boxShadow: ring ? `0 0 0 2px ${color}33` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.42, fontWeight: 700, color, fontFamily: T.fontMono,
      }}>{(name || '?')[0].toUpperCase()}</div>
    );
  }

  function SectionLabel({ children, style }) {
    return <div style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.4, color: T.text3, ...style }}>{children}</div>;
  }

  function Kbd({ children }) {
    return <span style={{
      padding: '1px 6px', borderRadius: 5, background: T.surface2, border: `1px solid ${T.border2}`,
      fontFamily: T.fontMono, fontSize: 10.5, color: T.text2, lineHeight: 1.6,
    }}>{children}</span>;
  }

  function Toggle({ on, onClick, color }) {
    const c = color || T.accent;
    return (
      <div onClick={onClick} style={{
        width: 38, height: 22, borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer',
        background: on ? c : T.surface3, border: `1px solid ${on ? c : T.border2}`, transition: 'background .15s',
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: on ? '#0b0b0d' : T.text3,
          position: 'absolute', top: 1, left: on ? 17 : 1, transition: 'left .16s',
        }} />
      </div>
    );
  }

  function Segmented({ options, value, onChange, size = 'md' }) {
    const H = size === 'sm' ? 28 : 34;
    return (
      <div style={{ display: 'inline-flex', gap: 3, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, padding: 3 }}>
        {options.map(o => {
          const active = o.v === value;
          return (
            <button key={o.v} onClick={() => onChange?.(o.v)} title={o.desc}
              style={{
                height: H - 6, padding: '0 12px', borderRadius: T.r.chip, border: 'none', cursor: 'pointer',
                background: active ? T.accent : 'transparent', color: active ? '#0b0b0d' : T.text2,
                fontSize: T.fs.xs, fontWeight: active ? 700 : 500, fontFamily: T.fontUI,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              {o.icon && <Icon d={o.icon} size={13} stroke={active ? '#0b0b0d' : 'currentColor'} />}
              {o.l}
            </button>
          );
        })}
      </div>
    );
  }

  // ── Popover / Dropdown / Menu ─────────────────────────────
  function Popover({ trigger, children, align = 'left', width = 240 }) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (!open) return;
      const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
      setTimeout(() => document.addEventListener('mousedown', onDown), 0);
      document.addEventListener('keydown', onKey);
      return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);
    return (
      <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
        {trigger(open, () => setOpen(o => !o))}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 90, width,
            background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card,
            boxShadow: T.shadowL, padding: 6, overflow: 'hidden',
          }}>
            {typeof children === 'function' ? children(() => setOpen(false)) : children}
          </div>
        )}
      </div>
    );
  }

  function MenuItem({ icon, children, onClick, active, danger, color, right, sub }) {
    const [h, setH] = React.useState(false);
    const c = danger ? T.danger : (active ? T.accent : (color || T.text));
    return (
      <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: T.r.ctl,
          background: h ? (danger ? 'rgba(232,89,93,.12)' : T.surface2) : 'transparent', border: 'none', cursor: 'pointer',
          color: c, textAlign: 'left', fontSize: T.fs.sm, fontFamily: T.fontUI,
        }}>
        {icon && (typeof icon === 'string' && icon.length <= 2 ? <span style={{ width: 16, textAlign: 'center', fontFamily: T.fontMono, fontWeight: 700 }}>{icon}</span> : <Icon d={icon} size={15} stroke={c} />)}
        <span style={{ flex: 1 }}>{children}{sub && <span style={{ display: 'block', fontSize: 10, color: T.text3, marginTop: 1 }}>{sub}</span>}</span>
        {active && <Icon d={ICONS.check} size={14} stroke={T.accent} />}
        {right}
      </button>
    );
  }

  function MenuLabel({ children }) {
    return <div style={{ padding: '6px 10px 4px', fontSize: 9.5, letterSpacing: 1.2, fontWeight: 700, color: T.text3, textTransform: 'uppercase' }}>{children}</div>;
  }
  function MenuSep() { return <div style={{ height: 1, background: T.border, margin: '5px 4px' }} />; }

  // Native-feeling Select (opens a Popover menu)
  function Select({ value, options, onChange, width = 'auto', size = 'md', placeholder }) {
    const H = { sm: 30, md: 36 }[size] || 36;
    const cur = options.find(o => o.v === value);
    return (
      <Popover width={typeof width === 'number' ? width : 200}
        trigger={(open, toggle) => (
          <button onClick={toggle} style={{
            height: H, padding: '0 11px', borderRadius: T.r.ctl, cursor: 'pointer',
            background: T.surface, border: `1px solid ${open ? T.accent : T.border2}`, color: T.text,
            display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: T.fs.sm, fontFamily: T.fontUI,
            width: typeof width === 'number' ? width : 'auto', justifyContent: 'space-between',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: cur ? T.text : T.text3 }}>
              {cur?.dot && <Dot color={cur.dot} size={7} />}{cur ? cur.l : (placeholder || 'Choisir…')}
            </span>
            <Icon d={ICONS.chevron} size={13} stroke={T.text3} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
        )}>
        {(close) => options.map(o => (
          <MenuItem key={o.v} active={o.v === value} color={o.color} icon={o.dot ? undefined : o.icon}
            onClick={() => { onChange?.(o.v); close(); }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{o.dot && <Dot color={o.dot} size={7} />}{o.l}</span>
          </MenuItem>
        ))}
      </Popover>
    );
  }

  function ProgressBar({ pct, color, h = 5 }) {
    const c = color || T.accent;
    return (
      <div style={{ height: h, background: T.surface3, borderRadius: h, overflow: 'hidden', width: '100%' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: h, transition: 'width .3s' }} />
      </div>
    );
  }

  const fmtTC = (sec, fps = 24) => {
    const f = Math.floor((sec % 1) * fps);
    const s = Math.floor(sec) % 60, m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
  };
  const fmt = (sec) => {
    const s = Math.floor(sec) % 60, m = Math.floor(sec / 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  window.RD = { T, Icon, ICONS, Btn, Chip, Dot, Card, Avatar, SectionLabel, Kbd, Toggle, Segmented, ProgressBar, Popover, MenuItem, MenuLabel, MenuSep, Select, fmtTC, fmt };
})();
