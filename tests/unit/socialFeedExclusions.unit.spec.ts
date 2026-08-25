import {
  validateExcludedItemId,
  YOUTUBE_VIDEO_ID_PATTERN,
} from '@/utilities/socialFeed/excludedItems'
import { describe, expect, it } from 'vitest'

describe('validateExcludedItemId', () => {
  it('accepts a valid 11-char youtube id', () => {
    expect(validateExcludedItemId('dQw4w9WgXcQ', { platform: 'youtube' })).toBe(true)
    expect(validateExcludedItemId('e2evideo001', { platform: 'youtube' })).toBe(true)
  })

  it('rejects youtube ids that are not 11 chars', () => {
    expect(validateExcludedItemId('e2e-video-excluido-4', { platform: 'youtube' })).toMatch(
      /11 caracteres/,
    )
    expect(validateExcludedItemId('short', { platform: 'youtube' })).toMatch(/11 caracteres/)
  })

  it('rejects a pasted youtube url as the id', () => {
    expect(
      validateExcludedItemId('https://youtube.com/watch?v=dQw4w9WgXcQ', { platform: 'youtube' }),
    ).toMatch(/11 caracteres/)
  })

  it('only validates for the youtube platform', () => {
    expect(validateExcludedItemId('anything-goes', { platform: 'instagram' })).toBe(true)
    expect(validateExcludedItemId('', { platform: 'youtube' })).toBe(true)
    expect(validateExcludedItemId(null, { platform: 'youtube' })).toBe(true)
    expect(validateExcludedItemId(undefined, { platform: 'youtube' })).toBe(true)
  })
})

describe('YOUTUBE_VIDEO_ID_PATTERN', () => {
  it('matches exactly 11 url-safe chars', () => {
    expect(YOUTUBE_VIDEO_ID_PATTERN.test('dQw4w9WgXcQ')).toBe(true)
    expect(YOUTUBE_VIDEO_ID_PATTERN.test('e2evideo001')).toBe(true)
    expect(YOUTUBE_VIDEO_ID_PATTERN.test('too-short')).toBe(false)
    expect(YOUTUBE_VIDEO_ID_PATTERN.test('e2e-video-excluido-4')).toBe(false)
  })
})
