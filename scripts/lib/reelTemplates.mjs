/**
 * C196 — the visual templates of the reel, ported class-by-class from the
 * approved artifact `docs/plans/reels-tutoriais-ui-design.html` (official
 * campaign kit: palette, marks, star, Brexter display face, caption box, step
 * badge, safe area, cover). Every template is a pure string builder rendered at
 * 360×640 with deviceScaleFactor 3, so the physical asset is 1080×1920.
 *
 * Pure module: the caller passes the font CSS and the kit asset data URIs.
 */

import { REEL } from './reelTimeline.mjs'

/** Official kit palette (extracted from the campaign assets). */
const BRAND = {
  red: '#e4102f',
  blue: '#184e92',
  yellow: '#ffeb00',
  cream: '#fff8f2',
}

/** Design §Safe zone: the side inset and the caption center in CSS pixels. */
const SIDE_INSET_PX = REEL.safeArea.sidePx / REEL.deviceScale
const CAPTION_CENTER_PX = REEL.caption.centerYPx / REEL.deviceScale

const BRAND_GRADIENT = `linear-gradient(160deg, ${BRAND.red} 0%, ${BRAND.red} 62%, ${BRAND.blue} 145%)`

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:${REEL.viewport.width}px;height:${REEL.viewport.height}px;overflow:hidden;background:transparent}
body{font-family:ReelInter,Inter,ui-sans-serif,system-ui,sans-serif;color:#000;-webkit-font-smoothing:antialiased}
.frame{position:relative;width:${REEL.viewport.width}px;height:${REEL.viewport.height}px;overflow:hidden}
.brexter{font-family:ReelBrexter,Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif;font-weight:700;text-transform:uppercase}
.accent{color:${BRAND.yellow}}
.star-disc{position:absolute;border-radius:50%;overflow:hidden;background:#fff;pointer-events:none}
.star-disc img{position:absolute;width:186.92%;height:auto;left:-47.38%;top:-12.8%}
.brand-plate{position:absolute;left:214px;top:22px;display:flex;align-items:center;justify-content:center;width:124px;height:68px;border-radius:8px;background:rgb(255 255 255 / 92%);box-shadow:0 4px 14px rgb(0 0 0 / 18%)}
.brand-plate img{display:block;width:112px;height:auto}
.badge{position:absolute;left:${SIDE_INSET_PX}px;top:15%;display:flex;align-items:center;gap:7.2px;border-radius:999px;background:${BRAND.yellow};padding:7.2px 14.4px;font-size:11.6px;font-weight:900;color:#000;box-shadow:0 6px 18px rgb(0 0 0 / 28%)}
.badge b{display:grid;place-items:center;width:21.6px;height:21.6px;border-radius:999px;background:#000;color:#fff;font-size:10px}
.caption-box{position:absolute;left:50%;top:${CAPTION_CENTER_PX}px;transform:translate(-50%,-50%);width:max-content;max-width:${REEL.caption.maxWidthPx / REEL.deviceScale}px;border-radius:14.4px;background:rgb(0 0 0 / 88%);padding:12.6px 18px;text-align:center;color:#fff;font-size:14.8px;font-weight:700;line-height:1.18;box-shadow:0 10px 30px rgb(0 0 0 / 25%)}
@keyframes reel-beat{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
@keyframes reel-fade{0%{opacity:0}100%{opacity:1}}
@keyframes reel-star{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
@keyframes reel-rise{0%{opacity:0;transform:translateY(22px)}100%{opacity:1;transform:translateY(0)}}
body.play .beat-1{animation:reel-beat .55s cubic-bezier(.2,.7,.2,1) both}
body.play .beat-2{animation:reel-beat .55s cubic-bezier(.2,.7,.2,1) .28s both}
body.play .fade-1{animation:reel-fade .45s ease-out .1s both}
body.play .fade-2{animation:reel-fade .45s ease-out .65s both}
body.play .star-1{animation:reel-star .7s ease-out .15s both}
body.play .rise-1{animation:reel-rise .5s cubic-bezier(.2,.7,.2,1) .35s both}
`

const htmlDocument = ({ title, fontCss, body }) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
${fontCss ? `<style>${fontCss}</style>` : ''}
<style>${BASE_CSS}</style>
</head>
<body>${body}</body>
</html>
`

/** Scene 01 — hook (recorded): official red field, star, Brexter in two beats. */
export const hookHtml = ({ fontCss, assets }) =>
  htmlDocument({
    title: 'Reel — hook',
    fontCss,
    body: `
<div class="frame" style="background:${BRAND_GRADIENT}">
  <div class="star-disc star-1" style="left:250px;top:54px;width:88px;height:88px"><img src="${assets.star}" alt="" /></div>
  <div style="position:absolute;left:6%;right:6%;top:14%">
    <span class="fade-1" style="display:inline-flex;border-radius:999px;background:${BRAND.yellow};color:#000;padding:6.1px 14.4px;font-size:12.6px;font-weight:900">FAÇA PARTE</span>
    <h1 class="brexter" style="font-size:34.2px;line-height:30.78px;letter-spacing:-1.71px;color:#fff;margin-top:28.8px;max-width:100%">
      <span class="beat-1" style="display:block;white-space:nowrap">Seu apoio</span>
      <span class="beat-1" style="display:block;white-space:nowrap">vira card</span>
      <span class="beat-2 accent" style="display:block;white-space:nowrap">em segundos.</span>
    </h1>
  </div>
  <p class="fade-2" style="position:absolute;left:22px;top:356px;width:170px;font-size:13.7px;font-weight:600;line-height:1.2;color:#fff">Veja como criar o seu pelo celular.</p>
  <img class="fade-2" style="position:absolute;left:206px;top:322px;width:132px;height:auto" src="${assets.completeNegative}" alt="Jorge Solla 1313 — Mais Saúde, Mais Futuro" />
</div>`,
  })

/** Scene last — CTA (recorded): official red header, white card with "link na bio". */
export const ctaHtml = ({ fontCss, assets }) =>
  htmlDocument({
    title: 'Reel — CTA',
    fontCss,
    body: `
<div class="frame" style="background:${BRAND.cream}">
  <div style="position:absolute;left:0;right:0;top:0;height:47%;background:${BRAND.red}"></div>
  <div class="star-disc star-1" style="left:20px;top:48px;width:72px;height:72px"><img src="${assets.star}" alt="" /></div>
  <div style="position:absolute;left:7%;right:7%;top:14%;text-align:center;color:#fff">
    <p class="fade-1" style="font-size:10.8px;font-weight:900;letter-spacing:.12em;color:${BRAND.yellow};text-transform:uppercase">Seu card, sua voz</p>
    <h3 class="brexter beat-1" style="font-size:41.4px;line-height:37.26px;margin-top:14.4px;max-width:100%">Agora é<br />com você.</h3>
  </div>
  <div class="rise-1" style="position:absolute;left:7%;right:7%;top:51%;background:#fff;border-radius:21.6px;padding:25.2px;text-align:center;box-shadow:0 14px 40px rgb(71 19 14 / 14%);border:1px solid rgb(0 0 0 / 10%)">
    <div style="display:grid;place-items:center;width:50.4px;height:50.4px;margin:0 auto;border-radius:999px;background:${BRAND.yellow}">
      <svg width="25.2" height="25.2" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.3"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>
    </div>
    <p style="margin-top:12.6px;font-size:14.4px;font-weight:600;color:#000">Acesse o site pelo</p>
    <p class="brexter" style="font-size:28.8px;line-height:1;color:${BRAND.red};margin-top:2.5px">link na bio</p>
    <p style="margin-top:10px;font-size:10.8px;line-height:1.35;color:#6c615e">Escolha seu modelo, crie e compartilhe.</p>
  </div>
  <p style="position:absolute;left:7%;bottom:11%;max-width:52%;font-size:10.1px;font-weight:600;line-height:1.3;color:${BRAND.blue}">jorgesolla1313.com.br</p>
  <img style="position:absolute;left:203px;top:520px;width:132px;height:auto" src="${assets.completePositive}" alt="Jorge Solla 1313 — Mais Saúde, Mais Futuro" />
</div>`,
  })

/** Transparent overlay of a capture scene: step badge + positive mark on a plate. */
export const chromeOverlayHtml = ({ fontCss, badge, assets }) =>
  htmlDocument({
    title: `Reel — chrome ${badge.number}`,
    fontCss,
    body: `
<div class="frame">
  <div class="badge"><b>${badge.number}</b>${badge.label}</div>
  <div class="brand-plate"><img src="${assets.namePositive}" alt="Jorge Solla — Deputado Federal" /></div>
</div>`,
  })

/** Transparent overlay of one burned caption (accent parts in brand yellow). */
export const captionOverlayHtml = ({ fontCss, caption }) => {
  const parts = caption.parts
    .map((part) => (part.accent ? `<span class="accent">${part.text}</span>` : part.text))
    .join('')
  return htmlDocument({
    title: 'Reel — caption',
    fontCss,
    body: `<div class="frame"><p class="caption-box">${parts}</p></div>`,
  })
}

/** Scene 05 — cover: own composition, title inside the central 1080×1350 crop. */
export const coverHtml = ({ fontCss, assets }) =>
  htmlDocument({
    title: 'Reel — capa',
    fontCss,
    body: `
<div class="frame" style="background:${BRAND_GRADIENT}">
  <div class="star-disc" style="left:250px;top:54px;width:88px;height:88px"><img src="${assets.star}" alt="" /></div>
  <div style="position:absolute;left:7%;right:7%;top:22%">
    <span style="display:inline-flex;border-radius:999px;background:${BRAND.yellow};color:#000;padding:5.4px 14.4px;font-size:10.8px;font-weight:900">TUTORIAL DO SITE</span>
    <h3 class="brexter" style="font-size:43.2px;line-height:.88;color:#fff;margin-top:25.2px">Crie seu<br />card de<br /><span class="accent">apoio.</span></h3>
    <p style="margin-top:21.6px;max-width:65%;font-size:13.3px;font-weight:600;line-height:1.2;color:#fff">Seu nome ou sua foto, direto pelo celular.</p>
  </div>
  <p style="position:absolute;left:7%;bottom:18%;border-radius:4px;background:rgb(0 0 0 / 40%);padding:5.4px 10.8px;font-size:8.6px;color:#fff">#cards</p>
  <img style="position:absolute;left:205px;top:448px;width:133px;height:auto" src="${assets.completeNegative}" alt="Jorge Solla 1313 — Mais Saúde, Mais Futuro" />
</div>`,
  })
