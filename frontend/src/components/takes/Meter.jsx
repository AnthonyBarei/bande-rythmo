import React, { useState, useEffect } from 'react'
import { T } from '../../ui'
import { METER_FLOOR, levelOf } from '../../utils/takeAudio'

// Rolling input-level history (newest right) from the live analyser.
function useMeterLevels(analyser, bars) {
  const [lvl, setLvl] = useState(() => Array(bars).fill(METER_FLOOR))
  useEffect(() => {
    if (!analyser) return
    const buf = new Float32Array(analyser.fftSize)
    const id = setInterval(() => {
      analyser.getFloatTimeDomainData(buf)
      const v = levelOf(buf)
      setLvl(p => [...p.slice(1), v])
    }, 60)
    return () => { clearInterval(id); setLvl(Array(bars).fill(METER_FLOOR)) }
  }, [analyser, bars])
  return lvl
}


// Studio control-strip meter — reference: 32 flex bars, accent with red peaks
// while recording, border3 otherwise.
export function StageMeter({ analyser, recording }) {
  const lvl = useMeterLevels(analyser, 32)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, flex: 1, minWidth: 0 }}>
      {lvl.map((v, i) => (
        <div key={i} style={{ flex: 1, maxWidth: 5, height: `${v * 100}%`, background: recording ? (v > 0.86 ? T.danger : T.accent) : T.border3, borderRadius: 2, transition: 'height .08s' }} />
      ))}
    </div>
  )
}
