import { describe, expect, it } from 'vitest'

import {
  CARD_MODELS,
  NAME_CARD_SLOT,
  cardModelHref,
  getCardModel,
  isCardModelId,
} from '@/lib/cardModels'

describe('card model catalog (S13)', () => {
  it('exposes the three shipped models with unique ids', () => {
    expect(CARD_MODELS.map((model) => model.id)).toEqual([
      'eu-sou-solla',
      'perfil-quadrado',
      'perfil-retangular',
    ])
    expect(new Set(CARD_MODELS.map((model) => model.id)).size).toBe(CARD_MODELS.length)
  })

  it('serves every master from the local /cards asset folder', () => {
    for (const model of CARD_MODELS) {
      expect(model.assetSrc.startsWith('/cards/')).toBe(true)
    }
  })

  it('pins the real output dimensions of the masters (not the 1080 in the file names)', () => {
    expect(getCardModel('eu-sou-solla')).toMatchObject({ width: 1080, height: 1440, kind: 'name' })
    expect(getCardModel('perfil-quadrado')).toMatchObject({
      width: 1000,
      height: 1000,
      kind: 'photo',
    })
    expect(getCardModel('perfil-retangular')).toMatchObject({
      width: 1000,
      height: 1440,
      kind: 'photo',
    })
  })

  it('keeps the photo window measured from the transparent masters', () => {
    expect(getCardModel('perfil-quadrado')?.photoWindow).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 740,
    })
    expect(getCardModel('perfil-retangular')?.photoWindow).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 1044,
    })
    expect(getCardModel('eu-sou-solla')?.photoWindow).toBeUndefined()
  })

  it('guards the name slot geometry measured from the filled master', () => {
    expect(NAME_CARD_SLOT).toMatchObject({
      centerX: 570,
      capTop: 430,
      capHeight: 106,
      maxInkWidth: 714,
    })
  })

  it('sanitizes query-param values through isCardModelId', () => {
    expect(isCardModelId('eu-sou-solla')).toBe(true)
    expect(isCardModelId('perfil-quadrado')).toBe(true)
    expect(isCardModelId('perfil-retangular')).toBe(true)
    expect(isCardModelId('modelo-inventado')).toBe(false)
    expect(isCardModelId(['perfil-quadrado'])).toBe(false)
    expect(isCardModelId(undefined)).toBe(false)
  })

  it('builds the deep-link used by the home tiles', () => {
    expect(cardModelHref('perfil-quadrado')).toBe('/cards?model=perfil-quadrado')
  })
})
