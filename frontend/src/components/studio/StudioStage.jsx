import React from 'react'
import { T, alpha, Icon, ICONS, Btn, Chip, Dot } from '../../ui'
import { TRACK_HEXES } from '../../config/tracks'
import { StageMeter } from '../takes/Meter'
import { LineStrip, StageClock } from './StageParts'

const pad = n => String(n).padStart(2, '0')
const K = ({ children }) => <span style={{ color: T.accent }}>{children}</span>
const TAG = { pret: 'PRÊT', auto: 'PRÊT', decompte: 'DÉCOMPTE', elan: 'ÉLAN', rec: 'REC', queue: 'REC', revue: 'REVUE', pause: 'PAUSE', summary: 'FIN' }
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`

// The dubbing stage — line strip · image (+ phase overlays) · band · control
// strip. STUDIO_V2 §3: the line text sits over the image while the actor is
// held (prêt / décompte / auto / revue), the countdown never moves the image,
// the élan drains to the start mark. En continu (§2): the line strip follows
// the playhead without sliding, Espace pauses, a summary card ends the session.
export default function StudioStage({
  subtitles, takes, index, fps, onSelectIndex, charIndex,
  rec, cfg, selectedLabel, flash, mode, sLines, roleLabel, summary,
  stageImage, stageBand, videoRef, onPrimary,
}) {
  const { phase, countdown, mediaT, micLabel, micDenied, analyser, session } = rec
  const cont = mode === 'cont'
  const sub = index != null ? subtitles[index] : null
  const color = sub ? TRACK_HEXES[(charIndex[sub.character || ''] || 0) % TRACK_HEXES.length] : T.text3
  const recLike = phase === 'rec' || phase === 'queue'
  const armed = phase === 'decompte' || phase === 'elan'
  const showText = sub && ['pret', 'decompte', 'auto', 'revue', 'pause'].includes(phase)
  const count = Math.ceil(countdown)
  const elanLeft = sub ? Math.max(0, sub.start - mediaT) : 0

  const status = !sub ? 'Aucune réplique à enregistrer.' : cont ? {
    pret: flash ? <span style={{ color: T.success }}>{flash}</span>
      : <>Prêt · <K>R</K> pour lancer · {plural(sLines.length, 'réplique')} de {roleLabel}</>,
    decompte: <K>Décompte {count} · image figée · Échap annuler</K>,
    elan: <K>Élan · REC dans {elanLeft.toFixed(1)}s</K>,
    rec: <span style={{ color: T.danger }}>Session en cours · {session?.captured.length ?? 0}/{sLines.length} · Espace pause · Échap arrêter</span>,
    pause: <>En pause · <K>Espace</K> reprendre · <K>Échap</K> terminer</>,
    summary: <>Session terminée</>,
  }[phase] : {
    pret: flash ? <span style={{ color: T.success }}>{flash}</span> : <>Prêt · <K>R</K> pour lancer</>,
    decompte: <K>Décompte {count} · image figée · Échap annuler</K>,
    elan: <K>Élan · REC dans {elanLeft.toFixed(1)}s</K>,
    rec: <span style={{ color: T.danger }}>Prise en cours · {Math.max(0, mediaT - sub.start).toFixed(1)}s / {(sub.end - sub.start).toFixed(1)}s</span>,
    queue: <span style={{ color: T.danger }}>Fin de prise…</span>,
    revue: <>{selectedLabel ? `${selectedLabel} ajoutée` : 'Prise ajoutée'} · <K>Entrée</K> valider · <K>R</K> refaire</>,
    auto: <>Réplique suivante dans {count}… · <K>Espace</K> pour attendre</>,
  }[phase]

  const primaryTitle = recLike ? (cont ? 'Arrêter la session (Échap)' : 'Annuler la prise (Échap)') : armed ? 'Annuler (Échap)'
    : phase === 'revue' ? 'Refaire (R)' : phase === 'pause' ? 'Reprendre (Espace)' : 'Lancer (R)'
  const tag = TAG[phase]

  return (
    <div style={{
      flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#000',
      border: `1px solid ${recLike ? alpha(T.danger, '88') : T.border}`, borderRadius: T.r.card, overflow: 'hidden', transition: 'border-color .2s',
    }}>
      <LineStrip subtitles={subtitles} takes={takes} index={index} fps={fps} onSelectIndex={rec.live || session ? null : onSelectIndex}
        roleLabel={sub ? sub.character || 'Sans personnage' : ''} animate={!session} />
      <div style={{ flex: 1, minHeight: 80, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ height: '94%', aspectRatio: '16/9', maxWidth: '96%', background: '#000', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
          {stageImage}
          {showText && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '48px 24px 18px', background: 'linear-gradient(transparent, rgba(0,0,0,.85))', pointerEvents: 'none' }}>
              <div style={{ fontSize: T.fs.micro, letterSpacing: 1.2, fontWeight: 700, color, marginBottom: 2 }}>
                {(sub.character || 'Sans personnage').toUpperCase()} · RÉPLIQUE {pad(index + 1)}
              </div>
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 28, color: '#fff', lineHeight: 1.15, textWrap: 'pretty' }}>{sub.text}</div>
              {sub.note && (
                <div style={{ fontSize: T.fs.xs, color: T.text2, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon d={ICONS.note} size={12} stroke={T.text3} />{sub.note}
                </div>
              )}
            </div>
          )}
          {phase === 'decompte' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(0,0,0,.35)', paddingBottom: 60, pointerEvents: 'none' }}>
              <span key={count} style={{ fontSize: 104, lineHeight: 1, fontWeight: 800, color: T.accent, fontFamily: T.fontMono, textShadow: `0 0 40px ${alpha(T.accent, '66')}`, animation: 'stCount .95s ease-out' }}>{count}</span>
              <span style={{ fontSize: T.fs.xs, color: T.text2 }}>Échap pour annuler</span>
            </div>
          )}
          {phase === 'pause' && sub && (
            <div style={{ position: 'absolute', top: '34%', left: '50%', transform: 'translateX(-50%)', padding: '10px 16px', background: 'rgba(0,0,0,.78)', border: `1px solid ${alpha(T.accent, '55')}`, borderRadius: T.r.ctl, fontSize: T.fs.sm, color: T.text, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
              <Icon d={ICONS.pause} size={14} stroke={T.accent} />Reprise sur la réplique {pad(index + 1)}, avec décompte
            </div>
          )}
          {phase === 'summary' && session && summary && <SummaryCard session={session} roleLabel={roleLabel} color={color} {...summary} />}
          {phase === 'elan' && cfg.lead > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: 'rgba(255,255,255,.08)' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (elanLeft / cfg.lead) * 100)}%`, background: T.accent }} />
            </div>
          )}
          {phase === 'auto' && (
            <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translateX(-50%)', padding: '10px 16px', background: 'rgba(0,0,0,.78)', border: `1px solid ${alpha(T.accent, '55')}`, borderRadius: T.r.ctl, fontSize: T.fs.sm, color: T.text, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
              <Icon d={ICONS.clock} size={14} stroke={T.accent} />Réplique suivante dans {count}… · <K>Espace</K> pour attendre
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', top: 12, left: 14, padding: '4px 10px', background: 'rgba(0,0,0,.7)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 12, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          {recLike
            ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.danger, animation: 'stBlink 1s steps(2) infinite' }} />
            : <Dot color={armed ? T.accent : phase === 'revue' ? T.success : T.text3} size={6} />}
          <span style={{ color: recLike ? T.danger : armed ? T.accent : T.text2, fontWeight: 700, fontSize: 10.5, letterSpacing: 1 }}>{tag}</span>
          <StageClock videoRef={videoRef} fps={fps} />
        </div>
        <div style={{ position: 'absolute', top: 12, right: 14, display: 'flex', gap: 6 }}>
          {micDenied
            ? <Chip soft color={T.danger}>Micro · refusé</Chip>
            : micLabel && (
              <Chip soft color={T.text2} style={{ maxWidth: 280 }}>
                <span title={micLabel} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Micro · {micLabel}</span>
              </Chip>
            )}
        </div>
      </div>
      {stageBand}
      <div style={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', background: T.surface, borderTop: `1px solid ${T.border}` }}>
        <StageMeter analyser={analyser} recording={recLike} />
        <button data-rd onClick={onPrimary} disabled={!sub} title={primaryTitle} style={{
          width: 48, height: 48, borderRadius: '50%', cursor: sub ? 'pointer' : 'not-allowed', flexShrink: 0, padding: 0,
          background: recLike ? T.danger : armed ? T.surface2 : T.accent,
          border: `3px solid ${alpha(recLike ? T.danger : armed ? T.border3 : T.accent, '44')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sub ? 1 : 0.4,
          boxShadow: recLike ? `0 0 0 6px ${alpha(T.danger, '22')}, 0 0 24px ${alpha(T.danger, '66')}` : 'none', transition: 'box-shadow .2s, background .2s',
        }}>
          {recLike
            ? <span style={{ width: 14, height: 14, borderRadius: 3, background: '#0b0b0d' }} />
            : armed ? <Icon d={ICONS.close} size={18} stroke={T.text} />
              : phase === 'pause' ? <Icon d={ICONS.play} size={18} stroke="#0b0b0d" fill="#0b0b0d" />
                : <Icon d={ICONS.mic} size={20} stroke="#0b0b0d" />}
        </button>
        <div role="status" style={{ flex: 1, minWidth: 0, fontSize: T.fs.xs, fontFamily: T.fontMono, color: T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {rec.error ? <span style={{ color: T.danger }}>{rec.error}</span> : status}
        </div>
      </div>
    </div>
  )
}

// After an En continu session: what was created, and what to do with it.
function SummaryCard({ session, roleLabel, color, free, onValidate, onReview, onCancel }) {
  const n = session.created.length
  const skipped = session.lines.length - session.captured.length
  const saving = session.saving > 0
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div role="dialog" aria-label="Session terminée" style={{ width: 360, maxWidth: '90%', background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, animation: 'stIn .2s ease-out' }}>
        <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>SESSION TERMINÉE</span>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {saving ? 'Découpe des prises…' : `${plural(n, 'prise')} créée${n > 1 ? 's' : ''}`} · <span style={{ color }}>{roleLabel}</span>
        </div>
        <div style={{ fontSize: T.fs.xs, color: T.text3, lineHeight: 1.45 }}>
          {skipped > 0 ? `${plural(skipped, 'réplique')} non enregistrée${skipped > 1 ? 's' : ''}. ` : ''}Les prises déjà validées ne sont pas remplacées.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          <Btn variant="primary" full icon={ICONS.check} onClick={onValidate} disabled={saving || !free}
            title={saving ? 'Découpe en cours…' : !free ? 'Toutes ces répliques ont déjà une prise validée' : undefined}>
            Valider les répliques sans prise validée ({free})
          </Btn>
          <Btn variant="outline" full onClick={onReview} disabled={saving}>Revoir réplique par réplique</Btn>
          <Btn full danger icon={ICONS.trash} onClick={onCancel} disabled={saving}>Annuler la session</Btn>
        </div>
      </div>
    </div>
  )
}
