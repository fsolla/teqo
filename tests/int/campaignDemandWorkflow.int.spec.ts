// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createCampaignDemandRecord,
  setCampaignDemandCostRecord,
  setCampaignDemandResponsiblesRecord,
  transitionCampaignDemandRecord,
  updateCampaignDemandRecord,
} from '@/app/(campaign)/campanha/actions/demand'
import { slugify } from '@/lib/slug'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('campaign demand workflow (staff-only)', () => {
  beforeAll(async () => {
    // The derived-title assertions below only hold while the AI call is
    // skipped: fail loudly if a key ever appears in the test environment.
    expect(process.env.DEEPSEEK_API_KEY).toBeUndefined()
    payload = await getPayload({ config: await config })
  })

  const createScenario = async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const candidate = await fixtures.createCampaignUser('candidate')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const leaderAccount = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    return { fixtures, municipality, coordinator, advisor, candidate, leaderAccount, leadership }
  }

  it('lets staff open a demand in an administered municipality with a derived title', async () => {
    const { fixtures, municipality, advisor } = await createScenario()

    const description = fixtures.value(
      'Som para caminhada: precisamos de carro de som para a caminhada de sábado.',
    )
    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'equipamento',
      description,
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    expect(demand.status).toBe('aberta')
    // Without a DEEPSEEK_API_KEY in tests, the derived title falls back to the
    // truncated free text — creation never fails over the AI.
    expect(demand.title).toBe(description)
    expect(demand.slug).toBe(slugify(description))

    const raw = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(raw.statusHistory).toHaveLength(1)
    expect(raw.statusHistory?.[0]?.status).toBe('aberta')
  })

  it('suffixes the slug when the derived title collides', async () => {
    const { fixtures, municipality, advisor } = await createScenario()

    const description = fixtures.value('Material para a feira: 500 santinhos e 200 bottons.')
    const first = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description,
      municipality: municipality.id,
    })
    const second = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description,
      municipality: municipality.id,
    })
    const third = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description,
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', first.id)
    fixtures.own('campaignDemand', second.id)
    fixtures.own('campaignDemand', third.id)

    expect(second.title).toBe(first.title)
    expect(second.slug).toBe(`${first.slug}-2`)
    expect(third.slug).toBe(`${first.slug}-3`)
  })

  it('rejects a free text shorter than the two-character minimum', async () => {
    const { municipality, advisor } = await createScenario()

    await expect(
      createCampaignDemandRecord(payload, advisor, {
        kind: 'material',
        description: 'a',
        municipality: municipality.id,
      }),
    ).rejects.toThrow()
  })

  it('rejects demand creation from leaders', async () => {
    const { fixtures, municipality, leaderAccount } = await createScenario()

    await expect(
      createCampaignDemandRecord(payload, leaderAccount, {
        kind: 'material',
        description: fixtures.value('Bloqueado'),
        municipality: municipality.id,
      }),
    ).rejects.toThrow()
  })

  it('rejects a demand from an advisor outside the municipality', async () => {
    const { fixtures, leaderAccount: _leader, municipality: _municipality } = await createScenario()
    const outsideAdvisor = await fixtures.createCampaignUser('advisor')
    const otherMunicipality = await fixtures.getMunicipality()

    await expect(
      createCampaignDemandRecord(payload, outsideAdvisor, {
        kind: 'material',
        description: fixtures.value('Fora do escopo'),
        municipality: otherMunicipality.id,
      }),
    ).rejects.toThrow()
  })

  it('runs the analyze → escalate → coordinator/candidate decision path with history', async () => {
    const { fixtures, municipality, coordinator, advisor, candidate } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'transporte',
      description: fixtures.value('Transporte'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    const analyzing = await transitionCampaignDemandRecord(payload, advisor, {
      id: demand.id,
      status: 'em_analise',
      decisionNote: null,
    })
    expect(analyzing.status).toBe('em_analise')

    const escalated = await transitionCampaignDemandRecord(payload, advisor, {
      id: demand.id,
      status: 'escalada',
      decisionNote: 'Custo acima da alçada.',
    })
    expect(escalated.status).toBe('escalada')

    await expect(
      transitionCampaignDemandRecord(payload, advisor, {
        id: demand.id,
        status: 'aprovada',
        decisionNote: null,
      }),
    ).rejects.toThrow('Coordenador Geral')

    const approved = await transitionCampaignDemandRecord(payload, coordinator, {
      id: demand.id,
      status: 'aprovada',
      decisionNote: 'Aprovado com ajuste de valor.',
    })
    expect(approved.status).toBe('aprovada')

    const demandForCandidate = await createCampaignDemandRecord(payload, advisor, {
      kind: 'transporte',
      description: fixtures.value('Candidato decide'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demandForCandidate.id)
    await transitionCampaignDemandRecord(payload, advisor, {
      id: demandForCandidate.id,
      status: 'em_analise',
      decisionNote: null,
    })
    await transitionCampaignDemandRecord(payload, advisor, {
      id: demandForCandidate.id,
      status: 'escalada',
      decisionNote: 'Escalada.',
    })
    const candidateApproved = await transitionCampaignDemandRecord(payload, candidate, {
      id: demandForCandidate.id,
      status: 'aprovada',
      decisionNote: 'OK pelo candidato.',
    })
    expect(candidateApproved.status).toBe('aprovada')
  })

  it('denies leaders read access to demands', async () => {
    const { fixtures, municipality, advisor, leaderAccount } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description: fixtures.value('Faixas'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    await expect(
      payload.find({
        collection: 'campaignDemand',
        where: { id: { equals: demand.id } },
        depth: 0,
        pagination: false,
        user: leaderAccount,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão/i)
  })

  it('keeps cost staff-only', async () => {
    const { fixtures, municipality, advisor } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'espaco',
      description: fixtures.value('Aluguel de espaço'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    await setCampaignDemandCostRecord(payload, advisor, { id: demand.id, cost: 1500.5 })

    const staffRead = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      user: advisor,
      overrideAccess: false,
    })
    expect(staffRead.cost).toBe(1500.5)
  })

  it('shows demands only to explicit responsibles (C143)', async () => {
    const { fixtures, municipality, advisor } = await createScenario()
    const peerAdvisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id, peerAdvisor.id])

    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description: fixtures.value('Panfletos'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    // The creator enters the responsible list automatically (C143 contract).
    const raw = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(raw.responsibles).toContain(advisor.id)

    const creatorRead = await payload.find({
      collection: 'campaignDemand',
      where: { id: { equals: demand.id } },
      depth: 0,
      pagination: false,
      user: advisor,
      overrideAccess: false,
    })
    expect(creatorRead.docs).toHaveLength(1)

    // Same-municipality advisor who is not a responsible sees nothing —
    // fail-closed, no municipality inheritance.
    const peerRead = await payload.find({
      collection: 'campaignDemand',
      where: { id: { equals: demand.id } },
      depth: 0,
      pagination: false,
      user: peerAdvisor,
      overrideAccess: false,
    })
    expect(peerRead.docs).toHaveLength(0)
  })

  it('keeps demands without responsibles readable only by unrestricted roles (C143 fail-closed)', async () => {
    const { fixtures, municipality, coordinator, candidate, advisor, leaderAccount } =
      await createScenario()

    const demand = await fixtures.createCampaignDemand({
      municipality: municipality.id,
      createdBy: coordinator.id,
    })

    for (const actor of [coordinator, candidate]) {
      const visible = await payload.find({
        collection: 'campaignDemand',
        where: { id: { equals: demand.id } },
        depth: 0,
        pagination: false,
        user: actor,
        overrideAccess: false,
      })
      expect(visible.docs).toHaveLength(1)
    }

    // Advisor: the Where scope filters the row out; leader: access is a hard
    // false, so Payload refuses the read outright.
    const advisorRead = await payload.find({
      collection: 'campaignDemand',
      where: { id: { equals: demand.id } },
      depth: 0,
      pagination: false,
      user: advisor,
      overrideAccess: false,
    })
    expect(advisorRead.docs).toHaveLength(0)
    await expect(
      payload.find({
        collection: 'campaignDemand',
        where: { id: { equals: demand.id } },
        depth: 0,
        pagination: false,
        user: leaderAccount,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão/i)
  })

  it('manages the responsible list within the visibility rule (C143)', async () => {
    const { fixtures, municipality, coordinator, advisor } = await createScenario()
    const secondAdvisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id, secondAdvisor.id])

    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description: fixtures.value('Comunicação'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    // The responsible adds a peer.
    await setCampaignDemandResponsiblesRecord(payload, advisor, {
      id: demand.id,
      responsibles: [advisor.id, secondAdvisor.id],
    })
    const raw = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(raw.responsibles).toEqual(expect.arrayContaining([advisor.id, secondAdvisor.id]))

    // The added peer can now read the demand.
    const peerRead = await payload.find({
      collection: 'campaignDemand',
      where: { id: { equals: demand.id } },
      depth: 0,
      pagination: false,
      user: secondAdvisor,
      overrideAccess: false,
    })
    expect(peerRead.docs).toHaveLength(1)

    // A non-responsible cannot manage the list (update scope = read scope).
    const outsideAdvisor = await fixtures.createCampaignUser('advisor')
    await expect(
      setCampaignDemandResponsiblesRecord(payload, outsideAdvisor, {
        id: demand.id,
        responsibles: [outsideAdvisor.id],
      }),
    ).rejects.toThrow()

    // Self-removal hands the demand off: the former responsible loses access.
    await setCampaignDemandResponsiblesRecord(payload, advisor, {
      id: demand.id,
      responsibles: [secondAdvisor.id],
    })
    const afterRemoval = await payload.find({
      collection: 'campaignDemand',
      where: { id: { equals: demand.id } },
      depth: 0,
      pagination: false,
      user: advisor,
      overrideAccess: false,
    })
    expect(afterRemoval.docs).toHaveLength(0)

    // An unrestricted coordinator can always restore/read it.
    const coordinatorRead = await payload.find({
      collection: 'campaignDemand',
      where: { id: { equals: demand.id } },
      depth: 0,
      pagination: false,
      user: coordinator,
      overrideAccess: false,
    })
    expect(coordinatorRead.docs).toHaveLength(1)
  })

  it('lets a responsible outside the municipality portfolio read and manage (C143)', async () => {
    const { fixtures, municipality, advisor } = await createScenario()
    const remoteAdvisor = await fixtures.createCampaignUser('advisor')

    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description: fixtures.value('Demanda fora da carteira'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    // The remote advisor administers no municipality of this demand, but an
    // explicit responsibility grants visibility by design (no municipality
    // inheritance — the link is the responsibility itself).
    await setCampaignDemandResponsiblesRecord(payload, advisor, {
      id: demand.id,
      responsibles: [advisor.id, remoteAdvisor.id],
    })
    const visible = await payload.find({
      collection: 'campaignDemand',
      where: { id: { equals: demand.id } },
      depth: 0,
      pagination: false,
      user: remoteAdvisor,
      overrideAccess: false,
    })
    expect(visible.docs).toHaveLength(1)

    const managed = await setCampaignDemandResponsiblesRecord(payload, remoteAdvisor, {
      id: demand.id,
      responsibles: [remoteAdvisor.id],
    })
    expect(managed.responsibles).toEqual([remoteAdvisor.id])
  })

  it('drops non-eligible ids from the responsible list (C143 fail-closed)', async () => {
    const { fixtures, municipality, advisor, leaderAccount } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description: fixtures.value('Lista limpa'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    // A forged request naming a leader as responsible: the beforeValidate
    // hook intersects with eligible staff, so the leader never lands on the
    // list (they read hard-false anyway — this pins the invariant server-side).
    await setCampaignDemandResponsiblesRecord(payload, advisor, {
      id: demand.id,
      responsibles: [advisor.id, leaderAccount.id],
    })
    const raw = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(raw.responsibles).toEqual([advisor.id])
  })

  it('keeps the previous title and slug when the edited description has no AI', async () => {
    const { fixtures, municipality, advisor } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description: fixtures.value('Panfletos da feira'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)
    const originalSlug = demand.slug
    const originalTitle = demand.title

    const updated = await updateCampaignDemandRecord(payload, advisor, {
      id: demand.id,
      description: `${fixtures.value('Panfletos')} — agora com mais 200 unidades.`,
    })

    // AI is unavailable in tests: the previous title is kept (keep-previous
    // policy for edits) and the canonical slug never changes after create.
    expect(updated.description).toContain('mais 200 unidades')
    expect(updated.title).toBe(originalTitle)
    expect(updated.slug).toBe(originalSlug)
  })

  it('recalculates nothing on an unchanged description', async () => {
    const { fixtures, municipality, advisor } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description: fixtures.value('Mesma descrição'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)
    const originalTitle = demand.title
    const originalSlug = demand.slug

    const updated = await updateCampaignDemandRecord(payload, advisor, {
      id: demand.id,
      description: demand.description ?? '',
    })

    expect(updated.title).toBe(originalTitle)
    expect(updated.slug).toBe(originalSlug)
    expect(updated.description).toBe(demand.description)
  })

  it('rejects description edits from leaders', async () => {
    const { fixtures, municipality, advisor, leaderAccount } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      kind: 'material',
      description: fixtures.value('Bloqueado para líder'),
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    await expect(
      updateCampaignDemandRecord(payload, leaderAccount, {
        id: demand.id,
        description: fixtures.value('Tentativa do líder'),
      }),
    ).rejects.toThrow(/editam demandas/)
  })
})
