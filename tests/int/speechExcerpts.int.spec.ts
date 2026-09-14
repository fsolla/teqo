// @vitest-environment node

import { randomUUID } from 'node:crypto'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { rerankMock } = vi.hoisted(() => ({ rerankMock: vi.fn() }))

vi.mock('@/utilities/ai/rerankSpeechExcerpts', () => ({ rerankSpeechExcerpts: rerankMock }))

import type { AIToolContext } from '@/lib/ai/types'
import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'
import { findSpeechExcerpts } from '@/utilities/ai/tools/findSpeechExcerpts'
import { upsertSpeechBundle, type SpeechImportBundle } from '@/utilities/speech/speechImport'

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

type ExecutableTool = {
  execute: (args: unknown, options?: unknown) => Promise<unknown>
}

const executeTool = (user: CampaignUser, args: unknown): Promise<Record<string, unknown>> =>
  (findSpeechExcerpts({ user, payload } as AIToolContext) as unknown as ExecutableTool).execute(
    args,
  ) as Promise<Record<string, unknown>>

const createSpeech = async (overrides: Partial<SpeechImportBundle> = {}): Promise<number> => {
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

beforeEach(() => {
  rerankMock.mockReset()
  rerankMock.mockResolvedValue(null)
})

describe('findSpeechExcerpts (C158)', () => {
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

  it('devolve trecho contínuo com citação, corte e link no ponto (tema sem acento, ASR com acento)', async () => {
    const marker = `zebra${randomUUID().slice(0, 8)}`
    const speechId = await createSpeech({
      speechAt: '2026-03-10T10:00',
      type: 'DISCURSO',
      segments: [
        { startSeconds: 0, endSeconds: 4, text: `O hospital do subúrbio ${marker}` },
        { startSeconds: 4, endSeconds: 8, text: `precisa de investimento ${marker}` },
      ],
    })
    const { coordinator } = await createUsers()

    const result = await executeTool(coordinator, { tema: `hospital do suburbio ${marker}` })

    expect(result).toMatchObject({
      reordenadoPorIA: false,
      totalDiscursos: 1,
      trechos: [
        {
          discursoId: speechId,
          data: '10/03/2026 · 10:00',
          tipo: 'DISCURSO',
          inicioSegundos: 0,
          fimSegundos: 8,
          inicioLabel: '00:00',
          fimLabel: '00:08',
          duracaoSegundos: 8,
          citacao: `O hospital do subúrbio ${marker} precisa de investimento ${marker}`,
          termosCasados: ['hospital', 'suburbio', marker],
          url: `/campanha/comunicacao/acervo/${speechId}?t=0&q=hospital+suburbio+${marker}`,
        },
      ],
    })
    expect((result as { criterio: string }).criterio).toContain('ASR')
  })

  it('nega advisor e leader (fail-closed) e libera communicator, coordinator e candidate', async () => {
    const marker = `zebra${randomUUID().slice(0, 8)}`
    await createSpeech({
      speechAt: '2026-03-11T10:00',
      segments: [{ startSeconds: 0, endSeconds: 5, text: `hospital do subúrbio ${marker}` }],
    })
    const users = await createUsers()

    for (const actor of [users.advisor, users.leader]) {
      await expect(executeTool(actor, { tema: `hospital ${marker}` })).resolves.toEqual({
        error: 'Leitura do acervo de falas negada.',
      })
    }

    for (const actor of [users.communicator, users.coordinator, users.candidate]) {
      const result = await executeTool(actor, { tema: `hospital ${marker}` })
      expect((result.trechos as unknown[]).length).toBeGreaterThan(0)
    }
  })

  it('lista no máximo um trecho por discurso, do mais recente para o mais antigo', async () => {
    const marker = `zebra${randomUUID().slice(0, 8)}`
    const older = await createSpeech({
      speechAt: '2026-01-05T10:00',
      segments: [{ startSeconds: 0, endSeconds: 6, text: `hospital do subúrbio ${marker} antigo` }],
    })
    const newer = await createSpeech({
      speechAt: '2026-02-05T10:00',
      segments: [{ startSeconds: 0, endSeconds: 6, text: `hospital do subúrbio ${marker} novo` }],
    })
    const { coordinator } = await createUsers()

    const result = await executeTool(coordinator, { tema: `hospital do subúrbio ${marker}` })
    const trechos = result.trechos as Array<{ discursoId: number }>

    expect(trechos.map((trecho) => trecho.discursoId)).toEqual([newer, older])
  })

  it('tema sem resultado devolve lista vazia (nunca erro técnico)', async () => {
    const marker = `zebra${randomUUID().slice(0, 8)}`
    await createSpeech({
      speechAt: '2026-03-12T10:00',
      segments: [{ startSeconds: 0, endSeconds: 5, text: `hospital do subúrbio ${marker}` }],
    })
    const { coordinator } = await createUsers()

    const result = await executeTool(coordinator, {
      tema: `inexistente ${marker}`,
    })

    expect(result).toMatchObject({ totalDiscursos: 0, trechos: [], reordenadoPorIA: false })
  })

  it('usa a escolha e o motivo do reranker quando há IA, com a intenção declarada', async () => {
    const marker = `zebra${randomUUID().slice(0, 8)}`
    await createSpeech({
      speechAt: '2026-03-13T10:00',
      segments: [
        { startSeconds: 0, endSeconds: 10, text: `hospital do subúrbio ${marker}` },
        { startSeconds: 10, endSeconds: 20, text: `e mais ${marker}` },
        { startSeconds: 20, endSeconds: 30, text: `e mais ainda ${marker}` },
      ],
    })
    rerankMock.mockResolvedValue({
      choices: [{ index: 0, reason: 'Cita o hospital do subúrbio e fecha a ideia' }],
    })
    const { coordinator } = await createUsers()

    const result = await executeTool(coordinator, {
      tema: `hospital do subúrbio ${marker}`,
      intencao: 'reels curto sobre o hospital do subúrbio',
    })

    expect(result.reordenadoPorIA).toBe(true)
    expect(result.trechos).toEqual([
      expect.objectContaining({
        motivo: 'Cita o hospital do subúrbio e fecha a ideia',
      }),
    ])
    expect(rerankMock).toHaveBeenCalledWith(
      expect.objectContaining({
        intencao: 'reels curto sobre o hospital do subúrbio',
        tema: `hospital do subúrbio ${marker}`,
      }),
    )
  })
})
