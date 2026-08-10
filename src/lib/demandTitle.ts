import { slugify } from '@/lib/slug'

export const DEMAND_TITLE_MAX_LENGTH = 160

/**
 * A derived demand title is usable when it fits the collection constraints
 * (minLength 2 / maxLength 160) and still produces a non-empty URL slug —
 * the same letters-or-numbers requirement `setCanonicalDemandSlug` enforces.
 */
export const isUsableDemandTitle = (title: string): boolean => {
  const trimmed = title.trim()
  return (
    trimmed.length >= 2 && trimmed.length <= DEMAND_TITLE_MAX_LENGTH && slugify(trimmed).length > 0
  )
}

/**
 * Deterministic fallback for the AI-derived demand title (B195): the single
 * free-text field collapsed to one line and truncated to the title bound.
 * Never fails — garbage in produces a garbage title, and the collection's
 * own letters-or-numbers check rejects it with the usual message.
 */
export const fallbackDemandTitle = (description: string): string =>
  description.trim().replace(/\s+/g, ' ').slice(0, DEMAND_TITLE_MAX_LENGTH).trim()
