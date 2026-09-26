// @vitest-environment node

import { randomUUID } from 'node:crypto'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { SpeechTopic } from '@/lib/speechFacets'
import { matchMunicipalityMentions } from '@/lib/speechGazetteer'
import { speechPosterHref } from '@/lib/speechPoster'
import config from '@/payload.config'
import { DEEPINFRA_EMBED_MODEL } from '@/utilities/ai/deepInfraEmbed'
import { indexSpeechSources } from '@/utilities/speech/speechEmbeddingIndex'
import { upsertSpeechBundle, type SpeechImportBundle } from '@/utilities/speech/speechImport'
import {
  loadSpeechAcervoPageData,
  loadSpeechDetailPageData,
  SpeechNotFoundError,
  type SpeechVideoStartResolver,
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

/**
 * C229 — writes one index row directly (the CLI has its own unit coverage);
 * the vectors are tiny and hand-picked so the ranking assertions are exact.
 */
const seedSpeechEmbedding = async (
  speechId: number,
  kind: 'speech' | 'segment' | 'window',
  order: number | null,
  vector: number[],
): Promise<void> => {
  await payload.create({
    collection: 'speechEmbedding',
    data: {
      speech: speechId,
      kind,
      order,
      model: DEEPINFRA_EMBED_MODEL,
      dimensions: vector.length,
      contentHash: `${kind}-${order ?? 'root'}-${vector.join(',')}`,
      vector,
    },
    overrideAccess: true,
  })
}

/** Facets of a test speech with the topic overridden (the facet boundary test). */
const facetsWithTopics = (topics: SpeechTopic[]): NonNullable<SpeechImportBundle['facets']> => ({
  topics,
  scopes: ['bahia'],
  municipalities: [],
  people: [],
  programs: [],
  projects: [],
  classifiedBy: 'gazetteer',
})

/**
 * C172 — the detail loader asks YouTube for the session video's start by
 * default; the fixtures keep the suite offline by injecting a resolver.
 */
const noVideoStart: SpeechVideoStartResolver = async () => null

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
    const view = await loadSpeechDetailPageData(payload, communicator, id, undefined, noVideoStart)

    expect(view.id).toBe(id)
    expect(view.segments).toHaveLength(2)
    expect(view.segments[1]?.startSeconds).toBe(3)
    // C166 — the excerpt picker needs the raw duration and the day-only label.
    expect(view.durationSeconds).toBe(252)
    expect(view.speechDateLabel).toBe('07/02/2023')
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
    const both = await loadSpeechDetailPageData(
      payload,
      communicator,
      withBoth,
      undefined,
      noVideoStart,
    )
    expect(both.youtubeVideoId).toBe('lLhRDkSPw0A')
    expect(both.youtubeOffsetSeconds).toBe(2634)
    expect(both.vodResolvable).toBe(true)

    const youtubeOnly = await loadSpeechDetailPageData(
      payload,
      communicator,
      onlyYoutube,
      undefined,
      noVideoStart,
    )
    expect(youtubeOnly.youtubeVideoId).toBe('lLhRDkSPw0A')
    expect(youtubeOnly.vodResolvable).toBe(false)
  })

  it('moves the YouTube offset to the video start, measured evidence winning (C172)', async () => {
    // No measurement for this video: the anchor the resolver answers is applied.
    const anchored = await createSpeech({
      youtubeUrl: 'https://www.youtube.com/watch?v=lLhRDkSPw0A',
      excerptTMs: 1786473834650,
      eventStartAt: '2026-08-11T15:00',
    })
    // Fala 997's session video has a measured lag (13s): it wins with no anchor.
    const measured = await createSpeech({
      youtubeUrl: 'https://www.youtube.com/watch?v=DC_i9Kp1LVk',
      excerptTMs: 1786485082000,
      eventStartAt: '2026-08-11T15:32',
    })

    const { communicator } = await createUsers()

    const withAnchor = await loadSpeechDetailPageData(
      payload,
      communicator,
      anchored,
      undefined,
      async () => '2026-08-11T18:00:40Z',
    )
    // 2634s of session offset − 40s of video start delay.
    expect(withAnchor.youtubeOffsetSeconds).toBe(2594)

    let anchorCalls = 0
    const withEvidence = await loadSpeechDetailPageData(
      payload,
      communicator,
      measured,
      undefined,
      async () => {
        anchorCalls += 1
        return null
      },
    )
    // 11962s of session offset − the measured 13s, and the measured recording
    // never pays the anchor lookup.
    expect(withEvidence.youtubeOffsetSeconds).toBe(11949)
    expect(anchorCalls).toBe(0)
  })

  it('keeps the direct download link off the list view model (C162)', async () => {
    const id = await createSpeech({ vodDownloadUrl: 'https://vod.camara.leg.br/old.mp4' })

    const { communicator } = await createUsers()
    const data = await loadSpeechAcervoPageData(payload, communicator, {})
    const row = data.rows.find((item) => item.id === id)

    expect(row).toBeDefined()
    expect(row).not.toHaveProperty('downloadUrl')
  })

  it('points the list thumbnail at the frame of the speech, or the YouTube cover (C182)', async () => {
    const runId = randomUUID().slice(0, 8)
    const marker = `miniatura${runId}`
    const resolvable = await createSpeech({
      youtubeUrl: 'https://www.youtube.com/watch?v=lLhRDkSPw0A',
      segments: [{ startSeconds: 0, endSeconds: 3, text: `A fala ${marker} no plenário` }],
    })
    const youtubeOnly = await createSpeech({
      eventId: null,
      audioId: null,
      excerptTMs: null,
      youtubeUrl: 'https://www.youtube.com/watch?v=lLhRDkSPw0A',
      segments: [{ startSeconds: 0, endSeconds: 3, text: `A fala ${marker} só no YouTube` }],
    })
    const withoutVideo = await createSpeech({
      eventId: null,
      audioId: null,
      excerptTMs: null,
      segments: [{ startSeconds: 0, endSeconds: 3, text: `A fala ${marker} sem vídeo` }],
    })

    const { communicator } = await createUsers()
    const data = await loadSpeechAcervoPageData(payload, communicator, { q: marker })
    const row = (id: number) => data.rows.find((item) => item.id === id)

    expect(row(resolvable)?.thumbnailUrl).toBe(speechPosterHref(resolvable))
    expect(row(youtubeOnly)?.thumbnailUrl).toBe('https://i.ytimg.com/vi/lLhRDkSPw0A/hqdefault.jpg')
    expect(row(withoutVideo)?.thumbnailUrl).toBeNull()
    // The raw VOD coordinates never reach the list view model.
    expect(JSON.stringify(row(resolvable))).not.toContain('vod.camara.leg.br')
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

  it('ranks by sense with the closest real passage and no highlight (C229)', async () => {
    const runId = randomUUID().slice(0, 8)
    const closer = await createSpeech({
      speechAt: '2020-01-01T10:00',
      segments: [
        { startSeconds: 10, endSeconds: 13, text: 'Primeiro trecho da fala' },
        { startSeconds: 40, endSeconds: 43, text: `O embate com a oposição ${runId}` },
      ],
    })
    const newer = await createSpeech({
      speechAt: '2026-01-01T10:00',
      segments: [{ startSeconds: 0, endSeconds: 3, text: 'Um assunto distante' }],
    })
    await seedSpeechEmbedding(closer, 'speech', null, [1, 0])
    await seedSpeechEmbedding(newer, 'speech', null, [0.9, 0.435])
    await seedSpeechEmbedding(closer, 'segment', 2, [1, 0])
    await seedSpeechEmbedding(closer, 'segment', 1, [0, 1])
    await seedSpeechEmbedding(newer, 'segment', 1, [0.9, 0.435])

    const { coordinator } = await createUsers()
    const embedCalls: string[] = []
    const data = await loadSpeechAcervoPageData(
      payload,
      coordinator,
      { q: 'combate à oposição', mode: 'tema' },
      async (query) => {
        embedCalls.push(query)
        return [1, 0]
      },
    )

    expect(embedCalls).toEqual(['combate à oposição'])
    expect(data.themeUnavailable).toBe(false)
    expect(data.themeApplied).toBe(true)
    // Proximity beats the date: the older speech outranks the newer one.
    const ids = data.rows.map((row) => row.id)
    expect(ids.indexOf(closer)).toBeLessThan(ids.indexOf(newer))

    const row = data.rows.find((item) => item.id === closer)
    expect(row?.semanticMatch).toBe(true)
    expect(row?.matchedTextSearch).toBe(false)
    expect(row?.matchKind).toBe('theme')
    // The evidence is the real segment closest to the query, without highlight.
    expect(row?.excerpt.parts.map((part) => part.text).join('')).toContain(
      `embate com a oposição ${runId}`,
    )
    expect(row?.excerpt.parts.some((part) => part.highlighted)).toBe(false)
    expect(row?.watchHref).toContain('t=40')
  })

  it('returns the honest empty when nothing passes the cut-off (C229)', async () => {
    const runId = randomUUID().slice(0, 8)
    const id = await createSpeech({ speechAt: '1985-01-01T10:00', year: 1985 })
    await seedSpeechEmbedding(id, 'speech', null, [0, 1])

    const { coordinator } = await createUsers()
    const data = await loadSpeechAcervoPageData(
      payload,
      coordinator,
      { q: `tema distante ${runId}`, mode: 'tema', year: '1985' },
      async () => [1, 0],
    )

    expect(data.rows).toEqual([])
    expect(data.themeApplied).toBe(true)
    expect(data.themeUnavailable).toBe(false)
  })

  it('degrades to the literal search when the embedder is unavailable (C229)', async () => {
    const runId = randomUUID().slice(0, 8)
    const marker = `literal${runId}`
    const id = await createSpeech({
      segments: [{ startSeconds: 0, endSeconds: 3, text: `A defesa do SUS ${marker} no plenário` }],
    })

    const { coordinator } = await createUsers()
    const data = await loadSpeechAcervoPageData(
      payload,
      coordinator,
      { q: `defesa do SUS ${marker}`, mode: 'tema' },
      async () => null,
    )

    expect(data.themeUnavailable).toBe(true)
    expect(data.themeApplied).toBe(false)
    const row = data.rows.find((item) => item.id === id)
    expect(row?.semanticMatch).toBe(false)
    expect(row?.matchedTextSearch).toBe(true)
  })

  it('degrades when the candidates have no index rows (C229)', async () => {
    const id = await createSpeech({ speechAt: '1984-01-01T10:00', year: 1984 })

    const { coordinator } = await createUsers()
    const data = await loadSpeechAcervoPageData(
      payload,
      coordinator,
      { q: 'qualquer tema', mode: 'tema', year: '1984' },
      async () => [1, 0],
    )

    expect(data.themeUnavailable).toBe(true)
    expect(data.themeApplied).toBe(false)
    expect(data.rows.every((row) => row.id !== id)).toBe(true)
  })

  it('keeps the facets as the candidate boundary (C229)', async () => {
    const runId = randomUUID().slice(0, 8)
    const saude = await createSpeech({
      speechAt: '2024-01-01T10:00',
      facets: facetsWithTopics(['saude']),
      segments: [{ startSeconds: 0, endSeconds: 3, text: `Saúde ${runId}` }],
    })
    const educacao = await createSpeech({
      speechAt: '2024-01-02T10:00',
      facets: facetsWithTopics(['educacao']),
      segments: [{ startSeconds: 0, endSeconds: 3, text: `Educação ${runId}` }],
    })
    await seedSpeechEmbedding(saude, 'speech', null, [1, 0])
    await seedSpeechEmbedding(educacao, 'speech', null, [1, 0])

    const { coordinator } = await createUsers()
    const data = await loadSpeechAcervoPageData(
      payload,
      coordinator,
      { q: 'tema qualquer', mode: 'tema', topic: 'saude' },
      async () => [1, 0],
    )

    const ids = data.rows.map((row) => row.id)
    expect(ids).toContain(saude)
    expect(ids).not.toContain(educacao)
  })

  it('ranks by relevance over the date in the theme mode (C229)', async () => {
    const runId = randomUUID().slice(0, 8)
    const older = await createSpeech({
      speechAt: '2020-01-01T10:00',
      segments: [{ startSeconds: 0, endSeconds: 3, text: `Fala ${runId}` }],
    })
    const newer = await createSpeech({
      speechAt: '2026-01-01T10:00',
      segments: [{ startSeconds: 0, endSeconds: 3, text: `Fala ${runId}` }],
    })
    await seedSpeechEmbedding(older, 'speech', null, [1, 0])
    await seedSpeechEmbedding(newer, 'speech', null, [0.9, 0.435])

    const { coordinator } = await createUsers()
    const data = await loadSpeechAcervoPageData(
      payload,
      coordinator,
      { q: `tema ${runId}`, mode: 'tema' },
      async () => [1, 0],
    )

    // Relevance first: the older speech outranks the newer one.
    const ids = data.rows.map((row) => row.id)
    expect(ids.indexOf(older)).toBeLessThan(ids.indexOf(newer))
    // The Câmara contract has no sort: the dated state never leaks through.
    expect(data.state.sort).toBeUndefined()
  })

  it('indexes a speech end-to-end and skips it on the second run (C229)', async () => {
    const runId = randomUUID().slice(0, 8)
    const id = await createSpeech({
      speechAt: '1986-01-01T10:00',
      year: 1986,
      segments: [
        { startSeconds: 0, endSeconds: 3, text: `Primeiro trecho ${runId}` },
        { startSeconds: 3, endSeconds: 6, text: `Segundo trecho ${runId}` },
      ],
    })
    const source = {
      id,
      segments: [
        { order: 1, startSeconds: 0, text: `Primeiro trecho ${runId}` },
        { order: 2, startSeconds: 3, text: `Segundo trecho ${runId}` },
      ],
    }
    const embedCalls: string[][] = []
    const embedTexts = async (texts: readonly string[]) => {
      embedCalls.push([...texts])
      return {
        vectors: texts.map((_, index) => (index === 0 ? [1, 0] : [0.6, 0.8])),
        promptTokens: 10,
      }
    }

    const first = await indexSpeechSources(payload, [source], { embedTexts })
    expect(first).toMatchObject({ indexed: 1, failed: 0, units: 2, upToDate: 0 })
    expect(embedCalls).toEqual([[`Primeiro trecho ${runId}`, `Segundo trecho ${runId}`]])

    const { coordinator } = await createUsers()
    const data = await loadSpeechAcervoPageData(
      payload,
      coordinator,
      { q: `tema ${runId}`, mode: 'tema', year: '1986' },
      async () => [1, 0],
    )
    const row = data.rows.find((item) => item.id === id)
    expect(row?.semanticMatch).toBe(true)
    expect(row?.excerpt.parts.map((part) => part.text).join('')).toContain(
      `Primeiro trecho ${runId}`,
    )

    const second = await indexSpeechSources(payload, [source], { embedTexts })
    expect(second).toMatchObject({ indexed: 0, failed: 0, upToDate: 1 })
    expect(embedCalls).toHaveLength(1)

    // A stored order that no longer exists falls back to the FIRST real segment
    // (never a shifted positional guess).
    await seedSpeechEmbedding(id, 'segment', 999, [0, 1])
    const fallback = await loadSpeechAcervoPageData(
      payload,
      coordinator,
      { q: `tema ${runId}`, mode: 'tema', year: '1986' },
      async () => [0, 1],
    )
    expect(
      fallback.rows
        .find((item) => item.id === id)
        ?.excerpt.parts.map((part) => part.text)
        .join(''),
    ).toContain(`Primeiro trecho ${runId}`)
  })

  it('cascades the index rows when the speech is deleted (C229)', async () => {
    const id = await createSpeech()
    await seedSpeechEmbedding(id, 'speech', null, [1, 0])

    await payload.delete({ collection: 'speech', id, depth: 0, overrideAccess: true })

    const found = await payload.find({
      collection: 'speechEmbedding',
      where: { speech: { equals: id } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(found.totalDocs).toBe(0)
  })

  it('ignores vectors from another embedding model (C229)', async () => {
    const id = await createSpeech({ speechAt: '1983-01-01T10:00', year: 1983 })
    await payload.create({
      collection: 'speechEmbedding',
      data: {
        speech: id,
        kind: 'speech',
        model: 'outro-modelo',
        dimensions: 2,
        contentHash: 'outro-modelo',
        vector: [1, 0],
      },
      overrideAccess: true,
    })

    const { coordinator } = await createUsers()
    const data = await loadSpeechAcervoPageData(
      payload,
      coordinator,
      { q: 'qualquer tema', mode: 'tema', year: '1983' },
      async () => [1, 0],
    )

    // The foreign vector is never scored against a bge-m3 query: the loader
    // degrades instead of ranking nonsense.
    expect(data.themeUnavailable).toBe(true)
    expect(data.rows).toEqual([])
  })

  it('never calls the sense engine for an actor outside the catalog gate (C229)', async () => {
    const { advisor } = await createUsers()
    let called = false
    await expect(
      loadSpeechAcervoPageData(payload, advisor, { q: 'SUS', mode: 'tema' }, async () => {
        called = true
        return [1, 0]
      }),
    ).rejects.toThrow(/permissão/i)
    expect(called).toBe(false)
  })
})
