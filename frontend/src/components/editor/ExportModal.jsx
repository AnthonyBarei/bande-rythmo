import React from 'react'
import { Btn, Icon, ICONS } from '../../ui'

// Inline export fallback when App provides no Export screen.
export default function ExportModal({ clipName, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(0,0,0,0.66)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(960px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <Icon d={ICONS.download} size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Exporter le clip</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{clipName}</div>
          </div>
          <Btn size="sm" variant="solid" icon={ICONS.close} onClick={onClose} title="Fermer (Échap)" />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
