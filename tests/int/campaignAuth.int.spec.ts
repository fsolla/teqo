// @vitest-environment node

import { readFileSync } from 'node:fs'

import type { Payload, PayloadRequest } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { assignPlazaAdvisorsRecord } from '@/app/(campaign)/campanha/actions/plaza'
import config from '@/payload.config'
import type { CampaignUser } from '@/payload-types'
import { CampaignUser as CampaignUserCollection } from '@/collections/CampaignUser'
import { campaignLoginSchema } from '@/lib/schemas/campaign-login'
import { getAccessiblePlazaIds, isCampaignCoordinator } from '@/utilities/campaignAccess'
import { authenticateCampaignToken } from '@/utilities/campaignAuth'
import {
  buildWhatsAppUrl,
  normalizeBrazilianPhone,
  sanitizeBrazilianPhoneInput,
} from '@/utilities/phone'
import { getPayload } from 'payload'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('campaign authentication foundation', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('configures optional username and email login', () => {
    expect(CampaignUserCollection.auth).toMatchObject({
      loginWithUsername: {
        allowEmailLogin: true,
        requireEmail: false,
        requireUsername: false,
      },
    })
  })

  it('defaults newly created campaign users to leader', async () => {
    const username = campaignFixtures().phone()
    const user = await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Liderança padrão',
        username,
        password: campaignFixtures().value('password'),
      } as never,
    })

    expect(user.role).toBe('leader')
  })

  it('authenticates staff by email and leadership by normalized phone', async () => {
    const password = campaignFixtures().value('password')
    const email = `${campaignFixtures().value('staff')}@example.com`
    const phone = campaignFixtures().phone()

    await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Coordenação',
        email,
        password,
        role: 'coordinator',
      },
    })
    await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Liderança',
        username: phone,
        password,
        role: 'leader',
      },
    })

    const staffLogin = await payload.login({
      collection: 'campaignUser',
      data: { email, password },
    })
    const leadershipLogin = await payload.login({
      collection: 'campaignUser',
      data: { username: phone, password },
    })

    expect(staffLogin.user?.email).toBe(email)
    expect(leadershipLogin.user?.username).toBe(phone)
  })

  it('preserves leading and trailing password spaces through validation and Payload login', async () => {
    const password = `  ${campaignFixtures().value('exact-password')}  `
    const trimmedPassword = password.trim()
    const email = `${campaignFixtures().value('spaced-password')}@example.com`

    await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Senha com espaços',
        email,
        password,
        role: 'coordinator',
      },
    })

    const parsed = campaignLoginSchema.parse({
      identifier: ` ${email} `,
      password,
    })
    expect(parsed).toEqual({ identifier: email, password })
    await expect(
      payload.login({
        collection: 'campaignUser',
        data: { email: parsed.identifier, password: parsed.password },
      }),
    ).resolves.toHaveProperty('token')
    await expect(
      payload.login({
        collection: 'campaignUser',
        data: { email, password: trimmedPassword },
      }),
    ).rejects.toThrow()
  })

  it('re-reads the campaign user so a role downgrade applies immediately', async () => {
    const staleJwtUser = {
      id: 42,
      collection: 'campaignUser',
      role: 'coordinator',
    } as CampaignUser
    const currentUser = {
      ...staleJwtUser,
      role: 'advisor',
    } as CampaignUser
    const auth = vi.fn().mockResolvedValue({ user: staleJwtUser })
    const findByID = vi.fn().mockResolvedValue(currentUser)

    const result = await authenticateCampaignToken('token', {
      auth,
      findByID,
    })

    expect(findByID).toHaveBeenCalledWith({
      collection: 'campaignUser',
      id: staleJwtUser.id,
      depth: 1,
    })
    expect(result?.email).toBe('')
    expect(result?.role).toBe('advisor')
    expect(isCampaignCoordinator(result)).toBe(false)
  })

  it('denies management when a stale JWT still says coordinator after downgrade', async () => {
    const staleCoordinator = await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Coordenação rebaixada',
        email: `${campaignFixtures().value('downgraded')}@example.com`,
        password: campaignFixtures().value('password'),
        role: 'coordinator',
      },
    })

    await payload.update({
      collection: 'campaignUser',
      id: staleCoordinator.id,
      data: {
        role: 'advisor',
      },
    })

    await expect(
      payload.create({
        collection: 'campaignUser',
        data: {
          name: 'Criação indevida',
          email: `${campaignFixtures().value('denied')}@example.com`,
          password: campaignFixtures().value('password'),
          role: 'coordinator',
        },
        user: staleCoordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it.each(['coordinator', 'advisor', 'leader'] as const)(
    'hides identity and private auth fields from another %s user',
    async (role) => {
      const viewer = await payload.create({
        collection: 'campaignUser',
        data: {
          name: `Viewer ${role}`,
          email: `${campaignFixtures().value(role)}@example.com`,
          password: campaignFixtures().value('password'),
          role,
        },
      })
      const target = await payload.create({
        collection: 'campaignUser',
        data: {
          name: 'Outra liderança',
          username: campaignFixtures().phone(),
          password: campaignFixtures().value('password'),
          role: 'leader',
        },
      })

      const visibleTarget = await payload.findByID({
        collection: 'campaignUser',
        id: target.id,
        user: viewer,
        overrideAccess: false,
      })

      expect(visibleTarget.name).toBe(target.name)
      expect(visibleTarget.email).toBeUndefined()
      expect(visibleTarget.username).toBeUndefined()
      expect(visibleTarget.hash).toBeUndefined()
      expect(visibleTarget.salt).toBeUndefined()
      expect(visibleTarget.sessions).toBeUndefined()
      expect(visibleTarget.loginAttempts).toBeUndefined()
      expect(visibleTarget.lockUntil).toBeUndefined()
      expect(visibleTarget.resetPasswordToken).toBeUndefined()
      expect(visibleTarget.resetPasswordExpiration).toBeUndefined()
    },
  )

  it('allows a campaign user to read their own identity fields', async () => {
    const username = campaignFixtures().phone()
    const target = await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Liderança titular',
        username,
        password: campaignFixtures().value('password'),
        role: 'leader',
      },
    })

    const visibleTarget = await payload.findByID({
      collection: 'campaignUser',
      id: target.id,
      user: target,
      overrideAccess: false,
    })

    expect(visibleTarget.username).toBe(username)
  })

  it('allows a Payload admin to read campaign user identity fields', async () => {
    const admin = await campaignFixtures().createAdminUser({
      email: `${campaignFixtures().value('admin')}@example.com`,
      password: campaignFixtures().value('password'),
    })
    const username = campaignFixtures().phone()
    const target = await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Liderança administrada',
        username,
        password: campaignFixtures().value('password'),
      } as never,
    })

    const visibleTarget = await payload.findByID({
      collection: 'campaignUser',
      id: target.id,
      user: admin,
      overrideAccess: false,
    })

    expect(visibleTarget.username).toBe(username)
  })

  it.each([
    { actorKind: 'admin', targetRole: 'advisor' },
    { actorKind: 'coordinator', targetRole: 'coordinator' },
  ] as const)(
    'blocks an assigned $targetRole downgrade from a Payload $actorKind while advisor of a plaza',
    async ({ actorKind, targetRole }) => {
      const coordinator = await payload.create({
        collection: 'campaignUser',
        data: {
          name: 'Coordenação responsável',
          email: `${campaignFixtures().value('coordinator')}@example.com`,
          password: campaignFixtures().value('password'),
          role: 'coordinator',
        },
      })
      const admin =
        actorKind === 'admin'
          ? await campaignFixtures().createAdminUser({
              email: `${campaignFixtures().value('admin')}@example.com`,
              password: campaignFixtures().value('password'),
            })
          : null
      const target = await payload.create({
        collection: 'campaignUser',
        data: {
          name: 'Responsável ainda designado',
          email: `${campaignFixtures().value('assigned')}@example.com`,
          password: campaignFixtures().value('password'),
          role: targetRole,
        },
      })
      const plaza = await campaignFixtures().getPlaza()
      await campaignFixtures().assignPlazaAdvisors(plaza, [target])
      const actor = admin ?? coordinator

      await expect(
        payload.update({
          collection: 'campaignUser',
          id: target.id,
          data: { role: 'leader' },
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow(
        'Remova ou substitua este usuário da assessoria de todas as Praças antes de alterar o papel para liderança.',
      )

      if (admin) {
        await payload.update({
          collection: 'plaza',
          id: plaza.id,
          data: { advisors: [] },
          user: admin,
          overrideAccess: false,
          depth: 0,
        })
      } else {
        await assignPlazaAdvisorsRecord(payload, coordinator, {
          plaza: plaza.id,
          advisors: [],
        })
      }
      const downgraded = await payload.update({
        collection: 'campaignUser',
        id: target.id,
        data: { role: 'leader' },
        user: actor,
        overrideAccess: false,
      })

      expect(downgraded.role).toBe('leader')
    },
  )

  it.each(['advisor', 'leader'] as const)(
    'denies campaignUser CRUD management to an ordinary %s',
    async (role) => {
      const actor = await payload.create({
        collection: 'campaignUser',
        data: {
          name: `Actor ${role}`,
          email: `${campaignFixtures().value(role)}@example.com`,
          password: campaignFixtures().value('password'),
          role,
        },
      })
      const target = await payload.create({
        collection: 'campaignUser',
        data: {
          name: 'Alvo',
          email: `${campaignFixtures().value('target')}@example.com`,
          password: campaignFixtures().value('password'),
          role: 'leader',
        },
      })

      await expect(
        payload.create({
          collection: 'campaignUser',
          data: {
            name: 'Criação indevida',
            email: `${campaignFixtures().value('denied')}@example.com`,
            password: campaignFixtures().value('password'),
          } as never,
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      await expect(
        payload.update({
          collection: 'campaignUser',
          id: target.id,
          data: { name: 'Atualização indevida' },
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      await expect(
        payload.delete({
          collection: 'campaignUser',
          id: target.id,
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    },
  )

  it('guards migration rollback when phone-only accounts exist', () => {
    const migration = readFileSync(
      new URL(
        '../../src/migrations/20260718_010733_consolidate_campaign_schema.ts',
        import.meta.url,
      ),
      'utf8',
    )

    expect(migration).toContain('IF EXISTS (SELECT 1 FROM "campaign_user")')
    expect(migration).toContain('RAISE EXCEPTION')
  })

  it('returns only plazas administered by an advisor', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const assignedPlaza = await campaignFixtures().getPlaza()
    const otherPlaza = await campaignFixtures().getPlaza()
    await campaignFixtures().assignPlazaAdvisors(assignedPlaza, [advisor])

    const req = { context: {}, payload } as unknown as PayloadRequest

    const ids = await getAccessiblePlazaIds(req, advisor)

    expect(ids).toEqual([assignedPlaza.id])
    expect(ids).not.toContain(otherPlaza.id)
  })

  it('uses the current role when resolving accessible plazas', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 7 }],
    })
    const staleCoordinator = {
      id: 11,
      collection: 'campaignUser',
      role: 'coordinator',
    } as CampaignUser
    const currentAdvisor = {
      ...staleCoordinator,
      role: 'advisor',
    } as CampaignUser
    const req = {
      context: {},
      payload: {
        collections: {
          plaza: {},
        },
        find,
        findByID: vi.fn().mockResolvedValue(currentAdvisor),
      },
      user: staleCoordinator,
    } as unknown as PayloadRequest

    const ids = await getAccessiblePlazaIds(req)

    expect(ids).toEqual([7])
    expect(req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'campaignUser',
        id: staleCoordinator.id,
        overrideAccess: true,
        req,
      }),
    )
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'plaza',
        req,
        where: {
          advisors: {
            contains: staleCoordinator.id,
          },
        },
      }),
    )
  })

  it('returns only engaged plazas for a leader and propagates req', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 3, plazas: [7], organizations: [] }],
    })
    const req = {
      context: {},
      payload: {
        collections: {
          leadership: {},
        },
        find,
      },
    } as unknown as PayloadRequest
    const user = {
      id: 12,
      collection: 'campaignUser',
      role: 'leader',
    } as CampaignUser

    const ids = await getAccessiblePlazaIds(req, user)

    expect(ids).toEqual([7])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'leadership',
        overrideAccess: true,
        req,
        where: {
          and: [{ user: { equals: user.id } }, { supportStatus: { equals: 'engajado' } }],
        },
      }),
    )
  })

  it.each([
    ['(71) 99999-1234', '71999991234'],
    ['+55 71 99999-1234', '71999991234'],
    ['55 71 99999-1234', '71999991234'],
  ])('normalizes Brazilian mobile phone %s', (input, expected) => {
    expect(normalizeBrazilianPhone(input)).toBe(expected)
  })

  it.each(['7199991234', '55719999912345', 'invalid'])(
    'rejects invalid Brazilian mobile phone %s',
    (input) => {
      expect(normalizeBrazilianPhone(input)).toBeNull()
    },
  )

  it.each([
    ['+55 (71) 99999-1234', '71999991234'],
    ['55 71 99999 1234', '71999991234'],
    ['71999991234', '71999991234'],
    ['55999991234', '55999991234'],
  ])(
    'sanitizes pasted or typed Brazilian phone %s without corrupting DDD 55',
    (input, expected) => {
      expect(sanitizeBrazilianPhoneInput(input)).toBe(expected)
    },
  )

  it('builds a wa.me URL from the canonical phone', () => {
    expect(buildWhatsAppUrl('(71) 99999-1234', 'Olá, Solla!')).toBe(
      'https://wa.me/5571999991234?text=Ol%C3%A1%2C+Solla%21',
    )
  })

  it('validates a single email-or-phone login field', () => {
    expect(
      campaignLoginSchema.parse({
        identifier: ' pessoa@example.com ',
        password: 'secret',
      }),
    ).toEqual({
      identifier: 'pessoa@example.com',
      password: 'secret',
    })
    expect(
      campaignLoginSchema.parse({
        identifier: '+55 (71) 99999-1234',
        password: 'secret',
      }),
    ).toEqual({
      identifier: '71999991234',
      password: 'secret',
    })
  })
})
