import type { Where } from 'payload'

import type { AIToolContext } from '@/lib/ai/types'
import { bahiaIdentityTerritories } from '@/lib/bahiaTerritories'
import { resolveMunicipalityName } from '@/lib/municipalityNameAliases'
import { salvadorCity } from '@/lib/salvadorCity'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

type ScopeMunicipality = {
  id: number
  name: string
  slug: string
  city: string | null
  region: string | null
}

export type AIToolResolvedScope = {
  kind: 'regiao' | 'cidade' | 'municipio' | 'todos'
  name: string | null
  municipalityIDs: number[] | null
  municipalities: ScopeMunicipality[]
}

/**
 * Shared scope resolution of the campaign intelligence tools (family B185/B189;
 * B186 will be the third consumer): a territory of identity, the virtual city
 * Salvador (19 ZE together) or a municipality. Extracted from B185 so the
 * family never twins the "Salvador first, then municipality, then territory"
 * lookup order.
 */
export const resolveAIToolScope = async (
  ctx: AIToolContext,
  scope: string | undefined,
): Promise<AIToolResolvedScope | { error: string }> => {
  if (!scope) {
    return { kind: 'todos', name: null, municipalityIDs: null, municipalities: [] }
  }

  // Salvador first: the virtual city is a first-class scope (19 ZE juntas) and
  // the catalog has no row literally named "Salvador" — the municipality query
  // would be a guaranteed-miss round trip.
  if (normalizeSearchPhrase(scope) === normalizeSearchPhrase(salvadorCity.city)) {
    const resolved = await resolveScopeMunicipalities(ctx, { city: { equals: salvadorCity.city } })
    return { kind: 'cidade', name: salvadorCity.name, ...resolved }
  }

  const canonicalMunicipality = resolveMunicipalityName(scope)
  if (canonicalMunicipality) {
    const resolved = await resolveScopeMunicipalities(ctx, {
      name: { equals: canonicalMunicipality },
    })
    return { kind: 'municipio', name: canonicalMunicipality, ...resolved }
  }

  const territory = bahiaIdentityTerritories.find(
    (name) => normalizeSearchPhrase(name) === normalizeSearchPhrase(scope),
  )
  if (territory) {
    const resolved = await resolveScopeMunicipalities(ctx, { region: { equals: territory } })
    return { kind: 'regiao', name: territory, ...resolved }
  }

  return {
    error: `Escopo não reconhecido: "${scope}". Use um município, "Salvador" ou um território de identidade da Bahia.`,
  }
}

/**
 * Resolve the requested scope into its municipality set through the actor's
 * own access (an advisor asking outside the portfolio gets the empty scoped
 * set — never an existence lie). The generic error stays reserved for names
 * that match nothing at all.
 */
const resolveScopeMunicipalities = async (
  ctx: AIToolContext,
  where: Where,
): Promise<{ municipalityIDs: number[]; municipalities: ScopeMunicipality[] }> => {
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
