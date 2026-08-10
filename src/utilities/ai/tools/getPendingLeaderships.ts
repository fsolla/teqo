import { tool } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import { resolveAIToolScope, type AIToolResolvedScope } from '@/utilities/ai/tools/aiToolScope'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'

const DENIED_MESSAGE = 'Leitura de dados de lideranças negada.'
const PENDING_CRITERION =
  'Status "A abordar" ou "Em disputa"; ou "Engajado" sem compromisso de votos no escopo consultado.'
const EMPTY_MUNICIPALITIES_CRITERION = 'Municípios do escopo sem nenhuma liderança vinculada.'
const NARROW_SCOPE_HINT = 'Estreite o escopo (território, cidade ou município) para ver o restante.'
const PENDING_SUPPORT_STATUSES = ['a_abordar', 'em_disputa', 'engajado'] as const

type ResolvedScope = AIToolResolvedScope

type PendingLeadershipDoc = {
  id: number
  contact: number | string | null
  municipalities: Array<number | string> | null
  supportStatus: string
  advisors: Array<number | string> | null
  updatedAt: string | null
}

/**
 * B185 — "quais lideranças ainda precisam ser abordadas" por território,
 * cidade (Salvador = 19 ZE) ou município, com critério declarado e assessores
 * responsáveis à vista. Staff-only (leader lockdown fail-closed, mesmo shape
 * do gate eleitoral); leituras com `overrideAccess: false, user: ctx.user`
 * (assessor = portfólio). Sem migration/Consent; nomes resolvidos em queries
 * manuais (nunca `depth` populando `campaignUser`).
 */
export const getPendingLeaderships = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns campaign leaderships still pending approach within a scope (territory, city or municipality), ' +
      'or the municipalities without any linked leadership. ' +
      'Use when the user asks "Quais lideranças ainda precisamos abordar em X?", ' +
      '"Quais lideranças estão sem assessor responsável?" or "Quais municípios não têm liderança cadastrada?". ' +
      'The pending criterion is always declared in the response; combine the ids/slugs with buildCampaignLinks.',
    inputSchema: z.object({
      scope: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          'Território de identidade, cidade ou município (ex.: "Vale do Jiquiriça", "Salvador", "Feira de Santana"). Omita para usar o escopo de acesso do usuário.',
        ),
      filter: z
        .enum(['sem_assessor'])
        .optional()
        .describe('Restringe a lista de lideranças às que não têm assessor responsável.'),
      mode: z
        .enum(['liderancas', 'municipios_sem_lideranca'])
        .optional()
        .default('liderancas')
        .describe(
          '"liderancas" lista as pendentes de abordagem; "municipios_sem_lideranca" lista os municípios do escopo sem nenhuma liderança vinculada.',
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(20)
        .describe('Máximo de resultados (default 20, max 50).'),
    }),
    execute: async ({ scope, filter, mode, limit }) => {
      if (!isStaffCampaignRole(ctx.user.role)) return { error: DENIED_MESSAGE }

      const resolved = await resolveAIToolScope(ctx, scope)
      if ('error' in resolved) return resolved

      if (mode === 'municipios_sem_lideranca') {
        if (filter) {
          return { error: 'O filtro "sem assessor" só se aplica à lista de lideranças.' }
        }
        return listMunicipalitiesWithoutLeadership(ctx, resolved, limit)
      }

      return listPendingLeaderships(ctx, resolved, filter === 'sem_assessor', limit)
    },
  })

const listPendingLeaderships = async (
  ctx: AIToolContext,
  scope: ResolvedScope,
  semAssessor: boolean,
  limit: number,
) => {
  const { payload } = ctx

  const andClauses: Where[] = [{ supportStatus: { in: [...PENDING_SUPPORT_STATUSES] } }]
  if (scope.municipalityIDs) andClauses.push({ municipalities: { in: scope.municipalityIDs } })
  if (semAssessor) andClauses.push({ advisors: { exists: false } })
  const where: Where = { and: andClauses }

  const leaderships = await payload.find({
    collection: 'leadership',
    where,
    depth: 0,
    limit: 0,
    pagination: false,
    select: {
      id: true,
      contact: true,
      municipalities: true,
      supportStatus: true,
      advisors: true,
      updatedAt: true,
    },
    sort: '-updatedAt',
    overrideAccess: false,
    user: ctx.user,
  })

  const docs = leaderships.docs as unknown as PendingLeadershipDoc[]

  // Only engaged leaderships consult the pledge axis — a_abordar/em_disputa
  // are pending regardless, so their pledges are never fetched.
  const engagedIDs = docs.filter((doc) => doc.supportStatus === 'engajado').map((doc) => doc.id)

  const pledgedLeadershipIDs = new Set<number>()
  if (engagedIDs.length > 0) {
    const pledgeAndClauses: Where[] = [{ leadership: { in: engagedIDs } }]
    if (scope.municipalityIDs) {
      pledgeAndClauses.push({ municipality: { in: scope.municipalityIDs } })
    }
    const pledges = await payload.find({
      collection: 'votePledge',
      where: { and: pledgeAndClauses },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { leadership: true },
      overrideAccess: false,
      user: ctx.user,
    })
    for (const pledge of pledges.docs) {
      const id = relationshipId(pledge.leadership)
      if (id !== null) pledgedLeadershipIDs.add(id)
    }
  }

  const pending = docs.filter((doc) => {
    if (doc.supportStatus === 'a_abordar' || doc.supportStatus === 'em_disputa') return true
    if (doc.supportStatus === 'engajado') return !pledgedLeadershipIDs.has(doc.id)
    return false
  })

  const total = pending.length
  const top = pending.slice(0, limit)

  const contactIDs = uniqueRelationshipIds(top.flatMap((doc) => [doc.contact]))
  const municipalityIDs = uniqueRelationshipIds(top.flatMap((doc) => doc.municipalities ?? []))
  const advisorIDs = uniqueRelationshipIds(top.flatMap((doc) => doc.advisors ?? []))

  const [contactNames, municipalityNames, advisorNames] = await Promise.all([
    loadNamesByIds(ctx, 'contact', contactIDs),
    loadMunicipalityNamesByIds(ctx, municipalityIDs),
    loadNamesByIds(ctx, 'campaignUser', advisorIDs),
  ])

  const liderancas = top.map((doc) => {
    const contactID = relationshipId(doc.contact)
    // Unresolved names mean out-of-access links (advisor portfolio): the chip
    // is dropped instead of leaking a bare id — same policy as the UI.
    const municipios = uniqueRelationshipIds(doc.municipalities)
      .map((id) => ({
        id,
        nome: municipalityNames.get(id)?.name ?? null,
        slug: municipalityNames.get(id)?.slug ?? null,
      }))
      .filter((m) => m.nome !== null)
    const assessores = uniqueRelationshipIds(doc.advisors).map((id) => ({
      id,
      nome: advisorNames.get(id) ?? null,
    }))
    return {
      id: doc.id,
      nome: contactNames.get(contactID ?? -1) ?? 'Sem nome',
      municipios,
      status:
        supportStatusLabels[doc.supportStatus as keyof typeof supportStatusLabels] ??
        doc.supportStatus,
      assessores,
      ultimaAtualizacao: doc.updatedAt ?? null,
    }
  })

  const truncado = total > top.length

  return {
    escopo: { tipo: scope.kind, nome: scope.name },
    escopoRestrito: ctx.user.role === 'advisor',
    criterio: PENDING_CRITERION,
    filtroAplicado: { semAssessor: semAssessor },
    total,
    liderancas,
    truncado,
    ...(truncado ? { dica: NARROW_SCOPE_HINT } : {}),
  }
}

const listMunicipalitiesWithoutLeadership = async (
  ctx: AIToolContext,
  scope: ResolvedScope,
  limit: number,
) => {
  const { payload } = ctx

  let scopeDocs = scope.municipalities
  if (scope.municipalityIDs === null) {
    const result = await payload.find({
      collection: 'municipality',
      where: {},
      depth: 0,
      limit: 0,
      pagination: false,
      select: { id: true, name: true, slug: true, city: true, region: true },
      overrideAccess: false,
      user: ctx.user,
    })
    scopeDocs = result.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      slug: doc.slug,
      city: doc.city ?? null,
      region: doc.region ?? null,
    }))
  }

  const scopeIDs = scopeDocs.map((doc) => doc.id)

  const covered = await payload.find({
    collection: 'leadership',
    where: { municipalities: { in: scopeIDs } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { municipalities: true },
    overrideAccess: false,
    user: ctx.user,
  })

  const coveredIDs = new Set<number>()
  for (const doc of covered.docs) {
    for (const id of uniqueRelationshipIds(doc.municipalities)) {
      coveredIDs.add(id)
    }
  }

  const missing = scopeDocs.filter((doc) => !coveredIDs.has(doc.id))
  const total = missing.length
  const shown = missing.slice(0, limit)
  const truncado = total > shown.length

  return {
    escopo: { tipo: scope.kind, nome: scope.name },
    escopoRestrito: ctx.user.role === 'advisor',
    criterio: EMPTY_MUNICIPALITIES_CRITERION,
    total,
    municipios: shown.map((doc) => ({
      id: doc.id,
      nome: doc.name,
      slug: doc.slug,
      regiao: doc.region,
      cidade: doc.city,
    })),
    truncado,
    ...(truncado ? { dica: NARROW_SCOPE_HINT } : {}),
  }
}

const loadNamesByIds = async (
  ctx: AIToolContext,
  collection: 'contact' | 'campaignUser',
  ids: number[],
): Promise<Map<number, string>> => {
  const names = new Map<number, string>()
  if (ids.length === 0) return names
  const result = await ctx.payload.find({
    collection,
    where: { id: { in: ids } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true },
    overrideAccess: false,
    user: ctx.user,
  })
  for (const doc of result.docs) names.set(doc.id, doc.name)
  return names
}

const loadMunicipalityNamesByIds = async (
  ctx: AIToolContext,
  ids: number[],
): Promise<Map<number, { name: string | null; slug: string | null }>> => {
  const names = new Map<number, { name: string | null; slug: string | null }>()
  if (ids.length === 0) return names
  const result = await ctx.payload.find({
    collection: 'municipality',
    where: { id: { in: ids } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { id: true, name: true, slug: true },
    overrideAccess: false,
    user: ctx.user,
  })
  for (const doc of result.docs) names.set(doc.id, { name: doc.name, slug: doc.slug })
  return names
}
