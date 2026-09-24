// @vitest-environment node

import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { matchMunicipalityMentions } from '@/lib/speechGazetteer'
import { INTERNET_SPEECH_MEDIA_SLUG } from '@/lib/webSpeech'
import type { InternetSpeechMedia } from '@/payload-types'
import config from '@/payload.config'
import {
  findSpeechImportState,
  upsertSpeechBundle,
  type SpeechImportBundle,
} from '@/utilities/speech/speechImport'

// C215 — the web-speech fields of the shared upsert: round-trip, idempotency
// (metadata refreshes, segments/facets preserved when omitted), manual
// curation wins and the speech delete cascades over the mirrored media.

let payload: Payload
const createdSourceKeys = new Set<string>()

const MEDIA_BYTES = Buffer.from('web-speech-media')

const createMedia = async (name: string): Promise<InternetSpeechMedia> =>
  payload.create({
    collection: INTERNET_SPEECH_MEDIA_SLUG,
    data: { alt: `Arquivo ${name}` },
    file: { data: MEDIA_BYTES, mimetype: 'video/mp4', name, size: MEDIA_BYTES.length },
    overrideAccess: true,
  })

const webBundle = (overrides: Partial<SpeechImportBundle> = {}): SpeechImportBundle => ({
  sourceKey: `web:test-${randomUUID()}`,
  origin: 'web',
  platform: 'youtube',
  externalId: 'abc123',
  sourceUrl: 'https://www.youtube.com/watch?v=abc123',
  title: 'Entrevista na rádio',
  channel: 'Canal do Solla',
  speechAt: '2026-09-20T00:00',
  year: 2026,
  legislature: null,
  type: null,
  phase: null,
  durationSeconds: 180,
  summary: null,
  officialTranscript: null,
  officialTextUrl: null,
  keywords: [],
  eventId: null,
  eventType: null,
  eventStartAt: null,
  eventEndAt: null,
  youtubeUrl: null,
  presidingOfficer: null,
  audioId: null,
  excerptTMs: null,
  vodPlaybackUrl: null,
  vodDownloadUrl: null,
  facets: {
    topics: ['saude'],
    scopes: ['bahia'],
    municipalities: matchMunicipalityMentions('Feira de Santana'),
    people: ['Lula'],
    programs: [],
    projects: [],
    classifiedBy: 'gazetteer',
  },
  segments: [{ startSeconds: 0, endSeconds: 2.5, text: 'A saúde pública baiana' }],
  ...overrides,
})

const findBySourceKey = async (sourceKey: string) => {
  const found = await payload.find({
    collection: 'speech',
    where: { sourceKey: { equals: sourceKey } },
    depth: 1,
    overrideAccess: true,
  })
  return found.docs[0] ?? null
}

describe('upsertSpeechBundle web origin (C215)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const sourceKey of createdSourceKeys) {
      const speech = await findBySourceKey(sourceKey)
      if (!speech) continue
      await payload.delete({ collection: 'speech', id: speech.id, depth: 0, overrideAccess: true })
    }
  })

  it('persists the origin fields and the mirrored media', async () => {
    const media = await createMedia('fala.mp4')
    const bundle = webBundle({ mirroredMedia: media.id })
    createdSourceKeys.add(bundle.sourceKey)

    const counts = await upsertSpeechBundle(payload, bundle)
    expect(counts.created).toBe(true)

    const speech = await findBySourceKey(bundle.sourceKey)
    expect(speech).toMatchObject({
      origin: 'web',
      platform: 'youtube',
      externalId: 'abc123',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123',
      title: 'Entrevista na rádio',
      channel: 'Canal do Solla',
      speechAt: '2026-09-20T00:00',
      year: 2026,
      durationSeconds: 180,
      classifiedBy: 'gazetteer',
      topics: ['saude'],
    })
    expect(speech?.mirroredMedia).toMatchObject({ id: media.id })
    expect(speech?.mentionedMunicipalities?.[0]).toMatchObject({ slug: 'feira-de-santana' })

    const state = await findSpeechImportState(payload, bundle.sourceKey)
    expect(state).toMatchObject({
      origin: 'web',
      platform: 'youtube',
      externalId: 'abc123',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123',
      mirroredMedia: media.id,
      thumbnail: null,
      segmentCount: 1,
    })
  })

  it('refreshes metadata on re-run and preserves omitted segments/facets', async () => {
    const bundle = webBundle()
    createdSourceKeys.add(bundle.sourceKey)
    await upsertSpeechBundle(payload, bundle)

    const counts = await upsertSpeechBundle(
      payload,
      webBundle({
        sourceKey: bundle.sourceKey,
        title: 'Título atualizado',
        segments: undefined,
        facets: undefined,
      }),
    )
    expect(counts.created).toBe(false)
    expect(counts.segmentsInserted).toBe(0)

    const speech = await findBySourceKey(bundle.sourceKey)
    expect(speech?.title).toBe('Título atualizado')
    expect(speech?.searchText).toBe('a saude publica baiana')
    expect(speech?.topics).toEqual(['saude'])
    const segments = await payload.count({
      collection: 'speechSegment',
      where: { speech: { equals: speech?.id } },
      overrideAccess: true,
    })
    expect(segments.totalDocs).toBe(1)
  })

  it('never overwrites a manual facet curation with the web metadata', async () => {
    const bundle = webBundle()
    createdSourceKeys.add(bundle.sourceKey)
    await upsertSpeechBundle(payload, bundle)
    const speech = await findBySourceKey(bundle.sourceKey)

    await payload.update({
      collection: 'speech',
      id: speech?.id,
      data: { classifiedBy: 'manual', topics: ['cultura'], title: 'Curado à mão' },
      depth: 0,
      overrideAccess: true,
    })

    await upsertSpeechBundle(payload, webBundle({ sourceKey: bundle.sourceKey }))
    const again = await findBySourceKey(bundle.sourceKey)
    expect(again?.topics).toEqual(['cultura'])
    expect(again?.classifiedBy).toBe('manual')
    // Manual curation is facets only: origin metadata still refreshes.
    expect(again?.title).toBe('Entrevista na rádio')
  })

  it('deletes the mirrored media when the speech is deleted', async () => {
    const media = await createMedia('cascata.mp4')
    const bundle = webBundle({ mirroredMedia: media.id })
    createdSourceKeys.add(bundle.sourceKey)
    await upsertSpeechBundle(payload, bundle)
    const speech = await findBySourceKey(bundle.sourceKey)

    await payload.delete({ collection: 'speech', id: speech?.id, depth: 0, overrideAccess: true })

    const mediaAfter = await payload
      .findByID({
        collection: INTERNET_SPEECH_MEDIA_SLUG,
        id: media.id,
        overrideAccess: true,
      })
      .catch(() => null)
    expect(mediaAfter).toBeNull()
  })
})
