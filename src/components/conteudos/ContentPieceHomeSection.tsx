import { contentPieceCatalogFacets, type ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import { toContentPieceHomeItem } from '@/lib/contentPieceHomeSelection'

import { ContentPieceHomeBoard } from './ContentPieceHomeBoard'

/**
 * S39 — the home section advertising the Central de Conteúdos (artefato: cenas
 * 01–06). The page resolves the cached listing once and only renders this when
 * something is published (fail-closed, same kill switch as the footer link);
 * the lean projection keeps the search haystack out of the static HTML.
 *
 * S42 — the explore row's facets are derived here, before the projection, from
 * the same catalogue owner the catalogue page uses (the lean item keeps only
 * what the card renders).
 */
export const ContentPieceHomeSection = ({
  items,
}: {
  items: readonly ContentPiecePublicItem[]
}) => {
  const facets = contentPieceCatalogFacets(items)

  return (
    <section
      aria-labelledby="content-pieces-title"
      data-home-section="content-pieces"
      className="relative overflow-hidden border-b border-(--campaign-line) bg-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-(--pt-yellow)/35"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-24 size-64 rounded-full bg-[#e4102f]/8"
      />
      <div className="relative mx-auto w-full max-w-[1160px] px-5 py-10 sm:px-8 lg:px-10 lg:py-16">
        <ContentPieceHomeBoard
          items={items.map(toContentPieceHomeItem)}
          // Only the row's three facets cross to the client island; the other
          // option lists (tema/instituição/liderança) stay on the server.
          facets={{ tipo: facets.tipo, cidade: facets.cidade, regiao: facets.regiao }}
        />
      </div>
    </section>
  )
}
