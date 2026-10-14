/* Screen — BR Éditeur (centerpiece). Band canvas + timeline nav + adaptive inspector + clustered toolbar */
(function () {
  const { T, Icon, ICONS, Btn, Chip, Dot, Avatar, Kbd, Toggle, Segmented, Popover, MenuItem, MenuLabel, MenuSep, Select, fmtTC, fmt } = window.RD;
  const { SUBS } = window.RDATA;
  const CURSOR = 0.30, FPS = 24;
  const trackOf = (n) => T.tracks.find(t => t.name === n) || T.tracks[0];

  function Editor({ go, accent, brStyle = 'classique', density, onHelp }) {
    const [t, setT] = React.useState(2.0);
    const [playing, setPlaying] = React.useState(true);
    const [tab, setTab] = React.useState('repl');
    const [sel, setSel] = React.useState(5);
    const [filter, setFilter] = React.useState([]); // empty = all
    const [pxPerSec, setPxPerSec] = React.useState(150);
    const [font, setFont] = React.useState('manuscrite');
    const [showDet, setShowDet] = React.useState(true);
    const [locked, setLocked] = React.useState(false);
    const tRef = React.useRef(t); tRef.current = t;

    // playback clock
    React.useEffect(() => {
      if (!playing) return;
      let raf, last = performance.now();
      const loop = (now) => {
        const dt = (now - last) / 1000; last = now;
        setT(p => { let n = p + dt; if (n > 17.5) n = 0.5; return n; });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }, [playing]);

    const active = SUBS.find(s => t >= s.start && t <= s.end);
    const chars = [...new Set(SUBS.map(s => s.char))];

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>
        {/* Top bar */}
        <div style={{ height: 52, flexShrink: 0, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <Btn size="sm" variant="outline" icon={ICONS.chevron} onClick={() => go('library')} style={{ transform: 'rotate(90deg)' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: T.fs.base, fontWeight: 600, lineHeight: 1.1 }}>S02E04 — confrontation cuisine</span>
            <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono }}>41.2s · {SUBS.length} répliques · 24 fps</span>
          </div>
          <Chip color={T.success} soft><Dot color={T.success} size={6} /> Sauvegardé</Chip>
          <div style={{ display: 'inline-flex', gap: 2, marginLeft: 2 }}>
            <Btn size="sm" icon={ICONS.undo} title="Annuler (Ctrl+Z)" />
            <Btn size="sm" icon={ICONS.redo} title="Rétablir (Ctrl+Y)" />
          </div>
          <div style={{ flex: 1 }} />
          {/* character filter pills */}
          <span style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1, fontWeight: 600 }}>VOIX</span>
          {chars.map(ch => {
            const tc = trackOf(ch); const on = filter.length === 0 || filter.includes(ch);
            return (
              <button key={ch} onClick={() => setFilter(f => f.includes(ch) ? f.filter(x => x !== ch) : [...f, ch])} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 5px', borderRadius: 99, cursor: 'pointer',
                background: on ? tc.hex + '1c' : T.surface2, border: `1px solid ${on ? tc.hex + '66' : T.border}`, opacity: on ? 1 : 0.5,
              }}>
                <Avatar name={ch} color={tc.hex} size={18} />
                <span style={{ fontSize: T.fs.xs, fontWeight: 600, color: on ? tc.hex : T.text3 }}>{ch}</span>
              </button>
            );
          })}
          <div style={{ width: 1, height: 22, background: T.border, margin: '0 4px' }} />
          <Popover align="right" width={210} trigger={(o, tog) => <Btn size="sm" variant="solid" active={o} onClick={tog} icon={ICONS.sub} iconR={ICONS.chevron}>Sous-titres</Btn>}>
            {(close) => (<><MenuLabel>Transcription & import</MenuLabel>
              <MenuItem icon={ICONS.sparkle} onClick={() => { close(); go('activity'); }}>Transcrire (Whisper)</MenuItem>
              <MenuItem icon={ICONS.upload} onClick={close}>Importer SRT / ASS / VTT…</MenuItem>
              <MenuSep />
              <MenuItem icon={ICONS.download} onClick={() => { close(); go('export'); }}>Exporter les sous-titres</MenuItem></>)}
          </Popover>
          <Btn size="sm" icon={ICONS.keyboard} title="Raccourcis (?)" onClick={onHelp} />
          <Btn size="sm" variant="primary" icon={ICONS.download} onClick={() => go('export')}>Exporter</Btn>
        </div>

        {/* Main: video + inspector */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Video hero */}
            <div style={{ flex: 1, minHeight: 0, background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '74%', aspectRatio: '16/9', maxHeight: '92%', background: `repeating-linear-gradient(0deg,#15151b 0 2px,#1a1a20 2px 6px)`, borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
                {active && (
                  <div style={{ position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)', maxWidth: '88%', background: 'rgba(0,0,0,.78)', padding: '7px 18px', borderRadius: 6, borderTop: `2px solid ${trackOf(active.char).hex}`, backdropFilter: 'blur(6px)', textAlign: 'center' }}>
                    <div style={{ color: trackOf(active.char).hex, fontSize: 9, letterSpacing: 1.5, fontWeight: 700, marginBottom: 2 }}>{active.char}</div>
                    <div style={{ fontSize: 16, fontFamily: T.fontMono, color: '#fff', whiteSpace: 'nowrap' }}>{active.text}</div>
                  </div>
                )}
              </div>
              {/* TC overlay */}
              <div style={{ position: 'absolute', top: 14, left: 18, padding: '4px 11px', background: 'rgba(0,0,0,.6)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 11.5, color: T.text2, backdropFilter: 'blur(6px)', display: 'flex', gap: 8 }}>
                <span style={{ color: accent }}>{fmtTC(t, FPS)}</span><span style={{ color: T.text4 }}>/ {fmtTC(41.2, FPS)}</span>
              </div>
              {/* proxy / quality toggle */}
              <div style={{ position: 'absolute', top: 12, right: 16 }}>
                <Segmented size="sm" value="vo" onChange={() => {}} options={[{ v: 'vo', l: 'VO', desc: 'qualité source' }, { v: 'proxy', l: 'Proxy 720p', desc: 'lecture fluide' }]} />
              </div>
            </div>

            {/* Transport */}
            <Transport t={t} playing={playing} setPlaying={setPlaying} setT={setT} accent={accent} />

            {/* Timeline nav bar (the big gap, now filled) */}
            <TimelineNav t={t} setT={setT} accent={accent} pxPerSec={pxPerSec} />

            {/* Band toolbar (clusters) */}
            <BandToolbar accent={accent} brStyle={brStyle} pxPerSec={pxPerSec} setPxPerSec={setPxPerSec}
              font={font} setFont={setFont} showDet={showDet} setShowDet={setShowDet} locked={locked} setLocked={setLocked} />

            {/* The band */}
            <BandCanvas t={t} setT={setT} setPlaying={setPlaying} accent={accent} brStyle={brStyle} pxPerSec={pxPerSec} font={font} showDet={showDet} filter={filter} />
          </div>

          {/* Inspector */}
          <Inspector tab={tab} setTab={setTab} sel={sel} setSel={setSel} t={t} setT={setT} accent={accent}
            showDet={showDet} setShowDet={setShowDet} font={font} setFont={setFont} go={go} />
        </div>
      </div>
    );
  }

  // ── Transport ──────────────────────────────────────────────
  function Transport({ t, playing, setPlaying, setT, accent }) {
    const pct = (t / 17.5) * 100;
    const [spd, setSpd] = React.useState(1);
    return (
      <div style={{ height: 50, flexShrink: 0, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, background: T.surface, borderTop: `1px solid ${T.border}` }}>
        <Btn size="sm" icon={ICONS.skipBack} title="Début (Home)" />
        <Btn size="sm" icon={ICONS.prevFrame} title="Image −1 (⇧←)" />
        <button onClick={() => setPlaying(p => !p)} style={{ width: 40, height: 36, borderRadius: T.r.ctl, background: accent, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon d={playing ? ICONS.pause : ICONS.play} size={15} stroke="#0b0b0d" fill="#0b0b0d" />
        </button>
        <Btn size="sm" icon={ICONS.nextFrame} title="Image +1 (⇧→)" />
        <Btn size="sm" icon={ICONS.skipFwd} title="Fin (End)" />
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text2, marginLeft: 6 }}>{fmt(t)} / {fmt(41.2)}</span>
        <div onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setT(((e.clientX - r.left) / r.width) * 17.5); }}
          style={{ flex: 1, height: 6, background: T.surface3, borderRadius: 3, margin: '0 8px', position: 'relative', cursor: 'pointer' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: accent, borderRadius: 3 }} />
          <div style={{ position: 'absolute', left: `${pct}%`, top: -3, width: 12, height: 12, borderRadius: '50%', background: accent, transform: 'translateX(-50%)', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
        </div>
        <Segmented size="sm" value={spd} onChange={setSpd} options={[{ v: 0.5, l: '0.5×' }, { v: 1, l: '1×' }, { v: 1.5, l: '1.5×' }, { v: 2, l: '2×' }]} />
        <Btn size="sm" icon={ICONS.volume} />
      </div>
    );
  }

  // ── Timeline nav bar ───────────────────────────────────────
  function TimelineNav({ t, setT, accent }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const cv = ref.current; if (!cv) return;
      const ctx = cv.getContext('2d');
      const W = cv.width = cv.offsetWidth * 2, H = cv.height = 56 * 2;
      ctx.scale(2, 2); const w = W / 2, h = H / 2;
      ctx.clearRect(0, 0, w, h);
      // waveform
      ctx.fillStyle = T.border3;
      for (let x = 0; x < w; x += 2) {
        const seed = Math.sin(x * 0.13) * 0.5 + Math.sin(x * 0.37) * 0.3 + Math.sin(x * 0.07) * 0.2;
        const a = Math.abs(seed) * 14 + 1;
        ctx.fillRect(x, h / 2 - a, 1.2, a * 2);
      }
      // subtitle blocks
      SUBS.forEach(s => {
        const tc = trackOf(s.char);
        const x = (s.start / 17.5) * w, ww = ((s.end - s.start) / 17.5) * w;
        ctx.fillStyle = tc.hex + '33'; ctx.fillRect(x, h - 10, ww, 6);
      });
      // boucle band
      ctx.fillStyle = accent + '18'; ctx.fillRect((11 / 17.5) * w, 0, ((15.4 - 11) / 17.5) * w, h);
      ctx.strokeStyle = accent + '88'; ctx.setLineDash([3, 3]);
      ctx.strokeRect((11 / 17.5) * w, 1, ((15.4 - 11) / 17.5) * w, h - 2); ctx.setLineDash([]);
      // playhead
      const px = (t / 17.5) * w;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(px - 5, 0); ctx.lineTo(px + 5, 0); ctx.lineTo(px, 6); ctx.fill();
    }, [t, accent]);
    return (
      <div style={{ height: 56, flexShrink: 0, position: 'relative', background: T.bg2, borderTop: `1px solid ${T.border}` }}
        onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setT(((e.clientX - r.left) / r.width) * 17.5); }}>
        <canvas ref={ref} style={{ width: '100%', height: 56, display: 'block', cursor: 'pointer' }} />
        <div style={{ position: 'absolute', top: 5, left: 10, fontSize: 9, color: T.text4, letterSpacing: 1, fontWeight: 700, fontFamily: T.fontMono, pointerEvents: 'none' }}>TIMELINE · CLIP ENTIER</div>
        <div style={{ position: 'absolute', top: 5, right: 10, fontSize: 9, color: accent, fontFamily: T.fontMono, pointerEvents: 'none' }}>⟲ B1 11:00–15:09</div>
      </div>
    );
  }

  // ── Band toolbar (clusters) ────────────────────────────────
  function BandToolbar({ accent, brStyle, pxPerSec, setPxPerSec, font, setFont, showDet, setShowDet, locked, setLocked }) {
    const Cluster = ({ children }) => (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, padding: 3 }}>{children}</div>
    );
    const RESP = [
      { tag: '(HH)', desc: 'Inspiration', dur: '0.5s' }, { tag: '(H)', desc: 'Souffle', dur: '0.4s' },
      { tag: '(Hm)', desc: 'Demi-souffle', dur: '0.4s' }, { tag: '*', desc: 'Repère BR', dur: '0.3s' },
      { tag: '(…)', desc: 'Pause', dur: '0.6s' },
    ];
    const REACT = [
      { tag: '(rires)', dur: '1.5s' }, { tag: '(pleurs)', dur: '2.0s' }, { tag: '(soupir)', dur: '1.0s' },
      { tag: '(cri)', dur: '0.7s' }, { tag: '(chuchoté)', dur: '1.2s' }, { tag: '(essoufflé)', dur: '1.0s' },
      { tag: '(hésitation)', dur: '0.5s' }, { tag: '(grognement)', dur: '0.4s' },
    ];
    return (
      <div style={{ height: 48, flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8, background: T.surface, borderTop: `1px solid ${T.border}`, flexWrap: 'wrap', overflow: 'visible' }}>
        {/* edit cluster */}
        <Cluster>
          <Btn size="sm" icon={ICONS.plus} title="Ajouter une réplique" />
          <Btn size="sm" icon={ICONS.scissors} title="Couper (S)" />
          <Btn size="sm" icon={ICONS.loop} title="Boucler la sélection (⇧clic)" />
        </Cluster>
        {/* insert cluster */}
        <Cluster>
          <Popover width={250} trigger={(o, tog) => <Btn size="sm" active={o} onClick={tog} icon={ICONS.breath} iconR={ICONS.chevron}>Resp.</Btn>}>
            {(close) => (<><MenuLabel>Respirations — insérer au curseur</MenuLabel>
              {RESP.map(r => <MenuItem key={r.tag} color={T.info} onClick={close}
                right={<span style={{ fontSize: 10, color: T.text4, fontFamily: T.fontMono }}>{r.dur}</span>}>
                <span style={{ fontFamily: T.fontMono, fontWeight: 700, color: T.info, marginRight: 8 }}>{r.tag}</span>
                <span style={{ color: T.text3, fontSize: 12 }}>{r.desc}</span></MenuItem>)}</>)}
          </Popover>
          <Popover width={230} trigger={(o, tog) => <Btn size="sm" active={o} onClick={tog} icon={ICONS.sparkle} iconR={ICONS.chevron}>Réact.</Btn>}>
            {(close) => (<><MenuLabel>Réactions — insérer au curseur</MenuLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: 6 }}>
                {REACT.map(r => <button key={r.tag} onClick={close} style={{ fontSize: 11, padding: '5px 9px', fontFamily: T.fontMono, background: T.surface2, border: `1px solid ${T.border2}`, color: T.text2, borderRadius: 6, cursor: 'pointer' }}>{r.tag}</button>)}
              </div></>)}
          </Popover>
        </Cluster>
        {/* flags */}
        <Cluster>
          <Popover width={230} trigger={(o, tog) => <Btn size="sm" active={o} onClick={tog} icon={ICONS.flag} title="État de la réplique" />}>
            {(close) => (<><MenuLabel>État de la réplique</MenuLabel>
              <MenuItem icon={ICONS.flag} onClick={close}>Hors-champ <span style={{ color: T.text4 }}>(off)</span></MenuItem>
              <MenuItem icon={ICONS.user} onClick={close}>De dos</MenuItem>
              <MenuItem icon={ICONS.wave} onClick={close}>Ambiance</MenuItem>
              <MenuSep />
              <MenuItem icon={ICONS.target} onClick={close}>Plan / raccord au curseur</MenuItem></>)}
          </Popover>
          <Popover width={250} trigger={(o, tog) => <Btn size="sm" active={o} onClick={tog} icon={ICONS.film} title="Plans / raccords (détection auto)" />}>
            {(close) => (<><MenuLabel>Plans — changements de scène</MenuLabel>
              <MenuItem icon={ICONS.sparkle} onClick={close}>Détecter automatiquement (ffmpeg)</MenuItem>
              <MenuItem icon={ICONS.plus} onClick={close}>Ajouter un plan au curseur</MenuItem>
              <MenuSep />
              <div style={{ padding: '4px 10px', fontSize: 11, color: T.text3 }}>2 plans · 00:00:06:18 · 00:00:13:14</div></>)}
          </Popover>
          <Popover width={280} align="left" trigger={(o, tog) => <Btn size="sm" active={o} onClick={tog} icon={ICONS.note} title="Note de direction" />}>
            {(close) => (<div style={{ padding: 4 }}>
              <MenuLabel>Note de direction</MenuLabel>
              <textarea autoFocus rows={3} placeholder="Intention, ton, timing…" defaultValue="ton pressé, à voix basse"
                style={{ width: '100%', background: T.bg2, border: `1px solid ${T.border2}`, borderRadius: 8, color: accent, fontFamily: T.fontUI, fontStyle: 'italic', fontSize: 12, padding: '7px 9px', outline: 'none', resize: 'vertical' }} />
              <Btn size="sm" variant="primary" full onClick={close} style={{ marginTop: 6 }}>Enregistrer la note</Btn>
            </div>)}
          </Popover>
        </Cluster>
        {/* détection */}
        <Cluster>
          <Btn size="sm" active={showDet} onClick={() => setShowDet(d => !d)} icon={ICONS.eye} title="Calque détection">Détection</Btn>
        </Cluster>

        <div style={{ flex: 1 }} />

        {/* font select */}
        <Select size="sm" width={132} value={font} onChange={setFont} options={[
          { v: 'manuscrite', l: 'Manuscrite' }, { v: 'atkinson', l: 'Atkinson' }, { v: 'mono', l: 'Mono' },
        ]} />
        {/* view cluster */}
        <Cluster>
          <Btn size="sm" icon={locked ? ICONS.lock : ICONS.unlock} active={locked} onClick={() => setLocked(l => !l)} title="Verrouiller" />
          <Btn size="sm" icon={ICONS.zoomOut} onClick={() => setPxPerSec(p => Math.max(60, p - 20))} />
          <span style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono, minWidth: 44, textAlign: 'center' }}>{pxPerSec}px/s</span>
          <Btn size="sm" icon={ICONS.zoomIn} onClick={() => setPxPerSec(p => Math.min(300, p + 20))} />
        </Cluster>
      </div>
    );
  }

  // ── Band canvas (elastic text) ─────────────────────────────
  function BandCanvas({ t, setT, setPlaying, accent, brStyle, pxPerSec, font, showDet, filter }) {
    const ref = React.useRef(null);
    const drag = React.useRef(null);
    const [ctx, setCtx] = React.useState(null);
    React.useEffect(() => {
      if (!ctx) return;
      const close = () => setCtx(null);
      setTimeout(() => window.addEventListener('mousedown', close), 0);
      return () => window.removeEventListener('mousedown', close);
    }, [ctx]);
    const FONTS = { manuscrite: "'Caveat', cursive", atkinson: "'IBM Plex Sans', sans-serif", mono: "'JetBrains Mono', monospace" };
    React.useEffect(() => {
      const cv = ref.current; if (!cv) return;
      const ctx = cv.getContext('2d');
      const W = cv.width = cv.offsetWidth * 2, H = cv.height = cv.offsetHeight * 2;
      ctx.scale(2, 2); const w = W / 2, h = H / 2;
      const visible = [...new Set(SUBS.map(s => s.char))].filter(c => filter.length === 0 || filter.includes(c));
      const nTracks = Math.max(1, visible.length);
      const trackH = h / nTracks;
      const cursorX = w * CURSOR;
      const isNeon = brStyle === 'neon', isMin = brStyle === 'minimal';

      ctx.fillStyle = isNeon ? '#08080c' : T.bg;
      ctx.fillRect(0, 0, w, h);

      // track separators + labels
      visible.forEach((ch, ti) => {
        const tc = trackOf(ch);
        if (ti > 0) { ctx.strokeStyle = T.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, ti * trackH); ctx.lineTo(w, ti * trackH); ctx.stroke(); }
        ctx.fillStyle = tc.hex; ctx.font = `700 9px ${T.fontUI}`; ctx.textBaseline = 'top';
        ctx.fillText(ch, 7, ti * trackH + 6);
      });

      // SMPTE grid
      const tStart = t - cursorX / pxPerSec, tEnd = t + (w - cursorX) / pxPerSec;
      for (let s = Math.ceil(tStart); s <= Math.floor(tEnd); s++) {
        const x = cursorX + (s - t) * pxPerSec;
        ctx.strokeStyle = s < 0 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.05)';
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        if (s >= 0) { ctx.fillStyle = T.text4; ctx.font = `9px ${T.fontMono}`; ctx.textBaseline = 'bottom'; ctx.fillText(fmtTC(s, FPS).slice(3), x + 3, h - 2); }
      }

      // START / PI markers (before 0)
      const mark = (sec, label, col) => {
        const x = cursorX + (sec - t) * pxPerSec; if (x < -40 || x > w) return;
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash(sec === -2 ? [4, 3] : []);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = col; ctx.font = `700 8px ${T.fontMono}`; ctx.textBaseline = 'top'; ctx.fillText(label, x + 3, 3);
      };
      mark(-3, 'START', '#fff'); mark(-2, 'BIP', T.info); mark(0, 'PI', '#fff');

      // scene-cut markers (plans)
      [6.8, 13.6].forEach(sc => {
        const x = cursorX + (sc - t) * pxPerSec; if (x < 0 || x > w) return;
        ctx.strokeStyle = T.violet; ctx.setLineDash([2, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = T.violet; ctx.font = `700 8px ${T.fontMono}`; ctx.textBaseline = 'top'; ctx.fillText('PLAN', x + 3, 16);
      });

      // boucle marker
      [11, 15.4].forEach((bt, i) => {
        const x = cursorX + (bt - t) * pxPerSec; if (x < 0 || x > w) return;
        ctx.strokeStyle = accent; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = accent; ctx.font = `700 8px ${T.fontMono}`; ctx.fillText('B1', x + 3, h - 14);
      });

      // subtitle blocks + elastic text
      SUBS.forEach(s => {
        if (!visible.includes(s.char)) return;
        const ti = visible.indexOf(s.char), tc = trackOf(s.char);
        const y0 = ti * trackH;
        const left = cursorX + (s.start - t) * pxPerSec, right = cursorX + (s.end - t) * pxPerSec;
        const bw = right - left; if (right < 0 || left > w) return;
        const act = t >= s.start && t <= s.end;
        const isReact = s.text.startsWith('(');

        // block bg
        if (isMin) { ctx.fillStyle = tc.hex + (act ? '88' : '44'); ctx.fillRect(Math.max(0, left), y0 + trackH - 3, Math.min(w, right) - Math.max(0, left), 2); }
        else if (isNeon) { ctx.strokeStyle = tc.hex + (act ? 'cc' : '66'); ctx.lineWidth = 1; if (act) { ctx.shadowColor = tc.hex; ctx.shadowBlur = 8; } ctx.strokeRect(left + 1, y0 + 4, bw - 2, trackH - 8); ctx.shadowBlur = 0; }
        else { ctx.fillStyle = tc.hex + (act ? '22' : '12'); ctx.fillRect(left, y0 + 3, bw, trackH - 6); ctx.fillStyle = tc.hex; ctx.fillRect(left, y0 + 3, 2.5, trackH - 6); }

        // elastic text: spread letters across block width
        ctx.save(); ctx.beginPath(); ctx.rect(Math.max(0, left), y0, Math.min(w, right) - Math.max(0, left), trackH); ctx.clip();
        const fontPx = isReact ? 14 : (font === 'manuscrite' ? 26 : 20);
        ctx.font = `${isReact ? 'italic ' : ''}600 ${fontPx}px ${FONTS[font]}`;
        ctx.textBaseline = 'middle';
        const pad = 12, availW = bw - pad * 2;
        const natW = ctx.measureText(s.text).width;
        const stretch = availW > 0 ? availW / natW : 1;
        const yMid = y0 + trackH / 2 + (font === 'manuscrite' ? 2 : 0);
        ctx.fillStyle = isReact ? tc.hex + (act ? 'ff' : 'aa') : (act ? '#fff' : 'rgba(255,255,255,.42)');
        if (isNeon && act) { ctx.shadowColor = tc.hex; ctx.shadowBlur = 6; }
        // draw letter by letter with horizontal scale
        let cx = left + pad;
        const clamp = Math.max(0.7, Math.min(1.35, stretch));
        for (const ch of s.text) {
          const cw = ctx.measureText(ch).width;
          ctx.save(); ctx.translate(cx, yMid); ctx.scale(clamp, 1); ctx.fillText(ch, 0, 0); ctx.restore();
          cx += cw * clamp;
        }
        ctx.shadowBlur = 0;
        // stretch marker
        const mk = clamp < 0.82 ? T.danger : clamp > 1.12 ? T.info : null;
        if (mk && !isMin) { ctx.fillStyle = mk; ctx.fillRect(left + 2, y0 + trackH - 4, bw - 4, 2); }
        // détection signs on active word (labiale dots under round letters)
        if (showDet && act && !isReact) {
          ctx.fillStyle = '#c7ccd4'; let dx = left + pad;
          for (const ch of s.text) {
            const cw = ctx.measureText(ch).width * clamp;
            if ('oOaАeéuûbpm'.includes(ch)) { ctx.fillRect(dx, yMid - fontPx / 2 - 6, cw * 0.7, 2.2); }
            dx += cw;
          }
        }
        ctx.restore();

        // avatar at block left
        if (bw > 26 && left > -20) {
          const ax = Math.max(left, 0) + 7, ay = y0 + 9;
          ctx.beginPath(); ctx.arc(ax + 7, ay + 7, 8, 0, 7); ctx.fillStyle = act ? tc.hex : tc.hex + 'aa'; ctx.fill();
          ctx.fillStyle = '#0b0b0d'; ctx.font = `700 9px ${T.fontMono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(s.char[0], ax + 7, ay + 8); ctx.textAlign = 'left';
        }
      });

      // cursor
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cursorX, 0); ctx.lineTo(cursorX, h); ctx.stroke();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(cursorX - 7, 0); ctx.lineTo(cursorX + 7, 0); ctx.lineTo(cursorX, 9); ctx.fill();
    }, [t, accent, brStyle, pxPerSec, font, showDet, filter]);

    // Hold-click to scrub: drag the band like a film strip (left = forward in time)
    function onPointerDown(e) {
      e.preventDefault();
      setPlaying && setPlaying(false);
      const startX = e.clientX, startT = t;
      const cv = ref.current; if (cv) cv.style.cursor = 'grabbing';
      const move = (ev) => {
        const dx = startX - ev.clientX;
        let nt = startT + dx / pxPerSec;
        nt = Math.max(0, Math.min(17.5, nt));
        setT(nt);
      };
      const up = () => {
        if (cv) cv.style.cursor = 'grab';
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }

    return (
      <div style={{ height: 190, flexShrink: 0, borderTop: `2px solid ${T.border2}`, position: 'relative' }}>
        <canvas ref={ref} onPointerDown={onPointerDown}
          onContextMenu={(e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setCtx({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
          style={{ width: '100%', height: 190, display: 'block', cursor: 'grab', touchAction: 'none', userSelect: 'none' }} />
        <div style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 9, color: T.text4, fontFamily: T.fontMono, pointerEvents: 'none' }}>
          maintenir pour déplacer le curseur · double-clic éditer · clic-droit menu
        </div>
        {ctx && (
          <div style={{ position: 'absolute', left: Math.min(ctx.x, 600), top: Math.max(6, ctx.y - 40), zIndex: 60, width: 210,
            background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 6 }}>
            <MenuItem icon={ICONS.edit} onClick={() => setCtx(null)}>Éditer le texte</MenuItem>
            <MenuItem icon={ICONS.scissors} onClick={() => setCtx(null)}>Couper ici</MenuItem>
            <MenuItem icon={ICONS.plus} onClick={() => setCtx(null)}>Dupliquer après</MenuItem>
            <MenuItem icon={ICONS.loop} onClick={() => setCtx(null)}>Boucler cette réplique</MenuItem>
            <MenuSep />
            <MenuLabel>Personnage</MenuLabel>
            {T.tracks.slice(0, 4).map(tk => <MenuItem key={tk.name} color={tk.hex} icon={undefined} onClick={() => setCtx(null)}><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={tk.hex} size={8} />{tk.name}</span></MenuItem>)}
            <MenuSep />
            <MenuItem icon={ICONS.trash} danger onClick={() => setCtx(null)}>Supprimer</MenuItem>
          </div>
        )}
      </div>
    );
  }

  // ── Inspector (adaptive tabs) ──────────────────────────────
  function Inspector({ tab, setTab, sel, setSel, t, setT, accent, showDet, setShowDet, font, setFont, go }) {
    const target = SUBS[sel] || SUBS[0];
    const tc = trackOf(target.char);
    const TABS = [
      { id: 'repl', label: 'Répliques' },
      { id: 'char', label: 'Voix' },
      { id: 'det', label: 'Détection' },
      { id: 'loop', label: 'Boucles' },
      { id: 'lex', label: 'Lexique' },
    ];
    return (
      <div style={{ width: 392, flexShrink: 0, display: 'flex', flexDirection: 'column', background: T.surface, borderLeft: `1px solid ${T.border}`, overflow: 'hidden' }}>
        {/* active réplique header */}
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.border}`, background: tc.hex + '0c', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Popover width={200} trigger={(o, tog) => (
            <button onClick={tog} title="Réassigner le personnage" style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, flex: 1, minWidth: 0 }}>
              <Avatar name={target.char} color={tc.hex} size={38} ring />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontSize: T.fs.md, fontWeight: 700, color: tc.hex }}>{target.char}</span>
                  <Icon d={ICONS.chevron} size={12} stroke={T.text3} />
                  <span style={{ fontSize: 9.5, color: T.text3, letterSpacing: 1, fontWeight: 600 }}>· RÉPLIQUE {sel + 1}</span>
                </div>
                <div style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono }}>{fmtTC(target.start, FPS)} → {fmtTC(target.end, FPS)} · {(target.end - target.start).toFixed(1)}s</div>
              </div>
            </button>
          )}>
            {(close) => (<><MenuLabel>Personnage de la réplique</MenuLabel>
              {T.tracks.map(tk => (
                <MenuItem key={tk.name} active={tk.name === target.char} color={tk.hex} onClick={close}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={tk.hex} size={8} />{tk.name}</span>
                </MenuItem>
              ))}
              <MenuSep />
              <MenuItem icon={ICONS.plus} onClick={close}>Nouveau personnage…</MenuItem></>)}
          </Popover>
          <Btn size="sm" icon={ICONS.rec} danger title="Enregistrer (R)" onClick={() => go('record')} style={{ background: T.danger, color: '#fff' }} />
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', padding: '0 8px', borderBottom: `1px solid ${T.border}`, height: 40, gap: 2 }}>
          {TABS.map(tb => {
            const on = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)} style={{
                flex: 1, padding: '0 4px', background: 'transparent', border: 'none', cursor: 'pointer',
                color: on ? accent : T.text2, fontSize: T.fs.xs, fontWeight: on ? 600 : 500, fontFamily: T.fontUI,
                borderBottom: `2px solid ${on ? accent : 'transparent'}`, marginBottom: -1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {tb.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {tab === 'repl' && <ReplList sel={sel} setSel={setSel} setT={setT} accent={accent} />}
          {tab === 'char' && <VoixPanel accent={accent} />}
          {tab === 'det' && <DetPanel accent={accent} target={target} showDet={showDet} setShowDet={setShowDet} font={font} setFont={setFont} />}
          {tab === 'loop' && <LoopPanel accent={accent} setT={setT} />}
          {tab === 'lex' && <LexiconPanel accent={accent} />}
        </div>

        {/* footer */}
        <div style={{ padding: '9px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: T.text3 }}>
          <Kbd>⇧</Kbd><Kbd>↵</Kbd><span style={{ color: T.text4 }}>nouvelle réplique</span>
          <div style={{ flex: 1 }} /><Kbd>?</Kbd><span style={{ color: T.text4 }}>aide</span>
        </div>
      </div>
    );
  }

  function ReplList({ sel, setSel, setT, accent }) {
    return (
      <div style={{ padding: 8 }}>
        {SUBS.map((s, i) => {
          const tc = trackOf(s.char), on = i === sel, isR = s.text.startsWith('(');
          return (
            <div key={i} onClick={() => { setSel(i); setT(s.start + 0.1); }} style={{
              display: 'flex', gap: 9, padding: '9px 10px', marginBottom: 3, borderRadius: T.r.ctl, cursor: 'pointer', position: 'relative',
              background: on ? tc.hex + '14' : 'transparent', border: `1px solid ${on ? tc.hex + '44' : 'transparent'}`,
            }}>
              {on && <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2.5, background: tc.hex, borderRadius: 2 }} />}
              <div style={{ width: 22, height: 22, borderRadius: 5, background: tc.hex + '22', color: tc.hex, fontSize: 9.5, fontWeight: 700, fontFamily: T.fontMono, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <Chip color={tc.hex} soft style={{ padding: '0px 6px', fontSize: 9 }}>{s.char}</Chip>
                  <span style={{ fontSize: 9.5, color: T.text3, fontFamily: T.fontMono }}>{fmt(s.start)}→{fmt(s.end)}</span>
                  {s.note && <Icon d={ICONS.note} size={11} stroke={accent} title="note" />}
                  {s.take && <Dot color={T.danger} size={6} />}
                  <div style={{ flex: 1 }} /><span style={{ fontSize: 9.5, color: T.text4, fontFamily: T.fontMono }}>{(s.end - s.start).toFixed(1)}s</span>
                </div>
                <div style={{ fontSize: T.fs.sm, lineHeight: 1.4, color: on ? T.text : T.text2, fontStyle: isR ? 'italic' : 'normal', textWrap: 'pretty' }}>{s.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function VoixPanel({ accent }) {
    return (
      <div style={{ padding: 14 }}>
        {T.tracks.map(tc => {
          const subs = SUBS.filter(s => s.char === tc.name);
          const dur = subs.reduce((a, s) => a + (s.end - s.start), 0);
          return (
            <div key={tc.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                <Avatar name={tc.name} color={tc.hex} size={26} />
                <span style={{ fontSize: T.fs.sm, fontWeight: 600 }}>{tc.name}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono }}>{subs.length} répl · {dur.toFixed(1)}s</span>
              </div>
              <div style={{ height: 6, background: T.surface2, borderRadius: 3 }}>
                <div style={{ width: `${Math.min(100, dur / 12 * 100)}%`, height: '100%', background: tc.hex, borderRadius: 3, opacity: 0.8 }} />
              </div>
            </div>
          );
        })}
        <Btn variant="outline" full icon={ICONS.plus} style={{ marginTop: 6 }}>Nouveau personnage</Btn>
      </div>
    );
  }

  function DetPanel({ accent, target, showDet, setShowDet, font, setFont }) {
    const signs = [
      { k: 'labiale', label: 'Labiale', desc: 'b p m · lèvres fermées', col: '#c7ccd4', on: true },
      { k: 'semi', label: 'Semi-fermée', desc: 'consonnes douces', col: '#9aa0aa', on: true },
      { k: 'fric', label: 'Fricative', desc: 'f v s z · chevron', col: '#aab0ba', on: true },
      { k: 'rond', label: 'Arrondie', desc: 'o u ou · cercle', col: '#c7ccd4', on: true },
      { k: 'ouv', label: 'Ouverte', desc: 'a · arc', col: '#888', on: false },
    ];
    return (
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, marginBottom: 14 }}>
          <Icon d={ICONS.eye} size={17} stroke={showDet ? accent : T.text3} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: T.fs.sm, fontWeight: 600 }}>Calque détection</div>
            <div style={{ fontSize: 10.5, color: T.text3 }}>signes phonétiques sur les lettres</div>
          </div>
          <Toggle on={showDet} onClick={() => setShowDet(d => !d)} />
        </div>
        <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.2, fontWeight: 700, marginBottom: 9 }}>AFFICHAGE</div>
        <ToggleRow label="Rendu lettre par lettre" desc="texte élastique selon les timestamps Whisper" on accent={accent} />
        <ToggleRow label="Marqueurs d'étirement" desc="tic rouge si trop dense, bleu si trop épars" on accent={accent} />
        <ToggleRow label="Forme d'onde" desc="waveform derrière le texte" on accent={accent} />
        <div style={{ marginTop: 16, fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.2, fontWeight: 700, marginBottom: 9 }}>TYPES DE SIGNES</div>
        {signs.map(s => (
          <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 4px', borderBottom: `1px solid ${T.surface2}` }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: T.surface2, border: `1px solid ${T.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.col, fontFamily: T.fontMono, fontSize: 13, fontWeight: 700 }}>
              {s.k === 'labiale' ? '▬' : s.k === 'fric' ? '^' : s.k === 'rond' ? '○' : s.k === 'ouv' ? '◡' : '⋯'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text }}>{s.label}</div>
              <div style={{ fontSize: 10, color: T.text3 }}>{s.desc}</div>
            </div>
            <Toggle on={s.on} color={accent} />
          </div>
        ))}
        <div style={{ marginTop: 16, fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.2, fontWeight: 700, marginBottom: 8 }}>POLICE DE LA BANDE</div>
        <Segmented value={font} onChange={setFont} options={[{ v: 'manuscrite', l: 'Manuscrite' }, { v: 'atkinson', l: 'Atkinson' }, { v: 'mono', l: 'Mono' }]} />
        <div style={{ marginTop: 10, padding: 11, background: T.bg2, border: `1px dashed ${T.border2}`, borderRadius: T.r.ctl, fontSize: 11, color: T.text3, lineHeight: 1.5 }}>
          Clic sur une lettre dans la bande pour cycler son signe manuellement.
        </div>
      </div>
    );
  }

  function LoopPanel({ accent, setT }) {
    const loops = [{ n: 1, s: 11, e: 15.4 }, { n: 2, s: 4.6, e: 8 }];
    return (
      <div style={{ padding: 14 }}>
        <Btn variant="primary" full icon={ICONS.plus} style={{ marginBottom: 14 }}>Boucle au curseur</Btn>
        <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.2, fontWeight: 700, marginBottom: 9 }}>BOUCLES · {loops.length}</div>
        {loops.map(l => (
          <div key={l.n} onClick={() => setT(l.s + 0.1)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', marginBottom: 6, background: accent + '0e', border: `1px solid ${accent}33`, borderRadius: T.r.ctl, cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: accent + '22', color: accent, fontWeight: 800, fontFamily: T.fontMono, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>B{l.n}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: T.fs.sm, color: T.text, fontFamily: T.fontMono }}>{fmtTC(l.s, FPS)} → {fmtTC(l.e, FPS)}</div>
              <div style={{ fontSize: 10.5, color: T.text3 }}>{(l.e - l.s).toFixed(1)}s · {SUBS.filter(x => x.start >= l.s && x.end <= l.e).length} répliques</div>
            </div>
            <Btn size="sm" icon={ICONS.trash} />
          </div>
        ))}
      </div>
    );
  }

  function ToggleRow({ label, desc, on, accent }) {
    const [v, setV] = React.useState(on);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderBottom: `1px solid ${T.surface2}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text }}>{label}</div>
          {desc && <div style={{ fontSize: 10, color: T.text3 }}>{desc}</div>}
        </div>
        <Toggle on={v} onClick={() => setV(x => !x)} color={accent} />
      </div>
    );
  }

  function LexiconPanel({ accent }) {
    const [entries, setEntries] = React.useState([
      { id: 1, term: 'Sheriff', tr: 'Shérif', ph: 'ʃe.ʁif', global: false },
      { id: 2, term: 'Downtown', tr: 'Centre-ville', ph: '', global: true },
      { id: 3, term: 'Ranger', tr: 'Ranger', ph: 'ʁɑ̃.dʒœʁ', global: false },
    ]);
    const [term, setTerm] = React.useState('');
    const [tr, setTr] = React.useState('');
    const add = () => { if (!term.trim()) return; setEntries(e => [{ id: Date.now(), term: term.trim(), tr: tr.trim(), ph: '', global: false }, ...e]); setTerm(''); setTr(''); };
    const inp = { flex: 1, minWidth: 0, fontSize: 12, padding: '7px 9px', background: T.bg2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 7, outline: 'none', fontFamily: T.fontUI };
    return (
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Terme" style={inp} />
          <input value={tr} onChange={e => setTr(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Traduction" style={inp} />
          <Btn size="sm" variant="primary" icon={ICONS.plus} onClick={add} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Btn size="sm" variant="outline" icon={ICONS.globe} onClick={() => tr || setTr(term ? '(traduit)' : '')}>Traduire auto</Btn>
          <span style={{ fontSize: 10, color: T.text4 }}>Projet « S02 » + termes globaux</span>
        </div>
        {entries.map(e => {
          const tk = trackOf('LÉA');
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', marginBottom: 5, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl }}>
              <Icon d={ICONS.book} size={15} stroke={T.text3} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontSize: T.fs.sm, fontWeight: 600 }}>{e.term}</span>
                  {e.tr && <span style={{ fontSize: T.fs.xs, color: accent }}>→ {e.tr}</span>}
                  {e.global && <span style={{ fontSize: 8.5, color: T.text4, border: `1px solid ${T.border2}`, borderRadius: 3, padding: '0 4px' }}>global</span>}
                </div>
                {e.ph && <div style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, marginTop: 1 }}>/{e.ph}/</div>}
              </div>
              <Btn size="sm" icon={ICONS.trash} onClick={() => setEntries(x => x.filter(y => y.id !== e.id))} />
            </div>
          );
        })}
      </div>
    );
  }

  window.RScreens = window.RScreens || {};
  window.RScreens.Editor = Editor;
})();
