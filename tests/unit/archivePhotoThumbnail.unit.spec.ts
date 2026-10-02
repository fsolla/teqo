// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  ARCHIVE_PHOTO_GRADE_EXTENSION,
  ARCHIVE_PHOTO_GRADE_MIME_TYPE,
  ARCHIVE_PHOTO_GRADE_QUALITY,
  archivePhotoGradeFilename,
} from '@/lib/archivePhotoThumbnail'

// C248 — the pure naming rules of the stored grade: the deterministic sibling
// key the route, the generation utility and the backfill CLI share. The
// extension swap is the whole contract; a collision with the original key or a
// nondeterministic name would silently break the discovery by exact key.

describe('archive photo grade naming (C248)', () => {
  it('derives the sibling key by replacing the original extension', () => {
    expect(archivePhotoGradeFilename('flickr-123.jpg')).toBe('flickr-123-grade.avif')
    expect(archivePhotoGradeFilename('flickr-123.jpeg')).toBe('flickr-123-grade.avif')
    expect(archivePhotoGradeFilename('flickr-123.png')).toBe('flickr-123-grade.avif')
    expect(archivePhotoGradeFilename('flickr-abc_def-9.JPG')).toBe('flickr-abc_def-9-grade.avif')
  })

  it('keeps the whole name as the base when there is no usable extension', () => {
    expect(archivePhotoGradeFilename('flickr-123')).toBe('flickr-123-grade.avif')
    expect(archivePhotoGradeFilename('.hidden')).toBe('.hidden-grade.avif')
    expect(archivePhotoGradeFilename('flickr-1.2.jpg')).toBe('flickr-1.2-grade.avif')
  })

  it('never derives the original key itself', () => {
    const original = 'flickr-999.jpg'
    expect(archivePhotoGradeFilename(original)).not.toBe(original)
  })

  it('pins the AVIF container and the repo quality ruler', () => {
    expect(ARCHIVE_PHOTO_GRADE_MIME_TYPE).toBe('image/avif')
    expect(ARCHIVE_PHOTO_GRADE_EXTENSION).toBe('.avif')
    expect(ARCHIVE_PHOTO_GRADE_QUALITY).toBe(60)
  })
})
