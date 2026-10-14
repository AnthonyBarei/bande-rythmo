/* Screen — Import (sources, stream/track picker, zoomable drag-to-create timeline, batch) */
(function () {
  const { T, Icon, ICONS, Btn, Chip, Dot, Kbd, fmtTC } = window.RD;
  const { PLEX } = window.RDATA;

  function Import({ go, accent }) {
    const [src, setSrc] = React.useState('upload');
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '26px 32px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 600, marginBottom: 4 }}>IMPORTER</div>
              <div style={{ fontSize: T.fs.xxl, fontWeight: 600, letterSpacing: -0.6 }}>Une_episode_brut.mp4</div>
              <div style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                42:18 · 1.2 GB · 24 fps · 1920×1080
                <Dot color={T.success} size={6} /> <span style={{ color: T.success }}>depuis Plex · Films / Saison 02</span>
              </div>
            </div>
            <Btn variant="solid" icon={ICONS.scissors}>Marquer un clip</Btn>
            <Btn variant="primary" size="lg" onClick={() => go('library')}>
              Créer 3 clips <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4 }}><Kbd>⌘</Kbd><Kbd>S</Kbd></span>
            </Btn>
          </div>

          {/* Source switcher */}
          <div style={{ display: 'flex', gap: 6, padding: 5, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, width: 'fit-content' }}>
            {[
              { id: 'upload', label: 'Fichier local', ic: ICONS.upload, hint: 'glisser un .mp4' },
              { id: 'plex', label: 'Plex', ic: ICONS.film, hint: '192.168.1.4:32400', online: true },
              { id: 'url', label: 'URL / Stream', ic: ICONS.plug, hint: 'http://…' },
            ].map(s => {
              const active = s.id === src;
              return (
                <button key={s.id} onClick={() => setSrc(s.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 15px', borderRadius: T.r.chip,
                  border: 'none', cursor: 'pointer', background: active ? T.bg2 : 'transparent',
                  color: active ? T.text : T.text2, fontSize: T.fs.sm, fontWeight: active ? 600 : 500,
                  boxShadow: active ? `inset 0 -2px 0 ${accent}` : 'none', fontFamily: T.fontUI,
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
          {src === 'plex' ? <PlexBrowse accent={accent} /> : (
            <>
              {/* Left: preview + timeline + pending */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
    return (
      <div style={{
        flex: 1, minHeight: 0, background: '#000', borderRadius: T.r.card, border: `1px solid ${T.border}`,
        position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: '58%', aspectRatio: '16/9', background: `repeating-linear-gradient(0deg,#181820 0 2px,#1c1c24 2px 6px)`, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text4, fontSize: 11, letterSpacing: 4, fontFamily: T.fontMono }}>SOURCE</div>
        <div style={{ position: 'absolute', top: 14, left: 16, padding: '4px 10px', background: 'rgba(0,0,0,.6)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 11, color: T.text2, backdropFilter: 'blur(6px)' }}>
          <span style={{ color: accent }}>●</span> 12:34:06 / 42:18:00
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
    const winW = 1 / zoom, viewStart = 0.22, toView = (f) => (f - viewStart) / winW;
    const blocks = [
      { s: 0.245, e: 0.258, c: accent }, { s: 0.30, e: 0.33, c: accent }, { s: 0.36, e: 0.365, c: accent, draft: true }, { s: 0.50, e: 0.515, c: T.success, saved: true },
    ];
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, overflow: 'hidden' }}>
        <div style={{ height: 38, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: T.fs.micro, letterSpacing: 1.2, color: T.text3, fontWeight: 700 }}>TIMELINE</span>
          <span style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono }}>09:18 – 23:24 sur 42:18</span>
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
        <div style={{ height: 26, background: T.bg2, borderTop: `1px solid ${T.border}`, position: 'relative' }}>
          {blocks.map((b, i) => (
            <div key={i} style={{ position: 'absolute', left: `${b.s * 100}%`, width: `${Math.max(0.4, (b.e - b.s) * 100)}%`, top: 6, bottom: 6, background: b.saved ? T.success : b.c, opacity: 0.7, borderRadius: 1 }} />
          ))}
          <div style={{ position: 'absolute', left: `${viewStart * 100}%`, width: `${winW * 100}%`, top: 0, bottom: 0, background: accent + '1a', border: `1px solid ${accent}`, borderRadius: 3 }} />
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
