import 'server-only'

import { revalidatePath } from 'next/cache'

// The cache tag moved to `municipalityCatalogCache.ts` (P3-E) — import it from
// there; this module owns only the revalidatePath side.

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
      // B147 parallel v2 surface — same municipality, singular path.
      revalidatePath(`/campanha/municipio/${detailSlug}/v2`, 'page')
      return
    }

    revalidatePath('/campanha/municipios/[slug]', 'page')
    revalidatePath('/campanha/municipio/[slug]/v2', 'page')
  }
}
