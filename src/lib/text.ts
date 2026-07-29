/** `value.trim()` when it is a string, `''` otherwise (P3-I — was byte-identical in 4 collections). */
export const trimmedText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

/** One day in milliseconds — THE neutral spelling (P3-K; was ×3, one of them in `suggestionCatalog`'s public interface). */
export const DAY_MS = 86_400_000
