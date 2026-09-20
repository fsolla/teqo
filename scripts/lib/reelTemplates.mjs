/**
 * C196/C197 — the visual templates of the reel, ported class-by-class from the
 * design artifacts: the family design `docs/plans/reels-tutoriais-ui-design.html`
 * and the revision `docs/plans/reels-tutoriais-foto-de-perfil-ui-design.html`
 * (official campaign kit: palette, marks, illustrations, Brexter display face,
 * command rail, capture brand cap, profile handoff, cover). Every template is a
 * pure string builder rendered at 360×640 with deviceScaleFactor 3, so the
 * physical asset is 1080×1920.
 *
 * The reel's message is data: hook/cover/CTA/profile copy comes from the shot
 * list (`graphics.*`); the templates carry structure only.
 *
 * Pure module: the caller passes the font CSS and the kit asset data URIs.
 */

const BRAND = {
  red: '#e4102f',
  blue: '#184e92',
  yellow: '#ffeb00',
  green: '#009647',
  cream: '#fff8f2',
  ink: '#111111',
  muted: '#6c615e',
  line: 'rgb(0 0 0 / 12%)',
}

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:360px;height:640px;overflow:hidden;background:transparent}
body{font-family:ReelInter,Inter,ui-sans-serif,system-ui,sans-serif;color:${BRAND.ink};-webkit-font-smoothing:antialiased}
.frame{position:relative;width:360px;height:640px;overflow:hidden}
.brexter{font-family:ReelBrexter,Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif;font-weight:700;text-transform:uppercase}
.kit-asset{display:block;height:auto;object-fit:contain}
.pattern-wash{position:absolute;inset:0 0 auto;width:360px;height:540px;object-fit:cover;object-position:top center;opacity:.16;pointer-events:none}
.official-mark{position:absolute;display:block;height:auto}

/* Capture chrome — a quiet top cap and one command rail, never a central card. */
.capture-brand-cap{position:absolute;z-index:20;inset:0 0 auto;height:38px;background:linear-gradient(90deg,${BRAND.red} 0 78%,${BRAND.blue} 100%);border-bottom:2px solid ${BRAND.yellow};box-shadow:0 4px 12px rgb(0 0 0 / 14%)}
.capture-brand-cap img{position:absolute;right:16px;top:7px;width:86px;height:auto}
.command-rail{position:absolute;z-index:24;left:16px;top:88px;width:328px;min-height:50px;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:8px 12px 8px 8px;border:1px solid rgb(0 0 0 / 10%);border-left:4px solid ${BRAND.red};border-radius:12px;background:rgb(255 255 255 / 96%);box-shadow:0 8px 24px rgb(0 0 0 / 18%);color:${BRAND.ink}}
.step-badge{display:grid;width:34px;height:34px;place-items:center;border-radius:50%;background:${BRAND.yellow};color:#000;font-size:11px;font-weight:900;line-height:1;box-shadow:inset 0 0 0 1px rgb(0 0 0 / 8%)}
.step-badge--label{width:auto;min-width:70px;border-radius:999px;padding:0 10px}
.command-copy{margin:0;max-width:258px;font-size:12.5px;font-weight:800;line-height:1.2;letter-spacing:-.01em}
.command-copy strong{color:#a21c1c;font-weight:900}

/* Graphic scene: hook. */
.hook-scene{background:linear-gradient(156deg,${BRAND.red} 0 68%,${BRAND.blue} 145%)}
.hook-illustration{position:absolute;right:-30px;top:58px;width:154px;opacity:.98}
.hook-copy{position:absolute;left:22px;right:20px;top:94px;color:#fff}
.hook-eyebrow{display:inline-flex;border-radius:999px;padding:6px 12px;background:${BRAND.yellow};color:#000;font-size:10.5px;font-weight:900;letter-spacing:.06em}
.hook-title{width:310px;margin:24px 0 0;font-size:40px;line-height:.88;letter-spacing:-.035em}
.hook-sub{width:205px;margin:20px 0 0;font-size:14px;line-height:1.3;font-weight:650}

/* Graphic scene: profile handoff. Class names are the port contract. */
.profile-scene{background:linear-gradient(180deg,#fff8f2 0%,#fff 72%,#f3f6fb 100%)}
.profile-scene::before{content:'';position:absolute;inset:0 0 auto;height:64px;background:${BRAND.red};border-bottom:4px solid ${BRAND.yellow}}
.profile-brand{position:absolute;z-index:3;right:18px;top:16px;width:95px}
.profile-heading{position:absolute;z-index:3;left:22px;right:22px;top:88px;text-align:center}
.profile-eyebrow{color:${BRAND.red};font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.profile-title{margin-top:5px;color:${BRAND.blue};font-size:27px;line-height:.92;letter-spacing:-.02em}
.profile-phones{position:absolute;left:18px;right:18px;top:176px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.profile-phone{position:relative;height:226px;overflow:hidden;border:1px solid rgb(0 0 0 / 12%);border-radius:22px;background:#fff;box-shadow:0 12px 30px rgb(24 78 146 / 13%)}
.profile-phone__top{height:38px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid ${BRAND.line};font-size:11px;font-weight:800}
.profile-phone--ig .profile-phone__top{color:#9d174d}
.profile-phone--wa .profile-phone__top{color:#087a3f}
.profile-avatar-shell{position:absolute;left:50%;top:58px;width:82px;height:82px;transform:translateX(-50%);border-radius:50%;padding:4px;background:linear-gradient(135deg,${BRAND.red},${BRAND.yellow},${BRAND.green})}
.profile-phone--wa .profile-avatar-shell{background:#d9f6e5}
.profile-avatar{position:relative;width:100%;height:100%;overflow:hidden;border:3px solid #fff;border-radius:50%;background:#e7eaee}
.profile-avatar img{width:100%;height:100%;object-fit:cover;filter:saturate(0.72);opacity:.58}
.profile-handle{position:absolute;left:12px;right:12px;top:151px;text-align:center;font-size:10px;font-weight:800}
.profile-lines{position:absolute;left:34px;right:34px;top:172px;display:grid;gap:6px}
.profile-lines span{height:5px;border-radius:999px;background:#e7e7e7}
.profile-lines span:last-child{margin-inline:11px}
.profile-card{position:absolute;z-index:10;left:145px;top:330px;width:70px;height:70px;overflow:hidden;border:3px solid #fff;border-radius:12px;background:#dfe9f0;box-shadow:0 10px 24px rgb(0 0 0 / 24%);opacity:0}
.profile-card__photo{width:100%;height:100%;object-fit:cover}
.profile-card__frame{position:absolute;inset:0;width:100%;height:100%}
.profile-check{position:absolute;z-index:12;top:344px;display:grid;width:28px;height:28px;place-items:center;border:3px solid #fff;border-radius:50%;background:${BRAND.green};color:#fff;font-size:15px;font-weight:900;opacity:0;transform:scale(.65)}
.profile-check--ig{left:118px}
.profile-check--wa{right:34px}
.profile-footnote{position:absolute;left:22px;right:22px;top:370px;text-align:center;color:${BRAND.blue};font-size:11px;font-weight:800}

@keyframes profile-heading-in{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
@keyframes profile-phones-in{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
@keyframes profile-to-instagram{0%,12%{opacity:0;transform:translate(0,12px) scale(.88);border-radius:12px}24%{opacity:1;transform:translate(0,0) scale(1);border-radius:12px}62%,100%{opacity:1;transform:translate(-87px,-100px) scale(1.06);border-radius:50%}}
@keyframes profile-to-whatsapp{0%,46%{opacity:0;transform:translate(0,12px) scale(.88);border-radius:12px}58%{opacity:1;transform:translate(0,0) scale(1);border-radius:12px}88%,100%{opacity:1;transform:translate(87px,-100px) scale(1.06);border-radius:50%}}
@keyframes profile-check-in{0%,78%{opacity:0;transform:scale(.65)}88%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
@keyframes profile-done-pulse{0%,85%,100%{box-shadow:0 12px 30px rgb(24 78 146 / 13%)}92%{box-shadow:0 0 0 4px rgb(255 235 0 / 65%),0 12px 30px rgb(24 78 146 / 13%)}}
.play .profile-heading{animation:profile-heading-in .42s cubic-bezier(.2,.7,.2,1) both}
.play .profile-phones{animation:profile-phones-in .5s cubic-bezier(.2,.7,.2,1) .3s both}
.play .profile-card--ig{animation:profile-to-instagram 2.15s cubic-bezier(.2,.7,.2,1) .55s both}
.play .profile-card--wa{animation:profile-to-whatsapp 2.9s cubic-bezier(.2,.7,.2,1) .55s both}
.play .profile-check{animation:profile-check-in 3.35s cubic-bezier(.2,.8,.2,1) .35s both}
.play .profile-phone{animation:profile-done-pulse 4s ease-out both}

/* Graphic scene: CTA. */
.cta-scene{background:${BRAND.cream}}
.cta-red{position:absolute;inset:0 0 auto;height:306px;overflow:hidden;background:${BRAND.red}}
.cta-punho{position:absolute;left:-38px;top:42px;width:180px;opacity:.98}
.cta-copy{position:absolute;left:132px;right:20px;top:90px;color:#fff;text-align:left}
.cta-copy p{margin:0;color:${BRAND.yellow};font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
.cta-copy h3{margin:10px 0 0;font-size:36px;line-height:.88;letter-spacing:-.025em}
.cta-card{position:absolute;left:22px;right:22px;top:328px;padding:20px 18px;border:1px solid ${BRAND.line};border-radius:18px;background:#fff;text-align:center;box-shadow:0 14px 36px rgb(71 19 14 / 14%)}
.cta-card__eyebrow{color:${BRAND.red};font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
.cta-card__action{margin-top:5px;color:${BRAND.blue};font-size:29px;line-height:.95}
.cta-card__sub{margin-top:8px;color:${BRAND.muted};font-size:11px;line-height:1.35}
.cta-url{position:absolute;left:22px;bottom:30px;color:${BRAND.blue};font-size:10px;font-weight:800}

/* Cover. */
.cover-scene{background:linear-gradient(156deg,${BRAND.red} 0 72%,${BRAND.blue} 155%)}
.cover-copy{position:absolute;left:24px;right:20px;top:132px;color:#fff}
.cover-copy h3{margin:24px 0 0;font-size:44px;line-height:.86;letter-spacing:-.035em}
.cover-copy p{width:232px;margin:20px 0 0;font-size:13px;line-height:1.3;font-weight:650}
.cover-tag{position:absolute;left:24px;top:500px;border-radius:7px;background:rgb(0 0 0 / 35%);padding:6px 11px;color:#fff;font-size:10px;font-weight:800}

/* Family motion vocabulary (hook/CTA). */
@keyframes reel-beat{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
@keyframes reel-fade{0%{opacity:0}100%{opacity:1}}
@keyframes reel-derive{0%{opacity:0;transform:translateX(8px)}100%{opacity:1;transform:translateX(0)}}
@keyframes reel-rise{0%{opacity:0;transform:translateY(18px)}100%{opacity:1;transform:translateY(0)}}
@keyframes reel-punch{0%{opacity:0;transform:translateX(-16px)}100%{opacity:1;transform:translateX(0)}}
.play .fade-1{animation:reel-fade .45s ease-out .15s both}
.play .beat-1{animation:reel-beat .55s cubic-bezier(.2,.7,.2,1) both}
.play .beat-2{animation:reel-beat .55s cubic-bezier(.2,.7,.2,1) .28s both}
.play .rise-1{animation:reel-rise .5s cubic-bezier(.2,.7,.2,1) .35s both}
.play .derive-1{animation:reel-derive .65s ease-out .1s both}
.play .punch-1{animation:reel-punch .6s ease-out both}
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

/** Explicit headline breaks; only the declared accent line changes color. */
const headline = (copy, accentColor = BRAND.yellow) =>
  copy.headlineLines
    .map((line, index) =>
      index === copy.accentIndex ? `<span style="color:${accentColor}">${line}</span>` : line,
    )
    .join('<br />')

/** Capture chrome — the brand cap (always on for the whole scene). */
export const captureChromeHtml = ({ assets }) =>
  htmlDocument({
    title: 'Reel — chrome',
    body: `
<div class="frame">
  <div class="capture-brand-cap"><img src="${assets.nameNegative}" alt="Jorge Solla — Deputado Federal" /></div>
</div>`,
  })

/** Transparent overlay of one command rail (step badge + action in brand red). */
export const commandRailHtml = ({ fontCss, badge, caption }) => {
  const badgeHtml =
    typeof badge.number === 'number'
      ? `<span class="step-badge">${badge.number}/${badge.total}</span>`
      : `<span class="step-badge step-badge--label">${badge.label}</span>`
  const parts = caption.parts
    .map((part) => (part.accent ? `<strong>${part.text}</strong>` : part.text))
    .join('')
  return htmlDocument({
    title: 'Reel — comando',
    fontCss,
    body: `<div class="frame"><div class="command-rail">${badgeHtml}<p class="command-copy">${parts}</p></div></div>`,
  })
}

/** Scene 01 — hook: red field, official pattern + heart, reel's own headline. */
export const hookHtml = ({ fontCss, assets, copy }) =>
  htmlDocument({
    title: 'Reel — hook',
    fontCss,
    body: `
<div class="frame hook-scene">
  <img class="pattern-wash" src="${assets.patternShapes}" alt="" />
  <img class="hook-illustration derive-1" src="${assets.heart}" alt="" />
  <div class="hook-copy">
    <span class="hook-eyebrow fade-1">${copy.eyebrow}</span>
    <h1 class="brexter hook-title">${headline(copy)}</h1>
    <p class="hook-sub beat-2">${copy.sub}</p>
  </div>
  <img class="official-mark" style="left:204px;top:498px;width:134px" src="${assets.completeNegative}" alt="Jorge Solla 1313 — Mais Saúde, Mais Futuro" />
</div>`,
  })

/** Scene 07 — profile handoff: the downloaded art becomes the avatar, no network. */
export const profileHtml = ({ fontCss, assets, copy }) => {
  const phone = (variant, appLabel) => `
    <div class="profile-phone profile-phone--${variant}">
      <div class="profile-phone__top">${appLabel}</div>
      <div class="profile-avatar-shell"><div class="profile-avatar"><img src="${assets.fixturePhoto}" alt="" /></div></div>
      <p class="profile-handle">${variant === 'ig' ? '@seuperfil' : 'Seu perfil'}</p>
      <div class="profile-lines"><span></span><span></span></div>
    </div>`
  return htmlDocument({
    title: 'Reel — profile',
    fontCss,
    body: `
<div class="frame profile-scene">
  <img class="kit-asset profile-brand" src="${assets.nameNegative}" alt="Jorge Solla — Deputado Federal" />
  <div class="profile-heading">
    <p class="profile-eyebrow">${copy.eyebrow}</p>
    <h3 class="brexter profile-title">${headline(copy, BRAND.blue)}</h3>
  </div>
  <div class="profile-phones">${phone('ig', copy.apps[0])}${phone('wa', copy.apps[1])}</div>
  <div class="profile-card profile-card--ig" aria-hidden="true">
    <img class="profile-card__photo" src="${assets.fixturePhoto}" alt="" />
    <img class="profile-card__frame" src="${assets.cardFrame}" alt="" />
  </div>
  <div class="profile-card profile-card--wa" aria-hidden="true">
    <img class="profile-card__photo" src="${assets.fixturePhoto}" alt="" />
    <img class="profile-card__frame" src="${assets.cardFrame}" alt="" />
  </div>
  <span class="profile-check profile-check--ig">✓</span><span class="profile-check profile-check--wa">✓</span>
  <p class="profile-footnote">${copy.instruction}</p>
</div>`,
  })
}

/** Scene last — CTA: official fist, one verbal CTA, positive mark on the light field. */
export const ctaHtml = ({ fontCss, assets, copy }) =>
  htmlDocument({
    title: 'Reel — CTA',
    fontCss,
    body: `
<div class="frame cta-scene">
  <div class="cta-red"><img class="cta-punho punch-1" src="${assets.fist}" alt="" /></div>
  <div class="cta-copy">
    <p class="fade-1">${copy.eyebrow}</p>
    <h3 class="brexter beat-1">${headline(copy)}</h3>
  </div>
  <div class="cta-card rise-1">
    <p class="cta-card__eyebrow">FAÇA A SUA</p>
    <p class="brexter cta-card__action">${copy.actionLines.join('<br />')}</p>
    <p class="cta-card__sub">${copy.sub}</p>
  </div>
  <p class="cta-url">${copy.url}</p>
  <img class="official-mark" style="right:20px;top:520px;width:132px" src="${assets.completePositive}" alt="Jorge Solla 1313 — Mais Saúde, Mais Futuro" />
</div>`,
  })

/** Cover: own composition, headline inside the central 1080×1350 crop. */
export const coverHtml = ({ fontCss, assets, copy }) =>
  htmlDocument({
    title: 'Reel — capa',
    fontCss,
    body: `
<div class="frame cover-scene">
  <img class="pattern-wash" src="${assets.patternShapes}" alt="" />
  <div class="cover-copy">
    <span class="hook-eyebrow">${copy.eyebrow}</span>
    <h3 class="brexter">${headline(copy)}</h3>
    <p>${copy.sub}</p>
  </div>
  <span class="cover-tag">${copy.tag}</span>
  <img class="official-mark" style="right:20px;top:455px;width:134px" src="${assets.completeNegative}" alt="Jorge Solla 1313 — Mais Saúde, Mais Futuro" />
</div>`,
  })
