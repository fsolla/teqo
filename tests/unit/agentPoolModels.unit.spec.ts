// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { POOL_DEFAULT_MODEL_SLUG, resolvePoolModel } from '../../scripts/lib/agent-pool-models.mjs'

const API_MODELS = [
  { id: 'composer-2.5', aliases: ['composer-latest'], parameters: [{ id: 'fast' }] },
  { id: 'cursor-grok-4.5-high' },
  { id: 'kimi-k3-low' },
]

describe('resolvePoolModel', () => {
  it('resolves a declared slug by exact id', () => {
    expect(resolvePoolModel('kimi-k3-low', API_MODELS)).toEqual({
      model: { id: 'kimi-k3-low' },
      requested: 'kimi-k3-low',
      usedFallback: false,
    })
  })

  it('resolves by alias', () => {
    const result = resolvePoolModel('composer-latest', API_MODELS)
    expect(result.model).toEqual({ id: 'composer-2.5' })
    expect(result.usedFallback).toBe(false)
  })

  it('maps the repo -fast suffix to the fast param when the table supports it', () => {
    const result = resolvePoolModel('composer-2.5-fast', API_MODELS)
    expect(result.model).toEqual({
      id: 'composer-2.5',
      params: [{ id: 'fast', value: 'true' }],
    })
    expect(result.usedFallback).toBe(false)
  })

  it('falls back when the base of a -fast slug lacks the fast param', () => {
    const result = resolvePoolModel('kimi-k3-low-fast', API_MODELS)
    expect(result.model).toEqual({ id: POOL_DEFAULT_MODEL_SLUG })
    expect(result.usedFallback).toBe(true)
    expect(result.warn).toContain('kimi-k3-low-fast')
  })

  it('falls back to composer-2.5 with a warn for unknown slugs', () => {
    const result = resolvePoolModel('modelo-inventado-9', API_MODELS)
    expect(result.model).toEqual({ id: POOL_DEFAULT_MODEL_SLUG })
    expect(result.requested).toBe('modelo-inventado-9')
    expect(result.usedFallback).toBe(true)
    expect(result.warn).toContain('fallback')
  })

  it('uses the default silently when the issue declares no model', () => {
    for (const absent of [undefined, null, '', '   ']) {
      const result = resolvePoolModel(absent, API_MODELS)
      expect(result.model).toEqual({ id: POOL_DEFAULT_MODEL_SLUG })
      expect(result.usedFallback).toBe(false)
      expect(result.warn).toBeUndefined()
    }
  })

  it('still resolves when the live table is unavailable (degraded mode)', () => {
    const result = resolvePoolModel('qualquer-coisa', [])
    expect(result.model).toEqual({ id: POOL_DEFAULT_MODEL_SLUG })
    expect(result.warn).toContain('/v1/models')
  })

  it('ignores non-string frontmatter values', () => {
    const result = resolvePoolModel(42, API_MODELS)
    expect(result.model).toEqual({ id: POOL_DEFAULT_MODEL_SLUG })
    expect(result.usedFallback).toBe(false)
  })
})
