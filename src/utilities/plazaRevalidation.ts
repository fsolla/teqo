import { revalidatePath } from 'next/cache'

export type PlazaListRevalidateScope = 'list' | 'detail' | 'both'

const plazaSlugPathPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type RevalidatePlazaListPathsOptions = {
  slug?: string
  scope?: PlazaListRevalidateScope
}

export const revalidatePlazaListPaths = ({
  slug,
  scope = 'both',
}: RevalidatePlazaListPathsOptions = {}) => {
  const detailSlug = slug && plazaSlugPathPattern.test(slug) ? slug : undefined

  if (scope === 'list' || scope === 'both') {
    revalidatePath('/campanha/pracas', 'page')
  }

  if (scope === 'detail' || scope === 'both') {
    if (detailSlug) {
      revalidatePath(`/campanha/pracas/${detailSlug}`, 'page')
      return
    }

    revalidatePath('/campanha/pracas/[slug]', 'page')
  }
}
