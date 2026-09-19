/**
 * S13/S15 — the personalized-card models of the campaign site. Pure data so
 * the home section, the `/cards` gallery and the canvas renderer share one
 * catalog (no second editor, no CMS): each entry carries the master asset, the
 * real output size in pixels and, for photo/team models, the transparent window
 * the visitor's photo must cover.
 *
 * Geometry comes from the master files (pixel-measured, keep in sync with
 * `docs/plans/cards-personalizados-campanha-impl.md` and
 * `docs/plans/cards-time-de-voce-impl.md`): the photo frames are 1000×1000 and
 * 1000×1440 despite the `1080x` in the original file names.
 */

const CARD_MODEL_IDS = [
  'eu-sou-solla',
  'perfil-quadrado',
  'perfil-retangular',
  'time-de-voce',
] as const

export type CardModelId = (typeof CARD_MODEL_IDS)[number]
type CardModelKind = 'name' | 'photo' | 'team'

export type CardRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CardModel = {
  id: CardModelId
  kind: CardModelKind
  label: string
  assetSrc: string
  width: number
  height: number
  /** Photo and team models: the transparent window the photo must cover. */
  photoWindow?: CardRect
  /** Team model: the master front overlay drawn above the cutout photo. */
  overlaySrc?: string
  /** Team model: the filled example shown before a cutout is ready. */
  previewSrc?: string
  /** Optional gallery badge (e.g. `NOVO`). */
  badge?: string
}

export const CARD_MODELS: readonly CardModel[] = [
  {
    id: 'eu-sou-solla',
    kind: 'name',
    label: 'Card com seu nome',
    assetSrc: '/cards/name-card-base.jpg',
    width: 1080,
    height: 1440,
  },
  {
    id: 'perfil-quadrado',
    kind: 'photo',
    label: 'Moldura quadrada',
    assetSrc: '/cards/photo-square-frame.png',
    width: 1000,
    height: 1000,
    photoWindow: { x: 0, y: 0, width: 1000, height: 740 },
  },
  {
    id: 'perfil-retangular',
    kind: 'photo',
    label: 'Moldura vertical',
    assetSrc: '/cards/photo-portrait-frame.png',
    width: 1000,
    height: 1440,
    photoWindow: { x: 0, y: 0, width: 1000, height: 1044 },
  },
  {
    id: 'time-de-voce',
    kind: 'team',
    label: 'Time de você',
    assetSrc: '/cards/team-card-base.png',
    overlaySrc: '/cards/team-card-front.png',
    previewSrc: '/cards/team-card-example.jpg',
    badge: 'NOVO',
    width: 1080,
    height: 1440,
    photoWindow: { x: 286, y: 439, width: 592, height: 577 },
  },
]

/** Fields every name slot shares, whatever the drawing alignment. */
type CardNameSlotBase = {
  capHeight: number
  minCapHeight: number
  maxInkWidth: number
  maxLines: number
  fill: string
}

/** Left-aligned slot with a two-line band (S13 name model). */
export type CardNameBlockSlot = CardNameSlotBase & {
  align: 'left'
  leftX: number
  capTop: number
  maxBlockBottom: number
}

/** Rotated rectangle + background the renderer draws for a banner. */
export type CardBanner = {
  centerX: number
  centerY: number
  width: number
  height: number
  rotationDeg: number
  background: string
}

/** Centered single-line slot drawn on a rotated banner (S15 team model). */
export type CardNameBannerSlot = CardNameSlotBase & {
  align: 'center'
  maxLines: 1
  banner: CardBanner
}

export type CardNameSlot = CardNameBlockSlot | CardNameBannerSlot

/**
 * Name model slot, pixel-measured from the filled master (`FULANO` example):
 * the `#SOU` line and the visitor's name share the same left border at x=213
 * (S14 — the name is left-aligned, not centered); the cap band tops at y=430
 * with a 106px cap height and the master's ink spans x[214..925] (712px), so a
 * fitted name never crosses 714px. The visitor's name is the only thing drawn
 * over the base; the fixed lines already live in the art.
 */
export const NAME_CARD_SLOT = {
  align: 'left',
  leftX: 213,
  capTop: 430,
  capHeight: 106,
  maxInkWidth: 714,
  maxBlockBottom: 630,
  minCapHeight: 48,
  fill: '#ffec01',
  maxLines: 2,
} as const satisfies CardNameBlockSlot

/**
 * S15 — geometry pixel-measured from `team-card-example.jpg` (the reference
 * filled card). Neither master carries the top banners, so the renderer draws
 * both rectangles + text over the composed art: the red `TIME DE` label and the
 * blue name banner. `rotationDeg` is counter-clockwise, matching the masters'
 * built-in tilt (the photo window sits inside the sky area at x=286 y=439).
 */
export const TEAM_CARD_LABEL = {
  text: 'TIME DE',
  centerX: 545,
  centerY: 162,
  width: 693,
  height: 118,
  rotationDeg: -3.5,
  background: '#e50e2f',
  fill: '#ffec01',
  capHeight: 93,
} as const

export const TEAM_CARD_NAME_BANNER = {
  centerX: 545,
  centerY: 313,
  width: 509,
  height: 176,
  rotationDeg: -4.1,
  background: '#0061a5',
  fill: '#ffffff',
} as const

export const TEAM_CARD_NAME_SLOT = {
  align: 'center',
  banner: TEAM_CARD_NAME_BANNER,
  capHeight: 130,
  minCapHeight: 56,
  maxInkWidth: 470,
  fill: TEAM_CARD_NAME_BANNER.fill,
  maxLines: 1,
} as const satisfies CardNameBannerSlot

export const BRAND_FALLBACK_FONT = 'sans-serif'

export const isCardModelId = (value: unknown): value is CardModelId =>
  typeof value === 'string' && (CARD_MODEL_IDS as readonly string[]).includes(value)

export const getCardModel = (id: CardModelId): CardModel | undefined =>
  CARD_MODELS.find((model) => model.id === id)
