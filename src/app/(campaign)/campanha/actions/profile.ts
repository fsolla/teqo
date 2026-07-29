'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'
import { getPayload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  CAMPAIGN_SESSION_EXPIRED_MESSAGE,
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import {
  assertCampaignAvatarFile,
  CAMPAIGN_AVATAR_SAFE_ERROR_MESSAGES,
} from '@/utilities/campaignUserProfile'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

const deleteAvatarMedia = async (
  payload: Payload,
  req: PayloadTransactionRequest,
  mediaID: number | null,
): Promise<void> => {
  if (mediaID === null) return

  await payload.delete({
    collection: 'media',
    id: mediaID,
    overrideAccess: true,
    req,
  })
}

export const updateCampaignAvatarFormAction = async (
  _previousState: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  const user = await getCampaignUser()
  if (!user) {
    return { message: CAMPAIGN_SESSION_EXPIRED_MESSAGE }
  }

  const file = formData.get('avatar')
  if (!(file instanceof File)) {
    return { fieldErrors: { avatar: ['Selecione uma imagem.'] } }
  }

  try {
    assertCampaignAvatarFile(file)
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      genericMessage: 'Não foi possível atualizar a foto.',
      safeMessages: CAMPAIGN_AVATAR_SAFE_ERROR_MESSAGES,
    })
  }

  const payload = await getPayload({ config })
  const previousAvatarID = relationshipId(user.avatar)

  try {
    await withPayloadTransaction(payload, async ({ req }) => {
      const media = await payload.create({
        collection: 'media',
        data: { alt: user.name },
        file: {
          data: Buffer.from(await file.arrayBuffer()),
          mimetype: file.type,
          name: file.name,
          size: file.size,
        },
        overrideAccess: true,
        req,
      })

      await payload.update({
        collection: 'campaignUser',
        id: user.id,
        data: { avatar: media.id },
        depth: 0,
        overrideAccess: true,
        user,
        req,
      })

      if (previousAvatarID !== null && previousAvatarID !== media.id) {
        await deleteAvatarMedia(payload, req, previousAvatarID)
      }
    })
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      genericMessage: 'Não foi possível atualizar a foto.',
      safeMessages: CAMPAIGN_AVATAR_SAFE_ERROR_MESSAGES,
    })
  }

  revalidatePath('/campanha', 'layout')
  return {
    status: 'success',
    message: 'Foto de perfil atualizada.',
  }
}

export const removeCampaignAvatarFormAction = async (
  _previousState: CampaignFormActionState,
  _formData: FormData,
): Promise<CampaignFormActionState> => {
  const user = await getCampaignUser()
  if (!user) {
    return { message: CAMPAIGN_SESSION_EXPIRED_MESSAGE }
  }

  const previousAvatarID = relationshipId(user.avatar)
  if (previousAvatarID === null) {
    return { status: 'success', message: 'Foto de perfil removida.' }
  }

  const payload = await getPayload({ config })

  try {
    await withPayloadTransaction(payload, async ({ req }) => {
      await payload.update({
        collection: 'campaignUser',
        id: user.id,
        data: { avatar: null },
        depth: 0,
        overrideAccess: true,
        user,
        req,
      })

      await deleteAvatarMedia(payload, req, previousAvatarID)
    })
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      genericMessage: 'Não foi possível remover a foto.',
      safeMessages: CAMPAIGN_AVATAR_SAFE_ERROR_MESSAGES,
    })
  }

  revalidatePath('/campanha', 'layout')
  return {
    status: 'success',
    message: 'Foto de perfil removida.',
  }
}
