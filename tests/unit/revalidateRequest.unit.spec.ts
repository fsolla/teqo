// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { getGlobalCacheTag } from '@/utilities/globals'
import { MUNICIPALITY_CATALOG_CACHE_TAG } from '@/utilities/municipality/municipalityCatalogCache'
import {
  REVALIDATE_POSTS_TAG,
  REVALIDATE_PRIVACY_POLICY_CACHE_TAG,
  resolveRevalidateTag,
} from '@/utilities/revalidateRequest'

describe('resolveRevalidateTag', () => {
  it('defaults to posts when no tag is provided', () => {
    expect(resolveRevalidateTag(null, null)).toEqual({ ok: true, tag: REVALIDATE_POSTS_TAG })
    expect(resolveRevalidateTag(undefined, undefined)).toEqual({
      ok: true,
      tag: REVALIDATE_POSTS_TAG,
    })
    expect(resolveRevalidateTag('', '')).toEqual({ ok: true, tag: REVALIDATE_POSTS_TAG })
  })

  it('accepts allowlisted tags from query or body', () => {
    expect(resolveRevalidateTag('posts', null)).toEqual({ ok: true, tag: REVALIDATE_POSTS_TAG })
    expect(resolveRevalidateTag(null, 'posts')).toEqual({ ok: true, tag: REVALIDATE_POSTS_TAG })
    expect(resolveRevalidateTag(null, REVALIDATE_PRIVACY_POLICY_CACHE_TAG)).toEqual({
      ok: true,
      tag: REVALIDATE_PRIVACY_POLICY_CACHE_TAG,
    })
    expect(resolveRevalidateTag(MUNICIPALITY_CATALOG_CACHE_TAG, null)).toEqual({
      ok: true,
      tag: MUNICIPALITY_CATALOG_CACHE_TAG,
    })
  })

  it('prefers query tag over body tag', () => {
    expect(resolveRevalidateTag('posts', REVALIDATE_PRIVACY_POLICY_CACHE_TAG)).toEqual({
      ok: true,
      tag: REVALIDATE_POSTS_TAG,
    })
  })

  it('rejects unknown tags', () => {
    const result = resolveRevalidateTag('global_metadata', null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Unknown tag')
      expect(result.error).toContain(REVALIDATE_POSTS_TAG)
      expect(result.error).toContain(REVALIDATE_PRIVACY_POLICY_CACHE_TAG)
    }
  })

  it('maps privacy-policy global slug to the shared cache tag helper', () => {
    expect(REVALIDATE_PRIVACY_POLICY_CACHE_TAG).toBe(getGlobalCacheTag('privacy-policy'))
  })
})
