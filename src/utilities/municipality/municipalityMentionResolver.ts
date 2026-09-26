import 'server-only'

import type { Payload } from 'payload'

import { matchMunicipalityMentions } from '@/lib/speechGazetteer'

/**
 * C232 — the shared, conservative município resolution from free text: the
 * gazetteer mentions are reduced to distinct cities and only a city with
 * exactly ONE catalogue entry resolves. Salvador has one entry per TSE zone,
 * so a bare "Salvador" mention is ambiguous and stays empty — the ficha picks
 * the zone. Extracted from the content-piece cataloguing (C211) so the photo
 * cataloguing (C232) uses the same rule instead of a twin.
 */
export const resolveMentionedMunicipalityId = async ({
  payload,
  text,
}: {
  payload: Payload
  text: string
}): Promise<number | null> => {
  const mentions = matchMunicipalityMentions(text)
  const cities = new Set(mentions.map((entry) => entry.city))
  if (cities.size !== 1) return null
  const entries = mentions.filter((entry) => entry.city === [...cities][0])
  if (entries.length !== 1) return null

  const found = await payload.find({
    collection: 'municipality',
    where: { slug: { equals: entries[0]!.slug } },
    depth: 0,
    limit: 1,
    pagination: false,
    // Intentional admin bypass: the município catalog is read-only geography.
    overrideAccess: true,
  })
  return found.docs[0]?.id ?? null
}
