'use client'

import { useEffect } from 'react'

const MAX_ATTEMPTS = 5
const RETRY_DELAY_MS = 150
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' '])

/**
 * S12 — the campaign home owns its scroll container (`h-dvh overflow-y-auto`
 * on the (home) layout; the body is `overflow-hidden`), so the browser's
 * native fragment navigation — which scrolls the document — never lands on a
 * hash target. On a direct `/#novidades` load the mobile layout settles only
 * after the `h-dvh` reflow and the hero's eager images, kicking the page back
 * to the top. (`[type]`/`artigos` share the same scroll-container model; if
 * they ever gain in-page anchors they inherit this mechanism.)
 *
 * Owner of hash scrolling on the home: on mount it retries the initial hash
 * until the target is in view (stopping at the first user interaction), and a
 * `hashchange` listener covers in-page anchors (hero CTA, footer `#bandeiras`,
 * back/forward). `el.scrollIntoView()` without `behavior` inherits the
 * container's `scroll-smooth` / `motion-reduce:scroll-auto`, so
 * `prefers-reduced-motion` is honored with zero extra JS. Renders nothing.
 */
export const CampaignHashScroll = () => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let frame: number | undefined
    let attempt = 0

    const clearRetry = () => {
      if (timer !== undefined) clearTimeout(timer)
      if (frame !== undefined) cancelAnimationFrame(frame)
    }

    // Returns true when a scroll was issued and the retry should continue;
    // false when there is nothing to do (no hash, unknown target, or the
    // target is already in view).
    const scrollToHashIfNeeded = (): boolean => {
      const hash = window.location.hash
      if (hash.length < 2) return false
      let target: HTMLElement | null = null
      try {
        target = document.getElementById(decodeURIComponent(hash.slice(1)))
      } catch {
        return false
      }
      if (!target) return false
      const rect = target.getBoundingClientRect()
      if (rect.top >= -8 && rect.top < window.innerHeight - 8) return false
      target.scrollIntoView()
      return true
    }

    const retry = () => {
      clearRetry()
      if (attempt >= MAX_ATTEMPTS || !scrollToHashIfNeeded()) return
      attempt += 1
      // The mobile layout settles after the `h-dvh` reflow and the hero's
      // eager images; re-check after the frame has painted the scroll.
      frame = requestAnimationFrame(() => {
        timer = setTimeout(retry, RETRY_DELAY_MS)
      })
    }

    // Never fight the user: stop retrying at the first real interaction.
    // Programmatic `scrollIntoView` does not fire these, so the retry itself
    // never cancels itself. Reinstalled whenever a `hashchange` starts a new
    // retry, so every loop runs guarded.
    const stopRetrying = () => {
      clearRetry()
      window.removeEventListener('wheel', stopRetrying)
      window.removeEventListener('touchstart', stopRetrying)
      window.removeEventListener('pointerdown', stopRetrying)
      window.removeEventListener('keydown', stopOnScrollKey)
    }

    const stopOnScrollKey = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) stopRetrying()
    }

    const installInteractionGuards = () => {
      window.addEventListener('wheel', stopRetrying, { passive: true })
      window.addEventListener('touchstart', stopRetrying, { passive: true })
      window.addEventListener('pointerdown', stopRetrying, { passive: true })
      window.addEventListener('keydown', stopOnScrollKey)
    }

    const handleHashChange = () => {
      attempt = 0
      retry()
      installInteractionGuards()
    }

    window.addEventListener('hashchange', handleHashChange)
    installInteractionGuards()
    retry()

    return () => {
      clearRetry()
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('wheel', stopRetrying)
      window.removeEventListener('touchstart', stopRetrying)
      window.removeEventListener('pointerdown', stopRetrying)
      window.removeEventListener('keydown', stopOnScrollKey)
    }
  }, [])

  return null
}
