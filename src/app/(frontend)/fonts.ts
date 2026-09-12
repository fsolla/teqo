import localFont from 'next/font/local'

/**
 * S13 — Brexter 700, the display face of the official card masters. Web use is
 * licensed for the campaign (regular DEMO face is deliberately excluded). The
 * font is only consumed by the card canvas, so the family string travels to the
 * client and `ensureCardFont` awaits `document.fonts.load` before measuring.
 */
export const brexterBold = localFont({
  src: './fonts/Brexter-Bold.ttf',
  weight: '700',
  style: 'normal',
  display: 'swap',
  variable: '--font-brexter',
  // Canvas-only face: preloading it on every page would be waste (the studio
  // loads it on demand via `document.fonts.load`).
  preload: false,
})
