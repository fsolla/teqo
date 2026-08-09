import { deepInfraTranscribe } from '@/utilities/ai/deepInfraTranscribe'
import { checkRateLimit, RATE_LIMIT_EXCEEDED_MESSAGE } from '@/utilities/ai/rateLimit'
import { getCampaignUserRaw } from '@/utilities/campaignAuth'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

export const maxDuration = 60

/**
 * B173: voice transcription for the Sollinha chat. The client records audio
 * (MediaRecorder) and POSTs the clip as multipart `file`; this route guards it
 * exactly like the chat send (cookie auth, same rate-limit bucket, same-origin)
 * and forwards to Deep Infra Whisper large-v3. The audio is never persisted —
 * it exists only in memory for the duration of the provider call, then the
 * transcript text becomes an editable draft in the chat input.
 *
 * A deliberate sibling of `/campanha/api/ai-chat`: multipart (not JSON), so it
 * cannot ride `campaignJsonMutationRoute`; both origin-check and rate-limit by
 * the same per-user bucket so voice cannot become a bypass of the text limit.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: 'Requisição inválida.' }, { status: 403 })
  }

  const user = await getCampaignUserRaw()
  if (!user) {
    return Response.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  if (!checkRateLimit(user.id)) {
    return Response.json({ error: RATE_LIMIT_EXCEEDED_MESSAGE }, { status: 429 })
  }

  let file: Blob
  try {
    const form = await request.formData()
    const entry = form.get('file')
    if (!(entry instanceof File)) {
      return Response.json({ error: 'Arquivo de áudio ausente.' }, { status: 400 })
    }
    file = entry
  } catch {
    return Response.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const result = await deepInfraTranscribe(file)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  return Response.json({ text: result.text })
}
