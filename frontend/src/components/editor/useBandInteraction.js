import { useState, useEffect, useRef } from 'react'
import { bandCoords, hitTestBand, hitTestBandLetter } from '../band/bandHit'

const SIGN_ORDER = [null, 'labiale', 'semi', 'fricative', 'arrondie', 'ouverte']

// Mouse on the band canvas: drag machine (create / shift / resize / alt-dupe /
// ⇧loop), letter clicks that cycle détection signs, hover hints, Ctrl/⇧+wheel
// zoom, the réplique context menu and the inline text editor.
export default function useBandInteraction({
  canvasRef, videoRef, subtitlesRef, charMapRef, numTracksRef, pxPerSecRef, setPxPerSec,
  detectionRef, wordByWord, onsetsRef, lockedRef, charList,
  getBandTime, seekBand, setLoopRegion, loopRegionRef, loopSub,
  changeSubtitles, setSubtitlesTransient, dragCommit, finishDrag, deleteReplica,
}) {
  const dragRef = useRef(null)
  const hoverRef = useRef(null)
  const [hoverHint, setHoverHint] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    if (!ctxMenu) return
    const onKey = e => { if (e.key === 'Escape') setCtxMenu(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctxMenu])

  // Native non-passive listener: React's onWheel is passive, so its
  // preventDefault can't stop Ctrl+wheel from zooming the whole page.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = e => {
      if (!e.ctrlKey && !e.shiftKey) return
      e.preventDefault()
      setPxPerSec(p => Math.max(40, Math.min(600, p + (e.deltaY < 0 ? 20 : -20))))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  function startEdit(idx) {
    const v = videoRef.current; if (v && !v.paused) v.pause()
    setEditingIdx(idx)
    setEditText(subtitlesRef.current[idx]?.text || '')
  }

  function commitEdit() {
    if (editingIdx == null) return
    const subs = subtitlesRef.current
    if (editingIdx < subs.length) {
      changeSubtitles(subs.map((s, i) => i === editingIdx ? { ...s, text: editText } : s))
    }
    setEditingIdx(null)
  }

  function canvasCoords(e) {
    return bandCoords(canvasRef.current, e, getBandTime(), pxPerSecRef.current)
  }

  function hitTest(e) {
    return hitTestBand(canvasCoords(e), subtitlesRef.current, charMapRef.current, numTracksRef.current)
  }

  // DOUBLAGE_IA_REVIEW §6 — click a letter on the band to cycle its detection sign.
  function hitTestLetter(e) {
    return hitTestBandLetter(canvasRef.current, canvasCoords(e), subtitlesRef.current, charMapRef.current, numTracksRef.current, wordByWord)
  }

  // Cycle sign at (sub, word, char): none → labiale → semi → fricative → arrondie → ouverte → none.
  function cycleSignAt(subIdx, wordIdx, charIdx) {
    const subs = subtitlesRef.current
    const sub = subs[subIdx]
    if (!sub) return
    const words = sub.words || []
    const wd = words[wordIdx]
    if (!wd) return
    const signs = Array.isArray(wd.signs) ? [...wd.signs] : []
    const existing = signs.findIndex(s => s.i === charIdx)
    const cur = existing >= 0 ? signs[existing].type : null
    const nextType = SIGN_ORDER[(SIGN_ORDER.indexOf(cur) + 1) % SIGN_ORDER.length]

    if (nextType == null) {
      if (existing >= 0) signs.splice(existing, 1)
    } else {
      // Time span: use the letter's slice of the word duration.
      const len = (wd.w || '').length || 1
      const dur = Math.max(0.05, (wd.end || 0) - (wd.start || 0))
      const t0 = (wd.start || 0) + (charIdx / len) * dur
      const t1 = (wd.start || 0) + ((charIdx + 1) / len) * dur
      const entry = { i: charIdx, type: nextType, t0, t1 }
      if (existing >= 0) signs[existing] = entry
      else signs.push(entry)
    }
    const nextWords = words.map((w, j) => j === wordIdx ? { ...w, signs: signs.length ? signs : null } : w)
    const nextSub = { ...sub, words: nextWords }
    changeSubtitles(subs.map((s, j) => j === subIdx ? nextSub : s))
  }

  function snapTime(t, e, preferOnset = false) {
    if (e?.altKey) return Math.max(0, t)
    if (preferOnset) {
      const onsets = onsetsRef.current
      if (onsets && onsets.length) {
        const win = 0.08
        let best = null, bestD = win
        for (const o of onsets) {
          const d = Math.abs(o - t)
          if (d < bestD) { bestD = d; best = o }
        }
        if (best != null) return Math.max(0, best)
      }
    }
    return Math.max(0, Math.round(t * 100) / 100)
  }

  function onMouseDown(e) {
    if (editingIdx != null) return
    if (e.button !== 0) return
    if (lockedRef.current) return
    const hit = hitTest(e); if (!hit) return

    // Shift+click on block → loop that subtitle
    if (e.shiftKey && hit.subIdx >= 0) {
      loopSub(subtitlesRef.current[hit.subIdx])
      return
    }
    // Shift+drag in empty → loop region custom
    if (e.shiftKey && hit.subIdx < 0) {
      dragRef.current = {
        mode: 'loop',
        startX: hit.x, startY: hit.y,
        startTime: hit.time,
        didMove: false,
      }
      return
    }

    if (hit.subIdx >= 0) {
      const sub = subtitlesRef.current[hit.subIdx]
      const mode = hit.zone === 'left' ? 'resize-start' : hit.zone === 'right' ? 'resize-end' : 'shift'
      // Alt+drag in mid → duplicate before shifting
      let subIdx = hit.subIdx
      const baseSubs = subtitlesRef.current
      let workingSubs = baseSubs
      if (e.altKey && mode === 'shift') {
        const dur = sub.end - sub.start
        const dupe = { ...sub, start: sub.end, end: sub.end + dur }
        workingSubs = [...workingSubs.slice(0, hit.subIdx + 1), dupe, ...workingSubs.slice(hit.subIdx + 1)]
        subIdx = hit.subIdx + 1
        setSubtitlesTransient(workingSubs)
      }
      dragRef.current = {
        mode,
        subIdx,
        startX: hit.x, startY: hit.y, startTime: hit.time,
        origSub: { ...workingSubs[subIdx] },
        origTrack: charMapRef.current[(workingSubs[subIdx].character || '')] ?? 0,
        duplicated: workingSubs !== baseSubs,
        baseSubs,
        didMove: false,
      }
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = mode === 'shift' ? 'grabbing' : 'ew-resize'
    } else {
      dragRef.current = {
        mode: 'create',
        subIdx: -1,
        startX: hit.x, startY: hit.y,
        startTime: snapTime(hit.time, e, true),
        trackChar: charList[hit.trackIdx] ?? '',
        created: false,
        didMove: false,
      }
    }
  }

  function onMouseMove(e) {
    const hit = hitTest(e); if (!hit) return
    const drag = dragRef.current

    if (!drag) {
      hoverRef.current = { x: hit.x, time: hit.time }
      const canvas = canvasRef.current
      if (canvas) {
        canvas.style.cursor = hit.subIdx >= 0
          ? (hit.zone === 'left' || hit.zone === 'right' ? 'ew-resize' : 'grab')
          : 'crosshair'
      }
      if (hit.subIdx >= 0) {
        const s = subtitlesRef.current[hit.subIdx]
        setHoverHint(`${hit.zone === 'mid' ? 'glisser' : 'redimensionner'} · ${s.character || '(défaut)'} · ${s.text.slice(0, 40)}`)
      } else {
        setHoverHint('cliquer-glisser pour créer · double-clic pour éditer')
      }
      return
    }

    drag.didMove = drag.didMove || Math.abs(hit.x - drag.startX) > 2 || Math.abs(hit.y - drag.startY) > 2
    const dt = hit.time - drag.startTime
    // Keep blocks inside the clip (duration unknown until metadata → no clamp).
    const clipEnd = videoRef.current?.duration || Infinity

    if (drag.mode === 'shift') {
      const dur = drag.origSub.end - drag.origSub.start
      const newStart = Math.min(snapTime(drag.origSub.start + dt, e), Math.max(0, clipEnd - dur))
      const verticalDelta = hit.y - drag.startY
      const trackH = hit.H / numTracksRef.current
      let newChar = drag.origSub.character
      if (Math.abs(verticalDelta) > trackH * 0.5 && hit.trackIdx !== drag.origTrack && charList[hit.trackIdx] != null) {
        newChar = charList[hit.trackIdx]
      }
      dragCommit(subtitlesRef.current.map((s, i) => i !== drag.subIdx ? s : { ...s, start: newStart, end: newStart + dur, character: newChar }))
    } else if (drag.mode === 'resize-start') {
      const newStart = Math.min(snapTime(drag.origSub.start + dt, e, true), drag.origSub.end - 0.1)
      dragCommit(subtitlesRef.current.map((s, i) => i !== drag.subIdx ? s : { ...s, start: newStart }))
    } else if (drag.mode === 'resize-end') {
      const newEnd = Math.max(Math.min(snapTime(drag.origSub.end + dt, e, true), clipEnd), drag.origSub.start + 0.1)
      dragCommit(subtitlesRef.current.map((s, i) => i !== drag.subIdx ? s : { ...s, end: newEnd }))
    } else if (drag.mode === 'loop') {
      const t1 = hit.time
      const a = Math.max(0, Math.min(drag.startTime, t1))
      const b = Math.max(0, Math.max(drag.startTime, t1))
      if (b - a > 0.1) setLoopRegion({ start: a, end: b })
    } else if (drag.mode === 'create') {
      const t1 = Math.min(snapTime(hit.time, e, true), clipEnd)
      if (!drag.created && Math.abs(t1 - drag.startTime) > 0.1) {
        drag.created = true
        const start = Math.min(drag.startTime, t1)
        const end = Math.max(drag.startTime, t1)
        const newSub = { start, end, character: drag.trackChar, text: '' }
        const next = [...subtitlesRef.current, newSub]
        drag.subIdx = next.length - 1
        drag.origSub = newSub
        drag.mode = 'resize-end'
        dragCommit(next)
      }
    }
    hoverRef.current = { x: hit.x, time: hit.time }
  }

  // End of an edit gesture: one undo step + immediate save. A create-drag that
  // never created anything changes nothing; an alt-click that never moved
  // drops its transient duplicate.
  function endEditDrag(drag) {
    if (drag.mode === 'create') return
    if (!drag.didMove) {
      if (drag.duplicated) setSubtitlesTransient(drag.baseSubs)
      return
    }
    finishDrag()
  }

  function onMouseLeave() {
    const drag = dragRef.current
    dragRef.current = null
    hoverRef.current = null
    setHoverHint(null)
    if (drag && drag.mode !== 'loop') endEditDrag(drag)
  }

  function onMouseUp(e) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.mode === 'loop') {
      const lr = loopRegionRef.current
      if (lr) {
        const v = videoRef.current
        if (v) { seekBand(lr.start); if (v.paused) v.play() }
      }
      return
    }
    if (!drag.didMove && drag.mode !== 'create') {
      endEditDrag(drag)
      // Plain click on a block — try letter cycle first (no modifiers, mid zone,
      // détection layer visible so the user sees what changes).
      // Falls through to seek if no letter hit.
      if (!e.shiftKey && !e.altKey && !e.ctrlKey && drag.mode === 'shift' && detectionRef.current.layer) {
        const letterHit = hitTestLetter(e)
        if (letterHit) {
          cycleSignAt(letterHit.subIdx, letterHit.wordIdx, letterHit.charIdx)
          return
        }
      }
      const hit = hitTest(e)
      if (hit) seekBand(Math.max(0, hit.time))
    } else {
      endEditDrag(drag)
    }
  }

  function onDoubleClick(e) {
    const hit = hitTest(e); if (!hit) return
    if (hit.subIdx >= 0) startEdit(hit.subIdx)
  }

  function onContextMenu(e) {
    e.preventDefault()
    dragRef.current = null
    const hit = hitTest(e); if (!hit) return
    if (hit.subIdx >= 0) {
      // Viewport coordinates — the menu is position:fixed.
      setCtxMenu({ x: e.clientX, y: e.clientY, subIdx: hit.subIdx, time: hit.time })
    } else {
      setCtxMenu(null)
    }
  }

  function ctxAction(action, payload) {
    if (!ctxMenu) return
    const i = ctxMenu.subIdx
    const subs = subtitlesRef.current
    const sub = subs[i]; if (!sub) { setCtxMenu(null); return }

    if (action === 'edit') {
      startEdit(i)
    } else if (action === 'split') {
      const t = ctxMenu.time
      if (t > sub.start && t < sub.end) {
        const next = [...subs]
        next.splice(i, 1, { ...sub, end: t }, { ...sub, start: t, text: '' })
        changeSubtitles(next)
      }
    } else if (action === 'duplicate') {
      const dur = sub.end - sub.start
      const next = [...subs]
      next.splice(i + 1, 0, { ...sub, start: sub.end, end: sub.end + dur, text: sub.text })
      changeSubtitles(next)
    } else if (action === 'delete') {
      deleteReplica(i)
    } else if (action === 'character') {
      changeSubtitles(subs.map((s, idx) => idx === i ? { ...s, character: payload } : s))
    } else if (action === 'newCharacter') {
      const name = prompt('Nom du personnage :', sub.character || '')
      if (name != null) changeSubtitles(subs.map((s, idx) => idx === i ? { ...s, character: name.trim() } : s))
    } else if (action === 'seekStart') {
      seekBand(sub.start)
    } else if (action === 'seekEnd') {
      seekBand(sub.end)
    }
    setCtxMenu(null)
  }

  return {
    dragRef, hoverRef, hoverHint, ctxMenu, setCtxMenu, ctxAction,
    editingIdx, setEditingIdx, editText, setEditText, startEdit, commitEdit,
    canvasHandlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onDoubleClick, onContextMenu },
  }
}
