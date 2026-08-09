import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL,
  CAMPAIGN_IOS_VIEWPORT_HEAL_KEYBOARD_CLOSE_DELAY_MS,
  CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS,
  CAMPAIGN_IOS_VIEWPORT_HEAL_PINCH_WINDOW_MS,
  CAMPAIGN_IOS_VIEWPORT_HEAL_RETRY_MS,
  getVisualViewportScale,
  installCampaignIosViewportHeal,
  isIosSafariStandalone,
  shouldAttemptViewportHeal,
} from '@/lib/campaignIosViewportHeal'

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

const stubNavigator = (partial: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  standalone?: boolean
}): void => {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) jsdom',
    platform: 'Linux',
    maxTouchPoints: 0,
    standalone: undefined,
    ...partial,
  })
}

const stubMatchMedia = (matches: boolean): void => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches }))
}

const stubThrowingMatchMedia = (): void => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => {
      throw new Error('unavailable')
    }),
  )
}

const stubStandaloneProperty = (value: boolean): void => {
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value,
  })
}

const stubScrollRestoration = (value: string): void => {
  Object.defineProperty(window.history, 'scrollRestoration', {
    configurable: true,
    writable: true,
    value,
  })
}

let viewportStub: {
  scale: number
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

const setScale = (scale: number): void => {
  viewportStub.scale = scale
}

const clearVisualViewport = (): void => {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: undefined,
  })
}

const setVisible = (visible: boolean): void => {
  Object.defineProperty(window.document, 'visibilityState', {
    configurable: true,
    value: visible ? 'visible' : 'hidden',
  })
}

const appendViewportMeta = (): HTMLMetaElement => {
  const viewportMeta = document.createElement('meta')
  viewportMeta.name = 'viewport'
  viewportMeta.content = 'width=device-width, initial-scale=1'
  document.head.append(viewportMeta)
  return viewportMeta
}

let teardown: (() => void) | null = null

const installStandalone = (
  options?: Parameters<typeof installCampaignIosViewportHeal>[1],
): void => {
  stubStandaloneProperty(true)
  teardown = installCampaignIosViewportHeal(window, options)
}

const installNonStandalone = (): void => {
  teardown = installCampaignIosViewportHeal(window)
}

const focusInput = (): HTMLInputElement => {
  const input = document.createElement('input')
  document.body.append(input)
  input.focus()
  return input
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  setVisible(true)
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  viewportStub = {
    scale: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewportStub,
  })
  stubStandaloneProperty(false)
})

afterEach(() => {
  teardown?.()
  teardown = null
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  clearVisualViewport()
  setVisible(true)
})

describe('isIosSafariStandalone', () => {
  it('returns true when navigator.standalone is set (classic iOS PWA)', () => {
    stubStandaloneProperty(true)
    expect(isIosSafariStandalone(window)).toBe(true)
  })

  it('returns true for iOS UA + standalone display mode', () => {
    stubNavigator({ userAgent: IOS_UA, platform: 'iPhone' })
    stubMatchMedia(true)
    expect(isIosSafariStandalone(window)).toBe(true)
  })

  it('returns false for iOS UA without standalone display mode (Safari tab)', () => {
    stubNavigator({ userAgent: IOS_UA, platform: 'iPhone' })
    stubMatchMedia(false)
    expect(isIosSafariStandalone(window)).toBe(false)
  })

  it('returns false for a non-iOS UA even in standalone display mode', () => {
    stubNavigator({
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile',
      platform: 'Linux',
    })
    stubMatchMedia(true)
    expect(isIosSafariStandalone(window)).toBe(false)
  })

  it('returns true for iPadOS (MacIntel platform + touch) in standalone', () => {
    stubNavigator({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 5 })
    stubMatchMedia(true)
    expect(isIosSafariStandalone(window)).toBe(true)
  })

  it('returns false for a Mac without touch input', () => {
    stubNavigator({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 0 })
    stubMatchMedia(true)
    expect(isIosSafariStandalone(window)).toBe(false)
  })

  it('returns false when matchMedia throws', () => {
    stubNavigator({ userAgent: IOS_UA, platform: 'iPhone' })
    stubThrowingMatchMedia()
    expect(isIosSafariStandalone(window)).toBe(false)
  })
})

describe('getVisualViewportScale', () => {
  it('reads visualViewport.scale', () => {
    setScale(1.3)
    expect(getVisualViewportScale(window)).toBe(1.3)
  })

  it('returns 1 when the VisualViewport API is missing', () => {
    clearVisualViewport()
    expect(getVisualViewportScale(window)).toBe(1)
  })

  it('returns 1 when visualViewport.scale is not a number', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { scale: undefined },
    })
    expect(getVisualViewportScale(window)).toBe(1)
  })
})

describe('shouldAttemptViewportHeal', () => {
  it('heals when the scale is stuck and nothing blocks', () => {
    expect(
      shouldAttemptViewportHeal({ scale: 1.3, editableFocused: false, recentPinch: false }),
    ).toBe(true)
  })

  it('does not heal at scale 1', () => {
    expect(
      shouldAttemptViewportHeal({ scale: 1, editableFocused: false, recentPinch: false }),
    ).toBe(false)
  })

  it('does not heal while an editable is focused (keyboard open)', () => {
    expect(
      shouldAttemptViewportHeal({ scale: 1.3, editableFocused: true, recentPinch: false }),
    ).toBe(false)
  })

  it('does not heal right after a pinch (user zoom)', () => {
    expect(
      shouldAttemptViewportHeal({ scale: 1.3, editableFocused: false, recentPinch: true }),
    ).toBe(false)
  })

  it('honors an explicit minScale', () => {
    expect(
      shouldAttemptViewportHeal({
        scale: 1.01,
        editableFocused: false,
        recentPinch: false,
        minScale: 1,
      }),
    ).toBe(true)
  })
})

describe('installCampaignIosViewportHeal — non-standalone contexts', () => {
  it('installs a no-op debug surface without wiring any heal', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    installNonStandalone()
    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    expect(debug?.state.standaloneIos).toBe(false)
    expect(debug?.state.mounted).toBe(true)

    setScale(1.4)
    window.dispatchEvent(new Event('pageshow'))
    expect(scrollToSpy).not.toHaveBeenCalled()
    expect(debug?.state.healedCount).toBe(0)
  })

  it('keeps scrollRestoration untouched outside standalone', () => {
    stubScrollRestoration('auto')
    installNonStandalone()
    expect(window.history.scrollRestoration).toBe('auto')
  })

  it('teardown removes the debug global', () => {
    installNonStandalone()
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]).toBeDefined()
    teardown?.()
    teardown = null
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]).toBeUndefined()
  })
})

describe('installCampaignIosViewportHeal — standalone', () => {
  it('opts out of history scroll restoration', () => {
    stubScrollRestoration('auto')
    installStandalone()
    expect(window.history.scrollRestoration).toBe('manual')
  })

  it('heals immediately at install when already stuck (load/pageshow may predate hydration)', () => {
    setScale(1.3)
    installStandalone()
    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    expect(debug?.state.healedCount).toBe(1)
    expect(debug?.state.lastHealReason).toBe('launch')
  })

  it('heals on launch when the scale is stuck', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    installStandalone()
    setScale(1.4)
    window.dispatchEvent(new Event('pageshow'))

    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    expect(debug?.state.healedCount).toBe(1)
    expect(debug?.state.lastHealReason).toBe('launch')
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })

  it('heals on the load event', () => {
    installStandalone()
    setScale(1.3)
    window.dispatchEvent(new Event('load'))
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.state.lastHealReason).toBe('launch')
  })

  it('does nothing at scale 1', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    installStandalone()
    window.dispatchEvent(new Event('pageshow'))
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  it('heals on bfcache resume (pageshow persisted)', () => {
    installStandalone()
    setScale(1.2)
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.state.lastHealReason).toBe('bfcache')
  })

  it('heals when the app returns to the foreground', () => {
    installStandalone()
    setScale(1.2)
    setVisible(false)
    window.dispatchEvent(new Event('visibilitychange'))
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.state.healedCount).toBe(0)

    setVisible(true)
    window.dispatchEvent(new Event('visibilitychange'))
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.state.lastHealReason).toBe('resume')
  })

  it('retries up to the attempt budget while the scale stays stuck, then stops', () => {
    installStandalone()
    setScale(1.3)
    window.dispatchEvent(new Event('pageshow'))
    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    expect(debug?.state.healedCount).toBe(1)

    for (let i = 0; i < CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS; i += 1) {
      vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_RETRY_MS)
    }
    expect(debug?.state.healedCount).toBe(1 + CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS)
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_RETRY_MS)
    expect(debug?.state.healedCount).toBe(1 + CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops retrying once the scale heals', () => {
    installStandalone()
    setScale(1.3)
    window.dispatchEvent(new Event('pageshow'))
    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    expect(debug?.state.healedCount).toBe(1)

    setScale(1)
    vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_RETRY_MS)
    expect(debug?.state.healedCount).toBe(1)
    expect(debug?.state.lastSkippedReason).toBe('scale-ok')
  })

  it('gives each episode a fresh retry budget', () => {
    installStandalone()
    setScale(1.3)
    window.dispatchEvent(new Event('pageshow'))
    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    for (let i = 0; i < CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS; i += 1) {
      vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_RETRY_MS)
    }
    expect(debug?.state.healedCount).toBe(1 + CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS)

    window.dispatchEvent(new Event('pageshow'))
    expect(debug?.state.healedCount).toBe(2 + CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS)

    vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_RETRY_MS)
    expect(debug?.state.healedCount).toBe(3 + CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS)
  })

  it('skips the heal while an editable is focused', () => {
    installStandalone()
    focusInput()
    setScale(1.3)
    window.dispatchEvent(new Event('pageshow'))
    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    expect(debug?.state.healedCount).toBe(0)
    expect(debug?.state.lastSkippedReason).toBe('editable-focused')
  })

  it('skips the heal right after a pinch gesture', () => {
    installStandalone()
    setScale(1.3)
    window.dispatchEvent(new Event('gesturestart'))
    window.dispatchEvent(new Event('pageshow'))
    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    expect(debug?.state.healedCount).toBe(0)
    expect(debug?.state.lastSkippedReason).toBe('recent-pinch')

    vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_PINCH_WINDOW_MS)
    window.dispatchEvent(new Event('pageshow'))
    expect(debug?.state.healedCount).toBe(1)
  })

  it('keeps the pinch guard fresh for the whole gesture', () => {
    installStandalone()
    setScale(1.3)
    window.dispatchEvent(new Event('gesturestart'))
    vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_PINCH_WINDOW_MS + 100)
    window.dispatchEvent(new Event('gesturechange'))
    window.dispatchEvent(new Event('pageshow'))
    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    expect(debug?.state.healedCount).toBe(0)
    expect(debug?.state.lastSkippedReason).toBe('recent-pinch')
  })

  it('heals after the keyboard closes following an input interaction', () => {
    installStandalone()
    const input = focusInput()
    setScale(1.3)
    input.blur()
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.state.healedCount).toBe(0)

    vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_KEYBOARD_CLOSE_DELAY_MS)
    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    expect(debug?.state.healedCount).toBe(1)
    expect(debug?.state.lastHealReason).toBe('keyboard')
  })

  it('does not schedule a keyboard heal when the focus never touched an editable', () => {
    installStandalone()
    setScale(1.3)
    document.body.dispatchEvent(new Event('focusout'))
    vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_KEYBOARD_CLOSE_DELAY_MS)
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.state.healedCount).toBe(0)
  })

  it('heals on visualViewport resize while nothing is focused', () => {
    installStandalone()
    const resizeListener = viewportStub.addEventListener.mock.calls.find(
      ([name]) => name === 'resize',
    )?.[1]
    expect(resizeListener).toBeDefined()

    setScale(1.25)
    resizeListener()
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.state.lastHealReason).toBe('resize')
  })

  it('exposes a manual heal for on-device verification', () => {
    installStandalone()
    setScale(1.3)
    const healed = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.healNow()
    expect(healed).toBe(true)
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.state.lastHealReason).toBe('manual')

    setScale(1)
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.healNow()).toBe(false)
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?.state.lastSkippedReason).toBe(
      'scale-ok',
    )
  })

  it('teardown cancels pending retries and removes the debug global', () => {
    installStandalone()
    setScale(1.3)
    window.dispatchEvent(new Event('pageshow'))
    teardown?.()
    teardown = null
    expect(window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]).toBeUndefined()

    vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_RETRY_MS * 3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('teardown cancels a pending keyboard heal timer', () => {
    installStandalone()
    const input = focusInput()
    input.blur()
    const debug = window[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    teardown?.()
    teardown = null

    vi.advanceTimersByTime(CAMPAIGN_IOS_VIEWPORT_HEAL_KEYBOARD_CLOSE_DELAY_MS)
    expect(debug?.state.healedCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('applies the maximum-scale fallback only in standalone when opted in', () => {
    const viewportMeta = appendViewportMeta()
    installStandalone({ maximumScaleFallback: true })
    expect(viewportMeta.content).toContain('maximum-scale=1')
    expect(viewportMeta.content).toContain('user-scalable=no')
  })

  it('keeps the viewport meta untouched by default (fallback off)', () => {
    const viewportMeta = appendViewportMeta()
    installStandalone()
    expect(viewportMeta.content).toBe('width=device-width, initial-scale=1')
  })

  it('keeps the viewport meta untouched in non-standalone even when opted in', () => {
    const viewportMeta = appendViewportMeta()
    teardown = installCampaignIosViewportHeal(window, { maximumScaleFallback: true })
    expect(viewportMeta.content).toBe('width=device-width, initial-scale=1')
  })
})
