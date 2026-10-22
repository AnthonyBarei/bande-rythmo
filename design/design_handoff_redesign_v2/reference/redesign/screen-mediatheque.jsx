/* Importer › Médiathèque — original layout (sidebar + grid + breadcrumb) with hover motion and pagination */
(function () {
  const { T, Icon, ICONS, Btn, Chip, Dot, Kbd, Popover, MenuItem, MenuLabel } = window.RD;
  const LI = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    tv: <><rect x="2.5" y="5" width="19" height="13" rx="2"/><path d="M8 21h8M12 18v3"/></>,
    film: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/></>,
    sort: 'M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3',
    reload: <><path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/></>,
    history: <><path d="M3 12a9 9 0 103-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    arrowL: 'M15 6l-6 6 6 6', arrowR: 'M9 6l6 6-6 6',
  };
  if (!document.getElementById('mt-css')) {
    const s = document.createElement('style'); s.id = 'mt-css';
    s.textContent = `
.mt-card{position:relative;display:flex;flex-direction:column;background:none;border:none;padding:0;text-align:left;cursor:pointer;color:inherit;font:inherit;border-radius:12px;outline:none}
.mt-art{position:relative;border-radius:10px;overflow:hidden;background:#16161a;box-shadow:0 0 0 1px #26262d;transition:transform .22s cubic-bezier(.2,.7,.2,1),box-shadow .22s}
.mt-art>.mt-img{position:absolute;inset:0;transition:transform .5s cubic-bezier(.2,.7,.2,1),filter .3s}
.mt-card:hover .mt-art,.mt-card:focus-visible .mt-art{transform:translateY(-4px);box-shadow:0 0 0 1px #3f3f4a,0 16px 36px rgba(0,0,0,.55)}
.mt-card:focus-visible .mt-art{box-shadow:0 0 0 2px #F5C518,0 16px 36px rgba(0,0,0,.55)}
.mt-card:hover .mt-img,.mt-card:focus-visible .mt-img{transform:scale(1.06);filter:brightness(.62)}
.mt-ov{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;gap:8px;padding:12px;opacity:0;transform:translateY(8px);transition:opacity .2s,transform .22s cubic-bezier(.2,.7,.2,1)}
.mt-card:hover .mt-ov,.mt-card:focus-visible .mt-ov{opacity:1;transform:none}
.mt-meta{position:absolute;left:8px;bottom:8px;padding:2px 7px;border-radius:5px;background:rgba(0,0,0,.72);font:600 10.5px 'JetBrains Mono',monospace;color:#ECECEF;transition:opacity .15s}
.mt-card:hover .mt-meta,.mt-card:focus-visible .mt-meta{opacity:0}
.mt-stack{position:absolute;inset:0;border-radius:10px;background:#24242b;box-shadow:0 0 0 1px #32323b;transition:transform .25s cubic-bezier(.2,.7,.2,1)}
.mt-stack.s1{transform:translate(5px,-5px)}.mt-stack.s2{transform:translate(10px,-10px);background:#1c1c21}
.mt-card:hover .mt-stack.s1,.mt-card:focus-visible .mt-stack.s1{transform:translate(8px,-11px) rotate(2deg)}
.mt-card:hover .mt-stack.s2,.mt-card:focus-visible .mt-stack.s2{transform:translate(15px,-18px) rotate(4deg)}
.mt-title{margin-top:9px;font-size:13px;font-weight:600;color:#ECECEF;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;transition:color .15s}
.mt-card:hover .mt-title{color:#F5C518}
.mt-sub{font-size:11.5px;color:#7A7A85;margin-top:2px}
.mt-cta{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:7px;background:#F5C518;color:#0b0b0d;font:700 12px 'IBM Plex Sans',sans-serif}
.mt-cta.ghost{background:rgba(255,255,255,.14);color:#fff;backdrop-filter:blur(4px)}
.mt-desc{font-size:11.5px;line-height:1.4;color:#d8d8dd;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.mt-row{display:grid;grid-template-columns:176px minmax(0,1fr) auto;gap:16px;align-items:center;padding:10px;border-radius:12px;border:1px solid transparent;background:none;text-align:left;cursor:pointer;color:inherit;font:inherit;width:100%;outline:none;transition:background .15s,border-color .15s}
.mt-row:hover,.mt-row:focus-visible{background:#16161a;border-color:#26262d}.mt-row:focus-visible{border-color:#F5C518}
.mt-thumb{position:relative;aspect-ratio:16/9;border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px #26262d}
.mt-thumb>.mt-img{position:absolute;inset:0;transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.mt-row:hover .mt-img{transform:scale(1.07)}
.mt-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;background:rgba(0,0,0,.35)}
.mt-row:hover .mt-play,.mt-row:focus-visible .mt-play{opacity:1}
.mt-play>span{width:38px;height:38px;border-radius:50%;background:#F5C518;display:flex;align-items:center;justify-content:center;transform:scale(.8);transition:transform .25s cubic-bezier(.3,1.6,.5,1)}
.mt-row:hover .mt-play>span{transform:scale(1)}
.mt-rcta{opacity:0;transform:translateX(-6px);transition:opacity .18s,transform .2s}
.mt-row:hover .mt-rcta,.mt-row:focus-visible .mt-rcta{opacity:1;transform:none}
.mt-skel{border-radius:10px;background:linear-gradient(90deg,#16161a 0%,#1f1f25 40%,#16161a 80%);background-size:300% 100%;animation:mtShim 1.2s linear infinite}
@keyframes mtShim{from{background-position:100% 0}to{background-position:-200% 0}}
@keyframes mtIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.mt-in{animation:mtIn .35s cubic-bezier(.2,.7,.2,1) both}
.mt-shelf{display:grid;grid-auto-flow:column;grid-auto-columns:150px;gap:16px;overflow-x:auto;scroll-behavior:smooth;padding:8px 2px 6px;scrollbar-width:none}
.mt-shelf::-webkit-scrollbar{display:none}
.mt-shelfwrap .mt-arrow{opacity:0;transition:opacity .2s}.mt-shelfwrap:hover .mt-arrow{opacity:1}
.mt-tab{position:relative;height:40px;display:flex;align-items:center;gap:7px;padding:0 2px;background:none;border:none;cursor:pointer;font:600 14px 'IBM Plex Sans',sans-serif;color:#7A7A85;transition:color .15s}
.mt-tab:hover{color:#ECECEF}.mt-tab[data-on="1"]{color:#ECECEF}
.mt-tab::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px;background:#F5C518;transform:scaleX(0);transition:transform .25s cubic-bezier(.2,.7,.2,1)}
.mt-tab[data-on="1"]::after{transform:scaleX(1)}
.mt-az button{width:22px;height:19px;border:none;background:none;border-radius:5px;font:600 10.5px 'JetBrains Mono',monospace;color:#7A7A85;cursor:pointer;transition:color .12s,background .12s,transform .12s}
.mt-az button:hover{color:#0b0b0d;background:#F5C518;transform:scale(1.15)}
.mt-az button:disabled{color:#32323b;cursor:default;background:none;transform:none}
.mt-prov{display:flex;align-items:center;gap:9px;height:36px;padding:0 12px;border-radius:9px;border:1px solid transparent;background:none;cursor:pointer;font:600 13px 'IBM Plex Sans',sans-serif;color:#A6A6AE;transition:background .15s,border-color .15s,color .15s}
.mt-prov:hover{background:#1c1c21;color:#ECECEF}.mt-prov[data-on="1"]{background:#24242b;border-color:#32323b;color:#ECECEF}
.mt-sug{display:flex;align-items:center;gap:10px;width:100%;padding:7px 10px;border:none;border-radius:7px;background:none;cursor:pointer;text-align:left;color:#ECECEF;font:13px 'IBM Plex Sans',sans-serif}
.mt-sug:hover,.mt-sug[data-on="1"]{background:#24242b}
.mt-hl{color:#F5C518;font-weight:700}`;
    document.head.appendChild(s);
  }

  // ── fake library data (no real artwork — generated posters)
  const W1 = ['Le', 'La', 'Les', 'Un', 'Une', 'Nuit', 'Port', 'Ville', 'Ligne', 'Ombre', 'Rive', 'Saison', 'Code', 'Mémoire', 'Fièvre', 'Écho', 'Signal', 'Rouge', 'Hiver', 'Atlas'];
  const W2 = ['blanche', 'du nord', 'sans nom', 'perdue', 'des sables', 'de verre', 'nocturne', 'électrique', 'de minuit', 'invisible', 'sauvage', 'brûlée', 'des oiseaux', 'lointaine', 'parallèle', 'du phare'];
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const FILMS = Array.from({ length: 96 }, (_, i) => {
    const h = hash('f' + i), t = `${W1[h % W1.length]} ${W2[(h >>> 5) % W2.length]}`;
    return { id: 'f' + i, kind: 'film', title: i % 7 === 3 ? t.split(' ')[0] + ' ' + (1 + h % 9) : t, year: 1972 + h % 53, dur: 84 + (h >>> 9) % 70, added: i,
      desc: 'Un soir de tempête, une équipe de tournage reste bloquée dans un hôtel vide. Le film se double à mesure que les répliques se répètent.' };
  }).filter((f, i, a) => a.findIndex(x => x.title === f.title) === i);
  const SERIES = [
    ['Port Sauvage', 2021, [9, 9]], ['Ligne 7', 2019, [8]], ['Les Veilleurs', 2016, [10, 10, 8]], ['Atlas', 2024, [6]], ['Mémoire vive', 2018, [12, 12]],
    ['Hiver rouge', 2022, [8, 8, 8, 6]], ['Signal faible', 2025, [7]], ['La Rive', 2013, [10, 10]], ['Code nocturne', 2020, [6, 6]], ['Échos', 2026, [8]],
  ].map(([title, year, seasons], i) => ({ id: 's' + i, kind: 'series', title, year, seasons, added: i * 3 + 1,
    desc: 'Dans une ville portuaire, une brigade de nuit enquête sur des disparitions qui semblent suivre un script.' }));
  const EP_NAMES = ['Le premier soir', 'Fausse piste', 'Ceux qui restent', 'La carte', 'Contre-champ', 'Hors du cadre', 'Le raccord', 'Doublure', 'Silence plateau', 'Dernière prise', 'Plan-séquence', 'Retour image'];
  const episodes = (s, sn) => Array.from({ length: s.seasons[sn - 1] }, (_, i) => ({ id: `${s.id}-${sn}-${i}`, kind: 'episode', series: s, season: sn, n: i + 1, title: EP_NAMES[(i + sn * 3 + s.title.length) % EP_NAMES.length], dur: 38 + hash(s.id + sn + i) % 22, year: s.year + sn - 1,
    desc: 'L’équipe retrouve une bande magnétique oubliée. Les voix ne correspondent plus aux lèvres, et quelqu’un l’a fait exprès.' }));
  const RESUME = [
    { item: FILMS[4], note: '2 clips · il y a 2 j' }, { item: episodes(SERIES[0], 1)[0], note: '1 clip · hier' }, { item: FILMS[11], note: '4 clips · il y a 6 j' },
  ];
  const fmtDur = (m) => m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
  const epCode = (e) => `S${String(e.season).padStart(2, '0')}E${String(e.n).padStart(2, '0')}`;
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function Art({ item, ratio = '2/3', still }) {
    const key = item.kind === 'episode' ? item.series.title + item.season + item.n : item.title;
    const h = hash(key), hue = h % 360, hue2 = (hue + 40 + (h >>> 8) % 80) % 360, lay = (h >>> 4) % 3;
    const title = item.kind === 'episode' ? item.series.title : item.title;
    const bg = still
      ? `radial-gradient(120% 90% at ${20 + h % 60}% ${30 + (h >>> 6) % 40}%, oklch(0.55 0.11 ${hue}) 0%, oklch(0.28 0.06 ${hue2}) 55%, oklch(0.16 0.02 ${hue2}) 100%)`
      : `linear-gradient(${150 + h % 60}deg, oklch(0.42 0.12 ${hue}) 0%, oklch(0.2 0.06 ${hue2}) 70%, oklch(0.14 0.03 ${hue2}) 100%)`;
    return (
      <div className="mt-img" style={{ background: bg }}>
        {!still && <div style={{ position: 'absolute', left: 12, right: 12, [lay === 0 ? 'top' : 'bottom']: lay === 2 ? '38%' : 16, fontFamily: lay === 1 ? "'Caveat', cursive" : T.fontUI, fontWeight: 800, fontSize: lay === 1 ? 30 : 19, lineHeight: 1, letterSpacing: lay === 1 ? 0 : -0.3, color: '#fff', textTransform: lay === 0 ? 'uppercase' : 'none', textWrap: 'balance', textAlign: lay === 2 ? 'center' : 'left', opacity: 0.92 }}>{title}</div>}
        {still && <div style={{ position: 'absolute', left: '-10%', right: '-10%', bottom: '-20%', height: '60%', background: `radial-gradient(50% 50% at 50% 50%, oklch(0.1 0.02 ${hue}) 0%, transparent 70%)` }} />}
      </div>
    );
  }

  if (!document.getElementById('mt-css2')) {
    const s2 = document.createElement('style'); s2.id = 'mt-css2';
    s2.textContent = '.mt-foot{display:flex;align-items:center;gap:8px;padding:9px 10px 0}.mt-foot .mt-title{margin:0;flex:1;min-width:0;-webkit-line-clamp:1}.mt-chev{display:flex;color:#565660;transition:transform .2s cubic-bezier(.2,.7,.2,1),color .15s}.mt-card:hover .mt-chev,.mt-card:focus-visible .mt-chev{transform:translateX(3px);color:#F5C518}'
      + '.mt-box{background:#16161a;border-radius:12px;box-shadow:0 0 0 1px #26262d;padding-bottom:9px;transition:box-shadow .22s,transform .22s cubic-bezier(.2,.7,.2,1)}.mt-card:hover .mt-box,.mt-card:focus-visible .mt-box{transform:translateY(-4px);box-shadow:0 0 0 1px #3f3f4a,0 16px 36px rgba(0,0,0,.55)}.mt-card:focus-visible .mt-box{box-shadow:0 0 0 2px #F5C518,0 16px 36px rgba(0,0,0,.55)}'
      + '.mt-box .mt-art{border-radius:12px 12px 0 0;box-shadow:none}.mt-card:hover .mt-box .mt-art,.mt-card:focus-visible .mt-box .mt-art{transform:none;box-shadow:none}.mt-box .mt-sub{padding:0 10px}'
      + '.mt-lib{display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 10px;border-radius:9px;border:1px solid transparent;background:none;cursor:pointer;color:#A6A6AE;font:500 13.5px "IBM Plex Sans",sans-serif;transition:background .15s,color .15s}.mt-lib:hover{background:#1c1c21;color:#ECECEF}.mt-lib[data-on="1"]{background:rgba(245,197,24,.1);border-color:rgba(245,197,24,.45);color:#F5C518;font-weight:600}'
      + '.mt-pg{min-width:32px;height:32px;padding:0 8px;border-radius:8px;border:1px solid transparent;background:none;cursor:pointer;color:#A6A6AE;font:600 12.5px "JetBrains Mono",monospace;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s,border-color .15s}.mt-pg:hover:not(:disabled){background:#1c1c21;color:#ECECEF;border-color:#32323b}.mt-pg[data-on="1"]{background:#F5C518;color:#0b0b0d}.mt-pg:disabled{opacity:.35;cursor:default}';
    document.head.appendChild(s2);
  }
  const Hl = ({ text, q }) => { const i = q ? norm(text).indexOf(norm(q)) : -1; if (i < 0) return text; return <>{text.slice(0, i)}<span className="mt-hl">{text.slice(i, i + q.length)}</span>{text.slice(i + q.length)}</>; };
  const PAGE = 24;

  function MCard({ item, i, onOpen, onPick, q }) {
    const folder = item.kind === 'series' || item.kind === 'season';
    const ep = item.kind === 'episode';
    const art = item.kind === 'season' ? { ...item.series, title: item.series.title + ' ' + item.n } : item;
    const title = ep ? <>{'E' + String(item.n).padStart(2, '0')} · <Hl text={item.title} q={q} /></> : item.kind === 'season' ? 'Saison ' + item.n : <Hl text={item.title} q={q} />;
    const sub = { film: 'Film', series: 'Série', season: 'Saison', episode: q ? item.series.title + ' · ' + epCode(item) : 'Épisode' }[item.kind];
    const meta = ep ? item.year + ' · ' + fmtDur(item.dur) : item.kind === 'film' ? item.year + ' · ' + fmtDur(item.dur) : item.kind === 'season' ? item.series.year + item.n - 1 : item.year;
    return (
      <button className="mt-card mt-in" style={{ animationDelay: Math.min(i, 12) * 25 + 'ms' }} onClick={() => folder ? onOpen(item) : onPick(item)} title={(folder ? 'Ouvrir ' : 'Importer ') + (ep ? item.title : item.title || 'Saison ' + item.n)}>
        <div className="mt-box">
          <div className="mt-art" style={{ position: 'relative', aspectRatio: ep ? '16/9' : '2/3' }}>
            <Art item={ep ? item : art} still={ep} />
            <span className="mt-meta">{meta}</span>
            <div className="mt-ov" style={{ background: 'linear-gradient(transparent 25%, rgba(0,0,0,.65))' }}>
              {!ep && item.desc && <div className="mt-desc">{item.desc}</div>}
              <span className={'mt-cta' + (folder ? ' ghost' : '')}><Icon d={folder ? ICONS.chevronR : ICONS.import} size={13} stroke={folder ? '#fff' : '#0b0b0d'} />{folder ? 'Ouvrir' : 'Importer'}</span>
            </div>
          </div>
          <div className="mt-foot"><div className="mt-title">{title}</div>{folder && <span className="mt-chev"><Icon d={ICONS.chevronR} size={14} stroke="currentColor" /></span>}</div>
          <div className="mt-sub">{sub}</div>
        </div>
      </button>
    );
  }

  function Pager({ page, pages, total, from, to, set }) {
    if (pages <= 1) return <div style={{ textAlign: 'center', fontSize: 12, color: T.text4, fontFamily: T.fontMono, marginTop: 22 }}>{total} élément{total > 1 ? 's' : ''}</div>;
    const nums = [];
    for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p); else if (nums[nums.length - 1] !== '…') nums.push('…');
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: T.text3, fontFamily: T.fontMono, marginRight: 12 }}>{from}–{to} sur {total}</span>
        <button className="mt-pg" disabled={page === 1} onClick={() => set(page - 1)} title="Page précédente (PgPréc)"><Icon d={ICONS.chevronL} size={14} stroke="currentColor" /></button>
        {nums.map((p, k) => p === '…' ? <span key={'e' + k} style={{ width: 24, textAlign: 'center', color: T.text4 }}>…</span> : <button key={p} className="mt-pg" data-on={p === page ? '1' : '0'} onClick={() => set(p)}>{p}</button>)}
        <button className="mt-pg" disabled={page === pages} onClick={() => set(page + 1)} title="Page suivante (PgSuiv)"><Icon d={ICONS.chevronR} size={14} stroke="currentColor" /></button>
      </div>
    );
  }

  function Mediatheque({ accent, onPick }) {
    const { Segmented } = window.RD;
    const [prov, setProv] = React.useState('jellyfin');
    const [lib, setLib] = React.useState('films');
    const [path, setPath] = React.useState([]); // [series] or [series, season]
    const [q, setQ] = React.useState('');
    const [pageBy, setPageBy] = React.useState({});
    const [loading, setLoading] = React.useState(false);
    const [focus, setFocus] = React.useState(false);
    const scRef = React.useRef(null);
    const ctx = q.trim() ? 'q:' + q.trim() : lib + '/' + path.map(p => p.id || p.n).join('/');
    const page = pageBy[ctx] || 1;

    let items;
    const S = norm(q.trim());
    if (S) items = lib === 'films' ? FILMS.filter(f => norm(f.title).includes(S))
      : [...SERIES.filter(x => norm(x.title).includes(S)), ...SERIES.flatMap(s => s.seasons.flatMap((_, k) => episodes(s, k + 1))).filter(e => norm(e.title).includes(S) || norm(e.series.title).includes(S))];
    else if (lib === 'films') items = FILMS;
    else if (!path.length) items = SERIES;
    else if (path.length === 1) items = path[0].seasons.map((n, k) => ({ id: path[0].id + 's' + (k + 1), kind: 'season', series: path[0], n: k + 1, eps: n }));
    else items = episodes(path[0], path[1].n);
    const epView = items.length && items.every(x => x.kind === 'episode');
    const pages = Math.max(1, Math.ceil(items.length / PAGE));
    const slice = items.slice((page - 1) * PAGE, page * PAGE);

    const flash = (fn) => { setLoading(true); fn(); if (scRef.current) scRef.current.scrollTop = 0; setTimeout(() => setLoading(false), 380); };
    const setPage = (p) => flash(() => setPageBy(m => ({ ...m, [ctx]: Math.min(pages, Math.max(1, p)) })));
    const open = (it) => flash(() => { setQ(''); if (it.kind === 'series') setPath(it.seasons.length === 1 ? [it, { n: 1 }] : [it]); else setPath(p => [p[0] || it.series, it]); });
    const up = () => flash(() => setPath(p => (p.length === 2 && p[0].seasons.length === 1) ? [] : p.slice(0, -1)));
    const goLib = (l) => flash(() => { setLib(l); setPath([]); setQ(''); });

    React.useEffect(() => {
      const k = (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'PageDown') { e.preventDefault(); setPage(page + 1); }
        if (e.key === 'PageUp') { e.preventDefault(); setPage(page - 1); }
        if (e.key === 'Backspace' && path.length) { e.preventDefault(); up(); }
      };
      window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
    });

    const GRID = { display: 'grid', gridTemplateColumns: epView ? 'repeat(auto-fill, minmax(230px, 1fr))' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, alignContent: 'start' };
    const libName = lib === 'films' ? 'Films' : 'Séries';
    const ph = path.length ? 'Filtrer ' + (path.length === 2 ? 'Saison ' + path[1].n : path[0].title) + '…' : 'Rechercher dans ' + libName + '…';

    if (prov === 'plex') return <Reconnect accent={accent} prov={prov} setProv={setProv} />;

    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 16, minHeight: 0 }}>
        <div style={{ width: 200, flexShrink: 0, background: T.surface, border: '1px solid ' + T.border, borderRadius: T.r.card, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'flex-start' }}>
          <Segmented size="sm" value={prov} onChange={setProv} options={[{ v: 'plex', l: 'Plex' }, { v: 'jellyfin', l: 'Jellyfin' }]} />
          <div style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700, margin: '10px 8px 2px' }}>BIBLIOTHÈQUES</div>
          {[{ id: 'films', l: 'Films', n: FILMS.length }, { id: 'series', l: 'Séries', n: SERIES.length }].map(x => (
            <button key={x.id} className="mt-lib" data-on={lib === x.id ? '1' : '0'} onClick={() => goLib(x.id)}>
              <Icon d={<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />} size={15} stroke="currentColor" />
              <span style={{ flex: 1, textAlign: 'left' }}>{x.l}</span><span style={{ fontFamily: T.fontMono, fontSize: 11, opacity: 0.6 }}>{x.n}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ flex: 1, height: 36, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', background: T.surface, border: '1px solid ' + (focus ? accent : T.border2), borderRadius: 999, boxShadow: focus ? '0 0 0 3px ' + accent + '22' : 'none', transition: 'border-color .15s, box-shadow .15s' }}>
              <Icon d={ICONS.search} size={14} stroke={focus ? accent : T.text3} />
              <input value={q} placeholder={ph} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: T.text, fontSize: 13, fontFamily: T.fontUI }} />
              {q && <button onClick={() => setQ('')} title="Effacer" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}><Icon d={ICONS.close} size={12} stroke={T.text3} /></button>}
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text2 }}><Dot color={T.success} size={6} />K8Plus</span>
            <Btn size="sm" variant="outline" icon={LI.reload} onClick={() => flash(() => {})}>Recharger</Btn>
          </div>
          {path.length > 0 && !q && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, flexShrink: 0 }}>
              <Btn size="sm" variant="outline" icon={ICONS.chevronL} onClick={up}>Retour</Btn>
              <button onClick={() => flash(() => setPath([]))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text2, fontFamily: T.fontUI, fontSize: 13, padding: 0 }}>Séries</button>
              <Icon d={ICONS.chevronR} size={12} stroke={T.text4} />
              {path.length === 2 && path[0].seasons.length > 1
                ? <button onClick={() => flash(() => setPath(p => p.slice(0, 1)))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text2, fontFamily: T.fontUI, fontSize: 13, padding: 0 }}>{path[0].title}</button>
                : <span style={{ color: path.length === 1 ? T.text : T.text2, fontWeight: path.length === 1 ? 600 : 400 }}>{path[0].title}</span>}
              {path.length === 2 && <><Icon d={ICONS.chevronR} size={12} stroke={T.text4} /><span style={{ color: T.text, fontWeight: 600 }}>Saison {path[1].n}</span></>}
            </div>
          )}
          <div ref={scRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '6px 4px 20px' }}>
            {loading ? (
              <div style={GRID}>{Array.from({ length: epView ? 8 : 12 }).map((_, i) => <div key={i} className="mt-skel" style={{ aspectRatio: epView ? '16/13' : '2/3.55', animationDelay: i * 50 + 'ms' }} />)}</div>
            ) : items.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: T.text3, fontSize: 13 }}>Aucun résultat pour « {q} » dans {libName}.</div>
            ) : <>
              <div key={ctx + page} style={GRID}>{slice.map((it, i) => <MCard key={it.id} item={it} i={i} q={q.trim()} onOpen={open} onPick={onPick} />)}</div>
              <Pager page={page} pages={pages} total={items.length} from={(page - 1) * PAGE + 1} to={Math.min(items.length, page * PAGE)} set={setPage} />
            </>}
          </div>
        </div>
      </div>
    );
  }

  function Reconnect({ accent, prov, setProv }) {
    const { Segmented } = window.RD;
    const [state, setState] = React.useState('down');
    const [tok, setTok] = React.useState('');
    const inp = { height: 36, width: '100%', padding: '0 12px', background: T.bg2, border: '1px solid ' + T.border2, borderRadius: 9, color: T.text, fontSize: 13, fontFamily: T.fontMono, outline: 'none' };
    const lab = { fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 };
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="mt-in" style={{ width: 460, background: T.surface, border: '1px solid ' + T.border2, borderRadius: T.r.card, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon d={LI.grid} size={17} stroke={accent} /><span style={{ fontSize: 16, fontWeight: 700 }}>Connecter Plex</span><span style={{ fontSize: 12, color: T.text3 }}>serveur local</span>
            <div style={{ flex: 1 }} /><Segmented size="sm" value={prov} onChange={setProv} options={[{ v: 'plex', l: 'Plex' }, { v: 'jellyfin', l: 'Jellyfin' }]} />
          </div>
          <div style={{ padding: '9px 12px', borderRadius: 9, fontSize: 12.5, lineHeight: 1.45, background: state === 'busy' ? T.surface2 : T.danger + '14', border: '1px solid ' + (state === 'busy' ? T.border2 : T.danger + '66'), color: state === 'busy' ? T.text2 : T.danger }}>
            {state === 'busy' ? 'Connexion…' : state === 'error' ? 'Connexion échouée — vérifiez l’URL et le token' : 'Serveur enregistré injoignable — 192.168.1.5:32400. Démarrez-le ou reconnectez-vous.'}
          </div>
          <span style={lab}>URL SERVEUR</span><input style={inp} defaultValue="http://192.168.1.5:32400" />
          <span style={lab}>TOKEN PLEX</span><input style={inp} type="password" placeholder="X-Plex-Token" value={tok} onChange={e => setTok(e.target.value)} />
          <span style={{ fontSize: 11.5, color: T.text3 }}>Plex Web → Paramètres → XML → attribut <span style={{ color: accent, fontFamily: T.fontMono }}>X-Plex-Token</span></span>
          <Btn variant={tok ? 'primary' : 'outline'} full icon={ICONS.plug} onClick={() => { setState('busy'); setTimeout(() => setState('error'), 1000); }}>{state === 'busy' ? 'Connexion…' : 'Connecter'}</Btn>
          <span style={{ fontSize: 11.5, color: T.text3, textAlign: 'center' }}>La connexion reste locale — clé stockée uniquement sur votre machine.</span>
        </div>
      </div>
    );
  }

  window.RScreens = window.RScreens || {};
  window.RScreens._Mediatheque = Mediatheque;
  window.RScreens._mtEpCode = epCode;
})();
