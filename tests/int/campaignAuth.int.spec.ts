// @vitest-environment node

import { readFileSync } from 'node:fs'

import type { Payload, PayloadRequest } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { assignNucleusCoordinatorsRecord } from '@/app/(campaign)/campanha/actions/coordinatorAssignment'
import config from '@/payload.config'
import type { CampaignUser } from '@/payload-types'
import { CampaignUser as CampaignUserCollection } from '@/collections/CampaignUser'
import { campaignLoginSchema } from '@/lib/schemas/campaign-login'
import { getAccessibleNucleusIds, isCampaignGeneral } from '@/utilities/campaignAccess'
import { authenticateCampaignToken } from '@/utilities/campaignAuth'
import {
  buildWhatsAppUrl,
  normalizeBrazilianPhone,
  sanitizeBrazilianPhoneInput,
} from '@/utilities/phone'
import { slugify } from '@/utilities/slug'
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

  it('defaults newly created campaign users to liderança', async () => {
    const username = campaignFixtures().phone()
    const user = await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Liderança padrão',
        username,
        password: campaignFixtures().value('password'),
      } as never,
    })

    expect(user.role).toBe('lideranca')
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
        role: 'geral',
      },
    })
    await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Liderança',
        username: phone,
        password,
        role: 'lideranca',
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
        role: 'geral',
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
      role: 'geral',
    } as CampaignUser
    const currentUser = {
      ...staleJwtUser,
      role: 'coordenador',
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
      depth: 0,
    })
    expect(result?.email).toBe('')
    expect(result?.role).toBe('coordenador')
    expect(isCampaignGeneral(result)).toBe(false)
  })

  it('denies management when a stale JWT still says geral after downgrade', async () => {
    const staleGeneral = await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Coordenação rebaixada',
        email: `${campaignFixtures().value('downgraded')}@example.com`,
        password: campaignFixtures().value('password'),
        role: 'geral',
      },
    })

    await payload.update({
      collection: 'campaignUser',
      id: staleGeneral.id,
      data: {
        role: 'coordenador',
      },
    })

    await expect(
      payload.create({
        collection: 'campaignUser',
        data: {
          name: 'Criação indevida',
          email: `${campaignFixtures().value('denied')}@example.com`,
          password: campaignFixtures().value('password'),
          role: 'geral',
        },
        user: staleGeneral,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it.each(['geral', 'coordenador', 'lideranca'] as const)(
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
          role: 'lideranca',
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
        role: 'lideranca',
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
    { actorKind: 'admin', targetRole: 'coordenador', nucleusStatus: 'ativo' },
    { actorKind: 'general', targetRole: 'geral', nucleusStatus: 'arquivado' },
  ] as const)(
    'blocks an assigned $targetRole downgrade from a Payload $actorKind even for an $nucleusStatus nucleus',
    async ({ actorKind, targetRole, nucleusStatus }) => {
      const general = await payload.create({
        collection: 'campaignUser',
        data: {
          name: 'Coordenação responsável',
          email: `${campaignFixtures().value('general')}@example.com`,
          password: campaignFixtures().value('password'),
          role: 'geral',
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
      const nucleusName = campaignFixtures().value('Núcleo com responsável')
      const nucleus = await payload.create({
        collection: 'electoralNucleus',
        data: {
          name: nucleusName,
          slug: slugify(nucleusName),
          status: nucleusStatus,
          coordinators: [target.id],
          cities: ['Salvador'],
          organizationKind: 'territorial',
        },
        depth: 0,
      })
      const actor = admin ?? general

      await expect(
        payload.update({
          collection: 'campaignUser',
          id: target.id,
          data: { role: 'lideranca' },
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow(
        'Remova ou substitua este usuário da coordenação de todos os núcleos antes de alterar o papel para liderança.',
      )

      if (admin) {
        await payload.update({
          collection: 'electoralNucleus',
          id: nucleus.id,
          data: { coordinators: [] },
          user: admin,
          overrideAccess: false,
          depth: 0,
        })
      } else {
        await assignNucleusCoordinatorsRecord(payload, general, {
          slug: nucleus.slug,
          coordinatorIds: [],
          expectedUpdatedAt: nucleus.updatedAt,
        })
      }
      const downgraded = await payload.update({
        collection: 'campaignUser',
        id: target.id,
        data: { role: 'lideranca' },
        user: actor,
        overrideAccess: false,
      })

      expect(downgraded.role).toBe('lideranca')
    },
  )

  it.each(['coordenador', 'lideranca'] as const)(
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
          role: 'lideranca',
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

  it('returns only nuclei assigned to a coordinator', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 7 }],
    })
    const req = {
      context: {},
      payload: {
        collections: {
          electoralNucleus: {},
        },
        find,
      },
    } as unknown as PayloadRequest
    const user = {
      id: 11,
      collection: 'campaignUser',
      role: 'coordenador',
    } as CampaignUser

    const ids = await getAccessibleNucleusIds(req, user)

    expect(ids).toEqual([7])
    expect(ids).not.toContain(8)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'electoralNucleus',
        overrideAccess: true,
        req,
        where: {
          coordinators: {
            contains: user.id,
          },
        },
      }),
    )
  })

  it('uses the current role when resolving accessible nuclei', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 7 }],
    })
    const staleGeneral = {
      id: 11,
      collection: 'campaignUser',
      role: 'geral',
    } as CampaignUser
    const currentCoordinator = {
      ...staleGeneral,
      role: 'coordenador',
    } as CampaignUser
    const req = {
      context: {},
      payload: {
        collections: {
          electoralNucleus: {},
        },
        find,
        findByID: vi.fn().mockResolvedValue(currentCoordinator),
      },
      user: staleGeneral,
    } as unknown as PayloadRequest

    const ids = await getAccessibleNucleusIds(req)

    expect(ids).toEqual([7])
    expect(req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'campaignUser',
        id: staleGeneral.id,
        overrideAccess: true,
        req,
      }),
    )
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'electoralNucleus',
        req,
        where: {
          coordinators: {
            contains: staleGeneral.id,
          },
        },
      }),
    )
  })

  it('returns only engaged nuclei for a leadership user and propagates req', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ nucleus: 7 }],
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
      role: 'lideranca',
    } as CampaignUser

    const ids = await getAccessibleNucleusIds(req, user)

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
