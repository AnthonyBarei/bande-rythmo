/* Screen — Bibliothèque (clips library) */
(function () {
  const { T, Icon, ICONS, Btn, Chip, Dot, Avatar, Select, fmt } = window.RD;
  const { CLIPS, STATUS } = window.RDATA;

  function Library({ go, accent }) {
    const [filter, setFilter] = React.useState('all');
    const counts = {
      all: CLIPS.length,
      todo: CLIPS.filter(c => c.status === 'todo').length,
      dubbing: CLIPS.filter(c => c.status === 'dubbing').length,
      review: CLIPS.filter(c => c.status === 'review').length,
      done: CLIPS.filter(c => c.status === 'done').length,
    };
    const list = filter === 'all' ? CLIPS : CLIPS.filter(c => c.status === filter);

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '26px 32px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: T.fs.micro, color: T.text3, letterSpacing: 1.4, fontWeight: 600, marginBottom: 4 }}>BIBLIOTHÈQUE</div>
              <div style={{ fontSize: T.fs.xxl, fontWeight: 600, letterSpacing: -0.6 }}>Mes clips</div>
            </div>
            <span style={{ fontSize: T.fs.sm, color: T.text3, fontFamily: T.fontMono, paddingBottom: 7 }}>
              {CLIPS.length} clips · {Math.round(CLIPS.reduce((a, c) => a + c.dur, 0))}s
            </span>
            <div style={{ flex: 1 }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', height: 40, minWidth: 260,
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99,
            }}>
              <Icon d={ICONS.search} size={15} stroke={T.text3} />
              <span style={{ fontSize: T.fs.sm, color: T.text3 }}>Rechercher un clip…</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: T.text4, fontFamily: T.fontMono, border: `1px solid ${T.border2}`, borderRadius: 4, padding: '1px 5px' }}>/</span>
            </div>
            <Btn variant="primary" size="lg" icon={ICONS.plus} onClick={() => go('import')}>Nouveau clip</Btn>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: `1px solid ${T.border}`, height: 42 }}>
            <Select size="sm" width={158} value="s02" onChange={() => {}} options={[
              { v: 'all', l: 'Tous les projets' }, { v: 's02', l: 'Projet · Saison 02', dot: T.accent }, { v: 's01', l: 'Projet · Saison 01', dot: T.info }, { v: 'memes', l: 'Memes & extraits', dot: T.violet },
            ]} />
            <div style={{ width: 1, height: 20, background: T.border, margin: '0 6px' }} />
            {[
              { id: 'all', label: 'Tous' },
              { id: 'todo', label: 'À faire' },
              { id: 'dubbing', label: 'Doublage' },
              { id: 'review', label: 'À revoir' },
              { id: 'done', label: 'Validé' },
            ].map(t => {
              const active = filter === t.id;
              return (
                <button key={t.id} onClick={() => setFilter(t.id)} style={{
                  height: 42, padding: '0 14px', background: 'transparent', border: 'none', cursor: 'pointer',
                  color: active ? T.text : T.text2, fontSize: T.fs.sm, fontWeight: active ? 600 : 500,
                  borderBottom: `2px solid ${active ? accent : 'transparent'}`, marginBottom: -1,
                  display: 'flex', alignItems: 'center', gap: 7, fontFamily: T.fontUI,
                }}>
                  {t.label}
                  <span style={{
                    fontSize: 10.5, padding: '1px 6px', borderRadius: 99, fontFamily: T.fontMono,
                    background: active ? accent + '22' : T.surface2, color: active ? accent : T.text3,
                  }}>{counts[t.id]}</span>
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: T.fs.xs, color: T.text3 }}>Trier</span>
            <Select size="sm" width={150} value="recent" onChange={() => {}} options={[
              { v: 'recent', l: 'Récents' }, { v: 'name', l: 'Nom A→Z' }, { v: 'dur', l: 'Durée' }, { v: 'status', l: 'Statut' },
            ]} />
          </div>
        </div>

        {/* Grid */}
        <div style={{
          flex: 1, overflow: 'auto', padding: 28,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gridAutoRows: 'max-content', gap: 18,
          alignContent: 'flex-start',
        }}>
          {list.map(c => <ClipCard key={c.id} clip={c} accent={accent} go={go} />)}
        </div>
      </div>
    );
  }

  function ClipCard({ clip, accent, go }) {
    const [h, setH] = React.useState(false);
    const st = STATUS[clip.status];
    return (
      <div
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        onClick={() => go('editor')}
        style={{
          background: T.surface, border: `1px solid ${h ? T.border2 : T.border}`, borderRadius: T.r.card,
          overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s, transform .15s, box-shadow .15s',
          transform: h ? 'translateY(-3px)' : 'none', boxShadow: h ? T.shadow : 'none',
          display: 'flex', flexDirection: 'column',
        }}>
        {/* Thumb */}
        <div style={{
          height: 168, flexShrink: 0, position: 'relative',
          background: `linear-gradient(135deg, hsl(${clip.hue},22%,20%), hsl(${clip.hue + 40},20%,12%))`,
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,.16) 3px 4px)` }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,.45)',
              border: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: h ? 1 : 0.85, transform: h ? 'scale(1.08)' : 'scale(1)', transition: 'all .15s',
            }}>
              <Icon d={ICONS.play} size={18} fill="#fff" stroke="#fff" />
            </div>
          </div>
          <div style={{
            position: 'absolute', top: 10, left: 10, padding: '3px 9px', borderRadius: 6,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
            background: st.bg, color: st.color, backdropFilter: 'blur(6px)',
          }}>{st.label}</div>
          <div style={{
            position: 'absolute', bottom: 10, right: 10, padding: '2px 8px', borderRadius: 5,
            fontFamily: T.fontMono, fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,.7)', color: '#fff',
          }}>{clip.dur.toFixed(1)}s</div>
        </div>

        {/* Body */}
        <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: T.fs.base, fontWeight: 600, lineHeight: 1.35, textWrap: 'pretty' }}>{clip.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: T.fs.xs, color: T.text3, fontFamily: T.fontMono }}>{clip.repl} répl.</span>
            <Dot color={T.border3} size={3} />
            <div style={{ display: 'flex' }}>
              {clip.chars.map((ch, i) => {
                const tc = T.tracks.find(t => t.name === ch) || T.tracks[0];
                return <div key={i} style={{ marginLeft: i ? -6 : 0 }}><Avatar name={ch} color={tc.hex} size={22} /></div>;
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', borderTop: `1px solid ${T.border}`,
          opacity: h ? 1 : 0.0, maxHeight: h ? 44 : 0, transition: 'opacity .15s, max-height .15s', overflow: 'hidden',
        }}>
          <button onClick={(e) => { e.stopPropagation(); go('editor'); }} style={{
            height: 44, padding: '0 14px', background: 'transparent', border: 'none', borderRight: `1px solid ${T.border}`,
            color: accent, fontWeight: 600, fontSize: T.fs.sm, cursor: 'pointer', fontFamily: T.fontUI,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Icon d={ICONS.edit} size={15} stroke={accent} /> Doubler
          </button>
          {[
            { ic: ICONS.mic, fn: 'record' },
            { ic: null, label: 'MP3' },
            { ic: null, label: 'GIF' },
            { ic: ICONS.trash, danger: true },
          ].map((a, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); a.fn && go(a.fn); }} style={{
              width: 44, height: 44, background: 'transparent', border: 'none',
              borderRight: i < 3 ? `1px solid ${T.border}` : 'none',
              color: a.danger ? T.danger + 'cc' : T.text3, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.fontMono, fontSize: 10, fontWeight: 700,
            }}>
              {a.ic ? <Icon d={a.ic} size={15} stroke="currentColor" /> : a.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  window.RScreens = window.RScreens || {};
  window.RScreens.Library = Library;
})();
