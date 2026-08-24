// @vitest-environment node

import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createActivityRecord,
  createTourDraftActivitiesRecord,
} from '@/app/(campaign)/campanha/actions/activity'
import {
  createAdvisorRecord,
  updateAdvisorPermissionRecord,
} from '@/app/(campaign)/campanha/actions/advisor'
import { createLeadershipRecord } from '@/app/(campaign)/campanha/actions/leadership'
import {
  assignMunicipalityAdvisorsRecord,
  setMunicipalityEngagementLevelRecord,
  updateMunicipalityStrategyRecord,
} from '@/app/(campaign)/campanha/actions/municipality'
import config from '@/payload.config'
import { canCreateOrganization } from '@/utilities/campaignAccess'
import { loadWritableMunicipalityOptions } from '@/utilities/campaignRelationOptions'
import { loadSupporterCreatePageData } from '@/utilities/supporter/supporterPageData'
import {
  loadMunicipalityVisitEligibility,
  loadVisitCandidates,
  loadVisitPlannerRegions,
} from '@/utilities/visit/visitPlannerData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { stub } from '../helpers/stub'

type MunicipalityUpdateCreateData = RequiredDataFromCollectionSlug<'municipalityUpdate'>
type DemandCreateData = RequiredDataFromCollectionSlug<'campaignDemand'>

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('advisor permission profile (C141)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('creates advisors with the default Carteira · Edita carteira profile', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const created = await createAdvisorRecord(payload, coordinator, {
      name: 'Assessora Padrão',
      email: `${fixtures.value('default-profile')}@example.com`,
    })
    const stored = await payload.findByID({
      collection: 'campaignUser',
      id: created.id,
      depth: 0,
      select: { visibility: true, editing: true },
      overrideAccess: true,
    })
    expect(stored.visibility).toBe('carteira')
    expect(stored.editing).toBe('carteira')
  })

  it('lets coordinator and candidate set the profile; advisor and leader cannot', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const candidate = await fixtures.createCampaignUser('candidate')
    const advisor = await fixtures.createCampaignUser('advisor')
    const leader = await fixtures.createCampaignUser('leader')
    const target = await fixtures.createCampaignUser('advisor')

    const byCoordinator = await updateAdvisorPermissionRecord(payload, coordinator, {
      id: target.id,
      visibility: 'tudo',
      editing: 'somente_leitura',
    })
    expect(byCoordinator.visibility).toBe('tudo')
    expect(byCoordinator.editing).toBe('somente_leitura')

    const byCandidate = await updateAdvisorPermissionRecord(payload, candidate, {
      id: target.id,
      visibility: 'tudo',
      editing: 'carteira',
    })
    expect(byCandidate.visibility).toBe('tudo')
    expect(byCandidate.editing).toBe('carteira')

    await expect(
      updateAdvisorPermissionRecord(payload, advisor, {
        id: target.id,
        visibility: 'tudo',
        editing: 'carteira',
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)

    await expect(
      updateAdvisorPermissionRecord(payload, leader, {
        id: target.id,
        visibility: 'carteira',
        editing: 'carteira',
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)
  })

  it('rejects the incoherent combination on the action and on the API itself', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const target = await fixtures.createCampaignUser('advisor')

    await expect(
      updateAdvisorPermissionRecord(payload, coordinator, {
        id: target.id,
        visibility: 'carteira',
        editing: 'tudo',
      }),
    ).rejects.toThrow(/exige Visão/)

    // The collection hook is the fail-closed layer for REST/admin writes.
    await expect(
      payload.update({
        collection: 'campaignUser',
        id: target.id,
        data: { visibility: 'carteira', editing: 'tudo' },
        depth: 0,
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/exige Visão/)
  })

  it('prevents advisors from changing their own profile', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')

    await expect(
      payload.update({
        collection: 'campaignUser',
        id: advisor.id,
        data: { visibility: 'tudo' },
        depth: 0,
        user: advisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('widens reads to the whole catalog with Visão "Tudo" — municipalities, leaderships, pledges', async () => {
    const fixtures = campaignFixtures()
    const carteiraAdvisor = await fixtures.createCampaignUser('advisor')
    const wideAdvisor = await fixtures.createCampaignUser('advisor', { visibility: 'tudo' })

    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [carteiraAdvisor.id, wideAdvisor.id])

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [outside.id],
    })
    const pledge = await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: outside.id,
    })

    const carteiraCount = await payload.count({
      collection: 'municipality',
      where: {},
      user: carteiraAdvisor,
      overrideAccess: false,
    })
    expect(carteiraCount.totalDocs).toBe(1)

    const wideCount = await payload.count({
      collection: 'municipality',
      where: {},
      user: wideAdvisor,
      overrideAccess: false,
    })
    expect(wideCount.totalDocs).toBe(435)

    // The leadership/pledge pins are by EXACT id (not global counts, which the
    // shared test DB pollutes from parallel specs): the wide advisor sees the
    // out-of-carteira row, the carteira advisor does not.
    const wideLeadership = await payload.findByID({
      collection: 'leadership',
      id: leadership.id,
      depth: 0,
      user: wideAdvisor,
      overrideAccess: false,
    })
    expect(wideLeadership.id).toBe(leadership.id)

    await expect(
      payload.findByID({
        collection: 'leadership',
        id: leadership.id,
        depth: 0,
        user: carteiraAdvisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const widePledge = await payload.findByID({
      collection: 'votePledge',
      id: pledge.id,
      depth: 0,
      user: wideAdvisor,
      overrideAccess: false,
    })
    expect(widePledge.id).toBe(pledge.id)

    await expect(
      payload.findByID({
        collection: 'votePledge',
        id: pledge.id,
        depth: 0,
        user: carteiraAdvisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('keeps demands and supporters on the carteira even with Visão "Tudo"', async () => {
    const fixtures = campaignFixtures()
    const wideAdvisor = await fixtures.createCampaignUser('advisor', { visibility: 'tudo' })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideAdvisor.id])

    const inScopeContact = await fixtures.createContact()
    const inScopeSupporter = await fixtures.createSupporter({
      contact: inScopeContact,
      municipality: administered.id,
    })
    const outsideContact = await fixtures.createContact()
    await fixtures.createSupporter({
      contact: outsideContact,
      municipality: outside.id,
    })
    await fixtures.createCampaignDemand({
      municipality: outside.id,
      title: fixtures.value('demanda-fora'),
    })

    const visibleSupporters = await payload.find({
      collection: 'supporter',
      where: {},
      depth: 0,
      pagination: false,
      user: wideAdvisor,
      overrideAccess: false,
    })
    expect(visibleSupporters.docs.map((doc) => doc.id)).toEqual([inScopeSupporter.id])

    const visibleDemands = await payload.find({
      collection: 'campaignDemand',
      where: {},
      depth: 0,
      pagination: false,
      user: wideAdvisor,
      overrideAccess: false,
    })
    expect(visibleDemands.docs).toHaveLength(0)
  })

  it('writes exactly what Edição allows — carteira keeps the boundary', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor', { visibility: 'tudo' })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    await expect(
      updateMunicipalityStrategyRecord(payload, advisor, {
        municipality: outside.id,
        priority: 'alta',
      }),
    ).rejects.toThrow()

    const updated = await updateMunicipalityStrategyRecord(payload, advisor, {
      municipality: administered.id,
      priority: 'alta',
    })
    expect(updated.priority).toBe('alta')
    fixtures.touchMunicipality(administered.id)
    fixtures.touchMunicipality(outside.id)
  })

  it('Edição "Tudo" widens staff writes but never the coordination or PII surfaces', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'tudo',
    })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const outsideUpdated = await updateMunicipalityStrategyRecord(payload, advisor, {
      municipality: outside.id,
      priority: 'alta',
    })
    expect(outsideUpdated.priority).toBe('alta')
    fixtures.touchMunicipality(outside.id)

    // Coordination writes stay unrestricted-only.
    await expect(
      assignMunicipalityAdvisorsRecord(payload, advisor, {
        municipality: outside.id,
        advisors: [advisor.id],
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)

    await expect(
      setMunicipalityEngagementLevelRecord(payload, advisor, {
        municipality: outside.id,
        level: 'n2',
        note: 'Teste C141',
      }),
    ).rejects.toThrow(/coordenador|candidato|coordenação/i)

    // Supporter rows (PII) stay capped on the carteira even with Edição "Tudo".
    const outsideContact = await fixtures.createContact()
    const outsideSupporter = await fixtures.createSupporter({
      contact: outsideContact,
      municipality: outside.id,
    })
    await expect(
      payload.update({
        collection: 'supporter',
        id: outsideSupporter.id,
        data: { notes: 'tentativa fora da carteira' },
        depth: 0,
        user: advisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('Somente leitura closes every write path for advisors', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor', {
      editing: 'somente_leitura',
    })
    const administered = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    await expect(
      updateMunicipalityStrategyRecord(payload, advisor, {
        municipality: administered.id,
        priority: 'alta',
      }),
    ).rejects.toThrow()

    // Organizations are staff-wide to create, but the Edição axis closes the
    // path for a `somente_leitura` advisor (fail-closed on the access gate).
    const createAsAdvisor = await canCreateOrganization({
      req: stub<PayloadRequest>({ user: advisor, payload, context: {} }),
      data: { name: fixtures.value('org-bloqueada'), kind: 'sindicato' },
    })
    expect(createAsAdvisor).toBe(false)

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [administered.id],
    })
    const pledge = await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: administered.id,
    })
    await expect(
      payload.update({
        collection: 'votePledge',
        id: pledge.id,
        data: { declaredVotes: 500 },
        depth: 0,
        user: advisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('giro (tour) stops are checked against the WRITE scope, not the read scope', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'carteira',
    })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    // Visão "Tudo" lets the advisor READ the outside município, but Edição
    // "Carteira" must still keep a tour composed over it out of the database.
    await expect(
      createTourDraftActivitiesRecord(payload, advisor, {
        tourName: 'Giro fora da carteira',
        note: undefined,
        stops: [{ municipality: outside.id, tags: [] }],
      }),
    ).rejects.toThrow(/fora do escopo|escopo/i)

    const created = await createTourDraftActivitiesRecord(payload, advisor, {
      tourName: 'Giro na carteira',
      note: undefined,
      stops: [{ municipality: administered.id, tags: [] }],
    })
    expect(created).toHaveLength(1)
    fixtures.touchMunicipality(administered.id)
  })

  it('giro follows Edição "Tudo" (out-of-carteira stops ok) and Somente leitura (blocked)', async () => {
    const fixtures = campaignFixtures()
    const wideAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'tudo',
    })
    const readOnlyAdvisor = await fixtures.createCampaignUser('advisor', {
      editing: 'somente_leitura',
    })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideAdvisor.id])
    await fixtures.assignMunicipalityAdvisors(administered.id, [readOnlyAdvisor.id])

    const wideCreated = await createTourDraftActivitiesRecord(payload, wideAdvisor, {
      tourName: 'Giro amplo',
      note: undefined,
      stops: [{ municipality: outside.id, tags: [] }],
    })
    expect(wideCreated).toHaveLength(1)
    fixtures.touchMunicipality(outside.id)

    await expect(
      createTourDraftActivitiesRecord(payload, readOnlyAdvisor, {
        tourName: 'Giro bloqueado',
        note: undefined,
        stops: [{ municipality: administered.id, tags: [] }],
      }),
    ).rejects.toThrow(/fora do escopo|escopo/i)
  })

  it('activity create/update follow the Edição axis (not the read scope)', async () => {
    const fixtures = campaignFixtures()
    const wideReadAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'carteira',
    })
    const wideEditAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'tudo',
    })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideReadAdvisor.id])
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideEditAdvisor.id])

    const validInput = (municipalityId: number, title: string) => ({
      title,
      tags: ['Caminhada'],
      status: 'confirmado' as const,
      startAt: new Date(Date.now() + 86_400_000).toISOString(),
      municipality: municipalityId,
      locality: 'Centro',
    })

    // Visão "Tudo" + Edição "Carteira": the single create outside the carteira
    // is refused by the action (Payload's `canCreateActivity` is a plain staff
    // boolean, so the per-município check lives in the action — same as the
    // giro batch).
    await expect(
      createActivityRecord(
        payload,
        wideReadAdvisor,
        validInput(outside.id, fixtures.value('atividade-fora')),
      ),
    ).rejects.toThrow()

    // Edição "Tudo" creates and updates outside the carteira.
    const created = await createActivityRecord(
      payload,
      wideEditAdvisor,
      validInput(outside.id, fixtures.value('atividade-ampla')),
    )
    fixtures.touchMunicipality(outside.id)
    const updated = await payload.update({
      collection: 'activity',
      id: created.id,
      data: { locality: 'Novo local' },
      depth: 0,
      user: wideEditAdvisor,
      overrideAccess: false,
    })
    expect(updated.locality).toBe('Novo local')

    // A carteira advisor cannot update the same out-of-carteira activity.
    await expect(
      payload.update({
        collection: 'activity',
        id: created.id,
        data: { locality: 'Invadido' },
        depth: 0,
        user: wideReadAdvisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('leadership create/manage follow the Edição axis in the server actions', async () => {
    const fixtures = campaignFixtures()
    const wideEditAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'tudo',
    })
    const wideReadAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'carteira',
    })
    const readOnlyAdvisor = await fixtures.createCampaignUser('advisor', {
      editing: 'somente_leitura',
    })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideEditAdvisor.id])
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideReadAdvisor.id])
    await fixtures.assignMunicipalityAdvisors(administered.id, [readOnlyAdvisor.id])

    const created = await createLeadershipRecord(payload, wideEditAdvisor, {
      municipalities: [outside.id],
      name: fixtures.value('Liderança ampla'),
      phones: [fixtures.phone()],
      supportStatus: 'a_abordar',
    })
    expect(created.id).toBeTruthy()
    fixtures.touchMunicipality(outside.id)

    await expect(
      createLeadershipRecord(payload, readOnlyAdvisor, {
        municipalities: [administered.id],
        name: fixtures.value('Liderança bloqueada'),
        phones: [fixtures.phone()],
        supportStatus: 'a_abordar',
      }),
    ).rejects.toThrow(/escopo|municípios que assessora/i)
    // Update outside the carteira: allowed for Edição "Tudo", denied for carteira.
    await expect(
      createLeadershipRecord(payload, wideReadAdvisor, {
        municipalities: [outside.id],
        name: fixtures.value('Liderança indevida'),
        phones: [fixtures.phone()],
        supportStatus: 'a_abordar',
      }),
    ).rejects.toThrow(/escopo|municípios que assessora/i)
  })

  it('municipality updates: Visão "Tudo" reads outside, Edição gates creates', async () => {
    const fixtures = campaignFixtures()
    const wideAdvisor = await fixtures.createCampaignUser('advisor', { visibility: 'tudo' })
    const carteiraAdvisor = await fixtures.createCampaignUser('advisor')
    const wideEditAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'tudo',
    })
    const author = await fixtures.createCampaignUser('coordinator')
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideAdvisor.id])
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideEditAdvisor.id])

    const outsideUpdate = await fixtures.createMunicipalityUpdate({
      municipality: outside.id,
      author: author.id,
      body: fixtures.value('atualização fora'),
    })
    fixtures.touchMunicipality(outside.id)

    // Visão "Tudo" reads the out-of-carteira update; the carteira advisor does not.
    const wideRead = await payload.findByID({
      collection: 'municipalityUpdate',
      id: outsideUpdate.id,
      depth: 0,
      user: wideAdvisor,
      overrideAccess: false,
    })
    expect(wideRead.id).toBe(outsideUpdate.id)

    await expect(
      payload.findByID({
        collection: 'municipalityUpdate',
        id: outsideUpdate.id,
        depth: 0,
        user: carteiraAdvisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    // Edição "Tudo" creates an update outside the carteira.
    await payload.create({
      collection: 'municipalityUpdate',
      data: stub<MunicipalityUpdateCreateData>({
        municipality: outside.id,
        body: fixtures.value('update amplo'),
      }),
      depth: 0,
      user: wideEditAdvisor,
      overrideAccess: false,
    })
  })

  it('demandas ignoram o eixo de visão e de edição — somente leitura fecha, "Tudo" não alarga', async () => {
    const fixtures = campaignFixtures()
    const wideEditAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'tudo',
    })
    const readOnlyAdvisor = await fixtures.createCampaignUser('advisor', {
      editing: 'somente_leitura',
    })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideEditAdvisor.id])
    await fixtures.assignMunicipalityAdvisors(administered.id, [readOnlyAdvisor.id])

    const demand = await fixtures.createCampaignDemand({
      municipality: outside.id,
      title: fixtures.value('demanda-eixo'),
    })

    // Edição "Tudo" does NOT widen demand updates (C143 owns the rule).
    await expect(
      payload.update({
        collection: 'campaignDemand',
        id: demand.id,
        data: { description: 'tentativa' },
        depth: 0,
        user: wideEditAdvisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    // Somente leitura cannot create or update demands, even in the carteira.
    await expect(
      payload.create({
        collection: 'campaignDemand',
        data: stub<DemandCreateData>({
          municipality: administered.id,
          title: fixtures.value('demanda-ro'),
        }),
        depth: 0,
        user: readOnlyAdvisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const inScopeDemand = await fixtures.createCampaignDemand({
      municipality: administered.id,
      title: fixtures.value('demanda-carteira'),
    })
    await expect(
      payload.update({
        collection: 'campaignDemand',
        id: inScopeDemand.id,
        data: { description: 'tentativa ro' },
        depth: 0,
        user: readOnlyAdvisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('Visão "Tudo" alarga os contatos de liderança mas mantém apoiadores na carteira (PII cap)', async () => {
    const fixtures = campaignFixtures()
    const wideAdvisor = await fixtures.createCampaignUser('advisor', { visibility: 'tudo' })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideAdvisor.id])

    const outsideLeadershipContact = await fixtures.createContact()
    await fixtures.createLeadership({
      contact: outsideLeadershipContact,
      municipalities: [outside.id],
    })
    const outsideSupporterContact = await fixtures.createContact()
    await fixtures.createSupporter({
      contact: outsideSupporterContact,
      municipality: outside.id,
    })
    const insideSupporterContact = await fixtures.createContact()
    await fixtures.createSupporter({
      contact: insideSupporterContact,
      municipality: administered.id,
    })

    // The leadership ficha outside the carteira IS readable with Visão "Tudo".
    const leadershipFicha = await payload.findByID({
      collection: 'contact',
      id: outsideLeadershipContact.id,
      depth: 0,
      user: wideAdvisor,
      overrideAccess: false,
    })
    expect(leadershipFicha.id).toBe(outsideLeadershipContact.id)

    // The supporter ficha outside the carteira stays invisible (PII cap).
    await expect(
      payload.findByID({
        collection: 'contact',
        id: outsideSupporterContact.id,
        depth: 0,
        user: wideAdvisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const insideSupporterFicha = await payload.findByID({
      collection: 'contact',
      id: insideSupporterContact.id,
      depth: 0,
      user: wideAdvisor,
      overrideAccess: false,
    })
    expect(insideSupporterFicha.id).toBe(insideSupporterContact.id)
  })

  it('enforceCoherentAdvisorProfile cobre updates parciais e downgrades', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const target = await fixtures.createCampaignUser('advisor')

    // Partial update raising Edição without touching Visão.
    await expect(
      payload.update({
        collection: 'campaignUser',
        id: target.id,
        data: { editing: 'tudo' },
        depth: 0,
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/exige Visão/)

    // Lowering Visão while Edição "Tudo" is persisted.
    await updateAdvisorPermissionRecord(payload, coordinator, {
      id: target.id,
      visibility: 'tudo',
      editing: 'tudo',
    })
    await expect(
      payload.update({
        collection: 'campaignUser',
        id: target.id,
        data: { visibility: 'carteira' },
        depth: 0,
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/exige Visão/)

    // Create with Edição "Tudo" and no Visão.
    await expect(
      payload.create({
        collection: 'campaignUser',
        data: {
          name: fixtures.value('incoerente'),
          email: `${fixtures.value('incoerente')}@example.com`,
          password: fixtures.value('password'),
          role: 'advisor',
          editing: 'tudo',
        },
        depth: 0,
      }),
    ).rejects.toThrow(/exige Visão/)
  })
})

describe('write-scoped municipality options (C144)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('loadWritableMunicipalityOptions follows the Edição axis for every profile', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const carteiraAdvisor = await fixtures.createCampaignUser('advisor')
    const wideReadAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'carteira',
    })
    const wideEditAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'tudo',
    })
    const readOnlyAdvisor = await fixtures.createCampaignUser('advisor', {
      editing: 'somente_leitura',
    })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [
      carteiraAdvisor.id,
      wideReadAdvisor.id,
      wideEditAdvisor.id,
      readOnlyAdvisor.id,
    ])

    const idsOf = (options: Awaited<ReturnType<typeof loadWritableMunicipalityOptions>>) =>
      new Set(options.map((option) => option.id))

    // Unrestricted staff and Edição "Tudo" offer the whole catalog.
    expect(idsOf(await loadWritableMunicipalityOptions(payload, coordinator)).has(outside.id)).toBe(
      true,
    )
    expect(
      idsOf(await loadWritableMunicipalityOptions(payload, wideEditAdvisor)).has(outside.id),
    ).toBe(true)

    // The C144 core fix: Visão "Tudo" + Edição "Carteira" offers ONLY the
    // carteira — the picker can no longer suggest a município the server rejects.
    for (const advisor of [carteiraAdvisor, wideReadAdvisor]) {
      const ids = idsOf(await loadWritableMunicipalityOptions(payload, advisor))
      expect(ids.has(administered.id)).toBe(true)
      expect(ids.has(outside.id)).toBe(false)
    }

    // Somente leitura: nothing to write, nothing offered.
    expect(await loadWritableMunicipalityOptions(payload, readOnlyAdvisor)).toEqual([])
  })

  it('giro composer writeScope restricts regions and candidates; the dossier card stays read-wide', async () => {
    const fixtures = campaignFixtures()
    const wideReadAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'carteira',
    })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideReadAdvisor.id])

    // Regions are built only over writable municípios — one portfolio, one count.
    const regions = await loadVisitPlannerRegions(payload, wideReadAdvisor, { writeScope: true })
    expect(regions.reduce((sum, region) => sum + region.municipalityCount, 0)).toBe(1)

    // Candidates exclude the readable-but-not-writable município.
    const bundle = await loadVisitCandidates(payload, wideReadAdvisor, { writeScope: true })
    const slugs = bundle.groups.flatMap((group) =>
      group.candidates.map((candidate) => candidate.slug),
    )
    expect(slugs).toEqual([administered.slug])
    expect(slugs).not.toContain(outside.slug)

    // The dossier eligibility card (read surface) keeps the read scope: the
    // same actor still reads the out-of-carteira município there.
    const { candidate } = await loadMunicipalityVisitEligibility(
      payload,
      wideReadAdvisor,
      outside.slug,
    )
    expect(candidate).not.toBeNull()
  })

  it('loadSupporterCreatePageData offers only writable municipalities', async () => {
    const fixtures = campaignFixtures()
    const wideReadAdvisor = await fixtures.createCampaignUser('advisor', {
      visibility: 'tudo',
      editing: 'carteira',
    })
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [wideReadAdvisor.id])

    const pageData = await loadSupporterCreatePageData(payload, wideReadAdvisor)
    const ids = new Set(pageData.municipalityOptions.map((option) => option.id))
    expect(ids.has(administered.id)).toBe(true)
    expect(ids.has(outside.id)).toBe(false)
  })
})
