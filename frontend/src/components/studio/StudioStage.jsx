import React, { useEffect, useRef, useState } from 'react'
import { T, alpha, Icon, ICONS, Btn, Chip, Dot } from '../../ui'
import { TRACK_HEXES } from '../../config/tracks'
import { StageMeter } from '../takes/Meter'
import { LineStrip, StageClock } from './StageParts'

const pad = n => String(n).padStart(2, '0')
const K = ({ children }) => <span style={{ color: T.accent }}>{children}</span>
const TAG = { pret: 'PRÊT', auto: 'PRÊT', decompte: 'DÉCOMPTE', elan: 'ÉLAN', rec: 'REC', queue: 'REC', revue: 'REVUE', pause: 'PAUSE', summary: 'FIN' }
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`
// A letterbox under the picture at least this tall takes the line text.
const LETTERBOX_TEXT_MIN = 72

// The picture as rendered inside the box (object-fit: contain, centred) —
// the line text and the chips sit on it, not on the letterbox.
function useVideoRect(boxRef, videoRef) {
  const [rect, setRect] = useState(null)
  useEffect(() => {
    const box = boxRef.current
    const v = videoRef?.current
    if (!box || !v) return
    const fit = () => {
      const bw = box.clientWidth
      const bh = box.clientHeight
      const vw = v.videoWidth || 16
      const vh = v.videoHeight || 9
      const s = Math.min(bw / vw, bh / vh)
      const w = Math.round(vw * s)
      const h = Math.round(vh * s)
      const left = Math.round((bw - w) / 2)
      const top = Math.round((bh - h) / 2)
      setRect(r => (r && r.left === left && r.top === top && r.width === w && r.height === h ? r
        : { left, top, width: w, height: h, below: bh - top - h }))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    v.addEventListener('loadedmetadata', fit)
    return () => { ro.disconnect(); v.removeEventListener('loadedmetadata', fit) }
  }, [boxRef, videoRef])
  return rect
}

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

  const boxRef = useRef(null)
  const rect = useVideoRect(boxRef, videoRef)
  const inSummary = phase === 'summary'
  const canPrimary = !!sub && !inSummary
  const primaryTitle = inSummary ? 'Choisir une action dans le résumé'
    : recLike ? (cont ? 'Arrêter la session (Échap)' : 'Annuler la prise (Échap)') : armed ? 'Annuler (Échap)'
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
        <div ref={boxRef} style={{ height: '94%', aspectRatio: '16/9', maxWidth: '96%', background: '#000', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
          {stageImage}
          {showText && rect && <LineOverlay sub={sub} index={index} color={color} rect={rect} />}
          {phase === 'decompte' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(0,0,0,.35)', paddingBottom: 60, pointerEvents: 'none' }}>
              <span key={count} style={{ fontSize: 104, lineHeight: 1, fontWeight: 800, color: T.accent, fontFamily: T.fontMono, textShadow: `0 0 40px ${alpha(T.accent, '66')}`, animation: 'stCount .95s ease-out' }}>{count}</span>
              <span style={{ fontSize: T.fs.xs, color: T.text2, background: 'rgba(0,0,0,.7)', borderRadius: 6, padding: '4px 10px' }}>Échap pour annuler</span>
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
          {rect && (
            <div style={{ position: 'absolute', zIndex: 1, top: rect.top + 12, left: rect.left + 12, padding: '4px 10px', background: 'rgba(0,0,0,.7)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 12, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              {recLike
                ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.danger, animation: 'stBlink 1s steps(2) infinite' }} />
                : <Dot color={armed ? T.accent : phase === 'revue' ? T.success : T.text3} size={6} />}
              <span style={{ color: recLike ? T.danger : armed ? T.accent : T.text2, fontWeight: 700, fontSize: 10.5, letterSpacing: 1 }}>{tag}</span>
              <StageClock videoRef={videoRef} fps={fps} />
            </div>
          )}
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
        <button data-rd onClick={onPrimary} disabled={!canPrimary} title={primaryTitle} style={{
          width: 48, height: 48, borderRadius: '50%', cursor: canPrimary ? 'pointer' : inSummary ? 'default' : 'not-allowed', flexShrink: 0, padding: 0,
          background: recLike ? T.danger : armed ? T.surface2 : T.accent,
          border: `3px solid ${alpha(recLike ? T.danger : armed ? T.border3 : T.accent, '44')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canPrimary ? 1 : 0.4,
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

// The held réplique over the picture (FIXES_STUDIO_R2 #1), one rule for every
// state: in the letterbox under the picture when it is ≥ 72px (on black),
// else inside the picture's bottom 30% over a gradient.
function LineOverlay({ sub, index, color, rect }) {
  const inLetterbox = rect.below >= LETTERBOX_TEXT_MIN
  const place = inLetterbox
    ? { top: rect.top + rect.height, height: rect.below, padding: '10px 24px', justifyContent: 'center' }
    : { bottom: rect.below, maxHeight: Math.round(rect.height * 0.3), padding: '24px 24px 14px', justifyContent: 'flex-end', background: 'linear-gradient(transparent, rgba(0,0,0,.85) 45%)' }
  return (
    <div style={{ position: 'absolute', left: rect.left, width: rect.width, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden', pointerEvents: 'none', ...place }}>
      <div style={{ fontSize: T.fs.micro, letterSpacing: 1.2, fontWeight: 700, color, marginBottom: 2, flexShrink: 0 }}>
        {(sub.character || 'Sans personnage').toUpperCase()} · RÉPLIQUE {pad(index + 1)}
      </div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: rect.height < 300 ? 22 : 28, color: '#fff', lineHeight: 1.15, textWrap: 'pretty', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', flexShrink: 0 }}>{sub.text}</div>
      {sub.note && (
        <div style={{ fontSize: T.fs.xs, color: T.text2, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
          <Icon d={ICONS.note} size={12} stroke={T.text3} />{sub.note}
        </div>
      )}
    </div>
  )
}

// After an En continu session: what was created, and what to do with it.
// The card keeps focus on its primary action (the first enabled button), so
// Entrée clicks it; Échap is handled by the screen's keys.
function SummaryCard({ session, roleLabel, color, free, onValidate, onReview, onCancel }) {
  const n = session.created.length
  const skipped = session.lines.length - session.captured.length
  const saving = session.saving > 0
  const cardRef = useRef(null)
  useEffect(() => { cardRef.current?.querySelector('button:not(:disabled)')?.focus() }, [saving, free])
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'rgba(0,0,0,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={cardRef} role="dialog" aria-label="Session terminée" style={{ width: 360, maxWidth: '90%', background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.r.card, boxShadow: T.shadowL, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, animation: 'stIn .2s ease-out' }}>
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
