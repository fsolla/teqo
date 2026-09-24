// @vitest-environment node

import { randomUUID } from 'node:crypto'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { composeThemeSnapshot } from '../../scripts/themeSnapshot.mjs'
import { installCampaignFixtures } from '../helpers/campaignFixtures'

// C190: the theme/area snapshot recorte IS the acervo tag (`Speech.topics`), so
// there is no nominal bridge. Pins the read projection (no PII), the topic
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
  slug: 'educacao',
  value: 'educacao',
  label: 'Educação',
  taxonomyNote: 'Taxonomia do acervo',
}

describe('theme snapshot (C190)', () => {
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
          sourceKey: `test-theme-${randomUUID()}`,
          origin: 'camara',
          speechAt: '2024-05-10T17:28',
          type: 'DISCURSO',
          phase: 'Discurso',
          summary: 'Defesa do financiamento da educação básica.',
          officialTranscript: 'O SR. JORGE SOLLA (Bloco/PT - BA) - Sr. Presidente...',
          keywords: ['escola', 'educação'],
          topics: ['educacao'],
          classifiedBy: 'gazetteer',
        },
        depth: 0,
        overrideAccess: true,
      })
      createdSpeechIds.push(speech.id)

      const actor = { ...candidate, collection: 'campaignUser' as const }
      const snapshot = await composeThemeSnapshot({
        payload,
        actor,
        identity,
        readAt: '2026-09-18T11:00:00.000Z',
        codeSha: 'test-sha',
        database: 'localhost:5432/teqo_test',
      })

      expect(snapshot.meta.kind).toBe('theme')
      expect(snapshot.theme).toMatchObject({
        slug: 'educacao',
        value: 'educacao',
        label: 'Educação',
      })
      expect(snapshot.theme.topics).toEqual(['educacao'])
      expect(snapshot.speeches.rows.some((row: { id: number }) => row.id === speech.id)).toBe(true)
      const row = snapshot.speeches.rows.find(
        (candidateRow: { id: number }) => candidateRow.id === speech.id,
      )!
      expect('officialTranscript' in row).toBe(false)
      expect('mentionExcerpt' in row).toBe(false)
      expect(JSON.stringify(snapshot)).not.toContain('@')
    },
  )

  it('declares an explicit gap when the theme has no speech', async () => {
    const fixtures = campaignFixtures()
    const candidate = await fixtures.createCampaignUser('candidate')
    const actor = { ...candidate, collection: 'campaignUser' as const }

    const snapshot = await composeThemeSnapshot({
      payload,
      actor,
      identity: {
        slug: 'pessoa-deficiencia',
        value: 'pessoa-deficiencia',
        label: 'Pessoa com Deficiência',
        taxonomyNote: 'Taxonomia do acervo',
      },
      readAt: '2026-09-18T11:00:00.000Z',
    })

    expect(snapshot.speeches.rows).toEqual([])
    expect(snapshot.speeches.totalCount).toBe(0)
    expect(snapshot.gaps).toContainEqual(expect.objectContaining({ id: 'acervo_sem_falas' }))
  })
})
