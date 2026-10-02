import { ImageIcon, SearchIcon } from 'lucide-react'
import Link from 'next/link'

import {
  ARCHIVE_PHOTO_ALBUM_PATH,
  type ArchivePhotoAlbumActiveFilter,
} from '@/lib/archivePhotoPublicCatalog'

import { ARCHIVE_PHOTO_PRIMARY_BUTTON } from './archivePhotoClasses'

/**
 * C233 — the two honest empty states (artefato: cena 04):
 * (A) the album has no approved photo yet — the page exists and explains it,
 * never a 404 and never a fake sample; (B) the combination returned nothing —
 * the query and the filters in force, with the one way out.
 */
export const ArchivePhotoEmptyState = () => (
  <section className="rounded-2xl border border-(--campaign-line) bg-(--campaign-cream) px-6 py-14 text-center">
    <div className="mx-auto grid size-12 place-items-center rounded-full border border-(--campaign-line) bg-white text-(--campaign-muted)">
      <ImageIcon aria-hidden="true" className="size-6" strokeWidth={2} />
    </div>
    <h2 className="mt-4 font-[family-name:var(--font-exo2)] text-2xl font-black">
      O álbum ainda está sendo preparado
    </h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-(--campaign-muted)">
      Ainda não há fotos aprovadas para publicação. Quando houver registros disponíveis, eles
      aparecerão aqui.
    </p>
  </section>
)

export const ArchivePhotoNoResults = ({
  activeFilters,
}: {
  activeFilters: readonly ArchivePhotoAlbumActiveFilter[]
}) => {
  // C244 — the pessoa facet only names curated public figures recognized by the
  // facial layer: the empty state explains that origin instead of promising
  // "all photos of a name".
  const hasPersonFilter = activeFilters.some((filter) => filter.facet === 'pessoa')

  return (
    <section
      data-album-no-results
      className="rounded-2xl border border-[#184e92]/15 bg-[#f9faff] px-5 py-10 text-center sm:px-8 sm:py-14"
    >
      <div
        aria-hidden="true"
        className="mx-auto grid size-11 place-items-center rounded-full border border-[#184e92]/20 bg-white text-[#184e92] sm:size-12"
      >
        <SearchIcon className="size-5 sm:size-6" strokeWidth={2} />
      </div>
      <h2 className="mt-4 font-[family-name:var(--font-exo2)] text-xl font-black sm:text-2xl">
        Nada encontrado com esses filtros
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-(--campaign-muted)">
        {hasPersonFilter
          ? 'O filtro Pessoa pública considera apenas figuras reconhecidas com curadoria no acervo — nunca terceiros. Tente outra pessoa ou volte a ver todas as fotos aprovadas do álbum.'
          : 'Tente outro termo ou volte a ver todas as fotos aprovadas do álbum.'}
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
        href={ARCHIVE_PHOTO_ALBUM_PATH}
        className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} mt-6 sm:min-w-40`}
      >
        Limpar filtros
      </Link>
    </section>
  )
}
