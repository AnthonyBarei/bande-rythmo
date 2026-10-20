import React from 'react'
import { T, Icon, ICONS, Popover, Segmented, Toggle } from '../../ui'
import { STUDIO_COUNTS, STUDIO_LEADS, STUDIO_CHAINS } from '../../config/studio'

// Session-bar pill `3 · 1s` (décompte · élan) → the take settings, the same
// ones as Réglages › Studio. Enchaînement only applies to Par réplique.
export default function TakeSettings({ cfg, onCfg, disabled, showChain = true }) {
  const row = (label, control) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2 }}>{label}</span>
      {control}
    </div>
  )
  return (
    <Popover align="right" width={300} trigger={(open, toggle) => (
      <button data-rd onClick={() => !disabled && toggle()} title={disabled ? 'Indisponible pendant la prise' : 'Décompte · élan avant réplique'}
        style={{
          height: 32, padding: '0 10px', borderRadius: T.r.ctl, background: T.surface, border: `1px solid ${open ? T.accent : T.border2}`,
          color: T.text2, fontSize: T.fs.xs, fontFamily: T.fontUI, display: 'inline-flex', alignItems: 'center', gap: 7,
          cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: disabled ? 0.6 : 1,
        }}>
        <Icon d={ICONS.clock} size={13} stroke={T.accent} />
        <span style={{ fontFamily: T.fontMono, color: T.text }}>{cfg.count} · {cfg.lead}s</span>
        <Icon d={ICONS.chevron} size={12} stroke={T.text3} />
      </button>
    )}>
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {row('Décompte', <Segmented size="sm" value={cfg.count} onChange={v => onCfg({ studioCount: v })} options={STUDIO_COUNTS} />)}
        {row('Élan avant réplique', <Segmented size="sm" value={cfg.lead} onChange={v => onCfg({ studioLead: v })} options={STUDIO_LEADS} />)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: T.fs.xs, fontWeight: 600, color: T.text2 }}>Bips</span>
          <Toggle on={cfg.beeps} onClick={() => onCfg({ studioBeeps: !cfg.beeps })} label="Bips" />
        </div>
        {showChain && row('Enchaînement', <Segmented size="sm" value={cfg.chain} onChange={v => onCfg({ studioChain: v })} options={STUDIO_CHAINS} />)}
        <div style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.45, textWrap: 'pretty' }}>
          L’image reste figée pendant le décompte. L’élan est la part d’image jouée avant la réplique.
        </div>
      </div>
    </Popover>
  )
}
