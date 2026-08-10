import { deepSeek } from '@ai-sdk/deepseek'
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
import { splitSollinhaFollowUpBlock } from '@/lib/sollinhaFollowUpSuggestions'

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

  const modelMessages = await convertToModelMessages(messages)

  // B192 — the follow-up block is a format directive for the chat UI, not
  // conversation content: strip it before the model ever sees it again, so a
  // previous answer's suggestions neither echo back nor burn context. Uses the
  // same pure splitter as the client (idempotent; no block → unchanged).
  const strippedMessages = modelMessages.map((message) => {
    if (message.role !== 'assistant') return message
    const content = Array.isArray(message.content)
      ? message.content.map((part) =>
          part.type === 'text'
            ? { ...part, text: splitSollinhaFollowUpBlock(part.text).body }
            : part,
        )
      : typeof message.content === 'string'
        ? splitSollinhaFollowUpBlock(message.content).body
        : message.content
    return { ...message, content }
  })

  const result = streamText({
    model: deepSeek('deepseek-v4-flash'),
    system: AI_SYSTEM_PROMPT,
    messages: strippedMessages,
    tools: buildAITools({ user, payload }),
    stopWhen: stepCountIs(10),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  })
}
