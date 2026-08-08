'use server'

import { randomUUID } from 'node:crypto'

import { calendarFeedCreateSchema, type CalendarFeedCreateInput } from '@/lib/schemas/calendarFeed'
import type { CalendarFeed } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import { getCampaignInviteBaseURL } from '@/utilities/campaignInviteOrigin'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

const CALENDAR_FEED_STAFF_ONLY_MESSAGE =
  'Apenas a equipe da campanha pode criar feeds de calendário.'
const CALENDAR_FEED_CREATE_FAILED_MESSAGE = 'Não foi possível criar o feed de calendário.'

export type CalendarFeedLinkResult =
  | { ok: true; feedUrl: string; feedId: number }
  | { ok: false; message: string }

const buildFeedUrl = (secretSlug: string): string => {
  const baseUrl = getCampaignInviteBaseURL()
  return `${baseUrl}/campanha/agenda/ical/${secretSlug}`
}

export const createCalendarFeedLinkRecord = async (
  input: CalendarFeedCreateInput,
): Promise<CalendarFeedLinkResult> => {
  const data = calendarFeedCreateSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  try {
    return await withPayloadTransaction(
      payload,
      async ({ req }) => {
        const currentActor = await reloadStaffActor(
          payload,
          actor,
          CALENDAR_FEED_STAFF_ONLY_MESSAGE,
          req,
        )

        if (!isCampaignStaff(currentActor)) {
          return { ok: false as const, message: CALENDAR_FEED_STAFF_ONLY_MESSAGE }
        }

        const secretSlug = randomUUID()

        const feed = (await payload.create({
          collection: 'calendarFeed',
          data: {
            secretSlug,
            label: data.label,
            filterMunicipality: data.filterMunicipality,
            filterDeputyPresent: data.filterDeputyPresent ?? false,
            filterTag: data.filterTag,
            createdBy: currentActor.id,
          },
          depth: 0,
          draft: false,
          user: currentActor,
          overrideAccess: false,
          req,
        })) as CalendarFeed

        return {
          ok: true as const,
          feedUrl: buildFeedUrl(secretSlug),
          feedId: feed.id,
        }
      },
      { beginFailureMessage: 'Não foi possível iniciar a criação do feed de calendário.' },
    )
  } catch {
    return { ok: false, message: CALENDAR_FEED_CREATE_FAILED_MESSAGE }
  }
}

export const revokeCalendarFeedRecord = async (feedId: number): Promise<{ ok: boolean }> => {
  const { payload, actor } = await getCampaignActionContext()

  try {
    await withPayloadTransaction(
      payload,
      async ({ req }) => {
        const currentActor = await reloadStaffActor(
          payload,
          actor,
          CALENDAR_FEED_STAFF_ONLY_MESSAGE,
          req,
        )

        await payload.update({
          collection: 'calendarFeed',
          id: feedId,
          data: { revokedAt: new Date().toISOString() },
          depth: 0,
          user: currentActor,
          overrideAccess: false,
          req,
        })
      },
      { beginFailureMessage: 'Não foi possível revogar o feed de calendário.' },
    )
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export const listCalendarFeedsRecord = async (): Promise<CalendarFeed[]> => {
  const { payload, actor } = await getCampaignActionContext()

  const result = await payload.find({
    collection: 'calendarFeed',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: '-createdAt',
    where: { revokedAt: { exists: false } },
    user: actor,
    overrideAccess: false,
  })

  return result.docs
}
