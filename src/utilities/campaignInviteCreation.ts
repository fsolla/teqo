import 'server-only'

import type { Payload } from 'payload'

import {
  campaignInviteCreateSchema,
  type CampaignInviteCreateInput,
} from '@/lib/schemas/invite'
import type { CampaignUser } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { reloadCampaignActor } from '@/utilities/campaignActionContext'
import {
  buildCampaignInviteWhatsAppLink,
  campaignInviteExpiry,
  generateCampaignInviteToken,
} from '@/utilities/campaignInvite'
import { requireLeadershipConsent } from '@/utilities/campaignConsent'
import {
  createCampaignInviteRecord,
  requireCampaignInvitePostgres,
  revokePriorActiveCampaignInvites,
} from '@/utilities/campaignInviteRepository'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { requireRelationshipId } from '@/utilities/relationship'

const MISSING_CONSENT_MESSAGE = 'Consentimento ainda não configurado.'

const getFreshInviteCreator = async (
  payload: Payload,
  actor: CampaignUser,
  req: PayloadTransactionRequest,
): Promise<CampaignUser> => {
  const currentActor = await reloadCampaignActor(payload, actor, req)
  // Staff only (coordinator, advisor, candidate) — matches the collection-level
  // `canCreateCampaignInvite` scope; the leadership read below narrows advisors.
  if (!isCampaignStaff(currentActor)) {
    throw new Error('Somente a coordenação pode criar convites.')
  }
  return currentActor
}

export const createCampaignInviteForActor = async (
  payload: Payload,
  actor: CampaignUser,
  input: CampaignInviteCreateInput,
  inviteBaseURL: string,
): Promise<{ inviteUrl: string; whatsappUrl: string }> => {
  const data = campaignInviteCreateSchema.parse(input)
  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      requireCampaignInvitePostgres(payload)
      const currentActor = await getFreshInviteCreator(payload, actor, req)
      await requireLeadershipConsent(payload, req, MISSING_CONSENT_MESSAGE)
      const leadership = await payload.findByID({
        collection: 'leadership',
        id: data.leadership,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
      if (data.kind === 'login' && leadership.supportStatus !== 'engajado') {
        throw new Error('Convites de acesso exigem uma liderança engajada.')
      }

      // The fresh staff actor and scoped Leadership authorize these trusted lifecycle reads/writes.
      await revokePriorActiveCampaignInvites(payload, req, leadership.id, data.kind)
      const generated = generateCampaignInviteToken()
      await createCampaignInviteRecord(payload, req, {
        tokenHash: generated.tokenHash,
        leadershipID: leadership.id,
        kind: data.kind,
        expiresAt: campaignInviteExpiry().toISOString(),
        createdBy: currentActor.id,
      })
      const contact = await payload.findByID({
        collection: 'contact',
        id: requireRelationshipId(leadership.contact),
        depth: 0,
        overrideAccess: true,
        req,
      })
      const inviteUrl = `${inviteBaseURL}/campanha/convite/${generated.token}`
      return {
        inviteUrl,
        whatsappUrl: buildCampaignInviteWhatsAppLink({
          phone: contact.phone,
          recipientName: contact.name,
          senderName: currentActor.name,
          inviteUrl,
          kind: data.kind,
        }),
      }
    },
    { beginFailureMessage: 'Não foi possível iniciar a transação do convite.' },
  )
}
