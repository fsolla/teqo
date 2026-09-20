import 'server-only'

import type { Jingle, Media } from '@/payload-types'

import { toJingleViewModel, type JingleViewModel } from '@/lib/jingle'
import { getCachedDocumentById, isNotFoundError } from '@/utilities/documentReads'
import { getCollectionListingTag } from '@/utilities/documents'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

/**
 * S21 — public reads of the jingles page and of the footer discovery link.
 * The listing is cached by the `jingles` collection listing tag (busted by
 * `revalidateJinglesListing` on Jingle afterChange/afterDelete) and stores
 * depth-0 docs; each cover/audio is resolved through `getCachedDocumentById`,
 * so replacing the FILE in the media doc (Media.afterChange busts
 * `document_media:<id>`) also refreshes the card without editing the jingle.
 */

const findPublishedJingles = () =>
  getPayload({ config: configPromise }).then((payload) =>
    payload.find({
      collection: 'jingle',
      where: { published: { equals: true } },
      sort: ['order', 'title'],
      depth: 0,
      limit: 0,
    }),
  )

const getCachedPublishedJingles = () =>
  unstable_cache(findPublishedJingles, ['jingles'], {
    tags: [getCollectionListingTag('jingle')],
  })

const mediaIdOf = (value: Jingle['coverImage']): number | null =>
  typeof value === 'number' ? value : (value?.id ?? null)

/**
 * A media row deleted while still referenced is blocked by the FK; a direct
 * write that left the id dangling resolves to "no media" and the card fails
 * closed instead of rendering a broken player. Real read failures stay loud.
 */
const readMedia = async (id: number | null): Promise<Media | null> => {
  if (id === null) return null

  try {
    return await getCachedDocumentById('media', id)()
  } catch (error) {
    if (isNotFoundError(error)) return null
    throw error
  }
}

/** Published jingles as serializable view models, missing media skipped. */
export const getPublishedJingleItems = async (): Promise<JingleViewModel[]> => {
  const { docs } = await getCachedPublishedJingles()()

  const items = await Promise.all(
    docs.map(async (jingle) => {
      const [cover, audio] = await Promise.all([
        readMedia(mediaIdOf(jingle.coverImage)),
        readMedia(mediaIdOf(jingle.audio)),
      ])

      return toJingleViewModel({ jingle, cover, audio })
    }),
  )

  return items.filter((item): item is JingleViewModel => item !== null)
}

/**
 * Discovery flag for the footer link: derived from the SAME resolved list the
 * page renders, so a published row that cannot render (dangling media) never
 * advertises a link to an empty page.
 */
export const hasPublishedJingles = async (): Promise<boolean> =>
  (await getPublishedJingleItems()).length > 0
