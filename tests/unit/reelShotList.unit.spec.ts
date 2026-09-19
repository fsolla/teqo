import { describe, expect, it } from 'vitest'

import {
  captureScenes,
  graphicScenes,
  normalizeShotList,
  shotListHash,
} from '../../scripts/lib/reelShotList.mjs'

// C196 — the shot list is the single source of truth of a reel: the schema is
// fail-closed and the hash identifies the rendered version (C195 ingests by it).

const rawShotList = (overrides: Record<string, unknown> = {}) => ({
  slug: 'cards',
  title: 'Crie seu card de apoio',
  feature: 'cards',
  route: '/',
  fixture: { cardName: 'Joana' },
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
})
