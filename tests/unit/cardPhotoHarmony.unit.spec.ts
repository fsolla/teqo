import { describe, expect, it } from 'vitest'

import {
  CARD_HARMONY_IDENTITY_EPSILON,
  CARD_HARMONY_LIMITS,
  applyCardPhotoHarmony,
  computeCardHarmonyAdjustment,
  isCardHarmonyIdentity,
  measureCardPhotoTone,
  type CardHarmonyAdjustment,
  type CardPhotoTone,
} from '@/lib/cardPhotoHarmony'
import { CARD_CUTOUT_ALPHA_THRESHOLD } from '@/lib/cardPhotoTransform'

type Rgba = readonly [number, number, number, number?]

const pixelsOf = (colors: ReadonlyArray<Rgba>) =>
  new Uint8ClampedArray(
    colors.flatMap(([red, green, blue, alpha = 255]) => [red, green, blue, alpha]),
  )

const toneOf = (overrides: Partial<CardPhotoTone> = {}): CardPhotoTone => ({
  meanLuma: 0.5,
  sdLuma: 0.2,
  meanSaturation: 0.4,
  samples: 1,
  ...overrides,
})

const IDENTITY: CardHarmonyAdjustment = { brightness: 1, contrast: 1, saturation: 1 }

describe('measureCardPhotoTone', () => {
  it('measures Rec.709 luma and HSV saturation of an opaque color', () => {
    const tone = measureCardPhotoTone(pixelsOf([[30, 120, 200]]))

    expect(tone.samples).toBe(1)
    expect(tone.meanLuma).toBeCloseTo(0.4182, 4)
    expect(tone.sdLuma).toBe(0)
    expect(tone.meanSaturation).toBeCloseTo(0.85, 5)
  })

  it('ignores pixels at or below the alpha threshold (matches the cutout bbox)', () => {
    const tone = measureCardPhotoTone(
      pixelsOf([
        [255, 255, 255, 0],
        [255, 255, 255, CARD_CUTOUT_ALPHA_THRESHOLD],
        [0, 0, 0, CARD_CUTOUT_ALPHA_THRESHOLD + 1],
      ]),
    )

    expect(tone.samples).toBe(1)
    expect(tone.meanLuma).toBe(0)
  })

  it('reports an empty sample instead of black when nothing is opaque', () => {
    const tone = measureCardPhotoTone(pixelsOf([[10, 20, 30, 0]]))

    expect(tone).toEqual({ meanLuma: 0, sdLuma: 0, meanSaturation: 0, samples: 0 })
  })

  it('measures the population spread of a two-tone sample', () => {
    const tone = measureCardPhotoTone(
      pixelsOf([
        [0, 0, 0],
        [255, 255, 255],
      ]),
    )

    expect(tone.samples).toBe(2)
    expect(tone.meanLuma).toBeCloseTo(0.5, 5)
    expect(tone.sdLuma).toBeCloseTo(0.5, 5)
    expect(tone.meanSaturation).toBe(0)
  })
})

describe('computeCardHarmonyAdjustment', () => {
  it('is identity when the photo already matches the reference tone', () => {
    const tone = toneOf()
    const adjustment = computeCardHarmonyAdjustment(tone, tone)

    expect(adjustment).toEqual(IDENTITY)
    expect(isCardHarmonyIdentity(adjustment)).toBe(true)
  })

  it('raises brightness toward a brighter reference, capped by the fixed limit', () => {
    const adjustment = computeCardHarmonyAdjustment(
      toneOf({ meanLuma: 0.4 }),
      toneOf({ meanLuma: 0.8 }),
    )

    expect(adjustment.brightness).toBe(CARD_HARMONY_LIMITS.brightness.max)
    expect(adjustment.contrast).toBe(1)
    expect(adjustment.saturation).toBe(1)
  })

  it('moves saturation toward a desaturated reference, floored by the fixed limit', () => {
    const adjustment = computeCardHarmonyAdjustment(
      toneOf({ meanSaturation: 0.5 }),
      toneOf({ meanSaturation: 0.1 }),
    )

    expect(adjustment.saturation).toBe(CARD_HARMONY_LIMITS.saturation.min)
  })

  it('moves contrast toward a flatter reference, floored by the fixed limit', () => {
    const adjustment = computeCardHarmonyAdjustment(
      toneOf({ sdLuma: 0.3 }),
      toneOf({ sdLuma: 0.1 }),
    )

    expect(adjustment.contrast).toBe(CARD_HARMONY_LIMITS.contrast.min)
  })

  it('keeps the factor at 1 for a degenerate source stat instead of amplifying noise', () => {
    const adjustment = computeCardHarmonyAdjustment(
      toneOf({ sdLuma: 0, meanSaturation: 0 }),
      toneOf({ sdLuma: 0.3, meanSaturation: 0.5 }),
    )

    expect(adjustment.contrast).toBe(1)
    expect(adjustment.saturation).toBe(1)
  })

  it('is identity when either sample is empty', () => {
    expect(computeCardHarmonyAdjustment(toneOf({ samples: 0 }), toneOf())).toEqual(IDENTITY)
    expect(computeCardHarmonyAdjustment(toneOf(), toneOf({ samples: 0 }))).toEqual(IDENTITY)
  })

  it('falls back to 1 for non-finite stats', () => {
    const adjustment = computeCardHarmonyAdjustment(
      toneOf({ meanLuma: Number.NaN }),
      toneOf({ meanLuma: Number.NaN, sdLuma: Number.POSITIVE_INFINITY }),
    )

    expect(adjustment).toEqual(IDENTITY)
  })
})

describe('isCardHarmonyIdentity', () => {
  it('accepts the epsilon band on both sides', () => {
    const inside = CARD_HARMONY_IDENTITY_EPSILON - 0.001
    expect(
      isCardHarmonyIdentity({
        brightness: 1 + inside,
        contrast: 1 - inside,
        saturation: 1,
      }),
    ).toBe(true)
  })

  it('rejects factors outside the epsilon band', () => {
    const outside = CARD_HARMONY_IDENTITY_EPSILON + 0.001
    expect(isCardHarmonyIdentity({ ...IDENTITY, brightness: 1 + outside })).toBe(false)
    expect(isCardHarmonyIdentity({ ...IDENTITY, saturation: 1 - outside })).toBe(false)
  })
})

describe('applyCardPhotoHarmony', () => {
  it('copies alpha byte-for-byte and never mutates the input buffer', () => {
    const source = pixelsOf([
      [10, 20, 30, 7],
      [40, 50, 60, 200],
    ])
    const before = Uint8ClampedArray.from(source)

    const result = applyCardPhotoHarmony(source, {
      brightness: 1.08,
      contrast: 1,
      saturation: 1.1,
    })

    expect(source).toEqual(before)
    expect(result).not.toBe(source)
    expect(result[3]).toBe(7)
    expect(result[7]).toBe(200)
  })

  it('returns the same color for an identity adjustment', () => {
    const source = pixelsOf([
      [11, 22, 33],
      [200, 100, 50],
    ])

    expect([...applyCardPhotoHarmony(source, IDENTITY)]).toEqual([...source])
  })

  it('multiplies every channel by the brightness factor', () => {
    const result = applyCardPhotoHarmony(pixelsOf([[100, 100, 100]]), {
      ...IDENTITY,
      brightness: 1.08,
    })

    expect([...result]).toEqual([108, 108, 108, 255])
  })

  it('pushes values away from the mid range with the contrast factor', () => {
    const result = applyCardPhotoHarmony(
      pixelsOf([
        [0, 0, 0],
        [255, 255, 255],
      ]),
      { ...IDENTITY, contrast: 1.08 },
    )

    expect([...result]).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })

  it('collapses color into luma when saturation goes to zero', () => {
    const result = applyCardPhotoHarmony(pixelsOf([[200, 100, 50]]), {
      ...IDENTITY,
      saturation: 0,
    })

    expect([...result]).toEqual([118, 118, 118, 255])
  })

  it('spreads the channels apart when saturation goes up', () => {
    const source = pixelsOf([[200, 100, 50]])
    const saturated = applyCardPhotoHarmony(source, { ...IDENTITY, saturation: 1.2 })

    expect(saturated[0] - saturated[2]).toBeGreaterThan(source[0] - source[2])
    expect(saturated[1]).toBeLessThan(source[1])
  })

  it('keeps a neutral gray neutral whatever the saturation', () => {
    const result = applyCardPhotoHarmony(pixelsOf([[128, 128, 128]]), {
      ...IDENTITY,
      saturation: 1.12,
    })

    expect(result[0]).toBe(result[1])
    expect(result[1]).toBe(result[2])
  })

  it('clamps at both ends without wrapping', () => {
    const result = applyCardPhotoHarmony(
      pixelsOf([
        [250, 250, 250],
        [2, 2, 2],
      ]),
      { ...IDENTITY, brightness: 1.08, contrast: 1.08 },
    )

    expect([...result].slice(0, 7)).toEqual([255, 255, 255, 255, 0, 0, 0])
  })

  it('is deterministic across runs', () => {
    const source = pixelsOf([[123, 45, 210, 128]])
    const adjustment = { brightness: 1.04, contrast: 0.96, saturation: 1.08 }

    expect([...applyCardPhotoHarmony(source, adjustment)]).toEqual([
      ...applyCardPhotoHarmony(source, adjustment),
    ])
  })
})
