import { describe, expect, it } from 'vitest'

import { homeSearchUiFocused } from '@/lib/campaignHomeSearchContract'

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
