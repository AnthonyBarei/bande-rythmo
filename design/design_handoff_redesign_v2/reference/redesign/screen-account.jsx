/* Compte — connexion / inscription (plein écran) + page Mon compte */
(function () {
  const { T, Icon, ICONS, Btn, Chip, Dot, Avatar, Segmented, Toggle } = window.RD;
  const OK = T.success || '#5EC27C';
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const strength = (p) => !p ? 0 : (p.length >= 8 ? 1 : 0) + (/[A-Z]/.test(p) && /[a-z]/.test(p) ? 1 : 0) + (/[\d\W]/.test(p) ? 1 : 0);
  if (!document.getElementById('acc-kf')) { const st = document.createElement('style'); st.id = 'acc-kf'; st.textContent = '@keyframes accBand{from{transform:translateX(0)}to{transform:translateX(-50%)}}@keyframes accIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.acc-in:focus-within{border-color:var(--acc-a)!important;box-shadow:0 0 0 3px var(--acc-g)}'; document.head.appendChild(st); }

  function TextField({ label, icon, type = 'text', value, onChange, placeholder, error, hint, right, autoFocus, accent, h = 42 }) {
    const [show, setShow] = React.useState(false);
    const pw = type === 'password';
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {label && <span style={{ display: 'flex', alignItems: 'center', fontSize: T.fs.xs, fontWeight: 600, color: T.text2 }}>{label}<span style={{ flex: 1 }} />{right}</span>}
        <div className="acc-in" style={{ '--acc-a': accent, '--acc-g': accent + '22', height: h, display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px', background: T.surface2, border: `1px solid ${error ? T.danger : T.border2}`, borderRadius: 10, transition: 'border-color .15s, box-shadow .15s' }}>
          {icon && <Icon d={icon} size={15} stroke={T.text3} />}
          <input autoFocus={autoFocus} type={pw && !show ? 'password' : pw ? 'text' : type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
            style={{ flex: 1, minWidth: 0, height: '100%', background: 'transparent', border: 'none', outline: 'none', color: T.text, fontSize: 14, fontFamily: T.fontUI }} />
          {pw && <button type="button" onClick={() => setShow(s => !s)} title={show ? 'Masquer' : 'Afficher'} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', opacity: show ? 1 : 0.6 }}><Icon d={ICONS.eye} size={15} stroke={show ? accent : T.text3} /></button>}
        </div>
        {error ? <span style={{ fontSize: 12, color: T.danger }}>{error}</span> : hint ? <span style={{ fontSize: 12, color: T.text3 }}>{hint}</span> : null}
      </label>
    );
  }

  // ════════════ CONNEXION / INSCRIPTION ════════════
  function Auth({ initial = 'login', accent, onDone, onLocal }) {
    const [mode, setMode] = React.useState(initial); // login · register · forgot · sent
    const [f, setF] = React.useState({ name: '', email: '', pw: '', remember: true, cgu: false });
    const [tried, setTried] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [srvErr, setSrvErr] = React.useState(null);
    const set = (k) => (v) => { setF(s => ({ ...s, [k]: v })); setSrvErr(null); };
    const st = strength(f.pw);
    const err = {
      name: mode === 'register' && !f.name.trim() ? 'Indiquez un nom affiché.' : null,
      email: !f.email ? 'Indiquez votre e-mail.' : !emailOk(f.email) ? 'Cette adresse e-mail n\u2019est pas valide.' : null,
      pw: mode === 'forgot' ? null : !f.pw ? 'Indiquez un mot de passe.' : mode === 'register' && f.pw.length < 8 ? '8 caractères minimum.' : null,
      cgu: mode === 'register' && !f.cgu ? 'Acceptez les conditions pour continuer.' : null,
    };
    const valid = !Object.values(err).some(Boolean);
    const switchMode = (m) => { setMode(m); setTried(false); setSrvErr(null); };
    const submit = (e) => {
      e.preventDefault(); setTried(true);
      if (!valid) return;
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        if (mode === 'forgot') return setMode('sent');
        if (mode === 'login' && f.pw === 'erreur') return setSrvErr('E-mail ou mot de passe incorrect.');
        onDone({ name: f.name.trim() || f.email.split('@')[0], email: f.email, comedien: f.name.trim(), color: accent });
      }, 700);
    };
    const E = (k) => tried ? err[k] : null;
    const title = { login: 'Bon retour en cabine', register: 'Créer votre compte', forgot: 'Mot de passe oublié', sent: 'Vérifiez votre boîte mail' }[mode];
    const sub = { login: 'Connectez-vous pour retrouver votre nom de comédien et vos préférences.', register: 'Gratuit. Vos vidéos et vos prises restent sur cette machine.', forgot: 'Nous vous envoyons un lien pour choisir un nouveau mot de passe.', sent: '' }[mode];
    const BAND = 'Le doublage, à la cadence du studio.   Ça y est, ça roule ?   Tu veux pas te détendre un peu ?   ';
    const link = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: accent, fontSize: T.fs.xs, fontWeight: 600, fontFamily: T.fontUI };

    return (
      <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(380px,520px)', background: T.bg, color: T.text, fontFamily: T.fontUI }}>
        {/* brand side */}
        <div style={{ position: 'relative', overflow: 'hidden', background: T.bg2, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', padding: '28px 40px' }}>
          <a href="home.html" style={{ display: 'flex', alignItems: 'center', gap: 12, color: T.text, textDecoration: 'none', width: 'fit-content' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={ICONS.wave} size={20} stroke="#0b0b0d" /></div>
            <span style={{ fontSize: T.fs.sm, fontWeight: 700, letterSpacing: 0.5 }}>BANDE RYTHMO</span>
          </a>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1, maxWidth: 520, textWrap: 'balance' }}>Votre atelier de doublage vous attend.</div>
            <div style={{ position: 'relative', height: 110, margin: '0 -40px', background: '#121217', borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', whiteSpace: 'pre', animation: 'accBand 26s linear infinite' }}>
                {[0, 1].map(k => <span key={k} style={{ fontFamily: "'Caveat', cursive", fontSize: 54, color: T.text, paddingRight: 40 }}>{BAND}</span>)}
              </div>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '30%', width: 2, background: accent, boxShadow: `0 0 12px ${accent}` }} />
              <div style={{ position: 'absolute', top: 0, left: 'calc(30% - 6px)', width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `9px solid ${accent}` }} />
            </div>
            <div style={{ fontSize: T.fs.sm, color: T.text2, maxWidth: 460, lineHeight: 1.55, textWrap: 'pretty' }}>Le compte retient votre nom de comédien, vos préférences et votre progression. Les clips, les répliques et les prises ne quittent pas votre machine.</div>
          </div>
          <div style={{ fontSize: 11, color: T.text4, fontFamily: T.fontMono }}>ATELIER LOCAL · WHISPER</div>
        </div>

        {/* form side */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '28px 48px' }}>
          <a href="home.html" style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 6, fontSize: T.fs.xs, color: T.text3, textDecoration: 'none' }}><Icon d={ICONS.chevronL} size={13} stroke={T.text3} />Retour à l'accueil</a>
          <form onSubmit={submit} noValidate key={mode} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, maxWidth: 400, width: '100%', margin: '0 auto', animation: 'accIn .25s ease-out' }}>
            {(mode === 'login' || mode === 'register') && (
              <div style={{ alignSelf: 'flex-start' }}><Segmented value={mode} onChange={switchMode} options={[{ v: 'login', l: 'Connexion' }, { v: 'register', l: 'Créer un compte' }]} /></div>
            )}
            {mode === 'forgot' && <button type="button" onClick={() => switchMode('login')} style={{ ...link, color: T.text3, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}><Icon d={ICONS.chevronL} size={13} stroke={T.text3} />Connexion</button>}
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{title}</div>
              {sub && <div style={{ fontSize: T.fs.sm, color: T.text3, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>{sub}</div>}
            </div>

            {mode === 'sent' ? <>
              <div style={{ display: 'flex', gap: 12, padding: 16, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: OK + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon d={ICONS.check} size={16} stroke={OK} /></div>
                <div style={{ fontSize: T.fs.sm, color: T.text2, lineHeight: 1.5 }}>Un lien a été envoyé à <b style={{ color: T.text }}>{f.email}</b>. Il est valable 30 minutes.</div>
              </div>
              <Btn variant="primary" full size="lg" onClick={() => switchMode('login')}>Retour à la connexion</Btn>
              <div style={{ fontSize: T.fs.xs, color: T.text3 }}>Rien reçu ? <button type="button" style={link} onClick={() => setMode('forgot')}>Renvoyer le lien</button></div>
            </> : <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {mode === 'register' && <TextField accent={accent} label="Nom affiché" icon={ICONS.user} value={f.name} onChange={set('name')} placeholder="Camille R." error={E('name')} hint="Prérempli comme nom de comédien dans le Studio." autoFocus />}
                <TextField accent={accent} label="E-mail" icon={ICONS.globe} type="email" value={f.email} onChange={set('email')} placeholder="vous@exemple.fr" error={E('email')} autoFocus={mode !== 'register'} />
                {mode !== 'forgot' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <TextField accent={accent} label="Mot de passe" icon={ICONS.lock} type="password" value={f.pw} onChange={set('pw')} placeholder={mode === 'register' ? '8 caractères minimum' : ''} error={E('pw')}
                      right={mode === 'login' ? <button type="button" style={link} onClick={() => switchMode('forgot')}>Mot de passe oublié ?</button> : null} />
                    {mode === 'register' && f.pw && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, display: 'flex', gap: 4 }}>{[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: st >= i ? [T.danger, '#FF9944', OK][st - 1] : T.surface2 }} />)}</div>
                        <span style={{ fontSize: 11.5, color: T.text3, width: 64, textAlign: 'right' }}>{['Trop court', 'Faible', 'Correct', 'Solide'][st]}</span>
                      </div>
                    )}
                  </div>
                )}
                {mode === 'login' && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: T.fs.xs, color: T.text2 }}><Toggle on={f.remember} onClick={() => set('remember')(!f.remember)} />Rester connecté sur cet appareil</div>}
                {mode === 'register' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: T.fs.xs, color: T.text2, lineHeight: 1.5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={f.cgu} onChange={e => set('cgu')(e.target.checked)} style={{ marginTop: 2, accentColor: accent, width: 15, height: 15 }} />
                      <span>J'accepte les <a href="#" style={{ color: accent }}>conditions d'utilisation</a> et la <a href="#" style={{ color: accent }}>politique de confidentialité</a>.</span>
                    </label>
                    {E('cgu') && <span style={{ fontSize: 12, color: T.danger }}>{E('cgu')}</span>}
                  </div>
                )}
              </div>
              {srvErr && <div style={{ padding: '10px 12px', background: T.danger + '18', border: `1px solid ${T.danger}55`, borderRadius: 10, fontSize: T.fs.xs, color: T.text }}>{srvErr}</div>}
              <button type="submit" disabled={busy} style={{ height: 46, borderRadius: 11, border: 'none', cursor: busy ? 'default' : 'pointer', background: accent, color: '#0b0b0d', fontSize: 15, fontWeight: 700, fontFamily: T.fontUI, opacity: busy ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {busy ? 'Un instant…' : { login: 'Se connecter', register: 'Créer mon compte', forgot: 'Envoyer le lien' }[mode]}
              </button>
              {mode !== 'forgot' && <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: T.text4 }}><div style={{ flex: 1, height: 1, background: T.border }} />ou<div style={{ flex: 1, height: 1, background: T.border }} /></div>
                <Btn variant="outline" full size="lg" onClick={onLocal}>Continuer sans compte</Btn>
                <div style={{ fontSize: 11.5, color: T.text3, textAlign: 'center', marginTop: -8 }}>Tout fonctionne en local. Vous pourrez créer un compte plus tard depuis l'avatar.</div>
              </>}
            </>}
          </form>
        </div>
      </div>
    );
  }

  // ════════════ MON COMPTE ════════════
  function Account({ go, accent, user, setUser, onLogout, onLogin }) {
    const H = window.RScreens._Header;
    const [draft, setDraft] = React.useState(user || {});
    const [saved, setSaved] = React.useState(false);
    const [pwOpen, setPwOpen] = React.useState(false);
    const [pw, setPw] = React.useState({ cur: '', next: '' });
    const [sessions, setSessions] = React.useState([
      { id: 1, dev: 'Chrome · Windows', where: 'Cet appareil', when: 'Active maintenant', me: true },
      { id: 2, dev: 'Firefox · macOS', where: 'Lyon, FR', when: 'Il y a 2 jours' },
      { id: 3, dev: 'Safari · iPad', where: 'Paris, FR', when: 'Il y a 3 semaines' },
    ]);
    const [del, setDel] = React.useState(false);
    const [delTxt, setDelTxt] = React.useState('');
    React.useEffect(() => { setDraft(user || {}); }, [user]);
    if (!user) {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <H kicker="COMPTE" title="Mon compte" />
          <div style={{ padding: '6px 32px', maxWidth: 560 }}>
            <div style={{ padding: 24, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.card, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ fontSize: T.fs.md, fontWeight: 600 }}>Vous travaillez sans compte</div>
              <div style={{ fontSize: T.fs.sm, color: T.text3, lineHeight: 1.5 }}>Tout fonctionne en local. Un compte retient votre nom de comédien et vos préférences d'un appareil à l'autre.</div>
              <div style={{ display: 'flex', gap: 8 }}><Btn variant="primary" onClick={() => onLogin('register')}>Créer un compte</Btn><Btn variant="outline" onClick={() => onLogin('login')}>Se connecter</Btn></div>
            </div>
          </div>
        </div>
      );
    }
    const dirty = ['name', 'comedien', 'color'].some(k => (draft[k] || '') !== (user[k] || ''));
    const save = () => { setUser({ ...user, ...draft }); setSaved(true); setTimeout(() => setSaved(false), 2200); };
    const Section = ({ title, desc, children, danger }) => (
      <div style={{ marginBottom: 30, maxWidth: 720 }}>
        <div style={{ fontSize: T.fs.md, fontWeight: 600, marginBottom: 3, color: danger ? T.danger : T.text }}>{title}</div>
        {desc && <div style={{ fontSize: T.fs.xs, color: T.text3, marginBottom: 12 }}>{desc}</div>}
        {children}
      </div>
    );
    const Field = ({ label, children, sub }) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderBottom: `1px solid ${T.surface2}` }}>
        <div style={{ width: 200, flexShrink: 0 }}><div style={{ fontSize: T.fs.sm, color: T.text2 }}>{label}</div>{sub && <div style={{ fontSize: 11.5, color: T.text3, marginTop: 2 }}>{sub}</div>}</div>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    );
    const inp = (k, ph) => <div style={{ maxWidth: 320 }}><TextField accent={accent} h={36} value={draft[k] || ''} onChange={v => setDraft(d => ({ ...d, [k]: v }))} placeholder={ph} /></div>;
    const COLORS = T.tracks.map(t => t.hex).concat(['#5EC27C', '#FF8C42']).slice(0, 6);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <H kicker="COMPTE" title="Mon compte" sub={user.email}
          right={<Btn variant="outline" onClick={onLogout}>Se déconnecter</Btn>} />
        <div style={{ flex: 1, overflow: 'auto', padding: '6px 32px 40px' }}>
          <Section title="Profil" desc="Visible sur vos prises et dans le Studio.">
            <Field label="Avatar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Avatar name={draft.name || '?'} color={draft.color || accent} size={52} ring />
                <div style={{ display: 'flex', gap: 8 }}>
                  {COLORS.map(c => <button key={c} onClick={() => setDraft(d => ({ ...d, color: c }))} title={c} style={{ width: 26, height: 26, borderRadius: 7, background: c, cursor: 'pointer', border: (draft.color || accent) === c ? `2px solid ${T.text}` : '1px solid transparent', boxShadow: (draft.color || accent) === c ? `0 0 0 2px ${c}55` : 'none' }} />)}
                </div>
              </div>
            </Field>
            <Field label="Nom affiché">{inp('name', 'Camille R.')}</Field>
            <Field label="Nom de comédien" sub="Prérempli dans le Studio">{inp('comedien', 'Même que le nom affiché')}</Field>
            <Field label="E-mail">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: T.fs.sm, color: T.text }}>{user.email}</span>
                <Chip soft color={OK}><Icon d={ICONS.check} size={10} stroke={OK} /> vérifié</Chip>
                <Btn size="sm" variant="ghost">Modifier</Btn>
              </div>
            </Field>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14 }}>
              <Btn variant={dirty ? 'primary' : 'outline'} onClick={dirty ? save : undefined} style={{ opacity: dirty ? 1 : 0.5 }}>Enregistrer</Btn>
              {dirty && <Btn variant="ghost" onClick={() => setDraft(user)}>Annuler</Btn>}
              {saved && <span style={{ fontSize: T.fs.xs, color: OK, display: 'flex', alignItems: 'center', gap: 6 }}><Icon d={ICONS.check} size={12} stroke={OK} />Profil enregistré</span>}
            </div>
          </Section>

          <Section title="Sécurité">
            <Field label="Mot de passe" sub="Modifié il y a 3 mois">
              {!pwOpen ? <Btn size="sm" variant="outline" icon={ICONS.lock} onClick={() => setPwOpen(true)}>Changer le mot de passe</Btn> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
                  <TextField accent={accent} h={36} type="password" value={pw.cur} onChange={v => setPw(p => ({ ...p, cur: v }))} placeholder="Mot de passe actuel" />
                  <TextField accent={accent} h={36} type="password" value={pw.next} onChange={v => setPw(p => ({ ...p, next: v }))} placeholder="Nouveau mot de passe" hint={pw.next && pw.next.length < 8 ? '8 caractères minimum.' : null} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn size="sm" variant="primary" onClick={() => { if (pw.cur && pw.next.length >= 8) { setPwOpen(false); setPw({ cur: '', next: '' }); } }}>Mettre à jour</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => { setPwOpen(false); setPw({ cur: '', next: '' }); }}>Annuler</Btn>
                  </div>
                </div>
              )}
            </Field>
            <Field label="Appareils connectés" sub={`${sessions.length} session${sessions.length > 1 ? 's' : ''}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl }}>
                    <Dot color={s.me ? OK : T.text4} size={7} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: T.fs.sm, color: T.text }}>{s.dev}</div>
                      <div style={{ fontSize: 11.5, color: T.text3 }}>{s.where} · {s.when}</div>
                    </div>
                    {s.me ? <Chip soft color={T.text2}>cet appareil</Chip> : <Btn size="sm" variant="ghost" onClick={() => setSessions(x => x.filter(y => y.id !== s.id))}>Déconnecter</Btn>}
                  </div>
                ))}
                {sessions.length > 1 && <div><Btn size="sm" variant="outline" onClick={() => setSessions(x => x.filter(y => y.me))}>Déconnecter les autres appareils</Btn></div>}
              </div>
            </Field>
          </Section>

          <Section title="Données" desc="Les vidéos restent sur cette machine et ne sont jamais envoyées.">
            <Field label="Exporter mes données" sub="Projets, répliques, prises (JSON)"><Btn size="sm" variant="outline" icon={ICONS.download}>Télécharger l'archive</Btn></Field>
          </Section>

          <Section title="Zone sensible" danger>
            <Field label="Supprimer le compte" sub="Le compte et le profil sont supprimés. Les fichiers locaux restent.">
              {!del ? <Btn size="sm" danger icon={ICONS.trash} onClick={() => setDel(true)}>Supprimer le compte…</Btn> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, padding: 14, border: `1px solid ${T.danger}55`, background: T.danger + '10', borderRadius: T.r.ctl }}>
                  <div style={{ fontSize: T.fs.xs, color: T.text2, lineHeight: 1.5 }}>Tapez <b style={{ color: T.text, fontFamily: T.fontMono }}>{user.email}</b> pour confirmer.</div>
                  <TextField accent={T.danger} h={36} value={delTxt} onChange={setDelTxt} placeholder={user.email} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={delTxt !== user.email} onClick={onLogout} style={{ height: 30, padding: '0 12px', borderRadius: T.r.chip, border: 'none', background: T.danger, color: '#fff', fontWeight: 700, fontSize: T.fs.xs, fontFamily: T.fontUI, cursor: delTxt === user.email ? 'pointer' : 'not-allowed', opacity: delTxt === user.email ? 1 : 0.4 }}>Supprimer définitivement</button>
                    <Btn size="sm" variant="ghost" onClick={() => { setDel(false); setDelTxt(''); }}>Annuler</Btn>
                  </div>
                </div>
              )}
            </Field>
          </Section>
        </div>
      </div>
    );
  }

  window.RScreens = window.RScreens || {};
  window.RScreens.Auth = Auth;
  window.RScreens.Account = Account;
})();
