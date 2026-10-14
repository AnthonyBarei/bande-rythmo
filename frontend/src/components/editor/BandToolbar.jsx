import React from 'react'
import { createPortal } from 'react-dom'
import { Btn, Dot, Icon, ICONS, Kbd, MenuItem, SectionLabel } from '../../ui'
import { TRACK_COLORS } from '../../config/tracks'
import { fmtSMPTE as fmtTC } from '../../utils/timecode'
import { activeIndexAt } from '../../utils/band'
import BandMenus from './BandMenus'
import StylePanel from './StylePanel'

const SIGN_OPTIONS = [
  ['labiale', 'Labiale (B P M)'],
  ['semi', 'Semi (W)'],
  ['fricative', 'Fricative (F V)'],
  ['arrondie', 'Arrondie (O U Œ)'],
  ['ouverte', 'Ouverte (A E I…)'],
  ['startEnd', 'Début / Fin de phrase'],
]

const grp = {
  display: 'inline-flex', alignItems: 'center', gap: 2,
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, padding: 3,
}
const popover = {
  position: 'fixed', zIndex: 'var(--z-dropdown)',
  background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12, boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
}
const popLabel = { textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }
const checkRow = { display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', minHeight: 32, fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }
const sep = { height: 1, background: 'var(--border)', margin: '6px 0' }

// VoxDub-style BR toolbar — 6 labelled clusters:
// Qui · Éditer · Insérer ▾ · Détection ▾ · Boucles ▾ · Affichage ▾ · 🔒
export default function BandToolbar({
  subtitles, onSubtitlesChange, selectedIdx, setSelectedIdx,
  getBandTime, seekBand,
  brOffset, setBrOffset, pxPerSec, setPxPerSec,
  charMap, brInPlayer, setBrInPlayer, rythmoStyle, setRythmoStyle,
  fontScale, setFontScale,
  locked, setLocked,
  detection, setDetection, detectionAuto, setDetectionAuto,
  boucles = [], onAddBoucle, onRemoveBoucle, clipFps = 25,
  sceneCuts = [], onDetectScenes = () => {}, onClearScenes = () => {}, detectingScenes = false,
  onUndo = () => {}, onRedo = () => {}, canUndo = false, canRedo = false,
  brFont = 'atkinson', setBrFont = () => {},
  uploadedFonts = [], onUploadFont = () => {}, onDeleteFont = () => {},
  wordByWord = true, setWordByWord = () => {},
}) {
  const [showDetection, setShowDetection] = React.useState(false)
  const [showBoucles, setShowBoucles] = React.useState(false)
  const liveIdx = activeIndexAt(subtitles, getBandTime())
  const targetIdx = selectedIdx != null ? selectedIdx : (liveIdx >= 0 ? liveIdx : null)
  const target = targetIdx != null ? subtitles[targetIdx] : null

  const [showReact, setShowReact] = React.useState(false)
  const [showResp, setShowResp] = React.useState(false)
  const [showNote, setShowNote] = React.useState(false)
  const [showCharPicker, setShowCharPicker] = React.useState(false)
  const [showInserer, setShowInserer] = React.useState(false)
  const [showAffichage, setShowAffichage] = React.useState(false)
  const [dropdownAnchor, setDropdownAnchor] = React.useState({ bottom: 60, left: 200 })
  // Per-menu anchors so each in-toolbar dropdown can portal to body with
  // position:fixed, escaping the toolbar's overflow:auto clip + stacking ctx.
  const [charAnchor, setCharAnchor] = React.useState({ bottom: 60, left: 200 })
  const [detAnchor, setDetAnchor] = React.useState({ bottom: 60, left: 200 })
  const [boucleAnchor, setBoucleAnchor] = React.useState({ bottom: 60, left: 200 })
  const toolbarRef = React.useRef(null)
  const charPickerRef = React.useRef(null)

  // Anchor a portaled dropdown above its trigger button. Tags the trigger with
  // a data-popover attribute so the click-away effect can recognise it.
  function anchorFromEvent(e, setter, name) {
    try {
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      setter({ bottom: window.innerHeight - r.top + 4, left: r.left })
      if (name) el.setAttribute('data-popover-trigger', name)
    } catch (err) { console.warn('Ancrage du menu impossible', err) }
  }

  // Global click-away: portaled dropdowns + their triggers carry data-popover[-trigger].
  // A mousedown outside any matching element closes the active popover.
  React.useEffect(() => {
    const anyOpen = showCharPicker || showDetection || showBoucles ||
                    showResp || showReact || showNote || showInserer || showAffichage
    if (!anyOpen) return
    const onDown = (e) => {
      const t = e.target
      if (!t || typeof t.closest !== 'function') return
      const hit = t.closest('[data-popover], [data-popover-trigger]')
      if (hit) return
      setShowCharPicker(false)
      setShowDetection(false)
      setShowBoucles(false)
      setShowResp(false)
      setShowReact(false)
      setShowNote(false)
      setShowInserer(false)
      setShowAffichage(false)
    }
    // Defer one tick so the opening click doesn't immediately close.
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDown) }
  }, [showCharPicker, showDetection, showBoucles, showResp, showReact, showNote, showInserer, showAffichage])

  // `field` marks a typing edit (coalesced into one undo step per burst).
  function updateTarget(patch, field) {
    if (targetIdx == null) return
    onSubtitlesChange(
      subtitles.map((s, i) => i === targetIdx ? { ...s, ...patch } : s),
      field ? { coalesce: `${targetIdx}:${field}` } : undefined)
  }

  function setIN() {
    if (!target) return
    updateTarget({ start: Math.min(getBandTime(), target.end - 0.1) })
  }
  function setOUT() {
    if (!target) return
    updateTarget({ end: Math.max(getBandTime(), target.start + 0.1) })
  }

  function splitAtCurrentTime() {
    if (!target || targetIdx == null) return
    const t = getBandTime()
    if (t <= target.start || t >= target.end) return
    const next = [...subtitles]
    next.splice(targetIdx, 1, { ...target, end: t }, { ...target, start: t, text: '' })
    onSubtitlesChange(next)
    setSelectedIdx(targetIdx + 1)
  }

  function insertTagSub(text, dur = 0.5) {
    const t = getBandTime()
    const newSub = { start: t, end: t + dur, text, character: activeChar, reactions: [] }
    const next = [...subtitles, newSub].sort((a, b) => a.start - b.start)
    onSubtitlesChange(next)
    setShowResp(false)
    setShowReact(false)
  }

  function newCharacterPrompt() {
    const name = window.prompt('Nom du nouveau personnage :')
    if (name && name.trim()) {
      updateTarget({ character: name.trim() })
      setShowCharPicker(false)
    }
  }

  const charList = Object.keys(charMap)
  const activeChar = target?.character || charList[0] || ''
  const cColor = TRACK_COLORS[(charMap[activeChar] ?? 0) % TRACK_COLORS.length].label
  const hasTarget = target != null

  return (
    <div ref={toolbarRef} style={{
      position: 'relative', background: 'var(--surface)',
      borderBottom: '1px solid var(--border)', padding: '0 14px', height: 50, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', overflowX: 'auto',
    }}>
      {/* Undo / redo */}
      <div style={grp}>
        <Btn size="sm" icon={ICONS.undo} onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)" />
        <Btn size="sm" icon={ICONS.redo} onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl+Y)" />
      </div>

      {/* Active character pill — click to reassign */}
      <div ref={charPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={e => { if (target) { anchorFromEvent(e, setCharAnchor, 'char'); setShowCharPicker(s => !s) } }}
          title={target ? 'Changer le personnage de cette réplique' : 'Sélectionnez une réplique'}
          style={{
            height: 34, minWidth: 140, padding: '0 10px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, lineHeight: 1,
            background: 'var(--surface2)', border: `1px solid ${target ? cColor + '55' : 'var(--border2)'}`,
            color: target ? cColor : 'var(--text4)', fontSize: 12, fontWeight: 600, borderRadius: 8,
            cursor: target ? 'pointer' : 'default',
          }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', background: target ? cColor + '33' : 'var(--surface3)',
            border: `1px solid ${target ? cColor : 'var(--border2)'}`, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 11, fontWeight: 700,
          }}>
            {(activeChar[0] || '?').toUpperCase()}
          </span>
          <span style={{ flex: 1, textAlign: 'left', textTransform: 'capitalize' }}>{activeChar || 'personnage'}</span>
          <Icon d={ICONS.chevron} size={14} />
        </button>
        {showCharPicker && target && createPortal(
          <div data-popover="char" style={{ ...popover, bottom: charAnchor.bottom, left: charAnchor.left, padding: 6, minWidth: 200 }}>
            <SectionLabel style={{ ...popLabel, padding: '4px 10px 2px' }}>
              Personnage — réplique #{targetIdx + 1}
            </SectionLabel>
            {charList.map(c => {
              const cc = TRACK_COLORS[(charMap[c] ?? 0) % TRACK_COLORS.length].label
              return (
                <MenuItem key={c || '_def'} color={cc} active={c === (target.character || '')}
                  onClick={() => { updateTarget({ character: c }); setShowCharPicker(false) }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={cc} size={8} />{c || '(défaut)'}</span>
                </MenuItem>
              )
            })}
            <div style={{ ...sep, margin: '4px 0' }} />
            <MenuItem icon={ICONS.plus} color="var(--accent)" onClick={newCharacterPrompt}>Nouveau personnage…</MenuItem>
          </div>,
          document.body
        )}
      </div>

      {/* Mic — toggle "prise à enregistrer" */}
      <button
        onClick={() => { if (target) updateTarget({ take: !target.take }) }}
        title={target?.take ? 'Marquer comme enregistrée' : 'Marquer comme prise à enregistrer'}
        style={{
          height: 34, width: 34, minWidth: 34, padding: 0, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: target?.take ? 'var(--danger)' : 'var(--surface2)',
          border: `1px solid ${target?.take ? 'var(--danger)' : 'color-mix(in srgb, var(--danger) 33%, transparent)'}`,
          color: target?.take ? '#fff' : (target ? 'var(--danger)' : 'var(--text4)'), borderRadius: 8,
          cursor: target ? 'pointer' : 'default',
        }}>
        <Icon d={ICONS.mic} />
      </button>

      {/* IN / OUT / Couper */}
      <div style={grp}>
        <Btn size="sm" icon={ICONS.in} onClick={setIN} disabled={!hasTarget} title="Définir IN au temps courant" style={{ padding: '0 9px', gap: 5 }}>
          IN<Kbd>I</Kbd>
        </Btn>
        <Btn size="sm" icon={ICONS.out} onClick={setOUT} disabled={!hasTarget} title="Définir OUT au temps courant" style={{ padding: '0 9px', gap: 5 }}>
          OUT<Kbd>O</Kbd>
        </Btn>
        <Btn size="sm" icon={ICONS.scissors} onClick={splitAtCurrentTime} disabled={!hasTarget} title="Couper la réplique au temps courant" style={{ padding: '0 9px', gap: 5 }}>
          Couper<Kbd>S</Kbd>
        </Btn>
      </div>

      {/* Insérer ▾ — collapses Resp · Réact · Note (DOUBLAGE_IA_REVIEW §3). */}
      <div style={{ ...grp, position: 'relative' }}>
        <Btn size="sm" icon={ICONS.plus} iconR={ICONS.chevron} active={showInserer}
          onClick={e => {
            anchorFromEvent(e, setDropdownAnchor, 'inserer')
            setShowInserer(s => !s)
            setShowResp(false); setShowReact(false); setShowNote(false)
          }}
          title="Insérer respiration, réaction, ou note"
          style={{ padding: '0 9px', gap: 5 }}>
          Insérer
        </Btn>
      </div>

      {/* Lock */}
      <div style={grp}>
        <Btn size="sm" icon={locked ? ICONS.lock : ICONS.lockOpen} active={locked} onClick={() => setLocked(l => !l)}
          title={locked ? 'Déverrouiller la BR' : 'Verrouiller la BR (empêche les éditions accidentelles)'} />
      </div>

      {/* Pro BR — détection layer toggle + per-sign menu */}
      <div style={{ ...grp, position: 'relative' }}>
        <Btn size="sm" active={detection.layer} onClick={() => setDetection(d => ({ ...d, layer: !d.layer }))}
          title="Calque détection (B/P/M, fricatives, etc.) — graphite sous le texte"
          style={{ padding: '0 9px' }}>
          Détection
        </Btn>
        <Btn size="sm" icon={ICONS.chevron} active={showDetection}
          onClick={e => { anchorFromEvent(e, setDetAnchor, 'det'); setShowDetection(s => !s) }} title="Signes affichés" />
        {showDetection && createPortal(
          <div data-popover="det" style={{ ...popover, bottom: detAnchor.bottom, left: detAnchor.left, padding: 8, minWidth: 230 }}>
            <SectionLabel style={popLabel}>Signes phonétiques</SectionLabel>
            {SIGN_OPTIONS.map(([k, lbl]) => (
              <label key={k} style={checkRow}>
                <input type="checkbox" checked={!!detection[k]} onChange={e => setDetection(d => ({ ...d, [k]: e.target.checked }))} />
                {lbl}
              </label>
            ))}
            <div style={sep} />
            <label style={checkRow}>
              <input type="checkbox" checked={detectionAuto} onChange={e => setDetectionAuto(e.target.checked)} />
              Aide auto (depuis les lettres)
            </label>
          </div>,
          document.body
        )}
      </div>

      {/* Boucles — split at cursor + list */}
      <div style={{ ...grp, position: 'relative' }}>
        <Btn size="sm" onClick={onAddBoucle} title="Créer / scinder une boucle au temps courant" style={{ padding: '0 9px' }}>
          Boucle +
        </Btn>
        <Btn size="sm" iconR={ICONS.chevron} active={showBoucles}
          onClick={e => { anchorFromEvent(e, setBoucleAnchor, 'boucle'); setShowBoucles(s => !s) }} title={`Boucles (${boucles.length})`}
          style={{ padding: '0 8px', gap: 5 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{boucles.length}</span>
        </Btn>
        {showBoucles && createPortal(
          <div data-popover="boucle" style={{ ...popover, bottom: boucleAnchor.bottom, left: boucleAnchor.left, padding: 8, minWidth: 260, maxHeight: 260, overflow: 'auto' }}>
            <SectionLabel style={popLabel}>Boucles · fps {clipFps.toFixed(2)}</SectionLabel>
            {boucles.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text3)', padding: 6 }}>Aucune boucle. Placez le curseur et cliquez « Boucle + ».</div>
            ) : boucles.map(b => (
              <div key={b.number} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <button onClick={() => seekBand(b.start)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, minHeight: 32, padding: 0 }}>
                  B{b.number}
                </button>
                <span style={{ color: 'var(--text3)', flex: 1 }}>
                  {fmtTC(b.start, clipFps)} — {fmtTC(b.end, clipFps)} · {(b.end - b.start).toFixed(1)}s
                </span>
                <Btn size="sm" danger icon={ICONS.close} onClick={() => onRemoveBoucle(b.number)} title="Supprimer cette boucle" />
              </div>
            ))}
          </div>,
          document.body
        )}
      </div>

      {/* Plans — auto-detect scene cuts (changements de plan) */}
      <div style={grp}>
        <Btn size="sm" active={sceneCuts.length > 0} onClick={onDetectScenes} disabled={detectingScenes}
          title="Détecter les changements de plan (ffmpeg)"
          style={{ padding: '0 9px', gap: 5 }}>
          <span style={{ color: 'var(--info)' }}>▏</span>
          {detectingScenes ? '…' : 'Plans'}
          {sceneCuts.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--info)' }}>{sceneCuts.length}</span>}
        </Btn>
        {sceneCuts.length > 0 && (
          <Btn size="sm" icon={ICONS.close} onClick={onClearScenes} title="Effacer les plans détectés" />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 8 }} />

      {/* Affichage ▾ — collapses Style · Zoom · Décalage · Font · BR-in-player
          (DOUBLAGE_IA_REVIEW §3 — set-once knobs out of the way). */}
      <div style={{ ...grp, position: 'relative' }}>
        <Btn size="sm" iconR={ICONS.chevron} active={showAffichage}
          onClick={e => {
            try {
              const el = e.currentTarget
              const r = el.getBoundingClientRect()
              setDropdownAnchor({ bottom: window.innerHeight - r.top + 4, left: Math.max(8, r.right - 360) })
              if (el.setAttribute) el.setAttribute('data-popover-trigger', 'affichage')
            } catch (err) { console.warn('Ancrage du menu impossible', err) }
            setShowAffichage(s => !s)
          }}
          title="Affichage : style, zoom, décalage, police, sous-titre dans le player"
          style={{ padding: '0 11px', gap: 6, fontWeight: 600 }}>
          Affichage
        </Btn>
      </div>

      <BandMenus
        anchor={dropdownAnchor}
        showResp={showResp}
        showReact={showReact}
        showNote={showNote}
        showInserer={showInserer}
        onCloseInserer={() => setShowInserer(false)}
        insertTagSub={insertTagSub}
        activeChar={activeChar}
        cColor={cColor}
        target={target}
        targetIdx={targetIdx}
        updateTarget={updateTarget}
      />

      {showAffichage && (
        <StylePanel
          anchor={dropdownAnchor}
          onClose={() => setShowAffichage(false)}
          rythmoStyle={rythmoStyle}
          setRythmoStyle={setRythmoStyle}
          brFont={brFont}
          setBrFont={setBrFont}
          uploadedFonts={uploadedFonts}
          onUploadFont={onUploadFont}
          onDeleteFont={onDeleteFont}
          pxPerSec={pxPerSec}
          setPxPerSec={setPxPerSec}
          brOffset={brOffset}
          setBrOffset={setBrOffset}
          fontScale={fontScale}
          setFontScale={setFontScale}
          wordByWord={wordByWord}
          setWordByWord={setWordByWord}
          brInPlayer={brInPlayer}
          setBrInPlayer={setBrInPlayer}
        />
      )}
    </div>
  )
}
