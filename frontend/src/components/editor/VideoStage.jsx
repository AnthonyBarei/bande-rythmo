import React from 'react'
import { T, Segmented } from '../../ui'
import { TRACK_COLORS } from '../../config/tracks'
import { fmtSMPTE as fmtTC } from '../../utils/timecode'

// Video hero — reference screen-editor.jsx Editor › "Video hero".
// Playback controls live in Transport only (one transport on screen).
export default function VideoStage({
  videoRef, segmentUrl,
  onVideoTimeUpdate, onVideoLoadedMetadata, onVideoPlay, onVideoPause,
  currentTime, duration, clipFps, playing,
  brInPlayer, activeSubtitle, charMap,
  onTogglePlay,
  hasProxy, useProxy, onToggleProxy, onGenerateProxy, proxyJob,
}) {
  const activeHex = activeSubtitle ? TRACK_COLORS[(charMap[activeSubtitle.character || ''] ?? 0) % TRACK_COLORS.length].hex : null
  const showSub = brInPlayer !== 'never' && (brInPlayer === 'always' || playing)
  const proxyValue = useProxy && hasProxy ? 'proxy' : 'vo'
  function onProxyChange(v) {
    if (v === proxyValue) return
    if (v === 'proxy' && !hasProxy) { if (!proxyJob) onGenerateProxy(); return }
    onToggleProxy()
  }
  return (
    <div style={{ flex: 1, minHeight: 160, overflow: 'hidden', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '74%', aspectRatio: '16/9', maxHeight: '92%', background: '#000', borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          src={segmentUrl}
          preload="metadata"
          crossOrigin="anonymous"
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', cursor: 'pointer' }}
          onTimeUpdate={onVideoTimeUpdate}
          onLoadedMetadata={onVideoLoadedMetadata}
          onPlay={onVideoPlay}
          onPause={onVideoPause}
          onClick={onTogglePlay}
        />
        {showSub && (
          <div style={{ position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)', maxWidth: '88%', background: 'rgba(0,0,0,.78)', padding: '7px 18px', borderRadius: 6, borderTop: `2px solid ${activeHex || T.border2}`, backdropFilter: 'blur(6px)', textAlign: 'center', pointerEvents: 'none', opacity: activeSubtitle ? 1 : 0.5 }}>
            {activeSubtitle?.character && (
              <div style={{ color: activeHex, fontSize: 9, letterSpacing: 1.5, fontWeight: 700, marginBottom: 2 }}>{activeSubtitle.character.toUpperCase()}</div>
            )}
            <div style={{ fontSize: 16, fontFamily: T.fontMono, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeSubtitle ? activeSubtitle.text : ' '}</div>
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', top: 14, left: 18, padding: '4px 11px', background: 'rgba(0,0,0,.6)', borderRadius: 6, fontFamily: T.fontMono, fontSize: 11.5, color: T.text2, backdropFilter: 'blur(6px)', display: 'flex', gap: 8, pointerEvents: 'none' }}>
        <span style={{ color: T.accent }}>{fmtTC(currentTime, clipFps)}</span><span style={{ color: T.text4 }}>/ {fmtTC(duration, clipFps)}</span>
      </div>
      <div style={{ position: 'absolute', top: 12, right: 16 }}>
        <Segmented size="sm" value={proxyValue} onChange={onProxyChange} options={[
          { v: 'vo', l: 'VO', desc: 'qualité source' },
          { v: 'proxy', l: proxyJob ? 'Proxy 720p…' : 'Proxy 720p', desc: hasProxy ? 'lecture fluide' : 'générer le proxy 720p (lecture fluide)' },
        ]} />
      </div>
    </div>
  )
}
