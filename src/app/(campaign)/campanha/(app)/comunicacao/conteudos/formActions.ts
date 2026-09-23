'use server'

import { revalidatePath } from 'next/cache'

import { updateContentPieceForActor } from '@/app/(campaign)/campanha/actions/contentPieces'
import { CAMPAIGN_COMMUNICATION_CONTEUDOS } from '@/lib/campaignPaths'
import { isContentPieceType } from '@/lib/contentPiece'
import {
  nullableFormText,
  repeatedFormTexts,
  requiredFormText,
  requiredIntegerFormValue,
} from '@/lib/formData'
import {
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  CONTENT_PIECE_SAFE_MESSAGES,
  CONTENT_PIECE_TYPE_INVALID_MESSAGE,
} from '@/lib/schemas/contentPiece'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

/**
 * C211 — the ficha form action. Keeps the route-owned revalidation (list and
 * ficha) and maps the domain errors through the shared ladder: the action
 * itself owns the gate, the curated fields and the relationships.
 */
export const updateContentPieceFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const contentPieceId = requiredIntegerFormValue(formData, 'contentPieceId')
      const type = requiredFormText(formData, 'type')
      if (!isContentPieceType(type)) {
        throw new Error(CONTENT_PIECE_TYPE_INVALID_MESSAGE)
      }
      const municipalityValue = optionalMunicipalityId(formData)

      await updateContentPieceForActor({
        contentPieceId,
        title: requiredFormText(formData, 'title'),
        description: nullableFormText(formData, 'description'),
        type,
        pieceDate: nullableFormText(formData, 'pieceDate'),
        topics: repeatedFormTexts(formData, 'topics'),
        municipalityId: municipalityValue,
        institution: nullableFormText(formData, 'institution'),
        transcript: nullableFormText(formData, 'transcript'),
      })

      revalidatePath(CAMPAIGN_COMMUNICATION_CONTEUDOS)
      revalidatePath(`${CAMPAIGN_COMMUNICATION_CONTEUDOS}/${contentPieceId}`)
      return { message: 'Alterações salvas.' }
    },
    safeMessages: CONTENT_PIECE_SAFE_MESSAGES,
    genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  })

const optionalMunicipalityId = (formData: FormData): number | null | undefined => {
  if (!formData.has('municipalityId')) return undefined
  const raw = String(formData.get('municipalityId') ?? '').trim()
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}
