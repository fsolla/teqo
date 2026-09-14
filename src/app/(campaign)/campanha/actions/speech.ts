'use server'

import { canReadSpeechCatalog } from '@/lib/campaignRoles'
import {
  SPEECH_VOD_FORBIDDEN_MESSAGE,
  SPEECH_VOD_INELIGIBLE_MESSAGE,
  SPEECH_VOD_NOT_FOUND_MESSAGE,
  speechVodRequestSchema,
} from '@/lib/schemas/speechVod'
import { speechVodCoordinates, type SpeechVodResolution } from '@/lib/speechVod'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { resolveSpeechVod } from '@/utilities/speech/speechVodResolver'

/**
 * C162 — resolves the exact excerpt MP4 for one speech through the Câmara
 * `video-sob-demanda` endpoint. The catalog gate is checked BEFORE the read so
 * a denied actor gets the domain message (the read itself runs with
 * `overrideAccess: false` and would only yield "not found"). The stored VOD
 * link is an eligibility signal, never a URL handed to the client: the
 * resolution owns the truth, and the response only carries probed links.
 */
export const resolveSpeechVodForActor = async (input: {
  speechId: number
}): Promise<SpeechVodResolution> => {
  const { speechId } = speechVodRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadSpeechCatalog(actor.role)) throw new Error(SPEECH_VOD_FORBIDDEN_MESSAGE)

  const result = await payload.find({
    collection: 'speech',
    where: { id: { equals: speechId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: {
      eventId: true,
      audioId: true,
      excerptTMs: true,
      vodPlaybackUrl: true,
      vodDownloadUrl: true,
    },
    user: actor,
    overrideAccess: false,
  })
  const speech = result.docs[0]
  if (!speech) throw new Error(SPEECH_VOD_NOT_FOUND_MESSAGE)

  const coordinates = speechVodCoordinates(speech)
  if (!coordinates) throw new Error(SPEECH_VOD_INELIGIBLE_MESSAGE)

  return resolveSpeechVod(coordinates)
}
