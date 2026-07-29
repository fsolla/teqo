'use server'

import { revalidatePath } from 'next/cache'

import {
  CAMPAIGN_BIOMETRIC_REMOVE_ERROR_MESSAGE,
  CAMPAIGN_BIOMETRIC_REMOVED_MESSAGE,
} from '@/lib/campaignAuthCopy'
import type { CampaignPasskeyRemoveInput } from '@/lib/schemas/campaignWebAuthn'
import { campaignPasskeyRemoveSchema } from '@/lib/schemas/campaignWebAuthn'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { runCampaignFormAction } from '@/utilities/campaignFormActionError'
import {
  CAMPAIGN_PASSKEY_REMOVE_DENIED_MESSAGE,
  removeCampaignPasskey,
} from '@/utilities/webauthn/campaignWebAuthnCeremony'

/**
 * Revokes one enrolled device. The delete runs with `overrideAccess: false`, so
 * the owner-only row constraint on `campaignWebAuthnCredential` — not this
 * action — is what refuses somebody else's passkey.
 *
 * The return type is annotated, not inferred: `runCampaignFormAction` types its
 * failure branch without a `status` key at all, so the caller can only narrow on
 * `status === 'success'` through `CampaignFormActionState`, where it is optional.
 */
export const removeCampaignPasskeyAction = async (
  input: CampaignPasskeyRemoveInput,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const { passkeyId } = campaignPasskeyRemoveSchema.parse(input)
      const { payload, actor } = await getCampaignActionContext()

      await removeCampaignPasskey(payload, actor, passkeyId)

      revalidatePath('/campanha/perfil')
      return { message: CAMPAIGN_BIOMETRIC_REMOVED_MESSAGE }
    },
    safeMessages: [CAMPAIGN_PASSKEY_REMOVE_DENIED_MESSAGE],
    genericMessage: CAMPAIGN_BIOMETRIC_REMOVE_ERROR_MESSAGE,
  })
