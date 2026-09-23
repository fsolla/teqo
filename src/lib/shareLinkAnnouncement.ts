import { formatBahiaEventDateLabel } from '@/lib/campaignTime'

/**
 * S29 — pure view model of the public announcement page. The server read
 * resolves the OG image and hands the client a serializable shape; the labels
 * (Bahia date, trimmed location) are computed here, client-safe, with no
 * Payload import.
 */

type ShareLinkAnnouncementMedia = {
  alt?: string | null
}

export type ShareLinkAnnouncementSource = {
  slug: string
  title: string
  description: string
  image?: ShareLinkAnnouncementMedia | number | null
  startsAt?: string | null
  endsAt?: string | null
  location?: string | null
}

export type ShareLinkAnnouncementView = {
  slug: string
  title: string
  description: string
  imageUrl: string | null
  imageAlt: string
  eventLabel: string | null
  location: string | null
  startsAt: string | null
  endsAt: string | null
}

const isMedia = (
  value: ShareLinkAnnouncementSource['image'],
): value is ShareLinkAnnouncementMedia => typeof value === 'object' && value !== null

export const buildShareLinkAnnouncementView = ({
  link,
  imageUrl,
}: {
  link: ShareLinkAnnouncementSource
  imageUrl: string | null
}): ShareLinkAnnouncementView => {
  const mediaAlt = isMedia(link.image) ? link.image.alt?.trim() : null
  const location = link.location?.trim()

  return {
    slug: link.slug,
    title: link.title,
    description: link.description,
    imageUrl,
    imageAlt: mediaAlt || link.title,
    eventLabel: link.startsAt ? formatBahiaEventDateLabel(link.startsAt) || null : null,
    location: location || null,
    startsAt: link.startsAt ?? null,
    endsAt: link.endsAt ?? null,
  }
}
