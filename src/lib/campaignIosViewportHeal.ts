/**
 * iOS standalone PWA viewport heal (B182).
 *
 * WebKit keeps the standalone visual viewport stuck at scale > 1 — at launch,
 * on bfcache resume, or after the keyboard auto-zoom fails to restore
 * (WebKit bug 237961 family / iOS 26 regressions). There is no viewport
 * policy that prevents it (the meta is already `width=device-width,
 * initial-scale=1`), so the fix is client-side: detect the stuck scale and
 * nudge WebKit back to 100%.
 *
 * Fail-safe by design: everything gates on iOS standalone, no-ops when the
 * scale is already 1, never heals while an editable is focused or a pinch is
 * recent (user zoom is a product anti-goal), and never throws.
 */

const CAMPAIGN_IOS_VIEWPORT_HEAL_MIN_SCALE = 1.02
export const CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS = 3
export const CAMPAIGN_IOS_VIEWPORT_HEAL_RETRY_MS = 250
export const CAMPAIGN_IOS_VIEWPORT_HEAL_PINCH_WINDOW_MS = 800
export const CAMPAIGN_IOS_VIEWPORT_HEAL_KEYBOARD_CLOSE_DELAY_MS = 350

/**
 * Documented fallback (product decision B): if the on-device verification
 * proves the heal cannot cure the stuck state on current iOS, flipping this
 * to true enables a selective `maximum-scale=1` meta rewrite — standalone
 * only, with the known WCAG tradeoff (pinch zoom dies in the PWA).
 */
const CAMPAIGN_IOS_VIEWPORT_HEAL_MAXIMUM_SCALE_FALLBACK = false

export const CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL = '__campaignIosViewportHeal'

type CampaignIosViewportHealState = {
  mounted: boolean
  standaloneIos: boolean
  lastScale: number
  healedCount: number
  lastHealAt: number | null
  lastHealReason: string | null
  lastSkippedReason: string | null
}

type CampaignIosViewportHealDebug = {
  state: CampaignIosViewportHealState
  healNow: (reason?: string) => boolean
}

declare global {
  interface Window {
    [CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]?: CampaignIosViewportHealDebug
  }
}

type HealReason = 'launch' | 'bfcache' | 'resume' | 'keyboard' | 'resize' | 'manual'

const isEditableElement = (element: Element | null): boolean => {
  if (!element) return false
  const tag = element.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return (element as HTMLElement).isContentEditable === true
}

export const isIosSafariStandalone = (win: Window): boolean => {
  const nav = win.navigator
  if ((nav as unknown as { standalone?: boolean }).standalone === true) return true
  const isIos =
    /iP(hone|ad|od)/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  if (!isIos) return false
  try {
    return win.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

export const getVisualViewportScale = (win: Window): number => {
  const visualViewport = win.visualViewport
  if (!visualViewport || typeof visualViewport.scale !== 'number') return 1
  return visualViewport.scale
}

export const shouldAttemptViewportHeal = (input: {
  scale: number
  editableFocused: boolean
  recentPinch: boolean
  minScale?: number
}): boolean => {
  const minScale = input.minScale ?? CAMPAIGN_IOS_VIEWPORT_HEAL_MIN_SCALE
  return input.scale > minScale && !input.editableFocused && !input.recentPinch
}

type InstallContext = {
  win: Window
  state: CampaignIosViewportHealState
  lastPinchAt: number
  keyboardWasOpen: boolean
  attemptsLeft: number
  retryTimer: number | null
  keyboardHealTimer: number | null
  healNow: (reason: HealReason) => boolean
}

const healDocument = (win: Window): void => {
  try {
    win.scrollTo(0, 0)
  } catch {
    // scrollTo can be a stub (jsdom) or absent in odd webviews — never throw.
  }
  try {
    const docEl = win.document.documentElement
    const previousHeight = docEl.style.height
    docEl.style.height = `${win.innerHeight}px`
    void docEl.offsetHeight
    docEl.style.height = previousHeight
  } catch {
    // Re-measure nudge is best effort; scale may already be healed by scrollTo.
  }
}

const createInstallContext = (win: Window, standaloneIos: boolean): InstallContext => {
  const state: CampaignIosViewportHealState = {
    mounted: true,
    standaloneIos,
    lastScale: getVisualViewportScale(win),
    healedCount: 0,
    lastHealAt: null,
    lastHealReason: null,
    lastSkippedReason: null,
  }
  const context: InstallContext = {
    win,
    state,
    lastPinchAt: 0,
    keyboardWasOpen: false,
    attemptsLeft: CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS,
    retryTimer: null,
    keyboardHealTimer: null,
    healNow: () => false,
  }
  context.healNow = (reason: HealReason): boolean => {
    if (!state.mounted) return false
    state.lastScale = getVisualViewportScale(win)
    const recentPinch =
      Date.now() - context.lastPinchAt < CAMPAIGN_IOS_VIEWPORT_HEAL_PINCH_WINDOW_MS
    const editableFocused = isEditableElement(win.document.activeElement)
    if (!shouldAttemptViewportHeal({ scale: state.lastScale, editableFocused, recentPinch })) {
      if (editableFocused) state.lastSkippedReason = 'editable-focused'
      else if (recentPinch) state.lastSkippedReason = 'recent-pinch'
      else state.lastSkippedReason = 'scale-ok'
      return false
    }
    healDocument(win)
    state.healedCount += 1
    state.lastHealAt = Date.now()
    state.lastHealReason = reason
    state.lastSkippedReason = null
    return true
  }
  return context
}

const scheduleRetry = (context: InstallContext, reason: HealReason): void => {
  if (context.retryTimer !== null) return
  context.retryTimer = context.win.setTimeout(() => {
    context.retryTimer = null
    if (context.attemptsLeft <= 0) return
    context.attemptsLeft -= 1
    if (context.healNow(reason)) scheduleRetry(context, reason)
  }, CAMPAIGN_IOS_VIEWPORT_HEAL_RETRY_MS)
}

/**
 * Each episode (launch, resume, bfcache, keyboard close, resize) gets a fresh
 * retry budget — a stuck episode may need several nudges, but one episode
 * must never starve the next.
 */
const attemptEpisodeHeal = (context: InstallContext, reason: HealReason): void => {
  context.attemptsLeft = CAMPAIGN_IOS_VIEWPORT_HEAL_MAX_ATTEMPTS
  if (context.healNow(reason)) scheduleRetry(context, reason)
}

export type CampaignIosViewportHealInstallOptions = {
  maximumScaleFallback?: boolean
}

/**
 * Wires the standalone iOS viewport heal; runs one launch heal immediately
 * (load/pageshow may have fired before React hydration) and then keeps
 * listening. Returns a teardown the React mount wires as the effect cleanup —
 * the campaign root never unmounts in the running app, so the cleanup only
 * fires in tests.
 */
export const installCampaignIosViewportHeal = (
  win: Window,
  options: CampaignIosViewportHealInstallOptions = {},
): (() => void) => {
  const maximumScaleFallback =
    options.maximumScaleFallback ?? CAMPAIGN_IOS_VIEWPORT_HEAL_MAXIMUM_SCALE_FALLBACK
  const standaloneIos = isIosSafariStandalone(win)
  const context = createInstallContext(win, standaloneIos)
  const { state } = context

  const debug: CampaignIosViewportHealDebug = {
    state,
    healNow: () => context.healNow('manual'),
  }

  if (!standaloneIos) {
    win[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL] = debug
    return () => {
      state.mounted = false
      delete win[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
    }
  }

  if (maximumScaleFallback) {
    const viewportMeta = win.document.querySelector('meta[name="viewport"]')
    viewportMeta?.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
    )
  }

  try {
    if (typeof win.history.scrollRestoration === 'string') {
      win.history.scrollRestoration = 'manual'
    }
  } catch {
    // Privacy modes can deny scrollRestoration writes.
  }

  const markPinch = (): void => {
    context.lastPinchAt = Date.now()
  }

  const onTouchStart = (event: TouchEvent): void => {
    if (event.touches && event.touches.length >= 2) markPinch()
  }

  const onTouchMove = (event: TouchEvent): void => {
    if (event.touches && event.touches.length >= 2) markPinch()
  }

  const onFocusIn = (event: FocusEvent): void => {
    if (isEditableElement(event.target as Element | null)) {
      context.keyboardWasOpen = true
    }
  }

  const onFocusOut = (): void => {
    if (!context.keyboardWasOpen) return
    context.keyboardWasOpen = false
    context.keyboardHealTimer = context.win.setTimeout(
      () => attemptEpisodeHeal(context, 'keyboard'),
      CAMPAIGN_IOS_VIEWPORT_HEAL_KEYBOARD_CLOSE_DELAY_MS,
    )
  }

  const onVisualViewportResize = (): void => {
    attemptEpisodeHeal(context, 'resize')
  }

  const onVisibilityChange = (): void => {
    if (win.document.visibilityState === 'visible') {
      attemptEpisodeHeal(context, 'resume')
    }
  }

  const onPageshow = (event: PageTransitionEvent): void => {
    attemptEpisodeHeal(context, event.persisted ? 'bfcache' : 'launch')
  }

  const onLoad = (): void => {
    attemptEpisodeHeal(context, 'launch')
  }

  win.addEventListener('gesturestart', markPinch)
  win.addEventListener('gesturechange', markPinch)
  win.addEventListener('gestureend', markPinch)
  win.addEventListener('touchstart', onTouchStart, { passive: true })
  win.addEventListener('touchmove', onTouchMove, { passive: true })
  win.document.addEventListener('focusin', onFocusIn, true)
  win.document.addEventListener('focusout', onFocusOut, true)
  win.visualViewport?.addEventListener('resize', onVisualViewportResize)
  win.addEventListener('visibilitychange', onVisibilityChange)
  win.addEventListener('pageshow', onPageshow)
  win.addEventListener('load', onLoad)

  attemptEpisodeHeal(context, 'launch')

  win[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL] = debug

  return () => {
    state.mounted = false
    if (context.retryTimer !== null) win.clearTimeout(context.retryTimer)
    if (context.keyboardHealTimer !== null) win.clearTimeout(context.keyboardHealTimer)
    win.removeEventListener('gesturestart', markPinch)
    win.removeEventListener('gesturechange', markPinch)
    win.removeEventListener('gestureend', markPinch)
    win.removeEventListener('touchstart', onTouchStart)
    win.removeEventListener('touchmove', onTouchMove)
    win.document.removeEventListener('focusin', onFocusIn, true)
    win.document.removeEventListener('focusout', onFocusOut, true)
    win.visualViewport?.removeEventListener('resize', onVisualViewportResize)
    win.removeEventListener('visibilitychange', onVisibilityChange)
    win.removeEventListener('pageshow', onPageshow)
    win.removeEventListener('load', onLoad)
    delete win[CAMPAIGN_IOS_VIEWPORT_HEAL_DEBUG_GLOBAL]
  }
}
