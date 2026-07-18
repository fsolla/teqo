import { createHash, randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, RequiredDataFromCollectionSlug, Where } from 'payload'
import { afterEach, beforeEach } from 'vitest'

import type {
  CampaignInvite,
  CampaignUser,
  Consent,
  Contact,
  ElectoralNucleus,
  Leadership,
  NucleusUpdate,
  Supporter,
  User,
} from '@/payload-types'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

type CampaignCollection =
  | 'users'
  | 'campaignInvite'
  | 'nucleusUpdate'
  | 'actionPlan'
  | 'leadership'
  | 'supporter'
  | 'electoralNucleus'
  | 'contact'
  | 'campaignUser'
  | 'consent'

type OwnedIDs = Record<CampaignCollection, Set<number>>

type CampaignUserInput = Partial<
  Pick<CampaignUser, 'name' | 'role' | 'phone' | 'email' | 'username' | 'password'>
>
type AdminUserInput = Partial<Pick<User, 'email' | 'password'>>
type ConsentInput = Partial<Pick<Consent, 'key' | 'text'>>
type ContactInput = Partial<
  Pick<Contact, 'name' | 'email' | 'phone' | 'gender' | 'state' | 'city' | 'postalCode'>
>
type NucleusInput = Partial<RequiredDataFromCollectionSlug<'electoralNucleus'>>
type LeadershipInput = Partial<
  Pick<
    Leadership,
    | 'contact'
    | 'nucleus'
    | 'sector'
    | 'sectorNotes'
    | 'supportStatus'
    | 'user'
    | 'consent'
    | 'consentContentHash'
    | 'consentedAt'
    | 'notes'
    | 'consentNote'
    | 'createdBy'
  >
> &
  Pick<Leadership, 'contact' | 'nucleus'>
type NucleusUpdateInput = Partial<
  Pick<
    NucleusUpdate,
    'kind' | 'worked' | 'failed' | 'needs' | 'activeVolunteers' | 'newSupports' | 'body'
  >
> &
  Pick<NucleusUpdate, 'nucleus' | 'author'>
type CampaignInviteInput = Partial<
  Pick<CampaignInvite, 'tokenHash' | 'kind' | 'expiresAt' | 'usedAt' | 'revokedAt'>
> &
  Pick<CampaignInvite, 'leadership' | 'createdBy'>

const processRunID = randomUUID()
let builderCounter = 0

const emptyOwnedIDs = (): OwnedIDs => ({
  users: new Set(),
  campaignInvite: new Set(),
  nucleusUpdate: new Set(),
  actionPlan: new Set(),
  leadership: new Set(),
  supporter: new Set(),
  electoralNucleus: new Set(),
  contact: new Set(),
  campaignUser: new Set(),
  consent: new Set(),
})

const inviteConsentKey = 'lideranca-autopreenchimento'

const defaultConsentText = (text: string): Consent['text'] => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text, version: 1 }],
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
})

const relationshipID = (value: number | { id: number }): number =>
  typeof value === 'number' ? value : value.id

const bulkErrors = (result: unknown): unknown[] => {
  if (
    typeof result === 'object' &&
    result !== null &&
    'errors' in result &&
    Array.isArray(result.errors)
  ) {
    return result.errors
  }
  return []
}

const combineErrors = (primary: unknown, cleanup: unknown): AggregateError =>
  new AggregateError([primary, cleanup], 'Campaign fixture callback and cleanup both failed.')

export class CampaignFixtures {
  readonly payload: Payload
  readonly runID: string

  private cleaned = false
  private counter = 0
  private readonly markers = new Set<string>()
  private readonly owned = emptyOwnedIDs()
  private readonly ownedLockedDocuments = new Set<number>()
  private readonly ownedPreferences = new Set<number>()

  constructor(private readonly rootPayload: Payload) {
    builderCounter += 1
    this.runID = `${processRunID}-${builderCounter}`
    const trackedCreate = async (args: Parameters<Payload['create']>[0]) => {
      const document = await rootPayload.create(args as never)
      const collection = args.collection
      const isLeasedInviteConsent =
        collection === 'consent' &&
        typeof args.data === 'object' &&
        args.data !== null &&
        'key' in args.data &&
        args.data.key === inviteConsentKey
      if (collection in this.owned && typeof document.id === 'number' && !isLeasedInviteConsent) {
        this.own(collection as CampaignCollection, document.id)
      }
      return document
    }
    let currentCreate: unknown = trackedCreate
    this.payload = new Proxy(Object.create(rootPayload) as Payload, {
      get: (_target, property) => {
        if (property === 'create') return currentCreate
        const value = Reflect.get(rootPayload, property)
        return typeof value === 'function' ? value.bind(rootPayload) : value
      },
      set: (_target, property, value) => {
        if (property === 'create') {
          currentCreate = value
          return true
        }
        return Reflect.set(rootPayload, property, value)
      },
      defineProperty: (_target, property, descriptor) => {
        if (property === 'create') {
          currentCreate = descriptor.value
          return true
        }
        return Reflect.defineProperty(rootPayload, property, descriptor)
      },
      deleteProperty: (_target, property) => {
        if (property === 'create') {
          currentCreate = trackedCreate
          return true
        }
        return Reflect.deleteProperty(rootPayload, property)
      },
      getOwnPropertyDescriptor: (_target, property) => {
        if (property === 'create') {
          return {
            configurable: true,
            enumerable: true,
            value: currentCreate,
            writable: true,
          }
        }
        return Reflect.getOwnPropertyDescriptor(rootPayload, property)
      },
    }) as Payload
  }

  value(prefix: string): string {
    this.counter += 1
    const value = `${prefix}-${this.runID}-${this.counter}`
    this.markers.add(value)
    return value
  }

  phone(): string {
    const digest = createHash('sha256').update(this.value('phone')).digest('hex')
    const subscriber = (BigInt(`0x${digest.slice(0, 12)}`) % 90_000_000n) + 10_000_000n
    const phone = `719${subscriber}`
    this.markers.add(phone)
    return phone
  }

  id(value: number | { id: number }): number {
    return relationshipID(value)
  }

  own(collection: CampaignCollection, value: number | { id: number }): void {
    this.owned[collection].add(relationshipID(value))
  }

  ownedIDs(collection: CampaignCollection): number[] {
    return [...this.owned[collection]]
  }

  private hasMarker(...values: (string | null | undefined)[]): boolean {
    return values.some(
      (value) =>
        value !== null &&
        value !== undefined &&
        [...this.markers].some((marker) => value.includes(marker)),
    )
  }

  private async discoverMarkedRoots(): Promise<void> {
    const roots = await Promise.all([
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
            { phone: { contains: this.runID } },
          ],
        },
        depth: 0,
        pagination: false,
      }),
      this.rootPayload.find({
        collection: 'contact',
        where: {
          or: [
            { name: { contains: this.runID } },
            { email: { contains: this.runID } },
            { phone: { contains: this.runID } },
          ],
        },
        depth: 0,
        pagination: false,
      }),
      this.rootPayload.find({
        collection: 'electoralNucleus',
        where: {
          or: [{ name: { contains: this.runID } }, { slug: { contains: this.runID } }],
        },
        depth: 0,
        pagination: false,
      }),
      this.rootPayload.find({
        collection: 'actionPlan',
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
    ])

    for (const user of roots[0].docs) this.own('users', user)
    for (const user of roots[1].docs) this.own('campaignUser', user)
    for (const contact of roots[2].docs) this.own('contact', contact)
    for (const nucleus of roots[3].docs) this.own('electoralNucleus', nucleus)
    for (const plan of roots[4].docs) this.own('actionPlan', plan)
    for (const consent of roots[5].docs) this.own('consent', consent)
  }

  async createCampaignUser(
    role: CampaignUser['role'] = 'lideranca',
    input: CampaignUserInput = {},
  ): Promise<CampaignUser> {
    const user = await this.rootPayload.create({
      collection: 'campaignUser',
      data: {
        name: this.value(`Usuário ${role}`),
        email: `${this.value(role)}@example.com`,
        password: this.value('password'),
        role,
        ...input,
      },
      depth: 0,
    })
    this.own('campaignUser', user)
    return user
  }

  async createAdminUser(input: AdminUserInput = {}): Promise<User> {
    const user = await this.rootPayload.create({
      collection: 'users',
      data: {
        email: `${this.value('admin')}@example.com`,
        password: this.value('password'),
        ...input,
      },
      depth: 0,
    })
    this.own('users', user)
    return user
  }

  async createConsent(input: ConsentInput = {}): Promise<Consent> {
    const marker = this.value('consent')
    const consent = await this.rootPayload.create({
      collection: 'consent',
      data: {
        key: marker,
        text: defaultConsentText(marker),
        ...input,
      },
      depth: 0,
    })
    this.own('consent', consent)
    return consent
  }

  async createContact(input: ContactInput = {}): Promise<Contact> {
    const contact = await this.rootPayload.create({
      collection: 'contact',
      data: {
        name: this.value('Contato'),
        phone: this.phone(),
        state: 'BA',
        city: 'Salvador',
        ...input,
      },
      depth: 0,
    })
    this.own('contact', contact)
    return contact
  }

  async createNucleus(input: NucleusInput = {}): Promise<ElectoralNucleus> {
    const name = input.name ?? this.value('Núcleo')
    const data: RequiredDataFromCollectionSlug<'electoralNucleus'> = {
      ...input,
      name,
      slug: input.slug ?? this.value('nucleo'),
      status: input.status ?? 'ativo',
      cities: input.cities === undefined ? ['Salvador'] : input.cities,
      organizationKind: input.organizationKind ?? 'territorial',
    }
    const nucleus = await this.rootPayload.create({
      collection: 'electoralNucleus',
      data,
      depth: 0,
    })
    this.own('electoralNucleus', nucleus)
    return nucleus
  }

  async createLeadership(input: LeadershipInput): Promise<Leadership> {
    const leadership = await this.rootPayload.create({
      collection: 'leadership',
      data: {
        supportStatus: 'engajado',
        ...input,
        contact: relationshipID(input.contact),
        nucleus: relationshipID(input.nucleus),
        ...(input.user ? { user: relationshipID(input.user) } : {}),
        ...(input.createdBy ? { createdBy: relationshipID(input.createdBy) } : {}),
        ...(input.consent ? { consent: relationshipID(input.consent) } : {}),
      },
      depth: 0,
    })
    this.own('leadership', leadership)
    return leadership
  }

  async createSupporter(
    input: Partial<
      Pick<
        Supporter,
        | 'contact'
        | 'nucleus'
        | 'voteIntention'
        | 'source'
        | 'consent'
        | 'consentContentHash'
        | 'consentedAt'
        | 'notes'
        | 'consentNote'
        | 'createdBy'
      >
    > &
      Pick<Supporter, 'contact'>,
  ): Promise<Supporter> {
    const supporter = await this.rootPayload.create({
      collection: 'supporter',
      data: {
        source: 'manual',
        ...input,
        contact: relationshipID(input.contact),
        ...(input.nucleus ? { nucleus: relationshipID(input.nucleus) } : {}),
        ...(input.createdBy ? { createdBy: relationshipID(input.createdBy) } : {}),
        ...(input.consent ? { consent: relationshipID(input.consent) } : {}),
      },
      depth: 0,
    })
    this.own('supporter', supporter)
    return supporter
  }

  async createNucleusUpdate(input: NucleusUpdateInput): Promise<NucleusUpdate> {
    const update = await this.rootPayload.create({
      collection: 'nucleusUpdate',
      data: {
        kind: 'nota',
        body: this.value('Atualização'),
        ...input,
        nucleus: relationshipID(input.nucleus),
        author: relationshipID(input.author),
      },
      depth: 0,
    })
    this.own('nucleusUpdate', update)
    return update
  }

  async createInvite(input: CampaignInviteInput): Promise<CampaignInvite> {
    const invite = await this.rootPayload.create({
      collection: 'campaignInvite',
      data: {
        tokenHash: createHash('sha256').update(this.value('invite')).digest('hex'),
        kind: 'autopreenchimento',
        expiresAt: new Date('2099-01-01T00:00:00.000Z').toISOString(),
        ...input,
        leadership: relationshipID(input.leadership),
        createdBy: relationshipID(input.createdBy),
      },
      depth: 0,
    })
    this.own('campaignInvite', invite)
    return invite
  }

  private async discoverDependents(): Promise<void> {
    await this.discoverMarkedRoots()
    const nucleusIDs = [...this.owned.electoralNucleus]
    const userIDs = [...this.owned.campaignUser]
    const leadershipConditions: Where[] = []
    if (nucleusIDs.length > 0) leadershipConditions.push({ nucleus: { in: nucleusIDs } })
    if (userIDs.length > 0) leadershipConditions.push({ createdBy: { in: userIDs } })
    if (this.owned.leadership.size > 0) {
      leadershipConditions.push({ id: { in: [...this.owned.leadership] } })
    }

    if (leadershipConditions.length > 0) {
      const leaderships = await this.rootPayload.find({
        collection: 'leadership',
        where: { or: leadershipConditions },
        depth: 0,
        pagination: false,
      })
      const candidateContactIDs = new Set<number>()
      const candidateUserIDs = new Set<number>()
      for (const leadership of leaderships.docs) {
        this.own('leadership', leadership)
        candidateContactIDs.add(relationshipID(leadership.contact))
        if (leadership.user) candidateUserIDs.add(relationshipID(leadership.user))
      }
      if (candidateContactIDs.size > 0) {
        const contacts = await this.rootPayload.find({
          collection: 'contact',
          where: { id: { in: [...candidateContactIDs] } },
          depth: 0,
          pagination: false,
        })
        for (const contact of contacts.docs) {
          if (
            this.owned.contact.has(contact.id) ||
            this.hasMarker(contact.name, contact.email, contact.phone)
          ) {
            this.own('contact', contact)
          }
        }
      }
      if (candidateUserIDs.size > 0) {
        const users = await this.rootPayload.find({
          collection: 'campaignUser',
          where: { id: { in: [...candidateUserIDs] } },
          depth: 0,
          pagination: false,
        })
        for (const user of users.docs) {
          if (
            this.owned.campaignUser.has(user.id) ||
            this.hasMarker(user.name, user.email, user.username, user.phone)
          ) {
            this.own('campaignUser', user)
          }
        }
      }
    }

    const leadershipIDs = [...this.owned.leadership]
    if (leadershipIDs.length > 0) {
      const invites = await this.rootPayload.find({
        collection: 'campaignInvite',
        where: { leadership: { in: leadershipIDs } },
        depth: 0,
        pagination: false,
      })
      for (const invite of invites.docs) this.own('campaignInvite', invite)
    }

    if (nucleusIDs.length > 0) {
      const updates = await this.rootPayload.find({
        collection: 'nucleusUpdate',
        where: { nucleus: { in: nucleusIDs } },
        depth: 0,
        pagination: false,
      })
      for (const update of updates.docs) this.own('nucleusUpdate', update)
    }

    const contactIDs = [...this.owned.contact]
    if (contactIDs.length > 0 || nucleusIDs.length > 0) {
      const supporterConditions: Where[] = []
      if (contactIDs.length > 0) supporterConditions.push({ contact: { in: contactIDs } })
      if (nucleusIDs.length > 0) supporterConditions.push({ nucleus: { in: nucleusIDs } })
      if (this.owned.supporter.size > 0) {
        supporterConditions.push({ id: { in: [...this.owned.supporter] } })
      }
      if (supporterConditions.length > 0) {
        const supporters = await this.rootPayload.find({
          collection: 'supporter',
          where: { or: supporterConditions },
          depth: 0,
          pagination: false,
        })
        for (const supporter of supporters.docs) {
          this.own('supporter', supporter)
          this.own('contact', relationshipID(supporter.contact))
        }
      }
    }

    const lockedDocumentConditions = [
      ['action_plan_id', this.owned.actionPlan],
      ['campaign_invite_id', this.owned.campaignInvite],
      ['campaign_user_id', this.owned.campaignUser],
      ['consent_id', this.owned.consent],
      ['contact_id', this.owned.contact],
      ['electoral_nucleus_id', this.owned.electoralNucleus],
      ['leadership_id', this.owned.leadership],
      ['supporter_id', this.owned.supporter],
      ['nucleus_update_id', this.owned.nucleusUpdate],
      ['users_id', this.owned.users],
    ]
      .filter((entry): entry is [string, Set<number>] => (entry[1] as Set<number>).size > 0)
      .map(([column, ids]) => `"${column}" IN (${[...ids].map((id) => Number(id)).join(', ')})`)
    if (lockedDocumentConditions.length > 0) {
      const result = await this.rootPayload.db.drizzle.execute(
        sql.raw(`
          SELECT DISTINCT "parent_id"
          FROM "payload_locked_documents_rels"
          WHERE ${lockedDocumentConditions.join(' OR ')}
        `),
      )
      for (const row of result.rows) {
        const parentID = Number(row.parent_id)
        if (Number.isInteger(parentID)) this.ownedLockedDocuments.add(parentID)
      }
    }

    if (userIDs.length > 0) {
      const preferences = await this.rootPayload.db.drizzle.execute(sql`
        SELECT DISTINCT "parent_id"
        FROM "payload_preferences_rels"
        WHERE "campaign_user_id" IN (${sql.join(
          userIDs.map((id) => sql`${id}`),
          sql`, `,
        )})
      `)
      for (const row of preferences.rows) {
        const preferenceID = Number(row.parent_id)
        if (Number.isInteger(preferenceID)) this.ownedPreferences.add(preferenceID)
      }
    }
  }

  private async deleteOwned(
    collection: CampaignCollection,
    req: { transactionID: number | string },
  ): Promise<void> {
    const ids = [...this.owned[collection]]
    if (ids.length === 0) return
    const result = await this.rootPayload.delete({
      collection,
      where: { id: { in: ids } },
      depth: 0,
      req: req as never,
    })
    const errors = bulkErrors(result)
    if (errors.length > 0) {
      throw new AggregateError(errors, `Failed to clean owned ${collection} fixture rows.`)
    }
  }

  async cleanup(): Promise<void> {
    if (this.cleaned) return
    await this.discoverDependents()
    await withPayloadTransaction(this.rootPayload, async ({ req }) => {
      for (const collection of [
        'campaignInvite',
        'nucleusUpdate',
        'actionPlan',
        'leadership',
        'supporter',
        'electoralNucleus',
        'contact',
        'campaignUser',
        'consent',
        'users',
      ] as const) {
        await this.deleteOwned(collection, req)
      }
      if (this.ownedPreferences.size > 0) {
        const transaction = this.rootPayload.db.sessions?.[String(req.transactionID)]?.db as
          | { execute: (query: ReturnType<typeof sql.raw>) => Promise<unknown> }
          | undefined
        if (!transaction) throw new Error('Campaign fixture cleanup transaction is unavailable.')
        await transaction.execute(
          sql.raw(`
            DELETE FROM "payload_preferences"
            WHERE "id" IN (${[...this.ownedPreferences].join(', ')})
          `),
        )
      }
      if (this.ownedLockedDocuments.size > 0) {
        const transaction = this.rootPayload.db.sessions?.[String(req.transactionID)]?.db as
          | { execute: (query: ReturnType<typeof sql.raw>) => Promise<unknown> }
          | undefined
        if (!transaction) throw new Error('Campaign fixture cleanup transaction is unavailable.')
        await transaction.execute(
          sql.raw(`
            DELETE FROM "payload_locked_documents"
            WHERE "id" IN (${[...this.ownedLockedDocuments].join(', ')})
          `),
        )
      }
    })
    this.cleaned = true
  }

  async expectNoOwnedRows(): Promise<void> {
    for (const collection of Object.keys(this.owned) as CampaignCollection[]) {
      const ids = [...this.owned[collection]]
      if (ids.length === 0) continue
      const remaining = await this.rootPayload.find({
        collection,
        where: { id: { in: ids } },
        depth: 0,
        limit: 1,
      })
      if (remaining.docs.length > 0) {
        throw new Error(`Owned ${collection} fixture rows remain after cleanup.`)
      }
    }
    if (this.ownedPreferences.size > 0) {
      const remainingPreferences = await this.rootPayload.db.drizzle.execute(
        sql.raw(`
          SELECT "id"
          FROM "payload_preferences"
          WHERE "id" IN (${[...this.ownedPreferences].join(', ')})
          LIMIT 1
        `),
      )
      if (remainingPreferences.rows.length > 0) {
        throw new Error('Owned Payload preference fixture rows remain after cleanup.')
      }
    }
  }
}

export const createCampaignFixtures = (payload: Payload): CampaignFixtures =>
  new CampaignFixtures(payload)

export const installCampaignFixtures = ({
  getPayload,
  setPayload,
}: {
  getPayload: () => Payload
  setPayload: (payload: Payload) => void
}): (() => CampaignFixtures) => {
  let rootPayload: Payload | undefined
  let fixtures: CampaignFixtures | undefined

  beforeEach(() => {
    rootPayload ??= getPayload()
    fixtures = createCampaignFixtures(rootPayload)
    setPayload(fixtures.payload)
  })

  afterEach(async () => {
    if (!fixtures || !rootPayload) return
    try {
      await fixtures.cleanup()
      await fixtures.expectNoOwnedRows()
    } finally {
      setPayload(rootPayload)
      fixtures = undefined
    }
  })

  return () => {
    if (!fixtures) throw new Error('Campaign fixtures are only available during a test.')
    return fixtures
  }
}

export const withCampaignFixtures = async <Result>(
  payload: Payload,
  operation: (fixtures: CampaignFixtures) => Promise<Result>,
): Promise<Result> => {
  const fixtures = createCampaignFixtures(payload)
  let operationError: unknown
  try {
    return await operation(fixtures)
  } catch (error) {
    operationError = error
    throw error
  } finally {
    try {
      await fixtures.cleanup()
      await fixtures.expectNoOwnedRows()
    } catch (cleanupError) {
      if (operationError !== undefined) throw combineErrors(operationError, cleanupError)
      throw cleanupError
    }
  }
}
