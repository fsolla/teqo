import { tool } from 'ai'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { getMunicipalityFederalBaseline } from '@/lib/bahiaElectionAggregates'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { DAY_MS } from '@/lib/text'
import { AI_TOOL_NARROW_SCOPE_HINT, resolveAIToolScope } from '@/utilities/ai/tools/aiToolScope'
import { type PoliticalTrendStatus } from '@/utilities/municipality/municipalityLabels'
import {
  PRIORITY_STALE_SIGNAL_DAYS,
  rankMunicipalityPriorities,
  type PriorityMunicipalityInput,
  type PriorityUpdateSignalInput,
} from '@/utilities/municipality/municipalityPriorities'
import { aggregatePledgesByMunicipality } from '@/utilities/votePledgeData'

const DENIED_MESSAGE = 'Leitura de prioridades de municípios negada.'

const buildCriterion = (janelaDias: number): string =>
  `Prioridades por gravidade: (1) sinal desfavorável recente (última atualização ruim, urgente ou com alerta de adversário na janela de ${janelaDias} dias); ` +
  `(2) estagnação (sem sinal há ${janelaDias} dias ou mais, ou nunca); ` +
  '(3) potencial alto (top 5 por votos estimados 2026, com fallback nos válidos de 2022) entre municípios de nível N0/N1/sem nível. ' +
  'Municípios com atualização recente favorável ficam de fora.'

type MunicipalityRow = {
  id: number
  name: string
  slug: string
  city: string | null
  region: string | null
  priority?: 'alta' | 'normal' | null
  engagementLevel?: 'n0' | 'n1' | 'n2' | 'n3' | 'n4' | null
  expectedVotes?: { central?: number | null } | null
  lastUpdateAt?: string | null
  politicalTrend?: { status?: PoliticalTrendStatus | null } | null
}

type UpdateRow = {
  municipality: number | string | null
  createdAt: string | null
  polarity?: 'boa' | 'neutra' | 'ruim' | null
  urgent?: boolean | null
  adversarySignal?: boolean | null
  body?: string | null
}

/**
 * B186 — "quais devem ser minhas prioridades neste momento?" — ranked
 * municipalities of the actor's scope (or a region/city/municipality cut),
 * each with a one-line evidence. The ranking is pure
 * (`municipalityPriorities.ts`, E9 freshness semantics); here live only the
 * access-scoped reads. Staff-only (leader lockdown fail-closed, same shape as
 * B180/B185); no migration/Consent; `expectedVotes` reaches only staff via
 * the collection access control.
 */
export const getMunicipalityPriorities = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns the campaign municipalities that deserve attention right now within a scope ' +
      "(territory, city, municipality or the user's access scope), ranked by combined gravity " +
      '(recent unfavorable signal > stagnation > high potential with low engagement), ' +
      'each with a one-line reason. Use when the user asks "Quais devem ser minhas prioridades ' +
      'neste momento?", "o que devo atacar primeiro?", "quais municípios estão pegando fogo?" ' +
      'or refines it ("só as sem atualização", "ordena por potencial"). ' +
      'The criterion is always declared in the response; combine the slugs with buildCampaignLinks.',
    inputSchema: z.object({
      scope: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          'Território de identidade, cidade ou município (ex.: "Vale do Jiquiriça", "Salvador", "Feira de Santana"). Omita para usar o escopo de acesso do usuário.',
        ),
      reason: z
        .enum(['sinal_desfavoravel', 'estagnacao', 'potencial'])
        .optional()
        .describe(
          'Filtra o ranking para um fator: "sinal_desfavoravel", "estagnacao" ou "potencial" (ex.: "só as sem atualização").',
        ),
      sortBy: z
        .enum(['gravidade', 'potencial'])
        .optional()
        .default('gravidade')
        .describe(
          '"gravidade" (default) ordena sinal desfavorável > estagnação > potencial; "potencial" reordena todos por votos estimados.',
        ),
      days: z
        .number()
        .int()
        .min(7)
        .max(90)
        .optional()
        .default(PRIORITY_STALE_SIGNAL_DAYS)
        .describe('Janela de recência em dias para sinal desfavorável e estagnação (default 30).'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(10)
        .describe('Máximo de resultados (default 10, max 20).'),
    }),
    execute: async ({ scope, reason, sortBy, days, limit }) => {
      if (!isStaffCampaignRole(ctx.user.role)) return { error: DENIED_MESSAGE }

      const resolved = await resolveAIToolScope(ctx, scope)
      if ('error' in resolved) return resolved

      const scopeIDs = resolved.municipalityIDs
      // The AI SDK applies the zod defaults before execute in the real route;
      // the ?? guards keep direct calls (unit tests, future callers) sane.
      const windowDays = days ?? PRIORITY_STALE_SIGNAL_DAYS
      const safeLimit = limit ?? 10
      const now = new Date()

      const baseResponse = {
        escopo: { tipo: resolved.kind, nome: resolved.name },
        escopoRestrito: ctx.user.role === 'advisor',
        criterio: buildCriterion(windowDays),
        janelaDias: windowDays,
        motivoAplicado: reason ?? null,
      }

      // Scoped to nothing (advisor asking outside the portfolio): fail closed
      // before the municipality read — never an existence lie, no wasted trips.
      if (scopeIDs !== null && scopeIDs.length === 0) {
        return { ...baseResponse, total: 0, prioridades: [], truncado: false }
      }

      const municipalities = await ctx.payload.find({
        collection: 'municipality',
        where: scopeIDs ? { id: { in: scopeIDs } } : {},
        depth: 0,
        limit: 0,
        pagination: false,
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          region: true,
          priority: true,
          engagementLevel: true,
          expectedVotes: { central: true },
          lastUpdateAt: true,
          politicalTrend: { status: true },
        },
        overrideAccess: false,
        user: ctx.user,
      })

      const rows = municipalities.docs as unknown as MunicipalityRow[]
      const ids = rows.map((row) => row.id)

      const [updates, pledges] = await Promise.all([
        ids.length === 0
          ? { docs: [] as UpdateRow[] }
          : ctx.payload.find({
              collection: 'municipalityUpdate',
              where: {
                and: [
                  { municipality: { in: ids } },
                  {
                    // Same boundary as the pure module: an update exactly
                    // `windowDays` old is still decisive.
                    createdAt: {
                      greater_than_equal: new Date(
                        now.getTime() - windowDays * DAY_MS,
                      ).toISOString(),
                    },
                  },
                ],
              },
              depth: 0,
              limit: 0,
              pagination: false,
              select: {
                municipality: true,
                createdAt: true,
                polarity: true,
                urgent: true,
                adversarySignal: true,
                body: true,
              },
              overrideAccess: false,
              user: ctx.user,
            }),
        aggregatePledgesByMunicipality(ctx.payload, ids),
      ])

      const lastPledgeAtById = new Map<number, string | null>(
        ids.map((id) => [id, pledges.get(id)?.lastPledgeAt ?? null]),
      )

      const inputs: PriorityMunicipalityInput[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        region: row.region ?? null,
        city: row.city ?? null,
        priority: row.priority === 'alta' ? 'alta' : 'normal',
        engagementLevel: row.engagementLevel ?? null,
        expectedVotesCentral: row.expectedVotes?.central ?? null,
        validVotes2022: getMunicipalityFederalBaseline(row.slug).validVotesByYear['2022'] ?? null,
        lastUpdateAt: row.lastUpdateAt ?? null,
        politicalTrendStatus: row.politicalTrend?.status ?? null,
      }))

      const signals: PriorityUpdateSignalInput[] = (updates.docs as unknown as UpdateRow[]).flatMap(
        (update) => {
          const municipalityID =
            typeof update.municipality === 'number' ? update.municipality : null
          if (municipalityID === null || !update.createdAt) return []
          return [
            {
              municipalityID,
              createdAt: update.createdAt,
              polarity: update.polarity ?? 'neutra',
              urgent: update.urgent ?? false,
              adversarySignal: update.adversarySignal ?? false,
              body: update.body ?? null,
            },
          ]
        },
      )

      const ranked = rankMunicipalityPriorities(inputs, lastPledgeAtById, signals, {
        windowDays,
        reason,
        sortBy,
        agora: now,
      })

      const total = ranked.length
      const top = ranked.slice(0, safeLimit)
      const truncado = total > top.length

      return {
        ...baseResponse,
        total,
        prioridades: top,
        truncado,
        ...(truncado ? { dica: AI_TOOL_NARROW_SCOPE_HINT } : {}),
      }
    },
  })
