// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  addMunicipalityUpdateCommentRecord,
  assignMunicipalityUpdateResponsibleRecord,
  markMunicipalityUpdateReopenedRecord,
  markMunicipalityUpdateResolvedRecord,
} from '@/app/(campaign)/campanha/actions/municipalityUpdateDeliberation'
import { relationshipId } from '@/lib/relationship'
import { MUNICIPALITY_UPDATE_RESPONSIBLE_NOT_ELIGIBLE_MESSAGE } from '@/lib/schemas/municipalityUpdate'
import type { MunicipalityUpdate } from '@/payload-types'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const loadUpdate = async (updateId: number): Promise<MunicipalityUpdate> =>
  payload.findByID({
    collection: 'municipalityUpdate',
    id: updateId,
    depth: 0,
    overrideAccess: true,
  })

describe('municipality update deliberation', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const createDeliberationContext = async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const outsiderAdvisor = await campaignFixtures().createCampaignUser('advisor')
    const leader = await campaignFixtures().createCampaignUser('leader')
    const municipality = await campaignFixtures().getMunicipality()
    const otherMunicipality = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(municipality, [advisor.id])
    await campaignFixtures().assignMunicipalityAdvisors(otherMunicipality, [outsiderAdvisor.id])
    const update = await campaignFixtures().createMunicipalityUpdate({
      municipality: municipality.id,
      author: coordinator.id,
      polarity: 'ruim',
      body: 'Fato registrado pela coordenação.',
    })
    return { coordinator, advisor, outsiderAdvisor, leader, municipality, update }
  }

  it('coordinator assigns an advisor of the municipality and clears the assignee', async () => {
    const { coordinator, advisor, update } = await createDeliberationContext()

    const assigned = await assignMunicipalityUpdateResponsibleRecord(payload, coordinator, {
      updateId: update.id,
      responsibleId: advisor.id,
    })
    expect(relationshipId(assigned.responsible)).toBe(advisor.id)

    const cleared = await assignMunicipalityUpdateResponsibleRecord(payload, coordinator, {
      updateId: update.id,
      responsibleId: null,
    })
    expect(cleared.responsible).toBeNull()
  })

  it('coordinator may assign another coordinator or the candidate', async () => {
    const { coordinator, municipality } = await createDeliberationContext()
    const candidate = await campaignFixtures().createCampaignUser('candidate')
    const update = await campaignFixtures().createMunicipalityUpdate({
      municipality: municipality.id,
      author: coordinator.id,
      polarity: 'neutra',
      body: 'Fato para o candidato.',
    })

    const assigned = await assignMunicipalityUpdateResponsibleRecord(payload, coordinator, {
      updateId: update.id,
      responsibleId: candidate.id,
    })
    expect(relationshipId(assigned.responsible)).toBe(candidate.id)
  })

  it('rejects a leader as responsible', async () => {
    const { coordinator, leader, update } = await createDeliberationContext()

    await expect(
      assignMunicipalityUpdateResponsibleRecord(payload, coordinator, {
        updateId: update.id,
        responsibleId: leader.id,
      }),
    ).rejects.toThrow(MUNICIPALITY_UPDATE_RESPONSIBLE_NOT_ELIGIBLE_MESSAGE)
  })

  it('rejects an advisor outside the municipality as responsible', async () => {
    const { coordinator, outsiderAdvisor, update } = await createDeliberationContext()

    await expect(
      assignMunicipalityUpdateResponsibleRecord(payload, coordinator, {
        updateId: update.id,
        responsibleId: outsiderAdvisor.id,
      }),
    ).rejects.toThrow(MUNICIPALITY_UPDATE_RESPONSIBLE_NOT_ELIGIBLE_MESSAGE)
  })

  it('advisor of the municipality comments and the hook stamps author and createdAt', async () => {
    const { advisor, update } = await createDeliberationContext()

    await addMunicipalityUpdateCommentRecord(payload, advisor, {
      updateId: update.id,
      body: '  Vou verificar no território.  ',
    })

    const reloaded = await loadUpdate(update.id)
    expect(reloaded.comments).toHaveLength(1)
    expect(reloaded.comments?.[0]?.body).toBe('Vou verificar no território.')
    expect(relationshipId(reloaded.comments?.[0]?.author)).toBe(advisor.id)
    expect(reloaded.comments?.[0]?.createdAt).toBeTruthy()
    expect(reloaded.body).toBe('Fato registrado pela coordenação.')
  })

  it('appends comments in order without touching earlier ones', async () => {
    const { advisor, update } = await createDeliberationContext()

    await addMunicipalityUpdateCommentRecord(payload, advisor, {
      updateId: update.id,
      body: 'Primeiro.',
    })
    await addMunicipalityUpdateCommentRecord(payload, advisor, {
      updateId: update.id,
      body: 'Segundo.',
    })

    const reloaded = await loadUpdate(update.id)
    expect(reloaded.comments?.map((comment) => comment.body)).toEqual(['Primeiro.', 'Segundo.'])
  })

  it('denies commenting to an advisor outside the portfolio', async () => {
    const { outsiderAdvisor, update } = await createDeliberationContext()

    // The scoped read finds no row: the outsider cannot even see the update
    // (fail-closed 404, same as the create gate).
    await expect(
      addMunicipalityUpdateCommentRecord(payload, outsiderAdvisor, {
        updateId: update.id,
        body: 'Fora do meu município.',
      }),
    ).rejects.toThrow(/não encontrado/i)
  })

  it('denies assigning and resolving to advisors and leaders', async () => {
    const { advisor, leader, update } = await createDeliberationContext()

    await expect(
      assignMunicipalityUpdateResponsibleRecord(payload, advisor, {
        updateId: update.id,
        responsibleId: advisor.id,
      }),
    ).rejects.toThrow(/permissão/i)

    await expect(
      markMunicipalityUpdateResolvedRecord(payload, advisor, { updateId: update.id }),
    ).rejects.toThrow(/permissão/i)

    await expect(
      addMunicipalityUpdateCommentRecord(payload, leader, {
        updateId: update.id,
        body: 'Liderança não participa.',
      }),
    ).rejects.toThrow(/permissão/i)
  })

  it('coordinator resolves and reopens, stamping who and when', async () => {
    const { coordinator, advisor, update } = await createDeliberationContext()
    await assignMunicipalityUpdateResponsibleRecord(payload, coordinator, {
      updateId: update.id,
      responsibleId: advisor.id,
    })
    await addMunicipalityUpdateCommentRecord(payload, advisor, {
      updateId: update.id,
      body: 'Resolvido no território.',
    })

    const resolved = await markMunicipalityUpdateResolvedRecord(payload, coordinator, {
      updateId: update.id,
    })
    expect(resolved.resolvedAt).toBeTruthy()
    expect(relationshipId(resolved.resolvedBy)).toBe(coordinator.id)
    expect(resolved.comments).toHaveLength(1)

    const reopened = await markMunicipalityUpdateReopenedRecord(payload, coordinator, {
      updateId: update.id,
    })
    expect(reopened.resolvedAt).toBeNull()
    expect(reopened.resolvedBy).toBeNull()
    expect(reopened.comments).toHaveLength(1)
  })

  it('deliberative writes cannot touch the fact body (allowlist)', async () => {
    const { coordinator, update } = await createDeliberationContext()

    await expect(
      payload.update({
        collection: 'municipalityUpdate',
        id: update.id,
        data: { body: 'Reescrito pela deliberação.' },
        depth: 0,
        user: coordinator,
        overrideAccess: false,
        context: { mutationKind: 'appendComment' },
      }),
    ).rejects.toThrow('Esta atualização não pode ser alterada por deliberação.')
  })

  it('rejects a leader who reads the update (lockdown at the root)', async () => {
    const { leader, update } = await createDeliberationContext()

    await expect(
      payload.findByID({
        collection: 'municipalityUpdate',
        id: update.id,
        depth: 0,
        user: leader,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão/i)
  })
})
