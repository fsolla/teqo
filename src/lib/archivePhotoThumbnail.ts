/**
 * C248 — pure rules of the stored grade thumbnail of an archive photo: the
 * deterministic sibling filename and the AVIF container/quality of the
 * derivative. No I/O and no `server-only`: the public media route, the
 * generation utility, the collection hook and the backfill CLI share this
 * module, so the naming and the quality live in one place.
 *
 * The derivative is a SIBLING object of the stored original, never a second
 * row: the original keeps its deterministic key (`flickr-<id>.<ext>`) and the
 * grade is discovered by the exact derived key (`flickr-<id>-grade.avif`).
 * Nothing is ever listed to find it, so a miss can only mean "not generated
 * yet" — the route falls back on the fly and heals.
 */

/** AVIF at q60 — the repo ruler for web assets (`scripts/lib/imageResize.mjs`). */
export const ARCHIVE_PHOTO_GRADE_QUALITY = 60

/** The stored grade is AVIF; `image/avif` is already inline-safe in the contract. */
export const ARCHIVE_PHOTO_GRADE_MIME_TYPE = 'image/avif'

/** The single extension of the derived object. */
export const ARCHIVE_PHOTO_GRADE_EXTENSION = '.avif'

/**
 * `flickr-123.jpg` → `flickr-123-grade.avif`: the suffix goes BEFORE the
 * extension of the original and a name with no usable extension keeps the
 * whole name as the base. Deterministic and collision-free with the original
 * key, so the same photo always resolves to the same derived key.
 */
export const archivePhotoGradeFilename = (originalFilename: string): string => {
  const name = originalFilename.trim()
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base}-grade${ARCHIVE_PHOTO_GRADE_EXTENSION}`
}
