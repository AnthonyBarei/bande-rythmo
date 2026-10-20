/* Screens — Studio d'enregistrement + Export */
(function () {
  const { T, Icon, ICONS, Btn, Chip, Dot, Avatar, Segmented, Toggle, ProgressBar, fmt, fmtTC } = window.RD;
  const { SUBS, TAKES } = window.RDATA;
  const trackOf = (n) => T.tracks.find(t => t.name === n) || T.tracks[0];

  if (!document.getElementById('st-kf')) { const st = document.createElement('style'); st.id = 'st-kf'; st.textContent = '@keyframes stCount{0%{transform:scale(1.5);opacity:0}25%{opacity:1}100%{transform:scale(.9);opacity:.15}}@keyframes stBlink{50%{opacity:0}}@keyframes stIn{from{transform:translateY(-6px);opacity:0}to{transform:none;opacity:1}}'; document.head.appendChild(st); }
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
  window.RScreens.Export = Export;
  window.RScreens._Header = ScreenHeader;
})();
