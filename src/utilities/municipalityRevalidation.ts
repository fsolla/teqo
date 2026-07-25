import { revalidatePath } from 'next/cache'

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
