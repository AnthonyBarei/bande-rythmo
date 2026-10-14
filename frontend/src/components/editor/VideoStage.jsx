import React from 'react'
import { Btn, Dot, Icon, ICONS, Segmented } from '../../ui'
import { TRACK_COLORS } from '../../config/tracks'
import { fmtClock as fmt } from '../../utils/timecode'

const SPEEDS = [{ v: 0.5, l: '0.5×' }, { v: 1, l: '1×' }, { v: 1.5, l: '1.5×' }, { v: 2, l: '2×' }]
const PROXY_OPTIONS = [
  { v: 'master', l: 'MASTER', desc: 'Basculer Master / Proxy 720p' },
  { v: 'proxy', l: '720p', desc: 'Basculer Master / Proxy 720p' },
]

export default function VideoStage({
  videoRef, segmentUrl,
  onVideoTimeUpdate, onVideoLoadedMetadata, onVideoPlay, onVideoPause,
  currentTime, duration, speed, playing, muted,
  brInPlayer, activeSubtitle, charMap, hasSubtitles,
  onTogglePlay, onSeek, onSeekEnd, onPrevSub, onNextSub,
  loopActive, onToggleLoopActive, onChangeSpeed, onToggleMute,
  hasProxy, useProxy, onToggleProxy, onGenerateProxy, proxyJob,
}) {
  const activeColor = activeSubtitle ? TRACK_COLORS[(charMap[activeSubtitle.character || ''] ?? 0) % TRACK_COLORS.length].label : null
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: '#000' }}>
      {/* Video */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <video
          ref={videoRef}
          src={segmentUrl}
          preload="metadata"
          crossOrigin="anonymous"
          style={{ width: '88%', maxHeight: '100%', display: 'block', objectFit: 'contain', cursor: 'pointer', aspectRatio: '16/9' }}
          onTimeUpdate={onVideoTimeUpdate}
          onLoadedMetadata={onVideoLoadedMetadata}
          onPlay={onVideoPlay}
          onPause={onVideoPause}
          onClick={onTogglePlay}
        />
        {/* Timecode overlay */}
        <div style={{ position: 'absolute', top: 8, left: '6%', padding: '3px 8px', background: 'rgba(0,0,0,0.55)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Dot color="var(--accent)" size={7} /> {fmt(currentTime)} / {fmt(duration)} · {speed}×
        </div>
        {/* Subtitle burn-in */}
        {brInPlayer !== 'never' && (brInPlayer === 'always' || playing) && (
          <div style={{
            position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.78)', color: '#fff', padding: '6px 16px',
            borderRadius: 3, fontSize: 14, maxWidth: '88%', minWidth: 120, textAlign: 'center',
            fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            borderTop: `2px solid ${activeColor || 'var(--border2)'}`,
            pointerEvents: 'none', opacity: activeSubtitle ? 1 : 0.5,
          }}>
            {activeSubtitle?.character && (
              <div style={{ color: activeColor, fontSize: 11, marginBottom: 2, letterSpacing: 2.5, fontWeight: 700 }}>
                {activeSubtitle.character.toUpperCase()}
              </div>
            )}
            {activeSubtitle ? activeSubtitle.text : ' '}
          </div>
        )}
        {!hasSubtitles && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Aperçu Clip</span>
          </div>
        )}
      </div>

      {/* Mini transport */}
      <div style={{ flexShrink: 0, height: 44, background: 'var(--bg2)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6 }}>
        <Btn size="sm" variant="solid" icon={ICONS.start} onClick={() => onSeek(0)} title="Début" />
        <Btn size="sm" variant="solid" icon={ICONS.prev} onClick={onPrevSub} title="Réplique précédente" />
        <Btn size="sm" variant="primary" onClick={onTogglePlay} style={{ width: 40, padding: 0 }}>
          <Icon d={playing ? ICONS.pause : ICONS.play} size={15} fill="#0b0b0d" />
        </Btn>
        <Btn size="sm" variant="solid" icon={ICONS.next} onClick={onNextSub} title="Réplique suivante" />
        <Btn size="sm" variant="solid" icon={ICONS.end} onClick={onSeekEnd} title="Fin" />
        <Btn size="sm" variant={loopActive ? 'ghost' : 'solid'} active={loopActive} icon={ICONS.loop}
          onClick={onToggleLoopActive} title="Boucler sur la réplique active/sélectionnée" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', flexShrink: 0, marginLeft: 4 }}>
          {fmt(currentTime)} / {fmt(duration)}
        </span>
        <input type="range" min={0} max={duration || 1} step={0.05} value={currentTime}
          onChange={e => onSeek(parseFloat(e.target.value))}
          style={{ flex: 1, color: 'var(--accent)', cursor: 'pointer', height: 3, '--pct': `${(currentTime / (duration || 1)) * 100}%` }} />
        <Segmented size="sm" value={speed} onChange={v => onChangeSpeed(v)} options={SPEEDS} />
        <Btn size="sm" variant="solid" onClick={onToggleMute} title={muted ? 'Activer le son' : 'Couper le son'} style={{ padding: 0 }}>
          <Icon d={muted ? ICONS.mute : ICONS.volume} size={15} stroke={muted ? 'var(--text4)' : 'currentColor'} />
        </Btn>
        {/* Proxy 720p — generate once, then toggle Master / Proxy for smooth scrubbing */}
        {hasProxy ? (
          <Segmented size="sm" value={useProxy ? 'proxy' : 'master'} options={PROXY_OPTIONS}
            onChange={v => { if ((v === 'proxy') !== useProxy) onToggleProxy() }} />
        ) : (
          <Btn size="sm" variant="solid" onClick={onGenerateProxy} disabled={proxyJob}
            title="Générer un proxy 720p (scrubbing fluide des segments lourds)">
            {proxyJob ? '…' : 'Proxy'}
          </Btn>
        )}
      </div>
    </div>
  )
}
