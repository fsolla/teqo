// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { matchMunicipalityMentions } from '@/lib/speechGazetteer'
import config from '@/payload.config'
import {
  findSpeechImportState,
  upsertSpeechBundle,
  type SpeechImportBundle,
} from '@/utilities/speech/speechImport'

import { speechBundleFixture } from '../helpers/speechBundleFixture'

let payload: Payload
const createdSourceKeys = new Set<string>()

const baseBundle = (overrides: Partial<SpeechImportBundle> = {}): SpeechImportBundle => {
  const bundle = speechBundleFixture(overrides)
  createdSourceKeys.add(bundle.sourceKey)
  return bundle
}

const findBySourceKey = async (sourceKey: string) => {
  const found = await payload.find({
    collection: 'speech',
    where: { sourceKey: { equals: sourceKey } },
    depth: 1,
    overrideAccess: true,
  })
  return found.docs[0] ?? null
}

const countSegments = async (speechId: number) => {
  const counted = await payload.count({
    collection: 'speechSegment',
    where: { speech: { equals: speechId } },
    overrideAccess: true,
  })
  return counted.totalDocs
}

describe('upsertSpeechBundle (C153)', () => {
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

  it('creates once and replaces segments on re-run without duplicating', async () => {
    const bundle = baseBundle()

    const first = await upsertSpeechBundle(payload, bundle)
    expect(first.created).toBe(true)
    expect(first.segmentsInserted).toBe(1)

    const speech = await findBySourceKey(bundle.sourceKey)
    expect(speech).not.toBeNull()
    expect(speech?.topics).toEqual(['saude'])
    expect(speech?.mentionedMunicipalities?.[0]).toMatchObject({ slug: 'feira-de-santana' })

    const firstSegments = await payload.find({
      collection: 'speechSegment',
      where: { speech: { equals: speech?.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(firstSegments.docs[0]?.searchText).toBe('a saude publica baiana')

    const second = await upsertSpeechBundle(payload, bundle)
    expect(second.created).toBe(false)
    expect(second.segmentsDeleted).toBe(1)
    expect(second.segmentsInserted).toBe(1)

    const again = await findBySourceKey(bundle.sourceKey)
    expect(again?.id).toBe(speech?.id)
    expect(await countSegments(again?.id ?? 0)).toBe(1)
  })

  it('mirrors the segments into the speech searchText and preserves it when skipped', async () => {
    const bundle = baseBundle({
      segments: [
        { startSeconds: 0, endSeconds: 2, text: 'A saúde pública baiana' },
        { startSeconds: 2, endSeconds: 5, text: 'Educação em Feira de Santana' },
      ],
    })

    await upsertSpeechBundle(payload, bundle)
    const speech = await findBySourceKey(bundle.sourceKey)
    expect(speech?.searchText).toBe('a saude publica baiana educacao em feira de santana')

    await upsertSpeechBundle(
      payload,
      baseBundle({ sourceKey: bundle.sourceKey, segments: undefined }),
    )
    const preserved = await findBySourceKey(bundle.sourceKey)
    expect(preserved?.searchText).toBe('a saude publica baiana educacao em feira de santana')
  })

  it('preserves manual facets and skips facet writes', async () => {
    const bundle = baseBundle()
    await upsertSpeechBundle(payload, bundle)
    const speech = await findBySourceKey(bundle.sourceKey)
    await payload.update({
      collection: 'speech',
      id: speech?.id,
      data: { classifiedBy: 'manual', topics: ['cultura'] },
      depth: 0,
      overrideAccess: true,
    })

    const counts = await upsertSpeechBundle(
      payload,
      baseBundle({
        sourceKey: bundle.sourceKey,
        facets: {
          topics: ['saude'],
          scopes: ['bahia'],
          municipalities: matchMunicipalityMentions('Feira de Santana'),
          people: [],
          programs: [],
          projects: [],
          classifiedBy: 'gazetteer',
        },
      }),
    )

    expect(counts.manualFacetsPreserved).toBe(true)
    const after = await findBySourceKey(bundle.sourceKey)
    expect(after?.topics).toEqual(['cultura'])
    expect(after?.classifiedBy).toBe('manual')
  })

  it('preserves the stored facets when the bundle carries none', async () => {
    const bundle = baseBundle()
    await upsertSpeechBundle(payload, bundle)
    const speech = await findBySourceKey(bundle.sourceKey)

    await upsertSpeechBundle(
      payload,
      baseBundle({ sourceKey: bundle.sourceKey, facets: undefined }),
    )

    const after = await findBySourceKey(bundle.sourceKey)
    expect(after?.topics).toEqual(speech?.topics)
    expect(after?.classifiedBy).toBe('gazetteer')
  })

  it('preserves the stored segments when the bundle carries none', async () => {
    const bundle = baseBundle()
    await upsertSpeechBundle(payload, bundle)
    const speech = await findBySourceKey(bundle.sourceKey)

    await upsertSpeechBundle(
      payload,
      baseBundle({ sourceKey: bundle.sourceKey, segments: undefined }),
    )

    expect(await countSegments(speech?.id ?? 0)).toBe(1)
  })

  it('reports the stored import state for skip decisions', async () => {
    const bundle = baseBundle()
    await upsertSpeechBundle(payload, bundle)

    const state = await findSpeechImportState(payload, bundle.sourceKey)
    expect(state).toMatchObject({
      audioId: 558641,
      excerptTMs: 1675801808560,
      segmentCount: 1,
      classifiedBy: 'gazetteer',
    })
    expect(await findSpeechImportState(payload, 'test-import-missing')).toBeNull()
  })

  it('keeps a facet-less new record with the default provenance', async () => {
    const bundle = baseBundle({ facets: undefined, segments: undefined })
    const counts = await upsertSpeechBundle(payload, bundle)

    expect(counts.created).toBe(true)
    const speech = await findBySourceKey(bundle.sourceKey)
    expect(speech?.classifiedBy).toBe('gazetteer')
    expect(speech?.topics).toEqual([])
  })
})
