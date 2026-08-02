import type { HomeSearchMunicipalityHit } from '@/lib/campaignHomeSearchHits'

/**
 * B117 / B125 — prefix the nearest in-scope município on suggest, deduping the server list.
 * The hit uses the normal suggest shape — no geo reason or distance metadata.
 */
export const mergeHomeSearchNearestMunicipality = (input: {
  nearestSlug: string | null | undefined
  serverHits: readonly HomeSearchMunicipalityHit[]
  hitBySlug: ReadonlyMap<string, HomeSearchMunicipalityHit>
}): HomeSearchMunicipalityHit[] => {
  const slug = input.nearestSlug?.trim()
  if (!slug) return [...input.serverHits]

  const nearestHit = input.hitBySlug.get(slug)
  if (!nearestHit) return [...input.serverHits]

  const withoutDup = input.serverHits.filter((hit) => hit.slug !== slug)
  return [nearestHit, ...withoutDup]
}
