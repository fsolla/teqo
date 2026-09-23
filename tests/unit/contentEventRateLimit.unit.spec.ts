// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  checkContentEventRateLimit,
  contentEventClientKey,
} from '@/utilities/content/contentEventRateLimit'

afterEach(() => {
  vi.useRealTimers()
})

describe('contentEventClientKey', () => {
  it('reads the tunnel header first, then the first forwarded hop, then the real IP', () => {
    const keyOf = (headers: Record<string, string>) => contentEventClientKey(new Headers(headers))

    const tunnelKey = keyOf({ 'cf-connecting-ip': '203.0.113.9' })
    expect(tunnelKey).toMatch(/^[a-f0-9]{64}$/)

    // The same client behind the same header always hashes to the same key.
    expect(keyOf({ 'cf-connecting-ip': '203.0.113.9' })).toBe(tunnelKey)
    expect(keyOf({ 'cf-connecting-ip': '203.0.113.10' })).not.toBe(tunnelKey)

    expect(keyOf({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' })).toMatch(/^[a-f0-9]{64}$/)
    expect(keyOf({ 'x-real-ip': '192.0.2.7' })).toMatch(/^[a-f0-9]{64}$/)

    // No IP header at all: no key, never a shared bucket.
    expect(keyOf({})).toBeNull()
    expect(keyOf({ 'x-forwarded-for': '  ' })).toBeNull()
  })
})

describe('checkContentEventRateLimit', () => {
  it('fails open without a key and never throttles an unkeyed client', () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      expect(checkContentEventRateLimit(null)).toBe(true)
    }
  })

  it('throttles the 121st event of one client inside the window and leaves others alone', () => {
    const key = 'unit-window-client'
    for (let attempt = 0; attempt < 120; attempt += 1) {
      expect(checkContentEventRateLimit(key)).toBe(true)
    }
    expect(checkContentEventRateLimit(key)).toBe(false)
    expect(checkContentEventRateLimit(`${key}-other`)).toBe(true)
  })

  it('resets when the window expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-23T12:00:00.000Z'))

    const key = 'unit-reset-client'
    for (let attempt = 0; attempt < 120; attempt += 1) checkContentEventRateLimit(key)
    expect(checkContentEventRateLimit(key)).toBe(false)

    vi.setSystemTime(new Date('2026-09-23T12:10:00.001Z'))
    expect(checkContentEventRateLimit(key)).toBe(true)
  })
})
