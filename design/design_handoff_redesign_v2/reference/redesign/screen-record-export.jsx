/* Screens — Studio d'enregistrement + Export */
(function () {
  const { T, Icon, ICONS, Btn, Chip, Dot, Avatar, Segmented, Toggle, ProgressBar, fmt, fmtTC } = window.RD;
  const { SUBS, TAKES } = window.RDATA;
  const trackOf = (n) => T.tracks.find(t => t.name === n) || T.tracks[0];

  if (!document.getElementById('st-kf')) { const st = document.createElement('style'); st.id = 'st-kf'; st.textContent = '@keyframes stCount{0%{transform:scale(1.5);opacity:0}25%{opacity:1}100%{transform:scale(.9);opacity:.15}}@keyframes stBlink{50%{opacity:0}}@keyframes stIn{from{transform:translateY(-6px);opacity:0}to{transform:none;opacity:1}}'; document.head.appendChild(st); }
  // ════════════ RECORD ════════════
  // Real dubbing stage: image + bande rythmo scroll together, pre-roll 3·2·1 with bips, REC over the line, take auto-added.
  function Record({ go, accent }) {
    const idx = 5, target = SUBS[idx], tc = trackOf(target.char);
    const PRE = 3;
    const [t, setT] = React.useState(target.start - PRE);
    const [phase, setPhase] = React.useState('idle'); // idle · preroll · rec · review
    const [ab, setAb] = React.useState(false);
    const [takes, setTakes] = React.useState(TAKES.map(x => ({ ...x })));
    const [selTake, setSelTake] = React.useState(null);
    const [playTake, setPlayTake] = React.useState(null); // { n, p }
    const [lvl, setLvl] = React.useState(Array(32).fill(0.08));
    const tRef = React.useRef(t); tRef.current = t;
    const Band = window.RScreens._Band;
    const [bandH, setBandH] = React.useState(150);
    React.useEffect(() => { const fit = () => setBandH(window.innerHeight < 760 ? 110 : window.innerHeight < 900 ? 140 : 170); fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, []);
    const live = phase === 'preroll' || phase === 'rec' || phase === 'review';
    React.useEffect(() => {
      if (!live) return;
      let raf, last = performance.now();
      const loop = (now) => {
        const dt = (now - last) / 1000; last = now;
        const n = tRef.current + dt;
        if (phase === 'preroll' && n >= target.start) setPhase('rec');
        if ((phase === 'rec' || phase === 'review') && n >= target.end + 0.6) {
          if (phase === 'rec') { const num = Math.max(0, ...takes.map(k => k.n)) + 1; setTakes(k => [{ n: num, label: 'Prise ' + num, dur: +(target.end - target.start).toFixed(1), level: 0.9, fresh: true }, ...k]); setSelTake(num); }
          setPhase('idle'); setT(target.start - PRE); return;
        }
        setT(n); raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
    }, [phase]);
    React.useEffect(() => {
      const id = setInterval(() => setLvl(p => p.map(() => phase === 'rec' ? Math.random() * 0.85 + 0.12 : Math.max(0.05, Math.random() * 0.16))), 80);
      return () => clearInterval(id);
    }, [phase]);
    React.useEffect(() => {
      if (!playTake) return;
      const tk = takes.find(k => k.n === playTake.n); if (!tk) return;
      let raf, t0 = performance.now() - playTake.p * tk.dur * 1000;
      const loop = (now) => { const p = (now - t0) / (tk.dur * 1000); if (p >= 1) { setPlayTake(null); return; } setPlayTake({ n: tk.n, p }); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
    }, [playTake && playTake.n]);
    React.useEffect(() => {
      const k = (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === 'r' || e.key === 'R') { e.preventDefault(); toggleRec(); } };
      window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
    });
    const toggleRec = () => { if (phase === 'idle') { setPlayTake(null); setT(target.start - PRE); setPhase('preroll'); } else { setPhase('idle'); setT(target.start - PRE); } };
    const count = phase === 'preroll' ? Math.ceil(target.start - t) : 0;
    const recEl = phase === 'rec' ? Math.max(0, t - target.start) : 0;
    const validated = takes.find(k => k.best);

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ScreenHeader kicker="STUDIO" title="Enregistrement" sub={`S02E04 — confrontation cuisine · réplique ${idx + 1} / ${SUBS.length}`}
          right={<Btn variant="outline" icon={ICONS.chevronL} onClick={() => go('editor')}>Retour à l'éditeur</Btn>} />
        <div style={{ flex: 1, minHeight: 0, padding: '4px 32px 24px', display: 'flex', gap: 20, overflow: 'hidden' }}>
          {/* Left: dubbing stage */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#000', border: `1px solid ${phase === 'rec' ? T.danger + '88' : T.border}`, borderRadius: T.r.card, overflow: 'hidden', transition: 'border-color .2s' }}>
            {/* line strip */}
            <div style={{ height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
              <Avatar name={target.char} color={tc.hex} size={30} ring />
              <span style={{ fontSize: T.fs.sm, fontWeight: 700, color: tc.hex }}>{target.char}</span>
              <span style={{ fontSize: T.fs.md, color: T.text, fontFamily: "'Caveat', cursive", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{target.text}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{fmtTC(target.start, 24)} → {fmtTC(target.end, 24)}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <Btn size="sm" icon={ICONS.skipBack} title="Réplique précédente" /><Btn size="sm" icon={ICONS.skipFwd} title="Réplique suivante" />
              </div>
            </div>
            {/* image */}
            <div style={{ flex: 1, minHeight: 80, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <div style={{ height: '94%', aspectRatio: '16/9', maxWidth: '96%', background: `repeating-linear-gradient(0deg,#15151b 0 2px,#1a1a20 2px 6px)`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <span style={{ color: T.text4, fontSize: 11, letterSpacing: 4, fontFamily: T.fontMono }}>IMAGE</span>
                {phase === 'preroll' && (
                  <div key={count} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.35)', animation: 'stCount .9s ease-out' }}>
                    <span style={{ fontSize: 96, fontWeight: 800, color: accent, fontFamily: T.fontMono, textShadow: `0 0 40px ${accent}66` }}>{count}</span>
                  </div>
                )}
              </div>
              <div style={{ position: 'absolute', top: 12, left: 14, padding: '4px 10px', background: 'rgba(0,0,0,.65)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 12, color: T.text, display: 'flex', alignItems: 'center', gap: 7 }}>
                {phase === 'rec' ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: T.danger, animation: 'stBlink 1s steps(2) infinite' }} /><span style={{ color: T.danger, fontWeight: 700 }}>REC</span></> : <Dot color={phase === 'preroll' ? accent : T.text4} size={6} />}
                {fmtTC(Math.max(0, t), 24)}
              </div>
              <div style={{ position: 'absolute', top: 12, right: 14, display: 'flex', gap: 6 }}>
                <Chip soft color={accent}><Icon d={ICONS.loop} size={11} stroke={accent} /> Pré-roll {PRE}s</Chip>
                <Chip soft color={T.text2}>Micro · USB Yeti</Chip>
              </div>
            </div>
            {/* bande rythmo — same renderer as Éditeur, follows the take */}
            {Band && <Band t={Math.max(0, t)} setT={() => {}} setPlaying={() => {}} accent={accent} brStyle="classique" pxPerSec={150} font="manuscrite" showDet={true} filter={[]} h={bandH} layoutKey={phase + bandH} readOnly />}
            {/* control strip */}
            <div style={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', background: T.surface, borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, flex: 1, minWidth: 0 }}>
                {lvl.map((v, i) => <div key={i} style={{ flex: 1, maxWidth: 5, height: `${v * 100}%`, background: phase === 'rec' ? (v > 0.86 ? T.danger : accent) : T.border3, borderRadius: 2, transition: 'height .08s' }} />)}
              </div>
              <button onClick={toggleRec} title="Enregistrer / arrêter (R)" style={{
                width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                background: phase === 'idle' ? accent : T.danger, border: `3px solid ${(phase === 'idle' ? accent : T.danger) + '44'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: phase === 'rec' ? `0 0 0 6px ${T.danger}22, 0 0 24px ${T.danger}66` : 'none', transition: 'box-shadow .2s',
              }}>
                {phase === 'idle' ? <Icon d={ICONS.mic} size={20} stroke="#0b0b0d" /> : <span style={{ width: 14, height: 14, borderRadius: 3, background: '#0b0b0d' }} />}
              </button>
              <div style={{ flex: 1, minWidth: 0, fontSize: T.fs.xs, fontFamily: T.fontMono, color: T.text2, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {phase === 'idle' && <>Appuyer pour enregistrer · <span style={{ color: accent }}>R</span></>}
                {phase === 'preroll' && <span style={{ color: accent }}>Pré-roll · bip {PRE - count + 1}/{PRE}</span>}
                {phase === 'rec' && <span style={{ color: T.danger }}>● Prise en cours · {recEl.toFixed(1)}s / {(target.end - target.start).toFixed(1)}s</span>}
              </div>
            </div>
          </div>

          {/* Right: take queue + A/B */}
          <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>PRISES</span>
              <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{takes.length}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setAb(v => !v)}><Chip soft={!ab} active={ab} color={T.info}>A/B comparer</Chip></button>
            </div>
            {ab && (
              <div style={{ background: T.surface, border: `1px solid ${T.info}44`, borderRadius: T.r.ctl, padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ fontSize: T.fs.micro, color: T.info, letterSpacing: 1, fontWeight: 700 }}>COMPARAISON A / B</div>
                {[{ s: 'A', t: 'Prise 3', c: accent }, { s: 'B', t: 'Prise 2', c: T.info }].map(x => (
                  <div key={x.s} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: x.c + '22', color: x.c, fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{x.s}</div>
                    <Btn size="sm" icon={ICONS.play} style={{ width: 28, height: 28, background: T.surface2 }} />
                    <span style={{ flex: 1, fontSize: T.fs.xs, color: T.text }}>{x.t}</span>
                    <div style={{ display: 'flex', gap: 1, alignItems: 'center', height: 16 }}>
                      {Array.from({ length: 28 }).map((_, i) => <div key={i} style={{ width: 2, height: `${(Math.sin(i * 0.6 + x.s.charCodeAt(0)) * 0.4 + 0.5) * 100}%`, background: x.c + '88', borderRadius: 1 }} />)}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn size="sm" variant="outline" full>Garder A</Btn>
                  <Btn size="sm" variant="outline" full>Garder B</Btn>
                </div>
              </div>
            )}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {takes.map(tk => {
              const on = selTake === tk.n, pl = playTake && playTake.n === tk.n, p = pl ? playTake.p : 0;
              return (
              <div key={tk.n} onClick={() => setSelTake(tk.n)} style={{ background: T.surface, border: `1px solid ${on ? accent : tk.best ? accent + '55' : T.border}`, borderRadius: T.r.ctl, padding: 12, cursor: 'pointer', flexShrink: 0, animation: tk.fresh ? 'stIn .35s ease-out' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                  <button onClick={e => { e.stopPropagation(); setPlayTake(pl ? null : { n: tk.n, p: 0 }); }} title={pl ? 'Pause' : 'Écouter'}
                    style={{ width: 30, height: 30, borderRadius: T.r.chip, border: 'none', cursor: 'pointer', background: pl ? accent : T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon d={pl ? ICONS.pause : ICONS.play} size={13} stroke={pl ? '#0b0b0d' : T.text} fill={pl ? '#0b0b0d' : T.text} />
                  </button>
                  <span style={{ fontSize: T.fs.sm, fontWeight: 600 }}>{tk.label}</span>
                  {tk.best && <Chip color={accent} soft><Icon d={ICONS.check} size={10} stroke={accent} /> validée</Chip>}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: pl ? accent : T.text3, fontFamily: T.fontMono }}>{pl ? (p * tk.dur).toFixed(1) + ' / ' : ''}{tk.dur}s</span>
                  <Btn size="sm" icon={ICONS.trash} onClick={e => { e.stopPropagation(); setTakes(k => k.filter(x => x.n !== tk.n)); }} />
                </div>
                {/* waveform: played part lights up, bars near the head bounce */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.5, height: 30 }}>
                  {Array.from({ length: 56 }).map((_, i) => {
                    const base = Math.abs((Math.sin(i * 0.4 + tk.n) * 0.4 + Math.sin(i * 0.9) * 0.3 + 0.4) * tk.level);
                    const f = i / 56, played = pl && f <= p, near = pl && Math.abs(f - p) < 0.06;
                    const h = near ? Math.min(1, base * (1.25 + 0.35 * Math.sin(performance.now() / 70 + i))) : base;
                    return <div key={i} style={{ flex: 1, height: `${Math.max(6, h * 100)}%`, background: played ? accent : (on || tk.best ? accent + '55' : T.border3), borderRadius: 1, transition: near ? 'none' : 'background .1s' }} />;
                  })}
                  {pl && <div style={{ position: 'absolute', left: `${p * 100}%`, top: -3, bottom: -3, width: 2, background: '#fff', borderRadius: 1, boxShadow: '0 0 6px rgba(255,255,255,.6)' }} />}
                </div>
              </div>
            ); })}
            </div>
            <Btn variant={selTake && !(validated && validated.n === selTake) ? 'primary' : 'outline'} full icon={ICONS.check} disabled={!selTake}
              onClick={() => selTake && setTakes(k => k.map(x => ({ ...x, best: x.n === selTake, fresh: false })))}>Valider la prise sélectionnée</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ════════════ EXPORT ════════════
  const GROUPS = [
    { label: 'Vidéo bande rythmo', hint: 'regarder / partager', fmts: [
      { id: 'mp4', ext: 'MP4 + BR', ic: ICONS.film, desc: 'Vidéo avec BR incrustée', c: '#5EC27C', heavy: true },
      { id: 'gif', ext: 'GIF', ic: ICONS.layers, desc: 'Clip animé', c: '#FF6644', heavy: true },
    ]},
    { label: 'Sous-titres', hint: 'montage / compat', fmts: [
      { id: 'srt', ext: 'SRT', ic: ICONS.sub, desc: 'Standard', c: '#5AA9F0' },
      { id: 'ass', ext: 'ASS', ic: ICONS.film, desc: 'Défilement BR', c: '#A98BF0' },
      { id: 'assk', ext: 'ASS Karaoké', ic: ICONS.mic, desc: 'Tags \\kf par mot', c: '#C8A0FF' },
    ]},
    { label: 'Documents studio', hint: 'plateau', fmts: [
      { id: 'detx', ext: 'DetX', ic: ICONS.target, desc: 'Standard FR · détection', c: '#FF9944' },
      { id: 'crois', ext: 'Croisillé', ic: ICONS.grid, desc: 'Grille perso × boucles', c: '#DDAA44' },
    ]},
    { label: 'Audio', hint: 'soundboard', fmts: [
      { id: 'mp3', ext: 'MP3', ic: ICONS.volume, desc: 'Compressé', c: '#F06AA0' },
      { id: 'wav', ext: 'WAV', ic: ICONS.volume, desc: 'Sans perte', c: '#A98BF0' },
    ]},
  ];
  const QUEUE = [
    { ext: 'MP4 + BR', c: '#5EC27C', file: 'S02E04_bande_rythmo.mp4', status: 'render', pct: 46, stage: 'Supersample 4', meta: 'YouTube · ~52s' },
    { ext: 'GIF', c: '#FF6644', file: 'reaction_lea.gif', status: 'render', pct: 20, stage: 'Palette 1/2' },
    { ext: 'DetX', c: '#FF9944', file: 'S02E04.detx', status: 'ready', size: '24 KB', when: '14:31' },
    { ext: 'SRT', c: '#5AA9F0', file: 'S02E04.srt', status: 'ready', size: '3 KB', when: '14:30' },
    { ext: 'MP3', c: '#F06AA0', file: 'S02E04.mp3', status: 'ready', size: '1.1 MB', when: '14:28' },
  ];

  function Export({ go, accent }) {
    const [sel, setSel] = React.useState('mp4');
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ScreenHeader kicker="EXPORTER" title="Sortie & téléchargements" sub="S02E04 — confrontation · 14 répliques"
          right={<Btn variant="outline" icon={ICONS.chevron} onClick={() => go('editor')} style={{ transform: 'none' }}>Retour</Btn>} />
        <div style={{ flex: 1, minHeight: 0, padding: '8px 32px 28px', display: 'flex', gap: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, overflow: 'hidden', minHeight: 0 }}>
            {/* format picker */}
            <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${T.border}`, overflow: 'auto', padding: 16 }}>
              {GROUPS.map(g => (
                <div key={g.label} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 8 }}>
                    <span style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 0.8, color: T.text2 }}>{g.label.toUpperCase()}</span>
                    <span style={{ fontSize: 10.5, color: T.text4 }}>{g.hint}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {g.fmts.map(f => {
                      const on = sel === f.id;
                      return (
                        <button key={f.id} onClick={() => setSel(f.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: T.r.ctl, cursor: 'pointer', width: '100%', textAlign: 'left',
                          background: on ? f.c + '14' : T.bg2, border: `1px solid ${on ? f.c + '88' : T.border}`,
                        }}>
                          <div style={{ width: 30, height: 30, borderRadius: 7, background: f.c + '1a', border: `1px solid ${f.c}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon d={f.ic} size={15} stroke={f.c} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: T.fs.sm, fontWeight: 600, color: on ? f.c : T.text }}>{f.ext}</div>
                            <div style={{ fontSize: 10.5, color: T.text3 }}>{f.desc}</div>
                          </div>
                          {f.heavy && <span style={{ fontSize: 8.5, padding: '2px 5px', borderRadius: 3, background: T.surface2, color: T.text3, border: `1px solid ${T.border2}` }}>RENDU</span>}
                          {on && <Icon d={ICONS.check} size={14} stroke={f.c} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* options */}
            <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${T.border}`, padding: 18, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.2, color: T.text3, marginBottom: 14 }}>OPTIONS</div>
              <ExportOptions sel={sel} accent={accent} />
              <div style={{ flex: 1 }} />
              <Btn variant="primary" size="lg" full icon={ICONS.download} style={{ marginTop: 14 }}>Lancer l'export</Btn>
              <div style={{ fontSize: 10, color: T.text4, textAlign: 'center', marginTop: 8 }}>apparaît dans la liste → téléchargez quand prêt</div>
            </div>

            {/* queue */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: T.bg }}>
              <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: T.fs.base, fontWeight: 600 }}>File d'attente & téléchargements</span>
                <Chip soft color={accent}>2 en cours</Chip>
                <div style={{ flex: 1 }} />
                <Btn size="sm" variant="outline" icon={ICONS.download}>Tout télécharger</Btn>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {QUEUE.map((q, i) => <QueueRow key={i} q={q} accent={accent} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function QueueRow({ q, accent }) {
    const rend = q.status === 'render';
    return (
      <div style={{ background: T.surface, border: `1px solid ${rend ? accent + '44' : T.border}`, borderRadius: T.r.ctl, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: q.c, padding: '3px 8px', minWidth: 76, textAlign: 'center', background: q.c + '14', border: `1px solid ${q.c}33`, borderRadius: 5 }}>{q.ext}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.fs.sm, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.file}</div>
          {rend ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 6 }}>
              <ProgressBar pct={q.pct} h={4} />
              <span style={{ fontSize: 10, color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{q.stage}</span>
            </div>
          ) : <div style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, marginTop: 2 }}>{q.size} · {q.when}</div>}
        </div>
        {rend ? (
          <>
            <span style={{ fontSize: T.fs.sm, fontWeight: 700, fontFamily: T.fontMono, color: accent, minWidth: 34, textAlign: 'right' }}>{q.pct}%</span>
            <Btn size="sm" icon={ICONS.close} title="Annuler" />
          </>
        ) : (
          <>
            <Btn size="sm" variant="primary" icon={ICONS.download}>Télécharger</Btn>
            <Btn size="sm" icon={ICONS.trash} />
          </>
        )}
      </div>
    );
  }

  function RangeField({ accent }) {
    const [mode, setMode] = React.useState('full');
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2, marginBottom: 7 }}>Plage</div>
        <Segmented value={mode} onChange={setMode} options={[{ v: 'full', l: 'Clip entier' }, { v: 'custom', l: 'Personnalisée' }]} />
        {mode === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontFamily: T.fontMono, fontSize: 11 }}>
            <Chip soft color={T.info}>[ IN 00:05.0</Chip>
            <div style={{ flex: 1, textAlign: 'center', color: T.text3 }}>5.0s</div>
            <Chip soft color={accent}>OUT 00:10.0 ]</Chip>
          </div>
        )}
      </div>
    );
  }

  function ExportOptions({ sel, accent }) {
    const Row = ({ label, children }) => <div style={{ marginBottom: 16 }}><div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2, marginBottom: 7 }}>{label}</div>{children}</div>;
    const Tg = ({ label, on, desc }) => (
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
        <Toggle on={on} /><div><div style={{ fontSize: T.fs.xs, color: T.text }}>{label}</div>{desc && <div style={{ fontSize: 10, color: T.text3, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}</div>
      </label>
    );
    if (sel === 'mp4') return (<>
      <RangeField accent={accent} />
      <Row label="Qualité"><Segmented value="yt" onChange={() => {}} options={[{ v: 'draft', l: 'Draft' }, { v: 'std', l: 'Standard' }, { v: 'yt', l: 'YouTube' }]} /><div style={{ fontSize: 10, color: T.text3, marginTop: 6, fontFamily: T.fontMono }}>preset slow · crf 19 · ss4</div></Row>
      <Tg label="Incruster la détection" on={false} desc="Off par défaut — bande propre, détails dans le DetX." />
      <Row label="Police BR"><Segmented value="man" onChange={() => {}} options={[{ v: 'man', l: 'Manuscrite' }, { v: 'atk', l: 'Atkinson' }]} /></Row>
      <Tg label="Accélération GPU (NVENC)" on={true} />
    </>);
    if (sel === 'gif') return (<>
      <RangeField accent={accent} />
      <Row label="Résolution"><Segmented value="480" onChange={() => {}} options={[{ v: '360', l: '360p' }, { v: '480', l: '480p' }, { v: '720', l: '720p' }]} /></Row>
      <Row label="Fréquence"><Segmented value="15" onChange={() => {}} options={[{ v: '12', l: '12' }, { v: '15', l: '15' }, { v: '24', l: '24 fps' }]} /></Row>
      <Tg label="Boucle infinie" on={true} />
    </>);
    if (sel === 'detx' || sel === 'crois') return (<>
      <div style={{ padding: 12, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, fontSize: T.fs.xs, color: T.text2, lineHeight: 1.5, marginBottom: 14 }}>
        {sel === 'detx' ? 'Standard d\u2019échange FR — Cappella, phonations, et la couche détection.' : 'Grille personnages × boucles — le planning remis au studio.'}
      </div>
      {sel === 'detx' && <Tg label="Inclure la détection" on />}
      <Tg label="Inclure les notes de direction" on={sel === 'detx'} />
    </>);
    if (sel === 'mp3' || sel === 'wav') return (<>
      <RangeField accent={accent} />
      {sel === 'mp3' && <Row label="Débit"><Segmented value="192" onChange={() => {}} options={[{ v: '128', l: '128k' }, { v: '192', l: '192k' }, { v: '320', l: '320k' }]} /></Row>}
      <Row label="Canaux"><Segmented value="src" onChange={() => {}} options={[{ v: 'src', l: 'Source' }, { v: 'mono', l: 'Mono' }, { v: 'st', l: 'Stéréo' }]} /></Row>
      <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.5 }}>Audio de la sélection — StreamDeck, Discord, soundboards.</div>
    </>);
    return (<>
      <Row label="Encodage"><Segmented value="utf8" onChange={() => {}} options={[{ v: 'utf8', l: 'UTF-8' }, { v: '1252', l: 'CP-1252' }]} /></Row>
      <Tg label="Inclure le nom des personnages" on />
      <Tg label="Fusionner répliques courtes" on={false} desc="< 0.4s collées à la suivante." />
    </>);
  }

  // shared header
  function ScreenHeader({ kicker, title, sub, right }) {
    return (
      <div style={{ padding: '26px 32px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 600, marginBottom: 4 }}>{kicker}</div>
          <div style={{ fontSize: T.fs.xxl, fontWeight: 600, letterSpacing: -0.6 }}>{title}</div>
          {sub && <div style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, marginTop: 5 }}>{sub}</div>}
        </div>
        <div style={{ flex: 1 }} />
        {right}
      </div>
    );
  }

  window.RScreens = window.RScreens || {};
  window.RScreens.Record = Record;
  window.RScreens.Export = Export;
  window.RScreens._Header = ScreenHeader;
})();
