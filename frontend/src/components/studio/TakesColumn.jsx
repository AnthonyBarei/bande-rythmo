import React from 'react'
import { T, alpha, ICONS, Btn, Chip } from '../../ui'
import { TakeCard } from '../takes/TakeCard'
import { AbBar } from './StageParts'

// PRISES column (340px): the takes of the current réplique, newest first,
// A/B comparison, and Valider — Valider sits 12px under the last card.
export default function TakesColumn({
  shown, labelOf, selected, freshId, onSelect, player, ab, onAB, onToggleAB,
  locked, onDelete, onValidate, error, role,
}) {
  const { takeA, takeB, showAB, canAB, abA, abB } = ab
  return (
    <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, paddingBottom: 'var(--toast-safe-bottom, 0px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minHeight: 24 }}>
        <span style={{ fontSize: T.fs.micro, letterSpacing: 1.4, color: T.text3, fontWeight: 700 }}>PRISES</span>
        <span style={{ fontSize: T.fs.micro, color: T.text3, fontFamily: T.fontMono }}>{shown.length}</span>
        <div style={{ flex: 1 }} />
        {canAB && (
          <button data-rd onClick={onToggleAB} style={{ background: 'transparent', padding: 0 }}>
            <Chip soft={!showAB} active={showAB} color={T.info}>A/B comparer</Chip>
          </button>
        )}
      </div>
      {showAB && (
        <AbBar takeA={takeA} takeB={takeB} slot={player.playing != null && !player.ctxId ? player.abSlot : null}
          onSlot={slot => {
            const take = slot === 'A' ? takeA : takeB
            if (take) player.togglePlay(take, slot, slot === 'A' ? takeB : takeA)
          }}
          canSwap={!!takeA && !!takeB} />
      )}
      {error && (
        <div style={{ fontSize: T.fs.micro, color: T.danger, background: alpha(T.danger, '22'), padding: '6px 8px', borderRadius: T.r.chip }}>{error}</div>
      )}
      <div style={{ flex: '0 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.length === 0 && (
            <div style={{ border: `2px dashed ${T.border2}`, borderRadius: T.r.ctl, padding: 18, fontSize: T.fs.xs, color: T.text3, textAlign: 'center', lineHeight: 1.5, flexShrink: 0 }}>
              Aucune prise pour cette réplique.<br />Appuyer sur <span style={{ color: T.accent }}>R</span> pour lancer le décompte.
            </div>
          )}
          {shown.map(t => (
            <TakeCard key={t.id} take={t} label={labelOf(t)}
              selected={selected?.id === t.id}
              fresh={freshId === t.id}
              isPlaying={player.playing === t.id} progress={player.playing === t.id ? player.progress.p : null} clock={player.progress.now}
              onImage={player.ctxId === t.id}
              onImageDisabled={locked}
              ab={t.id === abA ? 'A' : t.id === abB ? 'B' : null}
              showAB={showAB}
              onSelect={() => onSelect(t.id)}
              onPlay={() => player.togglePlay(t, t.id === abA ? 'A' : t.id === abB ? 'B' : null)}
              onPlayOnImage={() => !locked && player.toggleOnImage(t)}
              onAB={() => onAB(t.id)}
              onDelete={() => onDelete(t.id)} />
          ))}
        </div>
        {shown.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <Btn variant={selected && !selected.best ? 'primary' : 'outline'} full icon={ICONS.check} disabled={!selected || locked}
              title={locked ? 'Indisponible pendant la prise' : !selected ? "Sélectionnez d'abord une prise" : selected.best ? 'Cette prise est déjà validée' : 'Valider la prise (Entrée)'}
              onClick={() => onValidate(selected)}>
              {selected ? `Valider la ${labelOf(selected).toLowerCase()}` : 'Sélectionner une prise'}
            </Btn>
          </div>
        )}
      </div>
      {role && role.total > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
          <span style={{ fontSize: T.fs.xs, fontFamily: T.fontMono, color: role.done === role.total ? T.success : T.text3 }}>
            {role.label} · {role.done}/{role.total} validées
          </span>
          <div style={{ height: 4, background: T.surface2, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(role.done / role.total) * 100}%`, background: role.done === role.total ? T.success : role.color, transition: 'width .3s' }} />
          </div>
        </div>
      )}
    </div>
  )
}
