import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { calendarDaySelector } from '../e2e/helpers/agendaPeriodLabels.js'

// Miss #54 (2026-07-30): a `page.goto` fired while the previous heavy RSC
// navigation was still in flight aborted with `net::ERR_ABORTED`
// (campaignSavedFilters, prod build). `goto` stays legal for cold loads and
// URL contracts — the anti-pattern is two gotos with NOTHING between them
// that settles the first navigation. A settle is any awaited interaction
// with the landed page (assertion, fill, click, reload, login…): it proves
// the previous route rendered before the next one starts.
//
// Miss #53 (2026-07-30): the biometrics probe is one-shot per island mount,
// so a ceremony that starts before the CDP virtual authenticator answers
// never sees the enrollment UI. Specs registering a virtual authenticator
// must gate on `expectCampaignBiometricsReady` first.

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

describe('e2e navigation discipline (miss #54)', () => {
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
      'settle the first navigation (await expect/waitForURL/click…) before the next page.goto, or navigate in-shell (miss #54)',
    ).toEqual([])
  })
})

describe('e2e WebAuthn virtual authenticator (miss #53)', () => {
  it('gates every virtual-authenticator spec on expectCampaignBiometricsReady', () => {
    const offenders: string[] = []

    for (const file of specFiles) {
      const source = readFileSync(file, 'utf8')
      if (!source.includes('WebAuthn.addVirtualAuthenticator')) continue
      if (source.includes('expectCampaignBiometricsReady(')) continue
      offenders.push(relative(process.cwd(), file))
    }

    expect(
      offenders,
      'call expectCampaignBiometricsReady(page) before the surface whose island probes the authenticator',
    ).toEqual([])
  })
})

// Miss #55 (2026-10-01): the C104 e2e clicked the calendar's end-day cell with
// `getByRole('button', { name: '2 de Outubro de 2026' })`. The accessible name
// ("sexta-feira, 2 de outubro de 2026") is a longer string and Playwright's
// name matcher is substring + case-insensitive by default, so days 12 and 22
// in the same grid matched too — a strict mode violation that only fired when
// "today + 1" landed on a single-digit day of the month (2026-10-02).
const AMBIGUOUS_DAY_NAME =
  /getByRole\('button',\s*\{\s*name:\s*(?:[A-Za-z_]*DayLabel\b|`[^`]*\bde\b[^`]*\$\{|"[^"]*\bde\b[^"]*20\d\d[^"]*"|'[^']*\bde\b[^']*20\d\d[^']*')/

describe('e2e calendar day-cell locator (miss #55)', () => {
  it('clicks calendar days through the data-day contract, never the date name', () => {
    const offenders: string[] = []

    for (const file of specFiles) {
      const lines = readFileSync(file, 'utf8').split('\n')
      for (const [index, line] of lines.entries()) {
        if (AMBIGUOUS_DAY_NAME.test(line)) {
          offenders.push(`${relative(process.cwd(), file)}:${index + 1}`)
        }
      }
    }

    expect(
      offenders,
      "click the day cell via calendarDaySelector ('[data-day=\"DD/MM/YYYY\"]') — the accessible name 'd de mês de ano' also matches 1d/2d (miss #55)",
    ).toEqual([])
  })

  it('builds the pt-BR data-day selector with a zero-padded day and month', () => {
    expect(calendarDaySelector('2026-10-02')).toBe('[data-day="02/10/2026"]')
    expect(calendarDaySelector('2026-01-31')).toBe('[data-day="31/01/2026"]')
  })
})
