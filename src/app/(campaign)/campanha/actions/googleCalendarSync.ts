'use server'

import type { CampaignUser } from '@/payload-types'
import type { Payload } from 'payload'

import { buildGoogleCalendarAddLink } from '@/lib/googleCalendarLink'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import {
  loadGoogleCalendarSyncConfig,
  readGoogleCalendarSyncView,
  runCampaignCalendarSync,
  type GoogleCalendarSyncView,
} from '@/utilities/googleCalendarSync'

const GOOGLE_CALENDAR_SYNC_STAFF_ONLY_MESSAGE =
  'Apenas a equipe da campanha pode gerenciar a sincronização com o Google.'
const GOOGLE_CALENDAR_SYNC_FAILED_MESSAGE =
  'Não foi possível atualizar o estado da sincronização com o Google.'

export type GoogleCalendarSyncActionResult = {
  ok: boolean
  message?: string
} & GoogleCalendarSyncView & { addLink: string | null }

const withLinks = (view: GoogleCalendarSyncView): Omit<GoogleCalendarSyncActionResult, 'ok'> => ({
  ...view,
  addLink: view.calendarId ? buildGoogleCalendarAddLink(view.calendarId) : null,
})

const failure = (message: string): GoogleCalendarSyncActionResult => ({
  ok: false,
  message,
  status: 'not-configured',
  calendarId: null,
  lastSyncedAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  addLink: null,
})

const requireStaff = async (payload: Payload, actor: CampaignUser): Promise<CampaignUser> =>
  reloadStaffActor(payload, actor, GOOGLE_CALENDAR_SYNC_STAFF_ONLY_MESSAGE)

/** Read model for the agenda pill/dialog — status derived, never stored. */
export const getGoogleCalendarSyncState = async (): Promise<GoogleCalendarSyncActionResult> => {
  const { payload, actor } = await getCampaignActionContext()

  try {
    await requireStaff(payload, actor)
    return { ok: true, ...withLinks(await readGoogleCalendarSyncView(payload)) }
  } catch (error) {
    console.error('getGoogleCalendarSyncState failed', error)
    return failure(GOOGLE_CALENDAR_SYNC_FAILED_MESSAGE)
  }
}

/** Manual retry / auto-retry (agenda page view when paused). */
export const runGoogleCalendarSyncNow = async (): Promise<GoogleCalendarSyncActionResult> => {
  const { payload, actor } = await getCampaignActionContext()

  try {
    await requireStaff(payload, actor)
    await runCampaignCalendarSync(payload, { reason: 'manual' })
    return { ok: true, ...withLinks(await readGoogleCalendarSyncView(payload)) }
  } catch (error) {
    console.error('runGoogleCalendarSyncNow failed', error)
    return failure(GOOGLE_CALENDAR_SYNC_FAILED_MESSAGE)
  }
}

/** Staff pauses/resumes the mirror — the afterChange hook reconciles on resume. */
export const setGoogleCalendarSyncDisabled = async (
  disabled: boolean,
): Promise<GoogleCalendarSyncActionResult> => {
  const { payload, actor } = await getCampaignActionContext()

  try {
    const currentActor = await requireStaff(payload, actor)
    const doc = await loadGoogleCalendarSyncConfig(payload)
    if (doc) {
      await payload.update({
        collection: 'googleCalendarSync',
        id: doc.id,
        data: { disabledAt: disabled ? new Date().toISOString() : null },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
      })
    }
    return { ok: true, ...withLinks(await readGoogleCalendarSyncView(payload)) }
  } catch (error) {
    console.error('setGoogleCalendarSyncDisabled failed', error)
    return failure(GOOGLE_CALENDAR_SYNC_FAILED_MESSAGE)
  }
}
