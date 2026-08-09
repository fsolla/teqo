'use server'

import { randomUUID } from 'node:crypto'

import { calendarFeedCreateSchema, type CalendarFeedCreateInput } from '@/lib/schemas/calendarFeed'
import type { CalendarFeed, CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import { getCampaignInviteBaseURL } from '@/utilities/campaignInviteOrigin'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import type { Payload } from 'payload'

const CALENDAR_FEED_STAFF_ONLY_MESSAGE =
  'Apenas a equipe da campanha pode criar feeds de calendário.'
const CALENDAR_FEED_CREATE_FAILED_MESSAGE = 'Não foi possível criar o feed de calendário.'
const CALENDAR_FEED_FILTER_OUT_OF_SCOPE_MESSAGE =
  'Não foi possível criar o feed: o município do filtro está fora do seu escopo.'

export type CalendarFeedLinkResult =
  | { ok: true; feedUrl: string; feedId: number }
  | { ok: false; message: string }

const buildFeedUrl = (secretSlug: string): string => {
  const baseUrl = getCampaignInviteBaseURL()
  return `${baseUrl}/campanha/agenda/ical/${secretSlug}`
}

export const createCalendarFeedLinkRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: CalendarFeedCreateInput,
): Promise<CalendarFeedLinkResult> => {
  const data = calendarFeedCreateSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadStaffActor(
        payload,
        actor,
        CALENDAR_FEED_STAFF_ONLY_MESSAGE,
        req,
      )

      if (data.filterMunicipality) {
        await assertFilterMunicipalityInScope(payload, currentActor, data.filterMunicipality, req)
      }

      const secretSlug = randomUUID()

      const feed = (await payload.create({
        collection: 'calendarFeed',
        // `createdBy` is filled by the `stampCampaignCreatedBy` beforeChange hook
        // from the acting campaign user — never taken from the client.
        data: hookFilledCreateData<'calendarFeed'>({
          secretSlug,
          label: data.label,
          filterMunicipality: data.filterMunicipality,
          filterDeputyPresent: data.filterDeputyPresent ?? false,
          filterTag: data.filterTag,
        }),
        depth: 0,
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
}

export const createCalendarFeedLink = async (
  input: CalendarFeedCreateInput,
): Promise<CalendarFeedLinkResult> => {
  const { payload, actor } = await getCampaignActionContext()

  try {
    return await createCalendarFeedLinkRecord(payload, actor, input)
  } catch (error) {
    console.error('createCalendarFeedLink failed', error)
    const message =
      error instanceof Error && error.message === CALENDAR_FEED_FILTER_OUT_OF_SCOPE_MESSAGE
        ? error.message
        : CALENDAR_FEED_CREATE_FAILED_MESSAGE
    return { ok: false, message }
  }
}

export const revokeCalendarFeedRecord = async (
  payload: Payload,
  actor: CampaignUser,
  feedId: number,
): Promise<{ ok: boolean }> => {
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
}

export const revokeCalendarFeed = async (feedId: number): Promise<{ ok: boolean }> => {
  const { payload, actor } = await getCampaignActionContext()

  try {
    return await revokeCalendarFeedRecord(payload, actor, feedId)
  } catch (error) {
    console.error('revokeCalendarFeed failed', error)
    return { ok: false }
  }
}

export const listCalendarFeedsRecord = async (
  payload: Payload,
  actor: CampaignUser,
): Promise<CalendarFeed[]> => {
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

export const listCalendarFeeds = async (): Promise<CalendarFeed[]> => {
  const { payload, actor } = await getCampaignActionContext()
  return listCalendarFeedsRecord(payload, actor)
}

/**
 * Verifies a staff actor may pin `filterMunicipality` to a given municipality —
 * fail-closed for advisors (the collection create access is a plain staff
 * boolean and cannot express a per-município constraint, the same reason the
 * tour composer re-checks its stops in `activity.ts`). The scoped read resolves
 * against the feed author's own accessible set, so an out-of-scope id never
 * survives.
 */
const assertFilterMunicipalityInScope = async (
  payload: Payload,
  actor: CampaignUser,
  municipalityId: number,
  req?: PayloadTransactionRequest,
): Promise<void> => {
  const readable = await payload.find({
    collection: 'municipality',
    where: { id: { equals: municipalityId } },
    depth: 0,
    limit: 1,
    pagination: false,
    user: actor,
    overrideAccess: false,
    req,
  })
  if (readable.docs.length !== 1) {
    throw new Error(CALENDAR_FEED_FILTER_OUT_OF_SCOPE_MESSAGE)
  }
}
