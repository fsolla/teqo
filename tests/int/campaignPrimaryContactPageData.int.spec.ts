// @vitest-environment node

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'

const authState = vi.hoisted(() => ({
  user: null as CampaignUser | null,
}))

vi.mock('@/utilities/campaignAuth', () => ({
  getCampaignUser: async () => authState.user,
}))

import { searchPrimaryContactOptionsFormAction } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/primaryContactSearchActions'
import config from '@/payload.config'
import {
  getNucleusPrimaryContactPageData,
  primaryContactOptionLimit,
  searchNucleusPrimaryContactOptions,
} from '@/utilities/primaryContactPageData'
import { resolveAccessibleNucleusContext } from '@/utilities/nucleusPageData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('campaign primary contact page data', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('searches beyond the first 100 while pinning the current contact within the hard cap', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await payload.create({
      collection: 'electoralNucleus',
      data: {
        name: campaignFixtures().value('Núcleo contato principal'),
        region: 'Chapada Diamantina',
        locality: 'Chapada Diamantina',
        organizationKind: 'territorial',
      } as never,
      depth: 0,
    })
    const contacts = await Promise.all(
      Array.from({ length: 160 }, (_, index) =>
        payload.create({
          collection: 'contact',
          data: {
            name:
              index === 150
                ? `Needle 150 ${campaignFixtures().value('contato')}`
                : index === 159
                  ? `ZZ Current ${campaignFixtures().value('contato')}`
                  : `${String(index).padStart(3, '0')} Liderança ${campaignFixtures().value('contato')}`,
            phone: campaignFixtures().phone(),
            state: 'BA',
            city: 'Salvador',
          },
          depth: 0,
        }),
      ),
    )
    await Promise.all(
      contacts.map((contact, index) =>
        payload.create({
          collection: 'leadership',
          data: {
            contact: contact.id,
            nucleus: nucleus.id,
            sector: index === 159 ? 'cultura' : 'saude',
            supportStatus: 'engajado',
            createdBy: general.id,
          },
          depth: 0,
        }),
      ),
    )
    await payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: { primaryContact: contacts[159]!.id },
      depth: 0,
    })

    const context = await resolveAccessibleNucleusContext(payload, general, nucleus.slug)
    const data = await getNucleusPrimaryContactPageData(payload, general, context)
    const defaultResults = await searchNucleusPrimaryContactOptions(payload, general, context, '')
    const deepSearch = await searchNucleusPrimaryContactOptions(
      payload,
      general,
      context,
      'Needle 150',
    )
    const currentOffResult = await searchNucleusPrimaryContactOptions(
      payload,
      general,
      context,
      'sem qualquer correspondência',
    )

    expect(data.current).toMatchObject({
      id: contacts[159]!.id,
      name: contacts[159]!.name,
      phone: contacts[159]!.phone,
    })
    expect(data.options).toEqual([])
    expect(defaultResults.current?.id).toBe(contacts[159]!.id)
    expect(defaultResults.options).toHaveLength(primaryContactOptionLimit - 1)
    expect(defaultResults.options.map(({ id }) => id)).not.toContain(contacts[159]!.id)
    expect(defaultResults.options.length + (defaultResults.current ? 1 : 0)).toBe(
      primaryContactOptionLimit,
    )
    expect(deepSearch.current?.id).toBe(contacts[159]!.id)
    expect(deepSearch.options.map(({ id }) => id)).toContain(contacts[150]!.id)
    expect(currentOffResult).toEqual({
      current: expect.objectContaining({ id: contacts[159]!.id }),
      options: [],
    })
    for (const result of [data, defaultResults, deepSearch, currentOffResult]) {
      expect(JSON.stringify(result)).not.toContain('supportStatus')
      expect(JSON.stringify(result)).not.toContain('cultura')
      expect(result.options.length + (result.current ? 1 : 0)).toBeLessThanOrEqual(
        primaryContactOptionLimit,
      )
    }
  })

  it('enforces staff scope and does not expose contact options to leadership users', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const foreignCoordinator = await campaignFixtures().createCampaignUser('coordenador')
    const leader = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await payload.create({
      collection: 'electoralNucleus',
      data: {
        name: campaignFixtures().value('Núcleo contato escopo'),
        coordinators: [coordinator.id],
        region: 'Chapada Diamantina',
        locality: 'Chapada Diamantina',
        organizationKind: 'territorial',
      } as never,
      depth: 0,
    })
    const contact = await payload.create({
      collection: 'contact',
      data: {
        name: campaignFixtures().value('Contato restrito'),
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      },
      depth: 0,
    })
    await payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        nucleus: nucleus.id,
        user: leader.id,
        supportStatus: 'engajado',
        createdBy: general.id,
      },
      depth: 0,
    })
    await payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: { primaryContact: contact.id },
      depth: 0,
    })

    const coordinatorContext = await resolveAccessibleNucleusContext(
      payload,
      coordinator,
      nucleus.slug,
    )
    await expect(
      getNucleusPrimaryContactPageData(payload, coordinator, coordinatorContext),
    ).resolves.toMatchObject({ current: { id: contact.id } })
    await expect(
      searchNucleusPrimaryContactOptions(payload, coordinator, coordinatorContext, 'restrito'),
    ).resolves.toMatchObject({ current: { id: contact.id }, options: [] })
    authState.user = coordinator
    await expect(
      searchPrimaryContactOptionsFormAction(nucleus.slug, 'restrito'),
    ).resolves.toMatchObject({ current: { id: contact.id }, options: [] })
    authState.user = foreignCoordinator
    await expect(searchPrimaryContactOptionsFormAction(nucleus.slug, '')).rejects.toMatchObject({
      name: 'NucleusNotFoundError',
    })
    await expect(
      resolveAccessibleNucleusContext(payload, foreignCoordinator, nucleus.slug),
    ).rejects.toMatchObject({ name: 'NucleusNotFoundError' })

    const leaderContext = await resolveAccessibleNucleusContext(payload, leader, nucleus.slug)
    await expect(getNucleusPrimaryContactPageData(payload, leader, leaderContext)).resolves.toEqual(
      {
        current: null,
        options: [],
      },
    )
    await expect(
      searchNucleusPrimaryContactOptions(payload, leader, leaderContext, ''),
    ).rejects.toThrow('Somente a coordenação')
    authState.user = leader
    await expect(searchPrimaryContactOptionsFormAction(nucleus.slug, '')).rejects.toThrow(
      'Somente a coordenação',
    )
  })
})
