// @vitest-environment node

import { randomUUID } from 'node:crypto'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { composeInstitutionSnapshot } from '../../scripts/institutionSnapshot.mjs'
import { installCampaignFixtures } from '../helpers/campaignFixtures'

// C187: the institutional snapshot recorte is theme→institution (the acervo has
// no institution relationship). Pins the read projection (no PII), the topic
// filter and the explicit gap when the recorte is empty.

let payload: Payload
const createdSpeechIds: number[] = []
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const identity = {
  slug: 'ufba',
  name: 'UFBA',
  kind: 'universidade',
  kindLabel: 'Universidade',
  sphere: 'federal',
  sphereLabel: 'Federal',
  scope: 'BA',
  scopeLabel: 'Abrangência BA',
  aliases: ['Universidade Federal da Bahia'],
  topics: ['ciencia-tecnologia'],
}

describe('institution snapshot (C187)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const id of createdSpeechIds) {
      try {
        await payload.delete({ collection: 'speech', id, depth: 0, overrideAccess: true })
      } catch {
        // already deleted
      }
    }
  })

  it(
    'projects the topic-matched speeches without PII and records the recorte',
    {
      timeout: 30_000,
    },
    async () => {
      const fixtures = campaignFixtures()
      const candidate = await fixtures.createCampaignUser('candidate')

      const speech = await payload.create({
        collection: 'speech',
        data: {
          sourceKey: `test-inst-${randomUUID()}`,
          speechAt: '2024-05-10T17:28',
          type: 'DISCURSO',
          phase: 'Discurso',
          summary: 'Defesa do financiamento das universidades federais.',
          officialTranscript: 'O SR. JORGE SOLLA (Bloco/PT - BA) - Sr. Presidente...',
          keywords: ['UFBA', 'universidade'],
          topics: ['ciencia-tecnologia'],
          classifiedBy: 'gazetteer',
        },
        depth: 0,
        overrideAccess: true,
      })
      createdSpeechIds.push(speech.id)

      const actor = { ...candidate, collection: 'campaignUser' as const }
      const snapshot = await composeInstitutionSnapshot({
        payload,
        actor,
        identity,
        readAt: '2026-09-17T11:00:00.000Z',
        codeSha: 'test-sha',
        database: 'localhost:5432/teqo_test',
      })

      expect(snapshot.meta.kind).toBe('institution')
      expect(snapshot.institution).toMatchObject({ slug: 'ufba', name: 'UFBA' })
      expect(snapshot.institution.topics).toEqual(['ciencia-tecnologia'])
      expect(snapshot.speeches.rows.some((row: { id: number }) => row.id === speech.id)).toBe(true)
      const row = snapshot.speeches.rows.find(
        (candidateRow: { id: number }) => candidateRow.id === speech.id,
      )!
      expect('officialTranscript' in row).toBe(false)
      expect(JSON.stringify(snapshot)).not.toContain('@')
    },
  )

  it('declares an explicit gap when the institution has no topic', async () => {
    const fixtures = campaignFixtures()
    const candidate = await fixtures.createCampaignUser('candidate')
    const actor = { ...candidate, collection: 'campaignUser' as const }

    const snapshot = await composeInstitutionSnapshot({
      payload,
      actor,
      identity: { ...identity, slug: 'sem-tema', name: 'Sem Tema', topics: [] },
      readAt: '2026-09-17T11:00:00.000Z',
    })

    expect(snapshot.speeches.rows).toEqual([])
    expect(snapshot.gaps).toContainEqual(expect.objectContaining({ id: 'acervo_sem_tema' }))
  })
})
