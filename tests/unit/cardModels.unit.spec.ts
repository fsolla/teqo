import { describe, expect, it } from 'vitest'

import {
  CARD_MODELS,
  NAME_CARD_SLOT,
  TEAM_CARD_LABEL,
  TEAM_CARD_NAME_BANNER,
  TEAM_CARD_NAME_SLOT,
  getCardModel,
  isCardModelId,
} from '@/lib/cardModels'

describe('card model catalog (S13/S15)', () => {
  it('exposes the five shipped models with unique ids', () => {
    expect(CARD_MODELS.map((model) => model.id)).toEqual([
      'eu-sou-solla',
      'perfil-quadrado',
      'perfil-retangular',
      'time-de-voce',
      'time-do-estadual',
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
      align: 'left',
      leftX: 213,
      capTop: 430,
      capHeight: 106,
      maxInkWidth: 714,
    })
  })

  it('pins the team model, its overlay assets and the measured photo window', () => {
    expect(getCardModel('time-de-voce')).toMatchObject({
      kind: 'team',
      label: 'Time de você',
      assetSrc: '/cards/team-card-base.png',
      overlaySrc: '/cards/team-card-front.png',
      previewSrc: '/cards/team-card-example.jpg',
      width: 1080,
      height: 1440,
      photoWindow: { x: 286, y: 439, width: 592, height: 577 },
    })
    expect(getCardModel('eu-sou-solla')?.overlaySrc).toBeUndefined()
  })

  it('pins the S30 state-deputy model: same team geometry, picker flag and the approved example', () => {
    expect(getCardModel('time-do-estadual')).toMatchObject({
      kind: 'team',
      label: 'Time do estadual',
      assetSrc: '/cards/estaduais/julio-fotos.webp',
      overlaySrc: '/cards/estaduais/julio-base.webp',
      previewSrc: '/cards/modelo-time-de-voce-com-estadual.jpeg',
      stateDeputyPicker: true,
      badge: 'NOVO',
      width: 1080,
      height: 1440,
      photoWindow: { x: 286, y: 439, width: 592, height: 577 },
    })
    // The `NOVO` badge marks the newest model only (design gate scene 1).
    expect(getCardModel('time-de-voce')?.badge).toBeUndefined()
    expect(getCardModel('time-do-estadual')?.stateDeputyPicker).toBe(true)
    expect(getCardModel('time-de-voce')?.stateDeputyPicker).toBeUndefined()
  })

  it('guards the team banners and name slot measured from the example card', () => {
    expect(TEAM_CARD_LABEL).toMatchObject({
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
    })
    expect(TEAM_CARD_NAME_BANNER).toMatchObject({
      centerX: 545,
      centerY: 313,
      width: 509,
      maxWidth: 1000,
      height: 176,
      rotationDeg: -4.1,
      background: '#0061a5',
      fill: '#ffffff',
    })
    expect(TEAM_CARD_NAME_SLOT).toMatchObject({
      align: 'center',
      banner: TEAM_CARD_NAME_BANNER,
      capHeight: 130,
      minCapHeight: 40,
      maxInkWidth: 961,
      maxLines: 1,
      fill: '#ffffff',
    })
  })

  it('keeps the dynamic name banner ceiling inside the measured card bounds (S16)', () => {
    const model = getCardModel('time-de-voce')!
    const halfWidth = TEAM_CARD_NAME_BANNER.maxWidth / 2
    const halfHeight = TEAM_CARD_NAME_BANNER.height / 2
    const tilt = (Math.abs(TEAM_CARD_NAME_BANNER.rotationDeg) * Math.PI) / 180
    const halfSpanX = halfWidth * Math.cos(tilt) + halfHeight * Math.sin(tilt)
    const lowestCorner =
      TEAM_CARD_NAME_BANNER.centerY + halfHeight * Math.cos(tilt) + halfWidth * Math.sin(tilt)

    // The ceiling preserves the S15 ink padding: 1000 − 961 = 509 − 470 = 39.
    expect(TEAM_CARD_NAME_BANNER.maxWidth - TEAM_CARD_NAME_SLOT.maxInkWidth).toBe(39)
    expect(TEAM_CARD_NAME_BANNER.centerX - halfSpanX).toBeGreaterThanOrEqual(0)
    expect(TEAM_CARD_NAME_BANNER.centerX + halfSpanX).toBeLessThanOrEqual(model.width)
    expect(lowestCorner).toBeLessThan(model.photoWindow!.y)
  })

  it('sanitizes query-param values through isCardModelId', () => {
    expect(isCardModelId('eu-sou-solla')).toBe(true)
    expect(isCardModelId('perfil-quadrado')).toBe(true)
    expect(isCardModelId('perfil-retangular')).toBe(true)
    expect(isCardModelId('time-de-voce')).toBe(true)
    expect(isCardModelId('time-do-estadual')).toBe(true)
    expect(isCardModelId('modelo-inventado')).toBe(false)
    expect(isCardModelId(['perfil-quadrado'])).toBe(false)
    expect(isCardModelId(undefined)).toBe(false)
  })
})
