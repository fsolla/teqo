import type { AIToolContext } from '@/lib/ai/types'
import { assertCanReadElectionData } from '@/utilities/campaignAccess'

/**
 * Fail-closed election-data gate for the AI chat tools. Returns `true` for
 * staff actors and the chat-shaped denial for everyone else (leader lockdown:
 * "liderança não tem essa conversa"). The error object is the exact shape
 * tools return, so call sites just early-return it — one source of truth for
 * the message across the three election tools.
 */
export const electionDataGate = (
  ctx: AIToolContext,
): true | { error: 'Leitura de dados eleitorais negada.' } => {
  try {
    assertCanReadElectionData(ctx.user)
    return true
  } catch {
    return { error: 'Leitura de dados eleitorais negada.' }
  }
}
