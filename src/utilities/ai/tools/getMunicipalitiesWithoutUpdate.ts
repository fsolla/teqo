import { tool } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import { loadAIToolNamesByIds } from '@/utilities/ai/tools/aiToolQueries'
import { resolveAIToolScope, type AIToolScope } from '@/utilities/ai/tools/aiToolScope'
import { municipalitySignalAgeInDays } from '@/utilities/municipality/municipalitySignal'

const DENIED_MESSAGE = 'Leitura de municípios negada.'

type ScopedMunicipality = {
  id: number
  name: string
  slug: string
  city: string | null
  region: string | null
  kind: string | null
  lastUpdateAt: string | null
  advisors: Array<number | string> | null
}

type CoverageItem = {
  id: number
  nome: string
  slug: string
  tipo: string
  regiao: string | null
  cidade: string | null
  ultimaAtualizacao: string | null
  diasSemAtualizacao: number | null
  nuncaAtualizado: boolean
  assessores: Array<{ id: number; nome: string | null }>
}

/**
 * B189 — "quais municípios estão sem atualização há mais de X dias" (cobertura
 * do acompanhamento): varre o escopo do usuário, aplica o limiar (default 30,
 * ajustável na pergunta) e devolve a lista EXAUSTIVA ordenada do mais velho ao
 * mais recente, com "nunca atualizado" no topo. Recência vem de
 * `municipality.lastUpdateAt` (derivado dos hooks de `municipalityUpdate` — a
 * semântica compartilhada da família B185; nunca `updatedAt` do município).
 * Staff-only (leader lockdown fail-closed, mesmo shape do gate eleitoral);
 * leituras com `overrideAccess: false, user: ctx.user` (assessor = portfólio).
 * Sem migration/Consent; nomes de assessores resolvidos em query manual.
 */
export const getMunicipalitiesWithoutUpdate = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns municipalities in scope without a recent follow-up update: last municipalityUpdate ' +
      'older than N days, or never updated (listed first, stagnation). ' +
      'Use when the user asks "Quais municípios estão sem atualização há mais de X dias?", ' +
      '"Quais municípios nunca foram atualizados?" or "Cobertura do acompanhamento em X?". ' +
      'The threshold is always declared in the response; combine the slugs with buildCampaignLinks.',
    inputSchema: z.object({
      scope: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          'Território de identidade, cidade ou município (ex.: "Vale do Jiquiriça", "Salvador", "Feira de Santana"). Omita para usar o escopo de acesso do usuário.',
        ),
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .default(30)
        .describe(
          'Limiar em dias: municípios sem atualização há mais de N dias (estritamente maior). Default 30.',
        ),
    }),
    execute: async ({ scope, days = 30 }) => {
      if (!isStaffCampaignRole(ctx.user.role)) return { error: DENIED_MESSAGE }

      const resolved = await resolveAIToolScope(ctx, scope)
      if ('error' in resolved) return resolved

      // An advisor asking for a territory outside the portfolio gets the empty
      // scoped set — never an existence lie, and no wasted municipality read.
      if (resolved.municipalityIDs !== null && resolved.municipalityIDs.length === 0) {
        return {
          escopo: { tipo: resolved.kind, nome: resolved.name },
          escopoRestrito: ctx.user.role === 'advisor',
          limiarDias: days,
          criterio: buildCriterion(days),
          total: 0,
          nuncaAtualizados: 0,
          municipios: [],
        }
      }

      const docs = await loadScopeMunicipalities(ctx, resolved)
      const items = docs
        .map(buildCoverageItem)
        .filter((item) => item.diasSemAtualizacao === null || item.diasSemAtualizacao > days)

      const [neverUpdated, stale] = partitionByStagnation(items)
      const municipios = [...sortNeverUpdated(neverUpdated), ...sortStale(stale)]

      const advisorIDs = uniqueRelationshipIds(
        municipios.flatMap((item) => item.assessores.map((a) => a.id)),
      )
      const advisorNames = await loadAIToolNamesByIds(ctx, 'campaignUser', advisorIDs)
      for (const item of municipios) {
        item.assessores = item.assessores.map((advisor) => ({
          id: advisor.id,
          nome: advisorNames.get(advisor.id) ?? null,
        }))
      }

      return {
        escopo: { tipo: resolved.kind, nome: resolved.name },
        escopoRestrito: ctx.user.role === 'advisor',
        limiarDias: days,
        criterio: buildCriterion(days),
        total: municipios.length,
        nuncaAtualizados: neverUpdated.length,
        municipios,
      }
    },
  })

const buildCriterion = (days: number): string =>
  `Municípios sem atualização de acompanhamento há mais de ${days} dias (última atualização registrada); nunca atualizados contam como estagnação máxima.`

const loadScopeMunicipalities = async (
  ctx: AIToolContext,
  scope: AIToolScope,
): Promise<ScopedMunicipality[]> => {
  const where: Where = scope.municipalityIDs ? { id: { in: scope.municipalityIDs } } : {}
  const result = await ctx.payload.find({
    collection: 'municipality',
    where,
    depth: 0,
    limit: 0,
    pagination: false,
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      region: true,
      kind: true,
      lastUpdateAt: true,
      advisors: true,
    },
    overrideAccess: false,
    user: ctx.user,
  })
  return result.docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    city: doc.city ?? null,
    region: doc.region ?? null,
    kind: doc.kind ?? null,
    lastUpdateAt: doc.lastUpdateAt ?? null,
    advisors: (Array.isArray(doc.advisors) ? doc.advisors : null) as Array<number | string> | null,
  }))
}

const buildCoverageItem = (doc: ScopedMunicipality): CoverageItem => ({
  id: doc.id,
  nome: doc.name,
  slug: doc.slug,
  tipo: doc.kind === 'zona' ? 'Zona eleitoral (Salvador)' : 'Município inteiro',
  regiao: doc.region,
  cidade: doc.city,
  ultimaAtualizacao: doc.lastUpdateAt,
  diasSemAtualizacao: municipalitySignalAgeInDays(doc.lastUpdateAt),
  nuncaAtualizado: doc.lastUpdateAt === null,
  assessores: (Array.isArray(doc.advisors) ? doc.advisors : [])
    .map(relationshipId)
    .filter((id): id is number => id !== null)
    .map((id) => ({ id, nome: null })),
})

const partitionByStagnation = (items: CoverageItem[]): [CoverageItem[], CoverageItem[]] => {
  const neverUpdated: CoverageItem[] = []
  const stale: CoverageItem[] = []
  for (const item of items) {
    if (item.nuncaAtualizado) neverUpdated.push(item)
    else stale.push(item)
  }
  return [neverUpdated, stale]
}

const byName = (left: CoverageItem, right: CoverageItem): number =>
  left.nome.localeCompare(right.nome, 'pt-BR')

const sortNeverUpdated = (items: CoverageItem[]): CoverageItem[] => [...items].sort(byName)

const sortStale = (items: CoverageItem[]): CoverageItem[] =>
  [...items].sort((left, right) => {
    // The stale partition never contains never-updated items, so the ISO
    // timestamp is always present here.
    const leftAt = new Date(left.ultimaAtualizacao!).getTime()
    const rightAt = new Date(right.ultimaAtualizacao!).getTime()
    if (leftAt !== rightAt) return leftAt - rightAt
    return byName(left, right)
  })
