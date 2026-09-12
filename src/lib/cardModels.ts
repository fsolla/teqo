/**
 * S13 — the three personalized-card models of the campaign site. Pure data so
 * the home section, the `/cards` gallery and the canvas renderer share one
 * catalog (no second editor, no CMS): each entry carries the master asset, the
 * real output size in pixels and, for photo models, the transparent window the
 * visitor's photo must cover.
 *
 * Geometry comes from the master files (pixel-measured, keep in sync with
 * `docs/plans/cards-personalizados-campanha-impl.md`): the photo frames are
 * 1000×1000 and 1000×1440 despite the `1080x` in the original file names.
 */

const CARD_MODEL_IDS = ['eu-sou-solla', 'perfil-quadrado', 'perfil-retangular'] as const

export type CardModelId = (typeof CARD_MODEL_IDS)[number]
type CardModelKind = 'name' | 'photo'

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
  /** Photo models only: the transparent window the photo must cover. */
  photoWindow?: CardRect
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
]

/**
 * Name model slot, pixel-measured from the filled master (`FULANO` example):
 * the `#SOU` line and the visitor's name share the same left border at x=213
 * (S14 — the name is left-aligned, not centered); the cap band tops at y=430
 * with a 106px cap height and the master's ink spans x[214..925] (712px), so a
 * fitted name never crosses 714px. The visitor's name is the only thing drawn
 * over the base; the fixed lines already live in the art.
 */
export const NAME_CARD_SLOT = {
  leftX: 213,
  capTop: 430,
  capHeight: 106,
  maxInkWidth: 714,
  maxBlockBottom: 630,
  minCapHeight: 48,
  fill: '#ffec01',
  maxLines: 2,
} as const

export const BRAND_FALLBACK_FONT = 'sans-serif'

export const isCardModelId = (value: unknown): value is CardModelId =>
  typeof value === 'string' && (CARD_MODEL_IDS as readonly string[]).includes(value)

export const getCardModel = (id: CardModelId): CardModel | undefined =>
  CARD_MODELS.find((model) => model.id === id)
