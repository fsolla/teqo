import Link from 'next/link'

import { ARCHIVE_PHOTO_ALBUM_PATH } from '@/lib/archivePhotoPublicCatalog'
import type { FaceSearchPhotoView } from '@/lib/faceSearch'

import { ArchivePhotoCardBody } from './ArchivePhotoCard'
import { ARCHIVE_PHOTO_CARD } from './archivePhotoClasses'

/**
 * C234 — one photo of the selfie-search result (artefato: cena 05, variante
 * revisada): the album's own card body (`ArchivePhotoCardBody`) minus the
 * third-party line — the shape of the view model has no `people`, so "Quem
 * aparece" cannot leak back in. The card links to the album's own detail
 * (`/fotos?foto=<id>`), the single owner of the photo overlay.
 */
export const SelfieSearchResultCard = ({ photo }: { photo: FaceSearchPhotoView }) => (
  <article>
    <Link
      href={`${ARCHIVE_PHOTO_ALBUM_PATH}?foto=${photo.id}`}
      className={`${ARCHIVE_PHOTO_CARD} group`}
      data-photo-id={photo.id}
    >
      <ArchivePhotoCardBody item={{ ...photo, peopleLabel: null }} />
    </Link>
  </article>
)
