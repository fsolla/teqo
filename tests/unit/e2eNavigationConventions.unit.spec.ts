import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Miss #50 (public reopen of archive #54, 2026-07-30): a `page.goto` fired while
// the previous heavy RSC navigation was still in flight aborted with
// `net::ERR_ABORTED` (campaignSavedFilters, prod build). `goto` stays legal for
// cold loads and URL contracts — the anti-pattern is two gotos with NOTHING
// between them that settles the first navigation.
//
// Miss #49 (public reopen of archive #53, 2026-07-30): the biometrics probe is
// one-shot per island mount, so a ceremony that starts before the CDP virtual
// authenticator answers never sees the enrollment UI. Specs must
// `await addVirtualAuthenticator` *then* `await expectCampaignBiometricsReady`
// before the enrollment surface (Pass 5 hardening: call-site order).

const e2eRoot = resolve(process.cwd(), 'tests/e2e')

const specFiles = readdirSync(e2eRoot, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.e2e.spec.ts'))
  .map((entry) => resolve(entry.parentPath, entry.name))

const SETTLE_TOKENS = [
  'await expect(',
  'waitForURL(',
  '.click(',
  '.check(',
  '.fill(',
  '.press(',
  '.hover(',
  'clearCookies(',
  '.reload(',
  'campaign.login(',
  '.catch(',
  'await request.',
  'checkRadixWhenHydrated(',
  'expectCampaignBiometricsReady(',
] as const

describe('e2e navigation discipline (miss #50)', () => {
  it('never fires two page.goto without settling the first navigation', () => {
    const offenders: string[] = []

    for (const file of specFiles) {
      const lines = readFileSync(file, 'utf8').split('\n')
      let lastGoto: number | null = null
      let settledSince = false

      for (const [index, line] of lines.entries()) {
        if (SETTLE_TOKENS.some((token) => line.includes(token))) settledSince = true
        if (!line.includes('page.goto(')) continue
        if (lastGoto !== null && !settledSince) {
          offenders.push(
            `${relative(process.cwd(), file)}:${index + 1} (goto at ${lastGoto + 1} unsettled)`,
          )
        }
        lastGoto = index
        settledSince = false
      }
    }

    expect(
      offenders,
      'settle the first navigation (await expect/waitForURL/click…) before the next page.goto, or navigate in-shell (miss #50)',
    ).toEqual([])
  })
})

describe('e2e WebAuthn virtual authenticator (miss #49)', () => {
  it('registers the virtual authenticator before expectCampaignBiometricsReady', () => {
    const offenders: string[] = []

    for (const file of specFiles) {
      const source = readFileSync(file, 'utf8')
      // Call sites only — ignore the helper definition and doc comments.
      const addCall = source.search(/await\s+addVirtualAuthenticator\s*\(/)
      if (addCall < 0 && !source.includes('WebAuthn.addVirtualAuthenticator')) continue
      const effectiveAdd =
        addCall >= 0
          ? addCall
          : source.search(/\.send\(\s*['"]WebAuthn\.addVirtualAuthenticator['"]/)
      if (effectiveAdd < 0) continue
      const readyCall = source.search(/await\s+expectCampaignBiometricsReady\s*\(/)
      if (readyCall < 0 || readyCall < effectiveAdd) {
        offenders.push(relative(process.cwd(), file))
      }
    }

    expect(
      offenders,
      'await addVirtualAuthenticator(…) then await expectCampaignBiometricsReady(page) before the enrollment UI',
    ).toEqual([])
  })
})
