import { describe, expect, it } from 'vitest'

import {
  homeSearchShouldUnfocusOnBlur,
  homeSearchUiFocused,
} from '@/lib/campaignHomeSearchContract'

describe('homeSearchUiFocused', () => {
  it('is true when the input is focused without an active query', () => {
    expect(homeSearchUiFocused({ inputFocused: true, isActive: false })).toBe(true)
  })

  it('is true when the query is active even if the input lost focus', () => {
    expect(homeSearchUiFocused({ inputFocused: false, isActive: true })).toBe(true)
  })

  it('is false when blurred and query inactive', () => {
    expect(homeSearchUiFocused({ inputFocused: false, isActive: false })).toBe(false)
  })
})

describe('homeSearchShouldUnfocusOnBlur', () => {
  it('whenEmpty unfocuses only blank raw (B112 drawer)', () => {
    expect(homeSearchShouldUnfocusOnBlur('', 'whenEmpty', false)).toBe(true)
    expect(homeSearchShouldUnfocusOnBlur('  ', 'whenEmpty', false)).toBe(true)
    expect(homeSearchShouldUnfocusOnBlur('c', 'whenEmpty', false)).toBe(false)
    expect(homeSearchShouldUnfocusOnBlur('ca', 'whenEmpty', true)).toBe(false)
  })

  it('whenInactive follows isActive (Início)', () => {
    expect(homeSearchShouldUnfocusOnBlur('c', 'whenInactive', false)).toBe(true)
    expect(homeSearchShouldUnfocusOnBlur('ca', 'whenInactive', true)).toBe(false)
  })
})
