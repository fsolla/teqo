'use server'

import { randomBytes } from 'node:crypto'

import type { CampaignUser } from '@/payload-types'
import type { Payload } from 'payload'

import { buildGoogleCalendarAddLink } from '@/lib/googleCalendarLink'
import { buildGoogleCalendarOAuthAuthorizeUrl } from '@/lib/googleCalendarOAuth'
import { canManageGoogleCalendarConnection } from '@/utilities/access/googleCalendarSync'
import {
  getCampaignActionContext,
  reloadCampaignActor,
  reloadStaffActor,
} from '@/utilities/campaignActionContext'
import {
  buildGoogleCalendarOAuthRedirectUri,
  readGoogleCalendarOAuthCredentials,
  storeGoogleCalendarOAuthState,
} from '@/utilities/googleCalendarOAuth'
import {
  clearGoogleCalendarOAuthConnection,
  loadGoogleCalendarSyncConfig,
  readGoogleCalendarSyncView,
  runCampaignCalendarSync,
  type GoogleCalendarSyncView,
} from '@/utilities/googleCalendarSync'

const GOOGLE_CALENDAR_SYNC_STAFF_ONLY_MESSAGE =
  'Apenas a equipe da campanha pode gerenciar a sincronização com o Google.'
const GOOGLE_CALENDAR_SYNC_FAILED_MESSAGE =
  'Não foi possível atualizar o estado da sincronização com o Google.'
const GOOGLE_CALENDAR_OAUTH_MANAGER_ONLY_MESSAGE =
  'Apenas candidato ou coordenação pode conectar ou desconectar a conta Google da campanha.'
const GOOGLE_CALENDAR_OAUTH_UNAVAILABLE_MESSAGE =
  'A conexão com o Google ainda não está configurada no servidor. Fale com a equipe técnica.'

export type GoogleCalendarSyncActionResult = {
  ok: boolean
  message?: string
  /** C149 — the actor may connect/disconnect (candidate or coordinator). */
  canManageConnection: boolean
} & GoogleCalendarSyncView & { addLink: string | null }

export type GoogleCalendarOAuthStartResult =
  | { ok: true; authorizeUrl: string }
  | { ok: false; message: string }

const withLinks = (
  view: GoogleCalendarSyncView,
): Omit<GoogleCalendarSyncActionResult, 'ok' | 'canManageConnection'> => ({
  ...view,
  addLink: view.calendarId ? buildGoogleCalendarAddLink(view.calendarId) : null,
})

const failure = (
  message: string,
  canManageConnection: boolean,
): GoogleCalendarSyncActionResult => ({
  ok: false,
  message,
  canManageConnection,
  status: 'not-configured',
  connection: 'not-configured',
  oauthAvailable: false,
  oauthConnectedAt: null,
  oauthError: null,
  calendarId: null,
  lastSyncedAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  pushChannelExpiresAt: null,
  pushChannelError: null,
  addLink: null,
})

const requireStaff = async (payload: Payload, actor: CampaignUser): Promise<CampaignUser> =>
  reloadStaffActor(payload, actor, GOOGLE_CALENDAR_SYNC_STAFF_ONLY_MESSAGE)

/**
 * C149 — reloads the actor and returns them only when they may manage the
 * connection (candidate/coordinator). The role check runs on the fresh
 * document; `null` means "refused", never "not loaded".
 */
const loadConnectionManager = async (
  payload: Payload,
  actor: CampaignUser,
): Promise<CampaignUser | null> => {
  const currentActor = await reloadCampaignActor(payload, actor)
  return canManageGoogleCalendarConnection(currentActor) ? currentActor : null
}

/** Read model for the agenda pill/dialog — status derived, never stored. */
export const getGoogleCalendarSyncState = async (): Promise<GoogleCalendarSyncActionResult> => {
  const { payload, actor } = await getCampaignActionContext()

  try {
    const currentActor = await requireStaff(payload, actor)
    return {
      ok: true,
      canManageConnection: canManageGoogleCalendarConnection(currentActor),
      ...withLinks(await readGoogleCalendarSyncView(payload)),
    }
  } catch (error) {
    console.error('getGoogleCalendarSyncState failed', error)
    return failure(GOOGLE_CALENDAR_SYNC_FAILED_MESSAGE, canManageGoogleCalendarConnection(actor))
  }
}

/** Manual retry / auto-retry (agenda page view when paused). */
export const runGoogleCalendarSyncNow = async (): Promise<GoogleCalendarSyncActionResult> => {
  const { payload, actor } = await getCampaignActionContext()

  try {
    const currentActor = await requireStaff(payload, actor)
    await runCampaignCalendarSync(payload, { reason: 'manual' })
    return {
      ok: true,
      canManageConnection: canManageGoogleCalendarConnection(currentActor),
      ...withLinks(await readGoogleCalendarSyncView(payload)),
    }
  } catch (error) {
    console.error('runGoogleCalendarSyncNow failed', error)
    return failure(GOOGLE_CALENDAR_SYNC_FAILED_MESSAGE, canManageGoogleCalendarConnection(actor))
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
    return {
      ok: true,
      canManageConnection: canManageGoogleCalendarConnection(currentActor),
      ...withLinks(await readGoogleCalendarSyncView(payload)),
    }
  } catch (error) {
    console.error('setGoogleCalendarSyncDisabled failed', error)
    return failure(GOOGLE_CALENDAR_SYNC_FAILED_MESSAGE, canManageGoogleCalendarConnection(actor))
  }
}

/**
 * C149 — starts the OAuth handshake: validates the manager role, ensures the
 * singleton connection row exists, stores the signed single-use `state` cookie
 * and returns the Google consent URL for the client to navigate to. The
 * authorize URL is built from the canonical public origin (never the request),
 * so a callback behind the Cloudflare tunnel cannot leak localhost.
 */
export const startGoogleCalendarOAuth = async (): Promise<GoogleCalendarOAuthStartResult> => {
  const { payload, actor } = await getCampaignActionContext()

  try {
    if (!(await loadConnectionManager(payload, actor))) {
      return { ok: false, message: GOOGLE_CALENDAR_OAUTH_MANAGER_ONLY_MESSAGE }
    }

    const credentials = readGoogleCalendarOAuthCredentials()
    if (!credentials) {
      return { ok: false, message: GOOGLE_CALENDAR_OAUTH_UNAVAILABLE_MESSAGE }
    }
    // Resolved BEFORE any write: a missing canonical origin throws here and
    // must not leave a stray connection row behind.
    const redirectUri = buildGoogleCalendarOAuthRedirectUri()

    // The connection may exist before any calendar is chosen (C150 picks it).
    // Payload's Local API without `user` needs the explicit admin bypass; the
    // role check above is the authorization for this system write.
    const doc = await loadGoogleCalendarSyncConfig(payload)
    if (!doc) {
      await payload.create({
        collection: 'googleCalendarSync',
        data: {},
        depth: 0,
        overrideAccess: true,
      })
    }

    const state = randomBytes(32).toString('base64url')
    await storeGoogleCalendarOAuthState(state, actor.id)

    return {
      ok: true,
      authorizeUrl: buildGoogleCalendarOAuthAuthorizeUrl({
        clientId: credentials.clientId,
        redirectUri,
        state,
      }),
    }
  } catch (error) {
    console.error('startGoogleCalendarOAuth failed', error)
    return { ok: false, message: GOOGLE_CALENDAR_SYNC_FAILED_MESSAGE }
  }
}

/**
 * C149 — disconnects the OAuth account from the Teqo: drops the refresh token
 * and the connection state. The UI guides revoking the app access on the
 * Google account; the service account, when configured, takes over on the next
 * trigger.
 */
export const disconnectGoogleCalendarOAuth = async (): Promise<GoogleCalendarSyncActionResult> => {
  const { payload, actor } = await getCampaignActionContext()

  try {
    const currentActor = await loadConnectionManager(payload, actor)
    if (!currentActor) {
      return failure(GOOGLE_CALENDAR_OAUTH_MANAGER_ONLY_MESSAGE, false)
    }
    await clearGoogleCalendarOAuthConnection(payload)
    return {
      ok: true,
      canManageConnection: true,
      ...withLinks(await readGoogleCalendarSyncView(payload)),
    }
  } catch (error) {
    console.error('disconnectGoogleCalendarOAuth failed', error)
    return failure(GOOGLE_CALENDAR_SYNC_FAILED_MESSAGE, canManageGoogleCalendarConnection(actor))
  }
}
