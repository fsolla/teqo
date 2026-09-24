import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AIToolContext } from '@/lib/ai/types'
import type { CampaignUser } from '@/payload-types'

const { rerankMock } = vi.hoisted(() => ({ rerankMock: vi.fn() }))

vi.mock('@/utilities/ai/rerankSpeechExcerpts', () => ({ rerankSpeechExcerpts: rerankMock }))

import { findSpeechExcerpts } from '@/utilities/ai/tools/findSpeechExcerpts'

import { stub } from '../helpers/stub'

const denied = { error: 'Leitura do acervo de falas negada.' }

type ExecutableTool = {
  execute: (args: unknown, options?: unknown) => Promise<unknown>
}

const user = (role: CampaignUser['role']): CampaignUser =>
  stub<CampaignUser>({ collection: 'campaignUser', role })

const leader = user('leader')
const advisor = user('advisor')
const coordinator = user('coordinator')

const ctxFor = (actor: CampaignUser, payload: Payload): AIToolContext => ({
  user: actor,
  payload,
})

const payloadFor = (find: ReturnType<typeof vi.fn>): Payload =>
  stub<Payload>({ find: find as unknown as Payload['find'] })

const untouchablePayload = payloadFor(
  vi.fn(() => {
    throw new Error('gate must fail closed before any payload query')
  }),
)

const speechResult = (docs: unknown[], totalDocs = docs.length) => ({ docs, totalDocs })
const segmentsResult = (docs: unknown[]) => ({ docs })

const execute =
  (payload: Payload, actor: CampaignUser = coordinator) =>
  (args: unknown) =>
    (findSpeechExcerpts(ctxFor(actor, payload)) as unknown as ExecutableTool).execute(args)

const SPEECH_WHERE = {
  and: [
    // C215 — the assistant keeps suggesting Câmara excerpts only.
    { origin: { equals: 'camara' } },
    { searchText: { like: 'hospital' } },
    { searchText: { like: 'suburbio' } },
  ],
}

const reranked = (index: number, reason = 'Serve à intenção') => ({ index, reason })

beforeEach(() => {
  rerankMock.mockReset()
  rerankMock.mockResolvedValue(null)
})

describe('findSpeechExcerpts gate (C158)', () => {
  it('nega leader e advisor antes de qualquer query — e sem chamar o reranker', async () => {
    for (const actor of [leader, advisor]) {
      await expect(
        execute(untouchablePayload, actor)({ tema: 'hospital do subúrbio' }),
      ).resolves.toEqual(denied)
    }
    expect(untouchablePayload.find).not.toHaveBeenCalled()
    expect(rerankMock).not.toHaveBeenCalled()
  })

  it('deixa coordinator, candidate e communicator passarem (gate herdado pelo chat do C159)', async () => {
    for (const actor of [coordinator, user('candidate'), user('communicator')]) {
      const find = vi.fn().mockResolvedValue(speechResult([]))
      const result = (await execute(
        payloadFor(find),
        actor,
      )({
        tema: 'hospital do subúrbio',
      })) as Record<string, unknown>

      expect(result).toMatchObject({
        totalDiscursos: 0,
        trechos: [],
        reordenadoPorIA: false,
        truncado: false,
      })
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'speech',
          where: SPEECH_WHERE,
          sort: '-speechAt',
          limit: 30,
          overrideAccess: false,
          user: actor,
        }),
      )
    }
  })

  it('tema sem termos úteis devolve erro sem consultar o acervo nem o reranker', async () => {
    const find = vi.fn()
    const result = (await execute(payloadFor(find))({ tema: 'a de o' })) as { error: string }

    expect(result.error).toContain('Tema sem termos de busca')
    expect(find).not.toHaveBeenCalled()
    expect(rerankMock).not.toHaveBeenCalled()
  })
})

describe('findSpeechExcerpts fallback determinístico (C158)', () => {
  const scriptSearch = () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      speechResult([
        { id: 1, speechAt: '2024-05-01T10:00', type: 'DISCURSO' },
        { id: 2, speechAt: '2024-04-01T10:00', type: 'BREVES COMUNICAÇÕES' },
      ]),
    )
    find.mockResolvedValueOnce(
      segmentsResult([
        { speech: 1, startSeconds: 0, endSeconds: 50, text: 'O hospital do subúrbio e a saúde' },
        { speech: 2, startSeconds: 0, endSeconds: 40, text: 'hospital do subúrbio de novo' },
      ]),
    )
    return find
  }

  it('um trecho por discurso, preservando a ordem do pool scriptado, sem motivo no fallback', async () => {
    const result = (await execute(payloadFor(scriptSearch()))({
      tema: 'hospital do subúrbio',
    })) as {
      reordenadoPorIA: boolean
      consulta: { tema: string; termos: string[]; intencao: string | null }
      criterio: string
      trechos: Array<Record<string, unknown>>
    }

    expect(result.reordenadoPorIA).toBe(false)
    expect(result.consulta).toEqual({
      tema: 'hospital do subúrbio',
      termos: ['hospital', 'suburbio'],
      intencao: null,
    })
    expect(result.criterio).toContain('ASR')
    expect(result.trechos).toHaveLength(2)
    expect(result.trechos[0]).toMatchObject({
      discursoId: 1,
      data: '01/05/2024 · 10:00',
      tipo: 'DISCURSO',
      inicioSegundos: 0,
      fimSegundos: 50,
      inicioLabel: '00:00',
      fimLabel: '00:50',
      duracaoSegundos: 50,
      citacao: 'O hospital do subúrbio e a saúde',
      termosCasados: ['hospital', 'suburbio'],
      url: '/campanha/comunicacao/acervo/1?t=0&q=hospital+suburbio',
    })
    expect(result.trechos[0]).not.toHaveProperty('motivo')
    expect(result.trechos[1]).toMatchObject({ discursoId: 2 })

    // A intenção ausente vira o tema no prompt do reranker (prefixo determinístico).
    expect(rerankMock).toHaveBeenCalledWith(
      expect.objectContaining({ intencao: 'hospital do subúrbio', tema: 'hospital do subúrbio' }),
    )
    const rerankCandidates = (rerankMock.mock.calls[0]![0] as { candidates: unknown[] }).candidates
    expect(rerankCandidates).toHaveLength(2)
  })

  it('discurso que casa o tema mas não rende janela contínua devolve lista vazia, não erro', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(speechResult([{ id: 1, speechAt: '2024-05-01T10:00' }]))
    find.mockResolvedValueOnce(
      segmentsResult([{ speech: 1, startSeconds: 0, endSeconds: 5, text: 'economia e emprego' }]),
    )

    const result = (await execute(payloadFor(find))({ tema: 'hospital do subúrbio' })) as {
      totalDiscursos: number
      trechos: unknown[]
    }

    expect(result.totalDiscursos).toBe(1)
    expect(result.trechos).toEqual([])
    expect(rerankMock).not.toHaveBeenCalled()
  })

  it('trunca no limite de candidatos e devolve a dica', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(speechResult([{ id: 1, speechAt: '2024-05-01T10:00' }], 40))
    find.mockResolvedValueOnce(
      segmentsResult([
        { speech: 1, startSeconds: 0, endSeconds: 30, text: 'hospital do subúrbio' },
      ]),
    )

    const result = (await execute(payloadFor(find))({ tema: 'hospital do subúrbio' })) as {
      truncado: boolean
      dica?: string
    }

    expect(result.truncado).toBe(true)
    expect(result.dica).toContain('refine o tema')
  })
})

describe('findSpeechExcerpts reranking IA (C158)', () => {
  const scriptPool = () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      speechResult([
        { id: 3, speechAt: '2024-06-01T10:00', type: 'DISCURSO' },
        { id: 4, speechAt: '2024-05-01T10:00', type: 'DISCURSO' },
      ]),
    )
    find.mockResolvedValueOnce(
      segmentsResult([
        { speech: 3, startSeconds: 0, endSeconds: 10, text: 'hospital' },
        { speech: 3, startSeconds: 10, endSeconds: 20, text: 'do subúrbio' },
        { speech: 3, startSeconds: 20, endSeconds: 30, text: 'e mais' },
        { speech: 3, startSeconds: 30, endSeconds: 40, text: 'e mais ainda' },
        { speech: 3, startSeconds: 40, endSeconds: 50, text: 'fim' },
        { speech: 4, startSeconds: 0, endSeconds: 30, text: 'hospital do subúrbio' },
      ]),
    )
    return find
  }

  it('usa a ordem e os motivos do reranker, mantendo um trecho por discurso', async () => {
    rerankMock.mockResolvedValue({
      choices: [
        { index: 1, reason: 'Argumento completo em 50s' },
        { index: 0, reason: 'Versão curta do mesmo discurso' },
        reranked(2, 'Outra fala sobre o tema'),
      ],
    })

    const result = (await execute(payloadFor(scriptPool()))({
      tema: 'hospital do subúrbio',
      intencao: 'reels curto, tom emocionante',
    })) as {
      reordenadoPorIA: boolean
      trechos: Array<{ discursoId: number; motivo?: string; fimSegundos: number; url: string }>
    }

    expect(result.reordenadoPorIA).toBe(true)
    expect(result.trechos).toEqual([
      {
        discursoId: 3,
        data: '01/06/2024 · 10:00',
        tipo: 'DISCURSO',
        inicioSegundos: 0,
        fimSegundos: 50,
        inicioLabel: '00:00',
        fimLabel: '00:50',
        duracaoSegundos: 50,
        citacao: 'hospital do subúrbio e mais e mais ainda fim',
        termosCasados: ['hospital', 'suburbio'],
        motivo: 'Argumento completo em 50s',
        url: '/campanha/comunicacao/acervo/3?t=0&q=hospital+suburbio',
      },
      {
        discursoId: 4,
        data: '01/05/2024 · 10:00',
        tipo: 'DISCURSO',
        inicioSegundos: 0,
        fimSegundos: 30,
        inicioLabel: '00:00',
        fimLabel: '00:30',
        duracaoSegundos: 30,
        citacao: 'hospital do subúrbio',
        termosCasados: ['hospital', 'suburbio'],
        motivo: 'Outra fala sobre o tema',
        url: '/campanha/comunicacao/acervo/4?t=0&q=hospital+suburbio',
      },
    ])

    const call = rerankMock.mock.calls[0]![0] as { intencao: string; candidates: unknown[] }
    expect(call.intencao).toBe('reels curto, tom emocionante')
    expect(call.candidates).toHaveLength(3)
  })
})
