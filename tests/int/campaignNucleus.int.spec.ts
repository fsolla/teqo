// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import { readFileSync } from 'node:fs'

import {
  archiveElectoralNucleus,
  createElectoralNucleus,
  updateElectoralNucleus,
} from '@/app/(campaign)/campanha/actions/nucleus'
import { ElectoralNucleus } from '@/collections/ElectoralNucleus'
import { bahiaIdentityTerritoryRecords } from '@/lib/bahiaTerritories'
import { nucleusCreateSchema, nucleusUpdateSchema } from '@/lib/schemas/nucleus'
import config from '@/payload.config'
import { getEligibleNucleusCoordinatorOptions } from '@/utilities/nucleusCoordinatorOptions'
import {
  getNucleusDetailPageData,
  getNucleusEditPageData,
  resolveAccessibleNucleusContext,
} from '@/utilities/nucleusPageData'
import { parseNucleusCreateFormData, parseNucleusUpdateFormData } from '@/utilities/nucleusFormData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const validNucleusInput = {
  get name() {
    return campaignFixtures().value('Núcleo Chapada')
  },
  regions: ['Chapada Diamantina'],
  locality: 'Chapada Diamantina',
  organizationKind: 'territorial' as const,
  tseZones: [{ zoneNumber: 58, label: '58ª ZE — Seabra' }],
}

describe('electoral nucleus domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('matches the official 2024 SEI territory codes and municipality counts', () => {
    expect(bahiaIdentityTerritoryRecords).toHaveLength(27)
    expect(bahiaIdentityTerritoryRecords.map(({ code }) => code)).toEqual(
      Array.from({ length: 27 }, (_, index) => String(index + 1).padStart(2, '0')),
    )
    expect(
      bahiaIdentityTerritoryRecords.reduce(
        (total, territory) => total + territory.municipalityCount,
        0,
      ),
    ).toBe(417)
  })

  it('requires regions, cities, or a locality for every nucleus', () => {
    const result = nucleusCreateSchema.safeParse({
      ...validNucleusInput,
      regions: undefined,
      locality: undefined,
    })

    expect(result.success).toBe(false)
  })

  it('keeps nucleus create and PATCH blank semantics distinct', () => {
    expect(
      nucleusCreateSchema.parse({
        ...validNucleusInput,
        territoryNotes: '   ',
      }).territoryNotes,
    ).toBeUndefined()
    expect(
      nucleusUpdateSchema.parse({
        id: 1,
        cities: [],
        territoryNotes: '   ',
      }),
    ).toEqual({
      id: 1,
      cities: [],
      regions: [],
      territoryNotes: null,
    })
    expect(nucleusUpdateSchema.parse({ id: 1 })).toEqual({ id: 1 })
  })

  it('excludes estimates, status, and audit fields from generic schemas', () => {
    const forged = {
      ...validNucleusInput,
      status: 'arquivado',
      confirmedVoteEstimate: 5000,
      confirmedVoteEstimateAt: new Date().toISOString(),
      confirmedVoteEstimateBy: 999,
      confirmationNote: 'forjada',
      proposedVoteEstimate: 6000,
      proposedVoteEstimateAt: new Date().toISOString(),
      proposedVoteEstimateBy: 999,
      lastUpdateAt: new Date().toISOString(),
      createdBy: 999,
    }

    const protectedFields = [
      'status',
      'confirmedVoteEstimate',
      'confirmedVoteEstimateAt',
      'confirmedVoteEstimateBy',
      'confirmationNote',
      'proposedVoteEstimate',
      'proposedVoteEstimateAt',
      'proposedVoteEstimateBy',
      'lastUpdateAt',
      'createdBy',
    ]

    for (const parsed of [
      nucleusCreateSchema.parse(forged),
      nucleusUpdateSchema.parse({ id: 1, ...forged }),
    ]) {
      for (const field of protectedFields) {
        expect(Object.hasOwn(parsed, field)).toBe(false)
      }
    }
  })

  it('keeps organization and sector as additional dimensions', () => {
    const result = nucleusCreateSchema.parse({
      ...validNucleusInput,
      organizationKind: 'sindicato',
      organizationLabel: 'Sindicato dos Trabalhadores Rurais',
      sectorKind: 'sindical',
    })

    expect(result.regions).toEqual(['Chapada Diamantina'])
    expect(result.organizationKind).toBe('sindicato')
    expect(result.sectorKind).toBe('sindical')
  })

  it('rejects invalid or duplicate TSE zones', () => {
    expect(() =>
      nucleusCreateSchema.parse({
        ...validNucleusInput,
        tseZones: [{ zoneNumber: 0 }, { zoneNumber: 1000 }],
      }),
    ).toThrow()

    expect(() =>
      nucleusCreateSchema.parse({
        ...validNucleusInput,
        tseZones: [{ zoneNumber: 58 }, { zoneNumber: 58 }],
      }),
    ).toThrow('Zona TSE')
  })

  it('generates a canonical unique slug for direct Local API writes', async () => {
    const first = await payload.create({
      collection: 'electoralNucleus',
      data: {
        ...validNucleusInput,
        name: campaignFixtures().value('Núcleo São João'),
      } as never,
      depth: 0,
    })
    expect(first.slug).toMatch(/^nucleo-sao-joao-/)

    await expect(
      payload.create({
        collection: 'electoralNucleus',
        data: {
          ...validNucleusInput,
          name:
            first.name
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .replace('Núcleo', 'Nucleo') + '!!!',
        } as never,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('allows only one concurrent create for the same canonical nucleus name', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const suffix = campaignFixtures().value('corrida')
    const results = await Promise.allSettled([
      createElectoralNucleus(payload, general, {
        ...validNucleusInput,
        name: `Núcleo São João ${suffix}`,
      }),
      createElectoralNucleus(payload, general, {
        ...validNucleusInput,
        name: `Nucleo Sao Joao ${suffix}!!!`,
      }),
    ])

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1)
  })

  it('validates Bahia regions, cities, and neighborhood dependencies', async () => {
    expect(() =>
      nucleusCreateSchema.parse({
        ...validNucleusInput,
        regions: ['Região inventada'],
      }),
    ).toThrow()

    expect(() =>
      nucleusCreateSchema.parse({
        ...validNucleusInput,
        cities: ['Município inventado'],
      }),
    ).toThrow('município válido')

    expect(() =>
      nucleusCreateSchema.parse({
        ...validNucleusInput,
        cities: undefined,
        neighborhoods: ['Centro'],
      }),
    ).toThrow('município antes do bairro')

    await expect(
      payload.create({
        collection: 'electoralNucleus',
        data: {
          ...validNucleusInput,
          cities: ['Município inventado'],
        } as never,
        depth: 0,
      }),
    ).rejects.toThrow('município válido')
  })

  it('derives regions from multiple cities across territories, overriding a manual region', async () => {
    const nucleus = await payload.create({
      collection: 'electoralNucleus',
      data: {
        ...validNucleusInput,
        name: campaignFixtures().value('Núcleo multi-território'),
        regions: ['Irecê'],
        cities: ['Seabra', 'Salvador'],
      } as never,
      depth: 0,
    })

    expect(nucleus.cities).toEqual(['Seabra', 'Salvador'])
    expect(nucleus.regions).toEqual(['Chapada Diamantina', 'Metropolitano de Salvador'])

    const updated = await payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: { cities: ['Salvador'] },
      depth: 0,
    })
    expect(updated.cities).toEqual(['Salvador'])
    expect(updated.regions).toEqual(['Metropolitano de Salvador'])
  })

  it('allows multiple neighborhoods only when exactly one city is set', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo com bairros múltiplos'),
      cities: ['Seabra'],
      neighborhoods: ['Centro', 'Bairro Novo'],
    })

    expect(nucleus.cities).toEqual(['Seabra'])
    expect(nucleus.neighborhoods).toEqual(['Centro', 'Bairro Novo'])
  })

  it('rejects neighborhoods when more than one city is selected', async () => {
    expect(() =>
      nucleusCreateSchema.parse({
        ...validNucleusInput,
        cities: ['Seabra', 'Salvador'],
        neighborhoods: ['Centro'],
      }),
    ).toThrow('exatamente um município')

    await expect(
      payload.create({
        collection: 'electoralNucleus',
        data: {
          ...validNucleusInput,
          name: campaignFixtures().value('Núcleo com bairro em dois municípios'),
          cities: ['Seabra', 'Salvador'],
          neighborhoods: ['Centro'],
        } as never,
        depth: 0,
      }),
    ).rejects.toThrow('exatamente um município')
  })

  it('requires resending cities together with neighborhoods on a PATCH', () => {
    expect(() =>
      nucleusUpdateSchema.parse({
        id: 1,
        neighborhoods: ['Centro'],
      }),
    ).toThrow('município antes do bairro')
  })

  it('rejects explicitly clearing cities while providing a neighborhood', () => {
    expect(() =>
      nucleusUpdateSchema.parse({
        id: 1,
        cities: [],
        neighborhoods: ['Centro'],
      }),
    ).toThrow('município antes do bairro')
  })

  it('rejects clearing cities when an omitted existing neighborhood remains', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo com bairro preservado'),
      cities: ['Seabra'],
      neighborhoods: ['Centro'],
    })

    await expect(
      updateElectoralNucleus(payload, general, {
        id: nucleus.id,
        cities: null,
      }),
    ).rejects.toThrow('município antes do bairro')
  })

  it('allows the form to clear cities and neighborhoods when other geography remains', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo com geografia pelo formulário'),
      cities: ['Seabra'],
      neighborhoods: ['Centro'],
    })
    const formData = new FormData()
    formData.set('id', String(nucleus.id))
    formData.set('name', nucleus.name)
    formData.append('regions', 'Chapada Diamantina')
    formData.set('locality', 'Zona rural')
    formData.set('organizationKind', 'territorial')

    const updated = await updateElectoralNucleus(
      payload,
      general,
      parseNucleusUpdateFormData(formData),
    )

    expect(updated.cities).toEqual([])
    expect(updated.neighborhoods).toEqual([])
    expect(updated.regions).toEqual(['Chapada Diamantina'])
    expect(updated.locality).toBe('Zona rural')
  })

  it('declares archive status and no collection delete access for campaign users', async () => {
    expect(ElectoralNucleus.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', defaultValue: 'ativo' }),
        expect.objectContaining({ name: 'primaryContact', relationTo: 'contact' }),
        expect.objectContaining({ name: 'voterProfiles', type: 'array' }),
        expect.objectContaining({ name: 'strengths', type: 'array' }),
        expect.objectContaining({ name: 'risks', type: 'array' }),
        expect.objectContaining({ name: 'confirmedVoteEstimate', type: 'number' }),
        expect.objectContaining({ name: 'proposedVoteEstimate', type: 'number' }),
        expect.objectContaining({ name: 'ticketAlliance', type: 'group' }),
        expect.objectContaining({ name: 'lastUpdateAt', type: 'date' }),
        expect.objectContaining({ name: 'createdBy', relationTo: 'campaignUser' }),
      ]),
    )

    const general = await campaignFixtures().createCampaignUser('geral')
    const deleteAccess =
      typeof ElectoralNucleus.access?.delete === 'function'
        ? await ElectoralNucleus.access.delete({
            id: 1,
            data: undefined,
            req: { user: general } as never,
          })
        : ElectoralNucleus.access?.delete

    expect(deleteAccess).toBe(false)
  })

  it('enforces geography and unique zones through the Local API', async () => {
    await expect(
      payload.create({
        collection: 'electoralNucleus',
        data: {
          name: campaignFixtures().value('Núcleo sem território'),
          organizationKind: 'territorial',
        } as never,
      }),
    ).rejects.toThrow('território de identidade')

    await expect(
      payload.create({
        collection: 'electoralNucleus',
        data: {
          ...validNucleusInput,
          regions: undefined,
          locality: '   ',
        } as never,
      }),
    ).rejects.toThrow('território de identidade')

    await expect(
      payload.create({
        collection: 'electoralNucleus',
        data: {
          ...validNucleusInput,
          name: campaignFixtures().value('Núcleo com ZE repetida'),
          tseZones: [{ zoneNumber: 62 }, { zoneNumber: 62 }],
        } as never,
      }),
    ).rejects.toThrow('Zona TSE')

    const nucleus = await payload.create({
      collection: 'electoralNucleus',
      data: validNucleusInput as never,
    })

    await expect(
      payload.update({
        collection: 'electoralNucleus',
        id: nucleus.id,
        data: {
          cities: [],
          regions: [],
          locality: null,
        },
      }),
    ).rejects.toThrow('território de identidade')

    const trimmed = await payload.create({
      collection: 'electoralNucleus',
      data: {
        ...validNucleusInput,
        name: campaignFixtures().value('Núcleo com geografia normalizada'),
        regions: ['Chapada Diamantina'],
        cities: ['Seabra'],
        locality: ' Chapada Diamantina ',
        neighborhoods: [' Centro '],
        tseZones: [{ zoneNumber: 64 }],
      } as never,
    })

    expect(trimmed.regions).toEqual(['Chapada Diamantina'])
    expect(trimmed.neighborhoods).toEqual(['Centro'])
    expect(trimmed.locality).toBe('Chapada Diamantina')
  })

  it('denies anonymous nucleus reads and writes', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo protegido de anônimos'),
      tseZones: [{ zoneNumber: 65 }],
    })

    const visible = await payload.find({
      collection: 'electoralNucleus',
      overrideAccess: false,
    })
    expect(visible.docs.map(({ id }) => id)).not.toContain(nucleus.id)

    await expect(
      payload.create({
        collection: 'electoralNucleus',
        data: validNucleusInput as never,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'electoralNucleus',
        id: nucleus.id,
        data: { name: 'Alteração anônima' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('allows general coordination to create and stamps createdBy', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')

    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      coordinators: [general.id],
    })

    expect(nucleus.status).toBe('ativo')
    expect(nucleus.createdBy).toBe(general.id)
    expect(nucleus.regions).toEqual(['Chapada Diamantina'])
    expect(nucleus.coordinators).toContain(general.id)
  })

  it('loads general and coordinator options with the current general first', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const leadership = await campaignFixtures().createCampaignUser('lideranca')

    const options = await getEligibleNucleusCoordinatorOptions(payload, general)

    expect(options[0]).toEqual({
      id: general.id,
      name: general.name,
      isCurrent: true,
    })
    expect(options).toContainEqual({
      id: coordinator.id,
      name: coordinator.name,
      isCurrent: false,
    })
    expect(options.map(({ id }) => id)).not.toContain(leadership.id)
    expect(Object.keys(options[0]!).sort()).toEqual(['id', 'isCurrent', 'name'])
  })

  it('rejects leadership coordinator assignments through actions and direct Local API', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leadership = await campaignFixtures().createCampaignUser('lideranca')

    await expect(
      createElectoralNucleus(payload, general, {
        ...validNucleusInput,
        name: campaignFixtures().value('Núcleo com liderança pela ação'),
        coordinators: [leadership.id],
      }),
    ).rejects.toThrow('coordenação geral ou coordenador')

    await expect(
      payload.create({
        collection: 'electoralNucleus',
        data: {
          ...validNucleusInput,
          name: campaignFixtures().value('Núcleo com liderança forjada'),
          coordinators: [leadership.id],
        } as never,
        depth: 0,
      }),
    ).rejects.toThrow('coordenação geral ou coordenador')

    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo com coordenação válida'),
      coordinators: [general.id],
    })

    await expect(
      payload.update({
        collection: 'electoralNucleus',
        id: nucleus.id,
        data: { coordinators: [leadership.id] },
        depth: 0,
      }),
    ).rejects.toThrow('coordenação geral ou coordenador')
  })

  it('creates from authenticated form data and rejects an unauthorized actor', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const formData = new FormData()
    formData.set('name', campaignFixtures().value('Núcleo via formulário'))
    formData.append('cities', 'Salvador')
    formData.set('organizationKind', 'territorial')

    const created = await createElectoralNucleus(
      payload,
      general,
      parseNucleusCreateFormData(formData),
    )
    expect(created.createdBy).toBe(general.id)

    await expect(
      createElectoralNucleus(payload, coordinator, parseNucleusCreateFormData(formData)),
    ).rejects.toThrow()
  })

  it('strips protected fields passed to generic nucleus actions', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo sem estimativa genérica'),
      status: 'arquivado',
      confirmedVoteEstimate: 5000,
      proposedVoteEstimate: 6000,
      createdBy: 999,
      tseZones: [{ zoneNumber: 67 }],
    } as never)

    expect(nucleus.status).toBe('ativo')
    expect(nucleus.createdBy).toBe(general.id)
    expect(nucleus.confirmedVoteEstimate).toBeNull()
    expect(nucleus.proposedVoteEstimate).toBeNull()

    const updated = await updateElectoralNucleus(payload, general, {
      id: nucleus.id,
      status: 'arquivado',
      confirmedVoteEstimate: 7000,
      proposedVoteEstimate: 8000,
      createdBy: 999,
    } as never)

    expect(updated.status).toBe('ativo')
    expect(updated.createdBy).toBe(general.id)
    expect(updated.confirmedVoteEstimate).toBeNull()
    expect(updated.proposedVoteEstimate).toBeNull()
  })

  it('prevents coordinators from creating nuclei', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')

    await expect(
      createElectoralNucleus(payload, coordinator, {
        ...validNucleusInput,
        name: campaignFixtures().value('Núcleo indevido'),
      }),
    ).rejects.toThrow()
  })

  it('prevents leadership users from reading nuclei without an engaged assignment', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leadership = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo invisível à liderança'),
      tseZones: [{ zoneNumber: 63 }],
    })

    const visible = await payload.find({
      collection: 'electoralNucleus',
      depth: 0,
      user: leadership,
      overrideAccess: false,
    })

    expect(visible.docs.map(({ id }) => id)).not.toContain(nucleus.id)

    await expect(
      payload.update({
        collection: 'electoralNucleus',
        id: nucleus.id,
        data: { name: 'Alteração da liderança' },
        user: leadership,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('limits coordinator reads and updates to assigned nuclei', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const assignedCoordinator = await campaignFixtures().createCampaignUser('coordenador')
    const otherCoordinator = await campaignFixtures().createCampaignUser('coordenador')
    const assigned = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo designado'),
      coordinators: [assignedCoordinator.id],
    })
    const other = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo alheio'),
      coordinators: [otherCoordinator.id],
      tseZones: [{ zoneNumber: 59 }],
    })

    const visible = await payload.find({
      collection: 'electoralNucleus',
      depth: 0,
      user: assignedCoordinator,
      overrideAccess: false,
    })

    expect(visible.docs.map(({ id }) => id)).toContain(assigned.id)
    expect(visible.docs.map(({ id }) => id)).not.toContain(other.id)
    await expect(
      resolveAccessibleNucleusContext(payload, assignedCoordinator, other.slug),
    ).rejects.toThrow()
    await expect(getNucleusEditPageData(payload, assignedCoordinator, other.slug)).rejects.toThrow()
    const context = await resolveAccessibleNucleusContext(
      payload,
      assignedCoordinator,
      assigned.slug,
    )
    expect(getNucleusDetailPageData(context, assignedCoordinator)).toMatchObject({
      id: assigned.id,
      name: assigned.name,
    })

    await expect(
      updateElectoralNucleus(payload, assignedCoordinator, {
        id: assigned.id,
        name: campaignFixtures().value('Núcleo atualizado'),
      }),
    ).rejects.toThrow('não pode ser alterado')

    await expect(
      updateElectoralNucleus(payload, assignedCoordinator, {
        id: other.id,
        name: 'Tentativa indevida',
      }),
    ).rejects.toThrow()
  })

  it('keeps coordinator assignments outside generic campaign updates', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const replacement = await campaignFixtures().createCampaignUser('coordenador')
    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo com coordenação'),
      coordinators: [coordinator.id],
      tseZones: [{ zoneNumber: 60 }],
    })

    const craftedUpdate = await updateElectoralNucleus(payload, general, {
      id: nucleus.id,
      coordinators: [replacement.id],
      territoryNotes: 'Atualização territorial legítima',
    } as never)
    expect(craftedUpdate.coordinators).toEqual([coordinator.id])
    expect(craftedUpdate.territoryNotes).toBe('Atualização territorial legítima')

    const directUpdate = await payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: { coordinators: [replacement.id] },
      depth: 0,
      user: general,
      overrideAccess: false,
    })
    expect(directUpdate.coordinators).toEqual([coordinator.id])
  })

  it('prevents campaign users from forging protected nucleus fields', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const forged = await payload.create({
      collection: 'electoralNucleus',
      data: {
        ...validNucleusInput,
        name: campaignFixtures().value('Núcleo com auditoria protegida'),
        coordinators: [coordinator.id],
        status: 'arquivado',
        confirmedVoteEstimate: 5000,
        confirmedVoteEstimateAt: new Date().toISOString(),
        confirmedVoteEstimateBy: coordinator.id,
        confirmationNote: 'forjada',
        proposedVoteEstimate: 6000,
        proposedVoteEstimateAt: new Date().toISOString(),
        proposedVoteEstimateBy: coordinator.id,
        lastUpdateAt: new Date().toISOString(),
        createdBy: coordinator.id,
        tseZones: [{ zoneNumber: 66 }],
      } as never,
      depth: 0,
      user: general,
      overrideAccess: false,
    })

    expect(forged.status).toBe('ativo')
    expect(forged.createdBy).toBe(general.id)
    expect(forged.confirmedVoteEstimate).toBeNull()
    expect(forged.confirmedVoteEstimateAt).toBeNull()
    expect(forged.confirmedVoteEstimateBy).toBeNull()
    expect(forged.confirmationNote).toBeNull()
    expect(forged.proposedVoteEstimate).toBeNull()
    expect(forged.proposedVoteEstimateAt).toBeNull()
    expect(forged.proposedVoteEstimateBy).toBeNull()
    expect(forged.lastUpdateAt).toBeNull()

    const updated = await payload.update({
      collection: 'electoralNucleus',
      id: forged.id,
      data: {
        status: 'arquivado',
        coordinators: [general.id],
        confirmedVoteEstimate: 7000,
        confirmedVoteEstimateAt: new Date().toISOString(),
        confirmedVoteEstimateBy: coordinator.id,
        confirmationNote: 'forjada novamente',
        proposedVoteEstimate: 8000,
        proposedVoteEstimateAt: new Date().toISOString(),
        proposedVoteEstimateBy: coordinator.id,
        lastUpdateAt: new Date().toISOString(),
        createdBy: coordinator.id,
      },
      depth: 0,
      user: coordinator,
      overrideAccess: false,
    })

    expect(updated.status).toBe('ativo')
    expect(updated.coordinators).toContain(coordinator.id)
    expect(updated.createdBy).toBe(general.id)
    expect(updated.confirmedVoteEstimate).toBeNull()
    expect(updated.confirmedVoteEstimateAt).toBeNull()
    expect(updated.confirmedVoteEstimateBy).toBeNull()
    expect(updated.confirmationNote).toBeNull()
    expect(updated.proposedVoteEstimate).toBeNull()
    expect(updated.proposedVoteEstimateAt).toBeNull()
    expect(updated.proposedVoteEstimateBy).toBeNull()
    expect(updated.lastUpdateAt).toBeNull()
  })

  it('archives instead of hard deleting through the domain action', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo para arquivar'),
      tseZones: [{ zoneNumber: 61 }],
    })

    const archived = await archiveElectoralNucleus(payload, general, nucleus.id)

    expect(archived.status).toBe('arquivado')
    await expect(
      payload.delete({
        collection: 'electoralNucleus',
        id: nucleus.id,
        user: general,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    await expect(archiveElectoralNucleus(payload, coordinator, nucleus.id)).rejects.toThrow(
      'coordenação geral',
    )
  })

  it('preserves fields omitted from partial updates', () => {
    expect(nucleusUpdateSchema.parse({ id: 1, name: 'Novo nome' })).toEqual({
      id: 1,
      name: 'Novo nome',
    })
  })

  it('filters by a nested Zona TSE number through Payload', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const matching = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo ZE 731'),
      tseZones: [{ zoneNumber: 731 }],
    })
    await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo ZE 732'),
      tseZones: [{ zoneNumber: 732 }],
    })

    const result = await payload.find({
      collection: 'electoralNucleus',
      depth: 0,
      where: { 'tseZones.zoneNumber': { equals: 731 } },
      user: general,
      overrideAccess: false,
    })

    expect(result.docs.map(({ id }) => id)).toContain(matching.id)
    expect(
      result.docs.every((doc) => doc.tseZones?.some(({ zoneNumber }) => zoneNumber === 731)),
    ).toBe(true)
  })

  it('filters nuclei by regions and cities using Payload equals queries', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const chapada = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo Chapada equals'),
      cities: ['Seabra'],
    })
    const salvador = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      name: campaignFixtures().value('Núcleo Salvador equals'),
      cities: ['Salvador'],
    })

    const byRegion = await payload.find({
      collection: 'electoralNucleus',
      depth: 0,
      where: { regions: { equals: 'Chapada Diamantina' } },
      user: general,
      overrideAccess: false,
    })
    expect(byRegion.docs.map(({ id }) => id)).toContain(chapada.id)
    expect(byRegion.docs.map(({ id }) => id)).not.toContain(salvador.id)

    const byCity = await payload.find({
      collection: 'electoralNucleus',
      depth: 0,
      where: { cities: { equals: 'Salvador' } },
      user: general,
      overrideAccess: false,
    })
    expect(byCity.docs.map(({ id }) => id)).toContain(salvador.id)
    expect(byCity.docs.map(({ id }) => id)).not.toContain(chapada.id)
  })

  it('explicitly clears editable optional nucleus fields', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const nucleus = await createElectoralNucleus(payload, general, {
      ...validNucleusInput,
      coordinators: [coordinator.id],
      cities: ['Seabra'],
      locality: 'Centro',
      organizationLabel: 'Associação local',
      sectorKind: 'rural',
      tseZones: [{ zoneNumber: 733 }],
      ticketAlliance: {
        partnerName: 'Parceira',
        office: 'Deputada estadual',
        isCampaignPartner: true,
        notes: 'Dobrada ativa',
      },
    })

    const cleared = await updateElectoralNucleus(payload, general, {
      id: nucleus.id,
      coordinators: [],
      tseZones: [],
      cities: null,
      locality: 'Centro',
      sectorKind: null,
      organizationLabel: null,
      ticketAlliance: {
        partnerName: null,
        office: null,
        isCampaignPartner: false,
        notes: null,
      },
    } as never)

    expect(cleared.coordinators).toEqual([coordinator.id])
    expect(cleared.tseZones).toEqual([])
    expect(cleared.cities).toEqual([])
    expect(cleared.regions).toEqual([])
    expect(cleared.locality).toBe('Centro')
    expect(cleared.sectorKind).toBeNull()
    expect(cleared.organizationLabel).toBeNull()
    expect(cleared.ticketAlliance).toMatchObject({
      partnerName: null,
      office: null,
      isCampaignPartner: false,
      notes: null,
    })

    const clearedLocality = await updateElectoralNucleus(payload, general, {
      id: nucleus.id,
      cities: ['Seabra'],
      locality: null,
    })
    expect(clearedLocality.cities).toEqual(['Seabra'])
    expect(clearedLocality.locality).toBeNull()
  })

  it('drops lock-document dependencies before the nucleus table on rollback', () => {
    const migration = readFileSync(
      new URL(
        '../../src/migrations/20260718_010733_consolidate_campaign_schema.ts',
        import.meta.url,
      ),
      'utf8',
    )
    const externalConstraint = migration.indexOf(
      'DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_electoral_nucleus_fk"',
    )
    const nucleusTable = migration.indexOf('DROP TABLE "electoral_nucleus" CASCADE')

    expect(externalConstraint).toBeGreaterThan(-1)
    expect(externalConstraint).toBeLessThan(nucleusTable)
  })
})
