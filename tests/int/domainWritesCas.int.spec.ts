// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  updateLeadershipInternalCasRecord,
  updateLeadershipInternalRecord,
} from '@/app/(campaign)/campanha/actions/leadership'
import {
  createCampaignDemandRecord,
  transitionCampaignDemandCasRecord,
  transitionCampaignDemandRecord,
} from '@/app/(campaign)/campanha/actions/demand'
import { updateActivityCasRecord, createActivityRecord } from '@/app/(campaign)/campanha/actions/activity'
import {
  setStateDeputyMunicipalitiesBatchCasRecord,
  setStateDeputyMunicipalitiesBatchRecord,
} from '@/app/(campaign)/campanha/actions/stateDeputy'
import {
  isOpsUpdatedAtConflictMessage,
  OPS_UPDATED_AT_CONFLICT_MESSAGE,
} from '@/lib/schemas/opsCas'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('updateLeadershipInternalCas (OH13)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('writes when baseUpdatedAt is omitted', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'a_abordar',
    })

    const updated = await updateLeadershipInternalCasRecord(payload, advisor, {
      id: leadership.id,
      supportStatus: 'engajado',
    })

    expect(updated.supportStatus).toBe('engajado')
  })

  it('refuses a stale baseUpdatedAt without writing', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'a_abordar',
    })
    const baseUpdatedAt = leadership.updatedAt

    await updateLeadershipInternalRecord(payload, advisor, {
      id: leadership.id,
      supportStatus: 'em_disputa',
    })

    await expect(
      updateLeadershipInternalCasRecord(payload, advisor, {
        id: leadership.id,
        supportStatus: 'engajado',
        baseUpdatedAt,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(Error)
      const message = (error as Error).message
      expect(isOpsUpdatedAtConflictMessage(message)).toBe(true)
      expect(message.startsWith(OPS_UPDATED_AT_CONFLICT_MESSAGE)).toBe(true)
      return true
    })

    const current = await payload.findByID({
      collection: 'leadership',
      id: leadership.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(current.supportStatus).toBe('em_disputa')
  })

  it('writes when baseUpdatedAt matches', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'a_abordar',
    })

    const updated = await updateLeadershipInternalCasRecord(payload, advisor, {
      id: leadership.id,
      supportStatus: 'engajado',
      baseUpdatedAt: leadership.updatedAt,
    })

    expect(updated.supportStatus).toBe('engajado')
    expect(updated.updatedAt).not.toBe(leadership.updatedAt)
  })
})

describe('transitionCampaignDemandCas (OH13)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('writes when baseUpdatedAt matches and respects advisor scope', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const demand = await createCampaignDemandRecord(payload, advisor, {
      title: 'CAS demanda ok',
      kind: 'material',
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    const updated = await transitionCampaignDemandCasRecord(payload, advisor, {
      id: demand.id,
      status: 'em_analise',
      baseUpdatedAt: demand.updatedAt,
    })

    expect(updated.status).toBe('em_analise')
  })

  it('refuses a stale baseUpdatedAt without writing', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const demand = await createCampaignDemandRecord(payload, advisor, {
      title: 'CAS demanda stale',
      kind: 'servico',
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)
    const baseUpdatedAt = demand.updatedAt

    await transitionCampaignDemandRecord(payload, advisor, {
      id: demand.id,
      status: 'em_analise',
    })

    await expect(
      transitionCampaignDemandCasRecord(payload, advisor, {
        id: demand.id,
        status: 'aprovada',
        baseUpdatedAt,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(Error)
      expect(isOpsUpdatedAtConflictMessage((error as Error).message)).toBe(true)
      return true
    })

    const current = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(current.status).toBe('em_analise')
  })

  it('still refuses escalated decisions for advisors under CAS', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const demand = await createCampaignDemandRecord(payload, advisor, {
      title: 'CAS demanda escalada',
      kind: 'transporte',
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    const escalated = await transitionCampaignDemandRecord(payload, advisor, {
      id: demand.id,
      status: 'escalada',
    })

    await expect(
      transitionCampaignDemandCasRecord(payload, advisor, {
        id: demand.id,
        status: 'aprovada',
        baseUpdatedAt: escalated.updatedAt,
      }),
    ).rejects.toThrow()
  })
})

describe('updateActivityCas (OH13)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('refuses a stale baseUpdatedAt without writing', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const activity = await createActivityRecord(payload, advisor, {
      title: 'CAS atividade',
      kind: 'reuniao_apoio',
      municipality: municipality.id,
      status: 'rascunho',
      advisors: [advisor.id],
    })
    fixtures.own('activity', activity.id)
    const baseUpdatedAt = activity.updatedAt

    await updateActivityCasRecord(payload, advisor, {
      id: activity.id,
      locality: 'Centro',
    })

    await expect(
      updateActivityCasRecord(payload, advisor, {
        id: activity.id,
        locality: 'Bairro Novo',
        baseUpdatedAt,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isOpsUpdatedAtConflictMessage((error as Error).message)).toBe(true)
      return true
    })

    const current = await payload.findByID({
      collection: 'activity',
      id: activity.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(current.locality).toBe('Centro')
  })
})

describe('setStateDeputyMunicipalitiesBatchCas (OH13)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('refuses when a municipality base is stale', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy({ name: `CAS SD ${Date.now()}` })
    const baseUpdatedAt = municipality.updatedAt

    await setStateDeputyMunicipalitiesBatchRecord(payload, coordinator, {
      stateDeputyId: stateDeputy.id,
      municipalityIds: [municipality.id],
      assigned: true,
    })

    await expect(
      setStateDeputyMunicipalitiesBatchCasRecord(payload, coordinator, {
        stateDeputyId: stateDeputy.id,
        municipalityIds: [municipality.id],
        assigned: false,
        municipalityBaseUpdatedAt: { [String(municipality.id)]: baseUpdatedAt },
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isOpsUpdatedAtConflictMessage((error as Error).message)).toBe(true)
      return true
    })
  })
})
