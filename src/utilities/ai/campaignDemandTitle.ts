import 'server-only'

import { deepSeek } from '@ai-sdk/deepseek'
import { generateText } from 'ai'

import { isUsableDemandTitle } from '@/lib/demandTitle'
import { campaignDemandKindLabels, type CampaignDemandKind } from '@/lib/schemas/campaignDemand'

const DEMAND_TITLE_SYSTEM_PROMPT =
  'Você resume pedidos de campanha eleitoral em títulos curtos e objetivos para uma lista de demandas. ' +
  'Responda apenas com o título: uma frase de no máximo 80 caracteres, sem pontuação final, sem aspas, sem prefixos ' +
  'como "Pedido:" ou "Demanda:". Ex.: "500 santinhos para a feira de sábado", "Transporte para o comício do dia 12".'

const DEMAND_TITLE_TIMEOUT_MS = 4000

/**
 * One-shot AI title derivation for campaign demands (B195), on the Sollinha
 * path: DeepSeek server-side via `DEEPSEEK_API_KEY`. Never throws and never
 * blocks creation: missing key, timeout or unusable output all resolve to
 * `null`, and the caller owns the fallback policy (truncation on create,
 * keep-previous on edit).
 */
export const deriveDemandTitle = async (
  description: string,
  kind?: CampaignDemandKind,
): Promise<string | null> => {
  if (!process.env.DEEPSEEK_API_KEY) return null

  try {
    const { text } = await generateText({
      model: deepSeek('deepseek-v4-flash'),
      system: DEMAND_TITLE_SYSTEM_PROMPT,
      prompt: kind
        ? `Tipo: ${campaignDemandKindLabels[kind]}\nPedido: ${description}`
        : description,
      temperature: 0.3,
      maxOutputTokens: 120,
      abortSignal: AbortSignal.timeout(DEMAND_TITLE_TIMEOUT_MS),
    })
    return isUsableDemandTitle(text) ? text.trim() : null
  } catch {
    return null
  }
}
