// Landing page — port of design/design_handoff_redesign_v2/reference/home.html
// (flow tabs + demo bande rythmo canvas). A signed-in visitor goes straight to
// the atelier.
import { detectOs } from './os'

async function redirectIfSignedIn() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (!res.ok) return
    const { user } = await res.json()
    if (user) window.location.replace('/app/')
  } catch (e) {
    console.warn('Accueil : session non vérifiée (serveur injoignable ?)', e)
  }
}

function initFlowTabs() {
  const steps = [...document.querySelectorAll('.step')]
  const img = document.getElementById('flowImg')
  for (const step of steps) {
    step.addEventListener('click', () => {
      for (const s of steps) s.setAttribute('aria-selected', String(s === step))
      img.src = step.dataset.img
      img.alt = step.dataset.alt
      img.style.animation = 'none'
      void img.offsetHeight
      img.style.animation = ''
    })
  }
}

// The visitor's OS card goes first, outlined in the accent colour.
function initDownloads() {
  const os = detectOs()
  const card = os && document.querySelector(`.dl-card[data-os="${os}"]`)
  if (!card) return
  card.classList.add('dl-card--you')
  const badge = document.createElement('span')
  badge.className = 'dl-you'
  badge.textContent = 'Votre système'
  card.querySelector('.dl-os').append(badge)
  card.parentElement.prepend(card)
}

const LINES = [
  { c: 0, s: 1.0, e: 2.6, t: 'Attends, quelque chose ne va pas.' }, { c: 1, s: 3.0, e: 4.2, t: 'De quoi tu parles ?' },
  { c: 0, s: 4.6, e: 6.8, t: 'Regarde la porte. Elle était fermée.' }, { c: 2, s: 7.2, e: 8.0, t: '(souffle)' },
  { c: 1, s: 8.4, e: 11.0, t: 'On devrait appeler quelqu’un, non ?' }, { c: 0, s: 11.4, e: 13.2, t: 'Pas le temps. Viens.' },
  { c: 2, s: 13.6, e: 15.4, t: 'Et si c’était un piège ?' }, { c: 1, s: 15.8, e: 17.2, t: 'C’est forcément un piège.' },
]
const NAMES = ['LÉA', 'MARC', 'SARAH']
const COLS = ['#F5C518', '#5AA9F0', '#F06AA0']
const LOOP = 18.6
const PX = 150
const FPS = 24

const pad = n => String(n).padStart(2, '0')
const tc = s => `00:00:${pad(Math.floor(s))}:${pad(Math.floor((s % 1) * FPS))}`

function initBand() {
  const cv = document.getElementById('band')
  const tcEl = document.getElementById('tc')
  const ctx = cv.getContext('2d')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  let t = 3.6
  let last = performance.now()

  function paint() {
    const dpr = devicePixelRatio || 1
    const W = cv.offsetWidth
    const H = cv.offsetHeight
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const ruler = 22
    const th = (H - ruler) / 3
    const cx = Math.round(W * 0.3)
    for (let i = 0; i < 3; i++) {
      const y = i * th
      ctx.fillStyle = i % 2 ? '#101013' : '#0e0e11'; ctx.fillRect(0, y, W, th)
      ctx.fillStyle = COLS[i]; ctx.fillRect(0, y + 8, 3, 16)
      ctx.font = '700 10px "JetBrains Mono"'; ctx.textBaseline = 'top'; ctx.fillText(NAMES[i], 10, y + 10)
      ctx.strokeStyle = '#1d1d23'; ctx.beginPath(); ctx.moveTo(0, y + th + 0.5); ctx.lineTo(W, y + th + 0.5); ctx.stroke()
    }
    const t0 = t - cx / PX
    const t1 = t + (W - cx) / PX
    for (let s = Math.floor(t0 * 2) / 2; s <= t1; s += 0.5) {
      const x = cx + (s - t) * PX
      const major = Math.abs(s % 1) < 0.01
      ctx.strokeStyle = major ? '#2a2a32' : '#1c1c22'
      ctx.beginPath(); ctx.moveTo(x + 0.5, H - ruler); ctx.lineTo(x + 0.5, H - ruler + (major ? 9 : 5)); ctx.stroke()
      if (major) {
        ctx.fillStyle = '#565660'; ctx.font = '10px "JetBrains Mono"'; ctx.textBaseline = 'bottom'
        ctx.fillText(tc(((s % LOOP) + LOOP) % LOOP), x + 4, H - 3)
      }
    }
    for (const k of [-1, 0, 1]) {
      for (const L of LINES) {
        const s = L.s + k * LOOP
        const e = L.e + k * LOOP
        const x0 = cx + (s - t) * PX
        const x1 = cx + (e - t) * PX
        if (x1 < 0 || x0 > W) continue
        const y = L.c * th
        const col = COLS[L.c]
        const on = t >= s && t <= e
        ctx.fillStyle = col + (on ? '26' : '14'); ctx.fillRect(x0, y + 6, x1 - x0, th - 12)
        ctx.fillStyle = col; ctx.fillRect(x0, y + 6, 2, th - 12)
        ctx.font = `700 ${Math.round(th * 0.5)}px Caveat`; ctx.textBaseline = 'middle'
        const w = ctx.measureText(L.t).width
        const sx = Math.min(1.6, (x1 - x0 - 16) / w)
        ctx.save(); ctx.translate(x0 + 8, y + th / 2 + 2); ctx.scale(sx, 1)
        ctx.fillStyle = on ? '#ffffff' : 'rgba(236,236,239,.42)'; ctx.fillText(L.t, 0, 0); ctx.restore()
      }
    }
    ctx.fillStyle = 'rgba(11,11,13,.5)'; ctx.fillRect(0, 0, cx - 1, H - ruler)
    ctx.fillStyle = '#F5C518'; ctx.fillRect(cx - 1, 0, 2, H - ruler)
    ctx.beginPath(); ctx.moveTo(cx - 7, 0); ctx.lineTo(cx + 7, 0); ctx.lineTo(cx, 9); ctx.closePath(); ctx.fill()
    tcEl.textContent = tc(t)
  }

  function frame(now) {
    t = (t + Math.min(0.05, (now - last) / 1000)) % LOOP
    last = now
    paint()
    requestAnimationFrame(frame)
  }

  const start = () => {
    if (reduce) {
      paint()
      window.addEventListener('resize', paint)
    } else {
      last = performance.now()
      requestAnimationFrame(frame)
    }
  }
  ;(document.fonts ? document.fonts.ready : Promise.resolve()).then(start)
}

redirectIfSignedIn()
initFlowTabs()
initDownloads()
initBand()
