// @vitest-environment node

import { randomUUID } from 'node:crypto'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { matchMunicipalityMentions } from '@/lib/speechGazetteer'
import config from '@/payload.config'
import { upsertSpeechBundle, type SpeechImportBundle } from '@/utilities/speech/speechImport'
import {
  loadSpeechAcervoPageData,
  loadSpeechDetailPageData,
  SpeechNotFoundError,
} from '@/utilities/speech/speechPageData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { speechBundleFixture } from '../helpers/speechBundleFixture'

let payload: Payload
const createdSourceKeys = new Set<string>()
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const feiraDeSantana = () => matchMunicipalityMentions('Feira de Santana')

const feiraDeSantanaId = async (): Promise<number> => {
  const found = await payload.find({
    collection: 'municipality',
    where: { slug: { equals: 'feira-de-santana' } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const municipality = found.docs[0]
  if (!municipality) throw new Error('seeded municipality missing')
  return municipality.id
}

const baseBundle = (overrides: Partial<SpeechImportBundle> = {}): SpeechImportBundle => {
  const bundle = speechBundleFixture(overrides)
  createdSourceKeys.add(bundle.sourceKey)
  return bundle
}

const createSpeech = async (overrides: Partial<SpeechImportBundle> = {}): Promise<number> => {
  const bundle = baseBundle(overrides)
  await upsertSpeechBundle(payload, bundle)
  const found = await payload.find({
    collection: 'speech',
    where: { sourceKey: { equals: bundle.sourceKey } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const speech = found.docs[0]
  if (!speech) throw new Error('fixture speech was not created')
  return speech.id
}

const createUsers = async () => {
  const fixtures = campaignFixtures()
  const [communicator, coordinator, candidate, advisor, leader] = await Promise.all([
    fixtures.createCampaignUser('communicator'),
    fixtures.createCampaignUser('coordinator'),
    fixtures.createCampaignUser('candidate'),
    fixtures.createCampaignUser('advisor'),
    fixtures.createCampaignUser('leader'),
  ])
  return { communicator, coordinator, candidate, advisor, leader }
}

describe('speech acervo (C154)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const sourceKey of createdSourceKeys) {
      const found = await payload.find({
        collection: 'speech',
        where: { sourceKey: { equals: sourceKey } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      const speech = found.docs[0]
      if (speech) {
        await payload.delete({
          collection: 'speech',
          id: speech.id,
          depth: 0,
          overrideAccess: true,
        })
      }
    }
  })

  it('searches the segments accent-insensitively and paginates by speech', async () => {
    const runId = randomUUID().slice(0, 8)
    const marker = `zebra${runId}`
    const first = await createSpeech({
      segments: [
        { startSeconds: 0, endSeconds: 3, text: `A defesa da saúde ${marker}` },
        { startSeconds: 3, endSeconds: 6, text: `Mais saúde ${marker} para a Bahia` },
      ],
    })
    const second = await createSpeech({
      segments: [{ startSeconds: 0, endSeconds: 3, text: `Saúde ${marker} no interior` }],
    })

    const { coordinator } = await createUsers()
    const data = await loadSpeechAcervoPageData(payload, coordinator, {
      q: `saude ${marker}`,
    })

    // Three matching segments, two speeches: the count is per speech.
    expect(data.totalDocs).toBe(2)
    expect(data.rows.map((row) => row.id).sort()).toEqual([first, second].sort())
    expect(data.rows.every((row) => row.matchKind === 'segment')).toBe(true)
    const excerptText = data.rows
      .flatMap((row) => row.excerpt.parts)
      .map((part) => part.text)
      .join('')
    expect(excerptText).toContain(marker)
  })

  it('matches an official keyword as an exact term', async () => {
    const runId = randomUUID().slice(0, 8)
    const id = await createSpeech({
      keywords: [`Farmácia Popular ${runId}`],
      segments: [{ startSeconds: 0, endSeconds: 2, text: 'Discurso sem o termo buscado' }],
    })

    const { communicator } = await createUsers()
    const data = await loadSpeechAcervoPageData(payload, communicator, {
      q: `Farmácia Popular ${runId}`,
    })

    const row = data.rows.find((item) => item.id === id)
    expect(row?.matchKind).toBe('keyword')
  })

  it('filters by topic, year, duration and cited municipality', async () => {
    const id = await createSpeech({
      speechAt: '2019-05-10T15:00',
      year: 2019,
      durationSeconds: 90,
      facets: {
        topics: ['igualdade-racial'],
        scopes: ['brasil'],
        municipalities: feiraDeSantana(),
        people: [],
        programs: [],
        projects: [],
        classifiedBy: 'gazetteer',
      },
    })

    const { communicator } = await createUsers()
    const municipalityId = await feiraDeSantanaId()

    const data = await loadSpeechAcervoPageData(payload, communicator, {
      topic: 'igualdade-racial',
      year: '2019',
      duration: 'curta',
      municipality: String(municipalityId),
    })

    expect(data.rows.map((row) => row.id)).toContain(id)
    expect(data.filterOptions.years).toContain(2019)
  })

  it('returns the detail with segments, cited municipalities and the seek offset', async () => {
    const id = await createSpeech({
      segments: [
        { startSeconds: 0, endSeconds: 3, text: 'Primeiro trecho' },
        { startSeconds: 3, endSeconds: 8, text: 'O trecho sobre a saúde' },
      ],
    })

    const { communicator } = await createUsers()
    const view = await loadSpeechDetailPageData(payload, communicator, id)

    expect(view.id).toBe(id)
    expect(view.segments).toHaveLength(2)
    expect(view.segments[1]?.startSeconds).toBe(3)
    expect(view.municipalities.map((municipality) => municipality.name)).toContain(
      'Feira de Santana',
    )
    expect(view.presidingOfficer).toBe('Pompeo de Mattos')
  })

  it('derives the YouTube default and the resoluble VOD from the detail row (C162)', async () => {
    const withBoth = await createSpeech({
      youtubeUrl: 'https://www.youtube.com/watch?v=lLhRDkSPw0A',
      vodPlaybackUrl: 'https://vod.camara.leg.br/old.mp4',
      vodDownloadUrl: 'https://vod.camara.leg.br/old.mp4',
      excerptTMs: 1786473834650,
      eventStartAt: '2026-08-11T15:00',
    })
    const onlyYoutube = await createSpeech({ youtubeUrl: 'https://youtu.be/lLhRDkSPw0A' })

    const { communicator } = await createUsers()
    const both = await loadSpeechDetailPageData(payload, communicator, withBoth)
    expect(both.youtubeVideoId).toBe('lLhRDkSPw0A')
    expect(both.youtubeOffsetSeconds).toBe(2634)
    expect(both.vodResolvable).toBe(true)

    const youtubeOnly = await loadSpeechDetailPageData(payload, communicator, onlyYoutube)
    expect(youtubeOnly.youtubeVideoId).toBe('lLhRDkSPw0A')
    expect(youtubeOnly.vodResolvable).toBe(false)
  })

  it('keeps the direct download link off the list view model (C162)', async () => {
    const id = await createSpeech({ vodDownloadUrl: 'https://vod.camara.leg.br/old.mp4' })

    const { communicator } = await createUsers()
    const data = await loadSpeechAcervoPageData(payload, communicator, {})
    const row = data.rows.find((item) => item.id === id)

    expect(row).toBeDefined()
    expect(row).not.toHaveProperty('downloadUrl')
  })

  it('allows communicator/coordinator/candidate and denies advisor/leader', async () => {
    const id = await createSpeech()
    const { communicator, coordinator, candidate, advisor, leader } = await createUsers()

    for (const reader of [communicator, coordinator, candidate]) {
      const data = await loadSpeechAcervoPageData(payload, reader, {})
      expect(data.rows.length).toBeGreaterThan(0)
    }

    for (const denied of [advisor, leader]) {
      await expect(loadSpeechAcervoPageData(payload, denied, {})).rejects.toThrow(/permissão/i)
      await expect(loadSpeechDetailPageData(payload, denied, id)).rejects.toThrow(/permissão/i)
    }
  })

  it('throws the named not-found error for a missing speech', async () => {
    const { communicator } = await createUsers()
    await expect(
      loadSpeechDetailPageData(payload, communicator, 999_999_999),
    ).rejects.toBeInstanceOf(SpeechNotFoundError)
  })
})
