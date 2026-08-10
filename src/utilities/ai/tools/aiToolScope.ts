/**
 * Shared AI-tool scope resolution for the campaign-management tool family
 * (B185 `getPendingLeaderships`, B186 `getMunicipalityPriorities`, B189
 * `getMunicipalitiesWithoutUpdate`, …): a user-spoken scope ("Vale do
 * Jiquiriça", "Salvador", "Feira de Santana") is resolved into its
 * municipality set through the actor's own access. Extracted so the subtle
 * behavior (Salvador-primeiro, aliases canônicos, tolerância a acento) has
 * one owner instead of a copy per tool.
 */
import type { Where } from 'payload'

import type { AIToolContext } from '@/lib/ai/types'
import { bahiaIdentityTerritories } from '@/lib/bahiaTerritories'
import { resolveMunicipalityName } from '@/lib/municipalityNameAliases'
import { salvadorCity } from '@/lib/salvadorCity'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

type AIToolScopeKind = 'regiao' | 'cidade' | 'municipio' | 'todos'

type AIToolScopeMunicipality = {
  id: number
  name: string
  slug: string
  city: string | null
  region: string | null
}

export type AIToolScope = {
  kind: AIToolScopeKind
  name: string | null
  /** `null` = the actor's whole scope (access control narrows the queries). */
  municipalityIDs: number[] | null
  municipalities: AIToolScopeMunicipality[]
}

/**
 * Resolve the requested scope into its municipality set through the actor's
 * own access (an advisor asking outside the portfolio gets the empty scoped
 * set — never an existence lie). The generic error stays reserved for names
 * that match nothing at all.
 */
export const resolveAIToolScope = async (
  ctx: AIToolContext,
  scope: string | undefined,
): Promise<AIToolScope | { error: string }> => {
  if (!scope) {
    return { kind: 'todos', name: null, municipalityIDs: null, municipalities: [] }
  }

  // Salvador first: the virtual city is a first-class scope (19 ZE juntas) and
  // the catalog has no row literally named "Salvador" — the municipality query
  // would be a guaranteed-miss round trip.
  if (normalizeSearchPhrase(scope) === normalizeSearchPhrase(salvadorCity.city)) {
    const resolved = await resolveMunicipalities(ctx, { city: { equals: salvadorCity.city } })
    return { kind: 'cidade', name: salvadorCity.name, ...resolved }
  }

  const canonicalMunicipality = resolveMunicipalityName(scope)
  if (canonicalMunicipality) {
    const resolved = await resolveMunicipalities(ctx, { name: { equals: canonicalMunicipality } })
    return { kind: 'municipio', name: canonicalMunicipality, ...resolved }
  }

  const territory = bahiaIdentityTerritories.find(
    (name) => normalizeSearchPhrase(name) === normalizeSearchPhrase(scope),
  )
  if (territory) {
    const resolved = await resolveMunicipalities(ctx, { region: { equals: territory } })
    return { kind: 'regiao', name: territory, ...resolved }
  }

  return {
    error: `Escopo não reconhecido: "${scope}". Use um município, "Salvador" ou um território de identidade da Bahia.`,
  }
}

const resolveMunicipalities = async (
  ctx: AIToolContext,
  where: Where,
): Promise<{ municipalityIDs: number[]; municipalities: AIToolScopeMunicipality[] }> => {
  const result = await ctx.payload.find({
    collection: 'municipality',
    where,
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
  return { municipalityIDs: municipalities.map((m) => m.id), municipalities }
}
