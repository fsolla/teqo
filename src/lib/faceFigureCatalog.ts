/**
 * C244 — pure contract of the curated public-figure layer over the anonymous
 * face index of C242. A `faceFigure` row carries the curated reference
 * descriptors of a named public figure; this module compares those references
 * against the indexed descriptors of the approved archive and answers WHICH
 * photos show each figure — never a distance, a score or a percentage, not even
 * internally exposed (the caller only receives photo ids and identity).
 *
 * Only an explicitly active figure with at least one reference of the current
 * model participates; a malformed or foreign-model reference is ignored
 * (fail-closed). No I/O and no `server-only`: the cached read and the unit
 * tests share this module.
 */
import {
  FACE_SEARCH_MODEL,
  findFaceDescriptorPhotoIds,
  readFaceVector,
  type FaceDescriptorEntry,
} from '@/lib/faceSearch'

/** One curated reference portrait of a figure (vector + the model that made it). */
type FaceFigureReference = {
  model?: string | null
  vector?: unknown
}

/** The slice of a `faceFigure` row this contract needs. */
export type FaceFigure = {
  slug: string
  name: string
  active?: boolean | null
  references?: readonly FaceFigureReference[] | null
}

/** The public identity of a matched figure; no numeric field by shape. */
type FaceFigurePerson = {
  slug: string
  name: string
}

/** One figure with the distinct photo ids it was recognized in, in index order. */
export type FaceFigureMatch = FaceFigurePerson & {
  photoIds: number[]
}

/** One photo with the figures recognized in it (the album's "Quem aparece"). */
export type PhotoFigureMatch = {
  photoId: number
  figures: FaceFigurePerson[]
}

/**
 * Every active figure with at least one photo under the shared C242 threshold;
 * a figure only participates when `active === true` (an absent flag never
 * names anyone) and only current-model references count. Photos are deduped per
 * figure (a group photo with several faces of the same person is one match).
 */
export const findFaceFigureMatches = ({
  figures,
  descriptors,
}: {
  figures: readonly FaceFigure[]
  descriptors: readonly FaceDescriptorEntry[]
}): FaceFigureMatch[] => {
  const matches: FaceFigureMatch[] = []

  for (const figure of [...figures].sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (figure.active !== true) continue

    const photoIds = new Set<number>()
    for (const reference of figure.references ?? []) {
      if (reference.model !== FACE_SEARCH_MODEL) continue
      const vector = readFaceVector(reference.vector)
      if (!vector) continue
      for (const photoId of findFaceDescriptorPhotoIds(vector, descriptors)) {
        photoIds.add(photoId)
      }
    }

    if (photoIds.size > 0) {
      matches.push({ slug: figure.slug, name: figure.name, photoIds: [...photoIds] })
    }
  }

  return matches
}

/**
 * Pivots the per-figure matches into the per-photo map the album read merges
 * into each item: photos in id order, figures in slug order. Pure and
 * serializable (`unstable_cache` stores its result).
 */
export const groupFaceFigureMatchesByPhoto = (
  matches: readonly FaceFigureMatch[],
): PhotoFigureMatch[] => {
  const byPhoto = new Map<number, Map<string, FaceFigurePerson>>()

  for (const match of matches) {
    for (const photoId of match.photoIds) {
      let figures = byPhoto.get(photoId)
      if (!figures) {
        figures = new Map()
        byPhoto.set(photoId, figures)
      }
      if (!figures.has(match.slug)) figures.set(match.slug, { slug: match.slug, name: match.name })
    }
  }

  return [...byPhoto.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([photoId, figures]) => ({
      photoId,
      figures: [...figures.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
    }))
}
