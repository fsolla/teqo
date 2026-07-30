import { describe, expect, it } from 'vitest'

// @ts-expect-error — plain .mjs data module, intentionally untyped
import {
  MINIMAL_CAMPAIGN_GOALS,
  MINIMAL_CAMPAIGN_USERS,
  MINIMAL_CONSENT_KEYS,
  MINIMAL_LEADERSHIPS,
  MINIMAL_MUNICIPALITIES,
  MINIMAL_ORGANIZATION,
  MINIMAL_STATE_DEPUTY,
  MINIMAL_SUPPORTERS,
} from '../../scripts/lib/seed-minimal-manifest.mjs'

import {
  CAMPAIGN_INVITE_CONSENT_KEY,
  SUPPORTER_REGISTRATION_CONSENT_KEY,
  SUPPORTER_VOTE_INTENTION_CONSENT_KEY,
  WHATSAPP_SUBSCRIPTION_CONSENT_KEY,
} from '@/lib/campaignConsentKeys'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'

/**
 * Guardrail for the "migration/schema without seed update" miss pattern: the
 * minimal-DB contract is data, pinned here, so a delivery that changes a
 * consent key, renames a municipality slug or drops a seeded role fails the
 * fast unit gate instead of only the slower PR-CI integration job.
 */
describe('seed-minimal manifest', () => {
  it('covers every fail-closed Consent key the app resolves at runtime', () => {
    expect([...MINIMAL_CONSENT_KEYS].sort()).toEqual(
      [
        CAMPAIGN_INVITE_CONSENT_KEY,
        SUPPORTER_REGISTRATION_CONSENT_KEY,
        SUPPORTER_VOTE_INTENTION_CONSENT_KEY,
        WHATSAPP_SUBSCRIPTION_CONSENT_KEY,
      ].sort(),
    )
  })

  it('seeds exactly one campaign user per role, with synthetic credentials only', () => {
    const roles = MINIMAL_CAMPAIGN_USERS.map((user: { role: string }) => user.role).sort()
    expect(roles).toEqual(['advisor', 'candidate', 'coordinator', 'leader'])
    for (const user of MINIMAL_CAMPAIGN_USERS) {
      if (user.email) expect(user.email).toMatch(/@teqo\.invalid$/)
      if (user.username) expect(user.username).toMatch(/^719999999\d\d$/)
    }
  })

  it('pins only slugs that exist in the municipality catalog', () => {
    expect(MINIMAL_MUNICIPALITIES.length).toBeGreaterThanOrEqual(3)
    expect(MINIMAL_MUNICIPALITIES.length).toBeLessThanOrEqual(5)
    const slugs = MINIMAL_MUNICIPALITIES.map((entry: { slug: string }) => entry.slug)
    expect(slugs).toContain('salvador-ze-1')
    expect(slugs).toContain('camacari')
    for (const slug of slugs) {
      expect(getMunicipalityCatalogEntry(slug), `slug ${slug}`).toBeDefined()
    }
    for (const entry of MINIMAL_MUNICIPALITIES) {
      const { pessimistic, central, optimistic } = entry.expectedVotes
      expect(pessimistic).toBeLessThanOrEqual(central)
      expect(central).toBeLessThanOrEqual(optimistic)
    }
  })

  it('references only pinned municipality slugs from org/leadership/supporter entries', () => {
    const pinned = new Set(MINIMAL_MUNICIPALITIES.map((entry: { slug: string }) => entry.slug))
    for (const slug of MINIMAL_ORGANIZATION.municipalitySlugs) expect(pinned.has(slug)).toBe(true)
    for (const leadership of MINIMAL_LEADERSHIPS) {
      for (const slug of leadership.municipalitySlugs) expect(pinned.has(slug)).toBe(true)
      expect(MINIMAL_CONSENT_KEYS).toContain(leadership.consentKey)
    }
    for (const supporter of MINIMAL_SUPPORTERS) {
      expect(pinned.has(supporter.municipalitySlug)).toBe(true)
      expect(MINIMAL_CONSENT_KEYS).toContain(supporter.consentKey)
      if (supporter.voteIntentionConsentKey) {
        expect(supporter.voteIntentionConsentKey).toBe(SUPPORTER_VOTE_INTENTION_CONSENT_KEY)
      }
    }
    expect(MINIMAL_STATE_DEPUTY.slug).toMatch(/^seed-/)
  })

  it('keeps the E8 campaign goals default sane', () => {
    expect(MINIMAL_CAMPAIGN_GOALS.stateGoal).toBeGreaterThan(0)
  })
})
