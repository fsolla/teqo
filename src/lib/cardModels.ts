/**
 * S13/S15 — the personalized-card models of the campaign site. Pure data so
 * the home section, the `/cards` gallery and the canvas renderer share one
 * catalog (no second editor, no CMS): each entry carries the master asset, the
 * real output size in pixels and, for photo/team models, the transparent window
 * the photo is framed and zoomed over (fully covered under the bounded default).
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
  'time-do-estadual',
  'minha-colinha',
] as const

export type CardModelId = (typeof CARD_MODEL_IDS)[number]
type CardModelKind = 'name' | 'photo' | 'team' | 'colinha'

export type CardRect = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * S33 — the visitor-adjustment policy of a photo/team model. `bounded` (the
 * omitted default) pins the photo offsets so the transparent window is always
 * covered (S13/S14); `free` leaves the offsets untouched in both axes — the
 * photo may leave the frame and reveal the art behind it — while the zoom keeps
 * its `[1, 4]` range (human gate of 2026-09-24).
 */
export type CardPhotoPosition = 'bounded' | 'free'

export type CardModel = {
  id: CardModelId
  kind: CardModelKind
  label: string
  /**
   * S38 — the one-line explanation of the model shown by its catalogue item on
   * `/conteudos`, under the name. Copy of the model, never of the studio.
   */
  description: string
  /**
   * S38 — the popular nicknames the public catalogue search must find the model
   * by ("santinho", "foto de perfil", "colinha", "estadual"). Search data of the
   * item, never rendered as the model name.
   */
  aliases: readonly string[]
  assetSrc: string
  width: number
  height: number
  /** Photo and team models: the transparent window the photo is framed over. */
  photoWindow?: CardRect
  /** Photo/team models: `free` unlocks the position clamp during the adjustment. */
  photoPosition?: CardPhotoPosition
  /** Team model: the master front overlay drawn above the cutout photo. */
  overlaySrc?: string
  /**
   * Gallery tile art: the filled example shown by the team models before a
   * cutout is ready.
   */
  previewSrc?: string
  /**
   * S30/S31 — model whose flow is picked per state deputy from the shared
   * catalog: on the team model the composer swaps `assetSrc`/`overlaySrc` for
   * the selected entry (the defaults are the illustrative JULIO pair); on the
   * colinha it fills the estadual row. Both gate the flow on the selection.
   */
  stateDeputyPicker?: boolean
  /** Optional gallery badge (e.g. `NOVO`). */
  badge?: string
}

export const CARD_MODELS: readonly CardModel[] = [
  {
    id: 'eu-sou-solla',
    kind: 'name',
    label: 'Card com seu nome',
    description: 'Coloque seu nome no card oficial.',
    aliases: ['nome'],
    assetSrc: '/cards/name-card-base.jpg',
    width: 1080,
    height: 1440,
  },
  {
    id: 'perfil-quadrado',
    kind: 'photo',
    label: 'Moldura quadrada',
    description: 'Foto de perfil quadrada.',
    aliases: ['foto de perfil'],
    assetSrc: '/cards/photo-square-frame.png',
    width: 1000,
    height: 1000,
    photoWindow: { x: 0, y: 0, width: 1000, height: 740 },
  },
  {
    id: 'perfil-retangular',
    kind: 'photo',
    label: 'Moldura vertical',
    description: 'Foto vertical para stories.',
    aliases: ['foto de perfil'],
    assetSrc: '/cards/photo-portrait-frame.png',
    width: 1000,
    height: 1440,
    photoWindow: { x: 0, y: 0, width: 1000, height: 1044 },
  },
  {
    id: 'time-de-voce',
    kind: 'team',
    label: 'Time de você',
    description: 'Entre para o time com sua foto.',
    aliases: ['santinho'],
    assetSrc: '/cards/team-card-base.png',
    overlaySrc: '/cards/team-card-front.png',
    previewSrc: '/cards/team-card-example.jpg',
    width: 1080,
    height: 1440,
    photoWindow: { x: 286, y: 439, width: 592, height: 577 },
    photoPosition: 'free',
  },
  {
    id: 'time-do-estadual',
    kind: 'team',
    label: 'Time do estadual',
    description: 'Escolha o estadual e personalize.',
    aliases: ['estadual'],
    // S30 — the defaults are the illustrative pair (JULIO, the deputy of the
    // approved example art); the composer swaps them for the selected entry of
    // `stateDeputyCatalog`. `previewSrc` is the exact file approved by the
    // human for the gallery tile and the pre-selection placeholder.
    assetSrc: '/cards/estaduais/julio-fotos.webp',
    overlaySrc: '/cards/estaduais/julio-base.webp',
    previewSrc: '/cards/modelo-time-de-voce-com-estadual.jpeg',
    stateDeputyPicker: true,
    width: 1080,
    height: 1440,
    photoWindow: { x: 286, y: 439, width: 592, height: 577 },
    photoPosition: 'free',
  },
  {
    id: 'minha-colinha',
    kind: 'colinha',
    label: 'Minha colinha',
    description: 'Monte sua cola de votação.',
    aliases: ['santinho', 'colinha'],
    // S34 — the approved art delivered by the human is the base of the preview
    // and the download (drawn whole at 1.2×); the only drawn element is the
    // estadual row overlay. The gallery tile shows the same art via `assetSrc`.
    assetSrc: '/cards/modelo-colinha.jpeg',
    stateDeputyPicker: true,
    badge: 'NOVO',
    width: 1080,
    height: 1920,
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
  /** Model-pixel ceiling the width may grow to (S16); equals `width` when fixed. */
  maxWidth: number
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
  maxWidth: 693,
  height: 118,
  rotationDeg: -3.5,
  background: '#e50e2f',
  fill: '#ffec01',
  capHeight: 93,
} as const

/**
 * S16 — the blue name banner is dynamic: `width` is the S15 reference kept while
 * the fitted ink fits the reference band (`width - padding` = 470) and
 * `maxWidth` (1000) is the ceiling the banner grows to only as needed. The
 * ceiling keeps the lowest rotated corner (`313 + 500·sin 4.1° + 88·cos 4.1°`
 * ≈ 436.5 — conservative corner check) above the photo window top (y=439); it is
 * also the pair that fixes the ink padding: `maxWidth - slot.maxInkWidth = 39`
 * (= the S15 pair `509 - 470`).
 */
export const TEAM_CARD_NAME_BANNER = {
  centerX: 545,
  centerY: 313,
  width: 509,
  maxWidth: 1000,
  height: 176,
  rotationDeg: -4.1,
  background: '#0061a5',
  fill: '#ffffff',
} as const

/**
 * S16 — the readable floor drops to a 40px cap (the human gate decision of
 * 2026-09-19: long compound names fit and only clearly absurd names are asked
 * to shorten) and the ink ceiling becomes the banner ceiling pair: 961 = 1000
 * (banner) − 39 (padding), the same padding measured in the S15 pair 509 − 470.
 */
export const TEAM_CARD_NAME_SLOT = {
  align: 'center',
  banner: TEAM_CARD_NAME_BANNER,
  capHeight: 130,
  minCapHeight: 40,
  maxInkWidth: 961,
  fill: TEAM_CARD_NAME_BANNER.fill,
  maxLines: 1,
} as const satisfies CardNameBannerSlot

export const BRAND_FALLBACK_FONT = 'sans-serif'

export const isCardModelId = (value: unknown): value is CardModelId =>
  typeof value === 'string' && (CARD_MODEL_IDS as readonly string[]).includes(value)

export const getCardModel = (id: CardModelId): CardModel | undefined =>
  CARD_MODELS.find((model) => model.id === id)
