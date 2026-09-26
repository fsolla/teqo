import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

import {
  buildArchivePhotoAlbumHref,
  type ArchivePhotoAlbumPage,
  type ArchivePhotoAlbumParams,
} from '@/lib/archivePhotoPublicCatalog'

import { ArchivePhotoCard } from './ArchivePhotoCard'
import { ARCHIVE_PHOTO_SECONDARY_BUTTON } from './archivePhotoClasses'

/**
 * C233 — the grid and its pagination (artefato: cenas 01/02/07): 24 per page,
 * 2 columns on mobile and 3 from `sm`; previous/next preserve every facet, the
 * first page never serializes `pagina=1` and the overlay id never travels in a
 * pagination link.
 */
export const ArchivePhotoGrid = ({
  page,
  params,
}: {
  page: ArchivePhotoAlbumPage
  params: ArchivePhotoAlbumParams
}) => {
  const pageHref = (target: number) =>
    buildArchivePhotoAlbumHref({ ...params, foto: null, pagina: target })

  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7">
        {page.items.map((item) => (
          <ArchivePhotoCard key={item.id} item={item} params={params} />
        ))}
      </div>

      {page.pageCount > 1 ? (
        <nav
          aria-label="Paginação das fotos"
          className="mt-9 flex items-center justify-between border-t border-(--campaign-line) pt-5"
        >
          {page.hasPrevious ? (
            <Link href={pageHref(page.page - 1)} className={ARCHIVE_PHOTO_SECONDARY_BUTTON}>
              <ChevronLeft aria-hidden="true" className="size-4" />
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className={`${ARCHIVE_PHOTO_SECONDARY_BUTTON} opacity-55`}>
              <ChevronLeft aria-hidden="true" className="size-4" />
              Anterior
            </span>
          )}

          <span className="text-sm font-bold">
            Página {page.page} de {page.pageCount}
          </span>

          {page.hasNext ? (
            <Link href={pageHref(page.page + 1)} className={ARCHIVE_PHOTO_SECONDARY_BUTTON}>
              Próxima
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : (
            <span aria-disabled="true" className={`${ARCHIVE_PHOTO_SECONDARY_BUTTON} opacity-55`}>
              Próxima
              <ChevronRight aria-hidden="true" className="size-4" />
            </span>
          )}
        </nav>
      ) : null}
    </>
  )
}
