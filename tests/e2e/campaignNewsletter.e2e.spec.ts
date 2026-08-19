import type { APIRequestContext } from '@playwright/test'

import { CAMPAIGN_NEWSLETTER_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import { adminHeaders } from '../helpers/adminApi'
import { seedTestUser } from '../helpers/seedUser'
import { expect, test } from './fixtures/e2eTest'

/**
 * S9 — the campaign home "novidades" capture: the hero CTA anchors the
 * section, the form records the contact + subscription with the engagement
 * level, and the page confirms in place. Runs the write through the deployed
 * server (server action + Local API) so the fail-closed consent path and the
 * transaction are the production ones.
 */
test.describe('Campaign home novidades capture', () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  const runSuffix = Date.now()
  // Unique 11-digit mobile per run (719 + 8 digits) so a crashed previous run
  // can never poison the by-phone lookups.
  const phoneDigits = String(runSuffix % 100_000_000).padStart(8, '0')
  const successPhone = `719${phoneDigits}`
  const successName = `E2e Novidades ${runSuffix}`

  let consentID: number | undefined

  const createNewsletterConsent = async (
    request: APIRequestContext,
    headers: Record<string, string>,
  ) => {
    // Self-healing lifecycle (S1 precedent): an aborted run could leave the
    // unique-key row behind and poison the next beforeAll — purge first. The
    // consent cannot be deleted while a subscription references it
    // (`subscription.consent_id` NOT NULL + FK SET NULL), so purge those too.
    const existing = await request.get(
      `${baseURL}/api/consent?where[key][equals]=${CAMPAIGN_NEWSLETTER_CONSENT_KEY}&limit=10&depth=0`,
      { headers },
    )
    if (existing.ok()) {
      const { docs } = await existing.json()
      for (const doc of docs) {
        const subscriptions = await request.get(
          `${baseURL}/api/subscription?where[consent][equals]=${doc.id}&limit=50&depth=0`,
          { headers },
        )
        if (subscriptions.ok()) {
          const { docs: subscriptionDocs } = await subscriptions.json()
          for (const subscription of subscriptionDocs) {
            await request.delete(`${baseURL}/api/subscription/${subscription.id}`, { headers })
          }
        }
        await request.delete(`${baseURL}/api/consent/${doc.id}`, { headers })
      }
    }

    const response = await request.post(`${baseURL}/api/consent`, {
      headers,
      data: {
        key: CAMPAIGN_NEWSLETTER_CONSENT_KEY,
        text: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'Consentimento de novidades da campanha (e2e).',
                    version: 1,
                  },
                ],
                direction: null,
                format: '',
                indent: 0,
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
    })
    expect(response.ok()).toBeTruthy()
    const { doc } = await response.json()
    consentID = doc.id
    return doc
  }

  const cleanup = async (request: APIRequestContext, headers: Record<string, string>) => {
    for (const phone of [successPhone]) {
      const contacts = await request.get(
        `${baseURL}/api/contact?where[phones.value][equals]=${phone}&limit=1&depth=0`,
        { headers },
      )
      if (contacts.ok()) {
        const { docs } = await contacts.json()
        const contact = docs[0]
        if (contact) {
          const subscriptions = await request.get(
            `${baseURL}/api/subscription?where[contact][equals]=${contact.id}&limit=1&depth=0`,
            { headers },
          )
          if (subscriptions.ok()) {
            const { docs: subscriptionDocs } = await subscriptions.json()
            if (subscriptionDocs[0]) {
              await request.delete(`${baseURL}/api/subscription/${subscriptionDocs[0].id}`, {
                headers,
              })
            }
          }
          await request.delete(`${baseURL}/api/contact/${contact.id}`, { headers })
        }
      }
    }
    if (consentID !== undefined) {
      await request.delete(`${baseURL}/api/consent/${consentID}`, { headers })
    }
  }

  test.beforeAll(async ({ request }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, baseURL)
    await createNewsletterConsent(request, headers)
  })

  test.afterAll(async ({ request }) => {
    const headers = await adminHeaders(request, baseURL).catch(() => undefined)
    if (headers) {
      await cleanup(request, headers)
    }
  })

  test('captures the visitor and confirms in place', async ({ page, request }) => {
    // Fresh load (unique query param bypasses the ISR fetch cache, same trick
    // as the content-section specs); the app ignores unknown params.
    await page.goto(`/?e2e=${runSuffix}`)
    await expect(page).toHaveURL(/\/\?e2e=/)

    const section = page.locator('[data-home-section="newsletter"]')
    await expect(
      section.getByRole('heading', { name: 'Receba as novidades da campanha' }),
    ).toBeVisible()

    // The hero CTA is the shortcut into the section (smooth anchor).
    await page.locator('[data-cta="secondary"]').click()
    await expect(page).toHaveURL(/#novidades$/)
    await expect(section).toBeInViewport()

    // The toggle is pre-selected: the default level is "time".
    const levelToggle = section.locator('#campaign-level')
    await expect(levelToggle).toBeChecked()

    await section.getByPlaceholder('Nome completo*').fill(successName)
    // Digits are formatted by the input itself; the schema normalizes back.
    await section.getByPlaceholder('WhatsApp (com DDD)*').fill(successPhone)
    await section.getByRole('button', { name: 'QUERO RECEBER NOVIDADES' }).click()

    await expect(section.getByRole('heading', { name: 'Inscrição confirmada' })).toBeVisible()

    // The success card keeps the bandeiras reachable (they sit above).
    const flagsLink = section.getByRole('link', { name: 'Ver bandeiras' })
    await expect(flagsLink).toHaveAttribute('href', '#bandeiras')

    // The record is visible to the admin with the level choice.
    const headers = await adminHeaders(request, baseURL)
    const contacts = await request.get(
      `${baseURL}/api/contact?where[phones.value][equals]=${successPhone}&limit=1&depth=0`,
      { headers },
    )
    expect(contacts.ok()).toBeTruthy()
    const { docs } = await contacts.json()
    const contact = docs[0]
    expect(contact).toBeDefined()
    // NameInput sanitizes/formatts the name on the way in (digits stripped).
    expect(contact.name.toLowerCase()).toContain('novidades')

    const subscriptions = await request.get(
      `${baseURL}/api/subscription?where[contact][equals]=${contact.id}&limit=1&depth=0`,
      { headers },
    )
    expect(subscriptions.ok()).toBeTruthy()
    const { docs: subscriptionDocs } = await subscriptions.json()
    expect(subscriptionDocs[0]).toBeDefined()
    expect(subscriptionDocs[0].campaignLevel).toBe('time')
    expect(
      typeof subscriptionDocs[0].consent === 'object'
        ? subscriptionDocs[0].consent.id
        : subscriptionDocs[0].consent,
    ).toBe(consentID)
  })
  // NOTE: the fail-closed refusal (consent missing → nothing written) is NOT
  // e2e-covered on purpose: the server action rejects with a 500, and the
  // suite's e2eFailureGuard treats same-origin 5xx as a failure (the WebAuthn
  // refusal precedent is a handled 4xx). The refusal path is pinned by the
  // int spec `submitCampaignNewsletter.int.spec.ts` (exact message + no rows).
})
