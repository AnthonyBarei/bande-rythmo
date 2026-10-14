/* App shell — left rail, top bar, command palette, screen router */
(function () {
  const { T, Icon, ICONS, Btn, Dot, Kbd, Avatar } = window.RD;

  const NAV = [
    { id: 'library', label: 'Bibliothèque', ic: ICONS.library },
    { id: 'import', label: 'Importer', ic: ICONS.import },
    { id: 'editor', label: 'Éditeur', ic: ICONS.edit },
    { id: 'record', label: 'Studio', ic: ICONS.mic },
    { id: 'meme', label: 'Atelier', ic: ICONS.meme },
  ];
  const NAV2 = [
    { id: 'activity', label: 'Activité', ic: ICONS.activity },
    { id: 'settings', label: 'Réglages', ic: ICONS.settings },
  ];

  function Rail({ screen, go, accent }) {
    const Item = ({ it }) => {
      const [h, setH] = React.useState(false);
      const on = screen === it.id;
      return (
        <button onClick={() => go(it.id)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} title={it.label}
          style={{
            width: 52, height: 52, borderRadius: 13, cursor: 'pointer', position: 'relative',
            background: on ? accent + '18' : (h ? T.surface2 : 'transparent'),
            border: `1px solid ${on ? accent + '44' : 'transparent'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            transition: 'background .14s',
          }}>
          {on && <div style={{ position: 'absolute', left: -9, top: 14, bottom: 14, width: 3, background: accent, borderRadius: 2 }} />}
          <Icon d={it.ic} size={19} stroke={on ? accent : (h ? T.text : T.text3)} />
          <span style={{ fontSize: 8.5, fontWeight: 600, color: on ? accent : T.text4, letterSpacing: 0.2 }}>{it.label}</span>
        </button>
      );
    };
    return (
      <div style={{ width: 74, flexShrink: 0, background: T.bg2, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 6 }}>
        {/* logo */}
        <div style={{ width: 40, height: 40, borderRadius: 11, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, boxShadow: `0 0 20px ${accent}55` }}>
          <Icon d={ICONS.wave} size={22} stroke="#0b0b0d" />
        </div>
        {NAV.map(it => <Item key={it.id} it={it} />)}
        <div style={{ flex: 1 }} />
        {NAV2.map(it => <Item key={it.id} it={it} />)}
        <div style={{ writingMode: 'vertical-rl', fontFamily: window.RD.T.fontMono, fontSize: 8, color: window.RD.T.text4, letterSpacing: 1, marginTop: 8, paddingBottom: 4 }}>WHISPER · BASE</div>
      </div>
    );
  }

  function TopBar({ accent, onCmd, onHelp }) {
    return (
      <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderBottom: `1px solid ${T.border}`, background: T.bg }}>
        <span style={{ fontSize: T.fs.sm, fontWeight: 700, letterSpacing: 0.5 }}>BANDE RYTHMO <span style={{ color: T.text4, fontWeight: 400 }}>· studio</span></span>
        <div style={{ flex: 1 }} />
        <button onClick={onCmd} style={{
          display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 12px', minWidth: 280,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99, cursor: 'pointer', color: T.text3,
        }}>
          <Icon d={ICONS.search} size={15} stroke={T.text3} />
          <span style={{ fontSize: T.fs.sm }}>Rechercher ou commande…</span>
          <div style={{ flex: 1 }} />
          <span style={{ display: 'flex', gap: 3 }}><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        </button>
        <Btn size="sm" icon={ICONS.keyboard} title="Raccourcis (?)" onClick={onHelp} />
        <Btn size="sm" icon={ICONS.activity} title="Activité" />
        <div style={{ width: 1, height: 22, background: T.border }} />
        <Avatar name="Studio" color={accent} size={30} />
      </div>
    );
  }

  function CommandPalette({ open, onClose, go, setAccent }) {
    const [q, setQ] = React.useState('');
    React.useEffect(() => { if (open) setQ(''); }, [open]);
    if (!open) return null;
    const cmds = [
      { label: 'Aller à la Bibliothèque', ic: ICONS.library, fn: () => go('library') },
      { label: 'Importer une vidéo', ic: ICONS.import, fn: () => go('import') },
      { label: 'Ouvrir l\u2019éditeur BR', ic: ICONS.edit, fn: () => go('editor') },
      { label: 'Studio d\u2019enregistrement', ic: ICONS.mic, fn: () => go('record') },
      { label: 'Atelier Meme · GIF · Audio', ic: ICONS.meme, fn: () => go('meme') },
      { label: 'Exporter', ic: ICONS.download, fn: () => go('export') },
      { label: 'Voir l\u2019activité', ic: ICONS.activity, fn: () => go('activity') },
      { label: 'Réglages', ic: ICONS.settings, fn: () => go('settings') },
      { label: 'Transcrire avec Whisper', ic: ICONS.sparkle, fn: () => go('activity') },
    ].filter(c => c.label.toLowerCase().includes(q.toLowerCase()));
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 560, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 18px', borderBottom: `1px solid ${T.border}` }}>
            <Icon d={ICONS.search} size={18} stroke={T.text3} />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une commande, un clip…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.text, fontSize: T.fs.md, fontFamily: T.fontUI }} />
            <Kbd>Esc</Kbd>
          </div>
          <div style={{ maxHeight: 360, overflow: 'auto', padding: 8 }}>
            {cmds.map((c, i) => (
              <button key={i} onClick={() => { c.fn(); onClose(); }} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 12px', borderRadius: T.r.ctl,
                background: i === 0 ? T.surface2 : 'transparent', border: 'none', cursor: 'pointer', color: T.text, textAlign: 'left',
                fontSize: T.fs.sm, fontFamily: T.fontUI,
              }}
                onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                onMouseLeave={e => e.currentTarget.style.background = i === 0 ? T.surface2 : 'transparent'}>
                <Icon d={c.ic} size={16} stroke={T.text2} />
                {c.label}
                {i === 0 && <><div style={{ flex: 1 }} /><Kbd>↵</Kbd></>}
              </button>
            ))}
            {cmds.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: T.text3, fontSize: T.fs.sm }}>Aucun résultat</div>}
          </div>
        </div>
      </div>
    );
  }

  function ShortcutsOverlay({ open, onClose }) {
    const { T, Icon, ICONS, Kbd } = window.RD;
    React.useEffect(() => {
      if (!open) return;
      const onKey = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open) return null;
    const GROUPS = [
      { title: 'Transport', rows: [
        { k: ['Espace', 'K'], l: 'Lecture / pause' }, { k: ['J'], l: 'Vitesse 0,5×' }, { k: ['L'], l: 'Vitesse 1,5×' },
        { k: ['M'], l: 'Mute' }, { k: ['←', '→'], l: '±1 s' }, { k: ['⇧←', '⇧→'], l: '±1 image' }, { k: [',', '.'], l: '±40 ms' },
      ]},
      { title: 'Bande rythmo', rows: [
        { k: ['I'], l: 'Marquer IN' }, { k: ['O'], l: 'Marquer OUT' }, { k: ['S'], l: 'Couper à la tête' },
        { k: ['Entrée'], l: 'Éditer la réplique' }, { k: ['⇧Entrée'], l: 'Nouvelle réplique' },
        { k: ['Suppr'], l: 'Supprimer la réplique' }, { k: ['Échap'], l: 'Quitter loop / édition' },
      ]},
      { title: 'Canvas — gestes', rows: [
        { k: ['maintenir'], l: 'Déplacer le curseur' }, { k: ['glisser'], l: 'Créer une réplique' }, { k: ['⇧ glisser'], l: 'Région de boucle' },
        { k: ['alt glisser'], l: 'Dupliquer' }, { k: ['ctrl molette'], l: 'Zoom px/s' }, { k: ['clic lettre'], l: 'Signe de détection' },
        { k: ['double-clic'], l: 'Éditer le texte' }, { k: ['clic droit'], l: 'Menu contextuel' },
      ]},
      { title: 'Général', rows: [
        { k: ['Ctrl', 'Z'], l: 'Annuler' }, { k: ['Ctrl', 'Y'], l: 'Rétablir' }, { k: ['⌘', 'K'], l: 'Palette de commandes' },
        { k: ['Ctrl', 'S'], l: 'Sauvegarder' }, { k: ['?'], l: 'Cette aide' },
      ]},
    ];
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 'min(860px,92vw)', maxHeight: '88vh', overflow: 'auto', background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <Icon d={ICONS.keyboard} size={20} stroke={T.accent} />
            <span style={{ fontSize: T.fs.lg, fontWeight: 600 }}>Raccourcis clavier</span>
            <span style={{ fontSize: T.fs.xs, color: T.text3 }}>Échap pour fermer</span>
            <div style={{ flex: 1 }} />
            <Btn size="sm" variant="outline" onClick={onClose}>Fermer</Btn>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 }}>
            {GROUPS.map(g => (
              <div key={g.title}>
                <div style={{ fontSize: 10.5, color: T.text3, letterSpacing: 1.2, fontWeight: 700, marginBottom: 9, textTransform: 'uppercase' }}>{g.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {g.rows.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r.ctl }}>
                      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{r.k.map((k, j) => <Kbd key={j}>{k}</Kbd>)}</span>
                      <span style={{ fontSize: T.fs.sm, color: T.text2, flex: 1, textAlign: 'right' }}>{r.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  window.RShell = { Rail, TopBar, CommandPalette, ShortcutsOverlay };
})();
