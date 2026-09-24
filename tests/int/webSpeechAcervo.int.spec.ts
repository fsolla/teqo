// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { matchMunicipalityMentions } from '@/lib/speechGazetteer'
import { INTERNET_SPEECH_MEDIA_SLUG } from '@/lib/webSpeech'
import config from '@/payload.config'
import { upsertSpeechBundle, type SpeechImportBundle } from '@/utilities/speech/speechImport'
import {
  loadSpeechAcervoPageData,
  loadSpeechDetailPageData,
  loadWebSpeechAcervoPageData,
  loadWebSpeechDetailPageData,
  loadWebSpeechTitleForActor,
  SpeechNotFoundError,
} from '@/utilities/speech/speechPageData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { speechBundleFixture } from '../helpers/speechBundleFixture'

// C216 — the "Falas na internet" loaders over the real Payload boundary: the
// list reads only web rows, the facets answer over the web catalog, the detail
// carries the private media routes and the Câmara detail never serves a web row
// (and vice versa). The private routes themselves are e2e territory; here the
// view model contract is the target.

let payload: Payload
const createdSourceKeys = new Set<string>()
const createdMediaIds = new Set<number>()
const tempDirs: string[] = []

const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

// Real magic bytes so Payload derives the mime type from the upload itself (the
// detail picks the native control from it).
const MP4_BYTES = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex')
const MP3_BYTES = Buffer.from('fffb900000000000000000000000000000000000', 'hex')

const createMedia = async (bytes: Buffer, filename: string): Promise<number> => {
  const dir = await mkdtemp(join(tmpdir(), 'web-speech-acervo-'))
  tempDirs.push(dir)
  const filePath = join(dir, filename)
  await writeFile(filePath, bytes)
  const media = await payload.create({
    collection: INTERNET_SPEECH_MEDIA_SLUG,
    data: { alt: `Mídia de teste ${filename}` },
    filePath,
    // Intentional bypass: fixtures are a trusted actor with no session.
    overrideAccess: true,
  })
  createdMediaIds.add(media.id)
  return media.id
}

const webBundle = (
  overrides: Partial<SpeechImportBundle> = {},
  sourceKey = `web:test:${randomUUID()}`,
): SpeechImportBundle => {
  createdSourceKeys.add(sourceKey)
  return {
    ...speechBundleFixture(),
    sourceKey,
    origin: 'web',
    platform: 'youtube',
    externalId: sourceKey,
    sourceUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(sourceKey)}`,
    title: 'Fala publicada na internet',
    channel: 'Canal do teste',
    // Câmara-only coordinates never travel on a web row.
    legislature: null,
    type: null,
    phase: null,
    eventId: null,
    audioId: null,
    excerptTMs: null,
    vodPlaybackUrl: null,
    vodDownloadUrl: null,
    officialTextUrl: null,
    officialTranscript: null,
    summary: null,
    presidingOfficer: null,
    ...overrides,
  }
}

const createWebSpeech = async (overrides: Partial<SpeechImportBundle> = {}): Promise<number> => {
  const bundle = webBundle(overrides)
  await upsertSpeechBundle(payload, bundle)
  const found = await payload.find({
    collection: 'speech',
    where: { sourceKey: { equals: bundle.sourceKey } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const speech = found.docs[0]
  if (!speech) throw new Error('web speech fixture was not created')
  return speech.id
}

const createCamaraSpeech = async (overrides: Partial<SpeechImportBundle> = {}): Promise<number> => {
  const bundle = speechBundleFixture(overrides)
  createdSourceKeys.add(bundle.sourceKey)
  await upsertSpeechBundle(payload, bundle)
  const found = await payload.find({
    collection: 'speech',
    where: { sourceKey: { equals: bundle.sourceKey } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const speech = found.docs[0]
  if (!speech) throw new Error('Câmara speech fixture was not created')
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

describe('web speech acervo (C216)', () => {
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
    for (const mediaId of createdMediaIds) {
      await payload
        .delete({
          collection: INTERNET_SPEECH_MEDIA_SLUG,
          id: mediaId,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => undefined)
    }
    for (const dir of tempDirs) await rm(dir, { recursive: true, force: true })
  })

  it('lists only web rows: the Câmara speech with the same marker stays invisible', async () => {
    const runId = randomUUID().slice(0, 8)
    const marker = `internet${runId}`
    const webId = await createWebSpeech({
      segments: [{ startSeconds: 0, endSeconds: 3, text: `A fala ${marker} na internet` }],
    })
    const camaraId = await createCamaraSpeech({
      segments: [{ startSeconds: 0, endSeconds: 3, text: `A fala ${marker} na Câmara` }],
    })

    const { communicator } = await createUsers()
    const data = await loadWebSpeechAcervoPageData(payload, communicator, { q: marker })

    expect(data.totalDocs).toBe(1)
    expect(data.rows.map((row) => row.id)).toEqual([webId])
    expect(data.rows[0]?.excerpt.parts.map((part) => part.text).join('')).toContain(marker)

    // And the Câmara list does not pick the web row up.
    const camara = await loadSpeechAcervoPageData(payload, communicator, { q: marker })
    expect(camara.rows.map((row) => row.id)).toEqual([camaraId])
  })

  it('filters by topic, year, duration and cited municipality over the web catalog', async () => {
    const id = await createWebSpeech({
      speechAt: '2021-04-12T00:00',
      durationSeconds: 90,
      facets: {
        topics: ['igualdade-racial'],
        scopes: ['brasil'],
        municipalities: matchMunicipalityMentions('Feira de Santana'),
        people: [],
        programs: [],
        projects: [],
        classifiedBy: 'gazetteer',
      },
    })

    const { communicator } = await createUsers()
    const municipality = await payload.find({
      collection: 'municipality',
      where: { slug: { equals: 'feira-de-santana' } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const municipalityId = municipality.docs[0]?.id
    if (!municipalityId) throw new Error('seeded municipality missing')

    const data = await loadWebSpeechAcervoPageData(payload, communicator, {
      topic: 'igualdade-racial',
      year: '2021',
      duration: 'curta',
      municipality: String(municipalityId),
    })

    expect(data.rows.map((row) => row.id)).toContain(id)
    expect(data.filterOptions.years).toContain(2021)
    // The web source has no Fase facet.
    expect(data.filterOptions.phases).toEqual([])
  })

  it('orders by publication date and gates the duration orders', async () => {
    const runId = randomUUID().slice(0, 8)
    const marker = `ordem${runId}`
    const older = await createWebSpeech({
      speechAt: '2020-01-10T00:00',
      durationSeconds: 90,
      title: `Mais antiga ${marker}`,
      segments: [{ startSeconds: 0, endSeconds: 3, text: `A fala ${marker} antiga` }],
    })
    const newer = await createWebSpeech({
      speechAt: '2026-01-10T00:00',
      durationSeconds: null,
      title: `Mais recente ${marker}`,
      segments: [{ startSeconds: 0, endSeconds: 3, text: `A fala ${marker} recente` }],
    })

    const { communicator } = await createUsers()
    const byRecency = await loadWebSpeechAcervoPageData(payload, communicator, { q: marker })
    expect(byRecency.rows.map((row) => row.id)).toEqual([newer, older])

    // A duration order only lists rows with a measured duration.
    const byDuration = await loadWebSpeechAcervoPageData(payload, communicator, {
      q: marker,
      sort: 'duracao_maior',
    })
    expect(byDuration.state.sort).toBe('duracao_maior')
    expect(byDuration.rows.map((row) => row.id)).toEqual([older])
  })

  it('expands a theme only over the web rows and keeps the evidence (C192)', async () => {
    const runId = randomUUID().slice(0, 8)
    const marker = `temaweb${runId}`
    const id = await createWebSpeech({
      segments: [
        {
          startSeconds: 0,
          endSeconds: 3,
          text: `Garantir o atendimento universal ${marker} na rede pública`,
        },
      ],
    })

    const { coordinator } = await createUsers()
    const expansionCalls: string[] = []
    const data = await loadWebSpeechAcervoPageData(
      payload,
      coordinator,
      { q: 'defesa do SUS', mode: 'tema' },
      async (theme) => {
        expansionCalls.push(theme)
        return { terms: [`atendimento universal ${marker}`] }
      },
    )

    expect(expansionCalls).toEqual(['defesa do SUS'])
    expect(data.themeUnavailable).toBe(false)
    expect(data.themeApplied).toBe(true)
    const row = data.rows.find((item) => item.id === id)
    expect(row).toBeDefined()
    expect(row?.excerpt.parts.some((part) => part.highlighted)).toBe(true)
  })

  it('carries the private routes, the platform and the origin attribution in the detail', async () => {
    const mediaId = await createMedia(MP3_BYTES, 'source.mp3')
    const id = await createWebSpeech({
      platform: 'radio',
      title: 'Entrevista na rádio',
      channel: 'Rádio Metrópole',
      sourceUrl: 'https://radio.example/entrevista',
      speechAt: '2026-09-21T00:00',
      mirroredMedia: mediaId,
      segments: [{ startSeconds: 0, endSeconds: 4, text: 'A saúde pública baiana' }],
    })

    const { communicator } = await createUsers()
    const view = await loadWebSpeechDetailPageData(payload, communicator, id, 'saúde')

    expect(view.title).toBe('Entrevista na rádio')
    expect(view.platform).toEqual({ value: 'radio', label: 'Rádio' })
    expect(view.channel).toBe('Rádio Metrópole')
    expect(view.sourceUrl).toBe('https://radio.example/entrevista')
    expect(view.dateLabel).toBe('21/09/2026')
    expect(view.mediaKind).toBe('audio')
    expect(view.fileHref).toBe(`/campanha/comunicacao/acervo/internet/${id}/arquivo`)
    expect(view.downloadHref).toBe(`/campanha/comunicacao/acervo/internet/${id}/arquivo?download=1`)
    expect(view.segments[0]?.parts.some((part) => part.highlighted)).toBe(true)
  })

  it('points the cover at the private route only when a thumbnail was captured', async () => {
    const thumbnailId = await createMedia(MP4_BYTES, 'thumb.mp4')
    const withCover = await createWebSpeech({ thumbnail: thumbnailId })
    const withoutCover = await createWebSpeech({})

    const { communicator } = await createUsers()
    const data = await loadWebSpeechAcervoPageData(payload, communicator, {})
    const row = (id: number) => data.rows.find((item) => item.id === id)

    expect(row(withCover)?.thumbnailUrl).toBe(
      `/campanha/comunicacao/acervo/internet/${withCover}/capa`,
    )
    expect(row(withoutCover)?.thumbnailUrl).toBeNull()
  })

  it('never serves one origin from the other origin detail loader', async () => {
    const webId = await createWebSpeech({})
    const camaraId = await createCamaraSpeech({})
    const { communicator } = await createUsers()

    await expect(
      loadSpeechDetailPageData(payload, communicator, webId, undefined, async () => null),
    ).rejects.toBeInstanceOf(SpeechNotFoundError)
    await expect(
      loadWebSpeechDetailPageData(payload, communicator, camaraId),
    ).rejects.toBeInstanceOf(SpeechNotFoundError)
    await expect(loadWebSpeechTitleForActor(payload, communicator, camaraId)).resolves.toBeNull()
  })

  it('allows communicator/coordinator/candidate and denies advisor/leader', async () => {
    const id = await createWebSpeech({})
    const { communicator, coordinator, candidate, advisor, leader } = await createUsers()

    for (const reader of [communicator, coordinator, candidate]) {
      const data = await loadWebSpeechAcervoPageData(payload, reader, {})
      expect(data.rows.map((row) => row.id)).toContain(id)
      await expect(loadWebSpeechDetailPageData(payload, reader, id)).resolves.toBeDefined()
    }

    for (const denied of [advisor, leader]) {
      await expect(loadWebSpeechAcervoPageData(payload, denied, {})).rejects.toThrow(/permissão/i)
      await expect(loadWebSpeechDetailPageData(payload, denied, id)).rejects.toThrow(/permissão/i)
    }
  })
})
