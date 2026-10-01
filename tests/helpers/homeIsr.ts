import type { APIRequestContext } from '@playwright/test'

/**
 * S39/S44 — the shared ISR poll of the specs that own home sections. The home
 * is served stale while it regenerates after a `revalidateTag` (slower under
 * the parallel suite), and a navigation that lands on the stale body never
 * refreshes its DOM. Poll the server HTML positively until it converges to the
 * expected state; the navigation that follows then always lands on the fresh
 * page. 12 attempts preserves the S1 convergence budget.
 */
export const waitForHomeHTML = async (
  request: APIRequestContext,
  baseUrl: string,
  includes: string[],
  excludes: string[] = [],
  attempts = 12,
): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await request.get(`${baseUrl}/`).catch(() => undefined)
    if (response?.ok()) {
      const html = await response.text()
      const allIncluded = includes.every((needle) => html.includes(needle))
      const anyExcluded = excludes.some((needle) => html.includes(needle))
      if (allIncluded && !anyExcluded) return
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  throw new Error(
    `A home não convergiu após ${attempts}s (includes: ${includes.join(', ')}, excludes: ${excludes.join(', ')}).`,
  )
}

/** The kill-switch/section-presence specialization of the HTML poll above. */
export const waitForHomeSection = async (
  request: APIRequestContext,
  baseUrl: string,
  section: string,
  expected: 'present' | 'absent',
  attempts = 12,
): Promise<void> => {
  const needle = `data-home-section="${section}"`

  try {
    await waitForHomeHTML(
      request,
      baseUrl,
      expected === 'present' ? [needle] : [],
      expected === 'present' ? [] : [needle],
      attempts,
    )
  } catch (error) {
    throw new Error(
      `A seção "${section}" da home não convergiu para "${expected}" em ${attempts}s (${(error as Error).message}).`,
    )
  }
}
