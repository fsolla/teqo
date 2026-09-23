import { SearchIcon } from 'lucide-react'
import Link from 'next/link'

import {
  CONTENT_PIECE_CATALOG_PATH,
  type ContentPieceCatalogActiveFilter,
} from '@/lib/contentPieceCatalog'

import { CONTENT_PIECE_PRIMARY_BUTTON } from './contentPieceClasses'

/**
 * S27 — the honest states of the Central (artefato: cena 05/06). Zero
 * published pieces keeps the page 200 with no discovery; an active filter that
 * matches nothing shows the query, the filters in force and the one way out.
 */

export const ContentPieceEmptyState = () => (
  <section className="bg-(--campaign-cream) px-5 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-lg rounded-xl bg-white p-8 text-center shadow-[0_22px_60px_rgb(39_25_22/13%)]">
      <h1 className="border-0 pb-0 font-[family-name:var(--font-exo2)] text-xl font-black">
        As primeiras peças estão a caminho
      </h1>
      <p className="mt-2 text-sm leading-6 text-(--campaign-muted)">
        Enquanto isso, faça seu card e peça voto pra Solla 1313.
      </p>
      <Link href="/cards" className={`${CONTENT_PIECE_PRIMARY_BUTTON} mt-5`}>
        Fazer meu card
      </Link>
    </div>
  </section>
)

export const ContentPieceNoResults = ({
  activeFilters,
}: {
  activeFilters: readonly ContentPieceCatalogActiveFilter[]
}) => (
  <section className="rounded-2xl border border-[#184e92]/15 bg-[#f9faff] px-5 py-10 text-center sm:px-8 sm:py-14">
    <div
      aria-hidden="true"
      className="mx-auto grid size-11 place-items-center rounded-full border border-[#184e92]/20 bg-white text-[#184e92] sm:size-12"
    >
      <SearchIcon className="size-5 sm:size-6" />
    </div>
    <h2 className="mt-4 border-0 pb-0 font-[family-name:var(--font-exo2)] text-xl font-black sm:text-2xl">
      Nenhuma peça com esses filtros
    </h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-(--campaign-muted)">
      Tente outro termo ou limpe os filtros para ver todas as peças.
    </p>
    {activeFilters.length > 0 ? (
      <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[11px] text-(--campaign-muted) sm:text-xs">
        {activeFilters.map((filter) => (
          <span
            key={filter.facet}
            className="rounded-full border border-black/10 bg-white px-2.5 py-1 sm:px-3 sm:py-1.5"
          >
            {filter.facet === 'q' ? `Busca: “${filter.value}”` : filter.value}
          </span>
        ))}
      </div>
    ) : null}
    <Link
      href={CONTENT_PIECE_CATALOG_PATH}
      className={`${CONTENT_PIECE_PRIMARY_BUTTON} mt-6 sm:min-w-40`}
    >
      Limpar filtros
    </Link>
  </section>
)
