// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { resolvePoolModel } from '../../scripts/lib/agent-pool-models.mjs'

const API_MODELS = [
  {
    id: 'composer-2.5',
    aliases: ['composer-latest'],
    parameters: [{ id: 'fast', values: [{ value: 'false' }, { value: 'true' }] }],
  },
  {
    id: 'grok-4.5',
    parameters: [
      {
        id: 'effort',
        values: [{ value: 'low' }, { value: 'medium' }, { value: 'high' }],
      },
      { id: 'fast', values: [{ value: 'false' }, { value: 'true' }] },
    ],
  },
  {
    id: 'kimi-k3',
    parameters: [
      {
        id: 'reasoning',
        values: [{ value: 'low' }, { value: 'high' }, { value: 'max' }],
      },
    ],
  },
]

const composerStandard = {
  id: 'composer-2.5',
  params: [{ id: 'fast', value: 'false' }],
}

describe('resolvePoolModel', () => {
  it('resolves composer by exact id and alias, pinning fast=false', () => {
    expect(resolvePoolModel('composer-2.5', API_MODELS)).toEqual({
      model: composerStandard,
      requested: 'composer-2.5',
      usedFallback: false,
    })
    expect(resolvePoolModel('composer-latest', API_MODELS).model).toEqual(composerStandard)
  })

  it.each([
    ['cursor-grok-4.5-low', 'low'],
    ['cursor-grok-4.5-medium', 'medium'],
    ['cursor-grok-4.5-high', 'high'],
  ] as const)('maps %s → grok-4.5 effort=%s + fast=false', (slug, effort) => {
    expect(resolvePoolModel(slug, API_MODELS)).toEqual({
      model: {
        id: 'grok-4.5',
        params: [
          { id: 'effort', value: effort },
          { id: 'fast', value: 'false' },
        ],
      },
      requested: slug,
      usedFallback: false,
    })
  })

  it('maps kimi-k3-low → kimi-k3 reasoning=low (no fast param on kimi)', () => {
    expect(resolvePoolModel('kimi-k3-low', API_MODELS)).toEqual({
      model: { id: 'kimi-k3', params: [{ id: 'reasoning', value: 'low' }] },
      requested: 'kimi-k3-low',
      usedFallback: false,
    })
  })

  it('rejects -fast: strips suffix, resolves base with fast=false, warns', () => {
    const composerFast = resolvePoolModel('composer-2.5-fast', API_MODELS)
    expect(composerFast.model).toEqual(composerStandard)
    expect(composerFast.usedFallback).toBe(false)
    expect(composerFast.warn).toContain('-fast')

    const grokFast = resolvePoolModel('cursor-grok-4.5-high-fast', API_MODELS)
    expect(grokFast.model).toEqual({
      id: 'grok-4.5',
      params: [
        { id: 'effort', value: 'high' },
        { id: 'fast', value: 'false' },
      ],
    })
    expect(grokFast.warn).toContain('-fast')
    expect(grokFast.model.params?.find((param) => param.id === 'fast')?.value).toBe('false')
  })

  it('falls back when -fast base is also unknown', () => {
    const result = resolvePoolModel('modelo-inventado-fast', API_MODELS)
    expect(result.model).toEqual(composerStandard)
    expect(result.usedFallback).toBe(true)
    expect(result.warn).toContain('-fast')
  })

  it('falls back to composer-2.5 (fast=false) with a warn for unknown slugs', () => {
    const result = resolvePoolModel('modelo-inventado-9', API_MODELS)
    expect(result.model).toEqual(composerStandard)
    expect(result.requested).toBe('modelo-inventado-9')
    expect(result.usedFallback).toBe(true)
    expect(result.warn).toContain('fallback')
  })

  it('uses the default silently when the issue declares no model', () => {
    for (const absent of [undefined, null, '', '   ']) {
      const result = resolvePoolModel(absent, API_MODELS)
      expect(result.model).toEqual(composerStandard)
      expect(result.usedFallback).toBe(false)
      expect(result.warn).toBeUndefined()
    }
  })

  it('still emits canonical Cloud shapes (incl. fast=false) when the table is empty', () => {
    expect(resolvePoolModel('composer-2.5', [])).toEqual({
      model: composerStandard,
      requested: 'composer-2.5',
      usedFallback: false,
    })
    expect(resolvePoolModel('cursor-grok-4.5-medium', [])).toEqual({
      model: {
        id: 'grok-4.5',
        params: [
          { id: 'effort', value: 'medium' },
          { id: 'fast', value: 'false' },
        ],
      },
      requested: 'cursor-grok-4.5-medium',
      usedFallback: false,
    })
    expect(resolvePoolModel('kimi-k3-low', []).model).toEqual({
      id: 'kimi-k3',
      params: [{ id: 'reasoning', value: 'low' }],
    })
  })

  it('falls back for unknown slugs when the live table is unavailable', () => {
    const result = resolvePoolModel('qualquer-coisa', [])
    expect(result.model).toEqual(composerStandard)
    expect(result.warn).toContain('/v1/models')
  })

  it('ignores non-string frontmatter values', () => {
    const result = resolvePoolModel(42, API_MODELS)
    expect(result.model).toEqual(composerStandard)
    expect(result.usedFallback).toBe(false)
  })
})
