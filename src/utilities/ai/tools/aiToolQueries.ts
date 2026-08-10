import type { AIToolContext } from '@/lib/ai/types'

/**
 * Shared name lookups of the campaign intelligence tools (family B185/B189):
 * names are resolved in dedicated queries with the actor's own access — never
 * `depth` populating `campaignUser`/`contact`.
 */
export const loadAIToolNamesByIds = async (
  ctx: AIToolContext,
  collection: 'contact' | 'campaignUser',
  ids: number[],
): Promise<Map<number, string>> => {
  const names = new Map<number, string>()
  if (ids.length === 0) return names
  const result = await ctx.payload.find({
    collection,
    where: { id: { in: ids } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true },
    overrideAccess: false,
    user: ctx.user,
  })
  for (const doc of result.docs) names.set(doc.id, doc.name)
  return names
}
