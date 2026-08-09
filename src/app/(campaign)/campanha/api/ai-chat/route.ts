import { deepInfra } from '@ai-sdk/deepinfra'
import configPromise from '@payload-config'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from 'ai'
import { getPayload } from 'payload'

import { checkRateLimit } from '@/utilities/ai/rateLimit'
import { AI_SYSTEM_PROMPT } from '@/utilities/ai/systemPrompt'
import { buildAITools } from '@/utilities/ai/tools'
import { getCampaignUserRaw } from '@/utilities/campaignAuth'

export const maxDuration = 60

export async function POST(req: Request) {
  // Authenticate
  const user = await getCampaignUserRaw()
  if (!user) {
    return Response.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  // Rate limit
  if (!checkRateLimit(user.id)) {
    return Response.json(
      {
        error: 'Você atingiu o limite de mensagens. Aguarde alguns minutos e tente novamente.',
      },
      { status: 429 },
    )
  }

  const payload = await getPayload({ config: configPromise })

  const { messages } = await req.json()

  const result = streamText({
    model: deepInfra('deepseek-ai/DeepSeek-V4-Flash'),
    system: AI_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: buildAITools({ user, payload }),
    stopWhen: stepCountIs(10),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  })
}
