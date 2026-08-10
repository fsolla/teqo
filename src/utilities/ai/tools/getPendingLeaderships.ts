import { tool } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { bahiaIdentityTerritories } from '@/lib/bahiaTerritories'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { resolveMunicipalityName } from '@/lib/municipalityNameAliases'
import { relationshipId } from '@/lib/relationship'
import { salvadorCity } from '@/lib/salvadorCity'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'

const DENIED_MESSAGE = 'Leitura de dados de lideranças negada.'
const PENDING_CRITERION =
  'Status "A abordar" ou "Em disputa"; ou "Engajado" sem compromisso de votos no escopo consultado.'
const EMPTY_MUNICIPALITIES_CRITERION = 'Municípios do escopo sem nenhuma liderança vinculada.'
const PENDING_SUPPORT_STATUSES = ['a_abordar', 'em_disputa', 'engajado'] as const

type ScopeMunicipality = {
  id: number
  name: string
  slug: string
  city: string | null
  region: string | null
}

type ResolvedScope = {
  kind: 'regiao' | 'cidade' | 'municipio' | 'todos'
  name: string | null
  municipalityIDs: number[] | null
  municipalities: ScopeMunicipality[]
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
      escopo: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          'Território de identidade, cidade ou município (ex.: "Vale do Jiquiriça", "Salvador", "Feira de Santana"). Omita para usar o escopo de acesso do usuário.',
        ),
      filtro: z
        .enum(['sem_assessor'])
        .optional()
        .describe('Restringe a lista de lideranças às que não têm assessor responsável.'),
      modo: z
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
    execute: async ({ escopo, filtro, modo, limit }) => {
      if (!isStaffCampaignRole(ctx.user.role)) return { error: DENIED_MESSAGE }

      const scope = await resolveScope(ctx, escopo)
      if ('error' in scope) return scope

      if (modo === 'municipios_sem_lideranca') {
        if (filtro) {
          return { error: 'O filtro "sem assessor" só se aplica à lista de lideranças.' }
        }
        return listMunicipalitiesWithoutLeadership(ctx, scope, limit)
      }

      return listPendingLeaderships(ctx, scope, filtro === 'sem_assessor', limit)
    },
  })

const resolveScope = async (
  ctx: AIToolContext,
  escopo: string | undefined,
): Promise<ResolvedScope | { error: string }> => {
  if (!escopo) {
    return { kind: 'todos', name: null, municipalityIDs: null, municipalities: [] }
  }

  const canonicalMunicipality = resolveMunicipalityName(escopo)
  if (canonicalMunicipality) {
    const result = await ctx.payload.find({
      collection: 'municipality',
      where: { name: { equals: canonicalMunicipality } },
      depth: 0,
      limit: 1,
      pagination: false,
      select: { id: true, name: true, slug: true, city: true, region: true },
      overrideAccess: false,
      user: ctx.user,
    })
    const doc = result.docs[0]
    if (doc) {
      return {
        kind: 'municipio',
        name: doc.name,
        municipalityIDs: [doc.id],
        municipalities: [
          {
            id: doc.id,
            name: doc.name,
            slug: doc.slug,
            city: doc.city ?? null,
            region: doc.region ?? null,
          },
        ],
      }
    }
  }

  if (normalizeSearchPhrase(escopo) === normalizeSearchPhrase(salvadorCity.city)) {
    const result = await ctx.payload.find({
      collection: 'municipality',
      where: { city: { equals: salvadorCity.city } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { id: true, name: true, slug: true, city: true, region: true },
      overrideAccess: false,
      user: ctx.user,
    })
    const municipalities = result.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      slug: doc.slug,
      city: doc.city ?? null,
      region: doc.region ?? null,
    }))
    if (municipalities.length === 0) {
      return { error: `Nenhuma zona eleitoral encontrada para "${escopo}".` }
    }
    return {
      kind: 'cidade',
      name: salvadorCity.name,
      municipalityIDs: municipalities.map((m) => m.id),
      municipalities,
    }
  }

  const territory = bahiaIdentityTerritories.find(
    (name) => normalizeSearchPhrase(name) === normalizeSearchPhrase(escopo),
  )
  if (territory) {
    const result = await ctx.payload.find({
      collection: 'municipality',
      where: { region: { equals: territory } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { id: true, name: true, slug: true, city: true, region: true },
      overrideAccess: false,
      user: ctx.user,
    })
    const municipalities = result.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      slug: doc.slug,
      city: doc.city ?? null,
      region: doc.region ?? null,
    }))
    if (municipalities.length === 0) {
      return { error: `Nenhum município encontrado no território "${territory}".` }
    }
    return {
      kind: 'regiao',
      name: territory,
      municipalityIDs: municipalities.map((m) => m.id),
      municipalities,
    }
  }

  return {
    error: `Escopo não reconhecido: "${escopo}". Use um município, "Salvador" ou um território de identidade da Bahia.`,
  }
}

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

  const docs = leaderships.docs as unknown as Array<{
    id: number
    contact: number | string | null
    municipalities: Array<number | string> | null
    supportStatus: string
    advisors: Array<number | string> | null
    updatedAt: string | null
  }>

  const leadershipIDs = docs.map((doc) => doc.id)

  const pledgeAndClauses: Where[] = [{ leadership: { in: leadershipIDs } }]
  if (scope.municipalityIDs) {
    pledgeAndClauses.push({ municipality: { in: scope.municipalityIDs } })
  }
  const pledgedLeadershipIDs = new Set<number>()
  if (leadershipIDs.length > 0) {
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

  const contactIDs = uniqueIDs(top.flatMap((doc) => [doc.contact]))
  const municipalityIDs = uniqueIDs(top.flatMap((doc) => doc.municipalities ?? []))
  const advisorIDs = uniqueIDs(top.flatMap((doc) => doc.advisors ?? []))

  const [contactNames, municipalityNames, advisorNames] = await Promise.all([
    loadNamesByIds(ctx, 'contact', contactIDs),
    loadMunicipalityNamesByIds(ctx, municipalityIDs),
    loadNamesByIds(ctx, 'campaignUser', advisorIDs),
  ])

  const liderancas = top.map((doc) => {
    const contactID = relationshipId(doc.contact)
    const municipalities = (doc.municipalities ?? [])
      .map(relationshipId)
      .filter((id): id is number => id !== null)
    const advisors = (doc.advisors ?? [])
      .map(relationshipId)
      .filter((id): id is number => id !== null)
    return {
      id: doc.id,
      nome: contactNames.get(contactID ?? -1) ?? 'Sem nome',
      municipios: municipalities.map((id) => ({
        id,
        nome: municipalityNames.get(id)?.name ?? null,
        slug: municipalityNames.get(id)?.slug ?? null,
      })),
      status:
        supportStatusLabels[doc.supportStatus as keyof typeof supportStatusLabels] ??
        doc.supportStatus,
      assessores: advisors.map((id) => ({ id, nome: advisorNames.get(id) ?? null })),
      ultimaAtualizacao: doc.updatedAt ?? null,
    }
  })

  return {
    escopo: { tipo: scope.kind, nome: scope.name },
    criterio: PENDING_CRITERION,
    filtroAplicado: { semAssessor: semAssessor },
    total,
    liderancas,
    truncado: total > top.length,
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
    for (const id of (Array.isArray(doc.municipalities) ? doc.municipalities : []).map(
      relationshipId,
    )) {
      if (id !== null) coveredIDs.add(id)
    }
  }

  const missing = scopeDocs.filter((doc) => !coveredIDs.has(doc.id))
  const total = missing.length
  const shown = missing.slice(0, limit)

  return {
    escopo: { tipo: scope.kind, nome: scope.name },
    criterio: EMPTY_MUNICIPALITIES_CRITERION,
    total,
    municipios: shown.map((doc) => ({
      id: doc.id,
      nome: doc.name,
      slug: doc.slug,
      regiao: doc.region,
      cidade: doc.city,
    })),
    truncado: total > shown.length,
  }
}

const uniqueIDs = (values: Array<number | string | null>): number[] => {
  const ids: number[] = []
  for (const value of values) {
    const id = relationshipId(value)
    if (id !== null && !ids.includes(id)) ids.push(id)
  }
  return ids
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
