/* Screens — Meme atelier · Activité · Réglages */
(function () {
  const { T, Icon, ICONS, Btn, Chip, Dot, Avatar, Segmented, Toggle, ProgressBar, Select } = window.RD;
  const { JOBS_RUN, JOBS_DONE } = window.RDATA;
  const Header = () => window.RScreens._Header;

  // ════════════ MEME ════════════
  function Meme({ go, accent }) {
    const [mode, setMode] = React.useState('image');
    const [edit, setEdit] = React.useState(false);
    const H = window.RScreens._Header;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <H kicker="ATELIER" title="Meme · GIF · Audio" sub="clip · S02E04 — confrontation cuisine"
          right={edit ? <Btn variant="outline" onClick={() => setEdit(false)} icon={ICONS.chevron} style={{ transform: 'none' }}>Sources</Btn> : null} />
        {!edit && (
          <div style={{ padding: '0 32px 14px', flexShrink: 0 }}>
            <Segmented value={mode} onChange={setMode} options={[
              { v: 'image', l: 'Image', icon: ICONS.film }, { v: 'gif', l: 'GIF', icon: ICONS.layers }, { v: 'audio', l: 'Audio', icon: ICONS.volume },
            ]} />
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, padding: '0 32px 28px', overflow: 'hidden' }}>
          {edit ? <MemeEditor accent={accent} /> :
            mode === 'image' ? <ImageMode accent={accent} onNext={() => setEdit(true)} /> :
            <RangeMode accent={accent} kind={mode} onNext={() => setEdit(true)} />}
        </div>
      </div>
    );
  }

  function VideoStub({ children, ratio = '16/9' }) {
    return (
      <div style={{ background: '#000', borderRadius: T.r.card, border: `1px solid ${T.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ aspectRatio: ratio, position: 'relative', background: `repeating-linear-gradient(0deg,#16161c 0 2px,#1b1b22 2px 6px)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: T.text4, fontSize: 11, letterSpacing: 4, fontFamily: T.fontMono }}>APERÇU</span>
        </div>
        {children}
      </div>
    );
  }

  function ImageMode({ accent, onNext }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 22, height: '100%', alignItems: 'start' }}>
        <VideoStub>
          <div style={{ padding: '12px 14px', borderTop: `1px solid ${T.border}` }}>
            <div style={{ height: 4, background: T.surface3, borderRadius: 2, position: 'relative' }}>
              <div style={{ width: '32%', height: '100%', background: accent, borderRadius: 2 }} />
              <div style={{ position: 'absolute', left: '32%', top: -3, width: 10, height: 10, borderRadius: '50%', background: accent, transform: 'translateX(-50%)' }} />
            </div>
          </div>
        </VideoStub>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Btn variant="primary" size="lg" full icon={ICONS.film} onClick={onNext}>Capturer ce frame</Btn>
          <p style={{ fontSize: T.fs.xs, color: T.text3, lineHeight: 1.6, margin: 0 }}>Naviguez puis capturez le frame souhaité — ou glissez votre propre image.</p>
          <div style={{ padding: 22, border: `2px dashed ${T.border2}`, borderRadius: T.r.card, textAlign: 'center', color: T.text3 }}>
            <Icon d={ICONS.upload} size={26} stroke={T.text3} style={{ margin: '0 auto' }} />
            <div style={{ fontSize: T.fs.xs, fontWeight: 600, marginTop: 8, color: T.text2 }}>Glisser une image</div>
            <div style={{ fontSize: 10.5, marginTop: 2 }}>PNG · JPG · WEBP · GIF</div>
          </div>
        </div>
      </div>
    );
  }

  function RangeMode({ accent, kind, onNext }) {
    const blue = T.info;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 22, height: '100%', alignItems: 'start' }}>
        <VideoStub>
          <div style={{ padding: '14px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative', height: 10, background: T.surface3, borderRadius: 3 }}>
              <div style={{ position: 'absolute', left: '18%', width: '46%', top: 0, bottom: 0, background: accent + '44', borderRadius: 3 }} />
              <div style={{ position: 'absolute', left: '18%', top: 0, bottom: 0, width: 3, background: blue, borderRadius: 1 }} />
              <div style={{ position: 'absolute', left: 'calc(64% - 3px)', top: 0, bottom: 0, width: 3, background: accent, borderRadius: 1 }} />
              <div style={{ position: 'absolute', left: '40%', top: -3, bottom: -3, width: 2, background: '#fff' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.fontMono, fontSize: 11 }}>
              <Chip soft color={blue}>[ IN 00:05.0</Chip>
              <div style={{ flex: 1, textAlign: 'center', color: T.text3 }}>5.0s</div>
              <Chip soft color={accent}>OUT 00:10.0 ]</Chip>
            </div>
          </div>
        </VideoStub>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {kind === 'gif' ? (<>
            <Btn variant="primary" size="lg" full icon={ICONS.layers} onClick={onNext}>Créer le GIF</Btn>
            <p style={{ fontSize: T.fs.xs, color: T.text3, lineHeight: 1.6, margin: 0 }}>Réglez IN / OUT puis créez le GIF. Il s'ouvre dans l'éditeur de texte.</p>
          </>) : (<>
            <Btn variant="primary" size="lg" full icon={ICONS.download}>Télécharger MP3</Btn>
            <Btn variant="solid" full icon={ICONS.download}>Télécharger WAV</Btn>
            <p style={{ fontSize: T.fs.xs, color: T.text3, lineHeight: 1.6, margin: 0 }}>Exporte l'audio de la sélection. MP3 compact, WAV lossless.</p>
          </>)}
        </div>
      </div>
    );
  }

  function MemeEditor({ accent }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, height: '100%' }}>
        <div style={{ background: '#000', borderRadius: T.r.card, border: `1px solid ${T.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 14px', borderBottom: `1px solid ${T.border}`, fontSize: T.fs.xs, color: T.text3 }}>Glissez le texte pour le repositionner</div>
          <div style={{ flex: 1, position: 'relative', background: `repeating-linear-gradient(0deg,#16161c 0 2px,#1b1b22 2px 6px)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'Impact, sans-serif', fontSize: 40, fontWeight: 900, color: '#fff', WebkitTextStroke: '2px #000', whiteSpace: 'nowrap' }}>QUAND LE DOUBLAGE</div>
            <div style={{ position: 'absolute', bottom: '9%', left: '50%', transform: 'translateX(-50%)', padding: '4px 8px', border: `1.5px dashed ${accent}aa`, borderRadius: 4 }}>
              <div style={{ fontFamily: 'Impact, sans-serif', fontSize: 40, fontWeight: 900, color: '#fff', WebkitTextStroke: '2px #000', whiteSpace: 'nowrap' }}>EST PARFAIT</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
              <span style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.2, color: T.text3 }}>TEXTES</span>
              <div style={{ flex: 1 }} /><span style={{ fontSize: T.fs.xs, color: accent, cursor: 'pointer' }}>+ Ajouter</span>
            </div>
            {['QUAND LE DOUBLAGE', 'EST PARFAIT'].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', marginBottom: 6, borderRadius: T.r.ctl, background: i === 1 ? accent + '14' : T.surface2, border: `1px solid ${i === 1 ? accent + '55' : T.border}` }}>
                <span style={{ fontSize: 10, color: T.text4, width: 12, textAlign: 'center' }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: T.fs.xs, color: T.text, fontFamily: 'Impact, sans-serif', letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</span>
                <Icon d={ICONS.chevron} size={13} stroke={T.text3} style={{ transform: 'rotate(180deg)', cursor: 'pointer' }} />
                <Icon d={ICONS.chevron} size={13} stroke={T.text3} style={{ cursor: 'pointer' }} />
                <Icon d={ICONS.layers} size={13} stroke={T.text3} style={{ cursor: 'pointer' }} />
                <Icon d={ICONS.trash} size={13} stroke={T.danger} style={{ cursor: 'pointer' }} />
              </div>
            ))}
            <div style={{ fontSize: 9.5, color: T.text4, marginTop: 2 }}>↑↓ réordonner · ⎘ dupliquer · flèches pour ajuster la position</div>
          </div>
          <div>
            <div style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.2, color: T.text3, marginBottom: 9 }}>STYLE — TEXTE 2</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div style={{ fontSize: 10, color: T.text3, marginBottom: 6 }}>POLICE</div><Segmented value="imp" onChange={() => {}} options={[{ v: 'imp', l: 'Impact' }, { v: 'arial', l: 'Arial B.' }, { v: 'mono', l: 'Mono' }]} /></div>
              <div><div style={{ fontSize: 10, color: T.text3, marginBottom: 6 }}>TAILLE — 48px</div><ProgressBar pct={42} /></div>
              <div><div style={{ fontSize: 10, color: T.text3, marginBottom: 6 }}>COULEUR</div><div style={{ display: 'flex', gap: 6 }}>{['#fff', '#ffff00', '#ff4444', '#44ff88', '#44bbff'].map((c, i) => <div key={c} style={{ width: 22, height: 22, borderRadius: 5, background: c, border: i === 0 ? `2px solid ${accent}` : '1px solid #444', cursor: 'pointer' }} />)}</div></div>
              <div><div style={{ fontSize: 10, color: T.text3, marginBottom: 6 }}>ALIGNEMENT</div><Segmented value="c" onChange={() => {}} options={[{ v: 'l', l: 'Gauche' }, { v: 'c', l: 'Centre' }, { v: 'r', l: 'Droite' }]} /></div>
            </div>
          </div>
          <Btn variant="primary" size="lg" full icon={ICONS.sparkle}>Générer</Btn>
        </div>
      </div>
    );
  }

  // ════════════ ACTIVITÉ ════════════
  function Activity({ go, accent }) {
    const H = window.RScreens._Header;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <H kicker="SYSTÈME" title="Activité"
          right={<div style={{ display: 'flex', gap: 8 }}>
            <Chip soft color={accent}><Dot color={accent} size={7} pulse /> 3 en cours</Chip>
            <Chip soft color={T.danger}>1 échec</Chip>
            <Chip soft color={T.text3}>14 terminés</Chip>
          </div>} />
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 32px 28px' }}>
          <GroupLabel color={accent}>EN COURS · 3</GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {JOBS_RUN.map((j, i) => <RunRow key={i} j={j} accent={accent} />)}
          </div>
          <GroupLabel color={T.danger}>ÉCHECS · 1</GroupLabel>
          <div style={{ marginBottom: 24 }}>
            <div style={{ background: 'rgba(232,89,93,.05)', border: `1px solid ${T.danger}44`, borderRadius: T.r.ctl, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: T.danger + '14', border: `1px solid ${T.danger}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={ICONS.film} size={17} stroke={T.danger} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span style={{ fontSize: T.fs.sm, fontWeight: 600, whiteSpace: 'nowrap' }}>Export MP4 + BR</span><span style={{ fontSize: T.fs.xs, color: T.text3 }}>S02E05 — nuit</span></div>
                <div style={{ fontSize: T.fs.xs, color: T.danger, fontFamily: T.fontMono, marginTop: 3 }}>ffmpeg : flux audio introuvable (-map 0:a)</div>
              </div>
              <Btn size="sm" variant="primary" icon={ICONS.loop}>Réessayer</Btn>
            </div>
          </div>
          <GroupLabel color={T.success}>TERMINÉ · 3</GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {JOBS_DONE.map((j, i) => <DoneRow key={i} j={j} accent={accent} />)}
          </div>
        </div>
      </div>
    );
  }
  function GroupLabel({ children, color }) {
    return <div style={{ fontSize: T.fs.micro, fontWeight: 700, letterSpacing: 1.2, color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 9 }}>{children}<div style={{ flex: 1, height: 1, background: T.border }} /></div>;
  }
  function RunRow({ j, accent }) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, background: accent + '14', border: `1px solid ${accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={ICONS[j.icon]} size={18} stroke={accent} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span style={{ fontSize: T.fs.base, fontWeight: 600, whiteSpace: 'nowrap' }}>{j.title}</span><span style={{ fontSize: T.fs.xs, color: T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.clip}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}><ProgressBar pct={j.pct} /><span style={{ fontSize: 11, color: T.text2, fontFamily: T.fontMono, minWidth: 100, whiteSpace: 'nowrap' }}>{j.stage}</span></div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 60 }}><div style={{ fontSize: T.fs.md, fontWeight: 700, fontFamily: T.fontMono, color: accent }}>{j.pct}%</div><div style={{ fontSize: 10, color: T.text3, fontFamily: T.fontMono }}>~{j.eta}</div></div>
        <Btn size="sm" variant="outline">Annuler</Btn>
      </div>
    );
  }
  function DoneRow({ j, accent }) {
    const act = { download: { l: 'Télécharger', ic: ICONS.download, p: true }, open: { l: 'Ouvrir le clip', ic: ICONS.edit } }[j.action];
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.ctl, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: T.success + '14', border: `1px solid ${T.success}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={ICONS.check} size={17} stroke={T.success} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span style={{ fontSize: T.fs.sm, fontWeight: 600 }}>{j.title}</span><span style={{ fontSize: T.fs.xs, color: T.text3 }}>{j.clip}</span></div>
          <div style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono, marginTop: 2 }}>{j.file}{j.size ? ` · ${j.size}` : ''}</div>
        </div>
        <span style={{ fontSize: 10.5, color: T.text3, fontFamily: T.fontMono }}>{j.when}</span>
        <Btn size="sm" variant={act.p ? 'primary' : 'outline'} icon={act.ic}>{act.l}</Btn>
      </div>
    );
  }

  // ════════════ RÉGLAGES ════════════
  function Settings({ go, accent, setAccent, brStyle, setBrStyle, density, setDensity }) {
    const H = window.RScreens._Header;
    const Section = ({ title, desc, children }) => (
      <div style={{ marginBottom: 26, maxWidth: 720 }}>
        <div style={{ fontSize: T.fs.md, fontWeight: 600, marginBottom: 3 }}>{title}</div>
        {desc && <div style={{ fontSize: T.fs.xs, color: T.text3, marginBottom: 14 }}>{desc}</div>}
        {children}
      </div>
    );
    const Field = ({ label, children }) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderBottom: `1px solid ${T.surface2}` }}>
        <div style={{ width: 200, flexShrink: 0, fontSize: T.fs.sm, color: T.text2 }}>{label}</div>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    );
    const ACCENTS = ['#F5C518', '#5AA9F0', '#F06AA0', '#5EC27C', '#A98BF0', '#FF8C42'];
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <H kicker="PRÉFÉRENCES" title="Réglages" />
        <div style={{ flex: 1, overflow: 'auto', padding: '6px 32px 40px' }}>
          <Section title="Apparence" desc="Identité visuelle de l'atelier.">
            <Field label="Couleur d'accent">
              <div style={{ display: 'flex', gap: 9 }}>
                {ACCENTS.map(c => <div key={c} onClick={() => setAccent(c)} style={{ width: 30, height: 30, borderRadius: 8, background: c, cursor: 'pointer', border: c === accent ? `2px solid ${T.text}` : '1px solid transparent', boxShadow: c === accent ? `0 0 0 2px ${c}55` : 'none' }} />)}
              </div>
            </Field>
            <Field label="Style de bande rythmo"><Segmented value={brStyle} onChange={setBrStyle} options={[{ v: 'classique', l: 'Classique' }, { v: 'neon', l: 'Néon' }, { v: 'minimal', l: 'Minimal' }]} /></Field>
            <Field label="Densité"><Segmented value={density} onChange={setDensity} options={[{ v: 'compact', l: 'Compact' }, { v: 'normal', l: 'Normal' }, { v: 'comfort', l: 'Confort' }]} /></Field>
            <Field label="Police personnalisée"><Btn variant="outline" icon={ICONS.upload}>Importer une police (TTF / OTF)</Btn></Field>
          </Section>

          <Section title="Traitement IA" desc="Outils optionnels, locaux quand possible.">
            <Field label="Séparation vocale"><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Toggle on={false} /><span style={{ fontSize: T.fs.xs, color: T.text3 }}>isoler la voix (demucs) pour comparer la prise</span></div></Field>
            <Field label="Auto-traduction"><Select width={200} value="libre" onChange={() => {}} options={[{ v: 'off', l: 'Désactivée' }, { v: 'libre', l: 'LibreTranslate (local)' }, { v: 'deepl', l: 'DeepL (clé API)' }]} /></Field>
          </Section>

          <Section title="Transcription Whisper" desc="Modèle local, hors-ligne.">
            <Field label="Modèle"><Segmented value="base" onChange={() => {}} options={[{ v: 'tiny', l: 'Tiny' }, { v: 'base', l: 'Base' }, { v: 'small', l: 'Small' }]} /></Field>
            <Field label="Langue par défaut">
              <Select width={200} value="fr" onChange={() => {}} options={[
                { v: 'fr', l: 'FR — Français' }, { v: 'en', l: 'EN — English' }, { v: 'es', l: 'ES — Español' },
                { v: 'de', l: 'DE — Deutsch' }, { v: 'it', l: 'IT — Italiano' }, { v: 'pt', l: 'PT — Português' },
                { v: 'ja', l: 'JA — 日本語' }, { v: 'auto', l: '🔍 Auto-détection' },
              ]} />
            </Field>
            <Field label="Moteur"><Segmented value="faster" onChange={() => {}} options={[{ v: 'whisper', l: 'openai-whisper' }, { v: 'faster', l: 'faster-whisper' }]} /></Field>
          </Section>

          <Section title="Connexion Plex" desc="Bibliothèque locale comme source.">
            <Field label="Statut"><Chip soft color={T.success}><Dot color={T.success} size={6} /> Connecté · 192.168.1.4:32400</Chip></Field>
            <Field label="Token"><span style={{ fontFamily: T.fontMono, fontSize: T.fs.sm, color: T.text2 }}>••••••••••••••••</span></Field>
            <Field label=""><Btn variant="outline" icon={ICONS.plug}>Reconfigurer</Btn></Field>
          </Section>

          <Section title="Export" desc="Valeurs par défaut.">
            <Field label="Qualité MP4"><Segmented value="std" onChange={() => {}} options={[{ v: 'draft', l: 'Draft' }, { v: 'std', l: 'Standard' }, { v: 'yt', l: 'YouTube' }]} /></Field>
            <Field label="Accélération GPU"><Toggle on /></Field>
            <Field label="Téléchargement auto"><Toggle on={false} /></Field>
          </Section>
        </div>
      </div>
    );
  }

  window.RScreens = window.RScreens || {};
  window.RScreens.Meme = Meme;
  window.RScreens.Activity = Activity;
  window.RScreens.Settings = Settings;
})();
