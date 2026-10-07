/**
 * Reel "Sua colinha para 2026" — the visual template of the chat reel: the
 * WhatsApp-style conversation (voter on the right, "Time 1313" on the left),
 * the printed-urna candidate cards and the two end screens (the filled colinha
 * slip and the official dobradinha santinho). Structure ports the reference
 * reel (dep_padrejoao) with the campaign kit language: official star badge,
 * Brexter display face, kit palette.
 *
 * Pure string builder: fonts and image data URIs are passed in by the builder
 * (`build-colinha-reel.mjs`); the page is rendered at 540×960 with
 * deviceScaleFactor 2 → physical 1080×1920 frames. `window.colinhaRender(t)`
 * sets the whole page state for a millisecond of the timeline (no CSS
 * animations — every frame is deterministic), and `window.colinhaReady` is the
 * promise the builder awaits before screenshotting.
 */

import { COLINHA_END, COLINHA_REEL } from './colinhaReel.mjs'

const BRAND = {
  red: '#e4102f',
  blue: '#184e92',
  ink: '#111111',
  chatGradient: 'linear-gradient(118deg,#5a67ec 0%,#8d37db 58%,#b52fb5 100%)',
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const BACK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'
const VIDEO_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6.5" width="12.5" height="11" rx="2.6"/><path d="M15 10.6l6-3.1v9l-6-3.1z"/></svg>'
const INFO_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><path d="M12 11v5.4"/><path d="M12 7.6h.01"/></svg>'
const CAMERA_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.6h2.6l1.5-2.4h7.8l1.5 2.4H20a1.6 1.6 0 0 1 1.6 1.6v8.2A1.6 1.6 0 0 1 20 19H4a1.6 1.6 0 0 1-1.6-1.6V9.2A1.6 1.6 0 0 1 4 7.6z"/><circle cx="12" cy="13.2" r="3.4"/></svg>'
const MIC_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0"/><path d="M12 17.8V21"/></svg>'
const IMAGE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2.6"/><circle cx="9" cy="10" r="1.7"/><path d="M4.2 17.5l4.6-4.4 3.4 3.2 3.2-3 4.4 4.2"/></svg>'
const PARTY_STAR =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.8l2.9 6.9 7 .6-5.3 4.6 1.6 6.9L12 17l-6.2 3.8 1.6-6.9L2.1 9.3l7-.6z"/></svg>'

/**
 * `@font-face` blocks as data URIs. Inter (the site's own grotesque) carries
 * the whole reel — chat, cards, labels; Brexter is the kit display face, kept
 * for the chat title; Arimo is the local metric-compatible Arial substitute
 * used only where the drawn row must match the site's own colinha render.
 */
export const colinhaFontCss = ({ brexterTtf, interWoff2, arimoWoff2 }) => `
@font-face{font-family:ReelBrexter;src:url(data:font/ttf;base64,${brexterTtf}) format('truetype');font-weight:400;font-style:normal}
@font-face{font-family:ReelInter;src:url(data:font/woff2;base64,${interWoff2}) format('woff2');font-weight:100 900;font-style:normal}
@font-face{font-family:ReelArimo;src:url(data:font/woff2;base64,${arimoWoff2}) format('woff2');font-weight:100 900;font-style:normal}
`

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:540px;height:960px;overflow:hidden;background:#fff}
body{font-family:ReelInter,Inter,system-ui,sans-serif;color:${BRAND.ink};-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.stage{position:relative;width:540px;height:960px;overflow:hidden;background:#fff;perspective:1600px}
.brexter{font-family:ReelBrexter,Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif;font-weight:400}
img{display:block}

/* ---------------- chat ---------------- */
.chat{position:absolute;inset:0;z-index:1;background:#fff;transform-origin:50% 50%}
.chat-top{position:absolute;z-index:6;inset:0 0 auto;height:52px;display:flex;align-items:center;gap:9px;padding:0 13px 0 10px;background:#fff;border-bottom:1px solid #eceef1}
.chat-top__back{width:18px;height:18px;color:#15181d}
.chat-top__avatar{width:35px;height:35px;flex:none;overflow:hidden;border-radius:50%;background:#fff;box-shadow:0 0 0 1px #e7eaee}
.chat-top__avatar img{width:100%;height:100%;object-fit:cover}
.chat-top__name{font-size:24px;line-height:1;letter-spacing:.005em;white-space:nowrap}
.chat-top__icons{display:flex;align-items:center;gap:16px;margin-left:auto;color:#15181d}
.chat-top__icons svg{width:22px;height:22px}
.messages{position:absolute;z-index:4;top:52px;bottom:53px;left:0;right:0;padding:0 12px 14px;overflow:hidden;background:#fff}
.day{margin:13px 0 11px;text-align:center;font-size:13px;font-weight:700;letter-spacing:.19em;color:#8b9099;text-transform:uppercase}
.row{display:flex;margin:0 0 8px}
.row--right{flex-direction:column;align-items:flex-end}
.row--left{flex-direction:column;align-items:flex-start}
.row--card{margin-bottom:11px}
.bubble{max-width:440px;padding:11px 15px;border-radius:18px;font-size:20px;line-height:1.34;letter-spacing:.001em}
.bubble--assistant{background:#f0f1f3;color:#141414;border-bottom-left-radius:5px}
.bubble--voter{background:${BRAND.chatGradient};color:#fff;border-bottom-right-radius:5px}
.bubble--number{background:${BRAND.chatGradient};color:#fff;border-bottom-right-radius:5px;font-weight:700;letter-spacing:.02em}
.seen{display:none;margin:2px 5px 0 0;font-size:15px;color:#9aa0a8}
.typing{display:flex;align-items:center;gap:3.8px;padding:12px 13px}
.typing i{width:5.4px;height:5.4px;border-radius:50%;background:#b9bec6;display:block}
.bubble--card{background:#f0f1f3;padding:7px 7px 8px;border-radius:16px;border-bottom-left-radius:5px;max-width:none}
.anotei-bar{height:3px;margin:-7px -7px 7px;border-radius:16px 16px 0 0;background:#dfe3e9;overflow:hidden}
.anotei-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,${BRAND.red},${BRAND.blue})}
.anotei-label{margin:0 2px 8px;font-size:19px;color:#141414}

/* candidate card (urna language) */
.card{width:420px;padding:11px;display:grid;grid-template-columns:168px minmax(0,1fr);grid-template-rows:auto auto;column-gap:13px;row-gap:9px;background:#fff;border-radius:13px;box-shadow:0 1px 2px rgb(16 24 40 / 10%)}
.card__photo{position:relative;grid-column:1;grid-row:1;width:168px;height:208px;overflow:hidden;border-radius:9px;background:linear-gradient(168deg,#fdfaf4 0%,#f2e9da 100%);box-shadow:inset 0 0 0 1px rgb(16 24 40 / 5%)}
.card__photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 0}
.card__info{grid-column:2;grid-row:1;display:flex;flex-direction:column;min-width:0;padding:3px 1px 0 0}
.card__office{font-size:14px;font-weight:700;letter-spacing:.11em;color:#31363d;white-space:nowrap}
.card__party{display:flex;align-items:center;gap:7px;margin-top:7px;font-size:28px;font-weight:900;line-height:1;letter-spacing:-.01em;color:#0f0f0f}
.card__party svg{width:22px;height:22px;color:${BRAND.red}}
.card__state{margin-top:9px;font-size:12.5px;font-weight:700;letter-spacing:.145em;color:#767d86}
.card__spacer{flex:1 1 auto;min-height:8px}
.card__urna{font-size:12.5px;font-weight:700;letter-spacing:.145em;color:#767d86;margin-bottom:5px}
.card__digits{display:flex;gap:5px}
.card__digit{display:grid;place-items:center;width:43px;height:53px;border-radius:8px;background:#1c1c1c;color:#fff;font-size:32px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
/* "Sem estadual": the very same card shell as the candidates — photo window on
   the left (the official Lula mark on a light neutral background) and the info
   column on the right, with the instruction to pick a state deputy from Lula's
   team where the urna digits sit. No party is named. */
.card__photo--mark{background:linear-gradient(160deg,#fdfbf6 0%,#efe9dd 100%);display:flex;align-items:center;justify-content:center;padding:0}
.card__photo--mark img{position:static;width:96%;height:auto;object-fit:contain}
.card__lead{margin-top:6px;font-size:26px;font-weight:900;line-height:1;letter-spacing:-.012em;color:#0f0f0f}
.card__name{grid-column:1/-1;grid-row:2;font-size:34px;font-weight:900;line-height:1;letter-spacing:-.012em;color:#0f0f0f;padding:3px 1px 1px}

/* composer */
.composer{position:absolute;z-index:6;inset:auto 0 0;height:53px;display:flex;align-items:center;gap:9px;padding:8px 11px 9px;background:#fff}
.composer__cam{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:${BRAND.chatGradient};color:#fff}
.composer__cam svg{width:17px;height:17px}
.composer__pill{flex:1 1 auto;display:flex;align-items:center;gap:12px;height:35px;padding:0 13px;border:1px solid #e7e9ed;border-radius:18px;color:#9aa0a8}
.composer__pill span{font-size:16px}
.composer__icons{display:flex;align-items:center;gap:14px;margin-left:auto;color:#15181d}
.composer__icons svg{width:19px;height:19px}

/* ---------------- end screen: the colinha assembles itself ---------------- */
.screen{position:absolute;inset:0;z-index:2;background:#fff;transform-origin:50% 50%;backface-visibility:hidden;visibility:hidden}
.screen--colinha{z-index:3}
.colinha-art{position:absolute;inset:0;width:540px;height:960px;object-fit:cover}
/* The official group photo (the "Time de você" family shot) fills the art's
   baked photo band; the wave clip keeps the art's crest in front of it. Each
   candidate's patch of the blurred copy fades out at their reveal. */
.figures{position:absolute;inset:0;clip-path:var(--wave)}
.group{position:absolute;inset:0;background-image:var(--group);background-size:540px 720px;background-position:0 -60px;background-repeat:no-repeat}
.group--blur{background-image:var(--group-blur);opacity:1;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat}
/* The art's own red band content is covered, but its coloured crest stays: the
   cover is clipped by the band's own top curve. */
.band-cover{position:absolute;inset:0;clip-path:var(--band)}
.band-logo{position:absolute;opacity:0}
.band-logo img{display:block;width:100%;height:auto}
/* The slip's own title (with its sky), feathered; it appears last. */
.title-patch{position:absolute;left:90px;top:5px;width:360px;height:135px;opacity:0}
.title-patch img{display:block;width:100%;height:100%}
.row-mask{position:absolute;background:#fff}
.colinha-row{position:absolute;inset:0;opacity:0}
.colinha-mask{position:absolute;left:132.3px;top:536.64px;width:309.96px;height:27.84px;background:#fff}
.colinha-copy{position:absolute;left:145.26px;top:542.02px;width:285.12px;height:24px;display:flex;align-items:baseline;justify-content:space-between;gap:8.1px}
.colinha-copy__office{font-family:ReelArimo,Arial,Helvetica,sans-serif;font-size:13.45px;font-weight:400;line-height:1;color:#202020;white-space:nowrap;flex:none}
.colinha-copy__name{font-family:ReelArimo,Arial,Helvetica,sans-serif;font-size:18.36px;font-weight:900;line-height:1;color:${BRAND.red};letter-spacing:-.04em;white-space:nowrap;text-align:right}
.colinha-digits{position:absolute;left:139.86px;top:560.64px;display:flex;gap:4.38px}
.colinha-digit{display:grid;place-items:center;width:32.94px;height:41.76px;font-family:ReelArimo,Arial,Helvetica,sans-serif;font-size:22.95px;font-weight:900;line-height:1;color:#171717}

/* intro fade (white cover over the very first frames) */
.fade{position:absolute;z-index:9;inset:0;background:#fff;pointer-events:none}
`

const RENDER_JS = `
;(() => {
  const CFG = window.__colinhaConfig
  const clamp01 = (v) => Math.min(1, Math.max(0, v))
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3)
  const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
  const beats = CFG.beats
  const nodeById = new Map()
  for (const el of document.querySelectorAll('[data-beat]')) nodeById.set(el.dataset.beat, el)
  const messages = document.getElementById('messages')
  const chat = document.getElementById('chat')
  const screens = { colinha: document.getElementById('screen-colinha') }
  const fade = document.getElementById('fade')
  const ends = beats.filter((beat) => beat.kind === 'end')
  const titlePatch = document.getElementById('title-patch')
  const figures = new Map()
  const logos = new Map()
  const rowMasks = new Map()
  for (const el of document.querySelectorAll('[data-figure]')) figures.set(el.dataset.figure, el)
  for (const el of document.querySelectorAll('[data-logo]')) logos.set(el.dataset.logo, el)
  for (const el of document.querySelectorAll('[data-row]')) rowMasks.set(el.dataset.row, el)
  const drawnRow = document.getElementById('colinha-drawn')
  let scrollTargets = []
  let prepared = false

  const prepare = () => {
    for (const el of nodeById.values()) el.style.display = ''
    for (const el of document.querySelectorAll('.seen')) el.style.display = 'block'
    const max = Math.max(0, messages.scrollHeight - messages.clientHeight)
    scrollTargets = beats.map((beat) => {
      const el = nodeById.get(beat.id)
      if (!el) return max
      const bottom = el.offsetTop + el.offsetHeight + 12
      return Math.min(max, Math.max(0, bottom - messages.clientHeight))
    })
    for (const el of nodeById.values()) el.style.display = ''
    for (const el of document.querySelectorAll('.seen')) el.style.display = ''
    fitColinhaName()
    fitCardNames()
    prepared = true
  }

  /** Long ballot names shrink on the card's one name line instead of wrapping. */
  function fitCardNames() {
    const max = 420 - 22
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    for (const el of document.querySelectorAll('.card__name')) {
      el.style.fontSize = ''
      el.style.whiteSpace = ''
      const size = Number.parseFloat(getComputedStyle(el).fontSize)
      ctx.font =
        getComputedStyle(el).fontWeight + ' ' + size + 'px ReelInter, Inter, system-ui, sans-serif'
      const width = ctx.measureText(el.textContent ?? '').width
      if (width > max && width > 0) {
        el.style.fontSize = Math.max(20, Math.floor((size * max) / width)) + 'px'
      }
      el.style.whiteSpace = 'nowrap'
    }
  }

  function fitColinhaName() {
    const name = document.querySelector('.colinha-copy__name')
    const office = document.querySelector('.colinha-copy__office')
    if (!name || !office) return
    const band = 285.12
    const gap = 8.1
    const max = band - office.getBoundingClientRect().width - gap
    const width = name.getBoundingClientRect().width
    if (width > max && width > 0) {
      name.style.fontSize = Math.floor((18.36 * max) / width) + 'px'
    }
  }

  const renderTyping = (el, t, enter) => {
    const dots = el.querySelectorAll('i')
    dots.forEach((dot, index) => {
      const phase = ((t - enter) / 420) * Math.PI * 2 - index * 0.7
      const lift = Math.max(0, Math.sin(phase)) * 2.6
      dot.style.transform = 'translateY(' + (-lift).toFixed(2) + 'px)'
      dot.style.opacity = (0.55 + 0.45 * Math.max(0, Math.sin(phase))).toFixed(3)
    })
  }

  window.colinhaReset = () => {
    prepared = false
    for (const el of nodeById.values()) el.style.display = ''
  }

  window.colinhaRender = (t) => {
    if (!prepared) prepare()
    const fadeP = clamp01(t / 180)
    fade.style.opacity = String(1 - fadeP)

    let active = -1
    for (let i = 0; i < beats.length; i++) {
      if (t >= beats[i].atMs) active = i
      else break
    }

    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i]
      if (beat.kind === 'end') continue
      const el = nodeById.get(beat.id)
      if (!el) continue
      const visible = t >= beat.atMs && (beat.hideAtMs === undefined || t < beat.hideAtMs)
      if (!visible) { el.style.display = 'none'; continue }
      el.style.display = ''
      const p = easeOutCubic(clamp01((t - beat.atMs) / beat.enterMs))
      if (beat.kind === 'card') {
        el.style.opacity = String(p)
        el.style.transform = 'translateY(' + ((1 - p) * 15).toFixed(2) + 'px) scale(' + (0.965 + 0.035 * p).toFixed(4) + ')'
      } else if (beat.kind === 'typing') {
        renderTyping(el, t, beat.atMs)
      } else {
        el.style.opacity = String(p)
        el.style.transform = 'translateY(' + ((1 - p) * 9).toFixed(2) + 'px)'
      }
      if (beat.seen) {
        const seen = el.querySelector('.seen')
        if (seen) {
          const sp = easeOutCubic(clamp01((t - beat.atMs - 720) / 260))
          seen.style.display = sp > 0 ? 'block' : 'none'
          seen.style.opacity = String(sp)
        }
      }
      if (beat.kind === 'card') {
        const bar = el.querySelector('.anotei-bar i')
        if (bar) {
          const from = (beat.cardProgressFrom ?? 0) * 100
          const to = beat.cardProgress * 100
          bar.style.width = (from + (to - from) * easeOutCubic(clamp01((t - beat.atMs) / 620))).toFixed(2) + '%'
        }
      }
    }

    if (active >= 0) {
      const from = active > 0 ? scrollTargets[active - 1] : 0
      const to = scrollTargets[active]
      const p = easeInOutCubic(clamp01((t - beats[active].atMs) / 460))
      messages.scrollTop = from + (to - from) * p
    } else {
      messages.scrollTop = 0
    }

    if (ends.length > 0) {
      const flip = CFG.flipMs
      const first = ends[0]
      const second = ends[1]
      const out1 = clamp01((t - first.atMs) / flip)
      if (t < first.atMs) {
        chat.style.visibility = 'visible'
        chat.style.transform = 'rotateY(0deg)'
      } else if (out1 < 1) {
        chat.style.visibility = 'visible'
        chat.style.transform = 'rotateY(' + (-90 * easeInOutCubic(out1)).toFixed(3) + 'deg)'
      } else {
        chat.style.visibility = 'hidden'
      }
      const in1 = clamp01((t - first.atMs - flip) / flip)
      if (in1 > 0) {
        screens.colinha.style.visibility = 'visible'
        const out2 = second ? clamp01((t - second.atMs) / flip) : 0
        const rot = second && t >= second.atMs ? -90 * easeInOutCubic(out2) : 90 * (1 - easeInOutCubic(in1))
        screens.colinha.style.transform = 'rotateY(' + rot.toFixed(3) + 'deg)'
      }
    }

    for (const reveal of CFG.reveals) {
      const p = easeOutCubic(clamp01((t - reveal.atMs) / reveal.durationMs))
      const figure = figures.get(reveal.candidateId)
      if (figure) figure.style.opacity = String(1 - p)
      const logo = logos.get(reveal.candidateId)
      if (logo) {
        logo.style.opacity = String(p)
        logo.style.transform = 'scale(' + (0.82 + 0.18 * p).toFixed(4) + ')'
      }
      const mask = rowMasks.get(reveal.candidateId)
      if (mask) mask.style.opacity = String(1 - p)
      if (drawnRow && reveal.candidateId === CFG.drawnRow) drawnRow.style.opacity = String(p)
    }

    if (CFG.brandAtMs !== undefined) {
      const brandP = easeInOutCubic(clamp01((t - CFG.brandAtMs) / 900))
      if (titlePatch) titlePatch.style.opacity = String(brandP)
    }
  }

  window.colinhaReady = (async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)))
    prepare()
    window.colinhaRender(0)
    return true
  })()
})()
`

/**
 * @param {{ beats: Array<{ id: string, kind: string, atMs: number, enterMs: number, text?: string, candidateId?: string, screen?: string, seen?: boolean, hideAtMs?: number, cardProgress?: number }>, candidates: Array<{ id: string, office: string, name: string, number: string, photo: string, figure: Record<string, number>, logo: Record<string, number>, row: Record<string, number> }>, reveals: Array<{ candidateId: string, atMs: number, durationMs: number }>, brandAtMs: number, drawnRow: string, totalMs: number, flipMs: number, fontCss: string, assets: Record<string, string>, cardFinale?: boolean }} options
 */
export const colinhaReelHtml = ({
  beats,
  candidates,
  reveals,
  brandAtMs,
  drawnRow,
  totalMs,
  flipMs,
  fontCss,
  assets,
  cardFinale = false,
}) => {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const estadual = candidates[1]
  const cardCount = candidates.length

  const rows = beats
    .filter((beat) => beat.kind !== 'end')
    .map((beat) => {
      if (beat.kind === 'typing') {
        return `<div class="row row--left" data-beat="${beat.id}"><div class="bubble bubble--assistant typing"><i></i><i></i><i></i></div></div>`
      }
      if (beat.kind === 'card') {
        const candidate = candidateById.get(beat.candidateId)
        if (candidate.generic) {
          return `<div class="row row--left row--card" data-beat="${beat.id}">
  <div class="bubble bubble--card">
    <div class="anotei-bar"><i style="width:${(((candidates.findIndex((c) => c.id === beat.candidateId) + 1) / cardCount) * 100).toFixed(2)}%"></i></div>
    <div class="anotei-label">anotei:</div>
    <article class="card">
      <div class="card__photo card__photo--mark"><img src="${assets.lulaMark}" alt="Marca oficial de Lula"></div>
      <div class="card__info">
        <div class="card__office">${escapeHtml(candidate.office)}</div>
        <div class="card__lead">${escapeHtml(candidate.name)}</div>
        <div class="card__state">${escapeHtml(COLINHA_REEL.cardState)}</div>
      </div>
      <div class="card__name">ESCOLHA O SEU</div>
    </article>
  </div>
</div>`
        }
        const progress =
          ((candidates.findIndex((c) => c.id === beat.candidateId) + 1) / cardCount) * 100
        const digits = [...candidate.number]
          .map((digit) => `<span class="card__digit">${escapeHtml(digit)}</span>`)
          .join('')
        const photoStyle = candidate.photoZoom
          ? ` style="transform:translateY(${candidate.photoShiftY ?? 0}%) scale(${candidate.photoZoom});transform-origin:${candidate.photoOrigin ?? '50% 0%'}"`
          : ''
        return `<div class="row row--left row--card" data-beat="${beat.id}">
  <div class="bubble bubble--card">
    <div class="anotei-bar"><i style="width:${progress.toFixed(2)}%"></i></div>
    <div class="anotei-label">anotei:</div>
    <article class="card">
      <div class="card__photo"><img src="${assets[`photo:${candidate.id}`]}" alt="${escapeHtml(candidate.name)}"${photoStyle}></div>
      <div class="card__info">
        <div class="card__office">${escapeHtml(candidate.office)}</div>
        <div class="card__party">${escapeHtml(COLINHA_REEL.cardParty)}${PARTY_STAR}</div>
        <div class="card__state">${escapeHtml(COLINHA_REEL.cardState)}</div>
        <div class="card__spacer"></div>
        <div class="card__urna">NA URNA</div>
        <div class="card__digits">${digits}</div>
      </div>
      <div class="card__name">${escapeHtml(candidate.name)}</div>
    </article>
  </div>
</div>`
      }
      const seen = beat.seen ? '<div class="seen">Visto</div>' : ''
      const variant = beat.kind === 'number' ? 'number' : beat.kind
      return `<div class="row ${beat.kind === 'voter' || beat.kind === 'number' ? 'row--right' : 'row--left'}" data-beat="${beat.id}">
  <div class="bubble bubble--${variant}">${escapeHtml(beat.text)}</div>
  ${seen}
</div>`
    })
    .join('\n')

  const colinhaDigits = [...estadual.number]
    .map((digit) => `<span class="colinha-digit">${escapeHtml(digit)}</span>`)
    .join('')

  const figuresMarkup = candidates
    .map((candidate) => {
      const { cx, cy, rx, ry } = candidate.figure
      const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, #000 52%, transparent 100%)`
      return `<div class="group group--blur" data-figure="${candidate.id}" style="mask-image:${mask};-webkit-mask-image:${mask}"></div>`
    })
    .join('\n      ')
  const logosMarkup = candidates
    .map(
      (candidate) =>
        `<div class="band-logo" data-logo="${candidate.id}" style="left:${candidate.logo.left}px;top:${candidate.logo.top}px;width:${candidate.logo.width}px"><img src="${assets[`logo:${candidate.id}`]}" alt=""></div>`,
    )
    .join('\n    ')
  const rowMasksMarkup = candidates
    .map(
      (candidate) =>
        `<div class="row-mask" data-row="${candidate.id}" style="left:${COLINHA_END.rowMask.left}px;top:${candidate.row.top}px;width:${COLINHA_END.rowMask.width}px;height:${candidate.row.height}px"></div>`,
    )
    .join('\n    ')

  let cardIndex = -1
  const config = {
    totalMs,
    flipMs,
    reveals: reveals.map((reveal) => ({ ...reveal })),
    brandAtMs,
    drawnRow,
    beats: beats.map((beat) => {
      const cardProgress = beat.kind === 'card' ? (++cardIndex + 1) / cardCount : undefined
      return {
        id: beat.id,
        kind: beat.kind,
        atMs: beat.atMs,
        enterMs: beat.enterMs,
        ...(beat.candidateId ? { candidateId: beat.candidateId } : {}),
        ...(beat.screen ? { screen: beat.screen } : {}),
        ...(beat.seen ? { seen: true } : {}),
        ...(beat.hideAtMs !== undefined ? { hideAtMs: beat.hideAtMs } : {}),
        ...(cardProgress !== undefined
          ? { cardProgress, cardProgressFrom: Math.max(0, cardProgress - 1 / cardCount) }
          : {}),
      }
    }),
  }

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(COLINHA_REEL.title)}</title>
<style>${fontCss}${BASE_CSS}</style>
</head>
<body>
<div class="stage" style="--wave:${assets.waveClip};--band:${assets.bandClip};--group:url(&quot;${assets.group}&quot;);--group-blur:url(&quot;${assets.groupBlur}&quot;)">
  <div class="chat" id="chat">
    <header class="chat-top">
      <span class="chat-top__back">${BACK_ICON}</span>
      <span class="chat-top__avatar"><img src="${assets.avatar}" alt="Jorge Solla 1313"></span>
      <span class="chat-top__name brexter">${escapeHtml(COLINHA_REEL.chatTitle)}</span>
      <span class="chat-top__icons">${VIDEO_ICON}${INFO_ICON}</span>
    </header>
    <div class="messages" id="messages">
      <div class="day">HOJE, ${escapeHtml(COLINHA_REEL.chatHour)}</div>
${rows}
    </div>
    <footer class="composer">
      <span class="composer__cam">${CAMERA_ICON}</span>
      <span class="composer__pill"><span>Mensagem...</span><span class="composer__icons">${MIC_ICON}${IMAGE_ICON}</span></span>
    </footer>
  </div>
  <section class="screen screen--colinha" id="screen-colinha">
    ${
      cardFinale
        ? `<img class="colinha-art" src="${assets.siteCard}" alt="Colinha personalizada gerada pelo site, com o time completo">`
        : `<img class="colinha-art" src="${assets.colinhaArt}" alt="Colinha oficial de votação com o time completo">
    <div class="figures">
      <div class="group group--sharp"></div>
      ${figuresMarkup}
    </div>
    <div class="band-cover" style="background:${COLINHA_END.band.color}"></div>
    ${logosMarkup}
    <div class="title-patch" id="title-patch"><img src="${assets.titlePatch}" alt="Mais Saúde, Mais Futuro"></div>
    ${rowMasksMarkup}
    <div class="colinha-row" id="colinha-drawn">
      <div class="colinha-mask"></div>
      <div class="colinha-copy">
        <span class="colinha-copy__office">${escapeHtml(estadual.office)}</span>
        <span class="colinha-copy__name">${escapeHtml(estadual.name)}</span>
      </div>
      <div class="colinha-digits">${colinhaDigits}</div>
    </div>`
    }
  </section>
  <div class="fade" id="fade"></div>
</div>
<script>window.__colinhaConfig=${JSON.stringify(config)};${RENDER_JS}</script>
</body>
</html>
`
}
