/* Screen — Import (sources, stream/track picker, zoomable drag-to-create timeline, batch) */
(function () {
  const { T, Icon, ICONS, Btn, Chip, Dot, Kbd, Segmented, fmtTC } = window.RD;
  const { PLEX } = window.RDATA;

  function Import({ go, accent }) {
    const [src, setSrc] = React.useState('plex');
    const [picked, setPicked] = React.useState(null);
    const MT = window.RScreens._Mediatheque;
    const pickedTitle = picked ? (picked.kind === 'episode' ? `${picked.series.title} · ${window.RScreens._mtEpCode(picked)} · ${picked.title}` : picked.title) : 'Une_episode_brut.mp4';
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '26px 32px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 600, marginBottom: 4 }}>IMPORTER</div>
              <div style={{ fontSize: T.fs.xxl, fontWeight: 600, letterSpacing: -0.6 }}>{src === 'plex' ? 'Choisir dans la médiathèque' : pickedTitle}</div>
              <div style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                {src === 'plex' ? 'Films et séries de vos serveurs Jellyfin et Plex' : <>42:18 · 1.2 GB · 24 fps · 1920×1080
                <Dot color={T.success} size={6} /> <span style={{ color: T.success }}>{picked ? `depuis Jellyfin · ${picked.kind === 'episode' ? picked.series.title + ' / Saison ' + picked.season : 'Films'}` : 'fichier local'}</span></>}
              </div>
            </div>
            {src !== 'plex' && <><Btn variant="solid" icon={ICONS.scissors}>Marquer un clip</Btn>
            <Btn variant="primary" size="lg" onClick={() => go('library')}>
              Créer 3 clips <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4 }}><Kbd>⌘</Kbd><Kbd>S</Kbd></span>
            </Btn></>}
          </div>

          {/* Source switcher */}
          <div style={{ display: 'flex', gap: 6, padding: 5, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, width: 'fit-content' }}>
            {[
              { id: 'upload', label: 'Fichier local', ic: ICONS.upload, hint: 'glisser un .mp4' },
              { id: 'plex', label: 'Médiathèque', ic: ICONS.film, hint: 'Jellyfin · Plex' },
              { id: 'url', label: 'URL / Stream', ic: ICONS.plug, hint: 'http://…' },
            ].map(s => {
              const active = s.id === src;
              return (
                <button key={s.id} onClick={() => setSrc(s.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 15px', borderRadius: T.r.chip,
                  border: `1px solid ${active ? T.border2 : 'transparent'}`, cursor: 'pointer', background: active ? T.surface3 : 'transparent',
                  color: active ? T.text : T.text2, fontSize: T.fs.sm, fontWeight: active ? 600 : 500,
                  fontFamily: T.fontUI,
                }}>
                  <Icon d={s.ic} size={15} stroke={active ? accent : 'currentColor'} />
                  {s.label}
                  {s.online && <span style={{ fontSize: 8.5, padding: '1px 5px', background: 'rgba(94,194,124,.16)', color: T.success, borderRadius: 3, fontWeight: 700 }}>● ONLINE</span>}
                  <span style={{ fontSize: 10.5, color: T.text4, marginLeft: 2 }}>{s.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, padding: '16px 32px 20px', display: 'flex', gap: 18, overflow: 'hidden' }}>
          {src === 'plex' ? (MT ? <MT accent={accent} onPick={(it) => { setPicked(it); setSrc('upload'); }} /> : <PlexBrowse accent={accent} />) : (
            <>
              {/* Left: preview + timeline + pending */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2 }}>
                <Preview accent={accent} />
                <ZoomTimeline accent={accent} />
                <PendingList accent={accent} />
              </div>
              {/* Right: stream/track picker */}
              <StreamPicker accent={accent} />
            </>
          )}
        </div>
      </div>
    );
  }

  function Preview({ accent }) {
    const DUR = 42 * 60 + 18, FPS = 24;
    const [t, setT] = React.useState(12 * 60 + 34.25);
    const [playing, setPlaying] = React.useState(false);
    const [spd, setSpd] = React.useState(1);
    const [muted, setMuted] = React.useState(false);
    const [inT, setIn] = React.useState(12 * 60 + 30);
    const [outT, setOut] = React.useState(null);
    const [hover, setHover] = React.useState(null);
    const [editTC, setEditTC] = React.useState(false);
    const clamp = (v) => Math.max(0, Math.min(DUR, v));
    React.useEffect(() => {
      if (!playing) return;
      let raf, last = performance.now();
      const loop = (now) => { const dt = (now - last) / 1000; last = now; setT(p => { const n = p + dt * spd; if (outT != null && inT != null && n > outT) return inT; return clamp(n); }); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
    }, [playing, spd, inT, outT]);
    const tc = (sec) => { const p = (n) => String(n).padStart(2, '0'); const f = Math.floor((sec % 1) * FPS); return `${p(Math.floor(sec / 3600))}:${p(Math.floor(sec / 60) % 60)}:${p(Math.floor(sec) % 60)}:${p(f)}`; };
    const parseTC = (str) => { const n = str.split(/[:.]/).map(Number); if (n.some(isNaN)) return null; while (n.length < 4) n.unshift(0); return n[0] * 3600 + n[1] * 60 + n[2] + n[3] / FPS; };
    const seekFromEvent = (e, box) => clamp(((e.clientX - box.left) / box.width) * DUR);
    const onScrubDown = (e) => {
      e.preventDefault(); const box = e.currentTarget.getBoundingClientRect(); const was = playing; setPlaying(false); setT(seekFromEvent(e, box));
      const mv = (ev) => setT(seekFromEvent(ev, box));
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (was) setPlaying(true); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    const pct = (v) => (v / DUR) * 100;
    const TB = ({ ic, title, onClick }) => <Btn size="sm" icon={ic} title={title} onClick={onClick} />;
    return (
      <div style={{ flex: '1 0 300px', minHeight: 300, background: '#000', borderRadius: T.r.card, border: `1px solid ${T.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div onClick={() => setPlaying(p => !p)} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <div style={{ width: '58%', aspectRatio: '16/9', maxHeight: '90%', background: `repeating-linear-gradient(0deg,#181820 0 2px,#1c1c24 2px 6px)`, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text4, fontSize: 11, letterSpacing: 4, fontFamily: T.fontMono }}>SOURCE</div>
          <div style={{ position: 'absolute', top: 14, left: 16, padding: '4px 10px', background: 'rgba(0,0,0,.6)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 11, color: T.text2, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot color={playing ? T.danger : accent} size={6} /> {tc(t)} <span style={{ color: T.text4 }}>/ {tc(DUR)}</span>
          </div>
        </div>
        {/* Seek bar — click / drag anywhere; IN–OUT range + hover timecode */}
        <div onPointerDown={onScrubDown} onMouseMove={e => { const b = e.currentTarget.getBoundingClientRect(); setHover({ x: e.clientX - b.left, t: seekFromEvent(e, b) }); }} onMouseLeave={() => setHover(null)}
          style={{ height: 22, flexShrink: 0, position: 'relative', background: T.surface, borderTop: `1px solid ${T.border}`, cursor: 'pointer', touchAction: 'none' }}>
          <div style={{ position: 'absolute', left: 10, right: 10, top: 9, height: 4, borderRadius: 2, background: T.surface3 }}>
            <div style={{ position: 'absolute', left: 0, width: `${pct(t)}%`, top: 0, bottom: 0, background: accent + '88', borderRadius: 2 }} />
            {inT != null && <div style={{ position: 'absolute', left: `${pct(inT)}%`, width: `${pct((outT ?? t) - inT)}%`, top: -3, bottom: -3, background: T.info + '33', borderLeft: `2px solid ${T.info}`, borderRight: outT != null ? `2px solid ${accent}` : 'none' }} />}
            <div style={{ position: 'absolute', left: `${pct(t)}%`, top: -4, width: 12, height: 12, borderRadius: '50%', background: accent, transform: 'translateX(-50%)', boxShadow: '0 1px 4px rgba(0,0,0,.5)' }} />
          </div>
          {hover && <div style={{ position: 'absolute', left: hover.x, bottom: 'calc(100% + 4px)', transform: 'translateX(-50%)', padding: '2px 6px', borderRadius: 4, background: T.surface2, border: `1px solid ${T.border2}`, fontFamily: T.fontMono, fontSize: 11, color: T.text, pointerEvents: 'none', whiteSpace: 'nowrap' }}>{tc(hover.t)}</div>}
        </div>
        {/* Player controls */}
        <div style={{ minHeight: 48, flexShrink: 0, padding: '7px 10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, rowGap: 6, background: T.surface }}>
          <TB ic={ICONS.skipBack} title="−10 s (J)" onClick={() => setT(v => clamp(v - 10))} />
          <TB ic={ICONS.prevFrame} title="Image −1 (,)" onClick={() => setT(v => clamp(v - 1 / FPS))} />
          <button onClick={() => setPlaying(p => !p)} title="Lecture / pause (Espace)" style={{ width: 40, height: 34, borderRadius: T.r.ctl, background: accent, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon d={playing ? ICONS.pause : ICONS.play} size={15} stroke="#0b0b0d" fill="#0b0b0d" />
          </button>
          <TB ic={ICONS.nextFrame} title="Image +1 (.)" onClick={() => setT(v => clamp(v + 1 / FPS))} />
          <TB ic={ICONS.skipFwd} title="+10 s (L)" onClick={() => setT(v => clamp(v + 10))} />
          {/* Editable timecode — click, type HH:MM:SS:FF, Entrée */}
          {editTC
            ? <input autoFocus defaultValue={tc(t)} onBlur={() => setEditTC(false)}
                onKeyDown={e => { if (e.key === 'Enter') { const v = parseTC(e.currentTarget.value); if (v != null) setT(clamp(v)); setEditTC(false); } if (e.key === 'Escape') setEditTC(false); }}
                style={{ width: 112, height: 30, padding: '0 8px', background: T.bg2, border: `1px solid ${accent}`, borderRadius: T.r.chip, color: T.text, fontFamily: T.fontMono, fontSize: 12, outline: 'none', marginLeft: 4 }} />
            : <button onClick={() => { setPlaying(false); setEditTC(true); }} title="Aller au timecode (cliquer pour saisir)" style={{ height: 30, padding: '0 8px', marginLeft: 4, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: T.r.chip, cursor: 'text', fontFamily: T.fontMono, fontSize: 12, color: T.text2, whiteSpace: 'nowrap' }}>
                <span style={{ color: T.text }}>{tc(t)}</span> / {tc(DUR)}
              </button>}
          <div style={{ width: 1, height: 22, background: T.border, margin: '0 4px' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, padding: 3 }}>
            <button onClick={() => { setIn(t); if (outT != null && outT <= t) setOut(null); }} title="Marquer IN (I) · clic droit : aller à IN" onContextMenu={e => { e.preventDefault(); inT != null && setT(inT); }}
              style={{ height: 26, padding: '0 9px', borderRadius: T.r.chip, border: 'none', cursor: 'pointer', background: inT != null ? T.info + '22' : 'transparent', color: inT != null ? T.info : T.text2, fontFamily: T.fontMono, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>[ IN {inT != null ? tc(inT).slice(0, 8) : '—'}</button>
            <button onClick={() => { if (inT == null || t > inT) setOut(t); }} title="Marquer OUT (O) · clic droit : aller à OUT" onContextMenu={e => { e.preventDefault(); outT != null && setT(outT); }}
              style={{ height: 26, padding: '0 9px', borderRadius: T.r.chip, border: 'none', cursor: 'pointer', background: outT != null ? accent + '22' : 'transparent', color: outT != null ? accent : T.text2, fontFamily: T.fontMono, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>OUT {outT != null ? tc(outT).slice(0, 8) : '—'} ]</button>
            <Btn size="sm" icon={ICONS.loop} title="Lire IN → OUT en boucle" onClick={() => { if (inT != null) { setT(inT); setPlaying(true); } }} style={{ height: 26, minWidth: 26 }} />
          </div>
          <div style={{ flex: 1 }} />
          <Segmented size="sm" value={spd} onChange={setSpd} options={[{ v: 0.5, l: '0.5×' }, { v: 1, l: '1×' }, { v: 2, l: '2×' }]} />
          <Btn size="sm" icon={muted ? ICONS.mute : ICONS.volume} title="Son (M)" onClick={() => setMuted(m => !m)} />
        </div>
      </div>
    );
  }

  function ZoomTimeline({ accent }) {
    const [zoom, setZoom] = React.useState(3);
    const [px, setPx] = React.useState(0.35);
    React.useEffect(() => {
      let raf; const t0 = performance.now();
      const loop = () => { const e = ((performance.now() - t0) / 1000) % 16; setPx(0.2 + (e / 16) * 0.3); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
    }, []);
    const [vs, setVs] = React.useState(0.22);
    const [dragging, setDragging] = React.useState(false);
    const winW = 1 / zoom, viewStart = Math.max(0, Math.min(1 - winW, vs)), toView = (f) => (f - viewStart) / winW;
    const DUR = 42 * 60 + 18;
    const mmss = (f) => { const s = Math.round(f * DUR); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    const dragWin = (e) => {
      e.preventDefault();
      const box = e.currentTarget.getBoundingClientRect();
      const f = (e.clientX - box.left) / box.width;
      const inside = f >= viewStart && f <= viewStart + winW;
      const off = inside ? f - viewStart : winW / 2;
      if (!inside) setVs(f - off);
      const mv = (ev) => setVs((ev.clientX - box.left) / box.width - off);
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); setDragging(false); };
      setDragging(true); window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    const blocks = [
      { s: 0.245, e: 0.258, c: accent }, { s: 0.30, e: 0.33, c: accent }, { s: 0.36, e: 0.365, c: accent, draft: true }, { s: 0.50, e: 0.515, c: T.success, saved: true },
    ];
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, overflow: 'hidden' }}>
        <div style={{ height: 38, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: T.fs.micro, letterSpacing: 1.2, color: T.text3, fontWeight: 700 }}>TIMELINE</span>
          <span style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono }}>{mmss(viewStart)} – {mmss(viewStart + winW)} sur 42:18</span>
          <div style={{ flex: 1 }} />
          <Btn size="sm" icon={ICONS.zoomOut} onClick={() => setZoom(z => Math.max(1, z - 0.5))} />
          <input type="range" min={1} max={20} step={0.5} value={zoom} onChange={e => setZoom(+e.target.value)} style={{ width: 110, accentColor: accent }} />
          <Btn size="sm" icon={ICONS.zoomIn} onClick={() => setZoom(z => Math.min(20, z + 0.5))} />
          <span style={{ fontSize: T.fs.xs, color: accent, fontFamily: T.fontMono, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{zoom.toFixed(1)}×</span>
        </div>
        {/* track */}
        <div style={{ height: 84, position: 'relative', background: `repeating-linear-gradient(90deg,transparent 0 7px,rgba(255,255,255,.012) 7px 8px)` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18, background: T.bg2, borderBottom: `1px solid ${T.border}` }} />
          <div style={{ position: 'absolute', top: 18, left: 0, right: 0, bottom: 0 }}>
            {blocks.map((b, i) => {
              const x = toView(b.s) * 100, w = (b.e - b.s) / winW * 100;
              if (x + w < -1 || x > 101) return null;
              return (
                <div key={i} style={{
                  position: 'absolute', left: `${x}%`, width: `${w}%`, top: 12, bottom: 12, borderRadius: 5,
                  background: b.draft ? 'transparent' : (b.saved ? 'rgba(94,194,124,.18)' : b.c + '26'),
                  border: b.draft ? `2px dashed ${b.c}` : `1.5px solid ${b.c}`, minWidth: 4,
                }}>
                  <div style={{ position: 'absolute', top: -15, left: 0, fontSize: 9, color: b.saved ? T.success : b.c, fontWeight: 700, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>
                    {b.saved ? '✓' : (b.draft ? '5.4s' : `#${i + 1}`)}
                  </div>
                </div>
              );
            })}
            <div style={{ position: 'absolute', left: `${toView(px) * 100}%`, top: 0, bottom: 0, width: 2, background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,.5)' }}>
              <div style={{ position: 'absolute', top: 0, left: -5, width: 12, height: 6, background: '#fff', clipPath: 'polygon(0 0,100% 0,50% 100%)' }} />
            </div>
          </div>
        </div>
        {/* minimap */}
        <div onPointerDown={dragWin} title="Glisser la fenêtre pour naviguer" style={{ height: 26, background: T.bg2, borderTop: `1px solid ${T.border}`, position: 'relative', cursor: dragging ? 'grabbing' : 'pointer', touchAction: 'none' }}>
          {blocks.map((b, i) => (
            <div key={i} style={{ position: 'absolute', left: `${b.s * 100}%`, width: `${Math.max(0.4, (b.e - b.s) * 100)}%`, top: 6, bottom: 6, background: b.saved ? T.success : b.c, opacity: 0.7, borderRadius: 1 }} />
          ))}
          <div style={{ position: 'absolute', left: `${viewStart * 100}%`, width: `${winW * 100}%`, top: 2, bottom: 2, background: accent + (dragging ? '2e' : '1a'), border: `1px solid ${accent}`, borderRadius: 4, cursor: dragging ? 'grabbing' : 'grab' }}>
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 2 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 1.5, height: 8, background: accent, borderRadius: 1 }} />)}</div>
          </div>
        </div>
      </div>
    );
  }

  function PendingList({ accent }) {
    const [editing, setEditing] = React.useState(null);
    const [rows, setRows] = React.useState([
      { name: 'S02E04 — réveil grange', tc: '00:24 → 00:52', dur: 27.6 },
      { name: 'S02E04 — confrontation', tc: '08:14 → 08:55', dur: 41.2 },
      { name: '', tc: '14:28 → 14:38', dur: 9.8, untitled: true },
    ]);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>CLIPS EN ATTENTE</span>
          <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{rows.length}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, color: T.text4 }}>cliquer le nom pour éditer · ⏎ valider</span>
        </div>
        {rows.map((c, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '20px 1fr auto auto 30px', alignItems: 'center', gap: 12,
            padding: '8px 12px', background: T.surface, border: `1px solid ${c.untitled ? T.border2 : accent + '33'}`, borderRadius: T.r.ctl,
          }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: accent + '22', color: accent, fontSize: 9.5, fontWeight: 800, fontFamily: T.fontMono, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
            {editing === i ? (
              <input autoFocus defaultValue={c.name} placeholder={`Clip ${i + 1}`}
                onBlur={e => { setRows(r => r.map((x, j) => j === i ? { ...x, name: e.target.value, untitled: !e.target.value } : x)); setEditing(null); }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(null); }}
                style={{ background: T.bg2, border: `1px solid ${accent}`, borderRadius: 6, padding: '5px 8px', fontSize: T.fs.sm, color: T.text, fontFamily: T.fontUI, outline: 'none' }} />
            ) : (
              <div onClick={() => setEditing(i)} style={{ fontSize: T.fs.sm, fontWeight: 500, color: c.untitled ? T.text3 : T.text, fontStyle: c.untitled ? 'italic' : 'normal', cursor: 'text', display: 'flex', alignItems: 'center', gap: 8 }}>
                {c.untitled ? 'Sans nom — cliquer pour nommer' : c.name}
                <Icon d={ICONS.edit} size={11} stroke={T.text4} style={{ opacity: 0.5 }} />
              </div>
            )}
            <span style={{ fontFamily: T.fontMono, fontSize: T.fs.xs, color: T.text2 }}>{c.tc}</span>
            <span style={{ fontFamily: T.fontMono, fontSize: T.fs.xs, color: accent }}>{c.dur.toFixed(1)}s</span>
            <button style={{ background: 'transparent', border: 'none', color: T.text3, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}><Icon d={ICONS.trash} size={14} /></button>
          </div>
        ))}
      </div>
    );
  }

  function StreamPicker({ accent }) {
    const [vid, setVid] = React.useState(0);
    const [aud, setAud] = React.useState(0);
    return (
      <div style={{ width: 264, flexShrink: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
        <div>
          <div style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700, marginBottom: 4 }}>FLUX DÉTECTÉS</div>
          <div style={{ fontSize: 10.5, color: T.text4 }}>ffprobe · choisir avant la découpe</div>
        </div>
        <div>
          <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2, marginBottom: 8 }}>Vidéo</div>
          {[{ l: 'H.264 · 1920×1080 · 24fps', meta: '8.2 Mb/s' }].map((s, i) => (
            <StreamRow key={i} on={vid === i} onClick={() => setVid(i)} accent={accent} icon={ICONS.film} label={s.l} meta={s.meta} />
          ))}
        </div>
        <div>
          <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2, marginBottom: 8 }}>Audio · 3 pistes</div>
          {[
            { l: 'FR · AC-3 5.1', meta: '448 kb/s' },
            { l: 'FR · AAC stéréo', meta: '192 kb/s' },
            { l: 'EN · AAC stéréo', meta: '192 kb/s' },
          ].map((s, i) => (
            <StreamRow key={i} on={aud === i} onClick={() => setAud(i)} accent={accent} icon={ICONS.volume} label={s.l} meta={s.meta} />
          ))}
        </div>
        <div style={{ padding: 11, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, fontSize: 11, color: T.text3, lineHeight: 1.5 }}>
          La piste 5.1 sera <span style={{ color: T.text2 }}>remixée en stéréo</span> au remux.
        </div>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: T.fs.xs, color: T.text2, cursor: 'pointer' }}>
          <Icon d={ICONS.check} size={14} stroke={accent} /> Transcrire après la découpe
        </label>
      </div>
    );
  }

  function StreamRow({ on, onClick, accent, icon, label, meta }) {
    return (
      <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', marginBottom: 5,
        borderRadius: T.r.ctl, cursor: 'pointer', textAlign: 'left',
        background: on ? accent + '12' : T.bg2, border: `1px solid ${on ? accent + '66' : T.border}`,
      }}>
        <Icon d={icon} size={15} stroke={on ? accent : T.text3} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.fs.xs, color: on ? T.text : T.text2, fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 10, color: T.text4, fontFamily: T.fontMono }}>{meta}</div>
        </div>
        {on && <Icon d={ICONS.check} size={14} stroke={accent} />}
      </button>
    );
  }

  function PlexBrowse({ accent }) {
    return (
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        <div style={{ width: 200, flexShrink: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, padding: 8 }}>
          <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 700, padding: '8px 10px' }}>BIBLIOTHÈQUES</div>
          {[{ n: 'Films', c: 248, on: true }, { n: 'Séries', c: 32 }, { n: 'Musique', c: 1842 }, { n: 'Photos', c: 0 }].map(b => (
            <div key={b.n} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: T.r.ctl, cursor: 'pointer',
              background: b.on ? accent + '11' : 'transparent', color: b.on ? accent : T.text2, border: b.on ? `1px solid ${accent}33` : '1px solid transparent', fontSize: T.fs.sm, fontWeight: b.on ? 600 : 500 }}>
              <Icon d={ICONS.folder} size={14} /><span style={{ flex: 1 }}>{b.n}</span>
              <span style={{ fontSize: 10, color: T.text3, fontFamily: T.fontMono }}>{b.c}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99 }}>
            <Icon d={ICONS.search} size={14} stroke={T.text3} /><span style={{ fontSize: T.fs.sm, color: T.text3 }}>Rechercher dans Films…</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, alignContent: 'flex-start' }}>
            {PLEX.map((m, i) => {
              const seed = m.title.charCodeAt(0) + m.title.charCodeAt(1);
              return (
                <div key={i} style={{ background: T.surface, border: `1px solid ${m.mine ? accent : T.border}`, borderRadius: T.r.ctl, overflow: 'hidden', cursor: 'pointer', boxShadow: m.mine ? `0 0 0 2px ${accent}33` : 'none' }}>
                  <div style={{ aspectRatio: '2/3', position: 'relative', background: `linear-gradient(135deg,hsl(${seed * 7 % 360},18%,22%),hsl(${seed * 13 % 360},16%,13%))` }}>
                    {m.mine && <div style={{ position: 'absolute', top: 6, left: 6, padding: '2px 6px', background: accent, color: '#0b0b0d', fontSize: 8.5, fontWeight: 800, borderRadius: 3 }}>SÉLECTIONNÉ</div>}
                    <div style={{ position: 'absolute', left: 8, bottom: 8, fontFamily: T.fontMono, fontSize: 9, color: 'rgba(255,255,255,.5)' }}>{m.year} · {m.dur}</div>
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: T.fs.xs, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                    <div style={{ fontSize: 10.5, color: T.text3 }}>{m.genre}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  window.RScreens = window.RScreens || {};
  window.RScreens.Import = Import;
})();
