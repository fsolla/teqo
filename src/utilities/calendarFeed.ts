import 'server-only'

import { allDayCivilDateOf, allDayExclusiveEndDate } from '@/lib/activityAllDay'
import type { Activity, CalendarFeed } from '@/payload-types'
import { advisorMunicipalityScopeWhere } from '@/utilities/access/shared'
import type { Payload, Where } from 'payload'

const CALENDAR_NAME = 'Agenda Teqo'
const FEED_LOOKBACK_DAYS = 90
const FEED_LOOKAHEAD_DAYS = 365

const escapeICalText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

const formatICalDate = (isoString: string): string =>
  isoString.replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const buildActivityDescription = (activity: Activity, municipalityName?: string): string => {
  const parts: string[] = []
  if (municipalityName) parts.push(`Município: ${municipalityName}`)
  if (activity.locality) parts.push(`Local: ${activity.locality}`)
  if (activity.tags?.length) parts.push(`Tags: ${activity.tags.join(', ')}`)
  if (activity.deputyPresent) parts.push('Deputado presente')
  if (activity.status === 'cancelado') parts.push('CANCELADO')
  return parts.join('\\n')
}

export const generateICalFeed = (
  activities: Activity[],
  feedLabel: string,
  municipalityNames: Map<number, string>,
): string => {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Teqo//Agenda//PT',
    `X-WR-CALNAME:${escapeICalText(feedLabel || CALENDAR_NAME)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const activity of activities) {
    if (activity.status === 'cancelado') continue
    if (!activity.startAt) continue

    const municipalityId =
      typeof activity.municipality === 'number' ? activity.municipality : activity.municipality?.id
    const municipalityName = municipalityId ? municipalityNames.get(municipalityId) : undefined

    const dtStart = formatICalDate(activity.startAt)
    const dtEnd = activity.endAt ? formatICalDate(activity.endAt) : dtStart

    // C104 — all-day commitments export as date-only values (VALUE=DATE) with
    // the exclusive end (day after the last day), the iCal all-day convention.
    const allDay = Boolean(activity.allDay)
    const dtStartLine = allDay
      ? `DTSTART;VALUE=DATE:${formatICalDate(allDayCivilDateOf(activity.startAt))}`
      : `DTSTART:${dtStart}`
    const dtEndLine = allDay
      ? `DTEND;VALUE=DATE:${formatICalDate(allDayExclusiveEndDate(activity.endAt ?? activity.startAt))}`
      : `DTEND:${activity.endAt ? dtEnd : dtStart}`

    const summary = municipalityName ? `[${municipalityName}] ${activity.title}` : activity.title

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${activity.slug}@teqo.jorgesolla.com.br`)
    lines.push(dtStartLine)
    lines.push(dtEndLine)
    lines.push(`SUMMARY:${escapeICalText(summary)}`)
    lines.push(`DESCRIPTION:${buildActivityDescription(activity, municipalityName)}`)
    lines.push(`DTSTAMP:${formatICalDate(activity.updatedAt || activity.createdAt)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

const buildFeedDateRange = (): { rangeStart: string; rangeEnd: string } => {
  const now = new Date()
  const rangeStart = new Date(now)
  rangeStart.setDate(rangeStart.getDate() - FEED_LOOKBACK_DAYS)
  const rangeEnd = new Date(now)
  rangeEnd.setDate(rangeEnd.getDate() + FEED_LOOKAHEAD_DAYS)

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
  }
}

const buildFeedWhere = (
  feed: CalendarFeed,
  rangeStart: string,
  rangeEnd: string,
  accessibleMunicipalityIds: number[] | null,
): Where => {
  const filters: Where[] = [
    { startAt: { less_than: rangeEnd } },
    {
      or: [
        { endAt: { greater_than: rangeStart } },
        {
          and: [{ endAt: { exists: false } }, { startAt: { greater_than_equal: rangeStart } }],
        },
      ],
    },
    { status: { not_equals: 'cancelado' } },
  ]

  if (feed.filterMunicipality) {
    const municipalityId =
      typeof feed.filterMunicipality === 'number'
        ? feed.filterMunicipality
        : feed.filterMunicipality.id
    filters.push({ municipality: { equals: municipalityId } })
  }
  // Defense in depth (C96): an advisor's feed is intersected with the
  // municipality ids the creator currently administers, so a feed (pinned or
  // not) stops serving a municipality the advisor was removed from. The creator's
  // read scope is re-derived on every request — never trusted from write time.
  // `null` = coordinator/candidate/admin (unrestricted).
  if (accessibleMunicipalityIds) {
    filters.push(advisorMunicipalityScopeWhere('municipality', accessibleMunicipalityIds))
  }

  if (feed.filterDeputyPresent) {
    filters.push({ deputyPresent: { equals: true } })
  }

  if (feed.filterTag) {
    filters.push({ tags: { contains: feed.filterTag } })
  }

  return { and: filters }
}

export const loadFeedActivities = async (
  payload: Payload,
  feed: CalendarFeed,
  accessibleMunicipalityIds: number[] | null,
): Promise<Activity[]> => {
  const { rangeStart, rangeEnd } = buildFeedDateRange()
  const where = buildFeedWhere(feed, rangeStart, rangeEnd, accessibleMunicipalityIds)

  // Intentional admin bypass: access is already enforced at the feed level
  // (creator's municipality scope is applied to the where clause).
  const result = await payload.find({
    collection: 'activity',
    depth: 1,
    limit: 0,
    pagination: false,
    sort: 'startAt',
    where,
    overrideAccess: true,
  })

  return result.docs
}

export const loadMunicipalityNames = async (
  payload: Payload,
  ids: number[],
): Promise<Map<number, string>> => {
  if (ids.length === 0) return new Map()

  // Intentional admin bypass: municipality names are public metadata,
  // not PII; the feed endpoint already scoped the ids to the creator's access.
  const result = await payload.find({
    collection: 'municipality',
    depth: 0,
    limit: 0,
    pagination: false,
    where: { id: { in: ids } },
    overrideAccess: true,
  })

  const names = new Map<number, string>()
  for (const doc of result.docs) {
    names.set(doc.id, doc.name)
  }
  return names
}

export const resolveFeedCreatorAccess = async (
  payload: Payload,
  feed: CalendarFeed,
): Promise<{
  accessible: boolean
  municipalityIds: number[] | null
}> => {
  const creatorId = typeof feed.createdBy === 'number' ? feed.createdBy : feed.createdBy?.id

  if (!creatorId) {
    return { accessible: false, municipalityIds: null }
  }

  try {
    // Intentional admin bypass: the feed endpoint has no authenticated user,
    // so we must reload the creator to verify their account still exists.
    const creator = await payload.findByID({
      collection: 'campaignUser',
      id: creatorId,
      depth: 0,
      overrideAccess: true,
    })

    if (!creator) {
      return { accessible: false, municipalityIds: null }
    }

    if (creator.role === 'coordinator' || creator.role === 'candidate') {
      return { accessible: true, municipalityIds: null }
    }

    if (creator.role === 'advisor') {
      // Intentional admin bypass: advisor municipality assignments are
      // internal metadata; the feed endpoint re-derives scope from them.
      const municipalities = await payload.find({
        collection: 'municipality',
        depth: 0,
        limit: 0,
        pagination: false,
        where: { advisors: { equals: creatorId } },
        overrideAccess: true,
      })
      return {
        accessible: true,
        municipalityIds: municipalities.docs.map((m) => m.id),
      }
    }

    return { accessible: false, municipalityIds: null }
  } catch {
    return { accessible: false, municipalityIds: null }
  }
}
