import type { HomeSearchMunicipalityHit } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_SUGGEST_LIMIT } from '@/lib/homeSearchSuggest'
import { formatDistanceKm } from '@/lib/municipalityProximity'

export const WIZARD_GEO_NEARBY_REASON = 'Perto de você' as const

export const WIZARD_CONTINUITY_LAST_ACTED_LABEL = 'Última ação' as const
export const WIZARD_CONTINUITY_VISITED_LABEL = 'Visitado' as const

const WIZARD_CONTINUITY_MAX_VISITED = 3

type WizardContinuitySource = 'last-acted' | 'visited'

export type WizardContinuitySlug = {
  source: WizardContinuitySource
  slug: string
}

export type WizardContinuityVisitInput = {
  href: string
  kind: 'municipality' | 'municipalityList'
}

export type WizardGeoMunicipalitySuggestion = {
  slug: string
  name: string
  distanceKm?: number
}

export type WizardMunicipalityMergedRow = {
  hit: HomeSearchMunicipalityHit
  continuityReason?: string
}

const MUNICIPALITY_DETAIL_HREF_PREFIX = '/campanha/municipios/'

export const municipalitySlugFromRecentVisitHref = (href: string): string | null => {
  if (!href.startsWith(MUNICIPALITY_DETAIL_HREF_PREFIX)) return null
  const slug = href.slice(MUNICIPALITY_DETAIL_HREF_PREFIX.length).split('/')[0]?.trim()
  return slug ? slug : null
}

/** Secondary line for a geo-resolved wizard hit — region first when known. */
export const formatWizardGeoSecondary = (
  region: string | undefined,
  distanceKm?: number,
): string => {
  const reason =
    distanceKm !== undefined
      ? `${WIZARD_GEO_NEARBY_REASON} (~${formatDistanceKm(distanceKm)})`
      : WIZARD_GEO_NEARBY_REASON

  return region ? `${region} · ${reason}` : reason
}

const continuityReasonForSource = (source: WizardContinuitySource): string => {
  switch (source) {
    case 'last-acted':
      return WIZARD_CONTINUITY_LAST_ACTED_LABEL
    case 'visited':
      return WIZARD_CONTINUITY_VISITED_LABEL
    default: {
      const _exhaustive: never = source
      return _exhaustive
    }
  }
}

export const listWizardContinuitySlugs = (input: {
  lastActedSlug: string | null
  recentVisits: WizardContinuityVisitInput[]
  scopeSlugs: ReadonlySet<string>
  maxVisited?: number
}): WizardContinuitySlug[] => {
  const maxVisited = input.maxVisited ?? WIZARD_CONTINUITY_MAX_VISITED
  const continuity: WizardContinuitySlug[] = []
  const seen = new Set<string>()

  const pushSlug = (source: WizardContinuitySource, slug: string) => {
    if (!input.scopeSlugs.has(slug) || seen.has(slug)) return
    seen.add(slug)
    continuity.push({ source, slug })
  }

  if (input.lastActedSlug) {
    pushSlug('last-acted', input.lastActedSlug)
  }

  let visitedCount = 0
  for (const entry of input.recentVisits) {
    if (visitedCount >= maxVisited) break
    if (entry.kind !== 'municipality') continue
    const slug = municipalitySlugFromRecentVisitHref(entry.href)
    if (!slug) continue
    if (seen.has(slug)) continue
    if (!input.scopeSlugs.has(slug)) continue
    seen.add(slug)
    continuity.push({ source: 'visited', slug })
    visitedCount += 1
  }

  return continuity
}

/**
 * B93 + B94 — merge geo (B94), continuity (B93) and server suggestions (B92).
 * Dedup order: geo → last-acted → visited → forgotten.
 */
export const mergeWizardMunicipalitySuggestions = (input: {
  continuity: WizardContinuitySlug[]
  geo?: WizardGeoMunicipalitySuggestion | null
  serverHits: HomeSearchMunicipalityHit[]
  hitBySlug: ReadonlyMap<string, HomeSearchMunicipalityHit>
  limit?: number
}): WizardMunicipalityMergedRow[] => {
  const limit = input.limit ?? HOME_SEARCH_SUGGEST_LIMIT
  const merged: WizardMunicipalityMergedRow[] = []
  const seen = new Set<string>()

  const pushHit = (slug: string, continuityReason?: string, regionOverride?: string) => {
    if (seen.has(slug)) return
    const hit = input.hitBySlug.get(slug)
    if (!hit) return
    seen.add(slug)
    merged.push({
      hit: regionOverride ? { ...hit, region: regionOverride } : hit,
      continuityReason,
    })
  }

  const geoSlug = input.geo?.slug.trim()
  if (geoSlug) {
    const baseHit = input.hitBySlug.get(geoSlug)
    if (baseHit) {
      pushHit(geoSlug, undefined, formatWizardGeoSecondary(baseHit.region, input.geo?.distanceKm))
    }
  }

  for (const item of input.continuity) {
    pushHit(item.slug, continuityReasonForSource(item.source))
  }

  for (const hit of input.serverHits) {
    pushHit(hit.slug)
  }

  return merged.slice(0, limit)
}
