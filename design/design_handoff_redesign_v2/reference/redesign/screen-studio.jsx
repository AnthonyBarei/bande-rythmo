/* Studio v2 — rôle explicite, Par réplique / En continu, décompte sur image figée, état « prêt » entre répliques */
(function () {
  const { T, Icon, ICONS, Btn, Chip, Dot, Avatar, Segmented, Toggle, Popover, MenuItem, MenuLabel, Kbd, fmtTC } = window.RD;
  const { SUBS, TAKES } = window.RDATA;
  const trackOf = (n) => T.tracks.find(t => t.name === n) || T.tracks[0];
  const CHARS = [...new Set(SUBS.map(s => s.char))];
  const TAIL = 0.6, OK = T.success || '#5EC27C';
  const LIVE = ['decompte', 'elan', 'rec', 'queue'];
  const pad = (n) => String(n).padStart(2, '0');
  if (!document.getElementById('st2-kf')) { const st = document.createElement('style'); st.id = 'st2-kf'; st.textContent = '@keyframes st2Count{0%{transform:scale(1.4);opacity:0}20%{opacity:1}100%{transform:scale(.92);opacity:.55}}@keyframes st2Blink{50%{opacity:0}}@keyframes st2In{from{transform:translateY(-6px);opacity:0}to{transform:none;opacity:1}}'; document.head.appendChild(st); }
  let actx = null;
  const beep = (hi) => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime; o.frequency.value = hi ? 1320 : 880; g.gain.setValueAtTime(0.1, n); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.12); o.connect(g).connect(actx.destination); o.start(n); o.stop(n + 0.13); } catch (e) {} };
  const initTakes = () => { const m = {}; SUBS.forEach(s => { m[s.i] = []; }); m[0] = [{ n: 1, label: 'Prise 1', dur: 1.6, best: true, level: 0.8 }]; m[2] = [{ n: 1, label: 'Prise 1', dur: 2.2, best: false, level: 0.7 }]; m[5] = TAKES.map(x => ({ ...x })); m[4] = [{ n: 1, label: 'Prise 1', dur: 2.6, best: true, level: 0.75 }]; return m; };
  const wave = (i, k) => Math.abs(Math.sin(i * 0.4 + k) * 0.4 + Math.sin(i * 0.9 + k * 0.3) * 0.3 + 0.4);
  const RANGE_L = { from: 'Depuis la réplique courante', all: 'Tout le clip', inout: 'Plage IN/OUT…' };
  const RANGE_S = { from: 'Depuis ici', all: 'Tout le clip', inout: 'IN/OUT' };

  function Studio({ go, accent }) {
    const H = window.RScreens._Header, Band = window.RScreens._Band;
    const [role, setRole] = React.useState('LÉA');
    const [idx, setIdx] = React.useState(5);
    const [mode, setMode] = React.useState('line');
    const [cfg, setCfg] = React.useState({ count: 3, lead: 1, beeps: true, chain: 'manuel' });
    const [phase, setPhase] = React.useState('pret'); // pret · decompte · elan · rec · queue · revue · auto · pause · summary
    const [cd, setCd] = React.useState(0);
    const [t, setT] = React.useState(SUBS[5].start - 1);
    const [runFrom, setRunFrom] = React.useState(5);
    const [takesBy, setTakesBy] = React.useState(initTakes);
    const [selTake, setSelTake] = React.useState(null);
    const [playTake, setPlayTake] = React.useState(null);
    const [ab, setAb] = React.useState(false);
    const [comed, setComed] = React.useState({ 'LÉA': 'Camille R.', 'SARAH': 'Inès B.' });
    const [roleOpen, setRoleOpen] = React.useState(false);
    const [rangeKind, setRangeKind] = React.useState('from');
    const [session, setSession] = React.useState(null); // { lines, captured, created }
    const [flash, setFlash] = React.useState(null);
    const [lvl, setLvl] = React.useState(Array(32).fill(0.08));
    const [bandH, setBandH] = React.useState(150);
    const tRef = React.useRef(t); tRef.current = t;
    const cdRef = React.useRef(cd); cdRef.current = cd;
    const roleRef = React.useRef(null);

    const line = SUBS[idx], tc = trackOf(role);
    const roleLines = SUBS.filter(s => s.char === role).map(s => s.i);
    const isValid = (i, m = takesBy) => m[i].some(k => k.best);
    const doneOf = (r) => SUBS.filter(s => s.char === r && isValid(s.i)).length;
    const totalOf = (r) => SUBS.filter(s => s.char === r).length;
    const done = doneOf(role), total = roleLines.length, complete = done === total;
    const rangeLines = rangeKind === 'all' ? roleLines : rangeKind === 'inout' ? (roleLines.filter(i => i >= 2 && i <= 6).length ? roleLines.filter(i => i >= 2 && i <= 6) : roleLines) : roleLines.filter(i => i >= idx);
    const sLines = session ? session.lines : rangeLines;
    const live = LIVE.includes(phase);
    const locked = live || !!session;
    const t0Of = (i) => Math.max(0, SUBS[i].start - cfg.lead);
    const startT = SUBS[runFrom].start;
    const endT = mode === 'cont' ? SUBS[sLines[sLines.length - 1]].end : line.end;
    const capturedNow = (lt) => { if (!session) return []; const from = session.lines.indexOf(runFrom); return session.lines.filter((i, k) => session.captured.includes(i) || (k >= from && SUBS[i].end + 0.35 <= lt)); };
    const capSet = session ? (phase === 'rec' ? capturedNow(t) : session.captured) : [];
    const curI = mode === 'cont' && session && (phase === 'rec' || phase === 'elan') ? (sLines.find(i => t <= SUBS[i].end + 0.35) ?? sLines[sLines.length - 1]) : idx;
    const stripLine = SUBS[curI];

    // ── transitions
    const go0 = (i) => {
      setPlayTake(null); setFlash(null); setRunFrom(i);
      const t0 = t0Of(i); setT(t0); tRef.current = t0;
      if (cfg.count > 0) { setCd(cfg.count); cdRef.current = cfg.count; if (cfg.beeps) beep(false); setPhase('decompte'); }
      else { if (cfg.beeps) beep(true); setPhase(cfg.lead > 0 ? 'elan' : 'rec'); }
    };
    const goLine = (i, ph = 'pret') => { setIdx(i); setRole(SUBS[i].char); setSelTake(null); setPlayTake(null); setT(t0Of(i)); if (ph === 'auto') { setCd(3); cdRef.current = 3; } setPhase(ph); };
    const pickRole = (r) => { setRoleOpen(false); if (r === role || locked) return; const ls = SUBS.filter(s => s.char === r).map(s => s.i); setFlash(null); goLine(ls.find(i => !isValid(i)) ?? ls[0]); };
    const addTake = () => { const n = Math.max(0, ...takesBy[idx].map(k => k.n)) + 1; setTakesBy(m => ({ ...m, [idx]: [{ n, label: 'Prise ' + n, dur: +(line.end - line.start).toFixed(1), level: 0.9, fresh: true }, ...m[idx].map(k => ({ ...k, fresh: false }))] })); setSelTake(n); };
    const validate = () => {
      if (!selTake) return;
      const m = { ...takesBy, [idx]: takesBy[idx].map(k => ({ ...k, best: k.n === selTake, fresh: false })) };
      setTakesBy(m);
      if (roleLines.every(i => isValid(i, m))) { setPhase('pret'); setSelTake(null); setT(t0Of(idx)); setFlash(`${role} : toutes les répliques validées`); return; }
      const next = roleLines.find(i => i > idx && !isValid(i, m)) ?? roleLines.find(i => !isValid(i, m));
      goLine(next, cfg.chain === 'auto' ? 'auto' : 'pret');
    };
    const startSession = () => { setSession({ lines: rangeLines, captured: [], created: [] }); go0(rangeLines[0]); };
    const finish = (lt) => {
      const cap = phase === 'rec' ? capturedNow(lt) : session.captured;
      if (!cap.length) { setSession(null); goLine(idx); return; }
      const nm = { ...takesBy }, created = [];
      cap.forEach(i => { const n = Math.max(0, ...nm[i].map(k => k.n)) + 1; created.push({ i, n }); nm[i] = [{ n, label: 'Prise ' + n, dur: +(SUBS[i].end - SUBS[i].start + 0.6).toFixed(1), level: 0.85, tag: 'continu', fresh: true }, ...nm[i]]; });
      setTakesBy(nm); setSession({ ...session, captured: cap, created }); setPhase('summary');
    };
    const pause = () => { const cap = capturedNow(t); const rest = session.lines.filter(i => !cap.includes(i)); if (!rest.length) return finish(t); setSession({ ...session, captured: cap }); setIdx(rest[0]); setPhase('pause'); };
    const resume = () => { const rest = session.lines.filter(i => !session.captured.includes(i)); setIdx(rest[0]); go0(rest[0]); };
    const sumValidate = () => { const m = { ...takesBy }; let c = 0; session.created.forEach(({ i, n }) => { if (!m[i].some(k => k.best)) { m[i] = m[i].map(k => ({ ...k, best: k.n === n })); c++; } }); setTakesBy(m); setSession(null); goLine(idx); setFlash(`${c} réplique${c > 1 ? 's' : ''} validée${c > 1 ? 's' : ''} · prises déjà validées conservées`); };
    const sumReview = () => { const f = session.lines[0]; setSession(null); setMode('line'); goLine(f); };
    const sumCancel = () => { const m = { ...takesBy }; session.created.forEach(({ i, n }) => { m[i] = m[i].filter(k => k.n !== n); }); setTakesBy(m); setSession(null); goLine(idx); setFlash('Session annulée · prises supprimées'); };
    const esc = () => {
      if (phase === 'decompte' || phase === 'elan') { if (session && session.captured.length) { setT(t0Of(runFrom)); setPhase('pause'); } else { setSession(null); goLine(idx); } return; }
      if (phase === 'rec' || phase === 'queue') return mode === 'cont' ? finish(t) : goLine(idx);
      if (phase === 'pause') return finish(t);
      if (phase === 'auto') return setPhase('pret');
    };
    const primary = () => {
      if (phase === 'pret') return mode === 'cont' ? startSession() : go0(idx);
      if (phase === 'revue') return goLine(idx);
      if (phase === 'auto') return go0(idx);
      if (phase === 'pause') return resume();
      if (phase !== 'summary') return esc();
    };
    const space = () => { if (mode === 'cont' && phase === 'rec') pause(); else if (phase === 'pause') resume(); else if (phase === 'auto') setPhase('pret'); };
    const nav = (dir, all) => { if (locked || phase === 'summary') return; const list = all ? SUBS.map(s => s.i) : roleLines; const j = list[list.indexOf(idx) + dir]; if (j != null) { setFlash(null); goLine(j); } };

    // ── clock: décompte/auto run on wall time with the image frozen; élan/rec/queue advance the image
    React.useEffect(() => {
      if (!LIVE.includes(phase) && phase !== 'auto') return;
      let raf, last = performance.now(), lt = tRef.current, lcd = cdRef.current, lastInt = Math.ceil(lcd);
      const step = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (phase === 'decompte' || phase === 'auto') {
          lcd -= dt; const ci = Math.ceil(lcd);
          if (lcd <= 0) { setCd(0); if (phase === 'auto') { go0(idx); return; } if (cfg.beeps) beep(true); setPhase(cfg.lead > 0 && lt < startT ? 'elan' : 'rec'); return; }
          if (phase === 'decompte' && ci !== lastInt && cfg.beeps) beep(false);
          lastInt = ci; setCd(lcd);
        } else {
          lt += dt;
          if (phase === 'elan' && lt >= startT) { setT(lt); setPhase('rec'); return; }
          if (mode === 'line' && phase === 'rec' && lt >= line.end) { setT(lt); setPhase('queue'); return; }
          if (mode === 'line' && phase === 'queue' && lt >= line.end + TAIL) { setT(line.end); addTake(); setPhase('revue'); return; }
          if (mode === 'cont' && phase === 'rec' && lt >= endT + TAIL) { setT(lt); finish(lt); return; }
          setT(lt);
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
    }, [phase, runFrom, idx, mode]);
    React.useEffect(() => { if (phase === 'pret') setT(t0Of(idx)); }, [cfg.lead]);
    React.useEffect(() => { const id = setInterval(() => setLvl(p => p.map(() => (phase === 'rec' || phase === 'queue') ? Math.random() * 0.85 + 0.12 : Math.max(0.05, Math.random() * 0.16))), 80); return () => clearInterval(id); }, [phase]);
    React.useEffect(() => { const fit = () => setBandH(window.innerHeight < 760 ? 100 : window.innerHeight < 900 ? 128 : 160); fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, []);
    React.useEffect(() => {
      if (!playTake) return;
      const tk = takesBy[idx].find(k => k.n === playTake.n); if (!tk) return;
      let raf, t0 = performance.now() - playTake.p * tk.dur * 1000;
      const loop = (now) => { const p = (now - t0) / (tk.dur * 1000); if (p >= 1) { setPlayTake(null); return; } setPlayTake({ n: tk.n, p }); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
    }, [playTake && playTake.n]);
    React.useEffect(() => {
      if (!roleOpen) return;
      const d = (e) => { if (roleRef.current && !roleRef.current.contains(e.target)) setRoleOpen(false); };
      document.addEventListener('mousedown', d); return () => document.removeEventListener('mousedown', d);
    }, [roleOpen]);
    React.useEffect(() => {
      const k = (e) => {
        if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return;
        if (/^[1-9]$/.test(e.key)) { const r = CHARS[+e.key - 1]; if (r) pickRole(r); return; }
        if (e.key === 'c' || e.key === 'C') { if (!locked) setRoleOpen(o => !o); return; }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); primary(); return; }
        if (e.key === ' ') { e.preventDefault(); space(); return; }
        if (e.key === 'Escape') { if (roleOpen) setRoleOpen(false); else esc(); return; }
        if (e.key === 'Enter' && phase === 'revue') { e.preventDefault(); validate(); return; }
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); nav(e.key === 'ArrowRight' ? 1 : -1, e.altKey); }
      };
      window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
    });

    // ── derived UI
    const count = Math.ceil(cd), elanLeft = Math.max(0, startT - t);
    const recLike = phase === 'rec' || phase === 'queue', armed = phase === 'decompte' || phase === 'elan';
    const showText = ['pret', 'decompte', 'auto', 'pause', 'revue'].includes(phase);
    const takes = takesBy[idx];
    const validated = takes.find(k => k.best);
    const K = ({ children }) => <span style={{ color: accent }}>{children}</span>;
    const status = {
      pret: flash ? <span style={{ color: OK }}>{flash}</span> : <>Prêt · <K>R</K> pour lancer{mode === 'cont' ? ` · ${sLines.length} réplique${sLines.length > 1 ? 's' : ''} de ${role}` : ''}</>,
      decompte: <K>Décompte {count} · image figée · Échap annuler</K>,
      elan: <K>Élan · REC dans {elanLeft.toFixed(1)}s</K>,
      rec: <span style={{ color: T.danger }}>{mode === 'cont' ? `Session en cours · ${capSet.length}/${sLines.length} · Espace pause · Échap arrêter` : `Prise en cours · ${Math.max(0, t - line.start).toFixed(1)}s / ${(line.end - line.start).toFixed(1)}s`}</span>,
      queue: <span style={{ color: T.danger }}>Fin de prise…</span>,
      revue: <>Prise {selTake} ajoutée · <K>Entrée</K> valider · <K>R</K> refaire</>,
      auto: <>Réplique suivante dans {count}… · <K>Espace</K> pour attendre</>,
      pause: <>En pause · <K>Espace</K> reprendre · <K>Échap</K> terminer</>,
      summary: <>Session terminée</>,
    }[phase];
    const tag = { pret: 'PRÊT', auto: 'PRÊT', decompte: 'DÉCOMPTE', elan: 'ÉLAN', rec: 'REC', queue: 'REC', revue: 'REVUE', pause: 'PAUSE', summary: 'FIN' }[phase];
    const pill = { height: 32, padding: '0 10px', borderRadius: T.r.ctl, background: T.surface, border: `1px solid ${T.border2}`, color: T.text2, fontSize: T.fs.xs, fontFamily: T.fontUI, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', whiteSpace: 'nowrap' };
    const microLabel = { fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 };
    const Row = ({ label, children }) => <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2 }}>{label}</span>{children}</div>;
    const setC = (k) => (v) => setCfg(c => ({ ...c, [k]: v }));
    const overlayPill = { padding: '10px 16px', background: 'rgba(0,0,0,.78)', border: `1px solid ${accent}55`, borderRadius: T.r.ctl, fontSize: T.fs.sm, color: T.text, display: 'flex', alignItems: 'center', gap: 10 };

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {H && <H kicker="STUDIO" title="Enregistrement" sub={`S02E04 — confrontation cuisine · réplique ${idx + 1} / ${SUBS.length}`}
          right={<Btn variant="outline" icon={ICONS.chevronL} onClick={() => go('editor')}>Retour à l'éditeur</Btn>} />}
        <div style={{ flex: 1, minHeight: 0, padding: '4px 32px 24px', display: 'flex', gap: 20, overflow: 'hidden' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* session bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
              <div ref={roleRef} style={{ position: 'relative' }}>
                <button onClick={() => !locked && setRoleOpen(o => !o)} title={locked ? 'Terminer la session pour changer de rôle' : 'Choisir le rôle (C)'}
                  style={{ height: 40, padding: '0 12px 0 6px', display: 'flex', alignItems: 'center', gap: 9, background: T.surface, border: `1px solid ${roleOpen ? tc.hex : T.border2}`, borderRadius: T.r.ctl, cursor: locked ? 'default' : 'pointer', color: T.text, fontFamily: T.fontUI, opacity: locked ? 0.7 : 1 }}>
                  <Avatar name={role} color={tc.hex} size={28} ring />
                  <span style={{ fontSize: T.fs.sm, fontWeight: 700, color: tc.hex }}>{role}</span>
                  <span style={{ fontFamily: T.fontMono, fontSize: 11, color: complete ? OK : T.text3 }}>{done}/{total} validées</span>
                  <Icon d={ICONS.chevron} size={13} stroke={T.text3} />
                </button>
                {roleOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 90, width: 300, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 6, animation: 'st2In .15s ease-out' }}>
                    <MenuLabel>Rôle à enregistrer</MenuLabel>
                    {CHARS.map((c, k) => {
                      const ct = trackOf(c), d = doneOf(c), n = totalOf(c), on = c === role;
                      return (
                        <button key={c} onClick={() => pickRole(c)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: T.r.chip, border: 'none', background: on ? T.surface2 : 'transparent', cursor: 'pointer', textAlign: 'left', color: T.text, fontFamily: T.fontUI }}>
                          <Avatar name={c} color={ct.hex} size={26} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: T.fs.sm, fontWeight: 600, color: ct.hex }}>{c}</div>
                            <div style={{ fontSize: 11, color: T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comed[c] || 'Comédien non renseigné'}</div>
                          </div>
                          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: d === n ? OK : T.text2 }}>{d}/{n}</span>
                          <span style={{ width: 13, display: 'flex' }}>{on && <Icon d={ICONS.check} size={13} stroke={accent} />}</span>
                          <Kbd>{k + 1}</Kbd>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.fs.xs, color: T.text3 }}>
                Comédien
                <input value={comed[role] || ''} placeholder="Nom du comédien…" onChange={e => setComed(c => ({ ...c, [role]: e.target.value }))}
                  style={{ height: 32, width: 150, padding: '0 10px', background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 9, color: T.text, fontSize: 13, fontFamily: T.fontUI, outline: 'none' }} />
              </label>
              <div style={{ flex: 1 }} />
              <div title={locked ? 'Terminer la session pour changer de mode' : ''} style={{ opacity: locked ? 0.6 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
                <Segmented size="sm" value={mode} onChange={v => { setMode(v); setFlash(null); goLine(idx); }}
                  options={[{ v: 'line', l: 'Par réplique', desc: 'Une prise par réplique' }, { v: 'cont', l: 'En continu', desc: 'Un seul passage, découpé en une prise par réplique' }]} />
              </div>
              {mode === 'cont' && (
                <Popover align="right" width={260} trigger={(o, tg) => (
                  <button onClick={() => !locked && tg()} style={{ ...pill, borderColor: o ? accent : T.border2 }} title="Plage enregistrée">
                    <Icon d={ICONS.film} size={13} stroke={T.text2} />{RANGE_S[rangeKind]} · {sLines.length} répl.<Icon d={ICONS.chevron} size={12} stroke={T.text3} />
                  </button>)}>
                  {close => <>
                    <MenuLabel>Plage enregistrée</MenuLabel>
                    {Object.keys(RANGE_L).map(k => <MenuItem key={k} active={rangeKind === k} right={rangeKind === k ? <Icon d={ICONS.check} size={12} stroke={accent} /> : null} onClick={() => { setRangeKind(k); close(); }}>{RANGE_L[k]}</MenuItem>)}
                  </>}
                </Popover>
              )}
              <Popover align="right" width={300} trigger={(o, tg) => (
                <button onClick={tg} style={{ ...pill, borderColor: o ? accent : T.border2 }} title="Décompte · élan avant réplique">
                  <Icon d={ICONS.clock} size={13} stroke={accent} /><span style={{ fontFamily: T.fontMono, color: T.text }}>{cfg.count} · {cfg.lead}s</span><Icon d={ICONS.chevron} size={12} stroke={T.text3} />
                </button>)}>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Row label="Décompte"><Segmented size="sm" value={cfg.count} onChange={setC('count')} options={[{ v: 0, l: 'Aucun' }, { v: 3, l: '3 s' }, { v: 5, l: '5 s' }]} /></Row>
                  <Row label="Élan avant réplique"><Segmented size="sm" value={cfg.lead} onChange={setC('lead')} options={[0, 1, 2, 3].map(v => ({ v, l: v + ' s' }))} /></Row>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2 }}>Bips</span><Toggle on={cfg.beeps} onClick={() => setCfg(c => ({ ...c, beeps: !c.beeps }))} /></div>
                  {mode === 'line' && <Row label="Enchaînement"><Segmented size="sm" value={cfg.chain} onChange={setC('chain')} options={[{ v: 'manuel', l: 'Manuel' }, { v: 'auto', l: 'Auto après 3 s' }]} /></Row>}
                  <div style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.45, textWrap: 'pretty' }}>L'image reste figée pendant le décompte. L'élan est la part d'image jouée avant la réplique.</div>
                </div>
              </Popover>
            </div>

            {/* stage */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#000', border: `1px solid ${recLike ? T.danger + '88' : T.border}`, borderRadius: T.r.card, overflow: 'hidden', transition: 'border-color .2s' }}>
              <div style={{ height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>#{pad(curI + 1)}</span>
                <span style={{ fontSize: T.fs.md, color: T.text, fontFamily: "'Caveat', cursive", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{stripLine.text}</span>
                {isValid(curI) && <Chip soft color={OK}><Icon d={ICONS.check} size={10} stroke={OK} /> validée</Chip>}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{fmtTC(stripLine.start, 24)} → {fmtTC(stripLine.end, 24)}</span>
                <div style={{ display: 'flex', gap: 2, opacity: locked ? 0.4 : 1 }}>
                  <Btn size="sm" icon={ICONS.skipBack} title={`Réplique précédente de ${role} (←)`} onClick={() => nav(-1)} />
                  <Btn size="sm" icon={ICONS.skipFwd} title={`Réplique suivante de ${role} (→)`} onClick={() => nav(1)} />
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 80, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <div style={{ height: '94%', aspectRatio: '16/9', maxWidth: '96%', background: 'repeating-linear-gradient(0deg,#15151b 0 2px,#1a1a20 2px 6px)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  <span style={{ color: T.text4, fontSize: 11, letterSpacing: 4, fontFamily: T.fontMono }}>IMAGE</span>
                  {showText && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '48px 24px 18px', background: 'linear-gradient(transparent, rgba(0,0,0,.85))' }}>
                      <div style={{ fontSize: T.fs.micro, letterSpacing: 1.2, fontWeight: 700, color: tc.hex, marginBottom: 2 }}>{role} · RÉPLIQUE {pad(idx + 1)}</div>
                      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 30, color: '#fff', lineHeight: 1.15, textWrap: 'pretty' }}>{line.text}</div>
                      {line.note && <div style={{ fontSize: T.fs.xs, color: T.text2, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Icon d={ICONS.note} size={12} stroke={T.text3} />{line.note}</div>}
                    </div>
                  )}
                  {phase === 'decompte' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(0,0,0,.35)', paddingBottom: 60 }}>
                      <span key={count} style={{ fontSize: 104, lineHeight: 1, fontWeight: 800, color: accent, fontFamily: T.fontMono, textShadow: `0 0 40px ${accent}66`, animation: 'st2Count .95s ease-out' }}>{count}</span>
                      <span style={{ fontSize: T.fs.xs, color: T.text2 }}>Échap pour annuler</span>
                    </div>
                  )}
                  {phase === 'elan' && cfg.lead > 0 && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: 'rgba(255,255,255,.08)' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, elanLeft / cfg.lead * 100)}%`, background: accent }} />
                    </div>
                  )}
                  {phase === 'auto' && <div style={{ position: 'absolute', top: '38%', ...overlayPill }}><Icon d={ICONS.clock} size={14} stroke={accent} />Réplique suivante dans {count}… · <K>Espace</K> pour attendre</div>}
                  {phase === 'pause' && <div style={{ position: 'absolute', top: '34%', ...overlayPill }}><Icon d={ICONS.pause} size={14} stroke={accent} />Reprise sur la réplique {pad(idx + 1)}, avec décompte</div>}
                  {phase === 'summary' && session && (() => {
                    const n = session.created.length, free = session.created.filter(c => !takesBy[c.i].some(k => k.best)).length, skipped = session.lines.length - n;
                    return (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 360, maxWidth: '90%', background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, animation: 'st2In .2s ease-out' }}>
                          <span style={microLabel}>SESSION TERMINÉE</span>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{n} prise{n > 1 ? 's' : ''} créée{n > 1 ? 's' : ''} · <span style={{ color: tc.hex }}>{role}</span></div>
                          <div style={{ fontSize: T.fs.xs, color: T.text3, lineHeight: 1.45 }}>{skipped > 0 ? `${skipped} réplique${skipped > 1 ? 's' : ''} non enregistrée${skipped > 1 ? 's' : ''}. ` : ''}Les prises déjà validées ne sont pas remplacées.</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                            <Btn variant="primary" full icon={ICONS.check} onClick={sumValidate}>Valider les répliques sans prise validée ({free})</Btn>
                            <Btn variant="outline" full onClick={sumReview}>Revoir réplique par réplique</Btn>
                            <Btn full danger icon={ICONS.trash} onClick={sumCancel}>Annuler la session</Btn>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div style={{ position: 'absolute', top: 12, left: 14, padding: '4px 10px', background: 'rgba(0,0,0,.7)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 12, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {recLike ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.danger, animation: 'st2Blink 1s steps(2) infinite' }} /> : <Dot color={armed ? accent : phase === 'revue' ? OK : T.text3} size={6} />}
                  <span style={{ color: recLike ? T.danger : armed ? accent : T.text2, fontWeight: 700, fontSize: 10.5, letterSpacing: 1 }}>{tag}</span>
                  {fmtTC(Math.max(0, t), 24)}
                </div>
                <div style={{ position: 'absolute', top: 12, right: 14, display: 'flex', gap: 6 }}>
                  <Chip soft color={T.text2}>{mode === 'cont' ? 'En continu' : 'Par réplique'}</Chip>
                  <Chip soft color={T.text2}>Micro · USB Yeti</Chip>
                </div>
              </div>
              {Band && <Band t={Math.max(0, t)} setT={() => {}} setPlaying={() => {}} accent={accent} brStyle="classique" pxPerSec={150} font="manuscrite" showDet={true} filter={[role]} h={bandH} layoutKey={phase + bandH + role} readOnly />}
              <div style={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', background: T.surface, borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, flex: 1, minWidth: 0 }}>
                  {lvl.map((v, i) => <div key={i} style={{ flex: 1, maxWidth: 5, height: `${v * 100}%`, background: recLike ? (v > 0.86 ? T.danger : accent) : T.border3, borderRadius: 2, transition: 'height .08s' }} />)}
                </div>
                <button onClick={primary} disabled={phase === 'summary'} title={recLike ? (mode === 'cont' ? 'Arrêter la session (Échap)' : 'Annuler la prise (Échap)') : armed ? 'Annuler (Échap)' : phase === 'revue' ? 'Refaire (R)' : phase === 'pause' ? 'Reprendre (Espace)' : 'Lancer (R)'}
                  style={{ width: 48, height: 48, borderRadius: '50%', cursor: phase === 'summary' ? 'default' : 'pointer', flexShrink: 0, opacity: phase === 'summary' ? 0.4 : 1,
                    background: recLike ? T.danger : armed ? T.surface2 : accent, border: `3px solid ${(recLike ? T.danger : armed ? T.border3 : accent) + '44'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: recLike ? `0 0 0 6px ${T.danger}22, 0 0 24px ${T.danger}66` : 'none', transition: 'box-shadow .2s, background .2s' }}>
                  {recLike ? <span style={{ width: 14, height: 14, borderRadius: 3, background: '#0b0b0d' }} />
                    : armed ? <Icon d={ICONS.close} size={18} stroke={T.text} />
                    : phase === 'pause' ? <Icon d={ICONS.play} size={18} stroke="#0b0b0d" fill="#0b0b0d" />
                    : <Icon d={ICONS.mic} size={20} stroke="#0b0b0d" />}
                </button>
                <div style={{ flex: 1, minWidth: 0, fontSize: T.fs.xs, fontFamily: T.fontMono, color: T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status}</div>
              </div>
            </div>
          </div>

          {/* right column */}
          <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
            {mode === 'line' ? <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, flexShrink: 0 }}>
                <span style={microLabel}>PRISES</span>
                <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{takes.length} · réplique {pad(idx + 1)}</span>
                <div style={{ flex: 1 }} />
                {takes.length > 1 && <button onClick={() => setAb(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><Chip soft={!ab} active={ab} color={T.info}>A/B comparer</Chip></button>}
              </div>
              {ab && takes.length > 1 && (
                <div style={{ background: T.surface, border: `1px solid ${T.info}44`, borderRadius: T.r.ctl, padding: 12, display: 'flex', flexDirection: 'column', gap: 9, flexShrink: 0 }}>
                  <div style={{ fontSize: T.fs.micro, color: T.info, letterSpacing: 1, fontWeight: 700 }}>COMPARAISON A / B · Tab pour basculer</div>
                  {[{ s: 'A', tk: takes[0], c: accent }, { s: 'B', tk: takes[1], c: T.info }].map(x => (
                    <div key={x.s} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: x.c + '22', color: x.c, fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{x.s}</div>
                      <span style={{ flex: 1, fontSize: T.fs.xs, color: T.text }}>{x.tk.label}</span>
                      <span style={{ fontSize: 11, color: T.text3, fontFamily: T.fontMono }}>{x.tk.dur}s</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {takes.length === 0 && <div style={{ border: `1px dashed ${T.border2}`, borderRadius: T.r.ctl, padding: 18, fontSize: T.fs.xs, color: T.text3, lineHeight: 1.5, textAlign: 'center' }}>Aucune prise pour cette réplique.<br />Appuyer sur <K>R</K> pour lancer le décompte.</div>}
                {takes.map(tk => {
                  const on = selTake === tk.n, pl = playTake && playTake.n === tk.n, p = pl ? playTake.p : 0;
                  return (
                    <div key={tk.n} onClick={() => setSelTake(tk.n)} style={{ background: T.surface, border: `1px solid ${on ? accent : tk.best ? accent + '55' : T.border}`, borderRadius: T.r.ctl, padding: 12, cursor: 'pointer', flexShrink: 0, animation: tk.fresh ? 'st2In .35s ease-out' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                        <button onClick={e => { e.stopPropagation(); setPlayTake(pl ? null : { n: tk.n, p: 0 }); }} title={pl ? 'Pause' : 'Écouter'}
                          style={{ width: 30, height: 30, borderRadius: T.r.chip, border: 'none', cursor: 'pointer', background: pl ? accent : T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon d={pl ? ICONS.pause : ICONS.play} size={13} stroke={pl ? '#0b0b0d' : T.text} fill={pl ? '#0b0b0d' : T.text} />
                        </button>
                        <span style={{ fontSize: T.fs.sm, fontWeight: 600 }}>{tk.label}</span>
                        {tk.best && <Chip color={accent} soft><Icon d={ICONS.check} size={10} stroke={accent} /> validée</Chip>}
                        {tk.tag && <Chip soft color={T.text3}>{tk.tag}</Chip>}
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, color: pl ? accent : T.text3, fontFamily: T.fontMono }}>{pl ? (p * tk.dur).toFixed(1) + ' / ' : ''}{tk.dur}s</span>
                        <Btn size="sm" icon={ICONS.trash} title="Supprimer" onClick={e => { e.stopPropagation(); setTakesBy(m => ({ ...m, [idx]: m[idx].filter(x => x.n !== tk.n) })); }} />
                      </div>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.5, height: 28 }}>
                        {Array.from({ length: 56 }).map((_, i) => { const f = i / 56; return <div key={i} style={{ flex: 1, height: `${Math.max(6, wave(i, tk.n) * tk.level * 100)}%`, background: pl && f <= p ? accent : (on || tk.best ? accent + '55' : T.border3), borderRadius: 1 }} />; })}
                        {pl && <div style={{ position: 'absolute', left: `${p * 100}%`, top: -3, bottom: -3, width: 2, background: '#fff', borderRadius: 1 }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Btn variant={selTake && !(validated && validated.n === selTake) ? 'primary' : 'outline'} full icon={ICONS.check} onClick={validate}>
                {selTake ? `Valider la prise ${selTake}` : 'Sélectionner une prise'}
              </Btn>
            </> : <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, flexShrink: 0 }}>
                <span style={microLabel}>SESSION CONTINUE</span>
                <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{capSet.length}/{sLines.length}</span>
              </div>
              <div style={{ fontSize: T.fs.xs, color: T.text3, marginTop: -8 }}>{RANGE_L[rangeKind].replace('…', '')} · {fmtTC(SUBS[sLines[0]].start, 24)} → {fmtTC(SUBS[sLines[sLines.length - 1]].end, 24)}</div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sLines.map(i => {
                  const s = SUBS[i], st = capSet.includes(i) ? 'done' : (phase === 'rec' && t >= s.start - 0.3 && t <= s.end + 0.35) ? 'live' : 'todo';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: T.surface, border: `1px solid ${st === 'live' ? T.danger + '88' : T.border}`, borderRadius: T.r.ctl }}>
                      <span style={{ width: 14, display: 'flex', justifyContent: 'center' }}>{st === 'done' ? <Icon d={ICONS.check} size={13} stroke={OK} /> : <Dot color={st === 'live' ? T.danger : T.border3} size={7} pulse={st === 'live'} />}</span>
                      <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>#{pad(i + 1)}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: T.fs.xs, color: st === 'todo' ? T.text2 : T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.text}</span>
                      {isValid(i) && <span title="Une prise est déjà validée, elle sera conservée" style={{ fontSize: 10.5, color: T.text3 }}>validée</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.5, textWrap: 'pretty' }}>Un seul passage, découpé en une prise « continu » par réplique. Espace met en pause ; la reprise repart du début de la réplique interrompue.</div>
            </>}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', fontSize: T.fs.xs, fontFamily: T.fontMono, color: complete ? OK : T.text3 }}><span>{role} · {done}/{total} validées</span></div>
              <div style={{ height: 4, background: T.surface2, borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${done / total * 100}%`, background: complete ? OK : tc.hex, transition: 'width .3s' }} /></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.RScreens = window.RScreens || {};
  window.RScreens.Record = Studio;
})();
