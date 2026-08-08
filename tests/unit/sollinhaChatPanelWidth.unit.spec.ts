import { afterEach, describe, expect, it } from 'vitest'

import {
  CHAT_DEFAULT_MAX_PX,
  CHAT_MIN_PX,
  clearSavedChatWidthPx,
  defaultChatWidthPx,
  getSavedChatWidthPx,
  resolveChatPanelWidthPx,
  saveChatWidthPx,
  SOLLINHA_CHAT_WIDTH_STORAGE_KEY,
} from '@/lib/sollinhaChatPanelWidth'

describe('sollinhaChatPanelWidth storage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when storage is missing or invalid', () => {
    expect(getSavedChatWidthPx()).toBeNull()
    localStorage.setItem(SOLLINHA_CHAT_WIDTH_STORAGE_KEY, 'not-json')
    expect(getSavedChatWidthPx()).toBeNull()
    localStorage.setItem(SOLLINHA_CHAT_WIDTH_STORAGE_KEY, JSON.stringify({ px: 520 }))
    expect(getSavedChatWidthPx()).toBeNull()
    localStorage.setItem(SOLLINHA_CHAT_WIDTH_STORAGE_KEY, JSON.stringify(-50))
    expect(getSavedChatWidthPx()).toBeNull()
    localStorage.setItem(SOLLINHA_CHAT_WIDTH_STORAGE_KEY, JSON.stringify(NaN))
    expect(getSavedChatWidthPx()).toBeNull()
  })

  it('records and reads the saved width (rounded)', () => {
    saveChatWidthPx(520.4)
    expect(getSavedChatWidthPx()).toBe(520)
    saveChatWidthPx(300)
    expect(getSavedChatWidthPx()).toBe(300)
  })

  it('clears the saved width', () => {
    saveChatWidthPx(360)
    clearSavedChatWidthPx()
    expect(getSavedChatWidthPx()).toBeNull()
    expect(localStorage.getItem(SOLLINHA_CHAT_WIDTH_STORAGE_KEY)).toBeNull()
  })
})

describe('defaultChatWidthPx', () => {
  it('caps the 25% default at CHAT_DEFAULT_MAX_PX', () => {
    expect(defaultChatWidthPx(1920)).toBe(CHAT_DEFAULT_MAX_PX)
    expect(defaultChatWidthPx(1920)).toBe(360)
    expect(defaultChatWidthPx(1440)).toBe(360)
  })

  it('stays at 25% when that is below the cap', () => {
    expect(defaultChatWidthPx(1280)).toBe(320)
    expect(defaultChatWidthPx(1200)).toBe(300)
  })

  it('never goes below CHAT_MIN_PX', () => {
    expect(defaultChatWidthPx(1000)).toBe(CHAT_MIN_PX)
    expect(defaultChatWidthPx(700)).toBe(CHAT_MIN_PX)
  })

  it('yields the group width for a group narrower than the floor', () => {
    expect(defaultChatWidthPx(200)).toBe(200)
  })
})

describe('resolveChatPanelWidthPx', () => {
  it('uses the capped 25% default when nothing is saved', () => {
    expect(resolveChatPanelWidthPx(1920, null)).toBe(360)
    expect(resolveChatPanelWidthPx(1280, null)).toBe(320)
  })

  it('lets a saved choice win even above the cap', () => {
    expect(resolveChatPanelWidthPx(1920, 520)).toBe(520)
  })

  it('clamps a saved choice to the group width', () => {
    expect(resolveChatPanelWidthPx(500, 900)).toBe(500)
  })

  it('clamps a saved choice below the floor up to CHAT_MIN_PX', () => {
    expect(resolveChatPanelWidthPx(1920, 150)).toBe(CHAT_MIN_PX)
  })

  it('yields the group width for a saved choice on a group narrower than the floor', () => {
    expect(resolveChatPanelWidthPx(200, 520)).toBe(200)
  })
})
