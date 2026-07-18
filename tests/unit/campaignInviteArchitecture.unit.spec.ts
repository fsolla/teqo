// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveInviteConsent } from '@/utilities/campaignConsent'

const source = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')

const lineCount = (contents: string): number => contents.split(/\r?\n/).length

describe('campaign invite module boundaries', () => {
  const actionPath = 'src/app/(campaign)/campanha/actions/invite.ts'
  const modules = {
    repository: 'src/utilities/campaignInviteRepository.ts',
    creation: 'src/utilities/campaignInviteCreation.ts',
    redemption: 'src/utilities/campaignInviteRedemption.ts',
  } as const

  it('keeps privileged invite modules server-only and focused', () => {
    const repository = source(modules.repository)
    const creation = source(modules.creation)
    const redemption = source(modules.redemption)

    for (const contents of [repository, creation, redemption]) {
      expect(contents).toMatch(/^import ['"]server-only['"]/)
    }

    expect(repository).toContain('acquireTextAdvisoryLocks')
    expect(repository).toContain('hashCampaignInviteToken')
    expect(repository).toContain('UPDATE "campaign_invite"')
    expect(repository).not.toContain('generateCampaignInviteToken')
    expect(repository).not.toContain('buildCampaignInviteWhatsAppLink')

    expect(creation).toContain('reloadCampaignActor')
    expect(creation).toContain('requireLeadershipConsent')
    expect(creation).toContain('buildCampaignInviteWhatsAppLink')
    expect(creation).not.toContain('@payloadcms/db-postgres')

    expect(redemption).toContain('resolveInviteConsent')
    expect(redemption).toContain('assertContactPhoneAvailable')
    expect(redemption).toContain("role: 'lideranca'")
    expect(redemption).not.toContain('@payloadcms/db-postgres')
  })

  it('keeps the use-server entrypoint thin with only public actions exported', () => {
    const action = source(actionPath)
    const exports = [...action.matchAll(/^export const (\w+)/gm)]
      .map(([, name]) => name)
      .sort()

    expect(action).toMatch(/^['"]use server['"]/)
    expect(exports).toEqual([
      'createCampaignInvite',
      'redeemCampaignInviteAutofill',
      'redeemCampaignInviteLogin',
    ])
    expect(action).not.toContain('@payloadcms/db-postgres')
    expect(action).not.toContain('overrideAccess')
    expect(action).not.toContain('hashCampaignInviteToken')
    expect(action).not.toContain('password:')
    expect(lineCount(action)).toBeLessThanOrEqual(75)
  })

  it('keeps invite modules within their responsibility budgets', () => {
    expect(lineCount(source(modules.repository))).toBeLessThanOrEqual(160)
    expect(lineCount(source(modules.creation))).toBeLessThanOrEqual(150)
    expect(lineCount(source(modules.redemption))).toBeLessThanOrEqual(340)
  })

  it('preserves consent only for the exact configured version', () => {
    expect(
      resolveInviteConsent({
        existingConsentID: 7,
        existingConsentContentHash: 'stable-hash',
        configuredConsentID: 7,
        configuredConsentContentHash: 'stable-hash',
      }),
    ).toEqual({ shouldUpdate: false })

    expect(() =>
      resolveInviteConsent({
        existingConsentID: 7,
        existingConsentContentHash: 'old-hash',
        configuredConsentID: 7,
        configuredConsentContentHash: 'new-hash',
      }),
    ).toThrow('É necessário aceitar o consentimento.')
  })
})
