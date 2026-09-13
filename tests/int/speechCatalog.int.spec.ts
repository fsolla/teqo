// @vitest-environment node

import { randomUUID } from 'node:crypto'

import type { Payload, RequiredDataFromCollectionSlug } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Speech } from '@/payload-types'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const createdSpeechIds: number[] = []
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const createSpeech = async (
  overrides: Partial<RequiredDataFromCollectionSlug<'speech'>> = {},
): Promise<Speech> => {
  const speech = await payload.create({
    collection: 'speech',
    data: {
      sourceKey: `test-${randomUUID()}`,
      speechAt: '2023-02-07T17:28',
      type: 'BREVES COMUNICAÇÕES',
      phase: 'Breves Comunicações',
      summary: 'A defesa do SUS e da saúde pública baiana.',
      officialTranscript: 'O SR. JORGE SOLLA (Bloco/PT - BA) - Sr. Presidente...',
      keywords: ['Saúde', 'SUS'],
      topics: ['saude'],
      classifiedBy: 'gazetteer',
      ...overrides,
    },
    depth: 0,
    overrideAccess: true,
  })
  createdSpeechIds.push(speech.id)
  return speech
}

describe('speech catalog (C153)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const id of createdSpeechIds) {
      try {
        await payload.delete({ collection: 'speech', id, depth: 0, overrideAccess: true })
      } catch {
        // already deleted by a cascade assertion
      }
    }
  })

  it('derives the year from the wall-clock speechAt', async () => {
    const speech = await createSpeech()

    expect(speech.year).toBe(2023)
  })

  it('normalizes the segment text into searchText and matches accent-insensitively', async () => {
    const speech = await createSpeech()
    const segment = await payload.create({
      collection: 'speechSegment',
      data: {
        speech: speech.id,
        order: 1,
        startSeconds: 0,
        endSeconds: 4.2,
        text: 'A defesa do SUS e da saúde pública',
        // Deliberately wrong: the beforeValidate hook owns this field.
        searchText: 'errado',
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(segment.searchText).toBe('a defesa do sus e da saude publica')

    const hits = await payload.find({
      collection: 'speechSegment',
      where: { searchText: { contains: 'saude' } },
      depth: 0,
      overrideAccess: true,
    })
    expect(hits.docs.map((doc) => doc.id)).toContain(segment.id)
  })

  it('deletes the speech segments with the speech', async () => {
    const speech = await createSpeech()
    const segment = await payload.create({
      collection: 'speechSegment',
      data: {
        speech: speech.id,
        order: 1,
        startSeconds: 0,
        endSeconds: 2,
        text: 'Trecho qualquer',
        searchText: '',
      },
      depth: 0,
      overrideAccess: true,
    })

    await payload.delete({ collection: 'speech', id: speech.id, depth: 0, overrideAccess: true })

    const remaining = await payload.find({
      collection: 'speechSegment',
      where: { id: { equals: segment.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(remaining.docs).toHaveLength(0)
  })

  it('reads for communicator, coordinator, candidate and admin; denies advisor, leader and anonymous', async () => {
    const speech = await createSpeech()
    const fixtures = campaignFixtures()
    const communicator = await fixtures.createCampaignUser('communicator')
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const candidate = await fixtures.createCampaignUser('candidate')
    const advisor = await fixtures.createCampaignUser('advisor')
    const leader = await fixtures.createCampaignUser('leader')
    const admin = await fixtures.createAdminUser()

    for (const reader of [communicator, coordinator, candidate, admin]) {
      const found = await payload.find({
        collection: 'speech',
        where: { id: { equals: speech.id } },
        depth: 0,
        user: reader,
        overrideAccess: false,
      })
      expect(found.docs).toHaveLength(1)
    }

    for (const denied of [advisor, leader, undefined]) {
      await expect(
        payload.find({
          collection: 'speech',
          where: { id: { equals: speech.id } },
          depth: 0,
          user: denied,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/permissão/i)
    }
  })

  it('updates facets for coordinator/candidate/admin but not for communicator/advisor', async () => {
    const speech = await createSpeech()
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const candidate = await fixtures.createCampaignUser('candidate')
    const communicator = await fixtures.createCampaignUser('communicator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const admin = await fixtures.createAdminUser()

    for (const editor of [coordinator, candidate, admin]) {
      const updated = await payload.update({
        collection: 'speech',
        id: speech.id,
        data: { topics: ['educacao'] },
        depth: 0,
        user: editor,
        overrideAccess: false,
      })
      expect(updated.topics).toEqual(['educacao'])
    }

    for (const denied of [communicator, advisor]) {
      await expect(
        payload.update({
          collection: 'speech',
          id: speech.id,
          data: { topics: ['cultura'] },
          depth: 0,
          user: denied,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/permissão/i)
    }
  })

  it('creates/deletes only for Payload admin', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const admin = await fixtures.createAdminUser()

    await expect(
      payload.create({
        collection: 'speech',
        data: {
          sourceKey: `test-${randomUUID()}`,
          speechAt: '2023-02-08T10:00',
          classifiedBy: 'gazetteer',
        },
        depth: 0,
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão/i)

    const speech = await createSpeech()
    await expect(
      payload.delete({
        collection: 'speech',
        id: speech.id,
        depth: 0,
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão/i)

    const adminCreated = await payload.create({
      collection: 'speech',
      data: {
        sourceKey: `test-${randomUUID()}`,
        speechAt: '2023-02-08T10:00',
        classifiedBy: 'gazetteer',
      },
      depth: 0,
      user: admin,
      overrideAccess: false,
    })
    createdSpeechIds.push(adminCreated.id)
    expect(adminCreated.id).toBeGreaterThan(0)
  })

  it('preserves manual facets on unauthenticated writes and lets admin curation through', async () => {
    const speech = await createSpeech({ classifiedBy: 'manual', topics: ['saude'] })

    await payload.update({
      collection: 'speech',
      id: speech.id,
      data: { topics: ['cultura'], scopes: ['brasil'], classifiedBy: 'llm' },
      depth: 0,
      overrideAccess: true,
    })

    const afterImport = await payload.findByID({
      collection: 'speech',
      id: speech.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(afterImport.topics).toEqual(['saude'])
    expect(afterImport.scopes).toEqual([])
    expect(afterImport.classifiedBy).toBe('manual')

    const admin = await campaignFixtures().createAdminUser()
    await payload.update({
      collection: 'speech',
      id: speech.id,
      data: { topics: ['cultura'] },
      depth: 0,
      user: admin,
      overrideAccess: false,
    })

    const curated = await payload.findByID({
      collection: 'speech',
      id: speech.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(curated.topics).toEqual(['cultura'])
    expect(curated.classifiedBy).toBe('manual')
  })
})
