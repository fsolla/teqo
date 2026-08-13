import { createHash, randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, Where } from 'payload'
import { afterEach, beforeEach } from 'vitest'

import { getMunicipalityCatalogEntry, municipalityCatalog } from '@/lib/municipalityCatalog'
import type {
  CampaignDemand,
  CampaignInvite,
  CampaignUser,
  Consent,
  Contact,
  Leadership,
  Municipality,
  MunicipalityUpdate,
  Organization,
  StateDeputy,
  Supporter,
  User,
  VotePledge,
} from '@/payload-types'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { purgeMunicipalityResidue, relationId, relationIds } from './campaignResidue'

/**
 * Campaign fixtures for the Município model. Municipalities are SEEDED reference rows
 * (435, created by migration): tests never create or delete them — fixtures
 * hand out seeded municipalities and reset the operational fields they touched.
 */

type CampaignCollection =
  | 'users'
  | 'campaignInvite'
  | 'municipalityUpdate'
  | 'votePledge'
  | 'campaignDemand'
  | 'allocationDecision'
  | 'activity'
  | 'leadership'
  | 'supporter'
  | 'organization'
  | 'stateDeputy'
  | 'contact'
  | 'campaignUser'
  | 'consent'
  | 'calendarFeed'
  | 'supporterImportBatch'

type OwnedIDs = Record<CampaignCollection, Set<number>>

type CampaignUserInput = Partial<
  Pick<CampaignUser, 'name' | 'role' | 'phone' | 'email' | 'username' | 'password'>
>
type AdminUserInput = {
  email?: string
  password?: string
  roles?: User['roles']
}
type EditorUserInput = {
  email?: string
  password?: string
}
type ConsentInput = Partial<Pick<Consent, 'key' | 'text'>>
type ContactInput = Partial<
  Pick<Contact, 'name' | 'email' | 'gender' | 'state' | 'city' | 'postalCode'> & {
    phones: Array<{ value: string }>
  }
>
type LeadershipInput = Partial<
  Pick<
    Leadership,
    | 'contact'
    | 'municipalities'
    | 'organizations'
    | 'exclusive'
    | 'supportStatus'
    | 'user'
    | 'consent'
    | 'consentContentHash'
    | 'consentedAt'
    | 'notes'
    | 'createdBy'
  >
> &
  Pick<Leadership, 'contact'> & { municipalities: Array<number | { id: number }> }
type MunicipalityUpdateInput = Partial<
  Pick<
    MunicipalityUpdate,
    'polarity' | 'urgent' | 'adversarySignal' | 'activeVolunteers' | 'newSupports' | 'body'
  >
> &
  Pick<MunicipalityUpdate, 'municipality' | 'author'>
type VotePledgeInput = Partial<
  Pick<VotePledge, 'declaredVotes' | 'estimatedVotes' | 'estimateNote'>
> &
  Pick<VotePledge, 'leadership' | 'municipality'>
type OrganizationInput = Partial<
  Pick<Organization, 'name' | 'slug' | 'kind' | 'notes' | 'municipalities'>
>
type StateDeputyInput = Partial<
  Pick<StateDeputy, 'contact' | 'slug' | 'party' | 'ballotName' | 'notes'>
> & {
  name?: string
}
type CampaignDemandInput = Partial<
  Pick<
    CampaignDemand,
    'title' | 'slug' | 'kind' | 'description' | 'status' | 'leadership' | 'createdBy'
  >
> &
  Pick<CampaignDemand, 'municipality'>
type CampaignInviteInput = Partial<
  Pick<CampaignInvite, 'tokenHash' | 'kind' | 'expiresAt' | 'usedAt' | 'revokedAt'>
> &
  Pick<CampaignInvite, 'leadership' | 'createdBy'>

const processRunID = randomUUID()
let builderCounter = 0

const emptyOwnedIDs = (): OwnedIDs => ({
  users: new Set(),
  campaignInvite: new Set(),
  municipalityUpdate: new Set(),
  votePledge: new Set(),
  campaignDemand: new Set(),
  allocationDecision: new Set(),
  activity: new Set(),
  leadership: new Set(),
  supporter: new Set(),
  organization: new Set(),
  stateDeputy: new Set(),
  contact: new Set(),
  campaignUser: new Set(),
  consent: new Set(),
  calendarFeed: new Set(),
  supporterImportBatch: new Set(),
})

/**
 * Consent rows shared across spec files (stable keys the app resolves at
 * runtime). They are leased via `testDatabaseLease.ts`, never owned by a
 * fixture instance — deleting them at cleanup would steal them from
 * concurrently running spec files.
 */
const leasedConsentKeys = new Set([
  'lideranca-autopreenchimento',
  'apoiador-cadastro',
  'apoiador-intencao-voto',
  'whatsapp-inscricao',
])

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

// `relationId`/`relationIds`/`purgeMunicipalityResidue` live in
// `campaignResidue.ts` (vitest-free — the e2e fixture imports it inside the
// Playwright process) and are re-exported here for the existing importers.
export { purgeMunicipalityResidue, relationId, relationIds } from './campaignResidue'

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

/**
 * Cross-process municipality allocator: seeded municipalities are shared reference rows, so
 * concurrently running spec files must never operate on the same municipality. A
 * Postgres sequence hands out globally unique catalog indexes.
 */
const MUNICIPALITY_ALLOCATION_SEQUENCE = 'campaign_fixture_municipality_alloc'
let allocationSequenceReady: Promise<void> | undefined

const nextAllocatedMunicipalityIndex = async (
  payload: Payload,
  catalogSize: number,
): Promise<number> => {
  allocationSequenceReady ??= payload.db.drizzle
    .execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS "${MUNICIPALITY_ALLOCATION_SEQUENCE}"`))
    .then(() => undefined)
    .catch((error: unknown) => {
      // IF NOT EXISTS still races across parallel workers (pg_class unique
      // violation, SQLSTATE 23505) — the sequence exists, which is all we need.
      if ((error as { code?: string }).code === '23505') return undefined
      throw error
    })
  await allocationSequenceReady
  const result = await payload.db.drizzle.execute(
    sql.raw(`SELECT nextval('"${MUNICIPALITY_ALLOCATION_SEQUENCE}"') AS "value"`),
  )
  const value = Number((result.rows[0] as { value: string | number }).value)
  return value % catalogSize
}

export class CampaignFixtures {
  readonly payload: Payload
  readonly runID: string

  private cleaned = false
  private counter = 0
  private municipalityCursor = 0
  private readonly markers = new Set<string>()
  private readonly owned = emptyOwnedIDs()
  private readonly touchedMunicipalities = new Set<number>()
  private readonly ownedLockedDocuments = new Set<number>()
  private readonly ownedPreferences = new Set<number>()
  private readonly ownedNotifications = new Set<number>()
  private readonly ownedPushSubscriptions = new Set<number>()

  constructor(private readonly rootPayload: Payload) {
    builderCounter += 1
    this.runID = `${processRunID}-${builderCounter}`
    // OWNERSHIP CONTRACT: rows created through `fixtures.payload` (the proxy
    // below) are auto-owned at cleanup — calling `fixtures.own()` for them is
    // redundant (kept harmless and idempotent for older specs). Rows made
    // through actions, raw payload handles, or the `rootPayload` are NOT
    // tracked — own those explicitly. Creates whose key is a LEASED consent
    // key (`leasedConsentKeys`) are deliberately never owned: the lease
    // system (testDatabaseLease.ts) owns their lifecycle, and owning them
    // here would let this spec's cleanup rob a parallel spec of the row.
    // Swapping/defineProperty-ing `payload.create` survives too — used by the
    // vi.spyOn(payload, 'create') specs.
    const trackedCreate = async (args: Parameters<Payload['create']>[0]) => {
      const document = await rootPayload.create(args)
      const collection = args.collection
      const isLeasedConsent =
        collection === 'consent' &&
        typeof args.data === 'object' &&
        args.data !== null &&
        'key' in args.data &&
        typeof args.data.key === 'string' &&
        leasedConsentKeys.has(args.data.key)
      if (collection in this.owned && typeof document.id === 'number' && !isLeasedConsent) {
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

  /**
   * Schema-valid unique person name. The contact/leadership name schemas
   * accept letters only (with single spaces/hyphens between words), so the
   * regular `value()` marker — uuid digits plus hyphens glued to them —
   * fails zod validation when a test feeds it through a real action. Digits
   * are transliterated to letters to keep per-run uniqueness, and the name
   * registers as a marker so cleanup sweeps still recognize the row.
   */
  personName(prefix: string): string {
    this.counter += 1
    const letterized = `${this.runID}${this.counter}`
      .replaceAll('-', '')
      .replaceAll(/[0-9]/g, (digit) => 'abcdefghij'[Number(digit)]!)
    const name = `${prefix} ${letterized}`
    this.markers.add(name)
    return name
  }

  phone(): string {
    const digest = createHash('sha256').update(this.value('phone')).digest('hex')
    const subscriber = (BigInt(`0x${digest.slice(0, 12)}`) % 90_000_000n) + 10_000_000n
    const phone = `719${subscriber}`
    this.markers.add(phone)
    return phone
  }

  id(value: number | { id: number }): number {
    return relationId(value)
  }

  own(collection: CampaignCollection, value: number | { id: number }): void {
    this.owned[collection].add(relationId(value))
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

  /**
   * A seeded municipality for this test — globally unique across concurrently running
   * spec files (Postgres sequence), so parallel tests never share one. Rows
   * left behind by a previously crashed run are purged on claim (allocation
   * uniqueness makes this safe: nothing live can reference this municipality).
   */
  async getMunicipality(slug?: string): Promise<Municipality> {
    let requestedSlug = slug
    if (!requestedSlug) {
      const index = await nextAllocatedMunicipalityIndex(
        this.rootPayload,
        municipalityCatalog.length,
      )
      requestedSlug = municipalityCatalog[index]!.slug
      this.municipalityCursor += 1
    }

    const result = await this.rootPayload.find({
      collection: 'municipality',
      where: { slug: { equals: requestedSlug } },
      depth: 0,
      limit: 1,
      pagination: false,
    })
    const municipality = result.docs[0]
    if (!municipality) {
      throw new Error(
        `Seeded municipality "${requestedSlug}" not found — run migrations on the test database.`,
      )
    }
    if (!slug) await purgeMunicipalityResidue(this.rootPayload, municipality.id)
    this.touchedMunicipalities.add(municipality.id)
    return municipality
  }

  /** Mark a municipality mutated by the test so cleanup resets its operational fields. */
  touchMunicipality(value: number | { id: number }): void {
    this.touchedMunicipalities.add(relationId(value))
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
            { 'phones.value': { contains: this.runID } },
          ],
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
        collection: 'campaignDemand',
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
    for (const organization of roots[3].docs) this.own('organization', organization)
    for (const activity of roots[4].docs) this.own('activity', activity)
    for (const demand of roots[5].docs) this.own('campaignDemand', demand)
    for (const consent of roots[6].docs) this.own('consent', consent)
  }

  async createCampaignUser(
    role: CampaignUser['role'] = 'leader',
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
        roles: ['admin'],
        ...input,
      },
      depth: 0,
    })
    this.own('users', user)
    return user
  }

  async createEditorUser(input: EditorUserInput = {}): Promise<User> {
    return this.createAdminUser({
      email: `${this.value('editor')}@example.com`,
      roles: ['editor'],
      ...input,
    })
  }

  /**
   * Creates an OWNED consent row (deleted at cleanup) — even for a leased
   * shared key, since calling this helper is an explicit ownership request.
   * For the shared stable keys, prefer `ensureLeasedConsent` /
   * `withLeasedConsent` (testDatabaseLease.ts) so parallel spec files are not
   * robbed of the row at cleanup.
   */
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

  async createContact(input: ContactInput = {}): Promise<Contact & { phone: string }> {
    const phone = input.phones?.[0]?.value ?? this.phone()
    const contact = await this.rootPayload.create({
      collection: 'contact',
      data: {
        name: this.value('Contato'),
        phones: [{ value: phone }],
        state: 'BA',
        city: 'Salvador',
        ...input,
      },
      depth: 0,
    })
    this.own('contact', contact)
    // The fixture contract is "one primary phone": every fixture contact carries
    // one — narrow so specs can rely on it (C112 keeps the array under the hood).
    const primary = contact.phones?.[0]?.value
    if (typeof primary !== 'string') {
      throw new Error('Fixture contacts must always carry a phone.')
    }
    return { ...contact, phone: primary }
  }

  /** Assign advisors to a seeded municipality (tracked for reset on cleanup). */
  async assignMunicipalityAdvisors(
    municipality: number | { id: number },
    advisors: Array<number | { id: number }>,
  ): Promise<Municipality> {
    const municipalityID = relationId(municipality)
    this.touchedMunicipalities.add(municipalityID)
    return this.rootPayload.update({
      collection: 'municipality',
      id: municipalityID,
      data: { advisors: relationIds(advisors) },
      depth: 0,
    })
  }

  async createLeadership(input: LeadershipInput): Promise<Leadership> {
    const leadership = await this.rootPayload.create({
      collection: 'leadership',
      data: {
        supportStatus: 'engajado',
        ...input,
        contact: relationId(input.contact),
        municipalities: relationIds(input.municipalities),
        ...(input.organizations
          ? { organizations: input.organizations.map((value) => relationId(value)) }
          : {}),
        ...(input.user ? { user: relationId(input.user) } : {}),
        ...(input.createdBy ? { createdBy: relationId(input.createdBy) } : {}),
        ...(input.consent ? { consent: relationId(input.consent) } : {}),
      },
      depth: 0,
    })
    this.own('leadership', leadership)
    for (const municipality of input.municipalities)
      this.touchedMunicipalities.add(relationId(municipality))
    return leadership
  }

  async createVotePledge(input: VotePledgeInput): Promise<VotePledge> {
    const pledge = await this.rootPayload.create({
      collection: 'votePledge',
      data: {
        declaredVotes: 100,
        ...input,
        leadership: relationId(input.leadership),
        municipality: relationId(input.municipality),
      },
      depth: 0,
    })
    this.own('votePledge', pledge)
    this.touchedMunicipalities.add(relationId(input.municipality))
    return pledge
  }

  async createOrganization(input: OrganizationInput = {}): Promise<Organization> {
    const name = input.name ?? this.value('Organização')
    const organization = await this.rootPayload.create({
      collection: 'organization',
      data: {
        kind: 'sindicato',
        ...input,
        name,
        slug: input.slug ?? this.value('organizacao'),
      },
      depth: 0,
    })
    this.own('organization', organization)
    return organization
  }

  async createStateDeputy(input: StateDeputyInput = {}): Promise<StateDeputy> {
    const { contact: inputContact, name, ...stateDeputyInput } = input
    const contact =
      inputContact ?? (await this.createContact({ name: name ?? this.value('Deputado') }))
    const stateDeputy = await this.rootPayload.create({
      collection: 'stateDeputy',
      data: {
        ...stateDeputyInput,
        contact: relationId(contact),
        slug: stateDeputyInput.slug ?? this.value('deputado'),
      },
      depth: 0,
    })
    this.own('stateDeputy', stateDeputy)
    return stateDeputy
  }

  async createCampaignDemand(input: CampaignDemandInput): Promise<CampaignDemand> {
    const title = input.title ?? this.value('Demanda')
    const demand = await this.rootPayload.create({
      collection: 'campaignDemand',
      data: {
        kind: 'material',
        status: 'aberta',
        ...input,
        title,
        slug: input.slug ?? this.value('demanda'),
        municipality: relationId(input.municipality),
        ...(input.leadership ? { leadership: relationId(input.leadership) } : {}),
        ...(input.createdBy ? { createdBy: relationId(input.createdBy) } : {}),
      },
      depth: 0,
    })
    this.own('campaignDemand', demand)
    this.touchedMunicipalities.add(relationId(input.municipality))
    return demand
  }

  async createSupporter(
    input: Partial<
      Pick<
        Supporter,
        | 'contact'
        | 'municipality'
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
        contact: relationId(input.contact),
        ...(input.municipality ? { municipality: relationId(input.municipality) } : {}),
        ...(input.createdBy ? { createdBy: relationId(input.createdBy) } : {}),
        ...(input.consent ? { consent: relationId(input.consent) } : {}),
      },
      depth: 0,
    })
    this.own('supporter', supporter)
    return supporter
  }

  async createMunicipalityUpdate(input: MunicipalityUpdateInput): Promise<MunicipalityUpdate> {
    const update = await this.rootPayload.create({
      collection: 'municipalityUpdate',
      data: {
        polarity: 'neutra',
        body: this.value('Atualização'),
        urgent: false,
        adversarySignal: false,
        ...input,
        municipality: relationId(input.municipality),
        author: relationId(input.author),
      },
      depth: 0,
    })
    this.own('municipalityUpdate', update)
    this.touchedMunicipalities.add(relationId(input.municipality))
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
        leadership: relationId(input.leadership),
        createdBy: relationId(input.createdBy),
      },
      depth: 0,
    })
    this.own('campaignInvite', invite)
    return invite
  }

  private async discoverDependents(): Promise<void> {
    await this.discoverMarkedRoots()
    const userIDs = [...this.owned.campaignUser]
    const leadershipConditions: Where[] = []
    if (userIDs.length > 0) leadershipConditions.push({ createdBy: { in: userIDs } })
    if (userIDs.length > 0) leadershipConditions.push({ user: { in: userIDs } })
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
        candidateContactIDs.add(relationId(leadership.contact))
        if (leadership.user) candidateUserIDs.add(relationId(leadership.user))
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
            this.hasMarker(contact.name, contact.email, contact.phones?.[0]?.value ?? null)
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
      for (const invite of invites.docs) this.own('campaignInvite', invite)
      for (const pledge of pledges.docs) this.own('votePledge', pledge)
      for (const demand of demands.docs) this.own('campaignDemand', demand)
    }

    if (userIDs.length > 0) {
      const importBatches = await this.rootPayload.find({
        collection: 'supporterImportBatch',
        where: { actor: { in: userIDs } },
        depth: 0,
        pagination: false,
      })
      for (const batch of importBatches.docs) this.own('supporterImportBatch', batch.id)
      const [updates, notifications, pushSubscriptions] = await Promise.all([
        this.rootPayload.find({
          collection: 'municipalityUpdate',
          where: { author: { in: userIDs } },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'notification',
          where: { recipient: { in: userIDs } },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'pushSubscription',
          where: { user: { in: userIDs } },
          depth: 0,
          pagination: false,
        }),
      ])
      for (const update of updates.docs) {
        this.own('municipalityUpdate', update)
        this.touchedMunicipalities.add(relationId(update.municipality))
      }
      for (const notification of notifications.docs) {
        this.ownedNotifications.add(notification.id)
      }
      for (const subscription of pushSubscriptions.docs) {
        this.ownedPushSubscriptions.add(subscription.id)
      }
    }

    const contactIDs = [...this.owned.contact]
    if (contactIDs.length > 0 || this.owned.supporter.size > 0) {
      const supporterConditions: Where[] = []
      if (contactIDs.length > 0) supporterConditions.push({ contact: { in: contactIDs } })
      if (this.owned.supporter.size > 0) {
        supporterConditions.push({ id: { in: [...this.owned.supporter] } })
      }
      const supporters = await this.rootPayload.find({
        collection: 'supporter',
        where: { or: supporterConditions },
        depth: 0,
        pagination: false,
      })
      for (const supporter of supporters.docs) {
        this.own('supporter', supporter)
        this.own('contact', relationId(supporter.contact))
      }
    }

    const lockedDocumentConditions = [
      ['activity_id', this.owned.activity],
      ['allocation_decision_id', this.owned.allocationDecision],
      ['campaign_invite_id', this.owned.campaignInvite],
      ['campaign_user_id', this.owned.campaignUser],
      ['campaign_demand_id', this.owned.campaignDemand],
      ['consent_id', this.owned.consent],
      ['contact_id', this.owned.contact],
      ['organization_id', this.owned.organization],
      ['leadership_id', this.owned.leadership],
      ['supporter_id', this.owned.supporter],
      ['municipality_update_id', this.owned.municipalityUpdate],
      ['vote_pledge_id', this.owned.votePledge],
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

  private async deleteNotificationOwned(req: { transactionID: number | string }): Promise<void> {
    if (this.ownedNotifications.size > 0) {
      await this.rootPayload.delete({
        collection: 'notification',
        where: { id: { in: [...this.ownedNotifications] } },
        depth: 0,
        overrideAccess: true,
        req,
      })
      this.ownedNotifications.clear()
    }
    if (this.ownedPushSubscriptions.size > 0) {
      await this.rootPayload.delete({
        collection: 'pushSubscription',
        where: { id: { in: [...this.ownedPushSubscriptions] } },
        depth: 0,
        overrideAccess: true,
        req,
      })
      this.ownedPushSubscriptions.clear()
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
      req,
    })
    const errors = bulkErrors(result)
    if (errors.length > 0) {
      throw new AggregateError(errors, `Failed to clean owned ${collection} fixture rows.`)
    }
  }

  /** Seeded municipalities are never deleted — touched ones get their fields reset. */
  private async resetTouchedMunicipalities(req: { transactionID: number | string }): Promise<void> {
    if (this.touchedMunicipalities.size === 0) return

    // `name` is reset from the catalog, not left as the spec wrote it: specs that
    // exercise search and sorting rename rows, and since B34+ the chips resolve
    // labels through `municipalityCatalog`, so a name left diverged makes the UI
    // and the fixture disagree in a LATER run — which is how it surfaced (an e2e
    // chip rendering the catalog name against a fixture holding the renamed one).
    const touched = await this.rootPayload.find({
      collection: 'municipality',
      where: { id: { in: [...this.touchedMunicipalities] } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { slug: true },
      req,
    })
    const catalogNameById = new Map(
      touched.docs.map((municipality) => [
        municipality.id,
        getMunicipalityCatalogEntry(municipality.slug)?.name,
      ]),
    )

    for (const municipalityID of this.touchedMunicipalities) {
      const catalogName = catalogNameById.get(municipalityID)
      await this.rootPayload.update({
        collection: 'municipality',
        id: municipalityID,
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
  }

  async cleanup(): Promise<void> {
    if (this.cleaned) return
    await this.discoverDependents()
    await withPayloadTransaction(this.rootPayload, async ({ req }) => {
      for (const collection of [
        'campaignInvite',
        'votePledge',
        'campaignDemand',
        'allocationDecision',
        'municipalityUpdate',
        'activity',
        'leadership',
        'supporter',
        'organization',
        'stateDeputy',
        'contact',
        'calendarFeed',
      ] as const) {
        await this.deleteOwned(collection, req)
      }
      await this.deleteNotificationOwned(req)
      for (const collection of [
        'supporterImportBatch',
        'campaignUser',
        'consent',
        'users',
      ] as const) {
        await this.deleteOwned(collection, req)
      }
      await this.resetTouchedMunicipalities(req)
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
