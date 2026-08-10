import { randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { BrowserContext, Fixtures, Page } from '@playwright/test'
import { getPayload, type CollectionSlug, type Payload, type PayloadRequest } from 'payload'

import { municipalityCatalog } from '../../../src/lib/municipalityCatalog.js'
import type { CampaignUser } from '../../../src/payload-types.js'
import config from '../../../src/payload.config.js'
import { withPayloadTransaction } from '../../../src/utilities/payloadTransaction.js'
import { assertTestDatabase } from '../../helpers/assertTestDatabase.js'
import { withInviteConsent } from '../../helpers/testDatabaseLease.js'
import { test as base, expect } from './e2eTest.js'

const defaultBaseURL = 'http://localhost:3000'

/**
 * The campaign session cookie name is owned by `src/utilities/campaignAuth.ts`
 * (CAMPAIGN_TOKEN_COOKIE) — the seeded cookie below must match it.
 */
const CAMPAIGN_TOKEN_COOKIE = 'campaign-token'
type TransactionRequest = Pick<PayloadRequest, 'transactionID'>
type OwnedCollection =
  | 'users'
  | 'campaignUser'
  | 'organization'
  | 'contact'
  | 'stateDeputy'
  | 'leadership'
  | 'votePledge'
  | 'campaignDemand'
  | 'allocationDecision'
  | 'municipalityUpdate'
  | 'activity'
  | 'campaignInvite'
  | 'consent'
  | 'supporter'
  | 'calendarFeed'
  | 'googleCalendarSync'

const deletionOrder: OwnedCollection[] = [
  'campaignInvite',
  'votePledge',
  'campaignDemand',
  'allocationDecision',
  'municipalityUpdate',
  'activity',
  'calendarFeed',
  'googleCalendarSync',
  'leadership',
  'supporter',
  'organization',
  'stateDeputy',
  'contact',
  'campaignUser',
  'consent',
  'users',
]

/**
 * Municipalities are SEEDED reference rows (435 from the static catalog): E2E tests
 * never create/delete them. `claimMunicipality` hands out a globally unique seeded
 * municipality per call (Postgres sequence — safe across parallel workers) and
 * cleanup resets the operational fields the test may have touched.
 *
 * OWNERSHIP CONTRACT: rows created through `fixtures.payload` (i.e. `campaign.payload`)
 * are auto-owned by the proxy below and deleted at cleanup — never call `own()` for
 * them (that is why the class exposes no public `own`). Rows created through the raw
 * `rootPayload` are NOT tracked. Shared stable-key consent rows are NEVER created
 * through the proxy: use `ensureLeasedConsent` (testDatabaseLease.ts) so cleanup
 * cannot rob a parallel spec of the shared row.
 */
export class CampaignE2EOwnership {
  readonly payload: Payload
  readonly runID = randomUUID()
  private counter = 0
  private readonly touchedMunicipalities = new Set<number>()
  private readonly owned = new Map<OwnedCollection, Set<number>>(
    deletionOrder.map((collection) => [collection, new Set<number>()]),
  )

  constructor(private readonly rootPayload: Payload) {
    this.payload = new Proxy(Object.create(rootPayload) as Payload, {
      get: (_target, property) => {
        if (property === 'create') {
          return async (args: Parameters<Payload['create']>[0]) => {
            const document = await rootPayload.create(args)
            if (this.isOwnedCollection(args.collection) && typeof document.id === 'number') {
              this.own(args.collection, document.id)
            }
            return document
          }
        }
        const value = Reflect.get(rootPayload, property)
        return typeof value === 'function' ? value.bind(rootPayload) : value
      },
    }) as Payload
  }

  value(prefix: string): string {
    this.counter += 1
    return `${prefix}-${this.runID}-${this.counter}`
  }

  phone(): string {
    this.counter += 1
    const seed = BigInt(`0x${this.runID.replaceAll('-', '').slice(0, 12)}`)
    const suffix = ((seed + BigInt(this.counter)) % 90_000_000n) + 10_000_000n
    return `719${suffix}`
  }

  /**
   * One campaign account with a deterministic generated password (returned for
   * the UI login) — replaces the ~28 hand-written `payload.create` blocks the
   * specs used to spell out per role. The proxy above auto-owns the row.
   */
  async createCampaignUser(
    role: CampaignUser['role'],
    input: { name?: string; email?: string; username?: string } = {},
  ): Promise<CampaignUser & { password: string }> {
    const password = this.value('password')
    const user = await this.payload.create({
      collection: 'campaignUser',
      data: {
        name: this.value(`Usuário ${role}`),
        email: `${this.value(role)}@example.com`,
        password,
        role,
        ...input,
      },
      depth: 0,
    })
    return { ...user, password }
  }

  async claimMunicipality(): Promise<{ id: number; name: string; slug: string }> {
    await this.rootPayload.db.drizzle
      .execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS "campaign_fixture_municipality_alloc"`))
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === '23505') return
        throw error
      })
    const result = await this.rootPayload.db.drizzle.execute(
      sql.raw(`SELECT nextval('"campaign_fixture_municipality_alloc"') AS "value"`),
    )
    const index =
      Number((result.rows[0] as { value: string | number }).value) % municipalityCatalog.length
    const slug = municipalityCatalog[index]!.slug
    const found = await this.rootPayload.find({
      collection: 'municipality',
      where: { slug: { equals: slug } },
      depth: 0,
      limit: 1,
      pagination: false,
    })
    const municipality = found.docs[0]
    if (!municipality)
      throw new Error(`Seeded municipality "${slug}" not found — run migrations first.`)
    this.touchedMunicipalities.add(municipality.id)
    // The catalog name, not the row's: since B34+ the chips label from
    // `municipalityCatalog`, so a row an int spec renamed and left behind would
    // make a specifier here miss the element the UI actually renders.
    return {
      id: municipality.id,
      name: municipalityCatalog[index]!.name,
      slug: municipality.slug,
    }
  }

  touchMunicipality(id: number): void {
    this.touchedMunicipalities.add(id)
  }

  /**
   * A leadership plus the `contact` it is required to point at — the pair every
   * spec that needs a row on `/campanha/liderancas` was writing out by hand.
   * Returns both, since assertions look the leadership up by id and find the row
   * by the contact's name.
   */
  async createStaffLeadership({
    namePrefix,
    municipalities,
    supportStatus = 'a_abordar',
    user,
  }: {
    namePrefix: string
    municipalities: { id: number; name: string }[]
    supportStatus?: 'a_abordar' | 'em_disputa' | 'lembranca' | 'engajado' | 'negativo'
    user?: number
  }): Promise<{ contactName: string; contactId: number; leadershipId: number }> {
    const contactName = this.value(namePrefix)
    const contact = await this.payload.create({
      collection: 'contact',
      data: {
        name: contactName,
        phones: [{ value: this.phone() }],
        state: 'BA',
        city: municipalities[0]?.name ?? 'Salvador',
      },
      depth: 0,
    })

    const leadership = await this.payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        municipalities: municipalities.map((municipality) => municipality.id),
        supportStatus,
        ...(user === undefined ? {} : { user }),
      },
      depth: 0,
    })

    return { contactName, contactId: contact.id, leadershipId: leadership.id }
  }

  private isOwnedCollection(collection: CollectionSlug): collection is OwnedCollection {
    return this.owned.has(collection as OwnedCollection)
  }

  private own(collection: OwnedCollection, id: number): void {
    this.owned.get(collection)!.add(id)
  }

  private ids(collection: OwnedCollection): number[] {
    return [...this.owned.get(collection)!]
  }

  private async discoverOwnedRows(): Promise<void> {
    const [users, campaignUsers, contacts, organizations, activities, consents] = await Promise.all(
      [
        this.rootPayload.find({
          collection: 'users',
          where: { email: { contains: this.runID } },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'campaignUser',
          where: {
            or: [
              { name: { contains: this.runID } },
              { email: { contains: this.runID } },
              { username: { contains: this.runID } },
            ],
          },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'contact',
          where: {
            or: [{ name: { contains: this.runID } }, { email: { contains: this.runID } }],
          },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'organization',
          where: {
            or: [{ name: { contains: this.runID } }, { slug: { contains: this.runID } }],
          },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'activity',
          where: {
            or: [{ title: { contains: this.runID } }, { slug: { contains: this.runID } }],
          },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'consent',
          where: { key: { contains: this.runID } },
          depth: 0,
          pagination: false,
        }),
      ],
    )
    for (const user of users.docs) this.own('users', user.id)
    for (const user of campaignUsers.docs) this.own('campaignUser', user.id)
    for (const contact of contacts.docs) this.own('contact', contact.id)
    for (const organization of organizations.docs) this.own('organization', organization.id)
    for (const activity of activities.docs) this.own('activity', activity.id)
    for (const consent of consents.docs) this.own('consent', consent.id)

    const userIDs = this.ids('campaignUser')
    const contactIDs = this.ids('contact')
    const stateDeputies = contactIDs.length
      ? await this.rootPayload.find({
          collection: 'stateDeputy',
          where: { contact: { in: contactIDs } },
          depth: 0,
          pagination: false,
        })
      : { docs: [] }
    for (const stateDeputy of stateDeputies.docs) this.own('stateDeputy', stateDeputy.id)
    const leaderships = await this.rootPayload.find({
      collection: 'leadership',
      where: {
        or: [
          ...(userIDs.length ? [{ createdBy: { in: userIDs } }] : []),
          ...(userIDs.length ? [{ user: { in: userIDs } }] : []),
          ...(contactIDs.length ? [{ contact: { in: contactIDs } }] : []),
        ],
      },
      depth: 0,
      pagination: false,
    })
    for (const leadership of leaderships.docs) this.own('leadership', leadership.id)

    const leadershipIDs = this.ids('leadership')
    if (leadershipIDs.length) {
      const [invites, pledges, demands] = await Promise.all([
        this.rootPayload.find({
          collection: 'campaignInvite',
          where: { leadership: { in: leadershipIDs } },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'votePledge',
          where: { leadership: { in: leadershipIDs } },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'campaignDemand',
          where: { leadership: { in: leadershipIDs } },
          depth: 0,
          pagination: false,
        }),
      ])
      for (const invite of invites.docs) this.own('campaignInvite', invite.id)
      for (const pledge of pledges.docs) this.own('votePledge', pledge.id)
      for (const demand of demands.docs) this.own('campaignDemand', demand.id)
    }
    if (userIDs.length) {
      const [updates, demands] = await Promise.all([
        this.rootPayload.find({
          collection: 'municipalityUpdate',
          where: { author: { in: userIDs } },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'campaignDemand',
          where: { createdBy: { in: userIDs } },
          depth: 0,
          pagination: false,
        }),
      ])
      for (const update of updates.docs) this.own('municipalityUpdate', update.id)
      for (const demand of demands.docs) this.own('campaignDemand', demand.id)
    }
    if (contactIDs.length || userIDs.length) {
      const supporters = await this.rootPayload.find({
        collection: 'supporter',
        where: {
          or: [
            ...(contactIDs.length ? [{ contact: { in: contactIDs } }] : []),
            ...(userIDs.length ? [{ createdBy: { in: userIDs } }] : []),
          ],
        },
        depth: 0,
        pagination: false,
      })
      for (const supporter of supporters.docs) this.own('supporter', supporter.id)
    }
    if (userIDs.length) {
      const feeds = await this.rootPayload.find({
        collection: 'calendarFeed',
        where: { createdBy: { in: userIDs } },
        depth: 0,
        pagination: false,
      })
      for (const feed of feeds.docs) this.own('calendarFeed', feed.id)
    }
  }

  async cleanup(): Promise<void> {
    await this.discoverOwnedRows()
    await withPayloadTransaction(this.rootPayload, async ({ req, transactionID }) => {
      const transaction = this.rootPayload.db.sessions?.[String(transactionID)]?.db as
        | { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }
        | undefined
      if (!transaction) throw new Error('Campaign E2E cleanup transaction is unavailable.')
      const userIDs = this.ids('campaignUser')
      if (userIDs.length) {
        await transaction.execute(sql`
          DELETE FROM "payload_preferences"
          WHERE "id" IN (
            SELECT "parent_id"
            FROM "payload_preferences_rels"
            WHERE "campaign_user_id" IN (${sql.join(
              userIDs.map((id) => sql`${id}`),
              sql`, `,
            )})
          )
        `)
      }
      for (const collection of deletionOrder) {
        const ids = this.ids(collection)
        if (!ids.length) continue
        const result = await this.rootPayload.delete({
          collection,
          where: { id: { in: ids } },
          depth: 0,
          req,
        })
        if (result.errors.length) {
          throw new AggregateError(result.errors, `Failed to clean owned ${collection} rows.`)
        }
      }
      const touched = await this.rootPayload.find({
        collection: 'municipality',
        where: { id: { in: [...this.touchedMunicipalities] } },
        depth: 0,
        pagination: false,
        select: { slug: true },
      })
      const catalogNameById = new Map(
        touched.docs.map((municipality) => [
          municipality.id,
          municipalityCatalog.find((entry) => entry.slug === municipality.slug)?.name,
        ]),
      )
      for (const municipalityID of this.touchedMunicipalities) {
        const catalogName = catalogNameById.get(municipalityID)
        await this.rootPayload.update({
          collection: 'municipality',
          id: municipalityID,
          // Same reset set as the int cleanup (tests/helpers/campaignFixtures.ts):
          // a field added there belongs here too — keep them in lockstep.
          data: {
            ...(catalogName ? { name: catalogName } : {}),
            advisors: [],
            priority: 'normal',
            expectedVotes: { pessimistic: null, central: null, optimistic: null },
            politicalTrend: { status: null, note: null, recordedBy: null, recordedAt: null },
            engagementLevel: null,
            levelNote: null,
            strengths: [],
            risks: [],
            stateDeputies: [],
            dobradinhaNotes: null,
            nextSteps: null,
            lastUpdateAt: null,
          },
          depth: 0,
          req,
        })
      }
    })
  }

  async expectNoOwnedRows(): Promise<void> {
    for (const collection of deletionOrder) {
      const ids = this.ids(collection)
      if (!ids.length) continue
      const remaining = await this.rootPayload.find({
        collection,
        where: { id: { in: ids } },
        depth: 0,
        limit: 1,
      })
      expect(remaining.totalDocs, `Owned ${collection} rows remain`).toBe(0)
    }
  }
}

/**
 * Waits for an auto-saving cell's write to actually land.
 *
 * Every cell in the B32+ family paints optimistically, so asserting on the text
 * proves nothing about the database — a `page.reload()` right after would race
 * the POST. Pair this with the interaction inside one `Promise.all`.
 */
export const expectPostResponse = (page: Page, urlFragment: string) =>
  page.waitForResponse(
    (response) =>
      response.url().includes(urlFragment) &&
      response.request().method() === 'POST' &&
      response.ok(),
  )

/**
 * Checks a Radix Checkbox only once the page has hydrated. A Radix checkbox is
 * a button whose hidden input is synced by React, so a click that lands BEFORE
 * hydration is a silent no-op (the SSR button has no handler) — the B13/B17
 * flake class. `toPass` retries the probe until the state sticks: pre-hydration
 * clicks change nothing, so the loop survives them; once hydration attaches,
 * the next click toggles and the loop ends. Safe because an already-checked
 * state short-circuits before any click.
 */
export const checkRadixWhenHydrated = async (page: Page, label: string) => {
  const checkbox = page.getByLabel(label)
  await expect(async () => {
    if ((await checkbox.getAttribute('data-state')) !== 'checked') {
      await checkbox.click({ timeout: 1_000 })
    }
    await expect(checkbox).toHaveAttribute('data-state', 'checked', { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

/**
 * Miss #53: the app's biometrics probe is ONE-SHOT per island mount
 * (`useCampaignBiometricsAvailable`) — if
 * `isUserVerifyingPlatformAuthenticatorAvailable()` resolves before the CDP
 * virtual authenticator is ready, the enrollment form / biometric button
 * never mount and no amount of waiting flips them. Gate the ceremony on the
 * platform answer BEFORE navigating into the surface whose island probes it,
 * so the race is decided before the app even asks. Requires a loaded page
 * (secure context) — call after `campaign.login` / `page.goto`.
 */
export const expectCampaignBiometricsReady = async (page: Page): Promise<void> => {
  await expect(async () => {
    const available = await page.evaluate(
      () => window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.() ?? false,
    )
    expect(available).toBe(true)
  }).toPass({ timeout: 15_000 })
}

export type CampaignSessionUser = CampaignUser & { password: string }

/**
 * OPS36 — session seeding. The shared-session journeys skip the browser login
 * round trip: `mintCampaignSession` goes through `payload.login` (the same
 * Local API path the real login action uses, so the session row and JWT are
 * exactly what the app validates) and `seedCampaignSession` injects the
 * resulting `campaign-token` cookie into a test context. The cookie mirrors
 * `campaignCookieOptions` in `src/utilities/campaignAuth.ts` (path `/campanha`,
 * httpOnly, sameSite lax; no `secure` on the http test origin).
 */
export const mintCampaignSession = async (
  payload: Payload,
  user: CampaignSessionUser,
): Promise<string> => {
  if (!user.email) {
    throw new Error('Campaign session seeding requires a user with an email.')
  }
  const { token } = await payload.login({
    collection: 'campaignUser',
    data: { email: user.email, password: user.password },
    depth: 0,
  })
  if (!token) {
    throw new Error('Campaign session seeding failed to obtain a session token.')
  }
  return token
}

export const seedCampaignSession = async (
  context: BrowserContext,
  baseURL: string,
  token: string,
): Promise<void> => {
  // `addCookies` accepts either `url` or `domain`+`path`, never both — and the
  // campaign cookie must live on `/campanha`, so the domain/path pair is used.
  await context.addCookies([
    {
      name: CAMPAIGN_TOKEN_COOKIE,
      value: token,
      domain: new URL(baseURL).hostname,
      path: '/campanha',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

/**
 * One ownership instance (own `runID`, own cleanup) wrapping the memoized
 * in-process Payload — the describe-level counterpart of the per-test
 * `campaign` fixture, for users shared across a journey group.
 */
export const createCampaignOwnership = async (): Promise<CampaignE2EOwnership> => {
  assertTestDatabase(process.env.DATABASE_URL)
  const payload = await getPayload({ config })
  return new CampaignE2EOwnership(payload)
}

export type CampaignE2EFixture = {
  baseURL: string
  fixtures: CampaignE2EOwnership
  login: (page: Page, identifier: string, password: string) => Promise<void>
  payload: Payload
  sessionFor: (context: BrowserContext, user: CampaignSessionUser) => Promise<void>
  transaction: <Result>(
    operation: (payload: Payload, req: TransactionRequest) => Promise<Result>,
  ) => Promise<Result>
  withInviteConsent: typeof withInviteConsent
}

type CampaignE2ETestFixtures = {
  campaign: CampaignE2EFixture
}

/**
 * The shared campaign ownership fixture (in-process Payload, auto-owned rows,
 * municipality claims, transactional cleanup). Exported so the browser suite
 * (`campaignE2EFixtures.ts`) and the browserless HTTP suite
 * (`campaignHttpTest.ts`) both extend from the same definition — never twin it.
 */
type CampaignE2EFixtureValue = Fixtures<CampaignE2ETestFixtures>['campaign']

export const campaignFixture: CampaignE2EFixtureValue = async ({}, runFixture) => {
  assertTestDatabase(process.env.DATABASE_URL)
  const payload = await getPayload({ config })
  const fixtures = new CampaignE2EOwnership(payload)
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL

  let testFailure: unknown
  try {
    await runFixture({
      baseURL,
      fixtures,
      login: async (page, identifier, password) => {
        await page.context().clearCookies()
        await page.goto(`${baseURL}/campanha/login`)
        // Dev-mode resilience (OPS30): Next dev compiles a route on its first
        // hit, and that compile can full-page-reload a connected client —
        // aborting the login POST before it lands (the mechanism documented
        // in setup.e2e.spec.ts). A budget-only wait cannot recover an aborted
        // submit, so on a navigation timeout we re-submit ONCE: the action is
        // warm by then. The grace wait absorbs a navigation that landed just
        // past the first wait, and the URL branch refuses a blind re-submit
        // against a page that left the login screen. Sub-budgets sum below
        // the 60 s test timeout, so a real credential failure surfaces as a
        // crisp wait error, not a generic test timeout. A second failure
        // surfaces — wrong credentials fail both attempts.
        const dashboardURL = `${baseURL}/campanha`
        const onDashboard = (url: string) => url === dashboardURL || url === `${dashboardURL}/`
        const submitLogin = async () => {
          await page.getByLabel('E-mail ou celular').fill(identifier)
          await page.getByLabel('Senha').fill(password)
          // `exact`: the login screen also offers "Entrar com digital ou Face
          // ID" (B40) whenever the device has a platform authenticator — which
          // any spec adding a virtual one does.
          await page.getByRole('button', { name: 'Entrar', exact: true }).click()
        }
        await submitLogin()
        try {
          await page.waitForURL(dashboardURL, { timeout: 15_000 })
        } catch {
          try {
            await page.waitForURL(dashboardURL, { timeout: 5_000 })
          } catch {
            const current = page.url()
            if (onDashboard(current)) return
            if (!current.startsWith(`${baseURL}/campanha/login`)) {
              throw new Error(`Login retry aborted: page left the login screen (${current}).`)
            }
            await submitLogin()
            await page.waitForURL(dashboardURL, { timeout: 30_000 })
          }
        }
      },
      payload: fixtures.payload,
      sessionFor: async (context, user) => {
        const token = await mintCampaignSession(payload, user)
        await seedCampaignSession(context, baseURL, token)
      },
      transaction: (operation) =>
        withPayloadTransaction(payload, ({ req }) => operation(fixtures.payload, req)),
      withInviteConsent,
    })
  } catch (error) {
    testFailure = error
    throw error
  } finally {
    let cleanupFailure: unknown
    try {
      assertTestDatabase(process.env.DATABASE_URL)
      await fixtures.cleanup()
      await fixtures.expectNoOwnedRows()
    } catch (error) {
      cleanupFailure = error
    }
    if (cleanupFailure !== undefined) {
      if (testFailure !== undefined) {
        throw new AggregateError(
          [testFailure, cleanupFailure],
          'Campaign E2E test and ownership cleanup both failed.',
        )
      }
      throw cleanupFailure
    }
  }
}

export const test = base.extend<CampaignE2ETestFixtures>({
  campaign: campaignFixture,
})

export const campaignPageChrome = (page: Page, title: string | RegExp) =>
  page
    .locator('[data-slot="campaign-page-chrome"]')
    .filter({ visible: true })
    .locator('[data-slot="campaign-page-chrome-title"]')
    .getByText(title, typeof title === 'string' ? { exact: true } : undefined)

export { expect }
