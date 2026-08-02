import type { HomeSearchMunicipalityHit } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_SUGGEST_LIMIT } from '@/lib/homeSearchSuggest'

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
 * B93 + B125 — merge geo prefix, continuity (B93) and server suggestions (B92).
 * Dedup order: geo → last-acted → visited → forgotten. Geo row has no proximity copy.
 */
export const mergeWizardMunicipalitySuggestions = (input: {
  continuity: WizardContinuitySlug[]
  geoSlug?: string | null
  serverHits: HomeSearchMunicipalityHit[]
  hitBySlug: ReadonlyMap<string, HomeSearchMunicipalityHit>
  limit?: number
}): WizardMunicipalityMergedRow[] => {
  const limit = input.limit ?? HOME_SEARCH_SUGGEST_LIMIT
  const merged: WizardMunicipalityMergedRow[] = []
  const seen = new Set<string>()

  const pushHit = (slug: string, continuityReason?: string) => {
    if (seen.has(slug)) return
    const hit = input.hitBySlug.get(slug)
    if (!hit) return
    seen.add(slug)
    merged.push({ hit, continuityReason })
  }

  const geoSlug = input.geoSlug?.trim()
  if (geoSlug) {
    pushHit(geoSlug)
  }

  for (const item of input.continuity) {
    pushHit(item.slug, continuityReasonForSource(item.source))
  }

  for (const hit of input.serverHits) {
    pushHit(hit.slug)
  }

  return merged.slice(0, limit)
}
