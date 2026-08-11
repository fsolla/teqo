// @vitest-environment node

import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { Consent } from '@/collections/Consent'
import type { CampaignUser, Consent as ConsentDocument } from '@/payload-types'
import config from '@/payload.config'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import {
  getTestTransactionBackendPID,
  waitForAdvisoryLockWaiter,
  withInviteConsent,
  withMutableConsentFixture,
} from '../helpers/testDatabaseLease'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})
const authState = vi.hoisted(() => ({
  user: null as CampaignUser | null,
}))
const cookieState = vi.hoisted(() => ({
  set: vi.fn(),
}))
const requestHeadersState = vi.hoisted(() => ({
  value: new Headers({ origin: 'http://localhost:3000' }),
}))

vi.mock('@/utilities/campaignAuth', () => ({
  getCampaignUser: async () => authState.user,
  setCampaignAuthCookie: cookieState.set,
}))
vi.mock('next/headers', () => ({
  headers: async () => requestHeadersState.value,
}))
const resultRows = <Row>(result: unknown): Row[] => {
  if (Array.isArray(result)) return result as Row[]
  if (
    typeof result === 'object' &&
    result !== null &&
    'rows' in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as Row[]
  }
  return []
}

const expectExactAdvisoryWaiter = async (key: string, waiterPID: number) => {
  const waiting = await waitForAdvisoryLockWaiter(payload, {
    key,
    mode: 'ExclusiveLock',
    waiterPID,
  })
  expect(waiting).toMatchObject({
    activityDatabaseOID: waiting.databaseOID,
    classID: waiting.expectedClassID,
    granted: false,
    mode: 'ExclusiveLock',
    objectID: waiting.expectedObjectID,
    objectSubID: 1,
    pid: waiterPID,
  })
}

const expectExactAdvisoryLockGranted = async (key: string, holderPID: number) => {
  const result = await payload.db.drizzle.execute(sql`
    WITH expected AS (
      SELECT
        hashtextextended(${key}, 0) AS "key",
        (SELECT oid FROM pg_database WHERE datname = current_database()) AS "databaseOID"
    )
    SELECT
      activity.datid::integer AS "activityDatabaseOID",
      locks.classid::text AS "classID",
      locks.database::integer AS "databaseOID",
      ((expected."key" >> 32) & 4294967295)::text AS "expectedClassID",
      (expected."key" & 4294967295)::text AS "expectedObjectID",
      locks.granted,
      locks.mode,
      locks.objid::text AS "objectID",
      locks.objsubid::integer AS "objectSubID",
      activity.pid::integer AS "pid"
    FROM pg_locks AS locks
    INNER JOIN pg_stat_activity AS activity
      ON activity.pid = locks.pid
     AND activity.datid = locks.database
    CROSS JOIN expected
    WHERE locks.locktype = 'advisory'
      AND locks.database = expected."databaseOID"
      AND locks.classid = ((expected."key" >> 32) & 4294967295)::oid
      AND locks.objid = (expected."key" & 4294967295)::oid
      AND locks.objsubid = 1
      AND locks.mode = 'ExclusiveLock'
      AND locks.pid = ${holderPID}
      AND locks.granted = true
  `)
  const granted = resultRows<{
    activityDatabaseOID: number
    classID: string
    databaseOID: number
    expectedClassID: string
    expectedObjectID: string
    granted: true
    mode: 'ExclusiveLock'
    objectID: string
    objectSubID: 1
    pid: number
  }>(result)[0]

  expect(granted).toMatchObject({
    activityDatabaseOID: granted?.databaseOID,
    classID: granted?.expectedClassID,
    granted: true,
    mode: 'ExclusiveLock',
    objectID: granted?.expectedObjectID,
    objectSubID: 1,
    pid: holderPID,
  })
}

const withBlockedInviteAction = async <Result>({
  key,
  start,
  whileWaiting,
}: {
  key: string
  start: () => Promise<Result>
  whileWaiting: (waiterPID: number) => Promise<void>
}): Promise<Result> => {
  const holderID = await payload.db.beginTransaction()
  if (holderID === null) throw new Error('Expected an advisory-lock holder transaction.')
  await acquireTextAdvisoryLocks(payload, { transactionID: holderID }, [key])

  const originalBegin = payload.db.beginTransaction.bind(payload.db)
  let actionTransactionID: number | string | undefined
  let resolveWaiterPID!: (pid: number) => void
  let rejectWaiterPID!: (error: unknown) => void
  const waiterPID = new Promise<number>((resolve, reject) => {
    resolveWaiterPID = resolve
    rejectWaiterPID = reject
  })
  const beginSpy = vi.spyOn(payload.db, 'beginTransaction').mockImplementation(async () => {
    try {
      const transactionID = await originalBegin()
      if (transactionID === null) throw new Error('Expected the invite transaction to start.')
      actionTransactionID = transactionID
      resolveWaiterPID(await getTestTransactionBackendPID(payload, transactionID))
      return transactionID
    } catch (error) {
      rejectWaiterPID(error)
      throw error
    }
  })

  let holderReleased = false
  let pending: Promise<Result> | undefined
  try {
    pending = start()
    const expectedPID = await waiterPID
    await expectExactAdvisoryWaiter(key, expectedPID)
    await whileWaiting(expectedPID)
    await payload.db.rollbackTransaction(holderID)
    holderReleased = true
    return await pending
  } finally {
    beginSpy.mockRestore()
    if (!holderReleased) {
      await payload.db.rollbackTransaction(holderID).catch(() => undefined)
    }
    await pending?.catch(() => undefined)
    if (
      actionTransactionID !== undefined &&
      payload.db.sessions?.[String(actionTransactionID)] !== undefined
    ) {
      await payload.db.rollbackTransaction(actionTransactionID).catch(() => undefined)
    }
  }
}

// Builds the owned Contact → Leadership graph required by invite scenarios.
const createInviteLeadershipGraph = async (
  actor: CampaignUser,
  municipality: number,
  supportStatus: 'engajado' | 'a_abordar' = 'engajado',
) => {
  const contact = await campaignFixtures().createContact({
    name: campaignFixtures().value('Liderança convite'),
    phone: campaignFixtures().phone(),
  })
  const leadership = await campaignFixtures().createLeadership({
    contact,
    municipalities: [municipality],
    supportStatus,
    notes: 'Nota interna protegida',
    createdBy: actor,
  })
  return { contact, leadership }
}

// Exercises the authenticated action and returns the derived raw-token metadata.
const createInviteThroughAction = async (
  actor: CampaignUser,
  input: { leadership: number; kind: 'login' | 'autopreenchimento' },
) => {
  authState.user = actor
  const [actions, inviteUtilities] = await Promise.all([
    import('@/app/(campaign)/campanha/actions/invite'),
    import('@/utilities/campaignInvite'),
  ])
  const result = await actions.createCampaignInvite(input)
  const token = new URL(result.inviteUrl).pathname.split('/').pop()!
  return {
    ...result,
    token,
    tokenHash: inviteUtilities.hashCampaignInviteToken(token),
  }
}

// Retained as a scenario builder: recovery tests need the same linked
// Contact → Leadership → CampaignUser → login-invite graph every time.
const createLinkedLoginInvite = async (actor: CampaignUser) => {
  const municipality = await campaignFixtures().getMunicipality()
  const { contact, leadership } = await createInviteLeadershipGraph(actor, municipality.id)
  const account = await payload.create({
    collection: 'campaignUser',
    data: {
      name: campaignFixtures().value('Conta vinculada'),
      username: contact.phone,
      phone: contact.phone,
      password: campaignFixtures().value('senha-anterior'),
      role: 'leader',
    },
    depth: 0,
  })
  await payload.update({
    collection: 'leadership',
    id: leadership.id,
    data: { user: account.id },
    depth: 0,
  })
  const invite = await createInviteThroughAction(actor, {
    leadership: leadership.id,
    kind: 'login',
  })
  return { account, contact, invite, leadership }
}

const expectLoginInviteUnchanged = async ({
  accountID,
  accountName,
  contactID,
  contactName,
  inviteHash,
  leadershipID,
}: {
  accountID: number
  accountName: string
  contactID: number
  contactName: string
  inviteHash: string
  leadershipID: number
}) => {
  const [account, contact, invite, leadership] = await Promise.all([
    payload.findByID({ collection: 'campaignUser', id: accountID, depth: 0 }),
    payload.findByID({ collection: 'contact', id: contactID, depth: 0 }),
    payload.find({
      collection: 'campaignInvite',
      where: { tokenHash: { equals: inviteHash } },
      depth: 0,
      limit: 1,
    }),
    payload.findByID({ collection: 'leadership', id: leadershipID, depth: 0 }),
  ])
  expect(account).toMatchObject({ id: accountID, name: accountName })
  expect(contact).toMatchObject({ id: contactID, name: contactName })
  expect(invite.docs[0]).toMatchObject({ usedAt: null })
  expect(leadership).toMatchObject({ user: accountID })
}

const itWithMutableConsent = (name: string, test: (consent: ConsentDocument) => Promise<void>) =>
  it(name, () => withMutableConsentFixture(payload, test))
const itWithInviteConsent = (name: string, test: (consent: ConsentDocument) => Promise<void>) =>
  it(name, () => withInviteConsent(payload, test))

describe('campaign invite domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('exposes an optional unique stable key on consent documents', () => {
    const keyField = Consent.fields.find((field) => 'name' in field && field.name === 'key')

    expect(keyField).toMatchObject({
      name: 'key',
      type: 'text',
      unique: true,
      index: true,
      required: false,
    })
  })

  it('declares secure invite fields and hides the persisted token hash', async () => {
    const inviteCollection = await import('@/collections/CampaignInvite').catch(() => null)

    expect(inviteCollection).not.toBeNull()
    const fields = inviteCollection!.CampaignInvite.fields
    const tokenHash = fields.find((field) => 'name' in field && field.name === 'tokenHash')

    expect(inviteCollection!.CampaignInvite).toMatchObject({
      slug: 'campaignInvite',
      admin: { group: 'Campanha' },
    })
    expect(tokenHash).toMatchObject({
      type: 'text',
      unique: true,
      index: true,
      admin: { hidden: true },
    })
  })

  it('declares protected consent version acceptance fields on leaderships', async () => {
    const leadershipCollection = await import('@/collections/Leadership')
    const fields = leadershipCollection.Leadership.fields
    const consentContentHash = fields.find(
      (field) => 'name' in field && field.name === 'consentContentHash',
    )
    const consentedAt = fields.find((field) => 'name' in field && field.name === 'consentedAt')

    expect(consentContentHash).toMatchObject({
      type: 'text',
      label: 'Hash do conteúdo consentido',
      admin: { readOnly: true },
      access: {
        create: expect.any(Function),
        update: expect.any(Function),
      },
    })
    expect(consentedAt).toMatchObject({
      type: 'date',
      label: 'Consentimento confirmado em',
      admin: { readOnly: true },
      access: {
        create: expect.any(Function),
        update: expect.any(Function),
      },
    })
  })

  it('generates a 32-byte token and stores only its SHA-256 digest', async () => {
    const inviteUtilities = await import('@/utilities/campaignInvite').catch(() => null)

    expect(inviteUtilities).not.toBeNull()
    const generated = inviteUtilities!.generateCampaignInviteToken()

    expect(Buffer.from(generated.token, 'base64url')).toHaveLength(32)
    expect(generated.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(generated.tokenHash).toBe(inviteUtilities!.hashCampaignInviteToken(generated.token))
    expect(generated.tokenHash).not.toContain(generated.token)
  })

  it('hashes equivalent consent content deterministically with recursive key ordering', async () => {
    const utility = await import('@/utilities/consentContentHash').catch(() => null)

    expect(utility).not.toBeNull()
    const knownHash = utility!.hashConsentContent({
      root: { children: [{ text: 'Aceito', version: 1 }], type: 'root' },
    })
    expect(knownHash).toBe('c0581788cb6892c8781835988d9b8261cab05db10a3f67c9f8ce0262393ac0e8')
    expect(knownHash).toBe(
      utility!.hashConsentContent({
        root: { type: 'root', children: [{ version: 1, text: 'Aceito' }] },
      }),
    )
    expect(
      utility!.hashConsentContent({
        root: { children: [{ text: 'Texto alterado', version: 1 }], type: 'root' },
      }),
    ).not.toBe(
      utility!.hashConsentContent({
        root: { children: [{ text: 'Aceito', version: 1 }], type: 'root' },
      }),
    )
  })

  it('accepts only an exact HTTPS non-local production origin', async () => {
    const inviteUtilities = await import('@/utilities/campaignInviteOrigin')
    const production = { environment: 'production' as const }

    expect(
      inviteUtilities.getCampaignInviteBaseURL({
        ...production,
        configuredURL: 'https://campanha.example.org/',
      }),
    ).toBe('https://campanha.example.org')

    const rejectedProductionURLs = [
      undefined,
      'not-an-absolute-url',
      'http://campanha.example.org',
      'https://localhost:3000',
      'https://127.0.0.1',
      'https://[::1]',
      'https://user@campanha.example.org',
      'https://user:password@campanha.example.org',
      'https://campanha.example.org/base',
      'https://campanha.example.org/?preview=1',
      'https://campanha.example.org/#fragment',
      'https://localhost.attacker.example',
      'https://attacker.localhost',
      'https://127.0.0.1.attacker.example',
    ] as const

    for (const configuredURL of rejectedProductionURLs) {
      expect(
        () => inviteUtilities.getCampaignInviteBaseURL({ ...production, configuredURL }),
        String(configuredURL),
      ).toThrow()
    }
  })

  it('accepts exact local request origins and normalizes them to HTTP outside production', async () => {
    const inviteUtilities = await import('@/utilities/campaignInviteOrigin')

    const localCases = [
      {
        input: { requestOrigin: 'http://localhost:3000' },
        expected: 'http://localhost:3000',
      },
      {
        input: { requestOrigin: 'https://LOCALHOST:3443' },
        expected: 'http://localhost:3443',
      },
      {
        input: { requestOrigin: 'http://127.0.0.1:3001' },
        expected: 'http://127.0.0.1:3001',
      },
      {
        input: { requestOrigin: 'https://[::1]:3443' },
        expected: 'http://[::1]:3443',
      },
      {
        input: { forwardedHost: '[::1]:3002', forwardedProto: 'https' },
        expected: 'http://[::1]:3002',
      },
    ] as const

    for (const { input, expected } of localCases) {
      expect(
        inviteUtilities.getCampaignInviteBaseURL({
          environment: 'development',
          configuredURL: undefined,
          ...input,
        }),
      ).toBe(expected)
    }

    expect(
      inviteUtilities.getCampaignInviteBaseURL({
        environment: 'development',
        configuredURL: undefined,
        requestOrigin: 'https://localhost:3443',
        allowLocalTLS: true,
      }),
    ).toBe('https://localhost:3443')
  })

  it('rejects hostile request-derived origins and uses only an explicit valid fallback', async () => {
    const inviteUtilities = await import('@/utilities/campaignInviteOrigin')
    const hostileRequestInputs = [
      { requestOrigin: 'https://attacker.example' },
      { requestOrigin: 'http://localhost.attacker.example:3000' },
      { requestOrigin: 'http://127.0.0.2:3000' },
      { requestOrigin: 'http://0.0.0.0:3000' },
      { requestOrigin: 'http://user@localhost:3000' },
      { requestOrigin: 'http://localhost:0' },
      { requestOrigin: 'http://localhost:3000, https://attacker.example' },
      { requestOrigin: 'http://localhost:3000\r\nx-evil: injected' },
      { forwardedHost: 'attacker.example', forwardedProto: 'https' },
      { forwardedHost: 'localhost.attacker.example:3000', forwardedProto: 'http' },
      { forwardedHost: 'localhost:3000,attacker.example', forwardedProto: 'http' },
      { forwardedHost: 'localhost:3000\r\nx-evil: injected', forwardedProto: 'http' },
      { forwardedHost: 'localhost:3000', forwardedProto: 'http,https' },
      { forwardedHost: 'user@localhost:3000', forwardedProto: 'http' },
    ] as const

    for (const hostileInput of hostileRequestInputs) {
      expect(
        inviteUtilities.getCampaignInviteBaseURL({
          environment: 'test',
          configuredURL: 'https://dev-campaign.example.org/',
          ...hostileInput,
        }),
      ).toBe('https://dev-campaign.example.org')
      expect(() =>
        inviteUtilities.getCampaignInviteBaseURL({
          environment: 'test',
          configuredURL: undefined,
          ...hostileInput,
        }),
      ).toThrow('origem segura')
    }
  })

  it('fails closed without leaking invite tokens in origin errors or logs', async () => {
    const inviteUtilities = await import('@/utilities/campaignInviteOrigin')
    const token = 'secret-invite-token-that-must-not-leak'
    const consoleSpies = [
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
    ]

    let thrown: unknown
    try {
      inviteUtilities.getCampaignInviteBaseURL({
        environment: 'development',
        configuredURL: undefined,
        requestOrigin: `https://${token}.attacker.example`,
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    expect(String(thrown)).not.toContain(token)
    expect(consoleSpies.flatMap((spy) => spy.mock.calls).join(' ')).not.toContain(token)
    for (const spy of consoleSpies) spy.mockRestore()
  })

  it('ignores all request headers in production', async () => {
    const inviteUtilities = await import('@/utilities/campaignInviteOrigin')

    expect(
      inviteUtilities.getCampaignInviteBaseURL({
        environment: 'production',
        configuredURL: 'https://campanha.example.org/',
        requestOrigin: 'https://attacker.example',
        forwardedHost: 'evil.vercel.app',
        forwardedProto: 'https',
      }),
    ).toBe('https://campanha.example.org')
  })

  it('builds exact decoded WhatsApp messages for both invite kinds', async () => {
    const inviteUtilities = await import('@/utilities/campaignInvite').catch(() => null)

    expect(inviteUtilities).not.toBeNull()
    const input = {
      phone: '(71) 99999-0000',
      recipientName: 'Maria',
      senderName: 'João',
      inviteUrl: 'https://example.com/campanha/convite/a+b',
    }
    const expectations = {
      autopreenchimento:
        'Oi Maria, aqui é João da campanha do Solla. Complete e confirme seu cadastro neste link: https://example.com/campanha/convite/a+b',
      login:
        'Oi Maria, aqui é João da campanha do Solla. Crie ou recupere seu acesso à plataforma neste link: https://example.com/campanha/convite/a+b',
    } as const

    for (const kind of ['autopreenchimento', 'login'] as const) {
      const url = new URL(inviteUtilities!.buildCampaignInviteWhatsAppLink({ ...input, kind }))
      expect(url.origin).toBe('https://wa.me')
      expect(url.pathname).toBe('/5571999990000')
      expect(url.searchParams.get('text')).toBe(expectations[kind])
    }
  })

  it('strips every non-whitelisted field from self-service submissions', async () => {
    const inviteSchemas = await import('@/lib/schemas/invite').catch(() => null)

    expect(inviteSchemas).not.toBeNull()
    const parsed = inviteSchemas!.campaignInviteAutofillSchema.parse({
      token: 'raw-token-long-enough-for-validation',
      name: '  Maria da Silva  ',
      phone: '+55 (71) 99999-0000',
      email: 'maria@example.com',
      gender: 'feminino',
      sector: 'comunitario',
      sectorNotes: 'forjado',
      consentAccepted: true,
      leadership: 999,
      supportStatus: 'engajado',
      notes: 'forged',
      municipalities: [999],
      user: 999,
      consent: 999,
    })

    expect(parsed).toEqual({
      token: 'raw-token-long-enough-for-validation',
      name: 'Maria da Silva',
      phone: '71999990000',
      email: 'maria@example.com',
      gender: 'feminino',
      consentAccepted: true,
    })
  })

  itWithMutableConsent(
    'fails safely when the stable consent document is not configured',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite').catch(() => null)
      expect(actions).not.toBeNull()

      await payload.delete({
        collection: 'consent',
        where: { key: { equals: 'lideranca-autopreenchimento' } },
      })
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { leadership } = await createInviteLeadershipGraph(coordinator, municipality.id)

      await expect(
        createInviteThroughAction(coordinator, {
          leadership: leadership.id,
          kind: 'autopreenchimento',
        }),
      ).rejects.toThrow('Consentimento ainda não configurado')
    },
  )

  itWithInviteConsent(
    'limits creation and reads to the coordinator or the assigned advisor scope',
    async () => {
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const assigned = await campaignFixtures().createCampaignUser('advisor')
      const outsider = await campaignFixtures().createCampaignUser('advisor')
      const municipality = await campaignFixtures().getMunicipality()
      await campaignFixtures().assignMunicipalityAdvisors(municipality, [assigned])
      const { leadership } = await createInviteLeadershipGraph(coordinator, municipality.id)

      await expect(
        createInviteThroughAction(outsider, {
          leadership: leadership.id,
          kind: 'autopreenchimento',
        }),
      ).rejects.toThrow()
      const created = await createInviteThroughAction(assigned, {
        leadership: leadership.id,
        kind: 'autopreenchimento',
      })

      const assignedRead = await payload.find({
        collection: 'campaignInvite',
        user: assigned,
        overrideAccess: false,
        depth: 0,
      })
      const outsiderRead = await payload.find({
        collection: 'campaignInvite',
        user: outsider,
        overrideAccess: false,
        depth: 0,
      })

      expect(assignedRead.totalDocs).toBeGreaterThan(0)
      expect(assignedRead.docs[0]).not.toHaveProperty('tokenHash')
      expect(outsiderRead.totalDocs).toBe(0)
      const rawTokenLookup = await payload.find({
        collection: 'campaignInvite',
        where: { tokenHash: { equals: created.token } },
        depth: 0,
      })
      expect(rawTokenLookup.totalDocs).toBe(0)
    },
  )

  itWithInviteConsent(
    'denies invite creation to leader accounts with the coordination-only message',
    async () => {
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const leaderAccount = await campaignFixtures().createCampaignUser('leader')
      const municipality = await campaignFixtures().getMunicipality()
      const { leadership } = await createInviteLeadershipGraph(coordinator, municipality.id)

      await expect(
        createInviteThroughAction(leaderAccount, {
          leadership: leadership.id,
          kind: 'autopreenchimento',
        }),
      ).rejects.toThrow('Somente a coordenação pode criar convites.')
    },
  )

  itWithInviteConsent(
    'revokes the prior active invite and rejects expired or revoked tokens',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { leadership } = await createInviteLeadershipGraph(coordinator, municipality.id)

      const first = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'autopreenchimento',
      })
      const second = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'autopreenchimento',
      })

      await expect(
        actions.redeemCampaignInviteAutofill({
          token: first.token,
          name: 'Maria Revogada',
          phone: campaignFixtures().phone(),
          consentAccepted: true,
        }),
      ).rejects.toThrow('Convite inválido ou expirado')

      const secondInvite = await payload.find({
        collection: 'campaignInvite',
        where: { tokenHash: { equals: second.tokenHash } },
        depth: 0,
        limit: 1,
      })
      await payload.update({
        collection: 'campaignInvite',
        id: secondInvite.docs[0]!.id,
        data: { expiresAt: new Date(Date.now() - 1000).toISOString() },
      })
      await expect(
        actions.redeemCampaignInviteAutofill({
          token: second.token,
          name: 'Maria Expirada',
          phone: campaignFixtures().phone(),
          consentAccepted: true,
        }),
      ).rejects.toThrow('Convite inválido ou expirado')
    },
  )

  itWithInviteConsent(
    'waits on the exact invite-creation key before revoking or creating an invite',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { leadership } = await createInviteLeadershipGraph(coordinator, municipality.id)
      const first = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'autopreenchimento',
      })
      authState.user = coordinator
      const key = `invite-creation:${leadership.id}:autopreenchimento`

      await expect(
        withBlockedInviteAction({
          key,
          start: () =>
            actions.createCampaignInvite({
              leadership: leadership.id,
              kind: 'autopreenchimento',
            }),
          whileWaiting: async () => {
            const invites = await payload.find({
              collection: 'campaignInvite',
              where: { leadership: { equals: leadership.id } },
              depth: 0,
              pagination: false,
            })
            expect(invites.docs).toHaveLength(1)
            expect(invites.docs[0]).toMatchObject({
              tokenHash: first.tokenHash,
              revokedAt: null,
              usedAt: null,
            })
          },
        }),
      ).resolves.toMatchObject({
        inviteUrl: expect.stringContaining('/campanha/convite/'),
        whatsappUrl: expect.stringContaining('https://wa.me/'),
      })

      const invites = await payload.find({
        collection: 'campaignInvite',
        where: { leadership: { equals: leadership.id } },
        depth: 0,
        pagination: false,
      })
      expect(invites.docs).toHaveLength(2)
      expect(invites.docs.filter((invite) => invite.revokedAt === null)).toHaveLength(1)
      expect(
        invites.docs.find((invite) => invite.tokenHash === first.tokenHash)?.revokedAt,
      ).not.toBe(null)
    },
  )

  itWithInviteConsent(
    'waits on the exact invite-redemption-contact key before login redemption mutates data',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const fixture = await createLinkedLoginInvite(coordinator)
      const key = `invite-redemption-contact:${fixture.contact.id}`
      const originalAccountName = fixture.account.name
      const originalContactName = fixture.contact.name

      await expect(
        withBlockedInviteAction({
          key,
          start: () =>
            actions.redeemCampaignInviteLogin({
              token: fixture.invite.token,
              name: campaignFixtures().value('Nome após contato'),
              phone: fixture.contact.phone,
              password: campaignFixtures().value('senha-nova'),
              consentAccepted: true,
            }),
          whileWaiting: async () => {
            await expectLoginInviteUnchanged({
              accountID: fixture.account.id,
              accountName: originalAccountName,
              contactID: fixture.contact.id,
              contactName: originalContactName,
              inviteHash: fixture.invite.tokenHash,
              leadershipID: fixture.leadership.id,
            })
          },
        }),
      ).resolves.toEqual({ ok: true })
    },
  )

  itWithInviteConsent(
    'waits on the exact account-username key before login redemption mutates data',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const fixture = await createLinkedLoginInvite(coordinator)
      const key = `account-username:${fixture.contact.phone}`

      await expect(
        withBlockedInviteAction({
          key,
          start: () =>
            actions.redeemCampaignInviteLogin({
              token: fixture.invite.token,
              name: campaignFixtures().value('Nome após username'),
              phone: fixture.contact.phone,
              password: campaignFixtures().value('senha-nova'),
              consentAccepted: true,
            }),
          whileWaiting: async (waiterPID) => {
            await expectExactAdvisoryLockGranted(
              `invite-redemption-contact:${fixture.contact.id}`,
              waiterPID,
            )
            await expectLoginInviteUnchanged({
              accountID: fixture.account.id,
              accountName: fixture.account.name,
              contactID: fixture.contact.id,
              contactName: fixture.contact.name,
              inviteHash: fixture.invite.tokenHash,
              leadershipID: fixture.leadership.id,
            })
          },
        }),
      ).resolves.toEqual({ ok: true })
    },
  )

  itWithInviteConsent(
    'orders all login redemption keys before waiting on the exact invite-redemption-user key',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const fixture = await createLinkedLoginInvite(coordinator)
      const usernameKey = `account-username:${fixture.contact.phone}`
      const contactPhoneKey = `contact-phone:${fixture.contact.phone}`
      const userKey = `invite-redemption-user:${fixture.account.id}`

      await expect(
        withBlockedInviteAction({
          key: userKey,
          start: () =>
            actions.redeemCampaignInviteLogin({
              token: fixture.invite.token,
              name: campaignFixtures().value('Nome após usuário'),
              phone: fixture.contact.phone,
              password: campaignFixtures().value('senha-nova'),
              consentAccepted: true,
            }),
          whileWaiting: async (waiterPID) => {
            await Promise.all([
              expectExactAdvisoryLockGranted(usernameKey, waiterPID),
              expectExactAdvisoryLockGranted(contactPhoneKey, waiterPID),
              expectExactAdvisoryLockGranted(
                `invite-redemption-contact:${fixture.contact.id}`,
                waiterPID,
              ),
            ])
            await expectLoginInviteUnchanged({
              accountID: fixture.account.id,
              accountName: fixture.account.name,
              contactID: fixture.contact.id,
              contactName: fixture.contact.name,
              inviteHash: fixture.invite.tokenHash,
              leadershipID: fixture.leadership.id,
            })
          },
        }),
      ).resolves.toEqual({ ok: true })
    },
  )

  itWithInviteConsent(
    'consumes an autofill invite once under concurrent redemption and writes only the whitelist',
    async (consent) => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { contact, leadership } = await createInviteLeadershipGraph(
        coordinator,
        municipality.id,
      )
      const invite = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'autopreenchimento',
      })
      const submission = {
        token: invite.token,
        name: 'Maria Confirmada',
        phone: campaignFixtures().phone(),
        email: 'confirmada@example.com',
        gender: 'feminino' as const,
        consentAccepted: true as const,
        supportStatus: 'negativo',
        notes: 'tentativa de sobrescrita',
        municipalities: [999],
        user: 999,
      }

      const results = await Promise.allSettled([
        actions.redeemCampaignInviteAutofill(submission),
        actions.redeemCampaignInviteAutofill(submission),
      ])
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)

      const updatedContact = await payload.findByID({
        collection: 'contact',
        id: contact.id,
        depth: 0,
      })
      const updatedLeadership = await payload.findByID({
        collection: 'leadership',
        id: leadership.id,
        depth: 0,
      })
      expect(updatedContact).toMatchObject({
        name: 'Maria Confirmada',
        phone: submission.phone,
        email: 'confirmada@example.com',
        gender: 'feminino',
      })
      expect(updatedLeadership).toMatchObject({
        supportStatus: 'engajado',
        notes: 'Nota interna protegida',
        municipalities: [municipality.id],
        consent: consent.id,
      })
      expect(updatedLeadership.user).toBeNull()
    },
  )

  itWithInviteConsent(
    'waits on the exact contact-phone namespace before an invite changes a phone',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { contact, leadership } = await createInviteLeadershipGraph(
        coordinator,
        municipality.id,
      )
      const invite = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'autopreenchimento',
      })
      const targetPhone = campaignFixtures().phone()
      const holderID = await payload.db.beginTransaction()
      if (holderID === null) throw new Error('Expected a PostgreSQL transaction.')
      const holderReq = { transactionID: holderID }
      await acquireTextAdvisoryLocks(payload, holderReq, [`contact-phone:${targetPhone}`])

      const originalBegin = payload.db.beginTransaction.bind(payload.db)
      let resolveWaiterPID!: (pid: number) => void
      const waiterPID = new Promise<number>((resolve) => {
        resolveWaiterPID = resolve
      })
      const beginSpy = vi.spyOn(payload.db, 'beginTransaction').mockImplementation(async () => {
        const transactionID = await originalBegin()
        if (transactionID === null) throw new Error('Expected the invite transaction to start.')
        resolveWaiterPID(await getTestTransactionBackendPID(payload, transactionID))
        return transactionID
      })
      const pending = actions.redeemCampaignInviteAutofill({
        token: invite.token,
        name: contact.name,
        phone: targetPhone,
        consentAccepted: true,
      })

      try {
        const expectedPID = await waiterPID
        const waiting = await waitForAdvisoryLockWaiter(payload, {
          key: `contact-phone:${targetPhone}`,
          mode: 'ExclusiveLock',
          waiterPID: expectedPID,
        })
        expect(waiting).toMatchObject({
          classID: waiting.expectedClassID,
          granted: false,
          objectID: waiting.expectedObjectID,
          objectSubID: 1,
          pid: expectedPID,
        })
        await payload.db.rollbackTransaction(holderID)
        await expect(pending).resolves.toEqual({ ok: true })
      } catch (error) {
        await payload.db.rollbackTransaction(holderID).catch(() => undefined)
        throw error
      } finally {
        beginSpy.mockRestore()
      }
    },
  )

  itWithInviteConsent(
    'shares a phone with another ficha on autofill and keeps the invite consumed (C111)',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const target = await createInviteLeadershipGraph(coordinator, municipality.id)
      const owner = await createInviteLeadershipGraph(coordinator, municipality.id)
      const invite = await createInviteThroughAction(coordinator, {
        leadership: target.leadership.id,
        kind: 'autopreenchimento',
      })

      // C111 — the ficha the invite anchors is known; the typed phone may
      // legitimately match another ficha's, and the write shares it.
      await expect(
        actions.redeemCampaignInviteAutofill({
          token: invite.token,
          name: target.contact.name,
          phone: owner.contact.phone,
          consentAccepted: true,
        }),
      ).resolves.toEqual({ ok: true })

      await expect(
        payload.findByID({ collection: 'contact', id: target.contact.id, depth: 0 }),
      ).resolves.toMatchObject({ phone: owner.contact.phone })
      await expect(
        payload.findByID({ collection: 'contact', id: owner.contact.id, depth: 0 }),
      ).resolves.toMatchObject({ phone: owner.contact.phone })
    },
  )

  itWithInviteConsent(
    'lets two concurrent autofills share one phone and consumes both invites (C111)',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const firstMunicipality = await campaignFixtures().getMunicipality()
      const secondMunicipality = await campaignFixtures().getMunicipality()
      const first = await createInviteLeadershipGraph(coordinator, firstMunicipality.id)
      const second = await createInviteLeadershipGraph(coordinator, secondMunicipality.id)
      const firstInvite = await createInviteThroughAction(coordinator, {
        leadership: first.leadership.id,
        kind: 'autopreenchimento',
      })
      const secondInvite = await createInviteThroughAction(coordinator, {
        leadership: second.leadership.id,
        kind: 'autopreenchimento',
      })
      const targetPhone = campaignFixtures().phone()
      const submissions = [
        {
          token: firstInvite.token,
          name: first.contact.name,
          phone: targetPhone,
          consentAccepted: true as const,
        },
        {
          token: secondInvite.token,
          name: second.contact.name,
          phone: targetPhone,
          consentAccepted: true as const,
        },
      ]

      const results = await Promise.allSettled(
        submissions.map((submission) => actions.redeemCampaignInviteAutofill(submission)),
      )
      // C111 — the phone is a contact channel: both invites may share it.
      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(2)

      const contacts = await Promise.all(
        [first.contact.id, second.contact.id].map((id) =>
          payload.findByID({ collection: 'contact', id, depth: 0 }),
        ),
      )
      expect(contacts.every(({ phone }) => phone === targetPhone)).toBe(true)
    },
  )

  itWithInviteConsent(
    'completes opposite phone swaps without deadlock and shares the numbers (C111)',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const first = await createInviteLeadershipGraph(coordinator, municipality.id)
      const second = await createInviteLeadershipGraph(coordinator, municipality.id)
      const firstInvite = await createInviteThroughAction(coordinator, {
        leadership: first.leadership.id,
        kind: 'autopreenchimento',
      })
      const secondInvite = await createInviteThroughAction(coordinator, {
        leadership: second.leadership.id,
        kind: 'autopreenchimento',
      })

      const results = await Promise.allSettled([
        actions.redeemCampaignInviteAutofill({
          token: firstInvite.token,
          name: first.contact.name,
          phone: second.contact.phone,
          consentAccepted: true,
        }),
        actions.redeemCampaignInviteAutofill({
          token: secondInvite.token,
          name: second.contact.name,
          phone: first.contact.phone,
          consentAccepted: true,
        }),
      ])
      // Both write the other's number (shared channel) — the ordered locks
      // keep the swap deadlock-free instead of serializing exclusivity.
      expect(results.every(({ status }) => status === 'fulfilled')).toBe(true)
      const [firstContact, secondContact] = await Promise.all([
        payload.findByID({ collection: 'contact', id: first.contact.id, depth: 0 }),
        payload.findByID({ collection: 'contact', id: second.contact.id, depth: 0 }),
      ])
      expect(firstContact.phone).toBe(second.contact.phone)
      expect(secondContact.phone).toBe(first.contact.phone)
    },
  )

  itWithInviteConsent(
    'persists explicit optional-field clears and leaves absent fields unchanged',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const cleared = await createInviteLeadershipGraph(coordinator, municipality.id)
      await payload.update({
        collection: 'contact',
        id: cleared.contact.id,
        data: { email: 'antes@example.com', gender: 'feminino' },
      })
      const clearInvite = await createInviteThroughAction(coordinator, {
        leadership: cleared.leadership.id,
        kind: 'autopreenchimento',
      })

      await actions.redeemCampaignInviteAutofill({
        token: clearInvite.token,
        name: cleared.contact.name,
        phone: cleared.contact.phone,
        email: '',
        gender: '',
        consentAccepted: true,
      })

      await expect(
        payload.findByID({ collection: 'contact', id: cleared.contact.id, depth: 0 }),
      ).resolves.toMatchObject({ email: null, gender: null })

      const unchanged = await createInviteLeadershipGraph(coordinator, municipality.id)
      await payload.update({
        collection: 'contact',
        id: unchanged.contact.id,
        data: { email: 'mantido@example.com', gender: 'masculino' },
      })
      const unchangedInvite = await createInviteThroughAction(coordinator, {
        leadership: unchanged.leadership.id,
        kind: 'autopreenchimento',
      })

      await actions.redeemCampaignInviteAutofill({
        token: unchangedInvite.token,
        name: unchanged.contact.name,
        phone: unchanged.contact.phone,
        consentAccepted: true,
      })

      await expect(
        payload.findByID({ collection: 'contact', id: unchanged.contact.id, depth: 0 }),
      ).resolves.toMatchObject({ email: 'mantido@example.com', gender: 'masculino' })
    },
  )

  itWithInviteConsent(
    'allows login only for engaged leadership and reuses accounts for recovery without reducing role',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const engaged = await createInviteLeadershipGraph(coordinator, municipality.id, 'engajado')
      const inactive = await createInviteLeadershipGraph(coordinator, municipality.id, 'a_abordar')

      await expect(
        createInviteThroughAction(coordinator, {
          leadership: inactive.leadership.id,
          kind: 'login',
        }),
      ).rejects.toThrow('engajada')

      const existingCoordinator = await payload.create({
        collection: 'campaignUser',
        data: {
          name: 'Conta existente',
          username: engaged.contact.phone,
          password: 'senha-antiga',
          role: 'coordinator',
        },
      })
      await payload.update({
        collection: 'leadership',
        id: engaged.leadership.id,
        data: { user: existingCoordinator.id },
        depth: 0,
      })
      const invite = await createInviteThroughAction(coordinator, {
        leadership: engaged.leadership.id,
        kind: 'login',
      })
      const recoveredPassword = '  senha-nova-segura  '
      await actions.redeemCampaignInviteLogin({
        token: invite.token,
        name: 'Conta recuperada',
        phone: engaged.contact.phone,
        password: recoveredPassword,
        consentAccepted: true,
      })

      const reused = await payload.findByID({
        collection: 'campaignUser',
        id: existingCoordinator.id,
        depth: 0,
      })
      const linked = await payload.findByID({
        collection: 'leadership',
        id: engaged.leadership.id,
        depth: 0,
      })
      const inactivePersisted = await payload.findByID({
        collection: 'leadership',
        id: inactive.leadership.id,
        depth: 0,
      })
      expect(reused.role).toBe('coordinator')
      expect(reused.phone).toBe(engaged.contact.phone)
      expect(linked.user).toBe(existingCoordinator.id)
      expect(inactivePersisted.user).toBeNull()
      await expect(
        payload.login({
          collection: 'campaignUser',
          data: { username: engaged.contact.phone, password: recoveredPassword },
        }),
      ).resolves.toHaveProperty('token')
      await expect(
        payload.login({
          collection: 'campaignUser',
          data: { username: engaged.contact.phone, password: recoveredPassword.trim() },
        }),
      ).rejects.toThrow()
    },
  )

  itWithInviteConsent(
    'requires missing consent for login and rolls back consumption on rejection',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { contact, leadership } = await createInviteLeadershipGraph(
        coordinator,
        municipality.id,
      )
      const invite = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'login',
      })
      const submission = {
        token: invite.token,
        name: contact.name,
        phone: contact.phone,
        password: 'senha-segura-nova',
      }

      await expect(actions.redeemCampaignInviteLogin(submission)).rejects.toThrow(
        'aceitar o consentimento',
      )
      await expect(
        actions.redeemCampaignInviteLogin({
          ...submission,
          consentAccepted: true,
        }),
      ).resolves.toEqual({ ok: true })
    },
  )

  itWithInviteConsent(
    'requires new acceptance before replacing an older consent during recovery',
    async (configuredConsent) => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const oldConsent = await campaignFixtures().createConsent({
        key: null,
        text: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Consentimento anterior', version: 1 }],
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
      })
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { contact, leadership } = await createInviteLeadershipGraph(
        coordinator,
        municipality.id,
      )
      const account = await payload.create({
        collection: 'campaignUser',
        data: {
          name: contact.name,
          username: contact.phone,
          password: 'senha-anterior-segura',
          role: 'leader',
        },
      })
      await payload.update({
        collection: 'leadership',
        id: leadership.id,
        data: { consent: oldConsent.id, user: account.id },
      })
      const invite = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'login',
      })
      const submission = {
        token: invite.token,
        name: contact.name,
        phone: contact.phone,
        password: 'senha-nova-segura',
      }

      await expect(actions.redeemCampaignInviteLogin(submission)).rejects.toThrow(
        'aceitar o consentimento',
      )
      await expect(
        payload.findByID({ collection: 'leadership', id: leadership.id, depth: 0 }),
      ).resolves.toMatchObject({ consent: oldConsent.id, user: account.id })
      await expect(
        payload.login({
          collection: 'campaignUser',
          data: { username: contact.phone, password: 'senha-anterior-segura' },
        }),
      ).resolves.toHaveProperty('token')

      await expect(
        actions.redeemCampaignInviteLogin({ ...submission, consentAccepted: true }),
      ).resolves.toEqual({ ok: true })
      await expect(
        payload.findByID({ collection: 'leadership', id: leadership.id, depth: 0 }),
      ).resolves.toMatchObject({ consent: configuredConsent.id, user: account.id })
    },
  )

  itWithMutableConsent(
    'requires reacceptance when the configured consent text changes in the same document',
    async (consent) => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const { getCampaignInvitePageData } = await import('@/utilities/campaignInvitePageData')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { contact, leadership } = await createInviteLeadershipGraph(
        coordinator,
        municipality.id,
      )
      const firstInvite = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'autopreenchimento',
      })

      await actions.redeemCampaignInviteAutofill({
        token: firstInvite.token,
        name: contact.name,
        phone: contact.phone,
        consentAccepted: true,
      })
      const firstAcceptance = await payload.findByID({
        collection: 'leadership',
        id: leadership.id,
        depth: 0,
      })
      expect(firstAcceptance.consent).toBe(consent.id)
      expect(firstAcceptance.consentContentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(firstAcceptance.consentedAt).toBeTruthy()

      await payload.update({
        collection: 'consent',
        id: consent.id,
        data: {
          text: {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    { type: 'text', text: campaignFixtures().value('Texto alterado'), version: 1 },
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
      const secondInvite = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'autopreenchimento',
      })
      await expect(getCampaignInvitePageData(payload, secondInvite.token)).resolves.toMatchObject({
        status: 'valid',
        requiresConsent: true,
      })
      await expect(
        actions.redeemCampaignInviteAutofill({
          token: secondInvite.token,
          name: contact.name,
          phone: contact.phone,
        }),
      ).rejects.toThrow('aceitar o consentimento')
      await expect(
        actions.redeemCampaignInviteAutofill({
          token: secondInvite.token,
          name: contact.name,
          phone: contact.phone,
          consentAccepted: true,
        }),
      ).resolves.toEqual({ ok: true })

      const secondAcceptance = await payload.findByID({
        collection: 'leadership',
        id: leadership.id,
        depth: 0,
      })
      expect(secondAcceptance.consent).toBe(consent.id)
      expect(secondAcceptance.consentContentHash).not.toBe(firstAcceptance.consentContentHash)
      expect(secondAcceptance.consentedAt).not.toBe(firstAcceptance.consentedAt)
    },
  )

  itWithInviteConsent(
    'rejects takeover of an unlinked elevated account with the submitted phone',
    async () => {
      const records = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { contact, leadership } = await createInviteLeadershipGraph(
        coordinator,
        municipality.id,
      )
      const victim = await payload.create({
        collection: 'campaignUser',
        data: {
          name: 'Coordenação vítima',
          username: contact.phone,
          password: 'senha-original-segura',
          role: 'coordinator',
        },
      })
      const invite = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'login',
      })

      await expect(
        records.redeemCampaignInviteLogin({
          token: invite.token,
          name: contact.name,
          phone: contact.phone,
          password: 'senha-tomada-segura',
          consentAccepted: true,
        }),
      ).rejects.toThrow('Convite inválido ou expirado')
      const persistedLeadership = await payload.findByID({
        collection: 'leadership',
        id: leadership.id,
        depth: 0,
      })
      expect(persistedLeadership.user).toBeNull()
      await expect(
        payload.login({
          collection: 'campaignUser',
          data: { username: contact.phone, password: 'senha-original-segura' },
        }),
      ).resolves.toMatchObject({ user: { id: victim.id, role: 'coordinator' } })
    },
  )

  itWithInviteConsent('rejects lateral takeover of another leadership account', async () => {
    const records = await import('@/app/(campaign)/campanha/actions/invite')
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const targetMunicipality = await campaignFixtures().getMunicipality()
    const otherMunicipality = await campaignFixtures().getMunicipality()
    const target = await createInviteLeadershipGraph(coordinator, targetMunicipality.id)
    const other = await createInviteLeadershipGraph(coordinator, otherMunicipality.id)
    const lateralAccount = await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Outra liderança',
        username: target.contact.phone,
        password: 'senha-lateral-original',
        role: 'leader',
      },
    })
    await payload.update({
      collection: 'leadership',
      id: other.leadership.id,
      data: { user: lateralAccount.id },
    })
    const invite = await createInviteThroughAction(coordinator, {
      leadership: target.leadership.id,
      kind: 'login',
    })

    await expect(
      records.redeemCampaignInviteLogin({
        token: invite.token,
        name: target.contact.name,
        phone: target.contact.phone,
        password: 'senha-lateral-tomada',
        consentAccepted: true,
      }),
    ).rejects.toThrow('Convite inválido ou expirado')
    const targetPersisted = await payload.findByID({
      collection: 'leadership',
      id: target.leadership.id,
      depth: 0,
    })
    expect(targetPersisted.user).toBeNull()
  })

  itWithMutableConsent(
    'requires the configured consent key even when the leadership already has consent',
    async (consent) => {
      const records = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { contact, leadership } = await createInviteLeadershipGraph(
        coordinator,
        municipality.id,
      )
      const invite = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'autopreenchimento',
      })
      await payload.update({
        collection: 'leadership',
        id: leadership.id,
        data: { consent: consent.id },
      })
      await payload.update({
        collection: 'consent',
        id: consent.id,
        data: { key: 'chave-renomeada' },
      })

      await expect(
        records.redeemCampaignInviteAutofill({
          token: invite.token,
          name: 'Nome não persistido',
          phone: contact.phone,
          consentAccepted: true,
        }),
      ).rejects.toThrow('Consentimento ainda não configurado')
      const unchanged = await payload.findByID({
        collection: 'contact',
        id: contact.id,
        depth: 0,
      })
      expect(unchanged.name).toBe(contact.name)
      await payload.update({
        collection: 'consent',
        id: consent.id,
        data: { key: 'lideranca-autopreenchimento' },
      })
      await expect(
        records.redeemCampaignInviteAutofill({
          token: invite.token,
          name: 'Nome após restauração',
          phone: contact.phone,
          consentAccepted: true,
        }),
      ).resolves.toEqual({ ok: true })
    },
  )

  itWithMutableConsent(
    'rolls back linked-account recovery when the configured consent key is missing',
    async (consent) => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const municipality = await campaignFixtures().getMunicipality()
      const { contact, leadership } = await createInviteLeadershipGraph(
        coordinator,
        municipality.id,
      )
      const account = await payload.create({
        collection: 'campaignUser',
        data: {
          name: contact.name,
          username: contact.phone,
          password: 'senha-original-consentimento',
          role: 'leader',
        },
      })
      await payload.update({
        collection: 'leadership',
        id: leadership.id,
        data: { consent: consent.id, user: account.id },
      })
      const invite = await createInviteThroughAction(coordinator, {
        leadership: leadership.id,
        kind: 'login',
      })
      await payload.update({
        collection: 'consent',
        id: consent.id,
        data: { key: 'chave-temporariamente-ausente' },
      })
      const submission = {
        token: invite.token,
        name: contact.name,
        phone: contact.phone,
        password: 'senha-nova-consentimento',
      }

      await expect(actions.redeemCampaignInviteLogin(submission)).rejects.toThrow(
        'Consentimento ainda não configurado',
      )
      await expect(
        payload.login({
          collection: 'campaignUser',
          data: { username: contact.phone, password: 'senha-original-consentimento' },
        }),
      ).resolves.toHaveProperty('token')
      await payload.update({
        collection: 'consent',
        id: consent.id,
        data: { key: 'lideranca-autopreenchimento' },
      })
      await expect(
        actions.redeemCampaignInviteLogin({ ...submission, consentAccepted: true }),
      ).resolves.toEqual({ ok: true })
    },
  )

  itWithInviteConsent(
    'serializes concurrent new-account creation for the same username and creates leader accounts',
    async () => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      const firstMunicipality = await campaignFixtures().getMunicipality()
      const secondMunicipality = await campaignFixtures().getMunicipality()
      const first = await createInviteLeadershipGraph(coordinator, firstMunicipality.id)
      const second = await createInviteLeadershipGraph(coordinator, secondMunicipality.id)
      const firstInvite = await createInviteThroughAction(coordinator, {
        leadership: first.leadership.id,
        kind: 'login',
      })
      const secondInvite = await createInviteThroughAction(coordinator, {
        leadership: second.leadership.id,
        kind: 'login',
      })
      const sharedPhone = campaignFixtures().phone()
      const results = await Promise.allSettled([
        actions.redeemCampaignInviteLogin({
          token: firstInvite.token,
          name: first.contact.name,
          phone: sharedPhone,
          password: 'senha-corrida-segura',
          consentAccepted: true,
        }),
        actions.redeemCampaignInviteLogin({
          token: secondInvite.token,
          name: second.contact.name,
          phone: sharedPhone,
          password: 'senha-corrida-segura',
          consentAccepted: true,
        }),
      ])

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
      const accounts = await payload.find({
        collection: 'campaignUser',
        where: { username: { equals: sharedPhone } },
        depth: 0,
      })
      expect(accounts.totalDocs).toBe(1)
      expect(accounts.docs[0]!.role).toBe('leader')
    },
  )

  itWithInviteConsent(
    'returns only minimal serializable DTOs from public server actions',
    async (consent) => {
      const actions = await import('@/app/(campaign)/campanha/actions/invite')
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')
      authState.user = coordinator
      const municipality = await campaignFixtures().getMunicipality()
      const autofillTarget = await createInviteLeadershipGraph(coordinator, municipality.id)
      const created = await actions.createCampaignInvite({
        leadership: autofillTarget.leadership.id,
        kind: 'autopreenchimento',
      })
      expect(Object.keys(created).sort()).toEqual(['inviteUrl', 'whatsappUrl'])
      expect(created.inviteUrl).toMatch(/^http:\/\/localhost:3000\/campanha\/convite\/[^/]+$/)
      expect(JSON.stringify(created)).not.toContain('tokenHash')
      const autofillToken = new URL(created.inviteUrl).pathname.split('/').pop()!
      await expect(
        actions.redeemCampaignInviteAutofill({
          token: autofillToken,
          name: autofillTarget.contact.name,
          phone: autofillTarget.contact.phone,
          consentAccepted: true,
        }),
      ).resolves.toEqual({ ok: true })

      const loginTarget = await createInviteLeadershipGraph(coordinator, municipality.id)
      await payload.update({
        collection: 'leadership',
        id: loginTarget.leadership.id,
        data: { consent: consent.id },
      })
      const loginCreated = await actions.createCampaignInvite({
        leadership: loginTarget.leadership.id,
        kind: 'login',
      })
      const loginToken = new URL(loginCreated.inviteUrl).pathname.split('/').pop()!
      await expect(
        actions.redeemCampaignInviteLogin({
          token: loginToken,
          name: loginTarget.contact.name,
          phone: loginTarget.contact.phone,
          password: 'senha-publica-segura',
          consentAccepted: true,
        }),
      ).resolves.toEqual({ ok: true })
      await expect(
        payload.findByID({
          collection: 'leadership',
          id: loginTarget.leadership.id,
          depth: 0,
        }),
      ).resolves.toMatchObject({ consent: consent.id })
      expect(cookieState.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object))
      expect(JSON.stringify(loginCreated)).not.toMatch(
        /tokenHash|supportStatus|notes|consentNote|sessions|salt|hash/,
      )
    },
  )
})
