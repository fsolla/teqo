import { describe, expect, it } from 'vitest'

import {
  captureScenes,
  graphicScenes,
  normalizeShotList,
  shotListHash,
} from '../../scripts/lib/reelShotList.mjs'

// C196 — the shot list is the single source of truth of a reel: the schema is
// fail-closed and the hash identifies the rendered version (C195 ingests by it).

const rawGraphics = (overrides: Record<string, unknown> = {}) => ({
  hook: {
    eyebrow: 'FAÇA PARTE',
    headlineLines: ['Seu apoio', 'vira card'],
    accentIndex: 1,
    sub: 'Veja como criar o seu pelo celular.',
  },
  cta: {
    eyebrow: 'Seu card, sua voz',
    headlineLines: ['Agora é', 'com você.'],
    actionLines: ['Acesse o site pelo', 'link na bio'],
    sub: 'Escolha seu modelo, crie e compartilhe.',
    url: 'jorgesolla1313.com.br',
  },
  cover: {
    eyebrow: 'TUTORIAL DO SITE',
    headlineLines: ['Crie seu', 'card de', 'apoio.'],
    accentIndex: 2,
    sub: 'Seu nome ou sua foto, direto pelo celular.',
    tag: '#cards',
  },
  ...overrides,
})

const rawShotList = (overrides: Record<string, unknown> = {}) => ({
  slug: 'cards',
  title: 'Crie seu card de apoio',
  feature: 'cards',
  route: '/',
  fixture: { cardName: 'Joana' },
  graphics: rawGraphics(),
  scenes: [
    { id: 'hook', kind: 'graphic', template: 'hook', durationMs: 2400 },
    {
      id: 'step-1',
      kind: 'capture',
      badge: { number: 1, total: 3, label: 'Escolha um modelo' },
      caption: { parts: [{ text: 'Toque em ' }, { text: '“Card”', accent: true }] },
      setup: [{ action: 'scrollIntoView', selector: '#cards-title' }],
      steps: [{ action: 'click', selector: '[data-card-model-tile="eu-sou-solla"]' }],
    },
    { id: 'cta', kind: 'graphic', template: 'cta', durationMs: 3200 },
  ],
  ...overrides,
})

describe('reelShotList', () => {
  it('normalizes a valid shot list with defaults', () => {
    const shotList = normalizeShotList(rawShotList())
    expect(shotList.slug).toBe('cards')
    expect(shotList.route).toBe('/')
    expect(captureScenes(shotList)).toHaveLength(1)
    expect(graphicScenes(shotList)).toHaveLength(2)
    const scene = captureScenes(shotList)[0]
    expect(scene.leadInMs).toBe(700)
    expect(scene.trailOutMs).toBe(800)
    expect(scene.captionDelayMs).toBe(250)
    expect(scene.captionDurationMs).toBeNull()
    expect(scene.setup).toEqual([{ action: 'scrollIntoView', selector: '#cards-title' }])
  })

  it('hashes the normalized shot list deterministically', () => {
    const first = normalizeShotList(rawShotList())
    const second = normalizeShotList(rawShotList())
    expect(shotListHash(first)).toBe(shotListHash(second))
    const changed = normalizeShotList(rawShotList({ fixture: { cardName: 'Outra Pessoa' } }))
    expect(shotListHash(changed)).not.toBe(shotListHash(first))
  })

  it('requires the hook first and the CTA last', () => {
    expect(() =>
      normalizeShotList(
        rawShotList({
          scenes: [
            {
              id: 'step-1',
              kind: 'capture',
              badge: { number: 1, total: 1, label: 'Passo' },
              caption: { parts: [{ text: 'Toque.' }] },
              steps: [{ action: 'click', selector: '#a' }],
            },
          ],
        }),
      ),
    ).toThrow(/primeira cena deve ser o hook/)
  })

  it('rejects unknown actions and empty selectors', () => {
    expect(() =>
      normalizeShotList(
        rawShotList({
          scenes: [
            { id: 'hook', kind: 'graphic', template: 'hook', durationMs: 1000 },
            {
              id: 'step-1',
              kind: 'capture',
              badge: { number: 1, total: 1, label: 'Passo' },
              caption: { parts: [{ text: 'x' }] },
              steps: [{ action: 'explode', selector: '#a' }],
            },
            { id: 'cta', kind: 'graphic', template: 'cta', durationMs: 1000 },
          ],
        }),
      ),
    ).toThrow(/action "explode" inválida/)
    expect(() =>
      normalizeShotList(
        rawShotList({
          scenes: [
            { id: 'hook', kind: 'graphic', template: 'hook', durationMs: 1000 },
            {
              id: 'step-1',
              kind: 'capture',
              badge: { number: 1, total: 1, label: 'Passo' },
              caption: { parts: [{ text: 'x' }] },
              steps: [{ action: 'click', selector: '' }],
            },
            { id: 'cta', kind: 'graphic', template: 'cta', durationMs: 1000 },
          ],
        }),
      ),
    ).toThrow(/selector deve ser string não vazia/)
  })

  it('requires fixture.cardName when a fill step has no value', () => {
    const withoutFixture = rawShotList({ fixture: {} })
    const scenes = (withoutFixture.scenes as Array<Record<string, unknown>>).slice()
    scenes[1] = {
      ...scenes[1],
      steps: [{ action: 'fill', selector: 'role=textbox[name="Seu nome"]' }],
    }
    expect(() => normalizeShotList({ ...withoutFixture, scenes })).toThrow(/fixture.cardName/)
  })

  const withUpload = (step: Record<string, unknown>, overrides: Record<string, unknown> = {}) => {
    const base = rawShotList(overrides)
    const scenes = (base.scenes as Array<Record<string, unknown>>).slice()
    scenes[1] = { ...scenes[1], steps: [step] }
    return { ...base, scenes }
  }

  it('normalizes an upload step with the fixture.photo fallback', () => {
    const shotList = normalizeShotList(
      withUpload(
        { action: 'upload', selector: 'role=button[name="Escolher foto"]' },
        { fixture: { photo: 'scripts/reels/fixtures/profile-photo.png' } },
      ),
    )
    const step = captureScenes(shotList)[0].steps[0]
    expect(step.action).toBe('upload')
    expect(step.value).toBeUndefined()
  })

  it('accepts an inline upload value and hashes the fixture photo', () => {
    const inline = normalizeShotList(
      withUpload({
        action: 'upload',
        selector: '#foto',
        value: 'scripts/reels/fixtures/a.png',
      }),
    )
    expect(captureScenes(inline)[0].steps[0].value).toBe('scripts/reels/fixtures/a.png')

    const photoA = normalizeShotList(
      withUpload(
        { action: 'upload', selector: '#foto' },
        { fixture: { photo: 'scripts/reels/fixtures/profile-photo.png' } },
      ),
    )
    const photoB = normalizeShotList(
      withUpload(
        { action: 'upload', selector: '#foto' },
        { fixture: { photo: 'scripts/reels/fixtures/outra.png' } },
      ),
    )
    expect(shotListHash(photoA)).not.toBe(shotListHash(photoB))
  })

  it('requires fixture.photo when an upload step has no value', () => {
    expect(() =>
      normalizeShotList(withUpload({ action: 'upload', selector: '#foto' }, { fixture: {} })),
    ).toThrow(/fixture.photo/)
  })

  it('requires the copy of every used graphic template', () => {
    const graphics = rawGraphics()
    delete (graphics as Record<string, unknown>).cover
    expect(() => normalizeShotList(rawShotList({ graphics }))).toThrow(/graphics.cover/)
    const unknown = rawGraphics({ banner: { eyebrow: 'x', headlineLines: ['y'] } })
    expect(() => normalizeShotList(rawShotList({ graphics: unknown }))).toThrow(
      /graphics.banner não é um template válido/,
    )
  })

  it('normalizes the graphic copy and validates the accent line', () => {
    const shotList = normalizeShotList(rawShotList())
    expect(shotList.graphics.hook).toMatchObject({
      eyebrow: 'FAÇA PARTE',
      headlineLines: ['Seu apoio', 'vira card'],
      accentIndex: 1,
    })
    expect(shotList.graphics.cta.actionLines).toEqual(['Acesse o site pelo', 'link na bio'])

    const graphics = rawGraphics({
      hook: { eyebrow: 'x', headlineLines: ['uma linha'], accentIndex: 2 },
    })
    expect(() => normalizeShotList(rawShotList({ graphics }))).toThrow(/accentIndex/)

    const first = normalizeShotList(rawShotList())
    const changed = normalizeShotList(
      rawShotList({
        graphics: rawGraphics({
          hook: {
            eyebrow: 'FAÇA PARTE',
            headlineLines: ['Seu apoio', 'vira vídeo'],
            accentIndex: 1,
            sub: 'Veja como criar o seu pelo celular.',
          },
        }),
      }),
    )
    expect(shotListHash(changed)).not.toBe(shotListHash(first))
  })

  it('accepts a label-only badge and a swipe distance', () => {
    const base = rawShotList()
    const scenes = (base.scenes as Array<Record<string, unknown>>).slice()
    scenes[1] = {
      ...scenes[1],
      badge: { label: 'COMECE' },
      steps: [{ action: 'swipe', selector: '#track', distance: 300 }],
    }
    const shotList = normalizeShotList({ ...base, scenes })
    expect(captureScenes(shotList)[0].badge).toEqual({ label: 'COMECE' })
    expect(captureScenes(shotList)[0].steps[0].distance).toBe(300)

    const invalid = (base.scenes as Array<Record<string, unknown>>).slice()
    invalid[1] = { ...invalid[1], steps: [{ action: 'click', selector: '#a', distance: 300 }] }
    expect(() => normalizeShotList({ ...base, scenes: invalid })).toThrow(/distance/)
  })

  it('requires fixture.photo for the profile scene and normalizes its copy', () => {
    const profileCopy = {
      eyebrow: 'PASSO FINAL',
      headlineLines: ['Use a arte', 'no seu perfil.'],
      instruction: 'Escolha a imagem baixada como nova foto de perfil.',
      apps: ['Instagram', 'WhatsApp'],
    }
    const graphics = rawGraphics({ profile: profileCopy })
    const profileScene = {
      id: 'profile',
      kind: 'graphic',
      template: 'profile',
      durationMs: 4000,
    }
    const withoutPhoto = rawShotList({ graphics, fixture: {} })
    const withoutScenes = (withoutPhoto.scenes as Array<Record<string, unknown>>).slice()
    withoutScenes.splice(1, 0, profileScene)
    expect(() => normalizeShotList({ ...withoutPhoto, scenes: withoutScenes })).toThrow(
      /fixture.photo/,
    )

    const withPhoto = rawShotList({
      graphics,
      fixture: { photo: 'scripts/reels/fixtures/profile-photo.png' },
    })
    const withScenes = (withPhoto.scenes as Array<Record<string, unknown>>).slice()
    withScenes.splice(1, 0, profileScene)
    const shotList = normalizeShotList({ ...withPhoto, scenes: withScenes })
    expect(graphicScenes(shotList).map((scene: { template: string }) => scene.template)).toEqual([
      'hook',
      'profile',
      'cta',
    ])
    expect(shotList.graphics.profile).toMatchObject({
      accentIndex: null,
      apps: ['Instagram', 'WhatsApp'],
    })
  })

  it('rejects value on an action that takes no value', () => {
    const scenes = (rawShotList().scenes as Array<Record<string, unknown>>).slice()
    scenes[1] = {
      ...scenes[1],
      steps: [{ action: 'click', selector: '#a', value: 'não' }],
    }
    expect(() => normalizeShotList({ ...rawShotList(), scenes })).toThrow(/value só é válido/)
  })

  it('normalizes the narration and preserves the authored caption spacing', () => {
    const shotList = normalizeShotList(
      rawShotList({
        coverAlt: 'Alt próprio da capa',
        scenes: [
          { id: 'hook', kind: 'graphic', template: 'hook', durationMs: 1000, narration: ' Olá.' },
          {
            id: 'step-1',
            kind: 'capture',
            badge: { number: 1, total: 3, label: 'Escolha' },
            caption: { parts: [{ text: 'Toque em ' }, { text: '“Card”', accent: true }] },
            narration: 'Fale por cima.',
            steps: [{ action: 'click', selector: '#a' }],
          },
          { id: 'cta', kind: 'graphic', template: 'cta', durationMs: 1000 },
        ],
      }),
    )
    expect(shotList.coverAlt).toBe('Alt próprio da capa')
    expect(shotList.scenes[0]).toMatchObject({ narration: 'Olá.' })
    expect(captureScenes(shotList)[0]).toMatchObject({ narration: 'Fale por cima.' })
    expect(shotList.scenes[2]).toMatchObject({ narration: null })
    expect(captureScenes(shotList)[0].caption?.parts[0].text).toBe('Toque em ')
  })

  it('falls back coverAlt to the title and hashes the narration', () => {
    const shotList = normalizeShotList(rawShotList())
    expect(shotList.coverAlt).toBe(shotList.title)

    const scenes = (rawShotList().scenes as Array<Record<string, unknown>>).map((scene, index) =>
      index === 0 ? { ...scene, narration: 'Nova fala.' } : scene,
    )
    const withSpeech = normalizeShotList(rawShotList({ coverAlt: 'x', scenes }))
    expect(shotListHash(withSpeech)).not.toBe(shotListHash(shotList))
  })

  it('rejects an over-long narration', () => {
    expect(() =>
      normalizeShotList(
        rawShotList({
          scenes: [
            {
              id: 'hook',
              kind: 'graphic',
              template: 'hook',
              durationMs: 1000,
              narration: 'a'.repeat(601),
            },
            rawShotList().scenes[1],
            rawShotList().scenes[2],
          ],
        }),
      ),
    ).toThrow(/narration excede 600 caracteres/)
  })
})
