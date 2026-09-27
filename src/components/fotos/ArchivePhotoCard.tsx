import Link from 'next/link'

import {
  ARCHIVE_PHOTO_THUMB_WIDTH,
  buildArchivePhotoAlbumHref,
  type ArchivePhotoAlbumParams,
  type ArchivePhotoPublicItem,
} from '@/lib/archivePhotoPublicCatalog'

import { ARCHIVE_PHOTO_CARD } from './archivePhotoClasses'

/**
 * C233 — the card body every photo grid shares (album and, without the
 * third-party line, the C234 selfie-search result): image through the
 * same-origin private proxy, curated title, meta line and the optional
 * "Quem aparece". The caller owns the link/href contract.
 */
export const ArchivePhotoCardBody = ({
  item,
}: {
  item: Pick<
    ArchivePhotoPublicItem,
    'alt' | 'title' | 'metaLabel' | 'peopleLabel' | 'thumbnailPath'
  >
}) => (
  <>
    {/* eslint-disable-next-line @next/next/no-img-element -- private proxy path with on-demand headers */}
    <img
      src={item.thumbnailPath}
      alt={item.alt}
      loading="lazy"
      decoding="async"
      // The CSS box owns the ratio (square on mobile, 4:3 from `sm`); the
      // attributes are the intrinsic hint for the pre-JS layout.
      width={ARCHIVE_PHOTO_THUMB_WIDTH}
      height={Math.round(ARCHIVE_PHOTO_THUMB_WIDTH * 0.75)}
      className="aspect-square w-full rounded-lg object-cover transition-[transform,box-shadow] duration-150 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_28px_rgb(32_27_26/16%)] motion-reduce:transition-none sm:aspect-[4/3] sm:rounded-xl"
    />
    <div className="pt-3">
      <p className="font-[family-name:var(--font-exo2)] text-sm font-black text-balance sm:text-base">
        {item.title}
      </p>
      {item.metaLabel ? (
        <p className="mt-1 text-xs leading-4 text-(--campaign-muted) sm:text-sm sm:leading-5">
          {item.metaLabel}
        </p>
      ) : null}
      {item.peopleLabel ? (
        <p className="mt-1 text-xs leading-4 sm:text-sm sm:leading-5">{item.peopleLabel}</p>
      ) : null}
    </div>
  </>
)

/**
 * C233 — one photo of the grid (artefato: cenas 01/02/07): the whole card is a
 * single link to the same filtered URL plus `?foto=<id>`, one tab stop, yellow
 * focus ring; image `alt` is the curated alt (the file description), never the
 * filename. The grid serves the resized thumbnail through the same-origin
 * private proxy, lazy and async.
 */
export const ArchivePhotoCard = ({
  item,
  params,
}: {
  item: ArchivePhotoPublicItem
  params: ArchivePhotoAlbumParams
}) => (
  <article>
    <Link
      href={buildArchivePhotoAlbumHref({ ...params, foto: item.id })}
      className={`${ARCHIVE_PHOTO_CARD} group`}
      data-photo-id={item.id}
    >
      <ArchivePhotoCardBody item={item} />
    </Link>
  </article>
)
