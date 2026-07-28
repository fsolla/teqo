import { revalidatePath } from 'next/cache'

/**
 * Cache tag for `unstable_cache` entries derived from the município catalog's
 * system fields (name / slug / region), which are `readOnly` in admin and
 * writable only by `canSetCampaignSystemField` — i.e. by a migration or seed.
 * The runbook mirrors `election-tse`: after a migration that adds or renames a
 * município, `POST /api/revalidate?tag=municipality-catalog` (allowlist in
 * revalidateRequest.ts).
 */
export const MUNICIPALITY_CATALOG_CACHE_TAG = 'municipality-catalog'

type MunicipalityListRevalidateScope = 'list' | 'detail' | 'both'

const municipalitySlugPathPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type RevalidateMunicipalityListPathsOptions = {
  slug?: string
  scope?: MunicipalityListRevalidateScope
}

export const revalidateMunicipalityListPaths = ({
  slug,
  scope = 'both',
}: RevalidateMunicipalityListPathsOptions = {}) => {
  const detailSlug = slug && municipalitySlugPathPattern.test(slug) ? slug : undefined

  if (scope === 'list' || scope === 'both') {
    revalidatePath('/campanha/municipios', 'page')
  }

  if (scope === 'detail' || scope === 'both') {
    if (detailSlug) {
      revalidatePath(`/campanha/municipios/${detailSlug}`, 'page')
      return
    }

    revalidatePath('/campanha/municipios/[slug]', 'page')
  }
}
